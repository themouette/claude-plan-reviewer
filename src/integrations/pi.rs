use super::{InstallContext, Integration};
use std::path::PathBuf;

// ---------------------------------------------------------------------------
// PiIntegration
// ---------------------------------------------------------------------------

/// The Pi extension TypeScript source, embedded at compile time.
///
/// The `__PLAN_REVIEWER_BIN__` and `__PLAN_REVIEWER_VERSION__` placeholders
/// are replaced with the real binary path and current version at install time
/// before writing to disk.
pub(crate) const PI_EXTENSION_SOURCE: &str = include_str!("pi_extension.ts");

/// Full install/uninstall implementation for Pi.
///
/// Writes a TypeScript extension shim to `~/.pi/agent/extensions/plan-reviewer-pi.ts`.
/// Pi auto-discovers extensions in that directory — no settings.json modification needed.
pub struct PiIntegration;

impl Integration for PiIntegration {
    /// Wire the plan_reviewer_submit_plan extension into Pi.
    ///
    /// Idempotent: safe to run multiple times. The extension file is always
    /// (re)written with the current embedded source and current binary path.
    fn install(&self, ctx: &InstallContext) -> Result<(), String> {
        let binary_path = ctx
            .binary_path
            .as_deref()
            .ok_or_else(|| "install requires a binary_path — none was provided".to_string())?;

        let extension_path = pi_extension_path(&ctx.home);

        // Create ~/.pi/agent/extensions/ directory if it doesn't exist
        if let Some(parent) = extension_path.parent()
            && let Err(e) = std::fs::create_dir_all(parent)
        {
            return Err(format!("cannot create {}: {}", parent.display(), e));
        }

        // Write the extension file: replace placeholders with actual values
        let extension_source = PI_EXTENSION_SOURCE
            .replace("__PLAN_REVIEWER_BIN__", binary_path)
            .replace("__PLAN_REVIEWER_VERSION__", env!("CARGO_PKG_VERSION"));
        if let Err(e) = std::fs::write(&extension_path, &extension_source) {
            return Err(format!("cannot write {}: {}", extension_path.display(), e));
        }

        println!(
            "plan-reviewer: Pi extension written to {}",
            extension_path.display()
        );
        Ok(())
    }

    /// Remove the Pi extension shim.
    ///
    /// Idempotent: safe to run when the extension file is not present.
    fn uninstall(&self, ctx: &InstallContext) -> Result<(), String> {
        let extension_path = pi_extension_path(&ctx.home);

        if extension_path.exists() {
            if let Err(e) = std::fs::remove_file(&extension_path) {
                return Err(format!("cannot remove {}: {}", extension_path.display(), e));
            }
            println!(
                "plan-reviewer: Pi extension removed from {}",
                extension_path.display()
            );
        } else {
            println!(
                "plan-reviewer: no Pi extension found at {} (skipping)",
                extension_path.display()
            );
        }

        Ok(())
    }

    /// Returns `true` if the Pi extension shim exists on disk.
    ///
    /// File-only check — there is no settings.json to inspect for Pi.
    fn is_installed(&self, ctx: &InstallContext) -> bool {
        pi_extension_path(&ctx.home).exists()
    }
}

// ---------------------------------------------------------------------------
// Pi helper functions (private to this module, pub(crate) where needed)
// ---------------------------------------------------------------------------

/// Returns the path for the installed Pi extension file:
/// `{home}/.pi/agent/extensions/plan-reviewer-pi.ts`.
///
/// pub(crate) — used by update.rs for version-aware refresh.
pub(crate) fn pi_extension_path(home: &str) -> PathBuf {
    PathBuf::from(home).join(".pi/agent/extensions/plan-reviewer-pi.ts")
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    // ---------------------------------------------------------------------------
    // Helper function tests
    // ---------------------------------------------------------------------------

    #[test]
    fn pi_extension_path_test() {
        let path = pi_extension_path("/home/alice");
        assert_eq!(
            path,
            PathBuf::from("/home/alice/.pi/agent/extensions/plan-reviewer-pi.ts")
        );
    }

    // ---------------------------------------------------------------------------
    // Install tests (filesystem)
    // ---------------------------------------------------------------------------

    #[test]
    fn install_creates_dir_and_file() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = PiIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        let result = integration.install(&ctx);
        assert!(result.is_ok(), "install should succeed: {:?}", result);

        let extension_path = dir.path().join(".pi/agent/extensions/plan-reviewer-pi.ts");
        assert!(extension_path.exists(), "extension file should be created");
        assert!(
            extension_path.parent().unwrap().is_dir(),
            "extensions directory should be created"
        );
    }

    #[test]
    fn install_returns_err_when_binary_path_is_none() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = PiIntegration;
        let ctx = InstallContext {
            home,
            binary_path: None,
        };

        let result = integration.install(&ctx);
        assert!(result.is_err(), "install without binary_path should fail");
    }

    #[test]
    fn install_replaces_binary_path_placeholder() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = PiIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();

        let extension_path = dir.path().join(".pi/agent/extensions/plan-reviewer-pi.ts");
        let content = std::fs::read_to_string(&extension_path).unwrap();

        // Placeholder should NOT be present
        assert!(
            !content.contains("__PLAN_REVIEWER_BIN__"),
            "placeholder should be replaced in installed extension file"
        );
        // Actual binary path should be present
        assert!(
            content.contains("/usr/local/bin/plan-reviewer"),
            "actual binary path should be in installed extension file"
        );
    }

    #[test]
    fn install_writes_version_comment() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = PiIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();

        let extension_path = dir.path().join(".pi/agent/extensions/plan-reviewer-pi.ts");
        let content = std::fs::read_to_string(&extension_path).unwrap();

        // Version comment line should be present
        assert!(
            content.contains("// plan-reviewer-version: "),
            "installed extension should contain version comment line"
        );
        // Version placeholder should NOT be present
        assert!(
            !content.contains("__PLAN_REVIEWER_VERSION__"),
            "__PLAN_REVIEWER_VERSION__ placeholder should be replaced in installed extension file"
        );
        // Binary placeholder should NOT be present
        assert!(
            !content.contains("__PLAN_REVIEWER_BIN__"),
            "__PLAN_REVIEWER_BIN__ placeholder should be replaced in installed extension file"
        );
    }

    #[test]
    fn install_is_idempotent() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = PiIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();
        let result = integration.install(&ctx);
        assert!(
            result.is_ok(),
            "second install should succeed: {:?}",
            result
        );

        let extension_path = dir.path().join(".pi/agent/extensions/plan-reviewer-pi.ts");
        assert!(
            extension_path.exists(),
            "extension file should still exist after second install"
        );
    }

    // ---------------------------------------------------------------------------
    // Uninstall tests
    // ---------------------------------------------------------------------------

    #[test]
    fn uninstall_removes_file() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = PiIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        // Install first
        integration.install(&ctx).unwrap();

        let extension_path = dir.path().join(".pi/agent/extensions/plan-reviewer-pi.ts");
        assert!(
            extension_path.exists(),
            "extension file should exist after install"
        );

        // Uninstall
        let ctx_uninstall = InstallContext {
            home: home.clone(),
            binary_path: None,
        };
        let result = integration.uninstall(&ctx_uninstall);
        assert!(result.is_ok(), "uninstall should succeed: {:?}", result);
        assert!(
            !extension_path.exists(),
            "extension file should be removed after uninstall"
        );
    }

    #[test]
    fn uninstall_on_nonexistent_returns_ok() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = PiIntegration;
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

    // ---------------------------------------------------------------------------
    // is_installed tests
    // ---------------------------------------------------------------------------

    #[test]
    fn is_installed_returns_false_when_no_file() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = PiIntegration;
        let ctx = InstallContext {
            home,
            binary_path: None,
        };
        assert!(!integration.is_installed(&ctx));
    }

    #[test]
    fn is_installed_returns_true_after_install() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = PiIntegration;
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

    // ---------------------------------------------------------------------------
    // Source content tests
    // ---------------------------------------------------------------------------

    #[test]
    fn pi_extension_uses_supported_imports_and_modern_pi_api() {
        // Keep the installed shim dependency-light: Pi documents node built-ins
        // and typebox as runtime-available extension imports.
        for line in PI_EXTENSION_SOURCE.lines() {
            if line.trim().starts_with("import") {
                assert!(
                    line.contains("\"node:") || line.contains("\"typebox\""),
                    "Pi extension must only import supported lightweight modules, found: {line}"
                );
            }
        }
        assert!(
            PI_EXTENSION_SOURCE.contains("pi.registerTool({"),
            "Pi extension must use Pi's current registerTool({{ ... }}) API"
        );
        assert!(
            PI_EXTENSION_SOURCE.contains("name: \"plan_reviewer_submit_plan\""),
            "Pi extension must register the plan_reviewer_submit_plan tool name"
        );
        assert!(
            PI_EXTENSION_SOURCE.contains("parameters: Type.Object"),
            "Pi extension must use Pi's current TypeBox parameters field"
        );
        assert!(
            PI_EXTENSION_SOURCE.contains("systemPrompt: `${event.systemPrompt}"),
            "Pi before_agent_start hook must return an object that modifies the system prompt"
        );
        assert!(
            PI_EXTENSION_SOURCE.contains("Before starting implementation work"),
            "Pi plan-review prompt must gate implementation work, not every action"
        );
        assert!(
            PI_EXTENSION_SOURCE
                .contains("Do not call\nplan_reviewer_submit_plan for read-only inspection"),
            "Pi plan-review prompt must exempt read-only inspection"
        );
        assert!(
            PI_EXTENSION_SOURCE.contains("a single explicit user-requested command"),
            "Pi plan-review prompt must exempt single explicit user-requested commands"
        );
        assert!(
            PI_EXTENSION_SOURCE.contains("opening the plan-reviewer\ncode-review UI itself"),
            "Pi plan-review prompt must exempt the code-review UI command"
        );
        assert!(
            !PI_EXTENSION_SOURCE.contains("Before taking any action or running any commands"),
            "Pi plan-review prompt must not require review before every action/command"
        );
        assert!(
            PI_EXTENSION_SOURCE.contains("[\"review\", filePath]"),
            "Pi extension must use file-based plan-reviewer review command"
        );
        assert!(
            !PI_EXTENSION_SOURCE.contains("[\"review-hook\"]"),
            "Pi extension must not call Claude-specific review-hook"
        );
        assert!(
            !PI_EXTENSION_SOURCE.contains("tool_name: \"exit_plan_mode\""),
            "Pi extension must not fabricate Claude hook JSON"
        );
        assert!(
            !PI_EXTENSION_SOURCE.contains("inputSchema"),
            "Pi extension must not use the obsolete inputSchema field"
        );
        assert!(
            PI_EXTENSION_SOURCE.contains("__PLAN_REVIEWER_BIN__"),
            "Pi extension source must contain __PLAN_REVIEWER_BIN__ placeholder"
        );
        assert!(
            PI_EXTENSION_SOURCE.contains("__PLAN_REVIEWER_VERSION__"),
            "Pi extension source must contain __PLAN_REVIEWER_VERSION__ placeholder"
        );
    }

    // ---------------------------------------------------------------------------
    // read_version_comment tests (shared utility via mod.rs)
    // ---------------------------------------------------------------------------

    #[test]
    fn read_version_comment_extracts_version() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.ts");
        std::fs::write(
            &file_path,
            "// plan-reviewer-pi.ts\n// plan-reviewer-version: 1.2.3\n// other comment\n",
        )
        .unwrap();

        let result = super::super::read_version_comment(&file_path);
        assert_eq!(result, Some("1.2.3".to_string()));
    }

    #[test]
    fn read_version_comment_returns_none_without_comment() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.ts");
        std::fs::write(&file_path, "// no version here\nconst x = 1;\n").unwrap();

        let result = super::super::read_version_comment(&file_path);
        assert_eq!(result, None);
    }

    #[test]
    fn read_version_comment_returns_none_for_missing_file() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("nonexistent.ts");

        let result = super::super::read_version_comment(&file_path);
        assert_eq!(result, None);
    }
}
