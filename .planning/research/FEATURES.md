# Feature Research

**Domain:** Mobile Retail & Wholesale POS (Expo + React Native + TypeScript) backed by Existing Store Web Service (`Apps_Toko_Rejeki`)
**Researched:** 2026-11-17
**Confidence:** HIGH (derived from direct inspection of `Apps_Toko_Rejeki/apps/src`, `PROJECT.md`, and verified mobile POS UX patterns)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users and the project rubric assume exist for v1. Missing any of these makes the app incomplete or breaks parity with the store POS workflow.

#### 1. Authentication, Session Persistence & Server Connectivity

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Username & password login with show/hide toggle & store branding | Staff authenticate with their existing store accounts (`POST /api/auth/login`) while recognizing store identity (`GET /api/settings` guest response) | LOW | Handle HTTP `400` validation, `401` generic error, `403` inactive account, and `429` exponential login throttle (`retryAfter` countdown from `lib/loginThrottle.ts`). |
| Persistent auth session & offline session survival | Cashiers cannot be kicked back to Login if Wi-Fi/LAN drops mid-shift | MEDIUM | Persist session token/cookie + local user snapshot (`{ id, username, fullName, role }`). Revalidate via `GET /api/auth/me` when online; **only** force logout on explicit `401`/`403` (revoked/inactive user or changed `pw_stamp`), preserving session on network/`5xx` errors (`AuthContext.tsx` pattern). |
| Store API Server URL configuration & connection test | Standalone mobile app runs outside Next.js same-origin; must point to store PC LAN IP (`http://192.168.x.x:3000`) or HTTPS tunnel | LOW | Accessible on Login screen (collapsible/advanced setting) and Pengaturan; validates reachability via `GET /api/settings` or `/api/health`. |
| Role-Based Access Control (RBAC) across UI & actions | Prevents `kasir` from altering prices/products or `admin` from changing store settings/users | MEDIUM | Enforce `kasir` / `admin` / `owner` UI gates matching backend guards (`ROLES_STAFF`, `ROLES_MANAGER`, `ROLES_OWNER` in `lib/apiAuth.ts`). |
| Logout with confirmation modal | Prevents accidental mid-shift sign-out while held tabs or active work exist | LOW | Calls `POST /api/auth/logout` (fail-safe if offline) and clears local auth session while prompting user about held local tabs. |

#### 2. Navigation Shell & Rubric Architecture

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Bottom Navigation Bar with 4 tabs (`Kasir`, `Produk`, `Pesanan`, `Pengaturan`) | Rubric Requirement #2 & `PROJECT.md` decision; maps 1:1 to web `Sidebar.tsx` 4-item navigation | LOW | `Pesanan` tab displays live badge count of non-empty held local tabs (`heldTabsCount`). All 4 tabs remain visible for all roles; `Produk` operates *read-only* for `kasir`. |
| >= 5 Distinct Screens + 2 List → Detail flows + 1 Profile/About screen | Rubric Requirements #3, #4, #5 | LOW | Covered natively via Login + 4 Tabs + **Detail Produk** (List→Detail #1) + **Detail Pesanan** (List→Detail #2) + **Profil Toko & Tentang Aplikasi** (Profile/About) + Owner sub-pages. |
| Persistent top status header (Connection & Catalog Sync badge) | Staff need instant visibility into whether DB is Online, Standby (Read-Only), or Offline (`Header.tsx`) | MEDIUM | Compact mobile status pills from `GET /api/health` (10s background poll) + sync state (`Tersinkronisasi` / `Syncing` / `Mode Offline`) with tap-to-sync action. |

#### 3. Kasir (Mobile POS Screen)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Segmented pane toggle (`Katalog Produk` ↔ `Nota Aktif`) + floating cart bar | Mobile screen cannot fit catalog + cart side-by-side; mirrors web `< md` layout (`kasir/page.tsx` lines 481–523, 1032–1053) | LOW | `Nota Aktif` tab shows item count badge; `Katalog Produk` shows docked bottom summary bar (`X Item • Nota N` + `Buka Nota`) whenever active tab has items. |
| Instant offline omni-search (Name, SKU, Barcode) & horizontal category chips | Retail cashiers search by partial name, SKU, or barcode without waiting for network round-trips | LOW | Queries local synced catalog (`useOfflineCatalog` equivalent over SQLite); includes clear button and `Semua Produk` chip. |
| Product cards with quick-add default unit & per-unit price buttons | Wholesale/retail staff tap once to add default unit or tap specific unit pill (`Pcs`, `Dus`, `Slop`) directly | MEDIUM | Filters out units with `isActive === false` or `sellingPrice <= 0` (`kasir/page.tsx` lines 664–666); shows total in-cart `Nx` badge and per-unit qty badge. Virtualized `FlatList`/`FlashList` required for >1,000 SKUs. |
| Multi-tab local Nota (`Nota 1`, `Nota 2`, `+ Nota Baru`) | Cashiers serve multiple walk-in customers concurrently (`POSCartContext.tsx`) | MEDIUM | Persisted locally on device; supports switching tabs, creating new tabs, `Batal` (clear active tab items & discount), and `Hapus Nota` with confirmation modal when items > 0 (`tabs.length > 1`). |
| Automatic multi-unit conversion & tiered wholesale pricing | Core Toko Rejeki pricing rule: hitting `minQty` automatically applies `specialPrice` and `Grosir` badge | MEDIUM | `calculateEffectiveUnitPrice` checks unit-specific `wholesaleTiers` sorted descending by `minQty`; changing unit merges duplicate `productId + unit` rows cleanly. |
| Inline cart controls: Qty stepper + direct qty input, Unit switcher, Open Price edit, Line delete | Cashiers regularly negotiate custom prices ("open price"), switch Pcs↔Dus, or type bulk qty directly (`kasir/page.tsx` lines 889–956) | MEDIUM | Tapping price allows manual Rp override; `-` stepper at qty 1 removes line; direct numeric input falls back to `1` on blur if invalid. |
| Manual discount (`Potongan Harga`) & live totals | Standard wholesale/retail bill adjustment | LOW | `grandTotal = Math.max(0, subtotal - discountVal)`. |
| Cash Given & Change calculator (`Uang Diterima` & `Kembalian`) | Required by `PROJECT.md` line 21 for mobile cashiers calculating change on the floor | LOW | Web `CompletedOrder` and `/api/print` (`orderValidation.ts` lines 124–125) already accept `cashGiven` and `change` (web hardcoded `cashGiven: grandTotal, change: 0`); mobile adds quick-cash chips (`Uang Pas`, `20rb`, `50rb`, `100rb`) + numeric input showing real-time `Kembalian`. |
| Thermal Receipt Preview modal (`ReceiptPreviewModal` parity) | Controlled by `settings.previewReceiptBeforePrint`; lets cashier verify items & wholesale savings before printing | MEDIUM | Shared pure layout logic (`buildReceiptLayout` in `lib/receiptLayout.ts`) renders 58mm (32-col) / 80mm (48-col) receipt with `Hemat Grosir` lines and `Total Hemat Grosir`. |
| Print Receipt (`Cetak Struk 2x` / `3x`) + Background WA Log + Printer Intervention modal | Matches exact store checkout pipeline (`POST /api/print` + non-blocking `POST /api/wa-log`) | HIGH | Replicates `PrinterInterventionModal`: loading → success (auto-closes tab after ~1.3s) → error recovery for `PrinterErrorCode` (`PAPER_EMPTY`, `COVER_OPEN`, `PRINTER_OFFLINE`, `PRINT_STALLED`, `PRINTER_NOT_FOUND`, `ACCESS_DENIED`) with `Cetak Ulang`, `Bersihkan Antrean` (`POST /api/print/flush`), and `Kembali ke Kasir`, plus `paperNearEnd` banner. Preserves cart if offline/failed. |

#### 4. Produk & Detail Produk (List → Detail #1 + Manager CRUD)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Searchable, filterable, sortable product catalog (`Produk` tab) | Staff need quick price/variant lookup; `admin`/`owner` manage catalog (`produk/page.tsx`) | MEDIUM | Filter by category (`SearchableSelect` equivalent), sort (`A-Z`, `Z-A`, `Harga Terendah`, `Harga Tertinggi`, `Terbaru`), search name/SKU/barcode, total SKU counter, virtualized list. |
| **Detail Produk** screen (`/produk/[id]`) — List → Detail #1 | Rubric Requirement #4 & cleaner mobile UX than squeezing wide table columns onto a 360px screen | LOW | Displays full product details: Name, Category badge, SKU, Barcode, all `unitConversions` (with `conversionFactor`, `sellingPrice`, and `Acuan · Tidak Dijual` badge if `isActive === false`), and all `wholesaleTiers`. **`costPrice` (`Harga Beli`) is hidden for `kasir`** and visible only to `admin`/`owner`. |
| Add & Edit Product form (`admin`/`owner` only, locked when DB offline) | Core catalog management (`POST /api/products`, `PUT /api/products/[id]`, `ProductModal.tsx`) | HIGH | Full validation parity: Name*, Category* (searchable + custom), SKU, Barcode; Base Unit (`conversionFactor = 1`) with `Tampilkan / Tidak Dijual` (`isBaseSold`) switch; Derived Units (`conversionFactor >= 1`, `costPrice`, `sellingPrice`, duplicate-unit prevention); Wholesale Tiers (sellable target unit, `minQty >= 2`, `specialPrice < sellingPrice`). Triggers delta sync after save. |
| Soft Delete Product & 30-day Trash Bin (`admin`/`owner` only, locked when DB offline) | Prevents accidental permanent deletion (`DELETE /api/products/[id]`, `GET/POST/DELETE /api/products/trash`) | MEDIUM | Confirmation sheet before soft delete; Trash screen lists deleted products with `daysLeft` badge, search, Restore (surfaces SKU conflict errors), Permanent Delete, and Empty All with inline confirmation. |

#### 5. Pesanan Aktif & Detail Pesanan (List → Detail #2)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Local Pending Orders list (`Pesanan` tab) | Mirrors `pesanan-aktif/page.tsx`: displays all locally held `OrderTab` entries with `items.length > 0` | LOW | Shows `Nota N`, `DITUNDA (X Item)` badge, item preview snippet, `formatRp(grandTotal)`, and empty state (`Tidak Ada Nota Tertunda`). Strictly local device persistence (never synced to server DB). |
| **Detail Pesanan** screen (`/pesanan/[id]`) — List → Detail #2 | Rubric Requirement #4 & allows reviewing a held customer order before resuming or discarding it | LOW | Shows tab title (with optional local rename via `renameTab`), `createdAt`, complete itemized breakdown (qty, unit, unit price, `Grosir` badge & original price), subtotal, discount, grand total, `Lanjutkan di Kasir` CTA (switches active tab and routes to `Kasir` → `Nota Aktif`), and `Hapus Nota` with confirmation. |

#### 6. Pengaturan, Offline Sync, Profile/About & Owner Sub-Pages

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Account Profile card & Role Status banner (all roles) | Staff need to verify active user, role (`Kasir`/`Admin`/`Owner`), and access logout (`pengaturan/page.tsx`) | LOW | Non-owner roles see clear "Pengaturan Terbatas" info banner; Owner sees gateway cards to management sub-pages. |
| Database Health & Offline Catalog Sync telemetry + manual controls (all roles) | Core Value offline resilience: staff must trust local cache freshness and recover if stale (`GET /api/sync/full`, `GET /api/sync/delta`) | MEDIUM | Displays DB node status/host/latency/standby read-only warning, online/offline badge, total cached SKUs, last delta sync time (5s poll), last full sync time (daily 10:00 WIB / >48h auto full sync), plus `Cek Pembaruan (Delta)`, `Sinkronisasi Penuh`, and `Reset Cache Lokal` (with confirmation). |
| **Profil Toko & Tentang Aplikasi** screen (all roles) | Rubric Requirement #5 (1 Profile/About screen) & `PROJECT.md` requirement | LOW | Shows cached Store Identity (logo, name, address, phone), App Name & Version, tech stack/architecture attribution, developer info, and active API endpoint diagnostic. |
| **Owner:** Profil & Identitas Toko editor (`PUT /api/settings`) | Owner updates store name, phone, address, and compressed logo image (`<= 300x300` base64) | MEDIUM | Unsaved-changes guard; **must merge and preserve existing `receiptSections` and `receiptItemConfig`** before calling `PUT /api/settings` so editing store profile from mobile never erases the web-configured receipt template! |
| **Owner:** Konfigurasi Printer & Struk (`GET /api/printers`, `POST /api/printers/test`, `PUT /api/settings`) | Owner needs to toggle `Preview Struk Sebelum Mencetak`, paper width (`58mm`/`80mm`), server printer selection, and `Tes Cetak` from mobile | MEDIUM | Focused mobile controls (printer picker, paper width, preview switch, test print, footer note) while preserving complex `receiptSections`/`receiptItemConfig` fields created on web. |
| **Owner:** Manajemen Akun & Hak Akses (`/api/users`, `/api/users/[id]`) | Owner creates/edits/deactivates staff accounts and resets forgotten cashier passwords remotely (`AccountManager.tsx`) | MEDIUM | Role-sorted user list; Add User (username min 3 chars, password min 4 chars, fullName, role); Edit User (details, role, active switch); Reset Password (`PATCH`); Delete User. Relies on backend self-deactivation/demotion/last-owner protections. |
| **Owner:** Manajemen Kategori & Satuan Barang (`/api/categories/**`, `/api/units/**`) | Owner cleans up duplicate categories/units and migrates products safely without breaking product references (`CategoryUnitManager.tsx`) | HIGH | Tabbed `Kategori` / `Satuan` view with product/variant usage count, Add, Edit/Rename + Connected Products inspection + Safe Migration (`/migrate`), conflict-guarded Delete, and Category/Unit Trash bin restore/purge. |

---

### Differentiators (Competitive Advantage)

Features not strictly required for v1 parity or rubric compliance, but high-value additions for v1.x once the core loop is validated.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Complete Transaction Locally ("Selesaikan Tanpa Cetak") + Share Digital Receipt (WhatsApp / OS Share Sheet) | On mobile away from the store USB printer (e.g., floor sales, delivery, or offline), cashiers can still close an order, inspect a digital receipt summary, or share via WhatsApp directly | MEDIUM | Requires `expo-sharing` / `react-native-view-shot` or formatted text share (`formatTransactionLog` logic from `lib/whatsapp.ts`). Still keeps orders local unless backend order-history API is added later. |
| Camera Barcode Scanner (`expo-camera`) on Kasir & Produk search | Eliminates typing long EAN-13 barcodes on a phone keyboard; standard expectation in Kasir Pintar/Qasir | MEDIUM | Explicitly marked Out of Scope in `PROJECT.md` for v1; trivial to add in v1.x by filling existing `searchQuery` state from camera scan result. |
| Direct Bluetooth ESC/POS Thermal Printing from Phone | Allows mobile cashier to print directly to a pocket 58mm Bluetooth printer when away from the Windows POS host PC | HIGH | Currently `/api/print` prints via the store PC server (Windows Spooler / network TCP). Direct mobile BT requires native BLE/Classic SPP library and custom ESC/POS port. |
| Quick Stock/Price Inquiry + "Almost Wholesale" Upsell Hint in Cart | Shows `"Tambah 2 Pcs lagi untuk harga grosir Rp 3.300"` in cart row so cashiers upsell higher volume | LOW | Pure client calculation using existing `product.wholesaleTiers` already synced locally. |
| Full Drag-and-Drop Receipt Section Builder on Mobile | Replicates `ReceiptSectionBuilder.tsx` (custom text/separator/key-value lines, `{invoice}`, `{tanggal}`, `{kasir}` chips, font sizes) on phone | HIGH | Low ROI on small phone screens in v1; web PC handles deep template layout authoring better, while mobile handles toggles/paper width/test print. |

---

### Anti-Features (Commonly Requested, Often Problematic)

Deliberate omissions for v1 to protect stability, scope, and backend compatibility.

| Feature | Why Requested | Why Problematic | Better Alternative |
|---------|---------------|-----------------|-------------------|
| Creating a New Standalone Backend or Direct PostgreSQL Connection from Phone | Tempting for rapid prototyping or bypassing cookie auth issues | Violates `PROJECT.md` constraint; exposes PostgreSQL credentials on mobile clients and splits inventory/auth state from `Apps_Toko_Rejeki` | Consume existing `Apps_Toko_Rejeki` Next.js REST API endpoints with proper session/cookie handling verified in Phase 1. |
| Syncing `Pesanan Aktif` (Held Tabs) to Server PostgreSQL Tables | Users assume held orders behave like restaurant kitchen tickets across devices | Explicitly Out of Scope in `PROJECT.md`; web `POSCartContext.tsx` has no backend table for orders/tabs (`Apps_Toko_Rejeki` doesn't store sales orders in DB) | Persist held tabs locally on the mobile device via SQLite/MMKV/AsyncStorage, matching web `localStorage` behavior. |
| Offline Product / Category / User Mutations (Offline Write Queue) | Seems helpful when Wi-Fi drops while editing prices | Web intentionally **locks** all Product/Category/Unit/Settings CRUD during offline mode (`isDbOffline`) to prevent SKU collisions, stale wholesale tier overwrites, and silent conflict corruption | Allow full offline **Kasir & read-only Produk browsing** via local catalog cache, and explicitly lock master-data mutations with clear `Mode Offline` indicators until reconnected. |
| Silently Modifying `Apps_Toko_Rejeki` Backend Code | Quick way to work around mobile cookie/CORS/bearer token quirks | Explicitly forbidden by `PROJECT.md` ("Perubahan diam-diam pada backend web `Apps_Toko_Rejeki` — segala kebutuhan perubahan backend harus dikomunikasikan kepada pengguna terlebih dahulu") | Test native cookie jar (`fetch` + `Cookie` / `Set-Cookie` + `sec-fetch-site` behavior) early; if a backend header/token change is truly needed, surface a clear proposal to the user before touching the sibling repo. |
| Hardware Keyboard Shortcuts (`F2`, `F4`, `Esc`) & Mouse Drag-Scroll Hooks | Present throughout web `kasir/page.tsx` and `produk/page.tsx` | Mobile touchscreens lack function keys and hover states; porting keyboard-first flows creates dead UI affordances (`F2` badges) | Replace `F2` focus hints with touch-friendly search bar + clear button (`48x48dp` targets per `design.md`), and replace `F4` with thumb-reachable sticky bottom action buttons. |
| Stock Quantity Deduction / Full Inventory Ledger UI | Common in competitors like Kasir Pintar/BeePOS | `Apps_Toko_Rejeki` PostgreSQL schema & `/api/products` do **not** have a stock quantity column or sales-transaction stock-deduction endpoint | Show active/sellable units, conversion factors, and wholesale tiers accurately without inventing fake stock numbers. |

---

## Feature Dependencies

```
[Server URL Config + Auth Login (/api/auth/login, /api/auth/me)]
    ├──requires──> [Persistent Session / Cookie Jar + Local Auth Snapshot]
    │
    ├──unlocks──> [Bottom Nav 4 Tabs + Role Guards (kasir/admin/owner)]
    │                  │
    │                  ├──> [Health Poll (/api/health) + Offline Sync Engine (/api/sync/full, /api/sync/delta)]
    │                  │        └──requires──> [Local Catalog Storage (SQLite/Storage)]
    │                  │                           ├──powers──> [Kasir: Catalog Search, Category Filter, Multi-Unit & Wholesale]
    │                  │                           └──powers──> [Produk Tab + Detail Produk (List->Detail #1)]
    │                  │
    │                  ├──> [Local Held Tabs Store (POSCartContext equivalent)]
    │                  │        ├──powers──> [Kasir: Multi-Tab Nota, Open Price, Discount, Kembalian]
    │                  │        └──powers──> [Pesanan Aktif Tab + Detail Pesanan (List->Detail #2)]
    │                  │
    │                  ├──> [Store Settings Cache (/api/settings)]
    │                  │        ├──powers──> [Kasir: Receipt Preview Modal + Print (/api/print) + WA Log (/api/wa-log)]
    │                  │        └──powers──> [Pengaturan: Profil Toko & Tentang Aplikasi (Rubric #5)]
    │                  │
    │                  └──> [Role: admin/owner] ──unlocks──> [Produk CRUD + Product Trash (/api/products/**)]
    │                                                              └──enhances──> [Trigger Delta Sync on Mutation]
    │
    └──[Role: owner]──unlocks──> [Owner Pengaturan Sub-Pages]
                                     ├──> [Edit Store Profile & Logo (/api/settings PUT)]
                                     ├──> [Printer & Receipt Basic Settings (/api/printers, /api/settings PUT)]
                                     ├──> [Account & Role Management (/api/users/**)]
                                     └──> [Category & Unit Management + Migration + Trash (/api/categories/**, /api/units/**)]

[Cash & Change Calculator] ──enhances──> [Kasir Checkout & /api/print payload]
[Receipt Layout Engine (lib/receiptLayout.ts)] ──required by──> [ReceiptPreviewModal]
```

### Dependency Notes

- **Auth Session & Cookie Handling requires verification first:** Every API endpoint (`sync/full`, `sync/delta`, `products`, `print`, `wa-log`, `users`, `settings` PUT) requires the `httpOnly` `SESSION_COOKIE_NAME` cookie, and `middleware.ts` checks `sec-fetch-site` on mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) — rejecting if `sec-fetch-site` is present and not `same-origin`/`none`. React Native `fetch` does not normally send `sec-fetch-site`, **but** cookie persistence across app restarts and `Set-Cookie` handling must be proven before building downstream features.
- **Offline Sync Engine feeds both `Kasir` and `Produk`:** Both screens read from the same local synced product/category/unit database for sub-millisecond search and offline survival. Building the sync engine and local catalog store early unblocks both core tabs simultaneously.
- **Local Held Tabs Store couples `Kasir` and `Pesanan Aktif`:** Updating or switching a tab in `Pesanan Aktif` / `Detail Pesanan` must reflect immediately in `Kasir` (`Nota Aktif`) and the `Pesanan` bottom tab badge count.
- **Store Profile / Printer Settings PUT depends on full settings hydration:** Because `PUT /api/settings` overwrites `receiptSections` and `receiptItemConfig` in `receipt_templates` if omitted (`api/settings/route.ts` lines 231–232), Owner settings edits on mobile must read-merge-write the complete `StoreSettings` object.
- **Online DB guard governs all write features:** `ProductModal`, `ProductTrashModal`, `CategoryUnitManager`, `AccountManager`, and `StoreSettings` edits depend on `SystemStatus` (`dbStatus !== 'offline'` and `!isReadOnly`) to enforce safe read-only locking when the server or primary DB is unreachable.

---

## MVP Definition

### Launch With (v1)

Minimum viable product required for complete Toko Rejeki mobile parity, offline resilience, and 100% grading rubric compliance:

- **Auth & Connectivity Foundation**
  - [ ] Login screen (`/login`) with username, password, show/hide toggle, store branding (`GET /api/settings`), login throttle/inactive/invalid error states, and API Base URL configuration
  - [ ] Persistent session (`httpOnly` cookie + secure local snapshot) surviving offline restarts (`GET /api/auth/me`, `POST /api/auth/logout`)
- **App Shell & Rubric Structure**
  - [ ] Bottom Navigation Bar 4 tabs (`Kasir`, `Produk`, `Pesanan` with badge, `Pengaturan`) + Connection/Sync status header
  - [ ] Role-based access gating across `kasir`, `admin`, and `owner` (`Produk` *read-only* for `kasir`)
- **Offline Sync & Local Persistence**
  - [ ] Local catalog store + Sync Engine (`GET /api/sync/full`, `GET /api/sync/delta` 5s foreground polling, daily 10:00 WIB / >48h full sync, manual Delta/Full/Reset triggers)
  - [ ] Local persistent Multi-Tab Cart store (`OrderTab[]` + `activeTabId`)
- **Kasir (Tab 1)**
  - [ ] Segmented `Katalog Produk` ↔ `Nota Aktif` switcher + floating bottom summary bar
  - [ ] Instant search (name, SKU, barcode), category filter chips, virtualized product cards with unit quick-add buttons (`isActive !== false && sellingPrice > 0`)
  - [ ] Multi-tab Nota (`+ Nota Baru`, switch, `Batal`, `Hapus Nota` confirmation)
  - [ ] Cart item editing: auto wholesale tier pricing (`Grosir` badge), unit switcher (with duplicate merge), qty stepper + numeric entry, manual Open Price override, line delete, manual Rp discount
  - [ ] Cash Given & Change (`Kembalian`) calculator with quick-cash chips
  - [ ] Thermal Receipt Preview modal (`settings.previewReceiptBeforePrint`) + `Cetak Struk 2x` / `3x` (`POST /api/print`) + non-blocking `POST /api/wa-log` + `PrinterInterventionModal` (`Cetak Ulang`, `Bersihkan Antrean`, `paperNearEnd` warning)
- **Produk + Detail Produk (Tab 2 — List → Detail #1)**
  - [ ] Search, category filter, 5 sort modes, virtualized product list
  - [ ] Dedicated **Detail Produk** screen (all units, conversion factors, selling prices, wholesale tiers; `costPrice` visible only to `admin`/`owner`)
  - [ ] Add/Edit Product form + Soft Delete + 30-day Trash Bin (`admin`/`owner` only, locked when DB offline)
- **Pesanan Aktif + Detail Pesanan (Tab 3 — List → Detail #2)**
  - [ ] Local pending orders list (`items.length > 0`) + empty state
  - [ ] Dedicated **Detail Pesanan** screen (full itemized list, wholesale savings, discount, total, `Lanjutkan di Kasir`, local tab rename, `Hapus Nota`)
- **Pengaturan + Profile/About + Owner Sub-Pages (Tab 4 — Profile/About #5)**
  - [ ] Account Profile + Logout confirmation + DB Health & Sync Telemetry card (all roles)
  - [ ] Dedicated **Profil Toko & Tentang Aplikasi** screen (all roles — Rubric #5)
  - [ ] Owner sub-pages (`role === 'owner'`): Store Profile & Logo editor, Printer & Receipt basic settings (`58mm`/`80mm`, preview switch, printer picker, test print — preserving `receiptSections`), Account/Role manager, Category & Unit manager (with connected products inspection, migration, and trash bin)

### Add After Validation (v1.x)

Features to add once v1 field testing confirms smooth daily use:

- [ ] **Complete Order Locally + Digital Receipt Share (WhatsApp / Image Share)** — Trigger: cashiers use mobile outside store Wi-Fi/printer range and want to mark local orders done or send digital receipts directly from their phone
- [ ] **Camera Barcode Scanner (`expo-camera`)** — Trigger: staff want rapid physical barcode scanning on mobile without typing EAN codes
- [ ] **"Add N more for Wholesale Tier" cart hint** — Trigger: cashiers want proactive upsell prompts on partial wholesale quantities

### Future Consideration (v2+)

Features to defer unless backend schema and business scope expand:

- [ ] **Server-Synced Transaction History & Reporting** — Deferred because `Apps_Toko_Rejeki` currently does not persist sales orders/invoices in PostgreSQL (only `/api/print` & `/api/wa-log` exist)
- [ ] **Direct Phone Bluetooth Thermal Printing** — Deferred until standalone mobile printing outside store PC LAN is required
- [ ] **Full Mobile Receipt Section Builder Studio** — Deferred because editing multi-line thermal templates (`ReceiptSectionBuilder.tsx`) is far better suited to desktop PC

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Auth Login + Persistent Session + Server URL Config | HIGH | MEDIUM | **P1** |
| Bottom Nav (4 Tabs) + Role Gates + Health/Sync Status | HIGH | LOW | **P1** |
| Offline Sync Engine (`full`/`delta`) + Local Catalog DB | HIGH | HIGH | **P1** |
| Kasir Catalog + Multi-Tab Cart + Multi-Unit & Wholesale Pricing | HIGH | HIGH | **P1** |
| Kasir Discount + Kembalian + Receipt Preview + Print/WA Log + Printer Modal | HIGH | HIGH | **P1** |
| Produk List + Detail Produk (List → Detail #1) + `admin`/`owner` CRUD & Trash | HIGH | HIGH | **P1** |
| Pesanan Aktif List + Detail Pesanan (List → Detail #2) | HIGH | LOW | **P1** |
| Pengaturan Overview + Sync Controls + Profil Toko & Tentang Aplikasi | HIGH | MEDIUM | **P1** |
| Owner Sub-Pages (Store Profile, Accounts, Categories/Units + Migration) | MEDIUM | HIGH | **P1** |
| Owner Printer Picker, Paper Width, Preview Toggle & Test Print | MEDIUM | MEDIUM | **P1** |
| Local Checkout + Digital Receipt Share Sheet (No Physical Printer) | MEDIUM | MEDIUM | **P2** |
| Camera Barcode Scanner (`expo-camera`) | MEDIUM | MEDIUM | **P2** |
| "Almost Wholesale" Upsell Indicator in Cart | LOW | LOW | **P2** |
| Direct Mobile Bluetooth ESC/POS Printing | LOW | HIGH | **P3** |
| Full Mobile Drag-and-Drop Receipt Section Builder | LOW | HIGH | **P3** |

---

## Role Permission Matrix (Mobile vs Web Reference)

| Module / Capability | `kasir` | `admin` | `owner` | Notes & Backend Guard Alignment |
|---------------------|---------|---------|---------|---------------------------------|
| Login / Auth / Logout | Yes | Yes | Yes | `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` |
| **Tab 1: Kasir** (Search, Cart, Multi-Tab, Wholesale, Open Price, Discount, Kembalian, Print, WA Log) | Yes | Yes | Yes | `ROLES_STAFF` on `/api/print`, `/api/print/flush`, `/api/wa-log`, `/api/sync/*` |
| **Tab 2: Produk** — Browse, Search, Filter, Sort, **Detail Produk** | **Read-Only** | Yes | Yes | Backend `GET /api/products`, `GET /api/products/[id]`, `GET /api/sync/*` allow `ROLES_STAFF`. Mobile hides `costPrice` & write buttons for `kasir` (adapting web `middleware.ts` block per `PROJECT.md`). |
| **Tab 2: Produk** — Add, Edit, Soft Delete, Trash Restore/Purge | No | Yes (online only) | Yes (online only) | Backend `ROLES_MANAGER` (`["admin", "owner"]`). Locked when DB offline. |
| **Tab 3: Pesanan Aktif** & **Detail Pesanan** (Local Tabs) | Yes | Yes | Yes | Purely local device storage; no server API calls. |
| **Tab 4: Pengaturan** — Account Card, Logout, Health/Sync Controls, **Profil Toko & Tentang Aplikasi** | Yes | Yes | Yes | `GET /api/health`, `GET /api/sync/*`, `GET /api/settings` allow `ROLES_STAFF`. |
| **Tab 4: Pengaturan** — Store Profile & Logo Edit, Printer/Receipt Config | No | No | Yes (online only) | `PUT /api/settings` requires `ROLES_OWNER`; `/api/printers` allows `ROLES_MANAGER` in backend but web `pengaturan/page.tsx` restricts entire printer/receipt UI to `isOwner`. |
| **Tab 4: Pengaturan** — User Accounts CRUD & Password Reset | No | No | Yes (online only) | `/api/users/**` requires `ROLES_OWNER`. |
| **Tab 4: Pengaturan** — Categories & Units CRUD, Migration & Trash | No | No | Yes (online only) | Backend `/api/categories/**` & `/api/units/**` allow `ROLES_MANAGER`, while web `pengaturan/page.tsx` places `CategoryUnitManager` inside Owner-only view (`isOwner`). Mobile follows web UI restriction (`owner` only). |

---

## 5 Rubric Requirements Verification Mapping

| # | Rubric Requirement | How `Apps Toko Rejeki Mobile` Satisfies It |
|---|-------------------|--------------------------------------------|
| 1 | **API Web Service buatan sendiri** | Consumes the store's own Next.js Web Service API (`Apps_Toko_Rejeki`: `/api/auth/*`, `/api/sync/*`, `/api/products/*`, `/api/categories/*`, `/api/units/*`, `/api/settings`, `/api/users/*`, `/api/printers/*`, `/api/print`, `/api/wa-log`, `/api/health`) |
| 2 | **Bottom Navigation Bar** | 4-tab persistent bottom navigation bar (`Kasir`, `Produk`, `Pesanan`, `Pengaturan`) using Expo Router Tabs, consistent across all 3 user roles |
| 3 | **Minimal 5 halaman** | Exceeds 5 screens: Login + 4 Bottom Tabs + Detail Produk + Detail Pesanan + Tambah/Edit Produk + Tong Sampah Produk + Profil Toko & Tentang Aplikasi + Owner sub-pages (Profil Toko, Printer/Struk, Akun, Kategori & Satuan) |
| 4 | **Minimal 2 halaman utama ber-list → halaman detail** | (1) `Produk` list → `Detail Produk` (`/produk/[id]`); (2) `Pesanan Aktif` list → `Detail Pesanan` (`/pesanan/[id]`) |
| 5 | **1 halaman Profile/About aplikasi** | `Profil Toko & Tentang Aplikasi` accessible from `Pengaturan` for all roles (`kasir`, `admin`, `owner`), showing logged-in account profile, store identity, app info/version, and server connection summary |

---

## Competitor Feature Analysis

| Feature | Web App (`Apps_Toko_Rejeki`) | Indonesian Retail/Wholesale Mobile POS (Kasir Pintar / Qasir) | `Apps Toko Rejeki Mobile` (v1 Approach) |
|---------|-------------------------------|--------------------------------------------------------------|------------------------------------------|
| Multi-Unit Conversion (Pcs, Dus, Slop) | Full matrix with `conversionFactor` & `isActive` ("Acuan") | Supported in Kasir Pintar Pro; basic variant only in Qasir | Full 1:1 parity via synced `unitConversions` + quick-add unit pills on product cards |
| Tiered Wholesale Pricing (`Grosir`) | Automatic per-unit `minQty -> specialPrice` calculation + savings lines on receipt | Paid plugin / Pro feature; often lacks automatic receipt savings breakdown | Full 1:1 automatic tier pricing + `Grosir` badge + `Hemat Grosir` receipt preview parity |
| Multi-Tab Held Orders | Local `POSCartContext` multi-tab (`Nota 1`, `Nota 2`) + `Pesanan Aktif` page | "Simpan Pesanan / Open Bill" list | Local multi-tab `Nota` + dedicated `Pesanan` list → `Detail Pesanan` inspection screen |
| Offline Resilience | IndexedDB (Dexie) + 5s Delta Sync + Session snapshot survival | Local SQLite cache with periodic cloud sync | Local SQLite/storage cache + `sync/full` & `sync/delta` + offline session survival + read-only mutation locks |
| Cash & Change (`Kembalian`) | Fields exist in `CompletedOrder` (`cashGiven`/`change`) but UI omits calculator | Built-in numpad / quick nominal chips on checkout | Mobile-first quick-cash chips + live `Kembalian` calculator integrated into checkout |
| Camera Barcode Scanner | Text/USB-HID scanner input (`F2`) | Built-in phone camera scanner | Text/SKU/Barcode search in v1 (per `PROJECT.md`); camera scanner planned for v1.x |
| Product Stock Deduction | Not implemented in DB schema | Full stock ledger | Out of scope in v1 to match `Apps_Toko_Rejeki` backend schema faithfully |

---

## Sources

- **Sibling Web Application Codebase (HIGH confidence — direct file inspection):**
  - `C:/Users/adrie/Desktop/Project/Apps_Toko_Rejeki_Mobile/.planning/PROJECT.md`
  - `C:/Users/adrie/Desktop/Project/Apps_Toko_Rejeki/design.md`
  - `C:/Users/adrie/Desktop/Project/Apps_Toko_Rejeki/apps/src/types/index.ts`
  - `C:/Users/adrie/Desktop/Project/Apps_Toko_Rejeki/apps/src/middleware.ts`
  - `C:/Users/adrie/Desktop/Project/Apps_Toko_Rejeki/apps/src/lib/apiAuth.ts`
  - `C:/Users/adrie/Desktop/Project/Apps_Toko_Rejeki/apps/src/lib/auth.ts`
  - `C:/Users/adrie/Desktop/Project/Apps_Toko_Rejeki/apps/src/lib/loginThrottle.ts`
  - `C:/Users/adrie/Desktop/Project/Apps_Toko_Rejeki/apps/src/lib/syncEngine.ts`
  - `C:/Users/adrie/Desktop/Project/Apps_Toko_Rejeki/apps/src/lib/receiptLayout.ts`
  - `C:/Users/adrie/Desktop/Project/Apps_Toko_Rejeki/apps/src/lib/orderValidation.ts`
  - `C:/Users/adrie/Desktop/Project/Apps_Toko_Rejeki/apps/src/lib/whatsapp.ts`
  - `C:/Users/adrie/Desktop/Project/Apps_Toko_Rejeki/apps/src/context/AuthContext.tsx`
  - `C:/Users/adrie/Desktop/Project/Apps_Toko_Rejeki/apps/src/context/POSCartContext.tsx`
  - `C:/Users/adrie/Desktop/Project/Apps_Toko_Rejeki/apps/src/context/SyncEngineContext.tsx`
  - `C:/Users/adrie/Desktop/Project/Apps_Toko_Rejeki/apps/src/context/SystemStatusContext.tsx`
  - `C:/Users/adrie/Desktop/Project/Apps_Toko_Rejeki/apps/src/components/Sidebar.tsx`, `Header.tsx`, `ProductModal.tsx`, `ProductTrashModal.tsx`, `ReceiptPreviewModal.tsx`, `PrinterInterventionModal.tsx`, `AccountManager.tsx`, `CategoryUnitManager.tsx`, `CategoryUnitTrashModal.tsx`
  - `C:/Users/adrie/Desktop/Project/Apps_Toko_Rejeki/apps/src/app/login/page.tsx`
  - `C:/Users/adrie/Desktop/Project/Apps_Toko_Rejeki/apps/src/app/(pos)/kasir/page.tsx`, `produk/page.tsx`, `pesanan-aktif/page.tsx`, `pengaturan/page.tsx`
  - `C:/Users/adrie/Desktop/Project/Apps_Toko_Rejeki/apps/src/app/api/**` (auth, products, categories, units, settings, users, printers, print, wa-log, health, sync)
- **External Mobile POS & Indonesian Wholesale POS Patterns (MEDIUM confidence — verified via web search):**
  - Mobile POS UX best practices for checkout, omni-search, inline cart management, multi-unit UoM, and wholesale tiers (Odoo / Baymard / Wingify references via WebSearch)
  - Indonesian Android retail/wholesale POS capabilities comparison: Kasir Pintar (`kasirpintar.co.id`), Qasir (`qasir.id`), BeePOS (`bee.id`)

---
*Feature research for: Apps Toko Rejeki Mobile (Expo React Native TypeScript POS)*
*Researched: 2026-11-17*
