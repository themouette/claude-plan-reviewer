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
        Cli, Commands, build_gemini_output, build_opencode_output, build_review_url,
        extract_command_from_tool_input, extract_plan_content, is_pr_command, parse_base_url,
        parse_bind_addr, should_trigger_code_review,
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
            matches!(cli.command, Some(Commands::CodeReview { base: None })),
            "expected Commands::CodeReview with no base"
        );
    }

    #[test]
    fn test_cli_code_review_with_base_flag() {
        let cli = Cli::try_parse_from(["plan-reviewer", "code-review", "--base", "develop"])
            .expect("parse failed");
        assert!(
            matches!(cli.command, Some(Commands::CodeReview { base: Some(ref b) }) if b == "develop"),
            "expected Commands::CodeReview with base=develop"
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
            matches!(cli.command, Some(Commands::CodeReview { .. })),
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
            is_pr_command("  gh pr create"),
            "leading whitespace + gh pr create"
        );
        // Negative cases — git push no longer triggers the reviewer
        assert!(
            !is_pr_command("git push origin main"),
            "git push must not trigger review"
        );
        assert!(
            !is_pr_command("git push"),
            "bare git push must not trigger review"
        );
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
        assert_eq!(build_review_url(8080, "/", None), "http://127.0.0.1:8080/");
        assert_eq!(
            build_review_url(3000, "/code-review", None),
            "http://127.0.0.1:3000/code-review"
        );
        assert_eq!(
            build_review_url(0, "/code-review", None),
            "http://127.0.0.1:0/code-review"
        );
    }

    #[test]
    fn test_build_review_url_with_base_url() {
        assert_eq!(
            build_review_url(8080, "/", Some("http://192.168.1.42")),
            "http://192.168.1.42:8080/"
        );
        assert_eq!(
            build_review_url(3000, "/code-review", Some("http://192.168.1.42")),
            "http://192.168.1.42:3000/code-review"
        );
    }

    #[test]
    fn test_build_review_url_strips_trailing_slash_from_base_url() {
        assert_eq!(
            build_review_url(8080, "/", Some("http://192.168.1.42/")),
            "http://192.168.1.42:8080/"
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
    fn test_run_pre_pr_hook_flow_does_not_trigger_on_git_push() {
        let raw = r#"{"session_id":"s","cwd":"/tmp","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"git push origin feature/foo"}}"#;
        let hi: hook::HookInput = serde_json::from_str(raw).unwrap();
        assert!(!should_trigger_code_review(&hi));
    }

    #[test]
    fn test_run_pre_pr_hook_flow_handles_missing_command_field() {
        let raw = r#"{"session_id":"s","cwd":"/tmp","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{}}"#;
        let hi: hook::HookInput = serde_json::from_str(raw).unwrap();
        assert!(!should_trigger_code_review(&hi));
    }

    #[test]
    fn test_cli_port_flag_default_zero() {
        let _guard = env_lock().lock().unwrap();
        let cli = Cli::try_parse_from(["plan-reviewer"]).expect("parse failed");
        assert_eq!(cli.port, 0, "--port default should be 0");
    }

    #[test]
    fn test_cli_port_flag_accepts_value() {
        let _guard = env_lock().lock().unwrap();
        let cli = Cli::try_parse_from(["plan-reviewer", "--port", "8080"]).expect("parse failed");
        assert_eq!(cli.port, 8080, "--port should accept 8080");
    }

    /// Mutex that serializes tests that mutate `PLAN_REVIEWER_BIND` in the process
    /// environment. The Rust test harness runs unit tests in parallel by default; without
    /// this lock, `test_cli_bind_env_var` (which sets then removes the var) races with
    /// `test_cli_bind_default` (which parses Cli and reads the same var via clap).
    fn env_lock() -> &'static std::sync::Mutex<()> {
        static LOCK: std::sync::OnceLock<std::sync::Mutex<()>> = std::sync::OnceLock::new();
        LOCK.get_or_init(|| std::sync::Mutex::new(()))
    }

    #[test]
    fn test_cli_bind_default() {
        let _guard = env_lock().lock().unwrap();
        let cli = Cli::try_parse_from(["plan-reviewer"]).expect("parse failed");
        assert_eq!(cli.bind, "127.0.0.1", "--bind default should be 127.0.0.1");
    }

    #[test]
    fn test_cli_bind_flag_accepts_value() {
        let _guard = env_lock().lock().unwrap();
        let cli =
            Cli::try_parse_from(["plan-reviewer", "--bind", "0.0.0.0"]).expect("parse failed");
        assert_eq!(cli.bind, "0.0.0.0");
    }

    #[test]
    fn test_cli_bind_flag_overrides_env_var() {
        let _guard = env_lock().lock().unwrap();
        unsafe { std::env::set_var("PLAN_REVIEWER_BIND", "10.0.0.1") };
        let cli =
            Cli::try_parse_from(["plan-reviewer", "--bind", "0.0.0.0"]).expect("parse failed");
        unsafe { std::env::remove_var("PLAN_REVIEWER_BIND") };
        assert_eq!(
            cli.bind, "0.0.0.0",
            "--bind flag must take precedence over PLAN_REVIEWER_BIND env var"
        );
    }

    #[test]
    fn test_cli_bind_rejects_invalid_address() {
        let result = Cli::try_parse_from(["plan-reviewer", "--bind", "not-an-ip"]);
        assert!(result.is_err(), "--bind should reject non-IP values");
    }

    #[test]
    fn test_cli_bind_env_var() {
        let _guard = env_lock().lock().unwrap();
        // SAFETY: env mutation is serialized by env_lock(); no other test reads
        // PLAN_REVIEWER_BIND concurrently while this guard is held.
        unsafe { std::env::set_var("PLAN_REVIEWER_BIND", "0.0.0.0") };
        let cli = Cli::try_parse_from(["plan-reviewer"]).expect("parse failed");
        unsafe { std::env::remove_var("PLAN_REVIEWER_BIND") };
        assert_eq!(cli.bind, "0.0.0.0");
    }

    #[test]
    fn test_cli_base_url_default_none() {
        let _guard = env_lock().lock().unwrap();
        let cli = Cli::try_parse_from(["plan-reviewer"]).expect("parse failed");
        assert!(cli.base_url.is_none());
    }

    #[test]
    fn test_cli_base_url_flag_accepts_value() {
        let _guard = env_lock().lock().unwrap();
        let cli = Cli::try_parse_from(["plan-reviewer", "--base-url", "http://192.168.1.42"])
            .expect("parse failed");
        assert_eq!(cli.base_url.as_deref(), Some("http://192.168.1.42"));
    }

    #[test]
    fn test_cli_base_url_accepts_https() {
        let _guard = env_lock().lock().unwrap();
        let cli = Cli::try_parse_from(["plan-reviewer", "--base-url", "https://myserver.local"])
            .expect("parse failed");
        assert_eq!(cli.base_url.as_deref(), Some("https://myserver.local"));
    }

    #[test]
    fn test_cli_base_url_rejects_missing_scheme() {
        let result = Cli::try_parse_from(["plan-reviewer", "--base-url", "192.168.1.42"]);
        assert!(
            result.is_err(),
            "bare host without scheme should be rejected"
        );
    }

    #[test]
    fn test_cli_base_url_rejects_embedded_port() {
        let result =
            Cli::try_parse_from(["plan-reviewer", "--base-url", "http://192.168.1.42:9000"]);
        assert!(result.is_err(), "--base-url with port should be rejected");
    }

    #[test]
    fn test_parse_base_url_valid() {
        assert!(parse_base_url("http://192.168.1.42").is_ok());
        assert!(parse_base_url("https://myserver.local").is_ok());
        // IPv6 without port must be accepted
        assert!(parse_base_url("http://[::1]").is_ok());
        assert!(parse_base_url("https://[::1]").is_ok());
    }

    #[test]
    fn test_parse_base_url_rejects_bad_scheme() {
        assert!(parse_base_url("ftp://192.168.1.42").is_err());
        assert!(parse_base_url("javascript:alert(1)").is_err());
        assert!(parse_base_url("file:///etc/passwd").is_err());
        assert!(parse_base_url("192.168.1.42").is_err());
    }

    #[test]
    fn test_parse_base_url_rejects_empty_host() {
        assert!(
            parse_base_url("http://").is_err(),
            "http:// with no host should be rejected"
        );
        assert!(
            parse_base_url("https://").is_err(),
            "https:// with no host should be rejected"
        );
    }

    #[test]
    fn test_parse_base_url_rejects_embedded_port() {
        let err = parse_base_url("http://192.168.1.42:9000").unwrap_err();
        assert!(err.contains("port"), "error should mention port: {err}");
    }

    #[test]
    fn test_parse_base_url_rejects_ipv6_with_port() {
        let err = parse_base_url("http://[::1]:9000").unwrap_err();
        assert!(
            err.contains("port"),
            "IPv6 with port should be rejected: {err}"
        );
    }

    #[test]
    fn test_parse_base_url_rejects_unclosed_ipv6_bracket() {
        let err = parse_base_url("http://[::1").unwrap_err();
        assert!(
            err.contains("bracket"),
            "unclosed IPv6 bracket should be rejected: {err}"
        );
    }

    #[test]
    fn test_build_review_url_with_ipv6_base_url() {
        assert_eq!(
            build_review_url(8080, "/", Some("http://[::1]")),
            "http://[::1]:8080/"
        );
        assert_eq!(
            build_review_url(3000, "/code-review", Some("http://[::1]")),
            "http://[::1]:3000/code-review"
        );
    }

    #[test]
    fn test_parse_bind_addr_valid() {
        assert!(parse_bind_addr("127.0.0.1").is_ok());
        assert!(parse_bind_addr("0.0.0.0").is_ok());
        assert!(parse_bind_addr("::1").is_ok());
        assert!(parse_bind_addr("::").is_ok());
    }

    #[test]
    fn test_parse_bind_addr_rejects_invalid() {
        assert!(parse_bind_addr("not-an-ip").is_err());
        assert!(parse_bind_addr("127.0.0.1:8080").is_err());
        assert!(parse_bind_addr("").is_err());
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
            comments: vec![],
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
            comments: vec![],
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
            comments: vec![],
        };
        let output = build_opencode_output(&decision);
        assert_eq!(output["behavior"].as_str(), Some("allow"));
        assert!(
            output.get("message").is_none(),
            "allow with no feedback should not have message field"
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
    fn test_opencode_allow_with_feedback_output_format() {
        let decision = server::Decision {
            behavior: "allow".to_string(),
            message: Some("LGTM but watch the error handling".to_string()),
            comments: vec![],
        };
        let output = build_opencode_output(&decision);
        assert_eq!(output["behavior"].as_str(), Some("allow"));
        assert!(
            output.get("message").is_some(),
            "allow with feedback should include message field"
        );
        assert!(
            output.get("hookSpecificOutput").is_none(),
            "opencode format must not have hookSpecificOutput"
        );
    }

    #[test]
    fn test_opencode_deny_output_format() {
        let decision = server::Decision {
            behavior: "deny".to_string(),
            message: Some("Needs more tests".to_string()),
            comments: vec![],
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
            comments: vec![],
        };
        let output = build_opencode_output(&decision);
        assert_eq!(output["behavior"].as_str(), Some("deny"));
        assert!(
            output.get("message").is_none(),
            "deny without message should not have message field"
        );
    }

    #[test]
    fn test_opencode_deny_with_comments_includes_comments_in_message() {
        let decision = server::Decision {
            behavior: "deny".to_string(),
            message: Some("needs work".to_string()),
            comments: vec![serde_json::json!({
                "file": "src/main.rs",
                "line": 1,
                "text": "this is problematic"
            })],
        };
        let output = build_opencode_output(&decision);
        assert_eq!(output["behavior"].as_str(), Some("deny"));
        let msg = output["message"].as_str().unwrap_or("");
        assert!(
            msg.contains("this is problematic"),
            "deny with inline comments should include comment text in message, got: {msg}"
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
use hook::{HookInput, HookOutput, pre_tool_use_advisory};
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

    /// IP address to bind the review server on (e.g. 0.0.0.0 to accept connections from all
    /// interfaces). Defaults to 127.0.0.1 (loopback only). When binding to 0.0.0.0 or another
    /// non-loopback address, also set --base-url so the printed URL is reachable from the browser.
    #[arg(long, default_value = "127.0.0.1", env = "PLAN_REVIEWER_BIND", value_parser = parse_bind_addr)]
    bind: String,

    /// Base URL shown to the user and opened in the browser (e.g. http://192.168.1.42).
    /// Useful when the bind address is not directly reachable from the browser (e.g. inside a VM:
    /// use --bind 0.0.0.0 --base-url http://<vm-ip> so the server accepts connections from the
    /// host and the printed URL points to the right address).
    /// Must use http:// or https:// and must not include a port number (it is appended automatically).
    #[arg(long, value_parser = parse_base_url)]
    base_url: Option<String>,

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
    CodeReview {
        /// Override the base branch used for the diff (e.g. main, develop, origin/main).
        /// Defaults to automatic detection via refs/remotes/origin/HEAD or common branch names.
        #[arg(long)]
        base: Option<String>,
    },
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

/// Format reviewer feedback (message + inline comments) into a single string.
///
/// Returns `None` when there is no feedback to include. Used to populate the
/// `message` field in hook outputs so the reviewer's notes reach the agent.
fn build_code_review_feedback(decision: &Decision) -> Option<String> {
    let has_message = decision
        .message
        .as_deref()
        .is_some_and(|m| !m.trim().is_empty());
    let has_comments = !decision.comments.is_empty();
    if !has_message && !has_comments {
        return None;
    }

    let mut out = String::new();
    if let Some(msg) = &decision.message {
        let trimmed = msg.trim();
        if !trimmed.is_empty() {
            out.push_str(trimmed);
        }
    }
    if has_comments {
        if !out.is_empty() {
            out.push_str("\n\n");
        }
        out.push_str("Inline comments:\n");
        for comment in &decision.comments {
            let file = comment.get("file").and_then(|v| v.as_str()).unwrap_or("?");
            let text = comment.get("text").and_then(|v| v.as_str()).unwrap_or("");
            if let Some(line) = comment.get("line").and_then(|v| v.as_u64()) {
                let side = comment.get("side").and_then(|v| v.as_str()).unwrap_or("");
                if let Some(end) = comment.get("endLine").and_then(|v| v.as_u64()) {
                    out.push_str(&format!(
                        "- {}:{}-{} ({}): {}\n",
                        file, line, end, side, text
                    ));
                } else {
                    out.push_str(&format!("- {}:{} ({}): {}\n", file, line, side, text));
                }
            } else {
                out.push_str(&format!("- {}: {}\n", file, text));
            }
        }
    }
    Some(out)
}

/// Build the opencode response JSON from a browser decision.
///
/// For "allow" with reviewer feedback (message or inline comments), the feedback
/// is included in the `message` field so the agent can see the reviewer's notes.
/// Format: {"behavior":"allow"} or {"behavior":"allow","message":"..."} or {"behavior":"deny","message":"..."}
fn build_opencode_output(decision: &Decision) -> serde_json::Value {
    match decision.behavior.as_str() {
        "allow" => {
            if let Some(feedback) = build_code_review_feedback(decision) {
                serde_json::json!({ "behavior": "allow", "message": feedback })
            } else {
                serde_json::json!({ "behavior": "allow" })
            }
        }
        _ => {
            if let Some(feedback) = build_code_review_feedback(decision) {
                serde_json::json!({ "behavior": "deny", "message": feedback })
            } else {
                serde_json::json!({ "behavior": "deny" })
            }
        }
    }
}

/// Extract the `command` field from a `ToolInput`'s extra map.
///
/// PreToolUse Bash events carry the shell command in `tool_input.command`.
/// Because `ToolInput.extra` captures arbitrary keys via `#[serde(flatten)]`,
/// this helper isolates the JSON-shape dependency from filtering logic.
fn extract_command_from_tool_input(tool_input: &hook::ToolInput) -> Option<&str> {
    tool_input
        .extra
        .get("command")
        .and_then(serde_json::Value::as_str)
}

/// Return `true` if `cmd` is an explicit PR-creation command.
///
/// Only matches `gh pr create ...` — explicit signal of intent to open a PR.
/// `git push` is intentionally excluded: pushes are too common and trigger the
/// reviewer on every branch sync, not just PR creation.
fn is_pr_command(cmd: &str) -> bool {
    cmd.trim_start().starts_with("gh pr create")
}

/// Validate a `--bind` address: must parse as a valid IP address.
///
/// Used as a clap `value_parser` so errors surface at argument-parse time.
fn parse_bind_addr(s: &str) -> Result<String, String> {
    s.parse::<std::net::IpAddr>()
        .map(|_| s.to_string())
        .map_err(|_| format!("'{s}' is not a valid IP address (e.g. 127.0.0.1 or 0.0.0.0 or ::1)"))
}

fn parse_base_url(s: &str) -> Result<String, String> {
    let after_scheme = if let Some(rest) = s.strip_prefix("https://") {
        rest
    } else if let Some(rest) = s.strip_prefix("http://") {
        rest
    } else {
        return Err(format!(
            "'{s}' is not a valid base URL: must start with http:// or https://"
        ));
    };
    // Reject empty host (e.g. "http://")
    let host_segment = after_scheme.split('/').next().unwrap_or("");
    if host_segment.is_empty() {
        return Err(format!("'{s}' is missing a host"));
    }
    // Reject embedded port. IPv6 addresses use bracket notation ([::1]) so the host
    // segment may contain ':' inside brackets — those are valid. A port appears as a
    // bare ':' after the closing bracket (e.g. [::1]:9000) or after a plain hostname.
    // Simple rule: a ':' that is NOT inside [...] indicates a port.
    let has_port = if host_segment.starts_with('[') {
        // Reject malformed IPv6 addresses missing the closing bracket.
        if !host_segment.contains(']') {
            return Err(format!("'{s}' contains an unclosed IPv6 bracket"));
        }
        // IPv6: port is present only if there is a ':' after the closing ']'
        host_segment
            .find(']')
            .map(|i| host_segment[i + 1..].contains(':'))
            .unwrap_or(false)
    } else {
        host_segment.contains(':')
    };
    if has_port {
        return Err(format!(
            "'{s}' contains a port number — omit the port from --base-url \
             (the server port is appended automatically)"
        ));
    }
    Ok(s.to_string())
}

/// Build the review server URL for a given port and path.
///
/// Pure helper — unit-testable without starting the server.
/// `base_url` overrides the host (e.g. `http://192.168.1.42`); trailing slashes are stripped.
fn build_review_url(port: u16, path: &str, base_url: Option<&str>) -> String {
    let base = base_url.unwrap_or("http://127.0.0.1").trim_end_matches('/');
    format!("{}:{}{}", base, port, path)
}

/// Return `true` if a PreToolUse hook event should trigger the code-review flow.
///
/// Extracts `tool_input.command` and delegates to `is_pr_command`.
/// Returns `false` when `command` is absent (defensive: empty stdin payloads
/// must not trigger the server).
fn should_trigger_code_review(hook_input: &hook::HookInput) -> bool {
    extract_command_from_tool_input(&hook_input.tool_input)
        .map(is_pr_command)
        .unwrap_or(false)
}

/// Server configuration derived from CLI flags, passed through all flow functions into `async_main`.
#[derive(Debug)]
struct ServerConfig {
    no_browser: bool,
    port: u16,
    bind: String,
    base_url: Option<String>,
}

fn run_opencode_flow(config: ServerConfig, plan_file: &str) {
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
        config,
        plan_md,
        "Approve".to_string(),
        "Deny".to_string(),
        "/",
        None,
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
fn run_review_flow(config: ServerConfig, file: &str, approve_label: &str, deny_label: &str) {
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
        config,
        plan_md,
        approve_label.to_string(),
        deny_label.to_string(),
        "/",
        None,
    ));

    // Build neutral output format and write to stdout — THE ONLY stdout write
    let output = build_opencode_output(&decision);
    serde_json::to_writer(std::io::stdout(), &output).expect("failed to write hook output");
}

fn main() {
    // 1. Parse CLI args FIRST — before stdin read (Pitfall 5: install must not hang on stdin)
    let cli = Cli::parse();

    macro_rules! config {
        () => {
            ServerConfig {
                no_browser: cli.no_browser,
                port: cli.port,
                bind: cli.bind.clone(),
                base_url: cli.base_url.clone(),
            }
        };
    }

    match &cli.command {
        Some(Commands::ReviewHook) => {
            run_hook_flow(config!());
        }
        Some(Commands::Review {
            file,
            approve_label,
            deny_label,
        }) => {
            run_review_flow(config!(), file, approve_label, deny_label);
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
        Some(Commands::CodeReview { base }) => {
            run_code_review_flow(config!(), base.clone());
        }
        Some(Commands::PrePrHook) => {
            run_pre_pr_hook_flow(config!());
        }
        None => {
            if let Some(ref plan_file) = cli.plan_file {
                // opencode uses --plan-file flag directly (no subcommand, no deprecation)
                run_opencode_flow(config!(), plan_file);
            } else {
                // Deprecated: bare plan-reviewer invocation without 'review-hook' subcommand.
                eprintln!(
                    "plan-reviewer: deprecation warning: invoking plan-reviewer without \
                     the 'review-hook' subcommand is deprecated and will be removed in a future \
                     major version. Use 'plan-reviewer review-hook' instead. \
                     Run 'plan-reviewer update' to upgrade all integration files automatically."
                );
                run_hook_flow(config!());
            }
        }
    }
}

fn run_hook_flow(config: ServerConfig) {
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
        config,
        plan_md,
        "Approve".to_string(),
        "Deny".to_string(),
        "/",
        None,
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
    config: ServerConfig,
    plan_md: String,
    approve_label: String,
    deny_label: String,
    path: &str,
    base_branch: Option<String>,
) -> Decision {
    // Start server
    let (port, decision_rx) = match server::start_server(
        plan_md,
        approve_label,
        deny_label,
        config.port,
        &config.bind,
        base_branch,
    )
    .await
    {
        Ok(v) => v,
        Err(e) => {
            eprintln!("Failed to start server: {}", e);
            return Decision {
                behavior: "deny".to_string(),
                message: Some(format!("Internal error: {}", e)),
                comments: vec![],
            };
        }
    };

    let url = build_review_url(port, path, config.base_url.as_deref());

    // Always print URL to stderr (UI-06)
    eprintln!("Review UI: {}", url);

    // Open browser unless --no-browser (CONF-02)
    if !config.no_browser
        && let Err(e) = webbrowser::open(&url)
    {
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
                        comments: vec![],
                    }
                }
            }
        }
        _ = tokio::time::sleep(std::time::Duration::from_secs(TIMEOUT_SECS)) => {
            eprintln!("Review timed out after {} seconds", TIMEOUT_SECS);
            Decision {
                behavior: "deny".to_string(),
                message: Some("Review timed out \u{2014} plan was not approved".to_string()),
                comments: vec![],
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

/// Run the code review flow for the current git branch.
///
/// Does NOT read stdin and passes an empty plan_md (the /code-review SPA route
/// never calls /api/plan). Opens the browser at /code-review.
fn run_code_review_flow(config: ServerConfig, base: Option<String>) {
    eprintln!("Starting code review for current git branch");

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
        config,
        String::new(),
        "Approve".to_string(),
        "Deny".to_string(),
        "/code-review",
        base,
    ));

    // Build opencode output format and write to stdout — THE ONLY stdout write
    let output = build_opencode_output(&decision);
    serde_json::to_writer(std::io::stdout(), &output).expect("failed to write hook output");
}

/// Claude Code PreToolUse hook handler.
///
/// Reads stdin JSON, filters by tool_input.command, exits 0 silently (with NO
/// stdout output) when the command is not a PR/push. When the command matches,
/// delegates to run_code_review_flow.
fn run_pre_pr_hook_flow(config: ServerConfig) {
    // Read all of stdin synchronously (before any async runtime)
    let input_json = match std::io::read_to_string(std::io::stdin()) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Failed to read stdin: {}", e);
            std::process::exit(1);
        }
    };

    // Parse JSON into HookInput
    let hook_input: HookInput = serde_json::from_str(&input_json).unwrap_or_else(|e| {
        eprintln!("Failed to parse hook input: {}", e);
        std::process::exit(1);
    });

    // Filter: exit 0 silently when the command is not a PR/push (T-29-02)
    if !should_trigger_code_review(&hook_input) {
        // Zero bytes to stdout — must not interfere with Claude's Bash output
        std::process::exit(0);
    }

    // Run the code-review server flow and emit the Claude Code PreToolUse hook protocol.
    // We do NOT delegate to run_code_review_flow because that function writes the opencode
    // {"behavior":"allow"|"deny"} format, which Claude Code's PreToolUse hook ignores.
    // PreToolUse requires HookOutput (hookSpecificOutput wrapper) to block, or no stdout to allow.
    eprintln!("Starting code review for current git branch (pre-PR hook)");

    #[cfg(debug_assertions)]
    {
        if server::Assets::get("index.html").is_none() {
            eprintln!("ERROR: Frontend assets not found at ui/dist/index.html");
            std::process::exit(1);
        }
    }

    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();

    let decision = rt.block_on(async_main(
        config,
        String::new(),
        "Approve".to_string(),
        "Deny".to_string(),
        "/code-review",
        None,
    ));

    // Write Claude Code PreToolUse hook output.
    // - "deny": hookSpecificOutput with PermissionRequest decision blocks the Bash call.
    // - "allow" with feedback: hookSpecificOutput with additionalContext injects the
    //   reviewer's notes into Claude's conversation context without blocking.
    // - "allow" with no feedback: no stdout — Claude Code treats empty stdout as allow.
    match decision.behavior.as_str() {
        "allow" => {
            if let Some(feedback) = build_code_review_feedback(&decision) {
                let advisory = pre_tool_use_advisory(&feedback);
                serde_json::to_writer(std::io::stdout(), &advisory)
                    .expect("failed to write hook output");
            }
        }
        _ => {
            let hook_output = HookOutput::deny(
                decision
                    .message
                    .unwrap_or_else(|| "Code review denied — revise before pushing".to_string()),
            );
            serde_json::to_writer(std::io::stdout(), &hook_output)
                .expect("failed to write hook output");
        }
    }
}
