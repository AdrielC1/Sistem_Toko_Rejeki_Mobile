import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { Package } from "lucide-react-native";
import { InitialSyncBanner } from "@/components/common/InitialSyncBanner";
import { TabScreenHeader } from "@/components/common/TabScreenHeader";
import { useSyncEngine } from "@/context/SyncEngineContext";
import { useSystemStatus } from "@/context/SystemStatusContext";

jest.mock("@/context/SystemStatusContext", () => ({
  useSystemStatus: jest.fn(),
}));

jest.mock("@/context/SyncEngineContext", () => ({
  useSyncEngine: jest.fn(),
}));

describe("TabScreenHeader status sub-bar and InitialSyncBanner", () => {
  const mockRecheckHealth = jest.fn(async () => null);
  const mockTriggerSyncNow = jest.fn(async () => ({
    synced: true,
    mode: "full" as const,
    trigger: "manual" as const,
    upsertedProducts: 5,
    deletedProducts: 0,
    serverTime: "2026-11-19T10:00:00Z",
    usedRoute: "lan" as const,
  }));

  beforeEach(() => {
    jest.clearAllMocks();
    (useSystemStatus as jest.Mock).mockReturnValue({
      healthState: "online",
      activeRoute: "lan",
      serverReachable: true,
      dbOnline: true,
      readOnly: false,
      latencyMs: 18,
      serverTime: "2026-11-19T10:00:00Z",
      lastCheckedAt: "2026-11-19T10:00:00Z",
      isAppActive: true,
      isDeviceConnected: true,
      recheckHealth: mockRecheckHealth,
      subscribeDbReconnected: () => () => {},
    });
    (useSyncEngine as jest.Mock).mockReturnValue({
      isSyncing: false,
      syncStatus: "success",
      lastSyncAt: "2026-11-19T10:00:00Z",
      lastFullSyncAt: "2026-11-19T10:00:00Z",
      lastSyncRoute: "lan",
      lastError: null,
      catalogCounts: { products: 24, categories: 4, units: 3 },
      catalogReady: true,
      catalogVersion: 1,
      triggerSyncNow: mockTriggerSyncNow,
      resetLocalCache: async () => {},
      loadRecentAudits: async () => [],
    });
  });

  it("renders LAN Online, Cloud Online, Standby Baca Saja, and Offline states cleanly", async () => {
    const { getByText, rerender, unmount } = await render(
      <TabScreenHeader
        title="Produk"
        icon={<Package size={20} color="#0052cc" />}
      />
    );
    expect(getByText("LAN Online · 18ms")).toBeTruthy();
    expect(getByText("Katalog 24")).toBeTruthy();

    (useSystemStatus as jest.Mock).mockReturnValue({
      healthState: "online",
      activeRoute: "cloud",
      latencyMs: 65,
      recheckHealth: mockRecheckHealth,
    });
    await rerender(
      <TabScreenHeader
        title="Produk"
        icon={<Package size={20} color="#0052cc" />}
      />
    );
    expect(getByText("Cloud Online · 65ms")).toBeTruthy();

    (useSystemStatus as jest.Mock).mockReturnValue({
      healthState: "read_only",
      activeRoute: "lan",
      latencyMs: 25,
      recheckHealth: mockRecheckHealth,
    });
    await rerender(
      <TabScreenHeader
        title="Produk"
        icon={<Package size={20} color="#0052cc" />}
      />
    );
    expect(getByText("Standby Baca Saja")).toBeTruthy();

    (useSystemStatus as jest.Mock).mockReturnValue({
      healthState: "offline",
      activeRoute: "lan",
      latencyMs: null,
      recheckHealth: mockRecheckHealth,
    });
    await rerender(
      <TabScreenHeader
        title="Produk"
        icon={<Package size={20} color="#0052cc" />}
      />
    );
    expect(getByText("Offline")).toBeTruthy();
    await unmount();
  });

  it("triggers recheckHealth and triggerSyncNow when tapping status pills", async () => {
    const { getByTestId, unmount } = await render(
      <TabScreenHeader
        title="Kasir"
        icon={<Package size={20} color="#0052cc" />}
      />
    );

    await fireEvent.press(getByTestId("header-route-status-pill"));
    expect(mockRecheckHealth).toHaveBeenCalledTimes(1);

    await fireEvent.press(getByTestId("header-sync-pill"));
    expect(mockTriggerSyncNow).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it("renders InitialSyncBanner syncing and error retry states when catalogReady is false", async () => {
    (useSyncEngine as jest.Mock).mockReturnValue({
      isSyncing: true,
      syncStatus: "syncing",
      lastError: null,
      catalogReady: false,
      catalogCounts: { products: 0, categories: 0, units: 0 },
      triggerSyncNow: mockTriggerSyncNow,
    });

    const { getByText, getByTestId, rerender, queryByTestId, unmount } =
      await render(<InitialSyncBanner />);
    expect(getByTestId("initial-sync-banner-loading")).toBeTruthy();
    expect(getByText("Menyiapkan Katalog Awal")).toBeTruthy();

    (useSyncEngine as jest.Mock).mockReturnValue({
      isSyncing: false,
      syncStatus: "error",
      lastError: "Server LAN gagal dihubungi",
      catalogReady: false,
      catalogCounts: { products: 0, categories: 0, units: 0 },
      triggerSyncNow: mockTriggerSyncNow,
    });
    await rerender(<InitialSyncBanner />);
    expect(getByTestId("initial-sync-banner-error")).toBeTruthy();
    expect(getByText("Server LAN gagal dihubungi")).toBeTruthy();

    await fireEvent.press(getByTestId("initial-sync-retry-button"));
    expect(mockTriggerSyncNow).toHaveBeenCalledWith({ forceFull: true });

    (useSyncEngine as jest.Mock).mockReturnValue({
      isSyncing: false,
      syncStatus: "success",
      lastError: null,
      catalogReady: true,
      catalogCounts: { products: 12, categories: 2, units: 2 },
      triggerSyncNow: mockTriggerSyncNow,
    });
    await rerender(<InitialSyncBanner />);
    expect(queryByTestId("initial-sync-banner-loading")).toBeNull();
    expect(queryByTestId("initial-sync-banner-error")).toBeNull();
    await unmount();
  });
});
