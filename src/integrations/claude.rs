use super::{InstallContext, Integration};
use std::path::PathBuf;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MARKETPLACE_NAME: &str = "plan-reviewer-local";
const PLUGIN_KEY: &str = "plan-reviewer@plan-reviewer-local";

// ---------------------------------------------------------------------------
// ClaudeIntegration
// ---------------------------------------------------------------------------

/// Full install/uninstall implementation for Claude Code.
///
/// Uses the Claude Code plugin directory model. Hook config lives in files
/// plan-reviewer owns (~/.local/share/plan-reviewer/claude-plugin/), enabling
/// version-aware rewrites by `update`. The old bare PermissionRequest entry
/// (if present from a previous install) is left in place for Phase 07.3 migration.
pub struct ClaudeIntegration;

impl Integration for ClaudeIntegration {
    /// Install the Claude Code plugin directory and register it in settings.json.
    ///
    /// Writes:
    ///   {home}/.local/share/plan-reviewer/claude-plugin/.claude-plugin/plugin.json
    ///   {home}/.local/share/plan-reviewer/claude-plugin/.claude-plugin/marketplace.json
    ///   {home}/.local/share/plan-reviewer/claude-plugin/hooks/hooks.json
    ///   {home}/.local/share/plan-reviewer/claude-plugin/commands/annotate.md
    ///
    /// Adds to ~/.claude/settings.json:
    ///   extraKnownMarketplaces["plan-reviewer-local"] (directory source)
    ///   enabledPlugins["plan-reviewer@plan-reviewer-local"] = true
    ///
    /// Idempotent: plugin files are always (re)written on every install.
    /// Only the settings.json mutations (extraKnownMarketplaces and enabledPlugins)
    /// are skipped if enabledPlugins[PLUGIN_KEY] already exists.
    fn install(&self, ctx: &InstallContext) -> Result<(), String> {
        let plugin_dir = claude_plugin_dir(&ctx.home);
        let settings_path = claude_settings_path(&ctx.home);

        // ------------------------------------------------------------------
        // Step 1: Write plugin directory files
        // ------------------------------------------------------------------

        // Write .claude-plugin/plugin.json
        let manifest_dir = plugin_dir.join(".claude-plugin");
        if let Err(e) = std::fs::create_dir_all(&manifest_dir) {
            return Err(format!("cannot create {}: {}", manifest_dir.display(), e));
        }
        let plugin_json = serde_json::json!({
            "name": "plan-reviewer",
            "version": crate_version(),
            "description": "Plan review hook for Claude Code"
        });
        let plugin_json_str = match serde_json::to_string_pretty(&plugin_json) {
            Ok(s) => s,
            Err(e) => return Err(format!("cannot serialize plugin.json: {}", e)),
        };
        let plugin_json_path = manifest_dir.join("plugin.json");
        if let Err(e) = std::fs::write(&plugin_json_path, &plugin_json_str) {
            return Err(format!(
                "cannot write {}: {}",
                plugin_json_path.display(),
                e
            ));
        }
        println!(
            "plan-reviewer: plugin manifest written to {}",
            plugin_json_path.display()
        );

        // Write .claude-plugin/marketplace.json
        let marketplace_json = serde_json::json!({
            "name": MARKETPLACE_NAME,
            "owner": {
                "name": "plan-reviewer authors"
            },
            "plugins": [
                {
                    "name": "plan-reviewer",
                    "source": "./",
                    "description": "Plan review hook for Claude Code"
                }
            ]
        });
        let marketplace_json_str = match serde_json::to_string_pretty(&marketplace_json) {
            Ok(s) => s,
            Err(e) => return Err(format!("cannot serialize marketplace.json: {}", e)),
        };
        let marketplace_json_path = manifest_dir.join("marketplace.json");
        if let Err(e) = std::fs::write(&marketplace_json_path, &marketplace_json_str) {
            return Err(format!(
                "cannot write {}: {}",
                marketplace_json_path.display(),
                e
            ));
        }
        println!(
            "plan-reviewer: marketplace manifest written to {}",
            marketplace_json_path.display()
        );

        // Write hooks/hooks.json
        let hooks_dir = plugin_dir.join("hooks");
        if let Err(e) = std::fs::create_dir_all(&hooks_dir) {
            return Err(format!("cannot create {}: {}", hooks_dir.display(), e));
        }
        let hooks_json = serde_json::json!({
            "hooks": {
                "PermissionRequest": [
                    {
                        "matcher": "ExitPlanMode",
                        "hooks": [{"type": "command", "command": "plan-reviewer review-hook"}]
                    }
                ]
            }
        });
        let hooks_json_str = match serde_json::to_string_pretty(&hooks_json) {
            Ok(s) => s,
            Err(e) => return Err(format!("cannot serialize hooks.json: {}", e)),
        };
        let hooks_json_path = hooks_dir.join("hooks.json");
        if let Err(e) = std::fs::write(&hooks_json_path, &hooks_json_str) {
            return Err(format!("cannot write {}: {}", hooks_json_path.display(), e));
        }
        println!(
            "plan-reviewer: hooks file written to {}",
            hooks_json_path.display()
        );

        // Write commands/annotate.md
        let commands_dir = plugin_dir.join("commands");
        if let Err(e) = std::fs::create_dir_all(&commands_dir) {
            return Err(format!("cannot create {}: {}", commands_dir.display(), e));
        }
        let annotate_content = concat!(
            "---\n",
            "description: Open a file in the plan-reviewer browser UI for feedback\n",
            "argument-hint: [path/to/file.md]\n",
            "allowed-tools: Bash\n",
            "---\n",
            "\n",
            "# /plan-reviewer:annotate\n",
            "\n",
            "Open a markdown file in the plan-reviewer browser UI. The user reviews\n",
            "the content and either approves (no comments) or denies (with feedback).\n",
            "Treat the result as feedback collection, not an approval gate.\n",
            "\n",
            "## Step 1 — Resolve the target file\n",
            "\n",
            "Determine which file to review using these rules in order:\n",
            "\n",
            "**Rule A — Explicit argument (highest priority):**\n",
            "If `$ARGUMENTS` is non-empty, use it as the file path. No further resolution needed.\n",
            "\n",
            "**Rule B — Last .md file from conversation history:**\n",
            "If `$ARGUMENTS` is empty, scan the current conversation history for the most\n",
            "recent Write or Edit tool call that references a path ending in `.md`. Use that path.\n",
            "\n",
            "**Rule C — Temp file fallback:**\n",
            "If no `.md` path is found in conversation history, write your last full response\n",
            "to a temporary file:\n",
            "```\n",
            "mktemp /tmp/plan-reviewer-XXXXXX.md\n",
            "```\n",
            "Write the last response content to that file, then use that path.\n",
            "Tell the user: \"No recent .md file found — writing last response to temp file: <path>\"\n",
            "\n",
            "## Step 2 — Inform the user\n",
            "\n",
            "Before launching the browser, say:\n",
            "\n",
            "> I'll open **<resolved-file>** in the review UI.\n",
            "> Use **Deny** to leave feedback with comments, **Approve** if you're satisfied.\n",
            "\n",
            "## Step 3 — Launch the review\n",
            "\n",
            "Run the following via the Bash tool with `run_in_background: true`:\n",
            "\n",
            "```bash\n",
            "plan-reviewer review <resolved-file>\n",
            "```\n",
            "\n",
            "The process opens a local browser tab. It exits when the user clicks Approve or Deny.\n",
            "The result is written to stdout as JSON.\n",
            "\n",
            "## Step 4 — Handle the result\n",
            "\n",
            "Parse the JSON output from stdout:\n",
            "\n",
            "**On `{\"behavior\":\"allow\"}`:**\n",
            "Say: \"Review complete, no comments.\" Then proceed with your next step.\n",
            "\n",
            "**On `{\"behavior\":\"deny\",\"message\":\"<feedback>\"}`:**\n",
            "Say: \"Feedback received: <feedback>\" Then treat the message as revision\n",
            "instructions for the reviewed content and propose how you will address it.\n",
        );
        let annotate_path = commands_dir.join("annotate.md");
        if let Err(e) = std::fs::write(&annotate_path, annotate_content) {
            return Err(format!("cannot write {}: {}", annotate_path.display(), e));
        }
        println!(
            "plan-reviewer: annotate command written to {}",
            annotate_path.display()
        );

        // ------------------------------------------------------------------
        // Step 2: Read or create ~/.claude/settings.json
        // ------------------------------------------------------------------

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

        // ------------------------------------------------------------------
        // Step 3: Idempotency check
        // ------------------------------------------------------------------

        if plugin_is_registered(&root) {
            println!(
                "plan-reviewer: settings already configured in {} (no settings changes made)",
                settings_path.display()
            );
            return Ok(());
        }

        // ------------------------------------------------------------------
        // Step 4: Add extraKnownMarketplaces entry
        // ------------------------------------------------------------------

        {
            let root_obj = root
                .as_object_mut()
                .expect("root is always an object at this point");
            root_obj
                .entry("extraKnownMarketplaces")
                .or_insert_with(|| serde_json::json!({}));
        }

        {
            let plugin_dir_str = plugin_dir.to_string_lossy().to_string();
            root["extraKnownMarketplaces"]
                .as_object_mut()
                .expect("extraKnownMarketplaces is an object")
                .entry(MARKETPLACE_NAME)
                .or_insert_with(|| {
                    serde_json::json!({
                        "source": {
                            "source": "directory",
                            "path": plugin_dir_str
                        }
                    })
                });
        }

        // ------------------------------------------------------------------
        // Step 5: Add enabledPlugins entry
        // ------------------------------------------------------------------

        {
            let root_obj = root
                .as_object_mut()
                .expect("root is always an object at this point");
            root_obj
                .entry("enabledPlugins")
                .or_insert_with(|| serde_json::json!({}));
        }

        root["enabledPlugins"]
            .as_object_mut()
            .expect("enabledPlugins is an object")
            .entry(PLUGIN_KEY)
            .or_insert(serde_json::Value::Bool(true));

        // ------------------------------------------------------------------
        // Step 6: Write settings.json back
        // ------------------------------------------------------------------

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
            "plan-reviewer: plugin registered in {}",
            settings_path.display()
        );
        println!(
            "plan-reviewer: marketplace '{}' and plugin '{}' entries added",
            MARKETPLACE_NAME, PLUGIN_KEY
        );
        Ok(())
    }

    /// Remove the Claude Code plugin directory and both settings.json registration entries.
    ///
    /// Does NOT touch the old-style hooks.PermissionRequest entries (Phase 07.3 handles that).
    /// Idempotent: safe to run when nothing is installed.
    fn uninstall(&self, ctx: &InstallContext) -> Result<(), String> {
        let plugin_dir = claude_plugin_dir(&ctx.home);
        let settings_path = claude_settings_path(&ctx.home);

        // ------------------------------------------------------------------
        // Step 1: Remove plugin directory
        // ------------------------------------------------------------------

        if plugin_dir.exists() {
            if let Err(e) = std::fs::remove_dir_all(&plugin_dir) {
                return Err(format!("cannot remove {}: {}", plugin_dir.display(), e));
            }
            println!(
                "plan-reviewer: plugin directory removed: {}",
                plugin_dir.display()
            );
        } else {
            println!(
                "plan-reviewer: plugin directory not found at {} (skipping)",
                plugin_dir.display()
            );
        }

        // ------------------------------------------------------------------
        // Step 2: Read settings.json (nothing to do if missing)
        // ------------------------------------------------------------------

        if !settings_path.exists() {
            println!(
                "plan-reviewer: no settings file found at {} (nothing to uninstall)",
                settings_path.display()
            );
            return Ok(());
        }

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
                    "plan-reviewer uninstall: warning: {} contains invalid JSON: {} \
                     (no changes made to settings — remove stale entries manually if needed)",
                    settings_path.display(),
                    e
                );
                return Ok(());
            }
        };

        // ------------------------------------------------------------------
        // Step 3: Remove extraKnownMarketplaces["plan-reviewer-local"]
        // ------------------------------------------------------------------

        root["extraKnownMarketplaces"]
            .as_object_mut()
            .map(|obj| obj.remove(MARKETPLACE_NAME));

        // ------------------------------------------------------------------
        // Step 4: Remove enabledPlugins["plan-reviewer@plan-reviewer-local"]
        // ------------------------------------------------------------------

        root["enabledPlugins"]
            .as_object_mut()
            .map(|obj| obj.remove(PLUGIN_KEY));

        // ------------------------------------------------------------------
        // Step 5: Write settings.json back
        // NOTE: Old-style hooks.PermissionRequest entries are NOT touched.
        //       Phase 07.3 handles migration of the old bare hook entry.
        // ------------------------------------------------------------------

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
            "plan-reviewer: plugin registration removed from {}",
            settings_path.display()
        );
        Ok(())
    }

    /// Returns `true` if the Claude Code plugin is registered via the plugin directory model.
    ///
    /// Checks whether `enabledPlugins["plan-reviewer@plan-reviewer-local"]` exists
    /// in settings.json. This is the new idempotency key (replaces the old ExitPlanMode
    /// matcher check).
    fn is_installed(&self, ctx: &InstallContext) -> bool {
        let settings_path = claude_settings_path(&ctx.home);
        if !settings_path.exists() {
            return false;
        }
        match std::fs::read_to_string(&settings_path) {
            Ok(content) => match serde_json::from_str::<serde_json::Value>(&content) {
                Ok(json) => plugin_is_registered(&json),
                Err(_) => false,
            },
            Err(_) => false,
        }
    }
}

// ---------------------------------------------------------------------------
// Helper functions (private to this module)
// ---------------------------------------------------------------------------

/// Returns the path to the plugin directory: `{home}/.local/share/plan-reviewer/claude-plugin`.
///
/// The `home` argument is the value of the `HOME` environment variable — the only
/// external input that touches the filesystem path (T-07.2-03 mitigation: no user-supplied
/// path fragments are accepted).
///
/// pub(crate) — used by update.rs for version-aware manifest reading.
pub(crate) fn claude_plugin_dir(home: &str) -> PathBuf {
    PathBuf::from(home).join(".local/share/plan-reviewer/claude-plugin")
}

/// Returns the path to Claude Code's settings file: `{home}/.claude/settings.json`.
fn claude_settings_path(home: &str) -> PathBuf {
    PathBuf::from(home).join(".claude/settings.json")
}

/// Returns `true` if the plugin directory model is registered in `settings`.
///
/// Checks for `enabledPlugins["plan-reviewer@plan-reviewer-local"]` — this is the
/// new idempotency key for the plugin directory model. The marketplace entry alone
/// is not sufficient because enabledPlugins is required for the plugin to load.
fn plugin_is_registered(settings: &serde_json::Value) -> bool {
    settings["enabledPlugins"]
        .as_object()
        .map(|obj| obj.contains_key(PLUGIN_KEY))
        .unwrap_or(false)
}

/// Returns `true` if the legacy ExitPlanMode hook entry is present in `settings`.
///
/// This checks for the old-style bare hook entry written by previous plan-reviewer
/// versions. Used by Phase 07.3 migration logic to detect and clean up old installs.
///
/// Kept for Phase 07.3 migration use. Do NOT use as the idempotency key for new installs.
pub(crate) fn claude_legacy_hook_installed(settings: &serde_json::Value) -> bool {
    settings["hooks"]["PermissionRequest"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .any(|entry| entry["matcher"].as_str() == Some("ExitPlanMode"))
        })
        .unwrap_or(false)
}

/// Returns the current crate version string, embedded at compile time.
fn crate_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    // ---------------------------------------------------------------------------
    // Helper function tests
    // ---------------------------------------------------------------------------

    #[test]
    fn claude_settings_path_test() {
        let path = claude_settings_path("/home/alice");
        assert_eq!(
            path,
            std::path::PathBuf::from("/home/alice/.claude/settings.json")
        );
    }

    #[test]
    fn claude_plugin_dir_test() {
        let path = claude_plugin_dir("/home/alice");
        assert_eq!(
            path,
            std::path::PathBuf::from("/home/alice/.local/share/plan-reviewer/claude-plugin")
        );
    }

    #[test]
    fn plugin_is_registered_detects_enabled_plugins_key() {
        let settings_with_plugin = serde_json::json!({
            "enabledPlugins": {
                "plan-reviewer@plan-reviewer-local": true
            }
        });
        assert!(plugin_is_registered(&settings_with_plugin));

        let settings_empty = serde_json::json!({});
        assert!(!plugin_is_registered(&settings_empty));

        let settings_empty_plugins = serde_json::json!({
            "enabledPlugins": {}
        });
        assert!(!plugin_is_registered(&settings_empty_plugins));
    }

    #[test]
    fn claude_legacy_hook_installed_detects_old_style_hook() {
        let settings_with_hook = serde_json::json!({
            "hooks": {
                "PermissionRequest": [
                    {"matcher": "ExitPlanMode", "hooks": [{"type": "command", "command": "/bin/plan-reviewer"}]}
                ]
            }
        });
        assert!(claude_legacy_hook_installed(&settings_with_hook));

        let settings_empty = serde_json::json!({});
        assert!(!claude_legacy_hook_installed(&settings_empty));
    }

    #[test]
    fn crate_version_is_non_empty() {
        assert!(!crate_version().is_empty());
    }

    // ---------------------------------------------------------------------------
    // Install tests (filesystem)
    // ---------------------------------------------------------------------------

    #[test]
    fn install_creates_plugin_json_with_required_keys() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = ClaudeIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        let result = integration.install(&ctx);
        assert!(result.is_ok(), "install should succeed: {:?}", result);

        let plugin_json_path = dir
            .path()
            .join(".local/share/plan-reviewer/claude-plugin/.claude-plugin/plugin.json");
        assert!(plugin_json_path.exists(), "plugin.json should be created");

        let content = std::fs::read_to_string(&plugin_json_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();

        assert!(
            json["name"].as_str().is_some(),
            "plugin.json must have 'name'"
        );
        assert!(
            json["version"].as_str().is_some(),
            "plugin.json must have 'version'"
        );
        assert!(
            json["description"].as_str().is_some(),
            "plugin.json must have 'description'"
        );
    }

    #[test]
    fn install_plugin_json_version_matches_crate_version() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = ClaudeIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();

        let plugin_json_path = dir
            .path()
            .join(".local/share/plan-reviewer/claude-plugin/.claude-plugin/plugin.json");
        let content = std::fs::read_to_string(&plugin_json_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();

        assert_eq!(
            json["version"].as_str(),
            Some(crate_version()),
            "plugin.json version should match crate version"
        );
    }

    #[test]
    fn install_creates_hooks_json_with_exit_plan_mode() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = ClaudeIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();

        let hooks_json_path = dir
            .path()
            .join(".local/share/plan-reviewer/claude-plugin/hooks/hooks.json");
        assert!(hooks_json_path.exists(), "hooks.json should be created");

        let content = std::fs::read_to_string(&hooks_json_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();

        let permission_requests = json["hooks"]["PermissionRequest"].as_array().unwrap();
        assert!(
            permission_requests.iter().any(|entry| {
                entry["matcher"].as_str() == Some("ExitPlanMode")
                    && entry["hooks"][0]["command"].as_str() == Some("plan-reviewer review-hook")
            }),
            "hooks.json must contain ExitPlanMode hook with 'plan-reviewer review-hook' command"
        );
    }

    #[test]
    fn install_writes_hook_command_with_hook_subcommand() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = ClaudeIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();

        let hooks_path = claude_plugin_dir(&home).join("hooks/hooks.json");
        let content = std::fs::read_to_string(&hooks_path).unwrap();
        assert!(
            content.contains("plan-reviewer review-hook"),
            "hooks.json command should be 'plan-reviewer review-hook', got: {}",
            content
        );
    }

    #[test]
    fn install_creates_marketplace_json_with_plugin_entry() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = ClaudeIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();

        let marketplace_json_path = dir
            .path()
            .join(".local/share/plan-reviewer/claude-plugin/.claude-plugin/marketplace.json");
        assert!(
            marketplace_json_path.exists(),
            "marketplace.json should be created"
        );

        let content = std::fs::read_to_string(&marketplace_json_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();

        assert_eq!(
            json["name"].as_str(),
            Some(MARKETPLACE_NAME),
            "marketplace name must match MARKETPLACE_NAME"
        );

        let plugins = json["plugins"].as_array().unwrap();
        assert_eq!(
            plugins.len(),
            1,
            "marketplace should list exactly one plugin"
        );

        let plugin = &plugins[0];
        assert_eq!(
            plugin["name"].as_str(),
            Some("plan-reviewer"),
            "plugin name must be 'plan-reviewer'"
        );
        assert_eq!(
            plugin["source"].as_str(),
            Some("./"),
            "plugin source must be './' (relative to marketplace root)"
        );
    }

    #[test]
    fn install_adds_extra_known_marketplaces_to_settings() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = ClaudeIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();

        let settings_path = dir.path().join(".claude/settings.json");
        let content = std::fs::read_to_string(&settings_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();

        let marketplace = &json["extraKnownMarketplaces"][MARKETPLACE_NAME];
        assert!(
            !marketplace.is_null(),
            "extraKnownMarketplaces['plan-reviewer-local'] should exist"
        );
        assert_eq!(
            marketplace["source"]["source"].as_str(),
            Some("directory"),
            "source type must be 'directory'"
        );
        let expected_plugin_dir = dir
            .path()
            .join(".local/share/plan-reviewer/claude-plugin")
            .to_string_lossy()
            .to_string();
        assert_eq!(
            marketplace["source"]["path"].as_str(),
            Some(expected_plugin_dir.as_str()),
            "source path must point to plugin directory"
        );
    }

    #[test]
    fn install_adds_enabled_plugins_to_settings() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = ClaudeIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();

        let settings_path = dir.path().join(".claude/settings.json");
        let content = std::fs::read_to_string(&settings_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();

        assert_eq!(
            json["enabledPlugins"][PLUGIN_KEY].as_bool(),
            Some(true),
            "enabledPlugins['plan-reviewer@plan-reviewer-local'] should be true"
        );
    }

    #[test]
    fn install_is_idempotent() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = ClaudeIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();
        integration.install(&ctx).unwrap();

        let settings_path = dir.path().join(".claude/settings.json");
        let content = std::fs::read_to_string(&settings_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();

        // Check no duplicate entries in enabledPlugins
        let enabled_plugins = json["enabledPlugins"].as_object().unwrap();
        let count = enabled_plugins
            .iter()
            .filter(|(k, _)| k.as_str() == PLUGIN_KEY)
            .count();
        assert_eq!(
            count, 1,
            "should have exactly one enabledPlugins entry after two installs"
        );

        // Check no duplicate entries in extraKnownMarketplaces
        let marketplaces = json["extraKnownMarketplaces"].as_object().unwrap();
        let count = marketplaces
            .iter()
            .filter(|(k, _)| k.as_str() == MARKETPLACE_NAME)
            .count();
        assert_eq!(
            count, 1,
            "should have exactly one extraKnownMarketplaces entry after two installs"
        );

        // commands/annotate.md should exist after idempotent install (file writes are unconditional)
        let annotate_path = dir
            .path()
            .join(".local/share/plan-reviewer/claude-plugin/commands/annotate.md");
        assert!(
            annotate_path.exists(),
            "commands/annotate.md should exist after idempotent install"
        );
    }

    #[test]
    fn install_creates_annotate_md_with_expected_content() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = ClaudeIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();

        let annotate_path = dir
            .path()
            .join(".local/share/plan-reviewer/claude-plugin/commands/annotate.md");
        assert!(
            annotate_path.exists(),
            "commands/annotate.md should be created by install"
        );

        let content = std::fs::read_to_string(&annotate_path).unwrap();

        // Frontmatter
        assert!(
            content.contains("description:"),
            "annotate.md should contain frontmatter description field"
        );
        assert!(
            content.contains("allowed-tools: Bash"),
            "annotate.md should declare allowed-tools: Bash"
        );

        // Heading (per CONTEXT.md D-09: namespaced command name)
        assert!(
            content.contains("# /plan-reviewer:annotate"),
            "annotate.md heading must be '# /plan-reviewer:annotate' (plugin-namespaced)"
        );

        // Argument substitution variable
        assert!(
            content.contains("$ARGUMENTS"),
            "annotate.md must contain $ARGUMENTS substitution variable"
        );

        // File resolution logic
        assert!(
            content.contains("plan-reviewer review"),
            "annotate.md must contain 'plan-reviewer review' execution command"
        );
        assert!(
            content.contains("run_in_background"),
            "annotate.md must instruct Bash tool to use run_in_background: true"
        );

        // Result handling
        assert!(
            content.contains("allow"),
            "annotate.md must describe handling of allow result"
        );
        assert!(
            content.contains("deny"),
            "annotate.md must describe handling of deny result"
        );
        assert!(
            content.contains("Feedback received"),
            "annotate.md must use 'Feedback received' phrasing for deny result (per CONTEXT.md D-06)"
        );
        assert!(
            content.contains("Review complete"),
            "annotate.md must use 'Review complete' phrasing for allow result (per CONTEXT.md D-05)"
        );
    }

    #[test]
    fn install_creates_annotate_md_even_when_already_installed() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = ClaudeIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        // First install
        integration.install(&ctx).unwrap();

        // Manually delete the commands directory to simulate upgrading an existing install
        let commands_dir = dir
            .path()
            .join(".local/share/plan-reviewer/claude-plugin/commands");
        std::fs::remove_dir_all(&commands_dir).unwrap();
        assert!(
            !commands_dir.exists(),
            "commands dir removed for test setup"
        );

        // Second install — must recreate commands/annotate.md even though plugin_is_registered() returns true
        integration.install(&ctx).unwrap();

        let annotate_path = commands_dir.join("annotate.md");
        assert!(
            annotate_path.exists(),
            "commands/annotate.md should be recreated on re-install (D-01)"
        );
    }

    #[test]
    fn install_preserves_existing_settings_keys() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();

        // Create settings.json with existing key
        let claude_dir = dir.path().join(".claude");
        std::fs::create_dir_all(&claude_dir).unwrap();
        let settings_path = claude_dir.join("settings.json");
        std::fs::write(&settings_path, r#"{"theme": "dark"}"#).unwrap();

        let integration = ClaudeIntegration;
        let ctx = InstallContext {
            home,
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();

        let content = std::fs::read_to_string(&settings_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();

        assert_eq!(
            json["theme"].as_str(),
            Some("dark"),
            "existing 'theme' key should be preserved"
        );
    }

    #[test]
    fn install_returns_err_when_binary_path_is_none() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = ClaudeIntegration;
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
    fn uninstall_removes_plugin_directory() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = ClaudeIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();

        let plugin_dir = dir.path().join(".local/share/plan-reviewer/claude-plugin");
        assert!(plugin_dir.exists(), "plugin dir should exist after install");

        let ctx_uninstall = InstallContext {
            home: home.clone(),
            binary_path: None,
        };
        let result = integration.uninstall(&ctx_uninstall);
        assert!(result.is_ok(), "uninstall should succeed: {:?}", result);
        assert!(
            !plugin_dir.exists(),
            "plugin dir should be removed after uninstall"
        );
    }

    #[test]
    fn uninstall_removes_both_settings_entries() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = ClaudeIntegration;
        let ctx = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };

        integration.install(&ctx).unwrap();

        let ctx_uninstall = InstallContext {
            home: home.clone(),
            binary_path: None,
        };
        integration.uninstall(&ctx_uninstall).unwrap();

        let settings_path = dir.path().join(".claude/settings.json");
        let content = std::fs::read_to_string(&settings_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();

        assert!(
            json["extraKnownMarketplaces"][MARKETPLACE_NAME].is_null(),
            "extraKnownMarketplaces entry should be removed"
        );
        assert!(
            json["enabledPlugins"][PLUGIN_KEY].is_null(),
            "enabledPlugins entry should be removed"
        );
    }

    #[test]
    fn uninstall_does_not_touch_old_style_hook_entry() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();

        // Create settings with old-style hook entry
        let claude_dir = dir.path().join(".claude");
        std::fs::create_dir_all(&claude_dir).unwrap();
        let settings_path = claude_dir.join("settings.json");
        let initial = serde_json::json!({
            "hooks": {
                "PermissionRequest": [
                    {"matcher": "ExitPlanMode", "hooks": [{"type": "command", "command": "/usr/local/bin/plan-reviewer"}]}
                ]
            },
            "enabledPlugins": {
                "plan-reviewer@plan-reviewer-local": true
            },
            "extraKnownMarketplaces": {
                "plan-reviewer-local": {
                    "source": {"source": "directory", "path": "/some/path"}
                }
            }
        });
        std::fs::write(
            &settings_path,
            serde_json::to_string_pretty(&initial).unwrap(),
        )
        .unwrap();

        let integration = ClaudeIntegration;
        let ctx = InstallContext {
            home,
            binary_path: None,
        };

        integration.uninstall(&ctx).unwrap();

        let content = std::fs::read_to_string(&settings_path).unwrap();
        let json: serde_json::Value = serde_json::from_str(&content).unwrap();

        // Old-style hook entry should still be present (Phase 07.3 handles migration)
        assert!(
            claude_legacy_hook_installed(&json),
            "old-style ExitPlanMode hook should NOT be touched by uninstall"
        );
    }

    #[test]
    fn uninstall_on_nonexistent_files_returns_ok() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = ClaudeIntegration;
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

    // ---------------------------------------------------------------------------
    // is_installed tests
    // ---------------------------------------------------------------------------

    #[test]
    fn is_installed_returns_false_when_no_files() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = ClaudeIntegration;
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
        let integration = ClaudeIntegration;
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
    fn is_installed_returns_false_after_uninstall() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();
        let integration = ClaudeIntegration;
        let ctx_install = InstallContext {
            home: home.clone(),
            binary_path: Some("/usr/local/bin/plan-reviewer".to_string()),
        };
        let ctx_check = InstallContext {
            home: home.clone(),
            binary_path: None,
        };

        integration.install(&ctx_install).unwrap();
        assert!(integration.is_installed(&ctx_check));

        integration.uninstall(&ctx_check).unwrap();
        assert!(!integration.is_installed(&ctx_check));
    }

    #[test]
    fn is_installed_checks_enabled_plugins_key_not_legacy_hook() {
        let dir = tempdir().unwrap();
        let home = dir.path().to_str().unwrap().to_string();

        // Create settings with old-style hook only (no enabledPlugins)
        let claude_dir = dir.path().join(".claude");
        std::fs::create_dir_all(&claude_dir).unwrap();
        let settings_path = claude_dir.join("settings.json");
        let initial = serde_json::json!({
            "hooks": {
                "PermissionRequest": [
                    {"matcher": "ExitPlanMode", "hooks": [{"type": "command", "command": "/bin/plan-reviewer"}]}
                ]
            }
        });
        std::fs::write(
            &settings_path,
            serde_json::to_string_pretty(&initial).unwrap(),
        )
        .unwrap();

        let integration = ClaudeIntegration;
        let ctx = InstallContext {
            home,
            binary_path: None,
        };

        // is_installed should return false: only legacy hook present, not plugin registration
        assert!(
            !integration.is_installed(&ctx),
            "is_installed should return false when only legacy hook is present"
        );
    }
}
