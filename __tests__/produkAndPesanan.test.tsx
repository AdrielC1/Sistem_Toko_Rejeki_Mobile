import React from "react";
import * as Network from "expo-network";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import PesananScreen from "@/app/(app)/(tabs)/pesanan";
import PesananDetailScreen from "@/app/(app)/(tabs)/pesanan/[tabId]";
import ProdukScreen from "@/app/(app)/(tabs)/produk";
import ProductDetailScreen from "@/app/(app)/(tabs)/produk/[id]";
import { AuthProvider } from "@/context/AuthContext";
import { applyFullCatalogReplace } from "@/db/catalogRepo";
import { resetSqliteConnectionForTest } from "@/db/sqlite";
import {
  setCachedStoreSettings,
  setSessionToken,
  setStoredServerConfigRaw,
  setUserSnapshot,
} from "@/services/storage/secureStorage";
import { usePosCartStore } from "@/store/posCartStore";
import { resetTestDatabase, resetTestStorage } from "./setup";

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockNavigate = jest.fn();
let mockRouteParams: Record<string, string> = {};

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: mockBack,
    navigate: mockNavigate,
  }),
  useLocalSearchParams: () => mockRouteParams,
}));

describe("Phase 4 Produk List->Detail RBAC and Pesanan Aktif List->Detail flows", () => {
  beforeEach(async () => {
    resetTestStorage();
    resetSqliteConnectionForTest();
    resetTestDatabase();
    usePosCartStore.getState().resetAllTabsForTest();
    jest.clearAllMocks();
    mockRouteParams = {};

    setStoredServerConfigRaw(
      JSON.stringify({
        primaryUrl: "http://192.168.1.100:3000",
        fallbackUrl: null,
      })
    );
    setCachedStoreSettings({ storeName: "Toko Rejeki Utama" });
    (Network.getNetworkStateAsync as jest.Mock).mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
      type: "NONE",
    });

    await applyFullCatalogReplace({
      products: [
        {
          id: "prod-a",
          sku: "SKU-A",
          barcode: "899001",
          name: "Gula Pasir 1kg",
          categoryId: "cat-1",
          categoryName: "Sembako",
          unitId: "u-kg",
          unitName: "Kg",
          costPrice: 12000,
          sellingPrice: 16000,
          isOpenPrice: false,
          sellBaseUnit: true,
          stock: 30,
          isActive: true,
          wholesaleTiers: [{ minQty: 5, price: 15000 }],
          unitConversions: [],
          createdAt: "2026-11-18T00:00:00Z",
          updatedAt: "2026-11-18T00:00:00Z",
        },
        {
          id: "prod-b",
          sku: "SKU-B",
          barcode: "899002",
          name: "Air Mineral 600ml",
          categoryId: "cat-2",
          categoryName: "Minuman",
          unitId: "u-btl",
          unitName: "Botol",
          costPrice: 2000,
          sellingPrice: 3500,
          isOpenPrice: false,
          sellBaseUnit: true,
          stock: 100,
          isActive: true,
          wholesaleTiers: [],
          unitConversions: [],
          createdAt: "2026-11-19T00:00:00Z",
          updatedAt: "2026-11-19T00:00:00Z",
        },
      ],
      categories: [
        { id: "cat-1", name: "Sembako", isActive: true },
        { id: "cat-2", name: "Minuman", isActive: true },
      ],
      units: [
        { id: "u-kg", name: "Kg", symbol: "kg", isActive: true },
        { id: "u-btl", name: "Botol", symbol: "btl", isActive: true },
      ],
      serverTime: "2026-11-19T01:00:00Z",
      totalProducts: 2,
    });
  });

  it("navigates Produk -> Detail Produk, supports 5 sorts/search, and strips costPrice + edit UI for Kasir", async () => {
    await setSessionToken("tok_kasir.sig");
    await setUserSnapshot({
      id: "usr-kasir",
      username: "kasir1",
      fullName: "Budi Kasir",
      role: "kasir",
    });

    const listView = await render(
      <AuthProvider>
        <ProdukScreen />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Gula Pasir 1kg")).toBeTruthy();
      expect(screen.getByText("Air Mineral 600ml")).toBeTruthy();
    });

    // Web-style variant & wholesale card blocks visible; edit/delete hidden for kasir
    expect(screen.getByText("1 Kg = Rp 16.000")).toBeTruthy();
    expect(screen.getByText("≥5 Kg: Rp 15.000")).toBeTruthy();
    expect(screen.queryByTestId("produk-card-edit-prod-a")).toBeNull();
    expect(screen.queryByTestId("produk-card-delete-prod-a")).toBeNull();

    // Sort dropdown modal switches sort to Termahal
    await fireEvent.press(screen.getByTestId("produk-sort-trigger"));
    expect(screen.getByTestId("produk-sort-modal")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("produk-sort-price_desc"));

    // Search filters list
    await fireEvent.changeText(screen.getByTestId("produk-search-input"), "Gula");
    await waitFor(() => {
      expect(screen.getByText("Gula Pasir 1kg")).toBeTruthy();
      expect(screen.queryByText("Air Mineral 600ml")).toBeNull();
    });

    await fireEvent.press(screen.getByTestId("produk-list-item-prod-a"));
    expect(mockPush).toHaveBeenCalledWith("/produk/prod-a");
    await listView.unmount();

    // Detail screen as kasir: hides Harga Modal (HPP) and Edit/Delete actions
    mockRouteParams = { id: "prod-a" };
    const kasirDetail = await render(
      <AuthProvider>
        <ProductDetailScreen />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId("produk-detail-name").props.children).toBe(
        "Gula Pasir 1kg"
      );
    });
    expect(screen.queryByTestId("produk-detail-cost-row")).toBeNull();
    expect(screen.queryByTestId("produk-detail-edit-button")).toBeNull();
    expect(screen.queryByTestId("produk-detail-delete-button")).toBeNull();
    await kasirDetail.unmount();

    // Owner list & detail show Harga Modal (HPP) and Edit/Delete controls
    await setUserSnapshot({
      id: "usr-owner",
      username: "owner1",
      fullName: "Siti Owner",
      role: "owner",
    });
    const ownerList = await render(
      <AuthProvider>
        <ProdukScreen />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId("produk-card-edit-prod-a")).toBeTruthy();
      expect(screen.getByTestId("produk-card-delete-prod-a")).toBeTruthy();
    });
    await ownerList.unmount();

    const ownerDetail = await render(
      <AuthProvider>
        <ProductDetailScreen />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId("produk-detail-cost-row")).toBeTruthy();
    });
    expect(screen.getByText("Rp 12.000")).toBeTruthy();
    expect(screen.getByTestId("produk-detail-edit-button")).toBeTruthy();
    expect(screen.getByTestId("produk-detail-delete-button")).toBeTruthy();
    await ownerDetail.unmount();
  });

  it("renders held orders in Pesanan -> Detail Pesanan with rename, Lanjutkan di Kasir, and delete", async () => {
    await setSessionToken("tok_kasir.sig");
    await setUserSnapshot({
      id: "usr-kasir",
      username: "kasir1",
      fullName: "Budi Kasir",
      role: "kasir",
    });

    const store = usePosCartStore.getState();
    store.addItem(
      {
        id: "prod-a",
        sku: "SKU-A",
        name: "Gula Pasir 1kg",
        categoryId: "cat-1",
        unitId: "u-kg",
        unitName: "Kg",
        sellingPrice: 16000,
        stock: 30,
        isActive: true,
        wholesaleTiers: [{ minQty: 5, price: 15000 }],
        unitConversions: [],
        createdAt: "",
        updatedAt: "",
      },
      {
        unitId: "u-kg",
        unitName: "Kg",
        conversionFactor: 1,
        sellingPrice: 16000,
        wholesaleTiers: [{ minQty: 5, price: 15000 }],
        isBaseUnit: true,
      },
      5
    );
    const heldTabId = usePosCartStore.getState().tabs[0].id;

    const listView = await render(
      <AuthProvider>
        <PesananScreen />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Nota #1")).toBeTruthy();
      expect(screen.getByText("Rp 75.000")).toBeTruthy();
    });

    await fireEvent.press(screen.getByTestId(`pesanan-card-${heldTabId}`));
    expect(mockPush).toHaveBeenCalledWith(`/pesanan/${heldTabId}`);
    await listView.unmount();

    // Detail screen: rename, Lanjutkan di Kasir, and delete
    mockRouteParams = { tabId: heldTabId };
    const detailView = await render(
      <AuthProvider>
        <PesananDetailScreen />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("pesanan-detail-grand-total").props.children).toBe(
        "Rp 75.000"
      );
    });
    expect(screen.getByText("Grosir · Hemat Rp 5.000")).toBeTruthy();

    await fireEvent.press(screen.getByTestId("pesanan-detail-rename-toggle"));
    await fireEvent.changeText(
      screen.getByTestId("pesanan-detail-rename-input"),
      "Nota Pak Joko"
    );
    await fireEvent.press(screen.getByTestId("pesanan-detail-rename-save"));
    expect(screen.getByTestId("pesanan-detail-label").props.children).toBe(
      "Nota Pak Joko"
    );

    await fireEvent.press(screen.getByTestId("pesanan-detail-resume-button"));
    expect(mockNavigate).toHaveBeenCalledWith("/kasir");

    await fireEvent.press(screen.getByTestId("pesanan-detail-delete-button"));
    await fireEvent.press(screen.getByTestId("pesanan-delete-confirm-button"));
    expect(usePosCartStore.getState().tabs[0].items).toHaveLength(0);
    expect(mockBack).toHaveBeenCalledTimes(1);

    await detailView.unmount();
  });
});
