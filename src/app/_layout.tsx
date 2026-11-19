import React, { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { HankenGrotesk_600SemiBold } from "@expo-google-fonts/hanken-grotesk";
import { Inter_400Regular, Inter_600SemiBold } from "@expo-google-fonts/inter";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_600SemiBold,
} from "@expo-google-fonts/jetbrains-mono";
import {
  SafeAreaProvider,
  initialWindowMetrics,
  type Metrics,
} from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { initBluetoothEscPosDriver } from "@/services/print/bluetoothDriver";

void SplashScreen.preventAutoHideAsync().catch(() => {});
initBluetoothEscPosDriver();

const DEFAULT_SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { user, isHydrated } = useAuth();
  const isReady = isHydrated && fontsReady;

  useEffect(() => {
    if (isReady) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  const isAuthenticated = Boolean(user);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={!isAuthenticated} redirectTo="/kasir">
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated} redirectTo="/login">
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    HankenGrotesk_600SemiBold,
    Inter_400Regular,
    Inter_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_600SemiBold,
  });

  const fontsReady = fontsLoaded || Boolean(fontError);

  return (
    <SafeAreaProvider
      initialMetrics={initialWindowMetrics ?? DEFAULT_SAFE_AREA_METRICS}
    >
      <AuthProvider>
        <RootNavigator fontsReady={fontsReady} />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
