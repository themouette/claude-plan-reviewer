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

/// Install claude into an isolated HOME creates plugin directory and registers
/// it in settings.json (Phase 07.2 plugin model).
///
/// Phase 07.2: Claude Code uses plugin directory model instead of bare hook entries.
/// install writes plugin directory + two entries in settings.json:
///   extraKnownMarketplaces["plan-reviewer-local"] and enabledPlugins["plan-reviewer@plan-reviewer-local"].
#[test]
fn install_claude_creates_settings_in_isolated_home() {
    let home = tempfile::TempDir::new().unwrap();

    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .env("HOME", home.path())
        .args(["install", "claude"])
        .assert()
        .success()
        .stdout(predicate::str::contains("plugin registered in"));

    // Plugin directory should exist with required files
    let plugin_dir = home.path().join(".local/share/plan-reviewer/claude-plugin");
    assert!(plugin_dir.exists(), "plugin directory should be created");

    let plugin_json_path = plugin_dir.join(".claude-plugin/plugin.json");
    assert!(plugin_json_path.exists(), "plugin.json should be created");

    let hooks_json_path = plugin_dir.join("hooks/hooks.json");
    assert!(hooks_json_path.exists(), "hooks.json should be created");

    // settings.json should have both registration entries
    let settings_path = home.path().join(".claude/settings.json");
    assert!(
        settings_path.exists(),
        "settings.json should be written in tmpdir HOME"
    );

    let content = std::fs::read_to_string(&settings_path).unwrap();
    let json: serde_json::Value = serde_json::from_str(&content).unwrap();

    assert!(
        !json["extraKnownMarketplaces"]["plan-reviewer-local"].is_null(),
        "extraKnownMarketplaces entry should be present"
    );
    assert_eq!(
        json["enabledPlugins"]["plan-reviewer@plan-reviewer-local"].as_bool(),
        Some(true),
        "enabledPlugins entry should be present and true"
    );

    // Keep home alive until after all assertions
    drop(home);
}

/// Second install does not duplicate registration entries (idempotency).
///
/// Phase 07.2: Plugin directory files are always rewritten; settings.json entries
/// use entry().or_insert_with() which prevents duplicates.
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

    // Second install — must not error and must not duplicate entries
    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .env("HOME", home.path())
        .args(["install", "claude"])
        .assert()
        .success();

    let settings_path = home.path().join(".claude/settings.json");
    let content = std::fs::read_to_string(&settings_path).unwrap();
    let json: serde_json::Value = serde_json::from_str(&content).unwrap();

    // enabledPlugins should have exactly one entry for plan-reviewer
    let enabled_plugins = json["enabledPlugins"].as_object().unwrap();
    let count = enabled_plugins
        .iter()
        .filter(|(k, _)| k.as_str() == "plan-reviewer@plan-reviewer-local")
        .count();
    assert_eq!(
        count, 1,
        "idempotent install must produce exactly one enabledPlugins entry"
    );

    // extraKnownMarketplaces should have exactly one entry for plan-reviewer-local
    let marketplaces = json["extraKnownMarketplaces"].as_object().unwrap();
    let count = marketplaces
        .iter()
        .filter(|(k, _)| k.as_str() == "plan-reviewer-local")
        .count();
    assert_eq!(
        count, 1,
        "idempotent install must produce exactly one extraKnownMarketplaces entry"
    );

    drop(home);
}

/// Install claude creates commands/annotate.md with the D-03 content.
///
/// Phase 10: install() writes commands/annotate.md at the plugin root alongside
/// the existing hook files. The file must contain the heading and $ARGUMENTS placeholder.
#[test]
fn install_claude_creates_commands_annotate_md() {
    let home = tempfile::TempDir::new().unwrap();

    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .env("HOME", home.path())
        .args(["install", "claude"])
        .assert()
        .success()
        .stdout(predicate::str::contains("annotate command written to"));

    let annotate_path = home
        .path()
        .join(".local/share/plan-reviewer/claude-plugin/commands/annotate.md");
    assert!(
        annotate_path.exists(),
        "commands/annotate.md should be created by install"
    );

    let content = std::fs::read_to_string(&annotate_path).unwrap();
    assert!(content.contains("# Annotate"), "should contain heading");
    assert!(
        content.contains("$ARGUMENTS"),
        "should contain $ARGUMENTS placeholder"
    );

    drop(home);
}

/// Re-install recreates commands/annotate.md even when plugin is already registered (D-01).
///
/// Phase 10: File writes are unconditional. The idempotency check only guards
/// settings.json mutations — existing users re-running install get the new command file.
#[test]
fn install_claude_recreates_commands_on_reinstall() {
    let home = tempfile::TempDir::new().unwrap();

    // First install
    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .env("HOME", home.path())
        .args(["install", "claude"])
        .assert()
        .success();

    let commands_dir = home
        .path()
        .join(".local/share/plan-reviewer/claude-plugin/commands");
    assert!(
        commands_dir.exists(),
        "commands dir should exist after first install"
    );

    // Manually remove commands/ to simulate upgrading from old version
    std::fs::remove_dir_all(&commands_dir).unwrap();
    assert!(
        !commands_dir.exists(),
        "commands dir removed for test setup"
    );

    // Second install -- must recreate commands/ even though plugin is already registered
    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .env("HOME", home.path())
        .args(["install", "claude"])
        .assert()
        .success();

    let annotate_path = commands_dir.join("annotate.md");
    assert!(
        annotate_path.exists(),
        "commands/annotate.md should be recreated on re-install (D-01)"
    );

    // Settings should still have exactly one entry (no duplicates)
    let settings_path = home.path().join(".claude/settings.json");
    let content = std::fs::read_to_string(&settings_path).unwrap();
    let json: serde_json::Value = serde_json::from_str(&content).unwrap();
    let count = json["enabledPlugins"]
        .as_object()
        .unwrap()
        .iter()
        .filter(|(k, _)| k.as_str() == "plan-reviewer@plan-reviewer-local")
        .count();
    assert_eq!(count, 1, "re-install must not duplicate settings entries");

    drop(home);
}

// ---------------------------------------------------------------------------
// Gemini install tests
// ---------------------------------------------------------------------------

/// Install gemini into an isolated HOME creates extension directory (not settings.json).
///
/// Phase 07.2: Gemini CLI uses extension directory auto-discovery.
/// No settings.json entry is needed or written.
#[test]
fn install_gemini_creates_settings_in_isolated_home() {
    let home = tempfile::TempDir::new().unwrap();

    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .env("HOME", home.path())
        .args(["install", "gemini"])
        .assert()
        .success()
        .stdout(predicate::str::contains("Gemini CLI extension installed"));

    // Extension directory should exist
    let ext_dir = home.path().join(".gemini/extensions/plan-reviewer");
    assert!(
        ext_dir.exists(),
        "extension directory should be created in tmpdir HOME"
    );

    // gemini-extension.json manifest should exist with correct keys
    let manifest_path = ext_dir.join("gemini-extension.json");
    assert!(manifest_path.exists(), "gemini-extension.json should exist");
    let manifest_content = std::fs::read_to_string(&manifest_path).unwrap();
    let manifest: serde_json::Value = serde_json::from_str(&manifest_content).unwrap();
    assert_eq!(manifest["name"].as_str(), Some("plan-reviewer"));

    // hooks/hooks.json should exist with BeforeTool hook
    let hooks_path = ext_dir.join("hooks/hooks.json");
    assert!(hooks_path.exists(), "hooks/hooks.json should exist");
    let hooks_content = std::fs::read_to_string(&hooks_path).unwrap();
    let hooks: serde_json::Value = serde_json::from_str(&hooks_content).unwrap();
    let before_tool = hooks["hooks"]["BeforeTool"]
        .as_array()
        .expect("BeforeTool should be an array");
    assert!(!before_tool.is_empty(), "BeforeTool should not be empty");

    // settings.json should NOT be created (auto-discovery replaces registration)
    let settings_path = home.path().join(".gemini/settings.json");
    assert!(
        !settings_path.exists(),
        "settings.json should NOT be created (Gemini uses auto-discovery)"
    );

    drop(home);
}

/// Second install of gemini does not corrupt extension files (idempotency).
///
/// Phase 07.2: Extension files are always (re)written on install — idempotent.
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

    // Second install — must not error and extension files must remain valid
    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .env("HOME", home.path())
        .args(["install", "gemini"])
        .assert()
        .success();

    let ext_dir = home.path().join(".gemini/extensions/plan-reviewer");
    let manifest_content = std::fs::read_to_string(ext_dir.join("gemini-extension.json")).unwrap();
    let hooks_content = std::fs::read_to_string(ext_dir.join("hooks/hooks.json")).unwrap();

    // Both files should be valid JSON after double install
    assert!(
        serde_json::from_str::<serde_json::Value>(&manifest_content).is_ok(),
        "gemini-extension.json should be valid JSON after double install"
    );
    assert!(
        serde_json::from_str::<serde_json::Value>(&hooks_content).is_ok(),
        "hooks.json should be valid JSON after double install"
    );

    drop(home);
}

// ---------------------------------------------------------------------------
// Claude uninstall tests
// ---------------------------------------------------------------------------

/// Uninstall claude on a clean system (no plugin dir, no settings file) exits 0.
///
/// Phase 07.2: Uninstall checks plugin directory existence before removal.
/// Prints "not found (skipping)" for plugin dir and "nothing to uninstall"
/// or "no settings file" for settings.json.
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
            predicate::str::contains("not found (skipping)")
                .or(predicate::str::contains("nothing to uninstall"))
                .or(predicate::str::contains("no settings file")),
        );

    drop(home);
}

/// Uninstall claude after install removes plugin directory and both settings.json entries.
///
/// Phase 07.2: Uninstall removes:
///   - The plugin directory at ~/.local/share/plan-reviewer/claude-plugin/
///   - extraKnownMarketplaces["plan-reviewer-local"] from settings.json
///   - enabledPlugins["plan-reviewer@plan-reviewer-local"] from settings.json
///
/// Old-style hooks.PermissionRequest entries are NOT touched (Phase 07.3 handles that).
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

    let plugin_dir = home.path().join(".local/share/plan-reviewer/claude-plugin");
    assert!(plugin_dir.exists(), "plugin dir should exist after install");

    // Now uninstall
    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .env("HOME", home.path())
        .args(["uninstall", "claude"])
        .assert()
        .success();

    // Plugin directory should be removed
    assert!(
        !plugin_dir.exists(),
        "plugin directory should be removed after uninstall"
    );

    // settings.json should still exist but with entries removed
    let settings_path = home.path().join(".claude/settings.json");
    assert!(
        settings_path.exists(),
        "settings.json should still exist after uninstall"
    );

    let content = std::fs::read_to_string(&settings_path).unwrap();
    let json: serde_json::Value = serde_json::from_str(&content).unwrap();

    // enabledPlugins entry should be removed
    assert!(
        json["enabledPlugins"]["plan-reviewer@plan-reviewer-local"].is_null(),
        "enabledPlugins entry should be removed after uninstall"
    );

    // extraKnownMarketplaces entry should be removed
    assert!(
        json["extraKnownMarketplaces"]["plan-reviewer-local"].is_null(),
        "extraKnownMarketplaces entry should be removed after uninstall"
    );

    drop(home);
}

/// Uninstall claude removes commands/ directory (whole plugin dir is removed, D-04).
///
/// Phase 10: uninstall() removes the entire plugin directory via remove_dir_all,
/// which implicitly removes commands/ and commands/annotate.md.
#[test]
fn uninstall_claude_removes_commands_directory() {
    let home = tempfile::TempDir::new().unwrap();

    // Install first
    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .env("HOME", home.path())
        .args(["install", "claude"])
        .assert()
        .success();

    let commands_dir = home
        .path()
        .join(".local/share/plan-reviewer/claude-plugin/commands");
    assert!(
        commands_dir.exists(),
        "commands dir should exist after install"
    );

    // Uninstall
    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .env("HOME", home.path())
        .args(["uninstall", "claude"])
        .assert()
        .success();

    assert!(
        !commands_dir.exists(),
        "commands/ should be removed (whole plugin dir removed by uninstall)"
    );

    drop(home);
}

// ---------------------------------------------------------------------------
// Gemini uninstall tests
// ---------------------------------------------------------------------------

/// Uninstall gemini on a clean system (no extension directory) exits 0 without error.
///
/// Phase 07.2: Gemini uninstall removes extension directory. When directory
/// doesn't exist, prints "not found (skipping)" and exits 0.
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
            predicate::str::contains("not found (skipping)")
                .or(predicate::str::contains("nothing to uninstall"))
                .or(predicate::str::contains("no settings file")),
        );

    drop(home);
}

/// Uninstall gemini after install removes the extension directory and exits 0.
///
/// Phase 07.2: Extension directory is removed entirely on uninstall.
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

    let ext_dir = home.path().join(".gemini/extensions/plan-reviewer");
    assert!(
        ext_dir.exists(),
        "extension directory should exist after install"
    );

    // Now uninstall
    Command::cargo_bin("plan-reviewer")
        .unwrap()
        .env("HOME", home.path())
        .args(["uninstall", "gemini"])
        .assert()
        .success();

    assert!(
        !ext_dir.exists(),
        "extension directory should be removed after uninstall"
    );

    drop(home);
}
