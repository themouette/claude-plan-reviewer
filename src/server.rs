use std::sync::{Arc, Mutex};

use axum::{http::StatusCode, response::IntoResponse, routing::get};
use axum_embed::{FallbackBehavior, ServeEmbed};
use rust_embed::RustEmbed;
use tokio::net::TcpListener;
use tokio::sync::oneshot;
use tokio_util::sync::CancellationToken;

use crate::{diff_api, plan_review};

// Re-export so main.rs can use `server::Decision` and `server::AppState`
// without changing existing import paths.
pub use crate::plan_review::{AppState, Decision};

// --- Embedded assets ---

#[derive(RustEmbed, Clone)]
#[folder = "ui/dist/"]
pub struct Assets;

// --- Stateless ping handler ---

// Stateless reachability probe used by the frontend heartbeat (HB-01).
// MUST NOT take State<Arc<AppState>> — endpoint is required to be stateless.
async fn get_ping() -> impl IntoResponse {
    StatusCode::OK
}

// --- Server entry point ---

/// Bind to the specified port on 127.0.0.1 (0 = OS-assigned), spawn the axum server,
/// and return (port, decision_rx) so the caller can open a browser and await
/// the decision.
pub async fn start_server(
    plan_md: String,
    approve_label: String,
    deny_label: String,
    port: u16,
) -> Result<(u16, oneshot::Receiver<Decision>), Box<dyn std::error::Error + Send + Sync>> {
    // 1. Create decision channel
    let (decision_tx, decision_rx) = oneshot::channel::<Decision>();

    // 2. Create cancellation token for graceful shutdown
    let token = CancellationToken::new();
    let token_clone = token.clone();

    // 3. Build plan_review state (AppState fields unchanged per D-06)
    let plan_state = Arc::new(AppState {
        plan_md,
        approve_label,
        deny_label,
        decision_tx: Mutex::new(Some(decision_tx)),
    });

    // 4. Build code_review state (repo_path from cwd at startup — not from request)
    let cwd = std::env::current_dir().unwrap_or_default();
    let code_review_state = Arc::new(diff_api::CodeReviewState { repo_path: cwd });

    // 5. Build SPA fallback — serves embedded React assets; any unknown path
    //    returns index.html (FallbackBehavior::Ok) to support client-side routing.
    let spa = ServeEmbed::<Assets>::with_parameters(
        Some("index.html".to_owned()),
        FallbackBehavior::Ok,
        None,
    );

    // 6. Merge sub-routers — both return Router<()> already (called .with_state inside).
    //    Attach /api/ping (stateless) and SPA fallback AFTER merge (Pitfall 5 — only one
    //    fallback_service allowed in the assembled router).
    let app = plan_review::router(plan_state)
        .merge(diff_api::router(code_review_state))
        .route("/api/ping", get(get_ping))
        .fallback_service(spa);

    // 7. Bind to specified port (0 = OS-assigned)
    let listener = TcpListener::bind(format!("127.0.0.1:{}", port)).await?;
    let port = listener.local_addr()?.port();

    // 8. Spawn axum server with graceful shutdown
    tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async move { token_clone.cancelled().await })
            .await
            .ok();
    });

    // 9. The CancellationToken is not exposed — process::exit handles termination
    //    after the decision is written to stdout.
    drop(token);

    Ok((port, decision_rx))
}
