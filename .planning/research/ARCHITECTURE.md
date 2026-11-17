# Architecture Research

**Domain:** Offline-Resilient Mobile POS Client (Expo + Expo Router + TypeScript) consuming an Existing Next.js App Router API (`Apps_Toko_Rejeki`)
**Researched:** 2026-11-17
**Confidence:** HIGH (backend contracts & domain logic verified directly from `../Apps_Toko_Rejeki/apps/src`; Expo Router & React Native native storage/cookie patterns verified via official Expo docs — MEDIUM/HIGH with a targeted Phase 1 cookie-jar verification spike)

## Standard Architecture

### System Overview

Apps Toko Rejeki Mobile follows a **4-Layer Local-First Client Architecture** separated into Presentation/Navigation, State & Domain Orchestration, Local Persistence & Sync Engine, and Remote API Transport. Because the backend (`../Apps_Toko_Rejeki/apps`) already owns PostgreSQL, ESC/POS thermal printing, and WhatsApp Gateway logging, the mobile client owns zero backend schema and treats on-device storage (`expo-sqlite` + `expo-secure-store`) as the primary read source for POS operations.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                 PRESENTATION & ROUTING LAYER (Expo Router)                   │
├──────────────────────────────────────────────────────────────────────────────┤
│  Root Stack (Stack.Protected auth gate)                                      │
│  ├── (auth)/login.tsx + server-config                                        │
│  └── (app)/(tabs)/ — 4-Tab Bottom Bar (Kasir | Produk | Pesanan | Pengaturan)│
│       ├── kasir/index.tsx          (Katalog/Nota toggle, multi-tab cart)     │
│       ├── produk/ (Nested Stack)   (index -> [id] detail | form | trash)     │
│       ├── pesanan/ (Nested Stack)  (index -> [tabId] detail -> resume Kasir) │
│       └── pengaturan/ (Nested Stack)(index -> about | owner-guarded screens) │
└───────────────────────────────┬──────────────────────────────┬───────────────┘
                                │ reads/dispatches             │ pure math
┌───────────────────────────────▼──────────────────────────────▼───────────────┐
│               STATE, GUARD & DOMAIN LAYER (Contexts + Stores)                │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────────┐  ┌─────────────────┐  ┌───────────┐  │
│  │ AuthContext  │  │SystemStatusCtx   │  │SyncEngineContext│  │POSCart    │  │
│  │ (session,    │  │(expo-network +   │  │(5s active poll, │  │(Zustand + │  │
│  │  role, RBAC) │  │ /api/health 10s) │  │ 10AM WIB/48h)   │  │ held tabs)│  │
│  └──────┬───────┘  └────────┬─────────┘  └────────┬────────┘  └─────┬─────┘  │
│         │                   │                     │                 │        │
│  Domain Pure Logic (`src/domain/`): pricing tiers, receiptLayout, formatting │
└─────────┼───────────────────┼─────────────────────┼─────────────────┼────────┘
          │                   │                     │                 │
┌─────────▼───────────────────▼─────────────────────▼─────────────────▼────────┐
│            LOCAL PERSISTENCE & SYNC LAYER (`src/db/` & `src/sync/`)          │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────┐   ┌────────────────────────────────────────┐  │
│  │ expo-secure-store         │   │ expo-sqlite (WAL mode, busy_timeout)   │  │
│  │ - pos_auth_user_snapshot  │   │ - products (indexed cols + JSON tiers) │  │
│  │ - server_base_url         │   │ - categories, units                    │  │
│  │ - client_uuid             │   │ - sync_meta (store_settings, cursors)  │  │
│  │ (- optional cookie backup)│   │ - sync_audit, held_orders (OrderTab[]) │  │
│  └───────────────────────────┘   └────────────────────▲───────────────────┘  │
└───────────────────────────────────────────────────────┼──────────────────────┘
                                                        │ HTTP JSON / Cookies
┌───────────────────────────────────────────────────────▼──────────────────────┐
│              REMOTE API SERVICE LAYER (`src/services/api/`)                  │
├──────────────────────────────────────────────────────────────────────────────┤
│  apiClient (dynamic baseUrl, credentials:'include', 401/403 vs 503 split)    │
│  ├── authApi (/api/auth/login, /me, /logout)     ├── syncApi (/sync/full, /delta)
│  ├── productsApi (/api/products, /[id], /trash)  ├── settingsApi (/api/settings)
│  ├── masterDataApi (/categories, /units, /users) └── posOpsApi (/print, /wa-log)
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
         Apps Toko Rejeki Next.js API (LAN HTTP or HTTPS Tunnel)
```

### Component Responsibilities

| Component | Responsibility | Recommended Implementation |
|-----------|----------------|----------------------------|
| **Root Router & Auth Gate** (`app/_layout.tsx`) | Mounts root providers (`SQLiteProvider`, `AuthProvider`, `SystemStatusProvider`, `SyncEngineProvider`, `POSCartProvider`) and enforces declarative `<Stack.Protected>` separation between `(auth)` and `(app)` | Expo Router `Stack` + `Stack.Protected` (`guard={isAuthenticated}` / `guard={!isAuthenticated}`) |
| **4-Tab Shell** (`app/(app)/(tabs)/_layout.tsx`) | Renders Bottom Navigation Bar (`Kasir`, `Produk`, `Pesanan`, `Pengaturan`) for all roles; displays active held-order count badge on `Pesanan` | Expo Router `Tabs` with dynamic `tabBarBadge` from `POSCart` selector |
| **Nested Feature Stacks** (`produk/`, `pesanan/`, `pengaturan/`) | Provides list-to-detail navigation (`Produk -> Detail`, `Pesanan -> Detail`, `Pengaturan -> About / Owner Admin`) while keeping bottom tabs or hiding tab bar on deep forms | Directory-per-tab with `_layout.tsx` (`<Stack>`) and `<Stack.Protected>` role guards |
| **AuthContext** | Hydrates offline session snapshot immediately at boot; verifies `/api/auth/me` online; distinguishes `401/403` revocation (invalid/disabled/password changed `pw_stamp`) from `503`/network offline | React Context + `expo-secure-store` snapshot (`pos_auth_user_snapshot`) |
| **SystemStatusContext** | Tracks device connectivity + server/PostgreSQL reachability (`online`, `degraded`, `offline`) | `expo-network` (`useNetworkState` / listener) + `/api/health` 10s foreground polling gated by `AppState` |
| **SyncEngine & SyncEngineContext** | Executes serialized Full/Delta catalog sync against `/api/sync/full` and `/api/sync/delta`, enforces 10:00 WIB daily full sync & >48h recovery, triggers WAL checkpoints | In-process promise mutex (`syncMutex.ts`) + `AppState`-aware 5s delta loop + `catalogBus` change emitter |
| **POSCart Store** | Manages multi-tab orders (`OrderTab[]`), active tab ID, wholesale tier pricing calculation, discounts, and `CompletedOrder` payload building | Zustand store (or normalized reducer) backed by SQLite `held_orders` / `AsyncStorage` persistence |
| **Local Catalog DB** (`src/db/`) | Replaces web Dexie (`IndexedDB`) with fast indexed SQL queries and atomic transactions for offline catalog, metadata, audit logs, and store settings | `expo-sqlite` (`openDatabaseSync`, `WAL` mode, `withExclusiveTransactionAsync`) |
| **API Service Layer** (`src/services/api/`) | Centralizes base URL resolution, timeout handling, `pos_session` cookie attachment, and typed DTO mapping | Modular fetch wrapper (`apiClient.ts`) + resource modules (`authApi`, `syncApi`, `productsApi`, etc.) |
| **Domain Pure Modules** (`src/domain/`) | Shares identical calculation & receipt formatting logic with `Apps_Toko_Rejeki` (`calculateEffectiveUnitPrice`, `getLineWidth`, `generateReceiptLines`) | Pure TypeScript modules ported from web `POSCartContext.tsx`, `receiptLayout.ts`, `format.ts` |

## Recommended Project Structure

```text
Apps_Toko_Rejeki_Mobile/
├── app.config.ts                     # Expo config (plugins: expo-router, expo-sqlite, expo-secure-store)
├── src/
│   ├── app/                          # Expo Router file-based routes ONLY (keep thin, delegate logic)
│   │   ├── _layout.tsx               # Root Providers + Stack.Protected auth/app gate
│   │   ├── (auth)/
│   │   │   ├── _layout.tsx           # Auth Stack (headerless)
│   │   │   └── login.tsx             # Login screen + inline LAN/HTTPS Server URL sheet
│   │   └── (app)/
│   │       ├── _layout.tsx           # Authenticated shell wrapper (starts SyncEngine & SystemStatus)
│   │       └── (tabs)/
│   │           ├── _layout.tsx       # 4-Tab Bottom Navigation Bar (Kasir, Produk, Pesanan, Pengaturan)
│   │           ├── kasir/
│   │           │   ├── _layout.tsx   # Stack (headerless or custom POS header)
│   │           │   └── index.tsx     # Kasir main screen (Katalog/Nota toggle, checkout, preview, print)
│   │           ├── produk/
│   │           │   ├── _layout.tsx   # Stack + Stack.Protected for admin/owner CRUD routes
│   │           │   ├── index.tsx     # Product List (all roles; edit/add buttons hidden for kasir)
│   │           │   ├── [id].tsx      # Product Detail (read-only for kasir; edit/delete for admin/owner)
│   │           │   ├── form.tsx      # Create / Edit Product (?id=...) [guard: admin | owner]
│   │           │   └── trash.tsx     # Soft-deleted Product Trash & Restore [guard: admin | owner]
│   │           ├── pesanan/
│   │           │   ├── _layout.tsx   # Stack for Held Orders
│   │           │   ├── index.tsx     # Active Held Orders List (local OrderTab[] with items > 0)
│   │           │   └── [tabId].tsx   # Held Order Detail + "Lanjutkan di Kasir" / Delete
│   │           └── pengaturan/
│   │               ├── _layout.tsx   # Stack + Stack.Protected for owner-only management routes
│   │               ├── index.tsx     # Overview Hub (Account, Health/Sync, Store Info link, Owner menu)
│   │               ├── about.tsx     # Store Profile & About App screen (accessible to ALL roles)
│   │               ├── store-profile.tsx    # Edit Store Profile & Printer Basics [guard: owner]
│   │               ├── receipt-config.tsx   # Receipt Sections & Item Layout Builder [guard: owner]
│   │               ├── accounts.tsx         # Staff Account Manager + Create/Edit/Password [guard: owner]
│   │               └── categories-units.tsx # Categories & Units CRUD, Trash, Migrate [guard: owner]
│   ├── components/
│   │   ├── ui/                       # Velocity Blue design primitives (Button, Card, Chip, Badge, Modal)
│   │   ├── pos/                      # CatalogGrid, CartPanel, WholesaleBadge, PaymentSummary, ReceiptPaper, PrinterInterventionModal
│   │   ├── products/                 # ProductRow, UnitConversionEditor, WholesaleTierEditor
│   │   └── common/                   # StatusBadge, RoleBadge, OfflineBanner, EmptyState
│   ├── context/
│   │   ├── AuthContext.tsx           # Session state, SecureStore snapshot, login/logout/refresh
│   │   ├── SystemStatusContext.tsx   # Network + /api/health polling, AppState awareness
│   │   └── SyncEngineContext.tsx     # Background 5s delta loop + manual sync actions
│   ├── store/
│   │   ├── posCartStore.ts           # Zustand store for OrderTab[] + local SQLite/AsyncStorage persistence
│   │   └── serverConfigStore.ts      # Active Server Base URL state (LAN IP vs HTTPS tunnel)
│   ├── db/
│   │   ├── sqlite.ts                 # Singleton openDatabaseSync + WAL PRAGMAs + schema migration
│   │   ├── catalogRepo.ts            # Queries & bulk upserts/deletes for products, categories, units
│   │   ├── syncMetaRepo.ts           # Key-value sync_meta, store_settings cache, sync_audit logs
│   │   └── heldOrdersRepo.ts         # Local persistence for OrderTab[] & activeTabId
│   ├── sync/
│   │   ├── syncMutex.ts              # In-process async lock preventing overlapping sync cycles
│   │   ├── syncEngine.ts             # shouldForceFullSync, executeFullSync, executeDeltaSync, 10:00 WIB check
│   │   └── catalogEvents.ts          # Lightweight pub/sub notifying hooks when SQLite catalog mutates
│   ├── services/
│   │   └── api/
│   │       ├── apiClient.ts          # Fetch wrapper (baseUrl, credentials:'include', 401/403 emitter, timeouts)
│   │       ├── authApi.ts            # /api/auth/login, /api/auth/me, /api/auth/logout
│   │       ├── syncApi.ts            # /api/sync/full, /api/sync/delta
│   │       ├── productsApi.ts        # /api/products, /api/products/[id], /api/products/trash
│   │       ├── categoriesApi.ts      # /api/categories, /[id], /trash, /[id]/migrate
│   │       ├── unitsApi.ts           # /api/units, /[id], /trash, /[id]/migrate
│   │       ├── usersApi.ts           # /api/users, /api/users/[id]
│   │       ├── settingsApi.ts        # /api/settings, /api/printers, /api/printers/test
│   │       ├── printApi.ts           # /api/print, /api/print/flush, /api/wa-log
│   │       └── healthApi.ts          # /api/health
│   ├── hooks/
│   │   ├── useOfflineCatalog.ts      # Subscribes to catalogEvents + queries SQLite / memory cache
│   │   └── useStoreSettings.ts       # Reads cached StoreSettings with background refresh
│   ├── domain/
│   │   ├── pricing.ts                # Wholesale tier matching & order totals (mirrors POSCartContext)
│   │   ├── receiptLayout.ts          # Pure receipt text-column engine (mirrors web lib/receiptLayout.ts)
│   │   └── format.ts                 # formatRp, parseCurrency, formatTitleCase, getWIBDateTime
│   ├── theme/
│   │   └── tokens.ts                 # Velocity Blue colors, typography, 8px spacing, 48px touch targets
│   └── types/
│       └── index.ts                  # Exact TypeScript DTOs synced with Apps_Toko_Rejeki/apps/src/types
```

### Structure Rationale

- **`src/app/` as pure routing shell:** Keeping business logic, SQLite queries, and API clients outside `src/app/` ensures Expo Router treats files strictly as screen controllers and avoids accidental route exposure of helper modules.
- **Directory-per-tab with nested `<Stack>`:** Converting `produk/`, `pesanan/`, and `pengaturan/` into subdirectories with `_layout.tsx` provides clean list-to-detail transitions (satisfying both rubric list-to-detail requirements and owner sub-pages) while retaining the persistent 4-tab Bottom Navigation Bar.
- **`src/domain/` decoupled from React Native & DOM:** Pure TypeScript functions (`pricing.ts`, `receiptLayout.ts`, `format.ts`) mirror `Apps_Toko_Rejeki/apps/src/lib/` directly, guaranteeing identical Rupiah rounding, wholesale threshold pricing, and 58mm/80mm receipt column wrapping between mobile and web/printer.
- **Separation of `db/`, `sync/`, and `services/api/`:** Prevents UI screens from issuing raw `fetch()` calls to `/api/products` when offline; screens read from `useOfflineCatalog()` (`db/`) and only call `services/api/` for explicit mutations (after which `syncEngine` runs an immediate delta pull).

## Architectural Patterns

### Pattern 1: Declarative Auth & Role-Based Route Guards (`Stack.Protected` + UI Capability Matrix)

**What:** Split authentication and RBAC into two coordinated layers: (1) declarative `<Stack.Protected>` route guards in `_layout.tsx` that automatically clear restricted history when auth or role changes, and (2) an explicit RBAC capability helper (`canManageProducts`, `canManageStore`) controlling UI controls (FABs, edit/delete buttons, owner menu cards).
**When to use:** Always — mandatory because hiding a tab or button alone does not block deep links or programmatic `router.push()`, and mobile differs from web by giving `kasir` read-only access to the `Produk` tab and detail page.
**Trade-offs:** Requires Expo SDK 53+ (`Stack.Protected`); older SDKs would require imperative `<Redirect />` checks inside every protected screen. Note that `kasir` still receives full 4-tab navigation while CRUD screens inside `produk/` and owner screens inside `pengaturan/` remain unreachable at router level.

**Example:**
```tsx
// src/app/_layout.tsx (Root Gate)
import { Stack } from "expo-router";
import { useAuth } from "@/context/AuthContext";

function RootNavigator() {
  const { user, isHydrated } = useAuth();
  if (!isHydrated) return null; // Keep splash visible until SecureStore snapshot loads

  const isAuthenticated = Boolean(user);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

// src/app/(app)/(tabs)/produk/_layout.tsx (Role-Guarded Nested Stack)
import { Stack } from "expo-router";
import { useAuth } from "@/context/AuthContext";

export default function ProdukStackLayout() {
  const { role } = useAuth();
  const canEditCatalog = role === "admin" || role === "owner";

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Daftar Produk" }} />
      {/* [id] is accessible to ALL roles; UI renders read-only for 'kasir' */}
      <Stack.Screen name="[id]" options={{ title: "Detail Produk" }} />
      <Stack.Protected guard={canEditCatalog}>
        <Stack.Screen name="form" options={{ title: "Kelola Produk" }} />
        <Stack.Screen name="trash" options={{ title: "Tong Sampah Produk" }} />
      </Stack.Protected>
    </Stack>
  );
}
```

### Pattern 2: Hybrid Relational-Document SQLite Schema for Catalog Sync

**What:** Replace browser Dexie (`IndexedDB`) with a single `expo-sqlite` database opened in **WAL mode** (`PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;`), storing indexed scalar columns (`id`, `name`, `sku`, `barcode`, `category_id`, `category_name`, `is_active`, `updated_at`) alongside JSON columns (`unit_conversions_json`, `wholesale_tiers_json`, `prices_json`) for nested `ProductUnit[]` and `WholesaleTier[]`.
**When to use:** Because `/api/sync/full` and `/api/sync/delta` already emit pre-aggregated `Product` documents containing nested `unitConversions` and `wholesaleTiers`.
**Trade-offs:**
- *Pro:* Delta upserts become atomic `INSERT OR REPLACE` statements with zero orphaned child rows or complex multi-table diffing inside SQLite transactions.
- *Pro:* SQL indexes on `name`, `sku`, `barcode`, and `category_name` allow instant SQLite queries even as the store catalog grows beyond 10,000+ SKUs.
- *Con:* Requires `JSON.parse` when hydrating `Product` rows (mitigated by keeping an in-memory array cache in `useOfflineCatalog` refreshed only when `catalogEvents` fires after a sync write).

**Example:**
```typescript
// src/db/sqlite.ts
import * as SQLite from "expo-sqlite";

export const db = SQLite.openDatabaseSync("toko_rejeki_pos.db");

export function initDatabase() {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY NOT NULL,
      category_id TEXT,
      category_name TEXT NOT NULL,
      name TEXT NOT NULL,
      sku TEXT NOT NULL DEFAULT '',
      barcode TEXT NOT NULL DEFAULT '',
      cost_price REAL NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      base_unit TEXT NOT NULL DEFAULT 'Pcs',
      prices_json TEXT NOT NULL DEFAULT '{}',
      unit_conversions_json TEXT NOT NULL DEFAULT '[]',
      wholesale_tiers_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_products_active_name ON products (is_active, deleted_at, name);
    CREATE INDEX IF NOT EXISTS idx_products_cat ON products (category_name);
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku);
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products (barcode);

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT,
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_type TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      records_upserted INTEGER NOT NULL DEFAULT 0,
      records_deleted INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS held_orders (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      items_json TEXT NOT NULL,
      discount_val REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 0
    );
  `);
}
```

### Pattern 3: `httpOnly` Cookie Session Transport + Offline Snapshot Resilience

**What:** Mirror the web `AuthContext` resilience contract while isolating React Native's `httpOnly` cookie constraints inside `apiClient.ts`.
**When to use:** Mandatory for consuming `Apps_Toko_Rejeki` without backend edits.
**Critical Backend & Runtime Mechanics (Verified in `Apps_Toko_Rejeki`):**
1. `/api/auth/login` sets cookie `pos_session` with `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, `maxAge: 30 days`, and `secure: isHttps` (plain HTTP LAN requests get `secure: false`, which works on local Wi-Fi when Android cleartext traffic / iOS ATS exception is enabled).
2. `middleware.ts` enforces a `sec-fetch-site` check on mutating `/api/*` requests (`POST/PUT/PATCH/DELETE`): if `sec-fetch-site` is present and not `same-origin`/`none`, it returns `403`. Native React Native HTTP stacks do not emit `sec-fetch-site`, so native mobile requests pass; **Expo Web** cross-origin browser requests will fail unless proxied.
3. **Offline Re-Entry:** On cold app start, `AuthContext` immediately hydrates `user` from `expo-secure-store` (`pos_auth_user_snapshot`), granting instant offline access to POS routes. Background `/api/auth/me` verification ONLY signs the user out on explicit HTTP `401` or `403` (e.g., disabled account or changed password changing `pw_stamp`), NEVER on `503` (DB offline) or network errors.
4. **Transport Caveat (Phase 1 Verification Target):** Expo SDK 52+ enables WinterCG `expo/fetch` globally, whose native cookie persistence across cold kills differs from standard React Native `fetch` (`OkHttp` / `NSURLSession`), and **Expo Go** does not guarantee persistent native cookie jars across app restarts. Therefore:
   - Configure `EXPO_PUBLIC_USE_RN_FETCH=1` (or build with an **Expo Development Build** + `@react-native-cookies/cookies` / `expo-cookies` calling `CookieManager.flush()` on Android immediately after login).
   - **Consult-User Escalation Trigger:** If Phase 1 physical-device testing shows `pos_session` cookie dropping across offline restarts under the target workflow (e.g., if Expo Go is required), escalate to the user before editing `Apps_Toko_Rejeki/apps/src/lib/apiAuth.ts` & `login/route.ts` to add an explicit `Authorization: Bearer <token>` header fallback alongside cookies.

### Pattern 4: Foreground-Aware Serialized Sync & In-Process Mutex

**What:** Port `Apps_Toko_Rejeki/apps/src/lib/syncEngine.ts` using an in-process promise mutex (`syncMutex.ts`) coordinated by `AppState` and `SystemStatusContext`.
**Trade-offs:** Eliminates browser `navigator.locks` and `localStorage` lease hacks (mobile runs a single JS runtime, not multiple browser tabs), while preventing concurrent `POLL_5S`, `FOCUS_REVALIDATE` (`AppState` -> `active`), `ONLINE_RECONNECTED`, and manual sync triggers from racing SQLite writes. Uses pure UTC+7 fallback alongside `Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta" })` so the 10:00 WIB daily Full Sync trigger works reliably across all Android Hermes builds.

## Data Flow

### Request & Offline Fallback Flow

```
[User Action (Kasir / Produk / Pengaturan)]
    │
    ├── Read / Search / Filter Catalog (Offline-First)
    │       UI Hook (useOfflineCatalog)
    │           └──► In-Memory Snapshot ◄──► expo-sqlite (products, categories, units)
    │
    ├── Cart & Held Order Mutation (Always Local, Zero Server Dependency)
    │       UI Action (Add item / Qty / Unit / Discount / Hold Tab)
    │           └──► POSCartStore (Zustand) ──► domain/pricing.ts (Wholesale Tiers)
    │                    └──► expo-sqlite (`held_orders` table)
    │
    ├── Checkout Print & WA Log (Online Server Ops)
    │       Kasir "Cetak Struk"
    │           ├──► domain/receiptLayout.ts (if previewReceiptBeforePrint -> Modal)
    │           ├──► POST /api/wa-log (async, non-blocking, fail-safe 200)
    │           └──► POST /api/print (returns diagnostic: PAPER_EMPTY, COVER_OPEN, etc.)
    │                    ├── Success -> clear/close active OrderTab
    │                    └── Diagnostic Error -> PrinterInterventionModal (+ /api/print/flush)
    │
    └── Catalog / Settings Mutation (Online-Required: admin / owner)
            Product / Category / Unit / User / Settings Form
                └──► Check SystemStatus (!isEffectiveOffline)
                         └──► apiClient (PUT/POST/DELETE with pos_session cookie)
                                  └──► On 200 OK -> triggerManualDeltaSync("MUTATION")
                                           └──► SQLite TX -> catalogEvents.emit() -> UI refreshes
```

### Key Data Flows

1. **Cold Launch & Offline Boot Flow:**
   - `SQLiteProvider` initializes `toko_rejeki_pos.db` with `WAL` mode and runs idempotent `CREATE TABLE IF NOT EXISTS` migrations.
   - `AuthProvider` reads `pos_auth_user_snapshot` from `expo-secure-store` and `server_base_url` from `serverConfigStore`; if present, root `<Stack.Protected>` immediately routes into `(app)/(tabs)/kasir` without waiting for network.
   - `POSCartStore` hydrates `held_orders` from SQLite (`OrderTab[]` + `activeTabId`), preserving all pending customer tabs across crashes or restarts.
   - In parallel (non-blocking), `AuthContext.refreshUser()` calls `GET /api/auth/me`:
     - `200 OK`: refreshes `pos_auth_user_snapshot` in `SecureStore`.
     - `401` / `403`: clears snapshot & native cookies, flips `isAuthenticated` to `false` (routing cleanly back to `(auth)/login`).
     - Network error / `503`: preserves offline session snapshot silently.

2. **Catalog Sync Engine Flow (`/api/sync/full` & `/api/sync/delta`):**
   - `SystemStatusContext` checks `expo-network` + `GET /api/health` (every 10s while `AppState === 'active'`).
   - If `networkConnected && dbStatus !== 'offline'`, `SyncEngineContext` runs `runSafeSyncCycle()` inside `runWithSyncLock()`:
     1. **10:00 WIB Rule:** If `wib.hour === 10` and `last_daily_sync_date !== wib.dateStr`, run `executeFullSync("SCHEDULED_10AM_WIB")`.
     2. **Force Full Rules:** Check `shouldForceFullSync()` (empty `products` table, missing `last_full_sync_at`, invalid timestamp, or `Date.now() - lastTs > 48h`). If needed, run `executeFullSync`.
     3. **Delta Sync:** Otherwise call `GET /api/sync/delta?since=<last_delta_sync_at>&client_id=<uuid>&trigger=<reason>`.
        - When `has_changes === false`: update `last_delta_sync_at` in `sync_meta` only (zero catalog table disk writes).
        - When `has_changes === true`: open `db.withExclusiveTransactionAsync`, `INSERT OR REPLACE` `upserted` records and `DELETE` `deleted` IDs across `products`, `categories`, `units`, update `last_delta_sync_at`, insert row into `sync_audit`, then emit `catalogEvents.emit("updated")` so all mounted screens re-query automatically.
   - When `AppState` changes to `background` or `inactive`, polling stops and `PRAGMA wal_checkpoint(PASSIVE)` flushes pending WAL frames safely to disk.

3. **Held Orders Flow (`Kasir` <-> `Pesanan Aktif` <-> `Detail Pesanan`):**
   - Creating/editing tabs in `Kasir` writes to `POSCartStore`, which debounces/writes synchronously to SQLite `held_orders`.
   - `Pesanan Aktif` subscribes to `tabs.filter(t => t.items.length > 0)` and renders each held tab card.
   - Tapping a card pushes `/(tabs)/pesanan/[tabId]`, showing full item lines, unit conversions, wholesale savings, discount, and grand total.
   - Tapping **"Lanjutkan di Kasir"** calls `switchTab(tabId)` in `POSCartStore` and navigates via `router.navigate("/(app)/(tabs)/kasir")` (switching tab focus directly to the resumed nota).

## Scaling Considerations

| Scale / Store Profile | Architecture Adjustments |
|-----------------------|--------------------------|
| **Single Store, < 2,000 SKUs, 1–3 Mobile Terminals** (Target v1) | Keep full active catalog in-memory snapshot inside `useOfflineCatalog` alongside SQLite WAL storage; 5s delta polling adds negligible server load (<200 bytes when unchanged) |
| **Mid Catalog (2,000–15,000 SKUs) / Multiple Cashiers** | Move search/category filtering in `useOfflineCatalog` from JS `Array.filter()` to parameterized SQLite `SELECT ... WHERE` with `LIMIT/OFFSET` + `FlashList` virtualization (`estimatedItemSize`), avoiding full JSON parsing on every keystroke |
| **High-Frequency Multi-Terminal / Weak Store Wi-Fi** | Add exponential backoff on `/api/health` and `/api/sync/delta` when consecutive timeouts occur; pause delta polling during active checkout printing to prevent Wi-Fi contention with `/api/print` |

### Scaling Priorities

1. **First bottleneck — Main-thread JSON parsing & list rendering on low-end Android POS devices:** Parsing `unit_conversions_json` for 3,000+ products inside a synchronous `useMemo` on tab switch causes frame drops. **Fix:** Parse JSON lazily per visible row or index `base_selling_price` as a numeric column in SQLite so list queries read flat columns only and parse `unitConversions` only when tapping a product (`addToActiveCart` or navigating to `produk/[id]`).
2. **Second bottleneck — Large base64 `storeLogo` in `/api/settings`:** `StoreSettings.storeLogo` can be a base64 data URI synced on `executeFullSync` and `/api/settings`. Storing huge blobs inside `expo-secure-store` fails Android's 2KB/size limits. **Fix:** Store `store_settings` strictly inside SQLite `sync_meta` (or file cache via `expo-file-system`), NEVER in `expo-secure-store`.

## Anti-Patterns

### Anti-Pattern 1: Storing Catalog, Settings, or Large Carts in `expo-secure-store` or `AsyncStorage`

**What people do:** Dump the entire `Product[]` array or `StoreSettings` (including `storeLogo` base64) into `AsyncStorage` JSON or `expo-secure-store`.
**Why it's wrong:** `expo-secure-store` has strict native value size limits (~2048 bytes on Android Keystore) and throws errors on large payloads; `AsyncStorage` forces full JSON re-serialization on every delta sync, blocking the bridge and breaking partial upserts/deletes.
**Do this instead:** Reserve `expo-secure-store` strictly for small sensitive strings (`pos_auth_user_snapshot`, `server_base_url`, `client_uuid`), and store `products`, `categories`, `units`, `sync_meta` (`store_settings`), `sync_audit`, and `held_orders` in `expo-sqlite`.

### Anti-Pattern 2: Relying on `response.headers.get("Set-Cookie")` or Treating `503` as Logout

**What people do:** Parse `Set-Cookie` manually from `fetch()` responses in React Native or log the user out whenever `/api/auth/me` returns non-200 (`503` DB offline or `Network request failed`).
**Why it's wrong:** Android `OkHttp` / React Native strips or mangles `Set-Cookie` from JS-accessible headers, and logging out on `503`/network failure destroys offline POS resilience (violating `Apps_Toko_Rejeki` auth contract in `AuthContext.tsx`).
**Do this instead:** Rely on the native cookie jar (`EXPO_PUBLIC_USE_RN_FETCH=1` + Dev Build `CookieManager.flush()` on Android) and ONLY wipe `pos_auth_user_snapshot` + redirect to `(auth)/login` on explicit HTTP `401` or `403`.

### Anti-Pattern 3: Hiding Tabs Only via `href: null` or Mirroring Web's Strict `/produk` Block for `kasir`

**What people do:** Use `href: null` in `<Tabs.Screen>` without `<Stack.Protected>`, or block `kasir` from opening the `Produk` tab (copying `Apps_Toko_Rejeki/apps/src/middleware.ts` literally).
**Why it's wrong:** `href: null` only hides the tab button without protecting deep routes, and blocking `Produk` entirely violates the mobile requirement that `kasir` retains all 4 bottom tabs with read-only access to `Produk` + `Detail Produk`.
**Do this instead:** Keep all 4 bottom tabs visible for every role, render `Produk` & `Detail Produk` in read-only mode for `kasir`, and place `<Stack.Protected>` guards around `produk/form`, `produk/trash`, and owner-only routes under `pengaturan/`.

### Anti-Pattern 4: Hardcoding Backend URL or Running Background Sync Timers While App Is Backgrounded

**What people do:** Hardcode `http://localhost:3000` (which points to the phone itself, not the store PC) or run unguarded `setInterval(..., 5000)` regardless of `AppState` and `SystemStatus`.
**Why it's wrong:** `localhost` fails on physical LAN devices, and unguarded polling drains battery, spams `503` errors when PostgreSQL is offline, and triggers `SQLITE_BUSY` races on OS suspend.
**Do this instead:** Store configurable `serverBaseUrl` (editable on Login & Pengaturan) defaulting to `EXPO_PUBLIC_API_URL`, pause polling when `AppState !== "active"` or `dbStatus === "offline"`, and serialize sync tasks through `syncMutex.ts`.

## Integration Points

### External Services (Existing `Apps_Toko_Rejeki` Next.js API)

| Endpoint Group | Endpoints & Methods | Auth Role (`apiAuth.ts`) | Mobile Integration Notes |
|----------------|---------------------|--------------------------|--------------------------|
| **Authentication** | `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` | Public (`login`/`logout`), Staff (`me`) | Sets `httpOnly` cookie `pos_session` (30-day HMAC-SHA256 + `pw_stamp`). `/api/auth/me` returns `{ offline: true, data }` if DB is offline |
| **Health** | `GET /api/health` | `ROLES_STAFF` (`verifyAccount: false`) | Works even when PostgreSQL is down; drives `SystemStatusContext` (`online` \| `degraded` \| `offline`) |
| **Catalog Sync** | `GET /api/sync/full`, `GET /api/sync/delta?since=...` | `ROLES_STAFF` | Returns `{ server_time, has_changes, data: { products, categories, units } }`; `503` (`offline: true`) when PostgreSQL is offline |
| **Products CRUD** | `GET/POST /api/products`, `GET/PUT/DELETE /api/products/[id]`, `GET/POST/DELETE /api/products/trash` | `GET`: `ROLES_STAFF`; `POST/PUT/DELETE`: `ROLES_MANAGER` (`admin`, `owner`) | All writes require active DB; after write succeeds, call `triggerManualDeltaSync()` to update SQLite |
| **Store Settings & Printers** | `GET/PUT /api/settings`, `GET /api/printers`, `POST /api/printers/test` | `GET /settings`: Public (store branding) / Staff (full); `PUT /settings`: `ROLES_OWNER`; `printers`: `ROLES_MANAGER` | `GET /settings` works on login screen without auth to show store name & logo |
| **POS Print & WA Log** | `POST /api/print`, `POST /api/print/flush`, `POST /api/wa-log` | `ROLES_STAFF` (`verifyAccount: false`) | Both work even if PostgreSQL is offline! `wa-log` is fire-and-forget; `print` returns `diagnostic.errorCode` for `PrinterInterventionModal` |
| **Owner Master Data** | `GET/POST /api/categories` (+ `[id]`, `trash`, `migrate`), `GET/POST /api/units` (+ `[id]`, `trash`, `migrate`), `GET/POST /api/users`, `PUT/PATCH/DELETE /api/users/[id]` | `users`: `ROLES_OWNER`; `categories`/`units` write: `ROLES_MANAGER` (UI exposed in Owner Pengaturan sub-pages) | Trigger `triggerManualDeltaSync()` after category/unit edits or migrations so local SQLite stays aligned |

### Internal Boundaries

| Boundary | Communication | Considerations |
|----------|---------------|----------------|
| `AuthContext` ↔ `apiClient` | Event callback (`onUnauthorized`) on HTTP `401`/`403` | Must ignore `503` and network timeouts so offline mode never kicks out logged-in staff |
| `SystemStatusContext` ↔ `SyncEngineContext` | Reactive `dbStatus` + `networkConnected` state | When `dbStatus` flips from `offline` to `online`/`degraded`, trigger one immediate `DB_RECONNECTED` delta sync |
| `SyncEngine` ↔ `useOfflineCatalog` | `catalogEvents` pub/sub (`EventEmitter`) | Emitted ONLY after SQLite `withExclusiveTransactionAsync` commits, avoiding partial/stale reads |
| `POSCartStore` ↔ `Kasir` / `Pesanan` | Shared Zustand store + SQLite `held_orders` | Switching active tab in `Pesanan/[tabId]` immediately reflects in `Kasir` without extra refetch |

## Suggested Build Order (Roadmap Implications)

Because modules have strict runtime dependencies, build in this sequence:

1. **Foundation, Theme, Types & Auth Transport Spike:**
   - Initialize Expo + Expo Router + TypeScript, Velocity Blue `theme/tokens.ts`, `types/index.ts`, `serverConfigStore`, `apiClient.ts`, `AuthContext` + `expo-secure-store`, `(auth)/login.tsx`, and root `<Stack.Protected>` shell.
   - **Critical Gate:** Verify `pos_session` `httpOnly` cookie persistence across cold app restarts on LAN HTTP and HTTPS in a Development Build (or confirm escalation if Bearer token fallback on backend is needed).
2. **Local SQLite Layer & Catalog Sync Engine:**
   - Implement `db/sqlite.ts` (WAL mode + schema), `catalogRepo.ts`, `syncMetaRepo.ts`, `syncMutex.ts`, `syncEngine.ts` (`/api/sync/full`, `/api/sync/delta`, 10:00 WIB & >48h rules), `SystemStatusContext`, `SyncEngineContext`, and `useOfflineCatalog` hook.
3. **4-Tab Shell & Kasir Checkout Flow:**
   - Wire `(tabs)/_layout.tsx` (4 tabs + badge), `POSCartStore` + `heldOrdersRepo.ts`, `domain/pricing.ts`, `domain/receiptLayout.ts`, and `kasir/index.tsx` (`Katalog` & `Nota` toggle, category filter, search, multi-tab nota, wholesale tiers, discount/change, receipt preview modal, `/api/print` + `/api/wa-log` + `PrinterInterventionModal`).
4. **List-to-Detail Modules (`Produk` & `Pesanan Aktif`):**
   - Implement `produk/` nested Stack (`index.tsx`, `[id].tsx` read-only for `kasir`, `form.tsx` + `trash.tsx` guarded for `admin`/`owner`) and `pesanan/` nested Stack (`index.tsx`, `[tabId].tsx` with resume-to-kasir & delete).
5. **Pengaturan Hub, Profile/About & Owner Management Sub-Pages:**
   - Implement `pengaturan/` nested Stack (`index.tsx` overview with Account/Health/Sync/Server URL, `about.tsx` Store Profile & App Info for all roles, and `<Stack.Protected>` owner sub-pages: `store-profile.tsx`, `receipt-config.tsx`, `accounts.tsx`, `categories-units.tsx`).

## Sources

- `../Apps_Toko_Rejeki/apps/src/types/index.ts`, `lib/apiAuth.ts`, `lib/session.ts`, `middleware.ts`, `lib/syncEngine.ts`, `lib/offlineDb.ts`, `lib/syncMutex.ts`, `lib/orderValidation.ts`, `lib/receiptLayout.ts`, `lib/productFormatter.ts`, `context/AuthContext.tsx`, `context/POSCartContext.tsx`, `context/SyncEngineContext.tsx`, `context/SystemStatusContext.tsx`, and `app/api/**` (directly inspected)
- Expo Router Docs — Protected Routes (`Stack.Protected`, `Tabs.Protected`) & Tabs with Nested Stacks: https://docs.expo.dev/router/advanced/protected/ and https://docs.expo.dev/router/basics/common-navigation-patterns/
- Expo SDK Docs — Local Storage (`expo-sqlite`, `expo-secure-store`, `AsyncStorage`), `expo-network`, and `expo/fetch`: https://docs.expo.dev/versions/latest/sdk/sqlite/ , https://docs.expo.dev/versions/latest/sdk/securestore/ , https://docs.expo.dev/versions/latest/sdk/network/ , https://docs.expo.dev/versions/latest/sdk/expo/
- React Native Cookie Persistence & `OkHttp` / `NSURLSession` behavior (cross-verified community & library references for `@react-native-cookies/cookies` / `expo-cookies` & `EXPO_PUBLIC_USE_RN_FETCH`)

---
*Architecture research for: Apps Toko Rejeki Mobile (Expo Router + TypeScript POS client)*
*Researched: 2026-11-17*
