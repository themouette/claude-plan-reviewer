---
phase: 19-outline-pane
plan: 02
subsystem: ui
tags: [typescript, react, tdd, vitest, section-type, heading-walk, useEffect]

# Dependency graph
requires:
  - phase: 19-outline-pane
    plan: 01
    provides: renderMarkdown() injects id attributes on h1-h6 elements

provides:
  - Section interface exported from types.ts with id/text/depth fields
  - ContentPane accepts onSectionsFound optional callback prop
  - heading walk useEffect in ContentPane fires after planHtml loads, builds Section[] from DOM, calls onSectionsFound
  - 14-test suite (8 existing + 6 new source-read assertions) all green

affects:
  - 19-03 (OutlinePane — receives Section[] via onSectionsFound wired through ReviewerV2Shell)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useEffect([planHtml, onSectionsFound]) fires after React commits DOM — querySelectorAll finds headings correctly"
    - "Default parameter = {} on ContentPane props for backward-compatible no-arg call"
    - "Source-read tests (readFileSync + toContain) as TDD contract for implementation strings"

key-files:
  created: []
  modified:
    - ui/src/reviewer-v2/types.ts
    - ui/src/reviewer-v2/ContentPane.tsx
    - ui/src/reviewer-v2/ContentPane.test.ts

key-decisions:
  - "Default parameter = {} on ContentPane props object — allows ContentPane() with no args (backward-compatible with ReviewerV2Shell.tsx)"
  - "useEffect dependency array includes both planHtml and onSectionsFound — re-runs if callback reference changes (stable in practice since Shell will useCallback or pass stable ref)"
  - "Guard checks both planRef.current AND onSectionsFound — both must be present before querySelectorAll runs"
  - "node_modules symlink created in worktree ui/ (-> main repo ui/node_modules) to enable vitest from worktree context"

requirements-completed: [OUTLINE-01]

# Metrics
duration: 3min
completed: 2026-05-20
---

# Phase 19 Plan 02: ContentPane onSectionsFound Prop Summary

**Section interface added to types.ts; ContentPane extended with onSectionsFound prop and heading walk useEffect that builds Section[] from DOM after planHtml loads**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-20T15:42:36Z
- **Completed:** 2026-05-20T15:46:14Z
- **Tasks:** 2 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments

- Added `export interface Section { id: string; text: string; depth: number }` to `types.ts`
- Added 6 source-read assertions in a new `describe('ContentPane onSectionsFound wiring')` block to `ContentPane.test.ts` — all fail RED before implementation
- Extended `ContentPane.tsx` with:
  - `Section` imported from `./types`
  - Optional `onSectionsFound` prop via typed inline object with default `= {}`
  - `useEffect([planHtml, onSectionsFound])` that guards on `planRef.current && onSectionsFound`, runs `querySelectorAll('h1,h2,h3,h4,h5,h6')`, maps elements to `Section[]` using `el.id`, `el.textContent ?? ''`, `parseInt(el.tagName[1], 10)`, then calls `onSectionsFound(sections)`
- All 14 ContentPane tests green; full 128-test suite (14 test files) passes; 0 new lint errors

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Section type + failing tests for onSectionsFound wiring** - `71463c4` (test)
2. **Task 2: GREEN — Implement ContentPane heading walk** - `c66acb7` (feat)

_Note: TDD plan — RED commit contains failing tests, GREEN commit makes them pass._

## Files Created/Modified

- `ui/src/reviewer-v2/types.ts` - Added `export interface Section { id: string; text: string; depth: number }` after `AnnotationAction` export
- `ui/src/reviewer-v2/ContentPane.tsx` - Added `Section` import, changed function signature to accept optional `onSectionsFound` prop (default `= {}`), added heading walk `useEffect([planHtml, onSectionsFound])`
- `ui/src/reviewer-v2/ContentPane.test.ts` - Added `describe('ContentPane onSectionsFound wiring')` with 6 source-read assertions

## Decisions Made

- Used default parameter `= {}` on the props object: `ContentPane({ onSectionsFound }: { onSectionsFound?: ... } = {})` — allows ContentPane() with no arguments, preserving backward compatibility with current ReviewerV2Shell usage
- Dependency array `[planHtml, onSectionsFound]` — re-fires the heading walk if either the HTML content or the callback reference changes
- Guard `if (!planRef.current || !onSectionsFound) return` — both conditions must be met before the DOM walk executes
- Created `node_modules` symlink in the worktree's `ui/` directory pointing to the main repo's `ui/node_modules` — required for vitest to run from the worktree context (worktrees don't inherit node_modules by default)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created node_modules symlink in worktree ui/ directory**
- **Found during:** Task 1 (RED — attempting to run tests from worktree)
- **Issue:** Running `npx vitest` from the worktree's `ui/` directory failed because `node_modules` was absent; running from the main repo's `ui/` directory would test the main repo's OLD files, not the worktree's updated files
- **Fix:** Created a symlink `worktree/ui/node_modules -> main_repo/ui/node_modules`; all subsequent test runs executed correctly from the worktree context
- **Files modified:** none (symlink only; `.gitignore` already ignores `node_modules`)
- **Impact:** No impact on committed code; symlink is in `.gitignore` and not tracked

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking issue: missing node_modules in worktree)
**Impact on plan:** Zero — test results are identical to plan expectations.

## Issues Encountered

- Pre-existing lint errors in `useTextSelection.test.ts` (no-regex-spaces) and `useTextSelection.ts` (_e unused) — out of scope, not introduced by this plan (documented in 19-01 SUMMARY)

## TDD Gate Compliance

- RED gate: `71463c4` — `test(19-02): add failing tests for ContentPane onSectionsFound prop and Section type`
- GREEN gate: `c66acb7` — `feat(19-02): add onSectionsFound prop and heading walk useEffect to ContentPane`
- REFACTOR gate: not needed — code is clean as written

Both required gates present in git history. Plan type is `tdd` — gate sequence valid.

## Next Phase Readiness

- `Section` type is now the data contract for the heading tree; Plan 03 (OutlinePane) can import `Section` from `types.ts`
- `ContentPane` exposes `onSectionsFound` prop; `ReviewerV2Shell.tsx` can pass a state setter callback to receive Section[] and forward to OutlinePane
- The heading walk fires after `planHtml` is committed to DOM — ids injected by `renderMarkdown()` (Plan 01) are readable via `el.id`

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. DOM read of heading text/ids is already visible to the user and sanitized by the existing marked GFM pipeline (T-19-03 and T-19-04 in plan threat model — both accepted).

## Self-Check: PASSED

- FOUND: `ui/src/reviewer-v2/types.ts` with `export interface Section`
- FOUND: `ui/src/reviewer-v2/ContentPane.tsx` with `onSectionsFound` and heading walk
- FOUND: `ui/src/reviewer-v2/ContentPane.test.ts` with 14 tests
- FOUND: `.planning/phases/19-outline-pane/19-02-SUMMARY.md`
- FOUND commit `71463c4`: test(19-02) RED gate
- FOUND commit `c66acb7`: feat(19-02) GREEN gate

---
*Phase: 19-outline-pane*
*Completed: 2026-05-20*
