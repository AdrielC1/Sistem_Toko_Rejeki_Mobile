import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Calculator,
  ChevronRight,
  Plus,
  ReceiptText,
} from "lucide-react-native";
import { EmptyStateCard } from "@/components/common/EmptyStateCard";
import { InitialSyncBanner } from "@/components/common/InitialSyncBanner";
import { TabScreenHeader } from "@/components/common/TabScreenHeader";
import {
  PrimaryButton,
  SecondaryButton,
  SurfaceCard,
} from "@/components/ui/VelocityPrimitives";
import { formatRupiah, formatWibDateTime } from "@/domain/format";
import { calculateCartSummary } from "@/domain/pricing";
import { usePosCartStore } from "@/store/posCartStore";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";

export default function PesananScreen() {
  const router = useRouter();
  const tabs = usePosCartStore((s) => s.tabs);
  const activeTabId = usePosCartStore((s) => s.activeTabId);
  const createTab = usePosCartStore((s) => s.createTab);

  const heldOrders = useMemo(
    () => tabs.filter((tab) => tab.items.length > 0),
    [tabs]
  );

  return (
    <View style={styles.screen}>
      <TabScreenHeader
        testID="pesanan-header"
        title="Pesanan"
        icon={<ReceiptText size={20} color={TOKENS.colors.primary} />}
        bannerSlot={<InitialSyncBanner />}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topActionRow}>
          <SecondaryButton
            testID="pesanan-new-order-button"
            variant="tonal"
            label="Buat Nota Kasir Baru"
            icon={<Plus size={16} color={TOKENS.colors.onPrimaryFixed} />}
            onPress={() => {
              createTab();
              router.push("/kasir");
            }}
          />
        </View>
        {heldOrders.length === 0 ? (
          <EmptyStateCard
            testID="pesanan-empty-card"
            icon={<ReceiptText size={24} color={TOKENS.colors.primary} />}
            title="Belum Ada Pesanan Tertunda"
            description="Nota transaksi yang ditahan secara lokal di perangkat akan tampil di sini setelah modul kasir aktif. Ketuk Ke Layar Kasir untuk melihat shell kasir."
            action={
              <PrimaryButton
                testID="pesanan-open-kasir-button"
                label="Ke Layar Kasir"
                icon={<Calculator size={18} color={TOKENS.colors.onPrimary} />}
                onPress={() => {
                  router.push("/kasir");
                }}
              />
            }
          />
        ) : (
          heldOrders.map((tab) => {
            const summary = calculateCartSummary(tab.items, tab.discount);
            const isActive = tab.id === activeTabId;
            return (
              <Pressable
                key={tab.id}
                testID={`pesanan-card-${tab.id}`}
                accessibilityRole="button"
                onPress={() => {
                  router.push(`/pesanan/${tab.id}`);
                }}
              >
                {({ pressed }) => (
                  <SurfaceCard
                    style={[styles.card, pressed && styles.pressedCard]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.titleRow}>
                        <Text style={styles.orderTitle}>{tab.label}</Text>
                        {isActive ? (
                          <Text style={styles.activeBadge}>Aktif di Kasir</Text>
                        ) : null}
                      </View>
                      <ChevronRight size={18} color={TOKENS.colors.outline} />
                    </View>

                    <Text style={styles.timeText}>
                      {`Dibuat: ${formatWibDateTime(tab.createdAt)}`}
                    </Text>

                    <View style={styles.footerRow}>
                      <Text style={styles.countText}>
                        {`${summary.itemCount} jenis · ${summary.totalQuantity} item`}
                      </Text>
                      <Text style={styles.totalText}>
                        {formatRupiah(summary.grandTotal)}
                      </Text>
                    </View>
                  </SurfaceCard>
                )}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: TOKENS.colors.background,
  },
  topActionRow: {
    marginBottom: TOKENS.spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: TOKENS.spacing.md,
    paddingTop: TOKENS.spacing.sm,
    paddingBottom: TOKENS.spacing.lg,
    gap: TOKENS.spacing.sm,
  },
  pressedCard: {
    borderColor: TOKENS.colors.primary,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
  },
  card: {
    gap: TOKENS.spacing.xs,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: TOKENS.spacing.sm,
  },
  titleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.sm,
  },
  orderTitle: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onSurface,
  },
  activeBadge: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onPrimaryFixed,
    backgroundColor: TOKENS.colors.primaryFixed,
    paddingHorizontal: TOKENS.spacing.sm,
    paddingVertical: 2,
    borderRadius: TOKENS.radii.sm,
  },
  timeText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: TOKENS.spacing.xs,
  },
  countText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  totalText: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.primary,
  },
});
