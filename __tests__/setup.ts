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

type SqlBindParam = string | number | bigint | Uint8Array | null;
type SQLiteBuiltin = {
  DatabaseSync: new (path: string) => {
    exec: (sql: string) => void;
    prepare: (sql: string) => {
      run: (...params: unknown[]) => {
        changes: number;
        lastInsertRowid: number | bigint;
      };
      get: (...params: unknown[]) => unknown;
      all: (...params: unknown[]) => unknown[];
    };
    close: () => void;
  };
};

const mockSqliteDatabases = new Map<
  string,
  InstanceType<SQLiteBuiltin["DatabaseSync"]>
>();

function mockNormalizeSqliteParams(params: unknown[]): unknown[] {
  if (params.length === 0) {
    return [];
  }
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0].map((v) => (v === undefined ? null : (v as SqlBindParam)));
  }
  if (
    params.length === 1 &&
    params[0] !== null &&
    typeof params[0] === "object" &&
    !(params[0] instanceof Uint8Array)
  ) {
    const cleanObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params[0] as Record<string, unknown>)) {
      cleanObj[k] = v === undefined ? null : v;
    }
    return [cleanObj];
  }
  return params.map((v) => (v === undefined ? null : (v as SqlBindParam)));
}

interface MockSqliteHandle {
  execAsync: (sql: string) => Promise<void>;
  runAsync: (
    sql: string,
    ...params: unknown[]
  ) => Promise<{ changes: number; lastInsertRowId: number }>;
  getFirstAsync: <T = unknown>(
    sql: string,
    ...params: unknown[]
  ) => Promise<T | null>;
  getAllAsync: <T = unknown>(
    sql: string,
    ...params: unknown[]
  ) => Promise<T[]>;
  withTransactionAsync: (task: () => Promise<void>) => Promise<void>;
  withExclusiveTransactionAsync: (
    task: (txn: MockSqliteHandle) => Promise<void>
  ) => Promise<void>;
  closeAsync: () => Promise<void>;
}

function mockCreateSqliteHandle(dbName: string): MockSqliteHandle {
  const getNativeDb = () => {
    let instance = mockSqliteDatabases.get(dbName);
    if (!instance) {
      const nodeSqlite = (
        process as unknown as {
          getBuiltinModule: (id: string) => SQLiteBuiltin;
        }
      ).getBuiltinModule("node:sqlite");
      instance = new nodeSqlite.DatabaseSync(":memory:");
      mockSqliteDatabases.set(dbName, instance);
    }
    return instance;
  };

  let txDepth = 0;

  const handle: MockSqliteHandle = {
    execAsync: async (sql: string) => {
      getNativeDb().exec(sql);
    },
    runAsync: async (sql: string, ...params: unknown[]) => {
      const stmt = getNativeDb().prepare(sql);
      const res = stmt.run(...mockNormalizeSqliteParams(params));
      return {
        changes: Number(res.changes),
        lastInsertRowId: Number(res.lastInsertRowid),
      };
    },
    getFirstAsync: async <T = unknown>(
      sql: string,
      ...params: unknown[]
    ): Promise<T | null> => {
      const stmt = getNativeDb().prepare(sql);
      const row = stmt.get(...mockNormalizeSqliteParams(params));
      return (row === undefined ? null : row) as T | null;
    },
    getAllAsync: async <T = unknown>(
      sql: string,
      ...params: unknown[]
    ): Promise<T[]> => {
      const stmt = getNativeDb().prepare(sql);
      return stmt.all(...mockNormalizeSqliteParams(params)) as T[];
    },
    withTransactionAsync: async (task: () => Promise<void>) => {
      const isOuter = txDepth === 0;
      txDepth += 1;
      if (isOuter) {
        getNativeDb().exec("BEGIN IMMEDIATE");
      }
      try {
        await task();
        if (isOuter) {
          getNativeDb().exec("COMMIT");
        }
      } catch (err) {
        if (isOuter) {
          try {
            getNativeDb().exec("ROLLBACK");
          } catch {
            // Ignore rollback failure if no active txn
          }
        }
        throw err;
      } finally {
        txDepth = Math.max(0, txDepth - 1);
      }
    },
    withExclusiveTransactionAsync: async (
      task: (txn: MockSqliteHandle) => Promise<void>
    ) => {
      const isOuter = txDepth === 0;
      txDepth += 1;
      if (isOuter) {
        getNativeDb().exec("BEGIN IMMEDIATE");
      }
      try {
        await task(handle);
        if (isOuter) {
          getNativeDb().exec("COMMIT");
        }
      } catch (err) {
        if (isOuter) {
          try {
            getNativeDb().exec("ROLLBACK");
          } catch {
            // Ignore rollback failure if no active txn
          }
        }
        throw err;
      } finally {
        txDepth = Math.max(0, txDepth - 1);
      }
    },
    closeAsync: async () => {
      const existing = mockSqliteDatabases.get(dbName);
      if (existing) {
        try {
          existing.close();
        } catch {
          // Already closed
        }
        mockSqliteDatabases.delete(dbName);
      }
    },
  };

  return handle;
}

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: jest.fn(async (dbName = "toko_rejeki_pos.db") =>
    mockCreateSqliteHandle(dbName)
  ),
  openDatabaseSync: jest.fn((dbName = "toko_rejeki_pos.db") =>
    mockCreateSqliteHandle(dbName)
  ),
}));

jest.mock("expo-print", () => ({
  printAsync: jest.fn(async () => {}),
  printToFileAsync: jest.fn(async () => ({
    uri: "file:///tmp/receipt.pdf",
    numberOfPages: 1,
  })),
}));

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({
    status: "granted",
    granted: true,
  })),
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: true,
    assets: null,
  })),
}));

jest.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg", PNG: "png", WEBP: "webp" },
  manipulateAsync: jest.fn(async (uri: string) => ({
    uri,
    width: 240,
    height: 240,
    base64: "bW9ja0Jhc2U2NA==",
  })),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      name: "Toko Rejeki Mobile",
      version: "1.0.0",
    },
  },
}));

jest.mock("@shopify/flash-list", () => {
  const React = require("react");
  const { FlatList } = require("react-native");
  return {
    FlashList: (props: Record<string, unknown>) =>
      React.createElement(FlatList, props),
  };
});

export function resetTestStorage(): void {
  mockSecureStoreMap.clear();
  mockKvStoreMap.clear();
}

export function resetTestDatabase(): void {
  for (const [, db] of mockSqliteDatabases) {
    try {
      db.close();
    } catch {
      // Ignore already-closed db
    }
  }
  mockSqliteDatabases.clear();
}
