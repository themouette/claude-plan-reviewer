use super::{InstallContext, Integration};
use std::path::PathBuf;

// ---------------------------------------------------------------------------
// ClaudeIntegration
// ---------------------------------------------------------------------------

/// Full install/uninstall implementation for Claude Code.
pub struct ClaudeIntegration;

impl Integration for ClaudeIntegration {
    /// Wire the ExitPlanMode hook into ~/.claude/settings.json.
    ///
    /// Idempotent: safe to run multiple times. If the hook is already present
    /// (any entry with matcher == "ExitPlanMode"), returns Ok(()) immediately.
    fn install(&self, ctx: &InstallContext) -> Result<(), String> {
        let binary_path = ctx
            .binary_path
            .as_deref()
            .ok_or_else(|| "install requires a binary_path — none was provided".to_string())?;
        let settings_path = claude_settings_path(&ctx.home);

        // Read existing settings or start with an empty object
        let mut root: serde_json::Value = if settings_path.exists() {
            match std::fs::read_to_string(&settings_path) {
                Ok(content) => match serde_json::from_str(&content) {
                    Ok(v) => v,
                    Err(e) => {
                        return Err(format!(
                            "cannot parse {}: {} — refusing to overwrite. \
                             Fix or remove the file first.",
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

        // Ensure root.hooks exists as an object (use entry() API — index operator does NOT create keys)
        {
            let root_obj = root
                .as_object_mut()
                .expect("root is always an object at this point");
            root_obj
                .entry("hooks")
                .or_insert_with(|| serde_json::json!({}));
        }

        // Ensure root["hooks"] is an object (entry() is a no-op when the key already exists
        // with a non-object value, so we must validate explicitly), then ensure
        // root["hooks"]["PermissionRequest"] exists as an array.
        {
            // Capture display string before taking a mutable borrow.
            let hooks_display = root["hooks"].to_string();
            let hooks_obj = root["hooks"].as_object_mut().ok_or_else(|| {
                format!(
                    "settings.json: expected 'hooks' to be an object, found: {}",
                    hooks_display
                )
            })?;
            hooks_obj
                .entry("PermissionRequest")
                .or_insert_with(|| serde_json::json!([]));
        }

        // Ensure root["hooks"]["PermissionRequest"] is an array
        {
            root["hooks"]["PermissionRequest"]
                .as_array_mut()
                .ok_or_else(|| {
                    "settings.json: expected 'hooks.PermissionRequest' to be an array".to_string()
                })?;
        }

        // Idempotency check
        if claude_is_installed(&root) {
            println!(
                "plan-reviewer: ExitPlanMode hook already configured in {} (no changes made)",
                settings_path.display()
            );
            return Ok(());
        }

        // Push the new hook entry
        root["hooks"]["PermissionRequest"]
            .as_array_mut()
            .expect("PermissionRequest was validated as array above")
            .push(claude_hook_entry(binary_path));

        // Write back with pretty-printing (2-space indent, standard serde_json format)
        let output = match serde_json::to_string_pretty(&root) {
            Ok(s) => s,
            Err(e) => {
                return Err(format!("cannot serialize settings.json: {}", e));
            }
        };

        // Create ~/.claude/ if it doesn't exist
        if let Some(parent) = settings_path.parent()
            && let Err(e) = std::fs::create_dir_all(parent)
        {
            return Err(format!("cannot create {}: {}", parent.display(), e));
        }

        if let Err(e) = std::fs::write(&settings_path, output) {
            return Err(format!("cannot write {}: {}", settings_path.display(), e));
        }

        println!(
            "plan-reviewer: ExitPlanMode hook installed in {}",
            settings_path.display()
        );
        println!("plan-reviewer: hook command set to: {}", binary_path);
        Ok(())
    }

    /// Remove the ExitPlanMode hook from ~/.claude/settings.json.
    ///
    /// Idempotent: safe to run when the hook is not present (D-05).
    /// Matches on `"matcher": "ExitPlanMode"` — NOT on binary path.
    fn uninstall(&self, ctx: &InstallContext) -> Result<(), String> {
        let settings_path = claude_settings_path(&ctx.home);

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

        // Idempotency check: if hook is not present, nothing to do (D-05)
        if !claude_is_installed(&root) {
            println!(
                "plan-reviewer: ExitPlanMode hook not found in {} (no changes made)",
                settings_path.display()
            );
            return Ok(());
        }

        // Remove all entries where "matcher" == "ExitPlanMode"
        // This removes ALL ExitPlanMode entries regardless of binary path
        if let Some(arr) = root["hooks"]["PermissionRequest"].as_array_mut() {
            arr.retain(|entry| entry["matcher"].as_str() != Some("ExitPlanMode"));
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
            "plan-reviewer: ExitPlanMode hook removed from {}",
            settings_path.display()
        );
        Ok(())
    }

    /// Returns `true` if the Claude Code hook is already configured.
    ///
    /// Reads settings.json from ctx.home; returns false if file doesn't exist
    /// or cannot be parsed.
    fn is_installed(&self, ctx: &InstallContext) -> bool {
        let settings_path = claude_settings_path(&ctx.home);
        if !settings_path.exists() {
            return false;
        }
        match std::fs::read_to_string(&settings_path) {
            Ok(content) => match serde_json::from_str::<serde_json::Value>(&content) {
                Ok(json) => claude_is_installed(&json),
                Err(_) => false,
            },
            Err(_) => false,
        }
    }
}

// ---------------------------------------------------------------------------
// Claude Code helper functions (private to this module)
// ---------------------------------------------------------------------------

/// Returns the path to Claude Code's settings file: `{home}/.claude/settings.json`.
///
/// The `home` argument is the value of the `HOME` environment variable — the only
/// external input that touches the filesystem path (T-04-02 mitigation: no user-supplied
/// path fragments are accepted).
fn claude_settings_path(home: &str) -> PathBuf {
    PathBuf::from(home).join(".claude/settings.json")
}

/// Returns the JSON hook entry to insert into `root["hooks"]["PermissionRequest"]`.
///
/// ```json
/// {"matcher":"ExitPlanMode","hooks":[{"type":"command","command":"<binary_path>"}]}
/// ```
fn claude_hook_entry(binary_path: &str) -> serde_json::Value {
    serde_json::json!({
        "matcher": "ExitPlanMode",
        "hooks": [
            {
                "type": "command",
                "command": binary_path
            }
        ]
    })
}

/// Returns `true` if the Claude Code hook is already configured in `settings`.
///
/// Checks whether any entry in `settings["hooks"]["PermissionRequest"]` has
/// `"matcher": "ExitPlanMode"`. This is the idempotency key used by both install
/// and uninstall — the binary path is intentionally NOT checked so that entries
/// written by a previous installation at a different path are still detected.
fn claude_is_installed(settings: &serde_json::Value) -> bool {
    settings["hooks"]["PermissionRequest"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .any(|entry| entry["matcher"].as_str() == Some("ExitPlanMode"))
        })
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn claude_settings_path_test() {
        let path = claude_settings_path("/home/alice");
        assert_eq!(
            path,
            std::path::PathBuf::from("/home/alice/.claude/settings.json")
        );
    }

    #[test]
    fn claude_hook_entry_has_exit_plan_mode() {
        let entry = claude_hook_entry("/usr/local/bin/plan-reviewer");
        assert_eq!(entry["matcher"].as_str(), Some("ExitPlanMode"));
        assert_eq!(
            entry["hooks"][0]["command"].as_str(),
            Some("/usr/local/bin/plan-reviewer")
        );
    }

    #[test]
    fn claude_is_installed_detects_matcher() {
        let settings_with_hook = serde_json::json!({
            "hooks": {
                "PermissionRequest": [
                    {"matcher": "ExitPlanMode", "hooks": [{"type": "command", "command": "/bin/plan-reviewer"}]}
                ]
            }
        });
        assert!(claude_is_installed(&settings_with_hook));

        let settings_empty = serde_json::json!({"hooks": {"PermissionRequest": []}});
        assert!(!claude_is_installed(&settings_empty));

        let settings_no_hooks = serde_json::json!({});
        assert!(!claude_is_installed(&settings_no_hooks));
    }
}
