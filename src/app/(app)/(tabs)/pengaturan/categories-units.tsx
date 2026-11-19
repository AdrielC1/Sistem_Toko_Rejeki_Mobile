import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  AlertTriangle,
  ArchiveRestore,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock,
  FolderOpen,
  Lock,
  Package,
  Pencil,
  Plus,
  Ruler,
  Search,
  Tags,
  Trash2,
  X,
} from "lucide-react-native";
import { EmptyStateCard } from "@/components/common/EmptyStateCard";
import {
  FeedbackBanner,
  InputField,
  PrimaryButton,
  SecondaryButton,
  SurfaceCard,
} from "@/components/ui/VelocityPrimitives";
import { useAuth } from "@/context/AuthContext";
import { useSystemStatus } from "@/context/SystemStatusContext";
import { formatRupiah } from "@/domain/format";
import {
  createCategoryServer,
  createUnitServer,
  fetchCategoriesServer,
  fetchCategoryDetailServer,
  fetchTrashedCategoriesServer,
  fetchTrashedUnitsServer,
  fetchUnitDetailServer,
  fetchUnitsServer,
  migrateCategoryProductsServer,
  migrateUnitProductsServer,
  purgeTrashedCategoryServer,
  purgeTrashedUnitServer,
  restoreTrashedCategoryServer,
  restoreTrashedUnitServer,
  softDeleteCategoryServer,
  softDeleteUnitServer,
  updateCategoryServer,
  updateUnitServer,
  type ConnectedProductSummary,
  type TrashMasterRecord,
} from "@/services/api/categoriesUnitsApi";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";
import type { Category, Unit } from "@/types";

type ActiveTab = "categories" | "units";

function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function PengaturanCategoriesUnitsScreen() {
  const router = useRouter();
  const { serverConfig } = useAuth();
  const { healthState, isDeviceConnected, dbOnline } = useSystemStatus();

  const [activeTab, setActiveTab] = useState<ActiveTab>("categories");
  const [segmentBarWidth, setSegmentBarWidth] = useState<number>(0);
  const [viewportWidth, setViewportWidth] = useState<number>(0);
  const tabAnim = useRef(new Animated.Value(0)).current;

  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [trashedCategories, setTrashedCategories] = useState<
    TrashMasterRecord[]
  >([]);
  const [trashedUnits, setTrashedUnits] = useState<TrashMasterRecord[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [banner, setBanner] = useState<{
    variant: "success" | "error";
    message: string;
  } | null>(null);

  // 1. Add Modal State
  const [addModalKind, setAddModalKind] = useState<ActiveTab | null>(null);
  const [newName, setNewName] = useState<string>("");

  // 2. Edit & Migration Panel Modal State
  const [editingItem, setEditingItem] = useState<{
    kind: ActiveTab;
    id: string;
    name: string;
    productCount: number;
  } | null>(null);
  const [editNameValue, setEditNameValue] = useState<string>("");
  const [connectedProducts, setConnectedProducts] = useState<
    ConnectedProductSummary[]
  >([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [productFilterQuery, setProductFilterQuery] = useState<string>("");
  const [migrationTargetId, setMigrationTargetId] = useState<string>("");
  const [migrationSearchQuery, setMigrationSearchQuery] = useState<string>("");
  const [isSavingRename, setIsSavingRename] = useState<boolean>(false);
  const [isMigrating, setIsMigrating] = useState<boolean>(false);

  // 3. Delete Safety Guard Modal State
  const [deleteCandidate, setDeleteCandidate] = useState<{
    kind: ActiveTab;
    id: string;
    name: string;
    productCount: number;
  } | null>(null);

  // 4. Dedicated Trash Modal State (Specific to active tab)
  const [trashModalKind, setTrashModalKind] = useState<ActiveTab | null>(null);
  const [trashSearchQuery, setTrashSearchQuery] = useState<string>("");
  const [confirmPurgeId, setConfirmPurgeId] = useState<string | null>(null);
  const [confirmEmptyAll, setConfirmEmptyAll] = useState<boolean>(false);
  const [trashProcessingId, setTrashProcessingId] = useState<string | null>(
    null
  );
  const [isEmptyingTrash, setIsEmptyingTrash] = useState<boolean>(false);

  const canWriteOnline =
    isDeviceConnected &&
    dbOnline &&
    healthState !== "offline" &&
    healthState !== "read_only";

  useEffect(() => {
    Animated.timing(tabAnim, {
      toValue: activeTab === "categories" ? 0 : 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeTab, tabAnim]);

  const segmentInnerWidth = Math.max(0, segmentBarWidth - 8);
  const pillWidth = segmentInnerWidth > 0 ? segmentInnerWidth / 2 : 0;
  const indicatorTranslateX = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, pillWidth],
  });
  const pagesTranslateX = tabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(viewportWidth || 1)],
  });

  const refreshAllLists = async () => {
    const [catRes, unitRes, catTrash, unitTrash] = await Promise.all([
      fetchCategoriesServer(serverConfig),
      fetchUnitsServer(serverConfig),
      fetchTrashedCategoriesServer(serverConfig),
      fetchTrashedUnitsServer(serverConfig),
    ]);
    if (catRes.ok) {
      setCategories(catRes.categories);
    }
    if (unitRes.ok) {
      setUnits(unitRes.units);
    }
    if (catTrash.ok) {
      setTrashedCategories(catTrash.items);
    }
    if (unitTrash.ok) {
      setTrashedUnits(unitTrash.items);
    }
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [catRes, unitRes, catTrash, unitTrash] = await Promise.all([
          fetchCategoriesServer(serverConfig),
          fetchUnitsServer(serverConfig),
          fetchTrashedCategoriesServer(serverConfig),
          fetchTrashedUnitsServer(serverConfig),
        ]);
        if (!active) {
          return;
        }
        if (catRes.ok) {
          setCategories(catRes.categories);
        }
        if (unitRes.ok) {
          setUnits(unitRes.units);
        }
        if (catTrash.ok) {
          setTrashedCategories(catTrash.items);
        }
        if (unitTrash.ok) {
          setTrashedUnits(unitTrash.items);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [serverConfig]);

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return categories;
    }
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, searchQuery]);

  const filteredUnits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return units;
    }
    return units.filter((u) => u.name.toLowerCase().includes(q));
  }, [units, searchQuery]);

  // 1. Add Item
  const handleOpenAddModal = (kind: ActiveTab) => {
    setNewName("");
    setBanner(null);
    setAddModalKind(kind);
  };

  const handleCreateItem = async () => {
    if (!addModalKind || isBusy || !canWriteOnline) {
      return;
    }
    const cleanName = newName.trim();
    if (!cleanName) {
      setBanner({ variant: "error", message: "Nama wajib diisi." });
      return;
    }

    setIsBusy(true);
    setBanner(null);
    try {
      const res =
        addModalKind === "categories"
          ? await createCategoryServer(serverConfig, { name: cleanName })
          : await createUnitServer(serverConfig, { name: cleanName });

      if (res.ok) {
        setAddModalKind(null);
        setNewName("");
        await refreshAllLists();
        setBanner({
          variant: "success",
          message: `${
            addModalKind === "categories" ? "Kategori" : "Satuan"
          } "${cleanName}" berhasil ditambahkan.`,
        });
      } else {
        setBanner({
          variant: "error",
          message: res.error ?? "Gagal menambahkan data.",
        });
      }
    } finally {
      setIsBusy(false);
    }
  };

  // 2. Open Edit & Migration Panel
  const handleOpenEditModal = async (
    kind: ActiveTab,
    item: { id: string; name: string; productCount?: number }
  ) => {
    setBanner(null);
    setEditingItem({
      kind,
      id: item.id,
      name: item.name,
      productCount: item.productCount ?? 0,
    });
    setEditNameValue(item.name);
    setConnectedProducts([]);
    setProductFilterQuery("");
    setMigrationTargetId("");
    setMigrationSearchQuery("");
    setIsLoadingDetail(true);

    try {
      if (kind === "categories") {
        const res = await fetchCategoryDetailServer(serverConfig, item.id);
        if (res.ok) {
          setConnectedProducts(res.connectedProducts);
          setEditingItem((prev) =>
            prev && prev.id === item.id
              ? { ...prev, productCount: res.connectedProducts.length }
              : prev
          );
        }
      } else {
        const res = await fetchUnitDetailServer(serverConfig, item.id);
        if (res.ok) {
          setConnectedProducts(res.connectedProducts);
          setEditingItem((prev) =>
            prev && prev.id === item.id
              ? { ...prev, productCount: res.connectedProducts.length }
              : prev
          );
        }
      }
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleSaveRename = async () => {
    if (!editingItem || isSavingRename || !canWriteOnline) {
      return;
    }
    const cleanName = editNameValue.trim();
    if (!cleanName || cleanName === editingItem.name) {
      return;
    }

    setIsSavingRename(true);
    setBanner(null);
    try {
      const res =
        editingItem.kind === "categories"
          ? await updateCategoryServer(serverConfig, editingItem.id, {
              name: cleanName,
            })
          : await updateUnitServer(serverConfig, editingItem.id, {
              name: cleanName,
            });

      if (res.ok) {
        setEditingItem((prev) => (prev ? { ...prev, name: cleanName } : null));
        await refreshAllLists();
        setBanner({
          variant: "success",
          message: `Nama berhasil diperbarui menjadi "${cleanName}".`,
        });
      } else {
        setBanner({
          variant: "error",
          message: res.error ?? "Gagal mengubah nama.",
        });
      }
    } finally {
      setIsSavingRename(false);
    }
  };

  const handleMigrateProducts = async () => {
    if (
      !editingItem ||
      !migrationTargetId ||
      isMigrating ||
      !canWriteOnline ||
      connectedProducts.length === 0
    ) {
      return;
    }

    setIsMigrating(true);
    setBanner(null);
    try {
      const res =
        editingItem.kind === "categories"
          ? await migrateCategoryProductsServer(
              serverConfig,
              editingItem.id,
              migrationTargetId
            )
          : await migrateUnitProductsServer(
              serverConfig,
              editingItem.id,
              migrationTargetId
            );

      if (res.ok) {
        const targetPool =
          editingItem.kind === "categories" ? categories : units;
        const targetName =
          targetPool.find((t) => t.id === migrationTargetId)?.name ??
          "Pengganti";

        setConnectedProducts([]);
        setMigrationTargetId("");
        setEditingItem((prev) => (prev ? { ...prev, productCount: 0 } : null));
        await refreshAllLists();
        setBanner({
          variant: "success",
          message: `Seluruh produk dari "${editingItem.name}" berhasil dipindahkan ke "${targetName}".`,
        });
      } else {
        setBanner({
          variant: "error",
          message: res.error ?? "Gagal memindahkan produk.",
        });
      }
    } finally {
      setIsMigrating(false);
    }
  };

  // 3. Delete Safety Guard
  const handleConfirmDelete = async () => {
    if (
      !deleteCandidate ||
      deleteCandidate.productCount > 0 ||
      isBusy ||
      !canWriteOnline
    ) {
      return;
    }

    setIsBusy(true);
    setBanner(null);
    try {
      const res =
        deleteCandidate.kind === "categories"
          ? await softDeleteCategoryServer(serverConfig, deleteCandidate.id)
          : await softDeleteUnitServer(serverConfig, deleteCandidate.id);

      if (res.ok) {
        const deletedName = deleteCandidate.name;
        const deletedKind =
          deleteCandidate.kind === "categories" ? "Kategori" : "Satuan";
        setDeleteCandidate(null);
        await refreshAllLists();
        setBanner({
          variant: "success",
          message: `${deletedKind} "${deletedName}" berhasil dipindahkan ke Tong Sampah.`,
        });
      } else {
        setBanner({
          variant: "error",
          message: res.error ?? "Gagal menghapus data.",
        });
      }
    } finally {
      setIsBusy(false);
    }
  };

  // 4. Dedicated Trash Operations
  const handleOpenTrashModal = (kind: ActiveTab) => {
    setTrashSearchQuery("");
    setConfirmPurgeId(null);
    setConfirmEmptyAll(false);
    setTrashModalKind(kind);
  };

  const handleRestoreTrashItem = async (kind: ActiveTab, id: string) => {
    if (trashProcessingId || isEmptyingTrash || !canWriteOnline) {
      return;
    }
    setTrashProcessingId(id);
    setBanner(null);
    try {
      const res =
        kind === "categories"
          ? await restoreTrashedCategoryServer(serverConfig, id)
          : await restoreTrashedUnitServer(serverConfig, id);

      if (res.ok) {
        await refreshAllLists();
        setBanner({
          variant: "success",
          message: `${
            kind === "categories" ? "Kategori" : "Satuan"
          } berhasil dipulihkan.`,
        });
      } else {
        setBanner({
          variant: "error",
          message: res.error ?? "Gagal memulihkan data.",
        });
      }
    } finally {
      setTrashProcessingId(null);
    }
  };

  const handlePermanentDeleteTrashItem = async (
    kind: ActiveTab,
    id: string
  ) => {
    if (trashProcessingId || isEmptyingTrash || !canWriteOnline) {
      return;
    }
    setTrashProcessingId(id);
    setBanner(null);
    try {
      const res =
        kind === "categories"
          ? await purgeTrashedCategoryServer(serverConfig, { id })
          : await purgeTrashedUnitServer(serverConfig, { id });

      if (res.ok) {
        setConfirmPurgeId(null);
        await refreshAllLists();
        setBanner({
          variant: "success",
          message: "Data dihapus secara permanen.",
        });
      } else {
        setBanner({
          variant: "error",
          message: res.error ?? "Gagal menghapus permanen.",
        });
      }
    } finally {
      setTrashProcessingId(null);
    }
  };

  const handleEmptyTrashForKind = async (kind: ActiveTab) => {
    if (trashProcessingId || isEmptyingTrash || !canWriteOnline) {
      return;
    }
    setIsEmptyingTrash(true);
    setBanner(null);
    try {
      const res =
        kind === "categories"
          ? await purgeTrashedCategoryServer(serverConfig, { emptyAll: true })
          : await purgeTrashedUnitServer(serverConfig, { emptyAll: true });

      if (res.ok) {
        setConfirmEmptyAll(false);
        await refreshAllLists();
        setBanner({
          variant: "success",
          message: `Tong sampah ${
            kind === "categories" ? "kategori" : "satuan"
          } berhasil dikosongkan.`,
        });
      } else {
        setBanner({
          variant: "error",
          message: res.error ?? "Gagal mengosongkan tong sampah.",
        });
      }
    } finally {
      setIsEmptyingTrash(false);
    }
  };

  const migrationTargets = useMemo(() => {
    if (!editingItem) {
      return [];
    }
    const pool = editingItem.kind === "categories" ? categories : units;
    const q = migrationSearchQuery.trim().toLowerCase();
    return pool.filter(
      (item) =>
        item.id !== editingItem.id &&
        (q.length === 0 || item.name.toLowerCase().includes(q))
    );
  }, [categories, editingItem, migrationSearchQuery, units]);

  const filteredConnectedProducts = useMemo(() => {
    const q = productFilterQuery.trim().toLowerCase();
    if (!q) {
      return connectedProducts;
    }
    return connectedProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  }, [connectedProducts, productFilterQuery]);

  const activeTrashItems = useMemo(() => {
    const list =
      trashModalKind === "units" ? trashedUnits : trashedCategories;
    const q = trashSearchQuery.trim().toLowerCase();
    if (!q) {
      return list;
    }
    return list.filter((item) => item.name.toLowerCase().includes(q));
  }, [trashModalKind, trashSearchQuery, trashedCategories, trashedUnits]);

  const renderMasterSection = (kind: ActiveTab) => {
    const isCat = kind === "categories";
    const items = isCat ? filteredCategories : filteredUnits;
    const totalCount = isCat ? categories.length : units.length;
    const trashCount = isCat ? trashedCategories.length : trashedUnits.length;
    const entityLabel = isCat ? "Kategori" : "Satuan";

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {banner ? (
          <FeedbackBanner
            testID={
              activeTab === kind
                ? "cat-unit-feedback"
                : `cat-unit-feedback-${kind}`
            }
            variant={banner.variant}
            message={banner.message}
          />
        ) : null}

        {/* Search Input + Dedicated Add & Trash Action Row */}
        <SurfaceCard style={styles.toolbarCard}>
          <View style={styles.searchBox}>
            <Search size={18} color={TOKENS.colors.onSurfaceVariant} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={`Cari nama ${entityLabel.toLowerCase()}...`}
              placeholderTextColor={TOKENS.colors.onSurfaceVariant}
              style={styles.searchInput}
            />
            {searchQuery.length > 0 ? (
              <Pressable
                onPress={() => setSearchQuery("")}
                style={styles.clearSearchBtn}
              >
                <X size={16} color={TOKENS.colors.onSurfaceVariant} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.toolbarActionsRow}>
            <Pressable
              testID={
                activeTab === kind
                  ? "cat-unit-add-button"
                  : `cat-unit-add-button-${kind}`
              }
              accessibilityRole="button"
              disabled={!canWriteOnline}
              onPress={() => handleOpenAddModal(kind)}
              style={({ pressed }) => [
                styles.primaryToolbarBtn,
                !canWriteOnline && styles.disabledBtn,
                pressed && canWriteOnline && styles.pressed,
              ]}
            >
              <Plus size={18} color={TOKENS.colors.onPrimary} />
              <Text style={styles.primaryToolbarBtnText}>
                {`Tambah ${entityLabel}`}
              </Text>
            </Pressable>

            <Pressable
              testID={
                activeTab === kind
                  ? "cat-unit-trash-button"
                  : `cat-unit-trash-button-${kind}`
              }
              accessibilityRole="button"
              onPress={() => handleOpenTrashModal(kind)}
              style={({ pressed }) => [
                styles.trashToolbarBtn,
                pressed && styles.pressed,
              ]}
            >
              <Trash2 size={17} color={TOKENS.colors.onSurfaceVariant} />
              <Text style={styles.trashToolbarBtnText}>
                {trashCount > 0
                  ? `Tong Sampah (${trashCount})`
                  : "Tong Sampah"}
              </Text>
            </Pressable>
          </View>
        </SurfaceCard>

        {/* Item List */}
        {items.length === 0 ? (
          <EmptyStateCard
            icon={
              isCat ? (
                <Tags size={24} color={TOKENS.colors.primary} />
              ) : (
                <Ruler size={24} color={TOKENS.colors.primary} />
              )
            }
            title={
              isLoading
                ? `Memuat ${entityLabel}...`
                : totalCount === 0
                  ? `Belum Ada ${entityLabel} Aktif`
                  : `${entityLabel} Tidak Ditemukan`
            }
            description={
              totalCount === 0
                ? isCat
                  ? "Tambahkan kategori barang untuk memudahkan pencarian di kasir."
                  : "Tambahkan satuan seperti Pcs, Pack, Lusin, atau Karton."
                : `Tidak ada ${entityLabel.toLowerCase()} yang cocok dengan kata kunci "${searchQuery}".`
            }
          />
        ) : (
          items.map((item, idx) => {
            const count = item.productCount ?? 0;
            const hasProducts = count > 0;

            return (
              <SurfaceCard key={item.id} style={styles.itemCard}>
                <View style={styles.itemTopRow}>
                  <View style={styles.indexCircle}>
                    <Text style={styles.indexCircleText}>{idx + 1}</Text>
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle}>{item.name}</Text>
                    <View style={styles.badgeRow}>
                      <View
                        style={[
                          styles.usageBadge,
                          hasProducts
                            ? styles.usageBadgeActive
                            : styles.usageBadgeEmpty,
                        ]}
                      >
                        <Package
                          size={12}
                          color={
                            hasProducts
                              ? TOKENS.colors.primary
                              : TOKENS.colors.onSurfaceVariant
                          }
                        />
                        <Text
                          style={[
                            styles.usageBadgeText,
                            hasProducts
                              ? styles.usageBadgeTextActive
                              : styles.usageBadgeTextEmpty,
                          ]}
                        >
                          {hasProducts
                            ? `${count} Produk`
                            : "0 Produk (Kosong)"}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.safetyBadge,
                          hasProducts
                            ? styles.safetyBadgeLocked
                            : styles.safetyBadgeReady,
                        ]}
                      >
                        <Text
                          style={[
                            styles.safetyBadgeText,
                            hasProducts
                              ? styles.safetyBadgeTextLocked
                              : styles.safetyBadgeTextReady,
                          ]}
                        >
                          {hasProducts ? "Wajib Pindah Dulu" : "Siap Dihapus"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.rowActions}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={!canWriteOnline || isBusy}
                      onPress={() => {
                        void handleOpenEditModal(kind, item);
                      }}
                      style={[
                        styles.iconActionBtn,
                        (!canWriteOnline || isBusy) && styles.disabledBtn,
                      ]}
                    >
                      <Pencil size={17} color={TOKENS.colors.primary} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      disabled={!canWriteOnline || isBusy}
                      onPress={() =>
                        setDeleteCandidate({
                          kind,
                          id: item.id,
                          name: item.name,
                          productCount: count,
                        })
                      }
                      style={[
                        styles.iconDeleteBtn,
                        (!canWriteOnline || isBusy) && styles.disabledBtn,
                      ]}
                    >
                      <Trash2 size={17} color={TOKENS.colors.destructive} />
                    </Pressable>
                  </View>
                </View>
              </SurfaceCard>
            );
          })
        )}
      </ScrollView>
    );
  };

  return (
    <View style={styles.screen}>
      {/* Top Bar without + icon */}
      <SafeAreaView edges={["top"]} style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <ChevronLeft size={22} color={TOKENS.colors.onSurface} />
        </Pressable>
        <Text style={styles.topTitle}>Kategori &amp; Satuan</Text>
      </SafeAreaView>

      {/* Animated Sliding Segmented Bar */}
      <View style={styles.segmentsOuter}>
        <View
          style={styles.segmentsTrack}
          onLayout={(e) => setSegmentBarWidth(e.nativeEvent.layout.width)}
        >
          {pillWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.segmentSlidingPill,
                {
                  width: pillWidth,
                  transform: [{ translateX: indicatorTranslateX }],
                },
              ]}
            />
          ) : null}

          <Pressable
            testID="cat-unit-tab-categories"
            accessibilityRole="button"
            onPress={() => setActiveTab("categories")}
            style={[
              styles.segBtn,
              pillWidth === 0 &&
                activeTab === "categories" &&
                styles.segBtnFallbackActive,
            ]}
          >
            <FolderOpen
              size={16}
              color={
                activeTab === "categories"
                  ? TOKENS.colors.onPrimary
                  : TOKENS.colors.onSurfaceVariant
              }
            />
            <Text
              style={[
                styles.segText,
                activeTab === "categories" && styles.segTextActive,
              ]}
            >
              {`Kategori (${categories.length})`}
            </Text>
          </Pressable>

          <Pressable
            testID="cat-unit-tab-units"
            accessibilityRole="button"
            onPress={() => setActiveTab("units")}
            style={[
              styles.segBtn,
              pillWidth === 0 &&
                activeTab === "units" &&
                styles.segBtnFallbackActive,
            ]}
          >
            <Ruler
              size={16}
              color={
                activeTab === "units"
                  ? TOKENS.colors.onPrimary
                  : TOKENS.colors.onSurfaceVariant
              }
            />
            <Text
              style={[
                styles.segText,
                activeTab === "units" && styles.segTextActive,
              ]}
            >
              {`Satuan (${units.length})`}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Animated Horizontal Page Slider */}
      <View
        style={styles.pagesViewport}
        onLayout={(e) => setViewportWidth(e.nativeEvent.layout.width)}
      >
        <Animated.View
          style={[
            styles.pagesSliderTrack,
            viewportWidth > 0
              ? {
                  width: viewportWidth * 2,
                  transform: [{ translateX: pagesTranslateX }],
                }
              : styles.flexOne,
          ]}
        >
          <View
            style={
              viewportWidth > 0 ? { width: viewportWidth } : styles.flexOne
            }
          >
            {renderMasterSection("categories")}
          </View>
          <View
            style={
              viewportWidth > 0 ? { width: viewportWidth } : styles.flexOne
            }
          >
            {renderMasterSection("units")}
          </View>
        </Animated.View>
      </View>

      {/* MODAL 1: Tambah Kategori / Satuan Baru */}
      <Modal
        visible={addModalKind !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setAddModalKind(null)}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {addModalKind === "units"
                ? "Tambah Satuan Baru"
                : "Tambah Kategori Baru"}
            </Text>
            <InputField
              testID="cat-unit-form-name"
              label={
                addModalKind === "units" ? "Nama Satuan" : "Nama Kategori"
              }
              placeholder={
                addModalKind === "units"
                  ? "Contoh: Pcs, Karton, Lusin..."
                  : "Contoh: Sembako, Minuman..."
              }
              value={newName}
              onChangeText={(val) => setNewName(toTitleCase(val))}
            />

            <View style={styles.modalActionsRow}>
              <SecondaryButton
                variant="tonal"
                label="Batal"
                disabled={isBusy}
                onPress={() => setAddModalKind(null)}
                style={styles.flexOne}
              />
              <PrimaryButton
                testID="cat-unit-form-save"
                label="Simpan"
                loading={isBusy}
                onPress={() => {
                  void handleCreateItem();
                }}
                style={styles.flexOne}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: Panel Kelola (Ubah Nama & Migrasi Produk) */}
      <Modal
        visible={editingItem !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setEditingItem(null)}
      >
        <View style={styles.backdrop}>
          <View style={styles.largeModalCard}>
            <View style={styles.largeModalHeader}>
              <View style={styles.flexOne}>
                <Text style={styles.largeModalOverline}>
                  {editingItem?.kind === "units"
                    ? "PANEL KELOLA SATUAN"
                    : "PANEL KELOLA KATEGORI"}
                </Text>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {editingItem?.name ?? ""}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setEditingItem(null)}
                style={styles.closeIconBtn}
              >
                <X size={20} color={TOKENS.colors.onSurfaceVariant} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.largeModalScroll}
              keyboardShouldPersistTaps="handled"
            >
              {/* Rename Section */}
              <View style={styles.panelSection}>
                <Text style={styles.panelSectionLabel}>
                  {editingItem?.kind === "units"
                    ? "Ubah Nama Satuan"
                    : "Ubah Nama Kategori"}
                </Text>
                <InputField
                  label="Nama Baru"
                  value={editNameValue}
                  onChangeText={(val) => setEditNameValue(toTitleCase(val))}
                />
                <PrimaryButton
                  label="Simpan Nama"
                  loading={isSavingRename}
                  disabled={
                    isSavingRename ||
                    !editNameValue.trim() ||
                    editNameValue.trim() === editingItem?.name
                  }
                  onPress={() => {
                    void handleSaveRename();
                  }}
                />
              </View>

              {/* Migration Section */}
              <View style={styles.panelSection}>
                <View style={styles.migrationHeaderRow}>
                  <ArrowRightLeft size={16} color={TOKENS.colors.primary} />
                  <Text style={styles.panelSectionLabel}>
                    {`Pindahkan Produk ke ${
                      editingItem?.kind === "units" ? "Satuan" : "Kategori"
                    } Pengganti`}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusInfoBox,
                    connectedProducts.length > 0
                      ? styles.statusInfoBoxAmber
                      : styles.statusInfoBoxGreen,
                  ]}
                >
                  {connectedProducts.length > 0 ? (
                    <AlertTriangle size={18} color={TOKENS.colors.warningText} />
                  ) : (
                    <CheckCircle2 size={18} color={TOKENS.colors.successText} />
                  )}
                  <View style={styles.flexOne}>
                    <Text
                      style={[
                        styles.statusInfoTitle,
                        connectedProducts.length > 0
                          ? styles.statusInfoTitleAmber
                          : styles.statusInfoTitleGreen,
                      ]}
                    >
                      {connectedProducts.length > 0
                        ? `${connectedProducts.length} Produk Masih Terhubung`
                        : "Bebas Konflik (0 Produk)"}
                    </Text>
                    <Text style={styles.statusInfoDesc}>
                      {connectedProducts.length > 0
                        ? `Pilih ${
                            editingItem?.kind === "units"
                              ? "satuan"
                              : "kategori"
                          } pengganti di bawah untuk memindahkan seluruh produk sekaligus.`
                        : "Item ini sudah kosong dan aman dihapus kapan saja."}
                    </Text>
                  </View>
                </View>

                {connectedProducts.length > 0 ? (
                  <>
                    <View style={styles.searchBox}>
                      <Search
                        size={16}
                        color={TOKENS.colors.onSurfaceVariant}
                      />
                      <TextInput
                        value={migrationSearchQuery}
                        onChangeText={setMigrationSearchQuery}
                        placeholder={`Cari ${
                          editingItem?.kind === "units" ? "satuan" : "kategori"
                        } pengganti...`}
                        placeholderTextColor={TOKENS.colors.onSurfaceVariant}
                        style={styles.searchInput}
                      />
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.migrateChips}
                    >
                      {migrationTargets.map((target) => {
                        const selected = migrationTargetId === target.id;
                        return (
                          <Pressable
                            key={target.id}
                            onPress={() => setMigrationTargetId(target.id)}
                            style={[
                              styles.migrateChip,
                              selected && styles.migrateChipActive,
                            ]}
                          >
                            {selected ? (
                              <Check
                                size={14}
                                color={TOKENS.colors.onPrimary}
                              />
                            ) : null}
                            <Text
                              style={[
                                styles.migrateChipText,
                                selected && styles.migrateChipTextActive,
                              ]}
                            >
                              {target.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>

                    <PrimaryButton
                      label="Pindahkan Seluruh Produk"
                      loading={isMigrating}
                      disabled={!migrationTargetId || isMigrating}
                      onPress={() => {
                        void handleMigrateProducts();
                      }}
                    />
                  </>
                ) : null}
              </View>

              {/* Connected Active Products Section */}
              <View style={styles.panelSection}>
                <View style={styles.productsHeaderRow}>
                  <Text style={styles.panelSectionLabel}>
                    Daftar Produk Aktif Terhubung
                  </Text>
                  <View style={styles.countPill}>
                    <Text style={styles.countPillText}>
                      {`${connectedProducts.length} Produk`}
                    </Text>
                  </View>
                </View>

                {connectedProducts.length > 0 ? (
                  <View style={styles.searchBox}>
                    <Search size={16} color={TOKENS.colors.onSurfaceVariant} />
                    <TextInput
                      value={productFilterQuery}
                      onChangeText={setProductFilterQuery}
                      placeholder="Filter nama atau SKU produk..."
                      placeholderTextColor={TOKENS.colors.onSurfaceVariant}
                      style={styles.searchInput}
                    />
                  </View>
                ) : null}

                {isLoadingDetail ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator color={TOKENS.colors.primary} />
                    <Text style={styles.loadingText}>
                      Memuat daftar produk terhubung...
                    </Text>
                  </View>
                ) : filteredConnectedProducts.length === 0 ? (
                  <Text style={styles.emptyProductsText}>
                    {connectedProducts.length === 0
                      ? "Tidak ada produk aktif yang menggunakan item ini."
                      : "Tidak ada produk yang cocok dengan filter."}
                  </Text>
                ) : (
                  filteredConnectedProducts.map((prod) => (
                    <View key={prod.id} style={styles.connectedProductRow}>
                      <View style={styles.flexOne}>
                        <Text style={styles.connectedProductName}>
                          {prod.name}
                        </Text>
                        <Text style={styles.connectedProductSku}>
                          {`SKU: ${prod.sku || "-"}`}
                        </Text>
                      </View>
                      <Text style={styles.connectedProductPrice}>
                        {formatRupiah(prod.sellingPrice ?? 0)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>

            <View style={styles.largeModalFooter}>
              <SecondaryButton
                variant="tonal"
                label="Tutup Panel"
                onPress={() => setEditingItem(null)}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: Safety Guard Delete Confirmation */}
      <Modal
        visible={deleteCandidate !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setDeleteCandidate(null)}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <View style={styles.safetyHeaderRow}>
              <View
                style={[
                  styles.safetyIconCircle,
                  (deleteCandidate?.productCount ?? 0) > 0
                    ? styles.safetyIconLocked
                    : styles.safetyIconDelete,
                ]}
              >
                {(deleteCandidate?.productCount ?? 0) > 0 ? (
                  <Lock size={20} color={TOKENS.colors.warning} />
                ) : (
                  <Trash2 size={20} color={TOKENS.colors.destructive} />
                )}
              </View>
              <View style={styles.flexOne}>
                <Text style={styles.modalTitle}>
                  {(deleteCandidate?.productCount ?? 0) > 0
                    ? `${
                        deleteCandidate?.kind === "units"
                          ? "Satuan"
                          : "Kategori"
                      } Terkunci`
                    : `Hapus ${
                        deleteCandidate?.kind === "units"
                          ? "Satuan"
                          : "Kategori"
                      }?`}
                </Text>
                <Text style={styles.itemMeta} numberOfLines={1}>
                  {deleteCandidate?.name ?? ""}
                </Text>
              </View>
            </View>

            {(deleteCandidate?.productCount ?? 0) > 0 ? (
              <>
                <View style={[styles.statusInfoBox, styles.statusInfoBoxAmber]}>
                  <AlertTriangle size={18} color={TOKENS.colors.warning} />
                  <View style={styles.flexOne}>
                    <Text
                      style={[
                        styles.statusInfoTitle,
                        styles.statusInfoTitleAmber,
                      ]}
                    >
                      {`Masih Digunakan oleh ${deleteCandidate?.productCount} Produk`}
                    </Text>
                    <Text style={styles.statusInfoDesc}>
                      Pindahkan seluruh produk tersebut ke pengganti terlebih
                      dahulu sebelum menghapus item ini.
                    </Text>
                  </View>
                </View>

                <View style={styles.modalActionsRow}>
                  <SecondaryButton
                    variant="tonal"
                    label="Batal"
                    onPress={() => setDeleteCandidate(null)}
                    style={styles.flexOne}
                  />
                  <PrimaryButton
                    label="Kelola & Pindah"
                    onPress={() => {
                      const candidate = deleteCandidate;
                      setDeleteCandidate(null);
                      if (candidate) {
                        void handleOpenEditModal(candidate.kind, candidate);
                      }
                    }}
                    style={styles.flexOne}
                  />
                </View>
              </>
            ) : (
              <>
                <View style={[styles.statusInfoBox, styles.statusInfoBoxGreen]}>
                  <CheckCircle2 size={18} color={TOKENS.colors.successText} />
                  <View style={styles.flexOne}>
                    <Text
                      style={[
                        styles.statusInfoTitle,
                        styles.statusInfoTitleGreen,
                      ]}
                    >
                      Aman Dihapus (0 Produk Terhubung)
                    </Text>
                    <Text style={styles.statusInfoDesc}>
                      {`"${deleteCandidate?.name}" akan dipindahkan ke Tong Sampah selama 30 hari dan dapat dipulihkan kapan saja.`}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalActionsRow}>
                  <SecondaryButton
                    variant="tonal"
                    label="Batal"
                    disabled={isBusy}
                    onPress={() => setDeleteCandidate(null)}
                    style={styles.flexOne}
                  />
                  <SecondaryButton
                    variant="danger"
                    label="Hapus"
                    loading={isBusy}
                    onPress={() => {
                      void handleConfirmDelete();
                    }}
                    style={styles.flexOne}
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL 4: Dedicated Tong Sampah (Kategori atau Satuan Masing-Masing) */}
      <Modal
        visible={trashModalKind !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setTrashModalKind(null)}
      >
        <View style={styles.backdrop}>
          <View style={styles.largeModalCard}>
            <View style={styles.largeModalHeader}>
              <View style={styles.flexOne}>
                <Text style={styles.largeModalOverline}>
                  RETENSI 30 HARI SEBELUM TERHAPUS OTOMATIS
                </Text>
                <Text style={styles.modalTitle}>
                  {trashModalKind === "units"
                    ? "Tong Sampah Satuan"
                    : "Tong Sampah Kategori"}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setTrashModalKind(null)}
                style={styles.closeIconBtn}
              >
                <X size={20} color={TOKENS.colors.onSurfaceVariant} />
              </Pressable>
            </View>

            <View style={styles.trashTopControls}>
              <View style={styles.searchBox}>
                <Search size={16} color={TOKENS.colors.onSurfaceVariant} />
                <TextInput
                  value={trashSearchQuery}
                  onChangeText={setTrashSearchQuery}
                  placeholder={`Cari ${
                    trashModalKind === "units" ? "satuan" : "kategori"
                  } terhapus...`}
                  placeholderTextColor={TOKENS.colors.onSurfaceVariant}
                  style={styles.searchInput}
                />
              </View>

              {(trashModalKind === "units"
                ? trashedUnits.length
                : trashedCategories.length) > 0 ? (
                confirmEmptyAll ? (
                  <View style={styles.emptyAllConfirmBox}>
                    <Text style={styles.emptyAllConfirmText}>
                      Kosongkan seluruh tong sampah ini secara permanen?
                    </Text>
                    <View style={styles.modalActionsRow}>
                      <SecondaryButton
                        variant="tonal"
                        label="Batal"
                        disabled={isEmptyingTrash}
                        onPress={() => setConfirmEmptyAll(false)}
                        style={styles.flexOne}
                      />
                      <SecondaryButton
                        variant="danger"
                        label="Ya, Kosongkan"
                        loading={isEmptyingTrash}
                        onPress={() => {
                          if (trashModalKind) {
                            void handleEmptyTrashForKind(trashModalKind);
                          }
                        }}
                        style={styles.flexOne}
                      />
                    </View>
                  </View>
                ) : (
                  <SecondaryButton
                    variant="danger-outline"
                    label="Kosongkan Sampah"
                    disabled={!canWriteOnline || isEmptyingTrash}
                    icon={
                      <Trash2 size={15} color={TOKENS.colors.destructive} />
                    }
                    onPress={() => {
                      setConfirmPurgeId(null);
                      setConfirmEmptyAll(true);
                    }}
                  />
                )
              ) : null}
            </View>

            <ScrollView contentContainerStyle={styles.largeModalScroll}>
              {activeTrashItems.length === 0 ? (
                <EmptyStateCard
                  icon={<Trash2 size={24} color={TOKENS.colors.primary} />}
                  title="Tong Sampah Kosong"
                  description={`Tidak ada ${
                    trashModalKind === "units" ? "satuan" : "kategori"
                  } di dalam tong sampah.`}
                />
              ) : (
                activeTrashItems.map((item) => {
                  const isConfirming = confirmPurgeId === item.id;
                  const isItemBusy = trashProcessingId === item.id;

                  return (
                    <SurfaceCard key={item.id} style={styles.trashItemCard}>
                      <View style={styles.trashItemHeader}>
                        <Text style={styles.itemTitle}>{item.name}</Text>
                        <View style={styles.daysLeftBadge}>
                          <Clock size={11} color={TOKENS.colors.warning} />
                          <Text style={styles.daysLeftText}>
                            {`${item.daysLeft ?? 30} hari tersisa`}
                          </Text>
                        </View>
                      </View>

                      {isConfirming ? (
                        <View style={styles.inlineConfirmRow}>
                          <SecondaryButton
                            variant="tonal"
                            label="Batal"
                            disabled={isItemBusy}
                            onPress={() => setConfirmPurgeId(null)}
                            style={styles.flexOne}
                          />
                          <SecondaryButton
                            variant="danger"
                            label="Ya, Hapus"
                            loading={isItemBusy}
                            onPress={() => {
                              if (trashModalKind) {
                                void handlePermanentDeleteTrashItem(
                                  trashModalKind,
                                  item.id
                                );
                              }
                            }}
                            style={styles.flexOne}
                          />
                        </View>
                      ) : (
                        <View style={styles.inlineConfirmRow}>
                          <SecondaryButton
                            variant="tonal"
                            label="Pulihkan"
                            disabled={!canWriteOnline || isItemBusy}
                            loading={isItemBusy}
                            icon={
                              <ArchiveRestore
                                size={15}
                                color={TOKENS.colors.onPrimaryFixed}
                              />
                            }
                            onPress={() => {
                              if (trashModalKind) {
                                void handleRestoreTrashItem(
                                  trashModalKind,
                                  item.id
                                );
                              }
                            }}
                            style={styles.flexOne}
                          />
                          <SecondaryButton
                            variant="danger-outline"
                            label="Hapus Permanen"
                            disabled={!canWriteOnline || isItemBusy}
                            onPress={() => {
                              setConfirmEmptyAll(false);
                              setConfirmPurgeId(item.id);
                            }}
                            style={styles.flexOne}
                          />
                        </View>
                      )}
                    </SurfaceCard>
                  );
                })
              )}
            </ScrollView>

            <View style={styles.largeModalFooter}>
              <SecondaryButton
                variant="tonal"
                label="Tutup"
                onPress={() => setTrashModalKind(null)}
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
  topBar: {
    backgroundColor: TOKENS.colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.colors.borderSubtle,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: TOKENS.spacing.sm,
    paddingBottom: TOKENS.spacing.sm,
    gap: TOKENS.spacing.sm,
  },
  backBtn: {
    width: TOKENS.spacing.touchTarget,
    height: TOKENS.spacing.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    flex: 1,
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.heading,
    lineHeight: TOKENS.lineHeight.heading,
    color: TOKENS.colors.onSurface,
  },
  segmentsOuter: {
    paddingHorizontal: TOKENS.spacing.md,
    paddingVertical: TOKENS.spacing.sm,
    backgroundColor: TOKENS.colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.colors.borderSubtle,
  },
  segmentsTrack: {
    position: "relative",
    flexDirection: "row",
    backgroundColor: TOKENS.colors.surfaceContainer,
    borderRadius: TOKENS.radii.md,
    padding: 4,
  },
  segmentSlidingPill: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.primary,
  },
  segBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: TOKENS.radii.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: TOKENS.spacing.xs,
    zIndex: 1,
  },
  segBtnFallbackActive: {
    backgroundColor: TOKENS.colors.primary,
  },
  segText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  segTextActive: {
    color: TOKENS.colors.onPrimary,
  },
  pagesViewport: {
    flex: 1,
    overflow: "hidden",
  },
  pagesSliderTrack: {
    flex: 1,
    flexDirection: "row",
  },
  scrollContent: {
    padding: TOKENS.spacing.md,
    gap: TOKENS.spacing.sm,
  },
  toolbarCard: {
    gap: TOKENS.spacing.sm,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.xs,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderRadius: TOKENS.radii.sm,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    paddingHorizontal: TOKENS.spacing.sm,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.body,
    color: TOKENS.colors.onSurface,
    paddingVertical: 8,
  },
  clearSearchBtn: {
    padding: 4,
  },
  toolbarActionsRow: {
    flexDirection: "row",
    gap: TOKENS.spacing.sm,
  },
  primaryToolbarBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: TOKENS.spacing.sm,
  },
  primaryToolbarBtnText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    color: TOKENS.colors.onPrimary,
  },
  trashToolbarBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.surfaceContainer,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: TOKENS.spacing.sm,
  },
  trashToolbarBtnText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    color: TOKENS.colors.onSurface,
  },
  disabledBtn: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
  },
  itemCard: {
    paddingVertical: TOKENS.spacing.sm,
    paddingHorizontal: TOKENS.spacing.md,
  },
  itemTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.sm,
  },
  indexCircle: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: TOKENS.colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  indexCircleText: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 12,
    color: TOKENS.colors.onSurfaceVariant,
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  itemTitle: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.body,
    color: TOKENS.colors.onSurface,
  },
  itemMeta: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 12,
    color: TOKENS.colors.onSurfaceVariant,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  usageBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  usageBadgeActive: {
    backgroundColor: TOKENS.colors.primaryFixed,
  },
  usageBadgeEmpty: {
    backgroundColor: TOKENS.colors.surfaceContainer,
  },
  usageBadgeText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 11,
  },
  usageBadgeTextActive: {
    color: TOKENS.colors.primary,
  },
  usageBadgeTextEmpty: {
    color: TOKENS.colors.onSurfaceVariant,
  },
  safetyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  safetyBadgeLocked: {
    backgroundColor: TOKENS.colors.warningBg,
  },
  safetyBadgeReady: {
    backgroundColor: TOKENS.colors.successBg,
  },
  safetyBadgeText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 10,
  },
  safetyBadgeTextLocked: {
    color: TOKENS.colors.warningText,
  },
  safetyBadgeTextReady: {
    color: TOKENS.colors.successText,
  },
  rowActions: {
    flexDirection: "row",
    gap: TOKENS.spacing.xs,
  },
  iconActionBtn: {
    width: 40,
    height: 40,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.primaryFixed,
    alignItems: "center",
    justifyContent: "center",
  },
  iconDeleteBtn: {
    width: 40,
    height: 40,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.errorContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    flex: 1,
    backgroundColor: TOKENS.colors.modalBackdrop,
    justifyContent: "center",
    padding: TOKENS.spacing.lg,
  },
  modalCard: {
    backgroundColor: TOKENS.colors.surfaceCard,
    borderRadius: TOKENS.radii.lg,
    padding: TOKENS.spacing.lg,
    gap: TOKENS.spacing.sm,
  },
  largeModalCard: {
    backgroundColor: TOKENS.colors.surfaceCard,
    borderRadius: TOKENS.radii.lg,
    maxHeight: "88%",
    overflow: "hidden",
  },
  largeModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: TOKENS.spacing.lg,
    paddingVertical: TOKENS.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.colors.borderSubtle,
    gap: TOKENS.spacing.sm,
  },
  largeModalOverline: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.6,
    color: TOKENS.colors.primary,
  },
  closeIconBtn: {
    width: 36,
    height: 36,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  largeModalScroll: {
    padding: TOKENS.spacing.md,
    gap: TOKENS.spacing.md,
  },
  largeModalFooter: {
    padding: TOKENS.spacing.md,
    borderTopWidth: 1,
    borderTopColor: TOKENS.colors.borderSubtle,
  },
  modalTitle: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.heading,
    color: TOKENS.colors.onSurface,
  },
  modalActionsRow: {
    flexDirection: "row",
    gap: TOKENS.spacing.sm,
    marginTop: TOKENS.spacing.xs,
  },
  panelSection: {
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderRadius: TOKENS.radii.md,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    padding: TOKENS.spacing.md,
    gap: TOKENS.spacing.sm,
  },
  panelSectionLabel: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    color: TOKENS.colors.onSurface,
  },
  migrationHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusInfoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: TOKENS.spacing.sm,
    padding: TOKENS.spacing.sm,
    borderRadius: TOKENS.radii.sm,
  },
  statusInfoBoxAmber: {
    backgroundColor: TOKENS.colors.warningBg,
  },
  statusInfoBoxGreen: {
    backgroundColor: TOKENS.colors.successBg,
  },
  statusInfoTitle: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
  },
  statusInfoTitleAmber: {
    color: TOKENS.colors.warningText,
  },
  statusInfoTitleGreen: {
    color: TOKENS.colors.successText,
  },
  statusInfoDesc: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 12,
    color: TOKENS.colors.onSurfaceVariant,
    marginTop: 2,
  },
  migrateChips: {
    gap: TOKENS.spacing.xs,
    paddingVertical: 2,
  },
  migrateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: TOKENS.spacing.sm,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: TOKENS.colors.surfaceContainer,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
  },
  migrateChipActive: {
    backgroundColor: TOKENS.colors.primary,
    borderColor: TOKENS.colors.primary,
  },
  migrateChipText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 12,
    color: TOKENS.colors.onSurfaceVariant,
  },
  migrateChipTextActive: {
    color: TOKENS.colors.onPrimary,
  },
  productsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  countPill: {
    backgroundColor: TOKENS.colors.primaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  countPillText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 11,
    color: TOKENS.colors.primary,
  },
  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.sm,
    paddingVertical: TOKENS.spacing.sm,
  },
  loadingText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 12,
    color: TOKENS.colors.onSurfaceVariant,
  },
  emptyProductsText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 12,
    color: TOKENS.colors.onSurfaceVariant,
    paddingVertical: TOKENS.spacing.xs,
  },
  connectedProductRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: TOKENS.colors.surfaceCard,
    borderRadius: TOKENS.radii.sm,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    paddingHorizontal: TOKENS.spacing.sm,
    paddingVertical: 8,
    gap: TOKENS.spacing.sm,
  },
  connectedProductName: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    color: TOKENS.colors.onSurface,
  },
  connectedProductSku: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 11,
    color: TOKENS.colors.onSurfaceVariant,
  },
  connectedProductPrice: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: 12,
    color: TOKENS.colors.primary,
  },
  safetyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.sm,
  },
  safetyIconCircle: {
    width: 42,
    height: 42,
    borderRadius: TOKENS.radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  safetyIconLocked: {
    backgroundColor: TOKENS.colors.warningBg,
  },
  safetyIconDelete: {
    backgroundColor: TOKENS.colors.errorContainer,
  },
  trashTopControls: {
    paddingHorizontal: TOKENS.spacing.md,
    paddingTop: TOKENS.spacing.sm,
    gap: TOKENS.spacing.sm,
  },
  emptyAllConfirmBox: {
    backgroundColor: TOKENS.colors.errorContainer,
    borderRadius: TOKENS.radii.sm,
    padding: TOKENS.spacing.sm,
    gap: TOKENS.spacing.xs,
  },
  emptyAllConfirmText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 12,
    color: TOKENS.colors.destructive,
  },
  trashItemCard: {
    gap: TOKENS.spacing.sm,
  },
  trashItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: TOKENS.spacing.sm,
  },
  daysLeftBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: TOKENS.colors.warningBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  daysLeftText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 11,
    color: TOKENS.colors.warningText,
  },
  inlineConfirmRow: {
    flexDirection: "row",
    gap: TOKENS.spacing.sm,
  },
  flexOne: {
    flex: 1,
  },
});
