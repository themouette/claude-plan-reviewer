# Phase 6: Gemini CLI Integration - Research

**Researched:** 2026-04-10
**Domain:** Rust integration implementation — Gemini CLI BeforeTool hook, settings.json manipulation, file-based plan reading
**Confidence:** HIGH for hook protocol and config format; MEDIUM for denial/retry behavior (unconfirmed in live test); LOW for exact plan Markdown structure

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INTEG-01 | User can run `plan-reviewer install gemini` to wire plan review into Gemini CLI | Config path confirmed: `~/.gemini/settings.json`; hook entry format confirmed via official docs; install pattern mirrors existing `claude.rs` implementation |
| INTEG-02 | User can run `plan-reviewer uninstall gemini` to remove Gemini CLI hook wiring | Uninstall removes BeforeTool entry matching `"matcher": "exit_plan_mode"` from `settings.json`; idempotent retain-filter pattern from `claude.rs` applies directly |
</phase_requirements>

## Summary

Gemini CLI has a documented hook system (introduced v0.26.0) that exposes `exit_plan_mode` as a `BeforeTool`-interceptable tool, providing a functional equivalent to Claude Code's `ExitPlanMode` PermissionRequest hook. The protocol differences are bounded and well-understood: config file is `~/.gemini/settings.json` (parallel to `~/.claude/settings.json`), the hook entry nests under `hooks.BeforeTool[].hooks[]` rather than `hooks.PermissionRequest[]`, and the plan content arrives as a filesystem path (`tool_input.plan_path`) rather than inline JSON. The binary must read the plan Markdown from disk before starting the browser UI.

The Phase 5 `Integration` trait is exactly the right abstraction for this phase. The `GeminiIntegration` struct in `src/integrations/gemini.rs` is already wired into the install/uninstall dispatch, returning `Err("not yet implemented")`. Phase 6 replaces that stub with a full implementation following the same patterns established in `claude.rs`. The only non-trivial new concern is the plan-reading path: the `run_hook_flow` in `main.rs` currently reads `hook_input.tool_input.plan` (inline), but Gemini sends `hook_input.tool_input.plan_path` (file path). The hook flow needs to detect which field is populated and read the file when `plan_path` is provided.

One important default timeout difference: Gemini CLI's default hook timeout is **60 seconds**, which is too short for interactive browser review. The hook entry written by `install gemini` must include an explicit `"timeout": 300000` (5 minutes) or longer. Claude Code has no documented timeout limit for PermissionRequest hooks; Gemini CLI enforces one.

**Primary recommendation:** Implement `GeminiIntegration` in `src/integrations/gemini.rs` following the `claude.rs` pattern exactly, then extend `run_hook_flow` in `main.rs` to handle the `plan_path` file-read path alongside the existing inline `plan` field path.

## Standard Stack

### Core (all already in Cargo.toml — no new dependencies)

| Library | Version | Purpose | Relevance to Phase |
|---------|---------|---------|---------------------|
| serde_json | 1.x | JSON read/write for `~/.gemini/settings.json` | Install/uninstall uses same `serde_json::Value` manipulation as claude.rs |
| std::fs | stdlib | Read plan Markdown from `plan_path` | `fs::read_to_string(plan_path)` — no new crate needed |
| clap | 4.x | CLI dispatch already handles `install gemini` | No changes needed |

**No new Cargo dependencies required for Phase 6.** [VERIFIED: crate search not needed — all operations are JSON manipulation + file read, already covered by `serde_json` and stdlib.]

## Architecture Patterns

### Recommended Project Structure (no new files for Rust side)

The stub at `src/integrations/gemini.rs` is already wired. Phase 6 fills in its three methods:

```
src/integrations/
├── mod.rs          # Integration trait, registry, IntegrationSlug — NO CHANGES
├── claude.rs       # Reference implementation — READ THIS, mirror its pattern
├── gemini.rs       # PHASE 6: replace stub with full implementation
└── opencode.rs     # Stub — no changes
src/main.rs         # PHASE 6: extend run_hook_flow to handle plan_path
src/hook.rs         # PHASE 6: extend ToolInput to add plan_path field
```

### Pattern 1: Gemini settings.json Hook Entry Format

**What:** The hook entry written into `~/.gemini/settings.json` by `plan-reviewer install gemini`.

**Config file path:** `{home}/.gemini/settings.json`

**Hook entry structure:**

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
            "command": "/path/to/plan-reviewer",
            "timeout": 300000
          }
        ]
      }
    ]
  }
}
```

**Critical:** `"timeout": 300000` (5 minutes) is MANDATORY. Gemini CLI's default is 60 seconds — without an override, the hook will time out before the user finishes reviewing the plan. [CITED: geminicli.com/docs/hooks/ — "60-second default when type is 'command'"]

**Matcher is a regex:** `"exit_plan_mode"` is treated as a regular expression. An exact-match literal string works fine here (no special regex characters needed). [CITED: geminicli.com/docs/hooks/index.md]

**Idempotency key:** Detect existing installation by scanning `settings["hooks"]["BeforeTool"]` for an entry with any `hooks[]` element containing `"name": "plan-reviewer"`. The binary path is intentionally NOT used as the idempotency key (mirrors claude.rs convention). Alternative idempotency key: any BeforeTool entry whose `hooks[]` array contains a command matching the current binary path — both approaches are valid; use the name-based check for robustness against binary relocation.

### Pattern 2: BeforeTool Hook stdin Payload (Gemini → plan-reviewer)

**What Gemini sends on stdin when `exit_plan_mode` fires:**

```json
{
  "session_id": "<string>",
  "transcript_path": "<absolute path to session transcript>",
  "cwd": "<current working directory>",
  "hook_event_name": "BeforeTool",
  "timestamp": "<ISO 8601>",
  "tool_name": "exit_plan_mode",
  "tool_input": {
    "plan_path": "<absolute path to .md plan file>"
  },
  "mcp_context": null,
  "original_request_name": "exit_plan_mode"
}
```

[CITED: geminicli.com/docs/hooks/reference/ (base fields); geminicli.com/docs/cli/plan-mode/ (plan_path field)]

**Key difference from Claude Code:** `tool_input.plan_path` contains a filesystem path to a Markdown file. Claude Code sends `tool_input.plan` with the plan text inline. The binary must read the file.

**`plan_path` location:** `~/.gemini/tmp/<project>/<session-uuid>/plans/<filename>.md`
This path is absolute and fully resolved when the hook fires. [CITED: geminicli.com/docs/tools/planning/; github.com/google-gemini/gemini-cli/issues/20549]

**Only confirmed `tool_input` field:** `plan_path`. No other fields in `tool_input` are documented for `exit_plan_mode`. Do NOT assume additional fields exist — if present, they will be captured by the existing `#[serde(flatten)] extra` field in `ToolInput`. [ASSUMED: no other fields; not exhaustively tested]

### Pattern 3: Hook stdout Response (plan-reviewer → Gemini)

**Allow decision:**
```json
{ "decision": "allow" }
```

**Deny decision:**
```json
{
  "decision": "deny",
  "reason": "Plan rejected: <annotation summary>"
}
```

**Critical difference from Claude Code:** Gemini uses a flat `{ "decision": "...", "reason": "..." }` response, NOT Claude Code's `{ "hookSpecificOutput": { "hookEventName": "...", "decision": { "behavior": "...", "message": "..." } } }` envelope. [CITED: geminicli.com/docs/hooks/reference/]

This means the hook response format differs by integration. The `HookOutput` struct in `hook.rs` currently only knows about Claude Code's format. Phase 6 must produce the correct format for Gemini.

**Additional response fields available (optional):**
- `systemMessage`: String displayed to user in Gemini CLI terminal
- `suppressOutput`: Boolean to hide hook metadata from logs
- `continue`: Boolean — if `false`, kills entire agent loop (use sparingly)

**Recommendation for denial:** Use `{ "decision": "deny", "reason": "<message>", "systemMessage": "Plan denied by plan-reviewer. Please revise." }` — the `reason` goes to the agent as a tool error, `systemMessage` shows the user a readable message in the terminal. [CITED: geminicli.com/docs/hooks/writing-hooks/]

### Pattern 4: Extending main.rs for plan_path

The current `run_hook_flow` in `main.rs` reads plan content like this:

```rust
// Current (Claude Code only):
let plan_md = hook_input.tool_input.plan.unwrap_or_default();
```

Phase 6 must handle both:

```rust
// Extended for both Claude Code (inline) and Gemini (file path):
let plan_md = if let Some(plan) = hook_input.tool_input.plan {
    // Claude Code: plan content is inline
    plan
} else if let Some(plan_path) = hook_input.tool_input.plan_path {
    // Gemini CLI: plan content is at this filesystem path
    match std::fs::read_to_string(&plan_path) {
        Ok(content) => content,
        Err(e) => {
            eprintln!("Failed to read plan file at {}: {}", plan_path, e);
            std::process::exit(1);
        }
    }
} else {
    // Neither field present — proceed with empty plan (existing behavior)
    String::new()
};
```

**`hook.rs` change required:** Add `plan_path: Option<String>` to `ToolInput`:

```rust
#[derive(Deserialize, Debug)]
pub struct ToolInput {
    pub plan: Option<String>,           // Claude Code: inline plan content
    pub plan_path: Option<String>,      // Gemini CLI: path to plan .md file
    #[serde(flatten)]
    #[allow(dead_code)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}
```

### Pattern 5: Output Format Routing

Gemini CLI expects a different JSON envelope than Claude Code. Two approaches:

**Option A (Recommended): Detect integration from stdin payload**

`hook_event_name` field:
- Claude Code sends: `"PermissionRequest"` (for ExitPlanMode hook)
- Gemini CLI sends: `"BeforeTool"`

Detect in `run_hook_flow`, emit appropriate output:

```rust
// After receiving decision from browser UI:
let output_json = match hook_input.hook_event_name.as_str() {
    "BeforeTool" => {
        // Gemini CLI format
        if decision.behavior == "allow" {
            serde_json::json!({ "decision": "allow" })
        } else {
            serde_json::json!({
                "decision": "deny",
                "reason": decision.message.unwrap_or_default(),
                "systemMessage": "Plan denied by plan-reviewer."
            })
        }
    }
    _ => {
        // Claude Code format (existing HookOutput struct)
        serde_json::to_value(HookOutput::from_decision(&decision)).unwrap()
    }
};
serde_json::to_writer(std::io::stdout(), &output_json).unwrap();
```

**Option B:** Add a `GeminiHookOutput` struct to `hook.rs` with its own `Serialize` impl. Cleaner typing but more code. Use if the team prefers explicit types over `serde_json::json!()` macros.

### Anti-Patterns to Avoid

- **Wrong JSON envelope for Gemini:** Using `HookOutput` (Claude Code format) for Gemini responses will cause Gemini to see unexpected JSON — it will likely treat it as an allow since no `decision` key is present at the top level. Always check `hook_event_name` to select the right output format.
- **Omitting `timeout` in the hook entry:** The 60-second default kills the hook before the user can review. Always write `"timeout": 300000` (or higher) in the installed hook entry.
- **Assuming plan content is inline:** Gemini always writes to `plan_path`. Never try to read `tool_input.plan` for Gemini payloads.
- **Using `continue: false` for denial:** This kills the entire Gemini agent loop. Use `decision: "deny"` instead so the user can revise the plan. [CITED: geminicli.com/docs/hooks/best-practices/]
- **Matching idempotency by binary path:** Binary may move after install. Match on name `"plan-reviewer"` or on matcher `"exit_plan_mode"`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON config read/write | Custom file parser | `serde_json::Value` (already in Cargo.toml) | The existing `claude.rs` install/uninstall is a direct template; copy-paste and adjust key paths |
| Plan file reading | Any custom reader | `std::fs::read_to_string` | Plan is a UTF-8 Markdown file; stdlib handles it |
| Integration detection | Separate flag or CLI arg | Detect from `hook_event_name` field in stdin | Field is always present in both Claude Code and Gemini payloads; zero extra state needed |

## Common Pitfalls

### Pitfall 1: Missing Timeout Override

**What goes wrong:** `plan-reviewer install gemini` writes a hook entry without `"timeout"`. Gemini CLI defaults to 60 seconds. The browser opens, the user starts reviewing, and at 60 seconds Gemini kills the hook process and treats it as a non-fatal error — continuing as if the hook allowed the tool.

**Why it happens:** Developers copy the Claude Code hook entry which has no timeout field (Claude Code PermissionRequest hooks don't enforce a timeout).

**How to avoid:** `gemini_hook_entry()` function in `gemini.rs` must hardcode `"timeout": 300000`. Consider making it configurable in a future phase.

**Warning signs:** During testing, hook returns before the user clicks Approve/Deny.

### Pitfall 2: Wrong Output Envelope

**What goes wrong:** `run_hook_flow` writes `HookOutput` (Claude Code's `hookSpecificOutput` wrapper) to stdout when responding to a Gemini hook invocation. Gemini CLI does not recognize this format, interprets the absence of a top-level `decision` key as an allow, and proceeds regardless of what the user clicked.

**Why it happens:** `run_hook_flow` was written before Gemini was supported; it always emits `HookOutput`.

**How to avoid:** Detect integration via `hook_event_name` ("BeforeTool" = Gemini, "PermissionRequest" = Claude Code) and select the appropriate serializer.

**Warning signs:** Deny button appears to work in the UI but Gemini keeps running the plan.

### Pitfall 3: Denial Triggers Agent Retry Loop

**What goes wrong:** When the hook returns `decision: "deny"`, Gemini CLI sends the `reason` back to the model as a tool error. The model may automatically call `exit_plan_mode` again (with the same plan). This creates a loop: user denies, model retries, UI opens again.

**Why it happens:** Gemini CLI's BeforeTool denial is not a terminal state — it's feedback to the model. The model decides whether to retry.

**How to avoid:** Include clear human-readable rejection notes in the `reason` field so the model understands the plan needs revision. The `systemMessage` field can inform the user that the model may continue planning.

**Risk level:** MEDIUM — requires integration testing with actual Gemini CLI binary to confirm whether looping occurs in practice. [ASSUMED: loop may occur; not confirmed in live test]

**Warning signs:** Browser UI opens immediately after the user clicks Deny.

**Mitigation (if loop is confirmed):** Use `"continue": false` as a last resort to terminate the session, but document this behavior for users. Alternatively, the denial `reason` could instruct the model to present an updated plan and wait for user `/plan` toggle — though this relies on model cooperation.

### Pitfall 4: plan_path Points to Non-Existent File

**What goes wrong:** The hook fires, `plan_path` is parsed from stdin, but `fs::read_to_string` fails because the file doesn't exist.

**Why it happens:** Can occur if the session's `plans/` directory was cleaned up, or if a path validation bug in Gemini CLI sends an incorrect path (as seen in issue #20549).

**How to avoid:** Emit a clear `eprintln!` with the path, then either exit(1) or emit a `deny` with a diagnostic message. Do not silently fall back to empty plan.

**Warning signs:** Browser opens with empty plan content.

### Pitfall 5: Non-Interactive / YOLO Mode

**What goes wrong:** When Gemini CLI runs in a non-interactive environment (CI/CD, headless), it auto-approves `exit_plan_mode` without user prompting — AND according to docs, hooks still fire in this path (unlike manual Shift+Tab). The browser opens but no human is present.

**Why it happens:** The non-interactive auto-approve behavior and BeforeTool hook firing are separate. The hook spawns the browser regardless.

**How to avoid:** The existing `--no-browser` flag and printed URL allow the user to handle this. Document that non-interactive use requires `--no-browser` + timeout handling. [ASSUMED: hooks fire in non-interactive mode; not explicitly confirmed in docs]

## Code Examples

### gemini.rs — Full Implementation Skeleton

```rust
// Source: mirrors claude.rs pattern from the codebase
use super::{InstallContext, Integration};
use std::path::PathBuf;

pub struct GeminiIntegration;

impl Integration for GeminiIntegration {
    fn install(&self, ctx: &InstallContext) -> Result<(), String> {
        let binary_path = ctx.binary_path.as_deref()
            .ok_or_else(|| "install requires binary_path".to_string())?;
        let settings_path = gemini_settings_path(&ctx.home);

        let mut root = read_or_create_json(&settings_path)?;

        // Ensure root["hooks"]["BeforeTool"] exists as an array
        ensure_hooks_before_tool_array(&mut root, &settings_path)?;

        if gemini_is_installed(&root) {
            println!("plan-reviewer: BeforeTool hook already configured (no changes made)");
            return Ok(());
        }

        root["hooks"]["BeforeTool"]
            .as_array_mut()
            .expect("ensured above")
            .push(gemini_hook_entry(binary_path));

        write_json(&settings_path, &root)
    }

    fn uninstall(&self, ctx: &InstallContext) -> Result<(), String> { ... }

    fn is_installed(&self, ctx: &InstallContext) -> bool { ... }
}

fn gemini_settings_path(home: &str) -> PathBuf {
    PathBuf::from(home).join(".gemini/settings.json")
}

fn gemini_hook_entry(binary_path: &str) -> serde_json::Value {
    serde_json::json!({
        "matcher": "exit_plan_mode",
        "hooks": [
            {
                "name": "plan-reviewer",
                "type": "command",
                "command": binary_path,
                "timeout": 300000
            }
        ]
    })
}

fn gemini_is_installed(settings: &serde_json::Value) -> bool {
    settings["hooks"]["BeforeTool"]
        .as_array()
        .map(|arr| {
            arr.iter().any(|entry| {
                entry["hooks"].as_array()
                    .map(|hooks| hooks.iter().any(|h| h["name"].as_str() == Some("plan-reviewer")))
                    .unwrap_or(false)
            })
        })
        .unwrap_or(false)
}
```

### hook.rs — Extended ToolInput

```rust
// Source: existing hook.rs, adding plan_path field
#[derive(Deserialize, Debug)]
pub struct ToolInput {
    pub plan: Option<String>,        // Claude Code: inline plan text
    pub plan_path: Option<String>,   // Gemini CLI: path to plan .md file
    #[serde(flatten)]
    #[allow(dead_code)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}
```

### main.rs — Unified plan extraction

```rust
// Source: extension of existing run_hook_flow pattern
let plan_md = if let Some(inline_plan) = hook_input.tool_input.plan {
    inline_plan
} else if let Some(ref path) = hook_input.tool_input.plan_path {
    std::fs::read_to_string(path).unwrap_or_else(|e| {
        eprintln!("Failed to read plan at {}: {}", path, e);
        std::process::exit(1);
    })
} else {
    String::new()
};
```

### main.rs — Integration-aware output

```rust
// Detect integration and emit correct response format
let json_output: serde_json::Value = match hook_input.hook_event_name.as_str() {
    "BeforeTool" => {
        // Gemini CLI format
        match decision.behavior.as_str() {
            "allow" => serde_json::json!({ "decision": "allow" }),
            _ => serde_json::json!({
                "decision": "deny",
                "reason": decision.message.unwrap_or_default(),
                "systemMessage": "Plan denied by plan-reviewer. Please revise the plan."
            }),
        }
    }
    _ => {
        // Claude Code format (PermissionRequest)
        serde_json::to_value(match decision.behavior.as_str() {
            "allow" => HookOutput::allow(),
            _ => HookOutput::deny(decision.message.unwrap_or_default()),
        }).unwrap()
    }
};
serde_json::to_writer(std::io::stdout(), &json_output).expect("stdout write failed");
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global-only Gemini settings | User + project + system precedence | Gemini CLI v0.26.0 hooks launch | Install to `~/.gemini/settings.json` is user-scoped (correct for plan-reviewer) |
| Fixed hook timeout (no option) | Configurable `timeout` per hook (ms) | Gemini CLI v0.26.0 | Must include `"timeout": 300000` to avoid 60s kill |
| No migration tooling | `gemini hooks migrate --from-claude` command | 2025 PR #14225, #14307 | Users migrating from Claude Code can convert automatically; our install should still write correct native format |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Denial retry: model may call `exit_plan_mode` again after hook denies | Common Pitfalls #3 | If retry does NOT occur, no mitigation needed; if it does, UI re-opens unexpectedly |
| A2 | `tool_input` for `exit_plan_mode` has only `plan_path` — no other fields | Architecture Pattern 2 | If other fields exist (e.g., plan summary), the code still works (captured by `extra`) but we miss potentially useful metadata |
| A3 | Hooks fire in non-interactive / YOLO mode | Common Pitfalls #5 | If hooks do NOT fire in non-interactive mode, the concern is moot |
| A4 | Idempotency key: match on `name == "plan-reviewer"` in BeforeTool hooks array | Architecture Pattern 1 | If user renamed their hook, we'd create a duplicate — acceptable tradeoff vs. fragile binary-path matching |

## Open Questions

1. **Denial retry loop confirmation**
   - What we know: Docs say denial sends `reason` to agent as tool error; agent "may retry or respond"
   - What's unclear: Does the Gemini CLI model reliably retry `exit_plan_mode` immediately, or does it wait for user input?
   - Recommendation: Include an integration test that denies once and observes whether a second hook invocation follows within 30 seconds. If yes, document in user-facing help text.

2. **Gemini plan Markdown structure**
   - What we know: Plans are `.md` files written to `~/.gemini/tmp/<project>/<session>/plans/`
   - What's unclear: Does Gemini CLI structure plans with specific headings (## Steps, ## Risks) or is it free-form?
   - Recommendation: Not blocking — `server.rs` renders any Markdown. The format doesn't affect the hook flow.

3. **BeforeTool hooks in non-interactive mode**
   - What we know: Docs say non-interactive mode auto-approves `exit_plan_mode` without user prompt; docs are silent on whether BeforeTool hooks fire first
   - What's unclear: Does the auto-approve bypass BeforeTool hooks or run them?
   - Recommendation: Not blocking for Phase 6 launch; document as a known gap. Test with `gemini --approval-mode=auto` or CI environment.

## Environment Availability

> This phase is code/config-only — it writes a JSON file and reads a Markdown file. No external tools required beyond the existing Rust toolchain.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Rust toolchain | Compilation | Confirmed (project builds today) | See Cargo.toml | — |
| Gemini CLI binary | Integration testing | Unknown — depends on developer machine | N/A | Mock stdin with example payload; no live test needed for unit/integration tests |

**Missing dependencies with no fallback:**
- None blocking implementation. Gemini CLI binary is only needed for end-to-end smoke testing, not for the Rust unit tests.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — local tool, no auth |
| V3 Session Management | no | N/A — stateless hook binary |
| V4 Access Control | yes | File written only to `~/.gemini/settings.json`; `plan_path` used read-only; no user-supplied path fragments accepted |
| V5 Input Validation | yes | `plan_path` from stdin — validate it is a readable file before passing to `fs::read_to_string`; do not execute the path |
| V6 Cryptography | no | N/A |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `plan_path` | Tampering | `plan_path` is used for read-only `fs::read_to_string`; never executed or passed to shell. `HOME`-based config path uses only the `HOME` env var, no user-supplied fragments (mirrors existing `claude_settings_path` pattern) |
| Corrupted `settings.json` | Tampering | Return `Err` if JSON parse fails — existing `install_claude` and `uninstall_claude` pattern already handles this; `gemini.rs` must mirror it |
| Stdout pollution | Spoofing | All debug output goes to `stderr` (existing `eprintln!` convention); only the final JSON goes to `stdout`. Any `println!` in hook flow would corrupt the Gemini response — use `eprintln!` exclusively in hook-flow paths |

## Sources

### Primary (HIGH confidence)
- [geminicli.com/docs/hooks/reference/](https://geminicli.com/docs/hooks/reference/) — BeforeTool stdin payload schema, stdout response fields, decision values, exit code semantics, timeout default
- [geminicli.com/docs/hooks/](https://geminicli.com/docs/hooks/) — Hook configuration format in settings.json, BeforeTool structure, matcher field, command type fields
- [geminicli.com/docs/cli/plan-mode/](https://geminicli.com/docs/cli/plan-mode/) — `plan_path` field in `tool_input`, plans directory path pattern
- [geminicli.com/docs/tools/planning/](https://geminicli.com/docs/tools/planning/) — `exit_plan_mode` tool parameter documentation: `plan_path` is the only documented field
- [geminicli.com/docs/hooks/writing-hooks/](https://geminicli.com/docs/hooks/writing-hooks/) — Writing hooks guide: stdout-only JSON, stderr for logs, decision/reason pattern
- [geminicli.com/docs/hooks/best-practices/](https://geminicli.com/docs/hooks/best-practices/) — `deny` vs `continue: false` behavioral differences
- `src/integrations/claude.rs` (codebase, read directly) — Reference implementation: install/uninstall/is_installed pattern with `serde_json::Value` manipulation, idempotency via pre-check, error handling convention
- `src/integrations/mod.rs` (codebase, read directly) — `Integration` trait definition, `InstallContext` struct, `get_integration` registry
- `src/hook.rs` (codebase, read directly) — Current `HookInput`/`ToolInput`/`HookOutput` structs
- `src/main.rs` (codebase, read directly) — `run_hook_flow`, `async_main`, plan extraction pattern

### Secondary (MEDIUM confidence)
- [github.com/google-gemini/gemini-cli/issues/20549](https://github.com/google-gemini/gemini-cli/issues/20549) — Confirms `plan_path` structure: `~/.gemini/tmp/<project>/<session-uuid>/plans/<name>.md`; confirms path validation behavior
- [.planning/research/GEMINI-INTEGRATION.md](../.planning/research/GEMINI-INTEGRATION.md) — Feasibility research from earlier phase: protocol comparison table, complexity estimate

### Tertiary (LOW confidence)
- WebSearch results on denial/retry behavior — multiple sources mention agent "may retry" but no authoritative confirmation of loop behavior in practice

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; existing `serde_json` + stdlib cover everything
- Architecture: HIGH for install/uninstall (mirrors confirmed claude.rs pattern); MEDIUM for output format routing (logic clear, not yet tested live)
- Pitfalls: HIGH for timeout (confirmed default = 60s); HIGH for wrong JSON envelope; MEDIUM for denial retry (plausible but unconfirmed)

**Research date:** 2026-04-10
**Valid until:** 2026-07-10 (Gemini CLI hook API is documented and stable; fast-moving project — recheck if Gemini CLI major version changes)
