import {
  resetSqliteConnectionForTest,
} from "@/db/sqlite";
import {
  applyDeltaCatalogBatch,
  applyFullCatalogReplace,
  getCatalogCategories,
  getCatalogCounts,
  getCatalogProductById,
  getCatalogProducts,
  getCatalogUnits,
  queryCatalogProductsPage,
} from "@/db/catalogRepo";
import {
  getRecentSyncAudits,
  getSyncMetaState,
  recordSyncSuccess,
  resetCatalogCache,
} from "@/db/syncMetaRepo";
import {
  setSessionToken,
  setStoredServerConfigRaw,
} from "@/services/storage/secureStorage";
import type { Product } from "@/types";
import { resetTestDatabase, resetTestStorage } from "./setup";

function makeSampleProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1",
    sku: "SKU-001",
    barcode: "8991234567890",
    name: "Beras Ramos 5kg",
    description: "Beras pulen",
    categoryId: "cat-1",
    categoryName: "Sembako",
    unitId: "unit-1",
    unitName: "Sak",
    costPrice: 58000,
    sellingPrice: 65000,
    isOpenPrice: false,
    sellBaseUnit: true,
    stock: 20,
    imageUrl: null,
    isActive: true,
    unitConversions: [
      {
        id: "pu-1",
        unitId: "unit-2",
        unitName: "Kg",
        conversionFactor: 1,
        sellingPrice: 14000,
      },
    ],
    wholesaleTiers: [{ minQty: 5, price: 63000 }],
    deletedAt: null,
    createdAt: "2026-11-18T00:00:00Z",
    updatedAt: "2026-11-19T00:00:00Z",
    ...overrides,
  };
}

describe("Catalog SQLite repositories and role security", () => {
  beforeEach(() => {
    resetTestStorage();
    resetSqliteConnectionForTest();
    resetTestDatabase();
  });

  it("applies full replace atomically and strips costPrice only for kasir (D-09)", async () => {
    await applyFullCatalogReplace({
      products: [
        makeSampleProduct({ id: "p-1", name: "Gula Pasir", costPrice: 12000 }),
        makeSampleProduct({ id: "p-2", name: "Minyak Goreng", costPrice: 31000 }),
      ],
      categories: [{ id: "cat-1", name: "Sembako", isActive: true }],
      units: [{ id: "unit-1", name: "Sak", symbol: "sak", isActive: true }],
      serverTime: "2026-11-19T08:00:00Z",
      totalProducts: 2,
    });

    const kasirProducts = await getCatalogProducts("kasir");
    expect(kasirProducts).toHaveLength(2);
    expect(kasirProducts[0].costPrice).toBeUndefined();
    expect("costPrice" in kasirProducts[0]).toBe(false);

    const kasirSingle = await getCatalogProductById("p-2", "kasir");
    expect(kasirSingle).not.toBeNull();
    expect(kasirSingle && "costPrice" in kasirSingle).toBe(false);

    const adminProducts = await getCatalogProducts("admin");
    expect(adminProducts[0].costPrice).toBe(12000);

    const ownerSingle = await getCatalogProductById("p-2", "owner");
    expect(ownerSingle?.costPrice).toBe(31000);

    const counts = await getCatalogCounts();
    expect(counts).toEqual({ products: 2, categories: 1, units: 1 });
    expect((await getCatalogCategories())[0].name).toBe("Sembako");
    expect((await getCatalogUnits())[0].symbol).toBe("sak");
  });

  it("handles delta upserts and chunked >500 ID soft-deletes cleanly", async () => {
    const seededProducts = Array.from({ length: 560 }, (_, idx) =>
      makeSampleProduct({
        id: `p-${idx}`,
        sku: `SKU-${idx}`,
        name: `Produk ${idx}`,
      })
    );

    await applyFullCatalogReplace({
      products: seededProducts,
      categories: [{ id: "cat-1", name: "Sembako", isActive: true }],
      units: [{ id: "unit-1", name: "Pcs", symbol: "pcs", isActive: true }],
      serverTime: "2026-11-19T08:00:00Z",
      totalProducts: 560,
    });

    const deletedIds = Array.from({ length: 550 }, (_, idx) => `p-${idx}`);
    const deltaRes = await applyDeltaCatalogBatch({
      products: [
        makeSampleProduct({
          id: "p-555",
          name: "Produk 555 Updated",
          sellingPrice: 70000,
        }),
        makeSampleProduct({
          id: "p-new",
          sku: "SKU-NEW",
          name: "Produk Baru",
        }),
      ],
      deletedProductIds: deletedIds,
      categories: [],
      deletedCategoryIds: [],
      units: [],
      deletedUnitIds: [],
      serverTime: "2026-11-19T08:05:00Z",
      hasChanges: true,
    });

    expect(deltaRes.upsertedProducts).toBe(2);
    expect(deltaRes.deletedProducts).toBe(550);

    const remaining = await getCatalogProducts("owner");
    expect(remaining).toHaveLength(11);
    const updated555 = await getCatalogProductById("p-555", "owner");
    expect(updated555?.sellingPrice).toBe(70000);
  });

  it("resetCatalogCache wipes only SQLite catalog/sync tables without touching auth or server config", async () => {
    await setSessionToken("tok_keep.sig");
    setStoredServerConfigRaw(
      JSON.stringify({
        primaryUrl: "http://192.168.1.100:3000",
        fallbackUrl: "https://kasir.tokorejeki.my.id",
      })
    );

    await applyFullCatalogReplace({
      products: [makeSampleProduct()],
      categories: [{ id: "cat-1", name: "Sembako", isActive: true }],
      units: [{ id: "unit-1", name: "Pcs", symbol: "pcs", isActive: true }],
      serverTime: "2026-11-19T08:00:00Z",
      totalProducts: 1,
    });
    await recordSyncSuccess({
      syncType: "full",
      triggerSource: "boot",
      usedRoute: "lan",
      productCount: 1,
      deletedCount: 0,
      serverTime: "2026-11-19T08:00:00Z",
      fullSyncWibDate: "2026-11-19",
      fullSyncIso: "2026-11-19T01:00:00Z",
    });

    expect((await getRecentSyncAudits(5)).length).toBe(1);
    expect((await getSyncMetaState()).catalogReady).toBe(true);

    await resetCatalogCache();

    expect(await getCatalogCounts()).toEqual({
      products: 0,
      categories: 0,
      units: 0,
    });
    expect(await getRecentSyncAudits(5)).toEqual([]);
    expect((await getSyncMetaState()).catalogReady).toBe(false);

    // Auth token and Dual-URL config preserved
    const {
      getSessionToken,
      getStoredServerConfigRaw,
    } = require("@/services/storage/secureStorage");
    expect(await getSessionToken()).toBe("tok_keep.sig");
    expect(getStoredServerConfigRaw()).toContain("192.168.1.100:3000");
  });

  it("queries paginated SQLite batches (LIMIT/OFFSET), search, category filter, and sort modes cleanly", async () => {
    const items = Array.from({ length: 120 }, (_, i) => {
      const num = String(i + 1).padStart(3, "0");
      return makeSampleProduct({
        id: `p-${num}`,
        sku: `SKU-${num}`,
        barcode: `89900${num}`,
        name: `Barang ${num}`,
        categoryId: i % 2 === 0 ? "cat-1" : "cat-2",
        sellingPrice: (i + 1) * 1000,
      });
    });

    await applyFullCatalogReplace({
      products: items,
      categories: [
        { id: "cat-1", name: "Kategori A", isActive: true },
        { id: "cat-2", name: "Kategori B", isActive: true },
      ],
      units: [{ id: "unit-1", name: "Pcs", isActive: true }],
      serverTime: "2026-11-19T08:00:00Z",
      totalProducts: 120,
    });

    const page1 = await queryCatalogProductsPage("kasir", {
      limit: 50,
      offset: 0,
      sortMode: "az",
    });
    expect(page1.items).toHaveLength(50);
    expect(page1.totalCount).toBe(120);
    expect(page1.unfilteredTotalCount).toBe(120);
    expect(page1.hasMore).toBe(true);
    expect(page1.items[0].name).toBe("Barang 001");
    expect("costPrice" in page1.items[0]).toBe(false);

    const page3 = await queryCatalogProductsPage("owner", {
      limit: 50,
      offset: 100,
      sortMode: "az",
    });
    expect(page3.items).toHaveLength(20);
    expect(page3.hasMore).toBe(false);

    const catFiltered = await queryCatalogProductsPage("kasir", {
      categoryId: "cat-2",
      sortMode: "price_desc",
      limit: 50,
      offset: 0,
    });
    expect(catFiltered.totalCount).toBe(60);
    expect(catFiltered.unfilteredTotalCount).toBe(120);
    expect(catFiltered.items[0].sellingPrice).toBe(120000);

    const barcodeMatch = await queryCatalogProductsPage("kasir", {
      searchQuery: "89900077",
      limit: 50,
      offset: 0,
    });
    expect(barcodeMatch.totalCount).toBe(1);
    expect(barcodeMatch.items[0].id).toBe("p-077");
  });
});
