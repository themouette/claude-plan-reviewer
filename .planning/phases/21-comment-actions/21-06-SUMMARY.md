---
phase: 21-comment-actions
plan: "06"
subsystem: ui
tags: [react, typescript, vitest, selection-toolbar, annotation-form, quick-actions]

# Dependency graph
requires:
  - phase: 21-05
    provides: ContentPane with AnnotationForm wiring, SelectionToolbar with QUICK_ACTIONS, handleAction with D-03/D-04 semantics

provides:
  - QUICK_ACTIONS[4] corrected to 'Search the web' (was 'search internet')
  - handleAction bypass path for delete and predefined quick actions (no popup, direct bubble creation)
  - AnnotationForm orange/amber border accent when formState.type === 'replace'
  - Updated ContentPane tests reflecting new bypass semantics

affects: [21-comment-actions, phase-22-submit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bypass pattern: delete and predefined quick actions skip AnnotationForm and call onAddAnnotation directly"
    - "D-03 auto-submit uses prefill fallback: latestFormValueRef.current || formState.prefill"
    - "D-04 applies only to form path (comment/replace) — resetTextSelection not called there"

key-files:
  created: []
  modified:
    - ui/src/reviewer-v2/SelectionToolbar.tsx
    - ui/src/reviewer-v2/SelectionToolbar.test.ts
    - ui/src/reviewer-v2/ContentPane.tsx
    - ui/src/reviewer-v2/ContentPane.test.ts
    - ui/src/reviewer-v2/AnnotationForm.tsx

key-decisions:
  - "Delete and predefined quick actions bypass the form entirely — they directly create bubbles with known comment text, never opening a textarea popup"
  - "D-04 (no resetTextSelection in handleAction) now scoped to form path only; bypass path correctly clears selection after direct annotation creation"
  - "D-03 auto-submit fallback uses formState.prefill when user hasn't typed anything"

patterns-established:
  - "Bypass path: type === 'delete' || prefillComment !== undefined -> direct onAddAnnotation call -> resetTextSelection() -> return"
  - "Form path: comment and replace types still use setFormState; D-04 selection-lock preserved"

requirements-completed: [COMMENT-04, COMMENT-05, OUTLINE-04]

# Metrics
duration: 15min
completed: 2026-05-22
---

# Phase 21 Plan 06: Comment Actions Gap-Closure Summary

**Delete/predefined-action bypass paths added to handleAction, QUICK_ACTIONS label corrected to 'Search the web', and AnnotationForm gets orange border for replace type — all 313 vitest tests green**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-22T17:43:00Z
- **Completed:** 2026-05-22T17:47:00Z
- **Tasks:** 5 (4 implementation + 1 verification)
- **Files modified:** 5

## Accomplishments

- Fixed UAT Failure 2: Delete pill now directly creates a bubble (no textarea popup) — calls onAddAnnotation with comment: 'Delete' and returns immediately
- Fixed UAT Failure 3: All 6 predefined quick actions now directly create bubbles via the same bypass path (prefillComment !== undefined)
- Fixed VERIFICATION.md SC-2 label discrepancy: 'search internet' → 'Search the web' in QUICK_ACTIONS[4]
- Added orange/amber (#f59e0b) border accent to AnnotationForm container when formState.type === 'replace'
- Updated ContentPane D-04 test from "does NOT call resetTextSelection" to two new tests reflecting correct bypass semantics

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix QUICK_ACTIONS label** - `4ef1fed` (fix)
2. **Task 2: Add delete/predefined bypass paths** - `333076a` (feat)
3. **Task 3: Update ContentPane D-04 test** - `2dc45d9` (test)
4. **Task 4: AnnotationForm orange border for replace type** - `6f29fee` (feat)
5. **Task 5: Full vitest suite green** - (verification only, no commit)

## Files Created/Modified

- `ui/src/reviewer-v2/SelectionToolbar.tsx` - QUICK_ACTIONS[4] corrected from 'search internet' to 'Search the web'
- `ui/src/reviewer-v2/SelectionToolbar.test.ts` - Tuple assertion updated for 'Search the web'
- `ui/src/reviewer-v2/ContentPane.tsx` - handleAction restructured: D-03 before bypass, bypass path for delete/predefined, form path for comment/replace
- `ui/src/reviewer-v2/ContentPane.test.ts` - Old D-04 test replaced with two new tests reflecting bypass + form-path semantics
- `ui/src/reviewer-v2/AnnotationForm.tsx` - Container border conditionally uses #f59e0b for replace type

## Decisions Made

- Delete bypass uses hardcoded `'Delete'` string as annotation comment (consistent with prior prefill value)
- Predefined action bypass uses the `prefillComment` argument directly as annotation comment
- D-03 auto-submit fallback: `latestFormValueRef.current || formState.prefill` — covers case where user hasn't typed anything yet (empty string from useRef)
- D-04 selection-lock now correctly scoped to form path only; bypass path legitimately calls resetTextSelection() after direct annotation creation

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- `node_modules` were not present in the worktree (worktree uses isolated filesystem). Ran `npm install` in `ui/` to install dependencies before running tests. This is normal worktree behavior, not a project issue.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 3 UAT failures (Failure 2, Failure 3, label discrepancy) resolved
- 313 vitest tests passing (up from 312 baseline — 1 test added net)
- Ready for phase 22 (Submit) and phase 21 remaining gap-closure plans (21-07 if any)

---
*Phase: 21-comment-actions*
*Completed: 2026-05-22*
