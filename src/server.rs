use std::sync::{Arc, Mutex};

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use axum_embed::{FallbackBehavior, ServeEmbed};
use rust_embed::RustEmbed;
use tokio::net::TcpListener;
use tokio::sync::oneshot;
use tokio_util::sync::CancellationToken;

// --- Embedded assets ---

#[derive(RustEmbed, Clone)]
#[folder = "ui/dist/"]
pub struct Assets;

// --- Decision type ---

#[derive(serde::Deserialize, Debug, Clone)]
pub struct Decision {
    pub behavior: String,        // "allow" or "deny"
    pub message: Option<String>, // required if behavior is "deny"
}

// --- AppState ---

pub struct AppState {
    pub plan_html: String,
    pub decision_tx: Mutex<Option<oneshot::Sender<Decision>>>,
}

// --- Route handlers ---

async fn get_plan(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(serde_json::json!({ "plan_html": state.plan_html }))
}

async fn post_decide(
    State(state): State<Arc<AppState>>,
    Json(body): Json<Decision>,
) -> impl IntoResponse {
    let tx = state.decision_tx.lock().unwrap().take();
    match tx {
        Some(tx) => {
            let _ = tx.send(body);
            StatusCode::OK
        }
        None => StatusCode::CONFLICT, // 409 — already decided
    }
}

// --- Server entry point ---

/// Bind to a random OS-assigned port on 127.0.0.1, spawn the axum server,
/// and return (port, decision_rx) so the caller can open a browser and await
/// the decision.
pub async fn start_server(
    plan_html: String,
) -> Result<(u16, oneshot::Receiver<Decision>), Box<dyn std::error::Error + Send + Sync>> {
    // 1. Create decision channel
    let (decision_tx, decision_rx) = oneshot::channel::<Decision>();

    // 2. Create cancellation token for graceful shutdown
    let token = CancellationToken::new();
    let token_clone = token.clone();

    // 3. Build AppState
    let state = Arc::new(AppState {
        plan_html,
        decision_tx: Mutex::new(Some(decision_tx)),
    });

    // 4. Build SPA fallback — serves embedded React assets; any unknown path
    //    returns index.html (FallbackBehavior::Ok) to support client-side routing.
    let spa = ServeEmbed::<Assets>::with_parameters(
        Some("index.html".to_owned()),
        FallbackBehavior::Ok,
        None,
    );

    // 5. Build router — API routes take priority; everything else falls back to SPA
    let app = Router::new()
        .route("/api/plan", get(get_plan))
        .route("/api/decide", post(post_decide))
        .fallback_service(spa)
        .with_state(state);

    // 6. Bind to OS-assigned port
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();

    // 7. Spawn axum server with graceful shutdown
    tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async move { token_clone.cancelled().await })
            .await
            .ok();
    });

    // 8. Return port and decision receiver
    // The CancellationToken is not exposed — process::exit handles termination
    // after the decision is written to stdout.
    drop(token);

    Ok((port, decision_rx))
}
