pub mod claude;
pub mod gemini;
pub mod opencode;

use std::fmt;
use std::io::IsTerminal;

// ---------------------------------------------------------------------------
// InstallContext
// ---------------------------------------------------------------------------

/// Context passed to every integration's install/uninstall/is_installed methods.
///
/// Carries the two pieces of information needed by most integrations. Additional
/// fields can be added here in future phases without changing the trait signature.
pub struct InstallContext {
    pub home: String,
    pub binary_path: String,
}

// ---------------------------------------------------------------------------
// Integration trait
// ---------------------------------------------------------------------------

/// Trait implemented by every coding-agent integration.
///
/// Each integration is responsible for its own install/uninstall idempotency.
/// Stubs (Gemini, Opencode) return `Err` from `install`/`uninstall` until the
/// real implementation is added in a future phase.
pub trait Integration {
    fn install(&self, ctx: &InstallContext) -> Result<(), String>;
    fn uninstall(&self, ctx: &InstallContext) -> Result<(), String>;
    fn is_installed(&self, ctx: &InstallContext) -> bool;
}

// ---------------------------------------------------------------------------
// IntegrationSlug
// ---------------------------------------------------------------------------

/// Slug identifying a supported (or planned) coding-agent integration.
///
/// Used as CLI argument values and internal keys throughout install/uninstall.
#[derive(Debug, Clone, PartialEq)]
pub enum IntegrationSlug {
    Claude,
    Gemini,
    Opencode,
}

impl IntegrationSlug {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Claude => "claude",
            Self::Gemini => "gemini",
            Self::Opencode => "opencode",
        }
    }

    /// Human-readable display name for TUI prompts and output messages.
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Claude => "Claude Code",
            Self::Gemini => "Gemini CLI",
            Self::Opencode => "OpenCode",
        }
    }

    /// Whether this integration has a real implementation (not a stub).
    ///
    /// Updated in Phases 6/7 when stubs become real implementations.
    pub fn is_available(&self) -> bool {
        match self {
            Self::Claude => true,
            Self::Gemini => false,
            Self::Opencode => false,
        }
    }

    /// Case-insensitive parse from a string slice. Returns `None` for unknown slugs.
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "claude" => Some(Self::Claude),
            "gemini" => Some(Self::Gemini),
            "opencode" => Some(Self::Opencode),
            _ => None,
        }
    }

    /// All known integration slugs in display order.
    pub fn all() -> &'static [IntegrationSlug] {
        &[Self::Claude, Self::Gemini, Self::Opencode]
    }
}

impl fmt::Display for IntegrationSlug {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/// Return a boxed trait object for the given slug.
///
/// Adding a new integration requires only: new file, implement Integration,
/// add variant to IntegrationSlug, add arm here. No changes to install.rs
/// or uninstall.rs dispatch logic.
pub fn get_integration(slug: &IntegrationSlug) -> Box<dyn Integration> {
    match slug {
        IntegrationSlug::Claude => Box::new(claude::ClaudeIntegration),
        IntegrationSlug::Gemini => Box::new(gemini::GeminiIntegration),
        IntegrationSlug::Opencode => Box::new(opencode::OpenCodeIntegration),
    }
}

// ---------------------------------------------------------------------------
// Interactive TUI picker and integration resolution
// ---------------------------------------------------------------------------

/// Resolve the list of integration slugs from CLI arguments.
///
/// - If `given` is non-empty: parse each string, exit(1) on unknown slug.
/// - If `given` is empty and stdin is NOT a TTY: print error and exit(1).
/// - If `given` is empty and stdin IS a TTY: launch interactive TUI picker.
pub fn resolve_integrations(given: &[String], prompt: &str) -> Vec<IntegrationSlug> {
    if !given.is_empty() {
        let mut slugs = Vec::with_capacity(given.len());
        for s in given {
            match IntegrationSlug::from_str(s) {
                Some(slug) => slugs.push(slug),
                None => {
                    eprintln!(
                        "plan-reviewer: unknown integration '{}'. Valid: claude, gemini, opencode",
                        s
                    );
                    std::process::exit(1);
                }
            }
        }
        return slugs;
    }

    // No integration names given — check TTY status (T-04-05 mitigation, D-08)
    if !std::io::stdin().is_terminal() {
        eprintln!(
            "No integrations specified. Run interactively or pass integration names: \
             plan-reviewer install claude gemini opencode"
        );
        std::process::exit(1);
    }

    show_integration_picker(prompt)
}

/// Show a TUI multi-select picker for integrations, rendered on stderr.
///
/// Pre-checks already-installed integrations so the user sees current state.
/// Returns the user's selection or exits(0) if nothing is selected / cancelled.
pub fn show_integration_picker(prompt: &str) -> Vec<IntegrationSlug> {
    use dialoguer::console::Term;
    use dialoguer::{theme::ColorfulTheme, MultiSelect};

    let all = IntegrationSlug::all();
    let home = std::env::var("HOME").unwrap_or_default();

    let ctx = InstallContext {
        home,
        binary_path: String::new(),
    };

    // Build display labels with installed/not-yet-implemented/available status
    let items: Vec<String> = all
        .iter()
        .map(|slug| {
            if !slug.is_available() {
                return format!("{} (not yet implemented)", slug.display_name());
            }
            let integration = get_integration(slug);
            if integration.is_installed(&ctx) {
                return format!("{} (installed)", slug.display_name());
            }
            slug.display_name().to_string()
        })
        .collect();

    // Pre-check already installed integrations for defaults
    let defaults: Vec<bool> = all
        .iter()
        .map(|slug| {
            if !slug.is_available() {
                return false;
            }
            let integration = get_integration(slug);
            integration.is_installed(&ctx)
        })
        .collect();

    let selections = MultiSelect::with_theme(&ColorfulTheme::default())
        .with_prompt(prompt)
        .items(&items)
        .defaults(&defaults)
        .interact_on_opt(&Term::stderr())
        .unwrap_or_else(|e| {
            eprintln!("plan-reviewer: picker error: {}", e);
            std::process::exit(1);
        });

    match selections {
        Some(idxs) if !idxs.is_empty() => idxs.into_iter().map(|i| all[i].clone()).collect(),
        _ => {
            eprintln!("No integrations selected.");
            std::process::exit(0);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slug_round_trip() {
        assert_eq!(
            IntegrationSlug::from_str("claude"),
            Some(IntegrationSlug::Claude)
        );
        assert_eq!(
            IntegrationSlug::from_str("CLAUDE"),
            Some(IntegrationSlug::Claude)
        );
        assert_eq!(
            IntegrationSlug::from_str("gemini"),
            Some(IntegrationSlug::Gemini)
        );
        assert_eq!(
            IntegrationSlug::from_str("GEMINI"),
            Some(IntegrationSlug::Gemini)
        );
        assert_eq!(
            IntegrationSlug::from_str("opencode"),
            Some(IntegrationSlug::Opencode)
        );
        assert_eq!(IntegrationSlug::from_str("codestral"), None);
        assert_eq!(IntegrationSlug::from_str("unknown"), None);
    }

    #[test]
    fn slug_display() {
        assert_eq!(IntegrationSlug::Claude.to_string(), "claude");
        assert_eq!(IntegrationSlug::Gemini.to_string(), "gemini");
        assert_eq!(IntegrationSlug::Opencode.to_string(), "opencode");
    }

    #[test]
    fn all_slugs_count() {
        assert_eq!(IntegrationSlug::all().len(), 3);
    }

    #[test]
    fn get_integration_returns_for_all_slugs() {
        // Should not panic for any known slug
        for slug in IntegrationSlug::all() {
            let _integration = get_integration(slug);
        }
    }

    #[test]
    fn gemini_stub_returns_err() {
        let integration = gemini::GeminiIntegration;
        let ctx = InstallContext {
            home: "/tmp".to_string(),
            binary_path: String::new(),
        };
        let result = integration.install(&ctx);
        assert!(result.is_err());
        assert!(
            result.unwrap_err().contains("not yet implemented"),
            "gemini install error should mention 'not yet implemented'"
        );
        assert!(!integration.is_installed(&ctx));
    }

    #[test]
    fn opencode_stub_returns_err() {
        let integration = opencode::OpenCodeIntegration;
        let ctx = InstallContext {
            home: "/tmp".to_string(),
            binary_path: String::new(),
        };
        let result = integration.install(&ctx);
        assert!(result.is_err());
        assert!(
            result.unwrap_err().contains("not yet implemented"),
            "opencode install error should mention 'not yet implemented'"
        );
        assert!(!integration.is_installed(&ctx));
    }
}
