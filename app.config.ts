import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Toko Rejeki POS",
  slug: "toko-rejeki-mobile",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "tokorejekipos",
  userInterfaceStyle: "light",
  backgroundColor: "#f9f9ff",
  icon: "./assets/images/icon.png",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.tokorejeki.posmobile",
    infoPlist: {
      NSLocalNetworkUsageDescription:
        "Aplikasi memerlukan akses jaringan lokal (Wi-Fi toko) untuk terhubung ke server API Toko Rejeki.",
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: false,
        NSAllowsLocalNetworking: true,
      },
    },
  },
  android: {
    package: "com.tokorejeki.posmobile",
    predictiveBackGestureEnabled: false,
    permissions: [
      "BLUETOOTH",
      "BLUETOOTH_ADMIN",
      "BLUETOOTH_CONNECT",
      "BLUETOOTH_SCAN",
    ],
    adaptiveIcon: {
      backgroundColor: "#00478d",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "with-rn-bluetooth-classic",
      {
        peripheralUsageDescription:
          "Aplikasi memerlukan akses Bluetooth untuk mencetak struk ke printer thermal ESC/POS.",
        bluetoothAlwaysPermission:
          "Aplikasi memerlukan akses Bluetooth untuk terhubung ke printer thermal kasir.",
      },
    ],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#00478d",
        image: "./assets/images/splash-icon.png",
        imageWidth: 96,
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          usesCleartextTraffic: true,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: "ff8b8981-a621-4656-856b-c90dceda24f6",
    },
  },
});
