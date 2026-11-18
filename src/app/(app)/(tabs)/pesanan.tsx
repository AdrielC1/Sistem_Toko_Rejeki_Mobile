import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Calculator, ReceiptText } from "lucide-react-native";
import { EmptyStateCard } from "@/components/common/EmptyStateCard";
import { TabScreenHeader } from "@/components/common/TabScreenHeader";
import { PrimaryButton } from "@/components/ui/VelocityPrimitives";
import { TOKENS } from "@/theme/tokens";

export default function PesananScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <TabScreenHeader
        testID="pesanan-header"
        title="Pesanan"
        icon={<ReceiptText size={24} color={TOKENS.colors.primary} />}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <EmptyStateCard
          testID="pesanan-empty-card"
          icon={<ReceiptText size={24} color={TOKENS.colors.primary} />}
          title="Belum Ada Pesanan Tertunda"
          description="Nota transaksi yang ditahan secara lokal di perangkat akan tampil di sini setelah modul kasir aktif. Ketuk Ke Layar Kasir untuk melihat shell kasir."
          action={
            <PrimaryButton
              testID="pesanan-open-kasir-button"
              label="Ke Layar Kasir"
              icon={<Calculator size={18} color={TOKENS.colors.onPrimary} />}
              onPress={() => {
                router.push("/kasir");
              }}
            />
          }
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: TOKENS.colors.background,
  },
  scrollContent: {
    paddingHorizontal: TOKENS.spacing.md,
    paddingTop: TOKENS.spacing.md,
    paddingBottom: TOKENS.spacing.lg,
    gap: TOKENS.spacing.md,
  },
});
