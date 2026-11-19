import React from "react";
import * as Network from "expo-network";
import * as Print from "expo-print";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import PengaturanScreen from "@/app/(app)/(tabs)/pengaturan";
import PengaturanAboutScreen from "@/app/(app)/(tabs)/pengaturan/about";
import PengaturanPrinterScreen from "@/app/(app)/(tabs)/pengaturan/printer";
import PengaturanStoreProfileScreen from "@/app/(app)/(tabs)/pengaturan/store-profile";
import { AuthProvider } from "@/context/AuthContext";
import {
  setCachedStoreSettings,
  setSessionToken,
  setStoredServerConfigRaw,
  setUserSnapshot,
} from "@/services/storage/secureStorage";
import { usePrinterPrefsStore } from "@/store/printerPrefsStore";
import { resetTestStorage } from "./setup";

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: mockBack,
  }),
}));

describe("Phase 5 Pengaturan Hub, Profile/About, Store Profile read-merge-write, and Printer Mode", () => {
  beforeEach(async () => {
    resetTestStorage();
    usePrinterPrefsStore.getState().resetForTest();
    jest.clearAllMocks();

    setStoredServerConfigRaw(
      JSON.stringify({
        primaryUrl: "http://192.168.1.100:3000",
        fallbackUrl: null,
      })
    );
    (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: "WIFI",
    });
    globalThis.fetch = jest.fn() as unknown as typeof globalThis.fetch;
  });

  it("hides Owner Management menu for Kasir while allowing About & Device Printer navigation", async () => {
    await setSessionToken("tok_kasir.sig");
    await setUserSnapshot({
      id: "usr-kasir",
      username: "kasir1",
      fullName: "Budi Kasir",
      role: "kasir",
    });
    setCachedStoreSettings({ storeName: "Toko Rejeki" });

    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        success: true,
        data: { storeName: "Toko Rejeki" },
      }),
    });

    const view = await render(
      <AuthProvider>
        <PengaturanScreen />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("pengaturan-nav-about")).toBeTruthy();
    });
    expect(screen.getByTestId("pengaturan-nav-printer")).toBeTruthy();
    expect(screen.queryByTestId("pengaturan-owner-menu-card")).toBeNull();

    await fireEvent.press(screen.getByTestId("pengaturan-nav-about"));
    expect(mockPush).toHaveBeenCalledWith("/pengaturan/about");
    await view.unmount();
  });

  it("renders About screen with store profile, version, and stack details cleanly", async () => {
    await setSessionToken("tok_owner.sig");
    await setUserSnapshot({
      id: "usr-owner",
      username: "owner1",
      fullName: "Siti Owner",
      role: "owner",
    });
    setCachedStoreSettings({
      storeName: "Toko Rejeki Utama",
      storeAddress: "Jl. Dargo No. 9",
      storePhone: "082210104919",
    });

    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        success: true,
        data: {
          storeName: "Toko Rejeki Utama",
          storeAddress: "Jl. Dargo No. 9",
          storePhone: "082210104919",
        },
      }),
    });

    const view = await render(
      <AuthProvider>
        <PengaturanAboutScreen />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("about-store-name").props.children).toBe(
        "Toko Rejeki Utama"
      );
    });
    expect(screen.getByText("v1.0.0")).toBeTruthy();
    expect(screen.getByText("Apps Toko Rejeki Mobile POS")).toBeTruthy();
    await view.unmount();
  });

  it("preserves receiptSections on StoreProfile read-merge-write PUT /api/settings and switches Printer mode to System HP Print", async () => {
    await setSessionToken("tok_owner.sig");
    await setUserSnapshot({
      id: "usr-owner",
      username: "owner1",
      fullName: "Siti Owner",
      role: "owner",
    });

    const preservedSections = [
      { id: "header", type: "header" as const, enabled: true },
      { id: "footer", type: "footer" as const, enabled: true },
    ];
    setCachedStoreSettings({
      storeName: "Toko Rejeki",
      receiptSections: preservedSections,
      receiptItemConfig: { showSku: true },
    });

    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/auth/me")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            success: true,
            data: {
              id: "usr-owner",
              username: "owner1",
              fullName: "Siti Owner",
              role: "owner",
            },
          }),
        });
      }
      if (url.endsWith("/api/settings") && (!init?.method || init.method === "GET")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            success: true,
            data: {
              storeName: "Toko Rejeki",
              receiptSections: preservedSections,
              receiptItemConfig: { showSku: true },
            },
          }),
        });
      }
      if (url.endsWith("/api/settings") && init?.method === "PUT") {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            success: true,
            data: JSON.parse(String(init.body)),
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ success: true, data: [] }),
      });
    });

    const profileView = await render(
      <AuthProvider>
        <PengaturanStoreProfileScreen />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("store-profile-name-input")).toBeTruthy();
    });

    await fireEvent.changeText(
      screen.getByTestId("store-profile-name-input"),
      "Toko Rejeki Jaya"
    );
    await fireEvent.press(screen.getByTestId("store-profile-save-button"));

    await waitFor(() => {
      expect(
        screen.getByText("Profil toko berhasil diperbarui.")
      ).toBeTruthy();
    });

    const putCall = fetchMock.mock.calls.find(
      ([u, init]) =>
        String(u).endsWith("/api/settings") &&
        (init as RequestInit)?.method === "PUT"
    );
    expect(putCall).toBeDefined();
    const sentBody = JSON.parse(String((putCall![1] as RequestInit).body));
    expect(sentBody.storeName).toBe("Toko Rejeki Jaya");
    expect(sentBody.receiptSections).toEqual(preservedSections);
    expect(sentBody.receiptItemConfig).toEqual({ showSku: true });
    await profileView.unmount();

    // Test Printer mode switch to System HP + Print.printAsync
    const printerView = await render(
      <AuthProvider>
        <PengaturanPrinterScreen />
      </AuthProvider>
    );

    await fireEvent.press(screen.getByTestId("printer-mode-system"));
    expect(usePrinterPrefsStore.getState().mode).toBe("system");

    await fireEvent.press(screen.getByTestId("printer-device-test-button"));
    await waitFor(() => {
      expect(Print.printAsync).toHaveBeenCalledTimes(1);
    });
    await printerView.unmount();
  });
});
