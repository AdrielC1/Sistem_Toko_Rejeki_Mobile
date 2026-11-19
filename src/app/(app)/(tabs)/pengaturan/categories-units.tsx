import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArchiveRestore,
  ChevronLeft,
  FolderInput,
  Pencil,
  Plus,
  Tags,
  Trash2,
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
} from "@/services/api/categoriesUnitsApi";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";
import type { Category, Unit } from "@/types";

type ActiveSection = "categories" | "units" | "trash";

export default function PengaturanCategoriesUnitsScreen() {
  const router = useRouter();
  const { serverConfig } = useAuth();
  const { healthState, isDeviceConnected, dbOnline } = useSystemStatus();

  const [section, setSection] = useState<ActiveSection>("categories");
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [trashedCategories, setTrashedCategories] = useState<Category[]>([]);
  const [trashedUnits, setTrashedUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [banner, setBanner] = useState<{
    variant: "success" | "error";
    message: string;
  } | null>(null);

  // Add/Edit modal
  const [editorState, setEditorState] = useState<{
    kind: "category" | "unit";
    id?: string;
  } | null>(null);
  const [formName, setFormName] = useState<string>("");
  const [formSymbol, setFormSymbol] = useState<string>("");
  const [formDesc, setFormDesc] = useState<string>("");

  // Inspect & migrate connected products modal
  const [inspectState, setInspectState] = useState<{
    kind: "category" | "unit";
    id: string;
    name: string;
    products: ConnectedProductSummary[];
  } | null>(null);
  const [targetMigrationId, setTargetMigrationId] = useState<string>("");

  const canWriteOnline =
    isDeviceConnected &&
    dbOnline &&
    healthState !== "offline" &&
    healthState !== "read_only";

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

  const openEditor = (kind: "category" | "unit", item?: Category | Unit) => {
    setFormName(item?.name ?? "");
    setFormSymbol(item && "symbol" in item ? (item.symbol ?? "") : "");
    setFormDesc(item?.description ?? "");
    setEditorState({ kind, id: item?.id });
  };

  const handleSaveEditor = async () => {
    if (!editorState || isBusy || !canWriteOnline) {
      return;
    }
    if (!formName.trim()) {
      setBanner({ variant: "error", message: "Nama wajib diisi." });
      return;
    }

    setIsBusy(true);
    setBanner(null);
    try {
      let ok = false;
      let errMsg: string | undefined;

      if (editorState.kind === "category") {
        const res = editorState.id
          ? await updateCategoryServer(serverConfig, editorState.id, {
              name: formName.trim(),
              description: formDesc.trim() || undefined,
            })
          : await createCategoryServer(serverConfig, {
              name: formName.trim(),
              description: formDesc.trim() || undefined,
            });
        ok = res.ok;
        errMsg = res.error;
      } else {
        const res = editorState.id
          ? await updateUnitServer(serverConfig, editorState.id, {
              name: formName.trim(),
              symbol: formSymbol.trim(),
              description: formDesc.trim() || undefined,
            })
          : await createUnitServer(serverConfig, {
              name: formName.trim(),
              symbol: formSymbol.trim(),
              description: formDesc.trim() || undefined,
            });
        ok = res.ok;
        errMsg = res.error;
      }

      if (ok) {
        setEditorState(null);
        await refreshAllLists();
        setBanner({ variant: "success", message: "Data berhasil disimpan." });
      } else {
        setBanner({
          variant: "error",
          message: errMsg ?? "Gagal menyimpan data.",
        });
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleOpenInspect = async (
    kind: "category" | "unit",
    id: string,
    name: string
  ) => {
    setIsBusy(true);
    setBanner(null);
    try {
      if (kind === "category") {
        const res = await fetchCategoryDetailServer(serverConfig, id);
        if (res.ok) {
          const fallbackTarget =
            categories.find((c) => c.id !== id)?.id ?? "";
          setTargetMigrationId(fallbackTarget);
          setInspectState({
            kind,
            id,
            name,
            products: res.connectedProducts,
          });
        } else {
          setBanner({
            variant: "error",
            message: res.error ?? "Gagal memeriksa produk kategori.",
          });
        }
      } else {
        const res = await fetchUnitDetailServer(serverConfig, id);
        if (res.ok) {
          const fallbackTarget = units.find((u) => u.id !== id)?.id ?? "";
          setTargetMigrationId(fallbackTarget);
          setInspectState({
            kind,
            id,
            name,
            products: res.connectedProducts,
          });
        } else {
          setBanner({
            variant: "error",
            message: res.error ?? "Gagal memeriksa produk satuan.",
          });
        }
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleMigrateAndDelete = async (alsoDelete: boolean) => {
    if (!inspectState || isBusy || !canWriteOnline) {
      return;
    }
    setIsBusy(true);
    setBanner(null);
    try {
      if (inspectState.products.length > 0 && targetMigrationId) {
        const migRes =
          inspectState.kind === "category"
            ? await migrateCategoryProductsServer(
                serverConfig,
                inspectState.id,
                targetMigrationId
              )
            : await migrateUnitProductsServer(
                serverConfig,
                inspectState.id,
                targetMigrationId
              );
        if (!migRes.ok) {
          setBanner({
            variant: "error",
            message: migRes.error ?? "Migrasi produk gagal.",
          });
          return;
        }
      }

      if (alsoDelete) {
        const delRes =
          inspectState.kind === "category"
            ? await softDeleteCategoryServer(serverConfig, inspectState.id)
            : await softDeleteUnitServer(serverConfig, inspectState.id);
        if (!delRes.ok) {
          setBanner({
            variant: "error",
            message: delRes.error ?? "Gagal menghapus data.",
          });
          return;
        }
      }

      setInspectState(null);
      await refreshAllLists();
      setBanner({
        variant: "success",
        message: alsoDelete
          ? "Berhasil dipindahkan ke tong sampah."
          : "Produk berhasil dimigrasi.",
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handleRestoreTrash = async (kind: "category" | "unit", id: string) => {
    setIsBusy(true);
    setBanner(null);
    try {
      const res =
        kind === "category"
          ? await restoreTrashedCategoryServer(serverConfig, id)
          : await restoreTrashedUnitServer(serverConfig, id);
      if (res.ok) {
        await refreshAllLists();
        setBanner({ variant: "success", message: "Berhasil dipulihkan." });
      } else {
        setBanner({
          variant: "error",
          message: res.error ?? "Gagal memulihkan data.",
        });
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handlePurgeTrash = async (kind: "category" | "unit", id: string) => {
    setIsBusy(true);
    setBanner(null);
    try {
      const res =
        kind === "category"
          ? await purgeTrashedCategoryServer(serverConfig, { id })
          : await purgeTrashedUnitServer(serverConfig, { id });
      if (res.ok) {
        await refreshAllLists();
        setBanner({ variant: "success", message: "Dihapus permanen." });
      } else {
        setBanner({
          variant: "error",
          message: res.error ?? "Gagal menghapus permanen.",
        });
      }
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top"]} style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <ChevronLeft size={22} color={TOKENS.colors.onSurface} />
        </Pressable>
        <Text style={styles.topTitle}>Kategori &amp; Satuan</Text>
        {section !== "trash" ? (
          <Pressable
            testID="cat-unit-add-button"
            accessibilityRole="button"
            disabled={!canWriteOnline}
            onPress={() =>
              openEditor(section === "categories" ? "category" : "unit")
            }
            style={[styles.addBtn, !canWriteOnline && styles.disabledBtn]}
          >
            <Plus size={18} color={TOKENS.colors.onPrimary} />
          </Pressable>
        ) : null}
      </SafeAreaView>

      <View style={styles.segmentsBar}>
        {(
          [
            { id: "categories", label: `Kategori (${categories.length})` },
            { id: "units", label: `Satuan (${units.length})` },
            {
              id: "trash",
              label: `Sampah (${trashedCategories.length + trashedUnits.length})`,
            },
          ] as const
        ).map((tab) => {
          const active = section === tab.id;
          return (
            <Pressable
              key={tab.id}
              testID={`cat-unit-tab-${tab.id}`}
              onPress={() => setSection(tab.id)}
              style={[styles.segBtn, active && styles.segBtnActive]}
            >
              <Text style={[styles.segText, active && styles.segTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {banner ? (
          <FeedbackBanner
            testID="cat-unit-feedback"
            variant={banner.variant}
            message={banner.message}
          />
        ) : null}

        {section === "categories" ? (
          categories.length === 0 ? (
            <EmptyStateCard
              icon={<Tags size={24} color={TOKENS.colors.primary} />}
              title={
                isLoading ? "Memuat Kategori..." : "Belum Ada Kategori Aktif"
              }
              description="Tambahkan kategori barang untuk memudahkan pencarian di kasir."
            />
          ) : (
            categories.map((cat) => (
              <SurfaceCard key={cat.id} style={styles.card}>
                <View style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle}>{cat.name}</Text>
                    <Text style={styles.itemMeta}>
                      {`${cat.productCount ?? 0} produk terhubung`}
                    </Text>
                  </View>
                  <View style={styles.rowActions}>
                    <Pressable
                      disabled={!canWriteOnline || isBusy}
                      onPress={() => openEditor("category", cat)}
                      style={styles.iconActionBtn}
                    >
                      <Pencil size={18} color={TOKENS.colors.primary} />
                    </Pressable>
                    <Pressable
                      disabled={!canWriteOnline || isBusy}
                      onPress={() => {
                        void handleOpenInspect("category", cat.id, cat.name);
                      }}
                      style={styles.iconDeleteBtn}
                    >
                      <Trash2 size={18} color={TOKENS.colors.destructive} />
                    </Pressable>
                  </View>
                </View>
              </SurfaceCard>
            ))
          )
        ) : section === "units" ? (
          units.length === 0 ? (
            <EmptyStateCard
              icon={<Tags size={24} color={TOKENS.colors.primary} />}
              title={isLoading ? "Memuat Satuan..." : "Belum Ada Satuan Aktif"}
              description="Tambahkan satuan seperti Pcs, Pack, Lusin, atau Sak."
            />
          ) : (
            units.map((u) => (
              <SurfaceCard key={u.id} style={styles.card}>
                <View style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemTitle}>
                      {u.symbol ? `${u.name} (${u.symbol})` : u.name}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {`${u.productCount ?? 0} produk terhubung`}
                    </Text>
                  </View>
                  <View style={styles.rowActions}>
                    <Pressable
                      disabled={!canWriteOnline || isBusy}
                      onPress={() => openEditor("unit", u)}
                      style={styles.iconActionBtn}
                    >
                      <Pencil size={18} color={TOKENS.colors.primary} />
                    </Pressable>
                    <Pressable
                      disabled={!canWriteOnline || isBusy}
                      onPress={() => {
                        void handleOpenInspect("unit", u.id, u.name);
                      }}
                      style={styles.iconDeleteBtn}
                    >
                      <Trash2 size={18} color={TOKENS.colors.destructive} />
                    </Pressable>
                  </View>
                </View>
              </SurfaceCard>
            ))
          )
        ) : trashedCategories.length === 0 && trashedUnits.length === 0 ? (
          <EmptyStateCard
            icon={<Trash2 size={24} color={TOKENS.colors.primary} />}
            title="Tong Sampah Kosong"
            description="Kategori dan satuan yang dihapus lunak tersimpan di sini selama 30 hari."
          />
        ) : (
          <>
            {trashedCategories.map((cat) => (
              <SurfaceCard key={`trash-cat-${cat.id}`} style={styles.card}>
                <Text style={styles.itemTitle}>{`[Kategori] ${cat.name}`}</Text>
                <View style={styles.trashActions}>
                  <SecondaryButton
                    variant="tonal"
                    label="Pulihkan"
                    disabled={!canWriteOnline || isBusy}
                    icon={
                      <ArchiveRestore
                        size={15}
                        color={TOKENS.colors.onPrimaryFixed}
                      />
                    }
                    onPress={() => {
                      void handleRestoreTrash("category", cat.id);
                    }}
                    style={styles.flexOne}
                  />
                  <SecondaryButton
                    variant="danger-outline"
                    label="Hapus Permanen"
                    disabled={!canWriteOnline || isBusy}
                    onPress={() => {
                      void handlePurgeTrash("category", cat.id);
                    }}
                    style={styles.flexOne}
                  />
                </View>
              </SurfaceCard>
            ))}
            {trashedUnits.map((u) => (
              <SurfaceCard key={`trash-unit-${u.id}`} style={styles.card}>
                <Text style={styles.itemTitle}>
                  {u.symbol
                    ? `[Satuan] ${u.name} (${u.symbol})`
                    : `[Satuan] ${u.name}`}
                </Text>
                <View style={styles.trashActions}>
                  <SecondaryButton
                    variant="tonal"
                    label="Pulihkan"
                    disabled={!canWriteOnline || isBusy}
                    icon={
                      <ArchiveRestore
                        size={15}
                        color={TOKENS.colors.onPrimaryFixed}
                      />
                    }
                    onPress={() => {
                      void handleRestoreTrash("unit", u.id);
                    }}
                    style={styles.flexOne}
                  />
                  <SecondaryButton
                    variant="danger-outline"
                    label="Hapus Permanen"
                    disabled={!canWriteOnline || isBusy}
                    onPress={() => {
                      void handlePurgeTrash("unit", u.id);
                    }}
                    style={styles.flexOne}
                  />
                </View>
              </SurfaceCard>
            ))}
          </>
        )}
      </ScrollView>

      <Modal
        visible={editorState !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setEditorState(null)}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editorState?.kind === "unit"
                ? editorState.id
                  ? "Ubah Satuan"
                  : "Tambah Satuan"
                : editorState?.id
                  ? "Ubah Kategori"
                  : "Tambah Kategori"}
            </Text>
            <InputField
              testID="cat-unit-form-name"
              label="Nama"
              value={formName}
              onChangeText={setFormName}
            />
            {editorState?.kind === "unit" ? (
              <InputField
                testID="cat-unit-form-symbol"
                label="Simbol Singkat (Opsional, misal: pcs)"
                value={formSymbol}
                onChangeText={setFormSymbol}
              />
            ) : null}
            <InputField
              label="Keterangan (Opsional)"
              value={formDesc}
              onChangeText={setFormDesc}
            />
            <PrimaryButton
              testID="cat-unit-form-save"
              label="Simpan"
              loading={isBusy}
              onPress={() => {
                void handleSaveEditor();
              }}
            />
            <SecondaryButton
              variant="tonal"
              label="Batal"
              onPress={() => setEditorState(null)}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={inspectState !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setInspectState(null)}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <FolderInput size={18} color={TOKENS.colors.primary} />
              <Text style={styles.modalTitle}>
                {`Hapus "${inspectState?.name ?? ""}"?`}
              </Text>
            </View>
            {inspectState && inspectState.products.length > 0 ? (
              <>
                <Text style={styles.itemMeta}>
                  {`${inspectState.products.length} produk terhubung. Pilih tujuan migrasi sebelum menghapus:`}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.migrateChips}
                >
                  {(inspectState.kind === "category" ? categories : units)
                    .filter((opt) => opt.id !== inspectState.id)
                    .map((opt) => (
                      <Pressable
                        key={opt.id}
                        onPress={() => setTargetMigrationId(opt.id)}
                        style={[
                          styles.migrateChip,
                          targetMigrationId === opt.id &&
                            styles.migrateChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.migrateChipText,
                            targetMigrationId === opt.id &&
                              styles.migrateChipTextActive,
                          ]}
                        >
                          {opt.name}
                        </Text>
                      </Pressable>
                    ))}
                </ScrollView>
                <SecondaryButton
                  variant="danger"
                  label="Migrasi Produk & Hapus"
                  disabled={!targetMigrationId || isBusy}
                  loading={isBusy}
                  onPress={() => {
                    void handleMigrateAndDelete(true);
                  }}
                />
              </>
            ) : (
              <SecondaryButton
                variant="danger"
                label="Ya, Pindahkan ke Tong Sampah"
                disabled={isBusy}
                loading={isBusy}
                onPress={() => {
                  void handleMigrateAndDelete(true);
                }}
              />
            )}
            <SecondaryButton
              variant="tonal"
              label="Batal"
              onPress={() => setInspectState(null)}
            />
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
  addBtn: {
    width: TOKENS.spacing.touchTarget,
    height: TOKENS.spacing.touchTarget,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledBtn: {
    opacity: 0.45,
  },
  segmentsBar: {
    flexDirection: "row",
    padding: TOKENS.spacing.sm,
    gap: TOKENS.spacing.xs,
    backgroundColor: TOKENS.colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.colors.borderSubtle,
  },
  segBtn: {
    flex: 1,
    minHeight: TOKENS.spacing.touchTarget,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: TOKENS.spacing.xs,
  },
  segBtnActive: {
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
  scrollContent: {
    padding: TOKENS.spacing.md,
    gap: TOKENS.spacing.sm,
  },
  card: {
    gap: TOKENS.spacing.sm,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: TOKENS.spacing.sm,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onSurface,
  },
  itemMeta: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  rowActions: {
    flexDirection: "row",
    gap: TOKENS.spacing.xs,
  },
  iconActionBtn: {
    width: TOKENS.spacing.touchTarget,
    height: TOKENS.spacing.touchTarget,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
  },
  iconDeleteBtn: {
    width: TOKENS.spacing.touchTarget,
    height: TOKENS.spacing.touchTarget,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.errorContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  trashActions: {
    flexDirection: "row",
    gap: TOKENS.spacing.sm,
  },
  flexOne: {
    flex: 1,
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
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.sm,
  },
  modalTitle: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.body,
    color: TOKENS.colors.onSurface,
  },
  migrateChips: {
    gap: TOKENS.spacing.xs,
  },
  migrateChip: {
    minHeight: TOKENS.spacing.touchTarget,
    paddingHorizontal: TOKENS.spacing.md,
    borderRadius: TOKENS.radii.sm,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    justifyContent: "center",
  },
  migrateChipActive: {
    backgroundColor: TOKENS.colors.primaryFixed,
    borderColor: TOKENS.colors.primary,
  },
  migrateChipText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  migrateChipTextActive: {
    color: TOKENS.colors.onPrimaryFixed,
  },
});
