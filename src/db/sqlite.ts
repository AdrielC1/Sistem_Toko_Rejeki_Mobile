import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

const DB_NAME = "toko_rejeki_pos.db";

const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL DEFAULT '',
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY NOT NULL,
  sku TEXT NOT NULL,
  barcode TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category_id TEXT NOT NULL DEFAULT '',
  category_name TEXT,
  unit_id TEXT NOT NULL DEFAULT '',
  unit_name TEXT,
  cost_price REAL NOT NULL DEFAULT 0,
  selling_price REAL NOT NULL DEFAULT 0,
  is_open_price INTEGER NOT NULL DEFAULT 0,
  sell_base_unit INTEGER NOT NULL DEFAULT 1,
  stock INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  unit_conversions_json TEXT NOT NULL DEFAULT '[]',
  wholesale_tiers_json TEXT NOT NULL DEFAULT '[]',
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active_deleted ON products(is_active, deleted_at);

CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_type TEXT NOT NULL,
  trigger_source TEXT NOT NULL,
  used_route TEXT,
  product_count INTEGER NOT NULL DEFAULT 0,
  deleted_count INTEGER NOT NULL DEFAULT 0,
  server_time TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL
);
`;

let dbInitPromise: Promise<SQLiteDatabase> | null = null;

export async function getCatalogDatabase(): Promise<SQLiteDatabase> {
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      const db = await openDatabaseAsync(DB_NAME);
      await db.execAsync(SCHEMA_SQL);
      return db;
    })().catch((err) => {
      dbInitPromise = null;
      throw err;
    });
  }
  return dbInitPromise;
}

export async function runInCatalogWriteTransaction<T>(
  task: (txn: SQLiteDatabase) => Promise<T>
): Promise<T> {
  const db = await getCatalogDatabase();
  let output!: T;
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync("PRAGMA busy_timeout = 5000;");
    output = await task(txn);
  });
  return output;
}

export async function resetCatalogTables(): Promise<void> {
  await runInCatalogWriteTransaction(async (txn) => {
    await txn.execAsync(`
      DELETE FROM products;
      DELETE FROM categories;
      DELETE FROM units;
      DELETE FROM sync_meta;
      DELETE FROM sync_audit;
    `);
  });
}

export function resetSqliteConnectionForTest(): void {
  dbInitPromise = null;
}
