use super::{InstallContext, Integration};

// ---------------------------------------------------------------------------
// GeminiIntegration (stub — Phase 6 fills in the real implementation)
// ---------------------------------------------------------------------------

/// Stub for Gemini CLI integration. Returns Err on install/uninstall until
/// Phase 6 implements the real hook wiring.
pub struct GeminiIntegration;

impl Integration for GeminiIntegration {
    fn install(&self, _ctx: &InstallContext) -> Result<(), String> {
        Err("gemini integration not yet implemented".into())
    }

    fn uninstall(&self, _ctx: &InstallContext) -> Result<(), String> {
        Err("gemini integration not yet implemented".into())
    }

    fn is_installed(&self, _ctx: &InstallContext) -> bool {
        false
    }
}
