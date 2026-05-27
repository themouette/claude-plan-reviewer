# Phase 29: Code Review Integration - Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 3 (2 modified, 1 extended via test)
**Analogs found:** 3 / 3

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/main.rs` | CLI dispatcher | request-response | `src/main.rs` (existing subcommand variants) | exact |
| `src/integrations/claude.rs` | installer/config | file-I/O | `src/integrations/claude.rs` (existing `install()`) | exact |
| `tests/integration/install_uninstall.rs` | integration test | batch | `tests/integration/install_uninstall.rs` (existing tests) | exact |

## Pattern Assignments

---

### `src/main.rs` — Add `Commands::CodeReview` variant + `run_code_review_flow()`

**Analog:** `src/main.rs`, existing `Commands::Review` variant and `run_review_flow()`

**Commands enum pattern** (lines 249–289):
```rust
#[derive(Subcommand, Debug)]
enum Commands {
    ReviewHook,
    /// Review any markdown file in the browser UI (outputs neutral {behavior} JSON)
    Review {
        /// Path to the markdown file to review
        file: String,
        /// Label for the Approve button in the browser UI
        #[arg(long, default_value = "Approve")]
        approve_label: String,
        /// Label for the Deny button in the browser UI
        #[arg(long, default_value = "Deny")]
        deny_label: String,
    },
    // ... Install, Uninstall, Update ...
}
```

New variant to add — parallel to `Review` but takes no file argument:
```rust
/// Open the code review UI for the current git branch.
///
/// Starts the local server and opens the browser at /code-review.
/// Does not read stdin — safe to invoke without piped input.
CodeReview,
```

**main() dispatch pattern** (lines 427–473):
```rust
fn main() {
    let cli = Cli::parse();
    match &cli.command {
        Some(Commands::Review { file, approve_label, deny_label }) => {
            run_review_flow(cli.no_browser, cli.port, file, approve_label, deny_label);
        }
        // Add alongside existing arms:
        Some(Commands::CodeReview) => {
            run_code_review_flow(cli.no_browser, cli.port);
        }
        // ...
    }
}
```

**`run_review_flow` core pattern to copy for `run_code_review_flow`** (lines 385–425):
```rust
fn run_review_flow(no_browser: bool, port: u16, file: &str, approve_label: &str, deny_label: &str) {
    let plan_md = match std::fs::read_to_string(file) {
        Ok(content) => content,
        Err(e) => {
            eprintln!("Failed to read file at {}: {}", file, e);
            std::process::exit(1);
        }
    };
    eprintln!("Plan loaded from file ({} bytes): {}", plan_md.len(), file);

    #[cfg(debug_assertions)]
    {
        if server::Assets::get("index.html").is_none() {
            eprintln!("ERROR: Frontend assets not found at ui/dist/index.html");
            eprintln!("Run 'cd ui && npm run build' first, or run 'cargo run' from the project root.");
            std::process::exit(1);
        }
    }

    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();

    let decision = rt.block_on(async_main(
        no_browser,
        port,
        plan_md,
        "Approve".to_string(),
        "Deny".to_string(),
    ));

    let output = build_opencode_output(&decision);
    serde_json::to_writer(std::io::stdout(), &output).expect("failed to write hook output");
}
```

`run_code_review_flow` differences from the above:
1. Pass `String::new()` instead of reading a file — `/code-review` SPA does not call `/api/plan`
2. Open `http://127.0.0.1:{port}/code-review` (done in `async_main` — needs a path argument or a separate async helper)
3. The `async_main` URL format to change — see existing `async_main` lines 547–610:

```rust
async fn async_main(no_browser: bool, port: u16, plan_md: String, ...) -> Decision {
    let (port, decision_rx) = match server::start_server(plan_md, approve_label, deny_label, port).await { ... };
    let url = format!("http://127.0.0.1:{}/", port);   // ← change to /code-review for CodeReview flow
    eprintln!("Review UI: {}", url);
    if !no_browser && let Err(e) = webbrowser::open(&url) { ... }
    // tokio::select! { decision_rx vs timeout } ...
}
```

The cleanest approach is a thin `async_code_review_main` that mirrors `async_main` but builds `url` with `/code-review` appended, or pass a `path: &str` parameter to a shared helper.

**Unit test pattern to add for `Commands::CodeReview`** (lines 176–219):
```rust
#[test]
fn test_cli_review_hook_subcommand_parses() {
    let cli = Cli::try_parse_from(["plan-reviewer", "review-hook"]).expect("parse failed");
    assert!(matches!(cli.command, Some(Commands::ReviewHook)));
}

// New test parallel:
#[test]
fn test_cli_code_review_subcommand_parses() {
    let cli = Cli::try_parse_from(["plan-reviewer", "code-review"]).expect("parse failed");
    assert!(matches!(cli.command, Some(Commands::CodeReview)));
}
```

---

### `src/integrations/claude.rs` — Extend `install()` with `commands/code-review.md` + `PreToolUse` hook

**Analog:** `src/integrations/claude.rs`, existing `annotate.md` write block (lines 139–234) and `hooks.json` write block (lines 111–137)

**`annotate.md` write pattern to copy for `code-review.md`** (lines 139–234):
```rust
// Write commands/annotate.md
let commands_dir = plugin_dir.join("commands");
if let Err(e) = std::fs::create_dir_all(&commands_dir) {
    return Err(format!("cannot create {}: {}", commands_dir.display(), e));
}
let annotate_content = concat!(
    "---\n",
    "description: Open a file in the plan-reviewer browser UI for feedback\n",
    "argument-hint: [path/to/file.md]\n",
    "allowed-tools: Bash\n",
    "---\n",
    "\n",
    "# /plan-reviewer:annotate\n",
    // ... steps ...
);
let annotate_path = commands_dir.join("annotate.md");
if let Err(e) = std::fs::write(&annotate_path, annotate_content) {
    return Err(format!("cannot write {}: {}", annotate_path.display(), e));
}
println!(
    "plan-reviewer: annotate command written to {}",
    annotate_path.display()
);
```

`code-review.md` write block to add after the `annotate.md` block (same `commands_dir` already created):
```rust
let code_review_content = concat!(
    "---\n",
    "description: Open the code review UI for the current git branch\n",
    "allowed-tools: Bash\n",
    "---\n",
    "\n",
    "# /plan-reviewer:code-review\n",
    // ... steps per RESEARCH.md Pattern 4 ...
);
let code_review_path = commands_dir.join("code-review.md");
if let Err(e) = std::fs::write(&code_review_path, code_review_content) {
    return Err(format!("cannot write {}: {}", code_review_path.display(), e));
}
println!(
    "plan-reviewer: code-review command written to {}",
    code_review_path.display()
);
```

**`hooks.json` write pattern** (lines 111–137) — must include BOTH arrays to avoid Pitfall 5 (overwriting ExitPlanMode):
```rust
let hooks_json = serde_json::json!({
    "hooks": {
        "PermissionRequest": [
            {
                "matcher": "ExitPlanMode",
                "hooks": [{"type": "command", "command": "plan-reviewer review-hook"}]
            }
        ]
        // Add PreToolUse array here — new code adds to the same literal:
        // "PreToolUse": [
        //     {
        //         "matcher": "Bash",
        //         "hooks": [{
        //             "type": "command",
        //             "command": "plan-reviewer pre-pr-hook",
        //             "timeout": 600000
        //         }]
        //     }
        // ]
    }
});
let hooks_json_str = match serde_json::to_string_pretty(&hooks_json) {
    Ok(s) => s,
    Err(e) => return Err(format!("cannot serialize hooks.json: {}", e)),
};
let hooks_json_path = hooks_dir.join("hooks.json");
if let Err(e) = std::fs::write(&hooks_json_path, &hooks_json_str) {
    return Err(format!("cannot write {}: {}", hooks_json_path.display(), e));
}
println!(
    "plan-reviewer: hooks file written to {}",
    hooks_json_path.display()
);
```

**`install()` unit test pattern for `code-review.md`** (lines 876–971):
```rust
#[test]
fn install_creates_annotate_md_with_expected_content() {
    let dir = tempdir().unwrap();
    let ctx = InstallContext {
        home: dir.path().to_str().unwrap().to_string(),
        binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
    };

    ClaudeIntegration.install(&ctx).unwrap();

    let annotate_path = dir.path()
        .join(".local/share/plan-reviewer/claude-plugin/commands/annotate.md");
    assert!(annotate_path.exists());
    let content = std::fs::read_to_string(&annotate_path).unwrap();
    assert!(content.contains("# /plan-reviewer:annotate"));
    assert!(content.contains("allowed-tools: Bash"));
    // ...
}

// Add parallel test:
#[test]
fn install_creates_code_review_md_with_expected_content() {
    let dir = tempdir().unwrap();
    let ctx = InstallContext {
        home: dir.path().to_str().unwrap().to_string(),
        binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
    };
    ClaudeIntegration.install(&ctx).unwrap();

    let cr_path = dir.path()
        .join(".local/share/plan-reviewer/claude-plugin/commands/code-review.md");
    assert!(cr_path.exists(), "commands/code-review.md should be created by install");

    let content = std::fs::read_to_string(&cr_path).unwrap();
    assert!(content.contains("# /plan-reviewer:code-review"), "must be plugin-namespaced");
    assert!(content.contains("allowed-tools: Bash"), "must declare Bash tool");
    assert!(content.contains("plan-reviewer code-review"), "must contain execution command");
    assert!(content.contains("run_in_background"), "must use run_in_background");
}
```

**`hooks.json` unit test pattern for `PreToolUse`** (lines 666–693):
```rust
#[test]
fn install_creates_hooks_json_with_exit_plan_mode() {
    // ...
    let content = std::fs::read_to_string(&hooks_json_path).unwrap();
    let json: serde_json::Value = serde_json::from_str(&content).unwrap();

    let permission_requests = json["hooks"]["PermissionRequest"].as_array().unwrap();
    assert!(
        permission_requests.iter().any(|entry| {
            entry["matcher"].as_str() == Some("ExitPlanMode")
                && entry["hooks"][0]["command"].as_str() == Some("plan-reviewer review-hook")
        }),
        "hooks.json must contain ExitPlanMode hook"
    );
}

// Add parallel test:
#[test]
fn install_creates_hooks_json_with_pre_tool_use() {
    // ... same setup ...
    let json: serde_json::Value = serde_json::from_str(&content).unwrap();
    let pre_tool_use = json["hooks"]["PreToolUse"].as_array()
        .expect("PreToolUse array must exist");
    assert!(
        pre_tool_use.iter().any(|entry| {
            entry["matcher"].as_str() == Some("Bash")
                && entry["hooks"][0]["command"].as_str() == Some("plan-reviewer pre-pr-hook")
        }),
        "hooks.json must contain PreToolUse Bash hook with 'plan-reviewer pre-pr-hook'"
    );
    // ExitPlanMode must still be present (Pitfall 5)
    let permission_requests = json["hooks"]["PermissionRequest"].as_array().unwrap();
    assert!(permission_requests.iter().any(|e| e["matcher"].as_str() == Some("ExitPlanMode")));
}
```

---

### `tests/integration/install_uninstall.rs` — New integration tests for code-review

**Analog:** `tests/integration/install_uninstall.rs`, `install_claude_creates_commands_annotate_md` (lines 135–174)

**Import pattern** (lines 1–4):
```rust
use assert_cmd::prelude::*;
use predicates::prelude::*;
use std::process::Command;
```

**`install_claude_creates_commands_annotate_md` integration test to mirror** (lines 135–174):
```rust
#[test]
fn install_claude_creates_commands_annotate_md() {
    let home = tempfile::TempDir::new().unwrap();

    Command::cargo_bin("plan-reviewer").unwrap()
        .env("HOME", home.path())
        .args(["install", "claude"])
        .assert()
        .success()
        .stdout(predicate::str::contains("annotate command written to"));

    let annotate_path = home.path()
        .join(".local/share/plan-reviewer/claude-plugin/commands/annotate.md");
    assert!(annotate_path.exists());

    let content = std::fs::read_to_string(&annotate_path).unwrap();
    assert!(content.contains("# /plan-reviewer:annotate"));
    assert!(content.contains("$ARGUMENTS"));
    assert!(content.contains("allowed-tools: Bash"));
    assert!(content.contains("plan-reviewer review"));

    drop(home);
}
```

New integration test to add:
```rust
#[test]
fn install_claude_creates_commands_code_review_md() {
    let home = tempfile::TempDir::new().unwrap();

    Command::cargo_bin("plan-reviewer").unwrap()
        .env("HOME", home.path())
        .args(["install", "claude"])
        .assert()
        .success()
        .stdout(predicate::str::contains("code-review command written to"));

    let cr_path = home.path()
        .join(".local/share/plan-reviewer/claude-plugin/commands/code-review.md");
    assert!(cr_path.exists(), "commands/code-review.md must be created");

    let content = std::fs::read_to_string(&cr_path).unwrap();
    assert!(content.contains("# /plan-reviewer:code-review"));
    assert!(content.contains("allowed-tools: Bash"));
    assert!(content.contains("plan-reviewer code-review"));
    assert!(content.contains("run_in_background"));

    drop(home);
}
```

**`uninstall_claude_removes_commands_directory` pattern** (lines 425–458) — already covers `code-review.md` since the whole plugin dir is removed. No additional uninstall test needed, but the test can assert the file does not survive uninstall.

---

### `src/main.rs` — `plan-reviewer pre-pr-hook` subcommand (if RESEARCH.md Recommendation is adopted)

**Analog:** `src/main.rs` `run_hook_flow()` (lines 476–545) — same stdin-read-then-parse pattern

**`run_hook_flow` stdin pattern to copy** (lines 476–545):
```rust
fn run_hook_flow(no_browser: bool, port: u16) {
    let input_json = match std::io::read_to_string(std::io::stdin()) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Failed to read stdin: {}", e);
            std::process::exit(1);
        }
    };

    let hook_input: HookInput = serde_json::from_str(&input_json).unwrap_or_else(|e| {
        eprintln!("Failed to parse hook input: {}", e);
        std::process::exit(1);
    });
    // ...
}
```

`pre-pr-hook` variant: read stdin, parse `tool_input.command` (a different JSON shape — `PreToolUse` stdin has `tool_input.command: String`), exit 0 immediately if the command does not match `gh pr create` or `git push`, otherwise call `run_code_review_flow()`.

**`HookInput` / `ToolInput` structs to extend** (`src/hook.rs` lines 1–33):
```rust
#[derive(Deserialize, Debug)]
pub struct ToolInput {
    pub plan: Option<String>,
    pub plan_path: Option<String>,
    #[serde(flatten)]
    #[allow(dead_code)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}
```

The `PreToolUse` stdin JSON shape has `tool_input.command: String` (not `plan`/`plan_path`). The `extra` map already captures it via `#[serde(flatten)]`. Extract as `hook_input.tool_input.extra.get("command")` or add a typed `command: Option<String>` field to `ToolInput`.

---

## Shared Patterns

### tokio runtime for server-starting subcommands
**Source:** `src/main.rs` lines 361–376, 409–424
**Apply to:** `run_code_review_flow()` and any new flow function
```rust
let rt = tokio::runtime::Builder::new_current_thread()
    .enable_all()
    .build()
    .unwrap();
let decision = rt.block_on(async_main(no_browser, port, plan_md, ...));
```

### stdout write — only one per flow function
**Source:** `src/main.rs` lines 376, 424, 543
**Apply to:** `run_code_review_flow()` stdout write
```rust
serde_json::to_writer(std::io::stdout(), &output).expect("failed to write hook output");
```
Rule: exactly one `to_writer(stdout, ...)` call per flow function, at the very end. No other stdout writes allowed.

### filesystem error handling pattern in `install()`
**Source:** `src/integrations/claude.rs` lines 54–78
**Apply to:** all new file-write blocks in `install()`
```rust
if let Err(e) = std::fs::write(&path, content) {
    return Err(format!("cannot write {}: {}", path.display(), e));
}
println!("plan-reviewer: <thing> written to {}", path.display());
```

### integration test HOME isolation
**Source:** `tests/integration/install_uninstall.rs` lines 33–76
**Apply to:** all new integration tests
```rust
let home = tempfile::TempDir::new().unwrap();
Command::cargo_bin("plan-reviewer").unwrap()
    .env("HOME", home.path())
    .args(["install", "claude"])
    .assert()
    .success()
    .stdout(predicate::str::contains("..."));
// ... assertions ...
drop(home);
```

### unit test context setup in `claude.rs`
**Source:** `src/integrations/claude.rs` lines 606–616
**Apply to:** all new unit tests in `claude.rs`
```rust
let dir = tempdir().unwrap();
let home = dir.path().to_str().unwrap().to_string();
let integration = ClaudeIntegration;
let ctx = InstallContext {
    home: home.clone(),
    binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
};
let result = integration.install(&ctx);
assert!(result.is_ok(), "install should succeed: {:?}", result);
```

## No Analog Found

No files in Phase 29 lack a codebase analog. All new code is a direct extension of patterns already in `src/main.rs`, `src/integrations/claude.rs`, and `tests/integration/install_uninstall.rs`.

## Metadata

**Analog search scope:** `src/`, `tests/integration/`
**Files scanned:** 4 (`src/main.rs`, `src/integrations/claude.rs`, `src/hook.rs`, `tests/integration/install_uninstall.rs`)
**Pattern extraction date:** 2026-05-26
