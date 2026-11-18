import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronDown, ChevronUp, Server, Wifi } from "lucide-react-native";
import {
  FeedbackBanner,
  InputField,
  SecondaryButton,
} from "@/components/ui/VelocityPrimitives";
import {
  SERVER_URL_HINTS,
  SERVER_URL_INVALID_ERROR,
} from "@/services/storage/serverConfig";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";
import type { ConnectionTestResult } from "@/types";

export interface ServerUrlPanelProps {
  savedServerUrl: string | null;
  onSaveUrl: (
    rawUrl: string
  ) => { ok: true; url: string } | { ok: false; error: string };
  onTestConnection: (rawUrl: string) => Promise<ConnectionTestResult>;
  defaultExpanded?: boolean;
}

interface PanelFeedback {
  variant: "success" | "error";
  title?: string;
  message: string;
}

export function ServerUrlPanel({
  savedServerUrl,
  onSaveUrl,
  onTestConnection,
  defaultExpanded,
}: ServerUrlPanelProps) {
  const [expanded, setExpanded] = useState<boolean>(
    defaultExpanded ?? !savedServerUrl
  );
  const [prevSavedUrl, setPrevSavedUrl] = useState<string | null>(
    savedServerUrl
  );
  const [draftUrl, setDraftUrl] = useState<string>(savedServerUrl ?? "");
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<PanelFeedback | null>(null);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  if (savedServerUrl !== prevSavedUrl) {
    setPrevSavedUrl(savedServerUrl);
    setDraftUrl(savedServerUrl ?? "");
    if (
      savedServerUrl &&
      draftUrl.trim().length === 0 &&
      defaultExpanded === undefined
    ) {
      setExpanded(false);
    }
  }

  const handleToggle = () => {
    setExpanded((prev) => !prev);
  };

  const handleSelectHint = (hintUrl: string) => {
    if (isTesting) {
      return;
    }
    setDraftUrl(hintUrl);
    setFeedback(null);
  };

  const handleSave = () => {
    if (isTesting) {
      return;
    }
    const result = onSaveUrl(draftUrl);
    if (!result.ok) {
      setFeedback({
        variant: "error",
        message: result.error || SERVER_URL_INVALID_ERROR,
      });
      return;
    }

    setDraftUrl(result.url);
    setFeedback({
      variant: "success",
      title: "Alamat Server Disimpan",
      message: result.url,
    });
  };

  const handleTestConnection = async () => {
    if (isTesting) {
      return;
    }
    setIsTesting(true);
    setFeedback(null);

    try {
      const result = await onTestConnection(draftUrl);
      if (!isMountedRef.current) {
        return;
      }
      if (!result.ok) {
        setFeedback({
          variant: "error",
          message: result.error || SERVER_URL_INVALID_ERROR,
        });
        return;
      }

      const storeLabel = result.storeSettings?.storeName ?? "Toko Rejeki";
      setFeedback({
        variant: "success",
        title: "Server Terhubung",
        message: `${storeLabel} merespons (${result.latencyMs} ms).`,
      });
    } catch {
      if (isMountedRef.current) {
        setFeedback({
          variant: "error",
          message: SERVER_URL_INVALID_ERROR,
        });
      }
    } finally {
      if (isMountedRef.current) {
        setIsTesting(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        testID="server-url-panel-toggle"
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel="Ubah alamat server API"
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
            {savedServerUrl || "Belum diatur"}
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
            label="URL Server Toko"
            value={draftUrl}
            editable={!isTesting}
            onChangeText={(text) => {
              if (isTesting) {
                return;
              }
              setDraftUrl(text);
              if (feedback) {
                setFeedback(null);
              }
            }}
            placeholder={SERVER_URL_HINTS.lanExample}
            helperText={`Contoh LAN: ${SERVER_URL_HINTS.lanExample} atau Emulator Android: ${SERVER_URL_HINTS.androidEmulator}`}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            monospace
            invalid={feedback?.variant === "error"}
          />

          <View style={styles.hintRow}>
            <Pressable
              testID="server-hint-lan"
              disabled={isTesting}
              onPress={() => handleSelectHint(SERVER_URL_HINTS.lanExample)}
              accessibilityRole="button"
              accessibilityState={{ disabled: isTesting }}
              accessibilityLabel={`Gunakan contoh LAN ${SERVER_URL_HINTS.lanExample}`}
              style={({ pressed }) => [
                styles.hintChip,
                isTesting && styles.hintChipDisabled,
                pressed && !isTesting && styles.triggerPressed,
              ]}
            >
              <Text style={styles.hintChipText}>
                LAN ({SERVER_URL_HINTS.lanExample})
              </Text>
            </Pressable>
            <Pressable
              testID="server-hint-emulator"
              disabled={isTesting}
              onPress={() => handleSelectHint(SERVER_URL_HINTS.androidEmulator)}
              accessibilityRole="button"
              accessibilityState={{ disabled: isTesting }}
              accessibilityLabel={`Gunakan Emulator Android ${SERVER_URL_HINTS.androidEmulator}`}
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
