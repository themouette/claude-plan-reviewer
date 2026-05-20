---
phase: 18-content-pane
verified: 2026-05-20T12:15:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Confirm GFM rendering visible at /v2"
    expected: "Navigating to /v2 shows formatted plan markdown with tables as grids, task list checkboxes, strikethrough text, and syntax-highlighted code blocks"
    why_human: "Visual rendering cannot be confirmed by grep or test output"
  - test: "Confirm paragraph hover affordance"
    expected: "Moving the mouse over any paragraph shows a subtle background color change and a + icon at the right edge of the paragraph; moving to another paragraph clears the previous and highlights the new one; mousing out clears all"
    why_human: "Requires browser interaction; UI behavior cannot be verified programmatically"
  - test: "Confirm selection toolbar appears and hover disappears when text is selected"
    expected: "Clicking and dragging over text removes the paragraph hover highlight and shows a fixed-position pill toolbar (Comment / Delete / Replace / triangle-more) anchored to the bottom-right of the selection; toolbar stays fixed when scrolling"
    why_human: "Requires browser interaction with DOM selection APIs"
  - test: "Confirm character-offset serialization"
    expected: "In React DevTools, inspecting the SelectionToolbar element shows offsets prop as { start: <number>, end: <number> } and selectedText as the exact selected string"
    why_human: "Requires React DevTools inspection in a real browser session"
  - test: "Confirm more expander contains correct 6 quick actions"
    expected: "Clicking the 'more' expander reveals: clarify this, needs test, give me an example, out of scope, search internet, search codebase"
    why_human: "Requires browser interaction to open the details/summary element"
  - test: "Confirm selection clears after toolbar click"
    expected: "Clicking any pill (e.g. Comment) causes the toolbar to disappear and the selection highlight to clear"
    why_human: "Requires interactive click event in real browser"
---

# Phase 18: Content Pane Verification Report

**Phase Goal:** The center pane renders the plan markdown as formatted HTML with GFM support; hovering a paragraph reveals a gutter icon and subtle background; selecting text shows an anchored comment toolbar — the interaction affordances for commenting are complete (annotation storage and the real onAction/onAdd dispatch are scoped to Phase 21)

**Verified:** 2026-05-20T12:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Markdown plan renders with GFM: tables, task list checkboxes, strikethrough, syntax-highlighted code | VERIFIED | `markdownRenderer.ts` exports `renderMarkdown()` with `marked.use({ gfm: true })` + `markedHighlight`; 6 tests prove GFM output: headings, tables, task lists, strikethrough, hljs prefix, idempotency |
| 2 | Hovering over any paragraph shows subtle background and + icon at right edge | VERIFIED | `PlanContent.tsx` handles `onMouseMove` with `target.closest(...)`, sets `hoveredParagraph` state; renders `<div className="paragraph-hover-overlay">` (via CSS) + `<GutterIcon>` when `hoveredParagraph && !selectedText` |
| 3 | Selecting text shows toolbar anchored to selection end; hover highlight disappears | VERIFIED | `ContentPane.tsx` calls `useTextSelection(planRef)`; renders `<SelectionToolbar>` when `selectedText && offsets`; `handleMouseMove` returns early when `selectedText` is truthy (preventing hover state during selection) |
| 4 | Text selections serialize to character offsets — not DOM paths | VERIFIED | `useTextSelection.ts` stores offsets via `getRangeOffsets()`, returns `getOffsets()` callback; `ContentPane` passes `offsets` to `SelectionToolbar` which uses `rangeFromOffsets()` to reconstruct the Range from character offsets |

**Score:** 4/4 truths verified

### Known Code Quality Issues from Code Review (18-REVIEW.md)

Two critical defects identified in the code review (2026-05-20T11:52) that do not block the ROADMAP success criteria but introduce runtime risk:

**CR-01 — WARNING:** `ContentPane.tsx` casts the fetch response directly to `{ plan_md: string }` without runtime validation. If the server returns a shape without `plan_md`, `marked.parse(undefined)` renders the literal string "undefined" silently. Fix: add a runtime type guard before calling `renderMarkdown()`.

**CR-02 — WARNING:** `rangeFromOffsets()` in `useTextSelection.ts` uses strict `>` for `startNode` and non-strict `>=` for `endNode`. When `start === end` and the value falls exactly at a text-node boundary, the boundary points are inverted and `document.createRange()` would throw a `DOMException`. This does not trigger in normal use (selections are never collapsed by the caller), but it is a latent bug for any future caller passing equal offsets at a node boundary.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `ui/src/reviewer-v2/hooks/useTextSelection.ts` | Character-offset hook + rangeFromOffsets | VERIFIED | 234 lines; exports `rangeFromOffsets` + `useTextSelection`; contains `selection-lock`; no `../` imports |
| `ui/src/reviewer-v2/utils/markdownRenderer.ts` | GFM + hljs rendering with once-guard | VERIFIED | 30 lines; exports `renderMarkdown`; `let configured = false` guard; `marked.use(markedHighlight(...))` + `marked.use({ gfm: true })` |
| `ui/src/reviewer-v2/hooks/useTextSelection.test.ts` | Tests for hook + rangeFromOffsets | VERIFIED | 5 describes covering rangeFromOffsets, useTextSelection export, CSS.highlights mock |
| `ui/src/reviewer-v2/utils/markdownRenderer.test.ts` | Tests for GFM output and idempotency | VERIFIED | 6 tests: heading, table, task list, strikethrough, hljs prefix, idempotency |
| `ui/src/reviewer-v2/GutterIcon.tsx` | Absolute-positioned + button | VERIFIED | Default export; `aria-label="Add comment to paragraph"`; `onMouseDown={(e) => e.preventDefault()}`; `paragraph.offsetTop` positioning; `right: -8`; no `../` imports |
| `ui/src/reviewer-v2/GutterIcon.test.ts` | Source-assertion tests | VERIFIED | 5 tests: function export, offsetTop math, mousedown guard, aria-label, right edge |
| `ui/src/reviewer-v2/SelectionToolbar.tsx` | Fixed-position pill toolbar | VERIFIED | Default export; `QUICK_ACTIONS` named export; `TOOLBAR_WIDTH`; `rangeFromOffsets(containerRef.current,...)`; `role="group"`; `aria-label="Annotation actions"`; `position: 'fixed'`; `Math.min(rect.right, window.innerWidth - TOOLBAR_WIDTH)` |
| `ui/src/reviewer-v2/SelectionToolbar.test.ts` | QUICK_ACTIONS tuple tests | VERIFIED | 4 tests: function export, length 6, first/last anchors, full tuple equality |
| `ui/src/reviewer-v2/PlanContent.tsx` | Markdown host + paragraph hover | VERIFIED | Default export; `if (selectedText) return` early return; `target.closest('p, pre, li, blockquote, h1, h2, h3, h4, h5, h6')`; `hoveredParagraph && !selectedText`; `dangerouslySetInnerHTML`; `className="plan-prose"` |
| `ui/src/reviewer-v2/PlanContent.test.ts` | Source-assertion tests | VERIFIED | 8 tests including selectedText early-return, selector string, GutterIcon suppression, overlay approach |
| `ui/src/reviewer-v2/ContentPane.tsx` | Fetch + selection orchestration | VERIFIED | Default export; `fetch('/api/plan')`; `renderMarkdown(data.plan_md)`; `useTextSelection(planRef)`; loading/error/ready states; `padding: 32` |
| `ui/src/reviewer-v2/ContentPane.test.ts` | Fetch state machine tests | VERIFIED | 8 tests: function export, fetch call, renderMarkdown, error copy, loading copy, JSX tags, padding token, handleAction stub |
| `ui/src/reviewer-v2/ReviewerV2Shell.tsx` modified | ContentPane in center main | VERIFIED | `import ContentPane from './ContentPane'`; `<ContentPane />` in `<main>`; padding: 0 on main |
| `ui/src/reviewer-v2/ReviewerV2.tsx` modified | highlight.js import added | VERIFIED | `import 'highlight.js/styles/github-dark.css'` at top of file |
| `ui/src/index.css` modified | Paragraph hover CSS rule | PARTIAL | `.paragraph-hover-overlay` class added (not `.plan-prose .paragraph-hovered` as the plan acceptance criterion specified); the overlay approach achieves the same visual result via a different mechanism |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `utils/markdownRenderer.ts` | marked + marked-highlight + highlight.js | `import { marked }`, `markedHighlight`, `hljs`; `marked.use(markedHighlight(...))` | WIRED | Module-level once-guard confirmed |
| `hooks/useTextSelection.ts` | CSS.highlights API | `CSS.highlights.set('selection-lock', new Highlight(range))` | WIRED | `HIGHLIGHT_NAME = 'selection-lock'` constant present |
| `SelectionToolbar.tsx` | `hooks/useTextSelection.ts` | `import { rangeFromOffsets } from './hooks/useTextSelection'` | WIRED | Used at render time to reconstruct Range from stored offsets |
| `SelectionToolbar.tsx` | `types.ts` | `import type { AnnotationType }` | WIRED | Used in `onAction` prop and `pills` array |
| `ContentPane.tsx` | `GET /api/plan` | `fetch('/api/plan')` in `useEffect([], [])` | WIRED | Response parsed and piped through `renderMarkdown` |
| `ContentPane.tsx` | `utils/markdownRenderer.ts` | `import { renderMarkdown }` | WIRED | Called on success: `renderMarkdown(data.plan_md)` |
| `PlanContent.tsx` | `GutterIcon.tsx` | `import GutterIcon from './GutterIcon'` | WIRED | Rendered conditionally: `hoveredParagraph && !selectedText` |
| `ReviewerV2Shell.tsx` | `ContentPane.tsx` | `import ContentPane from './ContentPane'`; `<ContentPane />` in `<main>` | WIRED | Replaces previous placeholder span |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `ContentPane.tsx` | `planHtml` | `fetch('/api/plan')` → `renderMarkdown(data.plan_md)` | Yes — real fetch + GFM parse | FLOWING |
| `ContentPane.tsx` | `selectedText`, `resetTextSelection`, `getOffsets` | `useTextSelection(planRef)` | Yes — real DOM selection events | FLOWING |
| `SelectionToolbar.tsx` | `range` (from offsets) | `rangeFromOffsets(containerRef.current, offsets.start, offsets.end)` | Yes — walks live DOM text nodes | FLOWING |
| `PlanContent.tsx` | `hoveredParagraph` | `onMouseMove` → `target.closest(...)` | Yes — real DOM event targeting | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All tests pass | `cd ui && npm test -- --run` | 14 test files, 99 tests passed, 0 failures | PASS |
| Lint clean | `cd ui && npm run lint` | 0 errors, 3 pre-existing App.tsx warnings | PASS |
| TypeScript compiles | `cd ui && npx tsc -b --noEmit` | 0 errors | PASS |
| GFM rendering (unit) | `npx vitest run src/reviewer-v2/utils/markdownRenderer.test.ts` | 6/6 tests passed | PASS |
| useTextSelection (unit) | `npx vitest run src/reviewer-v2/hooks/useTextSelection.test.ts` | All tests passed | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|---------|
| CONTENT-01 | 18-01, 18-03 | Markdown renders as formatted HTML with GFM support | PARTIAL — technology mismatch | ROADMAP SC1 is met; GFM renders correctly. However, REQUIREMENTS.md specifies `react-markdown + remark-gfm + rehype-highlight`; implementation uses `marked + marked-highlight + highlight.js`. Intentional deviation documented in `18-RESEARCH.md`: "NOT react-markdown per UI-SPEC ruling"; the behavior is equivalent |
| CONTENT-02 | 18-02, 18-03 | Hover shows background + gutter icon | VERIFIED | `PlanContent.tsx` implements hover via overlay div + `GutterIcon`; wired in `ContentPane` |
| CONTENT-03 | 18-01, 18-02, 18-03 | Selection toolbar with character-offset serialization | VERIFIED | `useTextSelection` stores offsets; `SelectionToolbar` renders from them; `ContentPane` wires both |
| LAYOUT-02 | 18-03 (claimed) | Three-column shell | VERIFIED (Phase 17) | Three-column layout exists in `ReviewerV2Shell.tsx` (established Phase 17). Phase 18 completes the center column by mounting `<ContentPane />` in `<main>` |

**Requirement discrepancy note:** CONTENT-01 in REQUIREMENTS.md specifies `react-markdown + remark-gfm + rehype-highlight`. The Phase 18 research document (`18-RESEARCH.md`) explicitly overrides this with `marked + marked-highlight + highlight.js` "per UI-SPEC ruling". This deviation is intentional and documented but REQUIREMENTS.md was never updated to reflect the technology choice. This is a WARNING — the behavior goal is achieved.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ContentPane.tsx` | 20 | `data: { plan_md: string }` cast without runtime validation | Warning | Silently renders "undefined" if API response shape changes (CR-01) |
| `hooks/useTextSelection.ts` | 71-79 | Asymmetric `>` vs `>=` in `rangeFromOffsets` boundary conditions | Warning | Inverted Range at exact node boundaries; latent `DOMException` for collapsed-offset callers (CR-02) |
| `SelectionToolbar.tsx` | 49-54 | `/* eslint-disable react-hooks/refs */` — non-existent ESLint rule | Info | No-op comment; does not suppress any real rule; misleading |
| `GutterIcon.test.ts` | 6 | `readFileSync('src/reviewer-v2/GutterIcon.tsx', 'utf8')` CWD-relative path | Info | Fragile: breaks when test runner cwd changes; sibling tests use `resolve(__dirname, ...)` |

No `TBD`, `FIXME`, or `XXX` markers found in phase 18 files.

### Human Verification Required

The following items cannot be confirmed programmatically:

#### 1. GFM Rendering Visible in Browser

**Test:** Start the binary with a sample plan containing all GFM features and navigate to `http://localhost:<port>/v2`
**Expected:** Heading renders, table shows as a grid with cell borders, task list shows checkboxes (one checked, one unchecked), strikethrough text shows with strikethrough styling, code block shows syntax-highlighted tokens with different colors
**Why human:** Visual rendering requires a real browser; grep confirms the implementation exists but not that it renders correctly

#### 2. Paragraph Hover Affordance

**Test:** Move the mouse over various paragraphs in the `/v2` center column
**Expected:** (a) A subtle background color appears on the hovered paragraph, (b) a `+` icon appears at the right edge, (c) moving to another paragraph clears the first and highlights the new one, (d) mousing out of the content area clears all
**Why human:** CSS hover background and DOM offsetTop positioning require a real browser with layout computed

#### 3. Selection Toolbar Appearance and Hover Suppression

**Test:** Click and drag to select text inside any paragraph
**Expected:** (a) The paragraph background highlight disappears while text is selected, (b) a blue selection highlight appears on the selected text, (c) a pill toolbar (Comment / Delete / Replace / triangle-more) appears anchored to the bottom-right of the selection, (d) the toolbar remains fixed when the content pane scrolls
**Why human:** Requires real mouse selection events and CSS Custom Highlight API behavior in a real browser

#### 4. Character-Offset Serialization via DevTools

**Test:** After making a selection in `/v2`, open React DevTools and inspect the `SelectionToolbar` component
**Expected:** Props show `offsets={{ start: <number>, end: <number> }}` and `selectedText="<exact selected text>"`
**Why human:** Requires React DevTools access in a real browser session

#### 5. More Expander with 6 Quick Actions

**Test:** Make a selection, click the `triangle-more` button in the toolbar
**Expected:** A dropdown menu appears with exactly 6 items in order: `clarify this`, `needs test`, `give me an example`, `out of scope`, `search internet`, `search codebase`
**Why human:** Requires browser interaction with the `<details>/<summary>` element

#### 6. Selection Clears After Toolbar Click (Phase 18 Stub Behavior)

**Test:** Make a text selection, click any pill (e.g., Comment)
**Expected:** The toolbar disappears and the selection highlight clears; no annotation is persisted (Phase 18 stub behavior — Phase 21 will add persistence)
**Why human:** Requires real browser click event

### Gaps Summary

No BLOCKER gaps were found. All four ROADMAP success criteria have verified implementation evidence in the codebase. The phase is blocked by the human verification checkpoint (Plan 03 Task 3, `gate: blocking`, `autonomous: false`), which requires explicit user approval after completing the 6-step browser verification flow in `18-03-PLAN.md`.

**Technical debt items to address (not blocking phase goal):**

1. **CR-01 (ContentPane API shape validation):** Add runtime type guard before `renderMarkdown(data.plan_md)` — prevents silent "undefined" rendering if API response shape changes
2. **CR-02 (rangeFromOffsets boundary condition):** Fix asymmetric `>` vs `>=` comparison to prevent inverted Range at exact node boundaries
3. **CONTENT-01 technology spec:** Update `REQUIREMENTS.md` to reflect `marked + marked-highlight + highlight.js` instead of the specified `react-markdown + remark-gfm + rehype-highlight`

---

_Verified: 2026-05-20T12:15:00Z_
_Verifier: Claude (gsd-verifier)_
