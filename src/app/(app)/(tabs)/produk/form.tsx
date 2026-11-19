import React, { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Plus, Save, Trash2 } from "lucide-react-native";
import {
  FeedbackBanner,
  InputField,
  PrimaryButton,
  SecondaryButton,
  SurfaceCard,
} from "@/components/ui/VelocityPrimitives";
import { useAuth } from "@/context/AuthContext";
import { useSystemStatus } from "@/context/SystemStatusContext";
import { getCatalogProductById } from "@/db/catalogRepo";
import { useLocalCatalog } from "@/hooks/useLocalCatalog";
import {
  createServerProduct,
  fetchServerProductDetail,
  updateServerProduct,
} from "@/services/api/productsApi";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";

interface DraftConversion {
  key: string;
  unitId: string;
  factorText: string;
  priceText: string;
}

interface DraftWholesaleTier {
  key: string;
  minQtyText: string;
  priceText: string;
}

export default function ProductFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = typeof id === "string" && id.trim().length > 0;
  const { role, serverConfig } = useAuth();
  const { healthState, isDeviceConnected, dbOnline } = useSystemStatus();
  const { categories, units } = useLocalCatalog({ includeInactive: true });

  const [name, setName] = useState<string>("");
  const [sku, setSku] = useState<string>("");
  const [barcode, setBarcode] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [unitId, setUnitId] = useState<string>("");
  const [costPriceText, setCostPriceText] = useState<string>("0");
  const [sellingPriceText, setSellingPriceText] = useState<string>("");
  const [stockText, setStockText] = useState<string>("0");
  const [sellBaseUnit, setSellBaseUnit] = useState<boolean>(true);
  const [isOpenPrice, setIsOpenPrice] = useState<boolean>(false);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [conversions, setConversions] = useState<DraftConversion[]>([]);
  const [wholesaleTiers, setWholesaleTiers] = useState<DraftWholesaleTier[]>(
    []
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canWriteOnline =
    isDeviceConnected &&
    dbOnline &&
    healthState !== "offline" &&
    healthState !== "read_only";

  useEffect(() => {
    let active = true;
    if (!isEdit || typeof id !== "string") {
      return;
    }

    void (async () => {
      const local = await getCatalogProductById(id, role);
      const source =
        local ??
        (await fetchServerProductDetail(serverConfig, id, role)).product;
      if (!active || !source) {
        return;
      }
      setName(source.name);
      setSku(source.sku);
      setBarcode(source.barcode ?? "");
      setCategoryId(source.categoryId);
      setUnitId(source.unitId);
      setCostPriceText(String(source.costPrice ?? 0));
      setSellingPriceText(String(source.sellingPrice));
      setStockText(String(source.stock ?? 0));
      setSellBaseUnit(source.sellBaseUnit !== false);
      setIsOpenPrice(Boolean(source.isOpenPrice));
      setIsActive(source.isActive);
      setConversions(
        source.unitConversions
          .filter((c) => c.unitId !== source.unitId)
          .map((c, idx) => ({
            key: `conv-${idx}-${c.unitId}`,
            unitId: c.unitId,
            factorText: String(c.conversionFactor),
            priceText: String(c.sellingPrice),
          }))
      );
      setWholesaleTiers(
        source.wholesaleTiers.map((t, idx) => ({
          key: `tier-${idx}-${t.minQty}`,
          minQtyText: String(t.minQty),
          priceText: String(t.price),
        }))
      );
    })();

    return () => {
      active = false;
    };
  }, [id, isEdit, role, serverConfig]);

  const effectiveCategoryId = categoryId || categories[0]?.id || "";
  const effectiveUnitId = unitId || units[0]?.id || "";

  const handleSave = async () => {
    if (isSaving || !canWriteOnline) {
      return;
    }
    if (!name.trim() || !sku.trim()) {
      setErrorMsg("Nama produk dan SKU wajib diisi.");
      return;
    }
    if (!effectiveCategoryId || !effectiveUnitId) {
      setErrorMsg("Pilih kategori dan satuan dasar produk terlebih dahulu.");
      return;
    }

    const sellingPrice = Number(sellingPriceText || "0");
    const costPrice = Number(costPriceText || "0");
    const stock = Number(stockText || "0");
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      setErrorMsg("Harga jual harus berupa angka valid.");
      return;
    }

    const resolvedCostPrice = Number.isFinite(costPrice) ? Math.max(0, costPrice) : 0;
    const resolvedSellingPrice = Math.round(sellingPrice);
    const resolvedCategory = categories.find(
      (c) => c.id === effectiveCategoryId
    );
    const resolvedBaseUnit = units.find((u) => u.id === effectiveUnitId);
    const baseUnitName = resolvedBaseUnit?.name?.trim() || "Pcs";

    const normalizedTiers = wholesaleTiers
      .filter((t) => Number(t.minQtyText) > 0 && Number(t.priceText) >= 0)
      .map((t) => {
        const tierPrice = Math.max(0, Math.round(Number(t.priceText)));
        return {
          unitName: baseUnitName,
          minQty: Math.max(1, Math.round(Number(t.minQtyText))),
          price: tierPrice,
          specialPrice: tierPrice,
        };
      });

    const extraConversions = conversions
      .filter((c) => c.unitId && c.unitId !== effectiveUnitId)
      .map((c) => {
        const factor = Math.max(1, Number(c.factorText || "1"));
        const convUnit = units.find((u) => u.id === c.unitId);
        return {
          unitId: c.unitId,
          unitName: convUnit?.name?.trim() || "Satuan",
          conversionFactor: factor,
          costPrice: Math.round(resolvedCostPrice * factor),
          sellingPrice: Math.max(0, Math.round(Number(c.priceText || "0"))),
          isActive: true,
        };
      });

    const payload = {
      sku: sku.trim(),
      barcode: barcode.trim() || null,
      name: name.trim(),
      categoryId: effectiveCategoryId,
      categoryName: resolvedCategory?.name?.trim() || "Umum",
      unitId: effectiveUnitId,
      unitName: baseUnitName,
      costPrice: resolvedCostPrice,
      sellingPrice: resolvedSellingPrice,
      isOpenPrice,
      sellBaseUnit,
      stock: Number.isFinite(stock) ? Math.max(0, Math.round(stock)) : 0,
      isActive,
      // Send base unit + derived conversions so backend mini_product_units & wholesale_tiers persist completely.
      unitConversions: [
        {
          unitId: effectiveUnitId,
          unitName: baseUnitName,
          conversionFactor: 1,
          costPrice: resolvedCostPrice,
          sellingPrice: resolvedSellingPrice,
          isActive: sellBaseUnit,
          wholesaleTiers: normalizedTiers,
        },
        ...extraConversions,
      ],
      wholesaleTiers: normalizedTiers,
    };

    setIsSaving(true);
    setErrorMsg(null);
    try {
      const res =
        isEdit && typeof id === "string"
          ? await updateServerProduct(serverConfig, id, payload, role)
          : await createServerProduct(serverConfig, payload, role);

      if (res.ok) {
        router.back();
      } else {
        setErrorMsg(res.error ?? "Gagal menyimpan data produk ke server.");
      }
    } finally {
      setIsSaving(false);
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
        <Text style={styles.topTitle}>
          {isEdit ? "Ubah Produk" : "Tambah Produk Baru"}
        </Text>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {!canWriteOnline ? (
          <FeedbackBanner
            variant="warning"
            message="Server/database tidak terjangkau. Penambahan dan perubahan produk hanya dapat dilakukan saat online."
          />
        ) : null}

        {errorMsg ? <FeedbackBanner variant="error" message={errorMsg} /> : null}

        <SurfaceCard style={styles.card}>
          <InputField
            testID="produk-form-name"
            label="Nama Produk"
            value={name}
            onChangeText={setName}
            placeholder="Contoh: Beras Ramos 5kg"
          />
          <InputField
            testID="produk-form-sku"
            label="SKU"
            value={sku}
            onChangeText={setSku}
            placeholder="Contoh: BRS-005"
            autoCapitalize="characters"
            monospace
          />
          <InputField
            testID="produk-form-barcode"
            label="Barcode (Opsional)"
            value={barcode}
            onChangeText={setBarcode}
            placeholder="899..."
            monospace
          />

          <Text style={styles.groupLabel}>Kategori</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipStrip}
          >
            {categories.map((cat) => {
              const selected = cat.id === effectiveCategoryId;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setCategoryId(cat.id)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected && styles.chipTextSelected,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.groupLabel}>Satuan Dasar</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipStrip}
          >
            {units.map((u) => {
              const selected = u.id === effectiveUnitId;
              return (
                <Pressable
                  key={u.id}
                  onPress={() => setUnitId(u.id)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected && styles.chipTextSelected,
                    ]}
                  >
                    {u.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <InputField
            testID="produk-form-selling-price"
            label="Harga Jual Satuan Dasar (Rp)"
            value={sellingPriceText}
            onChangeText={(txt) =>
              setSellingPriceText(txt.replace(/[^0-9]/g, ""))
            }
            keyboardType="numeric"
            monospace
          />
          <InputField
            testID="produk-form-cost-price"
            label="Harga Modal / HPP (Rp)"
            value={costPriceText}
            onChangeText={(txt) =>
              setCostPriceText(txt.replace(/[^0-9]/g, ""))
            }
            keyboardType="numeric"
            monospace
          />
          <InputField
            testID="produk-form-stock"
            label="Stok Awal / Saat Ini"
            value={stockText}
            onChangeText={(txt) => setStockText(txt.replace(/[^0-9]/g, ""))}
            keyboardType="numeric"
            monospace
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Jual Satuan Dasar di Kasir</Text>
            <Switch value={sellBaseUnit} onValueChange={setSellBaseUnit} />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Izinkan Harga Custom (Open Price)</Text>
            <Switch value={isOpenPrice} onValueChange={setIsOpenPrice} />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Produk Aktif</Text>
            <Switch value={isActive} onValueChange={setIsActive} />
          </View>
        </SurfaceCard>

        <SurfaceCard style={styles.card}>
          <View style={styles.sectionTop}>
            <Text style={styles.sectionTitle}>Konversi Satuan Tambahan</Text>
            <SecondaryButton
              variant="tonal"
              label="Tambah Satuan"
              icon={<Plus size={16} color={TOKENS.colors.onPrimaryFixed} />}
              onPress={() => {
                const candidate =
                  units.find((u) => u.id !== effectiveUnitId)?.id ??
                  effectiveUnitId;
                setConversions((prev) => [
                  ...prev,
                  {
                    key: `conv-${Date.now()}`,
                    unitId: candidate,
                    factorText: "1",
                    priceText: "0",
                  },
                ]);
              }}
            />
          </View>

          {conversions.map((conv, index) => (
            <View key={conv.key} style={styles.nestedBox}>
              <View style={styles.nestedHeader}>
                <Text style={styles.groupLabel}>{`Konversi #${index + 1}`}</Text>
                <Pressable
                  onPress={() =>
                    setConversions((prev) =>
                      prev.filter((row) => row.key !== conv.key)
                    )
                  }
                >
                  <Trash2 size={18} color={TOKENS.colors.destructive} />
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipStrip}
              >
                {units
                  .filter((u) => u.id !== effectiveUnitId)
                  .map((u) => (
                    <Pressable
                      key={u.id}
                      onPress={() =>
                        setConversions((prev) =>
                          prev.map((row) =>
                            row.key === conv.key
                              ? { ...row, unitId: u.id }
                              : row
                          )
                        )
                      }
                      style={[
                        styles.chip,
                        conv.unitId === u.id && styles.chipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          conv.unitId === u.id && styles.chipTextSelected,
                        ]}
                      >
                        {u.name}
                      </Text>
                    </Pressable>
                  ))}
              </ScrollView>
              <InputField
                label="Faktor Konversi (isi dalam satuan dasar)"
                value={conv.factorText}
                keyboardType="numeric"
                monospace
                onChangeText={(txt) =>
                  setConversions((prev) =>
                    prev.map((row) =>
                      row.key === conv.key
                        ? { ...row, factorText: txt.replace(/[^0-9]/g, "") }
                        : row
                    )
                  )
                }
              />
              <InputField
                label="Harga Jual Satuan Ini (Rp)"
                value={conv.priceText}
                keyboardType="numeric"
                monospace
                onChangeText={(txt) =>
                  setConversions((prev) =>
                    prev.map((row) =>
                      row.key === conv.key
                        ? { ...row, priceText: txt.replace(/[^0-9]/g, "") }
                        : row
                    )
                  )
                }
              />
            </View>
          ))}
        </SurfaceCard>

        <SurfaceCard style={styles.card}>
          <View style={styles.sectionTop}>
            <Text style={styles.sectionTitle}>Tingkat Harga Grosir</Text>
            <SecondaryButton
              variant="tonal"
              label="Tambah Grosir"
              icon={<Plus size={16} color={TOKENS.colors.onPrimaryFixed} />}
              onPress={() =>
                setWholesaleTiers((prev) => [
                  ...prev,
                  {
                    key: `tier-${Date.now()}`,
                    minQtyText: "5",
                    priceText: sellingPriceText || "0",
                  },
                ])
              }
            />
          </View>

          {wholesaleTiers.map((tier, index) => (
            <View key={tier.key} style={styles.nestedBox}>
              <View style={styles.nestedHeader}>
                <Text style={styles.groupLabel}>{`Tier #${index + 1}`}</Text>
                <Pressable
                  onPress={() =>
                    setWholesaleTiers((prev) =>
                      prev.filter((row) => row.key !== tier.key)
                    )
                  }
                >
                  <Trash2 size={18} color={TOKENS.colors.destructive} />
                </Pressable>
              </View>
              <InputField
                label="Minimal Qty Pembelian"
                value={tier.minQtyText}
                keyboardType="numeric"
                monospace
                onChangeText={(txt) =>
                  setWholesaleTiers((prev) =>
                    prev.map((row) =>
                      row.key === tier.key
                        ? { ...row, minQtyText: txt.replace(/[^0-9]/g, "") }
                        : row
                    )
                  )
                }
              />
              <InputField
                label="Harga Satuan Grosir (Rp)"
                value={tier.priceText}
                keyboardType="numeric"
                monospace
                onChangeText={(txt) =>
                  setWholesaleTiers((prev) =>
                    prev.map((row) =>
                      row.key === tier.key
                        ? { ...row, priceText: txt.replace(/[^0-9]/g, "") }
                        : row
                    )
                  )
                }
              />
            </View>
          ))}
        </SurfaceCard>

        <PrimaryButton
          testID="produk-form-submit"
          label={isEdit ? "Simpan Perubahan" : "Simpan Produk Baru"}
          loading={isSaving}
          loadingLabel="Menyimpan..."
          disabled={isSaving || !canWriteOnline}
          icon={<Save size={18} color={TOKENS.colors.onPrimary} />}
          onPress={() => {
            void handleSave();
          }}
        />
      </ScrollView>
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
    gap: TOKENS.spacing.md,
  },
  groupLabel: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  chipStrip: {
    gap: TOKENS.spacing.xs,
  },
  chip: {
    minHeight: TOKENS.spacing.touchTarget,
    paddingHorizontal: TOKENS.spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    justifyContent: "center",
  },
  chipSelected: {
    backgroundColor: TOKENS.colors.primaryFixed,
    borderColor: TOKENS.colors.primary,
  },
  chipText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  chipTextSelected: {
    color: TOKENS.colors.onPrimaryFixed,
  },
  switchRow: {
    minHeight: TOKENS.spacing.touchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: TOKENS.spacing.sm,
  },
  switchLabel: {
    flex: 1,
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurface,
  },
  sectionTop: {
    gap: TOKENS.spacing.sm,
  },
  sectionTitle: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onSurface,
  },
  nestedBox: {
    padding: TOKENS.spacing.md,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderRadius: TOKENS.radii.md,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    gap: TOKENS.spacing.sm,
  },
  nestedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
