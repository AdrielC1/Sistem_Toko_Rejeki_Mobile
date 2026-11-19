import { getCatalogCategories, getCatalogProductById, getCatalogUnits } from "@/db/catalogRepo";
import { resetSqliteConnectionForTest } from "@/db/sqlite";
import { resetActiveRouteForTest } from "@/services/api/apiClient";
import {
  createCategoryServer,
  createUnitServer,
  fetchCategoriesServer,
  migrateCategoryProductsServer,
  restoreTrashedCategoryServer,
  softDeleteCategoryServer,
} from "@/services/api/categoriesUnitsApi";
import {
  createServerProduct,
  fetchServerProductDetail,
  restoreTrashedProduct,
  softDeleteServerProduct,
} from "@/services/api/productsApi";
import {
  createStaffUser,
  fetchStaffUsers,
  resetStaffPassword,
  updateStaffUser,
} from "@/services/api/usersApi";
import { resetTestDatabase, resetTestStorage } from "./setup";

const CONFIG = {
  primaryUrl: "http://192.168.1.100:3000",
  fallbackUrl: null,
};

describe("Phase 4 & 5 Owner CRUD APIs (?scope=mini normalization & SQLite sync)", () => {
  beforeEach(() => {
    resetTestStorage();
    resetSqliteConnectionForTest();
    resetTestDatabase();
    resetActiveRouteForTest();
    jest.clearAllMocks();
    globalThis.fetch = jest.fn() as unknown as typeof globalThis.fetch;
  });

  it("normalizes raw snake_case GET /api/products/[id] responses and strips costPrice for kasir", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        success: true,
        data: {
          id: "p-raw",
          sku: "RAW-1",
          name: "Kopi Bubuk",
          category_id: "cat-1",
          unit_id: "u-1",
          cost_price: "9000",
          selling_price: "13000",
          is_open_price: false,
          sell_base_unit: true,
          stock: 15,
          is_active: true,
          unit_conversions: [],
          wholesale_tiers: [{ min_qty: 4, price: "12000" }],
          created_at: "2026-11-19T00:00:00Z",
          updated_at: "2026-11-19T00:00:00Z",
        },
      }),
    });

    const resKasir = await fetchServerProductDetail(CONFIG, "p-raw", "kasir");
    expect(resKasir.ok).toBe(true);
    expect(resKasir.product?.sellingPrice).toBe(13000);
    expect(resKasir.product?.wholesaleTiers).toEqual([{ minQty: 4, price: 12000 }]);
    expect(resKasir.product && "costPrice" in resKasir.product).toBe(false);
    expect((fetchMock.mock.calls[0] as [string])[0]).toContain(
      "/api/products/p-raw?scope=mini"
    );
  });

  it("normalizes production formatProductRow (unitConversions with specialPrice) & strips nested unit costPrice for kasir", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        success: true,
        data: {
          id: "p-prod",
          name: "testing3",
          sku: "TST-003",
          costPrice: 9000,
          categoryId: "c-1",
          categoryName: "testkategori",
          isActive: true,
          baseUnit: "Pcs",
          unitConversions: [
            {
              id: "pu-1",
              unitId: "u-pcs",
              unitName: "Pcs",
              conversionFactor: 1,
              costPrice: 9000,
              sellingPrice: 12000,
              isActive: true,
              wholesaleTiers: [{ minQty: 5, specialPrice: 11000 }],
            },
            {
              id: "pu-2",
              unitId: "u-lusin",
              unitName: "Lusin",
              conversionFactor: 12,
              costPrice: 108000,
              sellingPrice: 130000,
              isActive: true,
              wholesaleTiers: [],
            },
          ],
          createdAt: "2026-11-19T00:00:00Z",
          updatedAt: "2026-11-19T00:00:00Z",
        },
      }),
    });

    const resKasir = await fetchServerProductDetail(CONFIG, "p-prod", "kasir");
    expect(resKasir.ok).toBe(true);
    expect(resKasir.product?.sellingPrice).toBe(12000);
    expect(resKasir.product?.unitName).toBe("Pcs");
    expect(resKasir.product?.wholesaleTiers).toEqual([{ minQty: 5, price: 11000 }]);
    expect(resKasir.product?.unitConversions).toHaveLength(1);
    expect("costPrice" in (resKasir.product ?? {})).toBe(false);
    expect("costPrice" in (resKasir.product?.unitConversions[0] ?? {})).toBe(false);
  });

  it("upserts created/restored products directly into local SQLite and removes on soft delete", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: new Headers(),
      json: async () => ({
        success: true,
        data: {
          id: "p-new",
          sku: "NEW-1",
          name: "Teh Celup",
          categoryId: "cat-1",
          unitId: "u-1",
          costPrice: 5000,
          sellingPrice: 8000,
          stock: 20,
          isActive: true,
          unitConversions: [],
          wholesaleTiers: [],
          createdAt: "2026-11-19T00:00:00Z",
          updatedAt: "2026-11-19T00:00:00Z",
        },
      }),
    });

    const created = await createServerProduct(
      CONFIG,
      {
        sku: "NEW-1",
        name: "Teh Celup",
        categoryId: "cat-1",
        unitId: "u-1",
        costPrice: 5000,
        sellingPrice: 8000,
        isOpenPrice: false,
        sellBaseUnit: true,
        stock: 20,
        isActive: true,
        unitConversions: [],
        wholesaleTiers: [],
      },
      "owner"
    );
    expect(created.ok).toBe(true);
    expect((await getCatalogProductById("p-new", "owner"))?.name).toBe(
      "Teh Celup"
    );

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ success: true }),
    });
    await softDeleteServerProduct(CONFIG, "p-new");
    expect(await getCatalogProductById("p-new", "owner")).toBeNull();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        success: true,
        data: {
          id: "p-new",
          sku: "NEW-1",
          name: "Teh Celup",
          categoryId: "cat-1",
          unitId: "u-1",
          costPrice: 5000,
          sellingPrice: 8000,
          stock: 20,
          isActive: true,
          unitConversions: [],
          wholesaleTiers: [],
          createdAt: "2026-11-19T00:00:00Z",
          updatedAt: "2026-11-19T00:00:00Z",
        },
      }),
    });
    await restoreTrashedProduct(CONFIG, "p-new");
    expect((await getCatalogProductById("p-new", "owner"))?.name).toBe(
      "Teh Celup"
    );
  });

  it("handles categories/units ?scope=mini CRUD + migration and users CRUD endpoints cleanly", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers(),
        json: async () => ({
          success: true,
          data: { id: "c-1", name: "Snack", isActive: true },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers(),
        json: async () => ({
          success: true,
          data: { id: "u-1", name: "Pack", symbol: "pck", isActive: true },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          success: true,
          data: { id: "c-1", name: "Snack", isActive: true },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ success: true, data: [] }),
      });

    await createCategoryServer(CONFIG, { name: "Snack" });
    await createUnitServer(CONFIG, { name: "Pack", symbol: "pck" });
    expect((await getCatalogCategories())[0].name).toBe("Snack");
    expect((await getCatalogUnits())[0].symbol).toBe("pck");

    await migrateCategoryProductsServer(CONFIG, "c-1", "c-2");
    await softDeleteCategoryServer(CONFIG, "c-1");
    expect(await getCatalogCategories()).toEqual([]);

    await restoreTrashedCategoryServer(CONFIG, "c-1");
    expect((await getCatalogCategories())[0].id).toBe("c-1");

    await fetchCategoriesServer(CONFIG);

    // Users endpoints
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ success: true, data: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers(),
        json: async () => ({
          success: true,
          data: {
            id: "usr-2",
            username: "kasir2",
            fullName: "Kasir Dua",
            role: "kasir",
            isActive: true,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ success: true, data: { id: "usr-2" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ success: true }),
      });

    expect((await fetchStaffUsers(CONFIG)).ok).toBe(true);
    expect(
      (
        await createStaffUser(CONFIG, {
          username: "kasir2",
          fullName: "Kasir Dua",
          password: "password123",
          role: "kasir",
        })
      ).ok
    ).toBe(true);
    expect(
      (await updateStaffUser(CONFIG, "usr-2", { fullName: "Kasir Baru" })).ok
    ).toBe(true);
    expect((await resetStaffPassword(CONFIG, "usr-2", "newpass123")).ok).toBe(
      true
    );
  });
});
