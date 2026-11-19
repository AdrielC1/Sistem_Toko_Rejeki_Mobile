import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { FlashList } from "@shopify/flash-list";
import {
  Calculator,
  Layers,
  Minus,
  Package,
  Pencil,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  X,
} from "lucide-react-native";
import {
  CatalogLoadMoreFooter,
  CatalogPaginationSummary,
} from "@/components/common/CatalogPaginationBar";
import { EmptyStateCard } from "@/components/common/EmptyStateCard";
import { HybridCategoryBar } from "@/components/common/HybridCategoryBar";
import { InitialSyncBanner } from "@/components/common/InitialSyncBanner";
import { TabScreenHeader } from "@/components/common/TabScreenHeader";
import {
  CartItemPriceModal,
  DiscountModal,
  ProductUnitPickerModal,
  RemoveTabConfirmModal,
} from "@/components/kasir/KasirLineModals";
import { PrinterInterventionModal } from "@/components/kasir/PrinterInterventionModal";
import { ReceiptPreviewModal } from "@/components/kasir/ReceiptPreviewModal";
import {
  FeedbackBanner,
  PrimaryButton,
  SecondaryButton,
  SurfaceCard,
} from "@/components/ui/VelocityPrimitives";
import { useAuth } from "@/context/AuthContext";
import { getCatalogProductById } from "@/db/catalogRepo";
import { formatRupiah } from "@/domain/format";
import {
  buildCompletedOrderPayload,
  calculateCartSummary,
  getAvailableUnitsForProduct,
  validateOrderForCheckout,
  type CartItem,
  type CompletedOrder,
  type SelectableProductUnit,
} from "@/domain/pricing";
import {
  CATALOG_PAGE_SIZE,
  usePaginatedCatalog,
} from "@/hooks/usePaginatedCatalog";
import {
  submitWhatsAppOrderLog,
  type PrintDiagnosticInfo,
} from "@/services/api/printApi";
import {
  executeReceiptPrint,
  flushServerSpooler,
} from "@/services/print/printerService";
import { usePosCartStore } from "@/store/posCartStore";
import {
  usePrinterPrefsStore,
  type PrinterDeviceMode,
} from "@/store/printerPrefsStore";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";
import type { Product } from "@/types";

type KasirSegment = "catalog" | "cart";

export default function KasirScreen() {
  const { user, role, storeSettings, serverConfig } = useAuth();

  const tabs = usePosCartStore((s) => s.tabs);
  const activeTabId = usePosCartStore((s) => s.activeTabId);
  const createTab = usePosCartStore((s) => s.createTab);
  const switchTab = usePosCartStore((s) => s.switchTab);
  const removeTab = usePosCartStore((s) => s.removeTab);
  const addItem = usePosCartStore((s) => s.addItem);
  const updateItemQuantity = usePosCartStore((s) => s.updateItemQuantity);
  const setItemCustomPrice = usePosCartStore((s) => s.setItemCustomPrice);
  const switchItemUnit = usePosCartStore((s) => s.switchItemUnit);
  const removeItem = usePosCartStore((s) => s.removeItem);
  const setDiscount = usePosCartStore((s) => s.setDiscount);
  const completeCheckoutTab = usePosCartStore((s) => s.completeCheckoutTab);

  const printerMode = usePrinterPrefsStore((s) => s.mode);
  const bluetoothDevice = usePrinterPrefsStore((s) => s.bluetoothDevice);
  const bluetoothPaperWidth = usePrinterPrefsStore((s) => s.bluetoothPaperWidth);
  const printCopies = usePrinterPrefsStore((s) => s.defaultCopies);
  const setPrintCopies = usePrinterPrefsStore((s) => s.setDefaultCopies);

  const [segment, setSegment] = useState<KasirSegment>("catalog");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");

  const {
    products,
    totalCount,
    unfilteredTotalCount,
    hasMore,
    categories,
    isLoading: catalogLoading,
    isLoadingMore,
    loadMore,
  } = usePaginatedCatalog({
    searchQuery,
    categoryId: selectedCategoryId,
    sortMode: "az",
    includeInactive: false,
    pageSize: CATALOG_PAGE_SIZE,
  });

  const [statusNotice, setStatusNotice] = useState<{
    variant: "success" | "warning" | "error" | "info";
    title?: string;
    message: string;
  } | null>(null);

  // Picker & edit modals state
  const [unitPickerState, setUnitPickerState] = useState<{
    product: Product;
    units: SelectableProductUnit[];
    switchingFromUnitId?: string;
  } | null>(null);
  const [editingPriceItem, setEditingPriceItem] = useState<CartItem | null>(
    null
  );
  const [discountModalOpen, setDiscountModalOpen] = useState<boolean>(false);
  const [removeTabModalOpen, setRemoveTabModalOpen] = useState<boolean>(false);

  // Checkout / Print / Intervention state
  const [pendingOrder, setPendingOrder] = useState<CompletedOrder | null>(null);
  const [pendingOrderTabId, setPendingOrderTabId] = useState<string | null>(
    null
  );
  const [previewVisible, setPreviewVisible] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [interventionState, setInterventionState] = useState<{
    visible: boolean;
    errorMessage: string;
    diagnostic?: PrintDiagnosticInfo;
    paperNearEnd: boolean;
  }>({
    visible: false,
    errorMessage: "",
    paperNearEnd: false,
  });
  const [isFlushing, setIsFlushing] = useState<boolean>(false);
  const waLogSentRef = useRef<boolean>(false);

  const displayFullName = user?.fullName?.trim() || "Staf Kasir";

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0],
    [activeTabId, tabs]
  );

  const cartSummary = useMemo(
    () =>
      calculateCartSummary(activeTab?.items ?? [], activeTab?.discount ?? 0),
    [activeTab]
  );

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) {
      map.set(p.id, p);
    }
    return map;
  }, [products]);

  const [cartExtraProductMap, setCartExtraProductMap] = useState<
    Record<string, Product>
  >({});

  useEffect(() => {
    let active = true;
    const itemIds = activeTab?.items.map((line) => line.productId) ?? [];
    const missing = itemIds.filter(
      (id) => !productMap.has(id) && !cartExtraProductMap[id]
    );
    if (missing.length === 0) {
      return;
    }

    void (async () => {
      const fetched = await Promise.all(
        missing.map((id) => getCatalogProductById(id, role))
      );
      if (!active) {
        return;
      }
      const nextEntries: Record<string, Product> = {};
      for (const prod of fetched) {
        if (prod) {
          nextEntries[prod.id] = prod;
        }
      }
      if (Object.keys(nextEntries).length > 0) {
        setCartExtraProductMap((prev) => ({ ...prev, ...nextEntries }));
      }
    })();

    return () => {
      active = false;
    };
  }, [activeTab?.items, cartExtraProductMap, productMap, role]);

  const resolveCartCatalogProduct = (productId: string): Product | undefined =>
    productMap.get(productId) ?? cartExtraProductMap[productId];

  const handleAddDefaultUnit = (product: Product) => {
    const availableUnits = getAvailableUnitsForProduct(product);
    if (availableUnits.length === 0) {
      return;
    }
    void Haptics.selectionAsync().catch(() => {});
    addItem(product, availableUnits[0], 1);
  };

  const handleAddSpecificUnit = (
    product: Product,
    unit: SelectableProductUnit
  ) => {
    void Haptics.selectionAsync().catch(() => {});
    addItem(product, unit, 1);
  };

  const handleOpenCartUnitSwitcher = async (item: CartItem) => {
    const product =
      productMap.get(item.productId) ??
      (await getCatalogProductById(item.productId, role));
    if (!product) {
      return;
    }
    const units = getAvailableUnitsForProduct(product);
    if (units.length <= 1) {
      return;
    }
    setUnitPickerState({
      product,
      units,
      switchingFromUnitId: item.unitId,
    });
  };

  const runPrintFlow = async (
    orderToPrint: CompletedOrder,
    tabIdToComplete: string,
    overrideMode?: PrinterDeviceMode
  ) => {
    setIsPrinting(true);
    try {
      const outcome = await executeReceiptPrint({
        mode: overrideMode ?? printerMode,
        order: orderToPrint,
        copies: printCopies,
        serverConfig,
        storeSettings: storeSettings ?? null,
        bluetoothDevice,
        bluetoothPaperWidth,
      });

      if (outcome.ok) {
        if (!waLogSentRef.current) {
          waLogSentRef.current = true;
          void submitWhatsAppOrderLog(serverConfig, orderToPrint);
        }
        setPreviewVisible(false);
        setInterventionState({
          visible: false,
          errorMessage: "",
          paperNearEnd: false,
        });
        setPendingOrder(null);
        setPendingOrderTabId(null);
        completeCheckoutTab(tabIdToComplete);
        setSegment("catalog");
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(() => {});

        setStatusNotice(
          outcome.paperNearEnd
            ? {
                variant: "warning",
                title: `Struk ${orderToPrint.orderNumber} Dicetak (Kertas Menipis)`,
                message:
                  "Peringatan: Sensor mendeteksi kertas printer thermal hampir habis.",
              }
            : {
                variant: "success",
                title: "Transaksi Berhasil Dicetak",
                message: `Nota ${orderToPrint.orderNumber} sejumlah ${formatRupiah(orderToPrint.grandTotal)} (${printCopies}x) selesai.`,
              }
        );
        return;
      }

      setPreviewVisible(false);
      setInterventionState({
        visible: true,
        errorMessage: outcome.error ?? "Gagal mencetak struk transaksi.",
        diagnostic: outcome.diagnostic,
        paperNearEnd: outcome.paperNearEnd,
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleCheckoutTap = async () => {
    if (!activeTab) {
      return;
    }
    const validation = validateOrderForCheckout(
      activeTab.items,
      activeTab.discount
    );
    if (!validation.ok) {
      setStatusNotice({
        variant: "error",
        message: validation.error,
      });
      return;
    }

    const order = buildCompletedOrderPayload({
      items: activeTab.items,
      discount: activeTab.discount,
      cashierName: displayFullName,
      storeSettings: storeSettings ?? null,
    });

    waLogSentRef.current = false;
    setPendingOrder(order);
    setPendingOrderTabId(activeTab.id);

    if (storeSettings?.previewReceiptBeforePrint === false) {
      await runPrintFlow(order, activeTab.id);
      return;
    }

    setPreviewVisible(true);
  };

  const handleFlushQueue = async () => {
    setIsFlushing(true);
    try {
      const res = await flushServerSpooler(serverConfig, storeSettings ?? null);
      setInterventionState((prev) => ({
        ...prev,
        errorMessage: res.message,
      }));
    } finally {
      setIsFlushing(false);
    }
  };

  const renderProductCard = ({ item: product }: { item: Product }) => {
    const units = getAvailableUnitsForProduct(product);
    const primaryUnit = units[0] ?? null;
    const inCartLines =
      activeTab?.items.filter((line) => line.productId === product.id) ?? [];
    const inCartQty = inCartLines.reduce((acc, line) => acc + line.quantity, 0);

    return (
      <Pressable
        testID={`kasir-product-card-${product.id}`}
        accessibilityRole="button"
        disabled={!primaryUnit}
        onPress={() => handleAddDefaultUnit(product)}
        style={({ pressed }) => [pressed && primaryUnit && styles.pressedItem]}
      >
        <SurfaceCard
          style={[styles.productCard, inCartQty > 0 && styles.productCardActive]}
        >
          <View style={styles.cardTopRow}>
            <View style={styles.cardTitleGroup}>
              <Text numberOfLines={2} style={styles.productName}>
                {product.name}
              </Text>
              {product.categoryName ? (
                <Text style={styles.catBadge}>{product.categoryName}</Text>
              ) : null}
              {inCartQty > 0 ? (
                <View style={styles.qtyBadge}>
                  <Text style={styles.qtyBadgeText}>{`${inCartQty}x`}</Text>
                </View>
              ) : null}
            </View>

            <Pressable
              testID={`kasir-add-product-${product.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Tambah ${product.name}`}
              disabled={!primaryUnit}
              onPress={(e) => {
                e.stopPropagation?.();
                handleAddDefaultUnit(product);
              }}
              style={({ pressed }) => [
                styles.quickAddButton,
                !primaryUnit && styles.quickAddButtonDisabled,
                pressed && primaryUnit && styles.pressedItem,
              ]}
            >
              <Plus
                size={18}
                color={
                  primaryUnit
                    ? TOKENS.colors.primary
                    : TOKENS.colors.onSurfaceVariant
                }
              />
            </Pressable>
          </View>

          <Text style={styles.skuLine}>
            {`SKU: ${product.sku || "-"}${
              product.barcode ? ` | BC: ${product.barcode}` : ""
            }`}
          </Text>

          {units.length > 0 ? (
            <View style={styles.unitButtonsFooter}>
              {units.map((u) => {
                const lineQty =
                  inCartLines.find((line) => line.unitId === u.unitId)
                    ?.quantity ?? 0;
                return (
                  <Pressable
                    key={u.unitId}
                    testID={`kasir-add-unit-${product.id}-${u.unitId}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Tambah ${product.name} satuan ${u.unitName}`}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      handleAddSpecificUnit(product, u);
                    }}
                    style={({ pressed }) => [
                      styles.unitPillBtn,
                      lineQty > 0 && styles.unitPillBtnActive,
                      pressed && styles.pressedItem,
                    ]}
                  >
                    <Text style={styles.unitPillLabel}>{`${u.unitName}:`}</Text>
                    <Text style={styles.unitPillPrice}>
                      {formatRupiah(u.sellingPrice)}
                    </Text>
                    {lineQty > 0 ? (
                      <View style={styles.unitQtyCircle}>
                        <Text style={styles.unitQtyText}>{lineQty}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={styles.unavailablePriceText}>
              Belum ada harga jual aktif
            </Text>
          )}
        </SurfaceCard>
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <TabScreenHeader
        testID="kasir-header"
        title="Kasir"
        icon={<Calculator size={20} color={TOKENS.colors.primary} />}
        bannerSlot={<InitialSyncBanner />}
      />

      <View style={styles.segmentHeaderWrap}>
        <View style={styles.segmentedControl}>
          <Pressable
            testID="kasir-segment-catalog"
            accessibilityRole="button"
            accessibilityState={{ selected: segment === "catalog" }}
            onPress={() => setSegment("catalog")}
            style={[
              styles.segmentTab,
              segment === "catalog" && styles.segmentTabActive,
            ]}
          >
            <Text
              style={[
                styles.segmentTabText,
                segment === "catalog" && styles.segmentTabTextActive,
              ]}
            >
              Katalog Produk
            </Text>
          </Pressable>
          <Pressable
            testID="kasir-segment-cart"
            accessibilityRole="button"
            accessibilityState={{ selected: segment === "cart" }}
            onPress={() => setSegment("cart")}
            style={[
              styles.segmentTab,
              segment === "cart" && styles.segmentTabActive,
            ]}
          >
            <Text
              style={[
                styles.segmentTabText,
                segment === "cart" && styles.segmentTabTextActive,
              ]}
            >
              {`Nota Aktif (${cartSummary.itemCount})`}
            </Text>
          </Pressable>
        </View>

        {statusNotice ? (
          <FeedbackBanner
            testID="kasir-status-notice"
            variant={statusNotice.variant}
            title={statusNotice.title}
            message={statusNotice.message}
          />
        ) : null}
      </View>

      {segment === "catalog" ? (
        <View style={styles.segmentContainer}>
          <View style={styles.filterHeader}>
            <View style={styles.searchBar}>
              <Search size={18} color={TOKENS.colors.outline} />
              <TextInput
                testID="kasir-search-input"
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Cari nama, SKU, atau barcode..."
                placeholderTextColor={TOKENS.colors.outline}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.searchInput}
              />
              {searchQuery.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Hapus pencarian"
                  onPress={() => setSearchQuery("")}
                  style={styles.clearSearchBtn}
                >
                  <X size={16} color={TOKENS.colors.onSurfaceVariant} />
                </Pressable>
              ) : null}
            </View>

            <HybridCategoryBar
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={setSelectedCategoryId}
              testIDPrefix="kasir"
            />

            <CatalogPaginationSummary
              testID="kasir-pagination-summary"
              totalCount={totalCount}
              visibleCount={products.length}
              hasMore={hasMore}
              pageSize={CATALOG_PAGE_SIZE}
            />
          </View>

          {products.length === 0 ? (
            <View style={styles.emptyCatalogWrap}>
              <EmptyStateCard
                testID="kasir-empty-catalog"
                icon={<Package size={24} color={TOKENS.colors.primary} />}
                title={
                  catalogLoading
                    ? "Memuat Katalog..."
                    : unfilteredTotalCount === 0
                      ? "Belum Ada Produk Lokal"
                      : "Produk Tidak Ditemukan"
                }
                description={
                  unfilteredTotalCount === 0
                    ? "Ketuk status Sinkronisasi di header atas atau Pengaturan untuk mengunduh katalog barang."
                    : "Coba ubah kata kunci pencarian atau pilih kategori lain."
                }
              />
            </View>
          ) : (
            <FlashList
              data={products}
              keyExtractor={(item) => item.id}
              renderItem={renderProductCard}
              onEndReached={() => {
                if (hasMore && !isLoadingMore) {
                  void loadMore();
                }
              }}
              onEndReachedThreshold={0.4}
              ListFooterComponent={
                <CatalogLoadMoreFooter
                  hasMore={hasMore}
                  isLoadingMore={isLoadingMore}
                  visibleCount={products.length}
                  totalCount={totalCount}
                  pageSize={CATALOG_PAGE_SIZE}
                  onLoadMore={() => {
                    void loadMore();
                  }}
                />
              }
              contentContainerStyle={
                cartSummary.totalQuantity > 0
                  ? styles.catalogListWithFloatingBar
                  : styles.catalogListContent
              }
            />
          )}

          {cartSummary.totalQuantity > 0 ? (
            <View style={styles.floatingBarHost}>
              <Pressable
                testID="kasir-floating-cart-bar"
                accessibilityRole="button"
                onPress={() => setSegment("cart")}
                style={({ pressed }) => [
                  styles.floatingCartBar,
                  pressed && styles.pressedItem,
                ]}
              >
                <View style={styles.floatingLeft}>
                  <ShoppingCart size={20} color={TOKENS.colors.onPrimary} />
                  <View>
                    <Text style={styles.floatingTitle}>
                      {`${activeTab?.label ?? "Nota"} · ${cartSummary.totalQuantity} item`}
                    </Text>
                    <Text style={styles.floatingSub}>
                      Ketuk untuk lihat nota & cetak struk
                    </Text>
                  </View>
                </View>
                <Text style={styles.floatingTotal}>
                  {formatRupiah(cartSummary.grandTotal)}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.segmentContainer}>
          <View style={styles.tabsBarWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsStripContent}
            >
              {tabs.map((tab) => {
                const isActive = tab.id === activeTab?.id;
                return (
                  <Pressable
                    key={tab.id}
                    testID={`kasir-order-tab-${tab.id}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    onPress={() => switchTab(tab.id)}
                    style={[
                      styles.orderTabChip,
                      isActive && styles.orderTabChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.orderTabText,
                        isActive && styles.orderTabTextActive,
                      ]}
                    >
                      {tab.items.length > 0
                        ? `${tab.label} (${tab.items.length})`
                        : tab.label}
                    </Text>
                  </Pressable>
                );
              })}

              <Pressable
                testID="kasir-new-tab-button"
                accessibilityRole="button"
                onPress={() => createTab()}
                style={styles.newTabBtn}
              >
                <Plus size={16} color={TOKENS.colors.primary} />
                <Text style={styles.newTabBtnText}>Nota Baru</Text>
              </Pressable>
            </ScrollView>

            {activeTab &&
            (tabs.length > 1 || activeTab.items.length > 0) ? (
              <Pressable
                testID="kasir-delete-active-tab-button"
                accessibilityRole="button"
                accessibilityLabel={`Hapus ${activeTab.label}`}
                onPress={() => setRemoveTabModalOpen(true)}
                style={styles.deleteTabBtn}
              >
                <Trash2 size={18} color={TOKENS.colors.destructive} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            contentContainerStyle={styles.cartScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {!activeTab || activeTab.items.length === 0 ? (
              <EmptyStateCard
                testID="kasir-empty-cart"
                icon={<ShoppingCart size={24} color={TOKENS.colors.primary} />}
                title={`${activeTab?.label ?? "Nota"} Masih Kosong`}
                description="Tambahkan barang dari tab Katalog Produk untuk memulai transaksi kasir."
                action={
                  <SecondaryButton
                    testID="kasir-go-catalog-button"
                    variant="tonal"
                    label="Pilih Produk di Katalog"
                    onPress={() => setSegment("catalog")}
                  />
                }
              />
            ) : (
              <>
                {activeTab.items.map((item) => {
                  const catalogProd = resolveCartCatalogProduct(item.productId);
                  const canSwitchUnit = catalogProd
                    ? getAvailableUnitsForProduct(catalogProd).length > 1
                    : false;

                  return (
                    <SurfaceCard
                      key={`${item.productId}::${item.unitId}`}
                      testID={`kasir-cart-item-${item.productId}-${item.unitId}`}
                      style={styles.cartItemCard}
                    >
                      <View style={styles.cartItemHeader}>
                        <View style={styles.cartItemTitleGroup}>
                          <Text style={styles.cartItemName}>
                            {item.productName}
                          </Text>
                          <View style={styles.cartBadgesRow}>
                            <Text style={styles.skuChip}>{item.sku}</Text>
                            {canSwitchUnit ? (
                              <Pressable
                                testID={`cart-unit-switch-${item.productId}-${item.unitId}`}
                                accessibilityRole="button"
                                onPress={() => {
                                  void handleOpenCartUnitSwitcher(item);
                                }}
                                style={styles.unitSwitchChip}
                              >
                                <Layers
                                  size={12}
                                  color={TOKENS.colors.onPrimaryFixed}
                                />
                                <Text style={styles.unitSwitchChipText}>
                                  {`${item.unitName} · Ubah`}
                                </Text>
                              </Pressable>
                            ) : (
                              <Text style={styles.catLabel}>
                                {item.unitName}
                              </Text>
                            )}
                            {item.wholesaleSavings > 0 ? (
                              <Text style={styles.wholesaleBadge}>
                                {`Grosir · Hemat ${formatRupiah(item.wholesaleSavings)}`}
                              </Text>
                            ) : null}
                            {item.isCustomPrice ? (
                              <Text style={styles.openPriceBadge}>
                                Harga Khusus
                              </Text>
                            ) : null}
                          </View>
                        </View>

                        <Pressable
                          testID={`cart-remove-${item.productId}-${item.unitId}`}
                          accessibilityRole="button"
                          accessibilityLabel={`Hapus ${item.productName}`}
                          onPress={() =>
                            removeItem(item.productId, item.unitId)
                          }
                          style={styles.removeLineBtn}
                        >
                          <Trash2
                            size={18}
                            color={TOKENS.colors.destructive}
                          />
                        </Pressable>
                      </View>

                      <View style={styles.cartControlsRow}>
                        <View style={styles.stepperGroup}>
                          <Pressable
                            testID={`cart-qty-minus-${item.productId}-${item.unitId}`}
                            accessibilityRole="button"
                            accessibilityLabel={`Kurangi jumlah ${item.productName}`}
                            onPress={() =>
                              updateItemQuantity(
                                item.productId,
                                item.unitId,
                                item.quantity - 1
                              )
                            }
                            style={styles.stepperBtn}
                          >
                            <Minus size={18} color={TOKENS.colors.onSurface} />
                          </Pressable>

                          <TextInput
                            testID={`cart-qty-input-${item.productId}-${item.unitId}`}
                            accessibilityLabel={`Jumlah ${item.productName}`}
                            value={String(item.quantity)}
                            keyboardType="numeric"
                            onChangeText={(txt) => {
                              const num = Number(txt.replace(/[^0-9]/g, ""));
                              if (Number.isFinite(num) && num >= 1) {
                                updateItemQuantity(
                                  item.productId,
                                  item.unitId,
                                  num
                                );
                              }
                            }}
                            style={styles.qtyTextInput}
                          />

                          <Pressable
                            testID={`cart-qty-plus-${item.productId}-${item.unitId}`}
                            accessibilityRole="button"
                            accessibilityLabel={`Tambah jumlah ${item.productName}`}
                            onPress={() =>
                              updateItemQuantity(
                                item.productId,
                                item.unitId,
                                item.quantity + 1
                              )
                            }
                            style={styles.stepperBtn}
                          >
                            <Plus size={18} color={TOKENS.colors.onSurface} />
                          </Pressable>
                        </View>

                        <View style={styles.linePriceGroup}>
                          <Pressable
                            testID={`cart-open-price-${item.productId}-${item.unitId}`}
                            accessibilityRole="button"
                            onPress={() => setEditingPriceItem(item)}
                            style={styles.editPriceBtn}
                          >
                            <Tag size={13} color={TOKENS.colors.primary} />
                            <Text style={styles.editPriceText}>
                              {`${formatRupiah(item.effectiveUnitPrice)}`}
                            </Text>
                          </Pressable>
                          <Text style={styles.lineSubtotal}>
                            {formatRupiah(item.subtotal)}
                          </Text>
                        </View>
                      </View>
                    </SurfaceCard>
                  );
                })}

                <SurfaceCard
                  testID="kasir-checkout-summary-card"
                  style={styles.summaryCard}
                >
                  <View style={styles.summaryLine}>
                    <Text style={styles.summaryLabel}>Subtotal</Text>
                    <Text style={styles.summaryMono}>
                      {formatRupiah(cartSummary.subtotal)}
                    </Text>
                  </View>

                  {cartSummary.totalWholesaleSavings > 0 ? (
                    <View style={styles.summaryLine}>
                      <Text style={styles.savingsLabel}>
                        Hemat Harga Grosir
                      </Text>
                      <Text style={styles.savingsMono}>
                        {`-${formatRupiah(cartSummary.totalWholesaleSavings)}`}
                      </Text>
                    </View>
                  ) : null}

                  <Pressable
                    testID="kasir-discount-trigger"
                    accessibilityRole="button"
                    onPress={() => setDiscountModalOpen(true)}
                    style={styles.discountRow}
                  >
                    <View style={styles.discountLabelGroup}>
                      <Pencil size={15} color={TOKENS.colors.primary} />
                      <Text style={styles.discountLink}>Potongan Harga</Text>
                    </View>
                    <Text style={styles.discountValue}>
                      {cartSummary.discount > 0
                        ? `-${formatRupiah(cartSummary.discount)}`
                        : "Rp 0 (Atur)"}
                    </Text>
                  </Pressable>

                  <View style={styles.grandTotalRow}>
                    <Text style={styles.grandTotalLabel}>TOTAL BAYAR</Text>
                    <Text
                      testID="kasir-grand-total"
                      style={styles.grandTotalValue}
                    >
                      {formatRupiah(cartSummary.grandTotal)}
                    </Text>
                  </View>

                  <View style={styles.copiesSelectorRow}>
                    <Text style={styles.summaryLabel}>Jumlah Salinan Struk</Text>
                    <View style={styles.copyChipsGroup}>
                      {([2, 3] as const).map((cnt) => {
                        const selected = printCopies === cnt;
                        return (
                          <Pressable
                            key={cnt}
                            testID={`kasir-copy-chip-${cnt}`}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            onPress={() => setPrintCopies(cnt)}
                            style={[
                              styles.copyChip,
                              selected && styles.copyChipSelected,
                            ]}
                          >
                            <Text
                              style={[
                                styles.copyChipText,
                                selected && styles.copyChipTextSelected,
                              ]}
                            >
                              {`${cnt}x`}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <PrimaryButton
                    testID="kasir-checkout-button"
                    label={`Bayar & Cetak Struk (${printCopies}x)`}
                    loading={isPrinting}
                    loadingLabel="Memproses Struk..."
                    disabled={isPrinting}
                    icon={<Printer size={18} color={TOKENS.colors.onPrimary} />}
                    onPress={() => {
                      void handleCheckoutTap();
                    }}
                  />
                </SurfaceCard>
              </>
            )}
          </ScrollView>
        </View>
      )}

      <ProductUnitPickerModal
        visible={unitPickerState !== null}
        product={unitPickerState?.product ?? null}
        units={unitPickerState?.units ?? []}
        onClose={() => setUnitPickerState(null)}
        onSelectUnit={(unit) => {
          if (!unitPickerState) {
            return;
          }
          if (unitPickerState.switchingFromUnitId) {
            switchItemUnit(
              unitPickerState.product.id,
              unitPickerState.switchingFromUnitId,
              unit
            );
          } else {
            addItem(unitPickerState.product, unit, 1);
          }
          setUnitPickerState(null);
        }}
      />

      <CartItemPriceModal
        visible={editingPriceItem !== null}
        item={editingPriceItem}
        onClose={() => setEditingPriceItem(null)}
        onSavePrice={(customPrice) => {
          if (editingPriceItem) {
            setItemCustomPrice(
              editingPriceItem.productId,
              editingPriceItem.unitId,
              customPrice
            );
          }
          setEditingPriceItem(null);
        }}
        onResetPrice={() => {
          if (editingPriceItem) {
            setItemCustomPrice(
              editingPriceItem.productId,
              editingPriceItem.unitId,
              null
            );
          }
          setEditingPriceItem(null);
        }}
      />

      <DiscountModal
        visible={discountModalOpen}
        currentDiscount={activeTab?.discount ?? 0}
        subtotal={cartSummary.subtotal}
        onClose={() => setDiscountModalOpen(false)}
        onSaveDiscount={(amount) => {
          setDiscount(amount);
          setDiscountModalOpen(false);
        }}
      />

      <RemoveTabConfirmModal
        visible={removeTabModalOpen}
        tabLabel={activeTab?.label ?? "Nota"}
        onCancel={() => setRemoveTabModalOpen(false)}
        onConfirm={() => {
          if (activeTab) {
            removeTab(activeTab.id);
          }
          setRemoveTabModalOpen(false);
        }}
      />

      <ReceiptPreviewModal
        visible={previewVisible}
        order={pendingOrder}
        paperWidthMm={
          printerMode === "bluetooth"
            ? bluetoothPaperWidth
            : (storeSettings?.printerPaperWidth ?? 58)
        }
        copies={printCopies}
        printerMode={printerMode}
        isSubmitting={isPrinting}
        onChangeCopies={setPrintCopies}
        onClose={() => setPreviewVisible(false)}
        onConfirmPrint={() => {
          if (pendingOrder && pendingOrderTabId) {
            void runPrintFlow(pendingOrder, pendingOrderTabId);
          }
        }}
      />

      <PrinterInterventionModal
        visible={interventionState.visible}
        errorMessage={interventionState.errorMessage}
        diagnostic={interventionState.diagnostic}
        paperNearEnd={interventionState.paperNearEnd}
        isRetrying={isPrinting}
        isFlushing={isFlushing}
        onRetryPrint={() => {
          if (pendingOrder && pendingOrderTabId) {
            void runPrintFlow(pendingOrder, pendingOrderTabId);
          }
        }}
        onFlushQueue={() => {
          void handleFlushQueue();
        }}
        onFallbackSystemPrint={
          printerMode !== "system" && pendingOrder && pendingOrderTabId
            ? () => {
                void runPrintFlow(pendingOrder, pendingOrderTabId, "system");
              }
            : undefined
        }
        onClose={() =>
          setInterventionState((prev) => ({ ...prev, visible: false }))
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: TOKENS.colors.background,
  },
  segmentHeaderWrap: {
    paddingHorizontal: TOKENS.spacing.md,
    paddingVertical: 6,
    gap: TOKENS.spacing.xs,
    backgroundColor: TOKENS.colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.colors.borderSubtle,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: TOKENS.colors.surfaceContainer,
    borderRadius: TOKENS.radii.sm,
    padding: 3,
    gap: 3,
  },
  segmentTab: {
    flex: 1,
    minHeight: 34,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: TOKENS.spacing.sm,
    paddingVertical: 4,
  },
  segmentTabActive: {
    backgroundColor: TOKENS.colors.primary,
  },
  segmentTabText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.onSurfaceVariant,
  },
  segmentTabTextActive: {
    color: TOKENS.colors.onPrimary,
  },
  segmentContainer: {
    flex: 1,
  },
  filterHeader: {
    paddingHorizontal: TOKENS.spacing.md,
    paddingTop: TOKENS.spacing.sm,
    paddingBottom: TOKENS.spacing.xs,
    gap: TOKENS.spacing.xs,
  },
  searchBar: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TOKENS.colors.surfaceCard,
    borderWidth: 1,
    borderColor: TOKENS.colors.outline,
    borderRadius: TOKENS.radii.md,
    paddingHorizontal: TOKENS.spacing.md,
    gap: TOKENS.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONT_FAMILY.body,
    fontSize: 14,
    color: TOKENS.colors.onSurface,
    paddingVertical: 6,
  },
  clearSearchBtn: {
    width: TOKENS.spacing.xl,
    height: TOKENS.spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCatalogWrap: {
    padding: TOKENS.spacing.md,
  },
  catalogListContent: {
    paddingHorizontal: TOKENS.spacing.md,
    paddingTop: TOKENS.spacing.xs,
    paddingBottom: TOKENS.spacing.lg,
  },
  catalogListWithFloatingBar: {
    paddingHorizontal: TOKENS.spacing.md,
    paddingTop: TOKENS.spacing.xs,
    paddingBottom: 96,
  },
  productCard: {
    marginBottom: TOKENS.spacing.sm,
    gap: 6,
  },
  productCardActive: {
    borderColor: TOKENS.colors.primary,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: TOKENS.spacing.sm,
  },
  cardTitleGroup: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  productName: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 15,
    lineHeight: 20,
    color: TOKENS.colors.onSurface,
  },
  catBadge: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 11,
    lineHeight: 15,
    color: TOKENS.colors.onSurfaceVariant,
    backgroundColor: TOKENS.colors.surfaceContainer,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  qtyBadge: {
    backgroundColor: TOKENS.colors.primary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  qtyBadgeText: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 11,
    lineHeight: 15,
    color: TOKENS.colors.onPrimary,
  },
  skuLine: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.onSurfaceVariant,
  },
  skuChip: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
    backgroundColor: TOKENS.colors.surfaceContainer,
    paddingHorizontal: TOKENS.spacing.xs,
    borderRadius: TOKENS.radii.sm,
  },
  unitButtonsFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: TOKENS.colors.borderSubtle,
  },
  unitPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    minHeight: 34,
  },
  unitPillBtnActive: {
    backgroundColor: TOKENS.colors.primaryFixed,
    borderColor: TOKENS.colors.primary,
  },
  unitPillLabel: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.onSurfaceVariant,
  },
  unitPillPrice: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.primary,
  },
  unitQtyCircle: {
    backgroundColor: TOKENS.colors.primary,
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginLeft: 2,
  },
  unitQtyText: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 10,
    lineHeight: 14,
    color: TOKENS.colors.onPrimary,
  },
  unavailablePriceText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.destructive,
  },
  catLabel: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  wholesaleBadge: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.successText,
    backgroundColor: TOKENS.colors.successBg,
    paddingHorizontal: TOKENS.spacing.xs,
    borderRadius: TOKENS.radii.sm,
  },
  openPriceBadge: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.warningText,
    backgroundColor: TOKENS.colors.warningBg,
    paddingHorizontal: TOKENS.spacing.xs,
    borderRadius: TOKENS.radii.sm,
  },
  quickAddButton: {
    width: 36,
    height: 36,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  quickAddButtonDisabled: {
    backgroundColor: TOKENS.colors.surfaceContainer,
  },
  pressedItem: {
    opacity: 0.8,
  },
  floatingBarHost: {
    position: "absolute",
    left: TOKENS.spacing.md,
    right: TOKENS.spacing.md,
    bottom: TOKENS.spacing.md,
  },
  floatingCartBar: {
    minHeight: 60,
    backgroundColor: TOKENS.colors.primary,
    borderRadius: TOKENS.radii.md,
    paddingHorizontal: TOKENS.spacing.md,
    paddingVertical: TOKENS.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: TOKENS.spacing.sm,
  },
  floatingLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.sm,
  },
  floatingTitle: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onPrimary,
  },
  floatingSub: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.primaryFixed,
  },
  floatingTotal: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onPrimary,
  },
  tabsBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: TOKENS.spacing.md,
    paddingVertical: TOKENS.spacing.sm,
    backgroundColor: TOKENS.colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.colors.borderSubtle,
    gap: TOKENS.spacing.sm,
  },
  tabsStripContent: {
    gap: TOKENS.spacing.sm,
    alignItems: "center",
  },
  orderTabChip: {
    minHeight: TOKENS.spacing.touchTarget,
    paddingHorizontal: TOKENS.spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    justifyContent: "center",
    alignItems: "center",
  },
  orderTabChipActive: {
    backgroundColor: TOKENS.colors.primaryFixed,
    borderColor: TOKENS.colors.primary,
  },
  orderTabText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  orderTabTextActive: {
    color: TOKENS.colors.onPrimaryFixed,
  },
  newTabBtn: {
    minHeight: TOKENS.spacing.touchTarget,
    paddingHorizontal: TOKENS.spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: TOKENS.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.xs,
  },
  newTabBtnText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.primary,
  },
  deleteTabBtn: {
    width: TOKENS.spacing.touchTarget,
    height: TOKENS.spacing.touchTarget,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.errorContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  cartScrollContent: {
    padding: TOKENS.spacing.md,
    gap: TOKENS.spacing.sm,
  },
  cartItemCard: {
    gap: TOKENS.spacing.md,
  },
  cartItemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: TOKENS.spacing.sm,
  },
  cartItemTitleGroup: {
    flex: 1,
    gap: TOKENS.spacing.xs,
  },
  cartItemName: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onSurface,
  },
  cartBadgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: TOKENS.spacing.xs,
  },
  unitSwitchChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.xs,
    backgroundColor: TOKENS.colors.primaryFixed,
    paddingHorizontal: TOKENS.spacing.sm,
    paddingVertical: 2,
    borderRadius: TOKENS.radii.sm,
  },
  unitSwitchChipText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onPrimaryFixed,
  },
  removeLineBtn: {
    width: TOKENS.spacing.touchTarget,
    height: TOKENS.spacing.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  cartControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: TOKENS.spacing.sm,
  },
  stepperGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.xs,
  },
  stepperBtn: {
    width: TOKENS.spacing.touchTarget,
    height: TOKENS.spacing.touchTarget,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.surfaceContainer,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyTextInput: {
    minWidth: 52,
    minHeight: TOKENS.spacing.touchTarget,
    textAlign: "center",
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: TOKENS.typography.body,
    color: TOKENS.colors.onSurface,
    backgroundColor: TOKENS.colors.surfaceCard,
    borderWidth: 1,
    borderColor: TOKENS.colors.outline,
    borderRadius: TOKENS.radii.sm,
    paddingHorizontal: TOKENS.spacing.xs,
  },
  linePriceGroup: {
    alignItems: "flex-end",
    gap: TOKENS.spacing.xs,
  },
  editPriceBtn: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.xs,
    paddingHorizontal: TOKENS.spacing.sm,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
  },
  editPriceText: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.primary,
  },
  lineSubtotal: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onSurface,
  },
  summaryCard: {
    marginTop: TOKENS.spacing.sm,
    gap: TOKENS.spacing.md,
  },
  summaryLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  summaryMono: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onSurface,
  },
  savingsLabel: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.successText,
  },
  savingsMono: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.successText,
  },
  discountRow: {
    minHeight: TOKENS.spacing.touchTarget,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    paddingVertical: TOKENS.spacing.sm,
  },
  discountLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.xs,
  },
  discountLink: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.primary,
  },
  discountValue: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.primary,
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  grandTotalLabel: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onSurface,
  },
  grandTotalValue: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: TOKENS.typography.display,
    lineHeight: TOKENS.lineHeight.display,
    color: TOKENS.colors.primary,
  },
  copiesSelectorRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  copyChipsGroup: {
    flexDirection: "row",
    gap: TOKENS.spacing.sm,
  },
  copyChip: {
    minWidth: TOKENS.spacing.touchTarget,
    minHeight: TOKENS.spacing.touchTarget,
    borderRadius: TOKENS.radii.sm,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: TOKENS.spacing.sm,
  },
  copyChipSelected: {
    backgroundColor: TOKENS.colors.primaryFixed,
    borderColor: TOKENS.colors.primary,
  },
  copyChipText: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  copyChipTextSelected: {
    color: TOKENS.colors.onPrimaryFixed,
  },
});
