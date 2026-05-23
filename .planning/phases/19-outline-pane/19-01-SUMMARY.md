---
phase: 19-outline-pane
plan: 01
subsystem: ui
tags: [typescript, react, marked, markdown, slug, heading-ids, tdd, vitest]

# Dependency graph
requires:
  - phase: 17-foundation-isolation
    provides: markdownRenderer.ts with renderMarkdown() using marked v18 + GFM

provides:
  - markdownRenderer.ts exports slugify() and extractRawText() as pure named functions
  - renderMarkdown() injects id attributes on all h1-h6 elements using slugified heading text
  - Duplicate headings get -2, -3, ... suffix; counter resets per renderMarkdown() call
  - 14-test TDD suite covering slug logic, id injection, duplicate handling, counter reset

affects:
  - 19-02 (ContentPane — consumes heading ids via querySelectorAll in useEffect)
  - 19-03 (OutlinePane — scrolls to heading ids via document.getElementById)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level Map reset before each renderMarkdown() call for per-call-scoped state"
    - "marked.use({ renderer: { heading() {} } }) with regular method (not arrow) for this.parser access"
    - "extractRawText recursion: 'tokens' in t && t.tokens guard for safe optional chaining"

key-files:
  created: []
  modified:
    - ui/src/reviewer-v2/utils/markdownRenderer.ts
    - ui/src/reviewer-v2/utils/markdownRenderer.test.ts

key-decisions:
  - "headingSlugCounts is module-level (not local) because marked.use() registers renderer once — closure must read mutable variable"
  - "Regular method syntax for heading renderer (not arrow) — this.parser.parseInline() requires this binding in marked v18"
  - "headingSlugCounts reset BEFORE marked.parse(), not after — ensures counter is fresh before any heading token is processed"
  - "Added extractRawText test case to eliminate @typescript-eslint/no-unused-vars lint error"

patterns-established:
  - "Pattern: slugify = lowercase + trim + /\\s+/g→hyphen + strip non-alphanumeric"
  - "Pattern: duplicate id suffix is count+1 (first=0→no suffix, second=1→-2, third=2→-3)"

requirements-completed: [OUTLINE-01, OUTLINE-02]

# Metrics
duration: 2min
completed: 2026-05-20
---

# Phase 19 Plan 01: Heading ID Injection Summary

**slugify/extractRawText exported from markdownRenderer.ts; renderMarkdown() injects id attributes on h1-h6 with duplicate-safe counter reset per call**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-20T15:36:30Z
- **Completed:** 2026-05-20T15:38:45Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Exported `slugify()` pure function: lowercase → trim → hyphenate spaces → strip non-[a-z0-9-]
- Exported `extractRawText()` pure function: recursively walks marked Token[] collecting raw values
- `renderMarkdown()` now injects `id="slug"` on every h1-h6, with `-2`/`-3` suffixes for duplicates
- Per-call counter reset ensures two independent `renderMarkdown()` calls produce identical id sequences
- 14 Vitest tests (6 pre-existing + 8 new) all green; 0 new lint errors

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Failing tests for slugify, extractRawText, and heading id injection** - `e223711` (test)
2. **Task 2: GREEN — Implement heading renderer** - `1ef5603` (feat)

_Note: TDD plan — RED commit contains failing tests, GREEN commit makes them pass._

## Files Created/Modified
- `ui/src/reviewer-v2/utils/markdownRenderer.ts` - Added headingSlugCounts Map, extractRawText(), slugify(), heading renderer in marked.use()
- `ui/src/reviewer-v2/utils/markdownRenderer.test.ts` - Added describe('slugify'), describe('extractRawText'), describe('renderMarkdown heading ids') — 8 new tests

## Decisions Made
- Used module-level `headingSlugCounts` Map (not local variable) because `marked.use()` registers the heading renderer once; the closure must reference a mutable module-level variable to get the reset-per-call behavior
- Used regular method syntax `heading({ tokens, depth }) {}` (not arrow `heading: () => {}`) because `this.parser.parseInline()` requires `this` binding — arrow functions break it in marked v18
- Reset `headingSlugCounts = new Map()` at the START of `renderMarkdown()`, before `marked.parse()`, so the counter is fresh before the first heading token fires
- Added a direct `extractRawText` test case (flat token array) to eliminate the `@typescript-eslint/no-unused-vars` lint error from the import

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added extractRawText test to fix lint error**
- **Found during:** Task 2 (GREEN implementation)
- **Issue:** Importing `extractRawText` in the test file without using it caused `@typescript-eslint/no-unused-vars` lint error — a new error introduced by our changes
- **Fix:** Added `describe('extractRawText')` block with a single test verifying flat token concatenation; also added `import { marked } from 'marked'` for the `marked.Token[]` type annotation
- **Files modified:** `ui/src/reviewer-v2/utils/markdownRenderer.test.ts`
- **Verification:** `npm run lint` reports 0 errors from our modified files; 14 tests pass
- **Committed in:** `1ef5603` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical — lint correctness)
**Impact on plan:** Minimal — adds one test case for a function the plan already required to be exported and testable. No scope creep.

## Issues Encountered
- Pre-existing lint errors in `useTextSelection.test.ts` (no-regex-spaces) and `useTextSelection.ts` (_e unused) and `App.tsx` (eslint-disable warnings) — all out of scope, not introduced by this plan

## TDD Gate Compliance

- RED gate: `e223711` — `test(19-01): add failing tests for slug function and heading id injection`
- GREEN gate: `1ef5603` — `feat(19-01): add heading id injection and slug exports to renderMarkdown`
- REFACTOR gate: not needed — code is clean as written

Both required gates present in git history. Plan type is `tdd` — gate sequence valid.

## Next Phase Readiness
- `markdownRenderer.ts` now emits heading ids; Plan 02 (ContentPane) can use `querySelectorAll('h1,h2,h3,h4,h5,h6')` and read `.id` to build Section[]
- OutlinePane (Plan 03) can call `document.getElementById(section.id)` to scroll to headings
- slugify/extractRawText exported for reuse if OutlinePane needs to reconstruct ids from heading text

## Self-Check: PASSED

- FOUND: `ui/src/reviewer-v2/utils/markdownRenderer.ts`
- FOUND: `ui/src/reviewer-v2/utils/markdownRenderer.test.ts`
- FOUND: `.planning/phases/19-outline-pane/19-01-SUMMARY.md`
- FOUND commit `e223711`: test(19-01) RED gate
- FOUND commit `1ef5603`: feat(19-01) GREEN gate

---
*Phase: 19-outline-pane*
*Completed: 2026-05-20*
