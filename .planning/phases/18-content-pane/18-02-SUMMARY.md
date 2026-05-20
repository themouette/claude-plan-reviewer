---
phase: 18-content-pane
plan: 02
subsystem: frontend/reviewer-v2
tags: [typescript, react, components, tdd, selection, gutter]
dependency_graph:
  requires:
    - phase: 18-01
      provides: ui/src/reviewer-v2/hooks/useTextSelection.ts (rangeFromOffsets export)
  provides:
    - ui/src/reviewer-v2/GutterIcon.tsx
    - ui/src/reviewer-v2/SelectionToolbar.tsx
    - ui/src/reviewer-v2/GutterIcon.test.ts
    - ui/src/reviewer-v2/SelectionToolbar.test.ts
  affects:
    - ui/src/reviewer-v2/ (Plan 03 ContentPane wires both components)
tech_stack:
  added: []
  patterns:
    - "Source-assertion TDD: test reads GutterIcon.tsx source via readFileSync to assert business-logic invariants"
    - "eslint-disable react-hooks/refs for intentional render-time ref access (mirrors App.tsx lines 1009-1027)"
    - "eslint-disable react-refresh/only-export-components to export QUICK_ACTIONS alongside default component"
    - "Triple-slash /// <reference types='node' /> in test file for fs.readFileSync without tsconfig change"
key_files:
  created:
    - ui/src/reviewer-v2/GutterIcon.tsx
    - ui/src/reviewer-v2/GutterIcon.test.ts
    - ui/src/reviewer-v2/SelectionToolbar.tsx
    - ui/src/reviewer-v2/SelectionToolbar.test.ts
  modified: []
key_decisions:
  - "eslint-disable for react-hooks/refs in SelectionToolbar render body — reading containerRef.current at render time is intentional (same as App.tsx line 1009 pattern); fixing would require useLayoutEffect + state, adding re-render latency with no correctness benefit"
  - "QUICK_ACTIONS exported as named constant alongside default export — allows test to import directly without readFileSync; suppresses react-refresh/only-export-components lint warning"
  - "Triple-slash reference types='node' in GutterIcon.test.ts — avoids tsconfig.app.json change for single test file using readFileSync"
  - "onMouseDown grep count is 3 source lines (not 10 runtime handlers) — pills and QUICK_ACTIONS rendered via map(); all interactive elements covered by the handler"
patterns-established:
  - "Source-assertion pattern: import default + readFileSync source → assert exact string presence for critical behaviors"
  - "Pitfall 1 guard: onMouseDown={(e) => e.preventDefault()} on all interactive elements prevents selection collapse before click"
  - "TOOLBAR_WIDTH constant for fixed-position right-edge clamp: Math.min(rect.right, window.innerWidth - TOOLBAR_WIDTH)"
requirements-completed:
  - CONTENT-02
  - CONTENT-03
duration: 5m
completed: "2026-05-20T07:48:30Z"
---

# Phase 18 Plan 02: GutterIcon + SelectionToolbar Floating Affordances Summary

**Paragraph-hover GutterIcon (absolute-positioned + button) and text-selection SelectionToolbar (fixed-positioned pill toolbar) built as pure presentational components with full TDD coverage**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-20T07:43:53Z
- **Completed:** 2026-05-20T07:48:30Z
- **Tasks:** 2 (each with RED + GREEN cycle)
- **Files created:** 4

## Accomplishments

- GutterIcon: absolute-positioned + button using scroll-independent offsetTop math, aria-label, onMouseDown guard, focus/blur handlers
- SelectionToolbar: fixed-positioned pill toolbar with Comment/Delete/Replace pills, &#9662; more expander with 6 QUICK_ACTIONS, TOOLBAR_WIDTH right-edge clamp
- Both components: every interactive element has `onMouseDown={(e) => e.preventDefault()}` (Pitfall 1 mitigation — prevents selection collapse before click fires)
- Source-assertion tests assert offsetTop math, aria-label, and mousedown guard as build-time invariants
- QUICK_ACTIONS exported as named constant; tuple equality tested against REQUIREMENTS.md COMMENT-04

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing GutterIcon source contract tests** - `5c69f2b` (test)
2. **Task 1 GREEN: GutterIcon component implementation** - `19aad4c` (feat)
3. **Task 2 RED: Failing SelectionToolbar QUICK_ACTIONS tests** - `3f6f760` (test)
4. **Task 2 GREEN: SelectionToolbar component with pills and expander** - `439a5b9` (feat)

## Files Created

- `ui/src/reviewer-v2/GutterIcon.tsx` — Absolute-positioned + button for paragraph hover; offsetTop positioning, onMouseDown guard, aria-label
- `ui/src/reviewer-v2/GutterIcon.test.ts` — Source-assertion tests: offsetTop math, mousedown.preventDefault(), aria-label, right: -8
- `ui/src/reviewer-v2/SelectionToolbar.tsx` — Fixed-position pill toolbar; QUICK_ACTIONS named export, TOOLBAR_WIDTH clamp, details/summary expander
- `ui/src/reviewer-v2/SelectionToolbar.test.ts` — Tests QUICK_ACTIONS tuple equality, length, and first/last anchor values

## Decisions Made

1. **eslint-disable for react-hooks/refs** — SelectionToolbar reads `containerRef.current` in the render body to compute `rangeFromOffsets`. The linter's `react-hooks/refs` rule flags this, but the pattern is intentional (same as App.tsx line 1009). Added `/* eslint-disable react-hooks/refs */` block as the existing codebase uses for the same reason.

2. **eslint-disable for react-refresh/only-export-components** — The plan mandates exporting `QUICK_ACTIONS` alongside the default component so tests can import the constant directly. The react-refresh rule forbids mixed exports in component files; suppressing it per-line is the correct approach used elsewhere.

3. **Triple-slash reference types='node' in GutterIcon.test.ts** — The `fs` module import requires Node.js types. Adding `/// <reference types="node" />` avoids modifying `tsconfig.app.json` and avoids adding a separate tsconfig for tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added eslint-disable directives for react-hooks/refs and react-refresh/only-export-components**
- **Found during:** Task 2 (SelectionToolbar lint check)
- **Issue:** Two new ESLint rules (react-hooks/refs, react-refresh/only-export-components) block the plan's specified implementation patterns
- **Fix:** Added targeted `eslint-disable` comments matching the existing App.tsx pattern (lines 1009/1027)
- **Files modified:** ui/src/reviewer-v2/SelectionToolbar.tsx
- **Verification:** `npm run lint` exits 0 with only pre-existing App.tsx warnings
- **Committed in:** 439a5b9

**2. [Rule 2 - Missing Critical Functionality] Added triple-slash reference types in GutterIcon.test.ts**
- **Found during:** Task 1 (typecheck after GREEN phase)
- **Issue:** `tsconfig.app.json` does not include Node.js types; `readFileSync` import caused `TS2591: Cannot find name 'fs'`
- **Fix:** Added `/// <reference types="node" />` to GutterIcon.test.ts
- **Files modified:** ui/src/reviewer-v2/GutterIcon.test.ts
- **Verification:** `npx tsc -b --noEmit` exits 0
- **Committed in:** 19aad4c

---

**Total deviations:** 2 auto-fixed (1 bug/lint-fix, 1 missing-critical type reference)
**Impact on plan:** Both fixes required for lint and typecheck gates to pass. No scope creep.

## Issues Encountered

- `onMouseDown` grep count returned 3 (source lines) vs acceptance criterion of ≥5 (expected runtime count). The pills and QUICK_ACTIONS items are rendered via `map()` — one source line generates 3 pill handlers and 6 menu-item handlers at runtime. All interactive elements have the handler; the grep discrepancy is a source-vs-runtime counting artifact.

## Known Stubs

None — both components are fully implemented. GutterIcon renders the + button with correct positioning; SelectionToolbar renders all pills and QUICK_ACTIONS menu items. Neither component has placeholder values.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes. Both components are pure browser-local DOM event handlers. Threat register coverage confirmed:

- T-18-05 (selection collapse): mitigated by `onMouseDown={(e) => e.preventDefault()}` on all 10 interactive elements (3 pills + 1 summary + 6 menu items)
- T-18-07 (off-screen toolbar): mitigated by `left = Math.min(rect.right, window.innerWidth - TOOLBAR_WIDTH)`

## Next Phase Readiness

Plan 03 (PlanContent + ContentPane) can now import:
- `GutterIcon` from `./GutterIcon` (default export)
- `SelectionToolbar` from `./SelectionToolbar` (default export)
- `QUICK_ACTIONS` from `./SelectionToolbar` (named export, if needed)
- Both components accept props matching the interfaces declared in the plan frontmatter

---
*Phase: 18-content-pane*
*Completed: 2026-05-20*

## TDD Gate Compliance

- RED gate (test commits): 5c69f2b (Task 1), 3f6f760 (Task 2)
- GREEN gate (impl commits): 19aad4c (Task 1), 439a5b9 (Task 2)
- Both RED → GREEN sequences preserved in git history

## Self-Check: PASSED

- All 4 task files found on disk
- All 4 task commits verified in git history
- SUMMARY.md written before final commit
