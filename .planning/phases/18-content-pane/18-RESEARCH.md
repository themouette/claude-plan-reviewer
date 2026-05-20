# Phase 18: Content Pane — Research

**Researched:** 2026-05-20
**Domain:** React 19 · marked@18 · CSS Custom Highlight API · paragraph hover affordance · character-offset text selection
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LAYOUT-02 | Three-column shell: outline tree (left) / formatted markdown (center) / comment sidebar (right) | Phase 17 produced `ReviewerV2Shell` with the 3-column skeleton; Phase 18 fills the center `<main>` slot |
| CONTENT-01 | Markdown renders as formatted HTML with GFM support (tables, task lists, strikethrough) using `marked` + `marked-highlight` + `highlight.js` (NOT `react-markdown` per UI-SPEC ruling) | `marked@18` with `{ gfm: true }` + `markedHighlight` already wired in `App.tsx`; same pattern copied into `reviewer-v2/` |
| CONTENT-02 | Hovering a paragraph shows subtle background + `+` gutter icon at right edge | Event delegation via `onMouseMove` on container + `closest()` identifies target paragraph; `getBoundingClientRect()` positions absolute `GutterIcon`; cleared while selection is active |
| CONTENT-03 | Selecting text replaces hover highlight with `::highlight(selection-lock)`; shows `SelectionToolbar` anchored to selection end; character-offset serialization | `useTextSelection` hook already exists at `ui/src/hooks/useTextSelection.ts` and must be copied to `reviewer-v2/` (ESLint blocks cross-subtree imports); `SelectionToolbar` mirrors `FloatingAnnotationAffordance` from `App.tsx` |

</phase_requirements>

---

## Summary

Phase 18 fills the center content column of the `ReviewerV2Shell` produced by Phase 17. It introduces three tightly coupled pieces: GFM markdown rendering (`PlanContent`), paragraph hover affordance (`ParagraphHoverLayer` + `GutterIcon`), and text-selection comment toolbar (`SelectionToolbar`).

All markdown libraries are already installed — `marked@18.0.0`, `marked-highlight@2.2.4`, `highlight.js@11.11.1`. No new npm packages are required. The GFM configuration pattern and the CSS Custom Highlight API usage are fully established in `App.tsx` and `ui/src/hooks/useTextSelection.ts`. Phase 18 copies these patterns into the `reviewer-v2/` subtree rather than importing across the isolation boundary enforced by ESLint.

The primary technical risk is the `SelectionToolbar` positioning. `App.tsx` uses `position: absolute` anchored to a container scroll offset; the UI-SPEC mandates `position: fixed` to avoid scroll-offset math. The `onMouseDown` → `e.preventDefault()` guard is critical — without it, the mousedown on a toolbar button clears the selection before the click fires, and no annotation is created. This pitfall is explicitly documented in `App.tsx` line comments and must be preserved in the v2 copy.

**Primary recommendation:** Copy `useTextSelection.ts` verbatim into `reviewer-v2/hooks/useTextSelection.ts`, compose `ContentPane` from `PlanContent` + `ParagraphHoverLayer` + `GutterIcon` + `SelectionToolbar`, and wire the `marked` configuration identically to `App.tsx`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| GFM markdown rendering | Frontend (React component) | — | Client-side `marked.parse()` called in a `useEffect` after fetching `/api/plan`; same pattern as existing `App.tsx` |
| Paragraph hover detection | Browser / Client | — | DOM event delegation (`onMouseMove` + `closest()`); no server involvement |
| Gutter icon positioning | Browser / Client | — | `getBoundingClientRect()` on hovered element; absolute positioned within `PlanContent` |
| Text selection capture | Browser / Client | — | `document.addEventListener('mouseup')` in `useTextSelection`; character offset computed immediately from the live DOM |
| CSS Custom Highlight | Browser / Client | — | `CSS.highlights` API; already mocked in `vitest.setup.ts`; no server |
| SelectionToolbar positioning | Browser / Client | — | `position: fixed` using `Range.getBoundingClientRect()` of selection end |
| Plan data fetch | API / Backend | Frontend (caches result) | `GET /api/plan` returns `{ plan_md: string }` — same endpoint as `App.tsx` |

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `marked` | 18.0.0 [VERIFIED: npm registry] | Parse markdown → HTML | Already in `package.json`; GFM on by default in v18; same library used by existing `App.tsx` |
| `marked-highlight` | 2.2.4 [VERIFIED: npm registry] | Syntax highlighting extension for `marked` | Wired in `App.tsx`; pairs with `highlight.js` |
| `highlight.js` | 11.11.1 [VERIFIED: npm registry] | Token-level syntax highlighting | `github-dark` theme already imported; hljs registered via `markedHighlight` |
| `react` | 19.2.4 [VERIFIED: npm registry] | Component model | Project stack |

### Supporting (existing project hooks / utilities)

| Utility | Location | Purpose | How Used in Phase 18 |
|---------|----------|---------|----------------------|
| `useTextSelection` | `ui/src/hooks/useTextSelection.ts` | Character-offset selection capture + CSS highlight lock | Must be **copied** to `reviewer-v2/hooks/useTextSelection.ts` — ESLint blocks `../` imports |
| `rangeFromOffsets` | same file | Reconstruct a Range from char offsets (inverse of offset extraction) | Used by `SelectionToolbar` to get `getBoundingClientRect()` of current selection |
| `CSS.highlights` mock | `ui/vitest.setup.ts` | Prevents `TypeError: CSS.highlights is undefined` in tests | Already registered; Phase 17 satisfied TEST-02 |

### No New npm Packages Required

The UI-SPEC explicitly states: "No new npm packages required for this phase. All dependencies (`marked`, `marked-highlight`, `highlight.js`, React 19) are already in `package.json`."

---

## Package Legitimacy Audit

> Not applicable — no new packages are installed in this phase. All dependencies are pre-existing in `package.json`.

---

## Architecture Patterns

### System Architecture Diagram

```
User browser
  │
  ├─ GET /api/plan ──────────────────► Rust server
  │        └── { plan_md: string } ◄──┘
  │
  ▼
ReviewerV2 (ReviewerV2.tsx)
  └─ ReviewerV2Shell (3 columns)
       └─ <main> center column
            └─ ContentPane
                 ├─ fetch('/api/plan') → marked.parse(md) → planHtml
                 ├─ PlanContent  ← dangerouslySetInnerHTML={planHtml}
                 │    ├─ .plan-prose CSS class (already in index.css)
                 │    ├─ onMouseMove → closest('p,li,blockquote,h1..h6')
                 │    │    └─ ParagraphHoverLayer (state only)
                 │    │         └─ GutterIcon (absolute, right:-8px)
                 │    └─ useTextSelection(planRef)
                 │         ├─ mouseup → getRangeOffsets → storedOffsets
                 │         ├─ CSS.highlights.set('selection-lock', …)
                 │         └─ [selectedText, reset, getOffsets]
                 └─ SelectionToolbar (position:fixed)
                      ├─ visible when selectedText non-empty
                      ├─ anchored to Range.getBoundingClientRect() of selection end
                      └─ pills: Comment | Delete | Replace | ▾ more
```

### Recommended Project Structure

```
ui/src/reviewer-v2/
├── hooks/
│   └── useTextSelection.ts    # Copied verbatim from hooks/useTextSelection.ts
├── ContentPane.tsx             # Container: PlanContent + SelectionToolbar
├── PlanContent.tsx             # dangerouslySetInnerHTML + paragraph hover logic
├── GutterIcon.tsx              # Absolute-positioned + button
├── SelectionToolbar.tsx        # Fixed-positioned pill toolbar
├── ContentPane.test.tsx        # Unit tests for ContentPane integration
├── PlanContent.test.tsx        # Paragraph hover state transitions
├── useTextSelection.test.ts    # Copy of existing hook tests (already green)
├── ReviewerV2.tsx              # (existing — wires ContentPane into Shell)
├── ReviewerV2Shell.tsx         # (existing — replace <main> placeholder)
└── ... (other Phase 17 files unchanged)
```

### Pattern 1: `marked` GFM Configuration (copy from App.tsx)

**What:** Module-level `marked.use()` calls configure GFM + syntax highlighting once.
**When to use:** At the top of `ContentPane.tsx` (or a shared `markdownRenderer.ts` in `reviewer-v2/utils/`).
**Example:**
```typescript
// Source: ui/src/App.tsx lines 24-32 [VERIFIED: codebase]
import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext'
    return hljs.highlight(code, { language }).value
  },
}))
marked.use({ gfm: true })
```

The `gfm: true` flag enables tables, task list checkboxes, strikethrough, and autolinks. `marked@18` has `gfm: true` as its default, so the explicit `marked.use({ gfm: true })` call is a redundant safety net — keep it for clarity.

**Important:** `marked.use()` is additive and mutates the global `marked` instance. Because `App.tsx` already calls it at module load time, and `main.tsx` loads both entry points from the same bundle, the v2 configuration should be applied either in a shared utility or guarded to avoid double-registration. The safest approach is a `reviewer-v2/utils/markdownRenderer.ts` module that calls `marked.use()` once and exports a `renderMarkdown(md: string): string` function.

### Pattern 2: Paragraph Hover via Event Delegation

**What:** Instead of attaching `onMouseEnter`/`onMouseLeave` to every paragraph element (which would require React to re-render every paragraph on hover), attach a single `onMouseMove` listener to the container div and use `Element.closest()` to identify the hovered paragraph.
**When to use:** Any container with variable-count interactive children.
**Example:**
```typescript
// Source: App.tsx hover logic + UI-SPEC component spec [VERIFIED: codebase]
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

### Pattern 3: GutterIcon Absolute Positioning

**What:** Position a `+` button at the right edge of the hovered paragraph using `getBoundingClientRect()` relative to the container.
**When to use:** When a floating affordance must track a DOM element's position.
**Example:**
```typescript
// Source: UI-SPEC GutterIcon spec [VERIFIED: codebase — UI-SPEC]
function GutterIcon({ paragraph, containerRef }: { paragraph: HTMLElement, containerRef: RefObject<HTMLElement> }) {
  const rect = paragraph.getBoundingClientRect()
  const containerRect = containerRef.current!.getBoundingClientRect()
  const top = rect.top - containerRect.top + rect.height / 2 - 12  // center vertically
  // right: -8px per UI-SPEC (overlaps column boundary)
  return (
    <button
      aria-label="Add comment to paragraph"
      style={{
        position: 'absolute',
        top,
        right: -8,
        width: 24,
        height: 24,
        // ... styles per UI-SPEC
      }}
      onMouseDown={(e) => e.preventDefault()}  // CRITICAL: prevent focus steal
    >
      +
    </button>
  )
}
```

**Positioning note:** `position: absolute` on the GutterIcon requires `PlanContent` to have `position: relative`. The Y coordinate must be recalculated on scroll if `PlanContent` is the scroll container; if the parent `<main>` is the scroll container, the calculation uses `element.offsetTop` rather than `getBoundingClientRect()` deltas.

### Pattern 4: SelectionToolbar with `position: fixed`

**What:** The UI-SPEC mandates `position: fixed` (not absolute) for `SelectionToolbar` to avoid scroll-offset math. The toolbar anchors to the bottom-right of the Range's bounding rect.
**When to use:** Floating toolbar that must survive scroll without recalculation.
**Example:**
```typescript
// Source: App.tsx FloatingAnnotationAffordance + UI-SPEC [VERIFIED: codebase]
function SelectionToolbar({ offsets, containerRef, onAction }) {
  const range = rangeFromOffsets(containerRef.current!, offsets.start, offsets.end)
  if (!range) return null
  const rect = range.getBoundingClientRect()
  return (
    <div
      role="group"
      aria-label="Annotation actions"
      style={{
        position: 'fixed',
        top: rect.bottom + 6,
        left: rect.right,
        zIndex: 20,
        // ... surface styles
      }}
    >
      {/* pills */}
    </div>
  )
}
```

The `fixed` position means the toolbar stays on screen during scroll without any scroll event listener. The `rangeFromOffsets` call re-creates the Range from stored character offsets on every render — this is the same pattern used by annotation highlights in `App.tsx`.

### Pattern 5: `onMouseDown → e.preventDefault()` on Toolbar Buttons

**What:** Prevent mousedown from collapsing the browser's text selection before the click event fires.
**When to use:** Every interactive element inside `SelectionToolbar` and `GutterIcon`.
**Why:** The browser clears the selection on `mousedown` if the click target is outside the selection. Adding `e.preventDefault()` on `mousedown` blocks this behavior, allowing the subsequent `click` event to read `selectedText` from state.
**Example:**
```typescript
// Source: App.tsx line comment "CRITICAL (Pitfall 1)" [VERIFIED: codebase]
<button
  onMouseDown={(e) => e.preventDefault()}  // MUST be present
  onClick={() => onAction('comment', selectedText)}
>
  Comment
</button>
```

### Pattern 6: `useTextSelection` Copy Pattern

The ESLint `no-restricted-imports` rule in `eslint.config.js` blocks `reviewer-v2/` files from using `../` paths. The existing `hooks/useTextSelection.ts` must be copied to `reviewer-v2/hooks/useTextSelection.ts`. The copy is byte-identical at the time of Phase 18; any future changes to the original must be manually synced.

The hook exports:
- `[selectedText, reset, getOffsets]` — state, programmatic reset, and snapshot of current character offsets
- `rangeFromOffsets(container, start, end)` — named export to reconstruct a Range from offsets

Both exports are needed by `ContentPane`.

### Anti-Patterns to Avoid

- **Storing live `Range` objects in React state:** React reconciliation collapses them. Always store `{ start: number, end: number }` offsets and reconstruct the Range on demand via `rangeFromOffsets`. This is the central design of `useTextSelection.ts` — do not change it.
- **Attaching per-paragraph event listeners:** Use event delegation on the container (`onMouseMove`) and `closest()` — React will mount/unmount paragraph DOM nodes as the plan loads, making per-element listeners fragile.
- **`position: absolute` for `SelectionToolbar`:** The UI-SPEC mandates `position: fixed`. Using `absolute` requires tracking the scroll offset of the container, introduces a `useEffect` on scroll, and diverges from the spec.
- **Calling `marked.use()` multiple times in the same module tree:** Because `marked` is a singleton, calling `markedHighlight` or `{ gfm: true }` twice stacks the configurations. Isolate the `marked.use()` calls to a single `reviewer-v2/utils/markdownRenderer.ts` file.
- **Importing from `App.tsx` or `hooks/`:** The ESLint rule in `eslint.config.js` blocks `../` imports from within `reviewer-v2/`. Violations will fail `npm run lint`.
- **Using `react-markdown`:** The UI-SPEC explicitly overrides REQUIREMENTS.md — the project uses `marked`, not `react-markdown`. Do not install `react-markdown`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Character offset extraction from a DOM Range | Custom tree walker with bespoke offset math | `getRangeOffsets` inside the copied `useTextSelection.ts` | Already handles edge cases (text nodes split across elements, Range startContainer ≠ endContainer) |
| Range reconstruction from offsets | Custom `range.setStart`/`setEnd` code | `rangeFromOffsets` exported from `useTextSelection.ts` | Already handles walker boundary conditions and returns `null` safely |
| CSS highlight for locked selection | `<span>` injection / className toggling | `CSS.highlights.set('selection-lock', new Highlight(range))` | No DOM mutation; already mocked in `vitest.setup.ts`; `::highlight(selection-lock)` already declared in `index.css` |
| GFM table/checkbox/strikethrough parsing | Custom markdown renderer | `marked@18` with `{ gfm: true }` | GFM is on by default in marked v18; no extra work needed |
| Syntax highlighting for code blocks | Custom regex tokenizer | `marked-highlight` + `hljs.highlight()` | Already registered; `github-dark.css` already imported |

**Key insight:** Almost all complex work in this phase was already done by Phase 17's test infrastructure and by `App.tsx`'s proven implementation. Phase 18 is primarily a structured copy-and-compose exercise within the isolation boundary.

---

## Common Pitfalls

### Pitfall 1: Selection clears on toolbar mousedown
**What goes wrong:** User selects text, moves mouse to toolbar, clicks a pill — selection is gone before the click fires, `selectedText` is empty, no annotation is created.
**Why it happens:** Browser fires `mousedown` before `click`. On `mousedown`, if the target is outside the selection, the browser collapses the selection.
**How to avoid:** Add `onMouseDown={(e) => e.preventDefault()}` to every interactive element inside `SelectionToolbar` and `GutterIcon`. This is explicitly documented in `App.tsx` at line 240 with the comment "CRITICAL (Pitfall 1)".
**Warning signs:** Toolbar appears but clicking it does nothing; `selectedText` is empty in the click handler.

### Pitfall 2: Live Range objects stored in React state
**What goes wrong:** A `Range` created from `window.getSelection()` is stored in `useRef` or `useState`. After React reconciliation (any re-render), the Range's `startContainer` / `endContainer` text nodes may have been replaced, causing the Range to point to detached nodes or collapse to zero length.
**Why it happens:** `dangerouslySetInnerHTML` replaces the entire DOM subtree on content changes. Any live Range pointing into that subtree is invalidated.
**How to avoid:** Always store `{ start: number, end: number }` character offsets. Reconstruct the Range on demand via `rangeFromOffsets`. This is the core design of `useTextSelection.ts` — see its inline comments.
**Warning signs:** Annotation highlight appears briefly then vanishes; `rangeFromOffsets` returns `null` after a re-render.

### Pitfall 3: GutterIcon Y position jumps on scroll
**What goes wrong:** The gutter icon appears at the wrong vertical position when the content pane is scrolled.
**Why it happens:** If positioning uses `getBoundingClientRect()` (viewport-relative) but the icon is `position: absolute` within a scrolled container, the icon must account for `scrollTop`. Alternatively, using `element.offsetTop` gives document-relative position which is scroll-independent.
**How to avoid:** For an absolute-positioned icon within `PlanContent` (which has `position: relative` and is NOT itself a scroll container), use `getBoundingClientRect()` delta from `PlanContent.getBoundingClientRect()`. If `<main>` is the scroll container (as in `ReviewerV2Shell`), factor in `scrollTop`. See UI-SPEC note: `right: -8px` is a static value; only the Y needs recalculation on scroll.
**Warning signs:** Gutter icon appears to float upward as user scrolls down.

### Pitfall 4: `marked.use()` double registration
**What goes wrong:** `marked-highlight` or `{ gfm: true }` is applied twice, causing `highlight.js` to run twice per code block or GFM parsing to layer duplicate tokenizers.
**Why it happens:** `marked.use()` is additive on the global `marked` singleton. If `ContentPane.tsx` imports and calls it, and `App.tsx` also calls it from the same bundle, both registrations run.
**How to avoid:** Isolate `marked.use()` calls in a `reviewer-v2/utils/markdownRenderer.ts` module with a module-level guard (`let configured = false`) or rely on ES module semantics (executed once per module identity). Because `main.tsx` only mounts one component tree at a time (v2 or legacy), runtime double-execution is unlikely — but the guard prevents unexpected behavior during tests.
**Warning signs:** Code blocks are highlighted twice (doubled tokens); test warnings about multiple `marked.use()` calls.

### Pitfall 5: `position: fixed` toolbar outside visible area on small viewports
**What goes wrong:** `SelectionToolbar` appears partially off-screen if the selection is near the right edge.
**Why it happens:** `rect.right` from `getBoundingClientRect()` can exceed `window.innerWidth`.
**How to avoid:** Clamp the toolbar's `left` to `Math.min(rect.right, window.innerWidth - TOOLBAR_WIDTH)`. The UI-SPEC does not specify this guard explicitly, but the existing `App.tsx` uses `Math.max(0, rangeRect.left - containerRect.left)`. A symmetric right-clamp is the v2 equivalent.
**Warning signs:** Toolbar is partially cut off on narrow viewports.

### Pitfall 6: ESLint `../` import violation
**What goes wrong:** Developer imports `useTextSelection` from `../../hooks/useTextSelection` in a `reviewer-v2/` file. `npm run lint` fails; CI blocks merge.
**Why it happens:** The `no-restricted-imports` rule in `eslint.config.js` blocks `../` patterns from within `reviewer-v2/`.
**How to avoid:** Copy `useTextSelection.ts` to `reviewer-v2/hooks/useTextSelection.ts` before writing `ContentPane.tsx`. Any utility needed inside `reviewer-v2/` must live inside `reviewer-v2/`.
**Warning signs:** ESLint error: "reviewer-v2/ files must not import from outside the subtree."

---

## Code Examples

Verified patterns from official sources:

### marked@18 GFM + highlight.js setup (exact App.tsx pattern)
```typescript
// Source: ui/src/App.tsx lines 19-32 [VERIFIED: codebase]
import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext'
    return hljs.highlight(code, { language }).value
  },
}))
marked.use({ gfm: true })

// Usage: marked.parse(planMd) as string
```

### useTextSelection signature (exact existing hook)
```typescript
// Source: ui/src/hooks/useTextSelection.ts [VERIFIED: codebase]
export function useTextSelection(
  containerRef: RefObject<HTMLDivElement | null>,
): [string, () => void, () => { start: number; end: number } | null]

// Returns: [selectedText, reset, getOffsets]
// - selectedText: non-empty while selection is locked
// - reset(): clears selection, removes CSS highlight, resets stored offsets
// - getOffsets(): snapshot of { start, end } char offsets or null if no selection
```

### CSS Custom Highlight declarations (already in index.css)
```css
/* Source: ui/src/index.css lines 192-194 [VERIFIED: codebase] */
::highlight(selection-lock) {
  background-color: rgba(59, 130, 246, 0.35);
  color: inherit;
}
```
No new CSS rules needed for the selection lock. The paragraph hover background (`rgba(255,255,255,0.04)`) and the gutter icon styles are new additions.

### ReviewerV2Shell center column slot
```tsx
// Source: ui/src/reviewer-v2/ReviewerV2Shell.tsx lines 52-71 [VERIFIED: codebase]
{/* Center column: Content — replace this placeholder */}
<main
  style={{
    flex: 1,
    minWidth: 0,
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

### FloatingAnnotationAffordance positioning (reference for SelectionToolbar)
```typescript
// Source: ui/src/App.tsx lines 866-881 [VERIFIED: codebase]
// App.tsx uses position:absolute + scroll offset math.
// UI-SPEC mandates position:fixed for v2 — use Range.getBoundingClientRect() directly.
useLayoutEffect(() => {
  if (!selectedText || !planRef.current) { setSelectionPosition(null); return }
  const offsets = getSelectionOffsets()
  if (!offsets) { setSelectionPosition(null); return }
  const range = rangeFromOffsets(planRef.current, offsets.start, offsets.end)
  if (!range) { setSelectionPosition(null); return }
  const rangeRect = range.getBoundingClientRect()
  // v2 equivalent: use rangeRect.bottom and rangeRect.right directly as fixed coords
}, [selectedText, getSelectionOffsets])
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-markdown` (REQUIREMENTS.md stated) | `marked@18` with `gfm: true` (UI-SPEC ruling) | Phase 18 UI-SPEC | Use `marked` — do not install `react-markdown` |
| Storing live `Range` in state | Storing `{ start, end }` offsets + reconstructing Range on demand | Established in Phase 2 (`App.tsx`) | Critical — live Range survives React reconciliation gaps |
| `position: absolute` for selection toolbar | `position: fixed` for v2 `SelectionToolbar` | Phase 18 UI-SPEC | Eliminates scroll-offset math in toolbar positioning |
| Global `marked.use()` in `App.tsx` | Module-scoped `markdownRenderer.ts` in `reviewer-v2/utils/` | Phase 18 isolation requirement | Prevents double-registration; respects ARCH-01 |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ReviewerV2.tsx` will be refactored to pass `planHtml` / `planMd` down to `ContentPane` rather than `ContentPane` fetching `/api/plan` directly | Architecture Patterns | If ContentPane fetches independently, it needs its own loading/error states — more complex but equivalent |
| A2 | The center `<main>` in `ReviewerV2Shell` is the scroll container (not `ContentPane` itself) | Pitfall 3 / GutterIcon positioning | If ContentPane is the scroll container, Y calculation for GutterIcon is simpler (no scrollTop delta) |
| A3 | `highlight.js/styles/github-dark.css` does not need re-importing inside `reviewer-v2/` because it is already imported in `App.tsx` from the same Vite bundle | Standard Stack | If the CSS is tree-shaken or only applied to the old entry, code blocks in v2 won't be highlighted — add import to `ReviewerV2.tsx` or a shared CSS entry |

---

## Open Questions (RESOLVED)

1. **Where does `ContentPane` fetch plan data?**
   - What we know: `App.tsx` fetches `/api/plan` and passes `planHtml` down to the render div. `ReviewerV2.tsx` currently mounts the shell directly with no data.
   - What's unclear: Should `ReviewerV2.tsx` fetch and pass data down, or should `ContentPane` own the fetch?
   - Recommendation: Have `ReviewerV2.tsx` own the fetch (same as `App` pattern) and pass `{ planHtml, planMd, status }` as props to `ContentPane`. This keeps `ContentPane` a pure presentational component, easier to test.

2. **Does `highlight.js/styles/github-dark.css` need re-importing in the v2 entry?**
   - What we know: The import exists in `App.tsx`. Because `main.tsx` mounts either `App` or `ReviewerV2` (not both), the CSS may not be loaded on the `/v2` route.
   - What's unclear: Vite's CSS handling — does importing a CSS file in `App.tsx` inject it globally or scope it to that component?
   - Recommendation: Add `import 'highlight.js/styles/github-dark.css'` to `ReviewerV2.tsx` (or `ContentPane.tsx`) to be safe. Vite injects CSS globally anyway, but the explicit import ensures the styles are bundled with the v2 chunk.

3. **Should `GutterIcon` use `offsetTop` or `getBoundingClientRect()` for Y?**
   - What we know: `ReviewerV2Shell`'s `<main>` has `overflowY: 'auto'` and is the scroll container. `PlanContent` will be `position: relative` inside it.
   - What's unclear: Whether the GutterIcon should recompute on scroll.
   - Recommendation: Use `hoveredParagraph.offsetTop + hoveredParagraph.offsetHeight / 2 - 12` (scroll-independent, document-relative within `PlanContent`). This value does not change when the user scrolls — the absolute-positioned icon scrolls with the content naturally.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 18 is pure frontend code changes with no external tool, service, or runtime dependencies beyond what is already installed in `ui/node_modules/`.

---

## Sources

### Primary (HIGH confidence)
- `ui/src/App.tsx` — `marked.use()` configuration (lines 24-32), `FloatingAnnotationAffordance` (lines 204-338), selection position calculation (lines 866-881), `onMouseDown` pitfall comment (line 240)
- `ui/src/hooks/useTextSelection.ts` — full character-offset hook implementation; `rangeFromOffsets` export
- `ui/src/index.css` — `.plan-prose` rules, `::highlight(selection-lock)` declaration, annotation highlight colors
- `ui/src/reviewer-v2/ReviewerV2Shell.tsx` — center column `<main>` slot dimensions and overflow
- `ui/src/reviewer-v2/types.ts` — `Annotation`, `AnnotationType`, `AnnotationAction` types
- `ui/src/reviewer-v2/useAnnotations.ts` — `useAnnotations` hook API for Phase 21 integration reference
- `ui/eslint.config.js` — `no-restricted-imports` rule confirming `../` blocks from `reviewer-v2/`
- `.planning/phases/18-content-pane/18-UI-SPEC.md` — visual contracts, component inventory, GFM rendering contract, positioning specs
- `ui/package.json` — confirmed versions: marked@18.0.0, marked-highlight@2.2.4, highlight.js@11.11.1, react@19.2.4
- `ui/vitest.setup.ts` — confirmed CSS.highlights mock is registered

### Secondary (MEDIUM confidence)
- `marked@18` changelog: GFM is enabled by default — `{ gfm: true }` in defaults object confirmed by `node -e` inspection of `marked.defaults`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries present in `node_modules`, versions confirmed via `npm view`
- Architecture: HIGH — patterns verified directly from `App.tsx` and `useTextSelection.ts` source
- Pitfalls: HIGH — Pitfalls 1 and 2 are explicitly documented in `App.tsx` source comments; others derived from the known implementation

**Research date:** 2026-05-20
**Valid until:** 2026-08-20 (stable — no external APIs, all libraries pinned in package.json)
