# Phase 28: Review Submission - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 28 adds the submit bar to the code review UI. Users can approve the diff (when zero comments exist) or request changes (when at least one comment exists). Approving opens a popover for an optional global instruction before confirming. Submitting with comments serializes all `CodeReviewComment[]` state into a structured JSON payload returned to the agent. Clipboard fallback is available for offline mode via heartbeat-based connectivity detection.

Not in scope: slash command + pre-PR hook wiring (Phase 29). The backend `/api/decide` POST endpoint for code review is Phase 29; Phase 28 wires the submit path but the integration test of end-to-end flow is Phase 29.

</domain>

<decisions>
## Implementation Decisions

### Output JSON Schema (D-01)

- **D-01:** The submission JSON uses structured fields — no `hunk` string. Schema:
  ```json
  {
    "decision": "approved" | "changes_requested",
    "global_instruction": "...",
    "comments": [
      { "file": "src/foo.ts", "line": 42, "side": "additions", "text": "..." },
      { "file": "src/bar.ts", "text": "..." }
    ]
  }
  ```
  - Line comments: include `file`, `line`, `side`, `text`. Range comments include `endLine` (Claude's discretion on exact field name — mirror Phase 27's `endLineNumber` or normalize to `endLine`).
  - File-level comments: include `file` and `text` only — no `line`/`side`.
  - `global_instruction` is omitted (not `null`) when the user leaves it blank.
  - `comments` is omitted (not `[]`) when the decision is `"approved"` with no comments.
  - The `buildCodeReviewPayload(decision, comments, globalInstruction)` function lives in `ui/src/code-review/` — NOT in `reviewer-v2/`. Tested in plan 28-01 (TDD first).

### SubmitBar Placement (D-02)

- **D-02:** Approve and Request Changes buttons go in the **AppToolbar right side**, in the existing "Reserved: help / GitHub / theme" gap. `AppToolbar` receives new props: `comments: CodeReviewComment[]` (to derive gate states) and `onApprove`, `onRequestChanges` callbacks. Claude's discretion on exact prop shape.

### Connectivity / Offline Mode (D-03–D-04)

- **D-03:** Full heartbeat polling — `useHeartbeat` and `connectivity.ts` are **moved from `reviewer-v2/` to `ui/src/shared/`**. Both `reviewer-v2` and `code-review` import from `shared/`. The ESLint no-restricted-imports rule is updated to allow `code-review/` to import from `shared/` (it already allows it; verify the rule targets `reviewer-v2/**` not `shared/**`).
- **D-04:** `CodeReviewApp` calls `useHeartbeat()` from `ui/src/shared/useHeartbeat`. The `connectivity` value flows down to the SubmitBar. When `offline`: buttons switch to "Copy to clipboard" mode (same clipboard-error fallback as reviewer-v2 — textarea shown if clipboard write fails). The existing `CodeReviewApp.test.ts` assertion `does NOT call useHeartbeat` must be removed or replaced with a positive assertion.

### Approve + Global Instruction UX (D-05)

- **D-05:** Clicking Approve opens a `CodeReviewSubmitPopover` component (new, under `ui/src/code-review/`) — parallel to `reviewer-v2/SubmitPopover` but independent (cannot import from `reviewer-v2/`). The popover contains an optional global instruction textarea + Confirm button. If the textarea is blank, Confirm submits a clean approval with no `global_instruction` field. Request Changes submits immediately — no popover (comments are already the message).

### Validation Gates (D-06)

- **D-06:** Gate logic mirrors ROADMAP success criteria exactly:
  - Approve: disabled when `comments.length > 0`
  - Request Changes: disabled when `comments.length === 0`
  - Both gates are enforced in the UI (button `disabled` state) — no server-side validation in Phase 28.

### Claude's Discretion

- Exact prop shape for passing `comments` and callbacks into `AppToolbar` vs a new `SubmitBar` sub-component within the toolbar
- Whether `CodeReviewSubmitPopover` is a standalone component or inlined in `AppToolbar`
- Field name for comment line ranges in JSON: `endLine` vs `endLineNumber` (mirror Phase 27 or normalize)
- Clipboard fallback UX details (banner wording, button labels) — follow reviewer-v2 patterns

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope
- `.planning/ROADMAP.md` Phase 28 — Goal, 5 success criteria, plan breakdown (28-01, 28-02)
- `.planning/REQUIREMENTS.md` — SUBMIT-01, SUBMIT-02, SUBMIT-03, SUBMIT-04 (Phase 28 scope)

### Prior Phase Decisions
- `.planning/phases/27-inline-comments/27-CONTEXT.md` — D-07–D-11: `CodeReviewComment` discriminated union type, `useCodeReviewAnnotations` reducer, comment anchor shape that Phase 28 serializes
- `.planning/phases/25-diff-viewer-ui/25-CONTEXT.md` — D-01–D-14: CSS variable tokens, AppToolbar header pattern, ESLint import direction
- `.planning/phases/26-commit-navigation/26-CONTEXT.md` — D-11–D-12: state ownership in `CodeReviewApp`, injectable `doFetch` pattern for hooks

### Existing Submit Pattern (reviewer-v2 — for reference only, must NOT import from it)
- `ui/src/reviewer-v2/SubmitControls.tsx` — SubmitState machine, handleApprove / handleAskForChanges, clipboard fallback pattern to mirror
- `ui/src/reviewer-v2/SubmitPopover.tsx` — Popover pattern to replicate in `code-review/CodeReviewSubmitPopover.tsx`
- `ui/src/reviewer-v2/offlineLabels.ts` — `buildClipboardPayload` + `shouldUseClipboard` reference (Phase 28 creates `buildCodeReviewPayload` + `shouldUseClipboard` equivalents in `code-review/`)

### Heartbeat / Connectivity (to be moved to shared/)
- `ui/src/reviewer-v2/useHeartbeat.ts` — Source file to move to `ui/src/shared/useHeartbeat.ts`
- `ui/src/reviewer-v2/connectivity.ts` — `ConnectivityStatus` type to move to `ui/src/shared/connectivity.ts`

### Files to Modify
- `ui/src/code-review/AppToolbar.tsx` — Add submit controls to right side (Reserved gap)
- `ui/src/code-review/CodeReviewApp.tsx` — Add `useHeartbeat()` call; pass `comments` + submit callbacks to AppToolbar
- `ui/src/code-review/CodeReviewApp.test.ts` — Remove/replace `does NOT call useHeartbeat` assertion
- `ui/src/code-review/types.ts` — No changes expected; `CodeReviewComment` type already defined

### New Files (Phase 28)
- `ui/src/shared/useHeartbeat.ts` — Moved from reviewer-v2 (update imports in reviewer-v2 after move)
- `ui/src/shared/connectivity.ts` — Moved from reviewer-v2
- `ui/src/code-review/buildCodeReviewPayload.ts` — TDD plan 28-01: pure function + Vitest tests
- `ui/src/code-review/CodeReviewSubmitPopover.tsx` — Approve popover with optional global instruction
- `ui/src/code-review/buildCodeReviewPayload.test.ts` — Vitest tests (plan 28-01)

### Architecture Constraints
- `.planning/PROJECT.md` — React 19 + TypeScript + Vite; no new npm packages without justification
- `CLAUDE.md` — `cargo fmt && cargo clippy -- -D warnings` before commit; MUST NOT import from `reviewer-v2/`
- ESLint no-restricted-imports — verify `shared/` is not in the restricted list; `code-review/` may import from `shared/`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useHeartbeat()` in `ui/src/reviewer-v2/useHeartbeat.ts` — 3-failure hysteresis heartbeat polling; move to `shared/` (don't copy)
- `shouldUseClipboard(connectivity)` pattern — create equivalent in `code-review/` based on reviewer-v2 model
- `AppToolbar.tsx` — right side has `{/* Reserved: help / GitHub / theme — empty in Phase 25 (D-03) */}<div />` — this gap is where submit controls slot in
- `CodeReviewApp` comments state — `comments: CodeReviewComment[]` already managed by `useCodeReviewAnnotations`; available to derive gate states and pass to submit

### Established Patterns
- **TDD first** (plan 28-01): `buildCodeReviewPayload` function + Vitest tests written before any UI code
- **SubmitState machine** (reviewer-v2): `'idle' | 'popover_open' | 'confirmed_allow' | 'confirmed_deny' | 'clipboard_confirmed' | 'clipboard_error'` — mirror this pattern for `code-review/` submit states
- **Auto-close tab after submission**: reviewer-v2 closes the tab 500ms after confirmed — replicate for code review
- **CSS variable tokens**: `--color-accent-approve`, `--color-accent-deny`, `--color-surface`, `--color-border`, `--color-text-primary`, `--color-text-secondary`, `--color-focus`
- **Source-assertion test pattern**: used in `AppToolbar.test.ts`, `CommitDrawer.test.ts` — `readFileSync` + `expect(source).toContain(...)` for structural assertions

### Integration Points
- `AppToolbar.tsx` line ~55: `{/* Right: controls */}` div — submit controls added here alongside existing buttons
- `CodeReviewApp.tsx` — `useHeartbeat()` called at top level; `connectivity` passed as prop to AppToolbar (or to a new SubmitBar component within)
- `reviewer-v2/ReviewerV2Shell.tsx` — imports `useHeartbeat` from `./useHeartbeat`; must update to `../shared/useHeartbeat` after the move
- `reviewer-v2/SubmitControls.tsx` — imports `{ buildClipboardPayload, shouldUseClipboard }` from `./offlineLabels` — unchanged (offlineLabels stays in reviewer-v2)

</code_context>

<specifics>
## Specific Ideas

- "Same pattern as SubmitPopover (reviewer-v2)" — `CodeReviewSubmitPopover` is a close parallel to `reviewer-v2/SubmitPopover.tsx`: popover panel, optional text field, Confirm + Cancel
- "Request Changes submits immediately" — no popover needed; the inline comments are already the message
- `buildCodeReviewPayload('approved' | 'changes_requested', comments, globalInstruction?)` — pure function, returns JSON string, tested in 28-01

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 28-review-submission*
*Context gathered: 2026-05-25*
