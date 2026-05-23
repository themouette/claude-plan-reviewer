# Technology Stack — v0.6.0 Markdown Annotator v2

**Project:** claude-plan-reviewer (3-column annotation reviewer milestone)
**Researched:** 2026-05-19
**Scope:** New library additions only — existing React 19 + TypeScript + Vite + Tailwind CSS 4 + Vitest stack is proven and unchanged.

---

## Context: What Already Exists

| Package | Version in ui/package.json | Role |
|---------|---------------------------|------|
| react | ^19.2.4 | UI runtime |
| react-dom | ^19.2.4 | DOM renderer |
| tailwindcss | ^4.2.2 | Styling |
| marked | ^18.0.0 | Markdown → HTML (used only in App.tsx with dangerouslySetInnerHTML) |
| marked-highlight | ^2.2.4 | Syntax highlighting plugin for marked |
| highlight.js | ^11.11.1 | Syntax highlighting engine |
| @pierre/diffs | ^1.1.12 | Diff rendering |
| vitest | ^4.1.4 | Unit tests |

The existing `useTextSelection` hook (ui/src/hooks/useTextSelection.ts) handles text selection with character-offset anchoring using CSS Custom Highlights API. The existing `Annotation` type uses `anchorText: string` — only the quoted string, no positional offsets.

The new 3-column reviewer is architecturally isolated (ARCH-01: never imported from old view).

---

## Recommended Additions

### 1. react-markdown — Client-Side Markdown Rendering

**Add:** `react-markdown@10.1.0` + `remark-gfm@4.0.1`

**Why not keep `marked`:**
The existing view uses `marked` + `dangerouslySetInnerHTML`. For the new reviewer, the center pane must render markdown as a React component tree — not an HTML string — because:
- Per-paragraph hover handlers require React event binding on individual `<p>` elements
- Text selection → comment toolbar requires the DOM to be React-managed
- Comment bubble vertical positioning requires `getBoundingClientRect()` on paragraph elements, which only works reliably when those elements exist in the React tree

`marked` + `dangerouslySetInnerHTML` produces an opaque HTML blob with no per-element React handles. `react-markdown` renders each heading, paragraph, and list item as a distinct React element that can receive `ref`, `onMouseEnter`, and `data-*` props via the `components` override map.

**react-markdown@10.1.0 facts:**
- Current version: 10.1.0 (confirmed via npm registry, published ~12 months ago; no newer major since)
- React peer dependency: `>=18` — React 19.2.4 satisfies this (HIGH confidence)
- ESM-only package — compatible with Vite 8 ESM build
- The default `Markdown` component is synchronous; async plugins use `MarkdownAsync`/`MarkdownHooks` (not needed here)
- Custom `components` prop allows replacing any element type (`h1`–`h6`, `p`, `code`, `pre`, etc.) with a React component that receives the standard HTML props plus a `node` prop (the hast AST node)

**remark-gfm@4.0.1 facts:**
- Current version: 4.0.1 (confirmed via npm)
- Adds tables, task list checkboxes, strikethrough, autolinks to react-markdown
- Plans are authored with GFM (comrak on the Rust side renders GFM by default) — the client-side parser must match

**Syntax highlighting:** Do NOT add `react-syntax-highlighter`. The project already has `highlight.js@11.11.1`. Use `rehype-highlight@7.0.2` instead — it integrates highlight.js into the rehype pipeline that react-markdown uses, with zero additional bundle weight for the highlight engine.

**rehype-highlight@7.0.2 facts:**
- Current version: 7.0.2 (confirmed via npm)
- Peer dep: none beyond rehype ecosystem — no React version constraint
- Works via `rehypePlugins={[rehypeHighlight]}` prop on `<Markdown>`
- Requires importing the highlight.js theme CSS — project already loads highlight.js CSS for the existing view

**Do NOT add** `rehype-sanitize` — react-markdown is safe by default (no dangerouslySetInnerHTML); sanitization is only needed if you pass `rehypePlugins={[rehypeRaw]}` to allow raw HTML passthrough, which this viewer does not need.

**Installation:**
```bash
npm install react-markdown remark-gfm
```
(`rehype-highlight` is already a devDependency candidate but confirm it's in prod deps since it runs at render time)

---

### 2. @floating-ui/react — Comment Bubble Positioning

**Add:** `@floating-ui/react@0.27.19`

**Why:** The comment sidebar requires comment bubbles to float at the vertical position of their anchor text, with collision detection to prevent overlap at viewport boundaries. This is the core visual mechanism of the 3-column layout.

Floating UI is the de facto standard for anchored positioning in the React ecosystem (replaces Popper.js). It solves exactly the problems this feature requires:
- Anchor a floating element (comment bubble) to a reference element (the annotated paragraph or selection)
- `autoUpdate` keeps the anchor valid during scroll and resize
- `shift()` middleware prevents bubbles from clipping viewport edges
- `offset()` middleware controls the gap between anchor and bubble

**@floating-ui/react@0.27.19 facts:**
- Current version: 0.27.19 (confirmed via npm)
- React peer dependency: `>=17.0.0` — React 19.2.4 satisfies this (HIGH confidence)
- No Tailwind conflicts; floating elements use inline `style` for positioning, not CSS classes

**Alternative considered — custom absolute positioning:** For a fixed sidebar column, comment bubbles can be positioned with `position: absolute` using `getBoundingClientRect()` of the anchor paragraph and the scroll offset of the sidebar container. This is viable and avoids a dependency. However, it requires hand-rolling collision detection for the overlap/collapse behavior (COMMENT-03) and re-implementing `autoUpdate` scroll tracking. Floating UI eliminates this boilerplate and is well-tested.

**Alternative considered — CSS Anchor Positioning API:** The native CSS `anchor()` function is emerging (supported in Chrome 125+) but has no Firefox/Safari support as of May 2026. Not viable for a tool targeting all browsers.

**Installation:**
```bash
npm install @floating-ui/react
```

---

### 3. DO NOT ADD — @recogito/react-text-annotator

**Verdict: Reject.** Do not add this library.

**Rationale:**
The project already has a fully implemented `useTextSelection` hook that does exactly what Recogito's text annotator core provides: DOM selection capture, character-offset anchoring, CSS Custom Highlight API for persistent highlights, and range reconstruction after React reconciliation. This hook is battle-tested and its behavior is already covered by the existing annotation system.

Recogito adds:
- Its own annotation data model (diverges from W3C Web Annotation spec by design; incompatible with the project's existing `Annotation` type)
- Its own persistence layer
- `<Annotorious>` context provider that would need to wrap the entire new component tree
- A mandatory peer dependency on `openseadragon` (marked optional via `peerDependenciesMeta`, but still a noise warning during install)

The new annotator (v0.6.0) requires custom behavior: 3 quick-action types (comment / delete / replace), predefined-action menus, and floating sidebar bubbles at anchor positions. Recogito's popup model (`TextAnnotationPopup`) renders adjacent to the selection — not in a detached sidebar column. Adapting it to the sidebar layout would require overriding its positioning model entirely, at which point the library provides no value over the existing hook.

**Keep `useTextSelection` and extend it** to return `anchorElementRef` (the paragraph element containing the selection) for use as a Floating UI reference.

---

### 4. DO NOT ADD — Scroll Sync Library

**Verdict: Reject.** Use native scroll event listeners instead.

Scroll sync between the content pane and comment sidebar is a 10-line custom hook: listen to `scroll` on the content container ref, read `scrollTop`, set the same `scrollTop` on the sidebar container ref. No library needed. `scroll-sync-react` (the npm package found in search) has a small user base and no meaningful advantage over native scroll event coordination for a two-pane sync scenario.

---

### 5. DO NOT ADD — Separate Intersection Observer Library

**Verdict: Reject for heading tracking.** Use native `IntersectionObserver` directly.

Active heading tracking for the outline panel (OUTLINE-01) requires observing `h1`–`h6` elements rendered by react-markdown. This is a standard `useEffect` + `IntersectionObserver` pattern requiring ~30 lines of custom hook code. `react-intersection-observer` (version 10.0.3, React 17–19 compatible) is a clean option but adds a dependency for functionality that is straightforward to implement natively.

If the implementation becomes complex (scroll direction awareness, rootMargin tuning), add `react-intersection-observer@10.0.3` then. Do not preemptively add it.

---

## Final Dependency Delta

```bash
# New production dependencies
npm install react-markdown remark-gfm rehype-highlight @floating-ui/react
```

| Package | Version | Purpose | React 19 Compatible |
|---------|---------|---------|---------------------|
| react-markdown | 10.1.0 | Render markdown as React component tree | YES (peer: >=18) |
| remark-gfm | 4.0.1 | GFM tables, task lists, strikethrough | YES (no React peer dep) |
| rehype-highlight | 7.0.2 | Syntax highlighting via existing highlight.js | YES (no React peer dep) |
| @floating-ui/react | 0.27.19 | Anchor comment bubbles to paragraph elements | YES (peer: >=17) |

**Do not add:** `@recogito/react-text-annotator`, `react-syntax-highlighter`, `rehype-sanitize`, `scroll-sync-react`, `react-intersection-observer`

---

## Integration Notes

### react-markdown with existing highlight.js theme

The existing view imports a highlight.js CSS theme. The new view should import the same theme to maintain visual consistency. `rehype-highlight` adds `language-*` classes to `<code>` elements; highlight.js CSS targets those classes automatically.

### Floating UI anchor reference from useTextSelection

The `useTextSelection` hook currently returns `[selectedText, reset, getOffsets]`. To use Floating UI for the annotation toolbar popup position, the hook should also expose (or the caller should derive) a `getBoundingClientRect` compatible reference. Floating UI's `useFloating` accepts a `reference` that is any element with a `getBoundingClientRect` method — the `containerRef` and stored offsets can produce a virtual element:

```ts
const virtualElement = {
  getBoundingClientRect: () => range.getBoundingClientRect()
}
```

This keeps `useTextSelection` unchanged; the caller constructs the virtual reference from `currentRange` (already tracked internally).

### Comment bubble anchoring strategy

For sidebar comment bubbles floating at anchor text level, the reference element should be the paragraph `<p>` element containing the annotated text — not the text range itself. This gives stable positioning as the user types in a comment (the range may change, the paragraph does not). Floating UI `useFloating` with `strategy: 'absolute'` inside the sidebar's scroll container is the correct approach; this avoids viewport-relative fixed positioning issues when the sidebar scrolls.

### Tailwind CSS compatibility

All three new libraries produce zero Tailwind conflicts:
- `react-markdown` renders standard HTML elements — style them with Tailwind utility classes via the `components` prop wrappers
- `rehype-highlight` adds classes to `<code>` elements — does not conflict with Tailwind
- `@floating-ui/react` uses inline `style` for positional properties — no class conflicts

---

## Sources

- react-markdown npm (version confirmed via `npm info`): https://www.npmjs.com/package/react-markdown
- react-markdown GitHub: https://github.com/remarkjs/react-markdown
- remark-gfm npm (version confirmed): https://www.npmjs.com/package/remark-gfm
- rehype-highlight npm (version confirmed): https://www.npmjs.com/package/rehype-highlight
- @floating-ui/react npm (version confirmed): https://floating-ui.com/docs/react
- @recogito/react-text-annotator npm (evaluated and rejected): https://www.npmjs.com/package/@recogito/react-text-annotator
- recogito/text-annotator-js GitHub (latest release 3.4.0 Apr 30 2026): https://github.com/recogito/text-annotator-js
- react-intersection-observer npm (evaluated, not added): https://www.npmjs.com/package/react-intersection-observer
