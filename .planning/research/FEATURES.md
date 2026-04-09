# Feature Landscape

**Domain:** Local plan review tool for Claude Code (ExitPlanMode hook)
**Researched:** 2026-04-09
**Reference:** plannotator (https://github.com/backnotprop/plannotator)

---

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Render plan as formatted markdown | Plan content is markdown; raw text is unreadable at scale | Low | The ExitPlanMode tool_input contains a `plan` field in markdown format (confirmed via bug report #9701). Must render headings, lists, code blocks. |
| One-click approve | Core purpose of the hook — must be the default, zero-friction path | Low | Maps directly to `{"behavior": "allow"}` in hook stdout JSON |
| One-click deny with message | Must be able to reject and give feedback in one action | Low | Maps to `{"behavior": "deny", "message": "..."}` — the message goes back to Claude |
| Inline comment annotations | Users need to point at specific plan text and say "change this" | Medium | Select text → attach note; this is the primary annotation primitive |
| Structured feedback to agent | Annotations must be formatted so Claude can act on them, not just stored | Medium | Plannotator formats as structured markdown with a "Plan Feedback" header; the `message` field in deny response carries this |
| Auto-open browser on hook trigger | No manual steps — hook fires, browser opens, user reviews | Low | Binary spawns HTTP server, opens system browser via `open`/`xdg-open` |
| Block until decision | Binary must hold stdin open, wait for browser UI response, then emit stdout JSON | Medium | HTTP long-poll or WebSocket between browser and binary; the hook process cannot exit until decision is made |
| Keyboard shortcut for approve | Reviewing plans is frequent; mouse-only approve creates fatigue | Low | `Enter` or `Ctrl+Enter` to approve without annotations |
| Keyboard shortcut for deny | Symmetric with approve | Low | `Ctrl+d` or similar to open deny dialog |
| Visible plan content at a glance | Users must understand the full plan without scrolling past noise | Low | Clean render, no chrome clutter, full-width plan text |

---

## Differentiators

Features that set this product apart from plannotator. Not universally expected, but meaningfully better.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Single binary, zero runtime | `curl \| sh` installs and works — no Bun, no Node, no monorepo | High | Rust + rust-embed bundles UI assets; this is the primary distribution differentiator over plannotator |
| Approve with inline comments | Approve the plan AND attach comments Claude will see — no need to deny just to give notes | Medium | Plannotator sends annotations only on deny; "approve with notes" is a distinct, useful path. Maps to `{"behavior": "allow", "updatedInput": {...}}` — inject the comments into the plan text itself, or use a separate mechanism. Needs protocol investigation. |
| Code diff view alongside plan | Show the git diff for the affected files next to the plan | High | Plannotator does this as a separate command; integrating it into the plan review view is more useful. Read `transcript_path` + `cwd` from hook stdin to find relevant diffs. |
| Plan revision history | Show previous versions of the plan when agent revises | Medium | Requires storing prior plans per session. Plannotator does this; it's high-value when Claude revises a plan after "request changes" |
| Fast approve path: no browser | If user sets a "trust" preference, skip the browser and auto-approve after N seconds or always | Low | Anti-review-fatigue pattern: for users who only want to see plans occasionally. Optional, gated behind settings. |
| Global comment (document-level) | Attach a note not anchored to any specific text — useful for overall direction feedback | Low | Plannotator supports this. Low implementation cost, high communication value. |
| Replace annotation | Select text in plan, type replacement — tells Claude exactly what to write instead | Medium | More precise than "comment saying change X to Y". Plannotator supports `['R', originalText, replacementText]`. |
| Delete annotation | Mark a plan step for removal explicitly | Low | Cleaner signal than "comment saying skip this". Plannotator supports `['D', originalText]`. |

---

## Anti-Features

Features to explicitly NOT build. Each is a complexity trap with low marginal return for v1.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Image/screenshot attachments on annotations | Plannotator supports this; adds file handling, storage, and encoding complexity for rare use | Text comments cover 99% of cases; defer forever |
| Team sharing / URL encoding of plans | Requires encryption, server infrastructure, or large URL payloads; out of scope for local tool | Stay local-only for v1; sharing is explicitly OOS in PROJECT.md |
| Multi-agent platform support (Copilot, Gemini, etc.) | Each platform has a different hook protocol; adds abstraction layers that bloat the binary | Claude Code only for v1; PROJECT.md explicitly scopes this out |
| Plan diff / revision history storage across sessions | Requires persistent state, migration, storage format decisions | Plan revision within a single session is enough; no cross-session storage |
| Code review as a standalone command | Plannotator has `/plannotator-review` for PRs and arbitrary diffs; this is a separate product surface | Focus on the ExitPlanMode hook flow; code diff is a secondary panel in that context, not a standalone feature |
| TUI (terminal UI) | Inferior markdown/diff rendering; PROJECT.md already decided browser UI | Browser UI is the decision |
| "Annotate any file" command | Plannotator has `/plannotator-annotate`; arbitrary file annotation is a separate tool, not a plan reviewer | Out of scope |
| Real-time collaboration / websocket sync | Networking infrastructure for a local tool is disproportionate | Local only |
| Auth / user identity on annotations | Plannotator stores `author` on each annotation; single-user local tool has no need | Omit author field; simplifies data model |
| Insert annotation (new step insertion) | Requires position tracking in the document model; rarely used vs replace/comment | Use "replace" to rewrite a section; use "comment" to say "add X here"; defer insert as a first-class type |

---

## Annotation Model

Based on plannotator's model and the specific needs of this tool, the recommended annotation types are:

### Recommended: Three-type model (not five)

Plannotator supports five types: Delete, Insert, Replace, Comment, Global Comment. For v1, collapse to three:

| Type | When | Signal to agent |
|------|------|-----------------|
| `delete` | Selected text should be removed from the plan | "Do not do this step" |
| `replace` | Selected text should be rewritten | "Do this instead: [new text]" |
| `comment` | Selected text needs attention but user isn't prescribing the fix | "Think about this differently: [note]" |

Global comment (no anchor) maps naturally to a top-level `comment` with no `originalText`. This keeps the data model flat:

```
Annotation {
  id: uuid,
  type: "delete" | "replace" | "comment",
  original_text: String,   // selected text (empty string for global comment)
  replacement: Option<String>,  // only for "replace" type
  note: Option<String>,    // for "comment" type; optional on "delete"/"replace"
}
```

**Why not insert?** Insert requires knowing _where_ to insert in the document model (before/after which element). This needs a position index or a range, and the agent must parse that to reconstruct intent. Replace covers most insert use cases ("replace empty selection at position X with new text") but adds complexity. Defer.

**Why no images?** Binary payload through the hook's stdout JSON is messy. Text covers the use cases. Skip forever.

### Feedback formatting

When denying, annotations serialize to structured markdown sent as the `message` field:

```
## Plan Feedback

### Delete: "Run npm install in the root directory"
> Reason: We use bun, not npm.

### Replace: "Create a new PostgreSQL migration"
> With: "Create a new SQLite migration using the existing migration helper"

### Comment: "Phase 2: Refactor the auth module"
> Consider doing this as a separate task after the current feature is stable.

### Overall
This plan skips error handling entirely. Each step should include what to do if the operation fails.
```

This format is readable by Claude without any special parsing. Each annotation maps to a human-readable block with the original text quoted.

---

## Approve/Deny UX

### Findings from research

The critical insight from review fatigue research: **most plans should be approvable with one keystroke**. The annotation flow should feel like annotating a document before hitting send — not like filing a bug report.

Three patterns from code review UX that apply here:

1. **Approve is the default path.** The primary button / keyboard shortcut approves. Deny requires an intentional secondary action. This matches GitHub's PR model.

2. **Approve-with-comments is a valid state.** Currently plannotator only sends annotations on deny. But "I'll proceed, just noting X" is a common reviewer state. Map this to `behavior: allow` with comments injected into the plan text or passed as a separate channel. Needs protocol investigation — the `updatedInput` field on allow could carry augmented plan text.

3. **Deny requires a summary.** When requesting changes, Claude needs to know the overall intent, not just individual annotation targets. The deny dialog should prompt for a global note in addition to inline annotations.

### Recommended UX flow

```
Hook fires → browser opens → plan renders

  [No annotations needed]
  User presses Enter → approve immediately → window closes → binary exits

  [Wants to annotate then approve]
  User selects text → picks Delete/Replace/Comment → fills in
  User presses Ctrl+Enter → "approve with notes" → window closes → binary exits with allow + notes

  [Wants agent to revise]
  User annotates
  User clicks "Request changes" → confirmation shows annotation count
  Optional: user types overall feedback
  User confirms → window closes → binary exits with deny + structured message
```

The browser window closing is the signal to the user that the decision is sent. No "submitted" page, no waiting state.

---

## Diff Rendering

### What matters

Based on code review UX research: diff rendering for plan review is secondary to the plan text itself. The code diff is context — it shows _what changed_ to help the user evaluate whether the plan makes sense. The diff should be:

- Visible alongside the plan, not replacing it
- Unified diff view by default (most compact)
- Side-by-side view available as toggle
- Syntax highlighted per language
- File tree navigation when multiple files are affected

### What does NOT matter for v1

- Line-level annotations on the diff (defer — adds significant complexity)
- Staging/unstaging hunks (plannotator feature for code review, not plan review)
- Cross-repo PR cloning (out of scope)

### Implementation note

`diff2html` (JavaScript library) handles unified + side-by-side + syntax highlighting from a standard git diff string. It works without React, is well-maintained, and produces GitHub-style output. The binary reads the diff from `cwd` in the hook stdin by running `git diff HEAD` (or similar). This is the right tool for the diff rendering surface.

**Confidence:** MEDIUM — diff2html is the ecosystem standard, but embedding it in a Rust binary's bundled assets needs verification of bundle size.

---

## Feature Dependencies

```
Block-until-decision (HTTP server + WebSocket/long-poll)
  → All annotation features (need round-trip from browser to binary)
  → Approve action
  → Deny action

Approve action
  → Approve-with-comments (needs the above + annotation model)

Deny action
  → Structured feedback format (needs annotation model)

Annotation model
  → Delete annotation
  → Replace annotation
  → Comment annotation
  → Global comment

Diff view
  → Code diff rendering (needs git access via cwd from hook stdin)
```

---

## MVP Recommendation

Prioritize for v1:

1. Plan markdown rendering (table stakes — useless without it)
2. One-click approve / deny (table stakes)
3. Block-until-decision mechanism (architectural requirement for all of the above)
4. Comment annotation (the single most useful annotation type)
5. Deny with structured feedback (makes the tool useful vs plannotator's model)
6. Delete and Replace annotations (complete the annotation model)

Defer:

- **Code diff view**: Useful but not essential for plan review; adds surface area and git integration complexity. Add in milestone 2.
- **Approve-with-comments**: Useful differentiator but requires protocol investigation on how to pass notes on `allow`. Defer until the hook input/output protocol for ExitPlanMode is fully understood.
- **Plan revision history**: Valuable for multi-round plan refinement; defer until core loop is proven.
- **Fast approve / skip-browser mode**: Anti-fatigue feature for power users; add after core loop is working.

---

## Open Questions

1. **Does ExitPlanMode tool_input contain the plan text?** The bug report (#9701) shows `plan` as a parameter value (`"## Import/Export Feature Implementation Plan\n\n[content]"`), but the official docs don't document `tool_input` for ExitPlanMode. This needs empirical verification by inspecting the hook stdin JSON at runtime. This is a blocker for knowing exactly what the binary receives.

2. **Can `updatedInput` on `behavior: allow` carry annotated plan text?** The hooks docs show `updatedInput` modifying tool input on allow decisions (e.g., rewriting a Bash command). If `updatedInput` can carry a modified `plan` value, approve-with-comments becomes possible in v1. Needs testing.

3. **Is `transcript_path` in hook stdin useful for diff extraction?** The transcript is a JSONL file of the session. It may contain information about which files were being modified, which would let the binary infer a relevant git diff without user input.

---

## Sources

- Plannotator annotation types: https://www.mintlify.com/backnotprop/plannotator/guides/annotation-types
- Plannotator plan review basics: https://lzw.me/docs/opencodedocs/backnotprop/plannotator/platforms/plan-review-basics/
- Claude Code hooks reference: https://code.claude.com/docs/en/hooks
- Claude Code hooks guide: https://code.claude.com/docs/en/hooks-guide
- ExitPlanMode tool description: https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/system-prompts/tool-description-exitplanmode.md
- ExitPlanMode bug report (plan field confirmed): https://github.com/anthropics/claude-code/issues/9701
- Review fatigue design pattern: https://ravipalwe.medium.com/review-fatigue-is-breaking-human-in-the-loop-ai-heres-the-design-pattern-that-fixes-it-044d0ab1dd12
- diff2html library: https://diff2html.xyz/
- Armin Ronacher on plan mode UX: https://lucumr.pocoo.org/2025/12/17/what-is-plan-mode/
