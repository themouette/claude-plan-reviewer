# Feasibility: GitHub Copilot Integration

**Question:** Does GitHub Copilot (agentic/CLI form) have a hook system for plan/action approval?
**Researched:** 2026-04-10
**Verdict:** PARTIAL — hooks exist and are spawnable, but no plan-level approval hook maps cleanly to ExitPlanMode
**Confidence:** MEDIUM (official GitHub docs, GA announcement, changelog)

---

## 1. Does an Agentic CLI Mode Exist?

YES. GitHub Copilot CLI reached General Availability on 2026-02-25. It is a terminal-native agentic tool — not IDE autocomplete — powered by the same harness as the Copilot cloud coding agent.

It has two modes:
- **Plan mode** (Shift+Tab cycle): Copilot builds a structured implementation plan, asks clarifying questions, and waits for the user to approve before writing code.
- **Autopilot mode** (Shift+Tab cycle): Copilot executes autonomously without stopping for approval.

Plan mode is entirely interactive (terminal UI). There is no stdin/stdout API surface at plan approval time. Approval is a human key-press in the TUI, not a spawned subprocess.

Source: https://github.blog/changelog/2026-01-21-github-copilot-cli-plan-before-you-build-steer-as-you-go/

---

## 2. Hook System

YES, a hook system exists, documented in official GitHub docs under "Hooks configuration."

### Hook Types (6 total)

| Event | Trigger | Can Block? |
|-------|---------|------------|
| `sessionStart` | New or resumed session | No |
| `sessionEnd` | Session completes/terminates | No |
| `userPromptSubmitted` | User submits a prompt | No |
| `preToolUse` | Before any tool call (bash, edit, view, create) | YES |
| `postToolUse` | After tool completes | No |
| `errorOccurred` | Error during execution | No |

Only `preToolUse` produces structured output that the agent respects.

### Config File Path

For Copilot CLI: `.github/hooks/*.json` loaded from the **current working directory** (i.e., the project root where the CLI is invoked). Multiple JSON files are merged. No global config path equivalent to `~/.claude/settings.json`.

For cloud agent: same pattern but must be committed to the repository's default branch.

Source: https://docs.github.com/en/copilot/reference/hooks-configuration, https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/use-hooks

### Config File Format

```json
{
  "version": 1,
  "hooks": {
    "preToolUse": [
      {
        "type": "command",
        "bash": "./scripts/my-hook.sh",
        "powershell": "./scripts/my-hook.ps1",
        "cwd": ".github/hooks",
        "timeoutSec": 30
      }
    ]
  }
}
```

The hook entry is a shell script path, not a direct binary path. The script is spawned as a subprocess.

### preToolUse stdin Payload

```json
{
  "timestamp": 1704614600000,
  "cwd": "/path/to/project",
  "toolName": "bash",
  "toolArgs": "{\"command\":\"npm test\"}"
}
```

`toolName` is one of: `bash`, `edit`, `view`, `create`. The `toolArgs` field is a JSON-encoded string.

### preToolUse stdout Response

```json
{
  "permissionDecision": "allow|deny|ask",
  "permissionDecisionReason": "explanation"
}
```

**Critical caveat from official docs:** "only `deny` is currently processed." `allow` and `ask` may be no-ops or partially implemented. Output must be a single-line JSON (use `jq -c`).

Source: https://docs.github.com/en/copilot/reference/hooks-configuration

---

## 3. Is There an ExitPlanMode Equivalent?

NO. There is no hook that fires at plan approval time. The six hook types cover session lifecycle and individual tool calls, not plan generation or plan approval. Plan approval is a TUI interaction only.

The closest analog is `preToolUse`, which fires before each individual tool execution during the implementation phase — after the plan has already been approved by the user in the TUI. This is fundamentally different from Claude Code's `ExitPlanMode`, which fires once when the entire plan is approved.

---

## 4. Hook System Type: Config vs Plugin

CONFIG, not plugin. The hook system is a declarative JSON config file that points to shell scripts. There is no plugin API, no SDK, no binary registration mechanism. The shell script is what gets spawned — so a Rust binary could be invoked via a wrapper `.sh` script, but there is no direct binary entry point like Claude Code's settings.json hook entry.

---

## 5. Reference Implementations

None found. No third-party external plan reviewers for Copilot CLI were identified. The hooks system is new (CLI reached GA in February 2026) and the ecosystem of hook scripts is minimal.

---

## Complexity Estimate vs Claude Code

| Dimension | Claude Code | Copilot CLI |
|-----------|-------------|-------------|
| Hook trigger point | Plan approval (once per plan) | Per-tool-use (every individual tool call) |
| Spawn mechanism | Direct binary in settings.json | Shell script wrapper required |
| Config path | `~/.claude/settings.json` (global) | `.github/hooks/*.json` (per-project CWD) |
| Payload | Full plan JSON with all steps | Single tool call (name + args only) |
| Response contract | `decision: approve|reject` + `reason` | `permissionDecision: allow|deny|ask` |
| Plan visibility | Full plan text in payload | No plan context in payload |
| Implementation confidence | HIGH (proven, GA, documented) | MEDIUM (GA but `allow`/`ask` may be no-ops) |

Integration with Copilot CLI would require:
1. A wrapper `.sh` script per-project (no global registration)
2. Intercepting `preToolUse` events as a proxy for "plan is executing"
3. Accepting that there is no plan-level payload — only individual tool calls are visible
4. Handling `deny` as the only confirmed working response
5. Users manually placing `.github/hooks/` config in each project

This is substantially more friction than Claude Code, and the UX would be inferior: the reviewer would see individual tool calls, not a unified plan.

---

## Recommendation

**DEFER.** Do not include Copilot CLI integration in v0.3.0.

Reasons:
1. No plan-level hook exists. There is no ExitPlanMode equivalent — the integration would be architecturally mismatched (tool-by-tool vs plan-level review).
2. Per-project config only. No global install path means users must manually set up `.github/hooks/` in every project, which conflicts with the "one curl | sh" value proposition.
3. Shell script indirection required. Cannot register the binary directly; a wrapper `.sh` is needed, adding installation complexity.
4. `allow`/`ask` decisions are documented as potentially no-ops. Only `deny` is confirmed to work.
5. Ecosystem is brand new (GA February 2026). Hook usage patterns are not established; the API surface may change.

Reconsider if GitHub adds: (a) a plan-approval hook event, or (b) a global hooks config path. Monitor the `copilot-cli` changelog.

---

## Sources

- [GitHub Copilot CLI reaches GA (2026-02-25)](https://github.blog/changelog/2026-02-25-github-copilot-cli-is-now-generally-available/)
- [Copilot CLI plan mode announcement (2026-01-21)](https://github.blog/changelog/2026-01-21-github-copilot-cli-plan-before-you-build-steer-as-you-go/)
- [Hooks configuration reference](https://docs.github.com/en/copilot/reference/hooks-configuration)
- [Using hooks with Copilot CLI (how-to)](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/use-hooks)
- [Copilot CLI hooks tutorial](https://docs.github.com/en/copilot/tutorials/copilot-cli-hooks)
- [About Copilot CLI](https://docs.github.com/copilot/concepts/agents/about-copilot-cli)
- [github/copilot-cli repository](https://github.com/github/copilot-cli)
