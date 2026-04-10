use super::{InstallContext, Integration};
use std::path::PathBuf;

// ---------------------------------------------------------------------------
// GeminiIntegration
// ---------------------------------------------------------------------------

/// Full install/uninstall implementation for Gemini CLI.
pub struct GeminiIntegration;

impl Integration for GeminiIntegration {
    /// Wire the exit_plan_mode BeforeTool hook into ~/.gemini/settings.json.
    ///
    /// Idempotent: safe to run multiple times. If the hook is already present
    /// (any BeforeTool entry whose hooks[] array contains name "plan-reviewer"),
    /// returns Ok(()) immediately.
    fn install(&self, ctx: &InstallContext) -> Result<(), String> {
        let binary_path = ctx
            .binary_path
            .as_deref()
            .ok_or_else(|| "install requires a binary_path — none was provided".to_string())?;
        let settings_path = gemini_settings_path(&ctx.home);

        // Read existing settings or start with an empty object
        let mut root: serde_json::Value = if settings_path.exists() {
            match std::fs::read_to_string(&settings_path) {
                Ok(content) => match serde_json::from_str(&content) {
                    Ok(v) => v,
                    Err(e) => {
                        return Err(format!(
                            "cannot parse {}: {} -- refusing to overwrite. Fix or remove the file first.",
                            settings_path.display(),
                            e
                        ));
                    }
                },
                Err(e) => {
                    return Err(format!("cannot read {}: {}", settings_path.display(), e));
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
                settings_path.display()
            );
            root = serde_json::json!({});
        }

        // Ensure root["hooks"] exists as an object
        {
            let root_obj = root
                .as_object_mut()
                .expect("root is always an object at this point");
            root_obj
                .entry("hooks")
                .or_insert_with(|| serde_json::json!({}));
        }

        // Validate root["hooks"] is an object
        {
            let hooks_display = root["hooks"].to_string();
            let hooks_obj = root["hooks"].as_object_mut().ok_or_else(|| {
                format!(
                    "settings.json: expected 'hooks' to be an object, found: {}",
                    hooks_display
                )
            })?;
            // Ensure root["hooks"]["BeforeTool"] exists as an array
            hooks_obj
                .entry("BeforeTool")
                .or_insert_with(|| serde_json::json!([]));
        }

        // Validate root["hooks"]["BeforeTool"] is an array
        {
            root["hooks"]["BeforeTool"].as_array_mut().ok_or_else(|| {
                "settings.json: expected 'hooks.BeforeTool' to be an array".to_string()
            })?;
        }

        // Idempotency check
        if gemini_is_installed(&root) {
            println!(
                "plan-reviewer: BeforeTool hook already configured in {} (no changes made)",
                settings_path.display()
            );
            return Ok(());
        }

        // Push the new hook entry
        root["hooks"]["BeforeTool"]
            .as_array_mut()
            .expect("BeforeTool was validated as array above")
            .push(gemini_hook_entry(binary_path));

        // Write back with pretty-printing
        let output = match serde_json::to_string_pretty(&root) {
            Ok(s) => s,
            Err(e) => {
                return Err(format!("cannot serialize settings.json: {}", e));
            }
        };

        // Create ~/.gemini/ if it doesn't exist
        if let Some(parent) = settings_path.parent()
            && let Err(e) = std::fs::create_dir_all(parent)
        {
            return Err(format!("cannot create {}: {}", parent.display(), e));
        }

        if let Err(e) = std::fs::write(&settings_path, output) {
            return Err(format!("cannot write {}: {}", settings_path.display(), e));
        }

        println!(
            "plan-reviewer: BeforeTool hook installed in {}",
            settings_path.display()
        );
        println!("plan-reviewer: hook command set to: {}", binary_path);
        Ok(())
    }

    /// Remove the exit_plan_mode BeforeTool hook from ~/.gemini/settings.json.
    ///
    /// Idempotent: safe to run when the hook is not present.
    /// Matches on name "plan-reviewer" in hooks[] sub-array — NOT on binary path.
    fn uninstall(&self, ctx: &InstallContext) -> Result<(), String> {
        let settings_path = gemini_settings_path(&ctx.home);

        // If settings file does not exist, nothing to do
        if !settings_path.exists() {
            println!(
                "plan-reviewer: no settings file found at {} (nothing to uninstall)",
                settings_path.display()
            );
            return Ok(());
        }

        // Read and parse JSON
        let content = match std::fs::read_to_string(&settings_path) {
            Ok(c) => c,
            Err(e) => {
                return Err(format!("cannot read {}: {}", settings_path.display(), e));
            }
        };

        let mut root: serde_json::Value = match serde_json::from_str(&content) {
            Ok(v) => v,
            Err(e) => {
                eprintln!(
                    "plan-reviewer uninstall: warning: {} contains invalid JSON: {} (no changes made)",
                    settings_path.display(),
                    e
                );
                return Ok(());
            }
        };

        // Idempotency check: if hook is not present, nothing to do
        if !gemini_is_installed(&root) {
            println!(
                "plan-reviewer: BeforeTool hook not found in {} (no changes made)",
                settings_path.display()
            );
            return Ok(());
        }

        // Remove all BeforeTool entries whose hooks[] array contains name "plan-reviewer"
        if let Some(arr) = root["hooks"]["BeforeTool"].as_array_mut() {
            arr.retain(|entry| {
                entry["hooks"]
                    .as_array()
                    .map(|hooks| {
                        !hooks
                            .iter()
                            .any(|h| h["name"].as_str() == Some("plan-reviewer"))
                    })
                    .unwrap_or(true)
            });
        }

        // Write back with pretty-printing
        let output = match serde_json::to_string_pretty(&root) {
            Ok(s) => s,
            Err(e) => {
                return Err(format!("cannot serialize settings.json: {}", e));
            }
        };

        if let Err(e) = std::fs::write(&settings_path, output) {
            return Err(format!("cannot write {}: {}", settings_path.display(), e));
        }

        println!(
            "plan-reviewer: BeforeTool hook removed from {}",
            settings_path.display()
        );
        Ok(())
    }

    /// Returns `true` if the Gemini CLI hook is already configured.
    ///
    /// Reads settings.json from ctx.home; returns false if file doesn't exist
    /// or cannot be parsed.
    fn is_installed(&self, ctx: &InstallContext) -> bool {
        let settings_path = gemini_settings_path(&ctx.home);
        if !settings_path.exists() {
            return false;
        }
        match std::fs::read_to_string(&settings_path) {
            Ok(content) => match serde_json::from_str::<serde_json::Value>(&content) {
                Ok(json) => gemini_is_installed(&json),
                Err(_) => false,
            },
            Err(_) => false,
        }
    }
}

// ---------------------------------------------------------------------------
// Gemini CLI helper functions (private to this module)
// ---------------------------------------------------------------------------

/// Returns the path to Gemini CLI's settings file: `{home}/.gemini/settings.json`.
fn gemini_settings_path(home: &str) -> PathBuf {
    PathBuf::from(home).join(".gemini/settings.json")
}

/// Returns the JSON hook entry to insert into `root["hooks"]["BeforeTool"]`.
///
/// ```json
/// {
///   "matcher": "exit_plan_mode",
///   "hooks": [
///     {
///       "name": "plan-reviewer",
///       "type": "command",
///       "command": "<binary_path>",
///       "timeout": 300000
///     }
///   ]
/// }
/// ```
///
/// The `timeout: 300000` (5 minutes) is MANDATORY — Gemini CLI defaults to 60 seconds,
/// which is too short for interactive browser review (per 06-RESEARCH.md Pitfall 1).
fn gemini_hook_entry(binary_path: &str) -> serde_json::Value {
    serde_json::json!({
        "matcher": "exit_plan_mode",
        "hooks": [
            {
                "name": "plan-reviewer",
                "type": "command",
                "command": binary_path,
                "timeout": 300000
            }
        ]
    })
}

/// Returns `true` if the Gemini CLI hook is already configured in `settings`.
///
/// Checks whether any entry in `settings["hooks"]["BeforeTool"]` has a `hooks[]`
/// sub-array containing an element with `"name": "plan-reviewer"`. This is the
/// idempotency key — NOT the binary path, so entries written at a different path
/// are still detected.
fn gemini_is_installed(settings: &serde_json::Value) -> bool {
    settings["hooks"]["BeforeTool"]
        .as_array()
        .map(|arr| {
            arr.iter().any(|entry| {
                entry["hooks"]
                    .as_array()
                    .map(|hooks| {
                        hooks
                            .iter()
                            .any(|h| h["name"].as_str() == Some("plan-reviewer"))
                    })
                    .unwrap_or(false)
            })
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
    fn gemini_settings_path_test() {
        let path = gemini_settings_path("/home/alice");
        assert_eq!(path, PathBuf::from("/home/alice/.gemini/settings.json"));
    }

    #[test]
    fn gemini_hook_entry_structure() {
        let entry = gemini_hook_entry("/usr/local/bin/plan-reviewer");
        assert_eq!(entry["matcher"].as_str(), Some("exit_plan_mode"));
        let hooks = entry["hooks"].as_array().unwrap();
        assert_eq!(hooks.len(), 1);
        assert_eq!(hooks[0]["name"].as_str(), Some("plan-reviewer"));
        assert_eq!(hooks[0]["type"].as_str(), Some("command"));
        assert_eq!(
            hooks[0]["command"].as_str(),
            Some("/usr/local/bin/plan-reviewer")
        );
        assert_eq!(hooks[0]["timeout"].as_i64(), Some(300000));
    }

    #[test]
    fn gemini_is_installed_returns_true_when_hook_present() {
        let settings = serde_json::json!({
            "hooks": {
                "BeforeTool": [
                    {
                        "matcher": "exit_plan_mode",
                        "hooks": [
                            {
                                "name": "plan-reviewer",
                                "type": "command",
                                "command": "/usr/local/bin/plan-reviewer",
                                "timeout": 300000
                            }
                        ]
                    }
                ]
            }
        });
        assert!(gemini_is_installed(&settings));
    }

    #[test]
    fn gemini_is_installed_returns_false_for_empty_object() {
        let settings = serde_json::json!({});
        assert!(!gemini_is_installed(&settings));
    }

    #[test]
    fn gemini_is_installed_returns_false_for_empty_before_tool_array() {
        let settings = serde_json::json!({
            "hooks": {
                "BeforeTool": []
            }
        });
        assert!(!gemini_is_installed(&settings));
    }

    #[test]
    fn gemini_is_installed_returns_false_when_no_plan_reviewer_name() {
        let settings = serde_json::json!({
            "hooks": {
                "BeforeTool": [
                    {
                        "matcher": "other_tool",
                        "hooks": [
                            {
                                "name": "some-other-hook",
                                "type": "command",
                                "command": "/usr/bin/other"
                            }
                        ]
                    }
                ]
            }
        });
        assert!(!gemini_is_installed(&settings));
    }

    // ---------------------------------------------------------------------------
    // Install tests (filesystem)
    // ---------------------------------------------------------------------------

    #[test]
    fn install_creates_settings_when_no_file_exists() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = GeminiIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        let result = integration.install(&ctx);
        assert!(result.is_ok(), "install should succeed: {:?}", result);

        let settings_path = dir.path().join(".gemini/settings.json");
        assert!(settings_path.exists(), "settings.json should be created");

        let content = std::fs::read_to_string(&settings_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();
        assert!(
            gemini_is_installed(&json),
            "installed hook should be detected"
        );
        // Verify timeout is 300000
        let before_tool = &json["hooks"]["BeforeTool"];
        let hooks = before_tool[0]["hooks"].as_array().unwrap();
        assert_eq!(hooks[0]["timeout"].as_i64(), Some(300000));
    }

    #[test]
    fn install_is_idempotent() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = GeminiIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();
        integration.install(&ctx).unwrap();

        let settings_path = dir.path().join(".gemini/settings.json");
        let content = std::fs::read_to_string(&settings_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();

        // Should only have ONE BeforeTool entry with plan-reviewer
        let before_tool = json["hooks"]["BeforeTool"].as_array().unwrap();
        let plan_reviewer_count = before_tool
            .iter()
            .filter(|entry| {
                entry["hooks"]
                    .as_array()
                    .map(|h| {
                        h.iter()
                            .any(|h| h["name"].as_str() == Some("plan-reviewer"))
                    })
                    .unwrap_or(false)
            })
            .count();
        assert_eq!(
            plan_reviewer_count, 1,
            "should have exactly one plan-reviewer entry after two installs"
        );
    }

    #[test]
    fn install_preserves_existing_settings_keys() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();

        // Create settings file with existing key
        let gemini_dir = dir.path().join(".gemini");
        std::fs::create_dir_all(&gemini_dir).unwrap();
        let settings_path = gemini_dir.join("settings.json");
        std::fs::write(&settings_path, r#"{"theme": "dark"}"#).unwrap();

        let integration = GeminiIntegration;
        let ctx = InstallContext {
            home,
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();

        let content = std::fs::read_to_string(&settings_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();

        // Existing key should be preserved
        assert_eq!(
            json["theme"].as_str(),
            Some("dark"),
            "theme key should be preserved"
        );
        // Hook should be present
        assert!(gemini_is_installed(&json));
    }

    #[test]
    fn install_returns_err_when_binary_path_is_none() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = GeminiIntegration;
        let ctx = InstallContext {
            home,
            binary_path: None,
        };

        let result = integration.install(&ctx);
        assert!(result.is_err(), "install without binary_path should fail");
    }

    // ---------------------------------------------------------------------------
    // Uninstall tests
    // ---------------------------------------------------------------------------

    #[test]
    fn uninstall_removes_plan_reviewer_entry_preserves_others() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();

        // Create settings with both plan-reviewer and another hook
        let gemini_dir = dir.path().join(".gemini");
        std::fs::create_dir_all(&gemini_dir).unwrap();
        let settings_path = gemini_dir.join("settings.json");
        let initial = serde_json::json!({
            "hooks": {
                "BeforeTool": [
                    {
                        "matcher": "exit_plan_mode",
                        "hooks": [
                            {
                                "name": "plan-reviewer",
                                "type": "command",
                                "command": "/usr/local/bin/plan-reviewer",
                                "timeout": 300000
                            }
                        ]
                    },
                    {
                        "matcher": "other_tool",
                        "hooks": [
                            {
                                "name": "other-hook",
                                "type": "command",
                                "command": "/usr/bin/other"
                            }
                        ]
                    }
                ]
            }
        });
        std::fs::write(
            &settings_path,
            serde_json::to_string_pretty(&initial).unwrap(),
        )
        .unwrap();

        let integration = GeminiIntegration;
        let ctx = InstallContext {
            home,
            binary_path: None,
        };

        integration.uninstall(&ctx).unwrap();

        let content = std::fs::read_to_string(&settings_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();

        // plan-reviewer should be gone
        assert!(
            !gemini_is_installed(&json),
            "plan-reviewer hook should be removed"
        );

        // other hook should still be there
        let before_tool = json["hooks"]["BeforeTool"].as_array().unwrap();
        assert_eq!(before_tool.len(), 1, "other hook should still be present");
        assert_eq!(before_tool[0]["matcher"].as_str(), Some("other_tool"));
    }

    #[test]
    fn uninstall_on_nonexistent_settings_returns_ok() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = GeminiIntegration;
        let ctx = InstallContext {
            home,
            binary_path: None,
        };

        let result = integration.uninstall(&ctx);
        assert!(
            result.is_ok(),
            "uninstall on missing file should succeed: {:?}",
            result
        );
    }

    #[test]
    fn uninstall_when_hook_not_present_returns_ok() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();

        let gemini_dir = dir.path().join(".gemini");
        std::fs::create_dir_all(&gemini_dir).unwrap();
        let settings_path = gemini_dir.join("settings.json");
        std::fs::write(&settings_path, r#"{"hooks": {"BeforeTool": []}}"#).unwrap();

        let integration = GeminiIntegration;
        let ctx = InstallContext {
            home,
            binary_path: None,
        };

        let result = integration.uninstall(&ctx);
        assert!(
            result.is_ok(),
            "uninstall with no hook present should succeed: {:?}",
            result
        );
    }

    // ---------------------------------------------------------------------------
    // is_installed tests (filesystem)
    // ---------------------------------------------------------------------------

    #[test]
    fn is_installed_returns_false_when_no_settings_file() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = GeminiIntegration;
        let ctx = InstallContext {
            home,
            binary_path: None,
        };
        assert!(!integration.is_installed(&ctx));
    }

    #[test]
    fn is_installed_returns_true_when_hook_present() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();

        let gemini_dir = dir.path().join(".gemini");
        std::fs::create_dir_all(&gemini_dir).unwrap();
        let settings_path = gemini_dir.join("settings.json");
        let settings = serde_json::json!({
            "hooks": {
                "BeforeTool": [
                    {
                        "matcher": "exit_plan_mode",
                        "hooks": [
                            {
                                "name": "plan-reviewer",
                                "type": "command",
                                "command": "/usr/local/bin/plan-reviewer",
                                "timeout": 300000
                            }
                        ]
                    }
                ]
            }
        });
        std::fs::write(
            &settings_path,
            serde_json::to_string_pretty(&settings).unwrap(),
        )
        .unwrap();

        let integration = GeminiIntegration;
        let ctx = InstallContext {
            home,
            binary_path: None,
        };
        assert!(integration.is_installed(&ctx));
    }
}
