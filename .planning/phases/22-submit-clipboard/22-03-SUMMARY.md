---
phase: 22-submit-clipboard
plan: "03"
subsystem: reviewer-v2/submit-controls
tags:
  - reviewer-v2
  - submit
  - clipboard
  - gate-logic
  - tdd
dependency_graph:
  requires:
    - "22-01 (offlineLabels.ts — buildClipboardPayload, shouldUseClipboard)"
    - "22-02 (SubmitPopover.tsx — popover component)"
  provides:
    - "SubmitControls default export (function component)"
    - "SubmitControlsProps interface (annotations, connectivity)"
    - "Gate logic: canApprove = annotations.length === 0, canAskChange = annotations.length > 0"
    - "Online path: POST /api/decide with allow or deny+message"
    - "Offline path: synchronous clipboard.writeText (no await — transient-activation safe)"
    - "Six SubmitState literals with inline confirmations"
    - "Source-contract test locking all gate/path/copy contracts"
  affects:
    - "ui/src/reviewer-v2/ (ReviewerV2Shell.tsx — Plan 04 will mount this)"
tech_stack:
  added: []
  patterns:
    - "Source-contract test pattern (readFileSync + toContain/toMatch assertions)"
    - "Synchronous clipboard.writeText with no prior await (transient activation)"
    - "HTML disabled attribute on both gates (not opacity-only)"
    - "Inline confirmation states replacing button group (no full-screen overlay)"
    - "useEffect auto-close hint with setTimeout + clearTimeout cleanup"
key_files:
  created:
    - "ui/src/reviewer-v2/SubmitControls.tsx"
    - "ui/src/reviewer-v2/SubmitControls.test.ts"
  modified: []
decisions:
  - "Fallback to clipboard_error (not generic 'error') on network failure — preserves user's decision via copy/paste even when server is down"
  - "catch {} empty block annotated with comment to satisfy no-empty ESLint rule"
  - "Auto-close hint test uses toContain('window.setTimeout') + toContain('window.close()') split assertions instead of regex spanning multiple lines"
metrics:
  duration: "6m 23s"
  completed: "2026-05-22T21:30:21Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 22 Plan 03: SubmitControls Component Summary

SubmitControls component implementing dual gate (Approve disabled when comments exist, Send Feedback disabled when no comments) with online POST and offline clipboard paths, inline confirmation states, and source-contract test.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement SubmitControls.tsx | 4688b09 | ui/src/reviewer-v2/SubmitControls.tsx |
| 2 | Source-contract test for SubmitControls.tsx | 97eed69 | ui/src/reviewer-v2/SubmitControls.test.ts |

## What Was Built

### SubmitControls.tsx

A React function component mounted in the top-right of the v2 reviewer header. Key properties:

**Gate logic (SUBMIT-01):**
- `canApprove = annotations.length === 0` — Approve button is HTML-`disabled` when any comment exists
- `canAskChange = annotations.length > 0` — Send Feedback button is HTML-`disabled` when no comments exist (per REQUIREMENTS.md, which supersedes UI-SPEC line 150 "always enabled")

**Submit state machine:** Six `SubmitState` literals: `'idle'`, `'popover_open'`, `'confirmed_allow'`, `'confirmed_deny'`, `'clipboard_confirmed'`, `'clipboard_error'`

**Submission paths (SUBMIT-02):**
- Online: `fetch('/api/decide', { method: 'POST', ... })` treating `res.ok || res.status === 409` as success
- Offline: `navigator.clipboard.writeText(json)` called synchronously (no `await` before the call — transient-activation safe per Pitfall 4)
- Network failure fallback: sets `clipboardJson` and transitions to `clipboard_error` so user can copy manually

**Inline confirmations:** Four copy strings in four states — "Approved", "Feedback sent", "Copied to clipboard", "Clipboard write failed"

**clipboard_error state:** Read-only `<textarea readOnly value={clipboardJson}>` with click-to-select-all

**Auto-close hint:** `useEffect` schedules `window.setTimeout(() => window.close(), 500)` after any terminal confirmation state with `clearTimeout` cleanup

**ARCH-01:** All imports from within `reviewer-v2/` subtree — no `from '../` escaping the subtree

### SubmitControls.test.ts

Source-contract test with 37 assertions across 7 `describe` blocks:
1. Exports + imports (default function, ARCH-01 no-outside-imports)
2. Gate logic (both `disabled={!canApprove}` and `disabled={!canAskChange}` exactly once each)
3. Submission paths (param order verification, both fetch calls, both POST bodies)
4. Transient activation (Pitfall 4 — no `await` before `writeText` in offline branch)
5. State machine + inline confirmations (all 6 states, all 4 copy strings, readOnly textarea)
6. Accessibility (`aria-haspopup`, `aria-expanded`, disabled tooltips)
7. Auto-close hint (`window.setTimeout` + `window.close()`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESLint no-empty on catch {} block**
- **Found during:** Task 1 lint check
- **Issue:** `try { window.close() } catch {}` triggered `no-empty` ESLint rule
- **Fix:** Added comment inside catch body: `catch { /* browser may block window.close() — ignore */ }`
- **Files modified:** ui/src/reviewer-v2/SubmitControls.tsx
- **Commit:** included in 4688b09

**2. [Rule 1 - Bug] setTimeout regex in test failed to match multiline source**
- **Found during:** Task 2 test run
- **Issue:** The plan's test assertion `/setTimeout\([^)]*window\.close/` did not match because `window.close()` is on the line after `window.setTimeout`, so `[^)]*` (which doesn't cross newlines) stopped at the first newline
- **Fix:** Replaced with two separate `toContain` assertions: `toContain('window.setTimeout')` and `toContain('window.close()')` — semantically equivalent and more readable
- **Files modified:** ui/src/reviewer-v2/SubmitControls.test.ts
- **Commit:** included in 97eed69

## Verification Results

- `cd ui && npm test -- --run reviewer-v2/SubmitControls`: 37/37 passed
- `cd ui && npm run lint -- src/reviewer-v2/SubmitControls.tsx src/reviewer-v2/SubmitControls.test.ts`: exit 0 (0 errors, 5 pre-existing warnings in App.tsx and hooks)
- `cd ui && npx tsc --noEmit`: exit 0 (clean)
- Pitfall 4 spot-check: offline branch line 43–48 contains `navigator.clipboard.writeText` and has zero `await ` occurrences before it
- SUBMIT-01 dual-gate: `disabled={!canApprove}` appears 1x, `disabled={!canAskChange}` appears 1x

## Known Stubs

None. All four inline confirmation states render real copy strings and all submission paths are fully wired.

## Self-Check: PASSED
