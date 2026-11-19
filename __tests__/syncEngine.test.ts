import { getCatalogCounts, getCatalogProducts } from "@/db/catalogRepo";
import { resetSqliteConnectionForTest } from "@/db/sqlite";
import { getSyncMetaState } from "@/db/syncMetaRepo";
import { resetActiveRouteForTest } from "@/services/api/apiClient";
import {
  evaluateSyncPlan,
  getMobileClientId,
  getWIBDateTime,
  runSyncCycle,
} from "@/sync/syncEngine";
import { resetTestDatabase, resetTestStorage } from "./setup";

const CONFIG = {
  primaryUrl: "http://192.168.1.100:3000",
  fallbackUrl: "https://kasir.tokorejeki.my.id",
};

describe("Sync engine, WIB 10:00 schedule, >48h stale threshold, and mutex", () => {
  beforeEach(() => {
    resetTestStorage();
    resetSqliteConnectionForTest();
    resetTestDatabase();
    resetActiveRouteForTest();
    jest.clearAllMocks();
    globalThis.fetch = jest.fn() as unknown as typeof globalThis.fetch;
  });

  it("computes pure UTC+7 WIB date/hour accurately regardless of host TZ", () => {
    const eightThirtyWib = Date.parse("2026-11-19T01:30:00.000Z"); // 08:30 WIB
    expect(getWIBDateTime(eightThirtyWib)).toMatchObject({
      dateStr: "2026-11-19",
      hour: 8,
      minute: 30,
    });

    const tenOhFiveWib = Date.parse("2026-11-19T03:05:00.000Z"); // 10:05 WIB
    expect(getWIBDateTime(tenOhFiveWib)).toMatchObject({
      dateStr: "2026-11-19",
      hour: 10,
      minute: 5,
    });
  });

  it("generates persistent client UUID once", () => {
    const first = getMobileClientId();
    const second = getMobileClientId();
    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });

  it("runs boot full sync at 08:30 WIB, delta before 10:00 WIB, scheduled_10am_wib full sync at 10:05 WIB, and stale_48h full sync", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;

    // 1. Cold boot at 08:30 WIB -> Full Sync
    const t0830Wib = Date.parse("2026-11-19T01:30:00.000Z");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        success: true,
        data: {
          products: [
            {
              id: "p-1",
              sku: "SKU-1",
              name: "Tepung Terigu",
              categoryId: "c-1",
              unitId: "u-1",
              sellingPrice: 12000,
              stock: 10,
              isActive: true,
              unitConversions: [],
              wholesaleTiers: [],
              createdAt: "2026-11-19T01:00:00Z",
              updatedAt: "2026-11-19T01:00:00Z",
            },
          ],
          categories: [{ id: "c-1", name: "Bahan Kue", isActive: true }],
          units: [{ id: "u-1", name: "Kg", symbol: "kg", isActive: true }],
          serverTime: "2026-11-19T01:30:00.000Z",
          totalProducts: 1,
        },
      }),
    });

    const resBoot = await runSyncCycle(CONFIG, { nowMs: t0830Wib });
    expect(resBoot.synced).toBe(true);
    expect(resBoot.mode).toBe("full");
    expect((await getCatalogCounts()).products).toBe(1);

    // 2. At 09:45 WIB -> Delta Sync
    const t0945Wib = Date.parse("2026-11-19T02:45:00.000Z");
    expect((await evaluateSyncPlan(t0945Wib)).mode).toBe("delta");

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        success: true,
        data: {
          products: [],
          deletedProductIds: [],
          categories: [],
          deletedCategoryIds: [],
          units: [],
          deletedUnitIds: [],
          serverTime: "2026-11-19T02:45:00.000Z",
          hasChanges: false,
        },
      }),
    });
    const resDelta = await runSyncCycle(CONFIG, { nowMs: t0945Wib });
    expect(resDelta.mode).toBe("delta");
    expect((await getSyncMetaState()).lastSyncAt).toBe(
      "2026-11-19T02:45:00.000Z"
    );

    // 3. At 10:05 WIB -> Scheduled 10:00 WIB Full Sync fires automatically!
    const t1005Wib = Date.parse("2026-11-19T03:05:00.000Z");
    const plan1005 = await evaluateSyncPlan(t1005Wib);
    expect(plan1005.mode).toBe("full");
    expect(plan1005.trigger).toBe("scheduled_10am_wib");

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        success: true,
        data: {
          products: [],
          categories: [],
          units: [],
          serverTime: "2026-11-19T03:05:00.000Z",
          totalProducts: 0,
        },
      }),
    });
    const res1005 = await runSyncCycle(CONFIG, { nowMs: t1005Wib });
    expect(res1005.mode).toBe("full");
    expect(res1005.trigger).toBe("scheduled_10am_wib");

    // 4. At 10:10 WIB same day -> Back to Delta
    const t1010Wib = Date.parse("2026-11-19T03:10:00.000Z");
    expect((await evaluateSyncPlan(t1010Wib)).mode).toBe("delta");

    // 5. Over 48 hours later -> Stale 48h Full Sync
    const t49HoursLater = t1005Wib + 49 * 60 * 60 * 1000;
    const planStale = await evaluateSyncPlan(t49HoursLater);
    expect(planStale.mode).toBe("full");
  });

  it("preserves lastSyncAt cursor when DB is offline (503) and serializes overlapping calls via mutex", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;

    let releaseFirstFetch!: (res: unknown) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseFirstFetch = resolve;
      })
    );

    // Second queued call runs after first completes as delta!
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      headers: new Headers(),
      json: async () => ({
        success: false,
        offline: true,
        error: "Database toko offline",
      }),
    });

    const p1 = runSyncCycle(CONFIG, {
      nowMs: Date.parse("2026-11-19T03:05:00.000Z"),
    });
    const p2 = runSyncCycle(CONFIG, {
      nowMs: Date.parse("2026-11-19T03:06:00.000Z"),
    });

    // Wait one tick so p1 passes SQLite evaluateSyncPlan and reaches fetch, while p2 waits on syncMutex
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    releaseFirstFetch({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        success: true,
        data: {
          products: [
            {
              id: "p-1",
              sku: "SKU-1",
              name: "Gula",
              categoryId: "c-1",
              unitId: "u-1",
              sellingPrice: 14000,
              stock: 5,
              isActive: true,
              unitConversions: [],
              wholesaleTiers: [],
              createdAt: "2026-11-19T01:00:00Z",
              updatedAt: "2026-11-19T01:00:00Z",
            },
          ],
          categories: [],
          units: [],
          serverTime: "2026-11-19T03:05:00.000Z",
          totalProducts: 1,
        },
      }),
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.synced).toBe(true);
    expect(r1.mode).toBe("full");

    expect(r2.synced).toBe(false);
    expect(r2.errorCode).toBe("DB_OFFLINE");
    // Server cursor from p1 is preserved untouched!
    expect((await getSyncMetaState()).lastSyncAt).toBe(
      "2026-11-19T03:05:00.000Z"
    );
    expect(await getCatalogProducts("kasir")).toHaveLength(1);
  });

  it("unwraps real Apps_Toko_Rejeki /api/sync/full & /api/sync/delta (?scope=mini) payloads accurately", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        success: true,
        server_time: "2026-11-19T01:40:00.000Z",
        total_products: 2,
        data: {
          products: [
            {
              id: "p-t2",
              name: "testing2",
              sku: "TST-002",
              barcode: "8990001000028",
              costPrice: 15000,
              categoryId: "c-test",
              categoryName: "testkategori",
              isActive: true,
              baseUnit: "Pcs",
              prices: { Pcs: 20000 },
              unitConversions: [
                {
                  id: "pu-2",
                  unitId: "u-pcs",
                  unitName: "Pcs",
                  conversionFactor: 1,
                  costPrice: 15000,
                  sellingPrice: 20000,
                  isActive: true,
                  wholesaleTiers: [
                    {
                      id: "wt-1",
                      productUnitId: "pu-2",
                      unitName: "Pcs",
                      minQty: 5,
                      specialPrice: 18000,
                    },
                  ],
                },
              ],
              wholesaleTiers: [
                {
                  id: "wt-1",
                  productUnitId: "pu-2",
                  unitName: "Pcs",
                  minQty: 5,
                  specialPrice: 18000,
                },
              ],
              createdAt: "2026-11-19T01:00:00.000Z",
              updatedAt: "2026-11-19T01:00:00.000Z",
              deletedAt: null,
            },
            {
              id: "p-t3",
              name: "testing3",
              sku: "TST-003",
              costPrice: 9000,
              categoryId: "c-test",
              categoryName: "testkategori",
              isActive: true,
              baseUnit: "Pcs",
              unitConversions: [
                {
                  id: "pu-3a",
                  unitId: "u-pcs",
                  unitName: "Pcs",
                  conversionFactor: 1,
                  costPrice: 9000,
                  sellingPrice: 12000,
                  isActive: true,
                  wholesaleTiers: [],
                },
                {
                  id: "pu-3b",
                  unitId: "u-lusin",
                  unitName: "Lusin",
                  conversionFactor: 12,
                  costPrice: 108000,
                  sellingPrice: 130000,
                  isActive: true,
                  wholesaleTiers: [],
                },
              ],
              wholesaleTiers: [],
              createdAt: "2026-11-19T01:00:00.000Z",
              updatedAt: "2026-11-19T01:00:00.000Z",
              deletedAt: null,
            },
          ],
          categories: [
            {
              id: "c-test",
              name: "testkategori",
              created_at: "2026-11-19T01:00:00.000Z",
              updated_at: "2026-11-19T01:00:00.000Z",
              deleted_at: null,
            },
          ],
          units: [
            {
              id: "u-pcs",
              name: "Pcs",
              created_at: "2026-11-19T01:00:00.000Z",
              updated_at: "2026-11-19T01:00:00.000Z",
              deleted_at: null,
            },
            {
              id: "u-lusin",
              name: "Lusin",
              created_at: "2026-11-19T01:00:00.000Z",
              updated_at: "2026-11-19T01:00:00.000Z",
              deleted_at: null,
            },
          ],
        },
      }),
    });

    const fullRes = await runSyncCycle(CONFIG, {
      nowMs: Date.parse("2026-11-19T01:40:00.000Z"),
    });
    expect(fullRes.synced).toBe(true);
    expect(fullRes.serverTime).toBe("2026-11-19T01:40:00.000Z");

    const ownerProducts = await getCatalogProducts("owner");
    const t2 = ownerProducts.find((p) => p.id === "p-t2");
    const t3 = ownerProducts.find((p) => p.id === "p-t3");
    expect(t2).toMatchObject({
      unitId: "u-pcs",
      unitName: "Pcs",
      sellingPrice: 20000,
      wholesaleTiers: [{ id: "wt-1", minQty: 5, price: 18000 }],
      unitConversions: [],
    });
    expect(t3).toMatchObject({
      unitId: "u-pcs",
      sellingPrice: 12000,
    });
    expect(t3?.unitConversions).toHaveLength(1);
    expect(t3?.unitConversions[0]).toMatchObject({
      unitId: "u-lusin",
      conversionFactor: 12,
      sellingPrice: 130000,
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        success: true,
        server_time: "2026-11-19T01:45:00.000Z",
        has_changes: true,
        delta_count: 1,
        data: {
          products: {
            upserted: [],
            deleted: ["p-t3"],
          },
          categories: { upserted: [], deleted: [] },
          units: { upserted: [], deleted: [] },
        },
      }),
    });

    const deltaRes = await runSyncCycle(CONFIG, {
      nowMs: Date.parse("2026-11-19T01:45:00.000Z"),
    });
    expect(deltaRes.synced).toBe(true);
    expect(deltaRes.mode).toBe("delta");
    expect(deltaRes.deletedProducts).toBe(1);
    expect((await getSyncMetaState()).lastSyncAt).toBe(
      "2026-11-19T01:45:00.000Z"
    );
    const remaining = await getCatalogProducts("kasir");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].costPrice).toBeUndefined();
  });
});
