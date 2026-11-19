import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Tabs, type BottomTabBarProps } from "expo-router/js-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Calculator,
  Package,
  ReceiptText,
  Settings,
} from "lucide-react-native";
import {
  selectHeldOrdersCount,
  usePosCartStore,
} from "@/store/posCartStore";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";

function VelocityTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
}: BottomTabBarProps) {
  const safeInsets = useSafeAreaInsets();
  const bottomPadding = Math.max(
    insets?.bottom ?? safeInsets.bottom,
    TOKENS.spacing.sm
  );

  return (
    <View
      testID="bottom-tab-bar"
      role="tablist"
      style={[
        styles.tabBar,
        {
          height: TOKENS.spacing.tabBarHeight + bottomPadding,
          paddingBottom: bottomPadding,
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const descriptor = descriptors[route.key];
        const options = descriptor?.options ?? {};
        if (options.hidden) {
          return null;
        }

        const focused = index === state.index;
        const label =
          typeof options.title === "string" ? options.title : route.name;
        const activeTintColor =
          options.tabBarActiveTintColor ?? TOKENS.colors.primary;
        const inactiveTintColor =
          options.tabBarInactiveTintColor ?? TOKENS.colors.muted;
        const tintColor = focused ? activeTintColor : inactiveTintColor;
        const rawBadge = options.tabBarBadge;
        const badgeText =
          typeof rawBadge === "number"
            ? rawBadge > 99
              ? "99+"
              : String(rawBadge)
            : typeof rawBadge === "string"
              ? rawBadge
              : null;

        const onPress = () => {
          const event = emitter.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigateToTab(route.key);
          }
        };

        const onLongPress = () => {
          emitter.emit({
            type: "tabLongPress",
            target: route.key,
          });
        };

        return (
          <Pressable
            key={route.key}
            testID={options.tabBarButtonTestID ?? `tab-${route.name}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            onPress={onPress}
            onLongPress={onLongPress}
            style={({ pressed }) => [
              styles.tabItem,
              pressed && styles.tabItemPressed,
            ]}
          >
            <View
              testID={`tab-indicator-${route.name}`}
              style={[styles.topIndicator, focused && styles.topIndicatorActive]}
            />
            <View
              testID={`tab-pill-${route.name}`}
              style={[styles.iconPill, focused && styles.iconPillActive]}
            >
              {options.tabBarIcon?.({
                focused,
                color: tintColor,
                size: 20,
              })}
              {badgeText ? (
                <View
                  testID={`tab-badge-${route.name}`}
                  style={styles.badgeBubble}
                >
                  <Text style={styles.badgeBubbleText}>{badgeText}</Text>
                </View>
              ) : null}
            </View>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[
                styles.tabLabel,
                focused ? styles.tabLabelActive : styles.tabLabelInactive,
                { color: tintColor },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const unstable_settings = {
  anchor: "kasir",
};

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, TOKENS.spacing.sm);
  const heldOrdersCount = usePosCartStore(selectHeldOrdersCount);

  return (
    <Tabs
      backBehavior="initialRoute"
      tabBar={(props) => <VelocityTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: TOKENS.colors.primary,
        tabBarInactiveTintColor: TOKENS.colors.muted,
        tabBarStyle: {
          backgroundColor: TOKENS.colors.surfaceCard,
          borderTopWidth: 1,
          borderTopColor: TOKENS.colors.borderSubtle,
          height: TOKENS.spacing.tabBarHeight + bottomPadding,
          paddingBottom: bottomPadding,
          elevation: 0,
          shadowOpacity: 0,
        },
      }}
    >
      <Tabs.Screen
        name="kasir"
        options={{
          title: "Kasir",
          tabBarButtonTestID: "tab-kasir",
          tabBarAccessibilityLabel: "Kasir",
          tabBarIcon: ({ color, size }) => (
            <Calculator size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="produk"
        options={{
          title: "Produk",
          tabBarButtonTestID: "tab-produk",
          tabBarAccessibilityLabel: "Produk",
          tabBarIcon: ({ color, size }) => <Package size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pesanan"
        options={{
          title: "Pesanan",
          tabBarButtonTestID: "tab-pesanan",
          tabBarAccessibilityLabel:
            heldOrdersCount > 0
              ? `Pesanan (${heldOrdersCount} nota tertunda)`
              : "Pesanan",
          tabBarBadge: heldOrdersCount > 0 ? heldOrdersCount : undefined,
          tabBarIcon: ({ color, size }) => (
            <ReceiptText size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pengaturan"
        options={{
          title: "Pengaturan",
          tabBarButtonTestID: "tab-pengaturan",
          tabBarAccessibilityLabel: "Pengaturan",
          tabBarIcon: ({ color, size }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    backgroundColor: TOKENS.colors.surfaceCard,
    borderTopWidth: 1,
    borderTopColor: TOKENS.colors.borderSubtle,
  },
  tabItem: {
    flex: 1,
    minHeight: TOKENS.spacing.touchTarget,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: TOKENS.spacing.xs,
    paddingHorizontal: TOKENS.spacing.xs,
    gap: TOKENS.spacing.xs,
    position: "relative",
  },
  tabItemPressed: {
    opacity: 0.78,
  },
  topIndicator: {
    position: "absolute",
    top: 0,
    left: TOKENS.spacing.md,
    right: TOKENS.spacing.md,
    height: 2,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: "transparent",
  },
  topIndicatorActive: {
    backgroundColor: TOKENS.colors.primary,
  },
  iconPill: {
    width: TOKENS.spacing.touchTarget,
    height: 28,
    borderRadius: TOKENS.radii.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    position: "relative",
  },
  iconPillActive: {
    backgroundColor: TOKENS.colors.primaryFixed,
  },
  badgeBubble: {
    position: "absolute",
    top: -4,
    right: 0,
    minWidth: 20,
    height: 20,
    paddingHorizontal: TOKENS.spacing.xs,
    borderRadius: 999,
    backgroundColor: TOKENS.colors.destructive,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeBubbleText: {
    fontFamily: FONT_FAMILY.monoSemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.typography.label,
    color: TOKENS.colors.onPrimary,
  },
  tabLabel: {
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    textAlign: "center",
  },
  tabLabelActive: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    color: TOKENS.colors.primary,
  },
  tabLabelInactive: {
    fontFamily: FONT_FAMILY.body,
    color: TOKENS.colors.muted,
  },
});
