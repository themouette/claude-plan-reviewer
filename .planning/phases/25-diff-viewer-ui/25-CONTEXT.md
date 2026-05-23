# Phase 25: Diff Viewer UI - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 25 delivers a new `/code-review` route that renders the full branch diff: a file list on the left and a diff pane on the right. The diff pane supports unified/side-by-side toggle (DIFF-03), file list navigation (DIFF-04), and expandable context lines (DIFF-02). The full branch diff vs main is displayed by default (DIFF-01). The old unused `/api/diff` endpoint and its associated state are removed (ARCH-01).

Phase 25 also adds a `?context=N` query parameter to the existing backend endpoints (`/api/diff/branch` and `/api/diff/commit/:sha`) to support the "Expand All" feature.

Not in scope: commit navigation (Phase 26), inline comments (Phase 27), review submission (Phase 28), integration wiring (Phase 29).

</domain>

<decisions>
## Implementation Decisions

### Routing

- **D-01:** Route detection via pathname check in `main.tsx` — no router library. `window.location.pathname.startsWith('/code-review')` renders `<CodeReviewApp />`, otherwise renders `<ReviewerV2 />`. The Rust SPA fallback already serves `index.html` for all paths, so no server changes needed.
- **D-02:** The two views are fully standalone — no navigation links between them. `ReviewerV2` (plan annotation) and `CodeReviewApp` (diff viewer) are separate component trees with no shared state or routing between them.
- **D-03:** A shared `AppToolbar` shell component is introduced in Phase 25 with slots for: title (left), layout toggle (center-right), and reserved slots for help/GitHub link/theme switcher (deferred). Both `ReviewerV2Shell` and `CodeReviewApp` use `AppToolbar` for the header strip. The help, GitHub link, and theme switcher slots are empty stubs in Phase 25.

### Context Line Expansion (DIFF-02)

- **D-04:** Per-hunk expansion is the primary interaction — clicking the `...` separator between hunks expands that gap using `@pierre/diffs` native hunk expansion (`expansionLineCount` in `BaseDiffOptions`). This is library-native and requires no backend call.
- **D-05:** An "Expand All" button re-fetches the diff from `/api/diff/branch?context=999`. This returns a patch with effectively all context lines, replacing the current diff entirely. The button is a simple toggle: collapsed view (default, 3 context lines) vs fully-expanded view (context=999). Phase 25 adds the `context` query parameter to both `/api/diff/branch` and `/api/diff/commit/:sha` on the Rust backend.
- **D-06:** Default context lines for the initial fetch: whatever git2's default is (3). No custom `collapsedContextThreshold` override needed on the frontend.

### File List (DIFF-04)

- **D-07:** Each file entry shows: status icon (colored dot — green added, red deleted, blue modified, neutral renamed) + **basename only** (not full relative path) + `+N -M` change counts. Full relative path appears on hover tooltip.
- **D-08:** Renamed files show the new name with a rename icon (↳). The full `old → new` path mapping appears on hover tooltip.
- **D-09:** Clicking a file entry scrolls the diff pane to that file's diff section (smooth scroll or `scrollIntoView`). The active file in the list is highlighted.

### @pierre/diffs Integration

- **D-10:** Use `PatchDiff` component per file — it accepts the raw `patch` string directly from the API response (`FileDiff.patch` field). This matches the API shape from Phase 24 (GitHub-format `patch` strings).
- **D-11:** Worker pool disabled — `disableWorkerPool={true}` on every `PatchDiff`. No `WorkerPoolContext` needed. Appropriate for a local single-user tool with agent-generated diffs (typically small).
- **D-12:** Syntax highlighting theme: `github-light` or `github-dark` based on OS preference, read once on page load. Implementation: `const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches; const theme = isDark ? 'github-dark' : 'github-light'`. No runtime listener — requires page reload if OS theme changes.
- **D-13:** Unified/side-by-side toggle (DIFF-03) is implemented via `diffStyle: 'unified' | 'split'` in the `options` prop passed to each `PatchDiff`. A toggle button in the `AppToolbar` (or diff pane header) switches the value, and all file diffs re-render with the new style.

### ARCH-01 Cleanup

- **D-14:** Remove `GET /api/diff` from `src/plan_review.rs` — the `get_diff` handler, the `AppState.diff_content` field, and all callsites passing `diff_content` into `AppState`. The `extract_diff()` function in `main.rs` itself can be removed too (it was only used to populate `diff_content`). Verify nothing else depends on `/api/diff` before removing.

### Claude's Discretion

- Exact layout proportions for the two-column code-review view (file list width vs diff pane width — likely 220–280px sidebar similar to ReviewerV2's outline pane)
- Empty state when the branch has no diff (e.g., "No changes on this branch" message)
- Loading state while `useDiff` fetches (spinner or skeleton)
- Error state when the backend returns an error or the repo has no base branch
- Exact `expansionLineCount` value for per-hunk expansion (e.g., 10 or 20 lines per click)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and Roadmap
- `.planning/REQUIREMENTS.md` — Phase 25 covers: DIFF-01, DIFF-02, DIFF-03, DIFF-04, ARCH-01
- `.planning/ROADMAP.md` Phase 25 — Goal, success criteria (5 items), plan breakdown (25-01, 25-02, 25-03)

### Architecture Constraints
- `.planning/PROJECT.md` — Key Decisions table; React 19 + TypeScript + Vite tech stack; single-binary constraint
- `.planning/STATE.md` — Accumulated decisions from prior milestones

### Prior Phase Context (read before planning)
- `.planning/phases/24-backend-diff-api/24-CONTEXT.md` — JSON schema decisions (D-01–D-03): `FileDiff[]` with GitHub-format fields (`filename`, `previous_filename`, `status`, `additions`, `deletions`, `changes`, `patch`). The `patch` field is a raw unified diff string — this is what `PatchDiff` consumes.

### Existing Code to Understand Before Planning
- `ui/src/reviewer-v2/ReviewerV2Shell.tsx` — Current shell pattern (3-column layout, header strip at 48px, `flex-col h-screen`). `AppToolbar` should follow the same header-strip approach.
- `ui/src/reviewer-v2/types.ts` — Existing type patterns; new code-review types go in a parallel `ui/src/code-review/types.ts`
- `ui/src/main.tsx` — Current entry point (renders `ReviewerV2` directly); Phase 25 adds the pathname check here
- `src/plan_review.rs` — Contains the `get_diff` handler and `AppState.diff_content` field that ARCH-01 removes
- `src/diff_api.rs` — Existing diff endpoints from Phase 24; Phase 25 adds `?context=N` param here
- `ui/package.json` — `@pierre/diffs` already installed at `^1.1.12`; no new diff library needed

### @pierre/diffs API Reference
- `ui/node_modules/@pierre/diffs/dist/react/PatchDiff.d.ts` — `PatchDiff` props: `patch: string`, `options?: FileDiffOptions`, `disableWorkerPool?: boolean`
- `ui/node_modules/@pierre/diffs/dist/types.d.ts` — `BaseDiffOptions`: `diffStyle?: 'unified' | 'split'`, `expansionLineCount?: number`, `collapsedContextThreshold?: number`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ReviewerV2Shell.tsx` header strip pattern — 48px fixed-height header with `flexShrink: 0`, `borderBottom`, flex row. `AppToolbar` should copy this structure.
- `ui/src/reviewer-v2/hooks/` — Hook pattern (`useSectionAnnotationCounts`, `useHeartbeat`): custom hooks exported from a `hooks/` subdirectory. New `useDiff` hook should follow the same pattern under `ui/src/code-review/hooks/useDiff.ts`.
- `ui/src/reviewer-v2/connectivity.ts` — `ConnectivityStatus` as a standalone type (not folded into AppState). Phase 25 reuses `useHeartbeat` unchanged — connectivity is already solved.
- CSS variables (`--color-surface`, `--color-border`, `--color-bg`, `--color-text-secondary`) used throughout ReviewerV2 — use the same tokens in all new code-review components.

### Established Patterns
- **ESLint no-restricted-imports**: New code-review components go under `ui/src/code-review/`. They MUST NOT import from `ui/src/reviewer-v2/` (coupling direction is enforced). Shared utilities (if any emerge) go in `ui/src/shared/`.
- **TDD first**: Per CLAUDE.md test coverage requirements and Phase 24's pattern — the 25-01 plan is TDD (types + hook + components). Tests must exist before business logic is complete.
- **`State<Arc<T>>`** pattern in Rust handlers — new `?context=N` param in diff_api handlers follows the same `State` extraction pattern as existing handlers.
- **Vitest + jsdom** for frontend tests; `tempfile` + `git2::Repository::init` fixtures for Rust integration tests.

### Integration Points
- `ui/src/main.tsx` — pathname check added here to switch between `ReviewerV2` and `CodeReviewApp`
- `src/diff_api.rs` — `GET /api/diff/branch` and `GET /api/diff/commit/:sha` get a new optional `?context: Option<u32>` query param; default to 3 (git default) when absent
- `src/plan_review.rs` — `get_diff` handler + `AppState.diff_content` field removed (ARCH-01)
- `src/main.rs` — `extract_diff()` call and `diff_content` arg to `start_server()` removed (ARCH-01 cleanup)

</code_context>

<specifics>
## Specific Ideas

- The `PatchDiff` component from `@pierre/diffs` consumes a raw unified diff string directly — it matches the `FileDiff.patch` field returned by the Phase 24 API without transformation. No diff parsing library needed beyond `@pierre/diffs`.
- "Expand All" is a two-state toggle: default fetch (no `?context` param → git's 3-line context) vs expanded fetch (`?context=999`). The `useDiff` hook tracks which mode is active and re-fetches accordingly.
- The OS theme detection pattern: `const theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'github-dark' : 'github-light'` — read once in the hook or at component initialization, passed as `options={{ theme }}` to every `PatchDiff`.

</specifics>

<deferred>
## Deferred Ideas

- **Help icon, GitHub project link, theme switcher** in `AppToolbar` — slots reserved but empty in Phase 25; deferred to a future UX phase
- **Worker pool for @pierre/diffs** — `disableWorkerPool=true` for Phase 25; upgrade to `WorkerPoolContext` if large-diff performance becomes an issue in a future phase
- **Dynamic theme switching** (respond to OS theme changes at runtime) — requires a `matchMedia` event listener; deferred since single page-load read is sufficient for now
- **Navigation between ReviewerV2 and CodeReview** — the two views are deliberately standalone with no link between them; deferred (no user story for this in v0.7.0)

</deferred>

---

*Phase: 25-Diff Viewer UI*
*Context gathered: 2026-05-23*
