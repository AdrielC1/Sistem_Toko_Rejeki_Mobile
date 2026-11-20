import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
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
  ChevronDown,
  Copy,
  Files,
  FileText,
  Minus,
  Package,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  ShoppingBag,
  ShoppingCart,
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
  CartItemQuantityModal,
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
  const { user, role, storeSettings, serverConfig, refreshStoreSettings } =
    useAuth();

  const tabs = usePosCartStore((s) => s.tabs);
  const activeTabId = usePosCartStore((s) => s.activeTabId);
  const createTab = usePosCartStore((s) => s.createTab);
  const switchTab = usePosCartStore((s) => s.switchTab);
  const removeTab = usePosCartStore((s) => s.removeTab);
  const clearActiveTab = usePosCartStore((s) => s.clearActiveTab);
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
  const previewBeforePrint = usePrinterPrefsStore((s) => s.previewBeforePrint);

  const [segment, setSegment] = useState<KasirSegment>("catalog");
  const [isSliding, setIsSliding] = useState<boolean>(false);
  const [segmentTrackWidth, setSegmentTrackWidth] = useState<number>(
    Math.max(240, Dimensions.get("window").width - 32)
  );
  const [paneWidth, setPaneWidth] = useState<number>(
    Math.max(320, Dimensions.get("window").width)
  );
  const slideAnim = useRef(new Animated.Value(0)).current;

  const switchSegmentAnimated = (nextSegment: KasirSegment) => {
    if (nextSegment === segment) {
      return;
    }
    if (nextSegment === "cart") {
      void refreshStoreSettings();
    }
    setSegment(nextSegment);
    setIsSliding(true);
    Animated.timing(slideAnim, {
      toValue: nextSegment === "catalog" ? 0 : 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsSliding(false);
      }
    });
  };

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
  const [editingQuantityItem, setEditingQuantityItem] =
    useState<CartItem | null>(null);
  const [discountModalOpen, setDiscountModalOpen] = useState<boolean>(false);
  const [removeTabModalOpen, setRemoveTabModalOpen] = useState<boolean>(false);

  // Checkout / Print / Intervention state
  const [pendingOrder, setPendingOrder] = useState<CompletedOrder | null>(null);
  const [pendingOrderTabId, setPendingOrderTabId] = useState<string | null>(
    null
  );
  const [previewVisible, setPreviewVisible] = useState<boolean>(false);
  const [printSuccess, setPrintSuccess] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);
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
    overrideMode?: PrinterDeviceMode,
    copiesOverride?: 1 | 2
  ) => {
    const activeCopies = copiesOverride ?? printCopies;
    setIsPrinting(true);
    try {
      const outcome = await executeReceiptPrint({
        mode: overrideMode ?? printerMode,
        order: orderToPrint,
        copies: activeCopies,
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
        setInterventionState({
          visible: false,
          errorMessage: "",
          paperNearEnd: false,
        });
        setPendingOrder(null);
        setPendingOrderTabId(null);
        completeCheckoutTab(tabIdToComplete);
        switchSegmentAnimated("catalog");
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(() => {});

        // Tampilkan centang sukses di dalam modal tanpa memunculkan banner permanen di Kasir
        setStatusNotice(null);
        setPrintSuccess(true);
        setPreviewVisible(true);
        if (successTimerRef.current) {
          clearTimeout(successTimerRef.current);
        }
        successTimerRef.current = setTimeout(() => {
          setPreviewVisible(false);
          setPrintSuccess(false);
        }, 950);
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

  const handleCheckoutTap = async (copiesToUse?: 1 | 2) => {
    if (!activeTab) {
      return;
    }
    const chosenCopies = copiesToUse ?? printCopies;
    if (copiesToUse && copiesToUse !== printCopies) {
      setPrintCopies(copiesToUse);
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

    const effectiveSettings = storeSettings
      ? {
          ...storeSettings,
          printerPaperWidth: bluetoothPaperWidth,
        }
      : {
          storeName: "Toko Rejeki",
          printerPaperWidth: bluetoothPaperWidth,
        };
    const order = buildCompletedOrderPayload({
      items: activeTab.items,
      discount: activeTab.discount,
      cashierName: displayFullName,
      storeSettings: effectiveSettings,
    });

    waLogSentRef.current = false;
    setPrintSuccess(false);
    setPendingOrder(order);
    setPendingOrderTabId(activeTab.id);

    if (!previewBeforePrint) {
      await runPrintFlow(order, activeTab.id, undefined, chosenCopies);
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
      >
        {({ pressed }) => (
          <SurfaceCard
            style={[
              styles.productCard,
              inCartQty > 0 && styles.productCardActive,
              pressed && primaryUnit && styles.productCardPressed,
            ]}
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
                style={({ pressed: btnPressed }) => [
                  styles.quickAddButton,
                  !primaryUnit && styles.quickAddButtonDisabled,
                  btnPressed && primaryUnit && styles.pressedItem,
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
                      style={({ pressed: unitPressed }) => [
                        styles.unitPillBtn,
                        lineQty > 0 && styles.unitPillBtnActive,
                        unitPressed && styles.pressedItem,
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
        )}
      </Pressable>
    );
  };

  const halfSegmentWidth = Math.max(100, (segmentTrackWidth - 9) / 2);
  const pillTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, halfSegmentWidth + 3],
  });
  const pagesTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -paneWidth],
  });

  const renderCatalogPane = () => (
    <View style={[styles.segmentContainer, { width: paneWidth }]}>
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
            onPress={() => switchSegmentAnimated("cart")}
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
  );

  const renderCartPane = () => (
    <View style={[styles.segmentContainer, { width: paneWidth }]}>
      {/* Multi-Tab Strip (Nota 1, Nota 2, + Nota Baru) */}
      <View style={styles.tabsBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsStripContent}
        >
          {tabs.map((tab, index) => {
            const isActive = tab.id === activeTab?.id;
            const tabQty = tab.items.reduce(
              (acc, line) => acc + line.quantity,
              0
            );
            const displayLabel =
              tab.label.trim().replace(/^Nota\s*#/i, "Nota ") ||
              `Nota ${index + 1}`;
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
                {isActive ? (
                  <ReceiptText size={15} color={TOKENS.colors.onPrimary} />
                ) : (
                  <FileText size={15} color={TOKENS.colors.onSurfaceVariant} />
                )}
                <Text
                  style={[
                    styles.orderTabText,
                    isActive && styles.orderTabTextActive,
                  ]}
                >
                  {displayLabel}
                </Text>
                {tabQty > 0 ? (
                  <View
                    style={[
                      styles.orderTabCountBadge,
                      isActive && styles.orderTabCountBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.orderTabCountText,
                        isActive && styles.orderTabCountTextActive,
                      ]}
                    >
                      {tabQty}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}

          <Pressable
            testID="kasir-new-tab-button"
            accessibilityRole="button"
            onPress={() => createTab()}
            style={styles.newTabBtn}
          >
            <Plus size={15} color={TOKENS.colors.primary} />
            <Text style={styles.newTabBtnText}>Nota Baru</Text>
          </Pressable>
        </ScrollView>
      </View>

      {/* Main Nota Container Card */}
      <View style={styles.cartMainPanel}>
        {/* Sub-Header: ShoppingBag + Nota Aktif + Item Count Badge | Hapus + BATAL */}
        <View style={styles.cartSubHeader}>
          <View style={styles.cartSubHeaderLeft}>
            <ShoppingBag size={18} color={TOKENS.colors.primary} />
            <Text numberOfLines={1} style={styles.cartSubHeaderTitle}>
              {activeTab?.label.replace(/^Nota\s*#/i, "Nota ") ?? "Nota Aktif"}
            </Text>
            <View style={styles.cartItemCountPill}>
              <Text style={styles.cartItemCountPillText}>
                {`${cartSummary.totalQuantity} Item`}
              </Text>
            </View>
          </View>

          <View style={styles.cartSubHeaderActions}>
            {activeTab && (tabs.length > 1 || activeTab.items.length > 0) ? (
              <Pressable
                testID="kasir-delete-active-tab-button"
                accessibilityRole="button"
                accessibilityLabel={`Hapus ${activeTab.label}`}
                onPress={() => setRemoveTabModalOpen(true)}
                style={({ pressed }) => [
                  styles.subHeaderDeleteBtn,
                  pressed && styles.pressedItem,
                ]}
              >
                <Trash2 size={14} color={TOKENS.colors.destructive} />
                <Text style={styles.subHeaderDeleteText}>Hapus</Text>
              </Pressable>
            ) : null}

            <Pressable
              testID="kasir-clear-active-tab-button"
              accessibilityRole="button"
              accessibilityLabel="Kosongkan isi barang di nota ini"
              disabled={!activeTab || activeTab.items.length === 0}
              onPress={() => clearActiveTab()}
              style={({ pressed }) => [
                styles.subHeaderResetBtn,
                (!activeTab || activeTab.items.length === 0) &&
                  styles.disabledControl,
                pressed && styles.pressedItem,
              ]}
            >
              <RotateCcw size={13} color={TOKENS.colors.onSurfaceVariant} />
              <Text style={styles.subHeaderResetText}>BATAL</Text>
            </Pressable>
          </View>
        </View>

        {/* Scrollable Cart Items */}
        <ScrollView
          style={styles.cartItemsScroll}
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
                  onPress={() => switchSegmentAnimated("catalog")}
                />
              }
            />
          ) : (
            activeTab.items.map((item) => {
              const catalogProd = resolveCartCatalogProduct(item.productId);
              const availableUnits = catalogProd
                ? getAvailableUnitsForProduct(catalogProd)
                : [];
              const canSwitchUnit = availableUnits.length > 1;

              return (
                <View
                  key={`${item.productId}::${item.unitId}`}
                  testID={`kasir-cart-item-${item.productId}-${item.unitId}`}
                  style={styles.cartItemCard}
                >
                  {/* Top Row: Name + Grosir Badge (Left) | Subtotal + Trash (Right) */}
                  <View style={styles.cartItemHeader}>
                    <View style={styles.cartItemTitleGroup}>
                      <Text numberOfLines={1} style={styles.cartItemName}>
                        {item.productName}
                      </Text>
                      {item.wholesaleSavings > 0 ? (
                        <View style={styles.wholesaleBadgePill}>
                          <Text style={styles.wholesaleBadgeText}>Grosir</Text>
                        </View>
                      ) : null}
                      {item.isCustomPrice ? (
                        <View style={styles.openPriceBadgePill}>
                          <Text style={styles.openPriceBadgeText}>Khusus</Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.cartItemHeaderRight}>
                      <Text style={styles.lineSubtotal}>
                        {formatRupiah(item.subtotal)}
                      </Text>
                      <Pressable
                        testID={`cart-remove-${item.productId}-${item.unitId}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Hapus ${item.productName}`}
                        hitSlop={6}
                        onPress={() => removeItem(item.productId, item.unitId)}
                        style={styles.removeLineBtn}
                      >
                        <Trash2 size={17} color={TOKENS.colors.destructive} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Bottom Row: 3 Inline Controls [ Rp 7.500 ] [ Satuan ▼ ] [ - 2 + ] */}
                  <View style={styles.cartControlsRow}>
                    {/* 1. Price Box (Tap opens CartItemPriceModal without triggering inline keyboard) */}
                    <Pressable
                      testID={`cart-open-price-${item.productId}-${item.unitId}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Ubah harga ${item.productName}`}
                      onPress={() => setEditingPriceItem(item)}
                      style={({ pressed }) => [
                        styles.inlinePriceBox,
                        pressed && styles.pressedItem,
                      ]}
                    >
                      <Text style={styles.inlineRpPrefix}>Rp</Text>
                      <Text numberOfLines={1} style={styles.inlinePriceInput}>
                        {item.effectiveUnitPrice.toLocaleString("id-ID")}
                      </Text>
                    </Pressable>

                    {/* 2. Unit Selector Dropdown Pill */}
                    <Pressable
                      testID={`cart-unit-switch-${item.productId}-${item.unitId}`}
                      accessibilityRole="button"
                      disabled={!canSwitchUnit}
                      onPress={() => {
                        void handleOpenCartUnitSwitcher(item);
                      }}
                      style={({ pressed }) => [
                        styles.unitSelectorPill,
                        pressed && canSwitchUnit && styles.pressedItem,
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={styles.unitSelectorPillText}
                      >
                        {item.unitName}
                      </Text>
                      <ChevronDown
                        size={14}
                        color={
                          canSwitchUnit
                            ? TOKENS.colors.onSurfaceVariant
                            : TOKENS.colors.outline
                        }
                      />
                    </Pressable>

                    {/* 3. Quantity Stepper (Center number tap opens CartItemQuantityModal) */}
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
                        style={({ pressed }) => [
                          styles.stepperBtn,
                          pressed && styles.pressedItem,
                        ]}
                      >
                        <Minus size={15} color={TOKENS.colors.onSurface} />
                      </Pressable>

                      <Pressable
                        testID={`cart-qty-input-${item.productId}-${item.unitId}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Jumlah ${item.productName}`}
                        onPress={() => setEditingQuantityItem(item)}
                        style={({ pressed }) => [
                          styles.qtyValueBtn,
                          pressed && styles.pressedItem,
                        ]}
                      >
                        <Text numberOfLines={1} style={styles.qtyTextInput}>
                          {String(item.quantity)}
                        </Text>
                      </Pressable>

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
                        style={({ pressed }) => [
                          styles.stepperBtn,
                          pressed && styles.pressedItem,
                        ]}
                      >
                        <Plus size={15} color={TOKENS.colors.onSurface} />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Docked Summary Section inside Main Nota Panel */}
        <View
          testID="kasir-checkout-summary-card"
          style={styles.dockedSummarySection}
        >
          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryMono}>
              {formatRupiah(cartSummary.subtotal)}
            </Text>
          </View>

          {cartSummary.totalWholesaleSavings > 0 ? (
            <View style={styles.summaryLine}>
              <Text style={styles.savingsLabel}>Hemat Harga Grosir</Text>
              <Text style={styles.savingsMono}>
                {`-${formatRupiah(cartSummary.totalWholesaleSavings)}`}
              </Text>
            </View>
          ) : null}

          <View style={styles.summaryLine}>
            <Pressable
              testID="kasir-discount-trigger"
              accessibilityRole="button"
              onPress={() => setDiscountModalOpen(true)}
            >
              <Text style={styles.summaryLabel}>Potongan Harga</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Atur potongan harga"
              onPress={() => setDiscountModalOpen(true)}
              style={({ pressed }) => [
                styles.inlineDiscountBox,
                pressed && styles.pressedItem,
              ]}
            >
              <Text style={styles.inlineDiscountPrefix}>Rp</Text>
              <Text numberOfLines={1} style={styles.inlineDiscountInput}>
                {cartSummary.discount > 0
                  ? cartSummary.discount.toLocaleString("id-ID")
                  : "0"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>TOTAL BAYAR</Text>
            <Text testID="kasir-grand-total" style={styles.grandTotalValue}>
              {formatRupiah(cartSummary.grandTotal)}
            </Text>
          </View>
        </View>
      </View>

      {/* Bottom Print Action Buttons (Cetak Struk 1x [Green] & Cetak Struk 2x) */}
      <View style={styles.printActionsFooter}>
        <Pressable
          testID="kasir-checkout-button"
          accessibilityRole="button"
          disabled={
            isPrinting || !activeTab || activeTab.items.length === 0
          }
          onPress={() => {
            void handleCheckoutTap(1);
          }}
          style={({ pressed }) => [
            styles.print2xBtn,
            (isPrinting || !activeTab || activeTab.items.length === 0) &&
              styles.disabledControl,
            pressed && styles.pressedItem,
          ]}
        >
          <Copy size={17} color="#ffffff" />
          <Text style={styles.print2xBtnText}>
            {isPrinting && printCopies === 1
              ? "Memproses..."
              : "Cetak Struk 1x"}
          </Text>
        </Pressable>

        <Pressable
          testID="kasir-checkout-2x-button"
          accessibilityRole="button"
          disabled={
            isPrinting || !activeTab || activeTab.items.length === 0
          }
          onPress={() => {
            void handleCheckoutTap(2);
          }}
          style={({ pressed }) => [
            styles.print3xBtn,
            (isPrinting || !activeTab || activeTab.items.length === 0) &&
              styles.disabledControl,
            pressed && styles.pressedItem,
          ]}
        >
          <Files size={17} color={TOKENS.colors.primary} />
          <Text style={styles.print3xBtnText}>
            {isPrinting && printCopies === 2
              ? "Memproses..."
              : "Cetak Struk 2x"}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View
      style={styles.screen}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && w !== paneWidth) {
          setPaneWidth(w);
        }
      }}
    >
      <TabScreenHeader
        testID="kasir-header"
        title="Kasir"
        icon={<Calculator size={20} color={TOKENS.colors.primary} />}
        bannerSlot={<InitialSyncBanner />}
      />

      <View style={styles.segmentHeaderWrap}>
        <View
          style={styles.segmentedControl}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0 && w !== segmentTrackWidth) {
              setSegmentTrackWidth(w);
            }
          }}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.segmentSlidingIndicator,
              {
                width: halfSegmentWidth,
                transform: [{ translateX: pillTranslateX }],
              },
            ]}
          />
          <Pressable
            testID="kasir-segment-catalog"
            accessibilityRole="button"
            accessibilityState={{ selected: segment === "catalog" }}
            onPress={() => switchSegmentAnimated("catalog")}
            style={styles.segmentTab}
          >
            <Package
              size={15}
              color={
                segment === "catalog"
                  ? TOKENS.colors.onPrimary
                  : TOKENS.colors.onSurfaceVariant
              }
            />
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
            onPress={() => switchSegmentAnimated("cart")}
            style={styles.segmentTab}
          >
            <ShoppingCart
              size={15}
              color={
                segment === "cart"
                  ? TOKENS.colors.onPrimary
                  : TOKENS.colors.onSurfaceVariant
              }
            />
            <Text
              style={[
                styles.segmentTabText,
                segment === "cart" && styles.segmentTabTextActive,
              ]}
            >
              Nota Aktif
            </Text>
            {cartSummary.totalQuantity > 0 ? (
              <View
                style={[
                  styles.segmentCountPill,
                  segment === "cart" && styles.segmentCountPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentCountText,
                    segment === "cart" && styles.segmentCountTextActive,
                  ]}
                >
                  {cartSummary.totalQuantity}
                </Text>
              </View>
            ) : null}
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

      <View style={styles.slidingViewport}>
        {isSliding ? (
          <Animated.View
            style={[
              styles.slidingTrack,
              {
                width: paneWidth * 2,
                transform: [{ translateX: pagesTranslateX }],
              },
            ]}
          >
            {renderCatalogPane()}
            {renderCartPane()}
          </Animated.View>
        ) : segment === "catalog" ? (
          renderCatalogPane()
        ) : (
          renderCartPane()
        )}
      </View>

      <ProductUnitPickerModal
        visible={unitPickerState !== null}
        product={unitPickerState?.product ?? null}
        units={unitPickerState?.units ?? []}
        selectedUnitId={unitPickerState?.switchingFromUnitId}
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

      <CartItemQuantityModal
        visible={editingQuantityItem !== null}
        item={editingQuantityItem}
        onClose={() => setEditingQuantityItem(null)}
        onSaveQuantity={(nextQty) => {
          if (editingQuantityItem) {
            updateItemQuantity(
              editingQuantityItem.productId,
              editingQuantityItem.unitId,
              nextQty
            );
          }
          setEditingQuantityItem(null);
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
        itemCount={cartSummary.totalQuantity}
        grandTotal={cartSummary.grandTotal}
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
        paperWidthMm={bluetoothPaperWidth}
        copies={printCopies}
        printerMode={printerMode}
        isSubmitting={isPrinting}
        printSuccess={printSuccess}
        onClose={() => {
          setPrintSuccess(false);
          setPreviewVisible(false);
        }}
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
    position: "relative",
    flexDirection: "row",
    backgroundColor: TOKENS.colors.surfaceContainer,
    borderRadius: TOKENS.radii.sm,
    padding: 3,
    gap: 3,
  },
  segmentSlidingIndicator: {
    position: "absolute",
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: 6,
    backgroundColor: TOKENS.colors.primary,
  },
  segmentTab: {
    flex: 1,
    minHeight: 36,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: TOKENS.spacing.sm,
    paddingVertical: 4,
    zIndex: 1,
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
  segmentCountPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: TOKENS.colors.primary,
  },
  segmentCountPillActive: {
    backgroundColor: TOKENS.colors.onPrimary,
  },
  segmentCountText: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 10,
    lineHeight: 14,
    color: TOKENS.colors.onPrimary,
  },
  segmentCountTextActive: {
    color: TOKENS.colors.primary,
  },
  slidingViewport: {
    flex: 1,
    overflow: "hidden",
  },
  slidingTrack: {
    flex: 1,
    flexDirection: "row",
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
    borderColor: TOKENS.colors.borderSubtle,
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
  productCardPressed: {
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
    paddingTop: TOKENS.spacing.sm,
    paddingBottom: 6,
  },
  tabsStripContent: {
    gap: 8,
    alignItems: "center",
  },
  orderTabChip: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    backgroundColor: TOKENS.colors.surfaceCard,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  orderTabChipActive: {
    backgroundColor: TOKENS.colors.primary,
    borderColor: TOKENS.colors.primary,
  },
  orderTabText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.onSurfaceVariant,
  },
  orderTabTextActive: {
    color: TOKENS.colors.onPrimary,
  },
  orderTabCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: TOKENS.colors.primaryFixed,
  },
  orderTabCountBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  orderTabCountText: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 10,
    lineHeight: 14,
    color: TOKENS.colors.onPrimaryFixed,
  },
  orderTabCountTextActive: {
    color: TOKENS.colors.onPrimary,
  },
  newTabBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: TOKENS.colors.borderSubtle,
    backgroundColor: TOKENS.colors.surfaceCard,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  newTabBtnText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.primary,
  },
  cartMainPanel: {
    flex: 1,
    marginHorizontal: TOKENS.spacing.md,
    marginBottom: 8,
    backgroundColor: TOKENS.colors.surfaceCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    padding: 12,
    overflow: "hidden",
  },
  cartSubHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderStyle: "dashed",
    borderBottomColor: TOKENS.colors.borderSubtle,
    gap: 8,
  },
  cartSubHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  },
  cartSubHeaderTitle: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 14,
    lineHeight: 18,
    color: TOKENS.colors.onSurface,
    flexShrink: 1,
  },
  cartItemCountPill: {
    backgroundColor: TOKENS.colors.primaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    flexShrink: 0,
  },
  cartItemCountPillText: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 11,
    lineHeight: 15,
    color: TOKENS.colors.primary,
  },
  cartSubHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  subHeaderDeleteBtn: {
    height: 30,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.32)",
    backgroundColor: "#fff5f5",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  subHeaderDeleteText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 11,
    lineHeight: 15,
    color: TOKENS.colors.destructive,
  },
  subHeaderResetBtn: {
    height: 30,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    backgroundColor: TOKENS.colors.surfaceCard,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  subHeaderResetText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.4,
    color: TOKENS.colors.onSurfaceVariant,
  },
  disabledControl: {
    opacity: 0.45,
  },
  cartItemsScroll: {
    flex: 1,
  },
  cartScrollContent: {
    gap: 10,
    paddingBottom: 8,
  },
  cartItemCard: {
    backgroundColor: TOKENS.colors.surfaceCard,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  cartItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cartItemTitleGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    minWidth: 0,
  },
  cartItemName: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 13,
    lineHeight: 18,
    color: TOKENS.colors.onSurface,
    flexShrink: 1,
  },
  wholesaleBadgePill: {
    backgroundColor: TOKENS.colors.warningBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  wholesaleBadgeText: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 10,
    lineHeight: 14,
    color: TOKENS.colors.warningText,
  },
  openPriceBadgePill: {
    backgroundColor: TOKENS.colors.primaryFixed,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  openPriceBadgeText: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 10,
    lineHeight: 14,
    color: TOKENS.colors.onPrimaryFixed,
  },
  cartItemHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  lineSubtotal: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 13,
    lineHeight: 18,
    color: TOKENS.colors.primary,
  },
  removeLineBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  cartControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  inlinePriceBox: {
    flex: 1.15,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    borderRadius: 9,
    paddingHorizontal: 8,
  },
  inlineRpPrefix: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 11,
    lineHeight: 15,
    color: TOKENS.colors.onSurfaceVariant,
    marginRight: 4,
  },
  inlinePriceInput: {
    flex: 1,
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 12,
    color: TOKENS.colors.onSurface,
    paddingVertical: 0,
  },
  unitSelectorPill: {
    flex: 1,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    borderRadius: 9,
    paddingHorizontal: 9,
    gap: 4,
  },
  unitSelectorPillText: {
    flex: 1,
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.onSurface,
  },
  stepperGroup: {
    flex: 1.05,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    borderRadius: 9,
    overflow: "hidden",
  },
  stepperBtn: {
    width: 30,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyValueBtn: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyTextInput: {
    textAlign: "center",
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 12,
    color: TOKENS.colors.onSurface,
  },
  dockedSummarySection: {
    paddingTop: 10,
    marginTop: 6,
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderTopColor: TOKENS.colors.borderSubtle,
    gap: 6,
    backgroundColor: TOKENS.colors.surfaceCard,
  },
  summaryLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.onSurfaceVariant,
  },
  summaryMono: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.onSurface,
  },
  savingsLabel: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.successText,
  },
  savingsMono: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.successText,
  },
  inlineDiscountBox: {
    width: 118,
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    borderRadius: 7,
    paddingHorizontal: 8,
  },
  inlineDiscountPrefix: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 11,
    lineHeight: 14,
    color: TOKENS.colors.onSurfaceVariant,
    marginRight: 4,
  },
  inlineDiscountInput: {
    flex: 1,
    textAlign: "right",
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 12,
    color: TOKENS.colors.onSurface,
    paddingVertical: 0,
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingTop: 8,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: TOKENS.colors.borderSubtle,
  },
  grandTotalLabel: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 13,
    lineHeight: 18,
    color: TOKENS.colors.onSurface,
  },
  grandTotalValue: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 20,
    lineHeight: 24,
    color: TOKENS.colors.primary,
  },
  printActionsFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: TOKENS.spacing.md,
    paddingVertical: 10,
    backgroundColor: TOKENS.colors.surfaceCard,
    borderTopWidth: 1,
    borderTopColor: TOKENS.colors.borderSubtle,
  },
  print2xBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#059669",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  print2xBtnText: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 13,
    lineHeight: 18,
    color: "#ffffff",
  },
  print3xBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: TOKENS.colors.surfaceContainer,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  print3xBtnText: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 13,
    lineHeight: 18,
    color: TOKENS.colors.onSurface,
  },
});
