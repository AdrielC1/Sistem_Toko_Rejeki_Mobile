import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { ShieldCheck, User } from "lucide-react-native";
import { FONT_FAMILY, ROLE_STYLES, TOKENS } from "@/theme/tokens";
import type { UserRole } from "@/types";

export interface RoleBadgeProps {
  role: UserRole;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function RoleBadge({ role, style, testID }: RoleBadgeProps) {
  const roleStyle = ROLE_STYLES[role];

  return (
    <View
      testID={testID}
      style={[
        styles.pill,
        { backgroundColor: roleStyle.badgeBg },
        style,
      ]}
    >
      {roleStyle.icon === "shield-check" ? (
        <ShieldCheck size={14} color={roleStyle.badgeText} />
      ) : (
        <User size={14} color={roleStyle.badgeText} />
      )}
      <Text style={[styles.label, { color: roleStyle.badgeText }]}>
        {roleStyle.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.xs,
    paddingHorizontal: TOKENS.spacing.sm,
    paddingVertical: TOKENS.spacing.xs,
    borderRadius: TOKENS.radii.sm,
  },
  label: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
  },
});
