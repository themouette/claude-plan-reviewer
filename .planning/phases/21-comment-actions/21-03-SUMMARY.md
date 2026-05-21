---
phase: 21-comment-actions
plan: 03
subsystem: ui
tags: [react-19, inline-edit-mode, position-sticky, comment-bubble, tdd]

requires:
  - phase: 21-01
    provides: AnnotationForm with formState, CommentBubble base component, CommentPane base

provides:
  - CommentBubble with isEditing prop, pencil/× icon buttons, inline textarea edit mode, Save/Discard buttons, Cmd+Enter/Escape keyboard contract
  - CommentPane with editingId prop, sticky wrapper for editing bubble, absolute positioning for non-editing bubbles
  - CSS .bubble-icon-btn transition rule in index.css
  - Props contract (isEditing, onEdit, onRemove, onCancelEdit) ready for Plan 04 Shell wiring

affects:
  - 21-04
  - ReviewerV2Shell (requires editingId state + editAnnotation/removeAnnotation wiring in Plan 04)

tech-stack:
  added: []
  patterns:
    - "useRef for uncontrolled textarea read-on-save (avoid controlled state for single-save pattern)"
    - "position: sticky wrapper for editing bubble — viewport-pinned while editing, absolute for others"
    - "e.stopPropagation() in icon button onClick to prevent article onClick from re-toggling focus"
    - "onEdit dual-mode callback — called without arg to open edit mode; with arg to commit edit"

key-files:
  created: []
  modified:
    - ui/src/reviewer-v2/CommentBubble.tsx
    - ui/src/reviewer-v2/CommentBubble.test.ts
    - ui/src/reviewer-v2/CommentPane.tsx
    - ui/src/reviewer-v2/CommentPane.test.ts
    - ui/src/index.css

key-decisions:
  - "Uncontrolled textarea with defaultValue + useRef for save — avoids re-render on each keystroke"
  - "position: sticky on editing bubble wrapper within the shared overflowY: auto scroll container"
  - "key={ann.id} moved to wrapper div so React reconciliation tracks bubble across sticky/absolute mode changes"
  - "onEdit dual-mode: no arg = open mode, string arg = save — single callback, Shell handles both cases"

patterns-established:
  - "Bubble icon buttons: 20x20px, transparent bg, color: var(--color-text-secondary), hover via onMouseOver/onMouseOut"
  - "Focus ring on icon buttons: inline onFocus/onBlur matching SelectionToolbar convention"
  - "Save Changes: background: var(--color-focus), color: #fff. Discard: transparent bg, text-secondary"

requirements-completed: [COMMENT-05]

duration: 20min
completed: 2026-05-21
---

# Phase 21 Plan 03: CommentBubble Edit/Delete + CommentPane editingId Summary

**CommentBubble gains pencil/× icons, inline textarea edit mode with Save/Discard/Cmd+Enter/Escape; CommentPane gains editingId-driven sticky/absolute wrapper switching**

## Performance

- **Duration:** 20 min
- **Started:** 2026-05-21T11:17:00Z
- **Completed:** 2026-05-21T11:37:00Z
- **Tasks:** 2 (each with TDD RED + GREEN cycles)
- **Files modified:** 5

## Accomplishments

- CommentBubble exposes full COMMENT-05 surface: pencil (✎) and × icon buttons in focused state with `e.stopPropagation()` guards, inline textarea edit mode replacing the `<p>` tag when `isEditing=true`, Save/Discard buttons and Cmd+Enter/Escape keyboard contract
- CommentPane switches the editing bubble's wrapper to `position: sticky; top: 16` while keeping non-editing bubbles at `position: absolute` with `layoutItem.top`
- 28 new source-as-text assertions across both test files — all pass; existing 11 CommentBubble tests remain green

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: CommentBubble test stubs** - `7fc893f` (test)
2. **Task 1 GREEN: CommentBubble edit/delete + inline edit mode** - `fa9c78d` (feat)
3. **Task 2 RED: CommentPane test stubs** - `7ef7d1c` (test)
4. **Task 2 GREEN: CommentPane editingId + sticky wrapper** - `dd528a9` (feat)

**Plan metadata:** *(this commit)*

_TDD tasks have separate test (RED) and feat (GREEN) commits_

## Files Created/Modified

- `ui/src/reviewer-v2/CommentBubble.tsx` - Added isEditing/onEdit/onRemove/onCancelEdit props; pencil + × icon buttons in focused state; textarea edit mode with defaultValue + useRef; Save/Discard buttons; Cmd+Enter/Escape handler
- `ui/src/reviewer-v2/CommentBubble.test.ts` - Added Phase 21 describe block with 19 assertions
- `ui/src/reviewer-v2/CommentPane.tsx` - Added editingId/onEdit/onRemove/onCancelEdit props; wrapper div switching between position: sticky and position: absolute; key={ann.id} moved to wrapper; top={0} to CommentBubble
- `ui/src/reviewer-v2/CommentPane.test.ts` - Added Phase 21 describe block with 9 assertions
- `ui/src/index.css` - Added `.bubble-icon-btn { transition: color 0.1s ease; }` rule

## Decisions Made

- Used uncontrolled textarea (`defaultValue` + `useRef`) rather than controlled state — saves re-renders on each keystroke; value read once on save
- `key={ann.id}` moved to the wrapper `<div>` so React reconciliation tracks the bubble element across sticky/absolute mode changes without remounting
- `onEdit` is dual-mode by convention (no arg = open edit mode; string arg = commit edit) — this matches the Shell contract Plan 04 will implement
- Build fails in isolation (ReviewerV2Shell.tsx doesn't yet pass the 4 new required props to CommentPane) — this is expected and documented; Plan 04 (Wave 3) resolves it

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- **Worktree has no node_modules:** The worktree ui/ directory didn't have node_modules. Ran `npm install` in the worktree before tests could execute. This is a worktree setup issue, not a code issue.
- **Pre-existing test failures in CommentPane.test.ts:** Three tests from Phase 20's initial test file assert `addEventListener('scroll')`, `passive: true`, and `removeEventListener` — but CommentPane's actual implementation uses `ResizeObserver` without a scroll listener. These 3 failures existed before any changes in this plan and are out of scope. Plan 04 or a future fix plan should either update these tests or add the scroll listener.
- **Build fails in isolation (expected):** `ReviewerV2Shell.tsx` is missing the 4 new required props (`editingId`, `onEdit`, `onRemove`, `onCancelEdit`). Per the plan's `<verification>` section, this is by design — Plan 04 (Wave 3) wires the Shell.

## Known Stubs

None — all new code wires to real props; no hardcoded empty values or placeholder text in the modified files.

## Threat Flags

No new threat surface introduced. Icon button `e.stopPropagation()` (T-21-11) is implemented as required. Deletion without confirmation (T-21-10) is the documented intent per D-09. Position sticky within the scroll container (T-21-12) is implemented as designed, with Plan 04's human-verify step as the safety net.

## Self-Check

Files exist:
- `ui/src/reviewer-v2/CommentBubble.tsx` - FOUND
- `ui/src/reviewer-v2/CommentBubble.test.ts` - FOUND
- `ui/src/reviewer-v2/CommentPane.tsx` - FOUND
- `ui/src/reviewer-v2/CommentPane.test.ts` - FOUND
- `ui/src/index.css` - FOUND

Commits exist: 7fc893f, fa9c78d, 7ef7d1c, dd528a9 — all FOUND in git log

## Next Phase Readiness

- Plan 04 (Wave 3) can now wire ReviewerV2Shell using the exact props contract:
  - `editingId: string | null` state
  - `onEdit={(id, newComment) => { ... }}` — dual-mode handler
  - `onRemove={removeAnnotation}` — from useAnnotations
  - `onCancelEdit={() => setEditingId(null)}`
- The build will succeed again once Plan 04 passes these props to `<CommentPane>`

---
*Phase: 21-comment-actions*
*Completed: 2026-05-21*
