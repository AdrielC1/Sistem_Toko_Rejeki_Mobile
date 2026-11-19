import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";

export interface CatalogPaginationSummaryProps {
  totalCount: number;
  visibleCount: number;
  hasMore: boolean;
  pageSize?: number;
  testID?: string;
}

export function CatalogPaginationSummary({
  totalCount,
  visibleCount,
  hasMore,
  pageSize = 50,
  testID,
}: CatalogPaginationSummaryProps) {
  if (totalCount <= 0) {
    return null;
  }

  return (
    <View testID={testID} style={styles.summaryRow}>
      <Text style={styles.summaryText}>
        {"Total: "}
        <Text style={styles.summaryStrong}>{totalCount}</Text>
        {" produk"}
        {hasMore ? (
          <Text style={styles.summaryHint}>
            {` (menampilkan ${visibleCount} pertama)`}
          </Text>
        ) : null}
      </Text>

      {totalCount > pageSize ? (
        <Text style={styles.countBadge}>{`${visibleCount} / ${totalCount}`}</Text>
      ) : null}
    </View>
  );
}

export interface CatalogLoadMoreFooterProps {
  hasMore: boolean;
  isLoadingMore: boolean;
  visibleCount: number;
  totalCount: number;
  pageSize?: number;
  onLoadMore: () => void;
}

export function CatalogLoadMoreFooter({
  hasMore,
  isLoadingMore,
  visibleCount,
  totalCount,
  pageSize = 50,
  onLoadMore,
}: CatalogLoadMoreFooterProps) {
  if (!hasMore) {
    return null;
  }

  const remaining = Math.max(0, totalCount - visibleCount);
  const nextCount = Math.min(pageSize, remaining);

  return (
    <Pressable
      testID="catalog-load-more-footer"
      accessibilityRole="button"
      disabled={isLoadingMore}
      onPress={onLoadMore}
      style={({ pressed }) => [
        styles.footerCard,
        pressed && !isLoadingMore && styles.footerCardPressed,
      ]}
    >
      <View style={styles.footerTopRow}>
        {isLoadingMore ? (
          <ActivityIndicator size="small" color={TOKENS.colors.primary} />
        ) : null}
        <Text style={styles.footerTitle}>
          {isLoadingMore
            ? `Memuat ${nextCount} produk berikutnya (${visibleCount} dari ${totalCount})...`
            : `Muat ${nextCount} produk berikutnya (${visibleCount} dari ${totalCount})`}
        </Text>
      </View>
      <Text style={styles.footerSubtitle}>
        Gulir ke bawah atau ketuk di sini untuk memuat lebih banyak
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: TOKENS.spacing.sm,
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  summaryText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.onSurfaceVariant,
  },
  summaryStrong: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    color: TOKENS.colors.onSurface,
  },
  summaryHint: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    color: TOKENS.colors.primary,
  },
  countBadge: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: 11,
    lineHeight: 15,
    color: TOKENS.colors.onSurfaceVariant,
    backgroundColor: TOKENS.colors.surfaceContainer,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  footerCard: {
    marginTop: TOKENS.spacing.xs,
    marginBottom: TOKENS.spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: TOKENS.spacing.md,
    borderRadius: TOKENS.radii.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: TOKENS.colors.primary,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    alignItems: "center",
    gap: 2,
  },
  footerCardPressed: {
    opacity: 0.78,
  },
  footerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.xs,
  },
  footerTitle: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    color: TOKENS.colors.primary,
    textAlign: "center",
  },
  footerSubtitle: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 11,
    lineHeight: 15,
    color: TOKENS.colors.muted,
    textAlign: "center",
  },
});
