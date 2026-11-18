# Roadmap: Apps Toko Rejeki Mobile

## Overview

Apps Toko Rejeki Mobile delivers an offline-resilient Expo + Expo Router + TypeScript mobile POS client connected to the existing `Apps_Toko_Rejeki` Next.js API over five vertical MVP phases. Phase 1 proves `pos_session` cold-kill persistence and LAN cleartext networking inside a Velocity Blue 4-tab role-protected shell; Phase 2 builds the local `expo-sqlite` WAL catalog, foreground delta/full sync loop, global server health header, and manual sync controls; Phase 3 ships the core Kasir POS experience with multi-tab carts, tiered wholesale and Open Price math, web-parity checkout (`cashGiven = grandTotal` with no Kembalian/payment-method UI), thermal receipt preview, Server `/api/print` + intervention/WA logging, and direct Bluetooth ESC/POS or Built-in/System HP printing; Phase 4 completes the two required List → Detail flows (`Produk` with `admin`/`owner` CRUD/Trash and `Pesanan Aktif` with live tab badge and Kasir resume); and Phase 5 finishes the `Pengaturan` hub, universal `Profil Toko & Tentang Aplikasi` page, and Owner administration for store logo compression, printers, staff accounts, and categories/units.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Auth, LAN Transport Spike & Role-Protected Shell** - Validate `pos_session` cold-kill persistence and LAN cleartext networking, and ship Server URL setup, login/logout, and the 4-tab Velocity Blue RBAC shell
- [ ] **Phase 2: Offline SQLite Catalog, Sync Engine & Health Header** - Persist products, categories, units, and store settings in WAL SQLite with foreground delta/full sync, global health status header, and manual sync controls
- [ ] **Phase 3: Kasir Mobile POS & Multi-Mode Thermal Checkout** - Deliver `Katalog`/`Nota` checkout with multi-tab carts, wholesale/Open Price math, no-Kembalian web-parity flow, receipt preview, Server `/api/print`, and direct Bluetooth ESC/POS or Built-in/System HP printing
- [ ] **Phase 4: Produk & Pesanan Aktif (List → Detail Flows & CRUD)** - Ship searchable/sortable `Produk` list → `Detail Produk` + online `admin`/`owner` CRUD/Trash and local `Pesanan Aktif` list + live tab badge → `Detail Pesanan` resume flow
- [ ] **Phase 5: Pengaturan Hub, Profile/About & Owner Administration** - Deliver universal account & `Profil Toko & Tentang Aplikasi` screen, Owner store profile + compressed gallery logo upload, printer/receipt settings + Test Print, staff CRUD, and category/unit migration & trash

## Phase Details

### Phase 1: Auth, LAN Transport Spike & Role-Protected Shell
**Goal:** As a store staff member, I want to configure the server URL and sign into a persistent 4-tab role-protected shell, so that my session stays usable online and offline.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, NAV-01, NAV-04
**Success Criteria** (what must be TRUE):
  1. Staff can configure and test a LAN HTTP (`http://192.168.x.x:3000`) or HTTPS Server URL directly from the Login screen before signing in (`AUTH-02`).
  2. Staff can sign in via `POST /api/auth/login` with a password show/hide toggle and see clear error handling for `400`, `401`, `403` (inactive account), and a live countdown timer for `429` throttling (`AUTH-01`).
  3. After force-killing and relaunching the app while offline, an authenticated user stays inside the 4-tab Velocity Blue Bottom Navigation Bar (`Kasir`, `Produk`, `Pesanan`, `Pengaturan`) until explicit Logout or a server `401` / `/api/auth/me` `403` response (`AUTH-03`, `NAV-01`).
  4. User can sign out via a confirmation modal calling fail-safe `POST /api/auth/logout` (clearing local session state even when offline) and return cleanly to Login (`AUTH-04`).
  5. Logging in as `kasir`, `admin`, or `owner` enforces `<Stack.Protected>` role guards (`kasir` restricted to read-only catalog policy; `admin`/`owner` access enabled) and resets navigation history cleanly on account switch (`NAV-04`).
**Verification / Research Flag**: CRITICAL — On-Device Auth/Cookie Cold-Kill Spike & LAN Cleartext Config. Must validate `pos_session` `httpOnly` cookie survival across process kills and offline relaunch on physical Android/iOS (comparing `expo/fetch` `Set-Cookie` capture into `expo-secure-store` vs RN `fetch` `credentials: "include"`), configure `app.config.ts` (`expo-build-properties` `usesCleartextTraffic: true`, iOS `NSAllowsLocalNetworking` & `NSLocalNetworkUsageDescription`), verify strictly on emulator/device (never Expo Web where `sec-fetch-site` triggers `403`), and consult the user before modifying `Apps_Toko_Rejeki` if a Bearer opt-in fallback or `expo-dev-client` cookie manager is required.
**Plans:** 6 plans

Plans:
**Wave 1**
- [ ] 01-01-PLAN.md — Pre-install `SUS` Package Legitimacy Gate, Expo SDK 58 + LAN cleartext `app.config.ts`, ESLint/Jest Wave 0, and clean placeholder routes (`AUTH-02`, `AUTH-03`)

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 01-02-PLAN.md — Core auth types, dual-tier `SecureStore`/`kv-store` storage, Server URL validation, `cookieParser`, `apiClient`, and `authApi` + unit tests (`AUTH-01`–`AUTH-04`)

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 01-03-PLAN.md — Velocity Blue tokens/UI, collapsible `ServerUrlPanel`, `AuthContext` state machine, Login screen, and `loginScreen.test.tsx` (`AUTH-01`–`AUTH-04`)

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 01-04-PLAN.md — `LogoutConfirmModal` and the four role-aware Velocity Blue tab screens (`Kasir`, `Produk`, `Pesanan`, `Pengaturan`) (`AUTH-02`, `AUTH-04`, `NAV-01`, `NAV-04`)

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 01-05-PLAN.md — Root `<Stack.Protected>` boot gate, keyed `user.id:user.role` stack reset, 4-tab JS `<Tabs>` bar, and `routingRbac.test.tsx` (`AUTH-03`, `AUTH-04`, `NAV-01`, `NAV-04`)

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 01-06-PLAN.md — Full automated suite pre-flight and Physical Device / Emulator Cold-Kill Spike (`D-05` gate) (`AUTH-01`–`AUTH-04`, `NAV-01`, `NAV-04`)
**UI hint**: yes

### Phase 2: Offline SQLite Catalog, Sync Engine & Health Header
**Goal:** As a store staff member, I want to keep the product catalog synced locally and monitor server health, so that I can browse prices offline and trigger manual syncs.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: NAV-03, SYNC-01, SYNC-02, SYNC-03, SYNC-04
**Success Criteria** (what must be TRUE):
  1. On first authenticated launch—and automatically after 10:00 WIB daily or when last sync exceeds 48 hours—the app performs `GET /api/sync/full` and persists products, categories, units, and authenticated store settings into `expo-sqlite` (WAL mode) for instant offline reads (`SYNC-01`, `SYNC-02`).
  2. While active in the foreground with connectivity, the app polls `GET /api/sync/delta` every 5 seconds using `server_time` and persistent `client_id` without causing `SQLITE_BUSY` locks or background polling drain (`SYNC-03`).
  3. A persistent global status header across the 4 tabs reflects live database connectivity (`Online`, `Standby Read-Only`, `Offline` from `/api/health`) and current local catalog sync state (`NAV-03`).
  4. User can inspect sync timestamps and cached record counts inside `Pengaturan` and manually trigger `Cek Pembaruan (Delta)`, `Sinkronisasi Penuh`, and `Reset Cache Lokal` (`SYNC-04`).
**Verification / Research Flag**: Verify delta sync strictly persists server-returned `server_time` + persistent `client_id` UUID (never phone `Date.now()`), enforces UTC+7-safe 10:00 WIB & >48h full-sync gates (cleaning up hard-deleted items), serializes SQLite writes via `WAL` + `busy_timeout = 5000` + `syncMutex`, and caches full `StoreSettings` only after authentication.
**Plans**: TBD
**UI hint**: yes

### Phase 3: Kasir Mobile POS & Multi-Mode Thermal Checkout
**Goal:** As a cashier, I want to search items, manage multi-tab carts with wholesale and open pricing, and print receipts, so that I can complete sales online or offline.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: POS-01, POS-02, POS-03, POS-04, POS-05, POS-06, POS-07, POS-08
**Success Criteria** (what must be TRUE):
  1. Cashier can switch between `Katalog Produk` and `Nota Aktif`, use the floating bottom cart summary bar, search instantaneously by name, SKU, or barcode, filter with horizontal category chips, and tap active selling units (`isActive && sellingPrice > 0`) to add items (`POS-01`, `POS-02`).
  2. Cashier can create, switch, cancel, and delete (with confirmation) multiple locally persisted `Nota` tabs that survive app restarts (`POS-03`).
  3. Cart calculations apply tiered wholesale pricing (`wholesaleTiers` per `minQty`) automatically, merge duplicate rows when switching units, keep manual Open Price overrides intact across qty `-`/`+` edits, and apply manual cart discounts (`Potongan Harga`) directly with no Kembalian or payment-method UI (`cashGiven = grandTotal`, `change = 0`) (`POS-04`, `POS-05`).
  4. Cashier can preview `58mm`/`80mm` receipts honoring `previewReceiptBeforePrint` and `receiptSections`, print via **Server Printer** (`POST /api/print`, `PrinterInterventionModal` with *Cetak Ulang*, *Bersihkan Antrean* `/api/print/flush`, and `paperNearEnd` alerts), log once to `POST /api/wa-log` only on print success, and retain the `Nota` if printing fails (`POS-06`, `POS-07`).
  5. Cashier can select active device print mode and print directly from mobile to a **Bluetooth Thermal ESC/POS** printer (`58mm`/`80mm`, offline-capable) or **Built-in HP / System Print** (Android Print Service / built-in POS terminal) (`POS-08`).
**Verification / Research Flag**: Evaluate and select the SDK 58 Bluetooth Classic SPP ESC/POS native module vs `expo-dev-client` (required for Android Bluetooth permissions and raw ESC/POS printing; unsupported in Expo Go) paired with `expo-print` as the Built-in HP / System Print fallback. Verify strict web-parity checkout (`cashGiven = grandTotal`, `change = 0`, zero Kembalian/payment-method UI), integer Rupiah rounding matching `orderValidation.ts`, `isCustomPrice` preservation, `POST /api/print` branching on `data.success === true` (not HTTP `200`), and deduplicated ISO-dated `POST /api/wa-log`.
**Plans**: TBD
**UI hint**: yes

### Phase 4: Produk & Pesanan Aktif (List → Detail Flows & CRUD)
**Goal:** As a store user, I want to browse product and pending order lists into detail views and manage catalog CRUD, so that I can inspect, resume, or update store items.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: PROD-01, PROD-02, PROD-03, PROD-04, ORDR-01, ORDR-02, NAV-02
**Success Criteria** (what must be TRUE):
  1. On tab `Produk`, user can search, filter by category, sort with all 5 modes (`A-Z`, `Z-A`, `Harga Terendah`, `Harga Tertinggi`, `Terbaru`), and tap any item to open `Detail Produk` showing SKU, barcode, category, unit conversions, and wholesale tiers while hiding `costPrice` and write actions for `kasir` (`PROD-01`, `PROD-02`).
  2. When database is online, `admin` and `owner` can add and edit products (base unit with *Tampilkan/Tidak Dijual* toggle, derived units, wholesale tiers) via `/api/products` and `/api/products/[id]`, soft-delete products, and restore (handling SKU conflicts), permanently delete, or empty the 30-day Trash Bin via `/api/products/trash` (`PROD-03`, `PROD-04`).
  3. On tab `Pesanan`, the Bottom Navigation Bar badge reflects the real-time count of locally held pending orders (`items.length > 0`), and the screen lists those pending orders or shows a clear empty state (`NAV-02`, `ORDR-01`).
  4. Tapping a pending order opens `Detail Pesanan` displaying itemized goods, wholesale badges/savings, subtotal, discount, total, local order rename, `Lanjutkan di Kasir` (activating that tab in Kasir), and `Hapus Nota` with confirmation (`ORDR-02`).
**Verification / Research Flag**: Enforce canonical `normalizeProduct()` formatting on `GET /api/products/[id]` raw responses (supplying missing `unitName`, `prices`, `baseUnit`), block catalog mutations when database is offline (`isDbOffline`), and preserve existing `unit.id` / `tier.id` identifiers across `PUT` updates.
**Plans**: TBD
**UI hint**: yes

### Phase 5: Pengaturan Hub, Profile/About & Owner Administration
**Goal:** As a store user or owner, I want to view profile/about info and manage printers, store logo, staff, and categories, so that store operations are fully configured on mobile.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: SETT-01, SETT-02, SETT-03, SETT-04, SETT-05
**Success Criteria** (what must be TRUE):
  1. All roles can view active account info, role, Logout action, Server URL & DB/Sync controls in `Pengaturan`, and open `Profil Toko & Tentang Aplikasi` displaying store identity, app version, stack/developer credits, and API connection status (`SETT-01`).
  2. Any staff member can switch device printer mode (**Printer Server**, **Bluetooth Termal**, or **Built-in / Sistem HP**) and scan/select Bluetooth thermal printers, while `owner` can configure server printers (`/api/printers`), `58mm`/`80mm` width, `previewReceiptBeforePrint`, receipt footer notes, and run `Tes Cetak` (`SETT-03`).
  3. `owner` can edit Store Profile & Identity—including picking a store logo from the phone gallery, compressing it (`<= 300x300` base64), and saving via `PUT /api/settings` while preserving existing `receiptSections` and `receiptItemConfig` (`SETT-02`).
  4. `owner` can list, create, edit (details, role, active flag), reset passwords, and delete staff accounts via `/api/users` and `/api/users/[id]` (`SETT-04`).
  5. `owner` can add and rename Categories and Units, inspect connected products, safely migrate items between categories/units, soft-delete, and restore or permanently purge items from Category/Unit Trash via `/api/categories/**` and `/api/units/**` (`SETT-05`).
**Verification / Research Flag**: Verify SDK 58 `expo-image-picker` + `expo-image-manipulator` sizing (`<= 300x300` base64) for gallery store logo upload (`SETT-02`), perform read-merge-write on `PUT /api/settings` so web-authored `receiptSections` and `receiptItemConfig` are preserved, and verify `Tes Cetak` across Server (`/api/printers/test`), Bluetooth ESC/POS, and Built-in/System HP Print.
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Auth, LAN Transport Spike & Role-Protected Shell | 0/0 | Not started | - |
| 2. Offline SQLite Catalog, Sync Engine & Health Header | 0/0 | Not started | - |
| 3. Kasir Mobile POS & Multi-Mode Thermal Checkout | 0/0 | Not started | - |
| 4. Produk & Pesanan Aktif (List → Detail Flows & CRUD) | 0/0 | Not started | - |
| 5. Pengaturan Hub, Profile/About & Owner Administration | 0/0 | Not started | - |
