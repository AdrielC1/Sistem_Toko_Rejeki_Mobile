import React from "react";
import * as Font from "expo-font";
import * as Network from "expo-network";
import * as SplashScreen from "expo-splash-screen";
import {
  fireEvent,
  renderRouter,
  screen,
  waitFor,
  within,
} from "expo-router/testing-library";
import { resetTestStorage } from "./setup";
import {
  getSessionToken,
  getUserSnapshot,
  setCachedStoreSettings,
  setSessionToken,
  setStoredServerUrl,
  setUserSnapshot,
} from "@/services/storage/secureStorage";
import type { AuthSessionUser } from "@/types";

const BASE_URL = "http://192.168.1.10:3000";

jest.setTimeout(15000);

const KASIR_USER: AuthSessionUser = {
  id: "u-kasir",
  username: "kasir1",
  fullName: "Siti Kasir",
  role: "kasir",
};

const ADMIN_USER: AuthSessionUser = {
  id: "u-admin",
  username: "admin1",
  fullName: "Rina Admin",
  role: "admin",
};

const OWNER_USER: AuthSessionUser = {
  id: "u-owner",
  username: "owner1",
  fullName: "Budi Owner",
  role: "owner",
};

async function seedSession(
  user: AuthSessionUser,
  options: { online?: boolean } = {}
) {
  const { online = false } = options;
  setStoredServerUrl(BASE_URL);
  setCachedStoreSettings({ storeName: "Toko Rejeki" });
  await setSessionToken(`tok_${user.id}.sig`);
  await setUserSnapshot(user);

  (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
    isConnected: online,
    isInternetReachable: online,
    type: online ? "WIFI" : "NONE",
  });
}

describe("Root Stack.Protected, 4-tab Velocity Blue shell & RBAC integration", () => {
  beforeEach(() => {
    resetTestStorage();
    jest.clearAllMocks();
    globalThis.fetch = jest.fn() as unknown as typeof globalThis.fetch;
    (Font.useFonts as jest.Mock).mockReturnValue([true, null]);
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

  it("holds SplashScreen while fonts are still loading", async () => {
    (Font.useFonts as jest.Mock).mockReturnValue([false, null]);
    const heldView = await renderRouter("./src/app", { initialUrl: "/" });

    await new Promise<void>((resolve) => {
      Promise.resolve().then(resolve);
    });

    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
    expect(screen.queryByText("Masuk ke Sistem")).toBeNull();
    expect(screen.queryByTestId("bottom-tab-bar")).toBeNull();
    await heldView.unmount();
  });

  it("tolerates font load errors and releases SplashScreen once auth hydrates", async () => {
    (Font.useFonts as jest.Mock).mockReturnValue([
      false,
      new Error("Font timeout"),
    ]);
    const fallbackView = await renderRouter("./src/app", { initialUrl: "/" });

    await waitFor(() => {
      expect(screen.getByText("Masuk ke Sistem")).toBeTruthy();
    });
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
    await fallbackView.unmount();
  });

  it("retains offline/503 session snapshot into 4-tab shell and wipes session on /api/auth/me 403", async () => {
    await seedSession(KASIR_USER, { online: true });
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      headers: new Headers(),
      json: async () => ({ success: false, error: "DB down" }),
    });

    const dbOfflineView = await renderRouter("./src/app", { initialUrl: "/" });

    await waitFor(() => {
      expect(screen.getByText("Halo, Siti Kasir")).toBeTruthy();
    });
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
    expect(screen.getByTestId("bottom-tab-bar")).toBeTruthy();
    expect(await getSessionToken()).toBe(`tok_${KASIR_USER.id}.sig`);
    await dbOfflineView.unmount();

    resetTestStorage();
    jest.clearAllMocks();
    await seedSession(KASIR_USER, { online: true });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      headers: new Headers(),
      json: async () => ({ success: false, error: "Akun dinonaktifkan" }),
    });

    const revokedView = await renderRouter("./src/app", { initialUrl: "/" });

    await waitFor(() => {
      expect(screen.getByText("Masuk ke Sistem")).toBeTruthy();
    });
    expect(
      screen.getByText(
        "Sesi tidak valid atau akun dinonaktifkan. Silakan masuk kembali."
      )
    ).toBeTruthy();
    expect(screen.queryByTestId("bottom-tab-bar")).toBeNull();
    expect(await getSessionToken()).toBeNull();
    expect(await getUserSnapshot()).toBeNull();
    await revokedView.unmount();
  });

  it("blocks unauthenticated entry to /, /kasir, and /produk via <Stack.Protected>", async () => {
    const rootView = await renderRouter("./src/app", { initialUrl: "/" });
    await waitFor(() => {
      expect(screen.getByText("Masuk ke Sistem")).toBeTruthy();
      expect(rootView.getPathname()).toBe("/login");
    });
    expect(screen.getByText("Alamat Server API")).toBeTruthy();
    expect(screen.queryByTestId("bottom-tab-bar")).toBeNull();
    await rootView.unmount();

    const blockedKasir = await renderRouter("./src/app", {
      initialUrl: "/kasir",
    });
    await waitFor(() => {
      expect(screen.getByText("Masuk ke Sistem")).toBeTruthy();
      expect(blockedKasir.getPathname()).toBe("/login");
    });
    expect(screen.queryByText(/Halo,/)).toBeNull();
    expect(screen.queryByTestId("bottom-tab-bar")).toBeNull();
    await blockedKasir.unmount();

    const blockedProduk = await renderRouter("./src/app", {
      initialUrl: "/produk",
    });
    await waitFor(() => {
      expect(screen.getByText("Masuk ke Sistem")).toBeTruthy();
      expect(blockedProduk.getPathname()).toBe("/login");
    });
    expect(screen.queryByText("Mode Baca Saja (Kasir)")).toBeNull();
    expect(screen.queryByText("Mode Kelola Katalog Aktif")).toBeNull();
    expect(screen.queryByTestId("bottom-tab-bar")).toBeNull();
    await blockedProduk.unmount();
  });

  it("mounts all 4 Velocity Blue bottom tabs for kasir and enforces read-only policy on Produk", async () => {
    await seedSession(KASIR_USER, { online: false });
    const routerView = await renderRouter("./src/app", { initialUrl: "/" });

    await waitFor(() => {
      expect(screen.getByText("Halo, Siti Kasir")).toBeTruthy();
      expect(routerView.getPathname()).toBe("/kasir");
    });

    const tabBar = screen.getByTestId("bottom-tab-bar");
    expect(within(tabBar).getByText("Kasir")).toBeTruthy();
    expect(within(tabBar).getByText("Produk")).toBeTruthy();
    expect(within(tabBar).getByText("Pesanan")).toBeTruthy();
    expect(within(tabBar).getByText("Pengaturan")).toBeTruthy();
    expect(
      screen.getByTestId("tab-kasir").props.accessibilityState.selected
    ).toBe(true);

    // Tap Produk tab -> shows Mode Baca Saja (Kasir) only
    await fireEvent.press(screen.getByTestId("tab-produk"));
    await waitFor(() => {
      expect(screen.getByText("Mode Baca Saja (Kasir)")).toBeTruthy();
    });
    expect(screen.queryByText("Mode Kelola Katalog Aktif")).toBeNull();
    expect(
      screen.getByTestId("tab-produk").props.accessibilityState.selected
    ).toBe(true);

    // Tap Pesanan tab -> shows empty state without hardcoded badge
    await fireEvent.press(screen.getByTestId("tab-pesanan"));
    await waitFor(() => {
      expect(screen.getByText("Belum Ada Pesanan Tertunda")).toBeTruthy();
    });
    expect(
      screen.getByTestId("tab-pesanan").props.accessibilityState.selected
    ).toBe(true);

    await routerView.unmount();
  });

  it("displays Mode Kelola Katalog Aktif and hides Mode Baca Saja (Kasir) for admin and owner", async () => {
    await seedSession(ADMIN_USER, { online: false });
    const adminView = await renderRouter("./src/app", {
      initialUrl: "/produk",
    });

    await waitFor(() => {
      expect(screen.getByText("Mode Kelola Katalog Aktif")).toBeTruthy();
    });
    expect(screen.queryByText("Mode Baca Saja (Kasir)")).toBeNull();
    await adminView.unmount();

    resetTestStorage();
    jest.clearAllMocks();
    await seedSession(OWNER_USER, { online: false });
    const ownerView = await renderRouter("./src/app", {
      initialUrl: "/produk",
    });

    await waitFor(() => {
      expect(screen.getByText("Mode Kelola Katalog Aktif")).toBeTruthy();
    });
    expect(screen.queryByText("Mode Baca Saja (Kasir)")).toBeNull();
    await ownerView.unmount();
  });

  it("renders Pengaturan profile and executes fail-safe offline logout back to Login", async () => {
    await seedSession(OWNER_USER, { online: false });
    const routerView = await renderRouter("./src/app", {
      initialUrl: "/pengaturan",
    });

    await waitFor(() => {
      expect(screen.getByText("Budi Owner")).toBeTruthy();
    });
    expect(screen.getByText("@owner1")).toBeTruthy();
    expect(screen.getByText("Owner")).toBeTruthy();
    expect(
      screen.getByTestId("pengaturan-saved-server-url").props.children
    ).toBe(BASE_URL);
    expect(screen.getByText("Keluar dari Akun")).toBeTruthy();

    // Open confirmation modal
    await fireEvent.press(screen.getByTestId("pengaturan-logout-button"));
    expect(screen.getByText("Keluar dari Akun?")).toBeTruthy();

    // Confirm while offline fetch rejects -> clears SecureStore and returns to Login
    (globalThis.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("Network offline")
    );
    await fireEvent.press(screen.getByTestId("logout-confirm-button"));

    await waitFor(() => {
      expect(screen.getByText("Masuk ke Sistem")).toBeTruthy();
      expect(routerView.getPathname()).toBe("/login");
    });
    expect(screen.queryByTestId("bottom-tab-bar")).toBeNull();
    expect(screen.queryByText("Budi Owner")).toBeNull();
    expect(await getSessionToken()).toBeNull();
    expect(await getUserSnapshot()).toBeNull();

    await routerView.unmount();
  });

  it("resets authenticated navigation state cleanly on account switch via user.id:user.role key", async () => {
    await seedSession(OWNER_USER, { online: false });
    const routerView = await renderRouter("./src/app", { initialUrl: "/" });

    await waitFor(() => {
      expect(screen.getByText("Halo, Budi Owner")).toBeTruthy();
    });

    // Navigate to Produk (owner privileges) then Pengaturan
    await fireEvent.press(screen.getByTestId("tab-produk"));
    await waitFor(() => {
      expect(screen.getByText("Mode Kelola Katalog Aktif")).toBeTruthy();
    });

    await fireEvent.press(screen.getByTestId("tab-pengaturan"));
    await waitFor(() => {
      expect(screen.getByText("@owner1")).toBeTruthy();
    });

    // Logout from owner -> back to Login
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ success: true }),
    });
    await fireEvent.press(screen.getByTestId("pengaturan-logout-button"));
    await fireEvent.press(screen.getByTestId("logout-confirm-button"));

    await waitFor(() => {
      expect(screen.getByText("Masuk ke Sistem")).toBeTruthy();
    });

    // Log in as kasir on the same device
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      _rawHeaders: [
        ["set-cookie", "pos_session=tok_kasir_switch.sig; Path=/; HttpOnly"],
      ],
      headers: new Headers(),
      json: async () => ({
        success: true,
        data: KASIR_USER,
      }),
    });

    await fireEvent.changeText(
      screen.getByTestId("login-username-input"),
      "kasir1"
    );
    await fireEvent.changeText(
      screen.getByTestId("login-password-input"),
      "secret123"
    );
    await fireEvent.press(screen.getByTestId("login-submit-button"));

    // Fresh kasir shell mounts at /kasir with zero stale owner state
    await waitFor(() => {
      expect(screen.getByText("Halo, Siti Kasir")).toBeTruthy();
      expect(routerView.getPathname()).toBe("/kasir");
    });
    expect(screen.queryByText("Budi Owner")).toBeNull();
    expect(screen.queryByText("@owner1")).toBeNull();
    expect(screen.queryByText("Mode Kelola Katalog Aktif")).toBeNull();

    // Produk shows read-only kasir banner, never owner privileges
    await fireEvent.press(screen.getByTestId("tab-produk"));
    await waitFor(() => {
      expect(screen.getByText("Mode Baca Saja (Kasir)")).toBeTruthy();
    });
    expect(screen.queryByText("Mode Kelola Katalog Aktif")).toBeNull();

    // Pengaturan shows Siti Kasir, zero stale owner info
    await fireEvent.press(screen.getByTestId("tab-pengaturan"));
    await waitFor(() => {
      expect(screen.getByText("Siti Kasir")).toBeTruthy();
    });
    expect(screen.getByText("@kasir1")).toBeTruthy();
    expect(screen.queryByText("Budi Owner")).toBeNull();
    expect(screen.queryByText("@owner1")).toBeNull();

    await routerView.unmount();
  });
});
