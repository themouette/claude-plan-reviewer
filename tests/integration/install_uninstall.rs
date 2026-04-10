use assert_cmd::prelude::*;
use predicates::prelude::*;
use std::process::Command;

// ---------------------------------------------------------------------------
// Help flag tests
// ---------------------------------------------------------------------------

/// Verifies that --help output includes both --no-browser and --port flags.
/// These flags are required for TEST-01 and TEST-03 integration tests.
#[test]
fn help_includes_port_and_no_browser_flags() {
    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .args(["--help"])
        .assert()
        .success()
        .stdout(predicate::str::contains("--no-browser"))
        .stdout(predicate::str::contains("--port"));
}

// ---------------------------------------------------------------------------
// Claude install tests
// ---------------------------------------------------------------------------

/// Install claude into an isolated HOME creates settings.json with ExitPlanMode hook.
#[test]
fn install_claude_creates_settings_in_isolated_home() {
    let home = tempfile::TempDir::new().unwrap();

    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .env("HOME", home.path())
        .args(["install", "claude"])
        .assert()
        .success()
        .stdout(predicate::str::contains("ExitPlanMode hook installed"));

    let settings_path = home.path().join(".claude/settings.json");
    assert!(
        settings_path.exists(),
        "settings.json should be written in tmpdir HOME"
    );

    let content = std::fs::read_to_string(&settings_path).unwrap();
    let json: serde_json::Value = serde_json::from_str(&content).unwrap();

    let matcher = json["hooks"]["PermissionRequest"][0]["matcher"]
        .as_str()
        .unwrap_or("");
    assert_eq!(
        matcher, "ExitPlanMode",
        "first PermissionRequest entry should have matcher ExitPlanMode"
    );

    // Keep home alive until after all assertions
    drop(home);
}

/// Second install does not duplicate hook entries (idempotency).
#[test]
fn install_claude_is_idempotent() {
    let home = tempfile::TempDir::new().unwrap();

    // First install
    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .env("HOME", home.path())
        .args(["install", "claude"])
        .assert()
        .success();

    // Second install — must not error and must not duplicate entry
    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .env("HOME", home.path())
        .args(["install", "claude"])
        .assert()
        .success();

    let settings_path = home.path().join(".claude/settings.json");
    let content = std::fs::read_to_string(&settings_path).unwrap();
    let json: serde_json::Value = serde_json::from_str(&content).unwrap();

    let hooks = json["hooks"]["PermissionRequest"].as_array().unwrap();
    let count = hooks
        .iter()
        .filter(|e| e["matcher"].as_str() == Some("ExitPlanMode"))
        .count();
    assert_eq!(
        count, 1,
        "idempotent install must produce exactly one ExitPlanMode hook entry"
    );

    drop(home);
}

// ---------------------------------------------------------------------------
// Gemini install tests
// ---------------------------------------------------------------------------

/// Install gemini into an isolated HOME creates settings.json with BeforeTool hook.
#[test]
fn install_gemini_creates_settings_in_isolated_home() {
    let home = tempfile::TempDir::new().unwrap();

    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .env("HOME", home.path())
        .args(["install", "gemini"])
        .assert()
        .success()
        .stdout(predicate::str::contains("BeforeTool hook installed"));

    let settings_path = home.path().join(".gemini/settings.json");
    assert!(
        settings_path.exists(),
        "gemini settings.json should be written in tmpdir HOME"
    );

    let content = std::fs::read_to_string(&settings_path).unwrap();
    let json: serde_json::Value = serde_json::from_str(&content).unwrap();

    // Verify BeforeTool array has an entry whose hooks[] array contains name: "plan-reviewer"
    let before_tool = json["hooks"]["BeforeTool"]
        .as_array()
        .expect("BeforeTool should be an array");
    assert!(
        !before_tool.is_empty(),
        "BeforeTool array should not be empty"
    );
    let has_plan_reviewer = before_tool.iter().any(|entry| {
        entry["hooks"]
            .as_array()
            .map(|hooks| {
                hooks
                    .iter()
                    .any(|h| h["name"].as_str() == Some("plan-reviewer"))
            })
            .unwrap_or(false)
    });
    assert!(
        has_plan_reviewer,
        "BeforeTool should contain an entry with hooks[].name == 'plan-reviewer'"
    );

    drop(home);
}

/// Second install of gemini does not duplicate hook entries (idempotency).
#[test]
fn install_gemini_is_idempotent() {
    let home = tempfile::TempDir::new().unwrap();

    // First install
    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .env("HOME", home.path())
        .args(["install", "gemini"])
        .assert()
        .success();

    // Second install — must not error and must not duplicate entry
    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .env("HOME", home.path())
        .args(["install", "gemini"])
        .assert()
        .success();

    let settings_path = home.path().join(".gemini/settings.json");
    let content = std::fs::read_to_string(&settings_path).unwrap();
    let json: serde_json::Value = serde_json::from_str(&content).unwrap();

    let before_tool = json["hooks"]["BeforeTool"].as_array().unwrap();
    let count = before_tool
        .iter()
        .filter(|entry| {
            entry["hooks"]
                .as_array()
                .map(|hooks| {
                    hooks
                        .iter()
                        .any(|h| h["name"].as_str() == Some("plan-reviewer"))
                })
                .unwrap_or(false)
        })
        .count();
    assert_eq!(
        count, 1,
        "idempotent install must produce exactly one plan-reviewer BeforeTool entry"
    );

    drop(home);
}

// ---------------------------------------------------------------------------
// Claude uninstall tests
// ---------------------------------------------------------------------------

/// Uninstall claude on a clean system (no settings file) exits 0 without error.
#[test]
fn uninstall_claude_on_clean_system_exits_zero() {
    let home = tempfile::TempDir::new().unwrap();

    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .env("HOME", home.path())
        .args(["uninstall", "claude"])
        .assert()
        .success()
        .stdout(
            predicate::str::contains("nothing to uninstall")
                .or(predicate::str::contains("no settings file")),
        );

    drop(home);
}

/// Uninstall claude after install removes the hook entry and exits 0.
#[test]
fn uninstall_claude_after_install_removes_hook() {
    let home = tempfile::TempDir::new().unwrap();

    // Install first
    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .env("HOME", home.path())
        .args(["install", "claude"])
        .assert()
        .success();

    // Now uninstall
    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .env("HOME", home.path())
        .args(["uninstall", "claude"])
        .assert()
        .success();

    let settings_path = home.path().join(".claude/settings.json");
    assert!(
        settings_path.exists(),
        "settings.json should still exist after uninstall"
    );

    let content = std::fs::read_to_string(&settings_path).unwrap();
    let json: serde_json::Value = serde_json::from_str(&content).unwrap();

    // PermissionRequest array should have no ExitPlanMode entry
    let empty = vec![];
    let hooks = json["hooks"]["PermissionRequest"]
        .as_array()
        .unwrap_or(&empty);
    let has_exit_plan_mode = hooks
        .iter()
        .any(|e| e["matcher"].as_str() == Some("ExitPlanMode"));
    assert!(
        !has_exit_plan_mode,
        "ExitPlanMode hook should be removed after uninstall"
    );

    drop(home);
}

// ---------------------------------------------------------------------------
// Gemini uninstall tests
// ---------------------------------------------------------------------------

/// Uninstall gemini on a clean system (no settings file) exits 0 without error.
#[test]
fn uninstall_gemini_on_clean_system_exits_zero() {
    let home = tempfile::TempDir::new().unwrap();

    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .env("HOME", home.path())
        .args(["uninstall", "gemini"])
        .assert()
        .success()
        .stdout(
            predicate::str::contains("nothing to uninstall")
                .or(predicate::str::contains("no settings file")),
        );

    drop(home);
}

/// Uninstall gemini after install removes the hook entry and exits 0.
#[test]
fn uninstall_gemini_after_install_removes_hook() {
    let home = tempfile::TempDir::new().unwrap();

    // Install first
    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .env("HOME", home.path())
        .args(["install", "gemini"])
        .assert()
        .success();

    // Now uninstall
    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .env("HOME", home.path())
        .args(["uninstall", "gemini"])
        .assert()
        .success();

    let settings_path = home.path().join(".gemini/settings.json");
    assert!(
        settings_path.exists(),
        "gemini settings.json should still exist after uninstall"
    );

    let content = std::fs::read_to_string(&settings_path).unwrap();
    let json: serde_json::Value = serde_json::from_str(&content).unwrap();

    // BeforeTool array should have no plan-reviewer entries
    let empty = vec![];
    let before_tool = json["hooks"]["BeforeTool"].as_array().unwrap_or(&empty);
    let has_plan_reviewer = before_tool.iter().any(|entry| {
        entry["hooks"]
            .as_array()
            .map(|hooks| {
                hooks
                    .iter()
                    .any(|h| h["name"].as_str() == Some("plan-reviewer"))
            })
            .unwrap_or(false)
    });
    assert!(
        !has_plan_reviewer,
        "plan-reviewer BeforeTool hook should be removed after uninstall"
    );

    drop(home);
}
