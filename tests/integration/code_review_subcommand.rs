use predicates::prelude::*;
use std::time::Duration;

// ---------------------------------------------------------------------------
// Test 1: --help includes both new subcommands
// ---------------------------------------------------------------------------

/// Verify that --help output lists `code-review` and `pre-pr-hook` subcommands.
///
/// Covers INTEG-01 and INTEG-02: both subcommands must be discoverable.
#[test]
fn help_includes_code_review_subcommand() {
    assert_cmd::Command::cargo_bin("plan-reviewer")
        .unwrap()
        .args(["--help"])
        .assert()
        .success()
        .stdout(predicate::str::contains("code-review"))
        .stdout(predicate::str::contains("pre-pr-hook"));
}

// ---------------------------------------------------------------------------
// Test 2: code-review subcommand help describes purpose
// ---------------------------------------------------------------------------

/// Verify that `code-review --help` mentions /code-review or "code review".
#[test]
fn code_review_subcommand_help_describes_purpose() {
    assert_cmd::Command::cargo_bin("plan-reviewer")
        .unwrap()
        .args(["code-review", "--help"])
        .assert()
        .success()
        .stdout(
            predicate::str::contains("/code-review")
                .or(predicate::str::contains("code review"))
                .or(predicate::str::contains("code-review")),
        );
}

// ---------------------------------------------------------------------------
// Test 3: pre-pr-hook exits silently on non-PR command (T-29-02)
// ---------------------------------------------------------------------------

/// Verify that `pre-pr-hook` exits 0 and writes nothing to stdout when the
/// stdin command is not a PR/push command.
///
/// The binary must exit within 5 seconds and produce no stdout output.
/// This validates the T-29-02 mitigation: no server is started, no port is
/// bound, no stdout pollution.
#[test]
fn pre_pr_hook_exits_silently_on_non_pr_command() {
    let stdin_payload = r#"{"session_id":"test","cwd":"/tmp","hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"npm install"}}"#;

    assert_cmd::Command::cargo_bin("plan-reviewer")
        .unwrap()
        .args(["pre-pr-hook"])
        .write_stdin(stdin_payload)
        .timeout(Duration::from_secs(5))
        .assert()
        .success()
        .stdout(predicate::str::is_empty());
}
