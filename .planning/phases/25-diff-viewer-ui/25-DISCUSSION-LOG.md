# Phase 25: Diff Viewer UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 25-diff-viewer-ui
**Areas discussed:** Routing mechanism, Context expansion UX, File list info density, @pierre/diffs worker + theme setup

---

## Routing Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Pathname check (no lib) | `window.location.pathname.startsWith('/code-review')` in main.tsx. Zero new dependencies. Rust SPA fallback already handles all paths. | ✓ |
| react-router-dom | Standard SPA router, ~7KB, enables nested routes for future phases | |
| Hash-based (#/code-review) | `window.location.hash` check, zero deps, ugly URLs | |

**User's choice:** Pathname check (no library)
**Notes:** Cleanest option for the current single-split use case.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone — own header/layout | CodeReviewApp is entirely separate, different header | ✓ (with addition) |
| Shared shell, different content | Common AppShell wraps both views | |

**User's choice:** Standalone — but with a common `AppToolbar` component that both views use, with reserved slots for help, GitHub project link, and theme switcher (deferred).
**Notes:** User wants a shared toolbar architecture even though the views don't link to each other — future features (help, theme) should land in one place.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full toolbar in Phase 25 | Build complete AppToolbar with help, GitHub link, theme switcher now | |
| Placeholder for Phase 25, refactor later | Phase 25 builds its own header; toolbar extracted later | |
| Common toolbar shell, help/theme deferred | AppToolbar wrapper with title + layout toggle; help/theme as empty stubs | ✓ |

**User's choice:** Common toolbar shell — build the structure now, defer the content.

---

## Context Expansion UX (DIFF-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-hunk expand only | Click `...` to expand that gap; library-native via expansionLineCount | ✓ (combined) |
| Expand all button only | Single button sets expandUnchanged: true; all-or-nothing | |
| Both: per-hunk + expand all | Per-hunk AND a global expand button | ✓ (combined) |

**User's choice:** Both — per-hunk AND Expand All button
**Notes:** User asked "how would the expand all be done?" before deciding. Claude explained that `PatchDiff` only has patch text, so "expand all" requires a backend re-fetch with `?context=999`, not a pure frontend option. User confirmed: per-hunk expansion (library-native) + Expand All button re-fetches with `?context=999`.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed large number (context=999) | Effectively shows all context; simple toggle | ✓ |
| You decide | Let implementer pick sensible default | |

**User's choice:** Fixed large number — `?context=999`

---

## File List Info Density (DIFF-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Status icon + basename + +N/-M stats | GitHub-style: colored dot, filename only, change counts. Full path on hover. | ✓ |
| Full relative path + status + stats | Full path instead of basename | |
| Basename + comment count badge only | Minimal: filename + comment badge, status via colored border | |

**User's choice:** Status icon + basename + +N/-M stats (GitHub-style)

---

| Option | Description | Selected |
|--------|-------------|----------|
| New name only (with rename icon) | New filename + ↳ icon; full old→new on hover | ✓ |
| old → new inline | Show 'OldName.tsx → NewName.tsx' inline | |

**User's choice:** New name only with rename icon (↳), full rename on hover tooltip.

---

## @pierre/diffs Worker + Theme Setup

| Option | Description | Selected |
|--------|-------------|----------|
| Main thread (disableWorkerPool=true) | Zero config, appropriate for small local diffs | ✓ |
| Web Worker pool | Non-blocking syntax highlighting; ~10 lines extra setup + Vite worker bundling | |

**User's choice:** Main thread — `disableWorkerPool={true}`
**Notes:** User asked "what is the extra setup?" before deciding. Claude explained: `WorkerPoolContext` provider, a worker bundle reference in Vite, and possible `optimizeDeps` tweaks. User confirmed main thread is appropriate for this use case.

---

| Option | Description | Selected |
|--------|-------------|----------|
| github-dark (matches existing highlight.js) | Single dark theme matching current app | |
| github-light + github-dark (auto system) | Two-theme: OS preference determines which | ✓ |
| You decide | Implementer picks | |

**User's choice:** github-light + github-dark based on OS `prefers-color-scheme`

---

| Option | Description | Selected |
|--------|-------------|----------|
| Once on page load (simpler) | Read OS preference once on mount; reload to change | ✓ |
| Dynamic (live update) | Subscribe to matchMedia change events; ~5 extra lines | |

**User's choice:** Once on page load — simpler, reload to change is acceptable.

---

## Claude's Discretion

- Layout proportions (file list sidebar width — likely 220–280px matching ReviewerV2's outline pane)
- Empty state design (no changes on branch)
- Loading and error state UI
- Exact `expansionLineCount` value for per-hunk expand (e.g., 10 or 20 lines per click)

## Deferred Ideas

- Help icon, GitHub project link, theme switcher in `AppToolbar` — slots reserved but empty in Phase 25
- Worker pool for @pierre/diffs — can upgrade later if large-diff performance becomes an issue
- Dynamic theme switching (runtime OS preference changes)
- Navigation links between ReviewerV2 and CodeReview views
