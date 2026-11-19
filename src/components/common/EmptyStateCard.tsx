import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SurfaceCard } from "@/components/ui/VelocityPrimitives";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";

export type EmptyStateIconVariant = "neutral" | "warning" | "primary";

export interface EmptyStateCardProps {
  icon: React.ReactNode;
  iconBadgeVariant?: EmptyStateIconVariant;
  title: string;
  description: string;
  action?: React.ReactNode;
  testID?: string;
}

export function EmptyStateCard({
  icon,
  iconBadgeVariant = "neutral",
  title,
  description,
  action,
  testID,
}: EmptyStateCardProps) {
  return (
    <SurfaceCard testID={testID} style={styles.emptyCard}>
      <View
        style={[
          styles.emptyIconBadge,
          iconBadgeVariant === "warning" && styles.badgeWarning,
          iconBadgeVariant === "primary" && styles.badgePrimary,
        ]}
      >
        {icon}
      </View>
      <Text style={styles.emptyHeading}>{title}</Text>
      <Text style={styles.emptyBody}>{description}</Text>
      {action ? <View style={styles.actionWrap}>{action}</View> : null}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    alignItems: "center",
    gap: TOKENS.spacing.md,
  },
  emptyIconBadge: {
    width: TOKENS.spacing.touchTarget,
    height: TOKENS.spacing.touchTarget,
    borderRadius: TOKENS.radii.md,
    backgroundColor: TOKENS.colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeWarning: {
    backgroundColor: TOKENS.colors.warningBg,
  },
  badgePrimary: {
    backgroundColor: TOKENS.colors.primaryContainer,
  },
  emptyHeading: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.heading,
    lineHeight: TOKENS.lineHeight.heading,
    color: TOKENS.colors.onSurface,
    textAlign: "center",
  },
  emptyBody: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onSurfaceVariant,
    textAlign: "center",
  },
  actionWrap: {
    width: "100%",
  },
});
