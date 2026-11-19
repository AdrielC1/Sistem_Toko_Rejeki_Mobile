import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { useSystemStatus } from "@/context/SystemStatusContext";
import { getCatalogCounts } from "@/db/catalogRepo";
import {
  getRecentSyncAudits,
  getSyncMetaState,
  resetCatalogCache,
} from "@/db/syncMetaRepo";
import { subscribeCatalogChanged } from "@/sync/catalogEvents";
import { runSyncCycle } from "@/sync/syncEngine";
import type {
  CatalogCounts,
  ServerRoute,
  SyncAuditRecord,
  SyncResult,
} from "@/types";

export type SyncContextStatus =
  | "idle"
  | "syncing"
  | "success"
  | "error"
  | "paused_offline";

export interface SyncEngineContextValue {
  isSyncing: boolean;
  syncStatus: SyncContextStatus;
  lastSyncAt: string | null;
  lastFullSyncAt: string | null;
  lastSyncRoute: ServerRoute | null;
  lastError: string | null;
  catalogCounts: CatalogCounts;
  catalogReady: boolean;
  catalogVersion: number;
  triggerSyncNow: (options?: {
    forceFull?: boolean;
    trigger?: SyncAuditRecord["triggerSource"];
  }) => Promise<SyncResult>;
  resetLocalCache: () => Promise<void>;
  loadRecentAudits: (limit?: number) => Promise<SyncAuditRecord[]>;
}

const DEFAULT_SYNC_ENGINE: SyncEngineContextValue = {
  isSyncing: false,
  syncStatus: "idle",
  lastSyncAt: null,
  lastFullSyncAt: null,
  lastSyncRoute: null,
  lastError: null,
  catalogCounts: { products: 0, categories: 0, units: 0 },
  catalogReady: false,
  catalogVersion: 0,
  triggerSyncNow: async () => ({
    synced: false,
    mode: "skipped",
    trigger: "manual",
    upsertedProducts: 0,
    deletedProducts: 0,
    serverTime: null,
    usedRoute: null,
  }),
  resetLocalCache: async () => {},
  loadRecentAudits: async () => [],
};

const DELTA_BACKOFF_MS = [5_000, 15_000, 30_000] as const;

const SyncEngineContext =
  createContext<SyncEngineContextValue>(DEFAULT_SYNC_ENGINE);

export function SyncEngineProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, serverConfig } = useAuth();
  const {
    isAppActive,
    isDeviceConnected,
    healthState,
    subscribeDbReconnected,
  } = useSystemStatus();

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<SyncContextStatus>("idle");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastFullSyncAt, setLastFullSyncAt] = useState<string | null>(null);
  const [lastSyncRoute, setLastSyncRoute] = useState<ServerRoute | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [catalogCounts, setCatalogCounts] = useState<CatalogCounts>({
    products: 0,
    categories: 0,
    units: 0,
  });
  const [catalogReady, setCatalogReady] = useState<boolean>(false);
  const [catalogVersion, setCatalogVersion] = useState<number>(0);

  const isMountedRef = useRef<boolean>(true);
  const failureCountRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightSyncRef = useRef<Promise<SyncResult> | null>(null);

  const clearSyncTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const refreshMetadataSnapshot = useCallback(async () => {
    try {
      const [meta, counts] = await Promise.all([
        getSyncMetaState(),
        getCatalogCounts(),
      ]);
      if (!isMountedRef.current) {
        return;
      }
      setLastSyncAt(meta.lastSyncAt);
      setLastFullSyncAt(meta.lastFullSyncAt);
      setLastSyncRoute(meta.lastSyncRoute);
      setLastError(meta.lastSyncError);
      setCatalogReady(meta.catalogReady);
      setCatalogCounts(counts);
    } catch {
      // Ignore SQLite read errors during early unmount
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    let active = true;

    async function loadInitialSnapshot() {
      try {
        const [meta, counts] = await Promise.all([
          getSyncMetaState(),
          getCatalogCounts(),
        ]);
        if (!active || !isMountedRef.current) {
          return;
        }
        setLastSyncAt(meta.lastSyncAt);
        setLastFullSyncAt(meta.lastFullSyncAt);
        setLastSyncRoute(meta.lastSyncRoute);
        setLastError(meta.lastSyncError);
        setCatalogReady(meta.catalogReady);
        setCatalogCounts(counts);
      } catch {
        // Ignore SQLite read errors during early unmount
      }
    }

    void loadInitialSnapshot();

    const unsubscribeChanged = subscribeCatalogChanged(() => {
      if (!isMountedRef.current) {
        return;
      }
      setCatalogVersion((v) => v + 1);
      void refreshMetadataSnapshot();
    });

    return () => {
      active = false;
      isMountedRef.current = false;
      clearSyncTimer();
      unsubscribeChanged();
    };
  }, [clearSyncTimer, refreshMetadataSnapshot]);

  const executeSync = useCallback(
    async (options?: {
      forceFull?: boolean;
      trigger?: SyncAuditRecord["triggerSource"];
    }): Promise<SyncResult> => {
      if (inFlightSyncRef.current) {
        return inFlightSyncRef.current;
      }

      const task = (async () => {
        if (isMountedRef.current) {
          setIsSyncing(true);
          setSyncStatus("syncing");
        }
        try {
          const res = await runSyncCycle(serverConfig, options);
          if (!isMountedRef.current) {
            return res;
          }
          if (res.synced) {
            failureCountRef.current = 0;
            setSyncStatus("success");
            setLastError(null);
          } else if (res.mode === "skipped") {
            setSyncStatus("paused_offline");
          } else {
            failureCountRef.current = Math.min(2, failureCountRef.current + 1);
            setSyncStatus(
              res.errorCode === "DB_OFFLINE" || res.errorCode === "NETWORK"
                ? "paused_offline"
                : "error"
            );
            setLastError(res.error ?? "Sinkronisasi gagal.");
          }
          await refreshMetadataSnapshot();
          return res;
        } finally {
          inFlightSyncRef.current = null;
          if (isMountedRef.current) {
            setIsSyncing(false);
          }
        }
      })();

      inFlightSyncRef.current = task;
      return task;
    },
    [refreshMetadataSnapshot, serverConfig]
  );

  const isPausedByStatus = !isDeviceConnected || healthState === "read_only";

  // Foreground 5s delta loop (pauses cleanly when backgrounded, offline, or DB read-only)
  useEffect(() => {
    clearSyncTimer();

    if (!user || !isAppActive || isPausedByStatus) {
      return;
    }

    let cancelled = false;
    const scheduleNext = () => {
      clearSyncTimer();
      if (cancelled || !isAppActive || !user) {
        return;
      }
      const delayMs =
        DELTA_BACKOFF_MS[
          Math.min(failureCountRef.current, DELTA_BACKOFF_MS.length - 1)
        ];
      timerRef.current = setTimeout(async () => {
        if (cancelled) {
          return;
        }
        await executeSync({ trigger: "foreground" });
        scheduleNext();
      }, delayMs);
    };

    void executeSync({ trigger: "boot" }).then(() => {
      if (!cancelled) {
        scheduleNext();
      }
    });

    return () => {
      cancelled = true;
      clearSyncTimer();
    };
  }, [clearSyncTimer, executeSync, isAppActive, isPausedByStatus, user]);

  // Trigger immediate sync when DB reconnects from offline/read_only
  useEffect(() => {
    return subscribeDbReconnected(() => {
      if (!user || !isAppActive) {
        return;
      }
      failureCountRef.current = 0;
      void executeSync({ trigger: "db_reconnected" });
    });
  }, [executeSync, isAppActive, subscribeDbReconnected, user]);

  const triggerSyncNow = useCallback(
    async (options?: {
      forceFull?: boolean;
      trigger?: SyncAuditRecord["triggerSource"];
    }) => {
      return executeSync({
        forceFull: options?.forceFull,
        trigger: options?.trigger ?? "manual",
      });
    },
    [executeSync]
  );

  const resetLocalCache = useCallback(async () => {
    await resetCatalogCache();
    failureCountRef.current = 0;
    if (isMountedRef.current) {
      setSyncStatus("idle");
      setLastError(null);
      setCatalogVersion((v) => v + 1);
    }
    await refreshMetadataSnapshot();
  }, [refreshMetadataSnapshot]);

  const loadRecentAudits = useCallback(async (limit = 10) => {
    return getRecentSyncAudits(limit);
  }, []);

  const effectiveSyncStatus: SyncContextStatus =
    isPausedByStatus && !isSyncing ? "paused_offline" : syncStatus;

  const value = useMemo<SyncEngineContextValue>(
    () => ({
      isSyncing,
      syncStatus: effectiveSyncStatus,
      lastSyncAt,
      lastFullSyncAt,
      lastSyncRoute,
      lastError,
      catalogCounts,
      catalogReady,
      catalogVersion,
      triggerSyncNow,
      resetLocalCache,
      loadRecentAudits,
    }),
    [
      catalogCounts,
      catalogReady,
      catalogVersion,
      effectiveSyncStatus,
      isSyncing,
      lastError,
      lastFullSyncAt,
      lastSyncAt,
      lastSyncRoute,
      loadRecentAudits,
      resetLocalCache,
      triggerSyncNow,
    ]
  );

  return (
    <SyncEngineContext.Provider value={value}>
      {children}
    </SyncEngineContext.Provider>
  );
}

export function useSyncEngine(): SyncEngineContextValue {
  return useContext(SyncEngineContext);
}
