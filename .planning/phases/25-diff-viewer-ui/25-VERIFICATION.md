---
phase: 25-diff-viewer-ui
verified: 2026-05-24T10:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Navigate to /code-review in a running browser session and confirm the full diff viewer renders"
    expected: "File list on the left (240px sidebar with status dots, basenames, change counts), diff pane on the right showing PatchDiff output per file"
    why_human: "UI rendering, layout proportions, and visual correctness of PatchDiff cannot be verified programmatically via grep"
  - test: "Toggle between Unified and Side-by-side layouts using the AppToolbar buttons"
    expected: "PatchDiff instantly re-renders in the chosen layout with no network request"
    why_human: "Real-time layout switch behavior requires a live browser"
  - test: "Click a file in the file list and verify the diff pane scrolls to that file"
    expected: "Smooth scroll to the file anchor, active file highlighted in the list with left blue border"
    why_human: "scrollIntoView behavior and active-state visual feedback require a running browser"
  - test: "Click a '...' context separator in the diff pane to expand 20 more context lines"
    expected: "20 additional lines of surrounding context appear (native @pierre/diffs expansionLineCount: 20 behavior)"
    why_human: "@pierre/diffs PatchDiff UI interaction cannot be verified statically"
  - test: "Click 'Expand All', observe Loading... label, then verify diff shows full context; click 'Collapse' to revert"
    expected: "Button label cycles Expand All → Loading... → Collapse; diffs re-fetch with ?context=999 then default"
    why_human: "Network re-fetch and label transition sequence require live execution"
---

# Phase 25: Diff Viewer UI Verification Report

**Phase Goal:** A new `/code-review` route renders the full branch diff with a file list, unified/side-by-side toggle, and expandable context lines; the existing unused diff tab is removed
**Verified:** 2026-05-24T10:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Navigating to `/code-review` renders a file list on the left and a diff pane on the right | VERIFIED | `ui/src/main.tsx` line 7 branches on `pathname.startsWith('/code-review')` → renders `<CodeReviewApp />`; `CodeReviewApp.tsx` composes `<FileListPane>` (aside, 240px) + `<DiffPane>` (flex:1) |
| 2 | Toggling between unified and side-by-side layouts works without reloading | VERIFIED | `AppToolbar.tsx` renders Unified/Side-by-side buttons calling `onDiffStyleChange`; `CodeReviewApp.tsx` holds `diffStyle` state and passes it to `DiffPane`; `DiffPane` passes `diffStyle` into `PatchDiff options` — no fetch on toggle |
| 3 | Clicking a file in the file list jumps to that file in the diff pane | VERIFIED | `FileListPane.tsx` click handler calls `document.getElementById('file-${index}')?.scrollIntoView(...)` and `onActiveIndexChange(index)` synchronously; `DiffPane.tsx` renders `<div id={\`file-${index}\`}>` anchor before each file |
| 4 | Collapsed context lines (`...`) expand when clicked to reveal surrounding lines | VERIFIED | `DiffPane.tsx` passes `expansionLineCount: 20` in PatchDiff options — native @pierre/diffs per-hunk expansion; `Expand All` wires `refetch(999)` to fetch full context via the `?context=N` backend param |
| 5 | The existing (unused) diff tab and its code are removed — no dead DiffView or TabBar code remains | VERIFIED | `grep -rn "DiffView\|TabBar" ui/src/ src/` returns no matches; `src/plan_review.rs` AppState has 4 fields only (no `diff_content`); `start_server` has 4 params; `extract_diff` function and its 4 tests are gone from `main.rs`; no `/api/diff"` route in `plan_review.rs` |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `ui/src/code-review/types.ts` | FileDiff interface mirroring Rust struct | VERIFIED | Exists; exports `FileDiff` with all 7 fields (snake_case, `previous_filename?` optional) |
| `ui/src/code-review/hooks/useDiff.ts` | useDiff hook + fetchDiffOnce pure function | VERIFIED | Exports `useDiff`, `fetchDiffOnce`, `DoFetch`, `FetchDiffResult`, `UseDiffResult`; uses `!== undefined` for contextLines=0 handling |
| `ui/src/code-review/hooks/useDiff.test.ts` | 6 Vitest tests for fetchDiffOnce | VERIFIED | 6 tests pass (`npm test -- --run useDiff` → 6 passed) |
| `ui/eslint.config.js` | no-restricted-imports for code-review/ blocking reviewer-v2/ | VERIFIED | Lines 42-54: `files: ['src/code-review/**']`, patterns block `../reviewer-v2/**` and `*/reviewer-v2/**` |
| `src/diff_api.rs` | DiffContextQuery + ?context=N wired to both diff endpoints | VERIFIED | `DiffContextQuery` at line 42; `get_diff_branch` (line 201) and `get_diff_commit` (line 285) both accept `Query(params): Query<DiffContextQuery>`; `opts.context_lines(context_lines)` applied in both handlers |
| `ui/src/code-review/AppToolbar.tsx` | AppToolbar with Unified/Side-by-side + Expand All/Collapse/Loading | VERIFIED | 48px header, all 5 props, correct labels, `disabled={contextLoading}`, focus rings via onFocus/onBlur |
| `ui/src/code-review/FileListPane.tsx` | FileListPane with status dots, basename, IntersectionObserver | VERIFIED | IntersectionObserver with `rootMargin: '-10px 0px -85% 0px'`, click calls both scrollIntoView + onActiveIndexChange, status dot colors match spec, rename ↳ icon present |
| `ui/src/code-review/DiffPane.tsx` | DiffPane with PatchDiff per file + loading/empty/error/binary states | VERIFIED | Imports PatchDiff from `@pierre/diffs/react`, `disableWorkerPool={true}`, `expansionLineCount: 20`, binary file guard at `file.patch === '[binary file]'`, all 4 states present |
| `ui/src/code-review/CodeReviewApp.tsx` | CodeReviewApp composing all three components | VERIFIED | Exports `CodeReviewApp`; wires `useDiff()`, `handleExpandAll` with `refetch(999)` / `refetch()`, `handleReload` with `refetch(contextExpanded ? 999 : undefined)`, 240px sidebar |
| `ui/src/main.tsx` | Pathname routing dispatching /code-review | VERIFIED | `isCodeReview = window.location.pathname.startsWith('/code-review')`; renders `{isCodeReview ? <CodeReviewApp /> : <ReviewerV2 />}` inside `<StrictMode>` |
| `src/plan_review.rs` | AppState without diff_content; /api/diff route removed | VERIFIED | AppState: 4 fields only; no `get_diff` handler; no `/api/diff"` route in router |
| `src/server.rs` | start_server with 4 params (no diff_content) | VERIFIED | Signature: `start_server(plan_md, approve_label, deny_label, port)` |
| `src/main.rs` | extract_diff removed; async_main 5 params | VERIFIED | `grep extract_diff src/main.rs` returns no matches; `async_main` has 5 params |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ui/src/main.tsx` | CodeReviewApp | `pathname.startsWith('/code-review')` | WIRED | Line 7 + line 11 of main.tsx |
| `ui/src/code-review/CodeReviewApp.tsx` | AppToolbar + FileListPane + DiffPane + useDiff | JSX composition + hook destructure | WIRED | All four imports present; diffPaneRef passed to both FileListPane and DiffPane |
| `ui/src/code-review/DiffPane.tsx` | `@pierre/diffs` PatchDiff | `import { PatchDiff } from '@pierre/diffs/react'` | WIRED | Line 2 of DiffPane.tsx; `disableWorkerPool={true}`, options with diffStyle/expansionLineCount/theme |
| `ui/src/code-review/FileListPane.tsx` | diff pane anchors | `document.getElementById('file-${index}')?.scrollIntoView` | WIRED | Line 98-100; click handler calls scrollIntoView |
| `ui/src/code-review/FileListPane.tsx` | IntersectionObserver | rootMargin `-10px 0px -85% 0px` | WIRED | Lines 22-44; disconnects on cleanup |
| `src/diff_api.rs get_diff_branch` | `try_branch_diff(repo_path, context_lines)` | `DiffOptions::context_lines(u32)` | WIRED | Lines 201-204; `opts.context_lines(context_lines)` at line 220 |
| `ui/eslint.config.js` | `src/code-review/**` files | no-restricted-imports rule | WIRED | Lines 42-54; patterns block reviewer-v2 imports |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `CodeReviewApp.tsx` | `files` from `useDiff()` | `useDiff` hook → `fetchDiffOnce` → `GET /api/diff/branch` | Yes — `diff_api.rs` calls `try_branch_diff` which uses `git2::Repository` to compute diffs from actual git history | FLOWING |
| `DiffPane.tsx` | `files`, `loading`, `error` props | Passed from CodeReviewApp via useDiff | Yes — propagates real FileDiff[] from API | FLOWING |
| `FileListPane.tsx` | `files` prop | Passed from CodeReviewApp | Yes — same live data | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All Rust tests pass | `cargo test` | 23 passed, 0 failed | PASS |
| All 402 UI tests pass | `cd ui && npm test` | 402 passed, 0 failed | PASS |
| Frontend builds clean | `cd ui && npm run build` | `✓ built in 277ms` | PASS |
| Rust compiles clean | `cargo build` | `Finished dev profile` | PASS |
| Clippy clean | `cargo clippy -- -D warnings` | No warnings | PASS |
| ESLint clean | `cd ui && npm run lint` | 0 errors | PASS |
| No legacy artifacts | `grep -RE 'diff_content|extract_diff' src/` | No matches | PASS |
| 11 diff_api Rust tests | `grep -c '#\[tokio::test\]' src/diff_api.rs` | 11 (7 pre-existing + 4 new) | PASS |
| 6 useDiff TS tests | `npm test -- --run useDiff` | 6 passed | PASS |

### Probe Execution

Step 7c: No probe scripts found for Phase 25 (`scripts/*/tests/probe-*.sh` — none exist). SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DIFF-01 | 25-01, 25-03 | User can view a full branch diff | SATISFIED | `/code-review` route renders `CodeReviewApp` which fetches `GET /api/diff/branch` and renders `FileDiff[]` via `DiffPane` + `PatchDiff` |
| DIFF-02 | 25-01, 25-02, 25-03 | User can expand collapsed context lines | SATISFIED | Per-hunk: `expansionLineCount: 20` in PatchDiff options; Global: `Expand All` refetches with `?context=999`, `Collapse` refetches with default |
| DIFF-03 | 25-02, 25-03 | User can toggle unified/side-by-side | SATISFIED | `AppToolbar` Unified/Side-by-side buttons; `diffStyle` state in `CodeReviewApp`; passed to `PatchDiff options.diffStyle` |
| DIFF-04 | 25-01, 25-02, 25-03 | User can navigate to any changed file | SATISFIED | `FileListPane` renders all files; click → `scrollIntoView` on `file-{index}` anchor; `IntersectionObserver` tracks active file |
| ARCH-01 | 25-03 | Code review viewer replaces existing unused diff tab | SATISFIED | `/api/diff` route removed; `AppState.diff_content` gone; `extract_diff` function and 4 tests deleted; `DiffView`/`TabBar` not found in codebase |

All 5 requirement IDs declared in plan frontmatter (DIFF-01 through DIFF-04, ARCH-01) are accounted for and satisfied.

**Orphaned requirements check:** REQUIREMENTS.md maps DIFF-01, DIFF-02, DIFF-03, DIFF-04, ARCH-01 to Phase 25 — all 5 are covered by the plans. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ui/src/code-review/AppToolbar.tsx` | 64 | `{/* Reserved: help / GitHub / theme — empty in Phase 25 (D-03) */}` followed by `<div />` | INFO | Intentional stub slot per D-03 spec; the comment names the tracking requirement D-03, making it auditable. Not a BLOCKER. |

No `TBD`, `FIXME`, or `XXX` markers found in any phase-modified file.
No unreferenced debt markers. No BLOCKER anti-patterns.

### Human Verification Required

The SUMMARY.md records Task 4 as "APPROVED" (human checkpoint), but per the verification protocol, SUMMARY.md claims are not evidence. The following checks require a running browser session and cannot be verified programmatically:

#### 1. /code-review Route Visual Render

**Test:** Build the frontend (`npm run build`), launch the binary on a feature branch, navigate the browser to `/code-review`
**Expected:** File list (left, 240px, with status dots + basenames + change counts) and diff pane (right, with PatchDiff output per changed file) both render correctly
**Why human:** UI layout, visual rendering, and PatchDiff syntax highlighting cannot be verified with grep

#### 2. Unified/Side-by-side Toggle

**Test:** Click "Side-by-side" in the AppToolbar, then click "Unified"
**Expected:** Diffs instantly re-render in the new layout with no network request
**Why human:** Layout switch is a real-time visual behavior; no programmatic way to verify PatchDiff re-renders correctly

#### 3. File List Click-to-Jump

**Test:** Click a file in the file list that is below the fold in the diff pane
**Expected:** Diff pane scrolls smoothly to that file; left border of active file turns blue
**Why human:** scrollIntoView behavior and active-state visual feedback require live browser

#### 4. Per-Hunk Context Expansion

**Test:** In a file with multiple hunks, click the `...` separator
**Expected:** 20 additional lines of context appear (native @pierre/diffs `expansionLineCount: 20`)
**Why human:** @pierre/diffs PatchDiff UI interaction cannot be verified statically

#### 5. Expand All / Collapse Toggle

**Test:** Click "Expand All" in the toolbar; observe label; after load click "Collapse"
**Expected:** Label cycles Expand All → Loading... → Collapse; diffs re-fetch with `?context=999` then default; active file stays highlighted
**Why human:** End-to-end timing of network re-fetch, label state machine, and diff re-render require a live execution environment

#### 6. ARCH-01 Network Verification

**Test:** Open browser devtools → Network tab; reload `/code-review`; also run `curl http://127.0.0.1:<port>/api/diff -I`
**Expected:** No request to `/api/diff` (legacy); request to `/api/diff/branch` present; curl returns HTML fallback (not legacy JSON)
**Why human:** Runtime network behavior cannot be verified without a running server

### Gaps Summary

No automated gaps identified. All 5 roadmap success criteria have direct codebase evidence:

1. `/code-review` route: `main.tsx` pathname branch → `CodeReviewApp` → `FileListPane` + `DiffPane` — VERIFIED
2. Unified/Side-by-side toggle: `AppToolbar` buttons → `diffStyle` state → `PatchDiff options` — VERIFIED
3. File click scrolls to file: click handler in `FileListPane` → `scrollIntoView` on `file-{index}` anchors — VERIFIED
4. Context expansion: `expansionLineCount: 20` in PatchDiff options + `refetch(999)` wired to "Expand All" — VERIFIED
5. Legacy code removed: no `diff_content`, `extract_diff`, `/api/diff` route, `DiffView`, or `TabBar` anywhere in `src/` or `ui/src/` — VERIFIED

The `status: human_needed` is due to visual/browser-behavior checks (items 1-6 above) that cannot be resolved programmatically. The human approval noted in 25-03-SUMMARY.md covers these checks, but per verification protocol, SUMMARY.md claims are not accepted as evidence without independent re-execution.

---

_Verified: 2026-05-24T10:00:00Z_
_Verifier: Claude (gsd-verifier)_
