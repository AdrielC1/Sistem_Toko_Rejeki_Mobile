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
  Trash2,
} from "lucide-react-native";
import { EmptyStateCard } from "@/components/common/EmptyStateCard";
import {
  FeedbackBanner,
  SecondaryButton,
  SurfaceCard,
} from "@/components/ui/VelocityPrimitives";
import { useAuth } from "@/context/AuthContext";
import { useSystemStatus } from "@/context/SystemStatusContext";
import { formatRupiah } from "@/domain/format";
import {
  deleteTrashedProductPermanently,
  fetchTrashedProducts,
  restoreTrashedProduct,
} from "@/services/api/productsApi";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";
import type { Product } from "@/types";

export default function ProductTrashScreen() {
  const router = useRouter();
  const { role, serverConfig } = useAuth();
  const { healthState, isDeviceConnected, dbOnline } = useSystemStatus();

  const [trashed, setTrashed] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [emptyAllModalOpen, setEmptyAllModalOpen] = useState<boolean>(false);
  const [banner, setBanner] = useState<{
    variant: "success" | "error";
    message: string;
  } | null>(null);

  const canWriteOnline =
    isDeviceConnected &&
    dbOnline &&
    healthState !== "offline" &&
    healthState !== "read_only";

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetchTrashedProducts(serverConfig, role);
        if (!active) {
          return;
        }
        if (res.ok) {
          setTrashed(res.products);
        } else {
          setBanner({
            variant: "error",
            message: res.error ?? "Gagal memuat tong sampah produk.",
          });
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
  }, [role, serverConfig]);

  const handleRestore = async (id: string) => {
    setBusyId(id);
    setBanner(null);
    try {
      const res = await restoreTrashedProduct(serverConfig, id);
      if (res.ok) {
        setTrashed((prev) => prev.filter((item) => item.id !== id));
        setBanner({
          variant: "success",
          message: "Produk berhasil dipulihkan ke katalog aktif.",
        });
      } else {
        setBanner({
          variant: "error",
          message: res.error ?? "Gagal memulihkan produk.",
        });
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleDeletePermanent = async (id: string) => {
    setBusyId(id);
    setBanner(null);
    try {
      const res = await deleteTrashedProductPermanently(serverConfig, { id });
      if (res.ok) {
        setTrashed((prev) => prev.filter((item) => item.id !== id));
        setBanner({
          variant: "success",
          message: "Produk dihapus permanen.",
        });
      } else {
        setBanner({
          variant: "error",
          message: res.error ?? "Gagal menghapus permanen.",
        });
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleEmptyAll = async () => {
    setBusyId("__all__");
    setBanner(null);
    try {
      const res = await deleteTrashedProductPermanently(serverConfig, {
        emptyAll: true,
      });
      setEmptyAllModalOpen(false);
      if (res.ok) {
        setTrashed([]);
        setBanner({
          variant: "success",
          message: "Tong sampah produk dikosongkan.",
        });
      } else {
        setBanner({
          variant: "error",
          message: res.error ?? "Gagal mengosongkan tong sampah.",
        });
      }
    } finally {
      setBusyId(null);
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
        <Text style={styles.topTitle}>Tong Sampah Produk (30 Hari)</Text>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {banner ? (
          <FeedbackBanner variant={banner.variant} message={banner.message} />
        ) : null}

        {trashed.length > 0 ? (
          <SecondaryButton
            testID="produk-trash-empty-all"
            variant="danger-outline"
            label={`Kosongkan Tong Sampah (${trashed.length})`}
            disabled={!canWriteOnline || busyId !== null}
            onPress={() => setEmptyAllModalOpen(true)}
          />
        ) : null}

        {trashed.length === 0 ? (
          <EmptyStateCard
            testID="produk-trash-empty-card"
            icon={<Trash2 size={24} color={TOKENS.colors.primary} />}
            title={
              isLoading ? "Memuat Tong Sampah..." : "Tong Sampah Produk Kosong"
            }
            description="Produk yang dihapus lunak (soft delete) akan tersimpan di sini hingga 30 hari sebelum dihapus permanen."
          />
        ) : (
          trashed.map((item) => (
            <SurfaceCard
              key={item.id}
              testID={`produk-trash-item-${item.id}`}
              style={styles.card}
            >
              <Text style={styles.productName}>{item.name}</Text>
              <Text style={styles.metaText}>
                {`SKU: ${item.sku || "-"} · ${
                  item.sellingPrice > 0
                    ? formatRupiah(item.sellingPrice)
                    : (item.categoryName ?? "Produk")
                }`}
              </Text>
              <View style={styles.actionsRow}>
                <SecondaryButton
                  testID={`produk-trash-restore-${item.id}`}
                  variant="tonal"
                  label="Pulihkan"
                  disabled={!canWriteOnline || busyId !== null}
                  loading={busyId === item.id}
                  icon={
                    <ArchiveRestore
                      size={16}
                      color={TOKENS.colors.onPrimaryFixed}
                    />
                  }
                  onPress={() => {
                    void handleRestore(item.id);
                  }}
                  style={styles.actionBtn}
                />
                <SecondaryButton
                  testID={`produk-trash-purge-${item.id}`}
                  variant="danger-outline"
                  label="Hapus Permanen"
                  disabled={!canWriteOnline || busyId !== null}
                  onPress={() => {
                    void handleDeletePermanent(item.id);
                  }}
                  style={styles.actionBtn}
                />
              </View>
            </SurfaceCard>
          ))
        )}
      </ScrollView>

      <Modal
        visible={emptyAllModalOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setEmptyAllModalOpen(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.productName}>
              Kosongkan Semua Tong Sampah Produk?
            </Text>
            <Text style={styles.metaText}>
              Semua produk di tong sampah akan dihapus secara permanen dan tidak
              dapat dipulihkan kembali.
            </Text>
            <SecondaryButton
              variant="danger"
              label="Ya, Hapus Semua Permanen"
              loading={busyId === "__all__"}
              onPress={() => {
                void handleEmptyAll();
              }}
            />
            <SecondaryButton
              variant="tonal"
              label="Batal"
              onPress={() => setEmptyAllModalOpen(false)}
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
  scrollContent: {
    padding: TOKENS.spacing.md,
    gap: TOKENS.spacing.md,
  },
  card: {
    gap: TOKENS.spacing.sm,
  },
  productName: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onSurface,
  },
  metaText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  actionsRow: {
    flexDirection: "row",
    gap: TOKENS.spacing.sm,
  },
  actionBtn: {
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
    gap: TOKENS.spacing.md,
  },
});
