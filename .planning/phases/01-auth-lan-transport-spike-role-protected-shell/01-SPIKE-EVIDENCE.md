---
phase: "01-auth-lan-transport-spike-role-protected-shell"
plan: "06"
status: "approved"
created: "2026-11-18T21:15:00+07:00"
approved_at: "2026-11-18T22:18:07+07:00"
post_remediation_approved_at: "2026-11-19T07:52:24+07:00"
spike_gate: "D-05"
backend_repo: "Apps_Toko_Rejeki (apps_toko_rejeki / unmodified)"
---

# Phase 1 — Automated Pre-Flight & Cold-Kill Spike Evidence (`apps_toko_rejeki`)

## 1. Automated Pre-Flight Results (All Passed Prior to Device Spike)

Executed from `C:\Users\adrie\Desktop\Project\Apps_Toko_Rejeki_Mobile`:

| Check | Command | Exit | Result |
|-------|---------|------|--------|
| Full Jest Suite | `npx jest` | `0` | **7/7 suites passed, 41/41 tests passed** (`17.725 s`): `cookieParser.test.ts`, `serverConfig.test.ts`, `apiClient.test.ts`, `authContext.test.tsx`, `tabScreens.test.tsx`, `loginScreen.test.tsx`, `routingRbac.test.tsx` |
| TypeScript Strict Check | `npx tsc --noEmit` | `0` | **0 errors** (TypeScript `~6.0.3`) |
| Expo ESLint Flat Check | `npx expo lint` | `0` | **0 errors, 0 warnings** (`eslint-config-expo/flat`) |
| Expo Doctor | `npx expo-doctor` | `0` | **20/20 checks passed. No issues detected!** |
| Resolved Public Expo Config | `npx expo config --type public --json` assertion | `0` | `EXPO_CONFIG_PUBLIC_OK=true` — `userInterfaceStyle === "light"`, Android `usesCleartextTraffic === true` (`expo-build-properties`), iOS `NSAllowsLocalNetworking === true` (`NSAllowsArbitraryLoads: false`) |

## 2. Live LAN / Emulator Environment Readiness

- **Sibling Backend (`apps_toko_rejeki` / `Apps_Toko_Rejeki`):**
  - Repository status: **completely unmodified** (`git -C ../Apps_Toko_Rejeki status --short` empty).
  - Next.js server started read-only via `npm --prefix ..\Apps_Toko_Rejeki\apps run start` (`next start -H 0.0.0.0 -p 3000`).
  - Pre-login reachability verified:
    - `http://localhost:3000/api/settings` -> **HTTP `200`** (`{"success":true,"offline":true,"data":{"storeName":"Toko Rejeki",...}}`)
    - `http://192.168.0.199:3000/api/settings` -> **HTTP `200`**
  - **Database Note for Live Login (`POST /api/auth/login`):** `Apps_Toko_Rejeki` is configured to connect to PostgreSQL on `localhost:5433` (`docker/docker-compose.yml` service `db` / container `pos_supabase_db`). At pre-flight check time, Docker Desktop daemon was not running, so `/api/settings` returned `"offline": true`. Start Docker Desktop (and container `pos_supabase_db` on port `5433`) before testing Step 2 (`POST /api/auth/login`) on device/emulator.
- **Network & URL Coordinates:**
  - **Host PC Wi-Fi LAN IPv4 (`Wi-Fi 2`):** `192.168.0.199`
  - **API Server URL for Physical Phone (Expo Go on same Wi-Fi):** `http://192.168.0.199:3000`
  - **API Server URL for Android Emulator (`Medium_Phone` AVD detected):** `http://10.0.2.2:3000`
  - **Expo Metro LAN Dev Server:** `http://localhost:8081` -> `METRO_STATUS: 200 packager-status:running` (`exp://192.168.0.199:8081`)

## 3. Physical Device / Emulator Cold-Kill Spike Sign-Off (`D-05` Gate)

- **Status:** ✅ **APPROVED by user (`2026-11-18T22:18:07+07:00`) + Post-Remediation Sign-Off (`2026-11-19T07:52:24+07:00`)** — User confirmed pre-fix spike checks passed (`"okeh saya cek sih udh aman semua approved"`) and confirmed Phase 1 complete & safe post-remediation (`"oke sekarang karena sudah aman di fase 1, gas lanjutkan fase 2"`), clearing post-fix sanity and `E1`–`E4` visual checks.
- **Verified Targets (`D-05` passed without backend changes):**
  1. `AUTH-02` Pre-login `GET /api/settings` reachability (`Server Terhubung`) & login branding update (`storeName` / `storeLogo`) + collapsed/long URL truncation (`E2`).
  2. `AUTH-01` & `D-03` Blank `400`, wrong password `401`, throttle `429` 1-second countdown (`Tunggu {N} Detik...`), Eye/EyeOff toggle, and `__DEV__` `[AuthSpike] pos_session capture: { captured: true, length: >0 }` (zero token bytes logged).
  3. `AUTH-03` OS Force-Kill + Airplane Mode relaunch → direct entry into 4-tab shell (`Kasir`) without redirect to Login.
  4. `AUTH-03` & `D-04` / `D-05` Reconnect Wi-Fi + Force-Kill + relaunch → online `GET /api/auth/me` returns `200 OK` (NOT `401`).
  5. `AUTH-04`, `NAV-01`, `NAV-04` Fail-safe Airplane-Mode `Keluar dari Akun`, `owner` vs `kasir` (`Mode Baca Saja (Kasir)`, zero `costPrice`/mutations), hardware Back stack reset, and 1-line bottom tab labels under light mode (`E1`–`E4` visual backstops).
