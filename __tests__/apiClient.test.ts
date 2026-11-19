import * as SecureStore from "expo-secure-store";
import { Storage } from "expo-sqlite/kv-store";
import { resetTestStorage } from "./setup";
import {
  apiFetch,
  apiRequest,
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
  clearStoredServerUrl,
  clearUserSnapshot,
  getCachedStoreSettings,
  getSessionToken,
  getStoredServerUrl,
  getUserSnapshot,
  setSessionToken,
  setUserSnapshot,
} from "@/services/storage/secureStorage";
import type { AuthSessionUser } from "@/types";

const BASE_URL = "http://192.168.1.10:3000";

const SAMPLE_USER: AuthSessionUser = {
  id: "usr-1",
  username: "kasir1",
  fullName: "Budi Kasir",
  role: "kasir",
};

const SECOND_USER: AuthSessionUser = {
  id: "usr-2",
  username: "owner1",
  fullName: "Siti Owner",
  role: "owner",
};

describe("apiClient and authApi", () => {
  const activeUnsubscribers: (() => void)[] = [];

  beforeEach(() => {
    resetTestStorage();
    jest.clearAllMocks();
    globalThis.fetch = jest.fn() as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    while (activeUnsubscribers.length > 0) {
      const unsub = activeUnsubscribers.pop();
      unsub?.();
    }
    jest.restoreAllMocks();
  });

  it("injects Cookie: pos_session=<token> header and sets credentials: 'omit'", async () => {
    await setSessionToken("tok_abc.sig_123");
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ success: true, data: SAMPLE_USER }),
    });

    await apiFetch(BASE_URL, "/api/auth/me", { method: "GET" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toBe(`${BASE_URL}/api/auth/me`);
    expect(calledInit.credentials).toBe("omit");
    const sentHeaders = new Headers(calledInit.headers);
    expect(sentHeaders.get("Cookie")).toBe("pos_session=tok_abc.sig_123");
  });

  it("clears SecureStore and fires revocation handler on 401 (any endpoint) and 403 on /api/auth/me", async () => {
    const revokedSpy = jest.fn();
    activeUnsubscribers.push(registerSessionRevokedHandler(revokedSpy));

    await setSessionToken("tok_valid.sig");
    await setUserSnapshot(SAMPLE_USER);

    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers(),
      json: async () => ({ success: false, error: "Sesi kedaluwarsa" }),
    });

    const res401 = await apiRequest(BASE_URL, "/api/products", {
      method: "GET",
    });

    expect(res401.sessionRevoked).toBe(true);
    expect(await getSessionToken()).toBeNull();
    expect(await getUserSnapshot()).toBeNull();
    expect(revokedSpy).toHaveBeenCalledWith("Sesi kedaluwarsa");

    // Seed again and verify 403 specifically on /api/auth/me revokes session
    await setSessionToken("tok_inactive.sig");
    await setUserSnapshot(SAMPLE_USER);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: new Headers(),
      json: async () => ({
        success: false,
        error: "Akun tidak ditemukan atau telah dinonaktifkan",
      }),
    });

    const meRes403 = await fetchCurrentUser(BASE_URL);

    expect(meRes403.status).toBe(403);
    expect(meRes403.sessionRevoked).toBe(true);
    expect(meRes403.user).toBeNull();
    expect(await getSessionToken()).toBeNull();
    expect(await getUserSnapshot()).toBeNull();
    expect(revokedSpy).toHaveBeenCalledTimes(2);
  });

  it("preserves SecureStore session on non-/me 403, 503, 500, and network errors", async () => {
    const revokedSpy = jest.fn();
    activeUnsubscribers.push(registerSessionRevokedHandler(revokedSpy));

    await setSessionToken("tok_keep.sig");
    await setUserSnapshot(SAMPLE_USER);

    const fetchMock = globalThis.fetch as jest.Mock;

    // Feature 403 on /api/products (role permission denial) must NOT wipe session
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: new Headers(),
      json: async () => ({
        success: false,
        error: "Akses ditolak: peran Anda tidak memiliki izin",
      }),
    });
    const feature403 = await apiRequest(BASE_URL, "/api/products", {
      method: "POST",
      body: JSON.stringify({ name: "Test" }),
    });
    expect(feature403.status).toBe(403);
    expect(feature403.sessionRevoked).toBe(false);
    expect(await getSessionToken()).toBe("tok_keep.sig");
    expect(await getUserSnapshot()).toEqual(SAMPLE_USER);

    // 503 DB unreachable
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      headers: new Headers(),
      json: async () => ({ success: false, error: "Database offline" }),
    });
    const res503 = await apiRequest(BASE_URL, "/api/auth/me");
    expect(res503.status).toBe(503);
    expect(res503.sessionRevoked).toBe(false);
    expect(await getSessionToken()).toBe("tok_keep.sig");

    // 500 internal error
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers(),
      json: async () => ({ success: false, error: "Server error" }),
    });
    const res500 = await apiRequest(BASE_URL, "/api/auth/me");
    expect(res500.status).toBe(500);
    expect(res500.sessionRevoked).toBe(false);
    expect(await getSessionToken()).toBe("tok_keep.sig");

    // Network offline error
    fetchMock.mockRejectedValueOnce(new Error("Network request failed"));
    const netErr = await fetchCurrentUser(BASE_URL);
    expect(netErr.networkError).toBe(true);
    expect(netErr.offline).toBe(true);
    expect(netErr.sessionRevoked).toBe(false);
    expect(await getSessionToken()).toBe("tok_keep.sig");
    expect(await getUserSnapshot()).toEqual(SAMPLE_USER);
    expect(revokedSpy).not.toHaveBeenCalled();
  });

  it("guards against stale /api/auth/me 401 responses via authEpoch after a newer login", async () => {
    const revokedSpy = jest.fn();
    activeUnsubscribers.push(registerSessionRevokedHandler(revokedSpy));

    let resolveStaleMe!: (value: unknown) => void;
    const staleMePromise = new Promise((resolve) => {
      resolveStaleMe = resolve;
    });

    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockReturnValueOnce(staleMePromise);

    // Start in-flight /api/auth/me under older authEpoch
    const inFlightMe = fetchCurrentUser(BASE_URL);

    // Newer login completes and bumps authEpoch
    const priorEpoch = getAuthEpoch();
    await setSessionToken("new_owner_token.sig");
    await setUserSnapshot(SECOND_USER);
    expect(bumpAuthEpoch()).toBe(priorEpoch + 1);

    // Older /api/auth/me now resolves with 401
    resolveStaleMe({
      ok: false,
      status: 401,
      headers: new Headers(),
      json: async () => ({ success: false, error: "Old token expired" }),
    });

    const staleResult = await inFlightMe;

    expect(staleResult.sessionRevoked).toBe(false);
    expect(await getSessionToken()).toBe("new_owner_token.sig");
    expect(await getUserSnapshot()).toEqual(SECOND_USER);
    expect(revokedSpy).not.toHaveBeenCalled();
  });

  it("loginWithCredentials stores extracted pos_session, emits safe __DEV__ diagnostics, and clears stale token if 200 returns null token", async () => {
    const infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
    const fetchMock = globalThis.fetch as jest.Mock;

    // Case 1: blank validation skips fetch
    const blankRes = await loginWithCredentials(BASE_URL, "   ", "");
    expect(blankRes).toEqual({
      ok: false,
      status: 400,
      error: "Username dan kata sandi wajib diisi sebelum masuk.",
    });
    expect(fetchMock).not.toHaveBeenCalled();

    // Case 2: 200 login with Set-Cookie stores token & emits boolean+length __DEV__ telemetry
    const rawToken = "fresh_payload_123.fresh_sig_456";
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      _rawHeaders: [
        ["set-cookie", `pos_session=${rawToken}; Path=/; HttpOnly`],
      ],
      headers: new Headers(),
      json: async () => ({ success: true, data: SAMPLE_USER }),
    });

    const okLogin = await loginWithCredentials(BASE_URL, "kasir1", "secret");
    expect(okLogin).toEqual({ ok: true, user: SAMPLE_USER });
    expect(await getSessionToken()).toBe(rawToken);
    expect(await getUserSnapshot()).toEqual(SAMPLE_USER);
    expect(infoSpy).toHaveBeenCalledWith("[AuthSpike] pos_session capture:", {
      captured: true,
      length: rawToken.length,
    });
    expect(JSON.stringify(infoSpy.mock.calls)).not.toContain(rawToken);

    // Case 3: 200 login without Set-Cookie MUST wipe prior user's pos_session_token
    infoSpy.mockClear();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      _rawHeaders: [],
      headers: new Headers(),
      json: async () => ({ success: true, data: SECOND_USER }),
    });

    const nullTokenLogin = await loginWithCredentials(
      BASE_URL,
      "owner1",
      "secret2"
    );
    expect(nullTokenLogin).toEqual({ ok: true, user: SECOND_USER });
    expect(await getSessionToken()).toBeNull();
    expect(await getUserSnapshot()).toEqual(SECOND_USER);
    expect(infoSpy).toHaveBeenCalledWith("[AuthSpike] pos_session capture:", {
      captured: false,
      length: 0,
    });
  });

  it("aborts timed-out requests via AbortController and handles corrupt storage JSON defensively", async () => {
    await SecureStore.setItemAsync("pos_user_snapshot", "{bad-json");
    Storage.setItemSync("pos_store_settings", "{bad-json");
    Storage.setItemSync("pos_server_base_url", "http://192.168.1.10:3000");

    expect(await getUserSnapshot()).toBeNull();
    expect(getCachedStoreSettings()).toBeNull();
    clearStoredServerUrl();
    expect(getStoredServerUrl()).toBeNull();
    await setUserSnapshot(SAMPLE_USER);
    await clearUserSnapshot();
    expect(await getUserSnapshot()).toBeNull();

    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockImplementationOnce(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const abortErr = new Error("Aborted");
            abortErr.name = "AbortError";
            reject(abortErr);
          });
        })
    );

    const timedOutResult = await apiRequest(BASE_URL, "/api/auth/me", {
      timeoutMs: 15,
    });
    expect(timedOutResult.networkError).toBe(true);
    expect(timedOutResult.timedOut).toBe(true);
    expect(timedOutResult.sessionRevoked).toBe(false);
  });

  it("handles 429 retryAfter, 401/403 login errors, fail-safe offline logout, and public settings fetch", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers({ "Retry-After": "8" }),
      json: async () => ({ success: false, retryAfter: 8 }),
    });
    const res429 = await loginWithCredentials(BASE_URL, "kasir1", "wrong");
    expect(res429).toEqual({
      ok: false,
      status: 429,
      error: "Terlalu banyak percobaan gagal. Coba lagi dalam 8 detik.",
      retryAfterSeconds: 8,
    });

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: new Headers(),
      json: async () => ({ success: false }),
    });
    const res403 = await loginWithCredentials(BASE_URL, "kasir1", "ok");
    expect(res403).toEqual({
      ok: false,
      status: 403,
      error:
        "Akun ini sedang dinonaktifkan. Hubungi pemilik toko (Owner) untuk mengaktifkan kembali.",
    });

    // Fail-safe offline logout never throws
    fetchMock.mockRejectedValueOnce(new Error("Offline"));
    await expect(logoutSession(BASE_URL)).resolves.toBeUndefined();

    // Public settings caches on 200
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        success: true,
        data: { storeName: "Toko Rejeki Semarang", previewReceiptBeforePrint: false },
      }),
    });
    const settings = await fetchPublicSettings(BASE_URL);
    expect(settings).toEqual({
      storeName: "Toko Rejeki Semarang",
      previewReceiptBeforePrint: false,
    });
    expect(getCachedStoreSettings()).toEqual(settings);
  });

  it("IN-03 & IN-04: preserves FormData Content-Type, requires JSON on 200 (allows 204), and skips non-positive retryAfter", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;

    // IN-03a: FormData / non-string body does not force Content-Type: application/json
    const formData = new FormData();
    formData.append("file", "dummy");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 204,
      headers: new Headers(),
      json: async () => {
        throw new Error("No body");
      },
    });
    const res204 = await apiRequest(BASE_URL, "/api/upload", {
      method: "POST",
      body: formData as unknown as BodyInit,
    });
    const [, uploadInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(uploadInit.headers).get("Content-Type")).toBeNull();
    expect(res204.ok).toBe(true);
    expect(res204.status).toBe(204);

    // IN-03b: HTTP 200 with non-JSON body (e.g., captive portal HTML) is treated as failure
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON");
      },
    });
    const nonJson200 = await apiRequest(BASE_URL, "/api/auth/me");
    expect(nonJson200.ok).toBe(false);
    expect(nonJson200.status).toBe(200);

    // IN-04: retryAfter <= 0 falls back to Retry-After HTTP header
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers({ "Retry-After": "7" }),
      json: async () => ({ success: false, retryAfter: 0 }),
    });
    const res429 = await loginWithCredentials(BASE_URL, "kasir1", "wrong");
    expect(res429.ok).toBe(false);
    if (!res429.ok) {
      expect(res429.retryAfterSeconds).toBe(7);
    }
  });

  it("handles Smart Auto LAN->Cloud failover safely and queries ?scope=mini / /api/health", async () => {
    const {
      apiRequestWithFailover,
      getActiveRoute,
      resetActiveRouteForTest,
    } = require("@/services/api/apiClient");
    const {
      fetchClusterHealth,
      probeLanHealthOnly,
    } = require("@/services/api/healthApi");
    const {
      fetchDeltaCatalogSync,
      fetchFullCatalogSync,
      SyncTransportError,
    } = require("@/services/api/syncApi");

    resetActiveRouteForTest();
    const fetchMock = globalThis.fetch as jest.Mock;
    const config = {
      primaryUrl: "http://192.168.1.100:3000",
      fallbackUrl: "https://kasir.tokorejeki.my.id",
    };

    // 1. JSON 503 offline on LAN NEVER fails over to Cloud
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      headers: new Headers(),
      json: async () => ({ success: false, offline: true, error: "DB down" }),
    });
    const res503 = await apiRequestWithFailover(config, "/api/health");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res503.usedRoute).toBe("lan");
    expect(res503.offline).toBe(true);

    // 2. HTTP 401 on LAN NEVER fails over to Cloud (and clears auth once)
    await setSessionToken("tok_lan.sig");
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers(),
      json: async () => ({ success: false, error: "Unauthorized" }),
    });
    const res401 = await apiRequestWithFailover(config, "/api/products");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res401.usedRoute).toBe("lan");
    expect(res401.sessionRevoked).toBe(true);

    // 3. LAN network failure fails over cleanly to Cloud & flips activeRoute
    fetchMock
      .mockRejectedValueOnce(new Error("Network unreachable"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          status: "online",
          db: "connected",
          serverTime: "2026-11-19T10:00:00Z",
          latencyMs: 42,
        }),
      });
    const health = await fetchClusterHealth(config);
    expect(health.serverReachable).toBe(true);
    expect(health.dbOnline).toBe(true);
    expect(health.usedRoute).toBe("cloud");
    expect(getActiveRoute()).toBe("cloud");

    // 4. Subsequent sync calls use Cloud first when activeRoute === "cloud" & pass ?scope=mini
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
          serverTime: "2026-11-19T10:05:00Z",
          totalProducts: 0,
        },
      }),
    });
    const fullRes = await fetchFullCatalogSync(config, "cli-123");
    expect(fullRes.usedRoute).toBe("cloud");
    const [fullUrl] = fetchMock.mock.calls.at(-1) as [string];
    expect(fullUrl).toBe("https://kasir.tokorejeki.my.id/api/sync/full?scope=mini");

    // 5. Delta sync throws SyncTransportError("DB_OFFLINE") on 503 offline
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      headers: new Headers(),
      json: async () => ({ success: false, offline: true }),
    });
    await expect(
      fetchDeltaCatalogSync(config, "2026-11-19T10:00:00Z")
    ).rejects.toBeInstanceOf(SyncTransportError);

    // 6. probeLanHealthOnly checks LAN directly without changing activeRoute on failure
    fetchMock.mockRejectedValueOnce(new Error("LAN still unreachable"));
    const probeFail = await probeLanHealthOnly("http://192.168.1.100:3000");
    expect(probeFail.ok).toBe(false);
    expect(getActiveRoute()).toBe("cloud");
  });
});
