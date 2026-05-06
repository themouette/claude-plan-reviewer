# Codex CLI Hook System — Integration Feasibility

**Researched:** 2026-04-10
**Source:** openai/codex GitHub repo, source code (codex-rs/hooks/, codex-rs/core/)
**Confidence:** HIGH — all findings are from authoritative first-party source code, not docs or speculation

---

## Verdict: FEASIBLE but NOT EQUIVALENT to Claude Code's ExitPlanMode

Codex CLI (the Rust rewrite in `codex-rs/`) has a hook system, but it does not have an `ExitPlanMode` equivalent. The closest hook fires **before each shell command execution** (`PreToolUse`), not at the plan approval boundary. Integration is possible but requires a different mental model.

---

## Findings

### 1. Hook System Exists

YES. Codex CLI has a first-class hook system implemented in `codex-rs/hooks/`. It is modeled closely after Claude Code's hook system in structure and wire format.

Hook event types available:
- `PreToolUse` — fires before a shell command runs; can block execution
- `PostToolUse` — fires after a shell command runs
- `SessionStart` — fires when a session begins
- `UserPromptSubmit` — fires when the user submits a prompt
- `Stop` — fires when the agent stops (can block/retry)

### 2. No ExitPlanMode Equivalent

There is NO hook that fires when the model presents a plan and waits for approval before any execution begins. Codex's "Plan mode" is a UI collaboration mode (the TUI prompts "implement this plan?") — it is not a hook insertion point. The plan approval is handled interactively in the TUI, not via a spawned subprocess hook.

The `PreToolUse` hook fires per-command immediately before each shell execution. It can block individual commands but does not intercept the plan as a whole before any commands run.

### 3. Config File Path and Format

Config file: `~/.codex/hooks.json` (user scope) or `.codex/hooks.json` (project scope, discovered from the git project root)

The discovery logic reads `hooks.json` from each config layer's `.codex/` folder. User-level config lives in `~/.codex/hooks.json`. Project-level config lives in `.codex/hooks.json` at the project root.

Format is JSON (not TOML — despite `config.toml` being the main config file, hooks use a separate `hooks.json`):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "^Bash$",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/plan-reviewer",
            "timeout": 600,
            "statusMessage": "Reviewing command..."
          }
        ]
      }
    ]
  }
}
```

The `matcher` field is a regex applied to the tool name. For shell commands the tool name is always `"Bash"`. The `matcher` is optional (omit to match all tools).

### 4. Wire Format — stdin payload to the hook command

The hook command receives JSON on stdin. For `PreToolUse`:

```json
{
  "session_id": "<uuid>",
  "turn_id": "<string>",
  "transcript_path": "/path/to/transcript" | null,
  "cwd": "/working/directory",
  "hook_event_name": "PreToolUse",
  "model": "gpt-4o",
  "permission_mode": "default" | "acceptEdits" | "plan" | "dontAsk" | "bypassPermissions",
  "tool_name": "Bash",
  "tool_input": {
    "command": "the shell command string"
  },
  "tool_use_id": "<string>"
}
```

Note: `turn_id` is a Codex-specific extension not present in Claude Code's hook format.

### 5. Hook Response Format — stdout from the hook command

To **allow** the command: exit 0 with empty stdout, or exit 0 with JSON `{"continue": true}`.

To **block** the command: either:
- Exit with code 2, write the block reason to **stderr**
- Exit 0, write JSON to stdout:
  ```json
  {
    "hookSpecificOutput": {
      "hookEventName": "PreToolUse",
      "permissionDecision": "deny",
      "permissionDecisionReason": "User rejected this command"
    }
  }
  ```

Deprecated but still supported: `{"decision": "block", "reason": "..."}` (Claude Code-compatible format — same field names, accepted by Codex).

The `"ask"` value for `permissionDecision` is present in the schema but currently not supported — Codex treats it as a failure (fails open, does not block).

### 6. How Commands Are Invoked

The hook command is invoked via a shell. The `command` field in `hooks.json` is a shell command string passed to the configured shell (defaults to system shell). Input JSON is piped to stdin. The hook runs synchronously (async hooks are not yet supported — skipped with a warning). Default timeout is 600 seconds.

This is the same spawn-and-pipe model as Claude Code: suitable for the plan-reviewer binary.

### 7. Reference Implementations

None found in the public ecosystem. The integration test suite in `codex-rs/core/tests/suite/hooks.rs` contains Python script examples used as test fixtures — these demonstrate the stdin/stdout contract but are not external tools.

---

## Key Differences vs. Claude Code ExitPlanMode

| Aspect | Claude Code ExitPlanMode | Codex PreToolUse |
|--------|--------------------------|------------------|
| Trigger point | Once, after plan is presented, before any execution | Once per command, immediately before each shell invocation |
| Plan content in payload | Full plan JSON with all proposed steps | Single command string (`tool_input.command`) |
| Blocking scope | Blocks the entire plan execution | Blocks only that one command |
| Config file | `~/.claude/settings.json` | `~/.codex/hooks.json` |
| Config format | JSON, `hooks` key with event arrays | JSON, `hooks` key with event arrays (nearly identical) |
| Response field | `decision: "approve" | "deny"` | `hookSpecificOutput.permissionDecision: "allow" | "deny"` |
| Legacy compat | N/A | Accepts `decision: "block"` (Claude-style) |

---

## Complexity Estimate

**Implementation complexity: MEDIUM**

What works cleanly:
- The spawn-and-pipe invocation model is identical to Claude Code
- The config file format is structurally the same (JSON, `hooks` key)
- A single binary can serve both integrations with different argument flags
- The block/allow response is simpler than Claude Code (exit code 2 + stderr is the simplest path)

What is harder:
- No plan-level hook. The reviewer would receive one command at a time, not a full plan. The UI would need to present individual command approvals, not a plan overview.
- `tool_input.command` is a flat shell string, not structured JSON like Claude Code's ExitPlanMode payload. There is no list of file edits or plan steps in the PreToolUse payload — just the raw command.
- The `transcript_path` field (when non-null) points to the session transcript file on disk. A reviewer could read this to reconstruct context, but it is not guaranteed to be present.
- The integration installs per-tool blocking (each `ls`, `echo`, `cat` would trigger the hook), not a once-per-session plan review. This may feel intrusive without careful matcher configuration.

**A viable but limited integration:** The plan-reviewer could register as a `PreToolUse` hook matching `^Bash$` and show each command for approval in the browser UI. This is closer to a command-by-command approval tool than a plan reviewer. It does not give the user a pre-execution overview of the full plan.

---

## Recommendation

**DEFER for v0.3.0. Consider as a separate feature track (v0.4.0 or later).**

Rationale:
1. No ExitPlanMode analog exists. The integration would be fundamentally different in UX — command-by-command approval rather than plan-level approval. This is a different product, not an extension of the existing one.
2. The payload contains a single shell command string, not a structured plan. The existing plan-reviewer UI (designed for structured plan JSON + file diffs) would require significant adaptation.
3. The config wire format is compatible enough that the binary invocation pattern would work, but the value proposition to users is weaker.
4. The Claude Code integration is the primary value driver. Codex integration adds surface area and testing complexity without a clear match to the "plan reviewer" framing.

If Codex integration is prioritized later, the correct framing is "command approver" not "plan reviewer", with a separate UI mode. The config entry would go in `~/.codex/hooks.json` under `PreToolUse`.

---

## Sources

- `codex-rs/hooks/src/engine/config.rs` — `HooksFile`, `HookHandlerConfig` types; JSON config schema
- `codex-rs/hooks/src/engine/discovery.rs` — config file location logic (`hooks.json` in `.codex/` folder per config layer)
- `codex-rs/hooks/src/engine/command_runner.rs` — stdin pipe invocation model, timeout handling
- `codex-rs/hooks/src/events/pre_tool_use.rs` — PreToolUse event handler; block/allow logic; exit code semantics
- `codex-rs/hooks/src/schema.rs` — wire type definitions; `HookUniversalOutputWire`, `PreToolUseCommandInput`, `PreToolUseCommandOutputWire`
- `codex-rs/hooks/schema/generated/pre-tool-use.command.input.schema.json` — canonical input schema
- `codex-rs/hooks/schema/generated/pre-tool-use.command.output.schema.json` — canonical output schema
- `codex-rs/core/tests/suite/hooks.rs` — integration test examples showing hooks.json format
- `codex-rs/core/src/tools/handlers/plan.rs` — confirms plan mode is a UI collaboration mode, not a hook insertion point
- https://github.com/openai/codex (accessed 2026-04-10)
