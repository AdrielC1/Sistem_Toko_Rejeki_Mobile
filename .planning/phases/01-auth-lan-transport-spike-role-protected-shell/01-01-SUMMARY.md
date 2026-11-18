---
phase: 01-auth-lan-transport-spike-role-protected-shell
plan: 01
subsystem: infra
tags: [expo-sdk-58, expo-router, typescript, eslint-config-expo, jest-expo, lan-cleartext, ats, supply-chain]

# Dependency graph
requires: []
provides:
  - Expo SDK 58 + Expo Router + TypeScript workspace scaffold alongside existing .planning and GEMINI.md
  - app.config.ts with userInterfaceStyle light, Android usesCleartextTraffic true, and iOS NSAllowsLocalNetworking true
  - Wave 0 ESLint flat config (eslint-config-expo/flat) and Jest harness (jest-expo + __tests__/setup.ts)
  - Clean placeholder root routes (src/app/_layout.tsx and src/app/index.tsx) with template explore/animated-icon removed
affects: [01-02, 01-03, 01-04, 01-05, 01-06, phase-2, phase-3]

# Actuals (#2632)
actuals:
  tokens: 2347
  tasks: 2
  commits: 0

# Tech tracking
tech-stack:
  added:
    - expo@~58.0.26
    - expo-router@~58.0.32
    - react@19.3.0
    - react-native@0.88.1
    - typescript@~6.0.3
    - expo-secure-store@~58.0.3
    - expo-sqlite@~58.0.18
    - expo-build-properties@~58.0.12
    - expo-network@~58.0.5
    - expo-font@~58.0.12
    - expo-splash-screen@~58.0.14
    - expo-status-bar@~58.0.5
    - expo-system-ui@~58.0.7
    - expo-haptics@~58.0.8
    - expo-clipboard@~58.0.4
    - react-native-svg@15.16.0
    - zustand@^5.1.0
    - lucide-react-native@^1.75.0
    - zod@^4.6.7
    - "@expo-google-fonts/hanken-grotesk@^0.4.3"
    - "@expo-google-fonts/inter@^0.4.2"
    - "@expo-google-fonts/jetbrains-mono@^0.4.1"
    - jest@^30.5.2
    - jest-expo@~58.0.15
    - "@types/jest@^30.0.0"
    - "@testing-library/react-native@^14.1.0"
    - eslint@^9.39.5
    - eslint-config-expo@~58.0.4
  patterns:
    - Dynamic Expo configuration in app.config.ts replacing app.json
    - TypeScript 6.0 strict configuration with explicit Jest types opt-in
    - Centralized Wave 0 Jest native module mocks with exported resetTestStorage() helper

key-files:
  created:
    - package.json
    - package-lock.json
    - app.config.ts
    - tsconfig.json
    - eslint.config.js
    - jest.config.js
    - __tests__/setup.ts
    - src/app/_layout.tsx
    - src/app/index.tsx
    - .gitignore
  modified: []

key-decisions:
  - "Task 1 (T-01-SC) blocking-human Package Legitimacy Gate received explicit user approval prior to running package installation."
  - "Removed template app.json (and auto-generated app.json from npx expo install) in favor of app.config.ts locking light mode, Android cleartext LAN traffic, and iOS NSAllowsLocalNetworking."
  - "Added compilerOptions.types: [\"jest\"] in tsconfig.json because TypeScript 6.0.3 does not auto-include global @types packages."
  - "Deleted unused expo-template-default components, hooks, constants, scripts/reset-project.js, and src/app/explore.tsx so zero broken template or /explore references remain."

patterns-established:
  - "Config ownership: all Expo plugins and native permissions reside in app.config.ts (never app.json)."
  - "Supply-chain audit: lockfile verified against node_modules/expo/bundledNativeModules.json with zero install scripts across direct vetted dependencies."
  - "Jest setup: __tests__/setup.ts uses mock*-prefixed in-memory maps for Jest hoisting compliance and exports resetTestStorage()."

requirements-completed:
  - AUTH-02
  - AUTH-03

coverage:
  - id: D1
    description: "Pre-install Package Legitimacy Gate (T-01-SC) approved by user and verified against bundledNativeModules.json and package-lock.json"
    requirement: "AUTH-03"
    verification:
      - kind: other
        ref: "User pre-approved Task 1 ('approved'); lockfile audit confirmed zero hasInstallScript entries across direct vetted packages and 31/31 bundledNativeModules.json version alignment"
        status: pass
    human_judgment: false
  - id: D2
    description: "Expo SDK 58 workspace bootstrapped with app.config.ts locking light mode, Android usesCleartextTraffic: true, and iOS NSAllowsLocalNetworking: true"
    requirement: "AUTH-02"
    verification:
      - kind: other
        ref: "npx expo config --type public --json && npx expo-doctor (20/20 checks passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Wave 0 ESLint flat config, Jest harness (__tests__/setup.ts), and clean placeholder src/app/_layout.tsx + src/app/index.tsx routes pass checks"
    requirement: "AUTH-03"
    verification:
      - kind: other
        ref: "npx tsc --noEmit && npx expo lint && npx jest --passWithNoTests"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-11-18
status: complete
---

# Phase 1 Plan 01: Expo SDK 58 Bootstrap & Wave 0 Harness Summary

**Bootstrapped Expo SDK 58 + Expo Router + TypeScript workspace with LAN cleartext/ATS networking in `app.config.ts`, Wave 0 ESLint/Jest harnesses, and verified clean placeholder routes**

## Performance

- **Duration:** 12 min
- **Started:** 2026-11-18T13:16:30Z
- **Completed:** 2026-11-18T13:28:53Z
- **Tasks:** 2 (Task 1 pre-approved by user; Task 2 executed completely)
- **Files modified:** 10 primary files created/configured (plus `assets/` and `.vscode/` from template)

## Accomplishments
- Honored the pre-approved `T-01-SC` Package Legitimacy Gate (`"approved"`) and verified in `package-lock.json` that zero direct vetted dependencies declare `hasInstallScript` / `postinstall` hooks, with all 31 Expo-managed modules matching `node_modules/expo/bundledNativeModules.json`.
- Scaffolded `expo-template-default@sdk-58` via staging directory `_tmp_expo` without disturbing `.git/`, `.planning/`, or `GEMINI.md`, removed `app.json`, `src/app/explore.tsx`, and unused template files, and configured `app.config.ts` with `userInterfaceStyle: "light"`, `backgroundColor: "#f9f9ff"`, Android `usesCleartextTraffic: true`, iOS `NSAllowsLocalNetworking: true` (`NSAllowsArbitraryLoads: false`), `NSLocalNetworkUsageDescription`, and `experiments.typedRoutes: true`.
- Configured Wave 0 tooling (`tsconfig.json`, `eslint.config.js` extending `eslint-config-expo/flat`, `jest.config.js` with `jest-expo`, and `__tests__/setup.ts` providing in-memory mocks + `resetTestStorage()`) plus clean placeholder `src/app/_layout.tsx` and `src/app/index.tsx` passing `tsc`, `expo lint`, `expo config --type public --json`, `expo-doctor` (20/20), and `jest --passWithNoTests`.

## Task Commits

Pending manual user commit (per user instruction).

## Files Created/Modified
- `package.json` - Renamed to `apps-toko-rejeki-mobile`, installed approved SDK 58 + Wave 0 packages, added `test`, `typecheck`, and `lint` scripts, removed `reset-project`.
- `package-lock.json` - Generated lockfile audited for `hasInstallScript` and `bundledNativeModules.json` alignment.
- `app.config.ts` - Expo SDK 58 configuration with light mode lock, Android `usesCleartextTraffic: true`, iOS `NSAllowsLocalNetworking: true` & `NSLocalNetworkUsageDescription`, and `typedRoutes: true`.
- `tsconfig.json` - Strict TypeScript extending `expo/tsconfig.base` with `"types": ["jest"]` and `@/*` -> `./src/*` path mapping.
- `eslint.config.js` - Flat ESLint v9 config extending `eslint-config-expo/flat` and ignoring `dist/*`.
- `jest.config.js` - Jest 30 configuration using `jest-expo` preset, `__tests__/setup.ts`, and `@/*` module mapper.
- `__tests__/setup.ts` - In-memory mocks for `expo-secure-store`, `expo-sqlite/kv-store`, `expo/fetch`, `expo-font`, `expo-splash-screen`, `expo-network`, `expo-haptics`, `react-native-safe-area-context`, and `resetTestStorage()`.
- `src/app/_layout.tsx` - Clean placeholder root `<Stack screenOptions={{ headerShown: false }} />` with `<StatusBar style="dark" />`.
- `src/app/index.tsx` - Clean Velocity Blue `#f9f9ff` placeholder screen rendering `"Toko Rejeki POS"`.
- `.gitignore` - Template ignores for `node_modules/`, `.expo/`, `dist/`, `/ios`, `/android`, etc.

## Decisions Made
- Added `"types": ["jest"]` to `tsconfig.json` `compilerOptions` because `typescript@6.0.3` disables implicit global `@types/*` discovery unless explicitly opted in.
- Removed the secondary `app.json` recreated by `npx expo install` so `app.config.ts` acts as the single authoritative Expo config source.
- Removed all unused template helpers (`src/components/*`, `src/constants/theme.ts`, `src/hooks/*`, `src/global.css`, `scripts/reset-project.js`) alongside `src/app/explore.tsx` because `app-tabs.tsx` and `app-tabs.web.tsx` contained direct `/explore` route references that would fail `typedRoutes` / lint checks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Explicit Jest types opt-in for TypeScript 6.0.3**
- **Found during:** Task 2 verification (`npx tsc --noEmit`)
- **Issue:** Initial `npx tsc --noEmit` failed with TS2304 (`Cannot find name 'jest'`) in `__tests__/setup.ts` because `typescript@~6.0.3` defaults `compilerOptions.types` to empty rather than loading all `@types/*` packages.
- **Fix:** Added `"types": ["jest"]` to `compilerOptions` in `tsconfig.json`.
- **Files modified:** `tsconfig.json`
- **Verification:** Re-ran `npx tsc --noEmit` (exit 0) and `npx expo lint` (exit 0).
- **Committed in:** Pending manual user commit (per user instruction)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for TypeScript 6.0 strict compilation of Jest harness and upcoming Wave 0 tests. No scope creep.

## Issues Encountered
- `npx expo install` automatically generated a partial `app.json` listing config plugins; removed `app.json` immediately so `app.config.ts` remains the sole Expo config without conflict.
- During `npm install`, npm 11 warned that transitive Metro file-watcher `@parcel/watcher@2.6.0` has an unapproved install script (`hasInstallScript: true`, blocked by npm allowScripts). Audited `package-lock.json`: the only other lockfile entry with `hasInstallScript` is optional macOS `fsevents@2.3.3`; zero direct vetted packages contain install scripts.
- Windows PowerShell 5.1 rejects `&&` chaining; commands were verified sequentially via `;` and exit-code checks.

## Verification Output Summary
- `npx tsc --noEmit` -> exit `0` (0 errors)
- `npx expo lint` -> exit `0` (0 violations)
- `npx expo config --type public --json` assertion -> exit `0` (`EXPO_CONFIG_CHECK=true`: `userInterfaceStyle: "light"`, `NSAllowsLocalNetworking: true`, `NSAllowsArbitraryLoads: false`, `android.usesCleartextTraffic: true`, `typedRoutes: true`)
- `npx expo-doctor` -> exit `0` (`Running 20 checks on your project... 20/20 checks passed. No issues detected!`)
- `npx jest --passWithNoTests` -> exit `0` (`No tests found, exiting with code 0`)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Expo SDK 58 workspace and Wave 0 test/lint harnesses are green and ready for Plan `01-02` (Wave 2: core auth types, `SecureStore`/`kv-store` adapters, `serverConfig.ts`, `cookieParser.ts`, `apiClient.ts`, `authApi.ts`, and unit test suites).
- No git commits were created; changes remain cleanly staged on disk for user commit.

## Self-Check: PASSED
- Verified files exist on disk: `package.json`, `package-lock.json`, `app.config.ts`, `tsconfig.json`, `eslint.config.js`, `jest.config.js`, `__tests__/setup.ts`, `src/app/_layout.tsx`, `src/app/index.tsx`, `.gitignore`.
- Verified `src/app/explore.tsx` does not exist and `GEMINI.md` + `.planning/` remain intact.
- Verified all automated checks passed after final edit (`tsc`, `expo lint`, `expo config`, `expo-doctor`, `jest --passWithNoTests`).

---
*Phase: 01-auth-lan-transport-spike-role-protected-shell*
*Completed: 2026-11-18*
