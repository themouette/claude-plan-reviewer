# Phase 29: Code Review Integration - Research

**Researched:** 2026-05-26
**Domain:** Rust CLI subcommand + Claude Code plugin wiring + hooks.json PreToolUse
**Confidence:** HIGH

## Summary

Phase 29 adds the final integration layer connecting the code review UI (built in Phases 24-28) to Claude Code's slash command and pre-PR hook mechanisms. It introduces a `plan-reviewer code-review` subcommand that opens the browser at `/code-review` and wires that into the Claude plugin via a `commands/code-review.md` slash command file and a `PreToolUse` hook entry in `hooks.json` that intercepts `gh pr create` / `git push` Bash commands.

The Rust server already routes `/code-review` to `CodeReviewApp` (the React frontend does pathname routing in `main.tsx`). The server does NOT need to know about the `/code-review` path — it is purely a frontend SPA route served by the existing SPA fallback. The `code-review` subcommand therefore only needs to start the server (no plan content needed) and open the browser at `http://127.0.0.1:{port}/code-review` instead of `/`.

The install/uninstall pattern is identical to Phase 10 (the `annotate` slash command). All machinery — `InstallContext`, `Integration` trait, `claude_plugin_dir()`, idempotency logic, `remove_dir_all` — is already in place in `src/integrations/claude.rs`. This phase is an extension of the existing install path: add `commands/code-review.md` write + a second `PreToolUse` hook entry to `hooks.json`, both wired through the existing `install()` function.

**Primary recommendation:** Add a `Commands::CodeReview` variant to `main.rs`, extend `claude.rs` install to also write `commands/code-review.md` and add a `PreToolUse` entry to `hooks.json`, with full unit and integration tests following the existing pattern in `tests/integration/install_uninstall.rs`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INTEG-01 | User can invoke code review via a slash command | `commands/code-review.md` written by `install()`, Claude plugin loads it as `/plan-reviewer:code-review` |
| INTEG-02 | Agent can trigger code review automatically via a pre-PR hook | `PreToolUse` hook with `matcher: "Bash"` and `if: "Bash(gh pr create*)"` / `"Bash(git push *)"` wired in `hooks.json` |
| INTEG-03 | `plan-reviewer install` wires up slash command + hook; `uninstall` removes them | The whole plugin directory is removed on uninstall (existing `remove_dir_all` behavior) — already covers both new files |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `code-review` subcommand dispatch | Rust binary (main.rs) | — | All subcommands are dispatched from `main()` via `clap` |
| Start server + open browser at `/code-review` | Rust binary (main.rs) | — | Reuses `start_server()` from `server.rs`; url includes `/code-review` path segment |
| Serve `/code-review` SPA route | Existing SPA fallback (server.rs) | — | `axum_embed` `FallbackBehavior::Ok` already serves `index.html` for any unmatched path |
| `code-review.md` slash command prompt | Claude Code plugin file system | — | Plain Markdown file written by `install()` at `commands/code-review.md` |
| Pre-PR hook entry | `hooks.json` in plugin directory | — | Add `PreToolUse` array alongside existing `PermissionRequest` array |
| Install/uninstall file writes | `src/integrations/claude.rs` | — | Extends existing `install()` function |
| Integration test coverage | `tests/integration/install_uninstall.rs` | — | Follows existing `assert_cmd` pattern |

## Standard Stack

All required tools are already in `Cargo.toml` — no new dependencies.

### Core (already present)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| clap | 4.x (4.6.0) | CLI subcommand parsing | Already used for all subcommands |
| serde_json | 1.x | hooks.json / settings.json manipulation | Already used throughout |
| webbrowser | 1.x | Open browser tab | Already used in `async_main` |
| tokio | 1.x | Async runtime for server | Already used |
| axum | 0.8.x | HTTP server | Already used |
| tempfile | 3.x (dev) | Test HOME isolation | Already used in all install tests |
| assert_cmd | 2.x (dev) | Integration test binary invocation | Already used |

### No new packages needed

No new `Cargo.toml` entries are required for this phase.

## Package Legitimacy Audit

No new packages being installed in this phase — all dependencies are already in `Cargo.toml`.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
plan-reviewer code-review
         │
         ▼
    main.rs dispatch
    Commands::CodeReview
         │
         ├─► start_server("", "Approve", "Deny", port)   ← plan_md is empty string
         │        │
         │        └─► axum server binds on 127.0.0.1:{port}
         │                 │
         │                 ├─► /api/diff/branch, /api/commits, /api/diff/commit/:sha
         │                 ├─► /api/ping
         │                 └─► SPA fallback → index.html for /code-review
         │
         └─► webbrowser::open("http://127.0.0.1:{port}/code-review")

plan-reviewer install claude
         │
         ├─► write commands/code-review.md       (INTEG-01)
         ├─► rewrite hooks.json with PreToolUse  (INTEG-02)
         └─► settings.json (no change to existing logic)

/code-review (slash command) → Claude runs plan-reviewer code-review via Bash
PreToolUse hook (gh pr create) → plan-reviewer code-review intercepts
         │
         └─► browser opens /code-review, user reviews diff, sends structured feedback
```

### Recommended Project Structure

No structural changes needed — all new code fits into existing files:

```
src/
├── main.rs                           ← add Commands::CodeReview, run_code_review_flow()
├── integrations/
│   └── claude.rs                     ← extend install() with code-review.md + PreToolUse entry
tests/
└── integration/
    └── install_uninstall.rs          ← add code-review install/uninstall tests
```

### Pattern 1: Adding a New Subcommand

**What:** Add `Commands::CodeReview` to `main.rs` parallel to `Commands::Review`.

**When to use:** Any time a new CLI subcommand is needed that opens the review server.

**Example:**
```rust
// Source: existing pattern in main.rs Commands enum
#[derive(Subcommand, Debug)]
enum Commands {
    // ... existing variants ...

    /// Open the code review UI for the current git branch.
    ///
    /// Starts the local server and opens the browser at /code-review.
    /// Does not read stdin — safe to invoke without piped input.
    CodeReview,
}

// In main():
Some(Commands::CodeReview) => {
    run_code_review_flow(cli.no_browser, cli.port);
}
```

**Implementation note:** `run_code_review_flow` is nearly identical to `run_review_flow`, with two differences:
1. It reads no file — passes empty `plan_md` (the plan reviewer UI at `/code-review` ignores plan content)
2. Opens `http://127.0.0.1:{port}/code-review` instead of `/`

The server `start_server()` accepts `plan_md: String` — passing `String::new()` is valid and safe since the `/code-review` route does not fetch `/api/plan`.

**Output format:** Since `code-review` is not wired to a hook that expects JSON on stdout, it can write the review payload JSON to stdout (mirroring the existing `run_review_flow` behavior with `build_opencode_output`), or simply exit 0 silently. For INTEG-02 (pre-PR hook), the payload written to stdout is what the Claude Code `PreToolUse` hook decision uses. Decision: emit the review JSON to stdout so the agent can see structured feedback when invoked from a hook.

**Wait behavior:** The server should block waiting for `POST /api/decide` (same as `run_review_flow`), with the same 540-second timeout watchdog.

### Pattern 2: Extending install() in claude.rs

**What:** The existing `install()` in `src/integrations/claude.rs` already writes `commands/annotate.md`. Phase 29 adds `commands/code-review.md` in the same write sequence.

**When to use:** Every install of the Claude integration should write both command files.

**Example (extending existing code):**
```rust
// After the annotate.md write block, add:
let code_review_content = concat!(/* see code-review.md prompt content below */);
let code_review_path = commands_dir.join("code-review.md");
if let Err(e) = std::fs::write(&code_review_path, code_review_content) {
    return Err(format!("cannot write {}: {}", code_review_path.display(), e));
}
println!(
    "plan-reviewer: code-review command written to {}",
    code_review_path.display()
);
```

**Idempotency:** No change needed — file writes are already unconditional (idempotency check only guards settings.json mutations). Re-running install overwrites both files.

### Pattern 3: Adding PreToolUse to hooks.json

**What:** The existing `hooks.json` contains only a `PermissionRequest` array. Phase 29 needs a `PreToolUse` array that fires when Claude runs `gh pr create` or `git push`.

**Why:** INTEG-02 requires the agent to trigger code review automatically before a PR. The `PreToolUse` hook intercepts Bash commands before execution.

**Example — new hooks.json structure:**
```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "ExitPlanMode",
        "hooks": [{"type": "command", "command": "plan-reviewer review-hook"}]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "plan-reviewer code-review",
            "timeout": 600000
          }
        ]
      }
    ]
  }
}
```

**Note on `if` field:** Research shows Claude Code supports an `if` field for fine-grained matching (e.g., `"Bash(gh pr create*)"`). However, the documentation for the `if` field is in a draft/preview state. The simpler approach — a shell script that reads `$CLAUDE_TOOL_INPUT` and checks the command string — is more robust and testable. The planner should decide between these two approaches. Both are architecturally equivalent; the `if`-field approach is cleaner but depends on unpublished API stability.

**Alternative — command wrapper approach:** The `command` can be a shell one-liner that reads stdin and filters:
```bash
bash -c 'INPUT=$(cat); CMD=$(echo "$INPUT" | jq -r ".tool_input.command // empty"); if echo "$CMD" | grep -qE "gh pr create|git push"; then plan-reviewer code-review; fi'
```
This is more portable but harder to test. The direct `plan-reviewer code-review` approach (no filtering) runs on every Bash call and must exit 0 quickly when the command is not a PR/push. This would be very noisy and is NOT recommended.

**Recommended design:** The `PreToolUse` hook command should be a tiny wrapper that:
1. Reads stdin JSON
2. Extracts `tool_input.command`
3. Exits 0 immediately if the command is not `gh pr create` or `git push`
4. Runs `plan-reviewer code-review` and waits if it is

This filtering can live in the `plan-reviewer code-review` subcommand itself (accept optional `--hook` flag that reads stdin) or in a separate `plan-reviewer pre-pr` subcommand. The simpler approach is a dedicated `plan-reviewer pre-pr-hook` subcommand that handles the stdin JSON filtering, analogous to `plan-reviewer review-hook`.

### Pattern 4: code-review.md Slash Command Prompt

**What:** The `commands/code-review.md` file is a Claude Code slash command that the user invokes as `/plan-reviewer:code-review`.

**Structure (following annotate.md as a template):**
```markdown
---
description: Open the code review UI for the current git branch
allowed-tools: Bash
---

# /plan-reviewer:code-review

Open the diff viewer for the current git branch in the plan-reviewer browser UI.
Use this before creating a PR to review and annotate the changes.

## Step 1 — Launch the review

Run the following via the Bash tool with `run_in_background: true`:

```bash
plan-reviewer code-review
```

The process opens a local browser tab at /code-review showing the current branch diff.
It exits when the review is submitted.

## Step 2 — Handle the result

The background process exits when the user clicks "Send Review" in the browser.

**If stdout contains JSON:**

The payload has the shape `{"message?": "...", "comments?": [...]}`.
Treat it as structured review feedback:
- If `comments` is present: address each comment before creating the PR
- If only `message` is present: treat as overall instruction
- If the payload is empty `{}`: proceed with PR creation

**If no output is received (empty stdout):**

The server was stopped before the user submitted. Ask:
> The code review process exited without a result. Do you want to proceed with PR creation?
```

**Frontmatter note:** `allowed-tools: Bash` (not `Bash(plan-reviewer*)`) because the command uses `run_in_background: true` which requires the full Bash tool. This matches the existing `annotate.md` pattern.

### Anti-Patterns to Avoid

- **Filtering gh pr create in hooks.json via `if` field:** The `if` field is documented as a "permission rule syntax" feature that may not be fully stable for all Claude Code versions. Filtering in the Rust subcommand is more portable.
- **Using `plan-reviewer code-review` as a raw PreToolUse hook with no stdin filtering:** Would intercept ALL Bash calls and slow Claude down dramatically. Must exit 0 quickly when the command is not PR-related.
- **Adding a new Rust server state type for code review:** Not needed — the server already serves `/code-review` via the SPA fallback. The `CodeReviewState` (diff API) is already mounted. No new state is needed.
- **Trying to block actual PR creation:** Phase 29 INTEG-02 is about "triggering code review" — not blocking the PR. The hook opens the review UI; the agent can proceed after review. The hook should not use `permissionDecision: "deny"` unconditionally.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Opening browser | Custom `std::process::Command("open")` | `webbrowser::open()` | Already in Cargo.toml; cross-platform macOS/Linux/Windows |
| Async runtime for server | New `tokio::runtime::Builder` invocation | Copy pattern from `run_review_flow()` | Already proven in three places in main.rs |
| Filesystem cleanup on uninstall | Per-file removal | `std::fs::remove_dir_all(&plugin_dir)` | Already used in `uninstall()` — removes the whole plugin dir including new files |
| Test HOME isolation | Mocking filesystem | `tempfile::TempDir` + `env("HOME", home.path())` | Already the established pattern in `tests/integration/install_uninstall.rs` |

**Key insight:** Phase 29 is mostly wiring existing components. The Rust binary, the server, the plugin install/uninstall machinery, and the test infrastructure are all in place. The primary new work is the `code-review.md` prompt content and the `PreToolUse` hook design decision.

## Common Pitfalls

### Pitfall 1: PreToolUse Hook Runs on Every Bash Call
**What goes wrong:** If `hooks.json` adds `PreToolUse { matcher: "Bash" }` with `command: "plan-reviewer code-review"` as-is, the binary is invoked on EVERY Bash tool call — file writes, npm commands, etc. This makes Claude unusably slow.
**Why it happens:** The `matcher: "Bash"` pattern is very broad.
**How to avoid:** The subcommand that handles the PreToolUse hook must read stdin JSON, parse `tool_input.command`, and exit 0 immediately if the command is not `gh pr create` or `git push`. Either filter inside the subcommand or use the `if` field in hooks.json. A dedicated `plan-reviewer pre-pr-hook` subcommand is the cleanest design.
**Warning signs:** Integration test spawning the binary with a non-PR command takes more than 100ms.

### Pitfall 2: plan-reviewer code-review Blocks Forever Without a Decision Channel
**What goes wrong:** The `run_review_flow` pattern calls `server::start_server()` which creates a `oneshot::Sender<Decision>`. If the user closes the browser tab without submitting, the process hangs until the 540-second timeout.
**Why it happens:** The decision channel never receives a value.
**How to avoid:** This is the same behavior as `run_review_flow` — it is by design. The 540-second timeout in `async_main` handles it. Document this in the subcommand's help text.
**Warning signs:** Integration tests for `code-review` hanging; always POST `allow` at the end of test cleanup.

### Pitfall 3: Slash Command Namespace Conflict
**What goes wrong:** Writing `commands/code-review.md` with heading `# /code-review` (not `# /plan-reviewer:code-review`) causes the command to appear without the plugin namespace.
**Why it happens:** Claude Code plugin commands are namespaced as `plugin-name:command-name`.
**How to avoid:** Use `# /plan-reviewer:code-review` in the heading, consistent with `annotate.md`'s `# /plan-reviewer:annotate` heading. The success criterion explicitly says `/code-review` appears in Claude Code's slash command menu — this refers to the full namespaced form.
**Warning signs:** Test `install_creates_annotate_md_with_expected_content` pattern — add analogous assertion checking `# /plan-reviewer:code-review`.

### Pitfall 4: start_server Requires Non-Empty Plan Content
**What goes wrong:** `start_server(String::new(), ...)` might have unexpected behavior if `AppState.plan_md` is served to the `/code-review` route.
**Why it happens:** Passing empty string to `start_server`.
**How to avoid:** The `/code-review` route (SPA) does NOT call `/api/plan` — it calls `/api/diff/branch` and `/api/commits` instead. Empty `plan_md` is fine. Verified by reading `CodeReviewApp.tsx` — it uses `useDiff` and `useCommits` hooks, not the plan API.
**Warning signs:** None — this is safe.

### Pitfall 5: hooks.json Overwrite Loses ExitPlanMode Entry
**What goes wrong:** If `install()` replaces `hooks.json` wholesale without preserving the existing `PermissionRequest` array, the `review-hook` functionality breaks.
**Why it happens:** Naive `write` overwrites the file.
**How to avoid:** The new `hooks.json` write must include BOTH the existing `PermissionRequest` array AND the new `PreToolUse` array. Since `install()` always writes `hooks.json` from scratch (not from existing file content), the JSON literal in the code must include both arrays. [VERIFIED by reading current claude.rs install() — it writes hooks_json as a JSON literal].
**Warning signs:** Existing integration test `install_creates_hooks_json_with_exit_plan_mode` fails after the change.

## Code Examples

Verified patterns from codebase:

### Existing run_review_flow Pattern (main.rs)
```rust
// Source: src/main.rs run_review_flow()
fn run_review_flow(no_browser: bool, port: u16, file: &str, approve_label: &str, deny_label: &str) {
    let plan_md = match std::fs::read_to_string(file) { ... };
    let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().unwrap();
    let decision = rt.block_on(async_main(no_browser, port, plan_md, ...));
    let output = build_opencode_output(&decision);
    serde_json::to_writer(std::io::stdout(), &output).expect("failed to write hook output");
}
```

### Existing hooks.json Write Pattern (claude.rs)
```rust
// Source: src/integrations/claude.rs install()
let hooks_json = serde_json::json!({
    "hooks": {
        "PermissionRequest": [
            {
                "matcher": "ExitPlanMode",
                "hooks": [{"type": "command", "command": "plan-reviewer review-hook"}]
            }
        ]
    }
});
let hooks_json_str = serde_json::to_string_pretty(&hooks_json).unwrap();
std::fs::write(&hooks_json_path, &hooks_json_str)?;
```

### Existing Integration Test Pattern (install_uninstall.rs)
```rust
// Source: tests/integration/install_uninstall.rs
#[test]
fn install_claude_creates_commands_annotate_md() {
    let home = tempfile::TempDir::new().unwrap();
    Command::cargo_bin("plan-reviewer").unwrap()
        .env("HOME", home.path())
        .args(["install", "claude"])
        .assert()
        .success()
        .stdout(predicate::str::contains("annotate command written to"));
    // ... assertions on file contents ...
    drop(home);
}
```

### annotate.md Content Structure (model for code-review.md)
```
// Source: src/integrations/claude.rs annotate_content const
---
description: Open a file in the plan-reviewer browser UI for feedback
argument-hint: [path/to/file.md]
allowed-tools: Bash
---

# /plan-reviewer:annotate

... steps using $ARGUMENTS, plan-reviewer review, run_in_background ...
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bare `plan-reviewer` as hook command | `plan-reviewer review-hook` subcommand | Phase 07.3 | Explicit subcommand; deprecation warning on bare invocation |
| settings.json hook entries | Plugin directory model | Phase 07.2 | Version-aware updates; `update` can rewrite plugin files |
| `/v2` route for new reviewer | `/` (SPA root) | Phase 23 | Single renderer; no route branching in Rust server |
| `/code-review` only for diff tab | Active `/code-review` SPA route | Phase 25 | Full code review UI; client-side routing in `main.tsx` |

**Deprecated/outdated:**
- Old settings.json `hooks.PermissionRequest` bare entries: still present on legacy installs, handled by Phase 07.3 migration logic (not affected by Phase 29).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Claude Code `PreToolUse` hook `if` field supports `Bash(gh pr create*)` syntax for plugin hooks.json | Common Pitfalls, Pattern 3 | Hook would need to use stdin filtering instead; subcommand design changes |
| A2 | Passing `String::new()` as `plan_md` to `start_server` works correctly for the `/code-review` SPA flow | Common Pitfalls | Server might crash or return errors on `/api/plan` calls from the code-review app |
| A3 | The `code-review` subcommand output format (what it writes to stdout) should mirror `run_review_flow`'s `build_opencode_output` | Architecture Patterns | If the pre-PR hook expects a different JSON shape, the agent's feedback handling breaks |

## Open Questions

1. **PreToolUse hook filtering strategy**
   - What we know: The hook fires on every Bash call if no `if` filter is specified; the `if` field can filter by command pattern
   - What's unclear: Is the `if` field stable in Claude Code's plugin hooks.json for the current Claude Code release? Or should filtering be done inside the Rust subcommand?
   - Recommendation: Design a `plan-reviewer pre-pr-hook` subcommand that reads stdin JSON, checks `tool_input.command`, and exits 0 immediately if not a PR-related command. This is implementation-testable without needing a live Claude Code session.

2. **Output format for code-review subcommand**
   - What we know: `run_review_flow` emits `{"behavior":"allow"}` or `{"behavior":"deny","message":"..."}` to stdout; the code review submit path emits `{"message?":"...","comments?":[...]}`
   - What's unclear: When invoked from a pre-PR hook, should `plan-reviewer code-review` emit the code review payload or a simple allow/deny signal?
   - Recommendation: Emit the code review payload `{"message?":"...","comments?":[...]}` directly. The agent reads this from the hook's stdout and uses it as review feedback before proceeding with PR creation.

3. **Success Criterion 2 phrasing: "opens the browser UI at /code-review for the current git branch"**
   - What we know: The server is started, the browser opens at `http://127.0.0.1:{port}/code-review`; the diff API uses `cwd` at startup
   - What's unclear: Does the phase require the branch name to be determined at startup and displayed differently, or is this just describing the UI behavior?
   - Recommendation: No special branch handling needed — the server already reads the cwd repo and `CodeReviewApp` fetches commits/diffs from it. The phrase "for the current git branch" describes the UI behavior, not a new Rust feature.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `webbrowser` crate | Opening browser tab | Already in Cargo.toml | 1.x | `--no-browser` flag |
| `tokio` crate | Async server runtime | Already in Cargo.toml | 1.x | N/A |
| `axum` crate | HTTP server | Already in Cargo.toml | 0.8.x | N/A |
| `tempfile` (dev) | Test HOME isolation | Already in Cargo.toml dev-deps | 3.x | N/A |
| `assert_cmd` (dev) | Integration tests | Already in Cargo.toml dev-deps | 2.x | N/A |

**No missing dependencies.** This phase requires zero new crate additions.

## Validation Architecture

Nyquist validation is disabled (`workflow.nyquist_validation: false`) — skip this section per config.

## Security Domain

Security enforcement is not explicitly disabled. The phase adds:
- A new subcommand that reads no user input beyond CLI flags
- A new hook entry that processes stdin JSON from Claude Code (trusted caller)
- A new slash command file that contains no executable code (Markdown only)

No new attack surface beyond existing patterns already in the codebase.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | local-only tool, no auth |
| V3 Session Management | no | no sessions |
| V4 Access Control | no | local-only |
| V5 Input Validation | yes | SHA validation already in place; stdin JSON from trusted caller |
| V6 Cryptography | no | no crypto needed |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed stdin JSON in pre-pr-hook | Tampering | `serde_json::from_str` with graceful exit-0 on parse error |
| Hook runs code-review for every Bash call | DoS (agent performance) | Exit 0 immediately when command is not pr/push-related |

## Sources

### Primary (HIGH confidence)
- Codebase: `src/integrations/claude.rs` — complete install/uninstall implementation with tests
- Codebase: `src/main.rs` — existing subcommand dispatch, `run_review_flow`, `async_main` patterns
- Codebase: `src/server.rs` — `start_server()` signature and SPA fallback behavior
- Codebase: `ui/src/main.tsx` — `window.location.pathname.startsWith('/code-review')` routing
- Codebase: `tests/integration/install_uninstall.rs` — test patterns to extend
- [Official: Claude Code Slash Commands](https://code.claude.com/docs/en/slash-commands) — frontmatter specification, plugin command namespacing
- [Official: Claude Code Hooks](https://code.claude.com/docs/en/hooks) — `PreToolUse` protocol, stdin JSON format, blocking semantics

### Secondary (MEDIUM confidence)
- [anthropics/claude-plugins-official frontmatter reference](https://github.com/anthropics/claude-plugins-official/blob/main/plugins/plugin-dev/skills/command-development/references/frontmatter-reference.md) — `disable-model-invocation`, `argument-hint`, `allowed-tools` fields

### Tertiary (LOW confidence)
- A1: `if` field for fine-grained Bash command filtering — referenced in hooks docs but stability in plugin hooks.json not confirmed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already in Cargo.toml; zero new packages
- Architecture: HIGH — direct extensions of well-understood existing patterns; no new modules
- Pitfalls: HIGH — all pitfalls derived from reading existing code and cross-referencing known behaviors
- PreToolUse `if` field: LOW — documented in official hooks docs but plugin compatibility not verified

**Research date:** 2026-05-26
**Valid until:** 2026-07-01 (stable APIs; Claude Code plugin format is stable)
