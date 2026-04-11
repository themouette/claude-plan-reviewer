---
phase: 08-annotation-quick-actions-theme
fixed_at: 2026-04-11T00:00:00Z
review_path: .planning/phases/08-annotation-quick-actions-theme/08-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 8: Code Review Fix Report

**Fixed at:** 2026-04-11
**Source review:** .planning/phases/08-annotation-quick-actions-theme/08-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: Inline theme script applies unvalidated localStorage value to `data-theme`

**Files modified:** `ui/index.html`
**Commit:** baa53cb
**Applied fix:** Changed `if (!t)` to `if (t !== 'dark' && t !== 'light')` so that any unrecognized stored value (e.g. `'system'`, typo, future feature value) falls through to the system preference detection instead of being applied directly to `data-theme`.

### WR-02: `<details>` overflow dropdown never closes on outside click

**Files modified:** `ui/src/App.tsx`
**Commit:** 1982292
**Applied fix:** Added a `useEffect` inside `FloatingAnnotationAffordance` that attaches a `mousedown` listener to `document`. When the click target is outside `detailsRef.current`, the `open` property is set to `false`. The effect cleans up the listener on unmount.

### WR-03: `.plan-prose a` link color is hardcoded and fails contrast in light mode

**Files modified:** `ui/src/index.css`
**Commit:** 3611501
**Applied fix:** Added `--color-link: #60a5fa` to `:root` (dark mode default, unchanged visual), added `--color-link: #1d4ed8` to `[data-theme="light"]` (blue-700, ~6.5:1 contrast on #f8fafc, WCAG AA compliant), and updated `.plan-prose a` to use `color: var(--color-link)` instead of the hardcoded hex value.

### WR-04: ARIA role mismatch — `menuitem` children without a `menu` container

**Files modified:** `ui/src/App.tsx`
**Commit:** 534e004
**Applied fix:** Added `role="menu"` to the container `<div>` that wraps the overflow chip buttons. This satisfies the WAI-ARIA 1.2 ownership requirement that `menuitem` elements must be owned by a `menu` or `menubar` role.

---

_Fixed: 2026-04-11_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
