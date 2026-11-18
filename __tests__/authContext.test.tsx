import React from "react";
import * as Network from "expo-network";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { resetTestStorage } from "./setup";
import {
  AuthProvider,
  computeRoleCapabilities,
  useAuth,
} from "@/context/AuthContext";
import {
  getCachedStoreSettings,
  getSessionToken,
  getStoredServerUrl,
  getUserSnapshot,
  setCachedStoreSettings,
  setSessionToken,
  setStoredServerUrl,
  setUserSnapshot,
} from "@/services/storage/secureStorage";
import { SERVER_URL_INVALID_ERROR } from "@/services/storage/serverConfig";
import type { AuthSessionUser } from "@/types";

const BASE_URL = "http://192.168.1.10:3000";

const KASIR_USER: AuthSessionUser = {
  id: "usr-kasir",
  username: "kasir1",
  fullName: "Budi Kasir",
  role: "kasir",
};

const OWNER_USER: AuthSessionUser = {
  id: "usr-owner",
  username: "owner1",
  fullName: "Siti Owner",
  role: "owner",
};

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("AuthContext and computeRoleCapabilities", () => {
  beforeEach(() => {
    resetTestStorage();
    jest.clearAllMocks();
    globalThis.fetch = jest.fn() as unknown as typeof globalThis.fetch;
    (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: "WIFI",
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("computes role capabilities accurately for owner, admin, kasir, and null", () => {
    expect(computeRoleCapabilities("owner")).toEqual({
      canEditProducts: true,
      canViewCostPrice: true,
      canManageStore: true,
      isReadOnlyCatalog: false,
    });
    expect(computeRoleCapabilities("admin")).toEqual({
      canEditProducts: true,
      canViewCostPrice: true,
      canManageStore: false,
      isReadOnlyCatalog: false,
    });
    expect(computeRoleCapabilities("kasir")).toEqual({
      canEditProducts: false,
      canViewCostPrice: false,
      canManageStore: false,
      isReadOnlyCatalog: true,
    });
    expect(computeRoleCapabilities(null)).toEqual({
      canEditProducts: false,
      canViewCostPrice: false,
      canManageStore: false,
      isReadOnlyCatalog: false,
    });
  });

  it("hydrates cached AuthSessionUser on offline cold boot without network revalidation", async () => {
    setStoredServerUrl(BASE_URL);
    setCachedStoreSettings({ storeName: "Toko Rejeki Semarang" });
    await setSessionToken("tok_offline.sig");
    await setUserSnapshot(KASIR_USER);
    (Network.getNetworkStateAsync as jest.Mock).mockResolvedValueOnce({
      isConnected: false,
      isInternetReachable: false,
      type: "NONE",
    });

    const { result, unmount } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    expect(result.current.user).toEqual(KASIR_USER);
    expect(result.current.role).toBe("kasir");
    expect(result.current.roleCapabilities.isReadOnlyCatalog).toBe(true);
    expect(result.current.isLoggingOut).toBe(false);
    expect(result.current.serverUrl).toBe(BASE_URL);
    expect(result.current.storeSettings).toEqual({
      storeName: "Toko Rejeki Semarang",
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();

    await unmount();
  });

  it("handles online /api/auth/me 200 update, 503/network preservation, and 401/403 revocation", async () => {
    setStoredServerUrl(BASE_URL);
    await setSessionToken("tok_online.sig");
    await setUserSnapshot(KASIR_USER);

    const updatedKasir: AuthSessionUser = {
      ...KASIR_USER,
      fullName: "Budi Kasir Updated",
    };

    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ success: true, data: updatedKasir }),
    });

    const { result, unmount } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.user?.fullName).toBe("Budi Kasir Updated");
    });
    expect(await getUserSnapshot()).toEqual(updatedKasir);

    // 503 DB offline preserves snapshot
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      headers: new Headers(),
      json: async () => ({ success: false, error: "DB down" }),
    });
    await act(async () => {
      await result.current.refreshUser();
    });
    expect(result.current.user).toEqual(updatedKasir);
    expect(await getSessionToken()).toBe("tok_online.sig");

    // Network failure preserves snapshot
    fetchMock.mockRejectedValueOnce(new Error("Network request failed"));
    await act(async () => {
      await result.current.refreshUser();
    });
    expect(result.current.user).toEqual(updatedKasir);

    // /api/auth/me 403 (inactive account) wipes session and sets notice
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: new Headers(),
      json: async () => ({ success: false, error: "Akun dinonaktifkan" }),
    });
    await act(async () => {
      await result.current.refreshUser();
    });
    expect(result.current.user).toBeNull();
    expect(result.current.role).toBeNull();
    expect(result.current.sessionNotice).toBe(
      "Sesi tidak valid atau akun dinonaktifkan. Silakan masuk kembali."
    );
    expect(await getSessionToken()).toBeNull();
    expect(await getUserSnapshot()).toBeNull();

    // Seed again and verify /api/auth/me 401 revokes session
    await setSessionToken("tok_401.sig");
    await setUserSnapshot(OWNER_USER);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers(),
      json: async () => ({ success: false, error: "Unauthorized" }),
    });
    await act(async () => {
      await result.current.refreshUser();
    });
    expect(result.current.user).toBeNull();
    expect(await getSessionToken()).toBeNull();
    expect(await getUserSnapshot()).toBeNull();

    await unmount();
  });

  it("ignores stale in-flight /api/auth/me HTTP 200 responses that resolve after logout()", async () => {
    setStoredServerUrl(BASE_URL);
    await setSessionToken("tok_race.sig");
    await setUserSnapshot(OWNER_USER);

    let resolveStaleMe!: (value: unknown) => void;
    const staleMePromise = new Promise((resolve) => {
      resolveStaleMe = resolve;
    });

    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith("/api/auth/me")) {
        return staleMePromise;
      }
      if (url.endsWith("/api/auth/logout")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ success: true }),
        });
      }
      return Promise.reject(new Error(`Unexpected URL: ${url}`));
    });

    const { result, unmount } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE_URL}/api/auth/me`,
        expect.anything()
      );
    });

    let resolveLogoutFetch!: (val: unknown) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLogoutFetch = resolve;
        })
    );

    let logoutPromise!: Promise<void>;
    await act(async () => {
      logoutPromise = result.current.logout();
    });
    expect(result.current.isLoggingOut).toBe(true);

    resolveLogoutFetch({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ success: true }),
    });

    await act(async () => {
      await logoutPromise;
    });

    expect(result.current.isLoggingOut).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.role).toBeNull();

    // Now resolve stale /api/auth/me with HTTP 200
    await act(async () => {
      resolveStaleMe({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ success: true, data: OWNER_USER }),
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.role).toBeNull();
    expect(await getSessionToken()).toBeNull();
    expect(await getUserSnapshot()).toBeNull();

    await unmount();
  });

  it("handles blank validation, 401/403 login errors, 429 countdown via fake timers, and rapid double-tap deduplication", async () => {
    setStoredServerUrl(BASE_URL);
    setCachedStoreSettings({ storeName: "Toko Rejeki" });

    const { result, unmount } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    const fetchMock = globalThis.fetch as jest.Mock;

    // Blank credentials skip network
    let ok = true;
    await act(async () => {
      ok = await result.current.login("   ", "");
    });
    expect(ok).toBe(false);
    expect(result.current.authError).toBe(
      "Username dan kata sandi wajib diisi sebelum masuk."
    );
    expect(fetchMock).not.toHaveBeenCalled();

    // 401 invalid credentials
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers(),
      json: async () => ({ success: false }),
    });
    await act(async () => {
      ok = await result.current.login("kasir1", "wrong");
    });
    expect(ok).toBe(false);
    expect(result.current.authError).toBe(
      "Username atau kata sandi salah. Periksa kembali akun Anda dan coba masuk lagi."
    );

    // 403 inactive account
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: new Headers(),
      json: async () => ({ success: false }),
    });
    await act(async () => {
      ok = await result.current.login("kasir1", "secret");
    });
    expect(ok).toBe(false);
    expect(result.current.authError).toBe(
      "Akun ini sedang dinonaktifkan. Hubungi pemilik toko (Owner) untuk mengaktifkan kembali."
    );

    // Concurrent rapid double-tap login issues only ONE POST
    fetchMock.mockClear();
    let resolveLoginFetch!: (value: unknown) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLoginFetch = resolve;
      })
    );

    let firstLogin!: Promise<boolean>;
    let secondLogin!: Promise<boolean>;
    await act(async () => {
      firstLogin = result.current.login("owner1", "secret");
      secondLogin = result.current.login("owner1", "secret");
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.isLoggingIn).toBe(true);

    resolveLoginFetch({
      ok: true,
      status: 200,
      _rawHeaders: [
        ["set-cookie", "pos_session=tok_owner.sig; Path=/; HttpOnly"],
      ],
      headers: new Headers(),
      json: async () => ({ success: true, data: OWNER_USER }),
    });

    let firstRes = false;
    let secondRes = true;
    await act(async () => {
      firstRes = await firstLogin;
      secondRes = await secondLogin;
    });
    expect(firstRes).toBe(true);
    expect(secondRes).toBe(false);
    expect(result.current.user).toEqual(OWNER_USER);
    expect(result.current.role).toBe("owner");

    // 429 throttle countdown ticks down 1s at a time and blocks bypass until 0
    jest.useFakeTimers();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers({ "Retry-After": "3" }),
      json: async () => ({ success: false, retryAfter: 3 }),
    });

    await act(async () => {
      ok = await result.current.login("owner1", "bad");
    });
    expect(ok).toBe(false);
    expect(result.current.retryAfterSeconds).toBe(3);

    // Attempted call during throttle does NOT hit network
    fetchMock.mockClear();
    await act(async () => {
      ok = await result.current.login("owner1", "secret");
    });
    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.retryAfterSeconds).toBe(2);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.retryAfterSeconds).toBe(1);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.retryAfterSeconds).toBe(0);
    expect(result.current.authError).toBeNull();

    // Unmount cleanly without lingering intervals
    await unmount();
  });

  it("persists saveServerUrl/testServerUrl only on success and preserves prior saved URL on failure", async () => {
    setStoredServerUrl(BASE_URL);
    setCachedStoreSettings({ storeName: "Toko Lama" });

    const { result, unmount } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.isHydrated).toBe(true);
    });

    // Invalid saveServerUrl preserves saved URL
    let saveRes: { ok: boolean; url?: string; error?: string } = { ok: true };
    await act(async () => {
      saveRes = result.current.saveServerUrl("ftp://invalid-host");
    });
    expect(saveRes).toEqual({ ok: false, error: SERVER_URL_INVALID_ERROR });
    expect(result.current.serverUrl).toBe(BASE_URL);
    expect(getStoredServerUrl()).toBe(BASE_URL);

    // Valid saveServerUrl normalizes and persists
    await act(async () => {
      saveRes = result.current.saveServerUrl("http://10.0.2.2:3000/api/");
    });
    expect(saveRes).toEqual({ ok: true, url: "http://10.0.2.2:3000" });
    expect(result.current.serverUrl).toBe("http://10.0.2.2:3000");
    expect(getStoredServerUrl()).toBe("http://10.0.2.2:3000");

    // Failed testServerUrl preserves saved URL & storeSettings
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    let testRes!: Awaited<ReturnType<typeof result.current.testServerUrl>>;
    await act(async () => {
      testRes = await result.current.testServerUrl("http://192.168.9.9:3000");
    });
    expect(testRes.ok).toBe(false);
    expect(result.current.serverUrl).toBe("http://10.0.2.2:3000");
    expect(getStoredServerUrl()).toBe("http://10.0.2.2:3000");
    expect(getCachedStoreSettings()).toEqual({ storeName: "Toko Lama" });

    // Successful testServerUrl updates both serverUrl and storeSettings
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          storeName: "Toko Rejeki Baru",
          storeLogo: "data:image/png;base64,abc",
        },
      }),
    });

    await act(async () => {
      testRes = await result.current.testServerUrl(
        "https://kasir.example.com/"
      );
    });
    expect(testRes.ok).toBe(true);
    expect(result.current.serverUrl).toBe("https://kasir.example.com");
    expect(getStoredServerUrl()).toBe("https://kasir.example.com");
    expect(result.current.storeSettings?.storeName).toBe("Toko Rejeki Baru");
    expect(getCachedStoreSettings()?.storeName).toBe("Toko Rejeki Baru");

    await unmount();
  });

  it("executes fail-safe offline logout and deduplicates concurrent logout calls", async () => {
    setStoredServerUrl(BASE_URL);
    await setSessionToken("tok_logout.sig");
    await setUserSnapshot(KASIR_USER);
    (Network.getNetworkStateAsync as jest.Mock).mockResolvedValueOnce({
      isConnected: false,
      isInternetReachable: false,
      type: "NONE",
    });

    const { result, unmount } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => {
      expect(result.current.user).toEqual(KASIR_USER);
    });

    const fetchMock = globalThis.fetch as jest.Mock;
    let rejectLogout!: (err: Error) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectLogout = reject;
        })
    );

    let p1!: Promise<void>;
    let p2!: Promise<void>;
    await act(async () => {
      p1 = result.current.logout();
      p2 = result.current.logout();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.isLoggingOut).toBe(true);

    rejectLogout(new Error("Network offline"));

    await act(async () => {
      await Promise.all([p1, p2]);
    });

    expect(result.current.isLoggingOut).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.role).toBeNull();
    expect(await getSessionToken()).toBeNull();
    expect(await getUserSnapshot()).toBeNull();

    await unmount();
  });
});
