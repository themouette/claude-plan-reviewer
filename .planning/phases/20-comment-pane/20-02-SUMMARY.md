---
plan: 20-02
phase: 20-comment-pane
status: complete
completed: 2026-05-21
commits:
  - 8cbb900
  - 174db13
key-files:
  created:
    - ui/src/reviewer-v2/CommentBubble.tsx
    - ui/src/reviewer-v2/CommentBubble.test.ts
    - ui/src/reviewer-v2/CommentPane.tsx
    - ui/src/reviewer-v2/CommentPane.test.ts
---

## Summary

Built the two presentational components that form the comment sidebar for Phase 20.

### CommentBubble.tsx

Single-comment article with compact/expanded states:
- Renders an `<article>` with `position: 'absolute'`, `top` from props, left/right=0
- 3px left border colored by `annotation.type` via CSS variable tokens (`var(--color-annotation-comment/delete/replace)`)
- Compact state (`isCompact && !isFocused`): 48px height, `-webkit-box` 2-line clamp, `opacity: 0.85`
- Focused/expanded state: auto height, `boxShadow: '0 0 0 2px var(--color-focus)'`, `zIndex: 2`
- Hovered state: `opacity: 1` + 1px focus-color ring (2px ring wins when also focused)
- `aria-label` and `aria-expanded` per UI-SPEC contract
- Wires `onMouseEnter`, `onMouseLeave`, `onClick` to root `<article>`
- Presentational only — no hooks, no effects, no internal state

### CommentPane.tsx

Container that positions bubbles alongside anchor text:
- Local `anchorYMap: Map<string, number>` state
- Single `useEffect` watching `[mainRef, planRef, annotations]`: attaches `scroll` listener with `{ passive: true }`, creates `ResizeObserver`, runs `recompute()` on every event + immediately on mount
- `recompute()` formula: `anchorY = rangeRect.top - containerRect.top + el.scrollTop`
- Calls `computeCommentLayout` to produce final `top` + `isCompact` per bubble
- Renders `<div style={{ position: 'relative', minHeight: '100%' }}>` wrapper with one `<CommentBubble>` per annotation
- Empty-state: "No comments yet" / "Select text or hover a paragraph to add a comment." copy
- Does NOT import `sidenotes` or `InlineAnchor` (rejection guards enforced by tests)

### Tests

13 source-inspection tests for CommentPane (scroll subscription, passive flag, cleanup, ResizeObserver disconnect, rangeFromOffsets, computeCommentLayout, sidenotes rejection, empty-state copy) and 11 tests for CommentBubble (position:absolute, annotation-type border colors, aria-expanded, WebkitLineClamp, event handlers).

### Self-Check: PASSED

- All 18 test files pass (167 tests total)
- No regressions in prior phases
- No InlineAnchor or sidenotes references
- Lint errors are pre-existing in useTextSelection.ts/test.ts (not introduced by this plan)
