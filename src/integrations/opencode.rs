use super::{InstallContext, Integration};

// ---------------------------------------------------------------------------
// OpenCodeIntegration (stub — Phase 7 fills in the real implementation)
// ---------------------------------------------------------------------------

/// Stub for OpenCode integration. Returns Err on install/uninstall until
/// Phase 7 implements the real hook wiring.
pub struct OpenCodeIntegration;

impl Integration for OpenCodeIntegration {
    fn install(&self, _ctx: &InstallContext) -> Result<(), String> {
        Err("opencode integration not yet implemented".into())
    }

    fn uninstall(&self, _ctx: &InstallContext) -> Result<(), String> {
        Err("opencode integration not yet implemented".into())
    }

    fn is_installed(&self, _ctx: &InstallContext) -> bool {
        false
    }
}
