---
phase: 22-submit-clipboard
plan: 02
subsystem: ui
tags: [react, typescript, vitest, popover, submit, reviewer-v2, source-contract-test]

# Dependency graph
requires:
  - phase: 22-submit-clipboard
    provides: UI-SPEC §SubmitPopover visual spec, dismiss contract, keyboard contract
  - phase: 21-comment-actions
    provides: CommentBubble, AnnotationForm patterns for event handling
provides:
  - "SubmitPopover controlled popover component with open/onDismiss/onSubmit props"
  - "Source-contract Vitest test locking in popover accessibility, dismiss, and submit behavior"
affects: [22-submit-clipboard-plan-03, 22-submit-clipboard-plan-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Uncontrolled textarea with ref-based value reading (avoids react-hooks/set-state-in-effect lint error)"
    - "Source-contract test pattern: readFileSync + toContain/toMatch assertions"
    - "Document-level keydown+mousedown listeners in useEffect keyed on [open, onDismiss]"

key-files:
  created:
    - ui/src/reviewer-v2/SubmitPopover.tsx
    - ui/src/reviewer-v2/SubmitPopover.test.ts
  modified: []

key-decisions:
  - "Uncontrolled textarea (ref-based) instead of controlled useState to satisfy react-hooks/set-state-in-effect ESLint rule — value read via textareaRef.current?.value on submit"
  - "SubmitPopover contains zero submission-path logic — no clipboard, fetch, connectivity refs; pure UI boundary"
  - "Component returns null when open=false — no DOM in closed state"

patterns-established:
  - "Popover dismiss: document.addEventListener('keydown') for Escape + document.addEventListener('mousedown') for outside-click, both cleaned up in useEffect return"
  - "onSubmit called via button onClick AND onKeyDown (metaKey||ctrlKey && key==='Enter') — two submission paths"

requirements-completed: [SUBMIT-01]

# Metrics
duration: 10min
completed: 2026-05-22
---

# Phase 22 Plan 02: SubmitPopover Summary

**Controlled popover component with autoFocused textarea, Escape/outside-click dismiss, and Cmd+Enter submit — zero submission logic, pure UI primitive for SubmitControls (Plan 03)**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-22T21:10:00Z
- **Completed:** 2026-05-22T21:19:44Z
- **Tasks:** 2
- **Files modified:** 2 (created)

## Accomplishments

- Implemented `SubmitPopover.tsx` as a controlled popover with `open/onDismiss/onSubmit` props interface
- Popover renders `role="dialog"` container with autoFocused textarea and always-enabled "Send Feedback" button
- Dismisses on Escape keydown and outside mousedown via document-level listeners with useEffect cleanup
- Submits on Cmd+Enter/Ctrl+Enter (keyboard) or button click — both pass textarea value to `onSubmit()`
- Source-contract test passes all 13 assertions, locking in accessibility attributes, dismiss handlers, and purity invariants

## Task Commits

1. **Task 1: Implement SubmitPopover.tsx** - `31c23c6` (feat)
2. **Task 2: Source-contract test for SubmitPopover** - `0eb4022` (test)

## Files Created/Modified

- `ui/src/reviewer-v2/SubmitPopover.tsx` — Controlled popover component; exports `SubmitPopoverProps` interface and default function component
- `ui/src/reviewer-v2/SubmitPopover.test.ts` — Source-contract Vitest test with 13 assertions covering all behavioral invariants

## Decisions Made

- **Uncontrolled textarea pattern:** The plan specified `useState('')` + `useEffect` reset, but the `react-hooks/set-state-in-effect` ESLint rule (v5 react-hooks plugin) blocks calling `setState` synchronously in effects. Used uncontrolled textarea (`defaultValue=""` + `textareaRef`) following the AnnotationForm.tsx pattern. Value read via `textareaRef.current?.value ?? ''` on submit. This avoids both the lint error and cascading re-renders.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Switched from controlled to uncontrolled textarea to fix ESLint errors**
- **Found during:** Task 1 (ESLint verification)
- **Issue:** Plan specified `useState('')` + `useEffect(() => { if (open) setMessage('') }, [open])` for message state. The `react-hooks/set-state-in-effect` ESLint rule (enforced by `reactHooks.configs.flat.recommended`) rejects `setState` in effect body. A follow-up attempt using `prevOpenRef.current` during render was blocked by `react-hooks/refs` (no ref access during render). Both approaches fail with the installed react-hooks v5 plugin.
- **Fix:** Adopted uncontrolled textarea (`defaultValue=""`, `ref={textareaRef}`). Value is read on submit via `textareaRef.current?.value ?? ''`. Component behavior is identical — textarea always starts empty when popover opens (because the component returns null when closed, so the textarea is unmounted/remounted each time the popover opens).
- **Files modified:** `ui/src/reviewer-v2/SubmitPopover.tsx`
- **Verification:** ESLint passes 0 errors, TypeScript compiles, all 13 source-contract tests pass
- **Committed in:** `31c23c6` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug fix for ESLint compliance)
**Impact on plan:** The functional behavior is identical. Since the component returns `null` when `open=false`, the textarea DOM node is destroyed on close and recreated with `defaultValue=""` on next open. The controlled-state reset the plan described is naturally achieved by the unmount/remount cycle.

## Issues Encountered

- `npm install` was needed in the worktree's `ui/` directory — node_modules were not pre-installed. Installed successfully, no package changes.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The component is pure UI with no external side effects — no threat flags.

## Next Phase Readiness

- `SubmitPopover` is ready to be consumed by `SubmitControls` (Plan 03)
- Props interface `{ open: boolean, onDismiss: () => void, onSubmit: (message: string) => void }` is locked in by the source-contract test
- Plan 03 should wire `open={submitState === 'popover_open'}` and pass `onSubmit` as the submission dispatch

---
*Phase: 22-submit-clipboard*
*Completed: 2026-05-22*
