# Phase 8: Annotation Quick-Actions & Theme - Research

**Researched:** 2026-04-11
**Domain:** React (TSX) UI component extension — floating affordance chips + CSS custom property theme switching
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Quick-action chips appear in the existing `FloatingAnnotationAffordance` (App.tsx), not in the AnnotationCard sidebar
- **D-02:** Order: existing pills first ([Comment] [Delete] [Replace]), then quick-action chips appended after
- **D-03:** Show the first 2 quick-action chips inline; the remaining 4 go into a "▾ more" dropdown overflow menu
- **D-04:** Chip labels (in order): "clarify this", "needs test", "give me an example", "out of scope", "search internet", "search codebase" — first 2 inline, last 4 in dropdown
- **D-05:** Clicking a quick-action chip creates a `comment`-type annotation with `comment` pre-filled with the chip label; anchor text is the selected text
- **D-06:** The pre-filled comment is editable in the sidebar — no immediate submit
- **D-07:** Theme toggle is a sun/moon icon button at the far right of `PageHeader` (App.tsx), after the `TabBar`
- **D-08:** Theme stored in `localStorage` under key `plan-reviewer-theme` with values `"dark"` or `"light"`
- **D-09:** Theme applied via `data-theme` attribute on `<html>`: `data-theme="dark"` (default) or `data-theme="light"`
- **D-10:** Flash-free first load: inline synchronous `<script>` in `ui/index.html` `<head>` reads localStorage then `window.matchMedia`
- **D-11:** Light theme CSS vars live in `index.css` under `[data-theme="light"]` selector; dark vars stay in `:root`

### Claude's Discretion

- Exact dropdown implementation for "▾ more" overflow menu (CSS-only, `<details>` element, or React state) — UI-SPEC resolves this: use `<details>`/`<summary>`
- Keyboard accessibility and dismissal behavior for the overflow dropdown
- Exact hex values for light theme variables — resolved in UI-SPEC
- Whether to dynamically swap hljs stylesheet in light mode — resolved in UI-SPEC: keep `github-dark.css` in both modes

### Deferred Ideas (OUT OF SCOPE)

- Order of quick-action chips reordering (future UX iteration)
- Three-state theme picker (System/Light/Dark)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ANNOT-01 | User can apply a predefined quick-action with one click | Chip rendering in `FloatingAnnotationAffordance`; `onAddAnnotation` signature extension |
| ANNOT-02 | Selecting a quick-action pre-fills the annotation comment field with the action label | `handleAddAnnotation` in App.tsx receives optional `prefillComment`; sets `comment` at creation time |
| ANNOT-03 | User can edit the pre-filled comment before submitting | No change required — textarea in `AnnotationCard` is already controlled via `onUpdate`; pre-fill sets initial value |
| THEME-01 | User can toggle between light and dark mode | Theme toggle button in `PageHeader`; `document.documentElement.setAttribute('data-theme', ...)` |
| THEME-02 | Theme preference persists across sessions | `localStorage['plan-reviewer-theme']` read on mount, written on toggle |
| THEME-03 | Browser UI defaults to OS dark/light preference on first load with no flash | Synchronous inline `<script>` in `<head>` of `ui/index.html` before module script |
</phase_requirements>

---

## Summary

Phase 8 is a pure frontend change: no Rust changes, no API changes, no new npm dependencies. It adds two independent features to the existing React UI.

**Feature 1 — Quick-action chips:** The `FloatingAnnotationAffordance` component in `App.tsx` gains six predefined chip buttons appended after the existing Comment/Delete/Replace pills. The first two ("clarify this", "needs test") are rendered inline; the last four go inside a `<details>`/`<summary>` overflow menu labeled "▾ more". Each chip calls a backward-compatible extension of the existing `onAddAnnotation` callback with an optional `prefillComment` argument. The `handleAddAnnotation` function in `App` sets `annotation.comment = prefillComment` at creation time instead of the empty string it currently uses.

**Feature 2 — Theme toggle:** A sun/moon icon button added to the right end of `PageHeader` reads and writes `localStorage['plan-reviewer-theme']`, sets `document.documentElement.setAttribute('data-theme', ...)`, and syncs React state. A synchronous inline `<script>` placed in `<head>` of `ui/index.html` (before the Vite module script) prevents flash-of-wrong-theme on first load by applying `data-theme` before the React bundle parses. All component color references already use `var(--color-*)` custom properties; the light theme is implemented by adding a single `[data-theme="light"]` override block to `ui/src/index.css` — zero component-level color logic changes needed.

**Primary recommendation:** Implement in two distinct tasks: (1) quick-action chips + callback extension, (2) theme toggle + CSS vars + flash-free script. Both tasks are self-contained with clear boundaries and can be reviewed independently.

---

## Standard Stack

### Core (already installed — no new dependencies)

| Library | Version | Purpose | Note |
|---------|---------|---------|------|
| React | 19.2.4 | Component model | [VERIFIED: ui/package.json] |
| TypeScript | ~6.0.2 | Type safety | [VERIFIED: ui/package.json] |
| Vite | 8.0.4 | Build tool | [VERIFIED: ui/package.json] |
| Vitest | 4.1.4 | Test runner | [VERIFIED: ui/package.json] |
| Tailwind CSS | 4.2.2 | Global resets only (via `@import "tailwindcss"` in index.css) | [VERIFIED: ui/package.json] |

**No new npm packages required.** All capabilities needed — React state, `localStorage`, `window.matchMedia`, CSS custom properties, `<details>` HTML element — are browser-native or already in the installed stack.

**Installation:** none

---

## Architecture Patterns

### Existing patterns this phase must follow

**Inline styles everywhere (NOT Tailwind utility classes in .tsx files)**

All component files use inline `style={{}}` objects with `var(--color-*)` references. Tailwind is imported once in `index.css` for global reset only. The UI-SPEC and CLAUDE.md both enforce this. [VERIFIED: ui/src/App.tsx, ui/src/components/AnnotationSidebar.tsx]

**Button hover/focus pattern:**

```tsx
// Source: ui/src/App.tsx — existing pill pattern
onMouseOver={(e) => { e.currentTarget.style.background = hoverBg }}
onMouseOut={(e)  => { e.currentTarget.style.background = defaultBg }}
onFocus={(e)     => { e.currentTarget.style.outline = '2px solid var(--color-focus)'; e.currentTarget.style.outlineOffset = '2px' }}
onBlur={(e)      => { e.currentTarget.style.outline = 'none' }}
```

**`onMouseDown={(e) => e.preventDefault()}` on affordance buttons:** This is a critical existing pattern. ALL buttons inside `FloatingAnnotationAffordance` must include this handler to prevent the browser from clearing the text selection before the `onClick` fires. [VERIFIED: ui/src/App.tsx line 153]

### Pattern 1: `onAddAnnotation` signature extension (backward-compatible)

**What:** Add an optional third parameter `prefillComment?: string` to `FloatingAnnotationAffordance.onAddAnnotation` and to `handleAddAnnotation` in `App`.

**Current signature** (line 124):
```tsx
// Source: ui/src/App.tsx line 124
onAddAnnotation: (type: AnnotationType, anchorText: string) => void
```

**Extended signature:**
```tsx
onAddAnnotation: (type: AnnotationType, anchorText: string, prefillComment?: string) => void
```

**Handler change in `App.handleAddAnnotation`** — one line addition:
```tsx
// Source: ui/src/App.tsx lines 801–836 (pattern)
function handleAddAnnotation(type: AnnotationType, anchorText: string, prefillComment?: string) {
  // ... existing id, offsets logic ...
  const newAnnotation: Annotation = {
    id,
    type,
    anchorText,
    comment: prefillComment ?? '',  // changed from hardcoded ''
    replacement: '',
  }
  // ... rest unchanged ...
}
```

The existing `Comment`/`Delete`/`Replace` pills continue calling `onAddAnnotation(pill.type, selectedText)` with 2 args — the optional third param defaults to `undefined` (becomes `''`). No existing call sites break. [VERIFIED: ui/src/App.tsx]

### Pattern 2: Quick-action chips in `FloatingAnnotationAffordance`

The affordance currently renders pills from a typed array. Quick-action chips are appended after the existing pills as a second group:

```tsx
// Source: pattern derived from ui/src/App.tsx lines 127–178
const QUICK_ACTIONS = [
  'clarify this',
  'needs test',
  'give me an example',
  'out of scope',
  'search internet',
  'search codebase',
] as const

const inlineChips = QUICK_ACTIONS.slice(0, 2)
const overflowChips = QUICK_ACTIONS.slice(2)

// Each inline chip:
<button
  key={label}
  onMouseDown={(e) => e.preventDefault()}  // CRITICAL: preserve selection
  onClick={() => onAddAnnotation('comment', selectedText, label)}
  style={{
    fontSize: '14px', fontWeight: 600, height: '28px', padding: '0 8px',
    borderRadius: '4px', cursor: 'pointer', border: 'none',
    background: 'rgba(148, 163, 184, 0.15)',
    color: 'var(--color-text-secondary)',
    outline: 'none',
  }}
  onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.25)' }}
  onMouseOut={(e)  => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.15)' }}
  onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--color-focus)'; e.currentTarget.style.outlineOffset = '2px' }}
  onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
>
  {label}
</button>
```

### Pattern 3: `<details>`/`<summary>` overflow menu

The UI-SPEC mandates `<details>`/`<summary>` (no React state for open/close). Key requirements:

- `<details>` wrapper: `position: 'relative'`
- `<summary>` renders as a chip (same visual spec as inline chips, label "▾ more")
- `<summary>` needs `list-style: none` and `::marker { display: none }` or `list-style-type: none` to remove default disclosure triangle
- Dropdown `<div>` inside `<details>`: `position: 'absolute'`, `top: '100%'`, `left: 0`, `zIndex: 21`
- When an overflow item is clicked: call `onAddAnnotation(...)`, then close `<details>` via ref (`detailsRef.current.removeAttribute('open')` or `detailsRef.current.open = false`)
- `onMouseDown` on each overflow item must also call `e.preventDefault()` to preserve selection

```tsx
// Source: pattern derived from 08-UI-SPEC.md
const detailsRef = useRef<HTMLDetailsElement>(null)

<details ref={detailsRef} style={{ position: 'relative' }}>
  <summary
    onMouseDown={(e) => e.preventDefault()}
    style={{ /* chip styles */ listStyle: 'none' }}
  >
    ▾ more
  </summary>
  <div style={{
    position: 'absolute', top: '100%', left: 0, zIndex: 21,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    padding: '4px',
  }}>
    {overflowChips.map((label) => (
      <button
        key={label}
        role="menuitem"
        aria-label={label}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          onAddAnnotation('comment', selectedText, label)
          if (detailsRef.current) detailsRef.current.open = false
        }}
        style={{
          display: 'block', width: '100%', height: '32px',
          padding: '0 12px', textAlign: 'left',
          fontSize: '14px', fontWeight: 400,
          color: 'var(--color-text-primary)',
          background: 'none', border: 'none', cursor: 'pointer',
        }}
        onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.1)' }}
        onMouseOut={(e)  => { e.currentTarget.style.background = 'none' }}
        onFocus={(e)     => { e.currentTarget.style.outline = '2px solid var(--color-focus)'; e.currentTarget.style.outlineOffset = '2px' }}
        onBlur={(e)      => { e.currentTarget.style.outline = 'none' }}
      >
        {label}
      </button>
    ))}
  </div>
</details>
```

**`<summary>` triangle removal:** Chromium and Firefox both support `list-style: none` on `<summary>` or `summary::-webkit-details-marker { display: none }`. Safest approach: `style={{ listStyle: 'none' }}` inline plus a CSS rule in `index.css`:

```css
/* index.css addition */
details > summary { list-style: none; }
details > summary::-webkit-details-marker { display: none; }
```

[ASSUMED — browser compatibility approach; standard pattern but not verified against specific browser versions in this session]

### Pattern 4: Theme toggle in `PageHeader`

`PageHeader` currently receives `{ activeTab, onTabChange }`. Theme state must live in `App` (so the flash-free script and React state stay in sync) and be passed down:

```tsx
// Source: ui/src/App.tsx lines 32–55 (PageHeader current shape)
function PageHeader({
  activeTab,
  onTabChange,
  theme,
  onThemeToggle,
}: {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  theme: 'dark' | 'light'
  onThemeToggle: () => void
}) {
  return (
    <header style={{ /* existing */ }}>
      <span>Plan Review</span>
      <TabBar activeTab={activeTab} onTabChange={onTabChange} />
      <button
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={onThemeToggle}
        style={{
          width: '32px', height: '32px',
          borderRadius: '6px',
          background: 'none', border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-secondary)',
          fontSize: '18px',
          outline: 'none',
        }}
        onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.15)' }}
        onMouseOut={(e)  => { e.currentTarget.style.background = 'none' }}
        onFocus={(e)     => { e.currentTarget.style.outline = '2px solid var(--color-focus)'; e.currentTarget.style.outlineOffset = '2px' }}
        onBlur={(e)      => { e.currentTarget.style.outline = 'none' }}
      >
        {theme === 'dark' ? '☀' : '☽'}
      </button>
    </header>
  )
}
```

**Theme state in App:**

```tsx
// Source: pattern from 08-CONTEXT.md D-08, D-09, D-10
const [theme, setTheme] = useState<'dark' | 'light'>(() => {
  // Initializer reads the value already applied by the inline script,
  // so React state matches the DOM from the first render (no flicker).
  const stored = localStorage.getItem('plan-reviewer-theme')
  if (stored === 'dark' || stored === 'light') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
})

function handleThemeToggle() {
  const next = theme === 'dark' ? 'light' : 'dark'
  setTheme(next)
  document.documentElement.setAttribute('data-theme', next)
  localStorage.setItem('plan-reviewer-theme', next)
}
```

### Pattern 5: Flash-free inline script in `ui/index.html`

**Current `ui/index.html`** has no `<script>` in `<head>`. The script must be added synchronously (no `async`/`defer`, no `type="module"`) so it runs before the browser paints: [VERIFIED: ui/index.html]

```html
<!-- Source: 08-CONTEXT.md D-10, 08-UI-SPEC.md -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Plan Review — claude-plan-reviewer</title>
    <script>
    (function(){
      var t = localStorage.getItem('plan-reviewer-theme');
      if (!t) {
        t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      document.documentElement.setAttribute('data-theme', t);
    })();
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### Pattern 6: Light theme CSS vars in `index.css`

**Current `ui/src/index.css`** declares all vars in `:root` (dark theme defaults). The light override block is added at the top of the file, after `:root`: [VERIFIED: ui/src/index.css lines 1–20]

```css
/* Source: 08-UI-SPEC.md Color section */
[data-theme="light"] {
  --color-bg: #f8fafc;
  --color-surface: #f1f5f9;
  --color-border: #cbd5e1;
  --color-code-bg: #e2e8f0;
  --color-text-primary: #0f172a;
  --color-text-secondary: #64748b;
  --color-accent-approve: #16a34a;
  --color-accent-approve-hover: #15803d;
  --color-accent-deny: #dc2626;
  --color-focus: #2563eb;
  --color-annotation-highlight: rgba(37, 99, 235, 0.15);
  --color-annotation-comment: #2563eb;
  --color-annotation-delete: #dc2626;
  --color-annotation-replace: #d97706;
  --color-tab-active: #0f172a;
  --color-tab-inactive: #64748b;
}
```

No component files need color logic changes — they all use `var(--color-*)` already. [VERIFIED: ui/src/App.tsx, ui/src/components/AnnotationSidebar.tsx]

### Anti-Patterns to Avoid

- **Adding Tailwind utility classes in `.tsx` files.** The project convention is inline styles + CSS vars. CLAUDE.md and the UI-SPEC both prohibit this.
- **Calling `e.preventDefault()` in `onClick` instead of `onMouseDown`.** Selection is cleared on mousedown, not click. The existing codebase has `onMouseDown={(e) => e.preventDefault()}` on affordance buttons — new chips MUST follow the same pattern.
- **Forgetting `onMouseDown` on overflow dropdown items.** These also fire before `onClick` and would clear selection before the annotation is created.
- **Putting theme state in `PageHeader` instead of `App`.** The flash-free init script runs before React; the React `useState` initializer must read `localStorage`/`matchMedia` to match what the script already applied. If state lived in a child component that mounts later, there could be a one-frame mismatch.
- **Using `async` or `defer` on the flash-free script.** Both attributes delay execution until after the parser/paint; the FOUC prevention relies on synchronous execution.
- **Using `type="module"` on the flash-free script.** Module scripts are always deferred.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Overflow dropdown | Custom JS toggle with click-outside listeners | `<details>`/`<summary>` | Native HTML; keyboard-accessible (Enter opens, Escape closes in supporting browsers, Tab navigates); no JS state management needed for open/close |
| FOUC prevention | CSS transitions with `visibility: hidden` initial state | Synchronous inline `<script>` in `<head>` | CSS transitions still cause a brief flash; the inline script is the standard browser-native solution |
| Theme persistence | Cookie, sessionStorage, or URL param | `localStorage` | Survives tab close; no server round-trip; SPA-friendly; the decision is locked in D-08 |

---

## Common Pitfalls

### Pitfall 1: Selection-clearing mousedown on new chips

**What goes wrong:** User selects text, clicks a quick-action chip — the `mousedown` event fires first and clears the browser text selection before `onClick` fires. The `selectedText` state goes to `''` and no annotation is created.

**Why it happens:** Browser selection is cleared on `mousedown` by default. The existing Comment/Delete/Replace pills already solve this with `onMouseDown={(e) => e.preventDefault()}`.

**How to avoid:** Every button inside `FloatingAnnotationAffordance` — including overflow dropdown buttons — must have `onMouseDown={(e) => e.preventDefault()}`.

**Warning signs:** Chip click appears to do nothing; no annotation appears in sidebar; console shows no error.

### Pitfall 2: `<summary>` renders its default disclosure triangle

**What goes wrong:** The `<details>` element's `<summary>` shows a browser-default arrow/triangle that conflicts with the "▾ more" text label.

**Why it happens:** `<summary>` has `display: list-item` by default with a `::marker` pseudo-element.

**How to avoid:** Add CSS in `index.css`:
```css
details > summary { list-style: none; }
details > summary::-webkit-details-marker { display: none; }
```
And set `style={{ listStyle: 'none' }}` inline on the `<summary>` element.

**Warning signs:** Double triangle appears; visual inconsistency with other chips.

### Pitfall 3: React state initializer vs. flash-free script mismatch

**What goes wrong:** The inline script applies `data-theme="light"` based on OS preference, but the React `useState` initializer hardcodes `'dark'`. On first render, the icon shows ☽ (dark) but the page is already light. One repaint later, state corrects itself — brief icon flicker.

**Why it happens:** The inline script runs before React; React's initial state is independent.

**How to avoid:** The `useState` initializer MUST read `localStorage.getItem('plan-reviewer-theme')` and `window.matchMedia(...)` — the same logic as the inline script. Using a lazy initializer function (not a plain value) keeps this out of the render hot path:
```tsx
const [theme, setTheme] = useState<'dark' | 'light'>(() => {
  const stored = localStorage.getItem('plan-reviewer-theme')
  if (stored === 'dark' || stored === 'light') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
})
```

**Warning signs:** Theme toggle icon is wrong on first load; toggling once then toggling back shows the correct icon only after a repaint.

### Pitfall 4: Overflow dropdown stays open after selecting an item

**What goes wrong:** User clicks an overflow chip; annotation is created; `<details>` remains open (still showing the dropdown).

**Why it happens:** `<details>` only closes natively when clicking outside or pressing Escape. A click on a contained button does not close it.

**How to avoid:** In the `onClick` handler for each overflow item, explicitly close the details element:
```tsx
onClick={() => {
  onAddAnnotation('comment', selectedText, label)
  if (detailsRef.current) detailsRef.current.open = false
}}
```

**Warning signs:** After selecting an overflow quick-action, the "▾ more" dropdown visually stays open.

### Pitfall 5: `PageHeader` prop drilling — forgetting to pass `theme` and `onThemeToggle`

**What goes wrong:** `PageHeader` is called at line 881 of `App.tsx` as `<PageHeader activeTab={activeTab} onTabChange={setActiveTab} />`. After extending the props interface, the call site will show a TypeScript error if the new props are not added.

**How to avoid:** Update the `PageHeader` call in the JSX and the `PageHeader` props interface atomically in the same edit.

### Pitfall 6: `<details>` dropdown clips behind other elements

**What goes wrong:** The affordance bubble has `zIndex: 20`. The `<details>` dropdown uses `position: absolute` inside the bubble. If the dropdown `<div>` doesn't have a higher `zIndex`, it may render behind other elements.

**How to avoid:** Set `zIndex: 21` on the dropdown `<div>` (one above the affordance bubble's `zIndex: 20`). [VERIFIED: 08-UI-SPEC.md]

---

## Code Examples

### Complete `FloatingAnnotationAffordance` interface after extension

```tsx
// Source: ui/src/App.tsx current interface (lines 120–125) + extension
interface FloatingAnnotationAffordanceProps {
  top: number
  left: number
  selectedText: string
  onAddAnnotation: (type: AnnotationType, anchorText: string, prefillComment?: string) => void
}
```

### `handleAddAnnotation` with prefill support

```tsx
// Source: pattern from ui/src/App.tsx lines 801–836
function handleAddAnnotation(type: AnnotationType, anchorText: string, prefillComment?: string) {
  const id = crypto.randomUUID()
  const offsets = getSelectionOffsets()
  if (offsets) annotationOffsetsRef.current.set(id, offsets)

  const newAnnotation: Annotation = {
    id,
    type,
    anchorText,
    comment: prefillComment ?? '',  // pre-fill when provided
    replacement: '',
  }
  const newStart = offsets?.start ?? Infinity
  setAnnotations((prev) => {
    let insertIdx = prev.length
    for (let i = 0; i < prev.length; i++) {
      const prevStart = annotationOffsetsRef.current.get(prev[i].id)?.start ?? Infinity
      if (prevStart > newStart) { insertIdx = i; break }
    }
    const next = [...prev]
    next.splice(insertIdx, 0, newAnnotation)
    return next
  })
  if (type === 'comment' || type === 'replace') {
    setFocusAnnotationId(id)
  }
  resetTextSelection()
}
```

---

## File Change Map

Exactly four files change. No new files are created. No Rust changes.

| File | Change Type | Change Description |
|------|------------|-------------------|
| `ui/index.html` | Edit | Add synchronous `<script>` block in `<head>` for flash-free theme init |
| `ui/src/index.css` | Edit | Add `[data-theme="light"]` CSS custom property override block; add `details > summary` list-style reset |
| `ui/src/App.tsx` | Edit | (1) Extend `FloatingAnnotationAffordance` props + inline chips + `<details>` dropdown; (2) extend `handleAddAnnotation` for `prefillComment`; (3) add `theme` state + `handleThemeToggle` + `PageHeader` prop updates |
| (optional) `ui/src/components/AnnotationSidebar.tsx` | No change needed | `annotation.comment` is already a controlled textarea — pre-fill at creation time is sufficient |

---

## Environment Availability

Step 2.6: SKIPPED — this phase is purely frontend code and CSS changes. No external tools, services, CLI utilities, or databases beyond what is already part of the installed project (`npm`, `vite`, `vitest`).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `details > summary { list-style: none }` and `::-webkit-details-marker { display: none }` reliably remove the disclosure triangle across Chrome, Firefox, Safari | Common Pitfalls / Pattern 3 | Minor visual artifact (double triangle); fixable in a follow-up without code changes |

**All other claims were verified directly from the source files in the working directory or from locked decisions in CONTEXT.md.**

---

## Open Questions (RESOLVED)

1. **`useRef` on `<details>` inside `FloatingAnnotationAffordance`**
   - What we know: `FloatingAnnotationAffordance` is a function component; adding `useRef<HTMLDetailsElement>(null)` is straightforward.
   - What's unclear: Whether to import `useRef` inside `FloatingAnnotationAffordance` (it's currently defined as a plain function in App.tsx, not using any hooks) or promote it to use hooks.
   - Recommendation: `FloatingAnnotationAffordance` can trivially add `useRef` — it is already a React function component. Import `useRef` from React at the top of `App.tsx` (already imported).

2. **`<summary>` as a styled chip — layout concerns**
   - What we know: `<summary>` is `display: list-item` by default; overriding with inline `style` or CSS to `display: inline-flex` or `display: block` changes the layout model.
   - What's unclear: Whether `display: inline-flex` with the chip height/padding styles from UI-SPEC applies cleanly across browsers.
   - Recommendation: Set `style={{ display: 'inline-flex', alignItems: 'center', ... }}` on `<summary>` and test visually. This is the standard approach for styled `<summary>` elements. [ASSUMED]

---

## Sources

### Primary (HIGH confidence — verified from working directory source files)

- `ui/src/App.tsx` — `FloatingAnnotationAffordance` interface (lines 120–178), `handleAddAnnotation` (lines 801–836), `PageHeader` (lines 32–55)
- `ui/src/components/AnnotationSidebar.tsx` — `AnnotationCard` comment textarea (lines 138–180)
- `ui/src/index.css` — `:root` CSS custom properties (lines 1–20)
- `ui/index.html` — Current head structure (no existing `<script>`)
- `ui/src/types.ts` — `Annotation.comment` field existence confirmed
- `ui/package.json` — All dependency versions
- `.planning/phases/08-annotation-quick-actions-theme/08-CONTEXT.md` — All locked decisions (D-01 through D-13)
- `.planning/phases/08-annotation-quick-actions-theme/08-UI-SPEC.md` — Complete visual and interaction contract
- `.planning/config.json` — `nyquist_validation: false` (Validation Architecture section omitted)
- `CLAUDE.md` — No inline styles Tailwind prohibition; test coverage requirements

### Secondary (MEDIUM confidence)

- `ui/src/utils/serializeAnnotations.test.ts` — Confirms Vitest is the test framework with `describe`/`it`/`expect`

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json and source files
- Architecture patterns: HIGH — derived directly from verified source code + locked decisions
- Pitfalls: HIGH — derived from the codebase's own existing patterns; pitfall 1 directly observable in current code
- Assumptions: 1 (A1) — minor browser CSS compatibility; low risk

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable; React/Vite/Vitest versions will not change mid-milestone)
