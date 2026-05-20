# Phase 19: Outline Pane - Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 7
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `ui/src/reviewer-v2/OutlinePane.tsx` | component | event-driven | `ui/src/reviewer-v2/SelectionToolbar.tsx` | role-match |
| `ui/src/reviewer-v2/hooks/useOutline.ts` (optional) | hook | event-driven | `ui/src/reviewer-v2/useHeartbeat.ts` | role-match |
| `ui/src/reviewer-v2/ReviewerV2Shell.tsx` | component | request-response | `ui/src/reviewer-v2/ReviewerV2Shell.tsx` (self) | exact |
| `ui/src/reviewer-v2/ContentPane.tsx` | component | request-response | `ui/src/reviewer-v2/ContentPane.tsx` (self) | exact |
| `ui/src/reviewer-v2/utils/markdownRenderer.ts` | utility | transform | `ui/src/reviewer-v2/utils/markdownRenderer.ts` (self) | exact |
| `ui/src/reviewer-v2/utils/markdownRenderer.test.ts` | test | — | `ui/src/reviewer-v2/utils/markdownRenderer.test.ts` (self) | exact |
| `ui/src/reviewer-v2/types.ts` | model | — | `ui/src/reviewer-v2/types.ts` (self) | exact |

---

## Pattern Assignments

### `ui/src/reviewer-v2/OutlinePane.tsx` (component, event-driven)

**Analog:** `ui/src/reviewer-v2/SelectionToolbar.tsx` (prop-driven component with useEffect + useRef)

**Imports pattern** (SelectionToolbar.tsx lines 1-3):
```typescript
import { useEffect, useRef } from 'react'
import type { Section } from './types'
// No external packages needed — all browser-native APIs
```

**Props interface pattern** — typed inline object in function signature (SelectionToolbar.tsx lines 25-35):
```typescript
export default function OutlinePane({
  sections,
  activeId,
  mainRef,
  onActiveIdChange,
}: {
  sections: Section[]
  activeId: string | null
  mainRef: React.RefObject<HTMLElement | null>
  onActiveIdChange: (id: string) => void
}): React.JSX.Element {
```

**Button pattern** — use `<button>` NOT `<a>` for click-to-scroll (GutterIcon.tsx lines 17-50):
```typescript
// CRITICAL: Never <a href="#id"> — that pushes browser history (violates OUTLINE-02)
<button
  aria-label={`Scroll to ${section.text}`}
  onMouseDown={(e) => e.preventDefault()}  // prevent focus-steal during scroll
  onClick={() => {
    document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }}
  style={{
    // depth-driven indentation: paddingLeft = 16 + (depth - 1) * 8
    paddingLeft: 16 + (section.depth - 1) * 8,
    // active highlight via aria-current
  }}
  aria-current={section.id === activeId ? 'true' : undefined}
>
  {section.text}
</button>
```

**Focus/hover state pattern** (SelectionToolbar.tsx lines 102-107):
```typescript
onFocus={(e) => {
  e.currentTarget.style.outline = '2px solid var(--color-focus)'
  e.currentTarget.style.outlineOffset = '2px'
}}
onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
```

**IntersectionObserver useEffect pattern** — create/destroy in effect with cleanup (useHeartbeat.ts lines 99-149 as structural analog; actual IO pattern from RESEARCH.md Pattern 3):
```typescript
const activeItemRef = useRef<HTMLLIElement>(null)

// IntersectionObserver: watch heading elements within mainRef scroll container
useEffect(() => {
  if (!mainRef.current || sections.length === 0) return
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          onActiveIdChange(entry.target.id)
          break  // first intersecting entry wins
        }
      }
    },
    {
      root: mainRef.current,       // CRITICAL: must be the scroll container, not null
      rootMargin: '-10px 0px -85% 0px',  // narrow top band — calibrate during impl
      threshold: 0,
    }
  )
  sections.forEach(({ id }) => {
    const el = document.getElementById(id)
    if (el) observer.observe(el)
  })
  return () => observer.disconnect()  // cleanup always disconnects
}, [sections, mainRef, onActiveIdChange])

// Outline auto-scroll: keep active item visible in outline panel
useEffect(() => {
  activeItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}, [activeId])
```

**Active item ref attachment** — attach ref only to the active `<li>`:
```typescript
// In JSX list render:
<li ref={section.id === activeId ? activeItemRef : undefined}>
```

---

### `ui/src/reviewer-v2/hooks/useOutline.ts` (optional extraction, hook, event-driven)

**Analog:** `ui/src/reviewer-v2/useAnnotations.ts` (exported pure logic + hook wrapper)

**Structure pattern** (useAnnotations.ts lines 1-46): export pure function(s) for testability, wrap in hook:
```typescript
import { useEffect, useRef, type RefObject } from 'react'
import type { Section } from '../types'

// Exported pure-logic helpers (testable without React renderer):
export function slugify(text: string): string { ... }
export function extractRawText(tokens: marked.Token[]): string { ... }

// Hook wrapper — wires pure logic to React lifecycle
export function useOutline({
  sections,
  mainRef,
}: {
  sections: Section[]
  mainRef: RefObject<HTMLElement | null>
}): { activeId: string | null } {
  const [activeId, setActiveId] = useState<string | null>(null)
  // ... IntersectionObserver effect ...
  return { activeId }
}
```

**Test pattern** (useAnnotations.test.ts lines 1-5): import and call pure exported functions directly — no RTL:
```typescript
import { describe, it, expect } from 'vitest'
import { slugify, extractRawText } from './useOutline'
// or from markdownRenderer if slug lives there

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('My Heading')).toBe('my-heading')
  })
  it('strips non-alphanumeric characters', () => {
    expect(slugify('**Bold** Title')).toBe('bold-title')
  })
  it('handles duplicate suffix: second occurrence gets -2', () => {
    // test via heading renderer output, not slugify alone
  })
})
```

---

### `ui/src/reviewer-v2/ReviewerV2Shell.tsx` (component, request-response — modification)

**Current state** (ReviewerV2Shell.tsx lines 1-91): no state, no refs, static layout.

**Pattern to add** — useState + useRef at component top, following ContentPane.tsx lines 1-13:
```typescript
import { useRef, useState } from 'react'
import type { Section } from './types'
import OutlinePane from './OutlinePane'

export default function ReviewerV2Shell() {
  const mainRef = useRef<HTMLElement>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  // ...
}
```

**Prop threading pattern** — pass refs and callbacks down (ContentPane.tsx line 64 as structural model):
```typescript
// <main> element: add ref
<main
  ref={mainRef}
  style={{ flex: 1, minWidth: 0, background: 'var(--color-bg)', overflowY: 'auto', padding: 0 }}
>
  <ContentPane onSectionsFound={setSections} />
</main>

// <aside> left column: replace placeholder span with OutlinePane
<aside style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--color-border)', ... }}>
  <OutlinePane
    sections={sections}
    activeId={activeId}
    mainRef={mainRef}
    onActiveIdChange={setActiveId}
  />
</aside>
```

---

### `ui/src/reviewer-v2/ContentPane.tsx` (component, request-response — modification)

**Current state** (ContentPane.tsx lines 1-77): fetches `/api/plan`, renders via `planRef`, no section callback.

**Pattern to add** — new optional prop + useEffect on planHtml (follows existing useEffect at lines 14-25):

**Prop addition** — follow same typed inline object pattern (ContentPane.tsx line 8):
```typescript
import type { Section } from './types'

export default function ContentPane({
  onSectionsFound,
}: {
  onSectionsFound?: (sections: Section[]) => void
}) {
```

**Heading walk useEffect** — add after the fetch useEffect (ContentPane.tsx lines 14-25 as structural model):
```typescript
// After planHtml loads and React commits the DOM, walk headings
useEffect(() => {
  if (!planRef.current || !onSectionsFound) return
  const headings = planRef.current.querySelectorAll('h1,h2,h3,h4,h5,h6')
  const sections: Section[] = Array.from(headings).map((el) => ({
    id: el.id,
    text: el.textContent ?? '',
    depth: parseInt(el.tagName[1], 10),
  }))
  onSectionsFound(sections)
}, [planHtml, onSectionsFound])
// NOTE: useEffect([planHtml]) fires after DOM paint — querySelectorAll finds headings
```

---

### `ui/src/reviewer-v2/utils/markdownRenderer.ts` (utility, transform — modification)

**Current state** (markdownRenderer.ts lines 1-30): module-level `configured` flag, `marked.use()` called once.

**Extension pattern** — add module-level reset Map + heading renderer registration inside the `configured` guard:

```typescript
import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

let configured = false
// Module-level Map reset at the start of each renderMarkdown() call.
// CRITICAL: must be module-level (not local) because marked.use() registers
// the heading renderer once and the function closure reads this variable.
let headingSlugCounts: Map<string, number> = new Map()

// Exported for unit testing (no React renderer needed)
export function extractRawText(tokens: marked.Token[]): string {
  return tokens
    .map((t) => ('tokens' in t && t.tokens ? extractRawText(t.tokens as marked.Token[]) : t.raw ?? ''))
    .join('')
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

export function renderMarkdown(md: string): string {
  if (!configured) {
    configured = true
    marked.use(markedHighlight({
      langPrefix: 'hljs language-',
      highlight(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext'
        return hljs.highlight(code, { language }).value
      },
    }))
    marked.use({ gfm: true })
    // Heading renderer registered once; reads headingSlugCounts (reset per call below)
    marked.use({
      renderer: {
        // CRITICAL: regular method (not arrow) — this.parser requires `this` binding
        heading({ tokens, depth }: { tokens: marked.Token[]; depth: number }) {
          const rawText = extractRawText(tokens)
          const baseSlug = slugify(rawText)
          const count = headingSlugCounts.get(baseSlug) ?? 0
          headingSlugCounts.set(baseSlug, count + 1)
          const id = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`
          const innerHTML = this.parser.parseInline(tokens)
          return `<h${depth} id="${id}">${innerHTML}</h${depth}>\n`
        }
      }
    })
  }
  // Reset per-call state BEFORE parsing (Pitfall 1: module-level Map persists across calls)
  headingSlugCounts = new Map()
  return marked.parse(md) as string
}
```

---

### `ui/src/reviewer-v2/utils/markdownRenderer.test.ts` (test — modification)

**Current state** (markdownRenderer.test.ts lines 1-37): 6 tests calling `renderMarkdown()` directly.

**Extension pattern** — import and test exported pure functions, following useAnnotations.test.ts lines 1-5:
```typescript
import { describe, it, expect } from 'vitest'
import { renderMarkdown, slugify, extractRawText } from './markdownRenderer'

// New: test slugify pure function directly (no renderMarkdown needed)
describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('My Heading')).toBe('my-heading')
  })
  it('strips special characters leaving alphanumerics and hyphens', () => {
    expect(slugify('**Bold** Title')).toBe('bold-title')
  })
})

// New: test id injection via renderMarkdown output
describe('renderMarkdown heading ids', () => {
  it('injects id attribute on h1', () => {
    const result = renderMarkdown('# My Heading')
    expect(result).toContain('id="my-heading"')
  })
  it('duplicate headings get numeric suffix starting at -2', () => {
    const result = renderMarkdown('# Foo\n## Foo')
    expect(result).toContain('id="foo"')
    expect(result).toContain('id="foo-2"')
  })
  it('slug counter resets between renderMarkdown calls (no cross-call drift)', () => {
    renderMarkdown('# Foo')
    const second = renderMarkdown('# Foo')
    // Second independent call: first occurrence should be "foo", not "foo-2"
    expect(second).toContain('id="foo"')
    expect(second).not.toContain('id="foo-2"')
  })
})
```

---

### `ui/src/reviewer-v2/types.ts` (model — modification)

**Current state** (types.ts lines 1-13): `AnnotationType`, `Annotation`, `AnnotationAction`.

**Extension pattern** — add new type following same interface style:
```typescript
// Add after existing exports:
export interface Section {
  id: string      // slugified heading id matching the DOM element's id attribute
  text: string    // plain text content of the heading
  depth: number   // heading level 1–6 (from tagName[1])
}
```

---

## Shared Patterns

### CSS Variable Color Tokens
**Source:** `ui/src/reviewer-v2/SelectionToolbar.tsx`, `GutterIcon.tsx`, `ReviewerV2Shell.tsx`
**Apply to:** `OutlinePane.tsx` all styled elements
```typescript
// All colors use CSS variables — never hardcoded hex in layout
background: 'var(--color-surface)'
color: 'var(--color-text-secondary)'     // inactive items
color: 'var(--color-text-primary)'       // active item
border: '1px solid var(--color-border)'
outline: '2px solid var(--color-focus)'  // keyboard focus ring
```

### Inline Style Object Pattern
**Source:** `ui/src/reviewer-v2/ReviewerV2Shell.tsx` lines 6-88
**Apply to:** `OutlinePane.tsx` container and list items
```typescript
// This project uses inline style objects (not className/Tailwind) for layout
// Tailwind className used only for top-level structural divs in Shell (flex, h-screen)
style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 0, margin: 0, listStyle: 'none' }}
```

### Keyboard Focus Ring
**Source:** `ui/src/reviewer-v2/SelectionToolbar.tsx` lines 102-107, GutterIcon.tsx lines 37-44
**Apply to:** All `<button>` elements in `OutlinePane.tsx`
```typescript
onFocus={(e) => {
  e.currentTarget.style.outline = '2px solid var(--color-focus)'
  e.currentTarget.style.outlineOffset = '2px'
}}
onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
```

### IntersectionObserver jsdom Mock
**Source:** `ui/vitest.setup.ts` lines 4-11
**Apply to:** Any test file that imports a module using IntersectionObserver
```typescript
// Already registered globally — new tests inherit this mock automatically
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}))
// Tests can assert: expect(IntersectionObserver).toHaveBeenCalledWith(...)
// or inspect mock calls to verify root and rootMargin
```

### Source-Read Test Style (no RTL)
**Source:** `ui/src/reviewer-v2/ContentPane.test.ts` lines 1-49
**Apply to:** `OutlinePane.tsx` structural tests (component shape, prop contract)
```typescript
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import OutlinePane from './OutlinePane'

const source = readFileSync(resolve(__dirname, './OutlinePane.tsx'), 'utf-8')

describe('OutlinePane', () => {
  it('exports a function as default', () => {
    expect(typeof OutlinePane).toBe('function')
  })
  it('uses <button> not <a> for outline items (OUTLINE-02)', () => {
    expect(source).toContain('<button')
    expect(source).not.toContain('<a href=')
  })
  it('uses scrollIntoView for click-to-scroll', () => {
    expect(source).toContain('scrollIntoView')
  })
})
```

### Pure-Function Export for Testability
**Source:** `ui/src/reviewer-v2/useAnnotations.ts` lines 12-32, `ui/src/reviewer-v2/hooks/useTextSelection.ts` line 57
**Apply to:** `slugify`, `extractRawText` in `markdownRenderer.ts`; IntersectionObserver callback logic if extracted to `useOutline.ts`
```typescript
// Export business logic as named pure functions — do NOT inline in hook closures
export function slugify(text: string): string { ... }
export function extractRawText(tokens: marked.Token[]): string { ... }

// Then test them directly:
import { slugify } from './markdownRenderer'
expect(slugify('Hello World')).toBe('hello-world')
```

---

## No Analog Found

All files in this phase have close analogs in the existing codebase. No files require fallback to RESEARCH.md patterns alone.

---

## Critical Constraints (Non-Pattern)

These are not patterns to copy but blockers to avoid:

1. **No `@testing-library/react`** — all tests use pure function exports or source-read style. Confirmed by Phase 17 decision D-12 and RESEARCH.md.
2. **No `../` imports** — all new files must import only from within `ui/src/reviewer-v2/`. Isolation rule ARCH-01.
3. **No DOM mutation inside `dangerouslySetInnerHTML` children** — OutlinePane is a sibling `<aside>`, not inside `planRef`. Phase 18 blocking constraint.
4. **`<button>` not `<a>`** for outline items — `<a href="#id">` pushes browser history. OUTLINE-02 requirement.
5. **Regular method (not arrow) in marked renderer** — `this.parser.parseInline(tokens)` requires `this` binding. Verified against marked v18.0.0.

---

## Metadata

**Analog search scope:** `ui/src/reviewer-v2/`, `ui/vitest.setup.ts`
**Files scanned:** 14
**Pattern extraction date:** 2026-05-20
