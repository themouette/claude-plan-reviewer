---
phase: 02-annotations-diff
plan: 04
type: summary
status: complete
commit: a8bfa2e
date: 2026-04-09
---

# 02-04 Summary: Human Verification

## What Was Built

Complete Phase 2 UX, verified by human in browser. No regressions on Phase 1 functionality.

### Bugs fixed during extended verification (across prior sessions):

| Bug | Root cause | Fix |
|-----|-----------|-----|
| Selection highlight disappeared after clicking Comment | Live Range objects collapsed during React reconciliation of `dangerouslySetInnerHTML` | Offset-based tracking: `getRangeOffsets`/`rangeFromOffsets` store character offsets, rebuilt to Range on demand |
| Annotation highlights lost after re-render | Stored Ranges collapsed; `useEffect([annotations])` ran after paint | `useLayoutEffect` (no deps) rebuilds CSS Highlights from `annotationOffsetsRef` every render |
| Hover text→card not working | `planRef.current` was null at `useEffect` setup time | Moved listener to `document.addEventListener('mousemove')`, reads `planRef.current` fresh on each event |
| Comment textarea not auto-focused | Timing: focus fired before card was in DOM | `useLayoutEffect` queries `[data-annotation-id] textarea` after `focusAnnotationId` state change |
| Annotation cards not aligned to selection Y | `OverallCommentField` at sidebar top offset the cards scroll area | Moved overall comment to bottom action bar; `computeAndApplyLayout()` imperative DOM positioning now correct |

### Architecture decisions:

- `annotationOffsetsRef`: `Map<id, {start, end}>` — survives React reconciliation, provides stable anchors
- `computeAndApplyLayout()`: imperative DOM updates (not React state) for scroll-driven card positioning
- `data-cards-scroll` `overflow:hidden`, `scrollTop` synced to plan tab — cards move with plan without independent scroll
- Overall comment in bottom action bar — no sidebar offset, cleaner information hierarchy

## Human Verification Results

User confirmed:
- Annotation cards align to selection Y level in sidebar ✓
- Sidebar cards scroll in sync with plan scroll ✓
- Hover over highlighted text highlights matching sidebar card ✓
- Clicking Comment auto-focuses textarea ✓
- Overall comment field in bottom bar, no offset on annotation cards ✓

## Files Modified

- `ui/src/App.tsx` — two-column layout, annotation state, aligned card layout, overall comment in bar
- `ui/src/components/AnnotationSidebar.tsx` — removed OverallCommentField, cleaned up props
- `ui/src/hooks/useTextSelection.ts` — offset-based Range tracking
- `ui/src/components/DiffView.tsx` — diff rendering
- `ui/src/index.css` — annotation highlight CSS custom highlight registry
- `src/main.rs` — diff extraction plumbing

## Phase 2 Requirements Status

| Req | Description | Status |
|-----|-------------|--------|
| ANN-01 | Text selection triggers annotation affordance | ✓ Verified |
| ANN-02 | Comment / Delete / Replace annotation types | ✓ Verified |
| ANN-03 | Annotation cards persist and are removable | ✓ Verified |
| ANN-04 | Overall comment field | ✓ Verified (now in bottom bar) |
| ANN-05 | Annotations serialized into deny message | ✓ Verified |
| DIFF-01 | Diff view renders working-tree changes | ✓ Verified |
| DIFF-02 | Syntax-highlighted unified diff | ✓ Verified |
| DIFF-03 | Empty state when no changes | ✓ Verified |
