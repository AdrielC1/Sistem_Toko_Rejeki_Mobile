import { buildEscPosReceiptBytes } from "@/domain/escposBuilder";
import { formatRupiah, formatWibDateTime } from "@/domain/format";
import {
  buildCompletedOrderPayload,
  calculateCartSummary,
  calculateEffectiveUnitPrice,
  getAvailableUnitsForProduct,
} from "@/domain/pricing";
import {
  buildReceiptHtml,
  buildReceiptRenderLines,
} from "@/domain/receiptLayout";
import { POS_TABS_STORAGE_KEY, usePosCartStore } from "@/store/posCartStore";
import type { Product } from "@/types";
import { resetTestStorage } from "./setup";
import Storage from "expo-sqlite/kv-store";

function makeSampleProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-beras",
    sku: "BRS-01",
    barcode: "8990001",
    name: "Beras Pandan Wangi",
    categoryId: "cat-1",
    categoryName: "Sembako",
    unitId: "unit-kg",
    unitName: "Kg",
    sellingPrice: 15000,
    isOpenPrice: false,
    sellBaseUnit: true,
    stock: 100,
    isActive: true,
    wholesaleTiers: [
      { minQty: 5, price: 14000 },
      { minQty: 10, price: 13500 },
    ],
    unitConversions: [
      {
        id: "pu-sak",
        unitId: "unit-sak",
        unitName: "Sak 25Kg",
        conversionFactor: 25,
        sellingPrice: 325000,
        wholesaleTiers: [{ minQty: 3, price: 320000 }],
      },
      {
        id: "pu-zero",
        unitId: "unit-zero",
        unitName: "Nonaktif",
        conversionFactor: 2,
        sellingPrice: 0,
      },
    ],
    createdAt: "2026-11-19T00:00:00Z",
    updatedAt: "2026-11-19T00:00:00Z",
    ...overrides,
  };
}

describe("Phase 3 POS pricing domain, ESC/POS builder, receipt layout, and Zustand cart store", () => {
  beforeEach(() => {
    resetTestStorage();
    usePosCartStore.getState().resetAllTabsForTest();
  });

  it("formats Rupiah and WIB date cleanly", () => {
    expect(formatRupiah(150000)).toBe("Rp 150.000");
    expect(formatRupiah(0)).toBe("Rp 0");
    expect(formatWibDateTime("2026-11-19T03:05:00.000Z")).toBe(
      "19/11/2026 10:05 WIB"
    );
  });

  it("filters selectable units by sellBaseUnit and positive sellingPrice", () => {
    const prod = makeSampleProduct();
    const units = getAvailableUnitsForProduct(prod);
    expect(units.map((u) => u.unitId)).toEqual(["unit-kg", "unit-sak"]);

    const noBase = makeSampleProduct({ sellBaseUnit: false });
    expect(
      getAvailableUnitsForProduct(noBase).map((u) => u.unitId)
    ).toEqual(["unit-sak"]);

    const inactive = makeSampleProduct({ isActive: false });
    expect(getAvailableUnitsForProduct(inactive)).toEqual([]);

    const withInactiveVariant = makeSampleProduct({
      unitConversions: [
        {
          id: "pu-sak",
          unitId: "unit-sak",
          unitName: "Sak 25Kg",
          conversionFactor: 25,
          sellingPrice: 325000,
          isActive: false,
        },
      ],
    });
    expect(
      getAvailableUnitsForProduct(withInactiveVariant).map((u) => u.unitId)
    ).toEqual(["unit-kg"]);
  });

  it("computes wholesale tiers accurately and preserves manual isCustomPrice across qty changes", () => {
    const tiers = [
      { minQty: 5, price: 14000 },
      { minQty: 10, price: 13500 },
    ];
    expect(
      calculateEffectiveUnitPrice({
        baseUnitPrice: 15000,
        quantity: 4,
        wholesaleTiers: tiers,
      })
    ).toBe(15000);
    expect(
      calculateEffectiveUnitPrice({
        baseUnitPrice: 15000,
        quantity: 6,
        wholesaleTiers: tiers,
      })
    ).toBe(14000);
    expect(
      calculateEffectiveUnitPrice({
        baseUnitPrice: 15000,
        quantity: 12,
        wholesaleTiers: tiers,
        isCustomPrice: true,
        customPrice: 12500,
      })
    ).toBe(12500);
  });

  it("persists multi-tab orders to kv-store, preserves Open Price on qty taps, merges duplicate unit switches, and removes tabs", () => {
    const product = makeSampleProduct();
    const units = getAvailableUnitsForProduct(product);
    const kgUnit = units[0];
    const sakUnit = units[1];

    const store = usePosCartStore.getState();
    store.addItem(product, kgUnit, 5); // hits 14.000 tier!
    let tab = usePosCartStore.getState().tabs[0];
    expect(tab.items[0].effectiveUnitPrice).toBe(14000);
    expect(tab.items[0].subtotal).toBe(70000);
    expect(tab.items[0].wholesaleSavings).toBe(5000);

    // Apply custom Open Price then change qty -> customPrice stays locked!
    usePosCartStore.getState().setItemCustomPrice(product.id, kgUnit.unitId, 12000);
    usePosCartStore.getState().updateItemQuantity(product.id, kgUnit.unitId, 11);
    tab = usePosCartStore.getState().tabs[0];
    expect(tab.items[0].isCustomPrice).toBe(true);
    expect(tab.items[0].effectiveUnitPrice).toBe(12000);
    expect(tab.items[0].subtotal).toBe(132000);

    // Add Sak 25Kg (qty 1), then switch Kg line -> Sak merges cleanly (11 + 1 = 12, hits 320.000 tier!)
    usePosCartStore.getState().addItem(product, sakUnit, 1);
    usePosCartStore.getState().switchItemUnit(product.id, kgUnit.unitId, sakUnit);
    tab = usePosCartStore.getState().tabs[0];
    expect(tab.items).toHaveLength(1);
    expect(tab.items[0].unitId).toBe(sakUnit.unitId);
    expect(tab.items[0].quantity).toBe(12);
    expect(tab.items[0].effectiveUnitPrice).toBe(320000);

    // Verify synchronous persistence in kv-store under web key
    const rawSaved = Storage.getItemSync(POS_TABS_STORAGE_KEY);
    expect(rawSaved).toContain("Beras Pandan Wangi");

    // Multi-tab create & complete checkout
    const secondTabId = usePosCartStore.getState().createTab();
    expect(usePosCartStore.getState().tabs).toHaveLength(2);
    expect(usePosCartStore.getState().activeTabId).toBe(secondTabId);
    usePosCartStore.getState().completeCheckoutTab(secondTabId);
    expect(usePosCartStore.getState().tabs).toHaveLength(1);
  });

  it("builds web-parity CompletedOrder (cashGiven = grandTotal, change = 0), receipt lines, HTML, and ESC/POS bytes", () => {
    const product = makeSampleProduct();
    const [kgUnit] = getAvailableUnitsForProduct(product);
    usePosCartStore.getState().addItem(product, kgUnit, 5);
    usePosCartStore.getState().setDiscount(5000);

    const active = usePosCartStore.getState().tabs[0];
    const summary = calculateCartSummary(active.items, active.discount);
    expect(summary).toMatchObject({
      subtotal: 70000,
      discount: 5000,
      grandTotal: 65000,
      totalWholesaleSavings: 5000,
    });

    const order = buildCompletedOrderPayload({
      items: active.items,
      discount: active.discount,
      cashierName: "Budi Kasir",
      storeSettings: {
        storeName: "Toko Rejeki Utama",
        storeAddress: "Jl. Dargo 9",
        printerPaperWidth: 58,
      },
      orderNumber: "TRX-TEST-001",
      dateIso: "2026-11-19T03:05:00.000Z",
    });

    expect(order.cashGiven).toBe(65000);
    expect(order.change).toBe(0);

    const lines = buildReceiptRenderLines(order);
    expect(lines.some((l) => l.text?.includes("[Grosir]"))).toBe(true);
    expect(lines.some((l) => l.rightText === "Rp 65.000")).toBe(true);

    const html = buildReceiptHtml(order, 80);
    expect(html).toContain("Toko Rejeki Utama");
    expect(html).toContain("TOTAL");
    expect(html).not.toContain("TRX-TEST-001");

    const bytes = buildEscPosReceiptBytes(order, {
      paperWidthMm: 58,
      copies: 2,
    });
    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x40);
    expect(bytes.length).toBeGreaterThan(100);
  });
});
