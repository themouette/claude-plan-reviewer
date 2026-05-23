---
phase: 19-outline-pane
verified: 2026-05-20T18:12:00Z
status: passed
score: 4/4 must-haves verified (OUTLINE-04 deferred to Phase 21)
overrides_applied: 0
gaps:
  - truth: "Each outline item shows a badge with the count of comments anchored within that section; a section with no comments shows no badge or shows zero; adding a comment updates the count immediately"
    status: failed
    reason: "OUTLINE-04 (comment count badges) is entirely absent from OutlinePane.tsx and ReviewerV2Shell.tsx. No badge UI, no sectionId on Annotation type, no count computation logic exists. ROADMAP.md Phase 19 Success Criterion #4 is unmet. The discussion log records a user decision to defer this to Phase 21, but Phase 21's roadmap Requirements field lists only COMMENT-04 and COMMENT-05 — OUTLINE-04 is not assigned to any future phase in ROADMAP.md. The REQUIREMENTS.md traceability table still maps OUTLINE-04 to Phase 19."
    artifacts:
      - path: "ui/src/reviewer-v2/OutlinePane.tsx"
        issue: "No badge element, no comment count prop, no section-to-count mapping"
      - path: "ui/src/reviewer-v2/ReviewerV2Shell.tsx"
        issue: "No annotation count passed to OutlinePane"
      - path: "ui/src/reviewer-v2/types.ts"
        issue: "Annotation interface has no sectionId field"
    missing:
      - "Badge UI on outline items showing per-section comment counts"
      - "sectionId field on Annotation type (or equivalent count-computation approach)"
      - "Logic to count annotations per section and pass counts to OutlinePane"
      - "ROADMAP.md update: move OUTLINE-04 requirement to Phase 21 if deferral was intentional"
human_verification:
  - test: "Open /v2 with a plan document that has multiple headings"
    expected: "Left column shows a heading tree with correct depth indentation; clicking any item smooth-scrolls the center pane to that heading without changing the URL; scrolling the center pane highlights the heading nearest the top of the viewport in the outline panel; the highlighted outline item scrolls into view in the outline panel if off-screen"
    why_human: "IntersectionObserver behavior, smooth-scroll timing, active highlight visual state, and URL-non-change cannot be verified by static code analysis"
---

# Phase 19: Outline Pane Verification Report

**Phase Goal:** Implement the outline pane — a left-column heading tree that shows all headings from the rendered plan, supports click-to-scroll, and highlights the active heading as the user scrolls.
**Verified:** 2026-05-20T18:12:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All headings appear in the outline panel indented proportionally to their depth | ✓ VERIFIED | `OutlinePane.tsx` renders `sections.map()` with `paddingLeft: 16 + (section.depth - 1) * 8`; `Section[]` is built from `querySelectorAll('h1,h2,h3,h4,h5,h6')` in `ContentPane.tsx`; `renderMarkdown()` injects slugified `id` attributes on all h1–h6 elements |
| 2 | Clicking any outline item scrolls that heading to the top of the content viewport — the browser URL does not change | ✓ VERIFIED (code) / ? HUMAN NEEDED (runtime) | `OutlinePane.tsx` uses `document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })`; no `window.location` or `history.push` present; `<button>` not `<a href=>` |
| 3 | As the user scrolls the content pane, the outline item for the heading closest to the top is highlighted and auto-scrolled into view | ✓ VERIFIED (code) / ? HUMAN NEEDED (runtime) | `IntersectionObserver` with `root: mainRef.current`, `rootMargin: '-10px 0px -85% 0px'`, `threshold: 0`; `onActiveIdChange(entry.target.id)` fires on first intersecting entry; `activeItemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })` fires on `activeId` change |
| 4 | Each outline item shows a badge with the count of comments anchored within that section; a section with no comments shows no badge or zero; adding a comment updates the count immediately | ✗ FAILED | `OutlinePane.tsx` contains no badge element, no count prop, no count-computation logic. `Annotation` type has no `sectionId` field. `ReviewerV2Shell.tsx` passes no comment count data to `OutlinePane`. OUTLINE-04 is entirely unimplemented. |
| 5 | ReviewerV2Shell wires sections + activeId state between ContentPane and OutlinePane | ✓ VERIFIED | `ReviewerV2Shell.tsx` holds `mainRef`, `sections`, `activeId` state; passes `onSectionsFound={setSections}` to `ContentPane`; passes `sections`, `activeId`, `mainRef`, `onActiveIdChange={setActiveId}` to `OutlinePane` |

**Score:** 4/5 roadmap success criteria verified (SC #4 FAILED; SC #2 and #3 need human runtime confirmation)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `ui/src/reviewer-v2/utils/markdownRenderer.ts` | heading renderer with slugified id injection + exported slugify/extractRawText | ✓ VERIFIED | Exports `slugify`, `extractRawText`, `renderMarkdown`; heading renderer injects `id="${slug}"` on h1–h6; `headingSlugCounts` resets per call; duplicate suffix logic confirmed |
| `ui/src/reviewer-v2/utils/markdownRenderer.test.ts` | TDD test suite covering slug function and heading id injection | ✓ VERIFIED | 14 tests (6 pre-existing + 8 new); covers `slugify`, `extractRawText`, id injection, duplicate suffix, cross-call counter reset, bold-in-heading |
| `ui/src/reviewer-v2/types.ts` | Section interface with id, text, depth fields | ✓ VERIFIED | `export interface Section { id: string; text: string; depth: number }` present after `AnnotationAction` export |
| `ui/src/reviewer-v2/ContentPane.tsx` | onSectionsFound callback prop + heading walk useEffect | ✓ VERIFIED | Optional `onSectionsFound` prop with default `= {}`; `useEffect([planHtml, onSectionsFound])` with `querySelectorAll('h1,h2,h3,h4,h5,h6')` walk and `Section[]` mapping |
| `ui/src/reviewer-v2/ContentPane.test.ts` | source-read tests for onSectionsFound wiring | ✓ VERIFIED | 14 tests (8 existing + 6 new source-read assertions); asserts `onSectionsFound`, `querySelectorAll`, `Section`, `h1,h2,h3,h4,h5,h6`, `el.textContent`, `parseInt(el.tagName` |
| `ui/src/reviewer-v2/OutlinePane.tsx` | Left-column outline with click-to-scroll and active tracking | ✓ VERIFIED | `<nav aria-label="Document outline">`, `<button>` items, `IntersectionObserver`, depth `paddingLeft`, `scrollIntoView` (both `block:start` and `block:nearest`), `aria-current` |
| `ui/src/reviewer-v2/OutlinePane.test.ts` | Source-read and pure-function tests | ✓ VERIFIED | 10 source-read assertions covering all OUTLINE-01/02/03 behavioral contracts |
| `ui/src/reviewer-v2/ReviewerV2Shell.tsx` | Wired Shell with mainRef, sections state, activeId state, and OutlinePane | ✓ VERIFIED | `mainRef`, `sections`, `activeId`; `<OutlinePane>` in left `<aside>`; `<ContentPane onSectionsFound={setSections} />`; `ref={mainRef}` on `<main>` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ReviewerV2Shell.tsx` | `OutlinePane.tsx` | `<OutlinePane sections={sections} activeId={activeId} mainRef={mainRef} onActiveIdChange={setActiveId} />` | ✓ WIRED | Line 50–55 in Shell; all four required props present |
| `ReviewerV2Shell.tsx` | `ContentPane.tsx` | `onSectionsFound={setSections}` | ✓ WIRED | Line 69 in Shell: `<ContentPane onSectionsFound={setSections} />` |
| `OutlinePane.tsx` | DOM heading elements in `<main>` | `IntersectionObserver` with `root: mainRef.current` | ✓ WIRED | `IntersectionObserver` created with `root: mainRef.current`; observes `document.getElementById(id)` for each section |
| `markdownRenderer.ts` | DOM heading elements | `id="${slug}"` attribute in rendered HTML | ✓ WIRED | `return \`<h${depth} id="${id}">${innerHTML}</h${depth}>\n\`` |
| `ContentPane.tsx` | `ReviewerV2Shell.tsx` | `onSectionsFound(sections)` callback | ✓ WIRED | `useEffect([planHtml, onSectionsFound])` calls `onSectionsFound(sections)` after DOM walk |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `OutlinePane.tsx` | `sections` | `ReviewerV2Shell.tsx` state `setSections` via `ContentPane` heading walk | Yes — `querySelectorAll` on real DOM after `/api/plan` fetch | ✓ FLOWING |
| `OutlinePane.tsx` | `activeId` | `ReviewerV2Shell.tsx` state `setActiveId` via `IntersectionObserver` callback | Yes — set on actual scroll events | ✓ FLOWING |
| `ContentPane.tsx` | `planHtml` | `/api/plan` HTTP fetch → `renderMarkdown()` | Yes — real HTTP endpoint | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — interactive browser behavior (IntersectionObserver, scrollIntoView, user scroll events) cannot be tested without a running server and browser. Static code structure is verified; behavioral runtime checks escalated to human verification.

### Probe Execution

No probes declared or found for this phase.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| OUTLINE-01 | 19-01, 19-02, 19-03 | Outline panel shows heading hierarchy as tree with depth indentation | ✓ SATISFIED | `paddingLeft: 16 + (section.depth - 1) * 8` in `OutlinePane.tsx`; sections built from `querySelectorAll('h1,h2,h3,h4,h5,h6')`; id injection in `renderMarkdown` |
| OUTLINE-02 | 19-01, 19-03 | Clicking outline item scrolls heading via `scrollIntoView` — no browser history change | ✓ SATISFIED (code) | `scrollIntoView({ behavior: 'smooth', block: 'start' })`; no `window.location`/`history.push`; `<button>` not `<a href=>` |
| OUTLINE-03 | 19-03 | Active section tracking via IntersectionObserver; active item highlighted and auto-scrolled in outline | ✓ SATISFIED (code) | `IntersectionObserver` with `root: mainRef.current`; `onActiveIdChange(entry.target.id)`; auto-scroll on `activeId` dep; `aria-current` marker |
| OUTLINE-04 | 19-03 (claimed per REQUIREMENTS.md traceability) | Each outline item displays per-section comment count badge | ✗ BLOCKED | No badge UI, no `sectionId` on `Annotation`, no count logic anywhere in codebase. Discussion log records user decision to defer to Phase 21, but ROADMAP.md Phase 21 Requirements field does not include OUTLINE-04 — the deferral is orphaned. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ui/src/reviewer-v2/hooks/useTextSelection.ts` | 138 | `'_e' is defined but never used` | ⚠️ Warning (pre-existing) | Pre-existing before Phase 19; not introduced by this phase |
| `ui/src/reviewer-v2/hooks/useTextSelection.test.ts` | 128 | `no-regex-spaces` | ⚠️ Warning (pre-existing) | Pre-existing before Phase 19; not introduced by this phase |

Pre-existing lint errors in `useTextSelection.ts` and `useTextSelection.test.ts` are documented in all three SUMMARYs as out-of-scope. No new errors were introduced by Phase 19 files. TypeScript compilation exits clean (`npx tsc -b --noEmit`: 0 errors).

### Human Verification Required

#### 1. Full Outline Interaction Flow

**Test:** Start dev server (`cd ui && npm run dev` with backend running, open http://localhost:5173/v2), load a plan with multiple heading levels.

**Expected:**
- Left column shows all headings as an indented list — H2 items have 8px more left-padding than H1; H3 has 8px more than H2; etc.
- Clicking any outline item smooth-scrolls the center pane to that heading. Browser URL does NOT change (no `#id` appended).
- Scrolling the center pane highlights the heading closest to the viewport top with: left blue border (`var(--color-focus)`), accent text color, bold font weight, surface background.
- The highlighted outline item scrolls into view in the outline panel if it was off-screen.
- Hovering a non-active item shows a subtle background change (`rgba(255,255,255,0.04)`).

**Why human:** IntersectionObserver behavior, smooth-scroll timing, visual active state (CSS custom properties), and URL-non-change can only be confirmed in a real browser environment.

### Gaps Summary

One gap blocks phase goal achievement: **OUTLINE-04 (comment count badges) is entirely absent.**

ROADMAP.md Phase 19 Success Criterion #4 states: "Each outline item shows a badge with the count of comments anchored within that section; a section with no comments shows no badge or shows zero; adding a comment in the content pane updates its section's count immediately."

No part of this criterion is implemented:
- `OutlinePane.tsx` has no badge element
- `ReviewerV2Shell.tsx` passes no count data to `OutlinePane`
- `Annotation` type has no `sectionId` field

The discussion log (19-DISCUSSION-LOG.md) records the user explicitly deferring OUTLINE-04 to Phase 21. However, ROADMAP.md Phase 21's Requirements field lists only `COMMENT-04, COMMENT-05` — OUTLINE-04 is not reassigned. The traceability table in REQUIREMENTS.md still maps OUTLINE-04 to Phase 19.

**To close this gap, one of the following must happen:**
1. Implement OUTLINE-04 (comment count badges) in Phase 19
2. Update ROADMAP.md to move OUTLINE-04 to Phase 21's Requirements field, AND update REQUIREMENTS.md traceability table accordingly, then add it to Phase 21's success criteria

---

_Verified: 2026-05-20T18:12:00Z_
_Verifier: Claude (gsd-verifier)_
