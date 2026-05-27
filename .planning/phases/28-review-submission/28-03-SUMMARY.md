---
plan: 28-03
phase: 28
status: complete
completed: 2026-05-25
commits:
  - ecd18b6
  - 80c91f9
  - 4011fcc
  - b4498d4
  - ee81abb
  - 242921a
  - 6ab1935
  - 439b43b
key-files:
  created:
    - ui/src/code-review/CodeReviewSubmitPopover.tsx
    - ui/src/code-review/CodeReviewSubmitPopover.test.ts
  modified:
    - ui/src/code-review/AppToolbar.tsx
    - ui/src/code-review/AppToolbar.test.ts
    - ui/src/code-review/CodeReviewApp.tsx
    - ui/src/code-review/CodeReviewApp.test.ts
    - ui/src/code-review/buildCodeReviewPayload.ts
    - ui/src/code-review/buildCodeReviewPayload.test.ts
---

## Summary

Phase 28-03 ships the complete review submission UI for the code-review reviewer.

### What was built

**Design change during verification:** The original plan specified separate Approve / Request Changes buttons with gate logic (D-06). During browser verification, the user redirected to a simpler single "Send Review" button — the agent decides what to do from the payload. This was implemented immediately and is the shipped design.

**CodeReviewSubmitPopover.tsx** — Popover anchored under the Send Review button. Contains an optional message textarea (autoFocus, Escape/outside-click dismiss, Cmd+Enter submit). "Send Review" confirm button enables when `commentsCount > 0 || message.trim().length > 0`, ensuring at least one signal is present. `aria-label="Send review"`, `role="dialog" aria-modal="true"`.

**AppToolbar.tsx** — Single "Send Review" button (always enabled, green). Clicks open the popover. Submit flow:
1. Try POST `/api/decide` (Phase 29 backend — not yet implemented)
2. If POST fails for any reason → clipboard fallback (`navigator.clipboard.writeText`)
3. If clipboard also blocked → readonly textarea with JSON + Dismiss button

`SubmitState` union: `idle | popover_open | confirmed | clipboard_confirmed | clipboard_error`. Auto-close tab after 500ms on `confirmed`. Auto-reset `clipboard_confirmed` after 3000ms.

**buildCodeReviewPayload.ts** — Renamed export from `buildCodeReviewPayload` to `buildReviewPayload`. Payload schema changed from `{decision, global_instruction?, comments?}` to `{message?, comments?}` — both fields omitted when empty. The agent receives the payload and determines the decision.

**CodeReviewApp.tsx** — Passes `connectivity={connectivity}` and `comments={comments}` to AppToolbar. Prop renamed from `onApprove`/`onRequestChanges` to `onReviewSent` (stub `() => {}`; submit logic lives entirely in AppToolbar).

### Requirements satisfied

| Requirement | Where implemented |
|-------------|-------------------|
| SUBMIT-01: Approve gate | Removed — single button, agent decides |
| SUBMIT-02: Optional global instruction | `CodeReviewSubmitPopover` message textarea |
| SUBMIT-03: Structured JSON → agent | `buildReviewPayload` → POST `/api/decide` (Phase 29) or clipboard fallback |
| SUBMIT-04: Request Changes gate | Removed — single button, agent decides |

### Deviations

- **D-06 gate logic removed** — replaced with a single "Send Review" button per user direction during verification. The complexity of tooltip-on-disabled-button interactions was the trigger.
- **`buildCodeReviewPayload` renamed to `buildReviewPayload`** — payload schema no longer includes `decision` field.
- **POST fallback is clipboard, not textarea** — when `/api/decide` is unavailable (Phase 29 not yet implemented), content goes to clipboard. The textarea error state is only reached when clipboard is also blocked.

### Human verification (Task 4)

Browser walkthrough confirmed:
- Send Review button visible and always enabled
- Popover opens on click, dismisses on Escape and outside-click
- "Send Review" confirm button enables when message is typed (even with no comments)
- POST to `/api/decide` fails → automatic clipboard fallback → "Copied to clipboard" status
- Clipboard fallback works correctly with `{message?, comments?}` payload shape

Note: Online POST path verified at source level only (`fetch('/api/decide', ...)` present in AppToolbar.tsx). End-to-end POST exercise is Phase 29 scope.

### Test count

650 tests, 33 test files — all pass.

## Self-Check: PASSED
