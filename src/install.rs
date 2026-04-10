use crate::integrations::{self, InstallContext};

/// Wire the ExitPlanMode hook into the selected integrations.
///
/// `integrations_arg` is a list of integration name strings from CLI args (may be empty).
/// If empty and stdin is a TTY, an interactive picker is shown. If empty and non-TTY,
/// exits with a D-08 error message.
pub fn run_install(integrations_arg: Vec<String>) {
    let slugs = integrations::resolve_integrations(
        &integrations_arg,
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

    let ctx = InstallContext {
        home,
        binary_path,
    };

    for slug in &slugs {
        let integration = integrations::get_integration(slug);
        if let Err(e) = integration.install(&ctx) {
            eprintln!("plan-reviewer install: {}", e);
            std::process::exit(1);
        }
    }
}
