# Phase 18: Content Pane — Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 8 (6 new files + 2 modified files)
**Analogs found:** 8 / 8

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `ui/src/reviewer-v2/ContentPane.tsx` | component (container) | request-response + event-driven | `ui/src/App.tsx` (plan fetch + selection orchestration) | role-match |
| `ui/src/reviewer-v2/PlanContent.tsx` | component (markdown host) | event-driven | `ui/src/App.tsx` lines 1265–1279 (plan-prose div + FloatingAnnotationAffordance) | exact |
| `ui/src/reviewer-v2/GutterIcon.tsx` | component (absolute button) | event-driven | `ui/src/App.tsx` `FloatingAnnotationAffordance` component (lines 204–338) | role-match |
| `ui/src/reviewer-v2/SelectionToolbar.tsx` | component (fixed toolbar) | event-driven | `ui/src/App.tsx` `FloatingAnnotationAffordance` component (lines 204–338) | exact |
| `ui/src/reviewer-v2/hooks/useTextSelection.ts` | hook | event-driven | `ui/src/hooks/useTextSelection.ts` | exact (verbatim copy) |
| `ui/src/reviewer-v2/utils/markdownRenderer.ts` | utility | transform | `ui/src/App.tsx` lines 19–32 (marked.use() calls) | role-match |
| `ui/src/reviewer-v2/ReviewerV2Shell.tsx` | component (layout) | — | itself (modify: replace `<main>` placeholder) | exact |
| `ui/index.css` | stylesheet | — | itself (modify: add paragraph hover rules) | exact |

---

## Pattern Assignments

### `ui/src/reviewer-v2/hooks/useTextSelection.ts` (hook, event-driven)

**Analog:** `ui/src/hooks/useTextSelection.ts`
**Action:** Copy verbatim. ESLint `no-restricted-imports` in `eslint.config.js` (lines 24–40) blocks `../` imports from within `reviewer-v2/`. The copy must be byte-identical at time of Phase 18 execution.

**Full file to copy** (`ui/src/hooks/useTextSelection.ts` lines 1–195):
```typescript
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

const HIGHLIGHT_NAME = 'selection-lock'

const supportsHighlights =
  typeof CSS !== 'undefined' && typeof CSS.highlights !== 'undefined'

// [full file — copy verbatim; see source file for complete implementation]
// Key exports:
export function rangeFromOffsets(container, start, end): Range | null  // named export
export function useTextSelection(containerRef): [string, () => void, () => {start,end}|null]
```

**Critical design constraints preserved in the copy:**
- `storedOffsets` uses `{ start: number; end: number }` — never stores live `Range` objects (Pitfall 2)
- `useLayoutEffect` (no deps array) re-applies highlight on every render via `rangeFromOffsets`
- `mouseup` listener on `document`, not on the container element
- `containerRef.current?.contains(e.target as Node)` guard before clearing selection

---

### `ui/src/reviewer-v2/utils/markdownRenderer.ts` (utility, transform)

**Analog:** `ui/src/App.tsx` lines 19–32

**Imports pattern** (from `App.tsx` lines 19–22):
```typescript
import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
```

**Core pattern** (from `App.tsx` lines 24–32):
```typescript
// Configure marked with GFM and syntax highlighting (module-level, runs once)
marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext'
    return hljs.highlight(code, { language }).value
  },
}))
marked.use({ gfm: true })
```

**New module wraps this in a guard** (prevent double-registration — Pitfall 4):
```typescript
let configured = false

export function renderMarkdown(md: string): string {
  if (!configured) {
    configured = true
    marked.use(markedHighlight({ /* ... */ }))
    marked.use({ gfm: true })
  }
  return marked.parse(md) as string
}
```

**Why a dedicated module:** `App.tsx` calls `marked.use()` at module load. Because `main.tsx` routes `/v2` to `ReviewerV2` (not `App`), the v2 bundle chunk may not load `App.tsx`, so the configuration is not guaranteed to run. Isolating in `markdownRenderer.ts` ensures configuration happens exactly once in the v2 subtree regardless of bundle splitting.

---

### `ui/src/reviewer-v2/PlanContent.tsx` (component, event-driven)

**Analog:** `ui/src/App.tsx` lines 1265–1279 (plan-prose div + FloatingAnnotationAffordance render site)

**Imports pattern:**
```typescript
import { useRef, useState } from 'react'
import { useTextSelection, rangeFromOffsets } from './hooks/useTextSelection'
import GutterIcon from './GutterIcon'
```

**Core pattern — dangerouslySetInnerHTML** (from `App.tsx` line 1269):
```typescript
<div ref={planRef} className="plan-prose" dangerouslySetInnerHTML={{ __html: planHtml }} />
```

**Core pattern — event delegation for paragraph hover** (from `RESEARCH.md` Pattern 2, verified against `App.tsx` event handler style):
```typescript
function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
  if (selectedText) return  // selection supersedes hover
  const target = e.target as Element
  const para = target.closest('p, li, blockquote, h1, h2, h3, h4, h5, h6')
  if (para && planRef.current?.contains(para)) {
    setHoveredParagraph(para as HTMLElement)
  } else {
    setHoveredParagraph(null)
  }
}

function handleMouseLeave() {
  setHoveredParagraph(null)
}
```

**Core pattern — hover background via inline style** (UI-SPEC interaction states):
```typescript
// Applied to the hovered paragraph element imperatively (avoids className toggle complexity)
if (hoveredParagraph) {
  hoveredParagraph.style.background = 'rgba(255,255,255,0.04)'
  hoveredParagraph.style.transition = 'background 0.1s ease'
  hoveredParagraph.style.borderRadius = '4px'
}
// Cleared on mouse leave
```

**Container structure** (from `App.tsx` lines 1262–1269, adapted for v2):
```typescript
<div
  ref={planRef}
  className="plan-prose"
  style={{ position: 'relative', maxWidth: 720, margin: '0 auto' }}
  onMouseMove={handleMouseMove}
  onMouseLeave={handleMouseLeave}
  dangerouslySetInnerHTML={{ __html: planHtml }}
/>
{hoveredParagraph && !selectedText && (
  <GutterIcon paragraph={hoveredParagraph} containerRef={planRef} onAdd={onAdd} />
)}
```

**Position: relative** is mandatory — GutterIcon is `position: absolute` anchored to this container.

---

### `ui/src/reviewer-v2/GutterIcon.tsx` (component, event-driven)

**Analog:** `ui/src/App.tsx` `FloatingAnnotationAffordance` component (lines 204–338) — same absolute-positioned affordance pattern.

**Imports pattern:**
```typescript
import type { RefObject } from 'react'
```

**Core pattern — absolute positioning using offsetTop** (from RESEARCH.md Pitfall 3 recommendation):
```typescript
function GutterIcon({ paragraph, containerRef, onAdd }: {
  paragraph: HTMLElement
  containerRef: RefObject<HTMLDivElement | null>
  onAdd: () => void
}) {
  // Use offsetTop (scroll-independent, document-relative within PlanContent)
  // NOT getBoundingClientRect() which requires scrollTop delta correction
  const top = paragraph.offsetTop + paragraph.offsetHeight / 2 - 12

  return (
    <button
      aria-label="Add comment to paragraph"
      // CRITICAL: prevent focus-steal that would collapse selection
      onMouseDown={(e) => e.preventDefault()}
      onClick={onAdd}
      style={{
        position: 'absolute',
        top,
        right: -8,
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: 'var(--color-surface)',
        color: 'var(--color-focus)',
        border: 'none',
        cursor: 'pointer',
        zIndex: 5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '16px',
        opacity: 0.7,
      }}
      onMouseOver={(e) => { e.currentTarget.style.opacity = '1' }}
      onMouseOut={(e) => { e.currentTarget.style.opacity = '0.7' }}
      onFocus={(e) => {
        e.currentTarget.style.outline = '2px solid var(--color-focus)'
        e.currentTarget.style.outlineOffset = '2px'
      }}
      onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
    >
      +
    </button>
  )
}
```

**Focus/hover pattern** (from `App.tsx` lines 254–258 — pill button focus handlers):
```typescript
onFocus={(e) => {
  e.currentTarget.style.outline = '2px solid var(--color-focus)'
  e.currentTarget.style.outlineOffset = '2px'
}}
onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
```

---

### `ui/src/reviewer-v2/SelectionToolbar.tsx` (component, event-driven)

**Analog:** `ui/src/App.tsx` `FloatingAnnotationAffordance` component (lines 204–338) — direct v2 equivalent.

**Key difference from analog:** UI-SPEC mandates `position: fixed` (not `position: absolute`). The analog uses `position: absolute` with scroll-offset math (`planTabRef.current.scrollTop`). The v2 version uses `Range.getBoundingClientRect()` directly as fixed coordinates — no scroll math.

**Imports pattern:**
```typescript
import { useRef } from 'react'
import { rangeFromOffsets } from './hooks/useTextSelection'
import type { AnnotationType } from './types'
```

**Core pattern — fixed positioning** (from `RESEARCH.md` Pattern 4, `App.tsx` lines 866–881 adapted):
```typescript
function SelectionToolbar({ offsets, containerRef, onAction, onClose }: {
  offsets: { start: number; end: number }
  containerRef: RefObject<HTMLDivElement | null>
  onAction: (type: AnnotationType, selectedText: string) => void
  onClose: () => void
}) {
  if (!containerRef.current) return null
  const range = rangeFromOffsets(containerRef.current, offsets.start, offsets.end)
  if (!range) return null
  const rect = range.getBoundingClientRect()
  // position: fixed — avoids all scroll-offset math
  const top = rect.bottom + 6
  const left = Math.min(rect.right, window.innerWidth - TOOLBAR_WIDTH)  // Pitfall 5 clamp
  // ...
}
```

**Pill rendering pattern** (from `App.tsx` lines 215–261):
```typescript
const pills: { type: AnnotationType; label: string; bg: string; color: string }[] = [
  { type: 'comment', label: 'Comment', bg: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' },
  { type: 'delete',  label: 'Delete',  bg: 'rgba(239, 68, 68, 0.2)',  color: '#ef4444' },
  { type: 'replace', label: 'Replace', bg: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' },
]
// Each pill:
<button
  key={pill.type}
  aria-label={`Add ${pill.label} annotation`}
  onMouseDown={(e) => e.preventDefault()}  // CRITICAL (Pitfall 1): must be present
  onClick={() => onAction(pill.type, selectedText)}
  style={{
    fontSize: '13px', fontWeight: 600,
    height: '28px',  // --toolbar-height inherited out-of-grid value
    padding: '0 10px', borderRadius: '4px',
    cursor: 'pointer', border: 'none',
    background: pill.bg, color: pill.color,
    outline: 'none',
  }}
  onFocus={(e) => {
    e.currentTarget.style.outline = '2px solid var(--color-focus)'
    e.currentTarget.style.outlineOffset = '2px'
  }}
  onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
>
  {pill.label}
</button>
```

**Toolbar wrapper** (from `App.tsx` lines 221–233, adapted to `position: fixed`):
```typescript
<div
  role="group"
  aria-label="Annotation actions"
  style={{
    position: 'fixed',  // v2 change from App.tsx's 'absolute'
    top,
    left,
    zIndex: 20,
    display: 'flex',
    gap: '6px',
    background: 'var(--color-surface)',
    borderRadius: '6px',
    padding: '4px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  }}
>
```

**"more" expander pattern** (from `App.tsx` lines 263–335 — `<details>/<summary>` with overflow chips):
```typescript
<details ref={detailsRef} style={{ position: 'relative' }}>
  <summary
    onMouseDown={(e) => e.preventDefault()}  // CRITICAL (Pitfall 1)
    style={{ /* same as App.tsx lines 270–284 */ }}
  >
    &#9662; more
  </summary>
  <div role="menu" style={{ position: 'absolute', top: '100%', /* ... */ }}>
    {/* quick-action chips — same QUICK_ACTIONS array as App.tsx */}
  </div>
</details>
```

---

### `ui/src/reviewer-v2/ContentPane.tsx` (component container, request-response + event-driven)

**Analog:** `ui/src/App.tsx` (plan fetch + state orchestration, lines 676–710 and 1250–1279)

**Imports pattern** (modelled on `App.tsx` imports, scoped to v2 subtree):
```typescript
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTextSelection, rangeFromOffsets } from './hooks/useTextSelection'
import { renderMarkdown } from './utils/markdownRenderer'
import PlanContent from './PlanContent'
import SelectionToolbar from './SelectionToolbar'
import type { AnnotationType } from './types'
```

**Plan fetch pattern** (from `App.tsx` lines 695–709):
```typescript
useEffect(() => {
  fetch('/api/plan')
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    })
    .then((data: { plan_md: string }) => {
      setPlanHtml(renderMarkdown(data.plan_md))
      setStatus('ready')
    })
    .catch(() => {
      setStatus('error')
    })
}, [])
```

**Selection position calculation** (from `App.tsx` lines 866–881, adapted to `position: fixed`):
```typescript
// v2 version: no containerRect subtraction — fixed coords come straight from range
useLayoutEffect(() => {
  if (!selectedText || !planRef.current) { setOffsets(null); return }
  const o = getOffsets()
  if (!o) { setOffsets(null); return }
  setOffsets(o)
}, [selectedText, getOffsets])
```

**Render structure:**
```typescript
return (
  <div style={{ position: 'relative' }}>
    {status === 'ready' && (
      <>
        <PlanContent
          planHtml={planHtml}
          planRef={planRef}
          selectedText={selectedText}
          onAdd={handleAdd}
        />
        {selectedText && offsets && (
          <SelectionToolbar
            offsets={offsets}
            containerRef={planRef}
            onAction={handleAction}
            onClose={resetTextSelection}
          />
        )}
      </>
    )}
    {status === 'loading' && <span style={{ color: 'var(--color-text-secondary)' }}>Loading…</span>}
    {status === 'error' && <span style={{ color: 'var(--color-text-secondary)' }}>
      Could not render plan — The markdown content is unavailable. Reload the page to retry.
    </span>}
  </div>
)
```

---

### `ui/src/reviewer-v2/ReviewerV2Shell.tsx` (modify — replace `<main>` placeholder)

**Analog:** itself — replace the placeholder `<span>Content</span>` (lines 62–70) with `<ContentPane />`.

**Current state** (`ReviewerV2Shell.tsx` lines 52–71):
```tsx
<main
  style={{
    flex: 1, minWidth: 0,
    background: 'var(--color-bg)',
    overflowY: 'auto',
    padding: 32,
  }}
>
  <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>
    Content  {/* ← Phase 18 replaces this with <ContentPane /> */}
  </span>
</main>
```

**Target state:**
```tsx
import ContentPane from './ContentPane'

// In the JSX, replace the <span> with:
<main style={{ flex: 1, minWidth: 0, background: 'var(--color-bg)', overflowY: 'auto', padding: 0 }}>
  <ContentPane />
</main>
```

Note: Remove `padding: 32` from `<main>` — `ContentPane` owns its own `padding: 32` per UI-SPEC (xl token). The `<main>` element becomes a pure flex container.

---

### `ui/index.css` (modify — add paragraph hover rules)

**Analog:** itself — append new rules after the existing `.plan-prose` block (after line 219).

**Existing CSS custom highlight declarations** (lines 192–195, already present — no change needed):
```css
::highlight(selection-lock) {
  background-color: rgba(59, 130, 246, 0.35);
  color: inherit;
}
```

**New rules to add** (paragraph hover background — not yet in file):
```css
/* Paragraph hover background — applied via inline style in PlanContent.tsx,
   but the transition is declared here for theme-aware override if needed */
.plan-prose .paragraph-hovered {
  background: rgba(255, 255, 255, 0.04);
  border-radius: 4px;
  transition: background 0.1s ease;
}

@media (prefers-color-scheme: light) {
  .plan-prose .paragraph-hovered {
    background: rgba(0, 0, 0, 0.03);
  }
}
```

**Alternative approach (inline style, no new CSS):** The UI-SPEC allows the hover background to be set via inline style directly on the paragraph element (`hoveredParagraph.style.background = 'rgba(255,255,255,0.04)'`). If the executor uses inline styles, no CSS change is needed. If the executor uses a toggled className `.paragraph-hovered`, add the rules above.

---

## Shared Patterns

### Critical: `onMouseDown → e.preventDefault()` on All Interactive Elements

**Source:** `ui/src/App.tsx` line 240 (explicit comment: "CRITICAL (Pitfall 1)")
**Apply to:** Every `<button>` inside `SelectionToolbar` and `GutterIcon`; also the `<summary>` element in the "more" expander.

```typescript
// CRITICAL (Pitfall 1): prevent mousedown from clearing selection before click fires
onMouseDown={(e) => e.preventDefault()}
```

Without this, clicking any toolbar button clears `selectedText` before the `onClick` handler runs, and no annotation is created.

### Focus Ring Pattern

**Source:** `ui/src/App.tsx` lines 254–258
**Apply to:** All `<button>` elements in `GutterIcon` and `SelectionToolbar`.

```typescript
onFocus={(e) => {
  e.currentTarget.style.outline = '2px solid var(--color-focus)'
  e.currentTarget.style.outlineOffset = '2px'
}}
onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
```

### CSS Variable Palette

**Source:** `ui/src/index.css` lines 4–41
**Apply to:** All inline styles in Phase 18 components.

| Token | Dark value | Light value | Usage in Phase 18 |
|-------|-----------|-------------|-------------------|
| `var(--color-bg)` | `#0f1117` | `#f8fafc` | ContentPane background |
| `var(--color-surface)` | `#1a1d27` | `#f1f5f9` | Toolbar/GutterIcon background |
| `var(--color-focus)` | `#3b82f6` | `#2563eb` | GutterIcon color, focus rings |
| `var(--color-border)` | `#2d3148` | `#cbd5e1` | Toolbar border (if used) |
| `var(--color-text-secondary)` | `#94a3b8` | `#64748b` | Loading/error state text |

### ESLint Import Boundary

**Source:** `ui/eslint.config.js` lines 24–40
**Apply to:** All files created under `ui/src/reviewer-v2/`.

Rule: `no-restricted-imports` with pattern `../**` — any import path starting with `../` from within `reviewer-v2/` will fail `npm run lint`. All utilities and hooks needed inside `reviewer-v2/` must live inside `reviewer-v2/`.

### Vitest Test Pattern (no `@testing-library/react`)

**Source:** `ui/src/reviewer-v2/useAnnotations.test.ts` lines 1–76
**Apply to:** `ContentPane.test.tsx`, `PlanContent.test.tsx`, `useTextSelection.test.ts`

Tests use pure Vitest (`describe`, `it`, `expect`) without `@testing-library/react`. React hooks with DOM side effects are tested by exercising the exported pure functions (reducers, utilities) directly. The `CSS.highlights` mock in `ui/vitest.setup.ts` (lines 20–26) handles the CSS Custom Highlight API for `useTextSelection` tests.

```typescript
import { describe, it, expect } from 'vitest'
// Import the pure function / reducer directly — no React renderer
import { annotationReducer, initialAnnotationState } from './useAnnotations'
```

### plan-prose CSS Class

**Source:** `ui/src/index.css` lines 64–183 (full `.plan-prose` block)
**Apply to:** `PlanContent.tsx` — the `dangerouslySetInnerHTML` container div.

```typescript
<div ref={planRef} className="plan-prose" dangerouslySetInnerHTML={{ __html: planHtml }} />
```

All GFM elements (tables, task list checkboxes, code blocks, blockquotes) are already styled. No additional CSS needed for prose rendering.

---

## No Analog Found

All Phase 18 files have strong analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `ui/src/` (all TypeScript/React files)
**Files scanned:** 28 source files
**Key analogs:** `ui/src/App.tsx` (1,569 lines — primary analog for all 5 new components), `ui/src/hooks/useTextSelection.ts` (195 lines — verbatim copy), `ui/src/reviewer-v2/ReviewerV2Shell.tsx` (97 lines — modified), `ui/src/index.css` (223 lines — modified)
**Pattern extraction date:** 2026-05-20
