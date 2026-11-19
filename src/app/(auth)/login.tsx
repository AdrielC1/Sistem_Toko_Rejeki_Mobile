import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowRight,
  Clock,
  Eye,
  EyeOff,
  Lock,
  User,
} from "lucide-react-native";
import { ServerUrlPanel } from "@/components/common/ServerUrlPanel";
import {
  FeedbackBanner,
  InputField,
  PrimaryButton,
  SurfaceCard,
  type InputFieldHandle,
} from "@/components/ui/VelocityPrimitives";
import { useAuth } from "@/context/AuthContext";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";

export default function LoginScreen() {
  const {
    isLoggingIn,
    retryAfterSeconds,
    authError,
    sessionNotice,
    serverConfig,
    storeSettings,
    login,
    saveServerConfig,
    testDualServerUrl,
    clearAuthFeedback,
  } = useAuth();

  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [failedLogoUri, setFailedLogoUri] = useState<string | null>(null);
  const passwordInputRef = useRef<InputFieldHandle | null>(null);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const storeName = storeSettings?.storeName?.trim() || "Toko Rejeki";
  const storeLogo = storeSettings?.storeLogo?.trim() || "";
  const hasLogo = storeLogo.length > 0 && failedLogoUri !== storeLogo;

  const isThrottled = retryAfterSeconds > 0;
  const activeError = authError ?? sessionNotice;

  const handleSubmit = async () => {
    if (isLoggingIn || isThrottled) {
      return;
    }

    if (username.trim().length > 0 && password.length > 0) {
      void Haptics.selectionAsync().catch(() => {});
    }

    try {
      const ok = await login(username, password);
      if (ok && isMountedRef.current) {
        setPassword("");
      }
    } catch {
      // AuthContext.login surfaces errors into authError; catch defensively against unhandled rejections.
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.cardWrapper}>
            <SurfaceCard style={styles.loginCard}>
              <View style={styles.brandHeader}>
                <View
                  testID="store-brand-badge"
                  style={[
                    styles.brandBadge,
                    !hasLogo && styles.brandBadgeFallback,
                  ]}
                >
                  {hasLogo ? (
                    <Image
                      testID="store-logo-image"
                      source={{ uri: storeLogo }}
                      accessibilityLabel={storeName}
                      style={styles.brandLogoImage}
                      resizeMode="cover"
                      onError={() => setFailedLogoUri(storeLogo)}
                    />
                  ) : (
                    <Text style={styles.brandMonogram}>TR</Text>
                  )}
                </View>

                <Text style={styles.storeTitle}>{storeName}</Text>
                <Text style={styles.storeSubtitle}>
                  Sistem Kasir &amp; Manajemen Toko
                </Text>
              </View>

              {!serverConfig.primaryUrl && !serverConfig.fallbackUrl ? (
                <FeedbackBanner
                  testID="server-unconfigured-banner"
                  variant="info"
                  title="Alamat Server Belum Terhubung"
                  message="Buka panel Alamat Server API, masukkan URL server LAN atau Cloud toko, lalu ketuk Tes Koneksi Server."
                />
              ) : null}

              <ServerUrlPanel
                savedServerConfig={serverConfig}
                onSaveConfig={saveServerConfig}
                onTestDualConnection={testDualServerUrl}
              />

              {isThrottled ? (
                <FeedbackBanner
                  testID="login-throttle-banner"
                  variant="warning"
                  icon={<Clock size={18} color={TOKENS.colors.warningText} />}
                  message={`Terlalu banyak percobaan gagal. Coba lagi dalam ${retryAfterSeconds} detik.`}
                />
              ) : activeError ? (
                <FeedbackBanner
                  testID="login-error-banner"
                  variant="error"
                  message={activeError}
                />
              ) : null}

              <View style={styles.formStack}>
                <InputField
                  testID="login-username-input"
                  label="Username"
                  value={username}
                  onChangeText={(text) => {
                    setUsername(text);
                    if (activeError) {
                      clearAuthFeedback();
                    }
                  }}
                  placeholder="Masukkan username..."
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                  leadingIcon={<User size={16} color={TOKENS.colors.outline} />}
                />

                <InputField
                  testID="login-password-input"
                  inputRef={passwordInputRef}
                  label="Kata Sandi"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (activeError) {
                      clearAuthFeedback();
                    }
                  }}
                  placeholder="Masukkan kata sandi..."
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="current-password"
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    void handleSubmit();
                  }}
                  leadingIcon={<Lock size={16} color={TOKENS.colors.outline} />}
                  trailingAction={{
                    testID: "toggle-password-visibility",
                    accessibilityLabel: showPassword
                      ? "Sembunyikan kata sandi"
                      : "Tampilkan kata sandi",
                    onPress: () => setShowPassword((prev) => !prev),
                    icon: showPassword ? (
                      <EyeOff size={16} color={TOKENS.colors.onSurfaceVariant} />
                    ) : (
                      <Eye size={16} color={TOKENS.colors.onSurfaceVariant} />
                    ),
                  }}
                />

                <PrimaryButton
                  testID="login-submit-button"
                  label={
                    isThrottled
                      ? `Tunggu ${retryAfterSeconds} Detik...`
                      : "Masuk ke Sistem"
                  }
                  loading={isLoggingIn}
                  loadingLabel="Memeriksa Akses..."
                  disabled={isLoggingIn || isThrottled}
                  // Arrow signals forward authentication entry into the POS shell
                  icon={
                    !isLoggingIn && !isThrottled ? (
                      <ArrowRight size={18} color={TOKENS.colors.onPrimary} />
                    ) : undefined
                  }
                  onPress={() => {
                    void handleSubmit();
                  }}
                  style={styles.submitButton}
                />
              </View>
            </SurfaceCard>

            <Text style={styles.footerText}>
              POS Terminal V1 {"\u2022"} {storeName}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: TOKENS.colors.background,
  },
  flexOne: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: TOKENS.spacing.md,
    paddingVertical: TOKENS.spacing.xl,
  },
  cardWrapper: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },
  loginCard: {
    width: "100%",
    padding: TOKENS.spacing.lg,
    borderRadius: TOKENS.radii.lg,
    gap: TOKENS.spacing.md,
  },
  brandHeader: {
    alignItems: "center",
    gap: TOKENS.spacing.xs,
  },
  brandBadge: {
    width: TOKENS.spacing.logoBox,
    height: TOKENS.spacing.logoBox,
    borderRadius: TOKENS.radii.lg,
    borderWidth: 2,
    borderColor: TOKENS.colors.primary,
    backgroundColor: TOKENS.colors.surfaceCard,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: TOKENS.spacing.sm,
  },
  brandBadgeFallback: {
    backgroundColor: TOKENS.colors.primaryContainer,
  },
  brandLogoImage: {
    width: TOKENS.spacing.logoBox,
    height: TOKENS.spacing.logoBox,
  },
  brandMonogram: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.display,
    lineHeight: TOKENS.lineHeight.display,
    color: TOKENS.colors.onPrimary,
  },
  storeTitle: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.display,
    lineHeight: TOKENS.lineHeight.display,
    color: TOKENS.colors.onSurface,
    textAlign: "center",
  },
  storeSubtitle: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
    textAlign: "center",
  },
  formStack: {
    width: "100%",
    gap: TOKENS.spacing.md,
  },
  submitButton: {
    marginTop: TOKENS.spacing.xs,
  },
  footerText: {
    marginTop: TOKENS.spacing.lg,
    textAlign: "center",
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.muted,
  },
});
