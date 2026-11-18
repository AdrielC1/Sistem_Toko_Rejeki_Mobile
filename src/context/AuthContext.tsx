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
} from "@/services/api/apiClient";
import {
  fetchCurrentUser,
  fetchPublicSettings,
  loginWithCredentials,
  logoutSession,
} from "@/services/api/authApi";
import {
  clearAuthSession,
  getCachedStoreSettings,
  getSessionToken,
  getStoredServerUrl,
  getUserSnapshot,
  setCachedStoreSettings,
  setStoredServerUrl,
  setUserSnapshot,
} from "@/services/storage/secureStorage";
import {
  normalizeServerUrl,
  testServerConnection,
} from "@/services/storage/serverConfig";
import type {
  AuthSessionUser,
  ConnectionTestResult,
  RoleCapabilities,
  StoreSettings,
  UserRole,
} from "@/types";

const SESSION_INVALID_NOTICE =
  "Sesi tidak valid atau akun dinonaktifkan. Silakan masuk kembali.";
const BLANK_CREDENTIALS_ERROR =
  "Username dan kata sandi wajib diisi sebelum masuk.";
const MISSING_SERVER_URL_ERROR =
  "Alamat server belum diatur. Buka panel Alamat Server API, masukkan URL server toko, lalu ketuk Tes Koneksi Server.";

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
  storeSettings: StoreSettings | null;
  roleCapabilities: RoleCapabilities;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  saveServerUrl: (
    rawUrl: string
  ) => { ok: true; url: string } | { ok: false; error: string };
  testServerUrl: (rawUrl: string) => Promise<ConnectionTestResult>;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number>(0);
  const [authError, setAuthError] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(
    null
  );

  const isMountedRef = useRef<boolean>(true);
  const serverUrlRef = useRef<string | null>(null);
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

  const refreshUserWithBaseUrl = useCallback(async (activeUrl: string) => {
    const epoch = getAuthEpoch();
    const res = await fetchCurrentUser(activeUrl);
    if (!isMountedRef.current || epoch !== getAuthEpoch()) {
      return;
    }

    if (res.status === 200 && res.user) {
      setUser(res.user);
      await setUserSnapshot(res.user);
      // Guard against logout() occurring while setUserSnapshot awaited SecureStore
      if (epoch !== getAuthEpoch()) {
        await clearAuthSession();
        return;
      }
      return;
    }

    if (res.status === 401 || res.status === 403 || res.sessionRevoked) {
      await clearAuthSession();
      if (!isMountedRef.current || epoch !== getAuthEpoch()) {
        return;
      }
      setUser(null);
      setSessionNotice(SESSION_INVALID_NOTICE);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const activeUrl = serverUrlRef.current ?? getStoredServerUrl();
    if (!activeUrl) {
      return;
    }
    await refreshUserWithBaseUrl(activeUrl);
  }, [refreshUserWithBaseUrl]);

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
      const initialServerUrl = getStoredServerUrl();
      const initialSettings = getCachedStoreSettings();
      const [snapshotUser] = await Promise.all([
        getUserSnapshot(),
        getSessionToken(),
      ]);

      if (cancelled || !isMountedRef.current) {
        return;
      }

      serverUrlRef.current = initialServerUrl;
      storeSettingsRef.current = initialSettings;
      setServerUrl(initialServerUrl);
      setStoreSettings(initialSettings);

      if (snapshotUser && mountEpoch === getAuthEpoch()) {
        setUser(snapshotUser);
      }
      setIsHydrated(true);

      if (
        snapshotUser &&
        initialServerUrl &&
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
            await refreshUserWithBaseUrl(initialServerUrl);
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
  }, [clearCountdownTimer, refreshUserWithBaseUrl]);

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

      const activeUrl = serverUrlRef.current ?? getStoredServerUrl();
      if (!activeUrl) {
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
        const result = await loginWithCredentials(
          activeUrl,
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

          if (!storeSettingsRef.current) {
            void fetchPublicSettings(activeUrl).then((settings) => {
              if (settings && isMountedRef.current) {
                storeSettingsRef.current = settings;
                setStoreSettings(settings);
              }
            });
          }
          return true;
        }

        if (result.status === 429 && result.retryAfterSeconds) {
          setAuthError(result.error);
          startRetryCountdown(result.retryAfterSeconds);
        } else {
          setAuthError(result.error);
        }
        return false;
      } finally {
        loginInFlightRef.current = false;
        if (isMountedRef.current) {
          setIsLoggingIn(false);
        }
      }
    },
    [clearCountdownTimer, startRetryCountdown]
  );

  const logout = useCallback(async (): Promise<void> => {
    if (logoutInFlightRef.current) {
      return logoutInFlightRef.current;
    }

    const activeUrl = serverUrlRef.current ?? getStoredServerUrl() ?? "";
    bumpAuthEpoch();
    clearCountdownTimer();
    retryAfterRef.current = 0;

    if (isMountedRef.current) {
      setIsLoggingOut(true);
      setRetryAfterSeconds(0);
    }

    const logoutPromise = (async () => {
      try {
        await logoutSession(activeUrl);
      } finally {
        await clearAuthSession();
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

  const saveServerUrl = useCallback(
    (
      rawUrl: string
    ): { ok: true; url: string } | { ok: false; error: string } => {
      const normalized = normalizeServerUrl(rawUrl);
      if (!normalized.ok) {
        return normalized;
      }
      setStoredServerUrl(normalized.url);
      serverUrlRef.current = normalized.url;
      setServerUrl(normalized.url);
      return normalized;
    },
    []
  );

  const testServerUrl = useCallback(
    async (rawUrl: string): Promise<ConnectionTestResult> => {
      const result = await testServerConnection(rawUrl);
      if (!result.ok) {
        return result;
      }

      const normalized = normalizeServerUrl(rawUrl);
      if (normalized.ok) {
        setStoredServerUrl(normalized.url);
        serverUrlRef.current = normalized.url;
        if (isMountedRef.current) {
          setServerUrl(normalized.url);
        }
      }

      if (result.storeSettings) {
        setCachedStoreSettings(result.storeSettings);
        storeSettingsRef.current = result.storeSettings;
        if (isMountedRef.current) {
          setStoreSettings(result.storeSettings);
        }
      }

      return result;
    },
    []
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
      storeSettings,
      roleCapabilities,
      login,
      logout,
      refreshUser,
      saveServerUrl,
      testServerUrl,
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
      storeSettings,
      roleCapabilities,
      login,
      logout,
      refreshUser,
      saveServerUrl,
      testServerUrl,
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
