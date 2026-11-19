# Phase 2: Offline SQLite Catalog, Sync Engine & Health Header - Context

**Gathered:** 2026-11-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 builds the isolated **Kasir Mini (Minuman Dingin)** catalog sync & live health layer across **Apps Toko Rejeki Mobile** and explicitly approved additive backend endpoints/tables in `../Apps_Toko_Rejeki`:
- Dual-URL server connectivity (**Primary LAN** `http://192.168.1.100:3000` + **Fallback Cloud** `https://kasir.tokorejeki.my.id`, both editable/overridable in settings) with fast LAN priority failover,
- Isolated PostgreSQL twin tables in `../Apps_Toko_Rejeki` (`mini_categories`, `mini_units`, `mini_products`, `mini_product_units`, `mini_wholesale_tiers`, starting empty) exposed additively via `GET /api/sync/full?scope=mini` & `GET /api/sync/delta?scope=mini` (default main PC POS unchanged, zero Web UI changes),
- `expo-sqlite` local catalog database (`products`, `categories`, `units`, `sync_meta`, `sync_audit`, authenticated `StoreSettings`) running in `WAL` mode with `busy_timeout = 5000` and serialized mutations (`syncMutex`), storing the synced **Kasir Mini** catalog,
- Initial & scheduled `GET /api/sync/full` (empty SQLite, past `10:00 WIB`, or `> 48h`) and foreground-only 5-second `GET /api/sync/delta` using server `server_time` and persistent UUID `client_id` with error backoff,
- Persistent global Health & Sync status sub-bar inside `TabScreenHeader` across all 4 tabs (`LAN Online`, `Cloud Online`, `Standby Baca Saja`, `Offline`, plus sync pill with tap-to-refresh), and
- Non-blocking initial sync progress / empty-state recovery plus manual `Cek Pembaruan (Delta)`, `Sinkronisasi Penuh`, `Reset Cache Lokal`, and sync telemetry + recent audit log UI inside `Pengaturan`.

*(Product listing/detail, Kasir multi-tab checkout, and Owner store/account CRUD remain in Phases 3–5 per `ROADMAP.md`.)*

</domain>

<decisions>
## Implementation Decisions

### Dual Server URL & LAN-to-Cloud Failover (`AUTH-02` / `SYNC-01`–`SYNC-03`)
- **D-01:** Aplikasi mendukung **Dual Server URL**: alamat **Utama (LAN Toko)** default `http://192.168.1.100:3000` (IP statis production) dan alamat **Cadangan (Cloud)** default `https://kasir.tokorejeki.my.id` (mengarah ke server & database toko yang sama via HTTPS tunnel sehingga cookie `pos_session` dan `server_time` identik), sambil tetap dapat diubah/di-override pada panel **Alamat Server API** untuk testing dev (mis. `http://10.0.2.2:3000`).
- **D-02:** Perpindahan **LAN ↔ Cloud** berjalan **otomatis dengan prioritas kembali ke LAN (Smart Auto)** — **Reversibility:** `costly` — menyentuh resolusi `baseUrl` pada `serverConfig.ts`, `apiClient.ts`, `AuthContext.tsx`, dan UI panel konfigurasi server: saat request atau pengecekan aktif, coba URL utama LAN secara cepat (~2 detik); jika gagal/timeout, otomatis failover ke URL cadangan Cloud tanpa memutus sesi, dan secara berkala/saat Wi-Fi pulih menguji kembali LAN agar prioritas utama kembali ke `192.168.1.100:3000`.

### Header Status Global (`NAV-03`)
- **D-03:** [src/components/common/TabScreenHeader.tsx](src/components/common/TabScreenHeader.tsx) menampilkan **sub-baris status kompak** tepat di bawah baris judul utama pada seluruh 4 tab (`Kasir`, `Produk`, `Pesanan`, `Pengaturan`) sehingga judul halaman tetap lega dan kedua pill muat rapi di layar 360px.
- **D-04:** Pill Status DB (`/api/health`) menampilkan keterangan jalur server aktif secara langsung (**`LAN Online`**, **`Cloud Online`**, **`Standby Baca Saja`**, atau **`Offline`**) beserta Pill Status Sync katalog di sebelahnya.
- **D-05:** Ketuk langsung pada Pill Status DB memicu refresh `/api/health` (termasuk pengecekan ulang jalur LAN/Cloud), dan ketuk langsung pada Pill Status Sync memicu manual `Delta Sync` (selaras dengan perilaku `Header.tsx` web).

### SQLite WAL Catalog, Sync Rules & Role Isolation (`SYNC-01`, `SYNC-02`, `SYNC-03`)
- **D-06:** Katalog lokal (`products`, `categories`, `units`, `sync_meta`, `sync_audit`, serta `StoreSettings` terautentikasi) disimpan di **`expo-sqlite`** dengan `PRAGMA journal_mode = WAL;`, `PRAGMA busy_timeout = 5000;`, dan serialisasi penulisan melalui `syncMutex` — **Reversibility:** `costly` — mendefinisikan skema tabel SQLite lokal yang dipakai langsung oleh modul Kasir (Phase 3) dan Produk (Phase 4).
- **D-07:** Sinkronisasi otomatis menyimpan dan mengirim `server_time` dari server bersama UUID persisten `client_id` (bukan jam perangkat), mengeksekusi `GET /api/sync/full` saat SQLite kosong, melewati jadwal harian `10:00 WIB` (`Asia/Jakarta`), atau selisih `last_full_sync_at > 48 jam` (membersihkan item yang di-hard-delete), serta menjalankan polling `GET /api/sync/delta` setiap **5 detik** hanya saat aplikasi aktif di foreground (`AppState === "active"`) dan terhubung ke server.
- **D-08:** Jika polling delta 5 detik atau `/api/health` gagal berturut-turut di kedua server (`LAN` maupun `Cloud`), data SQLite lokal tetap dipertahankan penuh dan interval cek menerapkan **backoff bertahap (15–30 detik)** untuk menghemat baterai, lalu otomatis kembali ke polling **5 detik** begitu salah satu server kembali terjangkau.
- **D-09:** Kolom `costPrice` produk/satuan tetap disimpan pada tabel SQLite lokal agar pergantian akun `kasir` → `admin`/`owner` pada perangkat yang sama tidak perlu mengulang *full sync*, namun seluruh fungsi repository baca dan layer UI wajib **memblokir/menghilangkan `costPrice`** ketika peran aktif adalah `kasir`.

### Initial Sync UX & Pengaturan Sync Controls (`SYNC-02`, `SYNC-04`)
- **D-10:** Saat pengguna login perdana dengan SQLite masih kosong, proses `Full Sync` awal menampilkan **banner progres non-blocking** di dalam shell 4 tab (*"Menyinkronkan katalog toko..."*) dan animasi pill Sync agar UI tetap responsif; bila sync perdana gagal saat masih 0 produk, tampilkan kartu empty state informatif dengan tombol **`Sinkronkan Sekarang`** serta auto-retry saat koneksi pulih.
- **D-11:** Tab `Pengaturan` memuat kartu **Sinkronisasi Katalog** bagi **semua staf (`kasir`, `admin`, `owner`)**: menampilkan jumlah produk/kategori/satuan tersimpan, timestamp WIB `last_full_sync_at` & `last_delta_sync_at`, jalur aktif (`LAN` / `Cloud`), **5–10 riwayat log terbaru (`sync_audit`)**, serta tombol **`Cek Pembaruan (Delta)`**, **`Sinkronisasi Penuh`**, dan **`Reset Cache Lokal`** (dengan dialog konfirmasi; saat dikonfirmasi akan mengosongkan katalog SQLite & metadata sync lalu langsung memicu `Full Sync` baru bila online, tanpa menghapus sesi login, Server URL, maupun nota lokal).

### Isolasi Katalog Kasir Mini & Ekstensi Backend `Apps_Toko_Rejeki` (`SYNC-01`–`SYNC-03`)
- **D-12:** Di database PostgreSQL `../Apps_Toko_Rejeki` diciptakan **5 tabel kembar terpisah** dengan struktur kolom, constraint, dan indeks yang sama persis untuk katalog **Kasir Mini (Minuman Dingin)** — **Reversibility:** `one-way` — skema tabel PostgreSQL persisten di server production: `public.mini_categories`, `public.mini_units`, `public.mini_products` (FK -> `mini_categories`), `public.mini_product_units` (FK -> `mini_products`, `mini_units`), dan `public.mini_wholesale_tiers` (FK -> `mini_product_units`), dimulai **kosong (0 baris)** saat migrasi tanpa menyalin katalog Kasir Utama.
- **D-13:** Endpoint backend `../Apps_Toko_Rejeki` (`GET /api/sync/full` dan `GET /api/sync/delta` di Phase 2; disiapkan pola seragam untuk `/api/products/**`, `/api/categories/**`, `/api/units/**` di Phase 4–5) diperluas secara aditif menggunakan parameter **`?scope=mini`** (default tanpa `scope` tetap membaca tabel utama `products`/`categories`/`units` agar Web PC Kasir Utama tidak berubah sama sekali dan tanpa perubahan UI Web PC).
- **D-14:** Pada perangkat mobile (`expo-sqlite`), hanya terdapat **1 set tabel katalog lokal** (`products`, `categories`, `units`, `sync_meta`, `sync_audit`) yang menyinkronkan data **Kasir Mini (`?scope=mini`)** sepenuhnya; seluruh perubahan migrasi SQL & route backend `../Apps_Toko_Rejeki` dilaksanakan secara idempoten (`CREATE TABLE IF NOT EXISTS`) dan tidak merusak tabel utama yang sedang dipakai production.

### Agent's Discretion
- Detail struktur indeks SQLite tambahan (mis. indeks `sku`, `barcode`, `category_id`, `name`), implementasi `syncMutex` async queue, ambang batas tepat backoff (mis. 15 dtk / 30 dtk) serta detail komponen modal konfirmasi `Reset Cache Lokal` dan kartu audit log mengikuti sistem *Velocity Blue*.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning & Phase 1 Foundations
- `.planning/PROJECT.md` — Constraints (`Expo + Expo Router + TypeScript`, backend read-only rule, offline resilience)
- `.planning/REQUIREMENTS.md` — Phase 2 requirements (`NAV-03`, `SYNC-01`, `SYNC-02`, `SYNC-03`, `SYNC-04`)
- `.planning/ROADMAP.md` — Phase 2 Goal, Success Criteria, and Verification/Research Flag
- `.planning/research/ARCHITECTURE.md` — Offline SQLite WAL schema, `syncMutex`, and 3-tier persistence architecture
- `.planning/research/PITFALLS.md` — SQLite WAL locks, Hermes `Intl` / `10:00 WIB` timezone pitfalls, and `server_time` cursor rules
- `.planning/phases/01-auth-lan-transport-spike-role-protected-shell/01-CONTEXT.md` — Phase 1 decisions (`D-01`..`D-09`)
- `.planning/phases/01-auth-lan-transport-spike-role-protected-shell/01-UI-SPEC.md` — Velocity Blue visual tokens, 4 typography sizes, and 48px touch-target rules

### Sibling Reference Backend & Web Sync (`../Apps_Toko_Rejeki`, Approved Additive Scope `?scope=mini`)
- `../Apps_Toko_Rejeki/DatabaseSchema.md` — Ground truth DDL/FK/indexes for `categories`, `units`, `products`, `product_units`, `wholesale_tiers` to mirror identically into `mini_*` tables
- `../Apps_Toko_Rejeki/production_full_migration.sql` — Existing soft-delete (`updated_at`, `deleted_at`) & schema conventions in PostgreSQL
- `../Apps_Toko_Rejeki/apps/src/app/api/products/route.ts` — Existing product query join/formatting conventions (`formatProductRow`)
- `../Apps_Toko_Rejeki/apps/src/app/api/sync/full/route.ts` — Existing full sync payload shape & `sync_checkpoints` logging to extend with `?scope=mini`
- `../Apps_Toko_Rejeki/apps/src/app/api/sync/delta/route.ts` — Existing delta sync contract (`since`, `has_changes`, `upserted`/`deleted`, `server_time`) to extend with `?scope=mini`
- `../Apps_Toko_Rejeki/apps/src/app/api/health/route.ts` — Cluster/DB health JSON (`status`, `database`, `isReadOnly`, `nodeRole`, `latencyMs`)
- `../Apps_Toko_Rejeki/apps/src/lib/offlineDb.ts` — Reference schema (`products`, `categories`, `units`, `sync_meta`, `sync_audit`)
- `../Apps_Toko_Rejeki/apps/src/lib/syncEngine.ts` — Reference `client_id`, `10:00 WIB` & `>48h` gates, and delta/full checkpoint logic
- `../Apps_Toko_Rejeki/apps/src/context/SyncEngineContext.tsx` & `SystemStatusContext.tsx` — Reference 5s/10s foreground polling & reconnection hooks
- `../Apps_Toko_Rejeki/apps/src/components/Header.tsx` — Reference dual-pill DB + Sync status UX & tap-to-refresh interactions
- `../Apps_Toko_Rejeki/design.md` — Velocity Blue color tokens & semantic status styling
- `../Apps_Toko_Rejeki/apps/src/app/api/sync/full/route.ts` — Payload shape & query contract for `GET /api/sync/full`
- `../Apps_Toko_Rejeki/apps/src/app/api/sync/delta/route.ts` — Incremental delta contract (`since`, `has_changes`, `upserted`/`deleted`, `server_time`)
- `../Apps_Toko_Rejeki/apps/src/app/api/health/route.ts` — Live cluster/database health JSON contract (`status`, `database`, `isReadOnly`, `nodeRole`, `latencyMs`)
- `../Apps_Toko_Rejeki/apps/src/lib/offlineDb.ts` — Canonical table schemas (`products`, `categories`, `units`, `sync_meta`, `sync_audit`)
- `../Apps_Toko_Rejeki/apps/src/lib/syncEngine.ts` — Reference `client_id`, `10:00 WIB` & `>48h` gates, and delta/full checkpoint logic
- `../Apps_Toko_Rejeki/apps/src/context/SyncEngineContext.tsx` — Reference 5s foreground polling & DB reconnection sync trigger
- `../Apps_Toko_Rejeki/apps/src/context/SystemStatusContext.tsx` — Reference `/api/health` 10s polling & state transitions
- `../Apps_Toko_Rejeki/apps/src/components/Header.tsx` — Reference dual-pill DB + Sync status UX & click-to-refresh interactions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/common/TabScreenHeader.tsx` — Already provides `SafeAreaView edges={["top"]}`, `#ffffff` card bar, `#e2e8f0` bottom border, and `rightSlot`; can be extended cleanly with a compact status sub-row across all 4 tab screens (`D-03`).
- `src/services/api/apiClient.ts` & `src/services/storage/serverConfig.ts` — Currently resolve a single `server_base_url` via `kv-store` and execute `expo/fetch` with manual `Cookie: pos_session=...` injection and `authEpoch` revocation guards.
- `src/services/storage/secureStorage.ts` — Already uses `expo-sqlite/kv-store` for `pos_server_base_url` and `pos_store_settings` alongside `expo-secure-store` for `pos_session_token` & `pos_user_snapshot`.
- `src/context/AuthContext.tsx` — Already manages `serverUrl`, `storeSettings`, `roleCapabilities`, and epoch-guarded `/api/auth/me`.
- `src/components/ui/VelocityPrimitives.tsx` & `src/theme/tokens.ts` — Typed Velocity Blue surfaces, `FeedbackBanner`, buttons (`minHeight: 48`), and `EmptyStateCard.tsx`.

### Established Patterns
- Strict `StyleSheet.create` + `TOKENS` (zero raw hex literals), React 19 ESLint clean (`react-hooks/set-state-in-effect`), `jest-expo` + `@testing-library/react-native` with `resetTestStorage()` in `__tests__/setup.ts`.
- Read-only sibling `../Apps_Toko_Rejeki` consumption (zero silent backend changes).
- Only HTTP `401` (any endpoint) or HTTP `403` on `/api/auth/me` wipes session credentials; `503`/network failures keep local session and catalog active.

### Integration Points
- `src/app/_layout.tsx` & `src/app/(app)/_layout.tsx` — Boot and authenticated `(app)` subtree wrappers where SQLite `SQLiteProvider` / DB init, `SystemStatusProvider`, and `SyncEngineProvider` mount only once authenticated (`key={user.id:user.role}` awareness so role/account isolation stays intact).
- `src/components/common/ServerUrlPanel.tsx` & `src/app/(app)/(tabs)/pengaturan.tsx` — Extend configuration to support Primary LAN (`http://192.168.1.100:3000`) + Fallback Cloud (`https://kasir.tokorejeki.my.id`) plus the new Sync Control & Audit Log card.

</code_context>

<specifics>
## Specific Ideas

- Production shop architecture uses static LAN IP `http://192.168.1.100:3000` (primary) and deployed domain `https://kasir.tokorejeki.my.id` (Cloudflare Tunnel / HTTPS proxy fallback to the same shop server & DB).
- Mobile serves the isolated **Kasir Mini** cold-drinks catalog (`mini_products`, `mini_product_units`, `mini_wholesale_tiers`, `mini_categories`, `mini_units`) via `?scope=mini`, starting empty (`0` rows) on initial PostgreSQL migration while keeping Web PC Kasir Utama UI & tables untouched.
- Header status pill should visually distinguish `LAN Online` vs `Cloud Online` vs `Standby Baca Saja` vs `Offline` so staff immediately know which route is active.
- Keep `Reset Cache Lokal` clear of local session tokens, server URL settings, and future local cart/held-order data.

</specifics>

<deferred>
## Deferred Ideas

- Full searchable/filterable product list UI, 5-mode sort, `Detail Produk`, and `admin`/`owner` product CRUD/Trash → Phase 4
- `Kasir` multi-tab cart, wholesale tiers, checkout, and thermal printing → Phase 3
- Held pending orders tab badge and `Detail Pesanan` → Phase 4
- Full `Profil Toko & Tentang Aplikasi`, Owner store logo upload, staff & category/unit management → Phase 5

</deferred>

---

*Phase: 02-offline-sqlite-catalog-sync-engine-health-header*
*Context gathered: 2026-11-19*
