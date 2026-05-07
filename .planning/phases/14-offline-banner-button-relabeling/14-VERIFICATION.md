---
phase: 14-offline-banner-button-relabeling
verified: 2026-05-07T11:05:00Z
status: human_needed
score: 8/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Trigger offline via DevTools Network > Offline: after ~15s amber banner appears with two copy lines"
    expected: "Banner shows 'Server connection lost — working offline.' and the second copy line. Approve button shows 'Copy to clipboard — approve'; outer deny shows 'Copy to clipboard — deny'; inner submit shows 'Copy to clipboard'"
    why_human: "Requires a running binary with DevTools; cannot verify polling and rendering behaviour programmatically without a browser"
  - test: "Toggle back online: banner disappears after ~5s, labels revert"
    expected: "Banner gone; buttons revert to approveLabel/denyLabel/'Submit Denial'"
    why_human: "Requires a running binary and real network state toggling"
  - test: "Theme toggle while offline: banner palette switches correctly"
    expected: "Dark: #f59e0b bg / #0f1117 text; Light: #d97706 bg / #0f172a text"
    why_human: "Requires a running browser with theme-toggle interaction"
  - test: "Keyboard tab order: banner is not in the tab stop sequence"
    expected: "Tab key skips the offline banner entirely"
    why_human: "Requires keyboard navigation in a running browser"
  - test: "Banner visible across ALL appState values (loading, error, reviewing, confirmed)"
    expected: "Banner appears regardless of which appState is active — never blocked by an appState conditional"
    why_human: "Confirmed by code inspection (banner is a sibling of both appState branches at line 1110), but runtime validation against all four states requires a running app"
---

# Phase 14: Offline Banner & Button Relabeling — Verification Report

**Phase Goal:** When connectivity is offline, users see a persistent amber banner and submit buttons are relabeled to "Copy to clipboard" — these are pure rendering changes with no submit-path logic; the banner clears automatically when the server recovers
**Verified:** 2026-05-07T11:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | An amber non-dismissable banner reading "Server connection lost — working offline" (or equivalent) appears between the page header and the review columns when connectivity is offline | ✓ VERIFIED | `OfflineBanner` function at App.tsx:160 contains `role="status"`, `background: 'var(--color-banner-bg)'`, renders `OFFLINE_BANNER_LINE_1` and `OFFLINE_BANNER_LINE_2`. Mount point at App.tsx:1110 is a direct sibling of `<PageHeader />` and before both appState branches |
| 2 | The banner is not shown and cannot be triggered while the server is reachable | ? UNCERTAIN | Code renders `{connectivity === 'offline' && <OfflineBanner />}` — banner only mounts when `connectivity === 'offline'`; conditional is correct. Cannot verify the live online/offline toggle without a running binary |
| 3 | Submit buttons are relabeled to "Copy to clipboard" when offline and return to their normal labels when the server recovers | ✓ VERIFIED | App.tsx:1332 `{approveButtonLabel(connectivity, approveLabel)}`, App.tsx:1370 `{denyButtonLabel(connectivity, denyLabel)}`, App.tsx:1453 `{submitDenialButtonLabel(connectivity)}`. All three call pure helpers that return offline constants when `status === 'offline'`. Tests 6-15 in offlineLabels.test.ts cover all online/offline branches — 39/39 tests pass |
| 4 | The banner disappears when a successful ping restores connectivity | ? UNCERTAIN | Banner mount is `{connectivity === 'offline' && <OfflineBanner />}` — will unmount immediately when `useHeartbeat()` returns `'online'`. Correctness of that state transition depends on Phase 13's `useHeartbeat`, not on Phase 14 code. Cannot verify the transition without a running binary |
| 5 | The offline state is never represented as a blocking error — the annotation UI remains fully interactive | ✓ VERIFIED | No `pointer-events: none` added anywhere in Phase 14. `OfflineBanner` has no interactive elements, no overlay CSS, no fixed/sticky positioning. By construction, annotation UI is not blocked |
| 6 | Pure helper module exports the five offline copy constants byte-for-byte | ✓ VERIFIED | `offlineLabels.ts` lines 3-9 declare all 5 constants. Em dash count = 3 (grep confirmed). Curly apostrophe count = 0 (grep confirmed). Tests 1-5 verify exact byte equality — all pass |
| 7 | Three pure label-selection functions return offline strings when status is offline and the default otherwise | ✓ VERIFIED | Functions `approveButtonLabel`, `denyButtonLabel`, `submitDenialButtonLabel` implemented with ternaries in `offlineLabels.ts`. Tests 6-15 cover all online/offline branches — all 15 pass |
| 8 | CSS variables `--color-banner-bg` and `--color-banner-text` are defined in both `:root` and `[data-theme="light"]` blocks with WCAG AA contrast values | ✓ VERIFIED | `index.css` lines 22-23 (dark: `#f59e0b`/`#0f1117`) and lines 45-46 (light: `#d97706`/`#0f172a`). grep count = 4 (2 vars × 2 themes). Override comment present on light text token |
| 9 | `useHeartbeat()` is called exactly once in App — no second interval created | ✓ VERIFIED | `grep -c "useHeartbeat()" ui/src/App.tsx` = 1 (line 583). `OfflineBanner` does not call `useHeartbeat()` — confirmed by reading component body at App.tsx:160-182 |

**Score:** 7/9 truths fully verified; 2 uncertain due to requiring a running binary (Truths 2 and 4 are correct by construction but need human runtime confirmation)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `ui/src/utils/offlineLabels.ts` | Pure helper: 5 string constants + 3 label functions | ✓ VERIFIED | 28 lines; all 5 constants exported; all 3 functions exported; imports `ConnectivityStatus` with `type` qualifier from `./connectivity`; ternary pattern (no switch) |
| `ui/src/utils/offlineLabels.test.ts` | Vitest unit tests: 15 cases | ✓ VERIFIED | 86 lines; 4 `describe` blocks; 15 `it` cases; all 15 pass in full suite run; no `@testing-library/react` |
| `ui/src/index.css` | `--color-banner-bg` and `--color-banner-text` in both theme blocks | ✓ VERIFIED | 4 declarations confirmed (grep count = 4). Dark: `#f59e0b`/`#0f1117`. Light: `#d97706`/`#0f172a`. Both inside their respective scope blocks before closing brace |
| `ui/src/App.tsx` | OfflineBanner sub-component + single useHeartbeat() call + banner mount + 3 label ternaries | ✓ VERIFIED | `function OfflineBanner` at line 160; `const connectivity = useHeartbeat()` at line 583; banner mount at line 1110; label ternaries at lines 1332, 1370, 1453 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ui/src/utils/offlineLabels.ts` | `ui/src/utils/connectivity.ts` | `import type ConnectivityStatus` | ✓ WIRED | Line 1: `import type { ConnectivityStatus } from './connectivity'` — exact pattern, `type` qualifier present |
| `ui/src/utils/offlineLabels.test.ts` | `ui/src/utils/offlineLabels.ts` | named imports of constants and functions | ✓ WIRED | Lines 4-13: imports all 5 constants + 3 functions from `'./offlineLabels'` |
| `ui/src/App.tsx` | `ui/src/hooks/useHeartbeat.ts` | `import { useHeartbeat }` | ✓ WIRED | Line 5: `import { useHeartbeat } from './hooks/useHeartbeat'` |
| `ui/src/App.tsx` | `ui/src/utils/offlineLabels.ts` | named imports of helpers and constants | ✓ WIRED | Lines 6-12: imports `OFFLINE_BANNER_LINE_1`, `OFFLINE_BANNER_LINE_2`, `approveButtonLabel`, `denyButtonLabel`, `submitDenialButtonLabel` from `'./utils/offlineLabels'` |
| `OfflineBanner` | `ui/src/index.css` | `var(--color-banner-bg)` and `var(--color-banner-text)` in inline style | ✓ WIRED | App.tsx lines 165-166: `background: 'var(--color-banner-bg)'`, `color: 'var(--color-banner-text)'` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `OfflineBanner` | `OFFLINE_BANNER_LINE_1`, `OFFLINE_BANNER_LINE_2` | `offlineLabels.ts` constants | Yes — static string constants, not empty | ✓ FLOWING |
| Approve button label | `approveButtonLabel(connectivity, approveLabel)` | `connectivity` from `useHeartbeat()`; `approveLabel` from `useState` initialized from `/api/config` | Yes — returns non-empty string for both branches | ✓ FLOWING |
| Deny button label | `denyButtonLabel(connectivity, denyLabel)` | same | Yes | ✓ FLOWING |
| Submit Denial button label | `submitDenialButtonLabel(connectivity)` | `connectivity` from `useHeartbeat()` | Yes — returns `'Copy to clipboard'` or `'Submit Denial'` | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full Vitest suite passes (39 tests) | `cd ui && npm test -- --run` | 4 test files, 39 tests, all passed | ✓ PASS |
| Lint clean | `cd ui && npm run lint` | Exit 0, no errors | ✓ PASS |
| Vite build passes | `cd ui && npm run build` | Exit 0 (pre-existing chunk-size warnings only) | ✓ PASS |
| Em dash count in offlineLabels.ts = 3 | `grep -cP '\x{2014}' ui/src/utils/offlineLabels.ts` | 3 | ✓ PASS |
| Curly apostrophe count = 0 | `grep -c $''' ui/src/utils/offlineLabels.ts` | 0 | ✓ PASS |
| CSS banner token count = 4 | `grep -cE '--color-banner-(bg\|text)' ui/src/index.css` | 4 | ✓ PASS |
| No @testing-library in package.json | `grep -c '@testing-library' ui/package.json` | 0 | ✓ PASS |
| Single useHeartbeat() call | `grep -c "useHeartbeat()" ui/src/App.tsx` | 1 | ✓ PASS |
| role="status" count = 1 | `grep -c 'role="status"' ui/src/App.tsx` | 1 | ✓ PASS |
| role="alert" count = 0 | `grep -c 'role="alert"' ui/src/App.tsx` | 0 | ✓ PASS |
| approveButtonLabel wired in App | `grep -c "approveButtonLabel(connectivity, approveLabel)" ui/src/App.tsx` | 1 | ✓ PASS |
| denyButtonLabel wired in App | `grep -c "denyButtonLabel(connectivity, denyLabel)" ui/src/App.tsx` | 1 | ✓ PASS |
| submitDenialButtonLabel wired in App | `grep -c "submitDenialButtonLabel(connectivity)" ui/src/App.tsx` | 1 | ✓ PASS |
| Banner mount is sibling of appState branches | `grep -c "connectivity === 'offline' && <OfflineBanner" ui/src/App.tsx` | 1 (at line 1110, before appState branches at 1113/1124) | ✓ PASS |
| OfflineBanner not in components/ | `find ui/src/components -name 'OfflineBanner*' \| wc -l` | 0 | ✓ PASS |
| Click handlers still POST to /api/decide | `grep -n "api/decide" ui/src/App.tsx` | Lines 716 and 1082 (approve + deny handlers unmodified) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| OFX-01 | 14-01, 14-02 | When offline is detected, a persistent non-dismissable banner appears | ✓ SATISFIED | `OfflineBanner` colocated in App.tsx with `role="status"`, amber CSS tokens, two locked copy lines. Banner mount at line 1110 is outside all appState branches — visible in all states. No close/dismiss button or interaction |
| OFX-02 | 14-01, 14-02 | When offline, submit buttons are replaced with a single "Copy to clipboard" button | ✓ SATISFIED | Three label sites updated: `approveButtonLabel` → "Copy to clipboard — approve", `denyButtonLabel` → "Copy to clipboard — deny", `submitDenialButtonLabel` → "Copy to clipboard". Pure helper functions return offline labels when `connectivity === 'offline'`, default labels when `'online'` |

Note: OFX-02 description says "replaced with a single 'Copy to clipboard' button" — the Phase 14 goal and plan scope deliver relabeling only (three distinct offline labels, not merging into one button). The plan explicitly states "Buttons still POST to /api/decide (clipboard wiring is Phase 15)." This is a scope clarification, not a gap; REQUIREMENTS.md itself lists Phase 15 (CLB-01, CLB-02) for the actual clipboard action.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ui/src/App.tsx` | 495 | `{approveLabel}` bare usage remains (ConfirmationView done-state template literal) | ℹ️ Info | Intentional — this is the post-decision confirmation screen, not a submit button; offline label logic does not apply here |
| `ui/src/App.tsx` | 1118 | `{denyLabel}` bare usage remains (ConfirmationView prop pass) | ℹ️ Info | Intentional — same as above; ConfirmationView receives labels for display, not for submit action |

No blockers or warnings found. Both bare-label usages are documented in the SUMMARY.md as intentional deviations (post-decision confirmation, not submit-path buttons).

### Human Verification Required

#### 1. Offline Banner Appearance

**Test:** Open the running app in a browser. Open DevTools > Network tab > toggle "Offline". Wait ~15 seconds (3 failed pings at 5s intervals).
**Expected:** Amber banner appears between the page header and the review content area showing exactly two lines: "Server connection lost — working offline." and "When you're done, copy your decision to the clipboard and paste it back into Claude." The three action buttons relabel to "Copy to clipboard — approve", "Copy to clipboard — deny", and "Copy to clipboard".
**Why human:** Requires a running binary and browser DevTools network simulation.

#### 2. Banner Dismissal on Recovery

**Test:** While offline (banner showing), toggle DevTools Network back to "Online". Wait up to ~5s for the next successful ping.
**Expected:** Banner disappears immediately on the first successful ping. All three button labels revert to their normal values (approveLabel / denyLabel / "Submit Denial").
**Why human:** Requires a running binary and real connectivity state transition.

#### 3. Theme Toggle While Offline

**Test:** While offline (banner showing), toggle the light/dark theme switch.
**Expected:** Dark mode: banner background is amber (#f59e0b), text is near-black (#0f1117). Light mode: banner background is darker amber (#d97706), text is very dark (#0f172a). Both pass WCAG AA.
**Why human:** Requires visual inspection in a running browser.

#### 4. Keyboard Tab Order

**Test:** While offline (banner showing), tab through the page using the keyboard.
**Expected:** The banner is not in the tab stop sequence — focus skips from the last header element directly to the first interactive element in the review area.
**Why human:** Requires keyboard navigation in a running browser. (By construction the banner has no tabindex, no button, no anchor — confident this passes, but runtime confirmation closes the loop.)

#### 5. Banner Visible Across All appState Values

**Test:** Force each of the four appState values (loading, error, reviewing, confirmed) while in offline mode and verify the banner is present in all four.
**Expected:** Banner is visible regardless of appState.
**Why human:** Code inspection confirms the banner mount is at App.tsx:1110 as a sibling of both appState branches (lines 1113 and 1124). Runtime verification across all four states is needed for final confirmation.

### Gaps Summary

No automated gaps found. All must-have truths are either verified or uncertain only due to requiring a running binary. The two uncertain truths (banner hides online, banner disappears on recovery) are correct by construction — they depend on the conditional render and `useHeartbeat()` which was verified in Phase 13.

Five human verification items are required before this phase can be fully closed. These are all runtime behavioural checks that cannot be automated without a running server.

---

_Verified: 2026-05-07T11:05:00Z_
_Verifier: Claude (gsd-verifier)_
