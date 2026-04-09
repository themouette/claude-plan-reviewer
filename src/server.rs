use std::sync::{Arc, Mutex};

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use tokio::net::TcpListener;
use tokio::sync::oneshot;
use tokio_util::sync::CancellationToken;

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

async fn get_index(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let plan_html = &state.plan_html;
    let html = format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Plan Review</title>
  <style>
    body {{ font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; }}
    h1 {{ font-size: 1.5rem; margin-bottom: 1rem; }}
    #plan {{ border: 1px solid #ccc; border-radius: 4px; padding: 1rem; margin-bottom: 1.5rem; }}
    .buttons {{ display: flex; gap: 1rem; }}
    button {{ padding: 0.5rem 1.5rem; font-size: 1rem; cursor: pointer; border-radius: 4px; border: none; }}
    #approve-btn {{ background: #16a34a; color: white; }}
    #deny-btn {{ background: #dc2626; color: white; }}
    #status {{ margin-top: 1rem; font-weight: bold; }}
  </style>
</head>
<body>
  <h1>Plan Review</h1>
  <div id="plan">{plan_html}</div>
  <div class="buttons">
    <button id="approve-btn" onclick="decide('allow')">Approve</button>
    <button id="deny-btn" onclick="decide('deny')">Deny</button>
  </div>
  <div id="status"></div>
  <script>
    async function decide(behavior) {{
      const body = behavior === 'allow'
        ? {{ behavior: 'allow' }}
        : {{ behavior: 'deny', message: 'denied via test page' }};
      try {{
        const resp = await fetch('/api/decide', {{
          method: 'POST',
          headers: {{ 'Content-Type': 'application/json' }},
          body: JSON.stringify(body),
        }});
        if (resp.ok) {{
          document.getElementById('status').textContent = 'Decision submitted';
          document.getElementById('approve-btn').disabled = true;
          document.getElementById('deny-btn').disabled = true;
        }} else if (resp.status === 409) {{
          document.getElementById('status').textContent = 'Decision already submitted';
        }} else {{
          document.getElementById('status').textContent = 'Error: ' + resp.status;
        }}
      }} catch (e) {{
        document.getElementById('status').textContent = 'Error: ' + e.message;
      }}
    }}
  </script>
</body>
</html>"#,
        plan_html = plan_html,
    );
    axum::response::Html(html)
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

    // 4. Build router
    let app = Router::new()
        .route("/api/plan", get(get_plan))
        .route("/api/decide", post(post_decide))
        .route("/", get(get_index))
        .with_state(state);

    // 5. Bind to OS-assigned port
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();

    // 6. Spawn axum server with graceful shutdown
    tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async move { token_clone.cancelled().await })
            .await
            .ok();
    });

    // 7. Return port and decision receiver
    // The CancellationToken is not exposed — process::exit handles termination
    // after the decision is written to stdout.
    // We cancel the token when the process exits; there is no memory leak
    // because the process terminates within 3 seconds of receiving a decision.
    drop(token);

    Ok((port, decision_rx))
}
