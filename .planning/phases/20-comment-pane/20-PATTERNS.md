# Phase 20: Comment Pane - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 9 (6 new/modified source files + 3 new test files)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `ui/src/reviewer-v2/types.ts` | model | transform | `ui/src/reviewer-v2/types.ts` (self) | self-extend |
| `ui/src/reviewer-v2/useAnnotations.ts` | hook | event-driven | `ui/src/reviewer-v2/useAnnotations.ts` (self) | self-extend |
| `ui/src/reviewer-v2/ReviewerV2Shell.tsx` | component/provider | request-response | `ui/src/reviewer-v2/ReviewerV2Shell.tsx` (self) | self-extend |
| `ui/src/reviewer-v2/ContentPane.tsx` | component | request-response | `ui/src/reviewer-v2/ContentPane.tsx` (self) | self-extend |
| `ui/src/reviewer-v2/CommentPane.tsx` | component | event-driven | `ui/src/reviewer-v2/OutlinePane.tsx` | role-match |
| `ui/src/reviewer-v2/CommentBubble.tsx` | component | request-response | `ui/src/reviewer-v2/GutterIcon.tsx` | role-match |
| `ui/src/reviewer-v2/hooks/useCommentLayout.ts` | hook/utility | transform | `ui/src/reviewer-v2/useAnnotations.ts` | role-match (pure export pattern) |
| `ui/src/reviewer-v2/CommentPane.test.ts` | test | — | `ui/src/reviewer-v2/OutlinePane.test.ts` | exact |
| `ui/src/reviewer-v2/hooks/useCommentLayout.test.ts` | test | — | `ui/src/reviewer-v2/useAnnotations.test.ts` | exact |

---

## Pattern Assignments

### `ui/src/reviewer-v2/types.ts` (model, extend)

**Analog:** Self — extend the existing `Annotation` interface.

**Current shape** (lines 1-8 of `ui/src/reviewer-v2/types.ts`):
```typescript
export interface Annotation {
  id: string
  anchorText: string
  comment: string
  type: AnnotationType
}
```

**Extension to add** (D-01 — required fields, not optional, so TypeScript catches unpatched fixtures):
```typescript
export interface Annotation {
  id: string
  anchorText: string
  comment: string
  type: AnnotationType
  anchorStart: number   // character offset in planRef text walk (from getRangeOffsets)
  anchorEnd: number     // character offset in planRef text walk (from getRangeOffsets)
}
```

**No other changes to types.ts.** `AnnotationType`, `AnnotationAction`, and `Section` are unchanged.

---

### `ui/src/reviewer-v2/useAnnotations.ts` (hook, event-driven)

**Analog:** Self — `ui/src/reviewer-v2/useAnnotations.ts` (lines 1-46).

**Existing core pattern** (lines 1-46 of `ui/src/reviewer-v2/useAnnotations.ts`):
```typescript
import { useReducer } from 'react'
import type { Annotation, AnnotationAction } from './types'

export interface AnnotationState {
  annotations: Annotation[]
}

export const initialAnnotationState: AnnotationState = {
  annotations: [],
}

export function annotationReducer(
  state: AnnotationState,
  action: AnnotationAction,
): AnnotationState {
  switch (action.type) {
    case 'add':
      return { ...state, annotations: [...state.annotations, action.annotation] }
    // ... edit, remove
  }
}

export function useAnnotations() {
  const [state, dispatch] = useReducer(annotationReducer, initialAnnotationState)
  return {
    annotations: state.annotations,
    addAnnotation: (annotation: Annotation) => dispatch({ type: 'add', annotation }),
    editAnnotation: (id: string, comment: string) => dispatch({ type: 'edit', id, comment }),
    removeAnnotation: (id: string) => dispatch({ type: 'remove', id }),
  }
}
```

**What changes in Phase 20:** Only the `Annotation` type gains `anchorStart`/`anchorEnd` (in `types.ts`). The reducer and hook signature do not change. The hook is **lifted from ContentPane to ReviewerV2Shell** — no code changes to the hook itself, only its call site moves.

---

### `ui/src/reviewer-v2/ReviewerV2Shell.tsx` (component, request-response)

**Analog:** Self — `ui/src/reviewer-v2/ReviewerV2Shell.tsx` (lines 1-96).

**Existing state pattern** (lines 1-9):
```typescript
import { useRef, useState } from 'react'
import ContentPane from './ContentPane'
import OutlinePane from './OutlinePane'
import type { Section } from './types'

export default function ReviewerV2Shell() {
  const mainRef = useRef<HTMLElement>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
```

**Pattern to follow for new state** — mirror the `activeId`/`setActiveId` pair exactly:
```typescript
// Add alongside existing useState calls — same pattern as activeId for OutlinePane
const { annotations, addAnnotation } = useAnnotations()  // lifted from ContentPane
const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null)
const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null)
```

**Existing prop-passing pattern** (lines 50-55 — OutlinePane wiring in JSX):
```typescript
<OutlinePane
  sections={sections}
  activeId={activeId}
  mainRef={mainRef}
  onActiveIdChange={setActiveId}
/>
```

**New prop-passing** — same shape for ContentPane and CommentPane:
```typescript
<ContentPane
  onSectionsFound={setSections}
  onAddAnnotation={addAnnotation}      // D-02: callback → Shell generates id before dispatch
  hoveredCommentId={hoveredCommentId}  // D-09
/>
// ... and for the right column aside, replace the placeholder <span> with:
<CommentPane
  annotations={annotations}
  hoveredCommentId={hoveredCommentId}
  focusedCommentId={focusedCommentId}
  mainRef={mainRef}
  planRef={planRef}                    // planRef must be lifted to Shell (see ContentPane section)
  onHover={setHoveredCommentId}
  onFocus={setFocusedCommentId}
/>
```

**Existing right column JSX** (lines 72-93 — replace the placeholder span):
```typescript
{/* Right column: Comments */}
<aside
  style={{
    width: 280,
    flexShrink: 0,
    borderLeft: '1px solid var(--color-border)',
    background: 'var(--color-bg)',
    overflowY: 'auto',   // D-04: CommentPane needs overflow:auto with position:relative inner wrapper
    padding: 16,
  }}
>
  {/* Phase 20: replace placeholder span with <CommentPane .../> */}
</aside>
```

**Note on `planRef` lift:** D-02/D-11 require CommentPane to hold `planRef`. Since ContentPane currently owns `planRef`, it must be lifted to Shell (like `mainRef`) and passed as a prop to both ContentPane and CommentPane.

---

### `ui/src/reviewer-v2/ContentPane.tsx` (component, request-response)

**Analog:** Self — `ui/src/reviewer-v2/ContentPane.tsx` (lines 1-97).

**Existing props interface** (lines 8-12):
```typescript
export default function ContentPane({
  onSectionsFound,
}: {
  onSectionsFound?: (sections: Section[]) => void
} = {}) {
```

**Extended props interface** for Phase 20:
```typescript
export default function ContentPane({
  onSectionsFound,
  onAddAnnotation,
  hoveredCommentId,
  planRef: planRefProp,   // lifted to Shell; passed in rather than created locally
}: {
  onSectionsFound?: (sections: Section[]) => void
  onAddAnnotation?: (annotation: Annotation) => void  // D-02
  hoveredCommentId?: string | null                     // D-09
  planRef?: React.RefObject<HTMLDivElement | null>     // lifted to Shell (D-03 requires CommentPane access)
} = {}) {
```

**Existing `handleAction` stub** (lines 56-59 — replace with real dispatch):
```typescript
// Phase 18 stub — clears selection after toolbar action. Phase 21 replaces this
// with the real annotation dispatch to the useAnnotations reducer.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function handleAction(_type: AnnotationType, _anchorText: string, _prefill?: string) {
  resetTextSelection()
}
```

**Replacement for Phase 20** (D-02 — synchronous offsets capture, before selection clears):
```typescript
function handleAction(type: AnnotationType, anchorText: string) {
  const offsets = getOffsets()  // synchronous snapshot — must be called BEFORE resetTextSelection
  if (onAddAnnotation && offsets) {
    onAddAnnotation({
      id: crypto.randomUUID(),  // Shell generates id per D-02 (or caller generates — either is fine)
      anchorText,
      comment: anchorText,      // D-07: Phase 20 stub — anchorText as comment content
      type,
      anchorStart: offsets.start,
      anchorEnd: offsets.end,
    })
  }
  resetTextSelection()
}
```

**CSS Highlights API pattern** (D-11 — mirrors `useTextSelection.ts` lines 3-11):
```typescript
// Copy constants from useTextSelection.ts lines 3-6:
const COMMENT_HOVER_HIGHLIGHT = 'comment-hover'
const supportsHighlights =
  typeof CSS !== 'undefined' && typeof CSS.highlights !== 'undefined'

// useEffect watching hoveredCommentId + annotations:
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

**CSS required in `ui/src/index.css`** (alongside the existing `::highlight(selection-lock)` rule):
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

---

### `ui/src/reviewer-v2/CommentPane.tsx` (component, event-driven)

**Analog:** `ui/src/reviewer-v2/OutlinePane.tsx` (lines 1-98) — same role (sidebar panel), same data flow (receives `mainRef`, subscribes to scroll container events, renders list of items with external state flowing in/out).

**Imports pattern** (copy from OutlinePane lines 1-2, extend):
```typescript
import { useEffect, useRef, useState } from 'react'
import type { Annotation } from './types'
import { rangeFromOffsets } from './hooks/useTextSelection'
import { computeCommentLayout } from './hooks/useCommentLayout'
```

**Props interface** (mirrors OutlinePane lines 4-14 shape):
```typescript
export default function CommentPane({
  annotations,
  hoveredCommentId,
  focusedCommentId,
  mainRef,
  planRef,
  onHover,
  onFocus,
}: {
  annotations: Annotation[]
  hoveredCommentId: string | null
  focusedCommentId: string | null
  mainRef: React.RefObject<HTMLElement | null>
  planRef: React.RefObject<HTMLDivElement | null>
  onHover: (id: string | null) => void
  onFocus: (id: string | null) => void
}): React.JSX.Element {
```

**Scroll/ResizeObserver subscription pattern** (mirrors OutlinePane lines 18-43 — same `mainRef` subscription approach, but with scroll listener + ResizeObserver instead of IntersectionObserver; see RESEARCH.md Pitfall 6 for cleanup pattern):
```typescript
useEffect(() => {
  const el = mainRef.current
  const content = planRef.current
  if (!el || !content) return

  function recompute() {
    const map = new Map<string, number>()
    for (const ann of annotations) {
      if (!planRef.current) continue
      const range = rangeFromOffsets(planRef.current, ann.anchorStart, ann.anchorEnd)
      if (!range || !mainRef.current) continue
      const rangeRect = range.getBoundingClientRect()
      const containerRect = planRef.current.getBoundingClientRect()
      const anchorY = rangeRect.top - containerRect.top + mainRef.current.scrollTop
      map.set(ann.id, anchorY)
    }
    setAnchorYMap(map)
  }

  // CRITICAL: capture .current into local const at effect entry (Pitfall 6)
  el.addEventListener('scroll', recompute, { passive: true })
  const ro = new ResizeObserver(recompute)
  ro.observe(content)
  recompute() // initial computation

  return () => {
    el.removeEventListener('scroll', recompute)
    ro.disconnect()
  }
}, [mainRef, planRef, annotations])  // re-run when annotations changes (Pitfall 2)
```

**Rendering pattern** (D-04 — absolute positioning within overflow:auto container):
```typescript
// The outer <aside> in Shell has overflow:auto. CommentPane renders a tall
// relatively-positioned inner wrapper — all bubbles are absolute children.
return (
  <div style={{ position: 'relative', minHeight: '100%' }}>
    {layoutItems.map((item) => {
      const ann = annotations.find((a) => a.id === item.id)
      if (!ann) return null
      return (
        <CommentBubble
          key={item.id}
          annotation={ann}
          top={item.top}
          isCompact={item.isCompact}
          isHovered={hoveredCommentId === item.id}
          isFocused={focusedCommentId === item.id}
          onMouseEnter={() => onHover(item.id)}
          onMouseLeave={() => onHover(null)}
          onClick={() => onFocus(item.id)}
        />
      )
    })}
  </div>
)
```

---

### `ui/src/reviewer-v2/CommentBubble.tsx` (component, request-response)

**Analog:** `ui/src/reviewer-v2/GutterIcon.tsx` (lines 1-51) — absolute-positioned button-like element with hover/focus state managed via inline style callbacks.

**Absolute positioning pattern** (GutterIcon lines 14-16 — same `position: 'absolute'` + computed `top`):
```typescript
// GutterIcon uses: top = paragraph.offsetTop + paragraph.offsetHeight / 2 - 12
// CommentBubble uses: top from computeCommentLayout output
return (
  <article
    style={{
      position: 'absolute',
      top,
      left: 0,
      right: 0,
      // compact vs expanded state drives height and line clamping
    }}
  >
```

**Hover/focus inline style pattern** (GutterIcon lines 40-47 — copy exactly for buttons within the bubble):
```typescript
onMouseOver={(e) => { e.currentTarget.style.opacity = '1' }}
onMouseOut={(e) => { e.currentTarget.style.opacity = '0.7' }}
onFocus={(e) => {
  e.currentTarget.style.outline = '2px solid var(--color-focus)'
  e.currentTarget.style.outlineOffset = '2px'
}}
onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
```

**Props interface:**
```typescript
export default function CommentBubble({
  annotation,
  top,
  isCompact,
  isHovered,
  isFocused,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: {
  annotation: Annotation
  top: number
  isCompact: boolean
  isHovered: boolean
  isFocused: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick: () => void
}): React.JSX.Element {
```

**Compact vs expanded CSS approach** — use `WebkitLineClamp` for compact 2-line preview (discretion area per CONTEXT.md):
```typescript
// Compact: 2-line clamp
const compactStyle = {
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical' as const,
  WebkitLineClamp: 2,
}
// Expanded: no clamp, full height
```

---

### `ui/src/reviewer-v2/hooks/useCommentLayout.ts` (hook/utility, transform)

**Analog:** `ui/src/reviewer-v2/useAnnotations.ts` (exported pure function pattern, lines 14-32) — same pattern of exporting a pure function that is the testable core, with the hook wrapping React state on top.

**Export pattern** (mirror annotationReducer export):
```typescript
// Exported pure function — directly unit-testable without React renderer (Phase 17 rule)
export function computeCommentLayout(
  items: Array<{ id: string; anchorY: number; isExpanded: boolean; height: number }>,
): Array<{ id: string; top: number; isCompact: boolean }> {
  // ... algorithm from RESEARCH.md Pattern 2
}

// Optional: hook wrapper for React integration (if local state management is needed)
// Claude's discretion — useCommentLayout hook may or may not be needed
// if CommentPane does the computation inline in render.
```

**Full algorithm** (from RESEARCH.md Pattern 2 — copy verbatim, it is the spec):
```typescript
export function computeCommentLayout(
  items: Array<{ id: string; anchorY: number; isExpanded: boolean; height: number }>,
): Array<{ id: string; top: number; isCompact: boolean }> {
  const COMPACT_HEIGHT = 48
  const GAP = 8
  const PUSH_THRESHOLD = 40

  const expanded = items.find((i) => i.isExpanded)
  const rest = items.filter((i) => !i.isExpanded).sort((a, b) => a.anchorY - b.anchorY)

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

---

### `ui/src/reviewer-v2/CommentPane.test.ts` (test, source-inspection)

**Analog:** `ui/src/reviewer-v2/OutlinePane.test.ts` (lines 1-55) — exact pattern match. Source-inspection style: `readFileSync` + `describe/it/expect(source).toContain(...)`.

**Test file header pattern** (OutlinePane.test.ts lines 1-10 — copy exactly):
```typescript
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import CommentPane from './CommentPane'

const source = readFileSync(
  resolve(__dirname, './CommentPane.tsx'),
  'utf-8',
)
```

**Structural assertion pattern** (OutlinePane.test.ts lines 12-14):
```typescript
describe('CommentPane', () => {
  it('exports a function as default', () => {
    expect(typeof CommentPane).toBe('function')
  })
  // ... structural source assertions
})
```

**Key assertions to write** (structural checks consistent with Phase 17–19 testing conventions):
- `expect(source).toContain('position: \'absolute\'')` — D-04 absolute positioning
- `expect(source).toContain('addEventListener(\'scroll\'')` — D-03 scroll subscription
- `expect(source).toContain('ResizeObserver')` — D-03 resize subscription
- `expect(source).toContain('rangeFromOffsets')` — anchor Y resolution reuse
- `expect(source).toContain('computeCommentLayout')` — layout algorithm usage
- `expect(source).toContain('passive: true')` — Pitfall 6 scroll perf
- `expect(source).toContain('el.removeEventListener')` — Pitfall 6 cleanup
- `expect(source).not.toContain('InlineAnchor')` — sidenotes rejection guard

---

### `ui/src/reviewer-v2/hooks/useCommentLayout.test.ts` (test, pure function)

**Analog:** `ui/src/reviewer-v2/useAnnotations.test.ts` (lines 1-76) — pure function direct import + `describe/it/expect` assertions on return values. No `readFileSync`, no source inspection.

**Test file header pattern** (useAnnotations.test.ts lines 1-3 — copy exactly):
```typescript
import { describe, it, expect } from 'vitest'
import { computeCommentLayout } from './useCommentLayout'
```

**Pure function test cases** (from RESEARCH.md Code Examples — copy verbatim as the spec includes them):
```typescript
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
    expect(result[1].isCompact).toBe(true)
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

## Shared Patterns

### CSS Highlights API
**Source:** `ui/src/reviewer-v2/hooks/useTextSelection.ts` lines 3-11
**Apply to:** `ContentPane.tsx` (for `comment-hover`) and `useTextSelection.ts` (existing `selection-lock`)

```typescript
const supportsHighlights =
  typeof CSS !== 'undefined' && typeof CSS.highlights !== 'undefined'

// Apply:
CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(range))

// Remove:
CSS.highlights.delete(HIGHLIGHT_NAME)
```

**Mock already in place:** `ui/vitest.setup.ts` mocks `CSS.highlights`, `Highlight`, and `ResizeObserver`. No changes needed for new tests to work.

### useEffect scroll/observer cleanup
**Source:** `ui/src/reviewer-v2/OutlinePane.tsx` lines 18-43
**Apply to:** `CommentPane.tsx`

The pattern is: capture `ref.current` into a local `const` at effect entry, add listener, return cleanup. This prevents stale-ref bugs when the ref changes between renders.

```typescript
useEffect(() => {
  if (!mainRef.current || sections.length === 0) return
  const observer = new IntersectionObserver(/* ... */)
  // ...
  return () => observer.disconnect()
}, [sections, mainRef, onActiveIdChange])
```

CommentPane follows the same shape with `addEventListener('scroll', ..., { passive: true })` + `ResizeObserver`.

### Exported pure function for testability
**Source:** `ui/src/reviewer-v2/useAnnotations.ts` lines 14-32 (`annotationReducer`)
**Apply to:** `ui/src/reviewer-v2/hooks/useCommentLayout.ts` (`computeCommentLayout`)

The reducer is exported at the module level so tests can import and call it directly — no `renderHook`, no React renderer. `computeCommentLayout` must follow the same pattern.

### Inline style hover/focus for interactive elements
**Source:** `ui/src/reviewer-v2/GutterIcon.tsx` lines 40-47
**Apply to:** `CommentBubble.tsx` buttons

```typescript
onFocus={(e) => {
  e.currentTarget.style.outline = '2px solid var(--color-focus)'
  e.currentTarget.style.outlineOffset = '2px'
}}
onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
```

### Absolute sibling overlay positioning
**Source:** `ui/src/reviewer-v2/PlanContent.tsx` lines 53-79 (position:relative wrapper + position:absolute children)
**Apply to:** `CommentPane.tsx` inner wrapper + `CommentBubble.tsx`

```typescript
// PlanContent pattern:
<div style={{ position: 'relative', maxWidth: 720, margin: '0 auto' }}>
  <MarkdownView ... />
  {/* Absolutely-positioned siblings: */}
  <div aria-hidden="true" style={{ position: 'absolute', top: hoveredParagraph.offsetTop, ... }} />
  <GutterIcon ... />
</div>
```

CommentPane uses the same shape: `position: relative` wrapper → `position: absolute; top: {anchorY}` comment bubbles.

---

## No Analog Found

No files are completely without analog. All files map to existing codebase patterns.

---

## Metadata

**Analog search scope:** `ui/src/reviewer-v2/` (all files)
**Files scanned:** 26 source + test files
**Pattern extraction date:** 2026-05-21
**Key anti-patterns to avoid (from Phase 17–19 constraints):**
- No `@testing-library/react` — use source inspection or pure function imports
- No DOM mutation in `dangerouslySetInnerHTML` children — use CSS Highlights API
- No live `Range` objects in state — store `anchorStart`/`anchorEnd` offsets only
- No `sidenotes@2.0.1` — architecturally incompatible (see RESEARCH.md rejection verdict)
- No React state updates mid-drag — capture `getOffsets()` synchronously before `resetTextSelection()`
