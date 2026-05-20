---
phase: 19-outline-pane
reviewed: 2026-05-20T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - ui/src/reviewer-v2/utils/markdownRenderer.ts
  - ui/src/reviewer-v2/utils/markdownRenderer.test.ts
  - ui/src/reviewer-v2/types.ts
  - ui/src/reviewer-v2/ContentPane.tsx
  - ui/src/reviewer-v2/ContentPane.test.ts
  - ui/src/reviewer-v2/OutlinePane.tsx
  - ui/src/reviewer-v2/OutlinePane.test.ts
  - ui/src/reviewer-v2/ReviewerV2Shell.tsx
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-05-20T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

This phase introduces `OutlinePane` (active-section tracking via `IntersectionObserver`, depth-driven indentation, smooth scroll), wires it into `ReviewerV2Shell`, extends `ContentPane` with a heading-walk effect, and adds `markdownRenderer.ts` for GFM rendering with custom heading ids.

Two critical issues were found. The most severe: `marked` passes raw HTML blocks (including `<script>`, `<iframe>`, and `javascript:` href URIs) directly through to `dangerouslySetInnerHTML` with no sanitization at any layer in the pipeline. This is confirmed by live testing against the installed marked v18. The second critical issue is the `as string` cast on `marked.parse()` which silently produces `[object Promise]` in the UI if async mode is ever enabled by a future `marked.use()` call.

Five warnings address: empty-slug generation for special-character headings (`id=""` breaks IntersectionObserver), non-unique React keys for duplicate empty slugs, non-deterministic active-heading selection when IntersectionObserver fires multiple entries simultaneously, inline style mutation bypassing React's rendering model, and silent error swallowing in the fetch pipeline. Three info items cover test quality, an `extractRawText` silent-drop edge case, and the unconstrained `paddingLeft` depth calculation.

---

## Critical Issues

### CR-01: Unsanitized markdown-to-HTML pipeline allows XSS via raw HTML in plan content

**File:** `ui/src/reviewer-v2/utils/markdownRenderer.ts:48-78` / `ui/src/reviewer-v2/PlanContent.tsx:15`

**Issue:** `marked` passes raw HTML blocks through by default. A plan document containing any of the following renders them verbatim into `dangerouslySetInnerHTML`:

```
<script>fetch('/api/plan',{method:'POST',body:'exfiltrated'})</script>
<iframe src="https://attacker.com"></iframe>
<img src=x onerror="exfiltrate(document.cookie)">
[click](javascript:alert(document.origin))
```

Verified empirically against the installed package:

```
marked.parse('<script>alert(1)</script>')
// → '<script>alert(1)</script>\n'

marked.parse('[click](javascript:alert(1))')
// → '<p><a href="javascript:alert(1)">click</a></p>\n'

marked.parse('<img src=x onerror=alert(1)>')
// → '<img src=x onerror=alert(1)>\n'

marked.parse('<iframe src="https://evil.com"></iframe>')
// → '<iframe src="https://evil.com"></iframe>\n'
```

The rendered HTML flows from `renderMarkdown()` through `setPlanHtml` into `<div dangerouslySetInnerHTML={{ __html: planHtml }} />` in `PlanContent.tsx` with no transformation. No sanitization layer exists anywhere in the chain (confirmed by searching the entire `ui/src/` tree for `DOMPurify`, `sanitize`, and `allowedTags` — no results).

Although this is a local tool, plan content is AI-generated text that references repository files and could be attacker-influenced via a malicious repository. XSS in a local browser context can call the local HTTP API (e.g., `POST /api/approve`), manipulate `localStorage`, read session cookies, and perform arbitrary side effects within the same origin.

**Fix:** Add DOMPurify sanitization as the final step in `renderMarkdown`, after `marked.parse`:

```typescript
// Install: npm install dompurify @types/dompurify
import DOMPurify from 'dompurify'

export function renderMarkdown(md: string): string {
  if (!configured) {
    // ... existing marked.use() calls unchanged ...
    configured = true
  }
  headingSlugCounts = new Map()
  const rawHtml = marked.parse(md)
  if (rawHtml instanceof Promise) {
    throw new Error('renderMarkdown: marked returned a Promise — async mode must be disabled')
  }
  return DOMPurify.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['class'],           // preserve highlight.js class attributes
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'],
  })
}
```

---

### CR-02: `marked.parse()` cast `as string` silently corrupts UI if async mode is ever enabled

**File:** `ui/src/reviewer-v2/utils/markdownRenderer.ts:77`

**Issue:** `marked.parse(md)` is typed `string | Promise<string>` in the installed marked v18 type declarations. The implementation casts with `as string` to suppress the TypeScript error, but this is a compile-time assertion with no runtime enforcement. If any future `marked.use()` call registers an async `walkTokens` (e.g., a syntax-highlighting plugin), `marked.parse()` will silently return a `Promise` at runtime. `setPlanHtml` would store the Promise object, and React renders the string `"[object Promise]"` in the plan pane — no error is thrown, no warning surfaced.

**Fix:** Replace the bare cast with a runtime guard (also incorporated in the CR-01 fix above):

```typescript
const result = marked.parse(md)
if (result instanceof Promise) {
  throw new Error(
    'renderMarkdown: marked.parse() returned a Promise. ' +
    'An async walkTokens was registered. Disable async mode or refactor to async.'
  )
}
return result
```

---

## Warnings

### WR-01: Headings with only special characters produce `id=""` — breaks outline and IntersectionObserver

**File:** `ui/src/reviewer-v2/utils/markdownRenderer.ts:30-36`

**Issue:** `slugify()` strips all non-alphanumeric characters. A heading whose text contains only special characters (e.g., `# ---`, `# !!!`, `# 💡`) produces `baseSlug = ""`. The heading renderer then emits `id=""`. Downstream effects:

1. `document.getElementById("")` returns `null` in all browsers — the `if (el)` guard in `OutlinePane`'s observer setup silently skips the element; it is never observed and never becomes the active heading.
2. The click handler silently no-ops (`?.scrollIntoView` on `null`).
3. Two headings both producing `id=""` create a duplicate key in the React `<ol>` (see WR-02).

**Fix:** Fall back to a positional default when the slug is empty:

```typescript
heading({ tokens, depth }: Tokens.Heading) {
  const rawText = extractRawText(tokens)
  const baseSlug = slugify(rawText) || `section-${depth}`
  // rest unchanged
}
```

A more robust fix also passes a `headingIndex` counter so headings at the same depth remain unique.

---

### WR-02: Duplicate React `key` when multiple headings produce empty slug

**File:** `ui/src/reviewer-v2/OutlinePane.tsx:51`

**Issue:** `<li key={section.id}>` uses `section.id` as the React list key. When two headings produce `id=""` (WR-01), the duplicate counter logic in `markdownRenderer` produces `""` and `"-2"`. The id `""` appears exactly once, so React emits a duplicate-key warning in development and may mis-reconcile the list. Fixing WR-01 eliminates this entirely, but a defensive fallback is worth adding independently.

**Fix:**

```tsx
{sections.map((section, i) => (
  <li
    key={section.id || `__section-${i}`}
    ref={section.id === activeId ? activeItemRef : undefined}
  >
```

---

### WR-03: IntersectionObserver callback selects first entry in spec-undefined order — non-deterministic active heading

**File:** `ui/src/reviewer-v2/OutlinePane.tsx:22-26`

**Issue:** The observer callback iterates `entries` and selects the first intersecting entry with `break`. The IntersectionObserver specification explicitly does not guarantee the order of entries within a single callback invocation ("entries are reported in the order they were observed" per some implementations, but MDN notes the order is not mandated). When two headings are simultaneously in the intersection margin (e.g., a short section that fits entirely in the viewport, or rapid scroll), the selected active heading can be the wrong one and varies across browsers and viewport sizes.

**Fix:** Select the entry whose id appears earliest in the `sections` array (document order):

```typescript
const intersectingIds = new Set(
  entries.filter(e => e.isIntersecting).map(e => e.target.id)
)
if (intersectingIds.size > 0) {
  const first = sections.find(s => intersectingIds.has(s.id))
  if (first) onActiveIdChange(first.id)
}
```

---

### WR-04: Hover/focus state managed via direct `style` mutation — can desynchronize from React render

**File:** `ui/src/reviewer-v2/OutlinePane.tsx:63-81`

**Issue:** `onMouseEnter`, `onMouseLeave`, `onFocus`, and `onBlur` all mutate `e.currentTarget.style` directly. This bypasses React's virtual DOM. If a re-render occurs while the cursor is over a button (e.g., `sections` prop changes, `activeId` updates), React will commit the JSX `style` prop, overwriting the imperative mutation — causing a visual flash. Additionally, the `if (section.id !== activeId)` guard in the hover handlers closes over a stale `activeId` value from the render in which the handler was created, not the current active id.

**Fix:** Use CSS `:hover` and `:focus-visible` pseudo-classes:

```css
/* In stylesheet */
.outline-button:not([aria-current="true"]):hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-text-primary);
}
.outline-button:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
```

Remove all four imperative handlers and the `outline: 'none'` base style.

---

### WR-05: `fetch` error silently swallowed — no diagnostic information retained

**File:** `ui/src/reviewer-v2/ContentPane.tsx:28`

**Issue:** `.catch(() => setStatus('error'))` discards the error object. Network failures, non-JSON responses, and JSON parse errors all produce the same UI state with no log output. In a local dev tool this makes debugging substantially harder.

**Fix:**

```typescript
.catch((err: unknown) => {
  console.error('[ContentPane] Failed to load /api/plan:', err)
  setStatus('error')
})
```

---

## Info

### IN-01: Source-reading test pattern provides no runtime behavior coverage

**Files:** `ui/src/reviewer-v2/ContentPane.test.ts`, `ui/src/reviewer-v2/OutlinePane.test.ts`

**Issue:** Both test files use `readFileSync` to load the `.tsx` source file and assert that specific string literals are present (e.g., `expect(source).toContain("fetch('/api/plan')")`). These tests verify the source was written a certain way, not that the component behaves correctly at runtime. A semantics-preserving refactor that renames a variable or extracts a constant would break the tests while leaving the behavior correct. A logic bug that does not change source text would pass the tests.

Per CLAUDE.md Test Coverage Requirements, TypeScript modules with business logic require tests that "would fail if the new logic were removed." Source-text tests do not meet that bar.

**Fix:** Replace with rendered component tests using `@testing-library/react`. For `ContentPane`, mock `fetch`, render the component, and assert that `onSectionsFound` receives a `Section[]` with correct `id`, `text`, and `depth` values. For `OutlinePane`, render with known sections and assert scroll behavior and `aria-current` marking. The `markdownRenderer.test.ts` in this same changeset is a good model.

---

### IN-02: `extractRawText` silently drops text from tokens that have no `raw` and no `tokens` sub-array

**File:** `ui/src/reviewer-v2/utils/markdownRenderer.ts:20-24`

**Issue:** The fallback is `t.raw ?? ''`. A token with neither a `tokens` sub-array nor a `raw` property returns an empty string, silently shortening the slug. Some marked inline tokens (e.g., `link` tokens) carry their display text in `t.text` rather than `t.raw`. The existing test covers only a flat array of plain `text` tokens and would not catch this.

**Fix:**

```typescript
export function extractRawText(tokens: Token[]): string {
  return tokens
    .map((t) =>
      'tokens' in t && t.tokens
        ? extractRawText(t.tokens as Token[])
        : (t as { text?: string; raw?: string }).text ?? t.raw ?? ''
    )
    .join('')
}
```

---

### IN-03: `paddingLeft` depth computation has no upper-bound clamp

**File:** `ui/src/reviewer-v2/OutlinePane.tsx:95`

**Issue:** `paddingLeft: 16 + (section.depth - 1) * 8` produces values from 16 (h1) to 88 (h6). `Section.depth` is typed as `number` and computed from `parseInt(el.tagName[1], 10)`, so standard headings (1–6) are fine. However, the `Section` type does not constrain `depth` to the range 1–6. A zero or negative `depth` from any future code path would produce 8px or negative padding.

**Fix:** Clamp at the use site:

```typescript
paddingLeft: 16 + (Math.max(1, Math.min(6, section.depth)) - 1) * 8,
```

Or tighten the type:

```typescript
// In types.ts
export interface Section {
  id: string
  text: string
  depth: 1 | 2 | 3 | 4 | 5 | 6
}
```

---

_Reviewed: 2026-05-20T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
