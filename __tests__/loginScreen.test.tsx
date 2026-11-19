import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { resetTestStorage } from "./setup";
import LoginScreen from "@/app/(auth)/login";
import { AuthProvider } from "@/context/AuthContext";
import {
  getStoredServerUrl,
  setCachedStoreSettings,
  setStoredServerConfigRaw,
  setStoredServerUrl,
} from "@/services/storage/secureStorage";
import {
  DEFAULT_CLOUD_SERVER_URL,
  DEFAULT_PRIMARY_SERVER_URL,
  DUAL_SERVER_EMPTY_ERROR,
  DUAL_SERVER_UNREACHABLE_ERROR,
  SERVER_URL_INVALID_ERROR,
} from "@/services/storage/serverConfig";

const BASE_URL = "http://192.168.1.10:3000";

async function renderLogin() {
  return render(
    <AuthProvider>
      <LoginScreen />
    </AuthProvider>
  );
}

describe("LoginScreen and ServerUrlPanel (E1 & E2 UI-SPEC)", () => {
  beforeEach(() => {
    resetTestStorage();
    jest.clearAllMocks();
    globalThis.fetch = jest.fn() as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("renders TR monogram fallback when storeLogo is absent and renders logo + custom storeName when populated", async () => {
    const { unmount } = await renderLogin();

    await waitFor(() => {
      expect(screen.getByText("TR")).toBeTruthy();
    });
    expect(screen.getByText("Toko Rejeki")).toBeTruthy();
    expect(screen.queryByTestId("store-logo-image")).toBeNull();
    await unmount();

    resetTestStorage();
    setStoredServerUrl(BASE_URL);
    setCachedStoreSettings({
      storeName: "Toko Rejeki Cabang Dargo",
      storeLogo: "https://example.com/logo.png",
    });

    const second = await renderLogin();
    await waitFor(() => {
      expect(screen.getByTestId("store-logo-image")).toBeTruthy();
    });
    expect(screen.getByText("Toko Rejeki Cabang Dargo")).toBeTruthy();
    expect(screen.queryByText("TR")).toBeNull();
    expect(screen.getByTestId("store-logo-image").props.source).toEqual({
      uri: "https://example.com/logo.png",
    });
    await second.unmount();
  });

  it("toggles password visibility via the 48x48 Eye/EyeOff button and shows Memeriksa Akses... while loading", async () => {
    setStoredServerUrl(BASE_URL);
    setCachedStoreSettings({ storeName: "Toko Rejeki" });

    const { unmount } = await renderLogin();
    await waitFor(() => {
      expect(
        screen.getByTestId("server-url-panel-toggle").props.accessibilityState
          .expanded
      ).toBe(false);
    });

    const passwordInput = screen.getByTestId("login-password-input");
    expect(passwordInput.props.secureTextEntry).toBe(true);

    const showToggle = screen.getByLabelText("Tampilkan kata sandi");
    await fireEvent.press(showToggle);

    expect(screen.getByTestId("login-password-input").props.secureTextEntry).toBe(
      false
    );

    const hideToggle = screen.getByLabelText("Sembunyikan kata sandi");
    await fireEvent.press(hideToggle);
    expect(screen.getByTestId("login-password-input").props.secureTextEntry).toBe(
      true
    );

    // Loading state during in-flight login
    let resolveLogin!: (value: unknown) => void;
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLogin = resolve;
      })
    );

    await fireEvent.changeText(
      screen.getByTestId("login-username-input"),
      "kasir1"
    );
    await fireEvent.changeText(
      screen.getByTestId("login-password-input"),
      "secret123"
    );
    await fireEvent.press(screen.getByTestId("login-submit-button"));

    await waitFor(() => {
      expect(screen.getByText("Memeriksa Akses...")).toBeTruthy();
    });
    expect(
      screen.getByTestId("login-submit-button").props.accessibilityState
        .disabled
    ).toBe(true);

    await act(async () => {
      resolveLogin({
        ok: true,
        status: 200,
        _rawHeaders: [
          ["set-cookie", "pos_session=tok_ok.sig; Path=/; HttpOnly"],
        ],
        headers: new Headers(),
        json: async () => ({
          success: true,
          data: {
            id: "u1",
            username: "kasir1",
            fullName: "Budi Kasir",
            role: "kasir",
          },
        }),
      });
    });

    await unmount();
  });

  it("validates blank credentials without network, renders 401/403/offline errors, and runs live 429 countdown UI", async () => {
    setStoredServerUrl(BASE_URL);
    setCachedStoreSettings({ storeName: "Toko Rejeki" });

    const { unmount } = await renderLogin();
    await waitFor(() => {
      expect(
        screen.getByTestId("server-url-panel-toggle").props.accessibilityState
          .expanded
      ).toBe(false);
    });

    const fetchMock = globalThis.fetch as jest.Mock;

    // 400 client validation skips network
    await fireEvent.press(screen.getByTestId("login-submit-button"));
    expect(
      screen.getByText("Username dan kata sandi wajib diisi sebelum masuk.")
    ).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();

    await fireEvent.changeText(
      screen.getByTestId("login-username-input"),
      "kasir1"
    );
    await fireEvent.changeText(
      screen.getByTestId("login-password-input"),
      "wrong"
    );

    // 401 banner
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers(),
      json: async () => ({ success: false }),
    });
    await fireEvent.press(screen.getByTestId("login-submit-button"));
    await waitFor(() => {
      expect(
        screen.getByText(
          "Username atau kata sandi salah. Periksa kembali akun Anda dan coba masuk lagi."
        )
      ).toBeTruthy();
    });

    // 403 inactive account banner
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: new Headers(),
      json: async () => ({ success: false }),
    });
    await fireEvent.press(screen.getByTestId("login-submit-button"));
    await waitFor(() => {
      expect(
        screen.getByText(
          "Akun ini sedang dinonaktifkan. Hubungi pemilik toko (Owner) untuk mengaktifkan kembali."
        )
      ).toBeTruthy();
    });

    // 503 / offline banner
    fetchMock.mockRejectedValueOnce(new Error("Network error"));
    await fireEvent.press(screen.getByTestId("login-submit-button"));
    await waitFor(() => {
      expect(
        screen.getByText(
          "Server atau database toko tidak merespons. Periksa Alamat Server API dan pastikan perangkat berada di Wi-Fi toko yang sama."
        )
      ).toBeTruthy();
    });

    // 429 live countdown timer UI
    jest.useFakeTimers();
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: new Headers({ "Retry-After": "3" }),
      json: async () => ({ success: false, retryAfter: 3 }),
    });

    await fireEvent.press(screen.getByTestId("login-submit-button"));

    expect(
      screen.getByText(
        "Terlalu banyak percobaan gagal. Coba lagi dalam 3 detik."
      )
    ).toBeTruthy();
    expect(screen.getByText("Tunggu 3 Detik...")).toBeTruthy();
    expect(
      screen.getByTestId("login-submit-button").props.accessibilityState
        .disabled
    ).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(
      screen.getByText(
        "Terlalu banyak percobaan gagal. Coba lagi dalam 2 detik."
      )
    ).toBeTruthy();
    expect(screen.getByText("Tunggu 2 Detik...")).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(
      screen.getByText(
        "Terlalu banyak percobaan gagal. Coba lagi dalam 1 detik."
      )
    ).toBeTruthy();
    expect(screen.getByText("Tunggu 1 Detik...")).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByText("Masuk ke Sistem")).toBeTruthy();
    expect(
      screen.getByTestId("login-submit-button").props.accessibilityState
        .disabled
    ).toBe(false);
    expect(screen.queryByTestId("login-throttle-banner")).toBeNull();

    await unmount();
  });

  it("auto-expands ServerUrlPanel when unconfigured, shows Server LAN Terhubung on 200, and preserves saved URL on invalid/unreachable drafts", async () => {
    setStoredServerConfigRaw(
      JSON.stringify({ primaryUrl: null, fallbackUrl: null })
    );
    const first = await renderLogin();

    await waitFor(() => {
      expect(screen.getByText("Alamat Server Belum Terhubung")).toBeTruthy();
    });
    expect(
      screen.getByTestId("server-url-panel-toggle").props.accessibilityState
        .expanded
    ).toBe(true);

    const fetchMock = globalThis.fetch as jest.Mock;
    let resolveSettings!: (val: unknown) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSettings = resolve;
      })
    );

    await fireEvent.changeText(
      screen.getByTestId("server-url-input"),
      BASE_URL
    );
    await fireEvent.press(screen.getByTestId("server-test-button"));

    await waitFor(() => {
      expect(screen.getByText("Menguji Koneksi...")).toBeTruthy();
    });

    await act(async () => {
      resolveSettings({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            storeName: "Toko Rejeki Utama",
            storeLogo: "https://example.com/utama.png",
          },
        }),
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Server LAN Terhubung")).toBeTruthy();
    });
    expect(getStoredServerUrl()).toBe(BASE_URL);
    expect(screen.getByText("Toko Rejeki Utama")).toBeTruthy();
    expect(screen.getByTestId("store-logo-image")).toBeTruthy();
    expect(screen.queryByTestId("server-unconfigured-banner")).toBeNull();
    await first.unmount();

    // Now render fresh with saved URL and test invalid + unreachable draft preservation
    const second = await renderLogin();
    await waitFor(() => {
      expect(
        screen.getByTestId("server-url-panel-toggle").props.accessibilityState
          .expanded
      ).toBe(false);
    });

    await fireEvent.press(screen.getByTestId("server-url-panel-toggle"));
    expect(
      screen.getByTestId("server-url-panel-toggle").props.accessibilityState
        .expanded
    ).toBe(true);

    // Invalid draft via Save
    await fireEvent.changeText(
      screen.getByTestId("server-url-input"),
      "ftp://bad"
    );
    await fireEvent.press(screen.getByTestId("server-save-button"));
    expect(screen.getByText(SERVER_URL_INVALID_ERROR)).toBeTruthy();
    expect(getStoredServerUrl()).toBe(BASE_URL);

    // Dual-empty draft shows DUAL_SERVER_EMPTY_ERROR
    await fireEvent.changeText(screen.getByTestId("server-url-input"), " ");
    await fireEvent.changeText(
      screen.getByTestId("server-cloud-url-input"),
      ""
    );
    await fireEvent.press(screen.getByTestId("server-save-button"));
    expect(screen.getByText(DUAL_SERVER_EMPTY_ERROR)).toBeTruthy();

    // Unreachable host via Test Connection preserves saved URL
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await fireEvent.changeText(
      screen.getByTestId("server-url-input"),
      "http://10.0.2.2:3000"
    );
    await fireEvent.press(screen.getByTestId("server-test-button"));
    await waitFor(() => {
      expect(screen.getByText(DUAL_SERVER_UNREACHABLE_ERROR)).toBeTruthy();
    });
    expect(getStoredServerUrl()).toBe(BASE_URL);

    await second.unmount();
  });

  it("WR-05: locks ServerUrlPanel input & hint chips during test and ignores unmount completion cleanly", async () => {
    setStoredServerConfigRaw(
      JSON.stringify({ primaryUrl: null, fallbackUrl: null })
    );
    const fetchMock = globalThis.fetch as jest.Mock;
    let resolveTest!: (value: unknown) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveTest = resolve;
      })
    );

    const view = await renderLogin();
    await waitFor(() => {
      expect(screen.getByTestId("server-url-input")).toBeTruthy();
    });

    await fireEvent.changeText(
      screen.getByTestId("server-url-input"),
      BASE_URL
    );
    await fireEvent.press(screen.getByTestId("server-test-button"));

    await waitFor(() => {
      expect(screen.getByText("Menguji Koneksi...")).toBeTruthy();
    });

    expect(screen.getByTestId("server-url-input").props.editable).toBe(false);
    expect(
      screen.getByTestId("server-cloud-url-input").props.editable
    ).toBe(false);
    expect(
      screen.getByTestId("server-hint-lan").props.accessibilityState.disabled
    ).toBe(true);
    expect(
      screen.getByTestId("server-hint-emulator").props.accessibilityState
        .disabled
    ).toBe(true);
    expect(
      screen.getByTestId("server-hint-cloud").props.accessibilityState.disabled
    ).toBe(true);

    // Attempt mid-flight edit and hint chip tap -> draftUrl remains unchanged
    await fireEvent.press(screen.getByTestId("server-hint-emulator"));
    await fireEvent.changeText(
      screen.getByTestId("server-url-input"),
      "http://10.0.2.2:3000"
    );
    expect(screen.getByTestId("server-url-input").props.value).toBe(BASE_URL);

    // Unmount while request is still pending, then resolve without errors
    await view.unmount();
    await act(async () => {
      resolveTest({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { storeName: "Toko Unmounted" },
        }),
      });
    });
  });

  it("populates fresh install defaults (LAN + Cloud) and supports 3 quick-fill hint chips", async () => {
    const view = await renderLogin();
    await waitFor(() => {
      expect(
        screen.getByText(
          `${DEFAULT_PRIMARY_SERVER_URL} · Cadangan Cloud aktif`
        )
      ).toBeTruthy();
    });

    await fireEvent.press(screen.getByTestId("server-url-panel-toggle"));
    await fireEvent.changeText(screen.getByTestId("server-url-input"), "");
    await fireEvent.changeText(
      screen.getByTestId("server-cloud-url-input"),
      ""
    );

    await fireEvent.press(screen.getByTestId("server-hint-lan"));
    await fireEvent.press(screen.getByTestId("server-hint-cloud"));
    expect(screen.getByTestId("server-url-input").props.value).toBe(
      DEFAULT_PRIMARY_SERVER_URL
    );
    expect(screen.getByTestId("server-cloud-url-input").props.value).toBe(
      DEFAULT_CLOUD_SERVER_URL
    );

    await view.unmount();
  });

  it("WR-06: falls back to TR monogram when storeLogo image fails to load", async () => {
    setStoredServerUrl(BASE_URL);
    setCachedStoreSettings({
      storeName: "Toko Rejeki Error Logo",
      storeLogo: "https://invalid.example.com/missing-logo.png",
    });

    const view = await renderLogin();
    await waitFor(() => {
      expect(screen.getByTestId("store-logo-image")).toBeTruthy();
    });
    expect(screen.queryByText("TR")).toBeNull();

    await fireEvent(screen.getByTestId("store-logo-image"), "error");

    await waitFor(() => {
      expect(screen.getByText("TR")).toBeTruthy();
    });
    expect(screen.queryByTestId("store-logo-image")).toBeNull();

    await view.unmount();
  });
});
