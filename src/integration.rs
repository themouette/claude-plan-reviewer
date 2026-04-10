use std::fmt;
use std::path::PathBuf;

/// Slug identifying a supported (or planned) coding-agent integration.
///
/// Used as CLI argument values and internal keys throughout install/uninstall.
#[derive(Debug, Clone, PartialEq)]
pub enum IntegrationSlug {
    Claude,
    Opencode,
    Codestral,
}

impl IntegrationSlug {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Claude => "claude",
            Self::Opencode => "opencode",
            Self::Codestral => "codestral",
        }
    }

    /// Case-insensitive parse from a string slice. Returns `None` for unknown slugs.
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "claude" => Some(Self::Claude),
            "opencode" => Some(Self::Opencode),
            "codestral" => Some(Self::Codestral),
            _ => None,
        }
    }

    /// All known integration slugs in display order.
    pub fn all() -> &'static [IntegrationSlug] {
        &[Self::Claude, Self::Opencode, Self::Codestral]
    }
}

impl fmt::Display for IntegrationSlug {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Metadata and status for a single coding-agent integration.
pub struct Integration {
    pub slug: IntegrationSlug,
    /// Human-readable name shown in TUI prompts and output messages.
    pub display_name: &'static str,
    /// `false` for integrations that lack a plan-approval hook in their config format.
    /// The install/uninstall commands will print `unsupported_reason` and exit early.
    pub supported: bool,
    /// Explains why the integration is not yet supported. `None` when `supported` is `true`.
    pub unsupported_reason: Option<&'static str>,
}

/// Return the definition for a given slug.
pub fn get_integration(slug: &IntegrationSlug) -> Integration {
    match slug {
        IntegrationSlug::Claude => Integration {
            slug: IntegrationSlug::Claude,
            display_name: "Claude Code",
            supported: true,
            unsupported_reason: None,
        },
        IntegrationSlug::Opencode => Integration {
            slug: IntegrationSlug::Opencode,
            display_name: "OpenCode",
            supported: false,
            unsupported_reason: Some(
                "OpenCode does not have a plan approval hook in its config format. \
                 See https://opencode.ai/docs/config/",
            ),
        },
        IntegrationSlug::Codestral => Integration {
            slug: IntegrationSlug::Codestral,
            display_name: "Codestral",
            supported: false,
            unsupported_reason: Some(
                "Codestral is a model, not a coding agent with hook infrastructure. \
                 No settings file to configure.",
            ),
        },
    }
}

/// Return definitions for all known integrations, in display order.
pub fn all_integrations() -> Vec<Integration> {
    IntegrationSlug::all()
        .iter()
        .map(get_integration)
        .collect()
}

// ---------------------------------------------------------------------------
// Claude Code — helper functions (extracted from install.rs logic)
// ---------------------------------------------------------------------------

/// Returns the path to Claude Code's settings file: `{home}/.claude/settings.json`.
///
/// The `home` argument is the value of the `HOME` environment variable — the only
/// external input that touches the filesystem path (T-04-02 mitigation: no user-supplied
/// path fragments are accepted).
pub fn claude_settings_path(home: &str) -> PathBuf {
    PathBuf::from(home).join(".claude/settings.json")
}

/// Returns the JSON hook entry to insert into `root["hooks"]["PermissionRequest"]`.
///
/// ```json
/// {"matcher":"ExitPlanMode","hooks":[{"type":"command","command":"<binary_path>"}]}
/// ```
pub fn claude_hook_entry(binary_path: &str) -> serde_json::Value {
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
pub fn claude_is_installed(settings: &serde_json::Value) -> bool {
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
    fn slug_round_trip() {
        assert_eq!(IntegrationSlug::from_str("claude"), Some(IntegrationSlug::Claude));
        assert_eq!(IntegrationSlug::from_str("CLAUDE"), Some(IntegrationSlug::Claude));
        assert_eq!(IntegrationSlug::from_str("opencode"), Some(IntegrationSlug::Opencode));
        assert_eq!(IntegrationSlug::from_str("codestral"), Some(IntegrationSlug::Codestral));
        assert_eq!(IntegrationSlug::from_str("unknown"), None);
    }

    #[test]
    fn slug_display() {
        assert_eq!(IntegrationSlug::Claude.to_string(), "claude");
        assert_eq!(IntegrationSlug::Opencode.to_string(), "opencode");
        assert_eq!(IntegrationSlug::Codestral.to_string(), "codestral");
    }

    #[test]
    fn all_slugs_have_definitions() {
        for slug in IntegrationSlug::all() {
            let integration = get_integration(slug);
            assert_eq!(&integration.slug, slug);
            if !integration.supported {
                assert!(
                    integration.unsupported_reason.is_some(),
                    "unsupported integration {} must have a reason",
                    slug
                );
            }
        }
    }

    #[test]
    fn claude_is_supported() {
        let integration = get_integration(&IntegrationSlug::Claude);
        assert!(integration.supported);
        assert!(integration.unsupported_reason.is_none());
    }

    #[test]
    fn opencode_and_codestral_unsupported() {
        let opencode = get_integration(&IntegrationSlug::Opencode);
        assert!(!opencode.supported);
        let reason = opencode.unsupported_reason.unwrap();
        assert!(reason.contains("plan approval hook"), "reason: {}", reason);

        let codestral = get_integration(&IntegrationSlug::Codestral);
        assert!(!codestral.supported);
        let reason = codestral.unsupported_reason.unwrap();
        assert!(reason.contains("model, not a coding agent"), "reason: {}", reason);
    }

    #[test]
    fn claude_settings_path_test() {
        let path = claude_settings_path("/home/alice");
        assert_eq!(path, std::path::PathBuf::from("/home/alice/.claude/settings.json"));
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

    #[test]
    fn all_integrations_returns_all_three() {
        let all = all_integrations();
        assert_eq!(all.len(), 3);
    }
}
