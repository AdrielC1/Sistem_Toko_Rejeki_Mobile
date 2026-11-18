import { resetTestStorage } from "./setup";
import {
  getCachedStoreSettings,
  getStoredServerUrl,
  setCachedStoreSettings,
  setStoredServerUrl,
} from "@/services/storage/secureStorage";
import {
  SERVER_URL_HINTS,
  SERVER_URL_INVALID_ERROR,
  normalizeServerUrl,
  testServerConnection,
} from "@/services/storage/serverConfig";

describe("serverConfig", () => {
  beforeEach(() => {
    resetTestStorage();
    jest.clearAllMocks();
    globalThis.fetch = jest.fn() as unknown as typeof globalThis.fetch;
  });

  it("exposes LAN and Android Emulator helper hints", () => {
    expect(SERVER_URL_HINTS).toEqual({
      androidEmulator: "http://10.0.2.2:3000",
      lanExample: "http://192.168.1.10:3000",
    });
  });

  it("normalizes valid HTTP/HTTPS URLs and strips trailing slashes and /api suffixes", () => {
    expect(normalizeServerUrl("  http://192.168.1.10:3000/  ")).toEqual({
      ok: true,
      url: "http://192.168.1.10:3000",
    });
    expect(normalizeServerUrl("http://10.0.2.2:3000///")).toEqual({
      ok: true,
      url: "http://10.0.2.2:3000",
    });
    expect(normalizeServerUrl("https://kasir.example.com/api")).toEqual({
      ok: true,
      url: "https://kasir.example.com",
    });
    expect(normalizeServerUrl("https://kasir.example.com/api/")).toEqual({
      ok: true,
      url: "https://kasir.example.com",
    });
  });

  it("rejects empty, non-HTTP(S), or malformed URLs without overwriting saved server URL", async () => {
    setStoredServerUrl("http://192.168.1.10:3000");

    const invalidInputs = [
      "",
      "   ",
      "ftp://192.168.1.10:3000",
      "javascript:alert(1)",
      "192.168.1.10:3000",
      "http://",
      "http://..",
      "http://bad host:3000",
      "http://user:pass@192.168.1.10:3000",
    ];

    for (const badInput of invalidInputs) {
      expect(normalizeServerUrl(badInput)).toEqual({
        ok: false,
        error: SERVER_URL_INVALID_ERROR,
      });

      const connResult = await testServerConnection(badInput);
      expect(connResult.ok).toBe(false);
      expect(connResult.error).toBe(SERVER_URL_INVALID_ERROR);
    }

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(getStoredServerUrl()).toBe("http://192.168.1.10:3000");
  });

  it("tests pre-login connectivity against GET /api/settings (never /api/health) and caches storeSettings on 200", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          storeName: "Toko Rejeki Utama",
          storeAddress: "Jl. Dargo no. 9, Semarang Timur",
          storePhone: "082210104919",
          storeLogo: "data:image/png;base64,logo123",
          previewReceiptBeforePrint: false,
        },
      }),
    });

    const result = await testServerConnection("http://192.168.1.10:3000/api/");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toBe("http://192.168.1.10:3000/api/settings");
    expect(calledUrl).not.toContain("/api/health");
    expect(calledInit.credentials).toBe("omit");

    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.storeSettings).toEqual({
      storeName: "Toko Rejeki Utama",
      storeAddress: "Jl. Dargo no. 9, Semarang Timur",
      storePhone: "082210104919",
      storeLogo: "data:image/png;base64,logo123",
      previewReceiptBeforePrint: false,
    });
    expect(getCachedStoreSettings()).toEqual(result.storeSettings);
  });

  it("returns structured error on network/timeout/HTTP failure without overwriting valid saved URL or cached settings", async () => {
    setStoredServerUrl("http://192.168.1.10:3000");
    setCachedStoreSettings({ storeName: "Toko Lama" });

    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockRejectedValueOnce(new Error("Network request failed"));

    const netFailure = await testServerConnection("http://10.0.2.2:3000");
    expect(netFailure.ok).toBe(false);
    expect(netFailure.error).toBe(SERVER_URL_INVALID_ERROR);
    expect(getStoredServerUrl()).toBe("http://192.168.1.10:3000");
    expect(getCachedStoreSettings()).toEqual({ storeName: "Toko Lama" });

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ success: false }),
    });

    const httpFailure = await testServerConnection("http://10.0.2.2:3000");
    expect(httpFailure.ok).toBe(false);
    expect(httpFailure.error).toBe(SERVER_URL_INVALID_ERROR);
    expect(getStoredServerUrl()).toBe("http://192.168.1.10:3000");
    expect(getCachedStoreSettings()).toEqual({ storeName: "Toko Lama" });
  });
});
