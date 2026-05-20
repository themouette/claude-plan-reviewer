---
phase: 19-outline-pane
plan: 03
subsystem: ui
tags: [typescript, react, intersection-observer, outline, scroll, tdd, vitest, source-read-tests]

# Dependency graph
requires:
  - phase: 19-outline-pane
    plan: 01
    provides: renderMarkdown() injects id attributes on h1-h6 elements
  - phase: 19-outline-pane
    plan: 02
    provides: ContentPane accepts onSectionsFound prop, Section type in types.ts

provides:
  - OutlinePane component with IntersectionObserver active section tracking
  - Click-to-scroll via scrollIntoView({block:start}) without URL change (OUTLINE-02)
  - Depth-driven indentation: paddingLeft = 16 + (depth - 1) * 8 (OUTLINE-01)
  - Outline auto-scroll via scrollIntoView({block:nearest}) on activeId change
  - 10-test source-read suite for OutlinePane assertions
  - ReviewerV2Shell wired with mainRef, sections state, activeId state, and OutlinePane

affects:
  - human-verify checkpoint: user must approve visual/interactive behavior in browser

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IntersectionObserver with root: mainRef.current for scroll-container-scoped tracking"
    - "Outline auto-scroll: scrollIntoView({block:nearest}) on activeId dep — keeps active item visible without jarring"
    - "Two-useEffect pattern: one for IntersectionObserver lifecycle, one for auto-scroll on activeId change"
    - "activeItemRef attached conditionally: ref={section.id === activeId ? activeItemRef : undefined}"

key-files:
  created:
    - ui/src/reviewer-v2/OutlinePane.tsx
    - ui/src/reviewer-v2/OutlinePane.test.ts
  modified:
    - ui/src/reviewer-v2/ReviewerV2Shell.tsx

key-decisions:
  - "Used block:nearest for outline auto-scroll (not block:start) to avoid jarring scroll when active item already visible (D-05)"
  - "Used block:start for click-to-scroll to ensure heading appears at top of center pane (D-02)"
  - "IntersectionObserver root must be mainRef.current (the scroll container), not null — null roots observe viewport which is wrong for a scrollable column"
  - "activeItemRef attaches only to the active li — not all items — to avoid stale ref issues on section changes"

patterns-established:
  - "Pattern: PropRef threading — Shell holds mainRef, passes to OutlinePane for IntersectionObserver root"
  - "Pattern: Parallel state ownership — Shell owns sections and activeId; ContentPane calls onSectionsFound; OutlinePane calls onActiveIdChange"

requirements-completed: [OUTLINE-01, OUTLINE-02, OUTLINE-03]

# Metrics
duration: 3min
completed: 2026-05-20
---

# Phase 19 Plan 03: OutlinePane Component Summary

**OutlinePane with IntersectionObserver active tracking, click-to-scroll, and depth-indented heading tree wired into ReviewerV2Shell — awaiting human visual verification**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-20T15:49:17Z
- **Completed:** 2026-05-20T15:52:15Z (Tasks 1-2; Task 3 awaiting human verify)
- **Tasks:** 2 of 3 complete (Task 3 is human-verify checkpoint)
- **Files modified:** 3

## Accomplishments

- Created `OutlinePane.tsx` with `<nav aria-label="Document outline">`, `<ol>/<li>/<button>` structure
- IntersectionObserver with `root: mainRef.current`, `rootMargin: '-10px 0px -85% 0px'`, first-intersecting-wins logic
- Click handler: `scrollIntoView({behavior:'smooth', block:'start'})` — no URL change (OUTLINE-02)
- Outline auto-scroll: `scrollIntoView({behavior:'smooth', block:'nearest'})` on `activeId` change
- Depth-driven indentation: `paddingLeft: 16 + (section.depth - 1) * 8` (OUTLINE-01)
- `aria-current="true"` on active item; focus ring via `onFocus/onBlur` handlers
- Hover state: `rgba(255,255,255,0.04)` background on non-active items
- 10 source-read tests all passing in `OutlinePane.test.ts`
- `ReviewerV2Shell.tsx` wired: `mainRef`, `sections`/`activeId` state, `<OutlinePane>` replacing placeholder, `<ContentPane onSectionsFound={setSections}>`
- Full test suite: 138 tests across 15 files, all green

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Failing source-read tests for OutlinePane** - `d93f8ae` (test)
2. **Task 1: GREEN — OutlinePane component implementation** - `e46725d` (feat)
3. **Task 2: Wire Shell with mainRef, sections, activeId, OutlinePane** - `f62fad5` (feat)

_Note: Task 3 is a human-verify checkpoint — not committed until user approves._

## Files Created/Modified

- `ui/src/reviewer-v2/OutlinePane.tsx` - Left-column outline component; nav+ol+li+button; IntersectionObserver; two useEffects; depth indentation
- `ui/src/reviewer-v2/OutlinePane.test.ts` - 10 source-read assertions covering OUTLINE-01/02/03 requirements
- `ui/src/reviewer-v2/ReviewerV2Shell.tsx` - Added mainRef, sections/activeId state; OutlinePane mounted in left aside; ContentPane receives onSectionsFound prop

## Decisions Made

- Used `block: 'nearest'` for outline auto-scroll — avoids jarring scroll when active item already in view (D-05 from CONTEXT.md)
- Used `block: 'start'` for click-to-scroll — heading appears at top of center pane (D-02)
- `IntersectionObserver root` is `mainRef.current` (the `<main>` scroll container) not `null` — null root watches the viewport, which is wrong for a scrollable column layout
- `activeItemRef` attaches only to the currently active `<li>` — attaching to all would cause stale-ref issues when sections change

## Deviations from Plan

None — plan executed exactly as written. The node_modules symlink (originally a Rule 3 deviation in Plan 02) was already present and reused.

## Issues Encountered

- Pre-existing TypeScript errors in `markdownRenderer.ts` (marked.Token namespace export) — not introduced by this plan, confirmed present in main repo before any changes
- Pre-existing lint errors in `useTextSelection.test.ts` and `useTextSelection.ts` — not introduced by this plan (documented in Plans 01 and 02 summaries)

## Checkpoint Status

**Task 3 is a `checkpoint:human-verify`** — the plan stops here and waits for the user to:

1. Start dev server and open `/v2` in browser
2. Verify OUTLINE-01: heading tree with correct indentation
3. Verify OUTLINE-02: click-to-scroll without URL change
4. Verify OUTLINE-03: active section tracking + outline auto-scroll
5. Check active state visual: left blue border, accent text, surface background
6. Check hover state: subtle background on non-active items

The plan resumes when the user types "approved".

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. OutlinePane renders heading text from the plan document (read-only, user-initiated review flow). T-19-06 mitigation is in place: `if (!mainRef.current || sections.length === 0) return` guard and optional chaining on `getElementById()?.scrollIntoView()`.

## Self-Check: PASSED

- FOUND: `ui/src/reviewer-v2/OutlinePane.tsx`
- FOUND: `ui/src/reviewer-v2/OutlinePane.test.ts`
- FOUND: `ui/src/reviewer-v2/ReviewerV2Shell.tsx` (modified)
- FOUND commit `d93f8ae`: test(19-03) RED gate
- FOUND commit `e46725d`: feat(19-03) GREEN gate
- FOUND commit `f62fad5`: feat(19-03) Shell wiring
- Full test suite: 138/138 passing
- No new lint errors in modified files
- No new TypeScript errors in modified files

## Next Phase Readiness

Once Task 3 is human-approved:
- OUTLINE-01, OUTLINE-02, OUTLINE-03 requirements are complete
- Phase 19 is ready for merge to main
- Phase 20 (comment sidebar) can begin — it depends on Shell's 3-column structure which is now complete

---
*Phase: 19-outline-pane*
*Completed: 2026-05-20*
