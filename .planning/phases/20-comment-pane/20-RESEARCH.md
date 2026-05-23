# Phase 20: Comment Pane - Research

**Researched:** 2026-05-21
**Domain:** React comment sidebar — anchor-Y positioning, bidirectional hover, overlap/collapse layout
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Add `anchorStart: number` and `anchorEnd: number` character offsets to the `Annotation` type. Captured from `getOffsets()` in `useTextSelection` at creation time.
- **D-02:** ContentPane captures offsets synchronously in `handleAction` and passes them to Shell via `onAddAnnotation(type, anchorText, anchorStart, anchorEnd)`. Shell generates the id and dispatches to `useAnnotations.addAnnotation`.
- **D-03:** CommentPane subscribes to `mainRef` scroll event and `ResizeObserver` on the content area. On each event, re-computes `Map<id, anchorY>` using `rangeFromOffsets()` + `getBoundingClientRect()`.
- **D-04:** Right comment column uses `overflow: auto` with tall relatively-positioned inner wrapper. Bubbles `position: absolute; top: anchorY`. Sidebar scrollbar provides vertical reach.
- **D-05:** Research agent MUST evaluate `sidenotes@2.0.1` against COMMENT-03 requirements before planning. See verdict in `## sidenotes@2.0.1 Evaluation` below.
- **D-06:** If custom layout hook is necessary: `computeCommentLayout(items: Array<{ id, anchorY, isExpanded, height }>) => Array<{ id, top, isCompact }>` — greedy top-down algorithm. Exported pure function, unit-testable without browser.
- **D-07:** Phase 20 wires annotation creation minimally — `anchorText` as comment content (no textarea). Phase 21 replaces UX. Callback signature `onAddAnnotation(type, anchorText, anchorStart, anchorEnd)` is the stable contract.
- **D-08:** `useAnnotations` lifted from ContentPane to `ReviewerV2Shell`. Shell passes `addAnnotation` to ContentPane and `annotations` to CommentPane.
- **D-09:** `hoveredCommentId: string | null` + `setHoveredCommentId` in `ReviewerV2Shell`. Passed to both ContentPane and CommentPane.
- **D-10:** `focusedCommentId: string | null` + `setFocusedCommentId` in `ReviewerV2Shell`. Clicking a bubble calls `setFocusedCommentId(id)`.
- **D-11:** `hoveredCommentId` change triggers `CSS.highlights.set('comment-hover', new Highlight(range))` in ContentPane using `rangeFromOffsets(planRef.current, anchorStart, anchorEnd)`.

### Claude's Discretion

- Exact scroll listener approach (passive event listener vs. `onScroll` prop on `<main>`).
- Whether `Map<id, y>` position state lives in CommentPane local state or a dedicated `useCommentPositions` hook.
- CSS details for compact (2-line) vs expanded comment card states.
- Whether `sidenotes` is installed as `devDependency` during evaluation only, or runtime dependency if adopted.

### Deferred Ideas (OUT OF SCOPE)

- **sidenotes fallback approach** — specific algorithm deferred until research phase identifies the failure mode. (Now resolved — see verdict.)
- **Paragraph-hover → CommentPane interaction** — CONTENT-02 paragraph hover → gutter icon → comment highlight is NOT in COMMENT-02's scope. Deferred to Phase 21 or later.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMMENT-01 | Comments float at vertical level of anchor text; reposition as content pane scrolls; content extends if comments overflow below last line | D-03/D-04: ResizeObserver + scroll subscription; absolute positioning in overflow:auto column |
| COMMENT-02 | Hovering a comment highlights anchor text; hovering anchor text highlights comment — bidirectional, shared `hoveredCommentId` state | D-09/D-11: CSS Highlights API `comment-hover` highlight; shared state in Shell |
| COMMENT-03 | Overlapping comments collapse to compact (2-line preview); focused card expands to full height at anchor Y; all comments reachable by scroll; evaluate sidenotes@2.0.1 first | D-05/D-06: sidenotes evaluated and rejected; custom `computeCommentLayout` is the approach |

</phase_requirements>

---

## Summary

Phase 20 builds the comment sidebar for the v2 reviewer. Three capabilities must be delivered: anchored Y-positioning (COMMENT-01), bidirectional hover highlighting (COMMENT-02), and overlap/collapse layout (COMMENT-03). All three are wired through shared state in `ReviewerV2Shell`.

The anchor-Y calculation reuses `rangeFromOffsets()` from `useTextSelection.ts` — already exported and tested. The CSS Highlights API pattern for `comment-hover` mirrors the existing `selection-lock` highlight and is already mocked in `vitest.setup.ts`. The `annotationReducer` needs two new fields (`anchorStart`, `anchorEnd`) on `Annotation`; existing tests cover the reducer and will extend naturally.

The `sidenotes@2.0.1` library was evaluated against COMMENT-03 requirements and is **rejected** (see evaluation below). The custom `computeCommentLayout` pure function (D-06) is the implementation path. It produces a `{ id, top, isCompact }[]` output from `{ id, anchorY, isExpanded, height }[]` input — pure, unit-testable, no DOM dependency.

**Primary recommendation:** Implement `computeCommentLayout` as an exported pure function in `ui/src/reviewer-v2/hooks/useCommentLayout.ts`, subscribe to `mainRef` scroll and `ResizeObserver` for position recomputation, and use `CSS.highlights` for the anchor hover highlight — all consistent with Phase 17–19 established patterns.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Anchor Y resolution | Frontend (Browser) | — | `rangeFromOffsets()` walks live DOM text nodes; must be client-side |
| Scroll/resize subscription | Frontend (Browser) | — | `mainRef` scroll event + `ResizeObserver` — browser-only APIs |
| Overlap/collapse layout | Frontend (Browser) | — | Pure geometry computation; runs in browser after anchor Y known |
| Hover state management | Frontend (Shell) | — | `hoveredCommentId` lifted to Shell; flows down to ContentPane + CommentPane |
| Focus state management | Frontend (Shell) | — | `focusedCommentId` lifted to Shell; drives expand/collapse in CommentPane |
| CSS anchor highlight | Frontend (Browser) | — | `CSS.highlights` API; applies `::highlight(comment-hover)` in ContentPane |
| Annotation persistence | Frontend (Shell) | — | `useAnnotations` reducer lifted to Shell; no server involvement in Phase 20 |

---

## sidenotes@2.0.1 Evaluation

**Required by D-05 / COMMENT-03 — evaluated before planning.**

### Registry check [VERIFIED: npm registry]

- Package: `sidenotes@2.0.1`
- Published: 2026-04-20 (v2 major released 2026-04-20, ~1 month ago)
- Repo: `github.com/curvenote/sidenotes` (MIT, curvenote org)
- Size: 59,699 bytes unpacked
- No `postinstall` script [VERIFIED: `npm view sidenotes scripts.postinstall` returned empty]
- Peer deps: `classnames ^2.5.1`, `react >=18`, `react-dom >=18`, `uuid >=9`

### API audit [VERIFIED: github.com/curvenote/sidenotes source]

| COMMENT-03 requirement | sidenotes@2.0.1 capability | Compatible? |
|------------------------|---------------------------|-------------|
| Accept external Y positions (CommentPane computes anchorY from `rangeFromOffsets`) | **No.** Positioning is computed internally by walking `offsetParent` chain until it hits an `<article>` element. There is no API to supply a pre-computed Y | **NO** |
| Expose compact/expanded state | **No.** Only `selected`/unselected via a CSS class toggle. No compact 2-line preview concept | **NO** |
| Work inside a scrollable container (`mainRef` is `overflow:auto` `<main>`) | **No.** `getTopLeft()` walks `offsetParent` and stops at `<article>` — scroll containers in the offset chain produce incorrect positions | **NO** |
| Require InlineAnchor in DOM children | **Yes.** `InlineAnchor` must wrap DOM nodes inside `AnchorBase`. This is incompatible with Phase 18's BLOCKING constraint (no DOM mutation inside `dangerouslySetInnerHTML` children) | **BLOCKED** |
| All comments reachable by scroll | Partial — the column overflow model would need reconstruction | Moot — blocked above |

### Verdict: REJECTED

`sidenotes@2.0.1` is architecturally incompatible with this project:

1. It computes positions from `offsetParent` chains terminating at `<article>` — our scroll container is `<main>`, not wrapped in `<article>`, and positions must be computed from `rangeFromOffsets()` + `getBoundingClientRect()`.
2. It requires `InlineAnchor` wrapper components in the rendered document — incompatible with the Phase 18 BLOCKING constraint against DOM mutation inside `dangerouslySetInnerHTML` children.
3. It has no compact/2-line-preview concept.

**Decision (D-06 confirmed):** Implement `computeCommentLayout` as a custom exported pure function.

---

## Standard Stack

### Core (no new packages required)

All capabilities are achieved with existing project dependencies and browser APIs.

| Library / API | Source | Purpose | Status |
|---------------|--------|---------|--------|
| React 19 `useState` / `useReducer` | Already installed | Shell state: `hoveredCommentId`, `focusedCommentId`, `annotations` | Existing |
| React 19 `useEffect` / `useRef` | Already installed | Scroll subscription, ResizeObserver, anchor Y map | Existing |
| `rangeFromOffsets()` | `ui/src/reviewer-v2/hooks/useTextSelection.ts` | Reconstruct DOM Range from character offsets for Y resolution and CSS highlight | Existing, exported |
| CSS Highlights API (`CSS.highlights`) | Browser built-in | `comment-hover` highlight on anchor text | Existing pattern, already mocked in vitest.setup.ts |
| `ResizeObserver` | Browser built-in | Recompute anchor Y on content resize | Already mocked in vitest.setup.ts |
| `annotationReducer` | `ui/src/reviewer-v2/useAnnotations.ts` | Extended with `anchorStart`/`anchorEnd` on `Annotation` type | Existing, needs type extension |

### No New Runtime Packages

No new `npm install` is required for Phase 20. `sidenotes` is rejected. The custom `computeCommentLayout` function is self-contained pure TypeScript.

---

## Package Legitimacy Audit

> No new packages are installed in Phase 20. sidenotes@2.0.1 was evaluated and rejected before any install. No audit table is required.

**Packages removed due to evaluation:** `sidenotes@2.0.1` — rejected for architectural incompatibility (not a legitimacy concern; the package itself is legitimate but unsuitable).

---

## Architecture Patterns

### System Architecture Diagram

```
ReviewerV2Shell (state owner)
  │
  ├── annotations[]             ← useAnnotations reducer (lifted from ContentPane)
  ├── hoveredCommentId          ← useState, bidirectional hover signal
  └── focusedCommentId          ← useState, last-clicked bubble id
       │
       ├──► ContentPane
       │     ├── props: onAddAnnotation, hoveredCommentId
       │     ├── handleAction → onAddAnnotation(type, anchorText, anchorStart, anchorEnd)
       │     └── useEffect(hoveredCommentId) → CSS.highlights.set('comment-hover', range)
       │
       └──► CommentPane
             ├── props: annotations, hoveredCommentId, focusedCommentId, mainRef, planRef,
             │          onHover, onFocus
             ├── useEffect: subscribe mainRef scroll + ResizeObserver(planRef)
             │   └── recompute Map<id, anchorY> via rangeFromOffsets() + getBoundingClientRect()
             ├── computeCommentLayout(items) → [{ id, top, isCompact }]
             └── render: <article> bubbles at position:absolute top:{computed}
```

### Recommended Project Structure

```
ui/src/reviewer-v2/
├── CommentPane.tsx              # new — receives annotations, hover/focus state, mainRef, planRef
├── CommentBubble.tsx            # new — single comment card (compact / expanded states)
├── hooks/
│   ├── useTextSelection.ts      # existing — rangeFromOffsets() reused
│   └── useCommentLayout.ts      # new — exports computeCommentLayout() pure function
├── useAnnotations.ts            # existing — extend Annotation type + reducer
├── types.ts                     # existing — add anchorStart, anchorEnd to Annotation
└── ReviewerV2Shell.tsx          # existing — lift useAnnotations, add hover/focus state
```

### Pattern 1: Anchor Y Resolution

**What:** Resolve a DOM Range from stored character offsets, then compute its Y position relative to the scroll container's scrolled coordinate system.

**When to use:** On mount, on scroll, on resize — any time `anchorY` values need refreshing.

```typescript
// Source: existing rangeFromOffsets in useTextSelection.ts + Phase 19/20 decision D-03
function computeAnchorY(
  planRef: React.RefObject<HTMLDivElement | null>,
  mainRef: React.RefObject<HTMLElement | null>,
  anchorStart: number,
  anchorEnd: number,
): number | null {
  if (!planRef.current || !mainRef.current) return null
  const range = rangeFromOffsets(planRef.current, anchorStart, anchorEnd)
  if (!range) return null
  const rangeRect = range.getBoundingClientRect()
  const containerRect = planRef.current.getBoundingClientRect()
  // anchorY is relative to the inner wrapper (absolute positioning context),
  // accounting for the scroll offset of the mainRef scroll container.
  return rangeRect.top - containerRect.top + mainRef.current.scrollTop
}
```

**Formula from UI-SPEC:**
`anchorY = range.getBoundingClientRect().top - planRef.current.getBoundingClientRect().top + mainRef.current.scrollTop`

### Pattern 2: computeCommentLayout (greedy top-down)

**What:** Pure function mapping `{ id, anchorY, isExpanded, height }[]` to `{ id, top, isCompact }[]`. No DOM, no browser APIs. Directly unit-testable.

**When to use:** Whenever `anchorYMap` or `focusedCommentId` changes.

```typescript
// Source: D-06 in CONTEXT.md + UI-SPEC algorithm
export function computeCommentLayout(
  items: Array<{ id: string; anchorY: number; isExpanded: boolean; height: number }>,
): Array<{ id: string; top: number; isCompact: boolean }> {
  // 1. Process the focused (expanded) item first — it always snaps to its anchorY.
  //    Remaining items are sorted by anchorY ascending.
  const COMPACT_HEIGHT = 48
  const GAP = 8
  const PUSH_THRESHOLD = 40

  const expanded = items.find((i) => i.isExpanded)
  const rest = items.filter((i) => !i.isExpanded).sort((a, b) => a.anchorY - b.anchorY)

  // Insert expanded item back in its anchorY position
  const sorted = [...rest]
  if (expanded) {
    const insertIdx = sorted.findIndex((i) => i.anchorY > expanded.anchorY)
    if (insertIdx === -1) sorted.push(expanded)
    else sorted.splice(insertIdx, 0, expanded)
  }

  const result: Array<{ id: string; top: number; isCompact: boolean }> = []
  let previousBottom = 0

  for (const item of sorted) {
    if (item.isExpanded) {
      // Expanded item snaps to anchorY regardless of previous placement
      const top = item.anchorY
      previousBottom = top + item.height + GAP
      result.push({ id: item.id, top, isCompact: false })
    } else {
      const idealTop = item.anchorY
      const top = Math.max(idealTop, previousBottom)
      const isCompact = top > idealTop + PUSH_THRESHOLD
      const height = COMPACT_HEIGHT
      previousBottom = top + height + GAP
      result.push({ id: item.id, top, isCompact })
    }
  }
  return result
}
```

### Pattern 3: CSS Highlights API for comment-hover

**What:** Apply `::highlight(comment-hover)` to anchor text when `hoveredCommentId` changes. Mirrors existing `selection-lock` highlight pattern in `useTextSelection.ts`.

**When to use:** In ContentPane `useEffect` watching `hoveredCommentId` + `annotations`.

```typescript
// Source: useTextSelection.ts pattern + D-11 in CONTEXT.md
const COMMENT_HOVER_HIGHLIGHT = 'comment-hover'
const supportsHighlights =
  typeof CSS !== 'undefined' && typeof CSS.highlights !== 'undefined'

useEffect(() => {
  if (!supportsHighlights) return
  if (!hoveredCommentId || !planRef.current) {
    CSS.highlights.delete(COMMENT_HOVER_HIGHLIGHT)
    return
  }
  const annotation = annotations.find((a) => a.id === hoveredCommentId)
  if (!annotation) {
    CSS.highlights.delete(COMMENT_HOVER_HIGHLIGHT)
    return
  }
  const range = rangeFromOffsets(planRef.current, annotation.anchorStart, annotation.anchorEnd)
  if (range) {
    CSS.highlights.set(COMMENT_HOVER_HIGHLIGHT, new Highlight(range))
  }
}, [hoveredCommentId, annotations, planRef])
```

**Required CSS in `index.css`** (from UI-SPEC):
```css
::highlight(comment-hover) {
  background-color: rgba(255, 255, 255, 0.14);
  color: inherit;
}
[data-theme="light"] ::highlight(comment-hover) {
  background-color: rgba(0, 0, 0, 0.08);
  color: inherit;
}
```

### Pattern 4: useAnnotations Hook Lift

**What:** `useAnnotations` moves from ContentPane local usage to `ReviewerV2Shell`. ContentPane receives `onAddAnnotation` prop; CommentPane receives `annotations` prop.

**Mirrors:** How `sections`/`setSections` and `activeId`/`setActiveId` are already lifted in Shell for OutlinePane.

### Anti-Patterns to Avoid

- **Storing live Range objects in state:** React reconciliation collapses live Ranges. Always store `anchorStart`/`anchorEnd` offsets and reconstruct with `rangeFromOffsets()` on each render/event. [VERIFIED: established pattern in useTextSelection.ts]
- **DOM mutation inside `dangerouslySetInnerHTML` children:** Phase 18 BLOCKING constraint. CSS Highlights API is the correct approach — zero DOM mutation, works on live text nodes. [VERIFIED: Phase 18 CONTEXT.md constraint]
- **Using `@testing-library/react` for tests:** Phase 17 isolation rule. All tests drive logic through exported pure functions or source-code inspection. `computeCommentLayout` must be exported as a pure function for direct unit testing. [VERIFIED: Phase 17 CONTEXT.md D-03–D-06]
- **Using `sidenotes@2.0.1`:** Architecturally incompatible — requires `<article>` ancestor, `InlineAnchor` DOM wrapping, and computes positions internally. See rejection verdict above.
- **React state updates mid-drag:** Phase 18 BLOCKING constraint. Any new event listeners added in ContentPane must follow the same pattern as existing `useTextSelection.ts` (separate `mouseDown`/`mouseUp` tracking to guard against mid-drag re-renders).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Character-offset → DOM Range | Custom walker | `rangeFromOffsets()` already exported from `useTextSelection.ts` | Already tested, handles edge cases, used by selection-lock pattern |
| Anchor text highlighting | DOM mutation / wrapper spans | CSS Highlights API (`CSS.highlights.set`) | Phase 18 blocking constraint; already mocked in test setup |
| ResizeObserver mock in tests | Inline mock | `vitest.setup.ts` already provides global mock | Consistent with existing test infrastructure |
| Annotation state management | Custom useState array | `annotationReducer` + `useAnnotations` | Already exported, already tested |

**Key insight:** The hardest parts of this phase (offset serialization, CSS highlight application, ResizeObserver mocking) are already solved. Phase 20 is primarily wiring and a new pure layout algorithm.

---

## Common Pitfalls

### Pitfall 1: anchorY computed from viewport instead of scroll-adjusted coordinates

**What goes wrong:** `range.getBoundingClientRect().top` returns viewport-relative coordinates. If the content has been scrolled, `top` will be negative or smaller than expected. Bubbles appear at the wrong Y position.

**Why it happens:** `getBoundingClientRect()` is always relative to the viewport, not the document or the positioning container.

**How to avoid:** Always add `mainRef.current.scrollTop` to the result:
`anchorY = range.getBoundingClientRect().top - planRef.current.getBoundingClientRect().top + mainRef.current.scrollTop`

**Warning signs:** Comment bubbles that appear near the top of the sidebar regardless of where anchor text is in the document.

### Pitfall 2: Position recomputation missing after annotations array changes

**What goes wrong:** A new annotation is added but its `anchorY` is never computed. The bubble appears at `top: 0`.

**Why it happens:** The `anchorY` map is only updated on scroll/resize events, not when `annotations` changes.

**How to avoid:** Include `annotations` as a dependency in the effect that computes anchor Y positions. Recompute the full map whenever `annotations` changes.

### Pitfall 3: computeCommentLayout ordering bug with the focused item

**What goes wrong:** The focused (expanded) item gets pushed down by the greedy algorithm because it's processed in anchorY order. Result: focused item does NOT snap to its anchor Y.

**Why it happens:** A pure ascending-order greedy pass would push the focused item down from its anchor if a compact item above it is pushed into its zone.

**How to avoid:** Per D-06 and the UI-SPEC algorithm, the expanded item must be processed separately — it always gets `top = anchorY`, and the greedy pass must not push it. The reference implementation above processes the expanded item at its natural position in the sorted order but assigns `top = item.anchorY` unconditionally, resetting `previousBottom` accordingly.

### Pitfall 4: Missing `annotations.anchorStart`/`anchorEnd` on old annotations

**What goes wrong:** Annotations created before Phase 20's type extension won't have `anchorStart`/`anchorEnd` fields. `rangeFromOffsets(planRef, undefined, undefined)` returns `null` and the bubble gets no Y position.

**Why it happens:** The `Annotation` type is extended but existing test fixtures in `useAnnotations.test.ts` use the old shape.

**How to avoid:** Add `anchorStart: number` and `anchorEnd: number` to the `Annotation` interface in `types.ts` (required fields, not optional). Update `useAnnotations.test.ts` fixtures to include these fields. The TypeScript compiler will catch any unpatched test fixtures at compile time.

### Pitfall 5: Bubble height unknown on first layout pass

**What goes wrong:** `computeCommentLayout` needs the height of the expanded bubble to compute `previousBottom` correctly. On first render, the expanded bubble hasn't been measured yet.

**Why it happens:** `getBoundingClientRect()` returns correct dimensions only after React commits the DOM. During the first layout computation, the expanded bubble's height is 0 or estimated.

**How to avoid:** Use a two-pass approach: first pass uses `height: 0` for the expanded item (causing a possibly-incorrect `previousBottom`), then a `useLayoutEffect` measures the rendered bubble heights via `getBoundingClientRect()` and triggers a second layout computation. For Phase 20, using the `COMPACT_HEIGHT` constant (48px) as the initial fallback for all bubbles is acceptable since the expanded bubble will snap to `anchorY` regardless.

### Pitfall 6: Scroll listener added directly to `mainRef.current` without cleanup

**What goes wrong:** Scroll listener leaks across remounts, causing stale closure bugs or double-triggering position updates.

**Why it happens:** `mainRef.current` changes between renders. If the `addEventListener` is in a `useEffect` without the ref value captured at effect time, cleanup may remove a listener from a different element.

**How to avoid:**
```typescript
useEffect(() => {
  const el = mainRef.current
  if (!el) return
  const onScroll = () => { /* recompute */ }
  el.addEventListener('scroll', onScroll, { passive: true })
  return () => el.removeEventListener('scroll', onScroll)
}, [mainRef, annotations])
```
Capture `mainRef.current` into a local `el` constant at effect entry. Use `{ passive: true }` for scroll performance.

---

## Code Examples

### Source-inspection test pattern (consistent with OutlinePane.test.ts, ContentPane.test.ts)

```typescript
// Source: established pattern in ui/src/reviewer-v2/OutlinePane.test.ts
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import CommentPane from './CommentPane'

const source = readFileSync(resolve(__dirname, './CommentPane.tsx'), 'utf-8')

describe('CommentPane', () => {
  it('exports a function as default', () => {
    expect(typeof CommentPane).toBe('function')
  })
  // ... structural assertions
})
```

### Pure function unit test pattern (consistent with annotationReducer tests)

```typescript
// Source: established pattern in ui/src/reviewer-v2/useAnnotations.test.ts
import { describe, it, expect } from 'vitest'
import { computeCommentLayout } from './hooks/useCommentLayout'

describe('computeCommentLayout', () => {
  it('single item: top equals anchorY', () => {
    const result = computeCommentLayout([{ id: 'a', anchorY: 100, isExpanded: false, height: 48 }])
    expect(result[0].top).toBe(100)
    expect(result[0].isCompact).toBe(false)
  })

  it('overlapping items: second is pushed down, marked compact when > 40px from anchor', () => {
    const items = [
      { id: 'a', anchorY: 100, isExpanded: false, height: 48 },
      { id: 'b', anchorY: 120, isExpanded: false, height: 48 },
    ]
    const result = computeCommentLayout(items)
    expect(result[0].top).toBe(100)
    expect(result[1].top).toBe(156) // 100 + 48 + 8
    expect(result[1].isCompact).toBe(true) // pushed 36px from anchor 120
  })

  it('focused item snaps to anchorY regardless of earlier placement', () => {
    const items = [
      { id: 'a', anchorY: 100, isExpanded: false, height: 48 },
      { id: 'b', anchorY: 130, isExpanded: true, height: 120 },
    ]
    const result = computeCommentLayout(items)
    const focused = result.find((r) => r.id === 'b')!
    expect(focused.top).toBe(130)
    expect(focused.isCompact).toBe(false)
  })
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Store live `Range` objects in state | Store `anchorStart`/`anchorEnd` offsets; reconstruct Range per render | Phase 19 (rangeFromOffsets established) | React reconciliation cannot collapse stored offsets |
| DOM mutation (wrapper spans) for highlights | CSS Highlights API | Phase 18 (BLOCKING constraint) | Zero DOM mutation; works on dangerouslySetInnerHTML content |
| `@testing-library/react` for component tests | Source-code inspection + pure function testing | Phase 17 (isolation rule) | Tests run without React renderer; no jsdom component mounting needed |

**Note on sidenotes:** v1.x existed since 2021 but was largely unmaintained. v2.0.0 was published 2026-04-20 by the curvenote team. v2 is a fresh rewrite — it is architecturally incompatible with this project's scroll container model regardless of version.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `computeCommentLayout` processed in render-time (not in a web worker) is fast enough for the expected annotation count (tens, not thousands) | Architecture Patterns | Negligible — annotation count is bounded by human review capacity |
| A2 | `planRef.current.getBoundingClientRect()` is stable enough as the coordinate reference point (does not change between scroll events) | Common Pitfalls / anchorY formula | If ContentPane has inner layout shifts, the base coordinate drifts; a `ResizeObserver` on `planRef` (D-03) mitigates this |

**All other claims are VERIFIED from official sources or the existing codebase.**

---

## Open Questions (RESOLVED)

1. **Expanded bubble height measurement timing**
   - What we know: `computeCommentLayout` needs the expanded bubble's rendered height for accurate `previousBottom` computation. On first pass this is unknown.
   - What's unclear: Whether a two-pass `useLayoutEffect` approach is sufficient, or whether a `ref` callback per bubble is needed to capture heights more precisely.
   - Recommendation: Start with a single-pass using 0 as initial expanded height (expanded item snaps to `anchorY` unconditionally anyway). Add a `useLayoutEffect` to re-run layout after heights are measured if visual artifacts appear. This is executor discretion territory.

2. **`onScroll` prop vs. `addEventListener` on `mainRef`**
   - What we know: CONTEXT.md marks this as Claude's discretion.
   - What's unclear: Whether passing `onScroll` to the `<main>` element in Shell (which already has `ref={mainRef}`) is cleaner than adding a scroll listener in CommentPane's effect.
   - Recommendation: Use `addEventListener('scroll', handler, { passive: true })` on `mainRef.current` inside CommentPane's `useEffect` — this keeps the scroll concern local to CommentPane and is consistent with OutlinePane's `IntersectionObserver` pattern.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 20 has no new external tool dependencies. All capabilities use existing browser APIs (CSS Highlights, ResizeObserver) and existing npm packages already installed.

---

## Validation Architecture

`workflow.nyquist_validation` is explicitly `false` in `.planning/config.json` — this section is skipped.

---

## Security Domain

Phase 20 introduces no new network endpoints, no user-provided data sent to a server, no authentication surface, and no new file system access. All data flows through existing React state in memory. ASVS review not required for this phase.

---

## Sources

### Primary (HIGH confidence)
- `ui/src/reviewer-v2/hooks/useTextSelection.ts` — `rangeFromOffsets()` export, CSS Highlights API pattern, offset serialization approach
- `ui/src/reviewer-v2/useAnnotations.ts` — `annotationReducer`, `Annotation` type, pure function export pattern
- `ui/src/reviewer-v2/ReviewerV2Shell.tsx` — `mainRef` wiring, existing Shell state lift pattern
- `ui/src/reviewer-v2/ContentPane.tsx` — `handleAction` stub, `getOffsets()` usage, `planRef` reference
- `ui/src/reviewer-v2/OutlinePane.tsx` — `mainRef` scroll container subscription pattern via `IntersectionObserver`
- `ui/vitest.setup.ts` — ResizeObserver mock, CSS.highlights mock, Highlight constructor mock
- `.planning/phases/20-comment-pane/20-CONTEXT.md` — all locked decisions D-01 through D-11
- `.planning/phases/20-comment-pane/20-UI-SPEC.md` — approved visual contract, `computeCommentLayout` algorithm, anchorY formula
- `npm view sidenotes@2.0.1 --json` — registry confirmation, peer deps, no postinstall script [VERIFIED]

### Secondary (MEDIUM confidence)
- `github.com/curvenote/sidenotes` source files (`index.ts`, `context.tsx`, `reducer.ts`, `selectors.ts`, `components/Sidenote.tsx`) — API audit for D-05 evaluation [VERIFIED via WebFetch of official GitHub source]

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all reuses verified existing code
- Architecture: HIGH — patterns directly mirror Phase 17–19 established code
- sidenotes evaluation: HIGH — source code audited directly from GitHub
- computeCommentLayout algorithm: HIGH — matches UI-SPEC spec verbatim; unit-testable
- Pitfalls: HIGH — derived from existing codebase patterns and Phase 18/19 blocking constraints

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (stable APIs; no fast-moving dependencies)
