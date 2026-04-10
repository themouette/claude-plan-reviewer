use crate::integrations::{self, InstallContext};

/// Remove the ExitPlanMode hook from the selected integrations.
///
/// `integrations_arg` is a list of integration name strings from CLI args (may be empty).
/// If empty and stdin is a TTY, an interactive picker is shown. If empty and non-TTY,
/// exits with a D-08 error message.
pub fn run_uninstall(integrations_arg: Vec<String>) {
    let slugs = integrations::resolve_integrations(
        &integrations_arg,
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

    let ctx = InstallContext {
        home,
        binary_path: None,
    };

    for slug in &slugs {
        let integration = integrations::get_integration(slug);
        if let Err(e) = integration.uninstall(&ctx) {
            eprintln!("plan-reviewer uninstall: {}", e);
            std::process::exit(1);
        }
    }
}
