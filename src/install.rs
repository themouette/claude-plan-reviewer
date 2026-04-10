/// Wire the ExitPlanMode hook into ~/.claude/settings.json.
///
/// Idempotent: safe to run multiple times. If the hook is already present
/// (any entry with matcher == "ExitPlanMode"), this is a no-op.
pub fn run_install() {
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

    let settings_path = std::path::PathBuf::from(&home).join(".claude/settings.json");

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

    // Idempotency check: scan for any existing ExitPlanMode matcher
    let already_present = root["hooks"]["PermissionRequest"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .any(|entry| entry["matcher"].as_str() == Some("ExitPlanMode"))
        })
        .unwrap_or(false);

    if already_present {
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
        .push(serde_json::json!({
            "matcher": "ExitPlanMode",
            "hooks": [
                {
                    "type": "command",
                    "command": binary_path
                }
            ]
        }));

    // Write back with pretty-printing (2-space indent, standard serde_json format)
    let output = match serde_json::to_string_pretty(&root) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("plan-reviewer install: cannot serialize settings.json: {}", e);
            std::process::exit(1);
        }
    };

    // Create ~/.claude/ if it doesn't exist
    if let Some(parent) = settings_path.parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            eprintln!(
                "plan-reviewer install: cannot create {}: {}",
                parent.display(),
                e
            );
            std::process::exit(1);
        }
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
    println!(
        "plan-reviewer: hook command set to: {}",
        binary_path
    );
}
