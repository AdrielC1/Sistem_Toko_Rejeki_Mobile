import React, { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Save, Store, Trash2, Upload } from "lucide-react-native";
import {
  FeedbackBanner,
  InputField,
  PrimaryButton,
  SecondaryButton,
  SurfaceCard,
} from "@/components/ui/VelocityPrimitives";
import { useAuth } from "@/context/AuthContext";
import { useSystemStatus } from "@/context/SystemStatusContext";
import { updateStoreSettings } from "@/services/api/settingsApi";
import { pickAndCompressStoreLogoBase64 } from "@/services/media/logoImagePicker";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";

export default function PengaturanStoreProfileScreen() {
  const router = useRouter();
  const { storeSettings, serverConfig, refreshStoreSettings } = useAuth();
  const { healthState, isDeviceConnected, dbOnline } = useSystemStatus();

  const [storeName, setStoreName] = useState<string>(
    storeSettings?.storeName ?? "Toko Rejeki"
  );
  const [storeAddress, setStoreAddress] = useState<string>(
    storeSettings?.storeAddress ?? ""
  );
  const [storePhone, setStorePhone] = useState<string>(
    storeSettings?.storePhone ?? ""
  );
  const [storeLogo, setStoreLogo] = useState<string>(
    storeSettings?.storeLogo ?? ""
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [banner, setBanner] = useState<{
    variant: "success" | "error";
    message: string;
  } | null>(null);

  const canWriteOnline =
    isDeviceConnected &&
    dbOnline &&
    healthState !== "offline" &&
    healthState !== "read_only";

  const handlePickLogo = async () => {
    setBanner(null);
    const res = await pickAndCompressStoreLogoBase64();
    if (res.status === "success") {
      setStoreLogo(res.dataUri);
    } else if (res.status === "error") {
      setBanner({ variant: "error", message: res.message });
    }
  };

  const handleSave = async () => {
    if (isSaving || !canWriteOnline) {
      return;
    }
    if (!storeName.trim()) {
      setBanner({ variant: "error", message: "Nama toko wajib diisi." });
      return;
    }

    setIsSaving(true);
    setBanner(null);
    try {
      const res = await updateStoreSettings(serverConfig, {
        storeName: storeName.trim(),
        storeAddress: storeAddress.trim(),
        storePhone: storePhone.trim(),
        storeLogo: storeLogo.trim(),
      });
      if (res.ok) {
        await refreshStoreSettings();
        setBanner({
          variant: "success",
          message: "Profil toko berhasil diperbarui.",
        });
      } else {
        setBanner({
          variant: "error",
          message: res.error ?? "Gagal menyimpan profil toko.",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top"]} style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <ChevronLeft size={22} color={TOKENS.colors.onSurface} />
        </Pressable>
        <Text style={styles.topTitle}>Profil &amp; Logo Toko</Text>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {!canWriteOnline ? (
          <FeedbackBanner
            variant="warning"
            message="Koneksi server/database offline. Perubahan profil toko membutuhkan koneksi aktif."
          />
        ) : null}

        {banner ? (
          <FeedbackBanner
            testID="store-profile-feedback"
            variant={banner.variant}
            message={banner.message}
          />
        ) : null}

        <SurfaceCard style={styles.card}>
          <View style={styles.logoSection}>
            <View style={styles.logoPreviewBox}>
              {storeLogo.trim().length > 0 ? (
                <Image
                  testID="store-profile-logo-preview"
                  source={{ uri: storeLogo }}
                  style={styles.logoImage}
                  resizeMode="cover"
                />
              ) : (
                <Store size={28} color={TOKENS.colors.onPrimary} />
              )}
            </View>
            <View style={styles.logoButtonsCol}>
              <SecondaryButton
                testID="store-profile-pick-logo"
                variant="tonal"
                label="Pilih Logo dari Galeri"
                icon={<Upload size={16} color={TOKENS.colors.onPrimaryFixed} />}
                onPress={() => {
                  void handlePickLogo();
                }}
              />
              {storeLogo.trim().length > 0 ? (
                <SecondaryButton
                  testID="store-profile-clear-logo"
                  variant="danger-outline"
                  label="Hapus Logo"
                  icon={<Trash2 size={16} color={TOKENS.colors.destructive} />}
                  onPress={() => setStoreLogo("")}
                />
              ) : null}
            </View>
          </View>

          <InputField
            testID="store-profile-name-input"
            label="Nama Toko"
            value={storeName}
            onChangeText={setStoreName}
            placeholder="Contoh: Toko Rejeki"
          />
          <InputField
            testID="store-profile-address-input"
            label="Alamat Toko"
            value={storeAddress}
            onChangeText={setStoreAddress}
            placeholder="Jl. Dargo No. 9, Semarang"
          />
          <InputField
            testID="store-profile-phone-input"
            label="Nomor Telepon / WhatsApp"
            value={storePhone}
            onChangeText={setStorePhone}
            placeholder="0822..."
            keyboardType="phone-pad"
            monospace
          />

          <PrimaryButton
            testID="store-profile-save-button"
            label="Simpan Profil Toko"
            loading={isSaving}
            loadingLabel="Menyimpan..."
            disabled={isSaving || !canWriteOnline}
            icon={<Save size={18} color={TOKENS.colors.onPrimary} />}
            onPress={() => {
              void handleSave();
            }}
          />
        </SurfaceCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: TOKENS.colors.background,
  },
  topBar: {
    backgroundColor: TOKENS.colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.colors.borderSubtle,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: TOKENS.spacing.sm,
    paddingBottom: TOKENS.spacing.sm,
    gap: TOKENS.spacing.sm,
  },
  backBtn: {
    width: TOKENS.spacing.touchTarget,
    height: TOKENS.spacing.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    flex: 1,
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.heading,
    lineHeight: TOKENS.lineHeight.heading,
    color: TOKENS.colors.onSurface,
  },
  scrollContent: {
    padding: TOKENS.spacing.md,
    gap: TOKENS.spacing.md,
  },
  card: {
    gap: TOKENS.spacing.md,
  },
  logoSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.md,
  },
  logoPreviewBox: {
    width: TOKENS.spacing.logoBox,
    height: TOKENS.spacing.logoBox,
    borderRadius: TOKENS.radii.md,
    backgroundColor: TOKENS.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  logoImage: {
    width: TOKENS.spacing.logoBox,
    height: TOKENS.spacing.logoBox,
  },
  logoButtonsCol: {
    flex: 1,
    gap: TOKENS.spacing.xs,
  },
});
