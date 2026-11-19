import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import {
  ChevronDown,
  Package,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react-native";
import {
  CatalogLoadMoreFooter,
  CatalogPaginationSummary,
} from "@/components/common/CatalogPaginationBar";
import { EmptyStateCard } from "@/components/common/EmptyStateCard";
import { CategoryPickerModal } from "@/components/common/HybridCategoryBar";
import { InitialSyncBanner } from "@/components/common/InitialSyncBanner";
import { TabScreenHeader } from "@/components/common/TabScreenHeader";
import {
  FeedbackBanner,
  SecondaryButton,
  SurfaceCard,
} from "@/components/ui/VelocityPrimitives";
import { useAuth } from "@/context/AuthContext";
import { useSyncEngine } from "@/context/SyncEngineContext";
import { useSystemStatus } from "@/context/SystemStatusContext";
import type { ProductSortMode } from "@/db/catalogRepo";
import { formatRupiah } from "@/domain/format";
import {
  CATALOG_PAGE_SIZE,
  usePaginatedCatalog,
} from "@/hooks/usePaginatedCatalog";
import { softDeleteServerProduct } from "@/services/api/productsApi";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";
import type { Product } from "@/types";

const SORT_OPTIONS: { id: ProductSortMode; label: string }[] = [
  { id: "az", label: "Nama A - Z" },
  { id: "za", label: "Nama Z - A" },
  { id: "price_asc", label: "Termurah" },
  { id: "price_desc", label: "Termahal" },
  { id: "newest", label: "Terbaru" },
];

interface UnitVariantBadge {
  key: string;
  label: string;
  isUnsold: boolean;
}

function buildProductVariantBadges(product: Product): UnitVariantBadge[] {
  const baseUnitName = product.unitName?.trim() || "Pcs";
  const badges: UnitVariantBadge[] = [];

  const baseActive = product.sellBaseUnit !== false;
  const hasBasePrice = product.sellingPrice > 0;
  if (!baseActive || (!hasBasePrice && !product.isOpenPrice)) {
    badges.push({
      key: `base-${product.unitId || baseUnitName}`,
      label: `1 ${baseUnitName} (${hasBasePrice ? `${formatRupiah(product.sellingPrice)} · ` : ""}Tidak Dijual)`,
      isUnsold: true,
    });
  } else {
    badges.push({
      key: `base-${product.unitId || baseUnitName}`,
      label: `1 ${baseUnitName} = ${formatRupiah(product.sellingPrice)}`,
      isUnsold: false,
    });
  }

  for (const conv of product.unitConversions ?? []) {
    const convName = conv.unitName?.trim() || "Satuan";
    const convActive = conv.isActive !== false;
    const convPrice = conv.sellingPrice ?? 0;
    if (!convActive || (convPrice <= 0 && !product.isOpenPrice)) {
      badges.push({
        key: conv.id || conv.unitId || convName,
        label: `1 ${convName} (${convPrice > 0 ? `${formatRupiah(convPrice)} · ` : ""}Tidak Dijual)`,
        isUnsold: true,
      });
    } else if (conv.conversionFactor === 1) {
      badges.push({
        key: conv.id || conv.unitId || convName,
        label: `1 ${convName} = ${formatRupiah(convPrice)}`,
        isUnsold: false,
      });
    } else {
      badges.push({
        key: conv.id || conv.unitId || convName,
        label: `1 ${convName} = ${conv.conversionFactor} ${baseUnitName} · ${formatRupiah(convPrice)}`,
        isUnsold: false,
      });
    }
  }

  return badges;
}

export default function ProdukScreen() {
  const router = useRouter();
  const { roleCapabilities, serverConfig } = useAuth();
  const { catalogReady, lastError } = useSyncEngine();
  const { healthState, isDeviceConnected, dbOnline } = useSystemStatus();

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [sortMode, setSortMode] = useState<ProductSortMode>("az");
  const [categoryModalOpen, setCategoryModalOpen] = useState<boolean>(false);
  const [sortModalOpen, setSortModalOpen] = useState<boolean>(false);

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [banner, setBanner] = useState<{
    variant: "success" | "error";
    message: string;
  } | null>(null);

  const {
    products,
    totalCount,
    unfilteredTotalCount,
    hasMore,
    categories,
    isLoading,
    isLoadingMore,
    loadMore,
  } = usePaginatedCatalog({
    searchQuery,
    categoryId: selectedCategoryId,
    sortMode,
    includeInactive: roleCapabilities.canEditProducts,
    pageSize: CATALOG_PAGE_SIZE,
  });

  const canWriteOnline =
    roleCapabilities.canEditProducts &&
    isDeviceConnected &&
    dbOnline &&
    healthState !== "offline" &&
    healthState !== "read_only";

  const selectedCategoryName = useMemo(() => {
    if (selectedCategoryId === "all") {
      return "Semua Kategori";
    }
    return (
      categories.find((cat) => cat.id === selectedCategoryId)?.name ??
      "Semua Kategori"
    );
  }, [categories, selectedCategoryId]);

  const activeSortLabel = useMemo(
    () => SORT_OPTIONS.find((opt) => opt.id === sortMode)?.label ?? "Nama A - Z",
    [sortMode]
  );

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting || !canWriteOnline) {
      return;
    }
    setIsDeleting(true);
    setBanner(null);
    try {
      const res = await softDeleteServerProduct(serverConfig, deleteTarget.id);
      if (res.ok) {
        setBanner({
          variant: "success",
          message: `"${deleteTarget.name}" dipindahkan ke Tong Sampah.`,
        });
        setDeleteTarget(null);
      } else {
        setBanner({
          variant: "error",
          message: res.error ?? "Gagal menghapus produk.",
        });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const renderProductCard = ({ item }: { item: Product }) => {
    const baseUnitName = item.unitName?.trim() || "Pcs";
    const unitBadges = buildProductVariantBadges(item);

    return (
      <Pressable
        testID={`produk-list-item-${item.id}`}
        accessibilityRole="button"
        onPress={() => {
          router.push(`/produk/${item.id}`);
        }}
      >
        {({ pressed }) => (
          <SurfaceCard
            style={[
              styles.productCard,
              pressed && styles.productCardPressed,
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <View style={styles.titleLine}>
                  <Text numberOfLines={2} style={styles.productName}>
                    {item.name}
                  </Text>
                  {item.categoryName ? (
                    <Text style={styles.categoryChip}>{item.categoryName}</Text>
                  ) : null}
                  {!item.isActive ? (
                    <Text style={styles.inactiveChip}>Nonaktif</Text>
                  ) : null}
                </View>
                <Text style={styles.skuLine}>
                  {`SKU: ${item.sku || "-"}${
                    item.barcode ? ` · BC: ${item.barcode}` : ""
                  }`}
                </Text>
              </View>

              {roleCapabilities.canEditProducts ? (
                <View style={styles.cardActionButtons}>
                  <Pressable
                    testID={`produk-card-edit-${item.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit produk ${item.name}`}
                    disabled={!canWriteOnline}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      router.push(`/produk/form?id=${item.id}`);
                    }}
                    style={({ pressed: editPressed }) => [
                      styles.cardEditBtn,
                      !canWriteOnline && styles.disabledBtn,
                      editPressed && canWriteOnline && styles.pressedCard,
                    ]}
                  >
                    <Pencil size={16} color={TOKENS.colors.primary} />
                  </Pressable>
                  <Pressable
                    testID={`produk-card-delete-${item.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Hapus produk ${item.name}`}
                    disabled={!canWriteOnline}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      setDeleteTarget(item);
                    }}
                    style={({ pressed: delPressed }) => [
                      styles.cardDeleteBtn,
                      !canWriteOnline && styles.disabledBtn,
                      delPressed && canWriteOnline && styles.pressedCard,
                    ]}
                  >
                    <Trash2 size={16} color={TOKENS.colors.destructive} />
                  </Pressable>
                </View>
              ) : null}
            </View>

            <View style={styles.variantBox}>
              <Text style={styles.boxHeading}>VARIAN SATUAN &amp; HARGA</Text>
              <View style={styles.pillWrap}>
                {unitBadges.map((badge) => (
                  <Text
                    key={badge.key}
                    style={[
                      styles.variantPill,
                      badge.isUnsold && styles.variantPillUnsold,
                    ]}
                  >
                    {badge.label}
                  </Text>
                ))}
              </View>
            </View>

            {item.wholesaleTiers.length > 0 ? (
              <View style={styles.wholesaleBox}>
                <Text style={styles.wholesaleHeading}>
                  HARGA GROSIR BERTINGKAT
                </Text>
                <View style={styles.pillWrap}>
                  {item.wholesaleTiers.map((tier, idx) => (
                    <Text
                      key={`${tier.minQty}-${idx}`}
                      style={styles.wholesalePill}
                    >
                      {`≥${tier.minQty} ${tier.unitName ?? baseUnitName}: ${formatRupiah(tier.price)}`}
                    </Text>
                  ))}
                </View>
              </View>
            ) : null}
          </SurfaceCard>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <TabScreenHeader
        testID="produk-header"
        title="Produk"
        icon={<Package size={20} color={TOKENS.colors.primary} />}
        bannerSlot={<InitialSyncBanner />}
      />

      <View style={styles.controlsWrap}>
        {banner ? (
          <FeedbackBanner variant={banner.variant} message={banner.message} />
        ) : null}

        <View style={styles.searchActionRow}>
          <View style={styles.searchBar}>
            <Search size={18} color={TOKENS.colors.outline} />
            <TextInput
              testID="produk-search-input"
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Cari barang di katalog..."
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

          {roleCapabilities.canEditProducts ? (
            <View style={styles.actionBtnGroup}>
              <Pressable
                testID="produk-add-button"
                accessibilityRole="button"
                accessibilityLabel="Tambah Produk Baru"
                disabled={!canWriteOnline}
                onPress={() => router.push("/produk/form")}
                style={[
                  styles.toolbarPrimaryBtn,
                  !canWriteOnline && styles.disabledBtn,
                ]}
              >
                <Plus size={19} color={TOKENS.colors.onPrimary} />
              </Pressable>
              <Pressable
                testID="produk-trash-button"
                accessibilityRole="button"
                accessibilityLabel="Buka Tong Sampah Produk"
                onPress={() => router.push("/produk/trash")}
                style={styles.toolbarTrashBtn}
              >
                <Trash2 size={18} color={TOKENS.colors.onPrimary} />
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.dropdownRow}>
          <View style={styles.dropdownCell}>
            <Pressable
              testID="produk-category-filter-trigger"
              accessibilityRole="button"
              onPress={() => setCategoryModalOpen(true)}
              style={styles.dropdownTrigger}
            >
              <Text numberOfLines={1} style={styles.dropdownLabel}>
                {selectedCategoryName}
              </Text>
              <View style={styles.dropdownIcons}>
                {selectedCategoryId !== "all" ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Reset filter kategori"
                    hitSlop={6}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      setSelectedCategoryId("all");
                    }}
                    style={styles.inlineClearBtn}
                  >
                    <X size={14} color={TOKENS.colors.onSurfaceVariant} />
                  </Pressable>
                ) : null}
                <ChevronDown size={16} color={TOKENS.colors.onSurfaceVariant} />
              </View>
            </Pressable>
          </View>

          <View style={styles.dropdownCell}>
            <Pressable
              testID="produk-sort-trigger"
              accessibilityRole="button"
              onPress={() => setSortModalOpen(true)}
              style={styles.dropdownTrigger}
            >
              <Text numberOfLines={1} style={styles.dropdownLabel}>
                {`Urut: ${activeSortLabel}`}
              </Text>
              <ChevronDown size={16} color={TOKENS.colors.onSurfaceVariant} />
            </Pressable>
          </View>
        </View>

        <CatalogPaginationSummary
          testID="produk-pagination-summary"
          totalCount={totalCount}
          visibleCount={products.length}
          hasMore={hasMore}
          pageSize={CATALOG_PAGE_SIZE}
        />
      </View>

      {unfilteredTotalCount === 0 && !isLoading ? (
        <ScrollView contentContainerStyle={styles.emptyWrap}>
          {lastError && !catalogReady ? (
            <FeedbackBanner
              variant="warning"
              message="Katalog belum tersinkron. Pastikan server aktif."
            />
          ) : null}
          <EmptyStateCard
            testID="produk-empty-card"
            icon={<Package size={24} color={TOKENS.colors.primary} />}
            iconBadgeVariant={
              !catalogReady && Boolean(lastError) ? "warning" : "neutral"
            }
            title="Katalog Produk Belum Tersinkronisasi"
            description="Daftar barang dan harga grosir akan tampil di sini setelah sinkronisasi SQLite aktif. Ketuk Periksa Koneksi di Pengaturan untuk melihat status server."
            action={
              <SecondaryButton
                testID="produk-open-settings-button"
                variant="outlined"
                label="Periksa Koneksi di Pengaturan"
                icon={<Settings size={18} color={TOKENS.colors.primary} />}
                onPress={() => {
                  router.push("/pengaturan");
                }}
              />
            }
          />
        </ScrollView>
      ) : products.length === 0 && !isLoading ? (
        <View style={styles.emptyWrap}>
          <EmptyStateCard
            testID="produk-no-match-card"
            icon={<Search size={24} color={TOKENS.colors.primary} />}
            title="Produk Tidak Ditemukan"
            description="Tidak ada barang yang cocok dengan pencarian atau kategori yang dipilih."
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
          contentContainerStyle={styles.listContent}
        />
      )}

      <CategoryPickerModal
        visible={categoryModalOpen}
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        enablePinning={false}
        onSelect={setSelectedCategoryId}
        onClose={() => setCategoryModalOpen(false)}
      />

      <Modal
        testID="produk-sort-modal"
        visible={sortModalOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSortModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setSortModalOpen(false)}
          />
          <View style={styles.sortModalCard}>
            <Text style={styles.sortModalTitle}>Urutkan Produk</Text>
            {SORT_OPTIONS.map((opt) => {
              const selected = sortMode === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  testID={`produk-sort-${opt.id}`}
                  accessibilityRole="button"
                  onPress={() => {
                    setSortMode(opt.id);
                    setSortModalOpen(false);
                  }}
                  style={[
                    styles.sortOptionRow,
                    selected && styles.sortOptionRowActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.sortOptionText,
                      selected && styles.sortOptionTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>

      <Modal
        testID="produk-card-delete-modal"
        visible={deleteTarget !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (!isDeleting) {
            setDeleteTarget(null);
          }
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.sortModalCard}>
            <Text style={styles.sortModalTitle}>Hapus Produk?</Text>
            <Text style={styles.deleteConfirmBody}>
              {`"${deleteTarget?.name ?? ""}" akan dipindahkan ke Tong Sampah selama 30 hari dan dapat dipulihkan kembali.`}
            </Text>
            <View style={styles.deleteModalActions}>
              <SecondaryButton
                variant="tonal"
                label="Batal"
                disabled={isDeleting}
                onPress={() => setDeleteTarget(null)}
                style={styles.flexOne}
              />
              <SecondaryButton
                testID="produk-card-delete-confirm"
                variant="danger"
                label="Ya, Hapus"
                loading={isDeleting}
                loadingLabel="Menghapus..."
                disabled={isDeleting}
                onPress={() => {
                  void handleConfirmDelete();
                }}
                style={styles.flexOne}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: TOKENS.colors.background,
  },
  controlsWrap: {
    paddingHorizontal: TOKENS.spacing.md,
    paddingTop: TOKENS.spacing.sm,
    paddingBottom: TOKENS.spacing.xs,
    gap: TOKENS.spacing.xs,
  },
  searchActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.xs,
  },
  searchBar: {
    flex: 1,
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TOKENS.colors.surfaceCard,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    borderRadius: TOKENS.radii.md,
    paddingHorizontal: TOKENS.spacing.sm,
    gap: TOKENS.spacing.xs,
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
  actionBtnGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  toolbarPrimaryBtn: {
    width: 42,
    height: 42,
    borderRadius: TOKENS.radii.md,
    backgroundColor: TOKENS.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  toolbarTrashBtn: {
    width: 42,
    height: 42,
    borderRadius: TOKENS.radii.md,
    backgroundColor: TOKENS.colors.destructive,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledBtn: {
    opacity: 0.45,
  },
  dropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.xs,
  },
  dropdownCell: {
    flex: 1,
  },
  dropdownTrigger: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: TOKENS.colors.surfaceCard,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    borderRadius: TOKENS.radii.lg,
    paddingHorizontal: TOKENS.spacing.sm,
    gap: 4,
  },
  dropdownLabel: {
    flex: 1,
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.onSurface,
  },
  dropdownIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  inlineClearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyWrap: {
    padding: TOKENS.spacing.md,
    gap: TOKENS.spacing.md,
  },
  listContent: {
    paddingHorizontal: TOKENS.spacing.md,
    paddingTop: TOKENS.spacing.xs,
    paddingBottom: TOKENS.spacing.lg,
  },
  pressedCard: {
    opacity: 0.84,
  },
  productCard: {
    marginBottom: TOKENS.spacing.sm,
    gap: TOKENS.spacing.xs,
  },
  productCardPressed: {
    borderColor: TOKENS.colors.primary,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: TOKENS.spacing.sm,
  },
  cardHeaderLeft: {
    flex: 1,
    gap: 2,
  },
  titleLine: {
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
  categoryChip: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 11,
    lineHeight: 15,
    color: TOKENS.colors.onPrimaryFixed,
    backgroundColor: TOKENS.colors.primaryFixed,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  inactiveChip: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 11,
    lineHeight: 15,
    color: TOKENS.colors.destructive,
    backgroundColor: TOKENS.colors.errorContainer,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  skuLine: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.onSurfaceVariant,
  },
  cardActionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  cardEditBtn: {
    width: 36,
    height: 36,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
  },
  cardDeleteBtn: {
    width: 36,
    height: 36,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.errorContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  variantBox: {
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderRadius: TOKENS.radii.md,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    padding: 10,
    gap: 6,
  },
  boxHeading: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.5,
    color: TOKENS.colors.onSurfaceVariant,
  },
  pillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  variantPill: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.onSurface,
    backgroundColor: TOKENS.colors.surfaceCard,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  variantPillUnsold: {
    color: TOKENS.colors.onSurfaceVariant,
    backgroundColor: TOKENS.colors.surfaceContainer,
    borderStyle: "dashed",
  },
  wholesaleBox: {
    backgroundColor: TOKENS.colors.warningBg,
    borderRadius: TOKENS.radii.md,
    borderWidth: 1,
    borderColor: TOKENS.colors.warningBorder,
    padding: 10,
    gap: 6,
  },
  wholesaleHeading: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.5,
    color: TOKENS.colors.warningText,
  },
  wholesalePill: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.warningText,
    backgroundColor: TOKENS.colors.surfaceCard,
    borderWidth: 1,
    borderColor: TOKENS.colors.warningBorder,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: TOKENS.colors.modalBackdrop,
    justifyContent: "center",
    padding: TOKENS.spacing.md,
  },
  sortModalCard: {
    backgroundColor: TOKENS.colors.surfaceCard,
    borderRadius: TOKENS.radii.lg,
    padding: TOKENS.spacing.md,
    gap: TOKENS.spacing.xs,
  },
  sortModalTitle: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 17,
    lineHeight: 22,
    color: TOKENS.colors.onSurface,
    marginBottom: 4,
  },
  sortOptionRow: {
    paddingHorizontal: TOKENS.spacing.md,
    paddingVertical: 12,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
  },
  sortOptionRowActive: {
    backgroundColor: TOKENS.colors.primary,
  },
  sortOptionText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 14,
    lineHeight: 18,
    color: TOKENS.colors.onSurface,
  },
  sortOptionTextActive: {
    color: TOKENS.colors.onPrimary,
  },
  deleteConfirmBody: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 14,
    lineHeight: 20,
    color: TOKENS.colors.onSurfaceVariant,
  },
  deleteModalActions: {
    flexDirection: "row",
    gap: TOKENS.spacing.sm,
    marginTop: TOKENS.spacing.sm,
  },
  flexOne: {
    flex: 1,
  },
});
