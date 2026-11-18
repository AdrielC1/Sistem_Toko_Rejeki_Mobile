import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";

export interface TabScreenHeaderProps {
  title: string;
  icon: React.ReactNode;
  rightSlot?: React.ReactNode;
  testID?: string;
}

export function TabScreenHeader({
  title,
  icon,
  rightSlot,
  testID,
}: TabScreenHeaderProps) {
  return (
    <SafeAreaView
      edges={["top"]}
      testID={testID}
      style={styles.safeAreaHeader}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <View style={styles.iconWrap}>{icon}</View>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={styles.titleText}
          >
            {title}
          </Text>
        </View>
        {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeAreaHeader: {
    backgroundColor: TOKENS.colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.colors.borderSubtle,
  },
  headerRow: {
    paddingHorizontal: TOKENS.spacing.md,
    paddingVertical: TOKENS.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: TOKENS.spacing.sm,
  },
  titleGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.sm,
  },
  iconWrap: {
    flexShrink: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  titleText: {
    flexShrink: 1,
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.heading,
    lineHeight: TOKENS.lineHeight.heading,
    color: TOKENS.colors.onSurface,
  },
  rightSlot: {
    flexShrink: 0,
  },
});
