---
status: resolved
slug: edit-mode-bubble-position
trigger: "In edit mode, the comment bubble loses its position"
created: 2026-05-22
updated: 2026-05-22
---

## Symptoms

- **Expected:** Comment bubble stays anchored to its annotation position when edit mode is entered
- **Actual:** Bubble jumps to y=0 (top of the comment pane) as soon as the user clicks Edit
- **Error messages:** None reported
- **Timeline:** Appeared after phase 21 fix commits (dd2c6d1 through 31b3cdc) — was working before
- **Reproduction:** Click the Edit button on any comment bubble → bubble immediately jumps to top

## Suspect Commits

Recent fixes that touched affected components:
- `dd2c6d1` — CR-01: useTextSelection.ts boundary condition `>` → `>=`
- `0b31427` — CR-02: CommentBubble.tsx added `onMouseDown preventDefault` to Save Changes button
- `48f9bbc` — CR-03/WR-04: ReviewerV2Shell.tsx clear editingId + focusedCommentId on remove
- `dab1412` — WR-01: CommentPane.tsx added scroll event listener
- `361fe92` — WR-02: ContentPane.tsx wrapped handleFormCancel in useCallback
- `31b3cdc` — WR-02: ContentPane.test.ts updated for useCallback
- `153dcc3` — WR-03: GutterIcon.test.ts path fix
- `6b36c0f` — WR-05: ContentPane.tsx + SelectionToolbar.tsx clamp popup top to viewport
- `3d81abb` — WR-06: useSectionAnnotationCounts.ts move planRef.current inside useMemo

## Current Focus

hypothesis: "position: sticky in CommentPane causes editing bubble to pin to top of comment pane viewport"
test: ""
expecting: ""
next_action: "RESOLVED"
reasoning_checkpoint: "Fixed by removing sticky conditional, always using absolute positioning"

## Evidence

- `CommentPane.tsx` lines 118–121: the wrapperStyle conditional switched from `position: absolute; top: layoutItem.top` to `position: sticky; top: 16` when `editingId === ann.id`
- `position: sticky; top: 16` pins the bubble 16px from the TOP of the scrolling comment pane viewport — this is the "jump to y=0" behavior
- The sticky behavior was introduced in commit `dd528a9` (feat 21-03) with intent to keep the editing bubble visible while scrolling, but it directly caused the jump-to-top bug
- `CommentPane.test.ts` lines 63–69 explicitly enforced the broken behavior with assertions for `position: 'sticky'` and `top: 16`

## Eliminated

- Not caused by scroll event listener (WR-01 / dab1412) — that commit only added a scroll listener, did not touch wrapperStyle
- Not caused by editingId wiring (48f9bbc) — that commit cleared dangling state, did not introduce the sticky positioning
- Not caused by any of the phase 21 fix commits — the root cause was in the original phase 21-03 implementation

## Resolution

root_cause: "CommentPane.tsx used `position: sticky; top: 16` for the editing bubble wrapper, which pins the bubble to 16px from the top of the comment pane scroll viewport instead of keeping it at its anchor position"
fix: "Removed the sticky/absolute conditional in CommentPane.tsx — all bubble wrappers now use `position: absolute; top: layoutItem.top` regardless of editing state. Updated CommentPane.test.ts to assert the correct absolute positioning and guard against sticky reintroduction."
verification: "All 315 tests pass (22 test files)"
files_changed: "ui/src/reviewer-v2/CommentPane.tsx, ui/src/reviewer-v2/CommentPane.test.ts"
