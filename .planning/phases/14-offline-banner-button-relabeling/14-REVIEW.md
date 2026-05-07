---
phase: 14-offline-banner-button-relabeling
reviewed: 2026-05-07T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - ui/src/App.tsx
  - ui/src/index.css
  - ui/src/utils/offlineLabels.test.ts
  - ui/src/utils/offlineLabels.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-05-07
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 14 adds an amber offline banner (`OfflineBanner`), CSS variable tokens for banner colors, a `offlineLabels.ts` pure-function module, and wires three button-label render-time ternaries in `App.tsx`. The implementation is structurally correct: the banner is properly placed between `<PageHeader>` and the appState block, the `useHeartbeat()` hook is called exactly once, `role="status"` is present, `flexShrink: 0` prevents viewport clipping, and all five copywriting constants use the correct Unicode em dash (U+2014) and straight apostrophe.

Two warnings were found, both involving the `↵ Enter` keyboard shortcut hint and a missing exported constant for the online "Submit Denial" label. These do not crash the application but create a user-visible false affordance (offline) and a fragile test assertion (maintainability).

Two info items were found: a permanently-empty `inlineChips` array that dead-codes a render branch (pre-existing, not introduced by phase 14), and the test descriptions' use of numeric prefixes that cause awkward failure messages when tests are added out of order.

No security vulnerabilities or data-loss risks were found.

---

## Warnings

### WR-01: "↵ Enter" keyboard hint rendered when button intent is clipboard copy

**File:** `ui/src/App.tsx:1334-1341`
**Issue:** The approve button unconditionally renders a `↵ Enter` keyboard shortcut hint alongside its label. When `connectivity === 'offline'` the label becomes `"Copy to clipboard — approve"` (from `approveButtonLabel`), but the global `keydown` handler (lines 733–747) still fires `approve()` on Enter. `approve()` POSTs to `/api/decide`; this POST fails while offline, and the `catch` block (line 727) transitions the app to `appState === 'error'`, displaying the `ErrorView` message "The plan reviewer failed to connect to the local server. Check that the binary is still running." The user pressed Enter expecting a clipboard write but receives a server-error screen. The keyboard hint thus advertises an action that delivers a different (and visually alarming) outcome when offline.

**Context:** The UI-SPEC and plan explicitly defer clipboard wiring to Phase 15 and note that button handlers must not be modified in this phase. The issue is a predictable consequence of that staged delivery, not a logic error. However, the hint should be suppressed offline now so it is not shipped as a permanent false affordance pending Phase 15.

**Fix:**
```tsx
{/* Suppress Enter hint when offline: Enter still POSTs (phase 15 wires clipboard) */}
{connectivity !== 'offline' && (
  <span
    style={{
      fontSize: '14px',
      color: 'rgba(241, 245, 249, 0.6)',
      fontWeight: 400,
    }}
  >
    ↵ Enter
  </span>
)}
```

---

### WR-02: Online "Submit Denial" label is a magic string literal, not an exported constant

**File:** `ui/src/utils/offlineLabels.ts:26` and `ui/src/utils/offlineLabels.test.ts:79`
**Issue:** The three offline labels (`OFFLINE_APPROVE_LABEL`, `OFFLINE_DENY_LABEL`, `OFFLINE_SUBMIT_DENIAL_LABEL`) are exported constants that both the implementation and the tests reference by name. The online "Submit Denial" label, however, is a bare string literal in `submitDenialButtonLabel`'s return value and duplicated as a hard-coded literal in the test assertion on line 79. If the label copy changes, both files must be updated independently; a missed update will silently leave the test asserting the old string against a changed implementation (or vice versa).

The pattern used for every other label in this module — export a constant, test the constant name — is the correct one and should be applied here too.

**Fix:**
```ts
// ui/src/utils/offlineLabels.ts
export const ONLINE_SUBMIT_DENIAL_LABEL = 'Submit Denial'

export function submitDenialButtonLabel(status: ConnectivityStatus): string {
  return status === 'offline' ? OFFLINE_SUBMIT_DENIAL_LABEL : ONLINE_SUBMIT_DENIAL_LABEL
}
```

```ts
// ui/src/utils/offlineLabels.test.ts
import {
  // …existing imports…
  ONLINE_SUBMIT_DENIAL_LABEL,
} from './offlineLabels'

it('Test 14: returns default when online', () => {
  expect(submitDenialButtonLabel('online')).toBe(ONLINE_SUBMIT_DENIAL_LABEL)
})
```

---

## Info

### IN-01: `inlineChips` is always an empty array — dead render branch

**File:** `ui/src/App.tsx:200-201, 262-287`
**Issue:** `inlineChips` is defined as `QUICK_ACTIONS.slice(0, 0)`, which is always `[]`. The `{inlineChips.map(...)}` block (lines 262–287) therefore renders nothing and is unreachable dead code. A developer reading `FloatingAnnotationAffordance` will spend time tracing `inlineChips` expecting to find some conditional logic that populates it. This is a pre-existing issue not introduced by Phase 14, but it is worth flagging.

**Fix:** Either remove the `inlineChips` variable and its `map` block entirely, or change `slice(0, 0)` to the intended non-zero boundary if the split between inline and overflow chips is meant to be tunable:
```ts
// Example: first 2 chips inline, rest overflow
const inlineChips = QUICK_ACTIONS.slice(0, 2)
const overflowChips = QUICK_ACTIONS.slice(2)
```

---

### IN-02: Test case names use numeric prefixes that fragment across describe blocks

**File:** `ui/src/utils/offlineLabels.test.ts:16-85`
**Issue:** Test names use a global counter ("Test 1", "Test 2", …, "Test 15") that spans multiple `describe` blocks. When Vitest reports a failure it prints the full `describe > it` path, producing messages like `offlineLabels constants > Test 3: approve offline label uses em dash`, where the number is meaningless without consulting the file. More importantly, inserting a new test case at the top of any describe block requires renumbering all subsequent tests globally. The project's existing test file `ui/src/utils/connectivity.test.ts` does not use this numeric prefix style.

**Fix:** Use descriptive names without global counters, consistent with the project pattern:
```ts
it('banner line 1 ships byte-for-byte', () => { … })
it('banner line 2 ships byte-for-byte', () => { … })
it('approve offline label uses em dash', () => { … })
```

---

_Reviewed: 2026-05-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
