---
phase: 20-comment-pane
verified: 2026-05-21T08:39:00Z
status: human_needed
score: 9/10 must-haves verified
overrides_applied: 0
gaps:
  - truth: "CommentBubble renders an <article> with position:absolute, top from props, and a 3px left border colored per annotation.type"
    status: failed
    reason: "borderLeft is set to '3px solid {borderColor}' on line 39 of CommentBubble.tsx, then immediately overwritten by the border shorthand 'border: 1px solid var(--color-border)' on line 40. In React inline-style objects the border shorthand resets all four border sides, so borderLeft is silently discarded. The colored left-border visual affordance that identifies annotation type does not render."
    artifacts:
      - path: "ui/src/reviewer-v2/CommentBubble.tsx"
        issue: "baseStyle object: borderLeft (line 39) clobbered by border shorthand (line 40). Fix: move borderLeft after border, or use borderLeftWidth/borderLeftStyle/borderLeftColor instead of borderLeft."
    missing:
      - "Reorder or replace the border/borderLeft properties so the 3px colored left border is not overridden"
human_verification:
  - test: "Verify bidirectional hover (COMMENT-02) works live in the browser"
    expected: "Direction 1 (bubble->anchor): hovering a CommentBubble highlights its anchor text in the center pane via the comment-hover CSS Highlight. Direction 2 (anchor->bubble): mousing over anchor text in ContentPane highlights the matching CommentBubble (isHovered=true styling). Both directions clear correctly when cursor moves away."
    why_human: "CSS.highlights API behavior and caretRangeFromPoint cursor resolution cannot be verified from source inspection alone. Task 5 of Plan 03 was auto-approved in --auto mode without a live browser session."
  - test: "Verify annotation-type colored left border renders on CommentBubble"
    expected: "After fixing the WR-01 borderLeft/border ordering bug: 'Comment' pill annotations show a blue left border, 'Delete' shows red, 'Replace' shows amber — matching the var(--color-annotation-*) tokens."
    why_human: "Requires visual inspection in the browser after the code fix is applied. Cannot be verified from source inspection once the ordering bug is corrected."
  - test: "Verify COMMENT-01 anchor Y positioning and scroll-follow"
    expected: "Each bubble floats at the vertical level of its anchor text. Scrolling the center pane reflows bubble Y positions in real time with no visible lag or bubbles stuck at the top."
    why_human: "Requires live browser interaction; getBoundingClientRect + scrollTop arithmetic cannot be asserted from source-inspection tests alone."
  - test: "Verify COMMENT-03 overlap collapse in the browser"
    expected: "Creating 3+ annotations in a small vertical span: non-focused bubbles clip to 2-line preview (opacity 0.85); clicking a bubble expands it (full height, snaps to anchorY); the previously focused bubble collapses. All bubbles remain reachable by scrolling."
    why_human: "computeCommentLayout is unit-tested, but the visual outcome (correct heights, clamp rendering, z-index stacking) requires live browser verification."
---

# Phase 20: comment-pane Verification Report

**Phase Goal:** Build a scrollable comment sidebar with anchor-aligned bubbles, bidirectional hover (COMMENT-02), and overlap collapse (COMMENT-03).
**Verified:** 2026-05-21T08:39:00Z
**Status:** human_needed (1 code gap + 4 human verification items)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Annotation type carries anchorStart and anchorEnd as required number fields | VERIFIED | `ui/src/reviewer-v2/types.ts` lines 8-9: `anchorStart: number` and `anchorEnd: number` present as non-optional fields |
| 2 | computeCommentLayout returns top = anchorY for a single non-expanded item | VERIFIED | `useCommentLayout.ts` lines 31-33; unit test 1 passes (5/5 tests green) |
| 3 | computeCommentLayout pushes overlapping items down by previous height + 8px gap | VERIFIED | Algorithm lines 31-36: `previousBottom = top + height + GAP`; test 2 (overlap) passes |
| 4 | An item pushed more than 40px below its anchorY is marked isCompact: true | VERIFIED | Line 33: `const isCompact = top > idealTop + PUSH_THRESHOLD`; PUSH_THRESHOLD=40 constant confirmed |
| 5 | An expanded (focused) item always receives top = anchorY regardless of preceding placement | VERIFIED | Lines 25-29: expanded branch unconditionally sets `top = item.anchorY`; test 3 (focused-snap) passes |
| 6 | computeCommentLayout is importable as a named export from hooks/useCommentLayout.ts and runs without any DOM or React renderer | VERIFIED | `export function computeCommentLayout` confirmed; zero React imports in the file; 5/5 unit tests pass without DOM |
| 7 | ::highlight(comment-hover) CSS rule exists in index.css for both dark and [data-theme=light] selectors | VERIFIED | `ui/src/index.css` lines 216 and 220 confirmed by grep |
| 8 | CommentBubble renders an \<article\> with position:absolute, top from props, and a 3px left border colored per annotation.type | FAILED | `borderLeft: '3px solid ${borderColor}'` (line 39) is immediately overwritten by `border: '1px solid var(--color-border)'` (line 40). The border shorthand resets all four border sides including borderLeft. The colored left border does not render. |
| 9 | CommentPane uses computeCommentLayout to place bubbles and renders a position:relative wrapper with absolutely positioned bubbles | VERIFIED | `CommentPane.tsx` imports `computeCommentLayout` line 4; calls it line 95; renders `<div style={{ position: 'relative', minHeight: '100%' }}>` line 98/61 |
| 10 | ReviewerV2Shell owns annotations, hoveredCommentId, focusedCommentId, planRef and wires CommentPane + ContentPane with full prop contract | VERIFIED | `ReviewerV2Shell.tsx`: `useAnnotations()` line 13; `hoveredCommentId` useState line 14; `focusedCommentId` useState line 15; `planRef = useRef<HTMLDivElement>` line 10; `<CommentPane>` mounted lines 97-106 with full prop set; `aria-label="Comments"` on aside line 87 |

**Score:** 9/10 truths verified (1 FAILED — borderLeft/border shorthand collision)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `ui/src/reviewer-v2/types.ts` | Extended Annotation interface with anchorStart, anchorEnd | VERIFIED | Both fields present as required (non-optional) |
| `ui/src/reviewer-v2/hooks/useCommentLayout.ts` | Exported pure function computeCommentLayout | VERIFIED | `export function computeCommentLayout` confirmed; COMPACT_HEIGHT=48, GAP=8, PUSH_THRESHOLD=40 |
| `ui/src/reviewer-v2/hooks/useCommentLayout.test.ts` | 5 unit tests | VERIFIED | 5/5 passing |
| `ui/src/index.css` | ::highlight(comment-hover) dark + light | VERIFIED | Both variants confirmed at lines 216, 220 |
| `ui/src/reviewer-v2/CommentBubble.tsx` | article with position:absolute, type-colored left border | STUB | position:absolute confirmed; left border type-coloring broken by borderLeft/border overwrite (WR-01) |
| `ui/src/reviewer-v2/CommentBubble.test.ts` | 11 source-inspection tests | VERIFIED | 11/11 passing — NOTE: tests check source contains `var(--color-annotation-comment)` which is true, but do not check rendering precedence |
| `ui/src/reviewer-v2/CommentPane.tsx` | Scroll/resize subscription, layout, bubble rendering | VERIFIED | scroll listener with passive:true, ResizeObserver, computeCommentLayout, CommentBubble rendering all confirmed |
| `ui/src/reviewer-v2/CommentPane.test.ts` | 13 source-inspection tests | VERIFIED | 13/13 passing |
| `ui/src/reviewer-v2/ReviewerV2Shell.tsx` | State owner with CommentPane mounted | VERIFIED | All state pairs confirmed; CommentPane mounted with full prop set |
| `ui/src/reviewer-v2/ReviewerV2Shell.test.ts` | Source-inspection structural tests | VERIFIED | 16/16 passing |
| `ui/src/reviewer-v2/ContentPane.tsx` | CSS Highlights effect + onMouseMove hover + handleAction dispatch | VERIFIED | CSS.highlights.set with COMMENT_HOVER_HIGHLIGHT, offsetFromPoint in onMouseMove, handleAction dispatches with synchronous getOffsets() capture |
| `ui/src/reviewer-v2/ContentPane.test.ts` | Extended tests for CSS Highlights and annotation creation | VERIFIED | 34/34 passing |
| `ui/src/reviewer-v2/hooks/offsetFromPoint.ts` | Pure helper caretRangeFromPoint + fallback | VERIFIED | Export confirmed; caretRangeFromPoint and caretPositionFromPoint both handled; no React imports |
| `ui/src/reviewer-v2/hooks/offsetFromPoint.test.ts` | 5 TDD tests | VERIFIED | 5/5 passing |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `hooks/useCommentLayout.ts` | `CommentPane.tsx` | `import { computeCommentLayout }` | WIRED | Line 4 of CommentPane.tsx; called at line 95 |
| `types.ts` anchorStart/anchorEnd | `CommentPane.tsx` recompute() | `ann.anchorStart, ann.anchorEnd` passed to rangeFromOffsets | WIRED | CommentPane.tsx line 39 |
| `CommentPane.tsx` onMouseEnter | `ContentPane.tsx` CSS.highlights.set | Shell `hoveredCommentId` state | WIRED | Shell passes hoveredCommentId to both; ContentPane effect confirmed |
| `ContentPane.tsx` onMouseMove | `ReviewerV2Shell.tsx` setHoveredCommentId | `onHoverCommentId` prop + `offsetFromPoint` | WIRED | ContentPane.tsx lines 115-124; Shell line 81 |
| `hooks/offsetFromPoint.ts` | `ContentPane.tsx` handleMouseMove | `import { offsetFromPoint }` | WIRED | ContentPane.tsx line 3; called line 117 |
| `ReviewerV2Shell.tsx` planRef | `CommentPane.tsx` rangeFromOffsets | `planRef={planRef}` prop | WIRED | Shell lines 80, 103; CommentPane receives it |
| `ContentPane.tsx` handleAction | `ReviewerV2Shell.tsx` addAnnotation | `onAddAnnotation` prop | WIRED | Shell passes `onAddAnnotation={addAnnotation}` line 77; ContentPane dispatches line 93 |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ui/src/reviewer-v2/CommentBubble.tsx` | 39-40 | `borderLeft` overwritten by `border` shorthand in same style object | BLOCKER | The 3px annotation-type colored left border (key visual affordance for COMMENT-01/COMMENT-03) does not render. `border` shorthand resets `borderLeft` to `1px solid var(--color-border)`. Fix: move `borderLeft` after `border` in the object literal, or use `borderLeftWidth`/`borderLeftStyle`/`borderLeftColor` separately. |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| COMMENT-01 | 20-01, 20-02, 20-03 | Anchor Y positioning + scroll-follow | NEEDS HUMAN | CommentPane scroll/resize subscription and anchorY formula implemented and structurally verified; live browser confirmation not performed (Task 5 auto-approved) |
| COMMENT-02 | 20-01, 20-02, 20-03 | Bidirectional hover | NEEDS HUMAN | Both directions implemented in code (CSS.highlights effect + offsetFromPoint + onMouseMove); live browser confirmation not performed |
| COMMENT-03 | 20-01, 20-02, 20-03 | Overlap collapse with compact/expanded states | PARTIAL | computeCommentLayout algorithm verified by unit tests; CommentPane passes layout to CommentBubble; BUT CommentBubble's visual compact/expanded rendering relies on the left-border which is broken (WR-01); live browser confirmation not performed |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| computeCommentLayout unit tests (5 cases) | `npx vitest run src/reviewer-v2/hooks/useCommentLayout.test.ts` | 5/5 passed | PASS |
| offsetFromPoint unit tests (5 cases) | `npx vitest run src/reviewer-v2/hooks/offsetFromPoint.test.ts` | 5/5 passed | PASS |
| CommentBubble source-inspection tests | `npx vitest run src/reviewer-v2/CommentBubble.test.ts` | 11/11 passed | PASS — tests verify string presence only, do not catch borderLeft/border ordering bug |
| CommentPane structural tests | `npx vitest run src/reviewer-v2/CommentPane.test.ts` | 13/13 passed | PASS |
| ReviewerV2Shell structural tests | `npx vitest run src/reviewer-v2/ReviewerV2Shell.test.ts` | 16/16 passed | PASS |
| ContentPane extended tests | `npx vitest run src/reviewer-v2/ContentPane.test.ts` | 34/34 passed | PASS |
| Full suite | `npm test` | 208/208 passed, 20 test files | PASS |
| Live bidirectional hover (COMMENT-02) | Browser at /v2 | Not performed | SKIP — human needed |
| Left border renders correctly per annotation type | Browser at /v2 | Not performed | SKIP — blocked by WR-01 code defect |

---

## Human Verification Required

### 1. Fix and Verify Annotation-Type Left Border on CommentBubble

**Test:** In `ui/src/reviewer-v2/CommentBubble.tsx` fix the `baseStyle` object so `borderLeft` appears AFTER `border` (or replace with `borderLeftWidth`/`borderLeftStyle`/`borderLeftColor`), then open `/v2`, create one annotation of each type (Comment, Delete, Replace), and confirm each bubble displays a distinct 3px colored left border.
**Expected:** Comment annotations show a blue left border (`var(--color-annotation-comment)`), Delete shows red (`var(--color-annotation-delete)`), Replace shows amber (`var(--color-annotation-replace)`).
**Why human:** Requires a code fix first, then visual inspection in the browser.

### 2. Bidirectional Hover (COMMENT-02) — Both Directions

**Test:** Start the dev server (`cd ui && npm run dev`), open `http://localhost:5173/v2`, create two annotations. (a) Hover a CommentBubble in the right column — the anchor text in the center pane should show a subtle background highlight via the `comment-hover` CSS Highlight. Move the cursor off the bubble — the highlight should clear. (b) Move the cursor over the anchor text of an annotation in the center pane — the matching CommentBubble in the right column should respond with `isHovered=true` styling (opacity 1 + 1px focus ring). Move to non-anchor text — all bubbles lose hover state.
**Expected:** Both directions of bidirectional hover work independently and clear correctly.
**Why human:** CSS.highlights API and caretRangeFromPoint cursor resolution cannot be verified from source inspection. Task 5 of Plan 03 was auto-approved without a live browser session.

### 3. Anchor Y Positioning and Scroll-Follow (COMMENT-01)

**Test:** Create annotations at different vertical positions in the document. Scroll the center content pane up and down.
**Expected:** Each bubble's vertical position tracks its anchor text with no visible lag. No bubbles stuck at the top of the column.
**Why human:** Requires live interaction; getBoundingClientRect + scrollTop arithmetic cannot be asserted statically.

### 4. Overlap Collapse and Focus Expand (COMMENT-03)

**Test:** Create 3+ annotations within a small vertical span. Confirm non-focused bubbles are shown in compact 2-line preview form (opacity 0.85). Click each bubble in turn and confirm it expands while others collapse. Confirm all bubbles remain reachable by scrolling the right column.
**Expected:** computeCommentLayout correctly drives compact/expanded visual states in the browser, including the left-border after the WR-01 fix is applied.
**Why human:** Visual rendering of height, text clamp, z-index stacking cannot be confirmed from unit tests alone.

---

## Gaps Summary

**1 BLOCKER — CommentBubble.tsx borderLeft/border shorthand collision (WR-01)**

In `CommentBubble.tsx` the `baseStyle` React inline-style object sets `borderLeft: '3px solid ${borderColor}'` on line 39, then immediately sets `border: '1px solid var(--color-border)'` on line 40. In React's inline-style merging (and in the CSS shorthand semantics the browser applies), the `border` shorthand resets all four border sides. The result is that all four borders render as `1px solid var(--color-border)` — the 3px colored left border that visually identifies the annotation type (comment/delete/replace) is silently discarded.

This is a behavioral defect, not a test gap. The source-inspection tests for CommentBubble confirm the strings `var(--color-annotation-comment/delete/replace)` appear in the file, but they do not check property ordering or rendering precedence, so they pass despite the bug.

**Fix:** In `baseStyle`, move `borderLeft` to appear after `border`, or replace it with:
```
borderLeftWidth: '3px',
borderLeftStyle: 'solid',
borderLeftColor: borderColor,
```

**Human verification items:** 4 items requiring live browser confirmation (including the WR-01 fix verification). Task 5 of Plan 03 was auto-approved without human observation.

---

_Verified: 2026-05-21T08:39:00Z_
_Verifier: Claude (gsd-verifier)_
