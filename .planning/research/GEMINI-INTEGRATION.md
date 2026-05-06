# Feasibility: Gemini CLI Hook Integration

**Question:** Does Gemini CLI have an equivalent to Claude Code's ExitPlanMode hook?
**Verdict:** YES — a functional equivalent exists, but with meaningful protocol differences.
**Confidence:** MEDIUM-HIGH (official docs + GitHub repo confirm hook system; exact `exit_plan_mode` BeforeTool denial semantics have one gap, noted below)
**Researched:** 2026-04-10

---

## Hook System Exists

Gemini CLI has a documented hook system introduced at v0.26.0. Hooks are external processes
spawned synchronously at specific points in the agent loop. They communicate via stdin/stdout
JSON — the same pattern as Claude Code.

Official docs: https://geminicli.com/docs/hooks/
Hook reference: https://geminicli.com/docs/hooks/reference/
Google Developers Blog announcement: https://developers.googleblog.com/tailor-gemini-cli-to-your-workflow-with-hooks/

---

## Equivalent to ExitPlanMode

Claude Code fires `ExitPlanMode` as a PermissionRequest hook, allowing the external process to
approve or deny the plan before execution starts.

Gemini CLI exposes `exit_plan_mode` as a **tool** that can be intercepted via a `BeforeTool`
hook with `"matcher": "exit_plan_mode"`. The hook runs before the tool executes, so a `deny`
decision blocks the transition from plan to execution.

The plan documentation explicitly confirms: "Hooks such as BeforeTool or AfterTool can be
configured to intercept the `enter_plan_mode` and `exit_plan_mode` tool calls."

Source: https://geminicli.com/docs/cli/plan-mode/
Source: https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/plan-mode.md

**Caveat — manual toggle:** When the user manually toggles plan mode via `/plan` command or
`Shift+Tab`, hooks do NOT fire. Hooks only fire when the agent calls the tool. For plan-reviewer
purposes (reviewing AI-generated plans before execution) this is acceptable, since the agent
calls `exit_plan_mode` programmatically.

---

## Config File Path and Format

Settings file: `~/.gemini/settings.json` (user scope) or `.gemini/settings.json` (project scope).
This is analogous to `~/.claude/settings.json` for Claude Code — simple JSON config, no plugin
installer required.

Example hook entry:

```json
{
  "hooks": {
    "BeforeTool": [
      {
        "matcher": "exit_plan_mode",
        "hooks": [
          {
            "name": "plan-reviewer",
            "type": "command",
            "command": "/usr/local/bin/plan-reviewer",
            "timeout": 300000
          }
        ]
      }
    ]
  }
}
```

---

## stdin Payload to the Hook Process

All hooks receive a base object plus event-specific fields. For `BeforeTool` on `exit_plan_mode`:

```json
{
  "session_id": "<string>",
  "transcript_path": "<string>",
  "cwd": "<string>",
  "hook_event_name": "BeforeTool",
  "timestamp": "<ISO 8601>",
  "tool_name": "exit_plan_mode",
  "tool_input": {
    "plan_path": "<path to .md plan file>"
  },
  "mcp_context": null,
  "original_request_name": "exit_plan_mode"
}
```

The `tool_input.plan_path` field is confirmed by the plan archiving example in official docs
(hook extracts it via `jq '.tool_input.plan_path // empty'`).

**Gap:** The complete list of fields inside `tool_input` for `exit_plan_mode` is not exhaustively
documented. `plan_path` is confirmed; other fields are unconfirmed. Recommend testing against
actual Gemini CLI binary to enumerate the full payload.

Source: https://geminicli.com/docs/hooks/reference/ (base payload schema)
Source: https://geminicli.com/docs/cli/plan-mode/ (plan_path field in example)

---

## stdout Response from the Hook Process

The hook must return strict JSON only (no plain text). Valid response shapes:

```json
{ "decision": "allow" }
```

```json
{
  "decision": "deny",
  "reason": "Plan rejected: missing rollback strategy",
  "systemMessage": "Plan was reviewed and rejected. Please revise."
}
```

Exit code 0 with JSON stdout = the `decision` field is honored.
Exit code 2 = critical block (tool aborted regardless of stdout content).

Denial behavior: "Set to `deny` (or `block`) to prevent the tool from executing." The turn
continues — the agent loop does not terminate; the model receives the rejection as a tool error
and may retry or prompt the user.

**Important difference from Claude Code:** In Claude Code, the hook returning `deny` terminates
the ExitPlanMode flow and Claude waits for further input. In Gemini CLI, denial sends the reason
back to the agent as a tool error. The agent could theoretically retry `exit_plan_mode`
immediately. Whether this creates a loop in practice is unconfirmed — requires testing.

---

## Integration Complexity Estimate

| Dimension | Claude Code | Gemini CLI | Delta |
|-----------|-------------|------------|-------|
| Hook mechanism | PermissionRequest hook | BeforeTool hook | Different event type, same pattern |
| Config file | `~/.claude/settings.json` | `~/.gemini/settings.json` | Parallel paths, same format |
| Install method | `hooks` key in settings | `hooks.BeforeTool` key in settings | Slightly different nesting |
| Stdin payload | PermissionRequest JSON | BeforeTool JSON with tool_input | Different schema, similar concept |
| Stdout response | `{decision, reason}` | `{decision, reason, systemMessage}` | Superset — backward-compatible additions |
| Plan content | Full plan in JSON payload | `plan_path` pointing to .md file | Binary must read file from disk |
| Denial semantic | Hard stop, Claude waits | Tool error, agent may retry | Behavioral risk — needs integration test |

The largest implementation difference: Claude Code sends the plan content directly in the hook
payload. Gemini CLI sends a `plan_path` (filesystem path to a Markdown file). The binary must
read that file to render the plan in the browser UI. This is straightforward but requires the
plan file to exist and be readable at the time the hook fires.

---

## Reference Implementations

No third-party plan reviewer implementations for Gemini CLI found in public repositories. The
official docs show an `AfterTool` archive-to-GCS example only.

The Gemini CLI repo includes a `gemini hooks migrate --from-claude` command that converts Claude
Code hook configurations to Gemini CLI format, confirming the two systems are intended to be
parallel. The migration maps event names and environment variables (e.g., `$CLAUDE_PROJECT_DIR`
to `$GEMINI_PROJECT_DIR`).

Source: https://github.com/google-gemini/gemini-cli/pull/14225
Source: https://github.com/google-gemini/gemini-cli/pull/14307

---

## Gaps Requiring Testing

1. **Full `tool_input` schema for `exit_plan_mode`** — `plan_path` is confirmed; whether
   additional fields (plan title, summary, user prompt) are included is undocumented.

2. **Denial retry behavior** — Does the agent retry `exit_plan_mode` after a hook denial?
   If yes, the UI must handle the same session receiving a second approval request.

3. **Non-interactive environment behavior** — Docs mention automatic YOLO mode switch in
   non-interactive environments. Whether hooks still fire in that path is unconfirmed.

4. **Plan file format** — The plan is a Markdown file at `plan_path`. The binary needs to
   read and render it; the exact Markdown structure Gemini CLI produces is undocumented.

---

## Recommendation

**Include in v0.3.0 milestone.**

Rationale:
- A functional hook mechanism exists and is officially documented.
- The config pattern (`~/.gemini/settings.json`) mirrors Claude Code closely enough that
  the installer and setup UX can be nearly identical.
- The protocol differences (BeforeTool vs PermissionRequest, plan_path vs inline content)
  are bounded and implementable without architectural changes to the binary.
- The `gemini hooks migrate` command signals Google's intent to support third-party hook
  integrations, including migration from Claude Code — directly relevant to this project's
  user base.

**Implementation note:** The Gemini CLI adapter must read `plan_path` from disk rather than
parsing plan content from the hook payload. Structure the hook handler as a trait/interface
from the start so the Claude Code handler (inline JSON) and Gemini CLI handler (file read)
share the browser UI and approval flow code.

**Risk flag:** Validate denial retry behavior in an integration test before shipping. If the
agent loops on denial, the UI needs a "force stop" escape hatch or the hook must signal
something other than a plain `deny`.
