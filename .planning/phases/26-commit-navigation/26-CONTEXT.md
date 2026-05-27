# Phase 26: Commit Navigation - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 26 adds a commit navigation layer to the existing `CodeReviewApp`. A collapsible commit drawer (opened via AppToolbar button) lists all branch commits. Clicking a commit switches the diff pane to per-commit view (shows that commit's diff, with the commit sha + message as the diff pane title). Closing the drawer returns to the full-branch diff. Checkboxes on each commit independently filter which commits are included in the combined full-branch diff (DIFF-05). Keyboard left/right arrows navigate between commits while in per-commit mode (COMMIT-04).

Not in scope: inline comments (Phase 27), review submission (Phase 28), integration wiring (Phase 29).

</domain>

<decisions>
## Implementation Decisions

### Commit Panel Layout (D-01–D-04)

- **D-01:** The commit list is a **collapsible side drawer** that slides over the existing file list sidebar from the left. It overlays the file list rather than pushing it — no third column.
- **D-02:** The drawer toggle is an **AppToolbar button** in the existing header row, consistent with the unified/split toggle added in Phase 25.
- **D-03:** Drawer open/close is **snap/instant** — no CSS transition or animation. Matches the current zero-animation approach in the rest of the UI.
- **D-04:** The drawer is **280–320px wide** (slightly wider than the 240px file list sidebar) to give commit messages adequate room without truncation. Exact width is Claude's discretion within this range.

### Mode & Select Model (D-05–D-08)

- **D-05:** **Two separate gestures** — clicking a commit row switches to per-commit view (shows that commit's diff); checkboxes independently control which commits are included in the full-branch combined diff. The two interactions are orthogonal.
- **D-06:** In per-commit view, the diff pane title shows the **commit sha + message** (e.g., `abc1234 — Fix login bug`). No separate mode badge or toolbar indicator.
- **D-07:** Returning to full-branch view is triggered by **closing the commit drawer** via the AppToolbar button. No separate "Full diff" button needed.
- **D-08:** Default checkbox state when the drawer first opens: **all checked** (opt-out model). The user unchecks commits to exclude them from the combined diff.

### Keyboard Navigation (D-09–D-10)

- **D-09:** Arrow key navigation is active **only when in per-commit mode** (a commit has been clicked). In full-branch view, arrow keys do nothing special — no conflict with diff pane scrolling.
- **D-10:** **Left arrow = previous commit, Right arrow = next commit.** Only left/right; up/down arrows are not wired to commit navigation (they already control diff pane scroll).

### State Ownership (D-11–D-13)

- **D-11:** All commit-related state lives in **`CodeReviewApp`**: `drawerOpen: boolean`, `viewMode: 'branch' | 'commit'`, `activeCommitSha: string | null`, `checkedCommitShas: string[]`. Props flow down to `CommitDrawer` and `DiffPane`. Consistent with how `activeIndex` and `diffStyle` are owned today.
- **D-12:** `useCommits` follows the **same injectable doFetch pattern as `useDiff`**: exports `fetchCommitsOnce(doFetch)` as a pure testable function plus `useCommits()` hook with `cancelledRef` for unmount safety. Tests call `fetchCommitsOnce` directly without a React renderer.
- **D-13:** When the user is in per-commit view and unchecks a commit in the drawer, **nothing immediate happens** — unchecking only affects full-branch mode. The two gestures are fully independent; the per-commit diff pane continues showing whichever commit was clicked regardless of checkbox state.

### Claude's Discretion

- Exact drawer width within the 280–320px range
- Commit row layout (short_sha chip + truncated message + author + date — exact column widths and truncation)
- Empty state when no commits are found or the branch has no commits beyond base
- What happens at boundary: navigating past the first/last commit with arrow keys (wrap vs stop)
- Loading state for the commit list (spinner or skeleton)
- How `checkedCommitShas` is passed to the diff fetch — whether the backend receives a `?shas=...` param or the frontend filters client-side (the backend already serves `FileDiff[]` per commit, so client-side union is feasible)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and Roadmap
- `.planning/REQUIREMENTS.md` — Phase 26 covers: COMMIT-01, COMMIT-02, COMMIT-03, COMMIT-04, DIFF-05
- `.planning/ROADMAP.md` Phase 26 — Goal, success criteria (5 items), plan breakdown (26-01, 26-02)

### Architecture Constraints
- `.planning/PROJECT.md` — Key Decisions table; React 19 + TypeScript + Vite tech stack; single-binary constraint
- `.planning/STATE.md` — Accumulated decisions from prior milestones

### Prior Phase Context (read before planning)
- `.planning/phases/25-diff-viewer-ui/25-CONTEXT.md` — D-01–D-14: routing pattern, @pierre/diffs `PatchDiff` usage, `diffStyle` via options prop, ESLint import direction, AppToolbar header strip pattern, CSS variable tokens
- `.planning/phases/24-backend-diff-api/24-CONTEXT.md` — D-01–D-03: FileDiff JSON schema, Commit struct fields, API endpoint shapes

### Existing Code to Understand Before Planning
- `ui/src/code-review/CodeReviewApp.tsx` — Current shell: two-column layout, state ownership pattern (diffStyle, contextExpanded, activeIndex), AppToolbar usage
- `ui/src/code-review/AppToolbar.tsx` — Existing toolbar with unified/split toggle + expand-all; Phase 26 adds a "commits" toggle button here
- `ui/src/code-review/hooks/useDiff.ts` — Injectable doFetch pattern + cancelledRef that useCommits must mirror exactly
- `ui/src/code-review/types.ts` — Existing FileDiff interface; Phase 26 adds a Commit interface here (mirrors Rust struct)
- `src/diff_api.rs` — `Commit` struct (sha, short_sha, message, author, email, date), `CommitList` (commits[], truncated), `GET /api/commits`, `GET /api/diff/commit/{sha}` — all already exist from Phase 24

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useDiff` hook pattern (`fetchDiffOnce` + `useDiff`) — `useCommits` should be a structural copy: `fetchCommitsOnce(doFetch)` pure function + `useCommits()` hook with cancelledRef. Tests call the pure function directly.
- `AppToolbar.tsx` — Already accepts toggle props (`diffStyle`, `contextExpanded`); add `commitsOpen: boolean` + `onCommitsToggle` to the same props interface.
- CSS variable tokens (`--color-surface`, `--color-border`, `--color-bg`, `--color-text-secondary`) — use in CommitDrawer and commit row components.
- `@pierre/diffs` `PatchDiff` component — used for per-commit diff rendering exactly as in full-branch view; same `disableWorkerPool={true}`, same `diffStyle` prop, same `FileDiff.patch` field.

### Established Patterns
- **ESLint no-restricted-imports**: All new Phase 26 components go under `ui/src/code-review/`. They MUST NOT import from `ui/src/reviewer-v2/`.
- **TDD first** (CLAUDE.md): 26-01 plan should be TDD — types + hook tested before component code.
- **`State<Arc<T>>`** in Rust handlers — no new backend routes needed in Phase 26; existing `/api/commits` and `/api/diff/commit/{sha}` from Phase 24 are sufficient.
- **Vitest + jsdom** for frontend tests; test `fetchCommitsOnce` directly with a fake `doFetch` (no renderer needed).

### Integration Points
- `ui/src/code-review/CodeReviewApp.tsx` — owns all new state; adds CommitDrawer component alongside FileListPane
- `ui/src/code-review/AppToolbar.tsx` — receives `commitsOpen` prop + `onCommitsToggle` handler
- `ui/src/code-review/DiffPane.tsx` — receives `viewMode` + `activeCommitSha`; when `viewMode === 'commit'`, fetches `/api/diff/commit/{sha}` instead of the branch diff
- No Rust backend changes needed — Phase 24 already shipped `/api/commits` and `/api/diff/commit/{sha}`

</code_context>

<specifics>
## Specific Ideas

- Per-commit view indicator: the diff pane title shows `{short_sha} — {commit message}` (not a badge in the toolbar). The title slot in `DiffPane` or a header above the file-diffs list is the right place.
- The checkbox-based combined diff filtering (DIFF-05): when `checkedCommitShas` is a subset of all commits, the full-branch diff is rebuilt by unioning the `FileDiff[]` from each checked commit via `/api/diff/commit/{sha}` calls. This is client-side union — no new backend query param needed.
- Keyboard handler: a `useEffect` on `CodeReviewApp` that listens to `window` `keydown`; only fires commit navigation logic when `viewMode === 'commit'`.

</specifics>

<deferred>
## Deferred Ideas

- **Theme switcher, help icon, GitHub link** in AppToolbar — slots still reserved from Phase 25, still deferred
- **Worker pool for @pierre/diffs** — `disableWorkerPool=true` remains; deferred
- **Animation/transition for commit drawer** — snap/instant chosen for Phase 26; smooth slide-in deferred to a future UX polish phase

</deferred>

---

*Phase: 26-Commit Navigation*
*Context gathered: 2026-05-24*
