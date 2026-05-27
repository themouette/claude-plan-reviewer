# Phase 26: Commit Navigation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 26-commit-navigation
**Areas discussed:** Commit panel layout, Mode & select model, Keyboard nav scope, State ownership & hook shape

---

## Commit Panel Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Third column left | commits \| files \| diff — three visible columns simultaneously | |
| Stack above file list | Vertical split of the 240px sidebar (commit list top, file list bottom) | |
| Collapsible side drawer | Slides over the file list from the left; AppToolbar button toggles | ✓ |

**User's choice:** Collapsible side drawer

| Option | Description | Selected |
|--------|-------------|----------|
| AppToolbar button | Button in the existing header row, consistent with unified/split toggle | ✓ |
| Floating toggle at drawer edge | Small arrow/chevron tab at left edge of file list | |
| Auto-open on load | Drawer opens by default on page load | |

**User's choice (toggle):** AppToolbar button

| Option | Description | Selected |
|--------|-------------|----------|
| CSS transition (slide in) | Smooth 150–200ms slide animation | |
| Snap/instant | No animation; immediate appear/disappear | ✓ |
| You decide | Leave to Claude's discretion | |

**User's choice (animation):** Snap/instant

| Option | Description | Selected |
|--------|-------------|----------|
| 240px fixed (same as file list) | Mirrors file list width | |
| 280–320px (slightly wider) | More room for commit messages | ✓ |
| You decide | Leave exact width to Claude | |

**User's choice (width):** 280–320px

---

## Mode & Select Model

| Option | Description | Selected |
|--------|-------------|----------|
| Two separate gestures | Click row = per-commit view; checkboxes = filter combined diff (orthogonal) | ✓ |
| Single-click = select for filter; toolbar = view mode | Click toggles checkbox; per-commit view is a separate toolbar mode | |
| Checkbox + row label = separate hit targets | Checkbox on left = include/exclude; clicking label = per-commit view | |

**User's choice:** Two separate gestures

| Option | Description | Selected |
|--------|-------------|----------|
| Commit sha + message as diff pane title | "abc1234 — Fix login bug" shown as diff pane title | ✓ |
| "Per-commit" badge/pill in AppToolbar | Small badge in toolbar when per-commit mode is active | |
| You decide | Leave indicator to Claude | |

**User's choice (per-commit indicator):** Commit sha + message as diff pane title

| Option | Description | Selected |
|--------|-------------|----------|
| Closing the commit drawer | Returning to full branch is implicit — close the drawer | ✓ |
| Explicit "Full diff" button in diff pane header | A "Full diff" link appears in the per-commit diff pane | |
| Both | Closing drawer or clicking "Full diff" | |

**User's choice (return to full diff):** Closing the commit drawer

| Option | Description | Selected |
|--------|-------------|----------|
| All checked (opt-out) | All commits included by default; user unchecks to exclude | ✓ |
| All unchecked (opt-in) | User must check commits to include them | |
| You decide | Leave default state to Claude | |

**User's choice (default checkbox state):** All checked (opt-out)

---

## Keyboard Nav Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Only when in per-commit mode | Arrow keys active only after a commit has been clicked | ✓ |
| Always when drawer is open | Active whenever drawer visible, regardless of view mode | |
| Only when commit list has keyboard focus | Standard focus-based approach | |

**User's choice:** Only when in per-commit mode

| Option | Description | Selected |
|--------|-------------|----------|
| Left/Right arrows | Left = previous commit, Right = next commit | ✓ |
| Up/Down arrows | Up = previous, Down = next | |
| Both Left/Right and Up/Down | Both key pairs supported | |

**User's choice (keys):** Left/Right arrows

---

## State Ownership & Hook Shape

| Option | Description | Selected |
|--------|-------------|----------|
| All in CodeReviewApp | drawerOpen, viewMode, activeCommitSha, checkedCommitShas[] owned in shell component | ✓ |
| Separate useCommitNav hook | Hook encapsulates all commit state, CodeReviewApp calls it and spreads props | |
| You decide | Leave architecture to Claude | |

**User's choice:** All in CodeReviewApp

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, same pattern (injectable doFetch) | fetchCommitsOnce(doFetch) + useCommits() + cancelledRef | ✓ |
| Simpler hook, no injectable seam | Just useCommits(), tests use @testing-library/react | |
| You decide | Leave to Claude | |

**User's choice (useCommits shape):** Yes, same injectable doFetch pattern as useDiff

| Option | Description | Selected |
|--------|-------------|----------|
| Nothing immediate — unchecking only affects full-branch mode | Per-commit view ignores checkbox state | ✓ |
| Unchecking active commit auto-returns to full-branch | View mode switches when active commit is unchecked | |

**User's choice (uncheck active commit):** Nothing immediate — checkboxes only affect full-branch mode

---

## Claude's Discretion

- Exact drawer width within 280–320px range
- Commit row layout (short_sha + truncated message + author + date — column widths)
- Empty state when no commits found
- Boundary behavior: navigating past first/last commit with arrow keys (wrap vs stop)
- Loading state for commit list
- How checkedCommitShas drives the combined diff (client-side union of per-commit diffs noted as likely approach)

## Deferred Ideas

- Theme switcher, help icon, GitHub link in AppToolbar — still reserved, still deferred
- Worker pool for @pierre/diffs — disableWorkerPool=true remains for now
- Animated/smooth drawer open/close — snap chosen for now; smooth slide deferred to future UX polish phase
