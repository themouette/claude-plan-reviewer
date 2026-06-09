use super::{InstallContext, Integration};
use std::path::PathBuf;

// ---------------------------------------------------------------------------
// OpenCodeIntegration
// ---------------------------------------------------------------------------

/// The opencode JS plugin source, embedded at compile time.
///
/// The `__PLAN_REVIEWER_BIN__` placeholder is replaced with the real binary
/// path at install time before writing to disk.
const OPENCODE_PLUGIN_SOURCE: &str = include_str!("opencode_plugin.mjs");

pub(crate) const OPENCODE_ANNOTATE_MD: &str = concat!(
    "---\n",
    "description: Open a markdown file in the plan-reviewer browser UI for feedback\n",
    "agent: build\n",
    "---\n",
    "\n",
    "Open a markdown file in the plan-reviewer browser UI. Treat the result as feedback collection, not an approval gate.\n",
    "\n",
    "Resolve the target file using these rules in order:\n",
    "\n",
    "1. If `$ARGUMENTS` is non-empty, use it as the file path.\n",
    "2. If `$ARGUMENTS` is empty, use the most recent markdown file mentioned in the conversation.\n",
    "3. If no markdown file is available, write your last full response to a temporary `.md` file and use that path.\n",
    "\n",
    "Tell the user which file you are opening, then run this with the bash tool:\n",
    "\n",
    "```bash\n",
    "__PLAN_REVIEWER_BIN__ review --approve-label \"No issues\" --deny-label \"Leave feedback\" <resolved-file>\n",
    "```\n",
    "\n",
    "If stdout contains `{\"behavior\":\"allow\"}`, say: `Review complete, no comments.`\n",
    "\n",
    "If stdout contains `{\"behavior\":\"deny\",\"message\":\"<feedback>\"}`, say: `Feedback received: <feedback>` and treat it as revision instructions.\n",
    "\n",
    "If there is no stdout, ask the user whether they copied a JSON decision from the browser UI.\n",
);

pub(crate) const OPENCODE_CODE_REVIEW_MD: &str = concat!(
    "---\n",
    "description: Open the code review UI for the current git branch\n",
    "agent: build\n",
    "---\n",
    "\n",
    "Open the diff viewer for the current git branch in the plan-reviewer browser UI.\n",
    "Use this before creating a PR to review and annotate the changes.\n",
    "\n",
    "Run this with the bash tool:\n",
    "\n",
    "```bash\n",
    "__PLAN_REVIEWER_BIN__ code-review\n",
    "```\n",
    "\n",
    "If stdout contains `{\"behavior\":\"allow\"}`, say: `Review complete, proceeding with PR creation.`\n",
    "\n",
    "If stdout contains `{\"behavior\":\"deny\",\"message\":\"<feedback>\"}`, say: `Review feedback received: <feedback>` and address it before creating the PR.\n",
    "\n",
    "If there is no stdout, say: `The code review process exited without a result.` and ask whether to proceed.\n",
);

/// Full install/uninstall implementation for OpenCode.
///
/// Writes a JS plugin file to `~/.config/opencode/plugins/plan-reviewer-opencode.mjs`
/// and registers it in `~/.config/opencode/opencode.json` under the `plugin` array.
pub struct OpenCodeIntegration;

impl Integration for OpenCodeIntegration {
    /// Wire the submit_plan plugin into OpenCode.
    ///
    /// Idempotent: safe to run multiple times. If the plugin path is already
    /// in `opencode.json`'s `plugin` array, returns Ok(()) immediately.
    /// The plugin file is always (re)written with the current embedded source.
    fn install(&self, ctx: &InstallContext) -> Result<(), String> {
        let binary_path = ctx
            .binary_path
            .as_deref()
            .ok_or_else(|| "install requires a binary_path — none was provided".to_string())?;

        let plugin_path = opencode_plugin_path(&ctx.home);
        let config_path = opencode_config_path(&ctx.home);
        let plugin_path_str = plugin_path.to_string_lossy().to_string();

        // Create ~/.config/opencode/plugins/ directory if it doesn't exist
        if let Some(parent) = plugin_path.parent()
            && let Err(e) = std::fs::create_dir_all(parent)
        {
            return Err(format!("cannot create {}: {}", parent.display(), e));
        }

        // Write the plugin file: replace __PLAN_REVIEWER_BIN__ with the actual binary path
        // and __PLAN_REVIEWER_VERSION__ with the crate version at install time
        let plugin_source = OPENCODE_PLUGIN_SOURCE
            .replace("__PLAN_REVIEWER_BIN__", binary_path)
            .replace("__PLAN_REVIEWER_VERSION__", env!("CARGO_PKG_VERSION"));
        if let Err(e) = std::fs::write(&plugin_path, &plugin_source) {
            return Err(format!("cannot write {}: {}", plugin_path.display(), e));
        }
        println!(
            "plan-reviewer: plugin file written to {}",
            plugin_path.display()
        );

        write_opencode_command_files(&ctx.home, binary_path)?;
        remove_legacy_opencode_command_files(&ctx.home)?;

        // Read existing opencode.json or start with {}
        let mut root: serde_json::Value = if config_path.exists() {
            match std::fs::read_to_string(&config_path) {
                Ok(content) => match serde_json::from_str(&content) {
                    Ok(v) => v,
                    Err(e) => {
                        return Err(format!(
                            "cannot parse {}: {} -- refusing to overwrite. Fix or remove the file first.",
                            config_path.display(),
                            e
                        ));
                    }
                },
                Err(e) => {
                    return Err(format!("cannot read {}: {}", config_path.display(), e));
                }
            }
        } else {
            serde_json::json!({})
        };

        // Ensure root is an object
        if !root.is_object() {
            eprintln!(
                "plan-reviewer install: {} root is not a JSON object; \
                 starting from empty object",
                config_path.display()
            );
            root = serde_json::json!({});
        }

        // Ensure root["plugin"] exists as an array
        root.as_object_mut()
            .expect("root is always an object at this point")
            .entry("plugin")
            .or_insert_with(|| serde_json::json!([]));

        // Idempotency check: if plugin path is already in the array, no-op
        if opencode_is_installed(&root, &plugin_path_str) {
            println!(
                "plan-reviewer: plugin entry already configured in {} (no changes made)",
                config_path.display()
            );
            return Ok(());
        }

        // Push the plugin path string into the plugin array
        root["plugin"]
            .as_array_mut()
            .expect("plugin was validated as array above")
            .push(serde_json::Value::String(plugin_path_str.clone()));

        // Pretty-print and write config back
        let output = match serde_json::to_string_pretty(&root) {
            Ok(s) => s,
            Err(e) => {
                return Err(format!("cannot serialize opencode.json: {}", e));
            }
        };

        // Create ~/.config/opencode/ directory if it doesn't exist
        if let Some(parent) = config_path.parent()
            && let Err(e) = std::fs::create_dir_all(parent)
        {
            return Err(format!("cannot create {}: {}", parent.display(), e));
        }

        if let Err(e) = std::fs::write(&config_path, output) {
            return Err(format!("cannot write {}: {}", config_path.display(), e));
        }

        println!(
            "plan-reviewer: plugin entry added to {}",
            config_path.display()
        );
        Ok(())
    }

    /// Remove the submit_plan plugin from OpenCode.
    ///
    /// Idempotent: safe to run when neither the plugin file nor the config
    /// entry is present.
    fn uninstall(&self, ctx: &InstallContext) -> Result<(), String> {
        let plugin_path = opencode_plugin_path(&ctx.home);
        let config_path = opencode_config_path(&ctx.home);
        let plugin_path_str = plugin_path.to_string_lossy().to_string();

        // Remove plugin file if it exists
        if plugin_path.exists() {
            if let Err(e) = std::fs::remove_file(&plugin_path) {
                return Err(format!("cannot remove {}: {}", plugin_path.display(), e));
            }
            println!(
                "plan-reviewer: plugin file removed from {}",
                plugin_path.display()
            );
        } else {
            println!(
                "plan-reviewer: no plugin file found at {} (skipping)",
                plugin_path.display()
            );
        }

        remove_opencode_command_files(&ctx.home)?;
        remove_legacy_opencode_command_files(&ctx.home)?;

        // Clean up config entry if config file exists
        if !config_path.exists() {
            println!(
                "plan-reviewer: no config file found at {} (nothing to update)",
                config_path.display()
            );
            return Ok(());
        }

        let content = match std::fs::read_to_string(&config_path) {
            Ok(c) => c,
            Err(e) => {
                return Err(format!("cannot read {}: {}", config_path.display(), e));
            }
        };

        let mut root: serde_json::Value = match serde_json::from_str(&content) {
            Ok(v) => v,
            Err(e) => {
                eprintln!(
                    "plan-reviewer uninstall: warning: {} contains invalid JSON: {} (no changes made)",
                    config_path.display(),
                    e
                );
                return Ok(());
            }
        };

        // Remove the plugin path string from the plugin array
        if let Some(arr) = root["plugin"].as_array_mut() {
            arr.retain(|entry| entry.as_str() != Some(plugin_path_str.as_str()));
        }

        // Write back with pretty-printing
        let output = match serde_json::to_string_pretty(&root) {
            Ok(s) => s,
            Err(e) => {
                return Err(format!("cannot serialize opencode.json: {}", e));
            }
        };

        if let Err(e) = std::fs::write(&config_path, output) {
            return Err(format!("cannot write {}: {}", config_path.display(), e));
        }

        println!(
            "plan-reviewer: plugin entry removed from {}",
            config_path.display()
        );
        Ok(())
    }

    /// Returns `true` if the OpenCode plugin is installed.
    ///
    /// Checks BOTH: the plugin file exists on disk AND the plugin path is
    /// present in `opencode.json`'s `plugin` array.
    fn is_installed(&self, ctx: &InstallContext) -> bool {
        let plugin_path = opencode_plugin_path(&ctx.home);
        let config_path = opencode_config_path(&ctx.home);
        let plugin_path_str = plugin_path.to_string_lossy().to_string();

        // Both conditions must be true
        if !plugin_path.exists() {
            return false;
        }

        match std::fs::read_to_string(&config_path) {
            Ok(content) => match serde_json::from_str::<serde_json::Value>(&content) {
                Ok(json) => opencode_is_installed(&json, &plugin_path_str),
                Err(_) => false,
            },
            Err(_) => false,
        }
    }
}

// ---------------------------------------------------------------------------
// OpenCode helper functions (private to this module)
// ---------------------------------------------------------------------------

/// Returns the path to OpenCode's config file: `{home}/.config/opencode/opencode.json`.
fn opencode_config_path(home: &str) -> PathBuf {
    PathBuf::from(home).join(".config/opencode/opencode.json")
}

/// Returns the path for the installed plugin file:
/// `{home}/.config/opencode/plugins/plan-reviewer-opencode.mjs`.
///
/// pub(crate) — used by update.rs for version-aware plugin file detection.
pub(crate) fn opencode_plugin_path(home: &str) -> PathBuf {
    PathBuf::from(home).join(".config/opencode/plugins/plan-reviewer-opencode.mjs")
}

pub(crate) fn opencode_commands_dir(home: &str) -> PathBuf {
    PathBuf::from(home).join(".config/opencode/commands")
}

fn opencode_annotate_command_path(home: &str) -> PathBuf {
    opencode_commands_dir(home).join("plan-reviewer-annotate.md")
}

fn opencode_code_review_command_path(home: &str) -> PathBuf {
    opencode_commands_dir(home).join("plan-reviewer-code-review.md")
}

pub(crate) fn write_opencode_command_files(home: &str, binary_path: &str) -> Result<(), String> {
    let commands_dir = opencode_commands_dir(home);
    std::fs::create_dir_all(&commands_dir)
        .map_err(|e| format!("cannot create {}: {}", commands_dir.display(), e))?;

    let annotate_path = opencode_annotate_command_path(home);
    std::fs::write(
        &annotate_path,
        OPENCODE_ANNOTATE_MD.replace("__PLAN_REVIEWER_BIN__", binary_path),
    )
    .map_err(|e| format!("cannot write {}: {}", annotate_path.display(), e))?;

    let code_review_path = opencode_code_review_command_path(home);
    std::fs::write(
        &code_review_path,
        OPENCODE_CODE_REVIEW_MD.replace("__PLAN_REVIEWER_BIN__", binary_path),
    )
    .map_err(|e| format!("cannot write {}: {}", code_review_path.display(), e))?;

    println!(
        "plan-reviewer: OpenCode commands written to {}",
        commands_dir.display()
    );
    Ok(())
}

fn remove_opencode_command_files(home: &str) -> Result<(), String> {
    for path in [
        opencode_annotate_command_path(home),
        opencode_code_review_command_path(home),
    ] {
        if !path.exists() {
            continue;
        }
        std::fs::remove_file(&path)
            .map_err(|e| format!("cannot remove {}: {}", path.display(), e))?;
        println!("plan-reviewer: command removed from {}", path.display());
    }
    Ok(())
}

fn remove_legacy_opencode_command_files(home: &str) -> Result<(), String> {
    for path in [
        opencode_commands_dir(home).join("annotate.md"),
        opencode_commands_dir(home).join("code-review.md"),
    ] {
        if !path.exists() {
            continue;
        }
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("cannot read {}: {}", path.display(), e))?;
        if !content.contains("plan-reviewer browser UI") {
            continue;
        }
        std::fs::remove_file(&path)
            .map_err(|e| format!("cannot remove {}: {}", path.display(), e))?;
        println!(
            "plan-reviewer: legacy command removed from {}",
            path.display()
        );
    }
    Ok(())
}

/// Read the plan-reviewer version from an installed .mjs plugin file.
///
/// Parses the `// plan-reviewer-version: X.Y.Z` comment line.
/// Returns None if the file cannot be read or the version line is absent.
pub(crate) fn read_mjs_version(plugin_path: &std::path::Path) -> Option<String> {
    let content = std::fs::read_to_string(plugin_path).ok()?;
    for line in content.lines() {
        if let Some(version) = line.strip_prefix("// plan-reviewer-version: ") {
            return Some(version.trim().to_string());
        }
    }
    None
}

/// Returns `true` if `plugin_path_str` is present in `config["plugin"]` array.
///
/// This is the idempotency key: the absolute path string in the plugin array.
fn opencode_is_installed(config: &serde_json::Value, plugin_path_str: &str) -> bool {
    config["plugin"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .any(|entry| entry.as_str() == Some(plugin_path_str))
        })
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    // ---------------------------------------------------------------------------
    // Helper function tests
    // ---------------------------------------------------------------------------

    #[test]
    fn opencode_config_path_test() {
        let path = opencode_config_path("/home/alice");
        assert_eq!(
            path,
            PathBuf::from("/home/alice/.config/opencode/opencode.json")
        );
    }

    #[test]
    fn opencode_plugin_path_test() {
        let path = opencode_plugin_path("/home/alice");
        assert_eq!(
            path,
            PathBuf::from("/home/alice/.config/opencode/plugins/plan-reviewer-opencode.mjs")
        );
    }

    #[test]
    fn opencode_is_installed_returns_true_when_plugin_in_array() {
        let config = serde_json::json!({
            "plugin": ["/home/alice/.config/opencode/plugins/plan-reviewer-opencode.mjs"]
        });
        assert!(opencode_is_installed(
            &config,
            "/home/alice/.config/opencode/plugins/plan-reviewer-opencode.mjs"
        ));
    }

    #[test]
    fn opencode_is_installed_returns_false_for_empty_object() {
        let config = serde_json::json!({});
        assert!(!opencode_is_installed(
            &config,
            "/home/alice/.config/opencode/plugins/plan-reviewer-opencode.mjs"
        ));
    }

    #[test]
    fn opencode_is_installed_returns_false_for_empty_plugin_array() {
        let config = serde_json::json!({ "plugin": [] });
        assert!(!opencode_is_installed(
            &config,
            "/home/alice/.config/opencode/plugins/plan-reviewer-opencode.mjs"
        ));
    }

    #[test]
    fn opencode_is_installed_returns_false_for_different_plugin() {
        let config = serde_json::json!({
            "plugin": ["/some/other/plugin.mjs", "@some-org/opencode-plugin"]
        });
        assert!(!opencode_is_installed(
            &config,
            "/home/alice/.config/opencode/plugins/plan-reviewer-opencode.mjs"
        ));
    }

    // ---------------------------------------------------------------------------
    // Install tests (filesystem)
    // ---------------------------------------------------------------------------

    #[test]
    fn install_creates_config_and_plugin_when_no_files_exist() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = OpenCodeIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        let result = integration.install(&ctx);
        assert!(result.is_ok(), "install should succeed: {:?}", result);

        let plugin_path = dir
            .path()
            .join(".config/opencode/plugins/plan-reviewer-opencode.mjs");
        assert!(plugin_path.exists(), "plugin file should be created");

        let config_path = dir.path().join(".config/opencode/opencode.json");
        assert!(config_path.exists(), "config file should be created");

        assert!(
            dir.path()
                .join(".config/opencode/commands/plan-reviewer-annotate.md")
                .exists(),
            "annotate slash command should be created"
        );
        assert!(
            dir.path()
                .join(".config/opencode/commands/plan-reviewer-code-review.md")
                .exists(),
            "code-review slash command should be created"
        );
        let code_review_command = std::fs::read_to_string(
            dir.path()
                .join(".config/opencode/commands/plan-reviewer-code-review.md"),
        )
        .unwrap();
        assert!(
            code_review_command.contains("/usr/local/bin/plan-reviewer code-review"),
            "slash command should use the installed binary path"
        );
        assert!(
            !code_review_command.contains("__PLAN_REVIEWER_BIN__"),
            "slash command binary placeholder should be replaced"
        );

        let content = std::fs::read_to_string(&config_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();
        let plugin_path_str = plugin_path.to_string_lossy().to_string();
        assert!(
            opencode_is_installed(&json, &plugin_path_str),
            "installed plugin path should be detected in config"
        );
    }

    #[test]
    fn install_is_idempotent() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = OpenCodeIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();
        integration.install(&ctx).unwrap();

        let config_path = dir.path().join(".config/opencode/opencode.json");
        let content = std::fs::read_to_string(&config_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();

        let plugin_path = dir
            .path()
            .join(".config/opencode/plugins/plan-reviewer-opencode.mjs");
        let plugin_path_str = plugin_path.to_string_lossy().to_string();

        let plugin_arr = json["plugin"].as_array().unwrap();
        let count = plugin_arr
            .iter()
            .filter(|e| e.as_str() == Some(plugin_path_str.as_str()))
            .count();
        assert_eq!(
            count, 1,
            "should have exactly one plan-reviewer entry after two installs"
        );
    }

    #[test]
    fn install_recreates_missing_commands_when_already_installed() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = OpenCodeIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();
        let commands_dir = dir.path().join(".config/opencode/commands");
        std::fs::remove_dir_all(&commands_dir).unwrap();

        integration.install(&ctx).unwrap();

        assert!(
            commands_dir.join("plan-reviewer-annotate.md").exists(),
            "annotate slash command should be recreated"
        );
        assert!(
            commands_dir.join("plan-reviewer-code-review.md").exists(),
            "code-review slash command should be recreated"
        );
    }

    #[test]
    fn install_removes_legacy_generic_commands_only_when_owned() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let commands_dir = dir.path().join(".config/opencode/commands");
        std::fs::create_dir_all(&commands_dir).unwrap();
        std::fs::write(
            commands_dir.join("annotate.md"),
            "Open a markdown file in the plan-reviewer browser UI.",
        )
        .unwrap();
        std::fs::write(commands_dir.join("code-review.md"), "my command").unwrap();

        let integration = OpenCodeIntegration;
        let ctx = InstallContext {
            home,
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();

        assert!(
            !commands_dir.join("annotate.md").exists(),
            "owned legacy generic annotate command should be removed"
        );
        assert!(
            commands_dir.join("code-review.md").exists(),
            "unowned generic command should be preserved"
        );
    }

    #[test]
    fn install_preserves_existing_config_keys() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();

        // Create config file with existing key
        let config_dir = dir.path().join(".config/opencode");
        std::fs::create_dir_all(&config_dir).unwrap();
        let config_path = config_dir.join("opencode.json");
        std::fs::write(
            &config_path,
            r#"{"$schema": "https://opencode.ai/config.json"}"#,
        )
        .unwrap();

        let integration = OpenCodeIntegration;
        let ctx = InstallContext {
            home,
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();

        let content = std::fs::read_to_string(&config_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();

        // Existing $schema key should be preserved
        assert_eq!(
            json["$schema"].as_str(),
            Some("https://opencode.ai/config.json"),
            "$schema key should be preserved"
        );
        // Plugin entry should be present
        let plugin_path = dir
            .path()
            .join(".config/opencode/plugins/plan-reviewer-opencode.mjs");
        let plugin_path_str = plugin_path.to_string_lossy().to_string();
        assert!(opencode_is_installed(&json, &plugin_path_str));
    }

    #[test]
    fn install_returns_err_when_binary_path_is_none() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = OpenCodeIntegration;
        let ctx = InstallContext {
            home,
            binary_path: None,
        };

        let result = integration.install(&ctx);
        assert!(result.is_err(), "install without binary_path should fail");
    }

    #[test]
    fn install_replaces_binary_path_placeholder_in_plugin() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = OpenCodeIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();

        let plugin_path = dir
            .path()
            .join(".config/opencode/plugins/plan-reviewer-opencode.mjs");
        let plugin_content = std::fs::read_to_string(&plugin_path).unwrap();

        // Placeholder should NOT be present
        assert!(
            !plugin_content.contains("__PLAN_REVIEWER_BIN__"),
            "placeholder should be replaced in installed plugin file"
        );
        // Actual binary path should be present
        assert!(
            plugin_content.contains("/usr/local/bin/plan-reviewer"),
            "actual binary path should be in installed plugin file"
        );
    }

    #[test]
    fn install_writes_version_comment() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = OpenCodeIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();

        let plugin_path = dir
            .path()
            .join(".config/opencode/plugins/plan-reviewer-opencode.mjs");
        let plugin_content = std::fs::read_to_string(&plugin_path).unwrap();

        // Version comment line should be present
        assert!(
            plugin_content.contains("// plan-reviewer-version: "),
            "installed plugin should contain version comment line"
        );
        // Version placeholder should NOT be present
        assert!(
            !plugin_content.contains("__PLAN_REVIEWER_VERSION__"),
            "__PLAN_REVIEWER_VERSION__ placeholder should be replaced in installed plugin file"
        );
        // Binary placeholder should NOT be present
        assert!(
            !plugin_content.contains("__PLAN_REVIEWER_BIN__"),
            "__PLAN_REVIEWER_BIN__ placeholder should be replaced in installed plugin file"
        );
    }

    #[test]
    fn opencode_plugin_uses_dependency_free_args_schema() {
        assert!(
            OPENCODE_PLUGIN_SOURCE.contains("args:"),
            "opencode custom tools must define args"
        );
        assert!(
            !OPENCODE_PLUGIN_SOURCE.contains("@opencode-ai/plugin"),
            "installed local plugin must not require external package dependencies"
        );
        assert!(
            !OPENCODE_PLUGIN_SOURCE.contains("parameters:"),
            "opencode custom tools should not use the legacy raw parameters field"
        );
    }

    #[test]
    fn read_mjs_version_extracts_version() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.mjs");
        std::fs::write(
            &file_path,
            "// plan-reviewer-opencode.mjs\n// plan-reviewer-version: 1.2.3\n// other comment\n",
        )
        .unwrap();

        let result = read_mjs_version(&file_path);
        assert_eq!(result, Some("1.2.3".to_string()));
    }

    #[test]
    fn read_mjs_version_returns_none_without_comment() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.mjs");
        std::fs::write(&file_path, "// no version here\nconst x = 1;\n").unwrap();

        let result = read_mjs_version(&file_path);
        assert_eq!(result, None);
    }

    #[test]
    fn read_mjs_version_returns_none_for_missing_file() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("nonexistent.mjs");

        let result = read_mjs_version(&file_path);
        assert_eq!(result, None);
    }

    // ---------------------------------------------------------------------------
    // Uninstall tests
    // ---------------------------------------------------------------------------

    #[test]
    fn uninstall_removes_plugin_file_and_config_entry() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = OpenCodeIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        // Install first
        integration.install(&ctx).unwrap();

        let plugin_path = dir
            .path()
            .join(".config/opencode/plugins/plan-reviewer-opencode.mjs");
        let config_path = dir.path().join(".config/opencode/opencode.json");
        assert!(
            plugin_path.exists(),
            "plugin file should exist after install"
        );

        // Uninstall
        let ctx_uninstall = InstallContext {
            home: home.clone(),
            binary_path: None,
        };
        let result = integration.uninstall(&ctx_uninstall);
        assert!(result.is_ok(), "uninstall should succeed: {:?}", result);

        assert!(
            !plugin_path.exists(),
            "plugin file should be removed after uninstall"
        );
        assert!(
            !dir.path()
                .join(".config/opencode/commands/plan-reviewer-annotate.md")
                .exists(),
            "annotate slash command should be removed after uninstall"
        );
        assert!(
            !dir.path()
                .join(".config/opencode/commands/plan-reviewer-code-review.md")
                .exists(),
            "code-review slash command should be removed after uninstall"
        );

        let content = std::fs::read_to_string(&config_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();
        let plugin_path_str = plugin_path.to_string_lossy().to_string();
        assert!(
            !opencode_is_installed(&json, &plugin_path_str),
            "plugin entry should be removed from config"
        );
    }

    #[test]
    fn uninstall_on_nonexistent_files_returns_ok() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = OpenCodeIntegration;
        let ctx = InstallContext {
            home,
            binary_path: None,
        };

        let result = integration.uninstall(&ctx);
        assert!(
            result.is_ok(),
            "uninstall on missing files should succeed: {:?}",
            result
        );
    }

    #[test]
    fn uninstall_when_plugin_not_in_config_returns_ok() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();

        // Create config without the plugin entry
        let config_dir = dir.path().join(".config/opencode");
        std::fs::create_dir_all(&config_dir).unwrap();
        let config_path = config_dir.join("opencode.json");
        std::fs::write(&config_path, r#"{"plugin": []}"#).unwrap();

        let integration = OpenCodeIntegration;
        let ctx = InstallContext {
            home,
            binary_path: None,
        };

        let result = integration.uninstall(&ctx);
        assert!(
            result.is_ok(),
            "uninstall with no plugin entry should succeed: {:?}",
            result
        );
    }

    #[test]
    fn uninstall_preserves_other_plugins_in_array() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();

        let plugin_path = dir
            .path()
            .join(".config/opencode/plugins/plan-reviewer-opencode.mjs");
        let plugin_path_str = plugin_path.to_string_lossy().to_string();

        // Create config with plan-reviewer and another plugin
        let config_dir = dir.path().join(".config/opencode");
        std::fs::create_dir_all(&config_dir).unwrap();
        let config_path = config_dir.join("opencode.json");
        let initial = serde_json::json!({
            "plugin": [
                plugin_path_str.clone(),
                "/some/other/plugin.mjs"
            ]
        });
        std::fs::write(
            &config_path,
            serde_json::to_string_pretty(&initial).unwrap(),
        )
        .unwrap();

        let integration = OpenCodeIntegration;
        let ctx = InstallContext {
            home,
            binary_path: None,
        };

        integration.uninstall(&ctx).unwrap();

        let content = std::fs::read_to_string(&config_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();

        // plan-reviewer should be gone
        assert!(!opencode_is_installed(&json, &plugin_path_str));

        // Other plugin should still be there
        let plugin_arr = json["plugin"].as_array().unwrap();
        assert_eq!(plugin_arr.len(), 1, "other plugin should still be present");
        assert_eq!(plugin_arr[0].as_str(), Some("/some/other/plugin.mjs"));
    }

    // ---------------------------------------------------------------------------
    // is_installed tests
    // ---------------------------------------------------------------------------

    #[test]
    fn is_installed_returns_false_when_no_files() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = OpenCodeIntegration;
        let ctx = InstallContext {
            home,
            binary_path: None,
        };
        assert!(!integration.is_installed(&ctx));
    }

    #[test]
    fn is_installed_returns_true_when_both_exist() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = OpenCodeIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();

        let ctx_check = InstallContext {
            home,
            binary_path: None,
        };
        assert!(integration.is_installed(&ctx_check));
    }

    #[test]
    fn is_installed_returns_false_when_plugin_file_missing() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();

        let plugin_path = dir
            .path()
            .join(".config/opencode/plugins/plan-reviewer-opencode.mjs");
        let plugin_path_str = plugin_path.to_string_lossy().to_string();

        // Create config with entry but no plugin file
        let config_dir = dir.path().join(".config/opencode");
        std::fs::create_dir_all(&config_dir).unwrap();
        let config_path = config_dir.join("opencode.json");
        let config = serde_json::json!({
            "plugin": [plugin_path_str]
        });
        std::fs::write(&config_path, serde_json::to_string_pretty(&config).unwrap()).unwrap();

        let integration = OpenCodeIntegration;
        let ctx = InstallContext {
            home,
            binary_path: None,
        };

        // Plugin file doesn't exist on disk → not installed
        assert!(!integration.is_installed(&ctx));
    }
}
