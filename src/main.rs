mod diff_api;
mod hook;
mod install;
mod integrations;
mod plan_review;
mod server;
mod uninstall;
mod update;

#[cfg(test)]
mod tests {
    use super::{
        build_gemini_output, build_opencode_output, build_review_url,
        extract_command_from_tool_input, extract_plan_content, is_pr_command,
        should_trigger_code_review, Cli, Commands,
    };
    use crate::hook;
    use crate::hook::HookOutput;
    use crate::server;
    use clap::Parser;

    // -----------------------------------------------------------------------
    // Task 1: New subcommand parse tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_cli_code_review_subcommand_parses() {
        let cli = Cli::try_parse_from(["plan-reviewer", "code-review"]).expect("parse failed");
        assert!(
            matches!(cli.command, Some(Commands::CodeReview)),
            "expected Commands::CodeReview"
        );
    }

    #[test]
    fn test_cli_code_review_with_no_browser_and_port() {
        let cli = Cli::try_parse_from([
            "plan-reviewer",
            "--no-browser",
            "--port",
            "4242",
            "code-review",
        ])
        .expect("parse failed");
        assert!(
            matches!(cli.command, Some(Commands::CodeReview)),
            "expected Commands::CodeReview"
        );
        assert!(cli.no_browser, "--no-browser should be true");
        assert_eq!(cli.port, 4242, "--port should be 4242");
    }

    #[test]
    fn test_cli_pre_pr_hook_subcommand_parses() {
        let cli = Cli::try_parse_from(["plan-reviewer", "pre-pr-hook"]).expect("parse failed");
        assert!(
            matches!(cli.command, Some(Commands::PrePrHook)),
            "expected Commands::PrePrHook; CLI name must be exactly 'pre-pr-hook'"
        );
    }

    #[test]
    fn test_extract_command_from_tool_input_present() {
        let mut extra = serde_json::Map::new();
        extra.insert(
            "command".to_string(),
            serde_json::Value::String("gh pr create --base main".to_string()),
        );
        let tool_input = hook::ToolInput {
            plan: None,
            plan_path: None,
            extra,
        };
        assert_eq!(
            extract_command_from_tool_input(&tool_input),
            Some("gh pr create --base main")
        );
    }

    #[test]
    fn test_extract_command_from_tool_input_missing() {
        let tool_input = hook::ToolInput {
            plan: None,
            plan_path: None,
            extra: serde_json::Map::new(),
        };
        assert_eq!(extract_command_from_tool_input(&tool_input), None);
    }

    #[test]
    fn test_is_pr_command_matches() {
        // Positive cases
        assert!(is_pr_command("gh pr create"), "gh pr create");
        assert!(
            is_pr_command("gh pr create --base main"),
            "gh pr create --base main"
        );
        assert!(
            is_pr_command("git push origin main"),
            "git push origin main"
        );
        assert!(is_pr_command("  git push"), "leading whitespace + git push");
        // Negative cases
        assert!(!is_pr_command("git status"), "git status should not match");
        assert!(
            !is_pr_command("npm install"),
            "npm install should not match"
        );
        assert!(!is_pr_command("echo hi"), "echo hi should not match");
        assert!(!is_pr_command(""), "empty string should not match");
    }

    // -----------------------------------------------------------------------
    // Task 2: build_review_url + should_trigger_code_review tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_async_main_builds_url_with_path() {
        assert_eq!(build_review_url(8080, "/"), "http://127.0.0.1:8080/");
        assert_eq!(
            build_review_url(3000, "/code-review"),
            "http://127.0.0.1:3000/code-review"
        );
        assert_eq!(
            build_review_url(0, "/code-review"),
            "http://127.0.0.1:0/code-review"
        );
    }

    #[test]
    fn test_run_pre_pr_hook_flow_exits_silently_on_non_pr_command() {
        let raw = r#"{"session_id":"s","cwd":"/tmp","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"npm install"}}"#;
        let hi: hook::HookInput = serde_json::from_str(raw).unwrap();
        assert!(!should_trigger_code_review(&hi));
    }

    #[test]
    fn test_run_pre_pr_hook_flow_triggers_on_gh_pr_create() {
        let raw = r#"{"session_id":"s","cwd":"/tmp","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"gh pr create --base main"}}"#;
        let hi: hook::HookInput = serde_json::from_str(raw).unwrap();
        assert!(should_trigger_code_review(&hi));
    }

    #[test]
    fn test_run_pre_pr_hook_flow_triggers_on_git_push() {
        let raw = r#"{"session_id":"s","cwd":"/tmp","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"git push origin feature/foo"}}"#;
        let hi: hook::HookInput = serde_json::from_str(raw).unwrap();
        assert!(should_trigger_code_review(&hi));
    }

    #[test]
    fn test_run_pre_pr_hook_flow_handles_missing_command_field() {
        let raw = r#"{"session_id":"s","cwd":"/tmp","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{}}"#;
        let hi: hook::HookInput = serde_json::from_str(raw).unwrap();
        assert!(!should_trigger_code_review(&hi));
    }

    #[test]
    fn test_cli_port_flag_default_zero() {
        let cli = Cli::try_parse_from(["plan-reviewer"]).expect("parse failed");
        assert_eq!(cli.port, 0, "--port default should be 0");
    }

    #[test]
    fn test_cli_port_flag_accepts_value() {
        let cli = Cli::try_parse_from(["plan-reviewer", "--port", "8080"]).expect("parse failed");
        assert_eq!(cli.port, 8080, "--port should accept 8080");
    }

    #[test]
    fn test_extract_plan_content_inline() {
        let tool_input = hook::ToolInput {
            plan: Some("# My Plan\nStep 1".to_string()),
            plan_path: None,
            extra: serde_json::Map::new(),
        };
        assert_eq!(extract_plan_content(&tool_input), "# My Plan\nStep 1");
    }

    #[test]
    fn test_extract_plan_content_from_file() {
        let tmp = tempfile::NamedTempFile::new().expect("create temp file");
        std::fs::write(tmp.path(), "# File Plan\nDo things").expect("write");
        let tool_input = hook::ToolInput {
            plan: None,
            plan_path: Some(tmp.path().to_str().unwrap().to_string()),
            extra: serde_json::Map::new(),
        };
        assert_eq!(extract_plan_content(&tool_input), "# File Plan\nDo things");
    }

    #[test]
    fn test_extract_plan_content_neither() {
        let tool_input = hook::ToolInput {
            plan: None,
            plan_path: None,
            extra: serde_json::Map::new(),
        };
        assert_eq!(extract_plan_content(&tool_input), "");
    }

    #[test]
    fn test_extract_plan_content_inline_preferred_over_file() {
        let tmp = tempfile::NamedTempFile::new().expect("create temp file");
        std::fs::write(tmp.path(), "file content").expect("write");
        let tool_input = hook::ToolInput {
            plan: Some("inline content".to_string()),
            plan_path: Some(tmp.path().to_str().unwrap().to_string()),
            extra: serde_json::Map::new(),
        };
        assert_eq!(extract_plan_content(&tool_input), "inline content");
    }

    #[test]
    fn test_gemini_allow_output_format() {
        let decision = server::Decision {
            behavior: "allow".to_string(),
            message: None,
        };
        let output = build_gemini_output(&decision);
        assert_eq!(output["decision"].as_str(), Some("allow"));
        assert!(
            output.get("hookSpecificOutput").is_none(),
            "Gemini format must not have hookSpecificOutput"
        );
    }

    #[test]
    fn test_gemini_deny_output_format() {
        let decision = server::Decision {
            behavior: "deny".to_string(),
            message: Some("Missing rollback".to_string()),
        };
        let output = build_gemini_output(&decision);
        assert_eq!(output["decision"].as_str(), Some("deny"));
        assert_eq!(output["reason"].as_str(), Some("Missing rollback"));
        assert_eq!(
            output["systemMessage"].as_str(),
            Some("Plan denied by plan-reviewer. Please revise the plan.")
        );
    }

    #[test]
    fn test_claude_allow_output_format() {
        let output = HookOutput::allow();
        let json = serde_json::to_value(&output).unwrap();
        assert!(json["hookSpecificOutput"]["decision"]["behavior"].as_str() == Some("allow"));
    }

    #[test]
    fn test_claude_deny_output_format() {
        let output = HookOutput::deny("bad plan".to_string());
        let json = serde_json::to_value(&output).unwrap();
        assert_eq!(
            json["hookSpecificOutput"]["decision"]["behavior"].as_str(),
            Some("deny")
        );
        assert_eq!(
            json["hookSpecificOutput"]["decision"]["message"].as_str(),
            Some("bad plan")
        );
    }

    #[test]
    fn test_opencode_allow_output_format() {
        let decision = server::Decision {
            behavior: "allow".to_string(),
            message: None,
        };
        let output = build_opencode_output(&decision);
        assert_eq!(output["behavior"].as_str(), Some("allow"));
        assert!(
            output.get("message").is_none(),
            "allow should not have message field"
        );
        assert!(
            output.get("hookSpecificOutput").is_none(),
            "opencode format must not have hookSpecificOutput"
        );
        assert!(
            output.get("decision").is_none(),
            "opencode format uses behavior, not decision key"
        );
    }

    #[test]
    fn test_opencode_deny_output_format() {
        let decision = server::Decision {
            behavior: "deny".to_string(),
            message: Some("Needs more tests".to_string()),
        };
        let output = build_opencode_output(&decision);
        assert_eq!(output["behavior"].as_str(), Some("deny"));
        assert_eq!(output["message"].as_str(), Some("Needs more tests"));
        assert!(
            output.get("hookSpecificOutput").is_none(),
            "opencode format must not have hookSpecificOutput"
        );
    }

    #[test]
    fn test_opencode_deny_without_message() {
        let decision = server::Decision {
            behavior: "deny".to_string(),
            message: None,
        };
        let output = build_opencode_output(&decision);
        assert_eq!(output["behavior"].as_str(), Some("deny"));
        assert!(
            output.get("message").is_none(),
            "deny without message should not have message field"
        );
    }

    #[test]
    fn test_cli_review_hook_subcommand_parses() {
        let cli = Cli::try_parse_from(["plan-reviewer", "review-hook"]).expect("parse failed");
        assert!(matches!(cli.command, Some(Commands::ReviewHook)));
    }

    #[test]
    fn test_cli_review_hook_with_no_browser_flag() {
        let cli = Cli::try_parse_from(["plan-reviewer", "--no-browser", "review-hook"])
            .expect("parse failed");
        assert!(matches!(cli.command, Some(Commands::ReviewHook)));
        assert!(cli.no_browser);
    }

    #[test]
    fn test_cli_review_hook_with_port_flag() {
        let cli = Cli::try_parse_from(["plan-reviewer", "--port", "9090", "review-hook"])
            .expect("parse failed");
        assert!(matches!(cli.command, Some(Commands::ReviewHook)));
        assert_eq!(cli.port, 9090);
    }

    #[test]
    fn test_cli_no_subcommand_is_none() {
        let cli = Cli::try_parse_from(["plan-reviewer"]).expect("parse failed");
        assert!(cli.command.is_none());
    }

    #[test]
    fn test_cli_review_subcommand_parses() {
        let cli =
            Cli::try_parse_from(["plan-reviewer", "review", "test.md"]).expect("parse failed");
        match cli.command {
            Some(Commands::Review { file, .. }) => assert_eq!(file, "test.md"),
            other => panic!("expected Commands::Review, got {:?}", other),
        }
    }

    #[test]
    fn test_cli_review_subcommand_requires_file() {
        let result = Cli::try_parse_from(["plan-reviewer", "review"]);
        assert!(
            result.is_err(),
            "review without file argument should fail to parse"
        );
    }
}

use clap::{Parser, Subcommand};
use hook::{HookInput, HookOutput};
use server::Decision;

#[derive(Parser, Debug)]
#[command(
    version,
    about = "Plan reviewer hook binary (supports: claude, gemini, opencode)"
)]
struct Cli {
    /// Skip opening the browser and print the review URL to stderr only
    #[arg(long, default_value_t = false)]
    no_browser: bool,

    /// Bind the review server to this port (0 = OS-assigned, default)
    #[arg(long, default_value_t = 0)]
    port: u16,

    /// Read plan content from a file instead of stdin (used by opencode plugin)
    #[arg(long)]
    plan_file: Option<String>,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Receive a hook event from stdin and open the browser review UI.
    ///
    /// This is the explicit subcommand form of the default hook behavior.
    /// The bare `plan-reviewer` invocation (without a subcommand) is
    /// deprecated and will be removed in a future major version.
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
    /// Wire the ExitPlanMode hook into one or more integrations (default: interactive picker)
    Install {
        /// Integration names: claude, gemini, opencode (omit for interactive picker)
        integrations: Vec<String>,
    },
    /// Remove the ExitPlanMode hook from one or more integrations
    Uninstall {
        /// Integration names: claude, gemini, opencode (omit for interactive picker)
        integrations: Vec<String>,
    },
    /// Update plan-reviewer to the latest version from GitHub releases
    Update {
        /// Only check for updates, don't download
        #[arg(long)]
        check: bool,
        /// Pin to a specific version tag (e.g., v0.2.0)
        #[arg(long)]
        version: Option<String>,
        /// Skip confirmation prompt
        #[arg(short = 'y', long)]
        yes: bool,
    },
    /// Open the code review UI for the current git branch.
    ///
    /// Starts the local server and opens the browser at /code-review.
    /// Does not read stdin.
    CodeReview,
    /// Claude Code PreToolUse hook handler.
    ///
    /// Reads stdin JSON, filters by tool_input.command, exits 0 silently when
    /// the command is not a PR/push, otherwise delegates to the code-review flow.
    PrePrHook,
}

/// Extract plan Markdown from hook input.
///
/// Claude Code sends the plan inline in `tool_input.plan`.
/// Gemini CLI sends a filesystem path in `tool_input.plan_path`.
/// If both are present, prefer the inline plan (Claude Code case).
/// If neither is present, return an empty string.
fn extract_plan_content(tool_input: &hook::ToolInput) -> String {
    if let Some(ref plan) = tool_input.plan {
        return plan.clone();
    }
    if let Some(ref plan_path) = tool_input.plan_path {
        match std::fs::read_to_string(plan_path) {
            Ok(content) => return content,
            Err(e) => {
                eprintln!("Failed to read plan file at {}: {}", plan_path, e);
                std::process::exit(1);
            }
        }
    }
    String::new()
}

/// Build the Gemini CLI response JSON from a browser decision.
fn build_gemini_output(decision: &Decision) -> serde_json::Value {
    match decision.behavior.as_str() {
        "allow" => serde_json::json!({ "decision": "allow" }),
        _ => serde_json::json!({
            "decision": "deny",
            "reason": decision.message.as_deref().unwrap_or("Denied without message"),
            "systemMessage": "Plan denied by plan-reviewer. Please revise the plan."
        }),
    }
}

/// Build the opencode response JSON from a browser decision.
///
/// Format: {"behavior":"allow"} or {"behavior":"deny","message":"..."}
/// This is the format the JS plugin parses in opencode_plugin.mjs.
fn build_opencode_output(decision: &Decision) -> serde_json::Value {
    match decision.behavior.as_str() {
        "allow" => serde_json::json!({ "behavior": "allow" }),
        _ => {
            let mut obj = serde_json::json!({
                "behavior": "deny"
            });
            if let Some(ref msg) = decision.message {
                obj["message"] = serde_json::Value::String(msg.clone());
            }
            obj
        }
    }
}

/// Extract the `command` field from a `ToolInput`'s extra map.
///
/// PreToolUse Bash events carry the shell command in `tool_input.command`.
/// Because `ToolInput.extra` captures arbitrary keys via `#[serde(flatten)]`,
/// this helper isolates the JSON-shape dependency from filtering logic.
#[allow(dead_code)] // used by run_pre_pr_hook_flow (Task 2) — remove once wired
fn extract_command_from_tool_input(tool_input: &hook::ToolInput) -> Option<&str> {
    tool_input
        .extra
        .get("command")
        .and_then(serde_json::Value::as_str)
}

/// Return `true` if `cmd` looks like a PR-creating or push command.
///
/// Matches `gh pr create ...` and `git push ...` (with optional leading whitespace).
/// Uses explicit `starts_with` — no regex dependency.
#[allow(dead_code)] // used by should_trigger_code_review (Task 2) — remove once wired
fn is_pr_command(cmd: &str) -> bool {
    let t = cmd.trim_start();
    t.starts_with("gh pr create") || t.starts_with("git push")
}

fn run_opencode_flow(no_browser: bool, port: u16, plan_file: &str) {
    // Read plan content from file — does NOT read stdin
    let plan_md = match std::fs::read_to_string(plan_file) {
        Ok(content) => content,
        Err(e) => {
            eprintln!("Failed to read plan file at {}: {}", plan_file, e);
            std::process::exit(1);
        }
    };
    eprintln!(
        "Plan loaded from file ({} bytes): {}",
        plan_md.len(),
        plan_file
    );

    // Start tokio runtime and run the browser review flow
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

    // Build opencode output format and write to stdout — THE ONLY stdout write
    let output = build_opencode_output(&decision);
    serde_json::to_writer(std::io::stdout(), &output).expect("failed to write hook output");
}

/// Run the browser review flow for any markdown file on disk.
///
/// Reads `file` from the filesystem (does NOT read stdin), opens the browser
/// review UI, and writes neutral `{"behavior":"allow"|"deny"}` JSON to stdout.
/// This enables scripts and agent workflows to invoke plan-reviewer without
/// constructing hook-specific JSON.
fn run_review_flow(no_browser: bool, port: u16, file: &str, approve_label: &str, deny_label: &str) {
    // Read plan content from file — does NOT read stdin
    let plan_md = match std::fs::read_to_string(file) {
        Ok(content) => content,
        Err(e) => {
            eprintln!("Failed to read file at {}: {}", file, e);
            std::process::exit(1);
        }
    };
    eprintln!("Plan loaded from file ({} bytes): {}", plan_md.len(), file);

    // In debug mode, verify frontend assets exist before starting the server.
    #[cfg(debug_assertions)]
    {
        if server::Assets::get("index.html").is_none() {
            eprintln!("ERROR: Frontend assets not found at ui/dist/index.html");
            eprintln!(
                "Run 'cd ui && npm run build' first, or run 'cargo run' from the project root."
            );
            std::process::exit(1);
        }
    }

    // Start tokio runtime and run the browser review flow
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();

    let decision = rt.block_on(async_main(
        no_browser,
        port,
        plan_md,
        approve_label.to_string(),
        deny_label.to_string(),
    ));

    // Build neutral output format and write to stdout — THE ONLY stdout write
    let output = build_opencode_output(&decision);
    serde_json::to_writer(std::io::stdout(), &output).expect("failed to write hook output");
}

fn main() {
    // 1. Parse CLI args FIRST — before stdin read (Pitfall 5: install must not hang on stdin)
    let cli = Cli::parse();

    match &cli.command {
        Some(Commands::ReviewHook) => {
            run_hook_flow(cli.no_browser, cli.port);
        }
        Some(Commands::Review {
            file,
            approve_label,
            deny_label,
        }) => {
            run_review_flow(cli.no_browser, cli.port, file, approve_label, deny_label);
        }
        Some(Commands::Install { integrations }) => {
            // install subcommand: does NOT read stdin
            install::run_install(integrations.clone());
        }
        Some(Commands::Uninstall { integrations }) => {
            // uninstall subcommand: does NOT read stdin
            uninstall::run_uninstall(integrations.clone());
        }
        Some(Commands::Update {
            check,
            version,
            yes,
        }) => {
            // update subcommand: does NOT read stdin
            update::run_update(*check, version.clone(), *yes);
        }
        Some(Commands::CodeReview) => {
            // Placeholder: wired in Task 2 (run_code_review_flow)
            todo!("CodeReview flow — implemented in Task 2")
        }
        Some(Commands::PrePrHook) => {
            // Placeholder: wired in Task 2 (run_pre_pr_hook_flow)
            todo!("PrePrHook flow — implemented in Task 2")
        }
        None => {
            if let Some(ref plan_file) = cli.plan_file {
                // opencode uses --plan-file flag directly (no subcommand, no deprecation)
                run_opencode_flow(cli.no_browser, cli.port, plan_file);
            } else {
                // Deprecated: bare plan-reviewer invocation without 'review-hook' subcommand.
                eprintln!(
                    "plan-reviewer: deprecation warning: invoking plan-reviewer without \
                     the 'review-hook' subcommand is deprecated and will be removed in a future \
                     major version. Use 'plan-reviewer review-hook' instead. \
                     Run 'plan-reviewer update' to upgrade all integration files automatically."
                );
                run_hook_flow(cli.no_browser, cli.port);
            }
        }
    }
}

fn run_hook_flow(no_browser: bool, port: u16) {
    // 2. Read all of stdin synchronously (before any async runtime)
    let input_json = match std::io::read_to_string(std::io::stdin()) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Failed to read stdin: {}", e);
            std::process::exit(1);
        }
    };

    // 3. Parse JSON into HookInput
    let hook_input: HookInput = serde_json::from_str(&input_json).unwrap_or_else(|e| {
        eprintln!("Failed to parse hook input: {}", e);
        std::process::exit(1);
    });

    // 4. In debug mode, verify frontend assets exist before starting the server.
    //    rust-embed reads from the filesystem in debug builds, so if ui/dist/ is
    //    missing the server would start but serve nothing.  Catch it early.
    #[cfg(debug_assertions)]
    {
        if server::Assets::get("index.html").is_none() {
            eprintln!("ERROR: Frontend assets not found at ui/dist/index.html");
            eprintln!(
                "Run 'cd ui && npm run build' first, or run 'cargo run' from the project root."
            );
            std::process::exit(1);
        }
    }

    // 5. Get plan markdown
    let plan_md = extract_plan_content(&hook_input.tool_input);
    eprintln!("Plan received ({} bytes)", plan_md.len());

    // 6. Start tokio runtime (current_thread for single-user tool)
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

    // 7. Build integration-specific output JSON and write to stdout — THE ONLY stdout write
    let output_json: serde_json::Value = if hook_input.is_gemini() {
        // Gemini CLI: flat {decision, reason, systemMessage} format
        build_gemini_output(&decision)
    } else {
        // Claude Code: nested hookSpecificOutput format
        let hook_output = match decision.behavior.as_str() {
            "allow" => HookOutput::allow(),
            "deny" => HookOutput::deny(
                decision
                    .message
                    .unwrap_or_else(|| "Denied without message".to_string()),
            ),
            other => {
                eprintln!("Unknown decision behavior: {}", other);
                HookOutput::deny(format!("Unknown behavior: {}", other))
            }
        };
        serde_json::to_value(hook_output).expect("HookOutput serialization cannot fail")
    };
    serde_json::to_writer(std::io::stdout(), &output_json).expect("failed to write hook output");
}

async fn async_main(
    no_browser: bool,
    port: u16,
    plan_md: String,
    approve_label: String,
    deny_label: String,
) -> Decision {
    // Start server
    let (port, decision_rx) =
        match server::start_server(plan_md, approve_label, deny_label, port).await {
            Ok(v) => v,
            Err(e) => {
                eprintln!("Failed to start server: {}", e);
                return Decision {
                    behavior: "deny".to_string(),
                    message: Some(format!("Internal error: {}", e)),
                };
            }
        };

    let url = format!("http://127.0.0.1:{}/", port);

    // Always print URL to stderr (UI-06)
    eprintln!("Review UI: {}", url);

    // Open browser unless --no-browser (CONF-02)
    if !no_browser && let Err(e) = webbrowser::open(&url) {
        eprintln!("Failed to open browser: {}", e);
        eprintln!("Open manually: {}", url);
    }

    // Race: user decision vs timeout (540 seconds, per D-07)
    const TIMEOUT_SECS: u64 = 540;

    let decision = tokio::select! {
        result = decision_rx => {
            match result {
                Ok(d) => d,
                Err(_) => {
                    eprintln!("Decision channel closed unexpectedly");
                    Decision {
                        behavior: "deny".to_string(),
                        message: Some("Internal error: decision channel closed".to_string()),
                    }
                }
            }
        }
        _ = tokio::time::sleep(std::time::Duration::from_secs(TIMEOUT_SECS)) => {
            eprintln!("Review timed out after {} seconds", TIMEOUT_SECS);
            Decision {
                behavior: "deny".to_string(),
                message: Some("Review timed out \u{2014} plan was not approved".to_string()),
            }
        }
    };

    // Spawn 3-second watchdog for clean exit (HOOK-04: after stdout write completes)
    tokio::spawn(async {
        tokio::time::sleep(std::time::Duration::from_secs(3)).await;
        std::process::exit(0);
    });

    decision
}
