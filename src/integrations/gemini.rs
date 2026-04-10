use super::{InstallContext, Integration};
use std::path::PathBuf;

// ---------------------------------------------------------------------------
// GeminiIntegration
// ---------------------------------------------------------------------------

/// Full install/uninstall implementation for Gemini CLI.
///
/// Uses the Gemini CLI extension directory model (~/.gemini/extensions/plan-reviewer/).
/// Gemini CLI auto-discovers extensions in this directory — no settings.json entry needed.
pub struct GeminiIntegration;

impl Integration for GeminiIntegration {
    /// Install the plan-reviewer Gemini CLI extension.
    ///
    /// Writes the extension directory at {home}/.gemini/extensions/plan-reviewer/
    /// with gemini-extension.json and hooks/hooks.json. Idempotent — always rewrites
    /// files with current version. No settings.json modification.
    fn install(&self, ctx: &InstallContext) -> Result<(), String> {
        // binary_path must be Some (validated as guard, but hooks.json uses bare "plan-reviewer")
        let _binary_path = ctx
            .binary_path
            .as_deref()
            .ok_or_else(|| "install requires a binary_path — none was provided".to_string())?;

        let ext_dir = gemini_extension_dir(&ctx.home);

        // Create extension root directory
        if let Err(e) = std::fs::create_dir_all(&ext_dir) {
            return Err(format!("cannot create {}: {}", ext_dir.display(), e));
        }

        // Write gemini-extension.json manifest
        let manifest_path = ext_dir.join("gemini-extension.json");
        let manifest = format!(
            r#"{{"name":"plan-reviewer","version":"{}","description":"Plan review hook for Gemini CLI"}}"#,
            crate_version()
        );
        if let Err(e) = std::fs::write(&manifest_path, &manifest) {
            return Err(format!("cannot write {}: {}", manifest_path.display(), e));
        }

        // Create hooks/ subdirectory
        let hooks_dir = ext_dir.join("hooks");
        if let Err(e) = std::fs::create_dir_all(&hooks_dir) {
            return Err(format!("cannot create {}: {}", hooks_dir.display(), e));
        }

        // Write hooks/hooks.json
        // Uses bare "plan-reviewer" command (relies on PATH; Phase 07.3 changes to "plan-reviewer hook")
        // timeout: 300000 (5 minutes) — mandatory per research (default 60s is too short for interactive review)
        let hooks_path = hooks_dir.join("hooks.json");
        let hooks_json = r#"{"hooks":{"BeforeTool":[{"matcher":"exit_plan_mode","hooks":[{"name":"plan-reviewer","type":"command","command":"plan-reviewer","timeout":300000}]}]}}"#;
        if let Err(e) = std::fs::write(&hooks_path, hooks_json) {
            return Err(format!("cannot write {}: {}", hooks_path.display(), e));
        }

        println!(
            "plan-reviewer: Gemini CLI extension installed at {}",
            ext_dir.display()
        );
        println!(
            "plan-reviewer: Gemini CLI auto-discovers extensions — no settings.json modification needed"
        );
        Ok(())
    }

    /// Remove the plan-reviewer Gemini CLI extension directory.
    ///
    /// Idempotent: returns Ok if the extension directory does not exist.
    /// Does NOT touch ~/.gemini/settings.json — old settings.json entries are
    /// Phase 07.3 migration concern.
    fn uninstall(&self, ctx: &InstallContext) -> Result<(), String> {
        let ext_dir = gemini_extension_dir(&ctx.home);

        if ext_dir.exists() {
            if let Err(e) = std::fs::remove_dir_all(&ext_dir) {
                return Err(format!("cannot remove {}: {}", ext_dir.display(), e));
            }
            println!(
                "plan-reviewer: Gemini CLI extension removed from {}",
                ext_dir.display()
            );
        } else {
            println!("plan-reviewer: {} not found (skipping)", ext_dir.display());
        }

        Ok(())
    }

    /// Returns `true` if the Gemini CLI extension is installed.
    ///
    /// Checks whether gemini-extension.json exists in the extension directory.
    /// This is the new idempotency key (replaces the old settings.json check).
    fn is_installed(&self, ctx: &InstallContext) -> bool {
        gemini_extension_dir(&ctx.home)
            .join("gemini-extension.json")
            .exists()
    }
}

// ---------------------------------------------------------------------------
// Gemini CLI helper functions
// ---------------------------------------------------------------------------

/// Returns the path to the Gemini CLI extension directory:
/// `{home}/.gemini/extensions/plan-reviewer`.
///
/// pub(crate) — used by update.rs for version-aware manifest reading.
pub(crate) fn gemini_extension_dir(home: &str) -> PathBuf {
    PathBuf::from(home).join(".gemini/extensions/plan-reviewer")
}

/// Returns the current crate version string (from Cargo.toml).
fn crate_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

/// Returns `true` if a Gemini CLI settings.json contains a BeforeTool hook
/// entry with name "plan-reviewer".
///
/// pub(crate) — kept for Phase 07.3 migration: detecting old-style hook entries
/// so they can be cleaned up during the migration pass.
///
/// NOTE: This function checks the OLD settings.json format (pre-07.2). It is NOT
/// used by the new extension-directory-based install/uninstall.
#[allow(dead_code)]
pub(crate) fn gemini_legacy_hook_installed(settings: &serde_json::Value) -> bool {
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
    fn gemini_extension_dir_test() {
        let path = gemini_extension_dir("/home/alice");
        assert_eq!(
            path,
            PathBuf::from("/home/alice/.gemini/extensions/plan-reviewer")
        );
    }

    #[test]
    fn gemini_legacy_hook_installed_returns_true_when_hook_present() {
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
        assert!(gemini_legacy_hook_installed(&settings));
    }

    #[test]
    fn gemini_legacy_hook_installed_returns_false_for_empty_object() {
        let settings = serde_json::json!({});
        assert!(!gemini_legacy_hook_installed(&settings));
    }

    #[test]
    fn gemini_legacy_hook_installed_returns_false_when_no_plan_reviewer() {
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
        assert!(!gemini_legacy_hook_installed(&settings));
    }

    // ---------------------------------------------------------------------------
    // Install tests (filesystem)
    // ---------------------------------------------------------------------------

    #[test]
    fn install_creates_extension_directory_when_no_prior_state() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = GeminiIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        let result = integration.install(&ctx);
        assert!(result.is_ok(), "install should succeed: {:?}", result);

        let ext_dir = dir.path().join(".gemini/extensions/plan-reviewer");
        assert!(ext_dir.exists(), "extension directory should be created");
    }

    #[test]
    fn install_writes_gemini_extension_json_with_correct_keys() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = GeminiIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();

        let manifest_path = dir
            .path()
            .join(".gemini/extensions/plan-reviewer/gemini-extension.json");
        assert!(manifest_path.exists(), "gemini-extension.json should exist");

        let content = std::fs::read_to_string(&manifest_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();

        assert_eq!(
            json["name"].as_str(),
            Some("plan-reviewer"),
            "name should be 'plan-reviewer'"
        );
        assert!(
            json["version"].as_str().is_some(),
            "version field should be present"
        );
        assert_eq!(
            json["version"].as_str(),
            Some(crate_version()),
            "version should match crate version"
        );
        assert!(
            json["description"].as_str().is_some(),
            "description field should be present"
        );
    }

    #[test]
    fn install_writes_hooks_json_with_before_tool_exit_plan_mode() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = GeminiIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();

        let hooks_path = dir
            .path()
            .join(".gemini/extensions/plan-reviewer/hooks/hooks.json");
        assert!(hooks_path.exists(), "hooks/hooks.json should exist");

        let content = std::fs::read_to_string(&hooks_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();

        // Verify BeforeTool hook exists with exit_plan_mode matcher
        let before_tool = json["hooks"]["BeforeTool"].as_array().unwrap();
        assert!(
            !before_tool.is_empty(),
            "BeforeTool array should not be empty"
        );

        let entry = &before_tool[0];
        assert_eq!(
            entry["matcher"].as_str(),
            Some("exit_plan_mode"),
            "matcher should be 'exit_plan_mode'"
        );

        let hooks = entry["hooks"].as_array().unwrap();
        assert_eq!(hooks.len(), 1);
        assert_eq!(hooks[0]["name"].as_str(), Some("plan-reviewer"));
        assert_eq!(hooks[0]["type"].as_str(), Some("command"));
        assert_eq!(hooks[0]["command"].as_str(), Some("plan-reviewer"));
        assert_eq!(hooks[0]["timeout"].as_i64(), Some(300000));
    }

    #[test]
    fn install_does_not_create_or_modify_settings_json() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = GeminiIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();

        let settings_path = dir.path().join(".gemini/settings.json");
        assert!(
            !settings_path.exists(),
            "install should NOT create ~/.gemini/settings.json"
        );
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

        // Both manifest and hooks file should exist and be valid JSON
        let manifest_path = dir
            .path()
            .join(".gemini/extensions/plan-reviewer/gemini-extension.json");
        let hooks_path = dir
            .path()
            .join(".gemini/extensions/plan-reviewer/hooks/hooks.json");

        let manifest_content = std::fs::read_to_string(&manifest_path).unwrap();
        let hooks_content = std::fs::read_to_string(&hooks_path).unwrap();

        // Both should be valid JSON (no corruption from double install)
        assert!(
            serde_json::from_str::<serde_json::Value>(&manifest_content).is_ok(),
            "gemini-extension.json should be valid JSON after double install"
        );
        assert!(
            serde_json::from_str::<serde_json::Value>(&hooks_content).is_ok(),
            "hooks.json should be valid JSON after double install"
        );
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
    fn uninstall_removes_extension_directory_entirely() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = GeminiIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        // Install first
        integration.install(&ctx).unwrap();

        let ext_dir = dir.path().join(".gemini/extensions/plan-reviewer");
        assert!(
            ext_dir.exists(),
            "extension directory should exist after install"
        );

        // Uninstall
        let ctx_uninstall = InstallContext {
            home: home.clone(),
            binary_path: None,
        };
        let result = integration.uninstall(&ctx_uninstall);
        assert!(result.is_ok(), "uninstall should succeed: {:?}", result);

        assert!(
            !ext_dir.exists(),
            "extension directory should be removed after uninstall"
        );
    }

    #[test]
    fn uninstall_on_nonexistent_directory_returns_ok() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = GeminiIntegration;
        let ctx = InstallContext {
            home,
            binary_path: None,
        };

        // No installation was done
        let result = integration.uninstall(&ctx);
        assert!(
            result.is_ok(),
            "uninstall on missing directory should succeed: {:?}",
            result
        );
    }

    // ---------------------------------------------------------------------------
    // is_installed tests (filesystem)
    // ---------------------------------------------------------------------------

    #[test]
    fn is_installed_returns_true_when_gemini_extension_json_exists() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = GeminiIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();

        let ctx_check = InstallContext {
            home: home.clone(),
            binary_path: None,
        };
        assert!(
            integration.is_installed(&ctx_check),
            "is_installed should return true when gemini-extension.json exists"
        );
    }

    #[test]
    fn is_installed_returns_false_when_extension_dir_does_not_exist() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = GeminiIntegration;
        let ctx = InstallContext {
            home,
            binary_path: None,
        };

        assert!(
            !integration.is_installed(&ctx),
            "is_installed should return false when extension dir does not exist"
        );
    }
}
