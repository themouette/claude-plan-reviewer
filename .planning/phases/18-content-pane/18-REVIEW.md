---
phase: 18-content-pane
reviewed: 2026-05-20T11:52:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - ui/src/index.css
  - ui/src/reviewer-v2/ContentPane.test.ts
  - ui/src/reviewer-v2/ContentPane.tsx
  - ui/src/reviewer-v2/GutterIcon.test.ts
  - ui/src/reviewer-v2/GutterIcon.tsx
  - ui/src/reviewer-v2/PlanContent.test.ts
  - ui/src/reviewer-v2/PlanContent.tsx
  - ui/src/reviewer-v2/ReviewerV2.tsx
  - ui/src/reviewer-v2/ReviewerV2Shell.tsx
  - ui/src/reviewer-v2/SelectionToolbar.test.ts
  - ui/src/reviewer-v2/SelectionToolbar.tsx
  - ui/src/reviewer-v2/hooks/useTextSelection.test.ts
  - ui/src/reviewer-v2/hooks/useTextSelection.ts
  - ui/src/reviewer-v2/utils/markdownRenderer.test.ts
  - ui/src/reviewer-v2/utils/markdownRenderer.ts
  - ui/vitest.setup.ts
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-05-20T11:52:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

This phase implements the ContentPane end-to-end wire: markdown fetching, prose rendering with
highlight.js, hover-gutter interaction, text selection locking, and the SelectionToolbar. The
architecture is sound and the tests all pass. Two critical defects were found — one produces an
unhandled-rejection crash when `data.plan_md` is absent from the API response, the other is an
invalid DOM Range constructed at node boundaries in `rangeFromOffsets`. Four warnings cover
hook-return discard, a type-assertion soundness hole, a phantom ESLint rule, and a stale-overlay
rendering issue. Two info items address test fragility and a dead-code pattern.

---

## Critical Issues

### CR-01: Unhandled crash when `/api/plan` response lacks `plan_md` field

**File:** `ui/src/reviewer-v2/ContentPane.tsx:20-21`

**Issue:** The fetch handler casts the JSON response to `{ plan_md: string }` with no runtime
validation. If the server ever returns a shape without `plan_md` (e.g., an error object such as
`{ "error": "not ready" }`, a 200 with an empty body `{}`, or a future API change),
`data.plan_md` is `undefined`, `renderMarkdown(undefined)` is called, and `marked.parse`
receives `undefined` instead of a string. `marked` will coerce it to the string `"undefined"`,
rendering the literal word "undefined" in the plan view — a silent data corruption rather than
a user-visible error state. Additionally, if `marked.parse` is ever called with a non-string in a
stricter version, it throws and the `setStatus('error')` branch is never reached because the throw
is not inside the `.catch` of a rejected promise but inside a `.then` callback, so it does become
a rejection — but only by accident. The intent is clearly to show the error state, which requires
explicit validation.

**Fix:**
```typescript
.then((data: unknown) => {
  if (
    typeof data !== 'object' ||
    data === null ||
    typeof (data as { plan_md?: unknown }).plan_md !== 'string'
  ) {
    throw new Error('Unexpected API response shape')
  }
  setPlanHtml(renderMarkdown((data as { plan_md: string }).plan_md))
  setStatus('ready')
})
.catch(() => setStatus('error'))
```

---

### CR-02: `rangeFromOffsets` produces an inverted DOM Range at exact node boundaries, causing a `DOMException`

**File:** `ui/src/reviewer-v2/hooks/useTextSelection.ts:71-79`

**Issue:** The condition to locate `startNode` uses strict greater-than (`charCount + len > start`)
while the condition for `endNode` uses greater-than-or-equal (`charCount + len >= end`). When
`start === end` and that value falls exactly at a text-node boundary (i.e., `start === charCount + len`
for the current node), the code:

1. Does NOT set `startNode` for the current node (strict `>` fails).
2. DOES set `endNode` for the current node (non-strict `>=` succeeds) at offset
   `endNodeOffset = end - charCount = len`.
3. Advances `charCount += len`.
4. On the next node, sets `startNode` at offset 0.

Result: `startNode` is the later node; `endNode` is the earlier node. Calling
`r.setStart(startNode, 0)` then `r.setEnd(endNode, len)` produces a range where start is
after end — `document.createRange()` will throw a `DOMException: The boundary points of a
Range do not meet specific requirements` when `setEnd` detects the inversion.

In the current flow, `storedOffsets` is only ever populated from a non-collapsed, trimmed
selection so `start === end` does not arise in practice. However, any future caller of
`rangeFromOffsets` (it is a named export) that passes equal offsets at a node boundary will
trigger this crash. The fix also eliminates a subtle asymmetry where `end` placed exactly at a
node boundary is attributed to the preceding node's last offset rather than the following node's
first offset — which differs from how `start` at the same position is handled.

**Fix:** Use consistent strict greater-than for both, and handle the end-of-node edge case:
```typescript
// Replace the endNode condition (line 75):
if (endNode === null && charCount + len > end) {
  endNode = node
  endNodeOffset = end - charCount
} else if (endNode === null && charCount + len === end) {
  // end falls exactly at the boundary: prefer attributing to this node's end
  endNode = node
  endNodeOffset = len
}
```

Or, more concisely, keep `>=` for endNode but add a guard that when `start === end`,
`endNode` is resolved from the same node or a later node than `startNode`:
```typescript
// Simplest fix: resolve startNode first, only then resolve endNode
if (startNode === null && charCount + len > start) {
  startNode = node
  startNodeOffset = start - charCount
}
// Only check endNode once startNode is resolved (or on same/later nodes)
if (startNode !== null && endNode === null && charCount + len >= end) {
  endNode = node
  endNodeOffset = end - charCount
}
```

---

## Warnings

### WR-01: `useAnnotations()` and `useHeartbeat()` return values discarded with `void` — annotation store is unreachable

**File:** `ui/src/reviewer-v2/ReviewerV2.tsx:10-14`

**Issue:** Both hooks are called with `void expr` to suppress ESLint's `no-unused-vars`. This
pattern mounts the internal hook state (reducer, interval) but throws away the returned
API surface (`annotations`, `addAnnotation`, `dispatch`, heartbeat status). No child component
can access the annotation store — there is no React Context, no prop-drilling, and no module-level
store. When Phase 21 wires annotation creation, the `ContentPane`'s `handleAction` calls
`resetTextSelection()` only. If `useAnnotations` remains discarded, Phase 21 will have to
refactor the entire wiring from scratch.

The comment says "Phase 21 will wire it into the UI" but discarding the return value at `ReviewerV2`
means Phase 21 must also restructure where the hook is called (e.g., move it into `ContentPane` or
introduce a Context). The current stub creates technical debt that is easy to misread as intentional
architecture.

**Fix:** At minimum, surface the hook result even as an unused variable with a comment,
or document the intended wiring pattern. Better: initialize a Context now so Phase 21 only needs
to fill in the context value:
```typescript
// Option A — make the coupling explicit so Phase 21 knows what to wire:
const _annotations = useAnnotations() // Phase 21: pass via Context or props to ContentPane

// Option B — use a Context stub (preferred):
// Create ReviewerV2Context.tsx, export provider and useReviewerContext hook,
// pass useAnnotations() result as context value here.
```

---

### WR-02: `marked.parse(md) as string` unsound cast — async extensions can make this a silently-pending Promise rendered as `[object Promise]`

**File:** `ui/src/reviewer-v2/utils/markdownRenderer.ts:29`

**Issue:** `marked.parse()` returns `string | Promise<string>`. The `as string` cast suppresses the
TypeScript error but does not prevent a runtime Promise if any `async: true` extension is ever
registered (including by a third-party dependency that augments `marked`). When
`setPlanHtml(renderMarkdown(data.plan_md))` is called, `planHtml` would be set to `[object Promise]`
— which `dangerouslySetInnerHTML` renders as the literal string. The `gfm: true` `marked.use` call
is safe (synchronous), but the cast masks the possibility of accidentally registering an async
extension in the future.

**Fix:** Assert synchronous mode explicitly via the overload that guarantees a string return:
```typescript
// Pass async: false to activate the string-returning overload — TypeScript will enforce
// the return type without a cast.
return marked.parse(md, { async: false })
```
This removes the cast and makes the sync contract explicit and type-checked.

---

### WR-03: `/* eslint-disable react-hooks/refs */` references a non-existent ESLint rule

**File:** `ui/src/reviewer-v2/SelectionToolbar.tsx:49-54`

**Issue:** `react-hooks/refs` is not a rule in `eslint-plugin-react-hooks`. The disable/enable
comments are no-ops — they silence nothing and provide no protection against future linter versions
adding a real rule with that name. The real concern being suppressed is reading `containerRef.current`
in the render function body outside a `useEffect`/`useCallback`. This pattern is in fact valid in
React (reading a ref during render is how you perform early-return bailouts based on ref state), but
the comment is misleading and creates false confidence that a linter guard is in place.

**Fix:** Remove the phantom rule comments and replace with a plain explanatory comment:
```typescript
// Reading containerRef.current in render is intentional: we bail out before paint
// if the container is not yet mounted. This is safe because refs are stable across renders.
if (!containerRef.current) return null
const range = rangeFromOffsets(containerRef.current, offsets.start, offsets.end)
if (!range) return null
```

---

### WR-04: Hover overlay remains visible when `planHtml` changes (stale `hoveredParagraph` from a detached DOM node)

**File:** `ui/src/reviewer-v2/PlanContent.tsx:15, 44-58`

**Issue:** `hoveredParagraph` is a direct reference to a DOM `HTMLElement` node that lives inside
the `dangerouslySetInnerHTML` subtree. When `planHtml` changes (e.g., plan is reloaded), React
replaces the entire inner DOM of the `plan-prose` div. The old `HTMLElement` reference stored in
`hoveredParagraph` state is now detached from the document. On the next render, React reads
`hoveredParagraph.offsetTop` and `hoveredParagraph.offsetHeight` from a detached node — both
return `0`, causing the overlay to snap to position `{top: 0, left: 0, height: 0}`. The `GutterIcon`
is also rendered at `top = 0 + 0/2 - 12 = -12`, placing it above the content area.

In Phase 18 `planHtml` is set once and never changes, so this is latent. Phase 22+ may reload the
plan, triggering the bug.

**Fix:** Reset `hoveredParagraph` to `null` whenever `planHtml` changes:
```typescript
useEffect(() => {
  setHoveredParagraph(null)
}, [planHtml])
```

---

## Info

### IN-01: `GutterIcon.test.ts` uses a CWD-relative path for `readFileSync` — test breaks when run from a different directory

**File:** `ui/src/reviewer-v2/GutterIcon.test.ts:6`

**Issue:** `readFileSync('src/reviewer-v2/GutterIcon.tsx', 'utf8')` uses a path relative to the
process working directory. The other source-scanning tests in this directory (`ContentPane.test.ts`,
`PlanContent.test.ts`) use `resolve(__dirname, './ComponentName.tsx')` which is portable. Vitest
currently sets cwd to `ui/` so the test passes, but it will silently fail with `ENOENT` if the cwd
changes (e.g., running `vitest` from the repo root, a CI environment, or a different config).

**Fix:** Use `__dirname`-relative resolution consistent with sibling tests:
```typescript
import { resolve } from 'path'
const source = readFileSync(resolve(__dirname, './GutterIcon.tsx'), 'utf8')
```

---

### IN-02: `ContentPane.test.ts` — source-scan test for `handleAction` body is overly brittle and tests implementation, not behavior

**File:** `ui/src/reviewer-v2/ContentPane.test.ts:45-48`

**Issue:** The test extracts the `handleAction` function body via a regex over the raw source file
and then asserts the body contains `resetTextSelection`. Source-scanning tests are fragile: renaming
`handleAction` to `onAction`, inlining it, or reformatting the function (arrow vs `function` keyword)
all break the regex without changing behavior. The matched regex pattern
`/function handleAction[^{]*{[^}]*}/s` also only captures the first `}` in the body, which means
any multi-statement function body (one that itself contains `{`) will be truncated and the assertion
may give a false positive or false negative.

Currently the regex works because the function body is a single statement. When Phase 21 adds
annotation dispatch, the body will grow and the regex will stop capturing the `resetTextSelection`
call.

**Fix:** Replace the source-scan approach with a DOM render test using `@testing-library/react`:
```typescript
it('handleAction clears the text selection', async () => {
  // Render ContentPane in a state with a mocked selection
  // Click a toolbar action button
  // Assert selection state is cleared (selectedText becomes '')
})
```
Or, extract `handleAction` into a separately importable pure function so it can be unit-tested
directly.

---

_Reviewed: 2026-05-20T11:52:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
