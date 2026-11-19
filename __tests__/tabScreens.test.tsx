import React from "react";
import * as Network from "expo-network";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react-native";
import { resetTestStorage } from "./setup";
import KasirScreen from "@/app/(app)/(tabs)/kasir";
import PengaturanScreen from "@/app/(app)/(tabs)/pengaturan";
import PesananScreen from "@/app/(app)/(tabs)/pesanan";
import ProdukScreen from "@/app/(app)/(tabs)/produk";
import { LogoutConfirmModal } from "@/components/common/LogoutConfirmModal";
import { AuthProvider } from "@/context/AuthContext";
import {
  getSessionToken,
  getStoredServerUrl,
  getUserSnapshot,
  setCachedStoreSettings,
  setSessionToken,
  setStoredServerUrl,
  setUserSnapshot,
} from "@/services/storage/secureStorage";
import type { AuthSessionUser } from "@/types";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

const BASE_URL = "http://192.168.1.10:3000";

const KASIR_USER: AuthSessionUser = {
  id: "u-kasir",
  username: "kasir1",
  fullName: "Budi Kasir",
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
  fullName: "Siti Owner Cabang Utama Semarang Tengah",
  role: "owner",
};

async function seedOfflineSession(
  user: AuthSessionUser,
  serverUrl: string = BASE_URL
) {
  setStoredServerUrl(serverUrl);
  setCachedStoreSettings({ storeName: "Toko Rejeki" });
  await setSessionToken("tok_session_123.sig");
  await setUserSnapshot(user);
  (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
    isConnected: false,
    isInternetReachable: false,
    type: "NONE",
  });
}

describe("Tab screens and LogoutConfirmModal (UI-SPEC E4)", () => {
  beforeEach(() => {
    resetTestStorage();
    jest.clearAllMocks();
    globalThis.fetch = jest.fn() as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders LogoutConfirmModal copy, blocks close while submitting, and triggers callbacks", async () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();

    const first = await render(
      <LogoutConfirmModal
        visible
        username="kasir1"
        isSubmitting={false}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText("Keluar dari Akun?")).toBeTruthy();
    expect(
      screen.getByText(
        "Sesi aktif akun kasir1 akan diakhiri dari perangkat ini."
      )
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Pastikan seluruh transaksi kasir yang berjalan sudah disimpan atau diselesaikan."
      )
    ).toBeTruthy();

    await fireEvent.press(screen.getByTestId("logout-cancel-button"));
    expect(onCancel).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByTestId("logout-confirm-button"));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    // Hardware back / onRequestClose closes when not submitting
    screen.getByTestId("logout-confirm-modal").props.onRequestClose();
    expect(onCancel).toHaveBeenCalledTimes(2);
    await first.unmount();

    // Submitting state shows loading copy and disables cancel / requestClose
    const onCancelBlocked = jest.fn();
    const onConfirmBlocked = jest.fn();
    const second = await render(
      <LogoutConfirmModal
        visible
        username="owner1"
        isSubmitting
        onCancel={onCancelBlocked}
        onConfirm={onConfirmBlocked}
      />
    );

    expect(screen.getByText("Mengakhiri Sesi...")).toBeTruthy();
    expect(
      screen.getByTestId("logout-cancel-button").props.accessibilityState
        .disabled
    ).toBe(true);
    expect(
      screen.getByTestId("logout-confirm-button").props.accessibilityState
        .disabled
    ).toBe(true);

    screen.getByTestId("logout-confirm-modal").props.onRequestClose();
    expect(onCancelBlocked).not.toHaveBeenCalled();

    await second.unmount();
  });

  it("renders Pengaturan profile, ServerUrlPanel, Sesi Lokal Aktif, and fail-safe offline logout", async () => {
    const longUrl =
      "https://kasir-toko-rejeki-cabang-semarang-timur.example.com/pos-api";
    await seedOfflineSession(OWNER_USER, longUrl);

    const { unmount } = await render(
      <AuthProvider>
        <PengaturanScreen />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("pengaturan-user-fullname").props.children).toBe(
        OWNER_USER.fullName
      );
    });
    expect(screen.getByText(`@${OWNER_USER.username}`)).toBeTruthy();
    expect(screen.getByText("Owner")).toBeTruthy();
    expect(screen.getByText("Sesi Lokal Aktif")).toBeTruthy();
    expect(screen.getByTestId("pengaturan-saved-server-url").props.children).toBe(
      longUrl
    );
    expect(
      screen.getByTestId("pengaturan-saved-server-url").props.numberOfLines
    ).toBe(2);

    // Open embedded ServerUrlPanel and save a valid LAN URL
    await fireEvent.press(screen.getByTestId("server-url-panel-toggle"));
    await fireEvent.changeText(
      screen.getByTestId("server-url-input"),
      "http://192.168.1.25:3000/"
    );
    await fireEvent.press(screen.getByTestId("server-save-button"));

    expect(getStoredServerUrl()).toBe("http://192.168.1.25:3000");
    expect(screen.getByTestId("pengaturan-saved-server-url").props.children).toBe(
      "http://192.168.1.25:3000"
    );

    // Trigger Logout modal and dismiss first
    await fireEvent.press(screen.getByTestId("pengaturan-logout-button"));
    expect(screen.getByText("Keluar dari Akun?")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("logout-cancel-button"));
    expect(await getSessionToken()).toBe("tok_session_123.sig");

    // Re-open Logout modal and confirm while offline (pending fetch -> reject)
    let rejectLogout!: (err: Error) => void;
    (globalThis.fetch as jest.Mock).mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectLogout = reject;
      })
    );

    await fireEvent.press(screen.getByTestId("pengaturan-logout-button"));
    await fireEvent.press(screen.getByTestId("logout-confirm-button"));

    await waitFor(() => {
      expect(screen.getByText("Mengakhiri Sesi...")).toBeTruthy();
    });

    await act(async () => {
      rejectLogout(new Error("Network unreachable"));
    });

    await waitFor(async () => {
      expect(await getSessionToken()).toBeNull();
      expect(await getUserSnapshot()).toBeNull();
    });

    await unmount();
  });

  it("renders compact 1-row Kasir header without greeting bar", async () => {
    await seedOfflineSession(KASIR_USER);

    const { unmount } = await render(
      <AuthProvider>
        <KasirScreen />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(
        within(screen.getByTestId("kasir-header")).getByText("Kasir")
      ).toBeTruthy();
    });
    expect(screen.queryByTestId("kasir-greeting-text")).toBeNull();
    expect(screen.queryByTestId("kasir-role-badge")).toBeNull();
    expect(screen.queryByTestId("kasir-open-settings-button")).toBeNull();
    expect(
      within(screen.getByTestId("kasir-header")).getByTestId("header-sync-pill")
    ).toBeTruthy();
    expect(
      within(screen.getByTestId("kasir-header")).getByTestId(
        "header-route-status-pill"
      )
    ).toBeTruthy();

    await unmount();
  });

  it("gates Produk action buttons cleanly without bulky role banners", async () => {
    // 1. Kasir role -> no manage policy banner and hides add/trash buttons
    await seedOfflineSession(KASIR_USER);
    const kasirView = await render(
      <AuthProvider>
        <ProdukScreen />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByText("Katalog Produk Belum Tersinkronisasi")
      ).toBeTruthy();
    });
    expect(screen.queryByText("Mode Baca Saja (Kasir)")).toBeNull();
    expect(screen.queryByText("Mode Kelola Katalog Aktif")).toBeNull();
    expect(screen.queryByTestId("produk-add-button")).toBeNull();
    expect(screen.queryByTestId("produk-trash-button")).toBeNull();

    await fireEvent.press(screen.getByTestId("produk-open-settings-button"));
    expect(mockPush).toHaveBeenCalledWith("/pengaturan");
    await kasirView.unmount();

    // 2. Admin role -> shows add/trash buttons and compact 1-row header
    resetTestStorage();
    jest.clearAllMocks();
    await seedOfflineSession(ADMIN_USER);
    const adminView = await render(
      <AuthProvider>
        <ProdukScreen />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("produk-add-button")).toBeTruthy();
      expect(screen.getByTestId("produk-trash-button")).toBeTruthy();
    });
    expect(screen.queryByText("Mode Baca Saja (Kasir)")).toBeNull();
    expect(screen.queryByText("Mode Kelola Katalog Aktif")).toBeNull();
    await adminView.unmount();

    // 3. Owner role -> shows add/trash buttons cleanly
    resetTestStorage();
    jest.clearAllMocks();
    await seedOfflineSession(OWNER_USER);
    const ownerView = await render(
      <AuthProvider>
        <ProdukScreen />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("produk-add-button")).toBeTruthy();
      expect(screen.getByTestId("produk-trash-button")).toBeTruthy();
    });
    await ownerView.unmount();
  });

  it("renders Pesanan empty state and navigates to Kasir", async () => {
    await seedOfflineSession(KASIR_USER);

    const { unmount } = await render(
      <AuthProvider>
        <PesananScreen />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Belum Ada Pesanan Tertunda")).toBeTruthy();
    });
    expect(
      screen.getByText(
        "Nota transaksi yang ditahan secara lokal di perangkat akan tampil di sini setelah modul kasir aktif. Ketuk Ke Layar Kasir untuk melihat shell kasir."
      )
    ).toBeTruthy();

    await fireEvent.press(screen.getByTestId("pesanan-open-kasir-button"));
    expect(mockPush).toHaveBeenCalledWith("/kasir");

    await unmount();
  });

  it("renders SyncControlCard inside Pengaturan", async () => {
    await seedOfflineSession(OWNER_USER);
    const { unmount } = await render(
      <AuthProvider>
        <PengaturanScreen />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("pengaturan-sync-control-card")
      ).toBeTruthy();
    });
    expect(screen.getByText("Sinkronisasi & Cache Katalog")).toBeTruthy();

    await unmount();
  });
});
