# Phase 2: Offline SQLite Catalog, Sync Engine & Health Header - Research

**Researched:** 2026-11-19
**Domain:** Expo SDK 58 Local-First SQLite (`WAL`), Dual-URL Smart LAN Failover, Additive PostgreSQL Twin Catalog (`?scope=mini`), Foreground Sync & Health Header
**Confidence:** HIGH (backend schemas, sync endpoints, Phase 1 codebase, and installed Expo SDK 58 modules verified directly on disk; on-device dual-URL failover and WAL concurrency flagged for live device verification in Phase 2)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
#### Dual Server URL & LAN-to-Cloud Failover (`AUTH-02` / `SYNC-01`–`SYNC-03`)
- **D-01:** Aplikasi mendukung **Dual Server URL**: alamat **Utama (LAN Toko)** default `http://192.168.1.100:3000` (IP statis production) dan alamat **Cadangan (Cloud)** default `https://kasir.tokorejeki.my.id` (mengarah ke server & database toko yang sama via HTTPS tunnel sehingga cookie `pos_session` dan `server_time` identik), sambil tetap dapat diubah/di-override pada panel **Alamat Server API** untuk testing dev (mis. `http://10.0.2.2:3000`).
- **D-02:** Perpindahan **LAN ↔ Cloud** berjalan **otomatis dengan prioritas kembali ke LAN (Smart Auto)** — **Reversibility:** `costly` — menyentuh resolusi `baseUrl` pada `serverConfig.ts`, `apiClient.ts`, `AuthContext.tsx`, dan UI panel konfigurasi server: saat request atau pengecekan aktif, coba URL utama LAN secara cepat (~2 detik); jika gagal/timeout, otomatis failover ke URL cadangan Cloud tanpa memutus sesi, dan secara berkala/saat Wi-Fi pulih menguji kembali LAN agar prioritas utama kembali ke `192.168.1.100:3000`.

#### Header Status Global (`NAV-03`)
- **D-03:** [src/components/common/TabScreenHeader.tsx](src/components/common/TabScreenHeader.tsx) menampilkan **sub-baris status kompak** tepat di bawah baris judul utama pada seluruh 4 tab (`Kasir`, `Produk`, `Pesanan`, `Pengaturan`) sehingga judul halaman tetap lega dan kedua pill muat rapi di layar 360px.
- **D-04:** Pill Status DB (`/api/health`) menampilkan keterangan jalur server aktif secara langsung (**`LAN Online`**, **`Cloud Online`**, **`Standby Baca Saja`**, atau **`Offline`**) beserta Pill Status Sync katalog di sebelahnya.
- **D-05:** Ketuk langsung pada Pill Status DB memicu refresh `/api/health` (termasuk pengecekan ulang jalur LAN/Cloud), dan ketuk langsung pada Pill Status Sync memicu manual `Delta Sync` (selaras dengan perilaku `Header.tsx` web).

#### SQLite WAL Catalog, Sync Rules & Role Isolation (`SYNC-01`, `SYNC-02`, `SYNC-03`)
- **D-06:** Katalog lokal (`products`, `categories`, `units`, `sync_meta`, `sync_audit`, serta `StoreSettings` terautentikasi) disimpan di **`expo-sqlite`** dengan `PRAGMA journal_mode = WAL;`, `PRAGMA busy_timeout = 5000;`, dan serialisasi penulisan melalui `syncMutex` — **Reversibility:** `costly` — mendefinisikan skema tabel SQLite lokal yang dipakai langsung oleh modul Kasir (Phase 3) dan Produk (Phase 4).
- **D-07:** Sinkronisasi otomatis menyimpan dan mengirim `server_time` dari server bersama UUID persisten `client_id` (bukan jam perangkat), mengeksekusi `GET /api/sync/full` saat SQLite kosong, melewati jadwal harian `10:00 WIB`, atau selisih `last_full_sync_at > 48 jam` (membersihkan item yang di-hard-delete), serta menjalankan polling `GET /api/sync/delta` setiap **5 detik** hanya saat aplikasi aktif di foreground (`AppState === "active"`) dan terhubung ke server.
- **D-08:** Jika polling delta 5 detik atau `/api/health` gagal berturut-turut di kedua server (`LAN` maupun `Cloud`), data SQLite lokal tetap dipertahankan penuh dan interval cek menerapkan **backoff bertahap (15–30 detik)** untuk menghemat baterai, lalu otomatis kembali ke polling **5 detik** begitu salah satu server kembali terjangkau.
- **D-09:** Kolom `costPrice` produk/satuan tetap disimpan pada tabel SQLite lokal agar pergantian akun `kasir` → `admin`/`owner` pada perangkat yang sama tidak perlu mengulang *full sync*, namun seluruh fungsi repository baca dan layer UI wajib **memblokir/menghilangkan `costPrice`** ketika peran aktif adalah `kasir`.

#### Initial Sync UX & Pengaturan Sync Controls (`SYNC-02`, `SYNC-04`)
- **D-10:** Saat pengguna login perdana dengan SQLite masih kosong, proses `Full Sync` awal menampilkan **banner progres non-blocking** di dalam shell 4 tab (*"Menyinkronkan katalog toko..."*) dan animasi pill Sync agar UI tetap responsif; bila sync perdana gagal saat masih 0 produk, tampilkan kartu empty state informatif dengan tombol **`Sinkronkan Sekarang`** serta auto-retry saat koneksi pulih.
- **D-11:** Tab `Pengaturan` memuat kartu **Sinkronisasi Katalog** bagi **semua staf (`kasir`, `admin`, `owner`)**: menampilkan jumlah produk/kategori/satuan tersimpan, timestamp WIB `last_full_sync_at` & `last_delta_sync_at`, jalur aktif (`LAN` / `Cloud`), **5–10 riwayat log terbaru (`sync_audit`)**, serta tombol **`Cek Pembaruan (Delta)`**, **`Sinkronisasi Penuh`**, dan **`Reset Cache Lokal`** (dengan dialog konfirmasi; saat dikonfirmasi akan mengosongkan katalog SQLite & metadata sync lalu langsung memicu `Full Sync` baru bila online, tanpa menghapus sesi login, Server URL, maupun nota lokal).

#### Isolasi Katalog Kasir Mini & Ekstensi Backend `Apps_Toko_Rejeki` (`SYNC-01`–`SYNC-03`)
- **D-12:** Di database PostgreSQL `../Apps_Toko_Rejeki` diciptakan **5 tabel kembar terpisah** dengan struktur kolom, constraint, dan indeks yang sama persis untuk katalog **Kasir Mini (Minuman Dingin)** — **Reversibility:** `one-way` — skema tabel PostgreSQL persisten di server production: `public.mini_categories`, `public.mini_units`, `public.mini_products` (FK -> `mini_categories`), `public.mini_product_units` (FK -> `mini_products`, `mini_units`), dan `public.mini_wholesale_tiers` (FK -> `mini_product_units`), dimulai **kosong (0 baris)** saat migrasi tanpa menyalin katalog Kasir Utama.
- **D-13:** Endpoint backend `../Apps_Toko_Rejeki` (`GET /api/sync/full` dan `GET /api/sync/delta` di Phase 2; disiapkan pola seragam untuk `/api/products/**`, `/api/categories/**`, `/api/units/**` di Phase 4–5) diperluas secara aditif menggunakan parameter **`?scope=mini`** (default tanpa `scope` tetap membaca tabel utama `products`/`categories`/`units` agar Web PC Kasir Utama tidak berubah sama sekali dan tanpa perubahan UI Web PC).
- **D-14:** Pada perangkat mobile (`expo-sqlite`), hanya terdapat **1 set tabel katalog lokal** (`products`, `categories`, `units`, `sync_meta`, `sync_audit`) yang menyinkronkan data **Kasir Mini (`?scope=mini`)** sepenuhnya; seluruh perubahan migrasi SQL & route backend `../Apps_Toko_Rejeki` dilaksanakan secara idempoten (`CREATE TABLE IF NOT EXISTS`) dan tidak merusak tabel utama yang sedang dipakai production.

### the agent's Discretion
- Detail struktur indeks SQLite tambahan (mis. indeks `sku`, `barcode`, `category_id`, `name`), implementasi `syncMutex` async queue, ambang batas tepat backoff (mis. 15 dtk / 30 dtk) serta detail komponen modal konfirmasi `Reset Cache Lokal` dan kartu audit log mengikuti sistem *Velocity Blue*.

### Deferred Ideas (OUT OF SCOPE)
- Full searchable/filterable product list UI, 5-mode sort, `Detail Produk`, and `admin`/`owner` product CRUD/Trash → Phase 4
- `Kasir` multi-tab cart, wholesale tiers, checkout, and thermal printing → Phase 3
- Held pending orders tab badge and `Detail Pesanan` → Phase 4
- Full `Profil Toko & Tentang Aplikasi`, Owner store logo upload, staff & category/unit management → Phase 5
</user_constraints>

---

## Project Constraints (from GEMINI.md)

Extracted verbatim/actionably from [GEMINI.md](GEMINI.md):
1. **Mandatory Stack:** React Native with **Expo + Expo Router + TypeScript** (`strict: true` per `tsconfig.json:4`) — no unapproved framework shifts.
2. **Backend Compatibility & Approval Boundary:** Consume existing `Apps_Toko_Rejeki` endpoints; Phase 2 includes ONLY the explicitly approved additive PostgreSQL `mini_*` tables and `?scope=mini` query support on `GET /api/sync/full` & `GET /api/sync/delta` (`D-12`..`D-14`) with zero Web PC UI changes and zero impact when `scope` is omitted. Any further backend change requires prior user approval.
3. **Rubric Compliance:** Preserve 4-tab Bottom Navigation Bar (`Kasir`, `Produk`, `Pesanan`, `Pengaturan`) and multi-screen role-protected architecture toward >=5 pages, 2 list→detail flows, and Profile/About.
4. **Offline Resilience:** Login session (`pos_session` + user snapshot) and local catalog must remain readable offline, and pending orders stay isolated from catalog cache clears (`D-11`).
5. **Visual System & Workflow:** Follow *Velocity Blue* (`src/theme/tokens.ts`, `StyleSheet.create`, light-mode locked, 48px touch targets, Indonesian copy). **Critical user instruction for this session:** Do NOT run `git commit` (`"untuk commit dari saya aja ya nanti"`).

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **NAV-03** | *"Header status global menampilkan kondisi koneksi database (`/api/health`: Online / Standby Read-Only / Offline) dan status sinkronisasi katalog lokal"* ([REQUIREMENTS.md](.planning/REQUIREMENTS.md:21)) | `TabScreenHeader.tsx` compact sub-row (`D-03`), `SystemStatusContext` driving `LAN Online` / `Cloud Online` / `Standby Baca Saja` / `Offline` (`D-04`), tap-to-refresh `/api/health` and tap-to-sync `Delta Sync` (`D-05`), plus safe fallback hooks so isolated Phase 1 tests keep passing. |
| **SYNC-01** | *"Aplikasi menyimpan katalog produk, kategori, satuan, dan pengaturan toko secara lokal di `expo-sqlite` (WAL mode) agar tetap dapat dibaca instan saat offline"* ([REQUIREMENTS.md](.planning/REQUIREMENTS.md:26)) | `expo-sqlite@58.0.18` singleton `openDatabaseAsync` with `WAL`, `busy_timeout = 5000`, `syncMutex` async queue (`D-06`), 5 relational-document tables (`products`, `categories`, `units`, `sync_meta`, `sync_audit`), authenticated `StoreSettings` persistence, and `kasir` `costPrice` stripping on all repository reads (`D-09`). |
| **SYNC-02** | *"Aplikasi melakukan sinkronisasi penuh (`GET /api/sync/full`) saat inisialisasi pertama, melewati jadwal harian 10:00 WIB, atau bila sinkronisasi terakhir lebih dari 48 jam"* ([REQUIREMENTS.md](.planning/REQUIREMENTS.md:27)) | Additive PostgreSQL `mini_*` twin schema (`D-12`) + `GET /api/sync/full?scope=mini` (`D-13`), deterministic UTC+7 `10:00 WIB` gate (`hour >= 10` & `lastFullSyncMs < today10AmWibUtcMs` matching server 09:30 WIB `pg_cron` purge), `>48h` check (`TWO_DAYS_MS`), non-blocking initial sync banner + failed-vs-empty catalog state (`D-10`). |
| **SYNC-03** | *"Aplikasi menjalankan polling sinkronisasi delta (`GET /api/sync/delta` berbasis `server_time` dan `client_id`) setiap 5 detik hanya saat aplikasi aktif di foreground dan koneksi tersedia"* ([REQUIREMENTS.md](.planning/REQUIREMENTS.md:28)) | `GET /api/sync/delta?scope=mini` (`D-13`), Dual-URL Smart Auto LAN→Cloud failover (`D-01`..`D-02`), verbatim server `server_time` cursor, pure-TS Hermes-safe UUID `client_id`, `AppState === "active"` + `expo-network` lifecycle gating, recursive `setTimeout` polling with `5s -> 15s -> 30s` error backoff (`D-07`..`D-08`). |
| **SYNC-04** | *"Pengguna dapat memicu `Cek Pembaruan (Delta)`, `Sinkronisasi Penuh`, dan `Reset Cache Lokal` secara manual serta melihat telemetri sinkronisasi di halaman Pengaturan"* ([REQUIREMENTS.md](.planning/REQUIREMENTS.md:29)) | `Pengaturan` Catalog Sync Card for all roles (`D-11`) displaying product/category/unit counts, WIB timestamps, active route (`LAN`/`Cloud`/`Offline`), last 5–10 `sync_audit` entries, manual Delta/Full triggers, and `ResetCacheConfirmModal` preserving `pos_session`, Server URL config, and local held orders. |
</phase_requirements>

---

## Summary

Phase 2 connects **Apps Toko Rejeki Mobile** to a dedicated **Kasir Mini (Minuman Dingin)** catalog isolated in PostgreSQL (`public.mini_*`) while establishing resilient Dual-URL connectivity (**Primary LAN** `http://192.168.1.100:3000` with ~2-second timeout failover to **Fallback Cloud** `https://kasir.tokorejeki.my.id`), local **`expo-sqlite`** WAL catalog persistence, foreground-only delta/full synchronization, and the global Health + Sync status sub-bar inside `TabScreenHeader`.

Every package needed for Phase 2 is **already installed and pinned** in [package.json](package.json) and [package-lock.json](package-lock.json) (`expo@58.0.26`, `expo-sqlite@58.0.18`, `expo-network@58.0.5`, `expo-secure-store@58.0.3`, `zod@4.6.7`, `lucide-react-native@1.75.0`) — meaning **0 new npm dependencies** are needed. Moreover, Node `v24.22.1` in this environment natively includes `node:sqlite` (`DatabaseSync`, SQLite `3.53.4`) accessible via `process.getBuiltinModule("node:sqlite")`, allowing Jest tests to run real in-memory SQLite queries, transactions, indexes, and constraint checks without adding any native Node packages.

Four technical subtleties uncovered during direct codebase inspection should shape the Phase 2 plan:
1. **`expo-sqlite` Transaction Connection Trap:** Verified in [SQLiteDatabase.ts](node_modules/expo-sqlite/src/SQLiteDatabase.ts:180-205) and [SKILL.md](node_modules/expo-sqlite/skills/expo-sqlite/SKILL.md:122-136), `withExclusiveTransactionAsync` opens a **separate connection** (unsupported on web and does not inherit `PRAGMA foreign_keys` or `busy_timeout` from the main handle). Avoid cross-table SQLite `FOREIGN KEY` constraints on synced catalog tables (denormalized `category_name` + atomic batch delete/replace already protect integrity) and execute `PRAGMA busy_timeout = 5000;` inside `txn` (or use `withTransactionAsync` on web/Jest), all serialized through `syncMutex`.
2. **PostgreSQL `postgres.js` & Partial Unique Indexes:** `apps/src/lib/db.ts` wraps `postgres` (`postgres.js`) with a Proxy checking the first SQL keyword (`SELECT` vs `INSERT/UPDATE/DELETE`). Dynamic table interpolation `${tableName}` fails in tagged templates; use strict allowlisted query branching (`scope === "mini"` vs main) and mirror the **partial unique indexes** (`WHERE deleted_at IS NULL`) from `production_full_migration.sql:194-217`, NOT rigid table-level `UNIQUE` constraints.
3. **Hermes Runtime Gaps (`Intl` & `crypto.randomUUID`):** Expo's `runtime.native.ts` does not polyfill `crypto.randomUUID()`, and Hermes ICU support can vary. Use pure UTC+7 epoch math (`+ 7 * 3600 * 1000` with `getUTC*` methods) for `10:00 WIB` and WIB display formatting, plus a `globalThis.crypto?.randomUUID` fast-path with pure-TS RFC 4122 v4 fallback for `client_id`.
4. **Empty `mini_*` Catalog vs Failed Sync (`D-10` vs `D-12`):** Because `mini_*` starts with `0` rows, `GET /api/sync/full?scope=mini` succeeds cleanly with `total_products: 0`. UI empty-state handling must distinguish *"never synced / initial sync failed while 0 rows"* (`Sinkronkan Sekarang` recovery card) from *"successfully synced empty catalog"* (`lastFullSyncAt !== null && totalCachedProducts === 0`).

**Primary recommendation:** Implement the additive PostgreSQL `mini_*` migration + `?scope=mini` routes first alongside the Dual-URL failover transport (`serverConfig.ts` + `apiClient.ts`) and `expo-sqlite` WAL repository (`node:sqlite`-backed in Jest), then wire `SystemStatusContext`, `SyncEngineContext`, `TabScreenHeader` status pills, and `Pengaturan` sync controls with zero new npm dependencies.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Isolated `mini_*` catalog tables & delta/full queries (`D-12`..`D-14`) | API / Backend (`Apps_Toko_Rejeki` + PostgreSQL) | — | Server owns authoritative master catalog, `pg_cron` purge, `NOW()`/`updated_at` triggers, and `sync_checkpoints` (`entity_name = 'mini_catalog'`). |
| DB cluster health probing (`GET /api/health`) | API / Backend (`Apps_Toko_Rejeki/apps/src/app/api/health/route.ts`) | Mobile Client (`SystemStatusContext`) | Server probes Primary/Standby PostgreSQL sockets; mobile combines that with `expo-network` + LAN/Cloud route selection (`D-04`). |
| Dual-URL LAN→Cloud failover & `pos_session` continuity (`D-01`..`D-02`) | Mobile Client Transport (`serverConfig.ts`, `apiClient.ts`) | Mobile Context (`AuthContext`, `SystemStatusContext`) | Server issues stateless HMAC `pos_session` valid on both routes; mobile handles 2s LAN probe, sticky fallback, and Wi-Fi recovery. |
| Local catalog persistence, WAL locking & `kasir` `costPrice` stripping (`D-06`, `D-09`) | Mobile Local Persistence (`src/db/sqlite.ts`, `catalogRepo.ts`, `syncMutex.ts`) | Mobile State (`SyncEngineContext`) | SQLite stores full synced `Product` rows (`cost_price` included for instant account switching); repository read boundary strips `costPrice` whenever `role === "kasir"`. |
| Foreground sync scheduling, `10:00 WIB` / `>48h` gates & backoff (`D-07`, `D-08`) | Mobile Sync Engine (`src/sync/syncEngine.ts`, `SyncEngineContext`) | Mobile UI (`TabScreenHeader`, `Pengaturan`) | Mobile enforces `AppState === "active"`, `server_time` cursors, UTC+7 math, and `5s -> 15s -> 30s` backoff without background drain. |
| Status sub-bar (`NAV-03`), initial sync banner & manual sync controls (`D-03`..`D-05`, `D-10`, `D-11`) | Mobile Presentation (`TabScreenHeader`, `PengaturanScreen`, modals) | Mobile Contexts (`SystemStatusContext`, `SyncEngineContext`) | Thin UI components subscribe to context telemetry and dispatch manual health/delta/full/reset actions. |

---

## Standard Stack

### Core (Verified Installed in Project — Zero New Packages Required)

| Library | Installed Version | Purpose | Provenance & Verification Notes |
|---------|-------------------|---------|--------------------------------|
| `expo` | `58.0.26` (`~58.0.26`) | Managed SDK 58 runtime, `expo/fetch` WinterCG client | `[VERIFIED: package.json:10]` (`package-lock.json` `58.0.26`). Flagged `SUS` (`too-new`) in `package-legitimacy` solely due to `2026-11-17` patch (`postinstall: null`). |
| `expo-sqlite` | `58.0.18` (`~58.0.18`) | Relational WAL SQLite catalog (`openDatabaseAsync`) + synchronous `expo-sqlite/kv-store` | `[VERIFIED: package.json:24]`, `[VERIFIED: node_modules/expo-sqlite/package.json:3]` (`58.0.18`). Flagged `SUS` (`too-new`, `2026-11-17`, `3.06M/wk`, `postinstall: null`). |
| `expo-network` | `58.0.5` (`~58.0.5`) | OS connectivity checks (`getNetworkStateAsync`, `addNetworkStateListener`) | `[VERIFIED: package.json:20]`, `[VERIFIED: node_modules/expo-network/package.json:3]` (`58.0.5`). Flagged `SUS` (`too-new`, `2026-11-11`, `3.89M/wk`, `postinstall: null`). |
| `expo-secure-store` | `58.0.3` (`~58.0.3`) | Encrypted Keychain/Keystore storage for `pos_session_token` & `pos_user_snapshot` | `[VERIFIED: package.json:22]` (`package-lock.json` `58.0.3`). Flagged `SUS` (`too-new`, `2026-11-11`, `12.1M/wk`, `postinstall: null`). |
| `expo-router` | `58.0.32` (`~58.0.32`) | `(app)/_layout.tsx` authenticated shell & 4-tab layout | `[VERIFIED: package.json:21]` (`package-lock.json` `58.0.32`). Flagged `SUS` (`too-new`, `2026-11-17`, `12.0M/wk`, `postinstall: null`). |
| `react` / `react-native` | `19.3.0` / `0.88.1` | React 19 UI + `AppState` foreground/background lifecycle + `StyleSheet.create` | `[VERIFIED: package.json:30,32]` (`package-lock.json` `19.3.0` / `0.88.1`). |
| `zod` | `4.6.7` (`^4.6.7`) | Dual server URL schema & API/settings payload validation | `[VERIFIED: npm registry]` (`OK`, `468.9M/wk`, `postinstall: null`), `[VERIFIED: package.json:40]`. |

### Supporting (Verified Installed)

| Library | Installed Version | Purpose | Provenance & Verification Notes |
|---------|-------------------|---------|--------------------------------|
| `lucide-react-native` | `1.75.0` (`^1.75.0`) | Header pill & Pengaturan icons (`Wifi`, `WifiOff`, `Globe`, `Cloud`, `CloudOff`, `ShieldAlert`, `RefreshCw`, `Database`, `Trash2`, `CheckCircle2`, `AlertCircle`, `TriangleAlert`, `Clock`, `Server`, `RotateCcw`) | `[VERIFIED: package.json:29]`, `[VERIFIED: node_modules/lucide-react-native/package.json:4]` (`1.75.0`), all icon symbols verified in [lucide-react-native.d.ts](node_modules/lucide-react-native/dist/types/lucide-react-native.d.ts). |
| `zustand` | `5.1.0` (`^5.1.0`) | Optional store if preferred, though React Context (`SystemStatusContext` + `SyncEngineContext`) matches Phase 1 `AuthContext` & web parity cleanly | `[VERIFIED: package.json:41]` (`package-lock.json` `5.1.0`). |
| `jest` / `jest-expo` / `@testing-library/react-native` | `30.5.2` / `58.0.15` / `14.1.0` | Unit & integration test suite | `[VERIFIED: package.json:44,49,50]`. |
| Node `node:sqlite` (`DatabaseSync`) | Node `v24.22.1` built-in (SQLite `3.53.4`) | Real in-memory SQLite backend for `expo-sqlite` Jest mock via `process.getBuiltinModule("node:sqlite")` | `[VERIFIED: run_command output]` (`DatabaseSync: function`, `v24.22.1`, SQLite `3.53.4`). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pure-TS RFC-4122 v4 UUID + `crypto.randomUUID` fast-path | `expo-crypto` | Installing `expo-crypto` adds a new `SUS`-flagged native package unnecessarily; `client_id` is a non-secret device observability ID (`mobile-<uuid>`). Keep **0** new npm packages. |
| Deterministic UTC+7 epoch arithmetic (`+ 7h` + `getUTC*`) | `Intl.DateTimeFormat(..., { timeZone: "Asia/Jakarta" })` | Hermes ICU builds can omit timezone data or emit `hour: "24"` at midnight; WIB is permanently UTC+7 with zero DST, so pure UTC+7 arithmetic is 100% deterministic. |
| `expo-sqlite` async singleton + `syncMutex` queue | Drizzle ORM or WatermelonDB | Unnecessary bundle/build overhead; raw typed SQL over indexed `products`/`categories`/`units` matches `D-06` and keeps `expo-sqlite` directly testable in `node:sqlite`. |
| Separate `process.getBuiltinModule("node:sqlite")` mock | Hand-rolled JS object array fake | Hand-rolled SQL fakes miss SQL syntax errors, `PRAGMA` failures, `COLLATE NOCASE` bugs, and index/constraint behavior; `node:sqlite` tests real SQLite DDL/DML in memory with zero deps. |

**Installation:**
```bash
# No new npm packages required for Phase 2 — all dependencies are already installed in package.json / package-lock.json.
```

---

## Package Legitimacy Audit

Executed via `gsd_run query package-legitimacy check --ecosystem npm` on 2026-11-19 (`postinstall: null` across all packages; **0 new packages** installed in Phase 2):

| Package | Registry | Published / Lock | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|------------------|-----------|-------------|---------|-------------|
| `zod` | npm | `4.6.7` (`2026-10-12`) | `468.9M/wk` | `github.com/colinhacks/zod` | `OK` | Already installed — Approved `[VERIFIED: npm registry]` |
| `expo` | npm | `58.0.26` (`2026-11-17`) | `17.2M/wk` | `github.com/expo/expo` | `SUS` (`too-new`) | Already installed in Phase 1 (`package-lock.json` `58.0.26`) — No new install |
| `expo-router` | npm | `58.0.32` (`2026-11-17`) | `12.0M/wk` | `github.com/expo/expo` | `SUS` (`too-new`) | Already installed in Phase 1 (`package-lock.json` `58.0.32`) — No new install |
| `expo-sqlite` | npm | `58.0.18` (`2026-11-17`) | `3.06M/wk` | `github.com/expo/expo` | `SUS` (`too-new`) | Already installed in Phase 1 (`package-lock.json` `58.0.18`) — No new install |
| `expo-network` | npm | `58.0.5` (`2026-11-11`) | `3.89M/wk` | `github.com/expo/expo` | `SUS` (`too-new`) | Already installed in Phase 1 (`package-lock.json` `58.0.5`) — No new install |
| `expo-secure-store` | npm | `58.0.3` (`2026-11-11`) | `12.1M/wk` | `github.com/expo/expo` | `SUS` (`too-new`) | Already installed in Phase 1 (`package-lock.json` `58.0.3`) — No new install |
| `zustand` | npm | `5.1.0` (`2026-11-06`) | `94.9M/wk` | `github.com/pmndrs/zustand` | `SUS` (`too-new`) | Already installed in Phase 1 (`package-lock.json` `5.1.0`) — No new install |
| `lucide-react-native` | npm | `1.75.0` (`2026-11-18`) | `3.75M/wk` | `github.com/lucide-icons/lucide` | `SUS` (`too-new`) | Already installed in Phase 1 (`package-lock.json` `1.75.0`) — No new install |

**Packages removed due to `SLOP` verdict:** None.  
**New packages requiring `checkpoint:human-verify` in Phase 2:** **None** (`0` new packages installed; all listed packages were already verified, approved, and locked in Phase 1).

---

## Architecture Patterns

### System Architecture Diagram

```
  [AppState ("active"/"background") + expo-network]
                          │
                          ▼
  ┌─────────────────────────────────────────────────────────────────────┐
  │                 SystemStatusContext & SyncEngineContext             │
  │  - 10s /api/health probe (LAN 2s -> Cloud fallback -> Offline)      │
  │  - 5s foreground /api/sync/delta?scope=mini (15s->30s backoff)      │
  │  - Boot / 10:00 WIB / >48h -> /api/sync/full?scope=mini             │
  └───────────┬───────────────────────────────┬─────────────────────────┘
              │ HTTP + Cookie: pos_session    │ serialized writes via syncMutex
              ▼                               ▼
  ┌──────────────────────────┐    ┌─────────────────────────────────────┐
  │ Dual-URL Failover Client │    │  expo-sqlite (toko_rejeki_pos.db)   │
  │ (apiClient + serverCfg)  │    │  WAL + busy_timeout=5000            │
  │  1. LAN 192.168.1.100    │    │  - products (incl. cost_price)      │
  │     (2000ms AbortCtrl)   │    │  - categories, units                │
  │  2. Cloud kasir.toko...  │    │  - sync_meta (server_time, client)  │
  │  3. Sticky route + LAN   │    │  - sync_audit (recent sync logs)    │
  │     priority re-probe    │    └──────────────────┬──────────────────┘
  └───────────┬──────────────┘                       │ catalogEvents.emit()
              │                                      ▼
              │                       ┌─────────────────────────────────┐
              │                       │ catalogRepo (Role Isolation)    │
              │                       │  role === "kasir" -> strip      │
              │                       │  costPrice on product & units!  │
              │                       └──────────────────┬──────────────┘
              ▼                                          ▼
  ┌──────────────────────────────┐    ┌─────────────────────────────────┐
  │ Apps_Toko_Rejeki Next.js API │    │ UI Consumption (All 4 Tabs)     │
  │ - /api/health (cluster ping) │    │ - TabScreenHeader (NAV-03 pills)│
  │ - /api/settings (auth full)  │    │ - Initial Sync Banner & Empty   │
  │ - /api/sync/full?scope=mini  │    │ - Pengaturan Sync Card & Logs   │
  │ - /api/sync/delta?scope=mini │    └─────────────────────────────────┘
  │   └─> PostgreSQL mini_* (0+) │
  └──────────────────────────────┘
```

### Recommended Project Structure

```text
Apps_Toko_Rejeki_Mobile/
├── src/
│   ├── db/
│   │   ├── sqlite.ts                  # Singleton openDatabaseAsync + WAL PRAGMAs + user_version migrations
│   │   ├── catalogRepo.ts             # Batch upserts/deletes + role-aware reads (strips costPrice for kasir)
│   │   └── syncMetaRepo.ts            # sync_meta KV, sync_audit logs (bounded), resetCatalogCache()
│   ├── sync/
│   │   ├── syncMutex.ts               # In-process async FIFO write queue + background poll coalescing
│   │   ├── syncEngine.ts              # WIB UTC+7 gates (10:00 WIB, >48h), server_time cursor, client_id UUID
│   │   ├── catalogEvents.ts           # Lightweight pub/sub listener notified post-commit
│   │   └── productNormalizer.ts       # Client-side Product sanitizer & costPrice role stripper
│   ├── services/
│   │   ├── api/
│   │   │   ├── apiClient.ts           # Extended with Dual-URL Smart Auto failover & sticky activeRoute
│   │   │   ├── healthApi.ts           # GET /api/health typed mapper
│   │   │   ├── syncApi.ts             # GET /api/sync/full?scope=mini & GET /api/sync/delta?scope=mini
│   │   │   └── authApi.ts             # Add fetchAuthenticatedSettings() (full StoreSettings post-login)
│   │   └── storage/
│   │       ├── secureStorage.ts       # Dual ServerUrlConfig migration (pos_server_config_v2 <- legacy URL)
│   │       └── serverConfig.ts        # Default Dual URLs, LAN+Cloud normalization & dual connection probe
│   ├── context/
│   │   ├── SystemStatusContext.tsx    # expo-network + AppState + 10s /api/health + backoff + LAN re-probe
│   │   └── SyncEngineContext.tsx      # 5s foreground delta poll + manual Full/Delta/Reset + backoff
│   ├── components/
│   │   ├── common/
│   │   │   ├── TabScreenHeader.tsx    # Compact 2-pill status sub-row (DB Route Pill + Sync Pill)
│   │   │   ├── ServerUrlPanel.tsx     # Primary LAN + Fallback Cloud URL inputs & dev override chips
│   │   │   └── InitialSyncBanner.tsx  # Non-blocking initial sync banner + failed-sync recovery card
│   │   └── pengaturan/
│   │       ├── SyncControlCard.tsx    # Telemetry, counts, WIB timestamps, 5-10 sync_audit rows, 3 buttons
│   │       └── ResetCacheConfirmModal.tsx # Confirmation modal preserving session, Server URL & held orders
│   └── types/
│       └── index.ts                   # Product, Category, Unit, HealthStatus, SyncAuditRecord, ServerUrlConfig
└── ../Apps_Toko_Rejeki/
    ├── mini_catalog_migration.sql     # Idempotent DDL for 5 public.mini_* tables + triggers + indexes
    └── apps/src/app/api/sync/
        ├── full/route.ts              # Additive ?scope=mini support (entity_name = 'mini_catalog')
        └── delta/route.ts             # Additive ?scope=mini support (entity_name = 'mini_catalog')
```

---

### Pattern 1: PostgreSQL `mini_*` Twin Schema & Additive `?scope=mini` Sync (`D-12`..`D-14`)

**What:** Create 5 isolated `public.mini_*` tables in `../Apps_Toko_Rejeki` matching the **post-migration** schema of `categories`, `units`, `products`, `product_units`, and `wholesale_tiers` (including `updated_at`, `deleted_at`, triggers, partial unique indexes, and delta B-tree indexes), starting with 0 rows, and extend `sync/full` and `sync/delta` additively via `?scope=mini`.

**Verified Production Schema Facts (Must Match Exactly):**
1. Base columns from `DatabaseSchema.md`:
   - `categories`: `id uuid DEFAULT gen_random_uuid() NOT NULL`, `name character varying(100) NOT NULL`, `created_at timestamptz DEFAULT now() NOT NULL` (`DatabaseSchema.md:260-264`).
   - `units`: `id uuid DEFAULT gen_random_uuid() NOT NULL`, `name character varying(50) NOT NULL`, `created_at timestamptz DEFAULT now() NOT NULL` (`DatabaseSchema.md:318-322`).
   - `products`: `id uuid DEFAULT gen_random_uuid() NOT NULL`, `category_id uuid`, `name character varying(255) NOT NULL`, `sku character varying(100)`, `barcode character varying(100)`, `cost_price numeric(15,2) DEFAULT 0 NOT NULL`, `is_active boolean DEFAULT true NOT NULL`, `created_at timestamptz DEFAULT now() NOT NULL`, `updated_at timestamptz DEFAULT now() NOT NULL` (`DatabaseSchema.md:386-396`).
   - `product_units`: `id uuid DEFAULT gen_random_uuid() NOT NULL`, `product_id uuid NOT NULL`, `unit_id uuid NOT NULL`, `conversion_factor integer DEFAULT 1 NOT NULL`, `selling_price numeric(15,2) NOT NULL`, `created_at timestamptz DEFAULT now() NOT NULL`, `is_active boolean DEFAULT true NOT NULL`, `cost_price numeric(15,2) DEFAULT 0` (`DatabaseSchema.md:464-473`).
   - `wholesale_tiers`: `id uuid DEFAULT gen_random_uuid() NOT NULL`, `product_unit_id uuid NOT NULL`, `min_qty integer NOT NULL`, `special_price numeric(15,2) NOT NULL`, `created_at timestamptz DEFAULT now() NOT NULL` (`DatabaseSchema.md:536-542`).
2. Post-migration soft-delete columns, triggers, and **partial unique indexes** from `production_full_migration.sql`:
   - `updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL` + `deleted_at TIMESTAMPTZ NULL` added to `categories`, `units`, `product_units`, `wholesale_tiers`, and `deleted_at TIMESTAMPTZ NULL` added to `products` (`production_full_migration.sql:46-67`).
   - Triggers calling `public.set_updated_at_timestamp()` (`production_full_migration.sql:17-23,105-133`).
   - **Critical:** Rigid table-level `UNIQUE` constraints (`products_sku_key`, `categories_name_key`, `units_name_key`, `unique_product_unit`) were **replaced** by soft-delete-aware partial unique indexes (`production_full_migration.sql:192-217`):
     - `idx_mini_products_sku_active_unique ON public.mini_products (sku) WHERE deleted_at IS NULL AND sku IS NOT NULL AND sku <> ''`
     - `idx_mini_categories_name_active_unique ON public.mini_categories (LOWER(name)) WHERE deleted_at IS NULL`
     - `idx_mini_units_name_active_unique ON public.mini_units (LOWER(name)) WHERE deleted_at IS NULL`
     - `idx_mini_product_units_active_unique ON public.mini_product_units (product_id, unit_id) WHERE deleted_at IS NULL`
     *(Do NOT declare rigid `UNIQUE (name)` or `UNIQUE (sku)` constraints on `mini_*` tables, or soft-deleting an item and re-creating one with the same name/SKU will throw `23505 unique_violation`!)*
3. **`postgres.js` Proxy Rules in `Apps_Toko_Rejeki/apps/src/lib/db.ts`:**
   - `sql` inspects `Array.isArray(argArray[0]) && 'raw' in argArray[0]` and `firstChunk = String(argArray[0][0] || '').trim()` to route writes to `primarySql` only and reads to `primarySql` with `standbySql` fallback (`db.ts:135-193`).
   - Tagged-template interpolations `${value}` become `$1` parameters (not SQL identifiers). **Never** write ``sql`FROM ${tableName}` ``. Instead, branch cleanly on `const isMini = scope === "mini"` to execute static `sql\`... FROM mini_products ...\`` vs the untouched main `sql\`... FROM products ...\`` queries!
   - Reject invalid `scope` values (`scopeParam && scopeParam !== "main" && scopeParam !== "mini"`) with HTTP `400`.
   - Record `entity_name` in `sync_checkpoints` as `'mini_catalog'` when `isMini`, keeping `'catalog'` when omitted (`full/route.ts:138`, `delta/route.ts:211`).
   - Empty `mini_*` tables cleanly yield `total_products: 0`, `data: { products: [], categories: [], units: [] }` on `/api/sync/full?scope=mini`, and `has_changes: false, delta_count: 0` on `/api/sync/delta?scope=mini`.
   - `/api/health` (`checkClusterHealth()` -> `SELECT 1 as ping, pg_is_in_recovery()`) and `/api/settings` (`store_profiles`, `receipt_templates`) require **zero modifications** (`D-13`).

---

### Pattern 2: Dual Server URL Migration & Smart Auto LAN Failover (`D-01`, `D-02`)

**What:** Upgrade `serverConfig.ts`, `secureStorage.ts`, `apiClient.ts`, `AuthContext.tsx`, and `ServerUrlPanel.tsx` from a single `pos_server_base_url` string to Dual Server URLs (`primaryUrl` + `fallbackUrl`) with ~2000ms LAN probe timeout, sticky route tracking (`activeRoute: "lan" | "cloud" | "offline"`), zero-loss `pos_session` injection, and automatic LAN priority recovery.

**Storage & Backward-Compatible Migration (`secureStorage.ts` + `serverConfig.ts`):**
- New KV key `KV_KEYS.SERVER_CONFIG = "pos_server_config_v2"` storing JSON `{ primaryUrl: string; fallbackUrl: string | null }`.
- Constants:
  - `DEFAULT_PRIMARY_SERVER_URL = "http://192.168.1.100:3000"` (`D-01`)
  - `DEFAULT_CLOUD_SERVER_URL = "https://kasir.tokorejeki.my.id"` (`D-01`)
  - `LAN_PROBE_TIMEOUT_MS = 2000` (`D-02`)
- **Resolution / Migration precedence in `getStoredServerConfig()`:**
  1. If `pos_server_config_v2` exists and parses cleanly via Zod -> return `{ primaryUrl, fallbackUrl }`.
  2. Else if legacy `KV_KEYS.SERVER_BASE_URL` (`"pos_server_base_url"`) exists -> migrate seamlessly:
     - `primaryUrl = legacyUrl`
     - `fallbackUrl = legacyUrl === DEFAULT_PRIMARY_SERVER_URL ? DEFAULT_CLOUD_SERVER_URL : null` (so dev overrides like `10.0.2.2:3000` or Phase 1 tests calling `setStoredServerUrl("http://192.168.1.10:3000")` do NOT silently fall over to production `kasir.tokorejeki.my.id`!).
  3. Else (fresh install with empty storage) -> default to `{ primaryUrl: DEFAULT_PRIMARY_SERVER_URL, fallbackUrl: DEFAULT_CLOUD_SERVER_URL }`, while keeping `saveServerConfig()` writing both `SERVER_CONFIG` and `SERVER_BASE_URL = primaryUrl` so `getStoredServerUrl()` remains accurate for legacy callers!
- **IMPORTANT Phase 1 Test Delta:** [loginScreen.test.tsx](__tests__/loginScreen.test.tsx:276-286) currently expects `"Alamat Server Belum Terhubung"` when `resetTestStorage()` leaves storage empty. Because `D-01` introduces built-in defaults (`http://192.168.1.100:3000` + `https://kasir.tokorejeki.my.id`), fresh boot now has active default URLs! Update that test case cleanly in Phase 2 to assert default Dual URLs (`192.168.1.100:3000` + `kasir.tokorejeki.my.id`) AND verify dev override / explicit invalid or cleared state.

**Smart Auto Failover Algorithm (`apiClient.ts` + `SystemStatusContext`):**
1. Maintain module/context-shared `activeRoute: "lan" | "cloud" | "offline"` (starts `"lan"`).
2. **`apiRequestWithFailover(config, path, options)`:**
   - **If `activeRoute !== "cloud"`:**
     - Try `config.primaryUrl` with `timeoutMs: options.lanTimeoutMs ?? 2000` (use longer `6000–8000ms` only after TCP/route is known `lan` for heavy `sync/full` payloads, OR race initial `2000ms` on probes/delta/login). Actually, on LAN (`192.168.1.100:3000`), even a full catalog JSON response arrives in `<300ms` once connected; keeping `2000ms` on probes/`delta`/`auth` and `5000ms` on `sync/full` (or `2000ms` pre-check + `sync/full`) prevents premature aborts while keeping failover snappy.
     - **Failover Trigger Condition (STRICT):** Fail over to `config.fallbackUrl` **ONLY** when:
       - `config.fallbackUrl` is non-null and `!== config.primaryUrl`, AND
       - `result.networkError === true` (timeout / TCP refused / DNS / unreachable) OR non-JSON `502`/`503`/`504` gateway error (`result.rawBody === null && result.status >= 502`).
       - **NEVER** fail over on `400`, `401`, `403`, `404`, `429`, or backend JSON `503 { offline: true }` (PostgreSQL down on shop server — Cloud hits the exact same DB!).
     - If `fallbackUrl` succeeds -> set `activeRoute = "cloud"` and return its response (`routeUsed = "cloud"`).
   - **If `activeRoute === "cloud"` (sticky Cloud mode while away from shop Wi-Fi):**
     - Send operational requests directly to `config.fallbackUrl` with **0ms LAN timeout penalty**!
     - If `fallbackUrl` fails with transport error -> try `config.primaryUrl` once (`2000ms`) in case the device just rejoined shop Wi-Fi (`routeUsed = "lan"` if it answers); if both fail -> `activeRoute = "offline"`.
3. **LAN Priority Re-Probe (`D-02`):**
   - While `activeRoute === "cloud"` (or `"offline"`), `SystemStatusContext` probes `config.primaryUrl` (`/api/health`, `2000ms` timeout):
     - Immediately on `expo-network` state transitions (e.g., `CELLULAR -> WIFI` or reconnect),
     - Immediately on `AppState` returning to `"active"`,
     - Periodically every **30 seconds** (every 3rd 10-second health tick) while in `"cloud"` mode!
   - When `config.primaryUrl` responds with valid JSON (`status === "online"` or `"degraded"`, or even `200` on `/api/health`), switch `activeRoute` immediately back to `"lan"`!
4. **Why `pos_session` never breaks across LAN ↔ Cloud:**
   - Phase 1 `apiFetch` already uses `credentials: "omit"` and manually attaches `Cookie: pos_session=<token>` from `expo-secure-store` ([apiClient.ts:89-120](src/services/api/apiClient.ts:89-120)), and `D-01` confirms both URLs hit the same server/`SESSION_SECRET`. Switching URLs requires zero re-login.

---

### Pattern 3: `expo-sqlite` WAL Schema, Connection Lifecycle, `syncMutex` & `D-09` Role Isolation (`D-06`, `D-09`)

**1. Singleton Initialization & WAL PRAGMAs (`src/db/sqlite.ts`):**
Open a single shared `SQLiteDatabase` via `openDatabaseAsync("toko_rejeki_pos.db")` memoized behind one `initPromise` (outside React `<Slot key={navKey}>` so account switches never close/reopen the handle). Apply connection-level PRAGMAs **outside** any transaction (`SKILL.md:85`):
```sql
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;
```
Then run idempotent schema creation + `PRAGMA user_version` upgrade inside `withTransactionAsync`.

**2. Local SQLite Tables (`toko_rejeki_pos.db`):**
Mirror `Apps_Toko_Rejeki/apps/src/lib/offlineDb.ts:37-43` plus indexed columns for fast Phase 3/4 queries:
- `products`:
  - `id TEXT PRIMARY KEY NOT NULL`
  - `category_id TEXT`
  - `category_name TEXT NOT NULL DEFAULT 'Umum'`
  - `name TEXT NOT NULL`
  - `sku TEXT NOT NULL DEFAULT ''`
  - `barcode TEXT NOT NULL DEFAULT ''`
  - `cost_price REAL NOT NULL DEFAULT 0`
  - `is_active INTEGER NOT NULL DEFAULT 1`
  - `base_unit TEXT NOT NULL DEFAULT 'Pcs'`
  - `base_selling_price REAL NOT NULL DEFAULT 0` *(precomputed for instant Phase 3/4 SQLite price sorting)*
  - `prices_json TEXT NOT NULL DEFAULT '{}'`
  - `unit_conversions_json TEXT NOT NULL DEFAULT '[]'`
  - `wholesale_tiers_json TEXT NOT NULL DEFAULT '[]'`
  - `created_at TEXT`, `updated_at TEXT`, `deleted_at TEXT`
  - Indexes: `(is_active, deleted_at, name COLLATE NOCASE)`, `(sku)`, `(barcode)`, `(category_id)`, `(category_name)`, `(updated_at)`, `(base_selling_price)`
- `categories`: `(id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, created_at TEXT, updated_at TEXT, deleted_at TEXT)` + index `(deleted_at, name COLLATE NOCASE)`
- `units`: `(id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, created_at TEXT, updated_at TEXT, deleted_at TEXT)` + index `(deleted_at, name COLLATE NOCASE)`
- `sync_meta`: `(key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL)`
- `sync_audit`: `(id INTEGER PRIMARY KEY AUTOINCREMENT, sync_type TEXT NOT NULL, trigger_reason TEXT, route TEXT, started_at TEXT NOT NULL, completed_at TEXT NOT NULL, records_upserted INTEGER NOT NULL DEFAULT 0, records_deleted INTEGER NOT NULL DEFAULT 0, duration_ms INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, error_message TEXT)` + prune to last 50 rows after insert so log storage stays bounded.

**3. Transaction & `syncMutex` Serialization (`D-06`):**
- `syncMutex.ts` uses an in-process FIFO async queue (`enqueueDbWrite(fn)`) for **all** SQLite writes (`executeFullSync`, `executeDeltaSync`, `resetCatalogCache`, `setSyncMeta`, `appendSyncAudit`), plus a `tryRunScheduledSync(fn)` gate that skips background `POLL_5S` ticks when a sync is already in flight (while manual button taps enqueue and wait cleanly so user taps are never silently dropped).
- **Network-before-transaction rule:** Fetch `/api/sync/full`, `/api/sync/delta`, and `/api/settings` **completely before** opening the SQLite write transaction, keeping write locks held for `<50ms`.
- Use `runWriteTransaction(db, fn)`: on native (`Platform.OS !== "web"`), calls `db.withExclusiveTransactionAsync(async (txn) => { await txn.execAsync("PRAGMA busy_timeout = 5000;"); await fn(txn); })`; on web/Jest falls back to `db.withTransactionAsync(() => fn(db))`. Because there are no SQLite `FOREIGN KEY` constraints on synced catalog tables, `withExclusiveTransactionAsync`'s separate connection cannot fail on uninherited `PRAGMA foreign_keys`, while still isolating writes from concurrent reads!

**4. `costPrice` Role Isolation (`D-09`):**
- Persist `cost_price` and full `unitConversions[i].costPrice` inside SQLite so switching `kasir` → `admin`/`owner` does not require re-syncing.
- In `catalogRepo.ts` (`getCatalogProducts`, `getCatalogProductById`, `searchCatalogProducts`), require `role: UserRole | null` (fail-closed: default `canViewCostPrice = role === "admin" || role === "owner"`). When `!canViewCostPrice`, strip `costPrice` (`delete` / `undefined` on both `Product.costPrice` and every `unitConversions[i].costPrice`) in the repository mapper BEFORE returning data to hooks or UI!

**5. Authenticated `StoreSettings` Sync (`D-06`, Pitfall #9):**
- Phase 1 `testServerConnection` / `fetchPublicSettings` hits `GET /api/settings` unauthenticated, returning stripped public branding (`storeName`, `storeAddress`, `storePhone`, `storeLogo`, `previewReceiptBeforePrint: false` — verified `settings/route.ts:78-90`).
- During authenticated `executeFullSync` (and `AuthContext` refresh), call `apiRequest<StoreSettings>(..., "/api/settings")` **with `pos_session` cookie**. Only when `!res.offline && (res.data.printerPaperWidth !== undefined || res.data.receiptSections !== undefined)` overwrite `sync_meta['store_settings']` and `kv-store['pos_store_settings']`!

---

### Pattern 4: Foreground-Only Polling, `10:00 WIB` & `>48h` Gates & Error Backoff (`D-07`, `D-08`)

1. **Deterministic UTC+7 `getWIBDateTime()` (Hermes-safe):**
   WIB (`Asia/Jakarta`) is permanently UTC+7 with no DST. Shift epoch by `7 * 3_600_000` and read `getUTCFullYear()`, `getUTCMonth()`, `getUTCDate()`, `getUTCHours()`, `getUTCMinutes()`. Never rely on `Intl.DateTimeFormat` with `timeZone` fallback to local `date.getHours()`.
2. **`server_time` Cursor & Clock Skew Defense (`D-07`):**
   - Always persist and send the exact `server_time` string from `/api/sync/full` or `/api/sync/delta` (`since=<last_delta_sync_at>`). Never compute `since` from phone `Date.now()`.
   - Track `serverClockOffsetMs = Date.parse(serverTime) - Date.now()` (persisted in `sync_meta['server_clock_offset_ms']`) so `estimatedServerNowMs = Date.now() + serverClockOffsetMs` keeps `10:00 WIB` and `> 48h` gates accurate even if the phone's clock is skewed!
3. **`10:00 WIB` & `>48h` Full Sync Gates:**
   - Why `10:00 WIB` exists: Server `pg_cron` permanently purges 30-day soft-deleted records at `02:30 UTC` (`09:30 WIB`) (`production_full_migration.sql:501`), leaving no delta tombstone. `10:00 WIB` full sync clears any purged items from mobile SQLite.
   - Trigger `executeFullSync`:
     - `totalProducts === 0 && !lastFullSyncAt` (`INITIAL_BOOTSTRAP_EMPTY_DB`) — or if `last_full_sync_at` is missing/invalid.
     - `estimatedServerNowMs - lastFullSyncMs > 48 * 3600 * 1000` (`GAP_OVER_2_DAYS`).
     - `wibNow.hour >= 10` AND `lastFullSyncMs < today10AmWibUtcMs` (`Date.UTC(year, month - 1, day, 3, 0, 0)`) AND `lastDailySyncDate !== wibNow.dateStr` (`SCHEDULED_10AM_WIB`). Using `hour >= 10` (plus `< today10AmWibUtcMs` check) catches up cleanly even if the device was offline/asleep at 10:00–10:59 WIB!
4. **Foreground Lifecycle + Recursive `setTimeout` Backoff (`D-07`, `D-08`):**
   - Listen to `AppState.addEventListener("change", ...)` and `Network.addNetworkStateListener(...)`.
   - When `AppState !== "active"`: cancel all pending health/delta timers immediately and run best-effort `PRAGMA wal_checkpoint(PASSIVE)` via `syncMutex`.
   - When `AppState === "active"` or network transitions disconnected → connected: re-probe `Network.getNetworkStateAsync()`, refresh `/api/health` (LAN-first), run `FOCUS_REVALIDATE` / `ONLINE_RECONNECTED` sync, and resume foreground scheduling.
   - **Recursive `setTimeout` Schedule (`D-08`):**
     - Delta Sync: `5_000 ms` when healthy; pauses completely while `dbStatus === "offline"`; if delta fails directly while online, backs off `15_000 ms` (1st failure) → `30_000 ms` (2nd+ failures); resets to `5_000 ms` on any success.
     - Health Probe (`/api/health`): `10_000 ms` when `online` / `degraded`; backs off `15_000 ms` (1st offline failure) → `30_000 ms` (2nd+ consecutive failures on both LAN & Cloud); resets to `10_000 ms` immediately upon recovery.

---

### Pattern 5: Global Status Header (`NAV-03`), Initial Sync UX (`D-10`) & `Pengaturan` Controls (`D-11`)

1. **`TabScreenHeader.tsx` Sub-Bar (`D-03`..`D-05`):**
   - Add a second compact row beneath `headerRow` (`paddingHorizontal: 16`, `paddingBottom: 10`, `flexDirection: "row"`, `gap: 8`) inside `TabScreenHeader` (automatically shown across all 4 tabs `Kasir`, `Produk`, `Pesanan`, `Pengaturan`).
   - Left Pill — **DB / Route Pill** (`Pressable`, `minHeight: 44` + `hitSlop: 4` or `48`, `flex: 1`, `onPress={() => refreshStatus()}`):
     - `LAN Online`: `#d1fae5` bg, `#10b981` border/dot, `#065f46` text, `Wifi` icon
     - `Cloud Online`: `#d6e3ff` bg, `#00478d` border, `#00468c` text, `Globe` icon
     - `Standby Baca Saja`: `#fef3c7` bg, `#f59e0b` border, `#78350f` text, `ShieldAlert` icon
     - `Offline`: `#ffdad6` bg, `#ef4444` border, `#93000a` text, `CloudOff` icon
     - Manual checking state: `"Menghubungkan..."` neutral `#ecedf6`
   - Right Pill — **Sync Status Pill** (`Pressable`, `minHeight: 44` + `hitSlop: 4` or `48`, `flex: 1`, `onPress={() => triggerManualDeltaSync("HEADER_BADGE_CLICK")}`):
     - Syncing: `"Menyinkronkan..."` (`#d6e3ff` / `#00468c`, `RefreshCw`)
     - Offline / Failed: `"Mode Offline"` / `"Sync Gagal"` (`#fef3c7` / `#78350f`, `CloudOff` or `AlertCircle`)
     - Synced: `"Katalog (${totalCachedProducts})"` (`#d1fae5` / `#065f46`, `CheckCircle2`)
   - Note: `useSystemStatus()` and `useSyncEngine()` MUST return safe non-throwing defaults when rendered outside providers (matching web `SyncEngineContext.tsx:220-245`), so Phase 1 unit tests (`tabScreens.test.tsx`) that mount `<PengaturanScreen />` without `(app)/_layout.tsx` continue passing!
2. **Initial Sync Banner vs Empty `mini_*` State (`D-10` vs `D-12`):**
   - Show non-blocking Velocity Blue banner (`"Menyinkronkan katalog toko..."`) inside `(app)/(tabs)` while `isSyncing && (totalCachedProducts === 0 || syncType === "FULL")`.
   - When `!isSyncing && totalCachedProducts === 0 && lastFullSyncAt === null && syncErrorMessage !== null`: render informative recovery `EmptyStateCard` with **`Sinkronkan Sekarang`** CTA and auto-retry when connectivity recovers (`DB_RECONNECTED` / `ONLINE_RECONNECTED`).
   - When `lastFullSyncAt !== null && totalCachedProducts === 0` (server `mini_*` tables genuinely have 0 items): show calm empty-catalog state (*"Katalog Kasir Mini Masih Kosong"*), NOT an error card!
3. **`Pengaturan` Catalog Sync Card (`D-11`):**
   - Visible to all authenticated roles (`kasir`, `admin`, `owner`).
   - Shows: counts (`products`, `categories`, `units`), WIB formatted `last_full_sync_at` & `last_delta_sync_at`, active route (`LAN` / `Cloud` / `Offline`), recent 5–10 `sync_audit` entries, and 3 `minHeight: 48` buttons: **`Cek Pembaruan (Delta)`**, **`Sinkronisasi Penuh`**, and **`Reset Cache Lokal`** (opens `ResetCacheConfirmModal` preserving `SecureStore` tokens/snapshot, `pos_server_config_v2`/`pos_server_base_url`, and future `held_orders` / `toko_rejeki_pos_tabs_v1`!).

### Anti-Patterns to Avoid
- **Do NOT use dynamic string `${tableName}` inside `postgres` tagged templates:** `apps/src/lib/db.ts` binds interpolations as `$1` parameters — use static allowlisted branching (`scope === "mini"` vs main).
- **Do NOT add rigid `UNIQUE (name)` or `UNIQUE (sku)` constraints to `mini_*` PostgreSQL tables:** Always use partial unique indexes (`WHERE deleted_at IS NULL`) matching `production_full_migration.sql:194-217`.
- **Do NOT call `withExclusiveTransactionAsync` relying on main-connection `PRAGMA foreign_keys`:** It opens a separate connection (`SQLiteDatabase.ts:186`).
- **Do NOT cache unauthenticated `GET /api/settings` over authenticated `StoreSettings`:** Unauthenticated `/api/settings` strips `printerPaperWidth`, `receiptSections`, and `receiptItemConfig` (`settings/route.ts:78-90`).
- **Do NOT return `costPrice` from `catalogRepo` when `role === "kasir"`:** Strip both `product.costPrice` and `unitConversions[i].costPrice` at the repository boundary (`D-09`).
- **Do NOT run `setInterval` unconditionally or fail over to Cloud on HTTP `401`/`403`/`503 { offline: true }`:** Only transport/timeout errors or non-JSON `502+` trigger failover, and polling pauses when `AppState !== "active"` or `dbStatus === "offline"`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Local relational catalog storage | JSON blobs in `kv-store` or `AsyncStorage` | `expo-sqlite` (`openDatabaseAsync`) + indexed columns | JSON blobs stall JS thread on parse and break atomic delta upserts/deletes. |
| SQLite Jest test fake | Custom regex SQL parser in JS | Node v24 built-in `node:sqlite` (`process.getBuiltinModule("node:sqlite")`) | Executes real SQLite `3.53.4` DDL, `PRAGMA`, transactions, `COLLATE NOCASE`, and indexes in memory with 0 deps. |
| OS network connectivity detection | Polling `8.8.8.8` or assuming Wi-Fi from `fetch` errors | `expo-network` (`getNetworkStateAsync`, `addNetworkStateListener`) | Works offline in airplane mode (shop Wi-Fi without internet!), zero battery overhead. |
| Multi-tab browser lock port | `navigator.locks` / `localStorage` lease hacks | Single-process FIFO `syncMutex` Promise queue | React Native runs one JS runtime; FIFO queue serializes manual resets & polls cleanly without lock-expiry races. |
| URL & payload runtime validation | Ad-hoc `try/catch` property access | `zod` (`^4.6.7`) | Already used in `serverConfig.ts` (`16-105`); prevents malformed URLs or partial API JSON from corrupting SQLite. |

**Key insight:** Reusing installed `expo-sqlite`, `expo-network`, `zod`, and Node's built-in `node:sqlite` eliminates third-party native risk while verifying real SQL behavior in CI.

---

## Common Pitfalls

### Pitfall 1: `withExclusiveTransactionAsync` Drops `PRAGMA`s & Crashes on Web
**What goes wrong:** Foreign keys silently fail to enforce or `SQLITE_BUSY` fires immediately inside `withExclusiveTransactionAsync`, or Expo Web tests throw `withExclusiveTransactionAsync is not supported on web`.
**Why it happens:** Verified in [SQLiteDatabase.ts:183-186](node_modules/expo-sqlite/src/SQLiteDatabase.ts:183-186), `withExclusiveTransactionAsync` throws on `Platform.OS === 'web'` and calls `Transaction.createAsync(this)`, opening a separate SQLite connection that does not inherit connection-scoped `PRAGMA foreign_keys` or `PRAGMA busy_timeout`.
**How to avoid:** Avoid SQLite `FOREIGN KEY` constraints on synced catalog tables (use `syncMutex` + atomic `withExclusiveTransactionAsync` on native with `await txn.execAsync("PRAGMA busy_timeout = 5000;")`, falling back to `withTransactionAsync` on web/Jest).

### Pitfall 2: PostgreSQL `mini_*` Rigid `UNIQUE` Constraints & `postgres.js` Interpolation Traps
**What goes wrong:** Soft-deleting a `mini_product` or `mini_category` and creating a new active item with the same `sku`/`name` throws `23505`, OR `sql\`FROM ${table}\`` throws PostgreSQL syntax error near `$1`.
**Why it happens:** `production_full_migration.sql:192-217` dropped rigid unique constraints and replaced them with `WHERE deleted_at IS NULL` partial unique indexes; `db.ts` passes tagged templates to `postgres.js`.
**How to avoid:** Create identical partial unique indexes on `mini_*` and branch `if (isMini)` to static `sql\`...\`` queries in `sync/full/route.ts` and `sync/delta/route.ts`.

### Pitfall 3: Dual-URL Defaults Breaking Phase 1 `loginScreen.test.tsx` Unconfigured Test
**What goes wrong:** `getStoredServerConfig()` returning `http://192.168.1.100:3000` when `kv-store` is empty causes `AuthContext` to have a non-null `serverUrl`, failing Phase 1 test `loginScreen.test.tsx:276-286` (`"Alamat Server Belum Terhubung"`).
**Why it happens:** Phase 1 assumed `null` initial URL; Phase 2 `D-01` introduces built-in production defaults (`192.168.1.100:3000` + `kasir.tokorejeki.my.id`).
**How to avoid:** Plan an explicit update in Wave 1 of Phase 2 to `loginScreen.test.tsx` (testing default Dual URLs pre-loaded + custom override + invalid/cleared handling) and keep `setStoredServerUrl()` / `getStoredServerUrl()` compatibility intact so `authContext.test.tsx` and `tabScreens.test.tsx` continue passing.

### Pitfall 4: Sticky `"cloud"` Route Paying 2-Second LAN Timeouts or Triggering Premature `401`
**What goes wrong:** Trying LAN (`2000ms` timeout) on every 5s delta poll while the user is away from the shop makes every screen lag by 2 seconds; conversely, retrying a `401` on Cloud masks session revocation.
**Why it happens:** Naive per-request `try primary -> catch -> fallback` repeats the 2s timeout on every call.
**How to avoid:** Maintain sticky `activeRoute` (`"lan" | "cloud" | "offline"`), send requests directly to `fallbackUrl` when `activeRoute === "cloud"`, re-probe LAN every 30s + on Wi-Fi/AppState recovery, and fail over ONLY on transport/timeout or non-JSON `502+` gateway errors (never `400/401/403/429` or backend JSON `503 { offline: true }`).

### Pitfall 5: Hermes `Intl` `10:00 WIB` Failure & Missing `crypto.randomUUID()`
**What goes wrong:** `Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta" })` falls back to phone local timezone or emits `24` at midnight; `crypto.randomUUID()` throws `TypeError: crypto.randomUUID is not a function` in Hermes (`runtime.native.ts` has no crypto polyfill).
**Why it happens:** Hermes lacks full Web Crypto and some Android builds omit ICU timezone tables.
**How to avoid:** Compute WIB via pure epoch offset (`+ 7 * 3600 * 1000` with `getUTC*`) and build `generateClientId()` using `globalThis.crypto?.randomUUID?.()` with a pure-TS RFC 4122 v4 fallback.

### Pitfall 6: `mini_*` Empty Catalog (`0` rows) Mistaken for Failed Initial Sync (`D-10` vs `D-12`)
**What goes wrong:** User logs in when `mini_products` has 0 rows, `sync/full?scope=mini` returns `200 { total_products: 0 }`, and the app mistakenly shows a failure retry screen.
**Why it happens:** Checking only `products.length === 0` conflates empty catalog with failed bootstrap sync.
**How to avoid:** Show the error recovery card (`Sinkronkan Sekarang`) **only** when `totalCachedProducts === 0 && lastFullSyncAt === null && syncErrorMessage !== null`.

### Pitfall 7: `costPrice` Leak for `kasir` & Phase 1 Component Test Provider Crashes
**What goes wrong:** Reading raw SQLite rows exposes `costPrice` in `Produk` / `Kasir` state for `kasir` (`D-09`), OR `TabScreenHeader` calling `useSystemStatus()` throws inside Phase 1 tests that render screens with `<AuthProvider>` only.
**Why it happens:** `TabScreenHeader` mounts inside every tab screen tested standalone in `tabScreens.test.tsx`.
**How to avoid:** Strip `costPrice` inside `catalogRepo.ts` whenever `role !== "admin" && role !== "owner"`, and give `useSystemStatus()` / `useSyncEngine()` non-throwing fallback defaults outside providers.

---

## Code Examples

### 1. Idempotent PostgreSQL Twin Migration (`../Apps_Toko_Rejeki/mini_catalog_migration.sql`)

Verified against `DatabaseSchema.md:260-549` and `production_full_migration.sql:17-267`:
```sql
BEGIN;

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.mini_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT mini_categories_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.mini_units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT mini_units_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.mini_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid,
    name character varying(255) NOT NULL,
    sku character varying(100),
    barcode character varying(100),
    cost_price numeric(15,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT mini_products_pkey PRIMARY KEY (id),
    CONSTRAINT mini_products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.mini_categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.mini_product_units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    unit_id uuid NOT NULL,
    conversion_factor integer DEFAULT 1 NOT NULL,
    selling_price numeric(15,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    cost_price numeric(15,2) DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT mini_product_units_pkey PRIMARY KEY (id),
    CONSTRAINT mini_product_units_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.mini_products(id) ON DELETE CASCADE,
    CONSTRAINT mini_product_units_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.mini_units(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS public.mini_wholesale_tiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_unit_id uuid NOT NULL,
    min_qty integer NOT NULL,
    special_price numeric(15,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT mini_wholesale_tiers_pkey PRIMARY KEY (id),
    CONSTRAINT mini_wholesale_tiers_product_unit_id_fkey FOREIGN KEY (product_unit_id) REFERENCES public.mini_product_units(id) ON DELETE CASCADE
);

-- Partial unique indexes (mirroring production_full_migration.sql:194-217 for soft-delete)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mini_products_sku_active_unique
    ON public.mini_products (sku)
    WHERE deleted_at IS NULL AND sku IS NOT NULL AND sku <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_mini_categories_name_active_unique
    ON public.mini_categories (LOWER(name)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mini_units_name_active_unique
    ON public.mini_units (LOWER(name)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_mini_product_units_active_unique
    ON public.mini_product_units (product_id, unit_id) WHERE deleted_at IS NULL;

-- B-tree delta & lookup indexes (mirroring production_full_migration.sql:225-260)
CREATE INDEX IF NOT EXISTS idx_mini_products_delta ON public.mini_products USING btree (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mini_products_active_category ON public.mini_products USING btree (category_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mini_products_deleted ON public.mini_products USING btree (deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mini_products_barcode ON public.mini_products USING btree (barcode) WHERE barcode IS NOT NULL AND barcode <> '';
CREATE INDEX IF NOT EXISTS idx_mini_categories_delta ON public.mini_categories USING btree (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mini_product_units_delta ON public.mini_product_units USING btree (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mini_product_units_product_id ON public.mini_product_units USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_mini_product_units_unit_id ON public.mini_product_units USING btree (unit_id);
CREATE INDEX IF NOT EXISTS idx_mini_wholesale_tiers_delta ON public.mini_wholesale_tiers USING btree (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_mini_wholesale_tiers_pu_id ON public.mini_wholesale_tiers USING btree (product_unit_id);
CREATE INDEX IF NOT EXISTS idx_mini_units_delta ON public.mini_units USING btree (updated_at DESC);

-- Triggers for automatic updated_at
DROP TRIGGER IF EXISTS trg_mini_categories_set_updated_at ON public.mini_categories;
CREATE TRIGGER trg_mini_categories_set_updated_at BEFORE UPDATE ON public.mini_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_mini_units_set_updated_at ON public.mini_units;
CREATE TRIGGER trg_mini_units_set_updated_at BEFORE UPDATE ON public.mini_units FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_mini_products_set_updated_at ON public.mini_products;
CREATE TRIGGER trg_mini_products_set_updated_at BEFORE UPDATE ON public.mini_products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_mini_product_units_set_updated_at ON public.mini_product_units;
CREATE TRIGGER trg_mini_product_units_set_updated_at BEFORE UPDATE ON public.mini_product_units FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_mini_wholesale_tiers_set_updated_at ON public.mini_wholesale_tiers;
CREATE TRIGGER trg_mini_wholesale_tiers_set_updated_at BEFORE UPDATE ON public.mini_wholesale_tiers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

COMMIT;
```

### 2. Deterministic UTC+7 `10:00 WIB` & Hermes-Safe `client_id`

```typescript
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const TWO_DAYS_MS = 48 * 60 * 60 * 1000;

export function getWIBDateTime(epochMs: number = Date.now()) {
  const wib = new Date(epochMs + WIB_OFFSET_MS);
  const year = wib.getUTCFullYear();
  const month = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const day = String(wib.getUTCDate()).padStart(2, "0");
  const hour = wib.getUTCHours();
  const minute = wib.getUTCMinutes();
  const second = wib.getUTCSeconds();
  return {
    year,
    monthNum: wib.getUTCMonth() + 1,
    dayNum: wib.getUTCDate(),
    dateStr: `${year}-${month}-${day}`,
    hour,
    minute,
    second,
    today10AmWibUtcMs: Date.UTC(year, wib.getUTCMonth(), wib.getUTCDate(), 3, 0, 0),
  };
}

export function generateClientId(): string {
  const nativeRandomUUID = globalThis.crypto?.randomUUID;
  if (typeof nativeRandomUUID === "function") {
    return `mobile-${nativeRandomUUID.call(globalThis.crypto)}`;
  }
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `mobile-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
```

### 3. `expo-sqlite` WAL Init, Serialized Write Queue & `kasir` `costPrice` Sanitization

```typescript
// Source: node_modules/expo-sqlite/src/SQLiteDatabase.ts & skills/expo-sqlite/SKILL.md
export async function runWriteTransaction<T>(
  db: SQLite.SQLiteDatabase,
  fn: (conn: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  let result!: T;
  if (Platform.OS !== "web" && typeof db.withExclusiveTransactionAsync === "function") {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync("PRAGMA busy_timeout = 5000;");
      result = await fn(txn);
    });
  } else {
    await db.withTransactionAsync(async () => {
      result = await fn(db);
    });
  }
  return result;
}

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

---

## State of the Art

| Old Approach | Current Approach (Phase 2) | When Changed | Impact |
|--------------|----------------------------|--------------|--------|
| Single `pos_server_base_url` string | Dual Server URL `{ primaryUrl, fallbackUrl }` (`192.168.1.100:3000` -> `kasir.tokorejeki.my.id`) | Phase 2 (`D-01`, `D-02`) | Zero manual URL switching between store Wi-Fi and remote cellular/tunnel access. |
| Browser Dexie (`IndexedDB`) + `navigator.locks` | `expo-sqlite@58` `WAL` + `busy_timeout = 5000` + FIFO `syncMutex` | Phase 2 (`D-06`) | Native SQLite index queries (`<1ms`), no browser-tab lock leaks. |
| `Intl.DateTimeFormat` WIB + local fallback | Pure UTC+7 epoch arithmetic + `server_time` cursor | Phase 2 (`D-07`) | Immune to Android Hermes ICU gaps and phone clock skew. |
| Single `catalog` PostgreSQL table set | Additive `mini_*` twin tables exposed via `?scope=mini` | Phase 2 (`D-12`..`D-14`) | Kasir Mini cold-drinks catalog stays 100% isolated from Web PC Kasir Utama. |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `withExclusiveTransactionAsync` + `PRAGMA busy_timeout = 5000;` inside `txn` avoids `SQLITE_BUSY` under real Android/iOS Expo Go rapid-read + 5s-delta concurrency. | Architecture Patterns / SQLite | If `SQLITE_BUSY` appears on device, fall back to `withTransactionAsync` strictly serialized by `syncMutex`. |
| A2 | `https://kasir.tokorejeki.my.id` Cloudflare/HTTPS tunnel forwards `Set-Cookie` / `Cookie: pos_session=...`, `GET /api/health`, and `GET /api/sync/*?scope=mini` identically to `http://192.168.1.100:3000`. | Dual Server URL / Security | Verify live tunnel routing and LAN->Cloud switchover on physical device once shop server + Docker PostgreSQL are online. |
| A3 | Updating Phase 1's `loginScreen.test.tsx:276-286` unconfigured test to reflect `D-01` default Dual URLs is expected and acceptable. | Common Pitfalls / Validation | Confirm during Wave 1 planning whether `Login` defaults `192.168.1.100:3000` silently on fresh install or keeps an explicit unverified indicator until tested. |

---

## Open Questions (RESOLVED)

1. **RESOLVED — Pre-fill vs Unverified Indicator on Fresh Install (`D-01` vs Phase 1 `loginScreen.test.tsx`):**
   - *What we know:* `D-01` specifies default LAN `http://192.168.1.100:3000` and Cloud `https://kasir.tokorejeki.my.id`; Phase 1 `loginScreen.test.tsx:280` expects `"Alamat Server Belum Terhubung"` when storage is empty.
   - *Resolution:* Pre-populate defaults `http://192.168.1.100:3000` + `https://kasir.tokorejeki.my.id` in `getStoredServerConfig()` when storage key is absent or corrupt (`02-UI-SPEC.md:131`, preserving explicit nullable `{ primaryUrl: null, fallbackUrl: null }` when cleared by user), and update `loginScreen.test.tsx` in Phase 2 to assert both the pre-filled Dual-URL defaults and the cleared-config auto-expand branch.
2. **RESOLVED — Database Migration Execution Window (`pos_supabase_db`):**
   - *What we know:* Docker Desktop daemon (`pos_supabase_db`) is currently offline on this dev machine (`docker ps` failed to connect to `dockerDesktopLinuxEngine`).
   - *Resolution:* Author `../Apps_Toko_Rejeki/mini_catalog_migration.sql` + additive `?scope=mini` routes (`full/route.ts`, `delta/route.ts`) inside `02-01-PLAN.md` behind a mandatory `gate="blocking-human"` (`D-12` `one-way` gate) confirming user approval and active Docker `pos_supabase_db` before executing live `psql` migration and verification against `next build`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (`node` + `node:sqlite`) | Jest tests, Expo CLI, in-memory SQLite tests | ✓ | `v24.22.1` (SQLite `3.53.4`) | — |
| npm | Running `npx jest`, `tsc`, backend `next build` | ✓ | `11.19.1` | — |
| Jest (`npx jest`) | Automated Phase 1 + Phase 2 test suites | ✓ | `30.5.2` (`7/7` suites, `48/48` tests green) | — |
| Docker Desktop (`pos_supabase_db`) | Running `mini_catalog_migration.sql` & live `/api/sync/*?scope=mini` integration | ✗ (daemon stopped) | — | Unit-test SQLite/API contracts with mocked responses; start Docker Desktop when applying migration & device verification. |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `jest@30.5.2` + `jest-expo@~58.0.15` + `@testing-library/react-native@^14.1.0` (`[VERIFIED: package.json:44,49,50]`) |
| Config file | [jest.config.js](jest.config.js) + [__tests__/setup.ts](__tests__/setup.ts) |
| Quick run command | `npx jest __tests__/<file>.test.ts` |
| Full suite command | `npx jest` + `npx tsc --noEmit` + `npx expo lint` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| **SYNC-01**, **D-06**, **D-09** | `expo-sqlite` WAL init, `busy_timeout`, catalog upsert/delete, `syncMutex` serialization, `kasir` `costPrice` stripped on read while preserved for `admin`/`owner` | unit (`node:sqlite` real SQLite) | `npx jest __tests__/catalogDb.test.ts` | ❌ Wave 0 (`setup.ts` `node:sqlite` mock + test file) |
| **SYNC-02**, **D-07**, **D-10** | Full sync on empty DB, `10:00 WIB` deterministic UTC+7 gate (incl. clock skew), `>48h` force full sync, hard-delete cleanup, empty `mini_*` (`0` rows) vs initial-sync error distinction | unit | `npx jest __tests__/syncEngine.test.ts` | ❌ Wave 0 |
| **SYNC-03**, **D-07**, **D-08** | 5s foreground delta poll (`server_time` cursor + `client_id`), `AppState` background teardown, `expo-network` recovery trigger, `5s -> 15s -> 30s` error backoff & immediate reset | unit + timer fakes | `npx jest __tests__/syncEngineContext.test.tsx` | ❌ Wave 0 |
| **AUTH-02**, **D-01**, **D-02** | Dual URL config migration, 2s LAN probe timeout -> Cloud failover preserving `pos_session`, no failover on `401`/`403`/DB-offline JSON `503`, sticky Cloud + 30s/Wi-Fi LAN re-probe | unit | `npx jest __tests__/serverConfig.test.ts __tests__/apiClient.test.ts` | ✅ Extend existing |
| **NAV-03**, **D-03**..**D-05** | `TabScreenHeader` renders `LAN Online` / `Cloud Online` / `Standby Baca Saja` / `Offline` + Sync pill across all 4 tabs; tap DB pill refreshes `/api/health`; tap Sync pill triggers `Delta Sync` | component | `npx jest __tests__/systemStatusHeader.test.tsx __tests__/tabScreens.test.tsx` | ❌ Wave 0 + extend |
| **SYNC-04**, **D-11** | `Pengaturan` sync card counts, WIB timestamps, 5–10 `sync_audit` entries, manual Delta/Full triggers, `Reset Cache Lokal` modal clearing catalog only (preserving `pos_session` & Server URL) | component | `npx jest __tests__/pengaturanSync.test.tsx` | ❌ Wave 0 |
| **D-12**, **D-13** | Backend `?scope=mini` isolation: `full/route.ts` & `delta/route.ts` query `mini_*` (`entity_name = 'mini_catalog'`), omit `scope` untouched, `0`-row response valid | backend verification / curl + lint | `npm --prefix ..\Apps_Toko_Rejeki\apps run lint && npm --prefix ..\Apps_Toko_Rejeki\apps run build` + live curl against `pos_supabase_db` | ❌ Wave 0 / live check |

### Sampling Rate
- **Per task commit (Wave edit):** `npx jest __tests__/<changed-suite> && npx tsc --noEmit`
- **Per wave merge:** `npx jest && npx tsc --noEmit && npx expo lint`
- **Phase gate:** Mobile `npx jest` + `tsc` + `expo lint` green; backend `eslint` + `next build` green; live device / emulator checkpoint verifying LAN ↔ Cloud failover (`D-02`), offline SQLite survival after force-kill, and `mini_*` empty/populated sync.

### Wave 0 Gaps
- [ ] Extend [__tests__/setup.ts](__tests__/setup.ts) with an in-memory `expo-sqlite` mock powered by `process.getBuiltinModule("node:sqlite").DatabaseSync(":memory:")` + `resetTestDatabase()` helper (plus `AppState` mock helpers if needed).
- [ ] New Phase 2 test suites: `__tests__/catalogDb.test.ts`, `__tests__/syncEngine.test.ts`, `__tests__/syncEngineContext.test.tsx`, `__tests__/systemStatusHeader.test.tsx`, `__tests__/pengaturanSync.test.tsx`.
- [ ] Update [__tests__/serverConfig.test.ts](__tests__/serverConfig.test.ts), [__tests__/apiClient.test.ts](__tests__/apiClient.test.ts), and [__tests__/loginScreen.test.tsx](__tests__/loginScreen.test.tsx) for Dual-URL (`primaryUrl` + `fallbackUrl`) defaults and failover.

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Keep `pos_session` exclusively in `expo-secure-store`; never auto-relogin or store passwords; never fail over `401`/revoked `/api/auth/me` `403` to Cloud (`apiClient.ts:186`). |
| V3 Session Management | Yes | Same HMAC `pos_session` attached with `credentials: "omit"` over LAN HTTP (store Wi-Fi) and Cloud HTTPS (`D-01`); `authEpoch` prevents stale background `/api/auth/me` or sync responses from reviving cleared sessions. |
| V4 Access Control | Yes | Enforce `D-09` fail-closed `costPrice` stripping in `catalogRepo.ts` (`role === "admin" || role === "owner"` only) so `kasir` never receives wholesale/margin cost prices into UI state or props. |
| V5 Input Validation | Yes | Validate Dual Server URLs (`http:`/`https:`, no embedded credentials, strict hostname regex) and `StoreSettings` / sync responses via `zod`; parameterize every SQLite query (`?` / `$param`) and use strict static query branching (`scope === "mini"` allowlist) in PostgreSQL routes. |
| V6 Cryptography | No (existing HMAC) | No new cryptographic primitives needed (`client_id` is a non-secret observability UUID). |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via `?scope=` or local search input | Tampering | Backend strictly branches on `scope === "mini"` vs main static queries (never interpolates identifiers); SQLite uses prepared bindings (`runAsync`/`getAllAsync`) only. |
| Privilege / margin data leak (`kasir` reading `costPrice`) | Information Disclosure | `catalogRepo.ts` strips `costPrice` on product & unit objects before leaving DB layer whenever `role !== "admin" && role !== "owner"`. |
| Unauthenticated `/api/settings` downgrade | Tampering | Cache full `StoreSettings` (`printerPaperWidth`, `receiptSections`) only from authenticated `apiRequest` responses where `!offline`. |
| SQLite file corruption / lock starvation | Denial of Service | `PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;`, FIFO `syncMutex`, `PRAGMA wal_checkpoint(PASSIVE)` on background transition. |

---

## Sources

### Primary (HIGH confidence — inspected directly on disk)
- [02-CONTEXT.md](.planning/phases/02-offline-sqlite-catalog-sync-engine-health-header/02-CONTEXT.md) — Decisions `D-01`..`D-14`, Discretion, Deferred scope.
- [package.json](package.json), [package-lock.json](package-lock.json), [jest.config.js](jest.config.js), [__tests__/setup.ts](__tests__/setup.ts), [tsconfig.json](tsconfig.json) — Verified exact installed SDK 58 dependencies and test setup.
- Mobile Phase 1 modules: [src/types/index.ts](src/types/index.ts), [src/services/storage/secureStorage.ts](src/services/storage/secureStorage.ts), [src/services/storage/serverConfig.ts](src/services/storage/serverConfig.ts), [src/services/api/apiClient.ts](src/services/api/apiClient.ts), [src/services/api/authApi.ts](src/services/api/authApi.ts), [src/services/api/cookieParser.ts](src/services/api/cookieParser.ts), [src/context/AuthContext.tsx](src/context/AuthContext.tsx), [src/app/_layout.tsx](src/app/_layout.tsx), [src/app/(app)/_layout.tsx](src/app/(app)/_layout.tsx), [src/components/common/TabScreenHeader.tsx](src/components/common/TabScreenHeader.tsx), [src/components/common/ServerUrlPanel.tsx](src/components/common/ServerUrlPanel.tsx), [src/app/(app)/(tabs)/pengaturan.tsx](src/app/(app)/(tabs)/pengaturan.tsx), [src/theme/tokens.ts](src/theme/tokens.ts).
- Installed SDK internals: [SQLiteDatabase.ts](node_modules/expo-sqlite/src/SQLiteDatabase.ts), [hooks.tsx](node_modules/expo-sqlite/src/hooks.tsx), [SKILL.md](node_modules/expo-sqlite/skills/expo-sqlite/SKILL.md), [Network.ts](node_modules/expo-network/src/Network.ts), [runtime.native.ts](node_modules/expo/src/winter/runtime.native.ts), [lucide-react-native.d.ts](node_modules/lucide-react-native/dist/types/lucide-react-native.d.ts).
- Sibling `Apps_Toko_Rejeki`: [DatabaseSchema.md](../Apps_Toko_Rejeki/DatabaseSchema.md), [production_full_migration.sql](../Apps_Toko_Rejeki/production_full_migration.sql), [sync/full/route.ts](../Apps_Toko_Rejeki/apps/src/app/api/sync/full/route.ts), [sync/delta/route.ts](../Apps_Toko_Rejeki/apps/src/app/api/sync/delta/route.ts), [health/route.ts](../Apps_Toko_Rejeki/apps/src/app/api/health/route.ts), [settings/route.ts](../Apps_Toko_Rejeki/apps/src/app/api/settings/route.ts), [productFormatter.ts](../Apps_Toko_Rejeki/apps/src/lib/productFormatter.ts), [db.ts](../Apps_Toko_Rejeki/apps/src/lib/db.ts), [offlineDb.ts](../Apps_Toko_Rejeki/apps/src/lib/offlineDb.ts), [syncEngine.ts](../Apps_Toko_Rejeki/apps/src/lib/syncEngine.ts), [syncMutex.ts](../Apps_Toko_Rejeki/apps/src/lib/syncMutex.ts), [SyncEngineContext.tsx](../Apps_Toko_Rejeki/apps/src/context/SyncEngineContext.tsx), [SystemStatusContext.tsx](../Apps_Toko_Rejeki/apps/src/context/SystemStatusContext.tsx), [Header.tsx](../Apps_Toko_Rejeki/apps/src/components/Header.tsx), [Sistem Kasir.bat](../Apps_Toko_Rejeki/scripts/Sistem%20Kasir.bat).

### Secondary (MEDIUM confidence — official docs & registry checks)
- Expo Documentation (`docs.expo.dev` via `search_web`) — `expo-sqlite` WAL, `busy_timeout`, `withExclusiveTransactionAsync` separate-connection behavior, and `expo-network` + `AppState` foreground re-probe patterns.
- `gsd-tools query package-legitimacy check` (live npm registry metadata, 2026-11-19).

---

## Metadata

**Confidence breakdown:**
- Standard stack & packages: **HIGH** — 0 new dependencies; all versions verified in `package-lock.json` and `node_modules/`.
- PostgreSQL `mini_*` & `?scope=mini`: **HIGH** — verified verbatim against `DatabaseSchema.md`, `production_full_migration.sql`, `db.ts`, and `sync/*` routes.
- Dual-URL failover & SQLite WAL lifecycle: **HIGH** in design, **MEDIUM** for live device network/tunnel switchover timing until tested on physical phone against running `pos_supabase_db`.
- Pitfalls & Jest validation: **HIGH** — verified `node:sqlite` (`DatabaseSync`, SQLite `3.53.4`) and baseline `npx jest` (`7/7` suites, `48/48` tests) directly.

**Research date:** 2026-11-19  
**Valid until:** 2026-12-19 (30 days; stable Expo SDK 58 + locked dependencies)
