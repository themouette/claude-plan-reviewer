mod hook;
mod install;
mod integrations;
mod server;
mod uninstall;
mod update;

#[cfg(test)]
mod tests {
    use super::{
        Cli, Commands, build_gemini_output, build_opencode_output, extract_diff,
        extract_plan_content,
    };
    use crate::hook;
    use crate::hook::HookOutput;
    use crate::server;
    use clap::Parser;

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
    fn test_extract_diff_nonexistent_path() {
        let result = extract_diff("/nonexistent/path/xyz");
        assert_eq!(result, "", "Non-existent path should return empty string");
    }

    #[test]
    fn test_extract_diff_non_git_dir() {
        let result = extract_diff(std::env::temp_dir().to_str().unwrap());
        assert_eq!(result, "", "Non-git directory should return empty string");
    }

    #[test]
    fn test_extract_diff_dirty_repo() {
        use std::fs;
        // Create a temp dir with a git repo that has uncommitted changes
        let tmp = tempfile::tempdir().expect("failed to create temp dir");
        let repo = git2::Repository::init(tmp.path()).expect("failed to init repo");

        // Create initial commit so HEAD exists
        {
            let sig = git2::Signature::now("test", "test@test.com").unwrap();
            let tree_id = repo.index().unwrap().write_tree().unwrap();
            let tree = repo.find_tree(tree_id).unwrap();
            repo.commit(Some("HEAD"), &sig, &sig, "init", &tree, &[])
                .unwrap();
        }

        // Write a new (untracked/modified) file
        let file_path = tmp.path().join("hello.txt");
        fs::write(&file_path, "hello world\n").expect("failed to write file");

        // Stage the file so it shows in diff_tree_to_workdir_with_index
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("hello.txt")).unwrap();
        index.write().unwrap();

        let result = extract_diff(tmp.path().to_str().unwrap());
        assert!(
            !result.is_empty(),
            "Dirty repo should return non-empty diff string"
        );
        // Should contain diff markers
        let has_diff_marker =
            result.contains("diff --git") || result.contains("@@") || result.contains('+');
        assert!(
            has_diff_marker,
            "Diff output should contain diff markers, got: {}",
            result
        );
    }

    #[test]
    fn test_extract_diff_clean_repo() {
        // Create a temp dir with a clean git repo (no uncommitted changes)
        let tmp = tempfile::tempdir().expect("failed to create temp dir");
        let repo = git2::Repository::init(tmp.path()).expect("failed to init repo");

        // Create initial commit
        {
            let sig = git2::Signature::now("test", "test@test.com").unwrap();
            let tree_id = repo.index().unwrap().write_tree().unwrap();
            let tree = repo.find_tree(tree_id).unwrap();
            repo.commit(Some("HEAD"), &sig, &sig, "init", &tree, &[])
                .unwrap();
        }

        let result = extract_diff(tmp.path().to_str().unwrap());
        assert_eq!(result, "", "Clean repo should return empty diff string");
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
            Some(Commands::Review { file }) => assert_eq!(file, "test.md"),
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
}

/// Extract the unified diff of the working tree against HEAD from the given
/// directory.  Returns an empty string if `cwd` is not a git repository,
/// does not exist, or has no uncommitted changes.
fn extract_diff(cwd: &str) -> String {
    let repo = match git2::Repository::open(cwd) {
        Ok(r) => r,
        Err(_) => return String::new(),
    };

    // Force standard a/b prefixes regardless of diff.mnemonicPrefix git config,
    // because @pierre/diffs regex only matches `a/` and `b/` prefixes.
    let mut opts = git2::DiffOptions::new();
    opts.old_prefix("a/").new_prefix("b/");

    // Prefer full working-tree diff vs HEAD (staged + unstaged)
    let diff = if let Ok(head) = repo.head() {
        if let Ok(commit) = head.peel_to_commit() {
            if let Ok(tree) = commit.tree() {
                repo.diff_tree_to_workdir_with_index(Some(&tree), Some(&mut opts))
                    .ok()
            } else {
                None
            }
        } else {
            None
        }
    } else {
        None
    };

    // Fallback: unstaged changes only (works on empty repos with no HEAD)
    let diff = diff.or_else(|| repo.diff_index_to_workdir(None, Some(&mut opts)).ok());

    let diff = match diff {
        Some(d) => d,
        None => return String::new(),
    };

    let mut output = String::new();
    let _ = diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        if let Ok(s) = std::str::from_utf8(line.content()) {
            match line.origin() {
                '+' | '-' | ' ' => {
                    output.push(line.origin());
                    output.push_str(s);
                }
                _ => {
                    // File headers, hunk headers, binary markers — already formatted by git2
                    output.push_str(s);
                }
            }
        }
        true
    });

    output
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

    // Extract diff from current working directory (no HookInput cwd available)
    let cwd = std::env::current_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_default();
    let diff_content = extract_diff(&cwd);
    eprintln!("Diff extracted ({} bytes)", diff_content.len());

    // Start tokio runtime and run the browser review flow
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();

    let decision = rt.block_on(async_main(no_browser, port, plan_md, diff_content));

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
fn run_review_flow(no_browser: bool, port: u16, file: &str) {
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

    // Extract diff from current working directory
    let cwd = std::env::current_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_default();
    let diff_content = extract_diff(&cwd);
    eprintln!("Diff extracted ({} bytes)", diff_content.len());

    // Start tokio runtime and run the browser review flow
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();

    let decision = rt.block_on(async_main(no_browser, port, plan_md, diff_content));

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
        Some(Commands::Review { file }) => {
            run_review_flow(cli.no_browser, cli.port, file);
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

    // 5b. Extract git diff from the hook's cwd
    let diff_content = extract_diff(&hook_input.cwd);
    eprintln!("Diff extracted ({} bytes)", diff_content.len());

    // 6. Start tokio runtime (current_thread for single-user tool)
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();

    let decision = rt.block_on(async_main(no_browser, port, plan_md, diff_content));

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
    diff_content: String,
) -> Decision {
    // Start server
    let (port, decision_rx) = match server::start_server(plan_md, diff_content, port).await {
        Ok(v) => v,
        Err(e) => {
            eprintln!("Failed to start server: {}", e);
            return Decision {
                behavior: "deny".to_string(),
                message: Some(format!("Internal error: {}", e)),
            };
        }
    };

    let url = format!("http://127.0.0.1:{}", port);

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
