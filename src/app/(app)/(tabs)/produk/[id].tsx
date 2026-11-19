import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  Package,
  Pencil,
  Trash2,
} from "lucide-react-native";
import { EmptyStateCard } from "@/components/common/EmptyStateCard";
import {
  FeedbackBanner,
  PrimaryButton,
  SecondaryButton,
  SurfaceCard,
} from "@/components/ui/VelocityPrimitives";
import { useAuth } from "@/context/AuthContext";
import { useSystemStatus } from "@/context/SystemStatusContext";
import { getCatalogProductById } from "@/db/catalogRepo";
import { formatRupiah } from "@/domain/format";
import {
  fetchServerProductDetail,
  softDeleteServerProduct,
} from "@/services/api/productsApi";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";
import type { Product } from "@/types";

export default function ProductDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role, roleCapabilities, serverConfig } = useAuth();
  const { healthState, isDeviceConnected, dbOnline } = useSystemStatus();

  const productId = typeof id === "string" ? id : "";
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(productId));
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const canWriteOnline =
    roleCapabilities.canEditProducts &&
    isDeviceConnected &&
    dbOnline &&
    healthState !== "offline" &&
    healthState !== "read_only";

  useEffect(() => {
    if (!productId) {
      return;
    }
    let active = true;

    void (async () => {
      try {
        const local = await getCatalogProductById(productId, role);
        if (active && local) {
          setProduct(local);
        }
        if (isDeviceConnected && dbOnline) {
          const remote = await fetchServerProductDetail(
            serverConfig,
            productId,
            role
          );
          if (active && remote.ok && remote.product) {
            setProduct(remote.product);
          }
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
  }, [dbOnline, isDeviceConnected, productId, role, serverConfig]);

  const handleConfirmDelete = async () => {
    if (!product || isDeleting) {
      return;
    }
    setIsDeleting(true);
    setErrorBanner(null);
    try {
      const res = await softDeleteServerProduct(serverConfig, product.id);
      if (res.ok) {
        setConfirmDeleteOpen(false);
        router.back();
      } else {
        setConfirmDeleteOpen(false);
        setErrorBanner(res.error ?? "Gagal memindahkan produk ke tong sampah.");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top"]} style={styles.topBar}>
        <Pressable
          testID="produk-detail-back"
          accessibilityRole="button"
          accessibilityLabel="Kembali ke daftar produk"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <ChevronLeft size={22} color={TOKENS.colors.onSurface} />
        </Pressable>
        <Text numberOfLines={1} style={styles.topTitle}>
          Detail Produk
        </Text>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {errorBanner ? (
          <FeedbackBanner variant="error" message={errorBanner} />
        ) : null}

        {!product ? (
          <EmptyStateCard
            testID="produk-detail-not-found"
            icon={<Package size={24} color={TOKENS.colors.primary} />}
            title={
              isLoading ? "Memuat Detail Produk..." : "Produk Tidak Ditemukan"
            }
            description={
              isLoading
                ? "Mengambil data katalog produk."
                : "Produk tidak tersedia di katalog lokal atau sudah dihapus."
            }
          />
        ) : (
          <>
            <SurfaceCard style={styles.card}>
              <Text testID="produk-detail-name" style={styles.productTitle}>
                {product.name}
              </Text>

              <View style={styles.metaLine}>
                <Text style={styles.metaLabel}>SKU</Text>
                <Text style={styles.metaMono}>{product.sku}</Text>
              </View>

              <View style={styles.metaLine}>
                <Text style={styles.metaLabel}>Barcode</Text>
                <Text style={styles.metaMono}>{product.barcode || "-"}</Text>
              </View>

              <View style={styles.metaLine}>
                <Text style={styles.metaLabel}>Kategori</Text>
                <Text style={styles.metaValue}>
                  {product.categoryName || "-"}
                </Text>
              </View>

              <View style={styles.metaLine}>
                <Text style={styles.metaLabel}>Status Jual</Text>
                <Text style={styles.metaValue}>
                  {product.isActive ? "Aktif" : "Nonaktif"}
                </Text>
              </View>

              <View style={styles.metaLine}>
                <Text style={styles.metaLabel}>Stok Saat Ini</Text>
                <Text style={styles.metaMono}>{`${product.stock} ${product.unitName ?? "Pcs"}`}</Text>
              </View>

              {product.description ? (
                <View style={styles.descBox}>
                  <Text style={styles.metaLabel}>Deskripsi</Text>
                  <Text style={styles.descText}>{product.description}</Text>
                </View>
              ) : null}
            </SurfaceCard>

            <SurfaceCard style={styles.card}>
              <Text style={styles.sectionHeading}>Informasi Harga</Text>

              <View style={styles.metaLine}>
                <Text style={styles.metaLabel}>
                  {`Harga Jual (${product.unitName ?? "Pcs"})`}
                </Text>
                <Text style={styles.priceMono}>
                  {product.sellBaseUnit === false
                    ? "Satuan dasar tidak dijual"
                    : formatRupiah(product.sellingPrice)}
                </Text>
              </View>

              {roleCapabilities.canViewCostPrice &&
              typeof product.costPrice === "number" ? (
                <View testID="produk-detail-cost-row" style={styles.metaLine}>
                  <Text style={styles.metaLabel}>Harga Modal (HPP)</Text>
                  <Text style={styles.metaMono}>
                    {formatRupiah(product.costPrice)}
                  </Text>
                </View>
              ) : null}

              <View style={styles.metaLine}>
                <Text style={styles.metaLabel}>Open Price (Harga Custom)</Text>
                <Text style={styles.metaValue}>
                  {product.isOpenPrice ? "Diizinkan" : "Tidak"}
                </Text>
              </View>
            </SurfaceCard>

            {product.unitConversions.length > 0 ? (
              <SurfaceCard style={styles.card}>
                <Text style={styles.sectionHeading}>Konversi Multi-Satuan</Text>
                {product.unitConversions.map((conv) => (
                  <View key={conv.id} style={styles.subListRow}>
                    <Text style={styles.metaValue}>
                      {`${conv.unitName} (= ${conv.conversionFactor} ${product.unitName ?? "Pcs"})`}
                    </Text>
                    <Text style={styles.priceMono}>
                      {formatRupiah(conv.sellingPrice)}
                    </Text>
                  </View>
                ))}
              </SurfaceCard>
            ) : null}

            {product.wholesaleTiers.length > 0 ? (
              <SurfaceCard style={styles.card}>
                <Text style={styles.sectionHeading}>Tingkat Harga Grosir</Text>
                {product.wholesaleTiers.map((tier, idx) => (
                  <View key={`${tier.minQty}-${idx}`} style={styles.subListRow}>
                    <Text style={styles.metaValue}>
                      {`Beli >= ${tier.minQty} ${product.unitName ?? "Pcs"}`}
                    </Text>
                    <Text style={styles.savingsMono}>
                      {formatRupiah(tier.price)}
                    </Text>
                  </View>
                ))}
              </SurfaceCard>
            ) : null}

            {roleCapabilities.canEditProducts ? (
              <SurfaceCard style={styles.card}>
                {!canWriteOnline ? (
                  <FeedbackBanner
                    variant="warning"
                    message="Koneksi server/database offline. Edit dan hapus produk membutuhkan koneksi aktif."
                  />
                ) : null}
                <PrimaryButton
                  testID="produk-detail-edit-button"
                  label="Ubah Data Produk"
                  disabled={!canWriteOnline}
                  icon={<Pencil size={18} color={TOKENS.colors.onPrimary} />}
                  onPress={() =>
                    router.push(`/produk/form?id=${product.id}`)
                  }
                />
                <SecondaryButton
                  testID="produk-detail-delete-button"
                  variant="danger-outline"
                  label="Pindahkan ke Tong Sampah"
                  disabled={!canWriteOnline}
                  icon={<Trash2 size={18} color={TOKENS.colors.destructive} />}
                  onPress={() => setConfirmDeleteOpen(true)}
                />
              </SurfaceCard>
            ) : null}
          </>
        )}
      </ScrollView>

      <Modal
        testID="produk-delete-confirm-modal"
        visible={confirmDeleteOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (!isDeleting) {
            setConfirmDeleteOpen(false);
          }
        }}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionHeading}>
              Pindahkan Produk ke Tong Sampah?
            </Text>
            <Text style={styles.descText}>
              {`${product?.name ?? "Produk"} akan disembunyikan dari kasir dan dapat dipulihkan dalam 30 hari dari Tong Sampah.`}
            </Text>
            <View style={styles.modalActions}>
              <SecondaryButton
                variant="tonal"
                label="Batal"
                disabled={isDeleting}
                onPress={() => setConfirmDeleteOpen(false)}
              />
              <SecondaryButton
                testID="produk-delete-confirm-button"
                variant="danger"
                label="Ya, Hapus Produk"
                loading={isDeleting}
                loadingLabel="Menghapus..."
                disabled={isDeleting}
                onPress={() => {
                  void handleConfirmDelete();
                }}
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
  scrollContent: {
    padding: TOKENS.spacing.md,
    gap: TOKENS.spacing.md,
  },
  card: {
    gap: TOKENS.spacing.sm,
  },
  productTitle: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.display,
    lineHeight: TOKENS.lineHeight.display,
    color: TOKENS.colors.onSurface,
    marginBottom: TOKENS.spacing.xs,
  },
  sectionHeading: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onSurface,
  },
  metaLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: TOKENS.spacing.sm,
  },
  subListRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: TOKENS.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: TOKENS.colors.borderSubtle,
  },
  metaLabel: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  metaValue: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurface,
  },
  metaMono: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurface,
  },
  priceMono: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.primary,
  },
  savingsMono: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.successText,
  },
  descBox: {
    marginTop: TOKENS.spacing.xs,
    gap: TOKENS.spacing.xs,
  },
  descText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
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
  modalActions: {
    gap: TOKENS.spacing.sm,
  },
});
