# Pitfalls Research

**Domain:** Expo React Native + TypeScript POS mobile client integrating with an existing Next.js App Router API (`Apps Toko Rejeki`) using `httpOnly` session cookies, `sec-fetch-site` CSRF checks, LAN HTTP hosting, offline SQLite catalog delta sync, and server-dispatched thermal printing.
**Researched:** 2026-11-17
**Confidence:** HIGH for backend/codebase contract pitfalls (verified directly against `../Apps_Toko_Rejeki/apps/src/**`); MEDIUM for Expo/React Native runtime behaviors (cross-checked via web search against official Expo, React Native, Shopify FlashList, and platform networking docs; requires Phase 1 on-device spike verification).

---

## Critical Pitfalls

### Pitfall 1: `httpOnly` Cookie (`pos_session`) Persistence Loss on Android & Inability to Hydrate Offline Auth State

**What goes wrong:**
The app logs in successfully against `POST /api/auth/login`, receives `Set-Cookie: pos_session=...; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`, and works during the active session. However, after force-closing or restarting the app on Android (or after clearing/switching the server base URL), the user appears "logged in" from cached UI state while every API call (`/api/auth/me`, `/api/sync/delta`, `/api/print`, `/api/products`) unexpectedly fails with `401 Belum login atau sesi telah berakhir`, or the session is silently dropped on cold launch.

**Why it happens:**
1. **Cookie-only auth contract on backend (`apps/src/lib/apiAuth.ts` & `apps/src/app/api/auth/login/route.ts`):** `getSessionUser()` reads ONLY `cookieStore.get(SESSION_COOKIE_NAME)?.value` (`pos_session`). `POST /api/auth/login` does **not** return the signed token in the JSON response body (`{ success, data: sessionPayload, message }`), and `apiAuth.ts` has no `Authorization: Bearer` fallback.
2. **Android `ForwardingCookieHandler` asynchronous disk flush:** React Native's Android `fetch` delegates to `OkHttp` + `ForwardingCookieHandler` → `android.webkit.CookieManager`. Unlike iOS `NSHTTPCookieStorage` (which reliably persists non-session cookies to disk), Android `CookieManager` flushes writes asynchronously to its SQLite store. If the OS or cashier kills the app before `CookieManager.flush()` completes, the `pos_session` cookie is lost while a separate JS snapshot (`SecureStore`/`AsyncStorage`) still remembers the user.
3. **JS cannot reliably read `httpOnly` `Set-Cookie` in Expo Go:** `response.headers.get("set-cookie")` can drop/merge headers or be stripped by remote debuggers, while native cookie-jar modules (`@react-native-cookies/cookies` / `@preeternal/react-native-cookie-manager`) are **unsupported in Expo Go** (`NativeModule` crash).
4. **Scheme/Domain `Secure` mismatch:** `login/route.ts` sets `secure: isHttps` based on `x-forwarded-proto` / `req.url`. Switching between a Cloudflare Tunnel (`https://...`) and LAN IP (`http://192.168.x.x:3000`) isolates or rejects cookies (`Secure` cookies are never sent over plain `http://`).

**How to avoid:**
- **Phase 1 Spike (Zero Backend Change):** Verify `fetch(..., { credentials: "include" })` cookie persistence across **kill + cold restart** on physical Android and iOS devices immediately in Phase 1. Keep `AuthContext` state explicitly aware of three distinct auth states: `online-authenticated`, `offline-cached` (network/DB unreachable — preserve snapshot), and `cookie-expired` (HTTP `401` received — clear snapshot and redirect to Login).
- **If Android drops `pos_session` across cold kills or switching URLs is common:**
  - *Mobile-only path (requires exiting Expo Go):* Move to a **Development Build (`expo-dev-client`)** and use `@preeternal/react-native-cookie-manager` (or native `CookieManager.getInstance().flush()`) after login plus re-hydration on boot.
  - **Backend Tweak Flag (Requires User Approval):** Ask the user before touching `Apps_Toko_Rejeki` to add a small, backwards-compatible Bearer token path: e.g., when login sends a mobile client header (or `X-Client-Type: mobile`), `POST /api/auth/login` also returns `{ token }` in JSON and `getSessionUser()` in `apps/src/lib/apiAuth.ts` checks `Authorization: Bearer <token>` if the `pos_session` cookie is absent. Mobile then stores that HMAC-signed token in `expo-secure-store` (survives cold restarts on both Android and iOS even inside Expo Go) and removes all cookie-jar fragility.

**Warning signs:**
- App boots into `(tabs)/kasir` from cached profile, then `SyncEngine` immediately displays `HTTP 401` on `/api/sync/delta`.
- Works in iOS Simulator / Expo Go during hot reload, fails only after swiping app away on physical Android.
- Switching between store LAN IP and Cloudflare Tunnel silently leaves the user unauthenticated.

**Phase to address:**
Phase 1 (Foundation, Networking & Auth Spike — validate before building POS screens).

---

### Pitfall 2: Expo Go Allows Cleartext LAN HTTP (`192.168.x.x`), Masking Release/Dev-Build Network Failures

**What goes wrong:**
All API calls to the store PC (`http://192.168.x.x:3000`) work seamlessly during development in **Expo Go**. Later, when creating the first **Development Build (`expo-dev-client`)** or standalone **Android APK / iOS TestFlight build**, every single request instantly throws `TypeError: Network request failed` on Android or silently fails on iOS.

**Why it happens:**
1. **Android 9+ (API 28+) blocks cleartext HTTP by default:** Expo Go's precompiled APK sets cleartext permissions globally so Metro and local servers work. Standalone Android builds (including Development Builds and Release APKs) set `usesCleartextTraffic=false`, blocking `http://192.168.x.x:3000` with `CLEARTEXT communication to ... not permitted by network security policy`.
2. **iOS App Transport Security (ATS) & Local Network Privacy (iOS 14+):** Physical iOS devices treat `localhost` as the iPhone itself and require BOTH `NSAppTransportSecurity: { NSAllowsLocalNetworking: true }` and `NSLocalNetworkUsageDescription` in `ios.infoPlist` to reach `http://192.168.x.x:3000`. If omitted, iOS blocks local LAN sockets or crashes/denies without a permission prompt.
3. **Hardcoded LAN IP:** Store router DHCP leases can reassign the server PC's `192.168.x.x` IP; baking `EXPO_PUBLIC_API_URL` strictly at build time bricks installed APKs.

**How to avoid:**
- Configure `expo-build-properties` in `app.json` / `app.config.ts` from Day 1:
  - `android: { usesCleartextTraffic: true }` (note: if later distributed publicly outside the store, scope cleartext to local RFC1918 subnets via a custom Android `network_security_config.xml` rather than global cleartext).
  - `ios.infoPlist`: set `NSLocalNetworkUsageDescription` and `NSAppTransportSecurity: { NSAllowsArbitraryLoads: false, NSAllowsLocalNetworking: true }`.
- Remember that editing `app.json` native plugins does **not** update an already-built dev/release binary — run `npx expo prebuild` and rebuild the native client whenever these keys change.
- Store the Server Base URL in persistent local storage (`AsyncStorage`/`SecureStore`) with an editable connection setting on both the **Login** screen and **Pengaturan** screen, and validate connectivity with `GET /api/settings` (public fields) or `/api/health` before saving.

**Warning signs:**
- App works in Expo Go over Wi-Fi, fails immediately on first `eas build` / `npx expo run:android` APK install.
- iOS physical device hangs or rejects LAN IP while iOS Simulator on `http://localhost:3000` works.

**Phase to address:**
Phase 1 (Project Scaffold, Build Config & Networking Layer).

---

### Pitfall 3: Choosing Non-Expo-Go Native Modules Prematurely (`NetInfo`, `MMKV`, Cookie Manager)

**What goes wrong:**
Installing popular React Native ecosystem packages such as `@react-native-community/netinfo`, `react-native-mmkv`, `react-native-encrypted-storage`, or `@react-native-cookies/cookies` causes immediate runtime crashes (`NativeModule is null` / `Invariant Violation`) if the team or evaluator tests with **Expo Go**, halting development until a full native build pipeline (Android SDK / EAS Build) is set up.

**Why it happens:**
Expo Go bundles only the curated native modules in the Expo SDK. Libraries requiring custom C++/JSI bindings (`MMKV`) or unbundled native bridges (`RNCNetInfo`, `CookieManager`) cannot run in Expo Go. Even `expo-secure-store` throws in Expo Go if called with biometric gating (`requireAuthentication: true`), because Expo Go lacks `NSFaceIDUsageDescription`.

**How to avoid:**
- Standardize on Expo Go-compatible SDK modules unless a verified blocker forces a Development Build:
  - Offline catalog & held orders DB: `expo-sqlite` (supported in Expo Go & Dev Builds)
  - Network connectivity & listener: `expo-network` (`getNetworkStateAsync`, `addNetworkStateListener`, `useNetworkState`) instead of `@react-native-community/netinfo`
  - Sensitive storage (token/session backup): `expo-secure-store` **without** `requireAuthentication: true`
  - Large lists: `@shopify/flash-list` **v2** (pure JS rewrite requiring React Native New Architecture, which works inside modern Expo Go — do not install v1 if targeting Expo Go with New Arch)
  - Tactile feedback: `expo-haptics`
  - Thermal printing: call backend `POST /api/print` over HTTP (do **not** install Bluetooth native ESC/POS libraries for v1).
- Decide upfront in Phase 1 whether Android APK / `expo-dev-client` is required (e.g., if Android `ForwardingCookieHandler` proves unreliable without `@preeternal/react-native-cookie-manager`) and document the exact run workflow so evaluators don't open a Dev-Build-only project in Expo Go.

**Warning signs:**
- `Cannot read property '...' of null` / `NativeModule.RNCNetInfo is null` on launch in Expo Go.
- `expo-secure-store` fails on iOS Expo Go with missing FaceID plist usage description.

**Phase to address:**
Phase 1 (Project Scaffold & Dependency Selection).

---

### Pitfall 4: `sec-fetch-site` Middleware & Missing CORS Headers Break Expo Web / Proxy Testing

**What goes wrong:**
Running `npx expo start --web` (in browser at `localhost:8081`) or testing through a local reverse proxy against the Next.js server (`localhost:3000` or `192.168.x.x:3000`) causes every `POST`/`PUT`/`DELETE` (`/api/auth/login`, `/api/print`, `/api/products`) to fail with CORS errors or `403 {"success":false,"error":"Permintaan lintas-situs ditolak."}`.

**Why it happens:**
1. `apps/src/middleware.ts` (lines 11–21) inspects `req.headers.get("sec-fetch-site")` on mutating `/api` requests and returns HTTP `403` whenever the header is present and is not `"same-origin"` or `"none"`.
2. `apps/next.config.ts` does **not** emit `Access-Control-Allow-Origin` or `Access-Control-Allow-Credentials` headers (only `allowedDevOrigins` for Next.js dev assets).
3. Native React Native `fetch` (OkHttp / NSURLSession) does **not** send `sec-fetch-site` and does **not** enforce browser CORS, so native mobile works — while browser-based Expo Web triggers `Sec-Fetch-Site: same-site` / `cross-site` and fails preflight!

**How to avoid:**
- **Never use Expo Web (`localhost:8081`) as an API integration test harness** against `localhost:3000`, and do **not** ask to disable `sec-fetch-site` CSRF protection or open wildcard CORS on the production Next.js server just to make Expo Web work.
- Always test API integration on **Android Emulator (`http://10.0.2.2:3000` or LAN IP)**, **iOS Simulator**, or **physical phone over store Wi-Fi**.
- Ensure the mobile HTTP client never manually attaches a spoofed `Sec-Fetch-Site` or browser `Origin` header on native requests.

**Warning signs:**
- `403 Permintaan lintas-situs ditolak.` on login/print only when running in a browser or WebView.
- Preflight `OPTIONS` failures when debugging with Chrome/Expo Web.

**Phase to address:**
Phase 1 (API Client Setup & Test Harness).

---

### Pitfall 5: Wholesale Tier, Manual Price Edit, and `GET /api/products/[id]` Shape Drift vs `orderValidation.ts` & `receiptLayout.ts`

**What goes wrong:**
1. Wholesale prices silently fail to apply when opening or editing a product fetched via `GET /api/products/[id]`.
2. Manually overriding a price in the cart gets silently wiped when tapping `+1` quantity, or leaves `isWholesaleApplied = true` stale so the receipt prints an erroneous `"Hemat Grosir"` discount line.
3. Thermal printouts (`POST /api/print`) fail with HTTP `400` or WA logs (`POST /api/wa-log`) print `Invalid Date` / duplicate messages.

**Why it happens (directly observed in backend/web files):**
1. **`GET /api/products/[id]` does NOT call `formatProductRow`!** Unlike `GET /api/products` and `GET /api/sync/full|delta`, `apps/src/app/api/products/[id]/route.ts` (line 82) returns `rawProducts[0]` directly. In that raw SQL output, `unitConversions[i].wholesaleTiers` objects **lack `unitName`**, and the root `prices`, `baseUnit`, and `wholesaleTiers` fields are **missing**! Meanwhile `POSCartContext.tsx` (line 109) filters wholesale tiers using `wt.unitName === unitName && qty >= wt.minQty` — which evaluates to `false` whenever `unitName` is `undefined`.
2. **Custom price vs wholesale tier collision in `POSCartContext.tsx`:** Look at lines 203–218 vs 305–349 in `POSCartContext.tsx`: `updateCartItemQty` and `updateCartItemQtyDirect` call `calculateEffectiveUnitPrice(product, item.unit, newQty)` *without* preserving `manualPrice`, overwriting cashier-entered custom prices on `+1`! And `updateCartItemPrice` updates `unitPrice` *without* updating `isWholesaleApplied`.
3. **Strict arithmetic check in `apps/src/lib/orderValidation.ts`:** `validateOrder` (lines 66, 106–112) rejects `/api/print` with HTTP `400` if:
   - `Math.abs(total - qty * unitPrice) > 1`
   - `Math.abs(subtotal - sumTotals) > items.length`
   - `Math.abs(grandTotal - Math.max(0, subtotal - discount)) > 1`
   - `items.length > 200` or `qty <= 0` or `name` is empty after stripping ASCII control chars (`0x00–0x1f`, `0x7f`).
4. **Wholesale receipt discount rules (`receiptLayout.ts` lines 59–69):** `getWholesaleItemDiscount` only shows `"Hemat Grosir"` when `isWholesale === true` AND finite `originalPrice > unitPrice`.
5. **Locale date parsing bug in `whatsapp.ts`:** `POSCartContext` sets `date: new Date().toLocaleString("id-ID")` (e.g., `"17/11/2026, 17.20.00"`), and `whatsapp.ts` (`formatReceiptDate`) attempts `new Date(dateStr)` — which returns `Invalid Date` for `DD/MM/YYYY` strings in V8/Hermes!
6. **Hardcoded `{kasir}` & ignored `cashGiven`/`change` on server print:** `apps/src/lib/receiptLayout.ts` (line 148) hardcodes `.replace(/\{kasir\}/g, "Kasir Utama")` and does not render `cashGiven`/`change` on paper.
7. **Duplicate `/api/wa-log` on print retry (`kasir/page.tsx` lines 189–216):** Web fires `/api/wa-log` *before* `/api/print` resolves, guarded only by `!isRetry`. If `/api/print` fails (`COVER_OPEN`/`PAPER_EMPTY`) and the cashier closes the modal, fixes the order, and prints again, `/api/wa-log` fires twice!

**How to avoid:**
- Write a **single canonical client normalizer** (mirroring `formatProductRow` in `apps/src/lib/productFormatter.ts`) and run it on EVERY product payload (especially `GET /api/products/[id]`), OR hydrate product detail views from the local SQLite catalog first and refresh in the background.
- Track an explicit `isCustomPrice: boolean` flag on mobile `CartItem` state:
  - When cashier manually edits price: set `isCustomPrice = true` and `isWholesaleApplied = false`.
  - When qty changes: if `isCustomPrice` is true, keep custom price (or explicitly show a badge/reset option if a wholesale tier would now be cheaper — don't silently overwrite without clarity, and never leave `isWholesaleApplied = true` stale!).
  - Compute `total = Math.round(unitPrice * qty)` (using integer Rupiah) and `subtotal = items.reduce((s, it) => s + it.total, 0)` and `grandTotal = Math.max(0, subtotal - discount)` so `orderValidation.ts` checks pass 100% of the time.
- Compute `cashGiven` and `change` locally for the mobile checkout / receipt preview UI (clearly communicating to the user whether thermal printouts also need `cashGiven`/`change` or dynamic `{kasir}` — **Backend Tweak Flag (Requires User Approval)** if they want those printed on paper by `receiptLayout.ts`).
- Fire `/api/wa-log` **only after** `/api/print` returns `data.success === true` (or deduplicate by `orderId` / `waLogSent` flag on the active tab so retries never double-send).
- Send `date: new Date().toISOString()` to `/api/wa-log` (so `formatReceiptDate` parses it cleanly on the server) and format a clean `DD/MM/YYYY HH:mm` string for `order.date` in `/api/print` (`receiptLayout.ts` displays `order.date` verbatim).
- **Backend Tweak Flag (Requires User Approval):** Recommend informing the user that `GET /api/products/[id]` currently omits `formatProductRow()` (easy 1-line fix on backend if needed, though mobile normalization avoids requiring it).

**Warning signs:**
- Wholesale badge shows `"Grosir"` on a manually raised price, or printed receipt says `"Hemat Grosir (- Rp 0)"`.
- `/api/print` returns `400 "Total item tidak sesuai dengan harga x jumlah."`.
- WhatsApp log receives duplicate receipts when printer runs out of paper.

**Phase to address:**
Phase 3 (Kasir POS Cart, Pricing Engine, Receipt Preview & Print/WA Dispatch) and Phase 4 (Produk Detail & CRUD).

---

### Pitfall 6: Offline Auth Snapshot vs Stale Role Permissions, `403` Misclassification & Offline Write Traps

**What goes wrong:**
1. A user with `owner` or `admin` role is deactivated, has their password reset, or is demoted to `kasir` on the store PC. On mobile (which was offline or backgrounded), they still see Owner Settings or Product Edit buttons.
2. Worse: a `kasir` navigates to an Owner-protected screen/endpoint, receives HTTP `403` (`"Akses ditolak: peran Anda tidak memiliki izin"` from `apiAuth.ts` line 89), and a global interceptor copied from web `AuthContext.tsx` (line 46: `if (res.status === 401 || res.status === 403)`) **logs the cashier out and wipes their local session**!
3. After `owner` logs out and `kasir` logs in on the same shared handheld device, pressing the Android hardware Back button pops back into an `owner` screen still sitting in React Navigation's stack.

**Why it happens:**
- `apps/src/app/api/auth/me/route.ts` returns `403` when `!freshUser.is_active`, whereas `requireApiAuth` (`apiAuth.ts`) returns `401` for deactivated/password-changed accounts and `403` for role mismatches (`!roles.includes(user.role)`). Treating all `403` responses identically breaks role-guarded endpoints.
- Also note a subtle quirk in `me/route.ts` line 56: `if (isOffline || !freshUser)` returns `200 { offline: true, data: session }` even if a user row was hard-deleted while the DB is online (`!freshUser`), whereas other endpoints using `requireApiAuth` return `401`.
- In Expo Router, hiding tabs/routes with `href: null` only removes the tab button — routes remain reachable via deep link or `router.push()`, and switching users without resetting/keying the navigator leaves stale screens/state in memory.
- Product/Category/Unit/User mutations (`POST`/`PUT`/`DELETE`) require the Primary PostgreSQL DB (`apps/src/lib/db.ts` lines 118–131 throw immediately when offline or on standby).

**How to avoid:**
- Differentiate HTTP error handling strictly:
  - `401` from **any** endpoint → token invalid, password changed (`pw_stamp` mismatch), or account deactivated → clear session & route to Login.
  - `403` from `/api/auth/me` → account deactivated → clear session & route to Login.
  - `403` from feature endpoints (`/api/users`, `/api/settings`, `/api/products` write) → role downgraded/insufficient → **do NOT log out**; refresh `/api/auth/me`, update cached `role`, show an access-denied alert, and redirect back to `Kasir`.
  - `503` or `TypeError: Network request failed` → server/DB offline → preserve local auth snapshot & operate in Offline Mode.
- Use **Expo Router Protected Routes** (`<Stack.Protected guard={...}>` / `<Tabs.Protected>`) AND enforce in-screen role checks + `key={user?.id}:${user?.role}` on the authenticated navigator tree so user switches or role downgrades tear down stale navigation history completely.
- Gate all CRUD actions (`Produk` create/edit/delete/trash, `Pengaturan` owner CRUD) behind an explicit online/DB-ready guard (checking `/api/health` `isReadOnly` / `offline` state) with clear Indonesian feedback, mirroring `produk/page.tsx` lines 102–108.

**Warning signs:**
- Pressing Android Back after switching accounts reveals the previous user's screen or cached `useState`.
- A `kasir` gets kicked out to Login instead of seeing an "Akses ditolak" toast when hitting an owner endpoint.

**Phase to address:**
Phase 1 (Auth & RBAC Navigation Architecture) and Phase 4–5 (Produk & Pengaturan Role Guards).

---

### Pitfall 7: Delta Sync Clock Skew, Hard-Delete Ghost Products & `expo-sqlite` Write Locks (`SQLITE_BUSY`)

**What goes wrong:**
1. Products edited on the PC never appear in mobile's 5-second delta sync.
2. Products permanently emptied from Trash (`DELETE /api/products/trash`) remain visible on mobile forever and cause `404` or confusion.
3. App crashes randomly with `Error: database is locked` (`SQLITE_BUSY`) during 5-second delta polling while the cashier searches or saves a cart tab.

**Why it happens:**
1. **Phone clock skew vs `server_time`:** `GET /api/sync/delta` filters PostgreSQL rows via `updated_at > ${sinceIso} OR deleted_at > ${sinceIso}`. If the mobile app passes `new Date().toISOString()` from the device's clock (which can drift minutes or hours ahead of the store PC), `sinceIso` jumps past real server edits and skips them forever.
2. **Hard-deleted Trash items leave no tombstone:** `DELETE /api/products/trash` executes `DELETE FROM products ...` (hard delete). `sync/delta` cannot detect missing rows; only `/api/sync/full` replaces the full active catalog (the web client forces Full Sync every day at 10:00 WIB and whenever `last_full_sync_at` is older than **48 hours** — `TWO_DAYS_MS` in `syncEngine.ts`).
3. **`isActive === false` arrives inside `deleted[]`:** `sync/delta/route.ts` (line 139) puts both `deletedAt` AND `isActive === false` into `products.deleted[]`. If an item inside an existing local held order (`Pesanan Aktif`) is deactivated/deleted, `catalogLookup(productId)` returns `undefined`.
4. **Concurrent SQLite transactions:** `expo-sqlite` permits only one SQLite writer at a time. Firing `PRAGMA` defaults (rollback journal, 0ms busy timeout), executing row-by-row `runAsync` loops without a transaction, running `fetch()` inside `withTransactionAsync()`, or letting 5-second polling collide with held-order writes triggers `database is locked`.
5. **Multiple phones colliding on `client_id`:** `sync/delta` & `sync/full` default `client_id` to `"pos-terminal-client"` if omitted, corrupting per-device audit trails in `sync_checkpoints`.

**How to avoid:**
- Always store and send the exact `server_time` returned by `/api/sync/full` and `/api/sync/delta` as `last_delta_sync_at` — **never** compute `since` from `Date.now()`.
- Mirror `syncEngine.ts` recovery rules:
  - Force `executeFullSync` if SQLite catalog is empty, `last_full_sync_at` is missing, or `Date.now() - lastFullSync > 48 hours` (and run daily scheduled full sync when online).
  - Persist a unique per-install `client_id` UUID (`mobile-<uuid>`) in `SecureStore`/`AsyncStorage`.
- Configure `expo-sqlite` once in a sequential singleton boot initializer **before** any sync/UI queries run:
  ```sql
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA synchronous = NORMAL;
  ```
- Perform ALL network `fetch()` and JSON parsing **before** opening `db.withTransactionAsync(...)`, wrap bulk upserts/deletes in a single tight transaction, and guard sync cycles with an in-memory JS async mutex (mirroring `syncMutex.ts`) so overlapping polls or manual sync clicks serialize cleanly.
- Pause 5-second delta polling whenever `AppState.currentState !== "active"`, `!networkState.isConnected`, or server health reports `offline` (`syncEngineContext.tsx` pattern), and trigger an immediate delta check on `AppState` foreground resume.
- Snapshot item display fields (`name`, `unit`, `unitPrice`, `originalPrice`, `isWholesaleApplied`) inside held `OrderTab` items so deactivated/deleted products don't crash `Pesanan Aktif` rendering, and handle `product === undefined` gracefully in cart unit/qty controls.

**Warning signs:**
- Edited prices on PC don't show on mobile until manual Full Sync.
- `SQLITE_BUSY` / `database is locked` errors in Logcat/Metro during rapid cart taps + background sync.
- Handheld battery drains fast when screen is locked due to background `setInterval` polling.

**Phase to address:**
Phase 2 (Local SQLite Storage & Sync Engine).

---

### Pitfall 8: `FlatList` Jank, Un-memoized Cart Re-renders & Hermes `localeCompare` Lag on Large Catalogs

**What goes wrong:**
Scrolling the `Kasir` or `Produk` catalog feels sluggish, drops frames, or shows blank white gaps during fast flings once the store catalog grows beyond 300–1,000+ products; tapping `+` on a unit pill button lags 200–500ms, or typing in the search bar stutters on budget Android store devices.

**Why it happens:**
1. **Variable card heights with nested unit buttons:** Each Kasir product card renders a variable number of unit pills (`Pcs`, `Dus`, `Slop`, `Karton`, etc.) in a wrapped row (`flexWrap: 'wrap'`), preventing fixed `getItemLayout` optimization in `FlatList`. Beyond ~200–300 complex cards, `FlatList` unmounts/remounts rows aggressively, causing white blank spaces and JS thread stalls.
2. **Whole-catalog re-renders on cart updates:** In `kasir/page.tsx` (line 611), cards compute `activeTab.items.filter(c => c.productId === item.id)`. If a React Native list item subscribes to the full `tabs` / `activeTab.items` context directly, **every `+1` tap re-renders every mounted card** in the list!
3. **JS `localeCompare` sorting on every keystroke (`useOfflineCatalog.ts` line 83):** Sorting thousands of items in JS on every keystroke using `a.name.localeCompare(b.name, "id")` incurs heavy ICU bridge overhead per comparison on Hermes.

**How to avoid:**
- Use **`@shopify/flash-list` v2** (pure JS, New Architecture compatible, no `estimatedItemSize` required, works in Expo Go and Dev Builds) instead of `FlatList` for `Kasir` and `Produk` catalogs.
- Decouple catalog rows from full `tabs` state: pass only a derived primitive or per-product quantity map / `extraData` key + `React.memo` on product card components so tapping `+1` on Product A only re-renders Product A's card.
- Offload search/category filtering and sorting to **indexed SQLite queries** (`WHERE is_active = 1`, `LOWER(name) LIKE ? OR LOWER(sku) LIKE ? OR barcode LIKE ?`, `ORDER BY name COLLATE NOCASE`) OR pre-sort once at sync time / use a pre-instantiated `new Intl.Collator("id-ID")` (never `a.localeCompare(b, "id")` inside `.sort()` on every keystroke), plus debounce search input (150–200ms) while keeping instant submit on keyboard Enter/Return.
- Add `keyboardShouldPersistTaps="handled"` on catalog & cart lists so cashiers never have to tap twice to add an item while the search keyboard is open.

**Warning signs:**
- Typing in the search bar drops characters on mid-range Android devices with 1,000+ products seeded.
- Scrolling quickly shows empty white rectangles before product cards pop in.
- Tapping `+` on a product lags proportionally to catalog size.

**Phase to address:**
Phase 3 (Kasir Catalog & Cart UX) and Phase 4 (Produk Catalog List).

---

### Pitfall 9: Thermal Print Diagnostics (`HTTP 200` on Hardware Failure) & Stale Client `settings` Override

**What goes wrong:**
1. The thermal printer is out of paper (`PAPER_EMPTY`), cover is open (`COVER_OPEN`), or offline (`PRINTER_OFFLINE`), yet the mobile app closes/clears the cashier's active cart tab thinking the print succeeded!
2. Or the owner updates receipt layout/paper width (`58mm` ↔ `80mm`) on the PC, yet mobile continues printing the old receipt format.
3. Or a short client `fetch` timeout cancels mid-print, triggering cashier retries that print duplicate receipts.

**Why it happens (verified in `apps/src/app/api/print/route.ts` & `apps/src/lib/escpos.ts`):**
1. **`/api/print` returns HTTP `200` even on printer errors:** Lines 137–145 return `NextResponse.json({ success: false, error, diagnostic: { errorCode, errorMessage } })` with **default status `200`**! Only `data.success === true` confirms printing succeeded.
2. **Client `settings` shadows DB `receipt_templates`:** Lines 79–103 of `print/route.ts` check `sanitizePrintSettings(clientSettings)` *first*; ONLY if `clientSettings` is undefined/falsy does the server query `receipt_templates` from PostgreSQL! Sending a stale or partial `settings` object from mobile overrides the live template on the server.
3. **Unauthenticated `GET /api/settings` returns stripped settings:** Lines 78–90 of `apps/src/app/api/settings/route.ts` return ONLY `{ storeName, storeAddress, storePhone, storeLogo, previewReceiptBeforePrint: false }` when `!session` — omitting `printerPaperWidth`, `receiptSections`, and `receiptItemConfig`. Caching that pre-login response as full `StoreSettings` breaks Receipt Preview and print layout!
4. **Slow server-side Windows Spooler / TCP timeouts:** `escpos.ts` uses `SOCKET_TIMEOUT_MS = 3500` + `STALL_TIMEOUT_MS = 4000` and spawns `windows-print.ps1` for USB printers; printing 3x copies routinely takes 4–8 seconds.

**How to avoid:**
- Always inspect `json.success === true` (never just `res.ok`) before closing/clearing the active `OrderTab`; on `json.success === false`, display a Printer Intervention modal matching `PrinterInterventionModal.tsx` (`errorCode`, Retry, Flush Queue via `POST /api/print/flush`).
- When online (or only cache after authenticated fetch), refresh `StoreSettings` from `GET /api/settings` **only when authenticated** (and verify `printerPaperWidth` / `receiptSections` are present before overwriting cache). When calling `POST /api/print`, either omit `settings` when online so the server uses the authoritative `receipt_templates` row, or keep `settings` synced on every `executeFullSync` / app focus; only send cached `settings` as offline-DB fallback!
- Set an explicit `AbortController` timeout of at least **15–20 seconds** on `POST /api/print` and disable the print button while `printStatus === "printing"` to prevent duplicate prints.
- Reuse the pure layout engine logic from `apps/src/lib/receiptLayout.ts` verbatim (`buildReceiptLayout`, `getWidthForSize`, `getWholesaleItemDiscount`) in a shared/ported TypeScript module on mobile so **Receipt Preview matches physical ESC/POS line-wrapping character-for-character** (32 cols @ 58mm, 48 cols @ 80mm).

**Warning signs:**
- Cart tab clears even when printer LED is blinking red (`PAPER_EMPTY`).
- Mobile receipt preview wraps text differently than the printed paper.
- `GET /api/settings` cached before login causes `previewReceiptBeforePrint` to stay `false` forever.

**Phase to address:**
Phase 3 (Receipt Preview, `/api/print` Dispatch & Intervention Modal) and Phase 2 (Authenticated Settings Cache).

---

## Technical Debt Patterns

Shortcuts that seem tempting during MVP mobile delivery but create severe POS operational debt.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing held `Pesanan Aktif` tabs only in React Context / memory | Fast to prototype cart | Android OS kills backgrounded apps routinely; cashiers lose unpaid multi-tab customer orders mid-shift | **Never** — persist `OrderTab[]` to SQLite/AsyncStorage immediately on every change |
| Hardcoding `http://192.168.1.x:3000` in `.env` only | Saves building a Server URL config UI | Any router DHCP IP change or switch to Cloudflare Tunnel breaks installed APKs without rebuild | **Never** for LAN POS — provide editable Server URL on Login + Pengaturan |
| Copying `formatRp` / `date` formatting casually without matching `receiptLayout.ts` | Quicker UI components | Preview totals/wrapping diverge from ESC/POS output or fail `orderValidation.ts` `MONEY_TOLERANCE = 1` check | **Never** — port `receiptLayout.ts` and integer Rupiah calculations cleanly |
| Relying on `useEffect(..., [])` + `setInterval` without `AppState` cleanup | Simple polling loop | Background battery drain, phantom 401/network errors while pocketed, memory leaks | **Never** |
| Global `res.status === 401 \|\| res.status === 403` → logout | Mirrors web `AuthContext.tsx` | A single `kasir` tap hitting an `owner` endpoint returns `403` and wipes the cashier's valid session | **Never** — separate `401` (re-auth) from `403` (permission denied) |
| Keeping all catalog filtering in JS `Array.filter` + `localeCompare` | Mirrors `useOfflineCatalog.ts` directly | Typing lag & frame drops on low-end Android devices once catalog > 1,000 SKUs | Acceptable **only** for `< 300` SKUs; switch to `Intl.Collator` or SQLite `LIKE`/`ORDER BY` before scaling |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `POST /api/auth/login` | Expecting `{ token }` in JSON body or calling `res.headers.get("set-cookie")` in Expo Go | Backend sets `httpOnly` `pos_session` cookie only (`apiAuth.ts` reads cookie only). Test `credentials: "include"` cold-restart persistence on Android in Phase 1; ask user if Bearer fallback is needed |
| `GET /api/auth/me` | Treating `200 { offline: true }` as an error or treating network timeout as `401` logout | `200` with `offline: true` means DB is offline and token signature passed — keep user logged in offline. Only `401` (or `403` specifically on `/api/auth/me`) clears local session |
| `GET /api/products/[id]` | Feeding its response directly into wholesale/unit selectors expecting `formatProductRow` output | `products/[id]/route.ts` returns raw SQL rows **without** `formatProductRow` (`prices`, `baseUnit`, and `wt.unitName` are missing!). Normalize client-side or read from SQLite |
| `PUT /api/products/[id]` | Assuming `productUnitId` or `wholesaleTier.id` remains stable after editing a product | Backend soft-deletes old `product_units` & `wholesale_tiers` and inserts brand-new UUIDs on every `PUT`. Always refresh/re-sync after mutation |
| `GET /api/sync/delta` | Passing device `new Date().toISOString()` as `since` or omitting `client_id` | Always pass the previous `server_time` from server responses and a persistent device UUID `client_id`; run Full Sync if gap > 48h to purge hard-deleted Trash items |
| `GET /api/settings` | Fetching and caching settings before login completes | Unauthenticated requests return stripped public fields without `printerPaperWidth` or `receiptSections`. Fetch & cache `StoreSettings` only after login succeeds |
| `POST /api/print` | Checking only `response.ok` (HTTP 200) | Hardware errors (`PAPER_EMPTY`, `COVER_OPEN`, `PRINTER_OFFLINE`) return HTTP `200` with `success: false` and `diagnostic.errorCode`. Always branch on `data.success` |
| `POST /api/wa-log` | Firing `/api/wa-log` before `/api/print` succeeds or passing `toLocaleString("id-ID")` date | Fire `/api/wa-log` only once per finalized/printed order (not on retry) and pass ISO-8601 `date` so `formatReceiptDate` in `whatsapp.ts` parses cleanly |
| `POST /api/print/flush` | Assuming it works for network TCP printers or clears mobile queue | Inspects/flushes Windows Spooler / server print queue on the PC (`apps/src/app/api/print/flush/route.ts`); keep behind printer intervention retry flow |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Rendering large catalogs with `FlatList` + variable unit rows | White gaps during fling scroll, jittery scrollbar, delayed row taps | Use `@shopify/flash-list` v2 + `React.memo` row components with `keyExtractor={(item) => item.id}` | > 250–300 products with multi-unit wrap pills |
| Subscribing every catalog row to entire `tabs` / `activeTab.items` array | Tapping `+` freezes UI for 150–400ms as every card re-renders | Pass primitive `qtyInCart` or memoized per-product selector map via `extraData` only for changed counts | > 100 visible/buffered items in active cart |
| Sorting with `a.name.localeCompare(b.name, "id")` per keystroke | Keyboard lags and drops taps while typing search queries on Android Hermes | Use SQLite `ORDER BY name COLLATE NOCASE` or cache one `new Intl.Collator("id-ID")` + debounce search 150ms | > 500–1,000 products on budget Android CPUs |
| Row-by-row SQLite `runAsync` inserts during `executeFullSync` | Initial bootstrap sync takes 10–30 seconds and triggers `SQLITE_BUSY` | Batch all upserts/deletes inside a single `db.withTransactionAsync()` with `WAL` + `busy_timeout = 5000` | > 300 products on initial sync or bulk category migration |
| Continuous 5s polling when backgrounded or offline | Rapid phone battery drain, log spam, OS background network kill | Bind polling loop to `AppState === "active"` + `expo-network` online + server health not offline | Any full 8–12 hour store shift |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing `password` in `AsyncStorage` / `SecureStore` to "auto-relogin" silently on `401` | Plaintext/recoverable staff passwords exposed if handheld is lost; bypasses Owner password revocation (`pw_stamp`) | **Never** store user passwords; rely strictly on `pos_session` cookie (or signed session token if backend tweak approved) and prompt login on `401` |
| Relying on `Tabs.Protected` / `href: null` alone without screen-level role checks | Demoted `kasir` or deep link opens `Produk` edit/trash or `Pengaturan` owner sub-screens | Enforce role checks inside every restricted screen (`admin`/`owner` for CRUD, `owner` for settings/users/categories/units) and key navigator by `user.id + user.role` |
| Enabling `NSAllowsArbitraryLoads: true` or leaving `usesCleartextTraffic: true` unchecked on public internet builds | Exposes credentials if staff connect to external Wi-Fi or triggers App Store review rejection | Use `NSAllowsLocalNetworking: true` on iOS; scope Android cleartext to store LAN subnets if distributing outside internal APK |
| Sending unvalidated/sanitized text or floating-point totals to `/api/print` | `orderValidation.ts` strips control bytes or rejects print (`400`); miscalculated `originalPrice` prints wrong customer savings | Round all Rupiah math to integers, sanitize/trim item names, and let `orderValidation.ts` remain authoritative |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Missing `keyboardShouldPersistTaps="handled"` on `Kasir` catalog/cart | Cashier searches SKU, taps `+` to add product, first tap only closes keyboard — item not added! | Set `keyboardShouldPersistTaps="handled"` on `FlashList`/`ScrollView` and keep quick-add buttons tappable while keyboard is open |
| Formatting Rupiah `10.000` inside `TextInput` `onChangeText` carelessly | Android IME cursor jumps to the end or duplicates dots when editing price/potongan | Edit raw numeric string on focus (`onFocus`), format `"Rp 10.000"` cleanly on blur (`onBlur`), and provide a clear/select-all UX matching `CartItemQtyInput` |
| `TextInput` numeric keyboard without dismiss button on iOS | Cashier enters custom price or cash received and cannot dismiss number pad to tap `Cetak Struk` | Add an `InputAccessoryView` "Selesai" toolbar on iOS and `onPress` outside-dismiss wrapper |
| Clearing `activeTab` before user confirms physical receipt came out | Printer jams or runs out of paper (`PAPER_EMPTY`), cart vanishes, cashier forgets items to ring up | Close/reset `OrderTab` **only** after `/api/print` returns `data.success === true`; preserve `pendingOrderPayload` for Retry |
| Letting cashiers expect PC `Pesanan Aktif` tabs to appear on mobile | Confusion during rush hours when a held order on PC isn't on the handheld | Clearly label `Pesanan Aktif` as *"Tersimpan lokal di perangkat ini"* (`PROJECT.md` Out of Scope) and provide a dedicated Order Detail view before resuming in Kasir |
| Unclear offline vs DB-offline feedback on `Produk` CRUD | Cashier/Admin tries editing a product when store PC PostgreSQL is off and gets cryptic error | Show clear banner from `/api/health` / sync status (`Mode Offline — Katalog Lokal Aktif, Edit Produk Nonaktif`) and disable write buttons gracefully |

---

## "Looks Done But Isn't" Checklist

- [ ] **Android Cold-Restart Cookie Persistence:** Tested logging in on a physical Android device, force-swiping the app closed immediately AND after 10 seconds, reopening, and confirming `/api/auth/me` + `/api/sync/delta` succeed without `401` (not just tested via Expo fast-refresh).
- [ ] **Standalone APK Cleartext LAN Check:** Tested an actual `expo-dev-client` or release APK (not just Expo Go) against `http://192.168.x.x:3000` on Android 9+ and physical iOS device (verifying local network permission prompt).
- [ ] **Offline Boot + Held Orders Persistence:** Put phone in Airplane Mode, force-close app, reopen — user stays in offline session, SQLite catalog searches instantaneously, and existing `Pesanan Aktif` multi-tabs survive intact.
- [ ] **401 vs 403 vs 503 Behavior:** Verified `kasir` hitting an `owner` endpoint (`403`) does **not** log out, DB-offline `503` keeps offline session, and `owner` changing password on PC (`401` on next request) forces mobile re-login.
- [ ] **Delta Sync Clock Skew & Hard Delete:** Temporarily set mobile device clock +1 hour ahead of server PC, edited a product on PC, and verified mobile still receives the delta (proving `server_time` is used, not `Date.now()`). Emptied Trash on PC and verified Full Sync cleans ghost item.
- [ ] **Wholesale + Custom Price + Print Parity:** Tested item reaching wholesale `minQty` -> qty back down -> manual price override -> `+1` qty -> `Preview Struk` vs actual thermal printout via `/api/print` (both 58mm and 80mm) -> `WA Log` payload (`Invalid Date` check + no duplicate WA logs on printer `PAPER_EMPTY` retry).
- [ ] **Large Catalog Scroll & Search Benchmark:** Seeded 1,500+ products with multi-unit conversions and scrolled/searched rapidly on a mid-range Android phone without frame drops or `database is locked` errors.
- [ ] **5 Rubric Verification Gates:** Confirmed Bottom Nav 4 tabs (`Kasir`, `Produk`, `Pesanan`, `Pengaturan`), >= 5 screens, 2 real list → detail flows (`Produk` → Detail Produk and `Pesanan Aktif` → Detail Pesanan), and `Profile/About` inside `Pengaturan`.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Android drops `httpOnly` `pos_session` cookie across cold restarts | **MEDIUM** | Option A: Switch from Expo Go to `expo-dev-client` and flush/backup cookie via `@preeternal/react-native-cookie-manager` + `SecureStore`. Option B (requires user approval for small backend tweak): Add Bearer token opt-in in `login/route.ts` + `apiAuth.ts` and store token in `expo-secure-store` |
| Standalone APK fails with cleartext error on `http://192.168.x.x` | **LOW** | Add `expo-build-properties` (`usesCleartextTraffic: true`) + iOS `NSAllowsLocalNetworking` / `NSLocalNetworkUsageDescription`, run `npx expo prebuild --clean`, and rebuild native binary |
| SQLite `database is locked` or corrupt delta state on devices | **LOW** | Enable `WAL` + `busy_timeout = 5000`, wrap batch writes in single `withTransactionAsync`, add JS sync mutex, and trigger a recovery `executeFullSync` from `Pengaturan` |
| `GET /api/products/[id]` missing `unitName`/`prices` breaks Edit/Wholesale | **LOW** | Run client-side `normalizeProduct()` matching `formatProductRow` (and optionally ask user to add `formatProductRow(rawProducts[0])` in `products/[id]/route.ts`) |
| `FlatList` frame drops on growing catalog | **LOW–MEDIUM** | Swap `FlatList` → `@shopify/flash-list` v2, memoize product cards with primitive props, and move filtering/sorting to indexed SQLite queries or `Intl.Collator` |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| #1 `httpOnly` cookie persistence on Android/iOS & offline auth state | Phase 1: Auth, Networking & App Shell | Cold-kill Android & iOS test after login + offline launch test + `401`/`403`/`503` matrix test |
| #2 Cleartext LAN HTTP (`192.168.x.x`) & iOS Local Network Privacy | Phase 1: Project Config & Networking | Build/run `expo-dev-client` or release APK against `http://<PC-IP>:3000`; verify runtime server URL config |
| #3 Expo Go native module incompatibilities | Phase 1: Dependencies & Config | Verify all chosen libs (`expo-sqlite`, `expo-network`, `expo-secure-store`, `flash-list` v2) boot in target runtime (Expo Go or Dev Build) |
| #4 `sec-fetch-site` & CORS trap on Expo Web | Phase 1: Networking & Dev Workflow | Run API integration suites on Android Emulator / physical device, never Expo Web cross-origin |
| #6 Offline auth vs stale RBAC & `403` logout trap | Phase 1 & Phase 4–5: RBAC Guards | Test role downgrade/password change on PC while mobile online/offline; test Back stack after user switch |
| #7 Delta sync clock skew, 48h Full Sync, `SQLITE_BUSY` locks | Phase 2: Local SQLite & Sync Engine | Test with skewed phone clock, simulate concurrent delta poll + cart write, verify `WAL` + `server_time` checkpointing |
| #8 `FlatList`/FlashList scroll jank & Hermes sorting lag | Phase 3 & Phase 4: Kasir & Produk UI | Profile 1,500-item catalog scroll & live search input on physical Android device |
| #5 Wholesale tier, custom price, `products/[id]` shape, `orderValidation` & WA date | Phase 3 & Phase 4: POS Cart & Product CRUD | Unit tests for pricing parity + `validateOrder` math + `/api/print` & `/api/wa-log` retry/date tests |
| #9 Thermal print HTTP 200 error payload & stale `settings` override | Phase 3: Checkout, Receipt Preview & Print | Test `?simulate=PAPER_EMPTY` / `COVER_OPEN` (dev) and verify cart stays intact & intervention modal opens |

---

## Sources

### Primary Codebase Sources (HIGH Confidence — verified directly in `../Apps_Toko_Rejeki/apps/`)
- `apps/src/middleware.ts` (`sec-fetch-site` API CSRF enforcement & route RBAC)
- `apps/src/lib/apiAuth.ts` & `apps/src/lib/session.ts` (`pos_session` cookie-only auth, `sessionStamp`, offline DB fallback, `401` vs `403`)
- `apps/src/app/api/auth/login/route.ts`, `me/route.ts`, `logout/route.ts` (cookie flags `httpOnly`, `sameSite: "lax"`, `secure: isHttps`, cleared cookie responses)
- `apps/src/app/api/sync/delta/route.ts`, `sync/full/route.ts`, `apps/src/lib/syncEngine.ts` (`server_time`, `TWO_DAYS_MS`, `isActive === false` in `deleted[]`, `sync_checkpoints`)
- `apps/src/lib/productFormatter.ts` & `apps/src/app/api/products/[id]/route.ts` (`GET /api/products/[id]` omitting `formatProductRow`, `PUT` soft-deleting & recreating `product_units`/`wholesale_tiers`)
- `apps/src/context/POSCartContext.tsx`, `apps/src/app/(pos)/kasir/page.tsx`, `apps/src/lib/orderValidation.ts`, `apps/src/lib/receiptLayout.ts`, `apps/src/lib/whatsapp.ts` (wholesale tiers, custom price bugs, `MONEY_TOLERANCE = 1`, hardcoded `{kasir}`, `/api/wa-log` retry & `new Date(localeString)` bug)
- `apps/src/app/api/print/route.ts`, `apps/src/lib/escpos.ts`, `apps/src/app/api/settings/route.ts` (HTTP 200 on printer errors, `clientSettings` override, unauthenticated `/api/settings` partial payload)
- `apps/src/lib/db.ts` & `apps/next.config.ts` (`sql.begin` fast-fail when DB offline, `allowedDevOrigins`)

### Ecosystem & Documentation Sources (MEDIUM Confidence — cross-checked across official docs & community findings)
- Expo `expo-build-properties` & Android cleartext (`usesCleartextTraffic`) — [docs.expo.dev](https://docs.expo.dev)
- Apple App Transport Security (`NSAllowsLocalNetworking`) & Local Network Privacy (`NSLocalNetworkUsageDescription`) — [developer.apple.com](https://developer.apple.com)
- Expo Router Protected Routes (`Stack.Protected`, `Tabs.Protected`, `href: null` caveats) — [docs.expo.dev/router](https://docs.expo.dev/router)
- `expo-sqlite` WAL mode, `busy_timeout`, `withTransactionAsync` concurrency — [docs.expo.dev](https://docs.expo.dev)
- `expo-network` vs `@react-native-community/netinfo` & Expo Go native module boundaries — [docs.expo.dev](https://docs.expo.dev)
- React Native `ForwardingCookieHandler`, Android `android.webkit.CookieManager.flush()`, and iOS `NSHTTPCookieStorage` persistence behavior — React Native core / Android WebKit docs
- Shopify `@shopify/flash-list` v2 New Architecture / Expo Go compatibility — [shopify.github.io/flash-list](https://shopify.github.io/flash-list)
- React Native Hermes `Intl` / `Asia/Jakarta` timezone & `Intl.Collator` performance — [reactnative.dev](https://reactnative.dev)

---
*Pitfalls research for: Apps Toko Rejeki Mobile (Expo React Native POS client + Next.js App Router API)*
*Researched: 2026-11-17*
