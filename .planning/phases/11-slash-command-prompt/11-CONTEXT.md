# Phase 11: Slash Command Prompt - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the stub content of `commands/annotate.md` (created by Phase 10) with a full Claude Code slash command prompt that implements the complete `/plan-reviewer:annotate` workflow. All logic lives in the prompt file — no binary changes. The prompt resolves which file to review, invokes `plan-reviewer review <file>` via Bash with `run_in_background: true`, and surfaces the result to Claude as feedback.

</domain>

<decisions>
## Implementation Decisions

### Session File Resolution (SLSH-03)
- **D-01:** When no argument is given, resolve the target file by scanning the current conversation history for the most recent Write/Edit tool call that references a `.md` path. This is the most precise approach — it reflects what was actually worked on in the session, not any arbitrary file on disk.

### Temp File Fallback (SLSH-04)
- **D-02:** When no `.md` file is found in conversation history, write the last full Claude response text to a temp file using `mktemp /tmp/plan-reviewer-XXXXXX.md`. Full response, not just markdown blocks — captures complete context.
- **D-03:** Stdin support (piping content directly without a temp file) is deferred to v0.5.0 — it requires binary changes to `run_review_flow` and complexity with `run_in_background: true`. Not in scope for this phase.

### Feedback Framing (SLSH-06, SLSH-07)
- **D-04:** Frame the review as feedback collection, not an approval gate. The prompt instructs Claude to say "Opening for feedback — use Deny to leave comments, Approve if satisfied" before launching the browser.
- **D-05:** On `allow` result (no message): "Review complete, no comments." Claude proceeds with its next step.
- **D-06:** On `deny` result (with message): "Feedback received: [message]." Claude treats the message as revision instructions for the reviewed content — not a hard stop, a direction to revise.
- **D-07:** The Approve/Deny button labels are NOT customized in this phase. Phase 11.1 will add `--approve-label` / `--deny-label` CLI flags and update `annotate.md` to use "No issues" / "Leave feedback". For now, the prompt text compensates by framing the browser interaction before the user reaches the UI.

### Implementation Approach
- **D-08:** Update the `annotate_content` string literal in `src/integrations/claude.rs` (line 143) with the full prompt. No new files, no embedded templates — just replace the string. Phase 10's install/uninstall wiring remains unchanged.
- **D-09:** The command name is `/plan-reviewer:annotate` (plugin-namespaced). The prompt heading and self-references must use this name, not `/annotate`.

### Claude's Discretion
- Exact wording and tone of the pre-launch message ("Opening for feedback...")
- How Claude structures the "Feedback received" response (inline summary vs. bullet list)
- Whether to echo the temp file path to the user when the fallback is used

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §SLSH-01 through SLSH-07 — full slash command success criteria

### Execution primitive (Phase 07.4)
- `src/main.rs` — `run_review_flow` function; `Commands::Review` dispatch; `build_opencode_output` neutral JSON format (`{"behavior":"allow"|"deny","message":"..."}`)

### Stub to replace (Phase 10)
- `src/integrations/claude.rs` lines 143–144 — `annotate_content` string literal; this is the only change target
- `.planning/phases/10-slash-command-install-uninstall/10-CONTEXT.md` §D-03 — stub content spec; Phase 11 replaces only the body, keeping `# Annotate` heading and `$ARGUMENTS`

### Claude Code slash command spec (verified in Phase 10)
- `.planning/phases/10-slash-command-install-uninstall/10-RESEARCH.md` §Critical Discovery — confirms command is `/plan-reviewer:annotate`; `commands/<name>.md` format; `$ARGUMENTS` substitution

### Phase 11.1 dependency
- `.planning/ROADMAP.md` §Phase 11.1 — Configurable Review Actions; will update `annotate.md` again to use custom button labels once binary support lands

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `build_opencode_output(&decision)` in `src/main.rs:454` — produces `{"behavior":"allow"}` or `{"behavior":"deny","message":"..."}`. The prompt parses this stdout JSON after the background process completes.
- `annotate_content` string at `src/integrations/claude.rs:143` — the only code change target; replace with full prompt text

### Established Patterns
- `run_in_background: true` is the Claude Code Bash tool parameter for non-blocking execution — background process writes result to stdout when complete; Claude reads it after
- Slash command prompt files use `$ARGUMENTS` for user-supplied arguments at invocation time
- Claude Code's Bash tool captures stdout; `serde_json::to_writer(stdout(), ...)` in `run_review_flow` is how the result reaches Claude

### Integration Points
- `src/integrations/claude.rs` install() → writes `annotate_content` to `commands/annotate.md` on disk → Claude Code reads it → slash command registered
- `plan-reviewer review <file>` → browser opens → user interacts → result JSON on stdout → Claude reads and acts

</code_context>

<specifics>
## Specific Ideas

- Feedback framing before browser launch: "I'll open this in the review UI. Use **Deny** to leave feedback with comments, **Approve** if you're satisfied." (gives user context on what the buttons mean before they see them)
- On deny: treat message as revision instruction, not a hard stop — Claude immediately proposes how it will address the feedback, then proceeds

</specifics>

<deferred>
## Deferred Ideas

- **Stdin support for `plan-reviewer review`** — `plan-reviewer review -` reading from stdin would eliminate the temp file write. Deferred to v0.5.0; requires binary changes to `run_review_flow` and is risky with `run_in_background: true` detached process model.
- **Configurable button labels** — `--approve-label "No issues" --deny-label "Leave feedback"` on `plan-reviewer review`. Full UX with feedback framing in the UI itself. Captured as **Phase 11.1** in the roadmap.

</deferred>

---

*Phase: 11-slash-command-prompt*
*Context gathered: 2026-04-11*
