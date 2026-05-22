---
phase: 21-comment-actions
plan: 07
subsystem: ui
tags: [react, vitest, text-selection, annotation, gutter-icon, uat-fix]

requires:
  - phase: 21-comment-actions/21-06
    provides: AnnotationForm, GutterIcon, PlanContent, ContentPane with annotation flow

provides:
  - handleAdd using text-node TreeWalker range (fixes getRangeOffsets null return — UAT failure 4)
  - GutterIcon data-gutter-icon attribute for click-outside coordination
  - PlanContent formOpen prop unblocking hover tracking and GutterIcon visibility during form
  - AnnotationForm click-outside handler skipping cancel for data-gutter-icon targets
  - Auto-submit of existing form in handleAdd before selecting new paragraph (UAT failure 5)
affects: [21-comment-actions, submit flow, annotation creation]

tech-stack:
  added: []
  patterns:
    - "TreeWalker(NodeFilter.SHOW_TEXT) for programmatic text selection — ensures boundary nodes match getRangeOffsets walker"
    - "data-* attribute coordination between components for click-outside exemption"
    - "formOpen prop threading from ContentPane to PlanContent for unblocking hover state"

key-files:
  created: []
  modified:
    - ui/src/reviewer-v2/ContentPane.tsx
    - ui/src/reviewer-v2/GutterIcon.tsx
    - ui/src/reviewer-v2/PlanContent.tsx
    - ui/src/reviewer-v2/AnnotationForm.tsx
    - ui/src/reviewer-v2/ContentPane.test.ts
    - ui/src/reviewer-v2/GutterIcon.test.ts
    - ui/src/reviewer-v2/PlanContent.test.ts
    - ui/src/reviewer-v2/AnnotationForm.test.ts

key-decisions:
  - "TreeWalker(NodeFilter.SHOW_TEXT) in handleAdd: selectNodeContents creates element-level boundary nodes that getRangeOffsets TEXT walker cannot match — text-node anchored range is required"
  - "formOpen prop in PlanContent: allows hover tracking to continue when form is open so user can navigate to new paragraphs without losing GutterIcon visibility"
  - "data-gutter-icon attribute: coordination signal between GutterIcon and AnnotationForm click-outside handler — no user data carried, pure behavioral coordination"

requirements-completed: [COMMENT-04, COMMENT-05, OUTLINE-04]

duration: 4min
completed: 2026-05-22
---

# Phase 21 Plan 07: UAT Failure 4+5 Fix — TreeWalker Range and Auto-Submit Summary

**Fixed two UAT failures: SelectionToolbar now appears after gutter-icon click (text-node-anchored range fixes null getRangeOffsets), and second gutter click auto-submits the open form then selects the new paragraph**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-22T15:50:28Z
- **Completed:** 2026-05-22T15:54:00Z
- **Tasks:** 8 (T1-T7 code changes, T8 verification)
- **Files modified:** 8

## Accomplishments

- Fixed UAT failure 4: handleAdd now uses TreeWalker(NodeFilter.SHOW_TEXT) to build text-node-anchored range — getRangeOffsets can find matching TEXT-node boundary containers and returns non-null offsets, so SelectionToolbar renders correctly after gutter-icon click
- Fixed UAT failure 5: handleAdd auto-submits existing form before selecting new paragraph, mirroring the D-03 pattern from handleAction; PlanContent formOpen prop keeps hover tracking and GutterIcon visible while a form is open
- Added data-gutter-icon coordination: GutterIcon button has the attribute; AnnotationForm click-outside handler skips cancel when click target is inside [data-gutter-icon] so the auto-submit path in handleAdd runs cleanly
- All 316 vitest tests pass (22 test files)

## Task Commits

1. **T1: Fix handleAdd to use text-node TreeWalker range + auto-submit existing form** - `aa8fe2d` (fix)
2. **T2: Add data-gutter-icon attribute to GutterIcon** - `0586849` (fix)
3. **T3: Add data-gutter-icon assertion to GutterIcon.test.ts** - `189673f` (test)
4. **T4: Update PlanContent to accept formOpen prop and unblock hover/gutter when form is open** - `7de18a3` (fix)
5. **T5: Wire formOpen={formState !== null} from ContentPane to PlanContent** - `d44a208` (fix)
6. **T6: Add gutter-icon exemption to AnnotationForm click-outside handler** - `14d79a8` (fix)
7. **T7: Update test files for T1, T4, T6 changes** - `19446e8` (test)
8. **T8: Full vitest suite green check** - (no commit needed — verification only, 316 tests passed)

## Files Created/Modified

- `ui/src/reviewer-v2/ContentPane.tsx` - handleAdd rewritten with TreeWalker(NodeFilter.SHOW_TEXT); auto-submit form in handleAdd; formOpen prop wired to PlanContent
- `ui/src/reviewer-v2/GutterIcon.tsx` - data-gutter-icon="" attribute added to button
- `ui/src/reviewer-v2/PlanContent.tsx` - formOpen prop added; hover short-circuit changed to `if (selectedText && !formOpen)`; GutterIcon condition changed to `hoveredParagraph && (!selectedText || formOpen)`
- `ui/src/reviewer-v2/AnnotationForm.tsx` - click-outside handler skips cancel when target is inside [data-gutter-icon]
- `ui/src/reviewer-v2/ContentPane.test.ts` - replaced selectNodeContents assertion with NodeFilter.SHOW_TEXT assertion
- `ui/src/reviewer-v2/GutterIcon.test.ts` - added data-gutter-icon contract assertion
- `ui/src/reviewer-v2/PlanContent.test.ts` - updated hover short-circuit and GutterIcon condition tests; added formOpen test
- `ui/src/reviewer-v2/AnnotationForm.test.ts` - added data-gutter-icon click-outside exemption assertion

## Decisions Made

- Used TreeWalker(NodeFilter.SHOW_TEXT) instead of selectNodeContents: the root cause of UAT failure 4 was that selectNodeContents sets boundary points to the ELEMENT node, but getRangeOffsets walks only TEXT nodes via NodeFilter.SHOW_TEXT and cannot match element-level boundary containers, returning null
- formOpen prop threading (ContentPane -> PlanContent): simplest fix that keeps hover tracking alive without restructuring state management; formOpen is derived state (formState !== null) so no new state needed
- data-gutter-icon as coordination attribute: avoids direct component coupling; AnnotationForm only needs to know "is this click targeting the gutter button?" without importing GutterIcon

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- node_modules not present in worktree — ran `npm install` before running tests (Rule 3: blocking issue resolved automatically)

## Known Stubs

None — all functionality is fully wired.

## Threat Flags

None — changes are pure in-browser event handling and DOM attribute additions. data-gutter-icon carries no user data.

## Self-Check: PASSED

- `aa8fe2d` exists in git log: FOUND
- `0586849` exists in git log: FOUND
- `189673f` exists in git log: FOUND
- `7de18a3` exists in git log: FOUND
- `d44a208` exists in git log: FOUND
- `14d79a8` exists in git log: FOUND
- `19446e8` exists in git log: FOUND
- All modified files confirmed present and correct
- 316 tests pass, 0 failures

## Next Phase Readiness

- UAT failures 4 and 5 resolved — gutter icon flow now complete end-to-end
- SelectionToolbar appears correctly after gutter-icon click (failure 4 fixed)
- Second gutter click auto-submits first form then selects new paragraph (failure 5 fixed)
- Phase 21 gap closure complete for COMMENT-04, COMMENT-05, OUTLINE-04

---
*Phase: 21-comment-actions*
*Completed: 2026-05-22*
