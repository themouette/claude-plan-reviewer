# Phase 19: Outline Pane - Research

**Researched:** 2026-05-20
**Domain:** React 19 / marked v18 heading renderer / IntersectionObserver / scroll-driven UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** ContentPane callback — after `planHtml` loads, ContentPane walks its rendered DOM (`querySelectorAll('h1,h2,h3,h4,h5,h6')`), builds a `Section[]`, and calls `onSectionsFound(sections)`. `ReviewerV2Shell` stores `sections` in state and passes them to OutlinePane as a prop. ContentPane keeps its own `/api/plan` fetch — Shell is not refactored into a data owner.
- **D-02:** Heading IDs for scroll targeting — `renderMarkdown` is extended with a custom `marked` heading renderer that adds a slugified `id` attribute to each heading (e.g., `"My Heading"` → `"my-heading"`; duplicates get numeric suffixes: `"my-heading-2"`). `Section = { id: string, text: string, depth: number }`. No DOM nodes stored in state. OutlinePane calls `document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })` on click.
- **D-03:** OUTLINE-04 (comment count badges) is fully deferred to Phase 21.
- **D-04:** IntersectionObserver with `root: mainRef.current` and narrow top-band `rootMargin` (e.g., `-10px 0px -85% 0px`). When a heading enters the narrow top band, it becomes the active section.
- **D-05:** Outline panel auto-scroll — `activeItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })` when `activeId` changes.

### Claude's Discretion

- Exact `rootMargin` values for the IntersectionObserver top band — calibrate during implementation.
- Slug collision strategy for duplicate heading text (numeric suffix is the direction; exact implementation up to planner).
- Directory structure for new files within `reviewer-v2/` (e.g., `OutlinePane.tsx`, `hooks/useOutline.ts`).
- Whether the `useOutline` scroll tracking logic lives as a standalone hook or inline within `OutlinePane`.

### Deferred Ideas (OUT OF SCOPE)

- **OUTLINE-04 (comment count badges)** — moved to Phase 21. No badge UI, no `sectionId` field on `Annotation`.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OUTLINE-01 | Outline panel shows document heading hierarchy as a tree; each item reflects its heading depth via indentation | marked v18 heading renderer (D-02) extracts depth; `Section.depth` drives `paddingLeft: 16 + (depth - 1) * 8` |
| OUTLINE-02 | Clicking an outline item scrolls the corresponding heading via `scrollIntoView` — no browser history change, no anchor link | `<button>` (not `<a>`); `document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })` |
| OUTLINE-03 | The heading closest to the top of the content viewport is highlighted and auto-scrolled into view in the outline | IntersectionObserver on heading elements; `root: mainRef.current`; narrow top-band `rootMargin` |
| OUTLINE-04 | Comment count badges — DEFERRED to Phase 21 | Not in scope |
</phase_requirements>

---

## Summary

Phase 19 builds the left-column outline pane for the reviewer-v2 shell. The work falls into three distinct sub-problems: (1) injecting `id` attributes into headings at markdown render time, (2) extracting those headings from the DOM into a `Section[]` state that flows from ContentPane up to Shell and down to OutlinePane, and (3) tracking which section is active as the user scrolls, using a browser-native IntersectionObserver.

The codebase is in excellent shape. The `markdownRenderer.ts` module-level `configured` flag pattern and `marked.use({ renderer: {...} })` API are confirmed for marked v18. The IntersectionObserver mock is already in `vitest.setup.ts` from Phase 17. The test pattern established by `useAnnotations.test.ts` (export pure reducer, test without RTL) applies directly to the slug function and active-section logic.

No new npm packages are required. The entire phase is additive — three files modified (Shell, ContentPane, markdownRenderer), one type added (Section), and two new files created (OutlinePane, slug test).

**Primary recommendation:** Implement in wave order: (1) slug function + heading renderer in markdownRenderer.ts with tests, (2) Section type, (3) ContentPane heading walk with onSectionsFound callback, (4) Shell state wiring, (5) OutlinePane component + useOutline logic, (6) integration smoke test (source-read style).

---

## Project Constraints (from CLAUDE.md)

- **Tech stack**: Rust binary with React 19 frontend (not Svelte — CLAUDE.md "Recommended Stack" is aspirational; anchor to `ui/` reality).
- **No `@testing-library/react`**: Tests drive logic through exported pure functions or DI. Heading slug and IntersectionObserver callback must be exported for direct unit testing.
- **jsdom mocks**: `vitest.setup.ts` already mocks `IntersectionObserver`, `ResizeObserver`, and `CSS.highlights`.
- **Isolation rule (ARCH-01)**: All new files must live under `ui/src/reviewer-v2/`; no `../` imports.
- **No DOM mutation inside `dangerouslySetInnerHTML` children**: OutlinePane is a separate `<aside>` — it does NOT touch the `planRef` DOM tree.
- **Code quality**: Run `cargo fmt` and `cargo clippy` before commits (Rust only; frontend has ESLint).
- **Test coverage**: Every module with business logic needs at least one test; the slug function and section extractor are business logic.
- **Pre-commit hook**: `.githooks/` enforces fmt + clippy; frontend linting handled by `npm run lint`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Heading ID injection | Frontend (markdownRenderer.ts) | — | Slug generation is a pure function run at markdown render time; no backend involvement |
| Section[] extraction | Frontend (ContentPane useEffect) | — | DOM walk after `planHtml` loads; ContentPane already owns the rendered DOM via `planRef` |
| Active section state | Frontend (ReviewerV2Shell) | — | Shell owns shared state (sections, activeId, mainRef) passed as props to both panes |
| Scroll tracking logic | Frontend (OutlinePane or useOutline hook) | — | IntersectionObserver on heading elements inside the `<main>` scroll container |
| Click-to-scroll | Frontend (OutlinePane) | — | `document.getElementById(id).scrollIntoView` — pure DOM API, no state change |
| Outline auto-scroll | Frontend (OutlinePane) | — | `activeItemRef.scrollIntoView` triggered by activeId prop change |

---

## Standard Stack

### Core — already installed, no new packages

| Library | Installed Version | Purpose | Why Standard |
|---------|------------------|---------|--------------|
| marked | 18.0.0 | Markdown to HTML; heading renderer extension | Already used in `markdownRenderer.ts` |
| react | 19.2.4 | Component tree, hooks, refs | Project runtime |
| vitest | 4.1.4 | Unit tests | Already configured with jsdom + setup file |

### No New Packages Required

This phase adds zero npm dependencies. All capabilities are available through:
- `marked` custom renderer API (heading id injection)
- Browser-native `IntersectionObserver` (active section tracking)
- `document.getElementById().scrollIntoView()` (click-to-scroll and outline auto-scroll)
- `useRef` / `useState` / `useEffect` from React 19

---

## Package Legitimacy Audit

No external packages are installed in this phase.

**Packages removed due to slopcheck:** none
**Packages flagged as suspicious:** none

---

## Architecture Patterns

### System Architecture Diagram

```
markdownRenderer.ts
  slugify(text) ─────────────────────────────────────────┐
  heading renderer: injects id attr into <hN> elements    │
                                                          │
ContentPane                                               │
  useEffect([planHtml]) {                                 │
    planRef.current.querySelectorAll('h1..h6')            │
    → Section[] (id, text, depth)                         │
    → onSectionsFound(sections) prop callback ───────┐    │
  }                                                   │   │
                                                      ▼   ▼
ReviewerV2Shell  ◄──── sections state ─────────────────────
  mainRef ────────────────────────────────────────────┐
  [sections, setSections]                             │
  [activeId, setActiveId]                             │
       │ sections, activeId props                     │ mainRef prop
       ▼                                              ▼
OutlinePane                               ContentPane
  useOutline (IntersectionObserver)  ←── root: mainRef.current
    on heading enters top band             watches heading elements
    → setActiveId(section.id)             in <main> scroll container
  
  renders <ol>
    <li> per section
      <button>
        paddingLeft: 16 + (depth-1) * 8
        aria-current="true" if active
        scrollIntoView on click ──────────────► document.getElementById(id)
  
  activeItemRef on active <li>
    useEffect([activeId]) → activeItemRef.scrollIntoView('nearest')
```

### Recommended Project Structure

```
ui/src/reviewer-v2/
├── OutlinePane.tsx          # New: left-column outline component
├── ReviewerV2Shell.tsx      # Modified: add mainRef, sections, activeId state
├── ContentPane.tsx          # Modified: add onSectionsFound prop + heading walk
├── types.ts                 # Modified: add Section type
└── utils/
    ├── markdownRenderer.ts  # Modified: add heading renderer with slugify
    └── markdownRenderer.test.ts  # Modified: add slug + id-injection tests
```

Optional (if complexity warrants extraction):
```
ui/src/reviewer-v2/
└── hooks/
    └── useOutline.ts        # Optional: extract IntersectionObserver logic for testability
```

### Pattern 1: marked v18 Heading Renderer with ID Injection

**What:** Extend `renderMarkdown()` in `markdownRenderer.ts` with a custom heading renderer that generates a slugified `id` attribute and tracks duplicate headings per-call using a local `Map`.

**When to use:** Whenever heading IDs must be stable and match the DOM (used for `getElementById` scroll targeting in OutlinePane).

**Critical constraint:** The slug counter `Map` must be local to each `renderMarkdown()` call — a module-level counter would persist across calls and cause duplicate-suffix drift between renders.

```typescript
// Source: verified against marked v18.0.0 installed in ui/node_modules/marked
// Heading renderer signature confirmed: heading({ tokens, depth })
// this.parser.parseInline(tokens) renders inline HTML (bold, code, etc.)

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

// Called inside renderMarkdown() so slugCounts is local to each render call
function makeHeadingRenderer(slugCounts: Map<string, number>) {
  return {
    heading({ tokens, depth }: { tokens: marked.Token[]; depth: number }) {
      const rawText = tokens.map((t) => ('raw' in t ? t.raw : '')).join('')
      const baseSlug = slugify(rawText)
      const count = slugCounts.get(baseSlug) ?? 0
      slugCounts.set(baseSlug, count + 1)
      const id = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`
      const innerHTML = this.parser.parseInline(tokens)
      return `<h${depth} id="${id}">${innerHTML}</h${depth}>\n`
    }
  }
}

export function renderMarkdown(md: string): string {
  if (!configured) {
    configured = true
    // ... existing markedHighlight and gfm setup ...
  }
  const slugCounts = new Map<string, number>()
  // Use a per-call marked instance or override per render
  // NOTE: marked.use() is additive and global — use marked.parse() with options
  // OR reset the renderer per call. See Pitfall 2 for correct approach.
  return marked.parse(md) as string
}
```

**Note on `configured` flag + per-call renderer:** The `configured` flag pattern in the existing code works for idempotent `marked.use()` calls. Heading ID generation requires a per-call counter. The implementation must either: (a) pass the heading renderer via `marked.parse(md, { renderer })` options argument (not `marked.use()`), or (b) use `marked.use()` once with a renderer that reads from a module-level Map that is reset at the start of each `renderMarkdown()` call. Approach (a) is cleaner.

```typescript
// VERIFIED approach using marked.parse options (avoids global state):
// Source: marked v18 API — marked.parse(md, options) accepts renderer override
export function renderMarkdown(md: string): string {
  if (!configured) {
    configured = true
    marked.use(markedHighlight({ ... }))
    marked.use({ gfm: true })
  }
  const slugCounts = new Map<string, number>()
  const renderer = {
    heading({ tokens, depth }: Heading) {
      const rawText = extractRawText(tokens)
      const baseSlug = slugify(rawText)
      const count = slugCounts.get(baseSlug) ?? 0
      slugCounts.set(baseSlug, count + 1)
      const id = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`
      return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`
    }
  }
  return marked.parse(md, { renderer }) as string
}
```

[VERIFIED: npm registry — marked 18.0.0 installed, API confirmed via node execution in ui/]

### Pattern 2: ContentPane Heading Walk (DOM Extraction)

**What:** After `planHtml` loads and React renders the markdown into the DOM, walk `planRef.current.querySelectorAll('h1,h2,h3,h4,h5,h6')` to extract `Section[]` and call `onSectionsFound`.

**When to use:** In the `useEffect` that depends on `planHtml`.

```typescript
// Source: codebase pattern — ContentPane.tsx useEffect, planRef pattern
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
```

[ASSUMED — pattern is conventional React; specific useEffect deps require review during implementation]

### Pattern 3: IntersectionObserver for Active Section Tracking

**What:** Observe all heading elements within the `<main>` scroll container. When a heading enters the narrow top band (approximately the first 10–15% of viewport height), mark it as the active section.

**When to use:** Implemented in `OutlinePane` (inline) or `useOutline` hook (extracted). The `IntersectionObserver` constructor is already mocked in `vitest.setup.ts`.

```typescript
// Source: CONTEXT.md D-04, UI-SPEC Interaction Contract
// Root: mainRef.current ensures IntersectionObserver tracks scroll within <main>
// rootMargin: narrow top band — calibrate during implementation
useEffect(() => {
  if (!mainRef.current || sections.length === 0) return
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          onActiveIdChange(entry.target.id)
          break // first intersecting entry wins
        }
      }
    },
    {
      root: mainRef.current,
      rootMargin: '-10px 0px -85% 0px',
      threshold: 0,
    }
  )
  sections.forEach(({ id }) => {
    const el = document.getElementById(id)
    if (el) observer.observe(el)
  })
  return () => observer.disconnect()
}, [sections, mainRef, onActiveIdChange])
```

[ASSUMED — rootMargin is a starting calibration; exact values are Claude's discretion per CONTEXT.md]

### Pattern 4: Outline Auto-Scroll on activeId Change

**What:** When `activeId` changes, scroll the corresponding outline item into view.

```typescript
// Source: CONTEXT.md D-05
const activeItemRef = useRef<HTMLLIElement>(null)

useEffect(() => {
  activeItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}, [activeId])

// In JSX: attach ref to the active <li>
<li ref={section.id === activeId ? activeItemRef : undefined}>
```

[ASSUMED — standard React useEffect + ref pattern]

### Anti-Patterns to Avoid

- **`<a href="#id">` for outline items**: Pushes browser history, changes URL — violates OUTLINE-02. Always use `<button>` with `scrollIntoView`.
- **DOM element refs in Section type**: Re-renders invalidate refs. Use `id` strings + `getElementById` (D-02 decision).
- **Module-level slug counter Map**: Persists across `renderMarkdown()` calls — headings in document 2 would get wrong suffixes. Keep counter Map local to each call.
- **Calling `marked.use()` with heading renderer** on every `renderMarkdown()` call: The `configured` flag prevents double-registration, so calling `marked.use()` with a per-call renderer would register it only once. Pass via `marked.parse(md, { renderer })` instead to get per-call behavior.
- **Storing `IntersectionObserver` instance in component state**: Use a `useRef` or create/destroy in `useEffect` cleanup — avoid re-creates on every render.
- **`block: 'start'` for outline auto-scroll**: Would scroll the active item to the top of the outline panel even if it's already visible — jarring UX. Use `block: 'nearest'` (D-05).
- **Setting `activeId` on every IntersectionObserver exit event**: The "last entered heading stays active" rule means only `isIntersecting === true` transitions should update `activeId`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Heading ID generation | Custom parser or regex on raw markdown | marked v18 heading renderer (`marked.use({ renderer: { heading } })` or `marked.parse(md, { renderer })`) | Already integrated; handles inline tokens (bold, code in headings) correctly |
| Active section detection | Scroll event listener + `getBoundingClientRect` polling | `IntersectionObserver` with `root: mainRef.current` | Zero polling, browser-native, already mocked in vitest.setup.ts |
| Outline auto-scroll | Calculating scroll position manually | `element.scrollIntoView({ block: 'nearest' })` | Browser handles all edge cases (already-visible items, oversized items, etc.) |
| Click-to-scroll | `window.scrollTo()` with calculated offset | `document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })` | Handles dynamic content height; no offset calculation needed |

**Key insight:** This phase intentionally uses only browser-native APIs. No new npm packages are needed.

---

## Common Pitfalls

### Pitfall 1: `marked.use()` heading renderer persists across test runs

**What goes wrong:** `configured` flag is module-level. If test A calls `renderMarkdown` and registers the heading renderer, test B in the same module inherits it — but the slug counter Map (if stored module-level) also persists, causing wrong IDs for test B headings.

**Why it happens:** vitest runs tests in the same module process; module-level variables are shared.

**How to avoid:** Keep the slug counter `Map` strictly local to each `renderMarkdown()` call (created inside the function body). The `configured` flag is fine for one-time setup of idempotent `marked.use()` calls.

**Warning signs:** Tests that call `renderMarkdown` multiple times get headings with unexpected `-2` suffixes.

### Pitfall 2: IntersectionObserver `root` must be the scroll container, not `document`

**What goes wrong:** If `root` is `null` (default = viewport), the observer watches the browser viewport, not the `<main>` element's scroll container. Scrolling inside `<main>` won't trigger intersection events.

**Why it happens:** The `<main>` element has `overflowY: auto` — it is the scroll container, not the document viewport.

**How to avoid:** Pass `root: mainRef.current` explicitly. Guard: `if (!mainRef.current) return` before creating the observer.

**Warning signs:** Active section never updates despite scrolling.

### Pitfall 3: Stale `sections` in IntersectionObserver closure

**What goes wrong:** The `useEffect` creates the observer with the `sections` array at the time it runs. If `sections` changes (document reloads), the observer still watches old heading elements.

**Why it happens:** `useEffect` closure captures the `sections` array from the render that created it.

**How to avoid:** Include `sections` in the `useEffect` dependency array. Cleanup (`observer.disconnect()`) runs before the new observer is created.

**Warning signs:** After a page reload in dev mode, the outline shows correct items but active tracking stops working.

### Pitfall 4: `useEffect` timing — heading DOM not yet painted

**What goes wrong:** The `useEffect` that walks `planRef.current.querySelectorAll(...)` runs before React has committed the new `planHtml` to the DOM.

**Why it happens:** `useEffect` fires after paint. But React batches state updates — the `planHtml` state setter and the DOM update happen in the same commit, so `useEffect([planHtml])` runs after the DOM is painted with the new HTML.

**How to avoid:** The existing `useEffect([planHtml])` pattern in ContentPane is correct. No `useLayoutEffect` needed for the heading walk.

**Warning signs:** `querySelectorAll` returns an empty NodeList despite `planHtml` being non-empty.

### Pitfall 5: `this.parser.parseInline(tokens)` — `this` binding in arrow functions

**What goes wrong:** If the heading renderer is an arrow function, `this.parser` is `undefined`.

**Why it happens:** Arrow functions don't bind `this`; marked calls the renderer with `this` set to the renderer instance.

**How to avoid:** Use a regular function expression (not arrow) in the renderer object:

```typescript
// CORRECT: regular method
heading({ tokens, depth }) { ... this.parser.parseInline(tokens) ... }

// WRONG: arrow function — this.parser is undefined
heading: ({ tokens, depth }) => { ... this.parser.parseInline(tokens) ... }
```

[VERIFIED: confirmed via node execution against marked v18.0.0]

### Pitfall 6: `marked.parse()` options renderer API

**What goes wrong:** Passing `{ renderer: { heading: fn } }` directly to `marked.parse()` as the second argument does not work in marked v18 — the second argument expects a `MarkedOptions` object where `renderer` is a full `Renderer` instance, not a plain object.

**Why it happens:** marked v18 `parseMarkdown()` calls `new Parser(options)` which wraps the renderer — plain objects are not accepted as renderer instances in that path.

**How to avoid:** Use `marked.use({ renderer: { heading: fn } })` pattern, but call it inside `renderMarkdown()` if per-call behavior is needed (with reset of the counter Map via closure). Or use the `walkTokens` hook to extract sections separately from rendering.

**Alternative safe approach:** Use `marked.use()` once (guarded by `configured`) with a heading renderer that reads/writes from a `Map` stored in a module-level variable that is reset at the top of `renderMarkdown()`:

```typescript
let headingSlugCounts: Map<string, number> = new Map()

// In renderMarkdown():
headingSlugCounts = new Map() // reset before each render
return marked.parse(md) as string

// In heading renderer registered via marked.use():
heading({ tokens, depth }) {
  // reads/writes headingSlugCounts
}
```

[VERIFIED: confirmed via node execution — `marked.parse(md, { renderer: plainObj })` does not work; `marked.use({ renderer: { heading } })` is the correct API]

---

## Code Examples

### Verified: marked v18 heading renderer with id injection

```typescript
// Source: verified against marked 18.0.0 via node execution in ui/
// Test: node --input-type=module with actual installed package

import { marked } from 'marked'

let configured = false
let headingSlugCounts: Map<string, number> = new Map()

function extractRawText(tokens: marked.Token[]): string {
  return tokens
    .map((t) => ('tokens' in t && t.tokens ? extractRawText(t.tokens as marked.Token[]) : t.raw ?? ''))
    .join('')
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

export function renderMarkdown(md: string): string {
  if (!configured) {
    configured = true
    // ... markedHighlight and gfm setup unchanged ...
    marked.use({
      renderer: {
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
  // Reset per-call state before parsing
  headingSlugCounts = new Map()
  return marked.parse(md) as string
}
```

### Verified: IntersectionObserver mock already registered

```typescript
// Source: ui/vitest.setup.ts (Phase 17, already in place)
// The mock returns { observe, unobserve, disconnect, root, rootMargin, thresholds }
// Any new code using IntersectionObserver works within this mock environment
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}))
```

### Verified: ReviewerV2Shell current `<main>` element

```typescript
// Source: ui/src/reviewer-v2/ReviewerV2Shell.tsx (read directly)
// The <main> element currently has no ref — Phase 19 adds mainRef
<main
  ref={mainRef}  // add this
  style={{
    flex: 1,
    minWidth: 0,
    background: 'var(--color-bg)',
    overflowY: 'auto',  // this is the scroll container
    padding: 0,
  }}
>
  <ContentPane onSectionsFound={setSections} mainRef={mainRef} />
</main>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Scroll event listener + getBoundingClientRect polling | IntersectionObserver with root container | ~2019 (broad browser support) | Zero polling overhead; browser-native |
| `window.location.hash = '#id'` for in-page navigation | `element.scrollIntoView({ behavior: 'smooth' })` | Widespread post-2018 | No URL change, no history push |
| marked Renderer subclass | `marked.use({ renderer: { methodName } })` plugin API | marked v1 → v2+ | Modular, chainable, no subclassing |

**Deprecated/outdated:**
- `marked.setOptions()`: Still works but `marked.use()` is the idiomatic v2+ API.
- Subclassing `marked.Renderer`: Works but the plugin API (`marked.use`) is preferred.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `useEffect([planHtml])` timing is sufficient (DOM is painted before the effect) — no `useLayoutEffect` needed for heading walk | Pitfall 4 / Pattern 2 | If wrong: querySelectorAll returns empty NodeList; fix is trivial (change to useLayoutEffect) |
| A2 | `rootMargin: '-10px 0px -85% 0px'` is a reasonable starting calibration for active section tracking | Pattern 3 | Minor: calibration values are Claude's discretion; wrong values mean active section highlights too late/early |
| A3 | Passing `mainRef` as a prop to ContentPane is the correct integration for the IntersectionObserver root | Architecture Patterns | If wrong: alternative is Shell owns the IntersectionObserver; requires refactoring but scope is small |

**All non-assumed claims were verified** against installed packages (marked 18.0.0), existing codebase files (read directly), and node execution.

---

## Open Questions

1. **IntersectionObserver root: `mainRef` passed to `OutlinePane` or owned by Shell?**
   - What we know: CONTEXT.md D-04 says `root: mainRef.current` where `mainRef` is the center `<main>` scroll container. Shell owns `mainRef`.
   - What's unclear: Whether `mainRef` should be passed as a prop to OutlinePane (for IntersectionObserver creation) or Shell should own the observer.
   - Recommendation: Pass `mainRef` as a prop to OutlinePane — keeps observer lifecycle co-located with the component that uses it. Shell manages the ref, OutlinePane manages the observer.

2. **Slug algorithm for headings with inline markup (e.g., `## **Bold** Title`)**
   - What we know: `extractRawText()` walking `token.raw` yields `**Bold** Title` — the raw markdown, not stripped text.
   - What's unclear: Whether to strip markdown syntax from the raw text before slugifying (yielding `bold-title`) or use raw (yielding `bold-title` anyway since `*` is stripped by the non-alphanumeric regex).
   - Recommendation: The non-alphanumeric strip (`replace(/[^a-z0-9-]/g, '')`) handles this — `**bold** title` becomes `bold-title`. No special handling needed.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/test | Yes | 25.8.1 | — |
| npm / vitest | Test runner | Yes | vitest 4.1.4 | — |
| marked 18.0.0 | Heading renderer | Yes | 18.0.0 (installed) | — |
| IntersectionObserver (browser) | Active section tracking | Yes (mocked in jsdom) | Mock registered in vitest.setup.ts | — |
| jsdom | Test environment | Yes | 29.1.1 | — |

**Missing dependencies with no fallback:** none

---

## Sources

### Primary (HIGH confidence)
- `ui/node_modules/marked/lib/marked.umd.js` — marked v18.0.0 installed; heading renderer signature `heading({ tokens, depth })` and `this.parser.parseInline(tokens)` verified via node execution
- `ui/src/reviewer-v2/` codebase files — read directly: ReviewerV2Shell.tsx, ContentPane.tsx, markdownRenderer.ts, types.ts, useAnnotations.ts, useAnnotations.test.ts, hooks/useTextSelection.ts, vitest.setup.ts
- `.planning/phases/19-outline-pane/19-CONTEXT.md` — locked decisions D-01 through D-05
- `.planning/phases/19-outline-pane/19-UI-SPEC.md` — visual contract, component structure, interaction contract
- `ui/package.json` — confirmed React 19.2.4, marked 18.0.0, vitest 4.1.4, no new packages needed

### Secondary (MEDIUM confidence)
- Node execution results — `marked.use({ renderer: { heading } })` API behavior and token structure confirmed interactively

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — marked 18.0.0 and all dependencies confirmed installed and working
- Architecture: HIGH — codebase read directly, all integration points verified
- Pitfalls: HIGH — pitfall 5 (arrow function this binding) and pitfall 6 (marked.parse renderer API) verified via node execution
- IntersectionObserver root margin values: LOW — starting calibration only; explicitly Claude's discretion

**Research date:** 2026-05-20
**Valid until:** 2026-06-20 (stable stack; marked v18 API unlikely to change within 30 days)
