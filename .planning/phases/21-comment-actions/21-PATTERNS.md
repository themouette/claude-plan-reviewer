# Phase 21: Comment Actions - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 13 (8 modified + 2 new components + 1 new hook + 2 new test files)
**Analogs found:** 13 / 13

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `ui/src/reviewer-v2/AnnotationForm.tsx` | component | request-response | `ui/src/reviewer-v2/SelectionToolbar.tsx` | role-match (fixed popover, same position pattern) |
| `ui/src/reviewer-v2/ContentPane.tsx` | component | event-driven | self (modify) | exact |
| `ui/src/reviewer-v2/PlanContent.tsx` | component | event-driven | self (modify) | exact |
| `ui/src/reviewer-v2/CommentBubble.tsx` | component | event-driven | self (modify) | exact |
| `ui/src/reviewer-v2/CommentPane.tsx` | component | event-driven | self (modify) | exact |
| `ui/src/reviewer-v2/ReviewerV2Shell.tsx` | component | event-driven | self (modify) | exact |
| `ui/src/reviewer-v2/OutlinePane.tsx` | component | CRUD | self (modify) | exact |
| `ui/src/reviewer-v2/hooks/useTextSelection.ts` | hook | transform | self (modify) | exact |
| `ui/src/reviewer-v2/hooks/useSectionAnnotationCounts.ts` | hook | transform | `ui/src/reviewer-v2/hooks/useTextSelection.ts` | role-match (pure utility hook) |
| `ui/src/reviewer-v2/AnnotationForm.test.ts` | test | — | `ui/src/reviewer-v2/CommentBubble.test.ts` | exact (same source-as-text pattern) |
| `ui/src/reviewer-v2/ContentPane.test.ts` | test | — | self (extend) | exact |
| `ui/src/reviewer-v2/CommentBubble.test.ts` | test | — | self (extend) | exact |
| `ui/src/reviewer-v2/CommentPane.test.ts` | test | — | self (extend) | exact |
| `ui/src/reviewer-v2/ReviewerV2Shell.test.ts` | test | — | self (extend) | exact |
| `ui/src/reviewer-v2/OutlinePane.test.ts` | test | — | self (extend) | exact |
| `ui/src/reviewer-v2/hooks/useSectionAnnotationCounts.test.ts` | test | — | `ui/src/reviewer-v2/useAnnotations.test.ts` | exact (direct pure-function test) |

---

## Pattern Assignments

### `ui/src/reviewer-v2/AnnotationForm.tsx` (new component, request-response)

**Analog:** `ui/src/reviewer-v2/SelectionToolbar.tsx`

**Imports pattern** (SelectionToolbar.tsx lines 1-4):
```typescript
import { useEffect, useRef } from 'react'
import { rangeFromOffsets } from './hooks/useTextSelection'
import type { AnnotationType } from './types'
```

**Fixed-position popover pattern** (SelectionToolbar.tsx lines 59-82):
```typescript
// position: fixed at lastRect.bottom + 6, left clamped to viewport
const TOOLBAR_WIDTH = 280
const rects = range.getClientRects()
const lastRect = rects.length > 0 ? rects[rects.length - 1] : range.getBoundingClientRect()
const top = lastRect.bottom + 6
const left = Math.min(lastRect.right, window.innerWidth - TOOLBAR_WIDTH)

return (
  <div
    role="group"
    aria-label="Annotation actions"
    style={{
      position: 'fixed',
      top,
      left,
      zIndex: 20,
      background: 'var(--color-surface)',
      borderRadius: '6px',
      padding: '4px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    }}
  >
```

**onMouseDown preventDefault pattern** (SelectionToolbar.tsx line 88):
```typescript
// CRITICAL: prevent mousedown from clearing selection before click fires
onMouseDown={(e) => e.preventDefault()}
```

**Click-outside listener pattern** (SelectionToolbar.tsx lines 39-47):
```typescript
useEffect(() => {
  const handler = (e: MouseEvent) => {
    if (detailsRef.current && !detailsRef.current.contains(e.target as Node)) {
      detailsRef.current.open = false
    }
  }
  document.addEventListener('mousedown', handler)
  return () => document.removeEventListener('mousedown', handler)
}, [])
```

**Focus/blur outline pattern** (SelectionToolbar.tsx lines 102-106):
```typescript
onFocus={(e) => {
  e.currentTarget.style.outline = '2px solid var(--color-focus)'
  e.currentTarget.style.outlineOffset = '2px'
}}
onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
```

**Form position — capture from stored offsets, not live selection** (ContentPane.tsx lines 94-96 + RESEARCH.md):
```typescript
// In AnnotationForm, rect comes from formState (captured at handleAction trigger time):
// position is already baked into formState.rect = { top: formTop, left: formLeft }
// AnnotationForm renders: style={{ position: 'fixed', top: formState.rect.top, left: formState.rect.left }}
```

---

### `ui/src/reviewer-v2/ContentPane.tsx` (modify — replace handleAction/handleAdd stubs)

**Analog:** self

**Current handleAction stub to replace** (ContentPane.tsx lines 94-107):
```typescript
function handleAction(type: AnnotationType, anchorText: string) {
  const offsets = getOffsets()
  if (onAddAnnotation && offsets) {
    onAddAnnotation({
      id: crypto.randomUUID(),
      anchorText,
      comment: anchorText, // D-07 stub: Phase 21 replaces with textarea form
      type,
      anchorStart: offsets.start,
      anchorEnd: offsets.end,
    })
  }
  resetTextSelection()
}
```

**New handleAction must:**
1. Accept `prefillComment?: string` as 3rd arg (matching SelectionToolbar's `onAction` signature at line 34)
2. Capture rect from `rangeFromOffsets(planRef.current, offsets.start, offsets.end)` before selection is cleared
3. If `formState !== null`: call `onAddAnnotation` with current formState content (auto-submit D-03), then set new formState
4. Otherwise: set `formState` (do NOT call `resetTextSelection()` here — only on submit/cancel per D-04)

**Current handleAdd stub to replace** (ContentPane.tsx lines 110-113):
```typescript
// Phase 18 stub — clears selection after gutter-icon click (idempotent). Phase 21
// will wire this to an annotation creation flow.
function handleAdd() {
  resetTextSelection()
}
```

**New handleAdd must accept a paragraph element** and implement programmatic selection (RESEARCH.md Pattern 7):
```typescript
function handleAdd(paragraphElement: HTMLElement) {
  const selection = window.getSelection()
  if (!selection) return
  selection.removeAllRanges()
  const range = document.createRange()
  range.selectNodeContents(paragraphElement)
  selection.addRange(range)
  // selectionchange fires → useTextSelection picks it up → SelectionToolbar appears
}
```

**Render pattern — SelectionToolbar vs AnnotationForm toggle** (ContentPane.tsx lines 151-159, modified):
```typescript
{selectedText && offsets && !formState && (
  <SelectionToolbar
    offsets={offsets}
    selectedText={selectedText}
    containerRef={planRef}
    onAction={handleAction}
  />
)}
{formState && (
  <AnnotationForm
    formState={formState}
    onSubmit={handleFormSubmit}
    onCancel={handleFormCancel}
  />
)}
```

**CSS Highlights pattern to preserve** (ContentPane.tsx lines 65-83):
```typescript
// Keep selection-lock highlight active while form is open (D-04).
// Do NOT call resetTextSelection() inside handleAction when formState is being set.
// Only call resetTextSelection() in handleFormSubmit and handleFormCancel.
useEffect(() => {
  if (!supportsHighlights) return
  // ... CSS.highlights.set / .delete on hoveredCommentId change
}, [hoveredCommentId, annotations, planRef])
```

**rangeFromOffsets rect capture** (RESEARCH.md Pitfall 1 + Pattern 2):
```typescript
// Inside handleAction — capture rect BEFORE selection is cleared by SelectionToolbar pill onClick:
const range = rangeFromOffsets(planRef.current, offsets.start, offsets.end)
const rects = range?.getClientRects() ?? []
const lastRect = rects.length > 0 ? rects[rects.length - 1] : range?.getBoundingClientRect()
const formTop = (lastRect?.bottom ?? 0) + 6
const formLeft = Math.min(lastRect?.right ?? 0, window.innerWidth - 280)
```

---

### `ui/src/reviewer-v2/PlanContent.tsx` (modify — wrap GutterIcon.onAdd)

**Analog:** self

**Current GutterIcon wiring** (PlanContent.tsx lines 76-77):
```typescript
<GutterIcon paragraph={hoveredParagraph} containerRef={planRef} onAdd={onAdd} />
```

**New pattern — wrap onAdd in closure to pass paragraph element** (RESEARCH.md Open Question 3):
```typescript
// Change ContentPane's onAdd prop type: onAdd: (el: HTMLElement) => void
// In PlanContent, wrap to pass hoveredParagraph without changing GutterIcon's interface:
<GutterIcon
  paragraph={hoveredParagraph}
  containerRef={planRef}
  onAdd={() => onAdd(hoveredParagraph)}
/>
```

**PlanContent onAdd prop type change** (PlanContent.tsx line 29):
```typescript
// From: onAdd: () => void
// To:   onAdd: (el: HTMLElement) => void
```

---

### `ui/src/reviewer-v2/CommentBubble.tsx` (modify — add edit/delete controls + inline edit mode)

**Analog:** self

**Current prop interface** (CommentBubble.tsx lines 13-31):
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

**New props to add:**
```typescript
// Add to the prop interface:
isEditing: boolean
onEdit: () => void
onRemove: () => void
```

**Pencil + × icons in focused state — follow isFocused conditional pattern** (CommentBubble.tsx lines 123-137):
```typescript
// Extend the existing isFocused block (currently renders type badge):
{isFocused && (
  <>
    <span style={{ /* existing type badge styles */ }}>
      {annotation.type}
    </span>
    <button
      aria-label="Edit comment"
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => { e.stopPropagation(); onEdit() }}
      style={{ /* pencil icon button, fontSize: 14, cursor: 'pointer', ... */ }}
    >
      ✎
    </button>
    <button
      aria-label="Delete comment"
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => { e.stopPropagation(); onRemove() }}
      style={{ /* × icon button */ }}
    >
      ×
    </button>
  </>
)}
```

**Inline edit mode textarea — replace `<p>` body** (RESEARCH.md Pattern 6):
```typescript
// Replace the <p>{annotation.comment}</p> block:
{isEditing ? (
  <textarea
    autoFocus
    defaultValue={annotation.comment}
    style={{ width: '100%', minHeight: 64, fontSize: 14 }}
    onKeyDown={(e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { /* save: call onEdit with new value */ }
      if (e.key === 'Escape') { /* cancel */ }
    }}
  />
) : (
  <p style={{ /* existing p styles */ }}>
    {annotation.comment}
  </p>
)}
```

**Button styling convention** (SelectionToolbar.tsx lines 94-109):
```typescript
// All action buttons in this codebase follow: border: 'none', cursor: 'pointer',
// onMouseDown={(e) => e.preventDefault()} to prevent selection clear,
// onFocus/onBlur for outline accessibility
```

---

### `ui/src/reviewer-v2/CommentPane.tsx` (modify — add editingId + sticky pinning)

**Analog:** self

**Current CommentBubble rendering loop** (CommentPane.tsx lines 103-119):
```typescript
return (
  <div style={{ position: 'relative', minHeight: '100%' }}>
    {annotations.map((ann) => {
      const layoutItem = layout.find((l) => l.id === ann.id)
      if (!layoutItem) return null
      return (
        <CommentBubble
          key={ann.id}
          annotation={ann}
          top={layoutItem.top}
          isCompact={layoutItem.isCompact}
          isHovered={hoveredCommentId === ann.id}
          isFocused={focusedCommentId === ann.id}
          onMouseEnter={() => onHover(ann.id)}
          onMouseLeave={() => onHover(null)}
          onClick={() => onFocus(focusedCommentId === ann.id ? null : ann.id)}
        />
      )
    })}
  </div>
)
```

**New prop to add to CommentPane:**
```typescript
// Add to the prop interface:
editingId: string | null
onEdit: (id: string, comment: string) => void
onRemove: (id: string) => void
```

**Sticky wrapper pattern for editing bubble** (RESEARCH.md Pattern 6 + D-12):
```typescript
// Wrap each CommentBubble in a div whose style depends on editingId:
const wrapperStyle: React.CSSProperties =
  editingId === ann.id
    ? { position: 'sticky', top: 16 }
    : { position: 'absolute', top: layoutItem.top, left: 0, right: 0 }

return (
  <div key={ann.id} style={wrapperStyle}>
    <CommentBubble
      annotation={ann}
      top={0}  // top handled by wrapper when not editing
      isCompact={layoutItem.isCompact}
      isHovered={hoveredCommentId === ann.id}
      isFocused={focusedCommentId === ann.id}
      isEditing={editingId === ann.id}
      onMouseEnter={() => onHover(ann.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onFocus(focusedCommentId === ann.id ? null : ann.id)}
      onEdit={() => onEdit(ann.id, /* textarea ref value */)}
      onRemove={() => onRemove(ann.id)}
    />
  </div>
)
```

**ref capture pattern** (CommentPane.tsx lines 27-29):
```typescript
// CRITICAL: always capture ref.current at effect entry
const el = mainRef.current
const content = planRef.current
if (!el || !content) return
```

---

### `ui/src/reviewer-v2/ReviewerV2Shell.tsx` (modify — add editingId state + hook call + OutlinePane prop)

**Analog:** self

**Existing shared state pattern to extend** (ReviewerV2Shell.tsx lines 13-15):
```typescript
const { annotations, addAnnotation } = useAnnotations()
const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null)
const [focusedCommentId, setFocusedCommentId] = useState<string | null>(null)
```

**New state and hook to add, following same pattern:**
```typescript
// Phase 21 additions — same pattern as hoveredCommentId/focusedCommentId:
const { annotations, addAnnotation, editAnnotation, removeAnnotation } = useAnnotations()
const [editingId, setEditingId] = useState<string | null>(null)
const annotationCounts = useSectionAnnotationCounts(sections, annotations, planRef)
```

**Escape key handler pattern** (ReviewerV2Shell.tsx lines 17-23):
```typescript
// Extend existing Escape handler to also clear editingId:
useEffect(() => {
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      setFocusedCommentId(null)
      setEditingId(null)  // add this
    }
  }
  document.addEventListener('keydown', onKeyDown)
  return () => document.removeEventListener('keydown', onKeyDown)
}, [])
```

**Prop passing pattern — CommentPane** (ReviewerV2Shell.tsx lines 100-109):
```typescript
// Extend CommentPane props:
<CommentPane
  annotations={annotations}
  hoveredCommentId={hoveredCommentId}
  focusedCommentId={focusedCommentId}
  editingId={editingId}            // new
  mainRef={mainRef}
  planRef={planRef}
  onHover={setHoveredCommentId}
  onFocus={setFocusedCommentId}
  onEdit={(id, comment) => { editAnnotation(id, comment); setEditingId(null) }}  // new
  onRemove={removeAnnotation}      // new
/>
```

**Prop passing pattern — OutlinePane** (ReviewerV2Shell.tsx lines 64-69):
```typescript
// Extend OutlinePane props:
<OutlinePane
  sections={sections}
  activeId={activeId}
  mainRef={mainRef}
  onActiveIdChange={setActiveId}
  annotationCounts={annotationCounts}  // new
/>
```

---

### `ui/src/reviewer-v2/OutlinePane.tsx` (modify — add annotationCounts badge rendering)

**Analog:** self

**Current section button rendering** (OutlinePane.tsx lines 53-91):
```typescript
{sections.map((section, i) => (
  <li key={section.id || `__section-${i}`} ref={section.id === activeId ? activeItemRef : undefined}>
    <button
      className="outline-button"
      aria-label={section.text}
      aria-current={section.id === activeId ? 'true' : undefined}
      onClick={() => document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
      style={{
        width: '100%',
        textAlign: 'left',
        // ... active/inactive color switching by section.id === activeId
        paddingLeft: 16 + (section.depth - 1) * 8,
        // ...
      }}
    >
      {section.text}
    </button>
  </li>
))}
```

**New annotationCounts prop and badge rendering** (RESEARCH.md Code Examples):
```typescript
// Add to prop interface:
annotationCounts?: Map<string, number>

// Inside button, after {section.text}:
{(annotationCounts?.get(section.id) ?? 0) > 0 && (
  <span
    aria-label={`${annotationCounts!.get(section.id)} comments`}
    style={{
      fontSize: 11, fontWeight: 600, lineHeight: 1,
      minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      marginLeft: 8,
      background: section.id === activeId ? 'var(--color-focus)' : 'rgba(59, 130, 246, 0.25)',
      color: section.id === activeId ? '#fff' : 'var(--color-focus)',
    }}
  >
    {annotationCounts!.get(section.id)}
  </span>
)}
```

**Active/inactive color switching convention** (OutlinePane.tsx lines 73-84):
```typescript
// Follow existing pattern: use section.id === activeId to switch between focus/secondary colors
color: section.id === activeId ? 'var(--color-focus)' : 'var(--color-text-secondary)',
background: section.id === activeId ? 'var(--color-surface)' : 'transparent',
borderLeft: section.id === activeId ? '2px solid var(--color-focus)' : '2px solid transparent',
```

---

### `ui/src/reviewer-v2/hooks/useTextSelection.ts` (modify — add getElementCharOffset export)

**Analog:** self

**Existing rangeFromOffsets pattern to mirror** (useTextSelection.ts lines 57-87):
```typescript
// rangeFromOffsets walks text nodes forward to find start/end by char count
export function rangeFromOffsets(
  container: HTMLElement,
  start: number,
  end: number,
): Range | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let charCount = 0
  // ... walk until startNode and endNode located
}
```

**New getElementCharOffset — inverse walk** (RESEARCH.md Pattern 5):
```typescript
// Co-located next to rangeFromOffsets (both are character-offset utilities on the same DOM model)
export function getElementCharOffset(container: HTMLElement, targetElement: HTMLElement): number {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  let charCount = 0
  let node: Node | null
  while ((node = walker.nextNode())) {
    if (targetElement.contains(node)) return charCount  // use .contains(), not ===
    charCount += (node.textContent ?? '').length
  }
  return charCount // fallback: element at or past the end
}
```

**Key:** Use `targetElement.contains(node)` not `node.parentElement === targetElement` — headings may contain inline elements (`<code>`, `<strong>`) that wrap the text node (RESEARCH.md Pitfall 6).

---

### `ui/src/reviewer-v2/hooks/useSectionAnnotationCounts.ts` (new hook)

**Analog:** `ui/src/reviewer-v2/hooks/useTextSelection.ts` (structure), `ui/src/reviewer-v2/useAnnotations.ts` (useReducer pattern)

**Hook signature** (RESEARCH.md Pattern + D-13):
```typescript
import { useMemo } from 'react'
import type { RefObject } from 'react'
import type { Annotation, Section } from '../types'
import { getElementCharOffset } from './useTextSelection'

export function useSectionAnnotationCounts(
  sections: Section[],
  annotations: Annotation[],
  planRef: RefObject<HTMLDivElement | null>,
): Map<string, number> {
  return useMemo(() => {
    const counts = new Map<string, number>()
    if (!planRef.current || sections.length === 0) return counts
    // ...
  }, [sections, annotations, planRef])
}
```

**Algorithm outline** (D-14):
```typescript
// 1. Walk headings in planRef.current, call getElementCharOffset for each
// 2. Build array of { sectionId, startOffset, endOffset } boundaries
// 3. For each annotation, find section whose [headingStart, nextHeadingStart) contains anchorStart
// 4. Count under first section only (annotations before first heading get no section)
```

**useMemo dependency array** — include `sections`, `annotations`, and `planRef` (note: `planRef` is a ref object; include it but the DOM content change won't re-trigger unless planRef itself changes — acceptable since sections/annotations change whenever content changes).

---

## Shared Patterns

### Source-as-Text Test Pattern (mandatory for all .test.ts files)

**Source:** All test files in `ui/src/reviewer-v2/` (e.g., `CommentBubble.test.ts` lines 1-11)
**Apply to:** All test files in Phase 21

```typescript
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import TargetComponent from './TargetComponent'

const source = readFileSync(
  resolve(__dirname, './TargetComponent.tsx'),
  'utf-8',
)

describe('TargetComponent', () => {
  it('default export is a function', () => {
    expect(typeof TargetComponent).toBe('function')
  })

  it('source contains expected string', () => {
    expect(source).toContain('expectedString')
  })
})
```

**For pure functions** (e.g., `getElementCharOffset`, `useSectionAnnotationCounts`): call the exported function directly in tests using `document.createElement` for jsdom DOM — see `useTextSelection.test.ts` lines 12-29 for the helper pattern:
```typescript
function singleTextContainer(text: string): HTMLElement {
  const div = document.createElement('div')
  div.appendChild(document.createTextNode(text))
  document.body.appendChild(div)
  return div
}
```

### CSS Highlights API Pattern (D-04)

**Source:** `ui/src/reviewer-v2/hooks/useTextSelection.ts` lines 3-16 + `ui/src/reviewer-v2/ContentPane.tsx` lines 9-11
**Apply to:** `AnnotationForm.tsx` (stopPropagation on mousedown to preserve selection-lock), `ContentPane.tsx` (do NOT call resetTextSelection while formState is non-null)

```typescript
const supportsHighlights =
  typeof CSS !== 'undefined' && typeof CSS.highlights !== 'undefined'

// Set highlight:
if (supportsHighlights) CSS.highlights.set('selection-lock', new Highlight(range))
// Delete highlight:
if (supportsHighlights) CSS.highlights.delete('selection-lock')
```

**Critical:** `resetTextSelection()` clears the `selection-lock` highlight. Only call it in `handleFormSubmit` and `handleFormCancel`, NOT in `handleAction` when opening the form.

### onMouseDown preventDefault Pattern (all interactive controls)

**Source:** `ui/src/reviewer-v2/SelectionToolbar.tsx` line 88, `ui/src/reviewer-v2/GutterIcon.tsx` line 19
**Apply to:** All buttons in `AnnotationForm.tsx` and all new action buttons in `CommentBubble.tsx`

```typescript
onMouseDown={(e) => e.preventDefault()}
```

Prevents the browser from clearing the text selection when the user clicks a button.

### CSS Custom Properties Color Convention

**Source:** Throughout `CommentBubble.tsx`, `SelectionToolbar.tsx`, `OutlinePane.tsx`
**Apply to:** All new UI in `AnnotationForm.tsx` and `CommentBubble.tsx` edit mode

```typescript
// Use these tokens (no hardcoded colors):
'var(--color-surface)'          // card/popover background
'var(--color-bg)'               // page background
'var(--color-border)'           // borders
'var(--color-focus)'            // focus ring, active state
'var(--color-text-primary)'     // body text
'var(--color-text-secondary)'   // muted/label text
'var(--color-annotation-comment)'  // comment type accent
'var(--color-annotation-delete)'   // delete type accent
'var(--color-annotation-replace)'  // replace type accent
```

### useAnnotations Hook (do not reimplement)

**Source:** `ui/src/reviewer-v2/useAnnotations.ts` lines 34-46
**Apply to:** `ReviewerV2Shell.tsx` — destructure `editAnnotation` and `removeAnnotation`

```typescript
// Already implemented — just destructure:
const { annotations, addAnnotation, editAnnotation, removeAnnotation } = useAnnotations()

// editAnnotation(id, comment): dispatches { type: 'edit', id, comment }
// removeAnnotation(id): dispatches { type: 'remove', id }
```

### ref.current Capture at Effect Entry

**Source:** `ui/src/reviewer-v2/CommentPane.tsx` lines 27-29
**Apply to:** All `useEffect` and `useLayoutEffect` blocks in new/modified files

```typescript
// CRITICAL: capture at effect entry — never close over .current lazily
const el = mainRef.current
const content = planRef.current
if (!el || !content) return
```

---

## No Analog Found

All files have analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `ui/src/reviewer-v2/`, `ui/src/reviewer-v2/hooks/`
**Files scanned:** 16 source files, 16 test files
**Pattern extraction date:** 2026-05-21
