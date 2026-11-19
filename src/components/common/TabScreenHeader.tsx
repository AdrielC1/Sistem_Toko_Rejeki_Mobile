import React, { useEffect, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Cloud,
  RefreshCw,
  TriangleAlert,
  Wifi,
  WifiOff,
} from "lucide-react-native";
import { useSyncEngine } from "@/context/SyncEngineContext";
import { useSystemStatus } from "@/context/SystemStatusContext";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";

export interface TabScreenHeaderProps {
  title: string;
  icon: React.ReactNode;
  rightSlot?: React.ReactNode;
  showStatusSubBar?: boolean;
  bannerSlot?: React.ReactNode;
  testID?: string;
}

export function TabScreenHeader({
  title,
  icon,
  rightSlot,
  showStatusSubBar = true,
  bannerSlot,
  testID,
}: TabScreenHeaderProps) {
  const { healthState, activeRoute, latencyMs, recheckHealth } =
    useSystemStatus();
  const { isSyncing, syncStatus, catalogCounts, triggerSyncNow } =
    useSyncEngine();

  const [reduceMotion, setReduceMotion] = useState<boolean>(false);
  const [spinValue] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) {
          setReduceMotion(Boolean(enabled));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isSyncing || reduceMotion) {
      spinValue.setValue(0);
      return;
    }

    const anim = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => {
      anim.stop();
    };
  }, [isSyncing, reduceMotion, spinValue]);

  const spinInterpolate = useMemo(
    () =>
      spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ["0deg", "360deg"],
      }),
    [spinValue]
  );

  const getRouteBadgeMeta = () => {
    if (healthState === "checking") {
      return {
        label: "Memeriksa...",
        bg: TOKENS.colors.surfaceContainer,
        border: TOKENS.colors.borderSubtle,
        text: TOKENS.colors.onSurfaceVariant,
        icon: <Wifi size={13} color={TOKENS.colors.onSurfaceVariant} />,
      };
    }
    if (healthState === "offline") {
      return {
        label: "Offline",
        bg: TOKENS.colors.errorContainer,
        border: TOKENS.colors.destructive,
        text: TOKENS.colors.destructive,
        icon: <WifiOff size={13} color={TOKENS.colors.destructive} />,
      };
    }
    if (healthState === "read_only") {
      return {
        label: "Standby Baca Saja",
        bg: TOKENS.colors.warningBg,
        border: TOKENS.colors.warningBorder,
        text: TOKENS.colors.warningText,
        icon: <TriangleAlert size={13} color={TOKENS.colors.warningText} />,
      };
    }
    if (activeRoute === "cloud") {
      return {
        label:
          latencyMs !== null ? `Cloud Online · ${latencyMs}ms` : "Cloud Online",
        bg: TOKENS.colors.cloudBg,
        border: TOKENS.colors.cloudBorder,
        text: TOKENS.colors.cloudText,
        icon: <Cloud size={13} color={TOKENS.colors.cloudText} />,
      };
    }
    return {
      label: latencyMs !== null ? `LAN Online · ${latencyMs}ms` : "LAN Online",
      bg: TOKENS.colors.successBg,
      border: TOKENS.colors.success,
      text: TOKENS.colors.successText,
      icon: <Wifi size={13} color={TOKENS.colors.successText} />,
    };
  };

  const getSyncPillLabel = (): string => {
    if (isSyncing) {
      return "Menyinkronkan...";
    }
    if (syncStatus === "paused_offline") {
      return `Jeda Offline · ${catalogCounts.products}`;
    }
    if (syncStatus === "error") {
      return "Sinkron Gagal";
    }
    return `Katalog ${catalogCounts.products}`;
  };

  const routeMeta = getRouteBadgeMeta();

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

        {showStatusSubBar ? (
          <View testID="header-status-subbar" style={styles.inlineStatusGroup}>
            <Pressable
              testID="header-sync-pill"
              accessibilityRole="button"
              accessibilityLabel={`Status sinkronisasi: ${getSyncPillLabel()}. Ketuk untuk sinkronisasi`}
              hitSlop={6}
              onPress={() => {
                void triggerSyncNow();
              }}
              style={({ pressed }) => [
                styles.syncPill,
                syncStatus === "error" && styles.syncPillError,
                pressed && styles.pressedPill,
              ]}
            >
              <Animated.View
                style={
                  isSyncing && !reduceMotion
                    ? { transform: [{ rotate: spinInterpolate }] }
                    : undefined
                }
              >
                <RefreshCw
                  size={12}
                  color={
                    syncStatus === "error"
                      ? TOKENS.colors.destructive
                      : TOKENS.colors.onPrimaryFixed
                  }
                />
              </Animated.View>
              <Text
                numberOfLines={1}
                style={[
                  styles.syncPillText,
                  syncStatus === "error" && styles.syncPillTextError,
                ]}
              >
                {getSyncPillLabel()}
              </Text>
            </Pressable>

            <Pressable
              testID="header-route-status-pill"
              accessibilityRole="button"
              accessibilityLabel={`Status koneksi: ${routeMeta.label}. Ketuk untuk periksa ulang`}
              hitSlop={6}
              onPress={() => {
                void recheckHealth();
              }}
              style={({ pressed }) => [
                styles.statusPill,
                {
                  backgroundColor: routeMeta.bg,
                  borderColor: routeMeta.border,
                },
                pressed && styles.pressedPill,
              ]}
            >
              {routeMeta.icon}
              <Text
                numberOfLines={1}
                style={[styles.statusPillText, { color: routeMeta.text }]}
              >
                {routeMeta.label}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
      </View>

      {bannerSlot ? <View style={styles.bannerSlot}>{bannerSlot}</View> : null}
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
    paddingVertical: TOKENS.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: TOKENS.spacing.xs,
  },
  titleGroup: {
    flexShrink: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconWrap: {
    flexShrink: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  titleText: {
    flexShrink: 1,
    fontFamily: FONT_FAMILY.heading,
    fontSize: 18,
    lineHeight: 22,
    color: TOKENS.colors.onSurface,
  },
  rightSlot: {
    flexShrink: 0,
  },
  inlineStatusGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    flexShrink: 1,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: TOKENS.spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 1,
  },
  statusPillText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 11,
    lineHeight: 15,
  },
  syncPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: TOKENS.spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: TOKENS.colors.primaryFixed,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    flexShrink: 0,
  },
  syncPillError: {
    backgroundColor: TOKENS.colors.errorContainer,
    borderColor: TOKENS.colors.destructive,
  },
  syncPillText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 11,
    lineHeight: 15,
    color: TOKENS.colors.onPrimaryFixed,
  },
  syncPillTextError: {
    color: TOKENS.colors.destructive,
  },
  pressedPill: {
    opacity: 0.78,
  },
  bannerSlot: {
    paddingBottom: TOKENS.spacing.sm,
  },
});
