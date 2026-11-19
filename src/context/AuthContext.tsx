import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as Network from "expo-network";
import {
  bumpAuthEpoch,
  getAuthEpoch,
  registerSessionRevokedHandler,
  resetActiveRouteForTest,
} from "@/services/api/apiClient";
import {
  fetchAuthenticatedSettings,
  fetchCurrentUserWithFailover,
  loginWithFailover,
  logoutSessionWithFailover,
} from "@/services/api/authApi";
import {
  clearAuthSession,
  getCachedStoreSettings,
  getSessionToken,
  getUserSnapshot,
  setUserSnapshot,
} from "@/services/storage/secureStorage";
import {
  getStoredServerConfig,
  normalizeDualServerConfig,
  normalizeServerUrl,
  setStoredServerConfig,
  testDualServerConnection,
  testServerConnection,
} from "@/services/storage/serverConfig";
import type {
  AuthSessionUser,
  ConnectionTestResult,
  RoleCapabilities,
  ServerUrlConfig,
  StoreSettings,
  UserRole,
} from "@/types";

const SESSION_INVALID_NOTICE =
  "Sesi tidak valid atau akun dinonaktifkan. Silakan masuk kembali.";
const BLANK_CREDENTIALS_ERROR =
  "Username dan kata sandi wajib diisi sebelum masuk.";
const MISSING_SERVER_URL_ERROR =
  "Alamat server belum diatur. Buka panel Alamat Server API, masukkan URL server toko, lalu ketuk Tes Koneksi Server.";
const LOGIN_STORAGE_ERROR =
  "Gagal menyimpan sesi login ke penyimpanan aman perangkat. Pastikan penyimpanan perangkat tersedia lalu coba lagi.";
const SERVER_URL_STORAGE_ERROR =
  "Gagal menyimpan alamat server ke penyimpanan lokal perangkat. Silakan coba lagi.";

export interface AuthContextValue {
  user: AuthSessionUser | null;
  role: UserRole | null;
  isHydrated: boolean;
  isLoggingIn: boolean;
  isLoggingOut: boolean;
  retryAfterSeconds: number;
  authError: string | null;
  sessionNotice: string | null;
  serverUrl: string | null;
  serverConfig: ServerUrlConfig;
  storeSettings: StoreSettings | null;
  roleCapabilities: RoleCapabilities;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshStoreSettings: () => Promise<StoreSettings | null>;
  saveServerUrl: (
    rawUrl: string
  ) => { ok: true; url: string } | { ok: false; error: string };
  saveServerConfig: (raw: {
    primaryUrl?: string | null;
    fallbackUrl?: string | null;
  }) => { ok: true; config: ServerUrlConfig } | { ok: false; error: string };
  testServerUrl: (rawUrl: string) => Promise<ConnectionTestResult>;
  testDualServerUrl: (raw: {
    primaryUrl?: string | null;
    fallbackUrl?: string | null;
  }) => Promise<ConnectionTestResult>;
  clearAuthFeedback: () => void;
}

export function computeRoleCapabilities(
  role: UserRole | null
): RoleCapabilities {
  return {
    canEditProducts: role === "admin" || role === "owner",
    canViewCostPrice: role === "admin" || role === "owner",
    canManageStore: role === "owner",
    isReadOnlyCatalog: role === "kasir",
  };
}

const AuthContext = createContext<AuthContextValue | null>(null);

function resolveDisplayUrl(config: ServerUrlConfig): string | null {
  return config.primaryUrl ?? config.fallbackUrl;
}

function hasAnyServerUrl(config: ServerUrlConfig): boolean {
  return Boolean(config.primaryUrl || config.fallbackUrl);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number>(0);
  const [authError, setAuthError] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [serverConfig, setServerConfig] = useState<ServerUrlConfig>(() =>
    getStoredServerConfig()
  );
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(
    null
  );

  const isMountedRef = useRef<boolean>(true);
  const serverConfigRef = useRef<ServerUrlConfig>(serverConfig);
  const storeSettingsRef = useRef<StoreSettings | null>(null);
  const loginInFlightRef = useRef<boolean>(false);
  const logoutInFlightRef = useRef<Promise<void> | null>(null);
  const retryAfterRef = useRef<number>(0);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearCountdownTimer = useCallback(() => {
    if (countdownTimerRef.current !== null) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const startRetryCountdown = useCallback(
    (initialSeconds: number) => {
      clearCountdownTimer();
      const total = Math.max(1, Math.ceil(initialSeconds));
      retryAfterRef.current = total;
      setRetryAfterSeconds(total);

      countdownTimerRef.current = setInterval(() => {
        const next = retryAfterRef.current - 1;
        if (next <= 0) {
          clearCountdownTimer();
          retryAfterRef.current = 0;
          if (isMountedRef.current) {
            setRetryAfterSeconds(0);
            setAuthError(null);
          }
          return;
        }

        retryAfterRef.current = next;
        if (isMountedRef.current) {
          setRetryAfterSeconds(next);
        }
      }, 1000);
    },
    [clearCountdownTimer]
  );

  const applyServerConfigState = useCallback((config: ServerUrlConfig) => {
    serverConfigRef.current = config;
    if (isMountedRef.current) {
      setServerConfig(config);
    }
  }, []);

  const refreshStoreSettings = useCallback(
    async (explicitConfig?: ServerUrlConfig): Promise<StoreSettings | null> => {
      const config = explicitConfig ?? serverConfigRef.current;
      if (!hasAnyServerUrl(config)) {
        return null;
      }
      const epoch = getAuthEpoch();
      try {
        const settings = await fetchAuthenticatedSettings(config);
        if (settings && isMountedRef.current && epoch === getAuthEpoch()) {
          storeSettingsRef.current = settings;
          setStoreSettings(settings);
        }
        return settings;
      } catch {
        return null;
      }
    },
    []
  );

  const refreshUserWithConfig = useCallback(
    async (activeConfig: ServerUrlConfig) => {
      const epoch = getAuthEpoch();
      const res = await fetchCurrentUserWithFailover(activeConfig);
      if (!isMountedRef.current || epoch !== getAuthEpoch()) {
        return;
      }

      if (res.status === 200 && res.user) {
        const refreshedUser = res.user;
        try {
          await setUserSnapshot(refreshedUser, () => epoch === getAuthEpoch());
        } catch {
          // Preserve existing cached snapshot if native SecureStore write fails.
        }
        if (isMountedRef.current && epoch === getAuthEpoch()) {
          setUser(refreshedUser);
        }
        return;
      }

      if (res.status === 401 || res.status === 403 || res.sessionRevoked) {
        // apiRequest owns clearAuthSession() for 401 and /api/auth/me 403.
        setUser(null);
        setSessionNotice(SESSION_INVALID_NOTICE);
      }
    },
    []
  );

  const refreshUser = useCallback(async () => {
    const activeConfig = serverConfigRef.current;
    if (!hasAnyServerUrl(activeConfig)) {
      return;
    }
    await refreshUserWithConfig(activeConfig);
  }, [refreshUserWithConfig]);

  useEffect(() => {
    isMountedRef.current = true;
    let cancelled = false;

    const unsubscribe = registerSessionRevokedHandler(() => {
      if (!isMountedRef.current) {
        return;
      }
      setUser(null);
      setSessionNotice(SESSION_INVALID_NOTICE);
    });

    async function hydrate() {
      const mountEpoch = getAuthEpoch();
      const initialConfig = getStoredServerConfig();
      const initialSettings = getCachedStoreSettings();
      const [snapshotUser, sessionToken] = await Promise.all([
        getUserSnapshot(),
        getSessionToken(),
      ]);

      if (cancelled || !isMountedRef.current) {
        return;
      }

      serverConfigRef.current = initialConfig;
      storeSettingsRef.current = initialSettings;
      setServerConfig(initialConfig);
      setStoreSettings(initialSettings);

      const hasValidOfflineSession = Boolean(snapshotUser && sessionToken);
      if (hasValidOfflineSession && mountEpoch === getAuthEpoch()) {
        setUser(snapshotUser);
      } else if (
        snapshotUser &&
        !sessionToken &&
        mountEpoch === getAuthEpoch()
      ) {
        await clearAuthSession(() => mountEpoch === getAuthEpoch());
      }

      if (cancelled || !isMountedRef.current) {
        return;
      }
      setIsHydrated(true);

      if (
        hasValidOfflineSession &&
        hasAnyServerUrl(initialConfig) &&
        mountEpoch === getAuthEpoch()
      ) {
        try {
          const networkState = await Network.getNetworkStateAsync();
          if (
            cancelled ||
            !isMountedRef.current ||
            mountEpoch !== getAuthEpoch()
          ) {
            return;
          }
          if (networkState.isConnected !== false) {
            await refreshUserWithConfig(initialConfig);
            if (
              !cancelled &&
              isMountedRef.current &&
              mountEpoch === getAuthEpoch()
            ) {
              void refreshStoreSettings(initialConfig);
            }
          }
        } catch {
          // Preserve cached offline snapshot if network probe fails
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
      isMountedRef.current = false;
      clearCountdownTimer();
      unsubscribe();
    };
  }, [clearCountdownTimer, refreshStoreSettings, refreshUserWithConfig]);

  const login = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      if (loginInFlightRef.current || retryAfterRef.current > 0) {
        return false;
      }

      const trimmedUsername =
        typeof username === "string" ? username.trim() : "";
      const rawPassword = typeof password === "string" ? password : "";

      if (!trimmedUsername || !rawPassword) {
        setAuthError(BLANK_CREDENTIALS_ERROR);
        setSessionNotice(null);
        return false;
      }

      const activeConfig = hasAnyServerUrl(serverConfigRef.current)
        ? serverConfigRef.current
        : getStoredServerConfig();
      if (!hasAnyServerUrl(activeConfig)) {
        setAuthError(MISSING_SERVER_URL_ERROR);
        setSessionNotice(null);
        return false;
      }

      loginInFlightRef.current = true;
      setIsLoggingIn(true);
      setAuthError(null);
      setSessionNotice(null);
      bumpAuthEpoch();

      try {
        const result = await loginWithFailover(
          activeConfig,
          trimmedUsername,
          rawPassword
        );

        if (!isMountedRef.current) {
          return result.ok;
        }

        if (result.ok) {
          clearCountdownTimer();
          retryAfterRef.current = 0;
          setRetryAfterSeconds(0);
          setUser(result.user);
          setAuthError(null);
          setSessionNotice(null);

          void refreshStoreSettings(activeConfig);
          return true;
        }

        if (result.status === 429 && result.retryAfterSeconds) {
          setAuthError(result.error);
          startRetryCountdown(result.retryAfterSeconds);
        } else {
          setAuthError(result.error);
        }
        return false;
      } catch {
        if (isMountedRef.current) {
          setAuthError(LOGIN_STORAGE_ERROR);
        }
        return false;
      } finally {
        loginInFlightRef.current = false;
        if (isMountedRef.current) {
          setIsLoggingIn(false);
        }
      }
    },
    [clearCountdownTimer, refreshStoreSettings, startRetryCountdown]
  );

  const logout = useCallback(async (): Promise<void> => {
    if (logoutInFlightRef.current) {
      return logoutInFlightRef.current;
    }

    const activeConfig = serverConfigRef.current;
    bumpAuthEpoch();
    clearCountdownTimer();
    retryAfterRef.current = 0;

    if (isMountedRef.current) {
      setIsLoggingOut(true);
      setRetryAfterSeconds(0);
    }

    const logoutPromise = (async () => {
      try {
        await logoutSessionWithFailover(activeConfig);
      } finally {
        await clearAuthSession();
        resetActiveRouteForTest();
        if (isMountedRef.current) {
          setUser(null);
          setAuthError(null);
          setSessionNotice(null);
          setIsLoggingOut(false);
        }
        logoutInFlightRef.current = null;
      }
    })();

    logoutInFlightRef.current = logoutPromise;
    return logoutPromise;
  }, [clearCountdownTimer]);

  const saveServerConfig = useCallback(
    (raw: {
      primaryUrl?: string | null;
      fallbackUrl?: string | null;
    }):
      | { ok: true; config: ServerUrlConfig }
      | { ok: false; error: string } => {
      const normalized = normalizeDualServerConfig(raw);
      if (!normalized.ok) {
        return normalized;
      }
      try {
        const saved = setStoredServerConfig(normalized.config);
        if (!saved) {
          return { ok: false, error: SERVER_URL_STORAGE_ERROR };
        }
      } catch {
        return { ok: false, error: SERVER_URL_STORAGE_ERROR };
      }
      resetActiveRouteForTest();
      applyServerConfigState(normalized.config);
      return normalized;
    },
    [applyServerConfigState]
  );

  const saveServerUrl = useCallback(
    (
      rawUrl: string
    ): { ok: true; url: string } | { ok: false; error: string } => {
      const normalized = normalizeServerUrl(rawUrl);
      if (!normalized.ok) {
        return normalized;
      }
      const nextConfig: ServerUrlConfig = {
        primaryUrl: normalized.url,
        fallbackUrl: serverConfigRef.current.fallbackUrl,
      };
      try {
        const saved = setStoredServerConfig(nextConfig);
        if (!saved) {
          return { ok: false, error: SERVER_URL_STORAGE_ERROR };
        }
      } catch {
        return { ok: false, error: SERVER_URL_STORAGE_ERROR };
      }
      resetActiveRouteForTest();
      applyServerConfigState(nextConfig);
      return { ok: true, url: normalized.url };
    },
    [applyServerConfigState]
  );

  const testDualServerUrl = useCallback(
    async (raw: {
      primaryUrl?: string | null;
      fallbackUrl?: string | null;
    }): Promise<ConnectionTestResult> => {
      const normalized = normalizeDualServerConfig(raw);
      if (!normalized.ok) {
        return {
          ok: false,
          latencyMs: 0,
          error: normalized.error,
        };
      }

      let result: ConnectionTestResult;
      try {
        result = await testDualServerConnection(normalized.config);
      } catch {
        return {
          ok: false,
          latencyMs: 0,
          error: SERVER_URL_STORAGE_ERROR,
        };
      }

      if (!result.ok) {
        return result;
      }

      try {
        const saved = setStoredServerConfig(normalized.config);
        if (!saved) {
          return {
            ok: false,
            latencyMs: result.latencyMs,
            error: SERVER_URL_STORAGE_ERROR,
          };
        }
      } catch {
        return {
          ok: false,
          latencyMs: result.latencyMs,
          error: SERVER_URL_STORAGE_ERROR,
        };
      }

      resetActiveRouteForTest();
      applyServerConfigState(normalized.config);

      if (result.storeSettings) {
        storeSettingsRef.current = result.storeSettings;
        if (isMountedRef.current) {
          setStoreSettings(result.storeSettings);
        }
      }

      return result;
    },
    [applyServerConfigState]
  );

  const testServerUrl = useCallback(
    async (rawUrl: string): Promise<ConnectionTestResult> => {
      let result: ConnectionTestResult;
      try {
        result = await testServerConnection(rawUrl);
      } catch {
        return {
          ok: false,
          latencyMs: 0,
          error: SERVER_URL_STORAGE_ERROR,
        };
      }
      if (!result.ok) {
        return result;
      }

      const normalized = normalizeServerUrl(rawUrl);
      if (normalized.ok) {
        const nextConfig: ServerUrlConfig = {
          primaryUrl: normalized.url,
          fallbackUrl: serverConfigRef.current.fallbackUrl,
        };
        try {
          const saved = setStoredServerConfig(nextConfig);
          if (!saved) {
            return {
              ok: false,
              latencyMs: result.latencyMs,
              error: SERVER_URL_STORAGE_ERROR,
            };
          }
        } catch {
          return {
            ok: false,
            latencyMs: result.latencyMs,
            error: SERVER_URL_STORAGE_ERROR,
          };
        }
        resetActiveRouteForTest();
        applyServerConfigState(nextConfig);
      }

      if (result.storeSettings) {
        storeSettingsRef.current = result.storeSettings;
        if (isMountedRef.current) {
          setStoreSettings(result.storeSettings);
        }
      }

      return result;
    },
    [applyServerConfigState]
  );

  const clearAuthFeedback = useCallback(() => {
    setAuthError(null);
    setSessionNotice(null);
  }, []);

  const role = user?.role ?? null;
  const roleCapabilities = useMemo(
    () => computeRoleCapabilities(role),
    [role]
  );
  const serverUrl = resolveDisplayUrl(serverConfig);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role,
      isHydrated,
      isLoggingIn,
      isLoggingOut,
      retryAfterSeconds,
      authError,
      sessionNotice,
      serverUrl,
      serverConfig,
      storeSettings,
      roleCapabilities,
      login,
      logout,
      refreshUser,
      refreshStoreSettings,
      saveServerUrl,
      saveServerConfig,
      testServerUrl,
      testDualServerUrl,
      clearAuthFeedback,
    }),
    [
      user,
      role,
      isHydrated,
      isLoggingIn,
      isLoggingOut,
      retryAfterSeconds,
      authError,
      sessionNotice,
      serverUrl,
      serverConfig,
      storeSettings,
      roleCapabilities,
      login,
      logout,
      refreshUser,
      refreshStoreSettings,
      saveServerUrl,
      saveServerConfig,
      testServerUrl,
      testDualServerUrl,
      clearAuthFeedback,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
