# Phase 2: Offline SQLite Catalog, Sync Engine & Health Header - Pattern Map

**Mapped:** 2026-11-19
**Files analyzed:** 42 (17 modified, 25 new across Mobile & approved `../Apps_Toko_Rejeki` additive backend)
**Analogs found:** 40 / 42 (2 new mobile-only primitives — `src/db/sqlite.ts` and `src/components/common/InitialSyncBanner.tsx` — draw from SDK contracts and `02-RESEARCH.md` / `02-UI-SPEC.md`)

> **Tracked-Source Gate:** Every analog path below was verified via `git ls-files` in `Apps_Toko_Rejeki_Mobile` and `git -C ../Apps_Toko_Rejeki ls-files`. No gitignored or mirror paths are emitted.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `../Apps_Toko_Rejeki/mini_catalog_migration.sql` | migration | schema-DDL | `../Apps_Toko_Rejeki/production_full_migration.sql` + `../Apps_Toko_Rejeki/DatabaseSchema.md` | exact |
| `../Apps_Toko_Rejeki/apps/src/app/api/sync/full/route.ts` | route | request-response | `../Apps_Toko_Rejeki/apps/src/app/api/sync/full/route.ts` | exact |
| `../Apps_Toko_Rejeki/apps/src/app/api/sync/delta/route.ts` | route | request-response | `../Apps_Toko_Rejeki/apps/src/app/api/sync/delta/route.ts` | exact |
| `src/types/index.ts` | model | transform | `src/types/index.ts` + `../Apps_Toko_Rejeki/apps/src/types/index.ts` | exact |
| `src/theme/tokens.ts` | config | transform | `src/theme/tokens.ts` | exact |
| `src/services/storage/secureStorage.ts` | service | file-I/O | `src/services/storage/secureStorage.ts` | exact |
| `src/services/storage/serverConfig.ts` | service | request-response | `src/services/storage/serverConfig.ts` | exact |
| `src/services/api/apiClient.ts` | service | request-response | `src/services/api/apiClient.ts` | exact |
| `src/services/api/authApi.ts` | service | request-response | `src/services/api/authApi.ts` | exact |
| `src/services/api/healthApi.ts` | service | request-response | `src/services/api/authApi.ts` + `../Apps_Toko_Rejeki/apps/src/app/api/health/route.ts` | role-match |
| `src/services/api/syncApi.ts` | service | request-response | `src/services/api/authApi.ts` + `../Apps_Toko_Rejeki/apps/src/app/api/sync/full/route.ts` | role-match |
| `src/context/AuthContext.tsx` | provider | event-driven | `src/context/AuthContext.tsx` | exact |
| `src/db/sqlite.ts` | service | file-I/O | None (native `expo-sqlite` SDK lifecycle; partial parallel in `../Apps_Toko_Rejeki/apps/src/lib/offlineDb.ts`) | no-analog |
| `src/sync/syncMutex.ts` | utility | event-driven | `src/services/storage/secureStorage.ts` (`enqueueAuthStorageOp`) + `../Apps_Toko_Rejeki/apps/src/lib/syncMutex.ts` | exact |
| `src/sync/productNormalizer.ts` | utility | transform | `../Apps_Toko_Rejeki/apps/src/lib/productFormatter.ts` + `src/context/AuthContext.tsx` | role-match |
| `src/sync/catalogEvents.ts` | utility | pub-sub | `src/services/api/apiClient.ts` (`sessionRevokedHandlers`) | exact |
| `src/db/catalogRepo.ts` | service | CRUD | `../Apps_Toko_Rejeki/apps/src/lib/offlineDb.ts` + `../Apps_Toko_Rejeki/apps/src/lib/syncEngine.ts` | role-match |
| `src/db/syncMetaRepo.ts` | service | CRUD | `../Apps_Toko_Rejeki/apps/src/lib/offlineDb.ts` + `src/services/storage/secureStorage.ts` | exact |
| `src/sync/syncEngine.ts` | service | batch | `../Apps_Toko_Rejeki/apps/src/lib/syncEngine.ts` | exact |
| `src/context/SystemStatusContext.tsx` | provider | event-driven | `../Apps_Toko_Rejeki/apps/src/context/SystemStatusContext.tsx` + `src/context/AuthContext.tsx` | exact |
| `src/context/SyncEngineContext.tsx` | provider | event-driven | `../Apps_Toko_Rejeki/apps/src/context/SyncEngineContext.tsx` + `src/context/AuthContext.tsx` | exact |
| `src/app/(app)/_layout.tsx` | provider | config | `src/app/(app)/_layout.tsx` + `../Apps_Toko_Rejeki/apps/src/app/(pos)/layout.tsx` | exact |
| `src/components/common/TabScreenHeader.tsx` | component | event-driven | `src/components/common/TabScreenHeader.tsx` + `../Apps_Toko_Rejeki/apps/src/components/Header.tsx` | exact |
| `src/components/common/ServerUrlPanel.tsx` | component | form | `src/components/common/ServerUrlPanel.tsx` | exact |
| `src/components/common/InitialSyncBanner.tsx` | component | event-driven | None (new UX; composes `FeedbackBanner` in `src/components/ui/VelocityPrimitives.tsx` + `EmptyStateCard.tsx`) | no-analog |
| `src/components/pengaturan/ResetCacheConfirmModal.tsx` | component | event-driven | `src/components/common/LogoutConfirmModal.tsx` | exact |
| `src/components/pengaturan/SyncControlCard.tsx` | component | CRUD | `src/app/(app)/(tabs)/pengaturan.tsx` + `../Apps_Toko_Rejeki/apps/src/app/(pos)/pengaturan/page.tsx` | exact |
| `src/app/(app)/(tabs)/pengaturan.tsx` | component | event-driven | `src/app/(app)/(tabs)/pengaturan.tsx` | exact |
| `src/app/(app)/(tabs)/kasir.tsx` | component | event-driven | `src/app/(app)/(tabs)/kasir.tsx` + `src/app/(app)/(tabs)/produk.tsx` | exact |
| `src/app/(app)/(tabs)/produk.tsx` | component | event-driven | `src/app/(app)/(tabs)/produk.tsx` | exact |
| `src/app/(app)/(tabs)/pesanan.tsx` | component | event-driven | `src/app/(app)/(tabs)/pesanan.tsx` | exact |
| `src/app/(auth)/login.tsx` | component | form | `src/app/(auth)/login.tsx` | exact |
| `__tests__/setup.ts` | test | config | `__tests__/setup.ts` + `node_modules/expo-sqlite/src/SQLiteDatabase.ts` | exact |
| `__tests__/catalogDb.test.ts` | test | CRUD | `__tests__/apiClient.test.ts` | role-match |
| `__tests__/syncEngine.test.ts` | test | batch | `__tests__/apiClient.test.ts` | role-match |
| `__tests__/syncEngineContext.test.tsx` | test | event-driven | `__tests__/authContext.test.tsx` | exact |
| `__tests__/systemStatusHeader.test.tsx` | test | event-driven | `__tests__/tabScreens.test.tsx` | exact |
| `__tests__/pengaturanSync.test.tsx` | test | CRUD | `__tests__/tabScreens.test.tsx` | exact |
| `__tests__/serverConfig.test.ts` | test | request-response | `__tests__/serverConfig.test.ts` | exact |
| `__tests__/apiClient.test.ts` | test | request-response | `__tests__/apiClient.test.ts` | exact |
| `__tests__/loginScreen.test.tsx` | test | form | `__tests__/loginScreen.test.tsx` | exact |
| `__tests__/tabScreens.test.tsx` | test | event-driven | `__tests__/tabScreens.test.tsx` | exact |

---

## Pattern Assignments

### 1. Backend Additive `mini_*` PostgreSQL Migration & `?scope=mini` Sync Routes (`D-12`–`D-14`)

#### `../Apps_Toko_Rejeki/mini_catalog_migration.sql` (migration, schema-DDL)

**Analog:** `../Apps_Toko_Rejeki/production_full_migration.sql` + `../Apps_Toko_Rejeki/DatabaseSchema.md`

**Trigger function pattern** (`production_full_migration.sql` lines 17–23):
```sql
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Base columns + FK actions** (`DatabaseSchema.md` lines 260–549) **+ soft-delete columns** (`production_full_migration.sql` lines 46–67):
- `mini_categories`: `id uuid DEFAULT gen_random_uuid() NOT NULL`, `name character varying(100) NOT NULL`, `created_at timestamptz DEFAULT now() NOT NULL`, `updated_at timestamptz DEFAULT now() NOT NULL`, `deleted_at timestamptz NULL`
- `mini_units`: `id uuid DEFAULT gen_random_uuid() NOT NULL`, `name character varying(50) NOT NULL`, `created_at/updated_at/deleted_at`
- `mini_products`: `id`, `category_id uuid` (`ON DELETE SET NULL`), `name varchar(255) NOT NULL`, `sku varchar(100)`, `barcode varchar(100)`, `cost_price numeric(15,2) DEFAULT 0 NOT NULL`, `is_active boolean DEFAULT true NOT NULL`, `created_at/updated_at/deleted_at`
- `mini_product_units`: `id`, `product_id uuid NOT NULL` (`ON DELETE CASCADE`), `unit_id uuid NOT NULL` (`ON DELETE RESTRICT`), `conversion_factor integer DEFAULT 1 NOT NULL`, `selling_price numeric(15,2) NOT NULL`, `created_at`, `is_active boolean DEFAULT true NOT NULL`, `cost_price numeric(15,2) DEFAULT 0`, `updated_at`, `deleted_at`
- `mini_wholesale_tiers`: `id`, `product_unit_id uuid NOT NULL` (`ON DELETE CASCADE`), `min_qty integer NOT NULL`, `special_price numeric(15,2) NOT NULL`, `created_at/updated_at/deleted_at`

**Partial unique indexes & delta indexes pattern** (`production_full_migration.sql` lines 194–260):
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_mini_products_sku_active_unique
    ON public.mini_products (sku)
    WHERE deleted_at IS NULL AND sku IS NOT NULL AND sku <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_mini_categories_name_active_unique
    ON public.mini_categories (LOWER(name)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mini_units_name_active_unique
    ON public.mini_units (LOWER(name)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mini_product_units_active_unique
    ON public.mini_product_units (product_id, unit_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_mini_products_delta ON public.mini_products USING btree (updated_at DESC);
```
**Constraint:** Never add rigid table-level `UNIQUE (name)` or `UNIQUE (sku)` constraints (`production_full_migration.sql` lines 192–217 dropped them so soft-deleted names/SKUs can be reused). Wrap entire file in `BEGIN; ... COMMIT;` using `CREATE TABLE IF NOT EXISTS` and `DROP TRIGGER IF EXISTS ...; CREATE TRIGGER ...` (lines 105–133) so execution starts with `0` rows (`D-12`).

---

#### `../Apps_Toko_Rejeki/apps/src/app/api/sync/full/route.ts` (route, request-response)

**Analog:** `../Apps_Toko_Rejeki/apps/src/app/api/sync/full/route.ts` + `../Apps_Toko_Rejeki/apps/src/lib/db.ts`

**Imports & Auth Guard pattern** (`full/route.ts` lines 1–19):
```typescript
import { NextRequest, NextResponse } from "next/server";
import sql, { isConnectionError } from "@/lib/db";
import { requireApiAuth, ROLES_STAFF } from "@/lib/apiAuth";
import { formatProductRow } from "@/lib/productFormatter";
export const dynamic = "force-dynamic";
// inside GET:
const auth = await requireApiAuth({ roles: ROLES_STAFF });
if (!auth.ok) return auth.response;
```

**Scope branching & `postgres.js` Proxy constraint** (`db.ts` lines 135–146, `full/route.ts` lines 21–98):
- `db.ts` inspects `firstChunk = String(argArray[0][0] || '').trim()` to distinguish reads from writes, and tagged-template `${x}` interpolations bind as `$1` SQL values (never table names).
- Parse `scopeParam = searchParams.get("scope")`: if `scopeParam && scopeParam !== "main" && scopeParam !== "mini"`, return HTTP `400` (`{ success: false, error: "Parameter 'scope' tidak valid. Gunakan 'main' atau 'mini'." }`).
- Branch `const isMini = scopeParam === "mini"` to run static `sql\`... FROM mini_products ...\`` / `mini_categories` / `mini_units` / `mini_product_units` / `mini_wholesale_tiers` vs untouched main `sql\`... FROM products ...\``.
- Pass `'mini_catalog'` vs `'catalog'` for `entity_name` in `sync_checkpoints` (`full/route.ts` line 138) and reuse `rawProducts.map(formatProductRow)` (`full/route.ts` line 100) verbatim.
- Preserve HTTP `503` `{ success: false, offline: true, error: ... }` via `isConnectionError(error)` (`full/route.ts` lines 185–195).

---

#### `../Apps_Toko_Rejeki/apps/src/app/api/sync/delta/route.ts` (route, request-response)

**Analog:** `../Apps_Toko_Rejeki/apps/src/app/api/sync/delta/route.ts`

**Parameter validation & CTE change detection** (`delta/route.ts` lines 20–65):
- Enforce required ISO 8601 `since` param returning `400` (lines 25–46); add identical `scope` allowlist (`"main" | "mini"`, HTTP `400` on invalid).
- Branch `isMini` to static CTEs querying `mini_products`, `mini_product_units`, `mini_wholesale_tiers`, `mini_categories`, `mini_units` with identical `updated_at > ${sinceIso} OR deleted_at > ${sinceIso}` predicates (lines 54–131).
- Reuse `deletedAt || isActive === false` split into `upserted` vs `deleted` (lines 135–178), conditional `sync_checkpoints` logging only `if (hasChanges)` with `entity_name = ${isMini ? "mini_catalog" : "catalog"}` (lines 193–250), and `503 { offline: true }` handling (lines 273–284).

---

### 2. Mobile Types, Tokens, Storage & Dual-URL Transport (`D-01`, `D-02`, `D-06`–`D-09`)

#### `src/types/index.ts` (model, transform)

**Analog:** `src/types/index.ts` (lines 1–57) + `../Apps_Toko_Rejeki/apps/src/types/index.ts` (lines 3–54) + `../Apps_Toko_Rejeki/apps/src/lib/offlineDb.ts` (lines 5–22) + `../Apps_Toko_Rejeki/apps/src/context/SystemStatusContext.tsx` (lines 5–31)

**Existing mobile pattern** (`src/types/index.ts` lines 11–21, 52–57):
- Extend `StoreSettings` (lines 11–21) with optional `receiptSections?: ReceiptSection[]` and `receiptItemConfig?: ReceiptItemConfig` (from sibling `apps/src/types/index.ts` lines 155–156) so authenticated `GET /api/settings` caches cleanly without dropping receipt fields.
- Mirror web `Category`, `Unit`, `WholesaleTier`, `ProductUnit`, `Product` (`apps/src/types/index.ts` lines 3–54), plus a role-safe `CatalogProduct` type (`Omit<Product, "costPrice" | "unitConversions"> & { costPrice?: number; unitConversions: Array<Omit<ProductUnit, "costPrice"> & { costPrice?: number }> }`) so TypeScript enforces `D-09` optionality on `costPrice`.
- Add Dual-URL & Health/Sync types:
  - `ServerRoute = "lan" | "cloud" | "offline"`
  - `ServerUrlConfig = { primaryUrl: string; fallbackUrl: string | null }`
  - Extend `ConnectionTestResult` (lines 32–38) with optional `routeUsed?: "lan" | "cloud"` and `lanAttemptError?: string`.
  - `HealthStatusSnapshot` mirroring `../Apps_Toko_Rejeki/apps/src/app/api/health/route.ts` lines 31–52 + `activeRoute: ServerRoute`, `lastCheckedAt: string | null`, `isManualChecking: boolean`.
  - `SyncAuditRecord`, `CatalogCounts` (`{ products: number; categories: number; units: number }`), `SyncResult`, `SyncFullResponse`, `SyncDeltaResponse`.

---

#### `src/theme/tokens.ts` (config, transform)

**Analog:** `src/theme/tokens.ts` (lines 11–42) + `02-UI-SPEC.md` (lines 74–90)

**Tokens extension pattern** (`src/theme/tokens.ts` lines 27–37):
```typescript
    success: "#10b981",
    successBg: "#d1fae5",
    successBgSubtle: "#ecfdf5",
    successText: "#065f46",
    kasirAvatar: "#047857",
    cloudBg: "#e0e7ff",
    cloudBorder: "#4338ca",
    cloudText: "#3730a3",
    warning: "#f59e0b",
    warningBg: "#fef3c7",
    warningBorder: "#b45309",
    warningText: "#78350f",
```
**Note:** Adding these 5 keys from `02-UI-SPEC.md` line 75 (`successBgSubtle`, `cloudBg`, `cloudBorder`, `cloudText`, `warningBorder`) eliminates all raw hex literals across `TabScreenHeader`, `SyncControlCard`, and `ServerUrlPanel`.

---

#### `src/services/storage/secureStorage.ts` (service, file-I/O)

**Analog:** `src/services/storage/secureStorage.ts` (lines 10–14, 161–211)

**KV store & backward-compatible migration pattern** (`secureStorage.ts` lines 10–13, 161–189):
```typescript
export const KV_KEYS = {
  SERVER_BASE_URL: "pos_server_base_url",
  SERVER_CONFIG: "pos_server_config_v2",
  STORE_SETTINGS: "pos_store_settings",
  CLIENT_UUID: "pos_client_uuid",
} as const;
```
- Keep `enqueueAuthStorageOp` (lines 21–34) and `SECURE_KEYS` (`SESSION_TOKEN`, `USER_SNAPSHOT`) untouched.
- Add `getStoredServerConfigRaw()` / `setStoredServerConfigRaw()` / `clearStoredServerConfig()` over `Storage.getItemSync`/`setItemSync`/`removeItemSync` (lines 163–185), plus `getOrCreateClientIdSync(generator)` for `KV_KEYS.CLIENT_UUID` (matching `syncEngine.ts` line 23 `pos_client_uuid` key, migrated from `localStorage` to `expo-sqlite/kv-store`).
- **Migration rule (`02-RESEARCH.md` lines 287–292):** `getStoredServerConfig()` in `serverConfig.ts` reads `SERVER_CONFIG` first; if absent, checks legacy `getStoredServerUrl()`: if set to `L`, returns `{ primaryUrl: L, fallbackUrl: L === DEFAULT_PRIMARY_SERVER_URL ? DEFAULT_CLOUD_SERVER_URL : null }`; if both are absent, returns `{ primaryUrl: DEFAULT_PRIMARY_SERVER_URL, fallbackUrl: DEFAULT_CLOUD_SERVER_URL }`. Writing via `setStoredServerConfig(cfg)` also syncs `setStoredServerUrl(cfg.primaryUrl)` so legacy callers of `getStoredServerUrl()` remain consistent.

---

#### `src/services/storage/serverConfig.ts` (service, request-response)

**Analog:** `src/services/storage/serverConfig.ts` (lines 6–196)

**Validation & hint pattern** (`serverConfig.ts` lines 6–135):
- Preserve existing exports (`SERVER_URL_HINTS`, `SERVER_URL_INVALID_ERROR`, `normalizeServerUrl`, `parseStoreSettingsResponse`, `testServerConnection`) and add:
  - `DEFAULT_PRIMARY_SERVER_URL = "http://192.168.1.100:3000"` (`D-01`)
  - `DEFAULT_CLOUD_SERVER_URL = "https://kasir.tokorejeki.my.id"` (`D-01`)
  - `LAN_PROBE_TIMEOUT_MS = 2000` (`D-02`)
  - `SERVER_URL_HINTS`: keep `androidEmulator: "http://10.0.2.2:3000"`, `lanExample: "http://192.168.1.10:3000"` (or `lanProduction: DEFAULT_PRIMARY_SERVER_URL` + `cloudDefault: DEFAULT_CLOUD_SERVER_URL`) so existing `serverConfig.test.ts` assertions on `SERVER_URL_HINTS` keep passing!
  - `DUAL_SERVER_EMPTY_ERROR` (from `02-UI-SPEC.md` line 106): `"Minimal satu URL valid (LAN Utama atau Cloud Cadangan) wajib diisi dengan awalan http:// atau https:// tanpa spasi."`
  - `DUAL_SERVER_UNREACHABLE_ERROR` (from `02-UI-SPEC.md` line 106): `"Alamat server tidak valid atau jalur aktif (LAN/Cloud) tidak terjangkau. Pastikan diawali http:// atau https:// dan server kasir aktif."`
- Extend `publicSettingsPayloadSchema` (lines 67–105) with optional passthrough/fields for `receiptSections` and `receiptItemConfig` so full authenticated settings pass Zod parsing cleanly.
- Add `normalizeDualServerConfig(primaryRaw: string, fallbackRaw: string)`:
  - Allows `(valid LAN, empty Cloud)` -> `{ primaryUrl: lan, fallbackUrl: null }`, `(empty LAN, valid Cloud)` -> `{ primaryUrl: cloud, fallbackUrl: null }` (or separate `{ primaryUrl: "", fallbackUrl: cloud }` normalized consistently — note if `primaryUrl` can be `""` when user only enters Cloud, `apiRequestWithFailover` handles `primaryUrl === ""` cleanly by probing `fallbackUrl`; choose one canonical representation and test both single-URL cases per `02-UI-SPEC.md` line 147!).
  - Rejects if both empty OR if any non-empty input fails `normalizeServerUrl()` (lines 121–135).
- Add `testDualServerConnection(primaryRaw, fallbackRaw)` reusing `testServerConnection` / `apiFetch(..., "/api/settings", { sessionToken: null })`:
  - Probes Primary LAN first with `timeoutMs: LAN_PROBE_TIMEOUT_MS` (2000ms); if network/timeout/non-JSON 502+, probes Fallback Cloud with `timeoutMs: 6000`; caches `storeSettings` on 200 without overwriting saved config on failure (lines 142–195).

---

#### `src/services/api/apiClient.ts` (service, request-response)

**Analog:** `src/services/api/apiClient.ts` (lines 1–249)

**Imports, Auth Epoch & Cookie Injection pattern** (`apiClient.ts` lines 1–136):
```typescript
import { fetch, type FetchRequestInit } from "expo/fetch";
import { clearAuthSession, getSessionToken } from "@/services/storage/secureStorage";
```
- Preserve `apiFetch`, `apiRequest`, `getAuthEpoch`, `bumpAuthEpoch`, `registerSessionRevokedHandler`, `NETWORK_UNREACHABLE_ERROR` without breaking single-URL callers.
- Add module-level `activeRoute: ServerRoute` (`"lan" | "cloud" | "offline"`, default `"lan"`) + route change subscriber Set (copying `sessionRevokedHandlers` lines 35–53!) + `getActiveRoute()` / `setActiveRoute(route)` / `resetActiveRouteForTest()`.
- Add `apiRequestWithFailover<T>(config: ServerUrlConfig, path: string, options?: ApiFailoverOptions): Promise<ApiFailoverResult<T>>`:
  - **Sticky routing (`D-02`):**
    - If `activeRoute !== "cloud"` and `config.primaryUrl` exists: execute `apiRequest<T>(config.primaryUrl, path, { ...options, timeoutMs: options?.lanTimeoutMs ?? 2000 })`.
    - **Strict Failover Trigger:** Fail over to `config.fallbackUrl` ONLY if `config.fallbackUrl` exists and differs from `config.primaryUrl` AND `(res.networkError === true || (res.rawBody === null && res.status >= 502))`. **NEVER** fail over on `400`, `401`, `403`, `404`, `429`, or JSON `503 { offline: true }`!
    - On fallback success (or non-network response from fallback), `setActiveRoute("cloud")` and return `{ ...fallbackRes, routeUsed: "cloud" }`.
    - If `activeRoute === "cloud"` and `config.fallbackUrl` exists: send directly to `config.fallbackUrl` (zero 2s LAN penalty); only if `fallbackUrl` hits a transport/gateway error and `config.primaryUrl` exists, probe `config.primaryUrl` once (`2000ms`); if both fail with transport error, `setActiveRoute("offline")`.
- **Note on `shouldRevoke` (`apiClient.ts` lines 186–207):** Because `apiRequest` internally handles `401` and `/api/auth/me` `403` revocation + `authEpoch` protection and `apiRequestWithFailover` does NOT fail over on `401`/`403`, session revocation remains 100% single-path and epoch-safe across LAN ↔ Cloud.

---

#### `src/services/api/authApi.ts` (service, request-response)

**Analog:** `src/services/api/authApi.ts` (lines 1–261) + `../Apps_Toko_Rejeki/apps/src/app/api/settings/route.ts` (lines 78–148)

**Core pattern** (`authApi.ts` lines 61–261):
- Preserve `loginWithCredentials(baseUrl, ...)`, `fetchCurrentUser(baseUrl)`, `logoutSession(baseUrl)`, `fetchPublicSettings(baseUrl)` signatures for backward compatibility with Phase 1 tests (`apiClient.test.ts`).
- Add Dual-URL wrappers (or accept `string | ServerUrlConfig`) `loginWithFailover`, `fetchCurrentUserWithFailover`, `logoutSessionWithFailover` calling `apiRequestWithFailover` / `apiFetch`.
- Add **`fetchAuthenticatedSettings(config: ServerUrlConfig)`** (`02-RESEARCH.md` lines 362–365):
  - Calls `apiRequestWithFailover<StoreSettings>(config, "/api/settings", { method: "GET" })` **with `pos_session` cookie attached**.
  - Only when `res.ok && !res.offline && res.data && (res.data.printerPaperWidth !== undefined || res.data.receiptSections !== undefined)` saves via `setCachedStoreSettings(res.data)` (preventing unauthenticated `settings/route.ts` lines 78–90 or offline defaults from overwriting full printer/receipt settings).

---

#### `src/services/api/healthApi.ts` (service, request-response)

**Analog:** `src/services/api/authApi.ts` + `../Apps_Toko_Rejeki/apps/src/app/api/health/route.ts` (lines 8–69)

**Backend contract (`health/route.ts` lines 31–69):**
- Endpoint: `GET /api/health` (requires `pos_session` cookie — verified `requireApiAuth` at line 9).
- Response fields: `status` (`"online" | "degraded" | "offline"`), `database` (`"online" | "standby_only" | "offline"`), `nodeRole`, `clusterRole`, `isReadOnly`, `activeNode`, `device`, `partnerDevice`, `partnerStatus`, `dbHost`, `dbPort`, `latencyMs`, `error`, `timestamp`.
- Implement:
  - `fetchClusterHealth(config, options?: { forceProbeLan?: boolean; lanTimeoutMs?: number })` using `apiRequestWithFailover` (with `forceProbeLan` bypassing sticky `"cloud"` so 30s LAN re-probes and manual `db-health-pill` taps actually test `primaryUrl` first!).
  - `probeLanHealthOnly(primaryUrl, timeoutMs = 2000)` calling `apiRequest(primaryUrl, "/api/health", { timeoutMs })` without modifying `activeRoute` until verified healthy, then calling `setActiveRoute("lan")` on valid JSON response (`res.rawBody !== null && !res.sessionRevoked`).

---

#### `src/services/api/syncApi.ts` (service, request-response)

**Analog:** `src/services/api/authApi.ts` + `../Apps_Toko_Rejeki/apps/src/app/api/sync/full/route.ts` + `delta/route.ts`

**Endpoint & payload contract:**
- `fetchFullCatalogSync(config, clientId, trigger)`:
  - Calls `apiRequestWithFailover` to `/api/sync/full?scope=mini&client_id=${encodeURIComponent(clientId)}&trigger=${encodeURIComponent(trigger)}` (`timeoutMs` / `lanTimeoutMs`: allow `5000ms`–`8000ms` after probe or `3000ms` LAN / `12000ms` Cloud for large catalog downloads).
  - Throws typed `SyncTransportError` (preserving `offline: true` on `503 { offline: true }` vs `networkError: true` vs `sessionRevoked`).
- `fetchDeltaCatalogSync(config, sinceIso, clientId, trigger)`:
  - Calls `apiRequestWithFailover` to `/api/sync/delta?scope=mini&since=${encodeURIComponent(sinceIso)}&client_id=${encodeURIComponent(clientId)}&trigger=${encodeURIComponent(trigger)}` (`lanTimeoutMs: 2000`).

---

#### `src/context/AuthContext.tsx` (provider, event-driven)

**Analog:** `src/context/AuthContext.tsx` (lines 54–512)

**State & callback pattern** (`AuthContext.tsx` lines 97–105, 192–247, 259–449):
- Keep existing `serverUrl`, `saveServerUrl`, `testServerUrl` in `AuthContextValue` so Phase 1 tests (`authContext.test.tsx`, `tabScreens.test.tsx`) keep passing, while adding:
  - `serverConfig: ServerUrlConfig` (hydrated synchronously via `getStoredServerConfig()` in `hydrate()`, default `{ primaryUrl: DEFAULT_PRIMARY_SERVER_URL, fallbackUrl: DEFAULT_CLOUD_SERVER_URL }`)
  - `saveServerConfig(primaryRaw: string, fallbackRaw: string)` -> validates via `normalizeDualServerConfig`, persists via `setStoredServerConfig`, updates `serverConfig` + `serverUrl` (`cfg.primaryUrl || cfg.fallbackUrl || ""`), resets `activeRoute` to `"lan"` if primary changed.
  - `testDualServerUrl(primaryRaw: string, fallbackRaw: string)` -> calls `testDualServerConnection`, updates `storeSettings` on `200`, preserves saved config unless user explicitly taps Save (or keep existing `testServerUrl` auto-save behavior while updating `ServerUrlPanel` tests — note `ServerUrlPanel.tsx` has separate `Tes Koneksi Server` and `Simpan Alamat Server`; verify whether `testDualServerUrl` auto-saves or only tests!). *Check `02-UI-SPEC.md` lines 146–151:* `Tes Koneksi Server` only tests & updates store preview, while `Simpan Alamat Server` saves — keep `testServerUrl(rawUrl)` auto-saving for Phase 1 `loginScreen.test.tsx` or update `loginScreen.test.tsx` explicitly if behavior is unified. Document that choice clearly in the plan!
- On login & `hydrate()` online validation, use `loginWithFailover` / `fetchCurrentUserWithFailover` against `serverConfigRef.current`, and after authenticated login/refresh trigger `fetchAuthenticatedSettings(serverConfigRef.current)` to upgrade public settings to full `StoreSettings`.

---

### 3. Mobile Local SQLite WAL Database & Sync Engine (`D-06`–`D-10`)

#### `src/db/sqlite.ts` (service, file-I/O)

**No direct mobile analog** — guided by `node_modules/expo-sqlite/src/SQLiteDatabase.ts` (lines 27–205, 393–483), `../Apps_Toko_Rejeki/apps/src/lib/offlineDb.ts` (lines 24–48), and `02-RESEARCH.md` (lines 79, 321–356).

**Connection & WAL PRAGMA pattern:**
```typescript
import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";

const DB_NAME = "toko_rejeki_pos.db";
const SCHEMA_VERSION = 1;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
```
- **Singleton outside React `<Slot key={navKey}>`:** `getDatabase()` memoizes one `openDatabaseAsync(DB_NAME)` promise and applies connection-level PRAGMAs **outside** any transaction:
  ```sql
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA synchronous = NORMAL;
  ```
- **Schema & indexes (`PRAGMA user_version = 1`):** Create 5 tables (`products`, `categories`, `units`, `sync_meta`, `sync_audit`) with `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` inside `withTransactionAsync`. **Do NOT declare SQLite `FOREIGN KEY` constraints** on synced catalog tables because `withExclusiveTransactionAsync` opens a separate native connection (`SQLiteDatabase.ts` line 186) that does not inherit `PRAGMA foreign_keys` or `busy_timeout`.
- **Write transaction helper (`SQLiteDatabase.ts` lines 140–205):**
  ```typescript
  export async function runWriteTransaction<T>(
    db: SQLite.SQLiteDatabase,
    fn: (conn: SQLite.SQLiteDatabase) => Promise<T>
  ): Promise<T> {
    let result!: T;
    if (Platform.OS !== "web" && typeof db.withExclusiveTransactionAsync === "function") {
      await db.withExclusiveTransactionAsync(async (txn) => {
        await txn.execAsync("PRAGMA busy_timeout = 5000;");
        result = await fn(txn as unknown as SQLite.SQLiteDatabase);
      });
    } else {
      await db.withTransactionAsync(async () => {
        result = await fn(db);
      });
    }
    return result;
  }
  ```
- Add `checkpointWalPassive()` executing `PRAGMA wal_checkpoint(PASSIVE);` (called on `AppState` background transition) and `resetDatabaseSingletonForTest()` for Jest `resetTestDatabase()`.

---

#### `src/sync/syncMutex.ts` (utility, event-driven)

**Analog:** `src/services/storage/secureStorage.ts` (`enqueueAuthStorageOp` lines 21–34) + `../Apps_Toko_Rejeki/apps/src/lib/syncMutex.ts` (lines 9–65)

**Exact FIFO queue pattern to copy** (`secureStorage.ts` lines 21–34):
```typescript
let writeQueue: Promise<void> = Promise.resolve();

export function enqueueDbWrite<T>(op: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(op, op);
  writeQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}
```
- Pair with an in-flight flag `isSyncCycleActive` + `tryRunScheduledSync(op)` (mirroring `navigator.locks.request(..., { ifAvailable: true })` semantics from web `syncMutex.ts` lines 17–24) so overlapping `POLL_5S` ticks return `null` immediately instead of queuing stale polls behind a slow `FULL` sync, while manual triggers and `resetCatalogCache()` enqueue cleanly via `enqueueDbWrite`.

---

#### `src/sync/productNormalizer.ts` (utility, transform)

**Analog:** `../Apps_Toko_Rejeki/apps/src/lib/productFormatter.ts` (lines 7–55) + `src/context/AuthContext.tsx` (`computeRoleCapabilities` lines 76–85)

**Role-stripping pattern (`D-09`):**
```typescript
export function sanitizeProductForRole(
  product: Product,
  role: UserRole | null
): CatalogProduct {
  const canViewCost = role === "admin" || role === "owner";
  if (canViewCost) {
    return product;
  }
  return {
    ...product,
    costPrice: undefined,
    unitConversions: product.unitConversions.map((uc) => ({
      ...uc,
      costPrice: undefined,
    })),
  };
}
```
- Also export `computeBaseSellingPrice(product: Product): number` (picks `conversionFactor === 1` unit or first active unit's `sellingPrice`, fallback `0`) for indexing `base_selling_price` in SQLite `products`, and `normalizeServerProduct(raw)` defensively coercing numeric/boolean fields from API JSON.

---

#### `src/sync/catalogEvents.ts` (utility, pub-sub)

**Analog:** `src/services/api/apiClient.ts` (`sessionRevokedHandlers` lines 35–53)

**Exact subscriber Set pattern** (`apiClient.ts` lines 35–53):
```typescript
const catalogListeners = new Set<() => void>();

export function subscribeCatalogUpdated(fn: () => void): () => void {
  catalogListeners.add(fn);
  return () => {
    catalogListeners.delete(fn);
  };
}

export function emitCatalogUpdated(): void {
  for (const fn of catalogListeners) {
    try {
      fn();
    } catch {
      // Isolate subscriber errors
    }
  }
}
```
Emit **only after** `runWriteTransaction` commits (`catalogRepo` / `syncEngine` / `resetCatalogCache`).

---

#### `src/db/catalogRepo.ts` (service, CRUD)

**Analog:** `../Apps_Toko_Rejeki/apps/src/lib/offlineDb.ts` (lines 37–43, 76–85) + `../Apps_Toko_Rejeki/apps/src/lib/syncEngine.ts` (lines 140–183, 293–328)

**Atomic write & role-guarded read pattern:**
- **Writes (must execute inside `enqueueDbWrite` + `runWriteTransaction`):**
  - `replaceCatalogAtomic(conn, { products, categories, units })`: `DELETE FROM products; DELETE FROM categories; DELETE FROM units;` then prepared `INSERT OR REPLACE` batches (`runAsync`), persisting `cost_price` and full `unit_conversions_json` (including unit `costPrice`) in SQLite (`D-09`).
  - `applyCatalogDeltaAtomic(conn, { productsUpserted, productsDeleted, categoriesUpserted, categoriesDeleted, unitsUpserted, unitsDeleted })`: batch `INSERT OR REPLACE` upserts and chunked `DELETE FROM ... WHERE id IN (...)` deletes (chunk <= 500 IDs to stay well below SQLite's `999` bind parameter limit).
- **Reads (fail-closed role isolation `D-09`):**
  - `getCatalogCounts()`: returns `{ products: number; categories: number; units: number }` (`WHERE deleted_at IS NULL AND is_active = 1` for products; `WHERE deleted_at IS NULL` for categories/units).
  - `getCatalogProducts(role: UserRole | null, options?)`, `getCatalogProductById(id: string, role: UserRole | null)`: always map rows through `sanitizeProductForRole(product, role)` **before returning** so `kasir` never receives `costPrice`.
  - `getCatalogCategories()`, `getCatalogUnits()` ordered by `name COLLATE NOCASE ASC`.

---

#### `src/db/syncMetaRepo.ts` (service, CRUD)

**Analog:** `../Apps_Toko_Rejeki/apps/src/lib/offlineDb.ts` (lines 5–22, 51–130) + `src/services/storage/secureStorage.ts` (lines 191–211)

**Core operations:**
- `getSyncMeta(key)` / `setSyncMeta(key, value)` / `setSyncMetaBatch(conn, entries)` targeting `sync_meta(key, value, updated_at)`.
  - Keys: `last_full_sync_at`, `last_delta_sync_at`, `last_daily_sync_date`, `server_clock_offset_ms`, `client_id`, `store_settings`.
- `appendSyncAudit(conn, entry)` + prune `DELETE FROM sync_audit WHERE id NOT IN (SELECT id FROM sync_audit ORDER BY id DESC LIMIT 50)` so table stays bounded (`02-RESEARCH.md` line 351).
- `getRecentSyncAuditLogs(limit = 10): Promise<SyncAuditRecord[]>` (`ORDER BY id DESC LIMIT ?`, clamped `1..50`) for `SyncControlCard` (`D-11`).
- `getCachedStoreSettingsFromDb()` / `setCachedStoreSettingsInDb(settings)` keeping SQLite `sync_meta['store_settings']` and `kv-store['pos_store_settings']` aligned (mirroring web `offlineDb.ts` lines 88–130).
- **`resetCatalogCache()` (`D-11`):** Inside `enqueueDbWrite` + `runWriteTransaction`, executes `DELETE` on `products`, `categories`, `units`, `sync_meta`, `sync_audit` (preserving `client_id` or regenerating cleanly, and **NEVER** touching `expo-secure-store` `pos_session_token`/`pos_user_snapshot`, `expo-sqlite/kv-store` `pos_server_config_v2`/`pos_server_base_url`, or future local order keys `toko_rejeki_pos_tabs_v1`!). Emits `emitCatalogUpdated()`.

---

#### `src/sync/syncEngine.ts` (service, batch)

**Analog:** `../Apps_Toko_Rejeki/apps/src/lib/syncEngine.ts` (lines 1–381)

**Deterministic UTC+7 `getWIBDateTime()` + Hermes-safe `generateClientId()` (`02-RESEARCH.md` lines 599–640):**
- Replace web `Intl.DateTimeFormat(..., { timeZone: "Asia/Jakarta" })` (`syncEngine.ts` lines 39–69) with pure epoch offset `epochMs + 7 * 3_600_000` + `getUTCFullYear/Month/Date/Hours/Minutes` + `today10AmWibUtcMs = Date.UTC(year, month - 1, day, 3, 0, 0)`.
- Replace web `localStorage.getItem("pos_client_uuid")` (`syncEngine.ts` lines 21–34) with `getOrCreateClientIdSync(generateClientId)` in `secureStorage.ts` (`mobile-<uuid>` using `globalThis.crypto?.randomUUID` fast-path + RFC 4122 v4 fallback).
- **`shouldForceFullSync(estimatedServerNowMs)` (`D-07`, `02-RESEARCH.md` lines 375–380):**
  1. `totalProducts === 0 && !lastFullSyncAt` -> `INITIAL_BOOTSTRAP_EMPTY_DB`
  2. `!lastFullSyncAt || Number.isNaN(lastTs)` -> `INITIAL_BOOTSTRAP_NO_META`
  3. `estimatedServerNowMs - lastTs > TWO_DAYS_MS` -> `GAP_OVER_2_DAYS`
  4. `wibNow.hour >= 10 && lastTs < wibNow.today10AmWibUtcMs && lastDailyDate !== wibNow.dateStr` -> `SCHEDULED_10AM_WIB` *(Notice improvement over web `wib.hour === 10` at `syncEngine.ts` line 372: `hour >= 10 && lastTs < today10AmWibUtcMs` catches up if phone was offline during 10:00–10:59 WIB!)*
- **Network-before-transaction (`D-06`):** Execute `fetchFullCatalogSync` / `fetchDeltaCatalogSync` (and authenticated `fetchAuthenticatedSettings` on full sync) **before** entering `enqueueDbWrite` + `runWriteTransaction`.
- **`server_time` cursor & clock offset (`D-07`):** Always persist verbatim `json.server_time` into `last_full_sync_at` / `last_delta_sync_at` and update `server_clock_offset_ms = Date.parse(json.server_time) - Date.now()`.
- **No-op 5s delta optimization (`syncEngine.ts` lines 269–278):** When `!json.has_changes`, update `last_delta_sync_at` in `sync_meta` **without** writing `sync_audit` (or writing `sync_audit` only when `has_changes` or `trigger !== "POLL_5S"` so 5-second idle polls do not flood the 5–10 row UI log in `Pengaturan`!). *Flag this explicitly for planner: recording `sync_audit` on `FULL`, changed `DELTA`, manual `DELTA`, and `FAILED` keeps the 10-row audit log in `Pengaturan` meaningful instead of showing 10 identical `+0, -0` polling rows every 50 seconds!*

---

### 4. Mobile Runtime Contexts & Authenticated Shell (`NAV-03`, `SYNC-02`, `SYNC-03`)

#### `src/context/SystemStatusContext.tsx` (provider, event-driven)

**Analog:** `../Apps_Toko_Rejeki/apps/src/context/SystemStatusContext.tsx` (lines 1–156) + `src/context/AuthContext.tsx` (lines 102–109, 180–257) + `../Apps_Toko_Rejeki/apps/src/context/SyncEngineContext.tsx` (lines 220–245 safe fallback)

**Imports & Lifecycle:**
- `import { AppState, type AppStateStatus } from "react-native";`
- `import * as Network from "expo-network";`
- Subscribe to `useAuth().serverConfig`, `getActiveRoute()` / route change subscription from `apiClient.ts`.
- **Anti-flicker rule (`SystemStatusContext.tsx` lines 69–75):** Only set `isManualChecking: true` (`Memeriksa...` pill) when `refreshStatus()` is invoked manually; silent 10-second background polls keep the previous badge visible until resolved.
- **Recursive `setTimeout` schedule + Backoff (`D-02`, `D-08`):**
  - `10_000 ms` when `status === "online" || status === "degraded"`.
  - When offline on both LAN & Cloud: 1st failure -> `15_000 ms`, 2nd+ failures -> `30_000 ms`; immediately resets to `10_000 ms` on recovery.
  - Every 3rd tick (~30s) while `activeRoute === "cloud"`, call `probeLanHealthOnly(serverConfig.primaryUrl)` (`2000ms` timeout) to automatically restore priority back to LAN (`D-02`).
- **Foreground & Network listeners (`D-02`, `D-07`):**
  - `AppState.addEventListener("change", ...)` pauses all timers when `state !== "active"` and triggers immediate probe (LAN-first) when returning to `"active"`.
  - `Network.addNetworkStateListener(...)` triggers immediate probe when `isConnected !== false` (and forces `"offline"` cleanly when `isConnected === false`).
- **Non-throwing fallback (`SyncEngineContext.tsx` lines 220–245):** `useSystemStatus()` returns a safe default (`status: "offline"`, `activeRoute: "offline"`, `isManualChecking: false`, `refreshStatus: async () => {}`) when rendered outside `SystemStatusProvider` so existing Phase 1 tests (`tabScreens.test.tsx`) keep passing without wrapping every test in `SystemStatusProvider`.

---

#### `src/context/SyncEngineContext.tsx` (provider, event-driven)

**Analog:** `../Apps_Toko_Rejeki/apps/src/context/SyncEngineContext.tsx` (lines 1–246) + `src/context/AuthContext.tsx`

**State & Lifecycle (`SyncEngineContext.tsx` lines 27–218):**
- Consumes `useAuth()` (`user`, `role`, `serverConfig`, `refreshSettings` callback) and `useSystemStatus()` (`status`, `activeRoute`, `isNetworkConnected`).
- Hydrates `catalogCounts` (`{ products, categories, units }`), `lastFullSyncAt`, `lastDeltaSyncAt`, `recentAuditLogs` (`limit = 10`) from SQLite on mount and on `subscribeCatalogUpdated(...)`.
- **Foreground-only 5s recursive `setTimeout` + `15s -> 30s` error backoff (`D-07`, `D-08`):**
  - Polls every `5_000 ms` ONLY when `AppState.currentState === "active"` AND `dbStatus !== "offline"` AND `isNetworkConnected !== false`.
  - On delta error while server seemed online: backs off `15_000 ms` -> `30_000 ms`, resetting to `5_000 ms` immediately on success.
  - Cancels timer + runs `checkpointWalPassive()` when `AppState` leaves `"active"`.
  - Triggers `runPollCycle("DB_RECONNECTED")` when `prevDbOfflineRef.current && !isDbOffline` (`SyncEngineContext.tsx` lines 193–199) AND `"FOCUS_REVALIDATE"` on foreground return.
- Exposes `triggerManualFullSync()`, `triggerManualDeltaSync(trigger)`, `resetAndResyncCatalog()` (calls `resetCatalogCache()`, refreshes counts to `0`, then immediately attempts `triggerManualFullSync()` if online, returning distinct success copy per `02-UI-SPEC.md` line 107!).
- **Non-throwing fallback (`SyncEngineContext.tsx` lines 220–245):** `useSyncEngine()` returns safe default (`isSyncing: false`, `syncType: "IDLE"`, `catalogCounts: { products: 0, categories: 0, units: 0 }`, `recentAuditLogs: []`, no-op triggers) outside `SyncEngineProvider`.

---

#### `src/app/(app)/_layout.tsx` (provider, config)

**Analog:** `src/app/(app)/_layout.tsx` (lines 1–13) + `../Apps_Toko_Rejeki/apps/src/app/(pos)/layout.tsx` (lines 251–260)

**Wrapper order (`(pos)/layout.tsx` lines 252–259 & `(app)/_layout.tsx` lines 8–13):**
```tsx
export default function AuthenticatedAppLayout() {
  const { user } = useAuth();
  const navKey = user ? `${user.id}:${user.role}` : "guest";

  return (
    <SystemStatusProvider>
      <SyncEngineProvider>
        <Slot key={navKey} />
      </SyncEngineProvider>
    </SystemStatusProvider>
  );
}
```
**Key placement rationale:** Placing `SystemStatusProvider` and `SyncEngineProvider` **outside** `<Slot key={navKey} />` (or keyed consistently) ensures `expo-sqlite` singleton stays open across account switches (`D-09`) while `<Slot key={navKey} />` still remounts all tab screens cleanly on role change so role-gated catalog reads re-run immediately! Unauthenticated `(auth)/login` remains outside `(app)` so `/api/health` and `/api/sync/*` are **never** polled before login.

---

### 5. Mobile Header Pills, Server Panel, Sync UI & Tab Empty States (`NAV-03`, `D-03`–`D-05`, `D-10`, `D-11`)

#### `src/components/common/TabScreenHeader.tsx` (component, event-driven)

**Analog:** `src/components/common/TabScreenHeader.tsx` (lines 1–78) + `../Apps_Toko_Rejeki/apps/src/components/Header.tsx` (lines 157–318)

**UI-SPEC Contract (`02-UI-SPEC.md` lines 84–90, 114–129 — authoritative over `02-RESEARCH.md` draft labels):**
- Keep `SafeAreaView edges={["top"]}` + `headerRow` (`paddingBottom: showStatusBar ? TOKENS.spacing.sm : TOKENS.spacing.md`).
- Add `showStatusBar?: boolean` (default `true`) rendering `statusSubRow` (`paddingHorizontal: TOKENS.spacing.md`, `paddingBottom: TOKENS.spacing.md`, `flexDirection: "row"`, `flexWrap: "wrap"`, `alignItems: "center"`, `gap: TOKENS.spacing.sm`).
- **Pill 1 (`testID="db-health-pill"`, `onPress={() => void refreshStatus()}`):**
  - `Memeriksa...`: `surfaceContainerLow`, border `outline`, text/icon `onSurfaceVariant`, `RefreshCw` `14px`
  - `LAN Online`: `successBg`, border `kasirAvatar`, text/icon `successText`, `Server` `14px`
  - `Cloud Online`: `cloudBg`, border `cloudBorder`, text/icon `cloudText`, `Cloud` `14px`
  - `Standby Baca Saja`: `warningBg`, border `warningBorder`, text/icon `warningText`, `ShieldAlert` `14px`
  - `Offline`: `errorContainer`, border `destructive`, text/icon `onErrorContainer`, `CloudOff` `14px`
- **Pill 2 (`testID="sync-status-pill"`, `onPress={() => { if (!isSyncing) void triggerManualDeltaSync("HEADER_BADGE_CLICK"); }}`):**
  - `Sync Penuh...` / `Sync Delta...` (shown during manual sync, full sync, reconnection sync, or active delta writes — NOT flashing during idle 5s no-op polls!): `primaryFixed`, border `primaryContainer`, text/icon `onPrimaryFixed`, `RefreshCw` `14px`
  - `Mode Offline`: `warningBg`, border `warningBorder`, text/icon `warningText`, `WifiOff` `14px`
  - `Sync Error`: `errorContainer`, border `destructive`, text/icon `onErrorContainer`, `AlertCircle` `14px`
  - `Katalog Siap`: `successBgSubtle`, border `kasirAvatar`, text/icon `successText`, `CheckCircle2` `14px`
- Both pills: `paddingHorizontal: TOKENS.spacing.sm`, `paddingVertical: TOKENS.spacing.sm`, `borderRadius: TOKENS.radii.sm`, `borderWidth: 1`, `gap: TOKENS.spacing.xs`, `hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}`, `accessibilityRole="button"`, `accessibilityState={{ busy, disabled }}`, `numberOfLines={1}`. Animate `RefreshCw` rotation ONLY when `isSyncing || isManualChecking` and OS Reduce Motion (`AccessibilityInfo.isReduceMotionEnabled()`) is disabled.

---

#### `src/components/common/ServerUrlPanel.tsx` (component, form)

**Analog:** `src/components/common/ServerUrlPanel.tsx` (lines 1–349)

**Props & Layout migration (`02-UI-SPEC.md` lines 130–152):**
- Upgrade props to support Dual Server URLs (`savedServerConfig: ServerUrlConfig`, `onSaveConfig`, `onTestConfig`) while keeping clean prop sync pattern (`ServerUrlPanel.tsx` lines 55–65 without `useEffect` `setState` lint warnings!).
- **Trigger header (`server-url-panel-toggle`):**
  - Collapsed by default unless both `primaryUrl` and `fallbackUrl` are empty (line 38).
  - Preview summary (`numberOfLines={1}`): e.g. `LAN: ${primaryHost} | Cloud: ${cloudHost}` (stripping protocol for compact 1-line display on `360px` screens, or single active host if one is null).
- **Expanded body (`gap: TOKENS.spacing.md`):**
  1. Failover Note Box (`surfaceContainerLow`, `1px borderSubtle`, `radii.sm`, `spacing.sm` padding): `"Smart Auto: coba LAN Utama dulu (~2 dtk), otomatis pindah ke Cloud Cadangan bila timeout tanpa memutus sesi."`
  2. `InputField` 1 (`testID="server-lan-input"`): label `"URL Utama (LAN Toko)"`, placeholder `"http://192.168.1.100:3000"`, helper `"Prioritas utama saat terhubung ke Wi-Fi toko."`, plus 2 quick-fill `hintChip` buttons (`minHeight: 48`): `LAN (192.168.1.100:3000)` and `Emulator (10.0.2.2:3000)`.
  3. `InputField` 2 (`testID="server-cloud-input"`): label `"URL Cadangan (Cloud)"`, placeholder `"https://kasir.tokorejeki.my.id"`, helper `"Jalur HTTPS otomatis saat di luar Wi-Fi toko."`, plus 1 quick-fill `hintChip`: `Cloud (kasir.tokorejeki.my.id)`.
  4. `buttonRow` (`server-test-button` `"Tes Koneksi Server"` + `server-save-button` `"Simpan Alamat Server"`), disabling all inputs & chips during `isTesting` (`ServerUrlPanel.tsx` lines 177–258).
  5. Live `FeedbackBanner` showing `"LAN Utama Terhubung"` vs `"Terhubung via Cloud Cadangan"` vs explicit Dual-URL error (`02-UI-SPEC.md` lines 149–151).

---

#### `src/components/common/InitialSyncBanner.tsx` (component, event-driven)

**No direct analog** — composes `FeedbackBanner` (`src/components/ui/VelocityPrimitives.tsx` lines 297–350) and `EmptyStateCard` (`src/components/common/EmptyStateCard.tsx` lines 14–61).

**Two exports matching `02-UI-SPEC.md` lines 153–165:**
1. `<InitialSyncBanner />`:
   - Reads `useSyncEngine()`. Renders ONLY when `lastFullSyncAt === null && totalCachedProducts === 0 && isSyncing`.
   - Mounts directly below `<TabScreenHeader />` in `kasir.tsx`, `produk.tsx`, `pesanan.tsx`, `pengaturan.tsx` (`marginHorizontal: TOKENS.spacing.md`, `marginTop: TOKENS.spacing.sm`), using `#d6e3ff` (`primaryFixed`) fill, `1px #00478d` (`primary`) border, `ActivityIndicator size="small" color={TOKENS.colors.onPrimaryFixed}`, title `"Menyinkronkan katalog toko..."`, body `"Mengunduh produk, kategori, dan satuan. Navigasi tetap dapat digunakan."`.
2. `<CatalogBootstrapEmptyState />` (shared by `kasir.tsx` and `produk.tsx` to avoid duplicating copy/state branching):
   - Case A (`lastFullSyncAt === null && totalCachedProducts === 0 && !isSyncing`): `CloudOff` (`24px` `onErrorContainer` in `errorContainer` badge), heading `"Katalog Lokal Belum Tersinkron"`, primary CTA `"Sinkronkan Sekarang"` (`onPress={() => void triggerManualFullSync()}`), secondary tonal CTA `"Buka Pengaturan"` (`router.push("/pengaturan")`).
   - Case B (`lastFullSyncAt !== null && totalCachedProducts === 0`): `Database` (`24px` `primary` in `surfaceContainer` badge), heading `"Katalog Kasir Mini Masih Kosong"`, outlined CTA `"Sinkronkan Sekarang"`.

---

#### `src/components/pengaturan/ResetCacheConfirmModal.tsx` (component, event-driven)

**Analog:** `src/components/common/LogoutConfirmModal.tsx` (lines 1–177) — **exact visual twin.**

**Copy every structural & styling detail from `LogoutConfirmModal.tsx` lines 25–176:**
- Same `Modal` (`transparent`, `animationType="fade"`, `statusBarTranslucent`, `onRequestClose` blocked while `isResetting`).
- Same `card` (`maxWidth: 400`, `maxHeight: "90%"`, `radii.lg`, `padding: spacing.lg`, inner `ScrollView` with `gap: spacing.md`).
- Header: `32x32` `errorContainer` badge with `RotateCcw` (`18px` `destructive`) + `"Reset Cache Lokal?"` (`heading`).
- Body (`body`, `onSurfaceVariant`): `"Seluruh salinan produk, kategori, satuan, dan metadata sinkronisasi SQLite di perangkat ini akan dihapus, lalu katalog penuh diunduh ulang bila server terhubung."`
- Caution box (`surfaceContainerLow`, `TriangleAlert` `18px` `warningText`): `"Sesi login, alamat server, dan nota lokal tetap aman dan tidak akan dihapus."`
- Actions: `"Pertahankan Cache"` (`SecondaryButton variant="tonal"`) + `"Ya, Reset Cache"` (`SecondaryButton variant="danger"`, `loading={isResetting}`, `loadingLabel="Mereset Cache..."`).

---

#### `src/components/pengaturan/SyncControlCard.tsx` (component, CRUD)

**Analog:** `src/app/(app)/(tabs)/pengaturan.tsx` (lines 108–137, 174–275) + `../Apps_Toko_Rejeki/apps/src/app/(pos)/pengaturan/page.tsx` (lines 800–926)

**Structure (`02-UI-SPEC.md` lines 173–200):**
- Wrapped in `<SurfaceCard testID="pengaturan-sync-card" style={styles.card}>` (rendered for **all roles**: `kasir`, `admin`, `owner`).
- Header row: `"Sinkronisasi Katalog"` (`heading`) + Active Route Badge (`LAN` `successBg`/`successText` | `Cloud` `cloudBg`/`cloudText` | `Offline` `errorContainer`/`onErrorContainer`) + 2-line subtitle.
- 3 Metric Tiles (`flexDirection: "row"`, `flexWrap: "wrap"`, `gap: TOKENS.spacing.sm`, each `flexGrow: 1`, `flexBasis: "30%"`, `minWidth: 96`, `surfaceContainerLow`, `1px borderSubtle`, `radii.md`, `padding: TOKENS.spacing.sm`): `Produk`, `Kategori`, `Satuan`.
- WIB Timestamps Box (`surfaceContainerLow`, `1px borderSubtle`, `radii.sm`, `padding: TOKENS.spacing.md`, `gap: TOKENS.spacing.sm`): `"Sinkronisasi Penuh Terakhir"` & `"Pembaruan Delta Terakhir"` formatted deterministically via UTC+7 helper (never device-locale `toLocaleTimeString`) + schedule notes (`"Jadwal otomatis: 10:00 WIB atau jeda > 48 jam"`, `"Polling otomatis setiap 5 detik saat layar aktif"`).
- Inline `FeedbackBanner` for `actionFeedback` (using exact copy from `02-UI-SPEC.md` line 107) or `syncErrorMessage`.
- 3 Action Buttons (`flexDirection: "row"`, `flexWrap: "wrap"`, `gap: TOKENS.spacing.sm`, each `flexGrow: 1`, `minWidth: 220`):
  1. `SecondaryButton variant="outlined"` (`RefreshCw` `18px`): `"Cek Pembaruan (Delta)"` (`loadingLabel="Memeriksa Pembaruan..."`)
  2. `PrimaryButton` (`CloudDownload` `18px`): `"Sinkronisasi Penuh"` (`loadingLabel="Mengunduh Katalog..."`)
  3. `SecondaryButton variant="danger-outline"` (`Trash2` `18px`): `"Reset Cache Lokal"` -> opens `ResetCacheConfirmModal`
  *(All disabled when `isSyncing || isResetting`.)*
- `"Riwayat Sinkronisasi Terbaru"` (`sync_audit` stack, 5–10 newest rows, or `"Belum Ada Riwayat Sinkronisasi"` empty copy):
  - Line 1: Mode pill (`FULL` in `primaryFixed`/`onPrimaryFixed` or `DELTA` in `surfaceContainer`/`onSurface`) + Status pill (`Berhasil` in `successBg`/`successText` with `CheckCircle2` `13px`, or `Gagal` in `errorContainer`/`onErrorContainer` with `AlertCircle` `13px`) + right-aligned WIB timestamp (`mono`).
  - Line 2: `SUCCESS` `"+{recordsUpserted} disimpan, -{recordsDeleted} dihapus ({durationMs} ms)"`; `FAILED` `"{errorMessage} ({durationMs} ms)"` (`numberOfLines={2}`).

---

#### `src/app/(app)/(tabs)/pengaturan.tsx` (component, event-driven)

**Analog:** `src/app/(app)/(tabs)/pengaturan.tsx` (lines 108–171)

**Changes:**
- Update `Koneksi Server` card (`pengaturan-server-card`, lines 108–137):
  - In `savedUrlBox`, render 2 stacked entries:
    1. `"URL Utama (LAN)"` + optional `"Aktif"` emerald badge when `activeRoute === "lan"` + `testID="pengaturan-saved-server-url"` (`numberOfLines={2}`) showing `serverConfig.primaryUrl || "Tidak diatur"`.
    2. `"URL Cadangan (Cloud)"` + optional `"Aktif"` indigo badge when `activeRoute === "cloud"` + `testID="pengaturan-saved-cloud-url"` (`numberOfLines={2}`) showing `serverConfig.fallbackUrl || "Tidak diatur"`.
  - Pass Dual-URL config & callbacks to `<ServerUrlPanel />`.
- Mount `<InitialSyncBanner />` right below `<TabScreenHeader />`.
- Mount `<SyncControlCard onOpenResetModal={() => setShowResetModal(true)} ... />` between `pengaturan-server-card` and `pengaturan-logout-card` (`D-11`).
- Mount `<ResetCacheConfirmModal />` alongside `<LogoutConfirmModal />` (lines 157–169), blocking dismiss while `isResetting`.

---

#### `src/app/(app)/(tabs)/kasir.tsx`, `produk.tsx`, `pesanan.tsx` & `src/app/(auth)/login.tsx` (components)

**Analogs:** `kasir.tsx` (lines 1–65), `produk.tsx` (lines 1–87), `pesanan.tsx` (lines 1–45), `login.tsx` (lines 127–140)

- **All 4 tabs:** Render `<InitialSyncBanner />` immediately below `<TabScreenHeader />` so initial sync progress stays visible across tab switches (`D-10`, `02-UI-SPEC.md` line 155).
- **`kasir.tsx` & `produk.tsx`:**
  - Read `useSyncEngine()` (`isSyncing`, `lastFullSyncAt`, `catalogCounts`, `triggerManualFullSync`).
  - When `catalogCounts.products === 0`: render `<CatalogBootstrapEmptyState />` (handling both initial sync failure with `"Sinkronkan Sekarang"` + `"Buka Pengaturan"`, and legitimately empty `Kasir Mini` with `"Katalog Kasir Mini Masih Kosong"`).
  - When `catalogCounts.products > 0`: `produk.tsx` preserves its `Mode Baca Saja (Kasir)` vs `Mode Kelola Katalog Aktif` banner (`produk.tsx` lines 27–64) and shows a calm synced catalog summary (`"{catalogCounts.products} produk Kasir Mini tersinkronisasi di SQLite lokal"`, strictly no `costPrice` for `kasir`, until Phase 4 full product list); `kasir.tsx` updates its status banner to reflect ready local catalog (`"{catalogCounts.products} produk siap digunakan"`).
- **`login.tsx`:**
  - Update `<ServerUrlPanel />` call (lines 136–140) to Dual-URL props.
  - Show `server-unconfigured-banner` (`lines 127–134`) only when **both** `serverConfig.primaryUrl` and `serverConfig.fallbackUrl` are empty (since `D-01` pre-populates defaults on fresh boot).

---

### 6. Jest Wave 0 `node:sqlite` Infrastructure & Phase 2 Tests (`SYNC-01`–`SYNC-04`, `NAV-03`)

#### `__tests__/setup.ts` (test, config)

**Analog:** `__tests__/setup.ts` (lines 1–178) + `node_modules/expo-sqlite/src/SQLiteDatabase.ts` (lines 140–205, 387–483)

**In-memory `node:sqlite` mock pattern (`Node v24.22.1`, SQLite `3.53.4` verified):**
```typescript
const nodeSqlite = process.getBuiltinModule("node:sqlite") as {
  DatabaseSync: new (path: string) => {
    exec: (sql: string) => void;
    prepare: (sql: string) => {
      run: (...params: unknown[]) => { changes: number | bigint; lastInsertRowid: number | bigint };
      get: (...params: unknown[]) => Record<string, unknown> | undefined;
      all: (...params: unknown[]) => Array<Record<string, unknown>>;
    };
    close: () => void;
  };
};
```
- **Critical `node:sqlite` vs `expo-sqlite` parity details (empirically verified):**
  1. `DatabaseSync.prepare(sql).get(...)` returns `[Object: null prototype] { ... }` or `undefined`; map `undefined -> null` and shallow-clone `{ ...row }` so Jest `.toEqual(...)` passes cleanly.
  2. `DatabaseSync.prepare(sql).all(...)` returns `[ [Object: null prototype] { ... } ]`; map `rows.map((r) => ({ ...r }))`.
  3. `DatabaseSync.prepare(sql).run(...)` returns `{ changes, lastInsertRowid }` (lowercase `id`); expose `{ changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) }` to match `expo-sqlite`'s `SQLiteRunResult`.
  4. Normalize `runAsync` / `getFirstAsync` / `getAllAsync` parameters to accept both `method(sql, [p1, p2])` and variadic `method(sql, p1, p2)` (`SQLiteDatabase.ts` lines 387–483).
  5. Implement `withTransactionAsync(task)` (`BEGIN` -> `await task()` -> `COMMIT` / `ROLLBACK`) AND `withExclusiveTransactionAsync(task)` (`BEGIN IMMEDIATE` -> `await task(dbProxy)` -> `COMMIT` / `ROLLBACK`), plus `execAsync`, `closeAsync`, and `openDatabaseAsync` keyed by database name.
  6. Export `resetTestDatabase()` alongside `resetTestStorage()` (`__tests__/setup.ts` lines 175–178) to close/clear in-memory DBs + reset `sqlite.ts` singleton between tests!
  7. Keep `jest.mock("expo-sqlite/kv-store", ...)` (`setup.ts` lines 19–74) untouched so synchronous `Storage.*Sync` works identically.

#### Phase 2 New & Updated Test Suites
- **New:** `__tests__/catalogDb.test.ts` (role-based `costPrice` stripping + `admin`/`owner` retention + WAL/mutex/reset preservation), `__tests__/syncEngine.test.ts` (`10:00 WIB` UTC+7 math, clock skew, `>48h`, `server_time` cursor, `client_id` UUID, empty `mini_*` vs failed initial sync), `__tests__/syncEngineContext.test.tsx` (`AppState` foreground/background, `expo-network` recovery, `5s -> 15s -> 30s` backoff), `__tests__/systemStatusHeader.test.tsx` (`LAN Online`, `Cloud Online`, `Standby Baca Saja`, `Offline`, tap-to-refresh, tap-to-delta across all 4 tabs), `__tests__/pengaturanSync.test.tsx` (`SyncControlCard` metrics, WIB timestamps, 5–10 `sync_audit` rows, manual Delta/Full, `ResetCacheConfirmModal` preserving `SecureStore` session & Dual Server URLs).
- **Updated (`02-RESEARCH.md` Pitfall #3 & Phase 1 test parity):**
  - `__tests__/serverConfig.test.ts`: extend for Dual-URL defaults, legacy `pos_server_base_url` migration, single-URL vs both-empty validation, and LAN->Cloud connection test.
  - `__tests__/apiClient.test.ts`: extend for sticky `activeRoute`, 2s LAN->Cloud failover preserving `pos_session`, and strict no-failover on `401`/`403`/JSON `503`.
  - `__tests__/loginScreen.test.tsx`: update lines 276–286 (`"Alamat Server Belum Terhubung"`) and `server-url-input` selectors (`lines 296, 345, 355, 382, 403`) to match `D-01` pre-populated Dual-URL defaults and `server-lan-input` / `server-cloud-input`.
  - `__tests__/tabScreens.test.tsx`: update `server-url-input` (`line 183`) and `"Katalog Produk Belum Tersinkronisasi"` (`line 270`) assertions if Phase 2 initial empty copy (`"Katalog Lokal Belum Tersinkronisasi"` / `"Katalog Kasir Mini Masih Kosong"`) replaces the Phase 1 placeholder copy, while keeping `AuthProvider`-only standalone rendering working via non-throwing context fallbacks!

---

## Shared Patterns

### 1. Authentication, `pos_session` Continuity & Failover Boundaries
**Source:** `src/services/api/apiClient.ts` (lines 81–249) + `src/context/AuthContext.tsx` (lines 145–170)
**Apply to:** `apiClient.ts`, `authApi.ts`, `healthApi.ts`, `syncApi.ts`, `SystemStatusContext.tsx`, `SyncEngineContext.tsx`
- All requests use `credentials: "omit"` and manually inject `Cookie: pos_session=${token}` from `expo-secure-store` (`apiClient.ts` lines 82–121).
- `authEpoch` prevents stale background `/api/auth/me` or sync `401` responses from wiping a newer login (`apiClient.ts` lines 147, 184–207).
- Failover from LAN to Cloud runs **only** on transport/timeout (`networkError === true`) or non-JSON `502`/`503`/`504` gateway errors — **never** on `400`, `401`, `403`, `404`, `429`, or PostgreSQL JSON `503 { offline: true }`.
- Only HTTP `401` (any endpoint) or HTTP `403` on `/api/auth/me` clears `SecureStore` (`apiClient.ts` line 186).

### 2. Fail-Closed `costPrice` Role Isolation (`D-09`)
**Source:** `src/context/AuthContext.tsx` (`computeRoleCapabilities` lines 76–85) + `src/sync/productNormalizer.ts`
**Apply to:** `src/db/catalogRepo.ts`, `src/app/(app)/(tabs)/produk.tsx`, `src/app/(app)/(tabs)/kasir.tsx`
- SQLite `products` stores `cost_price` and full `unit_conversions_json` so switching `kasir` -> `admin`/`owner` does not trigger a re-sync.
- Every read method in `catalogRepo.ts` requires `role: UserRole | null` and passes every hydrated `Product` through `sanitizeProductForRole(product, role)` (stripping `costPrice` on both `Product` and `unitConversions` whenever `role !== "admin" && role !== "owner"`).

### 3. SQLite Write Serialization & Transaction Safety (`D-06`)
**Source:** `src/services/storage/secureStorage.ts` (`enqueueAuthStorageOp` lines 21–34) + `node_modules/expo-sqlite/src/SQLiteDatabase.ts` (lines 140–205)
**Apply to:** `src/db/sqlite.ts`, `src/sync/syncMutex.ts`, `src/db/catalogRepo.ts`, `src/db/syncMetaRepo.ts`, `src/sync/syncEngine.ts`
- All SQLite writes run through `enqueueDbWrite` -> `runWriteTransaction` (using `withExclusiveTransactionAsync` + `PRAGMA busy_timeout = 5000;` on native, `withTransactionAsync` on web/Jest).
- Never run `fetch(...)` inside an open SQLite transaction; always complete network requests before acquiring the write lock.
- Emit `emitCatalogUpdated()` only after the transaction resolves.

### 4. Non-Throwing Context Fallbacks for Isolated Component Tests
**Source:** `../Apps_Toko_Rejeki/apps/src/context/SyncEngineContext.tsx` (lines 220–245)
**Apply to:** `src/context/SystemStatusContext.tsx`, `src/context/SyncEngineContext.tsx`
- Because `TabScreenHeader`, `InitialSyncBanner`, and `PengaturanScreen` mount inside tab screens tested standalone with `<AuthProvider>` in `__tests__/tabScreens.test.tsx`, `useSystemStatus()` and `useSyncEngine()` MUST return safe non-throwing fallback objects when `useContext(...)` is `undefined`.

### 5. Velocity Blue Styling & `02-UI-SPEC.md` Contracts
**Source:** `src/theme/tokens.ts` + `src/components/ui/VelocityPrimitives.tsx` + `02-UI-SPEC.md`
**Apply to:** `TabScreenHeader.tsx`, `ServerUrlPanel.tsx`, `InitialSyncBanner.tsx`, `SyncControlCard.tsx`, `ResetCacheConfirmModal.tsx`, `pengaturan.tsx`, `kasir.tsx`, `produk.tsx`
- Strict `StyleSheet.create` + `TOKENS` / `FONT_FAMILY` (zero raw hex literals).
- Multiples-of-4 spacing (`4, 8, 16, 24, 32, 48, 64`), 4 font sizes (`13, 16, 20, 24`), `minHeight: 48` touch targets (`50px` effective via `hitSlop` on compact header pills), Indonesian copy verbatim from `02-UI-SPEC.md` lines 93–109.
- Where `02-RESEARCH.md` lines 396–404 sketched draft pill labels (`Menghubungkan...`, `Katalog (N)`), follow `02-UI-SPEC.md` lines 84–89 & 119–128 (`LAN Online`, `Cloud Online`, `Standby Baca Saja`, `Offline`, `Memeriksa...` and `Katalog Siap`, `Sync Penuh...`, `Sync Delta...`, `Mode Offline`, `Sync Error`).

---

## No Analog Found

Files with no direct existing codebase analog (use `02-RESEARCH.md`, `02-UI-SPEC.md`, and installed SDK types directly):

| File | Role | Data Flow | Guidance Source |
|------|------|-----------|-----------------|
| `src/db/sqlite.ts` | service | file-I/O | `node_modules/expo-sqlite/src/SQLiteDatabase.ts` (lines 140–205) + `02-RESEARCH.md` Pattern 3 (`openDatabaseAsync`, external `WAL`/`busy_timeout` PRAGMAs, `withExclusiveTransactionAsync` caveat, `PRAGMA wal_checkpoint(PASSIVE)`). |
| `src/components/common/InitialSyncBanner.tsx` | component | event-driven | `02-UI-SPEC.md` Section 3 (lines 153–165) + `02-CONTEXT.md` `D-10`, built by composing `FeedbackBanner` (`VelocityPrimitives.tsx`) and `EmptyStateCard.tsx`. |

---

## Metadata

**Analog search scope:**
- `Apps_Toko_Rejeki_Mobile`: `src/**`, `__tests__/**`, `node_modules/expo-sqlite/src/**`, `.planning/phases/02-offline-sqlite-catalog-sync-engine-health-header/**`
- `../Apps_Toko_Rejeki`: `apps/src/app/api/**`, `apps/src/lib/**`, `apps/src/context/**`, `apps/src/components/**`, `apps/src/app/(pos)/**`, `apps/src/types/**`, `production_full_migration.sql`, `DatabaseSchema.md`

**Files scanned:** 31 source/schema/test files directly read + verified via `git ls-files` across both repositories + Node `node:sqlite` API verified via runtime probe
**Pattern extraction date:** 2026-11-19
