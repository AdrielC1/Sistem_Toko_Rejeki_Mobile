import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Network from "expo-network";
import { useAuth } from "@/context/AuthContext";
import {
  getActiveRoute,
  setActiveRoute,
  subscribeActiveRoute,
} from "@/services/api/apiClient";
import {
  fetchClusterHealth,
  probeLanHealthOnly,
} from "@/services/api/healthApi";
import type { HealthStatusSnapshot, ServerRoute } from "@/types";

export type HealthIndicatorState =
  | "checking"
  | "online"
  | "read_only"
  | "offline";

export interface SystemStatusContextValue {
  healthState: HealthIndicatorState;
  activeRoute: ServerRoute | null;
  serverReachable: boolean;
  dbOnline: boolean;
  readOnly: boolean;
  latencyMs: number | null;
  serverTime: string | null;
  lastCheckedAt: string | null;
  isAppActive: boolean;
  isDeviceConnected: boolean;
  recheckHealth: () => Promise<HealthStatusSnapshot | null>;
  subscribeDbReconnected: (listener: () => void) => () => void;
}

const DEFAULT_SYSTEM_STATUS: SystemStatusContextValue = {
  healthState: "checking",
  activeRoute: "lan",
  serverReachable: true,
  dbOnline: true,
  readOnly: false,
  latencyMs: null,
  serverTime: null,
  lastCheckedAt: null,
  isAppActive: true,
  isDeviceConnected: true,
  recheckHealth: async () => null,
  subscribeDbReconnected: () => () => {},
};

const HEALTH_BACKOFF_MS = [10_000, 15_000, 30_000] as const;
const LAN_REPROBE_INTERVAL_MS = 30_000;

const SystemStatusContext = createContext<SystemStatusContextValue>(
  DEFAULT_SYSTEM_STATUS
);

export function SystemStatusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, serverConfig } = useAuth();
  const networkState = Network.useNetworkState();
  const isDeviceConnected = networkState.isConnected !== false;

  const [isAppActive, setIsAppActive] = useState<boolean>(
    AppState.currentState === "active"
  );
  const [activeRoute, setActiveRouteState] = useState<ServerRoute | null>(() =>
    getActiveRoute()
  );
  const [serverReachable, setServerReachable] = useState<boolean>(false);
  const [dbOnline, setDbOnline] = useState<boolean>(false);
  const [readOnly, setReadOnly] = useState<boolean>(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [serverTime, setServerTime] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [hasCheckedOnce, setHasCheckedOnce] = useState<boolean>(false);

  const isMountedRef = useRef<boolean>(true);
  const wasDbHealthyRef = useRef<boolean | null>(null);
  const failureCountRef = useRef<number>(0);
  const healthTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dbReconnectListenersRef = useRef<Set<() => void>>(new Set());
  const inFlightCheckRef = useRef<Promise<HealthStatusSnapshot | null> | null>(
    null
  );

  const clearHealthTimer = useCallback(() => {
    if (healthTimerRef.current !== null) {
      clearTimeout(healthTimerRef.current);
      healthTimerRef.current = null;
    }
  }, []);

  const notifyDbReconnected = useCallback(() => {
    for (const listener of dbReconnectListenersRef.current) {
      try {
        listener();
      } catch {
        // Isolate subscriber errors
      }
    }
  }, []);

  const subscribeDbReconnected = useCallback((listener: () => void) => {
    dbReconnectListenersRef.current.add(listener);
    return () => {
      dbReconnectListenersRef.current.delete(listener);
    };
  }, []);

  const performHealthCheck =
    useCallback(async (): Promise<HealthStatusSnapshot | null> => {
      if (inFlightCheckRef.current) {
        return inFlightCheckRef.current;
      }

      const task = (async () => {
        if (!user || (!serverConfig.primaryUrl && !serverConfig.fallbackUrl)) {
          return null;
        }

        if (!isDeviceConnected) {
          failureCountRef.current = Math.min(2, failureCountRef.current + 1);
          if (isMountedRef.current) {
            setServerReachable(false);
            setDbOnline(false);
            setReadOnly(false);
            setLatencyMs(null);
            setHasCheckedOnce(true);
            setLastCheckedAt(new Date().toISOString());
          }
          wasDbHealthyRef.current = false;
          return {
            serverReachable: false,
            dbOnline: false,
            readOnly: false,
            latencyMs: null,
            serverTime: null,
            usedRoute: null,
          };
        }

        try {
          const snapshot = await fetchClusterHealth(serverConfig);
          if (!isMountedRef.current) {
            return snapshot;
          }

          const isHealthy = snapshot.serverReachable && snapshot.dbOnline;
          if (isHealthy) {
            failureCountRef.current = 0;
          } else {
            failureCountRef.current = Math.min(
              2,
              failureCountRef.current + 1
            );
          }

          const prevHealthy = wasDbHealthyRef.current;
          wasDbHealthyRef.current = isHealthy;

          setServerReachable(snapshot.serverReachable);
          setDbOnline(snapshot.dbOnline);
          setReadOnly(snapshot.readOnly);
          setLatencyMs(snapshot.latencyMs);
          setServerTime(snapshot.serverTime);
          if (snapshot.usedRoute) {
            setActiveRouteState(snapshot.usedRoute);
          }
          setHasCheckedOnce(true);
          setLastCheckedAt(new Date().toISOString());

          if (prevHealthy === false && isHealthy) {
            notifyDbReconnected();
          }

          return snapshot;
        } catch {
          failureCountRef.current = Math.min(2, failureCountRef.current + 1);
          wasDbHealthyRef.current = false;
          if (isMountedRef.current) {
            setServerReachable(false);
            setDbOnline(false);
            setReadOnly(false);
            setHasCheckedOnce(true);
          }
          return null;
        } finally {
          inFlightCheckRef.current = null;
        }
      })();

      inFlightCheckRef.current = task;
      return task;
    }, [isDeviceConnected, notifyDbReconnected, serverConfig, user]);

  useEffect(() => {
    isMountedRef.current = true;
    const unsubscribeRoute = subscribeActiveRoute((route) => {
      if (isMountedRef.current) {
        setActiveRouteState(route);
      }
    });

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (isMountedRef.current) {
        setIsAppActive(nextState === "active");
      }
    };
    const appStateSub = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      isMountedRef.current = false;
      clearHealthTimer();
      unsubscribeRoute();
      appStateSub.remove();
    };
  }, [clearHealthTimer]);

  // Health probe loop (pauses cleanly when backgrounded or unauthenticated)
  useEffect(() => {
    clearHealthTimer();
    if (!user || !isAppActive) {
      return;
    }

    let cancelled = false;

    const scheduleNext = () => {
      clearHealthTimer();
      if (cancelled || !isAppActive || !user) {
        return;
      }
      const delayMs =
        HEALTH_BACKOFF_MS[
          Math.min(failureCountRef.current, HEALTH_BACKOFF_MS.length - 1)
        ];
      healthTimerRef.current = setTimeout(async () => {
        if (cancelled) {
          return;
        }
        await performHealthCheck();
        scheduleNext();
      }, delayMs);
    };

    void performHealthCheck().then(() => {
      if (!cancelled) {
        scheduleNext();
      }
    });

    return () => {
      cancelled = true;
      clearHealthTimer();
    };
  }, [clearHealthTimer, isAppActive, performHealthCheck, user]);

  // 30s automatic LAN recovery re-probe while operating on Cloud fallback
  useEffect(() => {
    if (
      !user ||
      !isAppActive ||
      !isDeviceConnected ||
      activeRoute !== "cloud" ||
      !serverConfig.primaryUrl
    ) {
      return;
    }

    const primaryUrl = serverConfig.primaryUrl;
    const interval = setInterval(() => {
      void probeLanHealthOnly(primaryUrl).then((probe) => {
        if (!isMountedRef.current) {
          return;
        }
        if (probe.ok && probe.dbOnline) {
          setActiveRoute("lan");
          setActiveRouteState("lan");
          void performHealthCheck();
        }
      });
    }, LAN_REPROBE_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [
    activeRoute,
    isAppActive,
    isDeviceConnected,
    performHealthCheck,
    serverConfig.primaryUrl,
    user,
  ]);

  const healthState: HealthIndicatorState = useMemo(() => {
    if (!isDeviceConnected) {
      return "offline";
    }
    if (!hasCheckedOnce) {
      return "checking";
    }
    if (!serverReachable) {
      return "offline";
    }
    if (!dbOnline || readOnly) {
      return "read_only";
    }
    return "online";
  }, [dbOnline, hasCheckedOnce, isDeviceConnected, readOnly, serverReachable]);

  const value = useMemo<SystemStatusContextValue>(
    () => ({
      healthState,
      activeRoute,
      serverReachable,
      dbOnline,
      readOnly,
      latencyMs,
      serverTime,
      lastCheckedAt,
      isAppActive,
      isDeviceConnected,
      recheckHealth: performHealthCheck,
      subscribeDbReconnected,
    }),
    [
      activeRoute,
      dbOnline,
      healthState,
      isAppActive,
      isDeviceConnected,
      lastCheckedAt,
      latencyMs,
      performHealthCheck,
      readOnly,
      serverReachable,
      serverTime,
      subscribeDbReconnected,
    ]
  );

  return (
    <SystemStatusContext.Provider value={value}>
      {children}
    </SystemStatusContext.Provider>
  );
}

export function useSystemStatus(): SystemStatusContextValue {
  return useContext(SystemStatusContext);
}
