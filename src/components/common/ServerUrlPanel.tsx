import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  ChevronDown,
  ChevronUp,
  Cloud,
  Server,
  Wifi,
} from "lucide-react-native";
import {
  FeedbackBanner,
  InputField,
  SecondaryButton,
} from "@/components/ui/VelocityPrimitives";
import {
  DEFAULT_CLOUD_SERVER_URL,
  DEFAULT_PRIMARY_SERVER_URL,
  DUAL_SERVER_UNREACHABLE_ERROR,
  SERVER_URL_HINTS,
} from "@/services/storage/serverConfig";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";
import type { ConnectionTestResult, ServerUrlConfig } from "@/types";

export interface ServerUrlPanelProps {
  savedServerConfig: ServerUrlConfig;
  onSaveConfig: (raw: {
    primaryUrl?: string | null;
    fallbackUrl?: string | null;
  }) => { ok: true; config: ServerUrlConfig } | { ok: false; error: string };
  onTestDualConnection: (raw: {
    primaryUrl?: string | null;
    fallbackUrl?: string | null;
  }) => Promise<ConnectionTestResult>;
  defaultExpanded?: boolean;
}

interface PanelFeedback {
  variant: "success" | "error";
  title?: string;
  message: string;
}

export function ServerUrlPanel({
  savedServerConfig,
  onSaveConfig,
  onTestDualConnection,
  defaultExpanded,
}: ServerUrlPanelProps) {
  const hasAnySaved = Boolean(
    savedServerConfig.primaryUrl || savedServerConfig.fallbackUrl
  );
  const [expanded, setExpanded] = useState<boolean>(
    defaultExpanded ?? !hasAnySaved
  );
  const [prevConfigKey, setPrevConfigKey] = useState<string>(
    `${savedServerConfig.primaryUrl ?? ""}|${savedServerConfig.fallbackUrl ?? ""}`
  );
  const [draftPrimaryUrl, setDraftPrimaryUrl] = useState<string>(
    savedServerConfig.primaryUrl ?? ""
  );
  const [draftFallbackUrl, setDraftFallbackUrl] = useState<string>(
    savedServerConfig.fallbackUrl ?? ""
  );
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<PanelFeedback | null>(null);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const currentConfigKey = `${savedServerConfig.primaryUrl ?? ""}|${savedServerConfig.fallbackUrl ?? ""}`;
  if (currentConfigKey !== prevConfigKey) {
    const wasDraftEmpty =
      draftPrimaryUrl.trim().length === 0 &&
      draftFallbackUrl.trim().length === 0;
    setPrevConfigKey(currentConfigKey);
    setDraftPrimaryUrl(savedServerConfig.primaryUrl ?? "");
    setDraftFallbackUrl(savedServerConfig.fallbackUrl ?? "");
    if (hasAnySaved && wasDraftEmpty && defaultExpanded === undefined) {
      setExpanded(false);
    }
  }

  const handleToggle = () => {
    setExpanded((prev) => !prev);
  };

  const handleSelectLanHint = (hintUrl: string) => {
    if (isTesting) {
      return;
    }
    setDraftPrimaryUrl(hintUrl);
    setFeedback(null);
  };

  const handleSelectCloudHint = (hintUrl: string) => {
    if (isTesting) {
      return;
    }
    setDraftFallbackUrl(hintUrl);
    setFeedback(null);
  };

  const handleSave = () => {
    if (isTesting) {
      return;
    }
    const result = onSaveConfig({
      primaryUrl: draftPrimaryUrl,
      fallbackUrl: draftFallbackUrl,
    });
    if (!result.ok) {
      setFeedback({
        variant: "error",
        message: result.error,
      });
      return;
    }

    setDraftPrimaryUrl(result.config.primaryUrl ?? "");
    setDraftFallbackUrl(result.config.fallbackUrl ?? "");
    setFeedback({
      variant: "success",
      title: "Alamat Server Disimpan",
      message: [
        result.config.primaryUrl ? `LAN: ${result.config.primaryUrl}` : null,
        result.config.fallbackUrl
          ? `Cloud: ${result.config.fallbackUrl}`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  };

  const handleTestConnection = async () => {
    if (isTesting) {
      return;
    }
    setIsTesting(true);
    setFeedback(null);

    try {
      const result = await onTestDualConnection({
        primaryUrl: draftPrimaryUrl,
        fallbackUrl: draftFallbackUrl,
      });
      if (!isMountedRef.current) {
        return;
      }
      if (!result.ok) {
        setFeedback({
          variant: "error",
          message: result.error || DUAL_SERVER_UNREACHABLE_ERROR,
        });
        return;
      }

      const storeLabel = result.storeSettings?.storeName ?? "Toko Rejeki";
      const routeTitle =
        result.routeUsed === "cloud"
          ? "Server Cloud Terhubung (Cadangan)"
          : "Server LAN Terhubung";
      setFeedback({
        variant: "success",
        title: routeTitle,
        message: `${storeLabel} merespons (${result.latencyMs} ms).`,
      });
    } catch {
      if (isMountedRef.current) {
        setFeedback({
          variant: "error",
          message: DUAL_SERVER_UNREACHABLE_ERROR,
        });
      }
    } finally {
      if (isMountedRef.current) {
        setIsTesting(false);
      }
    }
  };

  const collapsedSummary = !hasAnySaved
    ? "Belum diatur"
    : savedServerConfig.primaryUrl && savedServerConfig.fallbackUrl
      ? `${savedServerConfig.primaryUrl} · Cadangan Cloud aktif`
      : (savedServerConfig.primaryUrl ??
        savedServerConfig.fallbackUrl ??
        "Belum diatur");

  return (
    <View style={styles.container}>
      <Pressable
        testID="server-url-panel-toggle"
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel="Ubah alamat server API LAN dan Cloud"
        style={({ pressed }) => [
          styles.triggerHeader,
          pressed && styles.triggerPressed,
        ]}
      >
        <Server size={16} color={TOKENS.colors.primary} />
        <View style={styles.triggerTextGroup}>
          <Text style={styles.triggerTitle}>Alamat Server API</Text>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={styles.triggerUrlPreview}
          >
            {collapsedSummary}
          </Text>
        </View>
        {expanded ? (
          <ChevronUp size={16} color={TOKENS.colors.primary} />
        ) : (
          <ChevronDown size={16} color={TOKENS.colors.primary} />
        )}
      </Pressable>

      {expanded ? (
        <View style={styles.expandedBody}>
          <InputField
            testID="server-url-input"
            label="URL Server LAN Utama"
            value={draftPrimaryUrl}
            editable={!isTesting}
            onChangeText={(text) => {
              if (isTesting) {
                return;
              }
              setDraftPrimaryUrl(text);
              if (feedback) {
                setFeedback(null);
              }
            }}
            placeholder={DEFAULT_PRIMARY_SERVER_URL}
            helperText={`Contoh LAN toko: ${DEFAULT_PRIMARY_SERVER_URL} atau Emulator: ${SERVER_URL_HINTS.androidEmulator}`}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            monospace
            invalid={feedback?.variant === "error"}
          />

          <InputField
            testID="server-cloud-url-input"
            label="URL Server Cloud Cadangan (Opsional)"
            value={draftFallbackUrl}
            editable={!isTesting}
            onChangeText={(text) => {
              if (isTesting) {
                return;
              }
              setDraftFallbackUrl(text);
              if (feedback) {
                setFeedback(null);
              }
            }}
            placeholder={DEFAULT_CLOUD_SERVER_URL}
            helperText="Jika Wi-Fi LAN toko tidak terjangkau (timeout 2 detik), aplikasi otomatis failover ke URL Cloud ini."
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            monospace
            leadingIcon={<Cloud size={15} color={TOKENS.colors.outline} />}
            invalid={feedback?.variant === "error"}
          />

          <View style={styles.hintRow}>
            <Pressable
              testID="server-hint-lan"
              disabled={isTesting}
              onPress={() => handleSelectLanHint(DEFAULT_PRIMARY_SERVER_URL)}
              accessibilityRole="button"
              accessibilityState={{ disabled: isTesting }}
              accessibilityLabel={`Isi LAN Utama ${DEFAULT_PRIMARY_SERVER_URL}`}
              style={({ pressed }) => [
                styles.hintChip,
                isTesting && styles.hintChipDisabled,
                pressed && !isTesting && styles.triggerPressed,
              ]}
            >
              <Text style={styles.hintChipText}>
                LAN ({DEFAULT_PRIMARY_SERVER_URL})
              </Text>
            </Pressable>
            <Pressable
              testID="server-hint-emulator"
              disabled={isTesting}
              onPress={() => handleSelectLanHint(SERVER_URL_HINTS.androidEmulator)}
              accessibilityRole="button"
              accessibilityState={{ disabled: isTesting }}
              accessibilityLabel={`Isi Emulator ${SERVER_URL_HINTS.androidEmulator}`}
              style={({ pressed }) => [
                styles.hintChip,
                isTesting && styles.hintChipDisabled,
                pressed && !isTesting && styles.triggerPressed,
              ]}
            >
              <Text style={styles.hintChipText}>
                Emulator ({SERVER_URL_HINTS.androidEmulator})
              </Text>
            </Pressable>
            <Pressable
              testID="server-hint-cloud"
              disabled={isTesting}
              onPress={() => handleSelectCloudHint(DEFAULT_CLOUD_SERVER_URL)}
              accessibilityRole="button"
              accessibilityState={{ disabled: isTesting }}
              accessibilityLabel={`Isi Cloud Cadangan ${DEFAULT_CLOUD_SERVER_URL}`}
              style={({ pressed }) => [
                styles.hintChip,
                isTesting && styles.hintChipDisabled,
                pressed && !isTesting && styles.triggerPressed,
              ]}
            >
              <Text style={styles.hintChipText}>
                Cloud ({DEFAULT_CLOUD_SERVER_URL})
              </Text>
            </Pressable>
          </View>

          <View style={styles.buttonRow}>
            <SecondaryButton
              testID="server-test-button"
              variant="outlined"
              label="Tes Koneksi Server"
              loadingLabel="Menguji Koneksi..."
              loading={isTesting}
              disabled={isTesting}
              icon={
                !isTesting ? (
                  <Wifi size={16} color={TOKENS.colors.primary} />
                ) : undefined
              }
              onPress={() => {
                void handleTestConnection();
              }}
              style={styles.actionButton}
            />
            <SecondaryButton
              testID="server-save-button"
              variant="tonal"
              label="Simpan Alamat Server"
              disabled={isTesting}
              onPress={handleSave}
              style={styles.actionButton}
            />
          </View>

          {feedback ? (
            <FeedbackBanner
              testID="server-url-feedback"
              variant={feedback.variant}
              title={feedback.title}
              message={feedback.message}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  triggerHeader: {
    minHeight: TOKENS.spacing.touchTarget,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: TOKENS.colors.outline,
    borderRadius: TOKENS.radii.sm,
    paddingHorizontal: TOKENS.spacing.md,
    paddingVertical: TOKENS.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.sm,
  },
  triggerPressed: {
    opacity: 0.85,
  },
  triggerTextGroup: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  triggerTitle: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurface,
  },
  triggerUrlPreview: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  expandedBody: {
    marginTop: TOKENS.spacing.md,
    gap: TOKENS.spacing.md,
  },
  hintRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: TOKENS.spacing.sm,
  },
  hintChip: {
    minHeight: TOKENS.spacing.touchTarget,
    paddingHorizontal: TOKENS.spacing.md,
    paddingVertical: TOKENS.spacing.sm,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    justifyContent: "center",
    alignItems: "center",
  },
  hintChipDisabled: {
    opacity: 0.6,
  },
  hintChipText: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: TOKENS.spacing.sm,
  },
  actionButton: {
    flexGrow: 1,
    minWidth: 160,
  },
});
