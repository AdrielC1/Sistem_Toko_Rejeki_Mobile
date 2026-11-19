import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SyncControlCard } from "@/components/pengaturan/SyncControlCard";
import { useSyncEngine } from "@/context/SyncEngineContext";
import { useSystemStatus } from "@/context/SystemStatusContext";

jest.mock("@/context/SystemStatusContext", () => ({
  useSystemStatus: jest.fn(),
}));

jest.mock("@/context/SyncEngineContext", () => ({
  useSyncEngine: jest.fn(),
}));

describe("SyncControlCard and ResetCacheConfirmModal", () => {
  const mockTriggerSyncNow = jest.fn(async () => ({
    synced: true,
    mode: "full" as const,
    trigger: "manual" as const,
    upsertedProducts: 42,
    deletedProducts: 0,
    serverTime: "2026-11-19T10:00:00Z",
    usedRoute: "lan" as const,
  }));
  const mockResetLocalCache = jest.fn(async () => {});
  const mockLoadRecentAudits = jest.fn(async () => [
    {
      id: 1,
      syncType: "full" as const,
      triggerSource: "boot" as const,
      usedRoute: "lan" as const,
      productCount: 42,
      deletedCount: 0,
      serverTime: "2026-11-19T10:00:00Z",
      status: "success" as const,
      errorMessage: null,
      createdAt: "2026-11-19T10:00:00Z",
    },
  ]);

  beforeEach(() => {
    jest.clearAllMocks();
    (useSystemStatus as jest.Mock).mockReturnValue({
      activeRoute: "lan",
      healthState: "online",
    });
    (useSyncEngine as jest.Mock).mockReturnValue({
      isSyncing: false,
      syncStatus: "success",
      lastSyncAt: "2026-11-19T03:00:00.000Z",
      lastFullSyncAt: "2026-11-19T03:00:00.000Z",
      lastSyncRoute: "lan",
      lastError: null,
      catalogCounts: { products: 42, categories: 5, units: 4 },
      catalogReady: true,
      catalogVersion: 1,
      triggerSyncNow: mockTriggerSyncNow,
      resetLocalCache: mockResetLocalCache,
      loadRecentAudits: mockLoadRecentAudits,
    });
  });

  it("displays catalog counts, audits, triggers full sync, and confirms cache reset", async () => {
    const { getByTestId, getByText, unmount } = await render(
      <SyncControlCard />
    );

    await waitFor(() => {
      expect(getByText("42")).toBeTruthy();
      expect(getByText("5")).toBeTruthy();
      expect(getByText("4")).toBeTruthy();
      expect(getByText("FULL (boot)")).toBeTruthy();
    });

    await fireEvent.press(getByTestId("sync-full-now-button"));
    await waitFor(() => {
      expect(mockTriggerSyncNow).toHaveBeenCalledWith({
        forceFull: true,
        trigger: "manual",
      });
      expect(
        getByText("Sinkronisasi penuh selesai (42 produk).")
      ).toBeTruthy();
    });

    await fireEvent.press(getByTestId("sync-reset-cache-button"));
    expect(getByText("Reset Cache Katalog Lokal?")).toBeTruthy();

    await fireEvent.press(getByTestId("reset-cache-confirm-button"));
    await waitFor(() => {
      expect(mockResetLocalCache).toHaveBeenCalledTimes(1);
      expect(
        getByText("Cache direset dan 42 produk berhasil diunduh ulang.")
      ).toBeTruthy();
    });

    await unmount();
  });
});
