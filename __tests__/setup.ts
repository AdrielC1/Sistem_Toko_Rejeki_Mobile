const mockSecureStoreMap = new Map<string, string>();
const mockKvStoreMap = new Map<string, string>();

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecureStoreMap.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStoreMap.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStoreMap.delete(key);
  }),
  getItem: jest.fn((key: string) => mockSecureStoreMap.get(key) ?? null),
  setItem: jest.fn((key: string, value: string) => {
    mockSecureStoreMap.set(key, value);
  }),
  isAvailableAsync: jest.fn(async () => true),
}));

jest.mock("expo-sqlite/kv-store", () => {
  const getItemSync = jest.fn((key: string) => mockKvStoreMap.get(key) ?? null);
  const setItemSync = jest.fn((key: string, value: string | ((prev: string | null) => string)) => {
    const next = typeof value === "function" ? value(mockKvStoreMap.get(key) ?? null) : value;
    mockKvStoreMap.set(key, next);
  });
  const removeItemSync = jest.fn((key: string) => mockKvStoreMap.delete(key));
  const getAllKeysSync = jest.fn(() => Array.from(mockKvStoreMap.keys()));
  const clearSync = jest.fn(() => {
    mockKvStoreMap.clear();
    return true;
  });

  const getItemAsync = jest.fn(async (key: string) => getItemSync(key));
  const setItemAsync = jest.fn(async (key: string, value: string | ((prev: string | null) => string)) => {
    setItemSync(key, value);
  });
  const removeItemAsync = jest.fn(async (key: string) => removeItemSync(key));
  const getAllKeysAsync = jest.fn(async () => getAllKeysSync());
  const clearAsync = jest.fn(async () => clearSync());

  const storageInstance = {
    getItemSync,
    setItemSync,
    removeItemSync,
    getAllKeysSync,
    clearSync,
    getItemAsync,
    setItemAsync,
    removeItemAsync,
    getAllKeysAsync,
    clearAsync,
    getItem: getItemAsync,
    setItem: setItemAsync,
    removeItem: jest.fn(async (key: string) => {
      mockKvStoreMap.delete(key);
    }),
    getAllKeys: getAllKeysAsync,
    clear: jest.fn(async () => {
      mockKvStoreMap.clear();
    }),
  };

  return {
    __esModule: true,
    default: storageInstance,
    AsyncStorage: storageInstance,
    Storage: storageInstance,
    getItemSync,
    setItemSync,
    removeItemSync,
    getItemAsync,
    setItemAsync,
    removeItemAsync,
  };
});

jest.mock("expo/fetch", () => ({
  fetch: jest.fn((...args: Parameters<typeof globalThis.fetch>) => globalThis.fetch(...args)),
}));

jest.mock("expo-font", () => ({
  useFonts: jest.fn(() => [true, null] as const),
  isLoaded: jest.fn(() => true),
  loadAsync: jest.fn(async () => {}),
}));

jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(async () => true),
  hideAsync: jest.fn(async () => true),
  hide: jest.fn(),
}));

jest.mock("expo-network", () => ({
  NetworkStateType: {
    NONE: "NONE",
    UNKNOWN: "UNKNOWN",
    CELLULAR: "CELLULAR",
    WIFI: "WIFI",
    BLUETOOTH: "BLUETOOTH",
    ETHERNET: "ETHERNET",
    WIMAX: "WIMAX",
    VPN: "VPN",
    OTHER: "OTHER",
  },
  getNetworkStateAsync: jest.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
    type: "WIFI",
  })),
  useNetworkState: jest.fn(() => ({
    isConnected: true,
    isInternetReachable: true,
    type: "WIFI",
  })),
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock("expo-haptics", () => ({
  ImpactFeedbackStyle: {
    Light: "light",
    Medium: "medium",
    Heavy: "heavy",
    Rigid: "rigid",
    Soft: "soft",
  },
  NotificationFeedbackType: {
    Success: "success",
    Warning: "warning",
    Error: "error",
  },
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  selectionAsync: jest.fn(async () => {}),
}));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  const actual = jest.requireActual("react-native-safe-area-context");
  const mockMetrics = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  };

  return {
    ...actual,
    __esModule: true,
    initialWindowMetrics: mockMetrics,
    SafeAreaProvider: ({
      children,
      initialMetrics,
    }: {
      children?: React.ReactNode;
      initialMetrics?: {
        frame?: typeof mockMetrics.frame;
        insets?: typeof mockMetrics.insets;
      };
    }) =>
      React.createElement(
        actual.SafeAreaFrameContext.Provider,
        { value: initialMetrics?.frame ?? mockMetrics.frame },
        React.createElement(
          actual.SafeAreaInsetsContext.Provider,
          { value: initialMetrics?.insets ?? mockMetrics.insets },
          children
        )
      ),
    SafeAreaView: View,
    useSafeAreaInsets: () =>
      React.useContext(actual.SafeAreaInsetsContext) ?? mockMetrics.insets,
    useSafeAreaFrame: () =>
      React.useContext(actual.SafeAreaFrameContext) ?? mockMetrics.frame,
  };
});

export function resetTestStorage(): void {
  mockSecureStoreMap.clear();
  mockKvStoreMap.clear();
}
