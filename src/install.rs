use crate::integration::{self, IntegrationSlug};

/// Wire the ExitPlanMode hook into the selected integrations.
///
/// `integrations` is a list of integration name strings from CLI args (may be empty).
/// If empty and stdin is a TTY, an interactive picker is shown. If empty and non-TTY,
/// exits with a D-08 error message.
pub fn run_install(integrations: Vec<String>) {
    let slugs = integration::resolve_integrations(
        &integrations,
        "Select integrations to install (Space to toggle, Enter to confirm)",
    );

    // Resolve binary path (written into settings.json as the command)
    let binary_path = match std::env::current_exe() {
        Ok(p) => p.to_string_lossy().into_owned(),
        Err(e) => {
            eprintln!("plan-reviewer install: cannot determine binary path: {}", e);
            std::process::exit(1);
        }
    };

    // Resolve HOME directory
    let home = match std::env::var("HOME") {
        Ok(h) => h,
        Err(_) => {
            eprintln!("plan-reviewer install: HOME environment variable not set");
            std::process::exit(1);
        }
    };

    for slug in &slugs {
        let defn = integration::get_integration(slug);
        if !defn.supported {
            eprintln!(
                "plan-reviewer install: {} integration is not yet supported. {}",
                defn.display_name,
                defn.unsupported_reason.unwrap_or("")
            );
            continue;
        }
        match slug {
            IntegrationSlug::Claude => install_claude(&home, &binary_path),
            _ => {
                eprintln!(
                    "plan-reviewer install: {} integration is not yet supported.",
                    defn.display_name
                );
            }
        }
    }
}

/// Install the ExitPlanMode hook into ~/.claude/settings.json.
///
/// Idempotent: safe to run multiple times. If the hook is already present
/// (any entry with matcher == "ExitPlanMode"), this is a no-op.
fn install_claude(home: &str, binary_path: &str) {
    let settings_path = integration::claude_settings_path(home);

    // Read existing settings or start with an empty object
    let mut root: serde_json::Value = if settings_path.exists() {
        match std::fs::read_to_string(&settings_path) {
            Ok(content) => serde_json::from_str(&content).unwrap_or_else(|_| {
                eprintln!(
                    "plan-reviewer install: warning: {} contains invalid JSON; \
                     starting from empty object (existing content will be overwritten)",
                    settings_path.display()
                );
                serde_json::json!({})
            }),
            Err(e) => {
                eprintln!(
                    "plan-reviewer install: cannot read {}: {}",
                    settings_path.display(),
                    e
                );
                std::process::exit(1);
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
    root.as_object_mut()
        .unwrap()
        .entry("hooks")
        .or_insert_with(|| serde_json::json!({}));

    // Ensure root.hooks.PermissionRequest exists as an array
    root["hooks"]
        .as_object_mut()
        .unwrap()
        .entry("PermissionRequest")
        .or_insert_with(|| serde_json::json!([]));

    // Idempotency check via integration helper
    if integration::claude_is_installed(&root) {
        println!(
            "plan-reviewer: ExitPlanMode hook already configured in {} (no changes made)",
            settings_path.display()
        );
        return;
    }

    // Push the new hook entry
    root["hooks"]["PermissionRequest"]
        .as_array_mut()
        .unwrap()
        .push(integration::claude_hook_entry(binary_path));

    // Write back with pretty-printing (2-space indent, standard serde_json format)
    let output = match serde_json::to_string_pretty(&root) {
        Ok(s) => s,
        Err(e) => {
            eprintln!(
                "plan-reviewer install: cannot serialize settings.json: {}",
                e
            );
            std::process::exit(1);
        }
    };

    // Create ~/.claude/ if it doesn't exist
    if let Some(parent) = settings_path.parent()
        && let Err(e) = std::fs::create_dir_all(parent)
    {
        eprintln!(
            "plan-reviewer install: cannot create {}: {}",
            parent.display(),
            e
        );
        std::process::exit(1);
    }

    if let Err(e) = std::fs::write(&settings_path, output) {
        eprintln!(
            "plan-reviewer install: cannot write {}: {}",
            settings_path.display(),
            e
        );
        std::process::exit(1);
    }

    println!(
        "plan-reviewer: ExitPlanMode hook installed in {}",
        settings_path.display()
    );
    println!("plan-reviewer: hook command set to: {}", binary_path);
}
