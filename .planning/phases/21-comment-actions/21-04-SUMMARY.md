---
phase: 21-comment-actions
plan: 04
subsystem: ui
tags: [react-19, shell-state-lift, integration, css-custom-properties, human-verify, tdd]

requires:
  - phase: 21-01
    provides: useSectionAnnotationCounts hook, CommentBubble base, CommentPane base
  - phase: 21-02
    provides: ContentPane wiring layer (AnnotationForm, SelectionToolbar, gutter icon)
  - phase: 21-03
    provides: CommentBubble edit/delete, CommentPane editingId/sticky wrapper, props contract

provides:
  - OutlinePane annotationCounts prop + per-section count badge with active/inactive color switching
  - ReviewerV2Shell editingId state + useSectionAnnotationCounts call + prop forwarding to CommentPane and OutlinePane
  - Escape handler extended to clear both focusedCommentId and editingId
  - Full Phase 21 wiring: annotation create/edit/delete lifecycle end-to-end
  - Build compiles again (Plan 03 left it broken due to missing required props)

affects:
  - Human verification gate (Task 3 — checkpoint:human-verify)

tech-stack:
  added: []
  patterns:
    - "useSectionAnnotationCounts called in Shell, result threaded as annotationCounts prop to OutlinePane"
    - "editingId lifted to Shell — single source of truth for which bubble is in edit mode"
    - "onEdit dual-mode callback wired at Shell level: no-arg path calls setEditingId(id), string-arg path calls editAnnotation + setEditingId(null)"
    - "Escape handler clears both focusedCommentId and editingId — global exit from any interactive state"

key-files:
  created: []
  modified:
    - ui/src/reviewer-v2/OutlinePane.tsx
    - ui/src/reviewer-v2/OutlinePane.test.ts
    - ui/src/reviewer-v2/ReviewerV2Shell.tsx
    - ui/src/reviewer-v2/ReviewerV2Shell.test.ts

key-decisions:
  - "annotationCounts passed as optional prop to OutlinePane — Shell owns the count computation, OutlinePane is purely presentational"
  - "editingId lifted to Shell rather than kept in CommentPane — Shell owns cross-pane state"
  - "onEdit dual-mode wired at Shell, not CommentPane — keeps CommentPane unaware of persistence layer"
  - "Pre-existing CommentPane.test.ts scroll-listener failures are out of scope (documented in Plan 03 SUMMARY)"

requirements-completed: [COMMENT-05, OUTLINE-04]

duration: 10min
completed: 2026-05-21
---

# Phase 21 Plan 04: ReviewerV2Shell Integration Summary

**OutlinePane gains annotationCounts badge; ReviewerV2Shell wires editingId state, useSectionAnnotationCounts, and all Phase 21 callback props — closing Phase 21 with build passing and full lifecycle wired**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-21T13:28:00Z
- **Completed:** 2026-05-21T13:38:00Z
- **Tasks:** 2 auto (each TDD RED + GREEN) + 1 checkpoint:human-verify (paused)
- **Files modified:** 4

## Accomplishments

- OutlinePane receives `annotationCounts?: Map<string, number>` prop; renders inline `<span>` badge for sections with count > 0, with active/inactive color switching using `var(--color-focus)` and `rgba(59, 130, 246, 0.25)`
- ReviewerV2Shell destructures `editAnnotation` + `removeAnnotation` from `useAnnotations()`, adds `editingId` state, calls `useSectionAnnotationCounts(sections, annotations, planRef)`, extends Escape handler to clear `editingId`, and passes all new props to both `OutlinePane` and `CommentPane`
- Build compiles successfully — Plan 03 had left it broken; this plan closes the prop-interface loop
- 44 new source-as-text assertions added (8 OutlinePane + 10 ReviewerV2Shell), all pass
- 312/315 tests pass overall; the 3 pre-existing failures in `CommentPane.test.ts` are out of scope (documented in Plan 03 SUMMARY, from Phase 20 stale scroll-listener tests)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: OutlinePane badge test stubs** — `a97201a` (test)
2. **Task 1 GREEN: OutlinePane annotationCounts badge** — `7098d72` (feat)
3. **Task 2 RED: ReviewerV2Shell Phase 21 test stubs** — `204ee50` (test)
4. **Task 2 GREEN: ReviewerV2Shell Phase 21 wiring** — `ef4dbe4` (feat)

**Plan metadata:** *(this commit)*

_TDD tasks have separate test (RED) and feat (GREEN) commits_

## Files Created/Modified

- `ui/src/reviewer-v2/OutlinePane.tsx` — Added `annotationCounts?: Map<string, number>` prop; conditional `<span>` badge rendered after `{section.text}` when count > 0; badge uses `aria-label`, active/inactive color logic, inline styles per spec
- `ui/src/reviewer-v2/OutlinePane.test.ts` — Added Phase 21 describe block with 8 assertions (prop presence, count lookup, aria-label, colors, borderRadius, minWidth, marginLeft)
- `ui/src/reviewer-v2/ReviewerV2Shell.tsx` — Added import for `useSectionAnnotationCounts`; added `editAnnotation`/`removeAnnotation` to `useAnnotations()` destructure; added `editingId` state; added `annotationCounts` hook call; extended Escape handler; passed `annotationCounts` to OutlinePane; passed `editingId`, `onEdit`, `onRemove`, `onCancelEdit` to CommentPane
- `ui/src/reviewer-v2/ReviewerV2Shell.test.ts` — Added Phase 21 describe block with 10 assertions

## Decisions Made

- Kept `annotationCounts` computation in Shell (via `useSectionAnnotationCounts`) and passed as prop to OutlinePane — the pane stays presentational with no knowledge of annotations
- `editingId` lives in Shell so it can be cleared by both the CommentPane's `onCancelEdit` callback and the Shell-level Escape handler — single source of truth
- `onEdit` dual-mode callback wired at the Shell level: no-arg branch calls `setEditingId(id)`, string-arg branch calls `editAnnotation(id, newComment)` then `setEditingId(null)`

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- **3 pre-existing CommentPane.test.ts failures:** Tests from Phase 20 assert `addEventListener('scroll')`, `passive: true`, and `removeEventListener` — but the current CommentPane uses `ResizeObserver` only. These failures predate this plan and are out of scope. See Plan 03 SUMMARY for details.
- **node_modules not present in worktree:** Required `npm install` before running tests (standard worktree setup issue, not a code issue).

## Known Stubs

None — all props are wired to real state and real hook calls. No hardcoded empty values or placeholder text.

## Threat Flags

No new threat surface introduced.

- T-21-14 (onEdit `newComment !== undefined` check): Implemented — the `if (newComment !== undefined)` guard is present in the Shell's `onEdit` callback, ensuring empty-string saves commit an empty comment as intended.
- T-21-15 (useSectionAnnotationCounts memoization): Confirmed — hook is memoized via `useMemo([sections, annotations, planRef])` per Plan 01; Shell passes the same stable `planRef` ref object.
- T-21-16 (Escape clears both states): Implemented — the Escape handler calls both `setFocusedCommentId(null)` and `setEditingId(null)`.

## TDD Gate Compliance

- Task 1: RED commit `a97201a` (test) precedes GREEN commit `7098d72` (feat) — PASS
- Task 2: RED commit `204ee50` (test) precedes GREEN commit `ef4dbe4` (feat) — PASS

## Self-Check

Files exist:
- `ui/src/reviewer-v2/OutlinePane.tsx` - FOUND
- `ui/src/reviewer-v2/OutlinePane.test.ts` - FOUND
- `ui/src/reviewer-v2/ReviewerV2Shell.tsx` - FOUND
- `ui/src/reviewer-v2/ReviewerV2Shell.test.ts` - FOUND

Commits exist: a97201a, 7098d72, 204ee50, ef4dbe4 — all found in git log above

## Self-Check: PASSED

## Checkpoint Status

Task 3 (checkpoint:human-verify) reached — awaiting user verification of all 9 behavioral steps.

## Next Steps

After user verification:
- If all 9 steps pass: Phase 21 complete. Requirements COMMENT-04, COMMENT-05, OUTLINE-04 fully satisfied.
- If any step fails: describe which step(s) and observed behavior; a gap-closure plan will be opened.
