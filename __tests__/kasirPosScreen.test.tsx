import React from "react";
import * as Network from "expo-network";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import KasirScreen from "@/app/(app)/(tabs)/kasir";
import { AuthProvider } from "@/context/AuthContext";
import { applyFullCatalogReplace } from "@/db/catalogRepo";
import { resetSqliteConnectionForTest } from "@/db/sqlite";
import {
  setCachedStoreSettings,
  setSessionToken,
  setStoredServerConfigRaw,
  setUserSnapshot,
} from "@/services/storage/secureStorage";
import { usePosCartStore } from "@/store/posCartStore";
import { usePinnedCategoriesStore } from "@/store/pinnedCategoriesStore";
import { usePrinterPrefsStore } from "@/store/printerPrefsStore";
import { resetTestDatabase, resetTestStorage } from "./setup";

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

describe("KasirScreen POS workflow, wholesale pricing, preview & intervention", () => {
  beforeEach(async () => {
    resetTestStorage();
    resetSqliteConnectionForTest();
    resetTestDatabase();
    usePosCartStore.getState().resetAllTabsForTest();
    usePinnedCategoriesStore.getState().resetForTest();
    usePrinterPrefsStore.getState().resetForTest();
    jest.clearAllMocks();

    setStoredServerConfigRaw(
      JSON.stringify({
        primaryUrl: "http://192.168.1.100:3000",
        fallbackUrl: null,
      })
    );
    setCachedStoreSettings({
      storeName: "Toko Rejeki Utama",
      previewReceiptBeforePrint: true,
      printerPaperWidth: 58,
    });
    await setSessionToken("tok_kasir.sig");
    await setUserSnapshot({
      id: "usr-kasir",
      username: "kasir1",
      fullName: "Budi Kasir",
      role: "kasir",
    });
    (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
      type: "NONE",
    });

    await applyFullCatalogReplace({
      products: [
        {
          id: "p-beras",
          sku: "BRS-01",
          barcode: "899111",
          name: "Beras Pandan Wangi",
          categoryId: "c-sembako",
          categoryName: "Sembako",
          unitId: "u-kg",
          unitName: "Kg",
          costPrice: 12000,
          sellingPrice: 15000,
          isOpenPrice: false,
          sellBaseUnit: true,
          stock: 50,
          isActive: true,
          wholesaleTiers: [{ minQty: 5, price: 14000 }],
          unitConversions: [],
          createdAt: "2026-11-19T00:00:00Z",
          updatedAt: "2026-11-19T00:00:00Z",
        },
      ],
      categories: [{ id: "c-sembako", name: "Sembako", isActive: true }],
      units: [{ id: "u-kg", name: "Kg", symbol: "kg", isActive: true }],
      serverTime: "2026-11-19T01:00:00Z",
      totalProducts: 1,
    });

    globalThis.fetch = jest.fn() as unknown as typeof globalThis.fetch;
  });

  it("adds product from catalog, applies discount, opens 58mm preview, retries intervention, and logs WA once on print success", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;

    const { unmount } = await render(
      <AuthProvider>
        <KasirScreen />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Beras Pandan Wangi")).toBeTruthy();
    });

    await fireEvent.press(screen.getByTestId("kasir-add-product-p-beras"));
    expect(screen.getByTestId("kasir-floating-cart-bar")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("kasir-floating-cart-bar"));
    expect(screen.getByTestId("kasir-checkout-button")).toBeTruthy();

    // Update quantity via CartItemQuantityModal to hit wholesale tier (>= 5)
    await fireEvent.press(screen.getByTestId("cart-qty-input-p-beras-u-kg"));
    expect(screen.getByTestId("kasir-qty-modal")).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("qty-modal-input"), "5");
    await fireEvent.press(screen.getByTestId("qty-modal-save-button"));
    expect(screen.getByTestId("kasir-grand-total").props.children).toBe(
      "Rp 70.000"
    );

    // Apply discount Rp 5.000
    await fireEvent.press(screen.getByTestId("kasir-discount-trigger"));
    await fireEvent.changeText(screen.getByTestId("discount-input"), "5000");
    await fireEvent.press(screen.getByTestId("discount-save-button"));
    expect(screen.getByTestId("kasir-grand-total").props.children).toBe(
      "Rp 65.000"
    );

    // Checkout -> opens ReceiptPreviewModal
    await fireEvent.press(screen.getByTestId("kasir-checkout-button"));
    expect(screen.getByTestId("receipt-preview-modal")).toBeTruthy();
    expect(screen.getByText("Pratinjau Struk (58mm)")).toBeTruthy();

    // Print attempt 1 fails -> Intervention Modal opens
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        success: false,
        error: "Printer offline",
        diagnostic: {
          errorCode: "PRINTER_OFFLINE",
          paperNearEnd: true,
        },
      }),
    });

    await fireEvent.press(screen.getByTestId("receipt-preview-confirm-button"));
    await waitFor(() => {
      expect(screen.getByTestId("printer-intervention-modal")).toBeTruthy();
    });
    expect(screen.getByTestId("printer-paper-near-end-warning")).toBeTruthy();

    // Retry print succeeds + triggers WA log ONCE
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          success: true,
          diagnostic: { paperNearEnd: true },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ success: true }),
      });

    await fireEvent.press(screen.getByTestId("printer-retry-button"));

    await waitFor(() => {
      expect(
        screen.getByText(/Struk TRX-.*Dicetak \(Kertas Menipis\)/)
      ).toBeTruthy();
    });

    const waCalls = fetchMock.mock.calls.filter(([u]) =>
      String(u).endsWith("/api/wa-log")
    );
    expect(waCalls).toHaveLength(1);
    expect(usePosCartStore.getState().tabs[0].items).toHaveLength(0);

    await unmount();
  });

  it("supports web-style unit pill buttons on Kasir cards and text-only Hybrid Category Modal with pinning", async () => {
    await applyFullCatalogReplace({
      products: [
        {
          id: "p-teh",
          sku: "2TACE",
          name: "2 Tang Celup",
          categoryId: "c-teh",
          categoryName: "Teh",
          unitId: "u-box",
          unitName: "Box",
          sellingPrice: 7500,
          sellBaseUnit: true,
          stock: 0,
          isActive: true,
          wholesaleTiers: [],
          unitConversions: [
            {
              id: "pu-bal",
              unitId: "u-bal",
              unitName: "Bal",
              conversionFactor: 12,
              sellingPrice: 390000,
              isActive: true,
            },
          ],
          createdAt: "2026-11-19T00:00:00Z",
          updatedAt: "2026-11-19T00:00:00Z",
        },
        {
          id: "p-kopi",
          sku: "KP-01",
          name: "Kopi Tubruk",
          categoryId: "c-kopi",
          categoryName: "Kopi",
          unitId: "u-box",
          unitName: "Box",
          sellingPrice: 12000,
          sellBaseUnit: true,
          stock: 0,
          isActive: true,
          wholesaleTiers: [],
          unitConversions: [],
          createdAt: "2026-11-19T00:00:00Z",
          updatedAt: "2026-11-19T00:00:00Z",
        },
      ],
      categories: [
        { id: "c-teh", name: "Teh", isActive: true },
        { id: "c-kopi", name: "Kopi", isActive: true },
      ],
      units: [
        { id: "u-box", name: "Box", isActive: true },
        { id: "u-bal", name: "Bal", isActive: true },
      ],
      serverTime: "2026-11-19T01:00:00Z",
      totalProducts: 2,
    });

    const { unmount } = await render(
      <AuthProvider>
        <KasirScreen />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("2 Tang Celup")).toBeTruthy();
      expect(screen.getByText("Kopi Tubruk")).toBeTruthy();
    });

    // Both Box & Bal unit buttons show right inside the Kasir card
    expect(screen.getByTestId("kasir-add-unit-p-teh-u-box")).toBeTruthy();
    expect(screen.getByTestId("kasir-add-unit-p-teh-u-bal")).toBeTruthy();

    // Tapping Bal unit pill adds Bal directly to active cart
    await fireEvent.press(screen.getByTestId("kasir-add-unit-p-teh-u-bal"));
    expect(usePosCartStore.getState().tabs[0].items[0]).toMatchObject({
      productId: "p-teh",
      unitId: "u-bal",
      effectiveUnitPrice: 390000,
      quantity: 1,
    });

    // Open Hybrid Category Modal ("Semua (2)"), pin "Teh", and select "Teh"
    await fireEvent.press(screen.getByTestId("kasir-category-modal-trigger"));
    expect(screen.getByTestId("category-picker-modal")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("category-modal-pin-c-teh"));
    expect(usePinnedCategoriesStore.getState().pinnedIds).toEqual(["c-teh"]);

    await fireEvent.press(screen.getByTestId("category-modal-item-c-teh"));
    await waitFor(() => {
      expect(screen.getByText("2 Tang Celup")).toBeTruthy();
      expect(screen.queryByText("Kopi Tubruk")).toBeNull();
    });
    expect(screen.getByTestId("kasir-category-c-teh")).toBeTruthy();

    await unmount();
  });
});
