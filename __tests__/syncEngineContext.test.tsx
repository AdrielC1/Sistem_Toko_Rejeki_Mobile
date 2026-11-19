import React from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Network from "expo-network";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AuthProvider } from "@/context/AuthContext";
import {
  SyncEngineProvider,
  useSyncEngine,
} from "@/context/SyncEngineContext";
import {
  SystemStatusProvider,
  useSystemStatus,
} from "@/context/SystemStatusContext";
import { resetSqliteConnectionForTest } from "@/db/sqlite";
import { resetActiveRouteForTest } from "@/services/api/apiClient";
import {
  setSessionToken,
  setStoredServerConfigRaw,
  setUserSnapshot,
} from "@/services/storage/secureStorage";
import { resetTestDatabase, resetTestStorage } from "./setup";

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SystemStatusProvider>
        <SyncEngineProvider>{children}</SyncEngineProvider>
      </SystemStatusProvider>
    </AuthProvider>
  );
}

describe("SystemStatusContext and SyncEngineContext lifecycle", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetTestStorage();
    resetSqliteConnectionForTest();
    resetTestDatabase();
    resetActiveRouteForTest();
    jest.clearAllMocks();
    (AppState as unknown as { currentState: AppStateStatus }).currentState =
      "active";
    (Network.useNetworkState as jest.Mock).mockReturnValue({
      isConnected: true,
      isInternetReachable: true,
      type: "WIFI",
    });
    (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: "WIFI",
    });
    globalThis.fetch = jest.fn() as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns safe defaults outside providers without throwing", async () => {
    const statusHook = await renderHook(() => useSystemStatus());
    expect(statusHook.result.current.healthState).toBe("checking");
    await statusHook.unmount();

    const syncHook = await renderHook(() => useSyncEngine());
    expect(syncHook.result.current.isSyncing).toBe(false);
    expect(syncHook.result.current.catalogCounts.products).toBe(0);
    await syncHook.unmount();
  });

  it("boots full sync, fails over LAN->Cloud, re-probes LAN at 30s, pauses in background, and resets cache cleanly", async () => {
    await setSessionToken("tok_ctx.sig");
    await setUserSnapshot({
      id: "usr-1",
      username: "kasir1",
      fullName: "Budi Kasir",
      role: "kasir",
    });
    setStoredServerConfigRaw(
      JSON.stringify({
        primaryUrl: "http://192.168.1.100:3000",
        fallbackUrl: "https://kasir.tokorejeki.my.id",
      })
    );

    let appStateHandler: ((state: AppStateStatus) => void) | null = null;
    const addListenerSpy = jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_type, listener) => {
        appStateHandler = listener;
        return { remove: jest.fn() } as unknown as ReturnType<
          typeof AppState.addEventListener
        >;
      });

    let lanRecovered = false;
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockImplementation((url: string) => {
      if (url.startsWith("http://192.168.1.100:3000")) {
        if (!lanRecovered) {
          return Promise.reject(new Error("LAN unreachable"));
        }
        if (url.endsWith("/api/health")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({
              status: "online",
              db: "connected",
              serverTime: "2026-11-19T10:01:00Z",
              latencyMs: 12,
            }),
          });
        }
      }

      if (url.endsWith("/api/auth/me")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            success: true,
            data: {
              id: "usr-1",
              username: "kasir1",
              fullName: "Budi Kasir",
              role: "kasir",
            },
          }),
        });
      }

      if (url.endsWith("/api/settings")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            success: true,
            data: { storeName: "Toko Rejeki" },
          }),
        });
      }

      if (url.endsWith("/api/health")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            status: "online",
            db: "connected",
            serverTime: "2026-11-19T10:00:00Z",
            latencyMs: 38,
          }),
        });
      }

      if (url.includes("/api/sync/full?scope=mini")) {
        return Promise.resolve({
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
                  name: "Gula Pasir 1kg",
                  categoryId: "c-1",
                  unitId: "u-1",
                  costPrice: 12000,
                  sellingPrice: 15000,
                  stock: 10,
                  isActive: true,
                  unitConversions: [],
                  wholesaleTiers: [],
                  createdAt: "2026-11-19T00:00:00Z",
                  updatedAt: "2026-11-19T00:00:00Z",
                },
              ],
              categories: [{ id: "c-1", name: "Sembako", isActive: true }],
              units: [{ id: "u-1", name: "Kg", symbol: "kg", isActive: true }],
              serverTime: "2026-11-19T10:00:00Z",
              totalProducts: 1,
            },
          }),
        });
      }

      return Promise.resolve({
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
            serverTime: "2026-11-19T10:00:05Z",
            hasChanges: false,
          },
        }),
      });
    });

    const { result, unmount } = await renderHook(
      () => ({
        status: useSystemStatus(),
        sync: useSyncEngine(),
      }),
      { wrapper }
    );

    // Flush async boot promises cleanly under fake timers
    await act(async () => {
      await jest.advanceTimersByTimeAsync(150);
    });

    await waitFor(() => {
      expect(result.current.status.healthState).toBe("online");
      expect(result.current.status.activeRoute).toBe("cloud");
      expect(result.current.sync.catalogReady).toBe(true);
      expect(result.current.sync.catalogCounts.products).toBe(1);
    });

    // Mark LAN recovered and advance 30s to trigger LAN recovery probe
    lanRecovered = true;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000);
    });

    await waitFor(() => {
      expect(result.current.status.activeRoute).toBe("lan");
    });

    // Move app to background -> pauses timers cleanly
    await act(async () => {
      appStateHandler?.("background");
    });
    const callsWhileBackgrounded = fetchMock.mock.calls.length;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(20_000);
    });
    expect(fetchMock.mock.calls.length).toBe(callsWhileBackgrounded);

    // Reset local cache wipes SQLite catalog counts while preserving auth
    await act(async () => {
      await result.current.sync.resetLocalCache();
    });
    expect(result.current.sync.catalogReady).toBe(false);
    expect(result.current.sync.catalogCounts.products).toBe(0);

    addListenerSpy.mockRestore();
    await unmount();
  });
});
