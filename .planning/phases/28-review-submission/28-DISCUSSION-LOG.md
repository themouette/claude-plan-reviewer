# Phase 28: Review Submission - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 28-review-submission
**Areas discussed:** Hunk field serialization, SubmitBar placement, Offline / clipboard strategy, Approve + global instruction UX

---

## Hunk field serialization

### Clarification exchange

The user noted that "line is not enough" because a comment can be on deleted code or added code — the `side` dimension is essential. Options were reformulated to account for both line number and side.

| Option | Description | Selected |
|--------|-------------|----------|
| Structured fields — `{ line, side, text }` | Explicit machine-readable fields; agents parse without string splitting; mirrors CodeReviewComment shape | ✓ |
| Diff notation string — `+L42` / `-L10` | Compact, uses unified-diff +/- convention; single hunk string | |
| Verbose string — `additions:L42` | Explicit label, human-readable | |
| Actual `@@` hunk header | Real diff hunk header from patch; requires diff data at serialization time | |

**User's choice:** Structured fields — `{ line, side, text }` (recommended)
**Notes:** The ROADMAP sketch used a `hunk` string field but that was replaced by structured `line` + `side` fields after the user clarified that side context is required. File-level comments use `{ file, text }` with no `line`/`side`.

---

## SubmitBar placement

| Option | Description | Selected |
|--------|-------------|----------|
| AppToolbar right side | Approve + Request Changes slot into existing toolbar header, right of existing controls | ✓ |
| Separate sticky footer | New fixed bar pinned to bottom of viewport | |
| Floating action bar | Pill/bar floating at bottom-right of diff pane | |

**User's choice:** AppToolbar right side (recommended)
**Notes:** The AppToolbar already has a "Reserved: help / GitHub / theme" comment marking an empty gap on the right — this is the natural location.

---

## Offline / clipboard strategy

### Phase 1 — Offline detection strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Try-POST, fall back on error | No proactive polling; try POST, fall back to clipboard on network error | |
| Add heartbeat polling (same as reviewer-v2) | Import useHeartbeat, derive connectivity, proactive offline detection | ✓ |
| Always clipboard (no POST) | Submit always writes to clipboard; no server round-trip | |

**User's choice:** Add heartbeat polling (same as reviewer-v2)

### Phase 2 — Where useHeartbeat lives

| Option | Description | Selected |
|--------|-------------|----------|
| Move to `ui/src/shared/` | Both reviewer-v2 and code-review import from shared; clean, no duplication | ✓ |
| Duplicate into `code-review/useHeartbeat.ts` | Copy file; simpler but risks drift | |

**User's choice:** "move it to shared" (free text — confirmed move to `ui/src/shared/`)
**Notes:** `useHeartbeat.ts` and `connectivity.ts` both move from `reviewer-v2/` to `shared/`. reviewer-v2 imports updated. The existing `CodeReviewApp.test.ts` assertion `does NOT call useHeartbeat` (labeled "Research Open Question 1") is removed in Phase 28.

---

## Approve + global instruction UX

| Option | Description | Selected |
|--------|-------------|----------|
| Approve click expands inline field | Clicking Approve reveals text input inline with Confirm + Cancel | |
| Always-visible textarea above toolbar | Small textarea always shown; user types note, then clicks Approve | |
| Same pattern as SubmitPopover (reviewer-v2) | Approve opens a popover with optional text field + Confirm | ✓ |

**User's choice:** Same pattern as SubmitPopover (reviewer-v2)
**Notes:** A new `CodeReviewSubmitPopover` component is created under `code-review/` — parallel to `reviewer-v2/SubmitPopover` but independent (ESLint prevents cross-import). Request Changes submits immediately without a popover — the inline comments are already the message.

---

## Claude's Discretion

- Exact prop shape for passing `comments` and submit callbacks into AppToolbar vs a sub-component
- Whether `CodeReviewSubmitPopover` is standalone or inlined in AppToolbar
- Field name for range end in JSON: `endLine` vs `endLineNumber`
- Clipboard fallback UX wording — follow reviewer-v2 patterns

## Deferred Ideas

None — discussion stayed within phase scope.
