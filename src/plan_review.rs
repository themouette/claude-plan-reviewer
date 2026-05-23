use std::sync::{Arc, Mutex};

use axum::{
    Json, Router,
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
};
use tokio::sync::oneshot;

// --- Decision type ---

#[derive(serde::Deserialize, Debug, Clone)]
pub struct Decision {
    pub behavior: String,        // "allow" or "deny"
    pub message: Option<String>, // required if behavior is "deny"
}

// --- AppState ---

pub struct AppState {
    pub plan_md: String,
    pub diff_content: String,
    pub approve_label: String,
    pub deny_label: String,
    pub decision_tx: Mutex<Option<oneshot::Sender<Decision>>>,
}

// --- Route handlers ---

async fn get_plan(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(serde_json::json!({ "plan_md": state.plan_md }))
}

async fn get_diff(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(serde_json::json!({ "diff": state.diff_content }))
}

async fn get_config(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(serde_json::json!({
        "approve_label": state.approve_label,
        "deny_label": state.deny_label,
    }))
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

// --- Router factory ---

/// Create the plan-review sub-router with state attached.
/// Returns `Router<()>` so the assembler can `.merge()` it.
/// Does NOT attach a fallback — the SPA fallback is added by the assembler only.
pub fn router(state: Arc<AppState>) -> Router<()> {
    Router::new()
        .route("/api/plan", get(get_plan))
        .route("/api/diff", get(get_diff))
        .route("/api/config", get(get_config))
        .route("/api/decide", post(post_decide))
        .with_state(state)
}
