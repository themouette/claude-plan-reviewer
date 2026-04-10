use crate::integration::{self, IntegrationSlug};

/// Remove the ExitPlanMode hook from the selected integrations.
///
/// `integrations` is a list of integration name strings from CLI args (may be empty).
/// If empty and stdin is a TTY, an interactive picker is shown. If empty and non-TTY,
/// exits with a D-08 error message.
pub fn run_uninstall(integrations: Vec<String>) {
    let slugs = integration::resolve_integrations(
        &integrations,
        "Select integrations to uninstall (Space to toggle, Enter to confirm)",
    );

    // Resolve HOME directory
    let home = match std::env::var("HOME") {
        Ok(h) => h,
        Err(_) => {
            eprintln!("plan-reviewer uninstall: HOME environment variable not set");
            std::process::exit(1);
        }
    };

    for slug in &slugs {
        let defn = integration::get_integration(slug);
        if !defn.supported {
            eprintln!(
                "plan-reviewer uninstall: {} integration is not yet supported.",
                defn.display_name
            );
            continue;
        }
        match slug {
            IntegrationSlug::Claude => uninstall_claude(&home),
            _ => {
                eprintln!(
                    "plan-reviewer uninstall: {} integration is not yet supported.",
                    defn.display_name
                );
            }
        }
    }
}

/// Remove the ExitPlanMode hook from ~/.claude/settings.json.
///
/// Idempotent: safe to run when the hook is not present (D-05).
/// Matches on `"matcher": "ExitPlanMode"` — NOT on binary path (Pitfall 4).
fn uninstall_claude(home: &str) {
    let settings_path = integration::claude_settings_path(home);

    // If settings file does not exist, nothing to do
    if !settings_path.exists() {
        println!(
            "plan-reviewer: no settings file found at {} (nothing to uninstall)",
            settings_path.display()
        );
        return;
    }

    // Read and parse JSON
    let content = match std::fs::read_to_string(&settings_path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!(
                "plan-reviewer uninstall: cannot read {}: {}",
                settings_path.display(),
                e
            );
            return;
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
            return;
        }
    };

    // Idempotency check: if hook is not present, nothing to do (D-05)
    if !integration::claude_is_installed(&root) {
        println!(
            "plan-reviewer: ExitPlanMode hook not found in {} (no changes made)",
            settings_path.display()
        );
        return;
    }

    // Remove all entries where "matcher" == "ExitPlanMode"
    // This removes ALL ExitPlanMode entries regardless of binary path (Pitfall 4 mitigation)
    if let Some(arr) = root["hooks"]["PermissionRequest"].as_array_mut() {
        arr.retain(|entry| entry["matcher"].as_str() != Some("ExitPlanMode"));
    }

    // Write back with pretty-printing
    let output = match serde_json::to_string_pretty(&root) {
        Ok(s) => s,
        Err(e) => {
            eprintln!(
                "plan-reviewer uninstall: cannot serialize settings.json: {}",
                e
            );
            std::process::exit(1);
        }
    };

    if let Err(e) = std::fs::write(&settings_path, output) {
        eprintln!(
            "plan-reviewer uninstall: cannot write {}: {}",
            settings_path.display(),
            e
        );
        std::process::exit(1);
    }

    println!(
        "plan-reviewer: ExitPlanMode hook removed from {}",
        settings_path.display()
    );
}
