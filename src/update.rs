use self_update::cargo_crate_version;

const REPO_OWNER: &str = "themouette";
const REPO_NAME: &str = "claude-plan-reviewer";
const BIN_NAME: &str = "plan-reviewer";

/// Main entry point for the update subcommand.
/// - `check_only`: print current + latest version and changelog URL without downloading
/// - `target_version`: pin to a specific release tag (e.g., "v0.2.0" or "0.2.0")
/// - `skip_confirm`: bypass the confirmation prompt before replacing the binary
pub fn run_update(check_only: bool, target_version: Option<String>, skip_confirm: bool) {
    if check_only {
        check_and_display();
        return;
    }

    perform_update(target_version, skip_confirm);
}

/// Print current version, latest version from GitHub, and changelog URL. No download. (D-10)
fn check_and_display() {
    let current = cargo_crate_version!();
    println!("Current version: {}", current);
    println!("\nChecking for updates...");

    match get_latest_version() {
        Some(latest) if sanitize_version(&latest) != current => {
            println!("New version available: {}", sanitize_version(&latest));
            println!(
                "\nChangelog: https://github.com/{}/{}/releases/tag/v{}",
                REPO_OWNER,
                REPO_NAME,
                sanitize_version(&latest)
            );
            println!("\nRun 'plan-reviewer update' to upgrade");
        }
        Some(_) => println!("You're already running the latest version"),
        None => {
            eprintln!("Unable to check for updates (could not reach GitHub API)");
            std::process::exit(1);
        }
    }
}

/// Download and replace the binary in-place. (D-09, D-11)
fn perform_update(target_version: Option<String>, skip_confirm: bool) {
    let current = cargo_crate_version!();
    println!("Current version: {}", current);

    // Normalize target version: strip 'v' prefix, treat "latest" as None
    let resolved_target = match target_version {
        Some(v) if v == "latest" => None,
        Some(v) => Some(v.trim_start_matches('v').to_string()),
        None => None,
    };

    // If no specific version was requested, fetch latest and check if already current
    let resolved_target = if resolved_target.is_none() {
        match get_latest_version() {
            Some(latest) if sanitize_version(&latest) == current => {
                println!("You're already running the latest version");
                return;
            }
            Some(latest) => {
                println!("New version available: {}", sanitize_version(&latest));
                Some(sanitize_version(&latest))
            }
            None => {
                eprintln!("Unable to fetch latest version from GitHub");
                std::process::exit(1);
            }
        }
    } else {
        resolved_target
    };

    println!("\nDownloading update...");

    let platform = current_platform();

    let mut builder = self_update::backends::github::Update::configure();
    builder
        .repo_owner(REPO_OWNER)
        .repo_name(REPO_NAME)
        .bin_name(BIN_NAME)
        .target(platform)
        .current_version(cargo_crate_version!())
        .show_download_progress(true)
        .no_confirm(skip_confirm);

    if let Some(ref version) = resolved_target {
        builder.target_version_tag(&format!("v{}", version));
    }

    match builder.build().and_then(|u| u.update()) {
        Ok(status) => {
            println!("\nSuccessfully updated to version {}", status.version());
            // Refresh installed integration files to match new binary version
            refresh_integrations();
            // Clear version check cache so next run gets a fresh check (D-12)
            clear_update_cache();
        }
        Err(e) => {
            let msg = e.to_string();
            if msg.contains("Permission denied") || msg.contains("EACCES") {
                eprintln!(
                    "Cannot replace binary. Try running with sudo: sudo plan-reviewer update"
                );
                std::process::exit(1);
            }
            eprintln!("Update failed: {}", msg);
            std::process::exit(1);
        }
    }
}

/// Returns the full Rust target triple matching cargo-dist asset names.
/// cargo-dist produces: plan-reviewer-v0.1.0-aarch64-apple-darwin.tar.gz
/// self_update matches `target()` as a substring against asset filenames.
fn current_platform() -> &'static str {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("macos", "aarch64") => "aarch64-apple-darwin",
        ("macos", "x86_64") => "x86_64-apple-darwin",
        ("linux", "aarch64") => "aarch64-unknown-linux-musl",
        ("linux", "x86_64") => "x86_64-unknown-linux-musl",
        (os, arch) => {
            eprintln!("Unsupported platform: {}-{}", os, arch);
            std::process::exit(1);
        }
    }
}

/// Fetch the latest release version string from GitHub releases API.
/// Returns None if the API is unreachable or returns no releases.
fn get_latest_version() -> Option<String> {
    let releases = self_update::backends::github::ReleaseList::configure()
        .repo_owner(REPO_OWNER)
        .repo_name(REPO_NAME)
        .build()
        .ok()?
        .fetch()
        .ok()?;

    releases
        .first()
        .map(|r| r.version.trim_start_matches('v').to_string())
}

/// Delete the version check cache file so the next invocation fetches fresh data. (D-12)
fn clear_update_cache() {
    if let Ok(home) = std::env::var("HOME") {
        let cache_path = std::path::PathBuf::from(home)
            .join(".plan-reviewer")
            .join("update-check.json");
        let _ = std::fs::remove_file(cache_path);
    }
}

/// Sanitize a version string from the network before displaying it in the terminal.
/// Prevents terminal escape injection from malicious release tag names. (T-04-07)
fn sanitize_version(version: &str) -> String {
    version
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '-' || *c == '+')
        .collect()
}

// ---------------------------------------------------------------------------
// Integration refresh after update
// ---------------------------------------------------------------------------

/// After binary replacement, detect installed integrations and rewrite stale files.
///
/// Detection is by manifest/file presence — if the integration was never installed,
/// no manifest exists and we skip it. Version comparison is string equality (no semver).
pub fn refresh_integrations() {
    let home = match std::env::var("HOME") {
        Ok(h) => h,
        Err(_) => {
            eprintln!("plan-reviewer: HOME not set, skipping integration refresh");
            return;
        }
    };
    let current_version = cargo_crate_version!();

    refresh_integrations_with_home(&home, current_version);
}

/// Testable core of refresh_integrations: takes home dir and version as parameters.
fn refresh_integrations_with_home(home: &str, current_version: &str) {
    // Claude: check plugin.json
    {
        use crate::integrations::claude::claude_plugin_dir;
        let manifest_path = claude_plugin_dir(home).join(".claude-plugin/plugin.json");
        if manifest_path.exists() {
            match read_manifest_version(&manifest_path) {
                Some(ref v) if v == current_version => {
                    println!(
                        "plan-reviewer: Claude plugin already at v{}",
                        current_version
                    );
                }
                _ => {
                    write_claude_plugin_files(home, current_version);
                }
            }
        }
    }

    // Gemini: check gemini-extension.json
    {
        use crate::integrations::gemini::gemini_extension_dir;
        let manifest_path = gemini_extension_dir(home).join("gemini-extension.json");
        if manifest_path.exists() {
            match read_manifest_version(&manifest_path) {
                Some(ref v) if v == current_version => {
                    println!(
                        "plan-reviewer: Gemini extension already at v{}",
                        current_version
                    );
                }
                _ => {
                    write_gemini_extension_files(home, current_version);
                }
            }
        }
    }

    // OpenCode: check version comment in .mjs file
    {
        use crate::integrations::opencode::{opencode_plugin_path, read_mjs_version};
        let plugin_path = opencode_plugin_path(home);
        if plugin_path.exists() {
            match read_mjs_version(&plugin_path) {
                Some(ref v) if v == current_version => {
                    println!(
                        "plan-reviewer: OpenCode plugin already at v{}",
                        current_version
                    );
                }
                _ => {
                    write_opencode_plugin_file(home, current_version);
                }
            }
        }
    }
}

/// Read the "version" field from a JSON manifest file (plugin.json or gemini-extension.json).
/// Returns None if the file cannot be read, parsed, or lacks a "version" string field.
fn read_manifest_version(manifest_path: &std::path::Path) -> Option<String> {
    let content = std::fs::read_to_string(manifest_path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    json["version"].as_str().map(|s| s.to_string())
}

/// Write Claude plugin directory files with current version.
///
/// Writes .claude-plugin/plugin.json and hooks/hooks.json.
/// Used during update to refresh stale plugin files without touching settings.json.
fn write_claude_plugin_files(home: &str, current_version: &str) {
    use crate::integrations::claude::claude_plugin_dir;
    let plugin_dir = claude_plugin_dir(home);

    let manifest = serde_json::json!({
        "name": "plan-reviewer",
        "version": current_version,
        "description": "Plan review hook for Claude Code"
    });
    let hooks = serde_json::json!({
        "hooks": {
            "PermissionRequest": [{
                "matcher": "ExitPlanMode",
                "hooks": [{"type": "command", "command": "plan-reviewer"}]
            }]
        }
    });

    let manifest_dir = plugin_dir.join(".claude-plugin");
    let hooks_dir = plugin_dir.join("hooks");
    let _ = std::fs::create_dir_all(&manifest_dir);
    let _ = std::fs::create_dir_all(&hooks_dir);
    let _ = std::fs::write(
        manifest_dir.join("plugin.json"),
        serde_json::to_string_pretty(&manifest).unwrap(),
    );
    let _ = std::fs::write(
        hooks_dir.join("hooks.json"),
        serde_json::to_string_pretty(&hooks).unwrap(),
    );
    println!(
        "plan-reviewer: Claude plugin files updated to v{}",
        current_version
    );
}

/// Write Gemini extension directory files with current version.
///
/// Writes gemini-extension.json and hooks/hooks.json.
/// Used during update to refresh stale extension files.
fn write_gemini_extension_files(home: &str, current_version: &str) {
    use crate::integrations::gemini::gemini_extension_dir;
    let ext_dir = gemini_extension_dir(home);

    let manifest = serde_json::json!({
        "name": "plan-reviewer",
        "version": current_version,
        "description": "Plan review hook for Gemini CLI"
    });
    let hooks = serde_json::json!({
        "hooks": {
            "BeforeTool": [{
                "matcher": "exit_plan_mode",
                "hooks": [{
                    "name": "plan-reviewer",
                    "type": "command",
                    "command": "plan-reviewer",
                    "timeout": 300000
                }]
            }]
        }
    });

    let hooks_dir = ext_dir.join("hooks");
    let _ = std::fs::create_dir_all(&ext_dir);
    let _ = std::fs::create_dir_all(&hooks_dir);
    let _ = std::fs::write(
        ext_dir.join("gemini-extension.json"),
        serde_json::to_string_pretty(&manifest).unwrap(),
    );
    let _ = std::fs::write(
        hooks_dir.join("hooks.json"),
        serde_json::to_string_pretty(&hooks).unwrap(),
    );
    println!(
        "plan-reviewer: Gemini extension files updated to v{}",
        current_version
    );
}

/// Write OpenCode plugin file with current version.
///
/// Re-embeds the plugin source with both placeholders replaced.
/// Uses "plan-reviewer" as binary name (it's in PATH after update).
fn write_opencode_plugin_file(home: &str, current_version: &str) {
    use crate::integrations::opencode::opencode_plugin_path;
    let plugin_path = opencode_plugin_path(home);

    let source = include_str!("integrations/opencode_plugin.mjs")
        .replace("__PLAN_REVIEWER_BIN__", "plan-reviewer")
        .replace("__PLAN_REVIEWER_VERSION__", current_version);

    let _ = std::fs::write(&plugin_path, source);
    println!(
        "plan-reviewer: OpenCode plugin file updated to v{}",
        current_version
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    // Helper: write a minimal plugin.json with a given version
    fn write_plugin_json(path: &std::path::Path, version: &str) {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        let json =
            serde_json::json!({"name": "plan-reviewer", "version": version, "description": "test"});
        std::fs::write(path, serde_json::to_string_pretty(&json).unwrap()).unwrap();
    }

    // Helper: write a minimal .mjs plugin file with a version comment
    fn write_mjs_with_version(path: &std::path::Path, version: &str) {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        let content = format!(
            "// plan-reviewer-opencode.mjs\n// plan-reviewer-version: {}\n// rest of file\n",
            version
        );
        std::fs::write(path, content).unwrap();
    }

    #[test]
    fn test_read_manifest_version_valid() {
        let dir = tempdir().unwrap();
        let manifest = dir.path().join("plugin.json");
        std::fs::write(&manifest, r#"{"version":"1.0.0","name":"test"}"#).unwrap();

        assert_eq!(read_manifest_version(&manifest), Some("1.0.0".to_string()));
    }

    #[test]
    fn test_read_manifest_version_missing_file() {
        let dir = tempdir().unwrap();
        let manifest = dir.path().join("nonexistent.json");

        assert_eq!(read_manifest_version(&manifest), None);
    }

    #[test]
    fn test_read_manifest_version_invalid_json() {
        let dir = tempdir().unwrap();
        let manifest = dir.path().join("bad.json");
        std::fs::write(&manifest, "not json").unwrap();

        assert_eq!(read_manifest_version(&manifest), None);
    }

    #[test]
    fn test_refresh_rewrites_claude_when_stale() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap();

        // Create plugin dir with stale version
        let manifest_path = dir
            .path()
            .join(".local/share/plan-reviewer/claude-plugin/.claude-plugin/plugin.json");
        write_plugin_json(&manifest_path, "0.0.1");

        refresh_integrations_with_home(home, "9.9.9");

        let content = std::fs::read_to_string(&manifest_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert_eq!(
            json["version"].as_str(),
            Some("9.9.9"),
            "plugin.json should be rewritten with new version"
        );
    }

    #[test]
    fn test_refresh_skips_claude_when_current() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap();

        let manifest_path = dir
            .path()
            .join(".local/share/plan-reviewer/claude-plugin/.claude-plugin/plugin.json");
        write_plugin_json(&manifest_path, "1.2.3");

        // Record mtime before
        let before_meta = std::fs::metadata(&manifest_path).unwrap();
        let before_modified = before_meta.modified().unwrap();

        // Small sleep to detect mtime change if any
        std::thread::sleep(std::time::Duration::from_millis(10));

        refresh_integrations_with_home(home, "1.2.3");

        let after_meta = std::fs::metadata(&manifest_path).unwrap();
        let after_modified = after_meta.modified().unwrap();

        assert_eq!(
            before_modified, after_modified,
            "plugin.json should NOT be rewritten when version matches"
        );
    }

    #[test]
    fn test_refresh_rewrites_gemini_when_stale() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap();

        let manifest_path = dir
            .path()
            .join(".gemini/extensions/plan-reviewer/gemini-extension.json");
        write_plugin_json(&manifest_path, "0.0.1");

        refresh_integrations_with_home(home, "9.9.9");

        let content = std::fs::read_to_string(&manifest_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert_eq!(
            json["version"].as_str(),
            Some("9.9.9"),
            "gemini-extension.json should be rewritten with new version"
        );
    }

    #[test]
    fn test_refresh_skips_gemini_when_current() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap();

        let manifest_path = dir
            .path()
            .join(".gemini/extensions/plan-reviewer/gemini-extension.json");
        write_plugin_json(&manifest_path, "1.2.3");

        let before_meta = std::fs::metadata(&manifest_path).unwrap();
        let before_modified = before_meta.modified().unwrap();

        std::thread::sleep(std::time::Duration::from_millis(10));

        refresh_integrations_with_home(home, "1.2.3");

        let after_meta = std::fs::metadata(&manifest_path).unwrap();
        let after_modified = after_meta.modified().unwrap();

        assert_eq!(
            before_modified, after_modified,
            "gemini-extension.json should NOT be rewritten when version matches"
        );
    }

    #[test]
    fn test_refresh_rewrites_opencode_when_stale() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap();

        let plugin_path = dir
            .path()
            .join(".config/opencode/plugins/plan-reviewer-opencode.mjs");
        write_mjs_with_version(&plugin_path, "0.0.1");

        refresh_integrations_with_home(home, "9.9.9");

        let content = std::fs::read_to_string(&plugin_path).unwrap();
        assert!(
            content.contains("// plan-reviewer-version: 9.9.9"),
            "mjs file should be rewritten with new version comment"
        );
        assert!(
            !content.contains("__PLAN_REVIEWER_VERSION__"),
            "placeholder should be replaced"
        );
    }

    #[test]
    fn test_refresh_skips_opencode_when_current() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap();

        let plugin_path = dir
            .path()
            .join(".config/opencode/plugins/plan-reviewer-opencode.mjs");
        write_mjs_with_version(&plugin_path, "1.2.3");

        let before_meta = std::fs::metadata(&plugin_path).unwrap();
        let before_modified = before_meta.modified().unwrap();

        std::thread::sleep(std::time::Duration::from_millis(10));

        refresh_integrations_with_home(home, "1.2.3");

        let after_meta = std::fs::metadata(&plugin_path).unwrap();
        let after_modified = after_meta.modified().unwrap();

        assert_eq!(
            before_modified, after_modified,
            "mjs file should NOT be rewritten when version matches"
        );
    }

    #[test]
    fn test_refresh_skips_absent_integrations() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap();

        // Empty home dir — no integrations installed
        // Should complete without errors
        refresh_integrations_with_home(home, "1.0.0");

        // Verify no files were created
        assert!(
            !dir.path()
                .join(".local/share/plan-reviewer/claude-plugin")
                .exists(),
            "Claude plugin dir should NOT be created when absent"
        );
        assert!(
            !dir.path().join(".gemini/extensions/plan-reviewer").exists(),
            "Gemini extension dir should NOT be created when absent"
        );
        assert!(
            !dir.path()
                .join(".config/opencode/plugins/plan-reviewer-opencode.mjs")
                .exists(),
            "OpenCode plugin should NOT be created when absent"
        );
    }
}
