# Project Research Summary

**Project:** Apps Toko Rejeki Mobile
**Domain:** Offline-Resilient Mobile Point-of-Sale (POS) Client consuming an Existing Next.js App Router + PostgreSQL REST API (`Apps_Toko_Rejeki`)
**Researched:** 2026-11-17
**Confidence:** MEDIUM (HIGH for `Apps_Toko_Rejeki` backend contracts, domain rules, and feature parity; MEDIUM for Expo SDK 58 runtime behavior around `httpOnly` cookie persistence on physical Android/iOS devices until verified in Phase 1)

## Executive Summary

**Apps Toko Rejeki Mobile** is a local-first retail and wholesale POS client built for store staff (`kasir`, `admin`, and `owner`) to serve walk-in customers on the shop floor, look up multi-unit and tiered wholesale prices, manage held local orders (`Pesanan Aktif`), dispatch thermal receipts via the store PC (`/api/print`, `/api/wa-log`), and administer catalog/store master data over LAN HTTP or HTTPS tunnels. Because the sibling `Apps_Toko_Rejeki` Next.js service already owns PostgreSQL, thermal ESC/POS printing, and WhatsApp logging—and `PROJECT.md` strictly prohibits building a standalone backend or silently editing the web server—experts build this class of app as a **4-layer local-first client**: Expo Router presentation/navigation with role guards, Zustand + Context domain orchestration, an `expo-sqlite` relational/KV persistence and delta-sync engine, and a defensive REST transport layer.

The recommended approach standardizes on **Expo SDK 58 (`~58.0.25`) + Expo Router (`~58.0.31`) + TypeScript (`strict: true`)**, pairing typed **Velocity Blue** design tokens + `StyleSheet.create` (avoiding NativeWind v4/v5 Metro friction under RN `0.88.1`), **`expo-sqlite` (`~58.0.17`)** for both WAL-mode relational catalog storage and synchronous `kv-store` cart persistence via **Zustand (`^5.1.0`)**, **`expo-secure-store` (`~58.0.3`)** for compact auth/server metadata, and **`@shopify/flash-list` v2 (`2.3.2`)** for fast catalog scrolling—keeping 100% of v1 native dependencies compatible with Expo Go while ready for EAS / `expo-dev-client` APKs. Navigation maps the web app's 4 sidebar sections into a persistent 4-tab Bottom Navigation Bar (`Kasir`, `Produk`, `Pesanan`, `Pengaturan`) visible to all roles (`Produk` operates *read-only* for `kasir`), backed by nested `<Stack>` detail and management flows that exceed all 5 project rubric requirements.

The single highest-priority technical risk stems from inspecting `Apps_Toko_Rejeki/apps/src/lib/apiAuth.ts` and `login/route.ts`: the backend **only** authenticates via an `httpOnly` cookie (`pos_session`) and returns no bearer token in JSON, yet neither Expo Go nor Android's `OkHttp`/`ForwardingCookieHandler` guarantees `httpOnly` cookie survival across cold process kills or LAN-vs-HTTPS URL switches. To mitigate this and related integration traps (such as Android 9+ blocking cleartext `http://192.168.x.x:3000` in standalone builds, `GET /api/products/[id]` omitting `formatProductRow`, `/api/print` returning HTTP `200` on printer hardware errors, and `403` role errors mistakenly logging out cashiers), **Phase 1 must execute an on-device Auth & LAN Networking Spike** before downstream POS screens are built, with a pre-planned escalation to the user for a small Bearer opt-in fallback on the backend (or a move to `expo-dev-client` + cookie flushing) if physical devices drop `pos_session`.

---

## Key Findings

### Recommended Stack

The stack stays lean and deterministic under Expo SDK 58 (`react-native@0.88.1` with mandatory New Architecture, `react@19.3.0`, Strict TypeScript API) by keeping all dependencies inside SDK 58's bundled native runtime and avoiding C++ Nitro/custom-bridge packages (`react-native-mmkv`, `@react-native-cookies/cookies`, `@react-native-community/netinfo`, WatermelonDB) that crash in Expo Go. See [STACK.md](./STACK.md) for exact versions and alternatives.

**Core technologies:**
- **Expo SDK `~58.0.25` + Expo Router `~58.0.31` + TypeScript `~5.9` (`strict: true`):** Managed React Native runtime, typed file-based `(tabs)` + nested `<Stack>` navigation, and `<Stack.Protected>` route guards.
- **`StyleSheet.create` + Typed Velocity Blue Tokens (`src/theme/tokens.ts`) + `@expo-google-fonts/*` (`0.4.x`):** Eliminates NativeWind v4 (Tailwind v3 / SDK 57 target) and v5-rc (`lightningcss` Metro override) fragility while delivering `design.md` typography (`Hanken Grotesk`, `Inter`, `JetBrains Mono`), 8px spacing, and `48dp` POS touch targets.
- **`expo-sqlite` `~58.0.17` (WAL Relational + `expo-sqlite/kv-store`) + `zustand` `^5.1.0`:** One native module handles indexed catalog tables/delta transactions *and* synchronous Zustand `persist` storage (`getItemSync`/`setItemSync`) for multi-tab `Pesanan Aktif`, replacing AsyncStorage and MMKV.
- **`expo-secure-store` `~58.0.3`:** Encrypted storage strictly for small payloads (~400–600 bytes: session token/cookie snapshot, user profile `{ id, username, fullName, role }`, `server_base_url`, and `client_uuid`), staying safely below the ~2048-byte Keychain/Keystore limit.
- **`expo/fetch` + `expo-network` `~58.0.5` + `@shopify/flash-list` `2.3.2` + `lucide-react-native` `^1.74.0` + `zod` `^4.6.7`:** WinterCG HTTP transport, OS connectivity monitoring alongside `/api/health`, New-Arch v2 list virtualization for 1,000+ SKUs, 1:1 web icon parity, and runtime payload/form validation.

### Expected Features

Feature scoping achieves 1:1 functional parity with the `Apps_Toko_Rejeki` POS workflow, satisfies all 5 mobile grading rubric gates, and adds mobile-native checkout ergonomics (`Uang Diterima` & `Kembalian`) while deferring camera scanning and non-essential studio editors. See [FEATURES.md](./FEATURES.md) for the complete role permission matrix and rubric mapping.

**Must have (table stakes — v1):**
- **Auth, Connectivity & RBAC Shell:** Username/password login with `429` throttle countdown, runtime Server URL config + connection test, offline session survival (logout only on `401` or `/api/auth/me` `403`, never on `503`/network loss), 4-tab Bottom Navigation Bar (`Kasir`, `Produk`, `Pesanan` with live badge, `Pengaturan`), persistent connection/sync status header, and `kasir` / `admin` / `owner` gates.
- **Offline Sync & Local Catalog:** `/api/sync/full` and `/api/sync/delta` (5s active poll, 10:00 WIB daily & >48h forced full sync, manual Delta/Full/Reset controls) feeding both `Kasir` and `Produk`.
- **Kasir Mobile Checkout:** Segmented `Katalog Produk` ↔ `Nota Aktif` toggle + docked floating cart bar, instant name/SKU/barcode search & category chips, quick-add unit pills (`isActive && sellingPrice > 0`), multi-tab local `Nota`, automatic wholesale tier pricing (`Grosir` badge), manual Open Price & discount, mobile **`Uang Diterima` & `Kembalian`** quick-cash calculator, Receipt Preview modal (`58mm`/`80mm`), `POST /api/print` + non-blocking `POST /api/wa-log`, and `PrinterInterventionModal` (`Cetak Ulang`, `Bersihkan Antrean`, `paperNearEnd`).
- **Two List → Detail Flows (Rubric #4):**
  1. `Produk` tab → **Detail Produk** (`/produk/[id]`): search, category filter, 5 sort modes; *read-only* with `costPrice` hidden for `kasir`; Add/Edit/Soft-Delete + 30-day Trash Bin (`admin`/`owner`, online-only).
  2. `Pesanan Aktif` tab → **Detail Pesanan** (`/pesanan/[tabId]`): locally persisted held tabs (`items.length > 0`), itemized wholesale breakdown, local rename, `Lanjutkan di Kasir`, and delete confirmation.
- **Pengaturan, Profile/About (Rubric #5) & Owner Sub-Pages:** Account card, Logout confirmation, Health/Sync telemetry, **Profil Toko & Tentang Aplikasi** (all roles), plus Owner-only sub-pages: Store Profile & Logo (`PUT /api/settings` preserving `receiptSections`), basic Printer/Receipt config + Test Print, User Accounts CRUD/Password Reset (`/api/users/**`), and Categories/Units CRUD + Migration + Trash (`/api/categories/**`, `/api/units/**`).

**Should have (v1.x after validation):**
- Complete transaction locally without printing + WhatsApp/OS Share digital receipt summary.
- Camera barcode scanner (`expo-camera`) feeding existing search state.
- "Add N more for Wholesale Tier" cart upsell hint.

**Defer (v2+ / Anti-features for v1):**
- Server-synced order history or stock deduction (no PostgreSQL tables/columns exist in `Apps_Toko_Rejeki`).
- Direct phone Bluetooth ESC/POS thermal printing (server `/api/print` handles v1).
- Full mobile drag-and-drop `ReceiptSectionBuilder` (low ROI on 360px screens; preserve web-authored `receiptSections` on mobile).
- Offline master-data mutation queues or silent edits to `Apps_Toko_Rejeki`.

### Architecture Approach

The mobile client implements a **4-Layer Local-First Architecture** (`src/app/` thin Expo Router routes → `src/context/` & `src/store/` + `src/domain/` pure math → `src/db/` & `src/sync/` SQLite WAL + mutex → `src/services/api/` typed HTTP client) so POS reads, cart operations, and held tabs never block on network latency. Catalog documents are stored in a hybrid relational-document SQLite schema (indexed scalar columns for fast search/sort alongside JSON columns for `unitConversions` and `wholesaleTiers`), while `src/domain/` ports web `pricing.ts`, `receiptLayout.ts`, and `format.ts` verbatim to guarantee identical Rupiah math and 32/48-column receipt wrapping. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the directory layout and sequence flows.

**Major components:**
1. **Root & Nested Protected Routers (`src/app/`):** Root `<Stack.Protected>` splits `(auth)` from `(app)`, keyed by `user.id:user.role` so account switches clear stale navigation history; `produk/` and `pengaturan/` nested `<Stack>` layouts protect CRUD/Owner routes while keeping all 4 bottom tabs visible.
2. **AuthContext, SystemStatusContext & SyncEngineContext:** Hydrate `SecureStore` auth immediately at boot, poll `/api/health` (10s) and `/api/sync/delta` (5s) only while `AppState === "active"` and online, serialize sync writes via an in-process async mutex (`syncMutex.ts`), and emit `catalogEvents` only after SQLite transactions commit.
3. **Local Persistence (`expo-sqlite` + `expo-sqlite/kv-store` + `expo-secure-store`):** Separates catalog/settings/audit (`products`, `categories`, `units`, `sync_meta`, `sync_audit`), synchronous multi-tab carts (`POSCartStore`), and sensitive compact auth/config strings (`SecureStore`).
4. **Domain & API Service Layers (`src/domain/`, `src/services/api/`):** Isolate cookie/baseURL injection, normalize raw `GET /api/products/[id]` shapes, and enforce `orderValidation.ts` integer Rupiah tolerances before printing.

### Critical Pitfalls

Direct inspection of `Apps_Toko_Rejeki/apps/src/**` and Expo SDK 58 runtime constraints surfaced five high-impact failure modes (see [PITFALLS.md](./PITFALLS.md) for all 9 pitfalls and the recovery checklist):

1. **`httpOnly` `pos_session` Cookie Persistence & `401`/`403`/`503` Misclassification:** Android `ForwardingCookieHandler` flushes cookies asynchronously and Expo Go restricts native cookie managers; meanwhile `sec-fetch-site` middleware blocks Expo Web cross-origin `POST`s (`403`). **Avoidance:** Run a Phase 1 physical-device cold-kill Auth Spike testing `expo/fetch` (`getSetCookie()` + `SecureStore` `Cookie` header with `credentials: "omit"`) vs `EXPO_PUBLIC_USE_RN_FETCH=1`; test APIs on Emulator/device (never Expo Web); only wipe session on `401` or `/api/auth/me` `403`, never on feature `403` or `503`. Escalate to user for Bearer opt-in fallback if physical Android drops cookies.
2. **Expo Go Masking Cleartext LAN HTTP & iOS ATS Failures:** Standalone/Dev APKs block `http://192.168.x.x:3000` by default on Android 9+ and iOS 14+ even though Expo Go allows it. **Avoidance:** Configure `expo-build-properties` (`usesCleartextTraffic: true`) + iOS `NSAllowsLocalNetworking: true` and `NSLocalNetworkUsageDescription` in `app.config.ts` from Day 1, and make `serverBaseUrl` editable on Login and Pengaturan.
3. **Wholesale Tier, Custom Price, `GET /api/products/[id]` Drift & WA Log Bugs:** `GET /api/products/[id]` omits `formatProductRow` (missing `unitName`, `prices`, `baseUnit`), `POSCartContext` overwrites manual custom prices on `+1`, `whatsapp.ts` fails `new Date(localeString)` (`Invalid Date`), and firing `/api/wa-log` before `/api/print` duplicates logs on printer retry. **Avoidance:** Run a canonical client `normalizeProduct()` everywhere, track explicit `isCustomPrice` on cart rows, enforce integer Rupiah math matching `orderValidation.ts`, pass ISO-8601 `date` to `/api/wa-log`, and fire `/api/wa-log` once only after `/api/print` returns `success === true`.
4. **`POST /api/print` Returning HTTP `200` on Printer Failure & Stale `settings` Override:** Printer errors (`PAPER_EMPTY`, `COVER_OPEN`, `PRINTER_OFFLINE`) return HTTP `200` with `success: false`, pre-login `/api/settings` omits `printerPaperWidth`/`receiptSections`, and `PUT /api/settings` erases `receiptSections` if omitted. **Avoidance:** Branch strictly on `data.success === true` before closing `OrderTab`; cache full `StoreSettings` only when authenticated; omit `settings` on online `/api/print` calls (15–20s timeout); and read-merge-write full `StoreSettings` on Owner edits.
5. **Delta Sync Clock Skew, Hard-Delete Ghosts, `SQLITE_BUSY` & List Jank:** Passing phone `Date.now()` skips PC edits; `DELETE /api/products/trash` leaves no tombstone until Full Sync; unserialized sync + cart writes trigger `database is locked`; and `FlatList` + `localeCompare` janks above 500 SKUs. **Avoidance:** Always pass server-returned `server_time` + persistent `client_id` UUID, keep 10:00 WIB & >48h Full Sync, configure SQLite `WAL` + `busy_timeout = 5000` + `syncMutex`, and use `@shopify/flash-list` v2 + memoized primitive cart props + SQLite `ORDER BY`/`Intl.Collator`.

---

## Implications for Roadmap

Research points directly to a **5-phase sequential build order** driven by runtime verification gates (Auth/LAN transport first, local SQLite/sync layer second, core Kasir POS third, List→Detail modules fourth, and Pengaturan/Owner administration fifth):

### Phase 1: Foundation, Velocity Blue Theme & Auth/LAN Transport Spike
**Rationale:** Every downstream endpoint requires `pos_session` authentication and reachable LAN HTTP/HTTPS connectivity, while `STACK.md`, `ARCHITECTURE.md`, and `PITFALLS.md` identify an explicit risk divergence around `httpOnly` cookie survival in Expo Go vs `expo-dev-client`. Proving auth persistence and cleartext LAN networking first prevents costly mid-project rewrites.
**Delivers:** Bootable Expo SDK 58 + Expo Router + TypeScript project (`app.config.ts` with Android cleartext & iOS local networking config), Velocity Blue `theme/tokens.ts` + Google Fonts, shared `types/index.ts`, `serverConfigStore`, `apiClient.ts` (`401` vs feature `403` vs `503` handling), `AuthContext` + `expo-secure-store` snapshot, `(auth)/login.tsx` (with `429` throttle & Server URL sheet), and Root `<Stack.Protected>` 4-tab navigation shell keyed by `user.id:user.role`.
**Addresses:** Login/logout, offline session survival, Server URL configuration, 4-tab bottom bar, and base RBAC route protection.
**Uses:** Expo SDK `~58.0.25`, Expo Router `~58.0.31`, `expo/fetch`, `expo-secure-store`, `expo-font`, `expo-splash-screen`, `zod`, `expo-build-properties`.
**Avoids:** Pitfalls #1 (`httpOnly` cold-kill session drop), #2 (standalone APK cleartext/ATS blocks), #3 (Expo Go incompatible modules), #4 (`sec-fetch-site` Expo Web test trap), #6 (stale Back stack on user switch).

### Phase 2: Local SQLite Store, Catalog Sync Engine & Health Monitoring
**Rationale:** Both `Kasir` and `Produk` operate offline-first from the same local catalog, and `StoreSettings` must only be cached once authenticated. Building the SQLite WAL schema, sync mutex, and health/sync contexts creates the shared offline backbone for all POS screens.
**Delivers:** `db/sqlite.ts` (`WAL`, `busy_timeout = 5000`), `catalogRepo.ts`, `syncMetaRepo.ts` (including authenticated `StoreSettings` & base64 `storeLogo`), `syncMutex.ts`, `syncEngine.ts` (`/api/sync/full`, `/api/sync/delta` using `server_time` + `client_id` UUID, UTC+7-safe 10:00 WIB & >48h rules), `normalizeProduct()` client formatter, `SystemStatusContext` (`expo-network` + `AppState`-aware 10s `/api/health` poll), `SyncEngineContext` (5s foreground delta loop), `catalogEvents`, `useOfflineCatalog`, and the persistent Top Connection/Sync Status Header.
**Addresses:** Offline catalog availability, background/manual sync telemetry, and online/standby/offline DB guard state.
**Implements:** Hybrid Relational-Document SQLite Schema and Foreground-Aware Serialized Sync patterns.
**Avoids:** Pitfalls #7 (clock skew, hard-delete ghosts, `SQLITE_BUSY`, background battery drain), #9 (unauthenticated partial settings overwrite), and `SecureStore` 2KB overflow.

### Phase 3: Kasir Mobile POS, Pricing Engine & Thermal Checkout
**Rationale:** `Kasir` is the core daily workflow and carries the highest domain-logic density (multi-unit conversions, wholesale tiers, open-price collision fix, integer Rupiah validation, 58mm/80mm receipt wrapping, `Kembalian`, and hardware printer intervention). Completing `POSCartStore` here also unblocks Phase 4's `Pesanan Aktif` flow.
**Delivers:** Pure `src/domain/` modules (`pricing.ts` with `isCustomPrice`, `receiptLayout.ts`, `format.ts`), `POSCartStore` (`zustand` + synchronous `expo-sqlite/kv-store`), `Kasir` screen (`Katalog Produk` ↔ `Nota Aktif` toggle, docked cart summary bar, `@shopify/flash-list` v2 memoized cards with unit pills, omni-search + category chips, `keyboardShouldPersistTaps="handled"`, multi-tab `Nota`, inline qty/unit/price/discount, quick-cash `Kembalian` calculator), `ReceiptPreviewModal`, `POST /api/print` (15–20s timeout, `data.success` check), `PrinterInterventionModal` + `/api/print/flush`, and deduplicated ISO-dated `POST /api/wa-log`.
**Addresses:** Complete v1 Kasir parity, offline cart/tab persistence, and physical checkout/printing.
**Avoids:** Pitfalls #5 (custom price vs wholesale bug, `orderValidation.ts` mismatches, duplicate/invalid-date WA logs), #8 (`FlatList` scroll jank & list-wide cart re-renders), and #9 (HTTP `200` printer failure clearing cart).

### Phase 4: Produk & Pesanan Aktif (List → Detail Flows & Catalog CRUD)
**Rationale:** With `useOfflineCatalog` (Phase 2) and `POSCartStore` (Phase 3) complete, the two Rubric #4 List → Detail workflows and `admin`/`owner` catalog management integrate cleanly with minimal coupling.
**Delivers:** `produk/` nested `<Stack>` (`index.tsx` with search/filter/5-sort `FlashList`, `[id].tsx` **Detail Produk** read-only & `costPrice`-hidden for `kasir`, `<Stack.Protected>` `form.tsx` Add/Edit with base/derived units & wholesale tiers + `trash.tsx` 30-day Trash restore/purge gated on online DB) and `pesanan/` nested `<Stack>` (`index.tsx` **Pesanan Aktif** local list + tab badge, `[tabId].tsx` **Detail Pesanan** with wholesale savings, local rename, `Lanjutkan di Kasir`, and delete confirmation).
**Addresses:** Rubric Requirement #4 (2 complete List → Detail flows), `kasir` read-only `Produk` rule, and catalog CRUD parity.
**Avoids:** Pitfalls #5 (`GET /api/products/[id]` raw shape & `PUT` UUID regeneration), #6 (offline write errors & `kasir` privilege leak), and #7 (deleted catalog products crashing held orders).

### Phase 5: Pengaturan Hub, Profile/About & Owner Management Sub-Pages
**Rationale:** Settings, diagnostics, Profile/About (Rubric #5), and Owner-only administration (`PUT /api/settings`, `/api/users`, `/api/categories`, `/api/units`) depend on authenticated online guards, sync triggers, and stable core POS workflows, making them the cleanest final milestone phase.
**Delivers:** `pengaturan/` nested `<Stack>`: Overview Hub (`index.tsx` with Account card, Logout confirmation modal, Server URL editor, DB Health & Sync Telemetry with Delta/Full/Reset Cache triggers), **Profil Toko & Tentang Aplikasi** (`about.tsx` accessible to all roles — Rubric #5), and `<Stack.Protected guard={role === 'owner'}>` management screens (Store Profile & Logo editor preserving `receiptSections`, Printer & Receipt basic config + Test Print, Staff Account & Role Manager, and Category/Unit Manager with connected-product inspection, safe migration, and Trash bin).
**Addresses:** Rubric Requirements #3 (>= 5 screens) and #5 (Profile/About), full Owner management parity, and field sync recovery tools.
**Avoids:** Pitfalls #6 (`403` logout trap & stale role screens), #9 (`PUT /api/settings` erasing web `receiptSections`), and scope creep from porting desktop drag-and-drop `ReceiptSectionBuilder`.

### Phase Ordering Rationale

- **Dependency chain:** Auth + Server URL (Phase 1) → Authenticated Sync + Local SQLite Catalog (Phase 2) → Cart Store + Kasir Checkout (Phase 3) → Catalog Detail/CRUD & Held Order Detail/Resume (Phase 4) → Settings, Profile/About & Owner Admin (Phase 5).
- **Risk front-loading:** Auth cookie transport (`pos_session` across cold kills) and cleartext LAN networking are tested in Phase 1 before writing 15+ downstream screens.
- **Architectural clean seams:** `POSCartStore` is built once in Phase 3 and consumed directly by Phase 4 (`Pesanan Aktif`) and the Tab Bar badge; `useOfflineCatalog` is built once in Phase 2 and consumed by Phases 3, 4, and 5.

### Research Flags

Phases needing deeper investigation or formal design contracts during planning:
- **Phase 1 (CRITICAL — Technical Spike Required):** Validate `pos_session` `httpOnly` cookie persistence across cold kills on physical Android and iOS devices (comparing `expo/fetch` manual `Set-Cookie` capture vs `EXPO_PUBLIC_USE_RN_FETCH=1` + `credentials: "include"`). Decide early whether Expo Go holds up or whether to escalate to the user for an optional backend Bearer opt-in / switch to `expo-dev-client`. Also verify exact SDK 58 `expo-build-properties` config for Android cleartext & iOS ATS.
- **Phase 3 (UI Design Contract Recommended — `/gsd-ui-phase`):** High-density mobile POS touch ergonomics (`Katalog`/`Nota` toggle, numeric/Rupiah IME focus/blur editing without cursor jumps, iOS `InputAccessoryView` dismissal, `Kembalian` quick-cash sheet, and `ReceiptPreviewModal` + `PrinterInterventionModal` states) warrant a dedicated `UI-SPEC.md` matching `design.md` before coding.
- **Phase 5 (Targeted Package Decision):** Verify whether Owner Store Logo editing uploads new images from the mobile gallery (`expo-image-picker` + `expo-image-manipulator` sized to `<= 300x300` base64 — omitted from initial `STACK.md` install list) or only displays/clears the existing logo.

Phases with well-documented, directly inspected patterns (standard planning, minimal extra research):
- **Phase 2 (Local SQLite & Sync Engine):** Directly mirrors inspected `Apps_Toko_Rejeki/apps/src/lib/syncEngine.ts`, `offlineDb.ts`, and `api/sync/*` routes using standard `expo-sqlite` WAL transactions.
- **Phase 4 (Produk & Pesanan List → Detail & CRUD):** Standard Expo Router nested `<Stack>` patterns consuming Phase 2/3 primitives and directly inspected `/api/products/**` routes.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | **MEDIUM** | Core SDK 58 (`~58.0.25`) versions cross-verified against live npm registry and `expo@58.0.25/bundledNativeModules.json`; `httpOnly` `Set-Cookie` survival on physical Android/iOS Expo Go remains runtime-unverified until Phase 1 spike. |
| **Features** | **HIGH** | Directly derived from reading `Apps_Toko_Rejeki/apps/src/**`, `PROJECT.md`, `design.md`, and the 5 grading rubric criteria; zero ambiguity on v1 vs v1.x/v2 scope. |
| **Architecture** | **MEDIUM** | Backend endpoints, payloads, RBAC rules, and sync math are verified at HIGH confidence from source; client-side Expo Router `<Stack.Protected>` + `httpOnly` cookie jar behavior sits at MEDIUM until Phase 1 device testing. |
| **Pitfalls** | **MEDIUM** | Codebase-specific pitfalls (#4, #5, #6 backend rules, #7 sync rules, #9 print `HTTP 200` / settings quirks) are verified at HIGH confidence directly in source; RN/Android runtime pitfalls (#1, #2, #3, #8) are MEDIUM pending physical-device profiling. |

**Overall confidence:** **MEDIUM** (ready to plan and begin Phase 1 immediately, with Phase 1 structured around resolving the single remaining runtime unknown).

### Gaps to Address

- **Auth Transport Resolution (Phase 1 Gate):** Confirm on physical Android/iOS Expo Go whether `expo/fetch` (`getSetCookie()`) or RN `fetch` (`credentials: "include"`) survives force-kill + offline relaunch; if not, present a clear recommendation to the user for adding a small Bearer token opt-in to `Apps_Toko_Rejeki` (`apiAuth.ts` / `login/route.ts`) or adopting `expo-dev-client` + `@preeternal/react-native-cookie-manager`.
- **Store Logo Upload Libraries (Phase 5):** `FEATURES.md` specifies editing/compressing store logos (`<= 300x300` base64) in Owner Settings, while `STACK.md` did not yet include `expo-image-picker` / `expo-image-manipulator`. Confirm during Phase 5 planning and install SDK 58-aligned versions via `npx expo install` if mobile logo picking is kept in scope.
- **Paper Receipt `{kasir}` & `Kembalian` Printing (Phase 3 Scope Check):** `orderValidation.ts` already accepts `cashGiven` and `change`, and mobile Kasir calculates/displays them in Checkout + Receipt Preview; however, server `Apps_Toko_Rejeki/apps/src/lib/receiptLayout.ts` hardcodes `{kasir}` = `"Kasir Utama"` and does not print `cashGiven`/`change` on thermal paper. Clarify with the user during Phase 3 planning if paper printouts should remain as-is or trigger a communicated backend proposal.
- **Large-Catalog SQLite Query Benchmark (Phase 2/3):** Validate during Phase 2/3 profiling on a mid-range Android phone whether in-memory filtering of `useOfflineCatalog` with lazy JSON parsing suffices up to 2,000 SKUs or whether `SELECT ... WHERE` SQLite queries should be wired immediately.

---

## Sources

### Primary (HIGH confidence — direct codebase & manifest inspection)
- `C:/Users/adrie/Desktop/Project/Apps_Toko_Rejeki_Mobile/.planning/PROJECT.md` — Project scope, constraints, rubric criteria, and backend-change consultation rule.
- `C:/Users/adrie/Desktop/Project/Apps_Toko_Rejeki/design.md` — Velocity Blue color tokens, typography (`Hanken Grotesk`, `Inter`, `JetBrains Mono`), 8px grid, and 48px touch targets.
- `C:/Users/adrie/Desktop/Project/Apps_Toko_Rejeki/apps/src/**` — Directly inspected `middleware.ts`, `lib/apiAuth.ts`, `lib/session.ts`, `lib/syncEngine.ts`, `lib/offlineDb.ts`, `lib/productFormatter.ts`, `lib/orderValidation.ts`, `lib/receiptLayout.ts`, `lib/whatsapp.ts`, `lib/escpos.ts`, `context/AuthContext.tsx`, `context/POSCartContext.tsx`, `context/SyncEngineContext.tsx`, `context/SystemStatusContext.tsx`, and `app/api/**` routes.
- Live npm registry & `https://unpkg.com/expo@58.0.25/bundledNativeModules.json` (checked 2026-11-17) — Verified exact SDK 58 compatible package versions.

### Secondary (MEDIUM confidence — official docs & verified ecosystem patterns)
- Expo Official Documentation (`docs.expo.dev`) — Expo SDK 58 release notes (`react-native@0.88.1`, `react@19.3.0`, Strict TS, `InteractionManager` removal), Expo Router (`Stack.Protected`, nested Stacks inside Tabs), `expo-sqlite` (WAL mode, `withTransactionAsync`, `kv-store`), `expo-secure-store`, `expo-network`, `expo/fetch`, and `expo-build-properties`.
- Apple Developer & Android Network Security docs — iOS ATS (`NSAllowsLocalNetworking`, `NSLocalNetworkUsageDescription`) and Android 9+ `usesCleartextTraffic` behavior.
- Shopify `@shopify/flash-list` v2, NativeWind (`4.2.7` vs `5.0.0-rc.1`), Uniwind (`1.13.2`), and React Native `ForwardingCookieHandler` / `CookieManager` ecosystem references.

---
*Research completed: 2026-11-17*
*Ready for roadmap: yes*
