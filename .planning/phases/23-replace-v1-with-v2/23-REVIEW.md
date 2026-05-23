---
phase: 23-replace-v1-with-v2
reviewed: 2026-05-23T09:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - src/main.rs
  - ui/src/main.tsx
findings:
  critical: 0
  warning: 0
  info: 1
  total: 1
status: issues_found
---

# Phase 23: Code Review Report

**Reviewed:** 2026-05-23T09:00:00Z
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found (1 info item)

## Summary

Phase 23 replaces the v1/v2 routing split with a single v2-only entry point. The two
changed files are:

- `src/main.rs` line 719: URL changed from `http://127.0.0.1:{}/v2` to
  `http://127.0.0.1:{}/`
- `ui/src/main.tsx`: `isV2` conditional and `App` import removed; `ReviewerV2` rendered
  unconditionally

Both changes are correct:

- The axum server uses `FallbackBehavior::Ok`, which serves `index.html` for any path not
  matched by an `/api/*` route, including `/`. The root URL works exactly as `/v2` did.
- `App.tsx` was deleted in the same commit wave; the `import App` removal leaves no
  dangling import.
- A full grep over `src/` and `ui/src/` finds zero surviving references to `/v2` or `/v1`
  outside test files and the `reviewer-v2/` directory name.

The only finding is a set of stale prose comments in adjacent (unchanged) files that still
cite `App.tsx` line numbers — those are documentation rot introduced when `App.tsx` was the
reference implementation, not by this phase.

## Info

### IN-01: Stale `App.tsx` line-number references in comments

**Files:**
- `ui/src/reviewer-v2/SelectionToolbar.tsx:8` — `// matches App.tsx line 193`
- `ui/src/reviewer-v2/SelectionToolbar.tsx:38` — `// mirrors App.tsx lines 206-214`
- `ui/src/reviewer-v2/ContentPane.tsx:121` — `// unlike App.tsx's scroll-relative positioning`
- `ui/src/reviewer-v2/hooks/useTextSelection.ts:54` — `// Exported so callers (App.tsx) can re-create …`

**Issue:** `App.tsx` was deleted in commit `c98f58e`. These comments now reference a
non-existent file, making the cross-references misleading for future maintainers.

**Fix:** Remove or reword the references. For example:

```tsx
// SelectionToolbar.tsx:8
// Exact 6-label tuple from REQUIREMENTS.md COMMENT-04
export const QUICK_ACTIONS = [ … ] as const

// SelectionToolbar.tsx:38
// Close the expander when clicking outside it (standard outside-click pattern)

// ContentPane.tsx:121
// position: fixed toolbar — no scroll-offset adjustment needed

// useTextSelection.ts:54
// Exported so annotation consumers (e.g. ContentPane) can re-create Ranges on every render
```

---

_Reviewed: 2026-05-23T09:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
