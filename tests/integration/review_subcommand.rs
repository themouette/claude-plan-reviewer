use std::io::BufRead;
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::time::Duration;

/// Return the path to the compiled `plan-reviewer` binary.
fn binary_path() -> std::path::PathBuf {
    assert_cmd::cargo::cargo_bin("plan-reviewer")
}

/// Spawn the binary with `--no-browser --port 0 review <file_path>`.
///
/// Uses OS-assigned port (--port 0) and extracts the actual port from the
/// "Review UI: http://127.0.0.1:{port}" stderr line the server prints when ready.
/// This eliminates all TOCTOU port-reservation races.
///
/// CRITICAL: stdin is set to Stdio::null() — the review subcommand must NOT
/// read stdin. This also avoids any deadlock from an unclosed stdin pipe.
///
/// Returns (child, port). The server is guaranteed to be listening on port
/// by the time this function returns.
fn spawn_review_flow(file_path: &str) -> (Child, u16) {
    let home = tempfile::TempDir::new().unwrap();
    let home = Box::leak(Box::new(home));
    let mut child = Command::new(binary_path())
        .env("HOME", home.path())
        .args(["--no-browser", "--port", "0", "review", file_path])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("failed to spawn plan-reviewer review");

    let port = read_server_port(&mut child);
    (child, port)
}

/// Spawn the binary with custom --approve-label and --deny-label flags.
fn spawn_review_flow_with_labels(
    file_path: &str,
    approve_label: &str,
    deny_label: &str,
) -> (Child, u16) {
    let home = tempfile::TempDir::new().unwrap();
    let home = Box::leak(Box::new(home));
    let mut child = Command::new(binary_path())
        .env("HOME", home.path())
        .args([
            "--no-browser",
            "--port",
            "0",
            "review",
            "--approve-label",
            approve_label,
            "--deny-label",
            deny_label,
            file_path,
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("failed to spawn plan-reviewer review with labels");

    let port = read_server_port(&mut child);
    (child, port)
}

/// Read the "Review UI: http://127.0.0.1:{port}" line from child stderr.
///
/// Spawns a background thread that drains stderr (preventing SIGPIPE if the
/// child writes more after we've read the port). Returns the port via a
/// channel with a 10-second timeout.
fn read_server_port(child: &mut Child) -> u16 {
    let stderr = child.stderr.take().expect("stderr not piped");
    let (tx, rx) = mpsc::channel();

    std::thread::spawn(move || {
        let reader = std::io::BufReader::new(stderr);
        for line in reader.lines().flatten() {
            if let Some(port_str) = line.strip_prefix("Review UI: http://127.0.0.1:") {
                if let Ok(port) = port_str.trim().parse::<u16>() {
                    let _ = tx.send(port);
                }
            }
        }
    });

    rx.recv_timeout(Duration::from_secs(10))
        .expect("server did not print 'Review UI:' line within 10 seconds")
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[test]
fn review_approve() {
    let tmp = tempfile::NamedTempFile::new().expect("create temp file");
    std::fs::write(tmp.path(), "# Test Plan\n\n1. Step one\n2. Step two").expect("write");

    let (child, port) = spawn_review_flow(tmp.path().to_str().unwrap());

    // POST allow decision
    let response = ureq::post(&format!("http://127.0.0.1:{port}/api/decide"))
        .send_json(serde_json::json!({ "behavior": "allow" }))
        .expect("POST /api/decide failed");
    assert_eq!(response.status(), 200, "expected 200 OK from /api/decide");

    let output = child.wait_with_output().expect("failed to wait for child");
    assert!(output.status.success(), "expected exit code 0");

    let json: serde_json::Value =
        serde_json::from_slice(&output.stdout).expect("stdout is not valid JSON");

    // Neutral format: flat {behavior: "allow"} — no hookSpecificOutput, no decision key
    assert_eq!(
        json["behavior"].as_str(),
        Some("allow"),
        "review approve: expected behavior == \"allow\""
    );
    assert!(
        json.get("hookSpecificOutput").is_none(),
        "review approve: must NOT have hookSpecificOutput key"
    );
    assert!(
        json.get("decision").is_none(),
        "review approve: must NOT have decision key (opencode/neutral format uses behavior)"
    );
}

#[test]
fn review_deny_with_message() {
    let tmp = tempfile::NamedTempFile::new().expect("create temp file");
    std::fs::write(tmp.path(), "# Test Plan\n\n1. Step one\n2. Step two").expect("write");

    let (child, port) = spawn_review_flow(tmp.path().to_str().unwrap());

    // POST deny decision with message
    let response = ureq::post(&format!("http://127.0.0.1:{port}/api/decide"))
        .send_json(serde_json::json!({ "behavior": "deny", "message": "Missing tests" }))
        .expect("POST /api/decide failed");
    assert_eq!(response.status(), 200, "expected 200 OK from /api/decide");

    let output = child.wait_with_output().expect("failed to wait for child");
    assert!(output.status.success(), "expected exit code 0");

    let json: serde_json::Value =
        serde_json::from_slice(&output.stdout).expect("stdout is not valid JSON");

    assert_eq!(
        json["behavior"].as_str(),
        Some("deny"),
        "review deny: expected behavior == \"deny\""
    );
    assert_eq!(
        json["message"].as_str(),
        Some("Missing tests"),
        "review deny: expected message == \"Missing tests\""
    );
    assert!(
        json.get("hookSpecificOutput").is_none(),
        "review deny: must NOT have hookSpecificOutput key"
    );
}

#[test]
fn review_missing_file() {
    assert_cmd::Command::cargo_bin("plan-reviewer")
        .expect("binary not found")
        .args(["--no-browser", "review", "/nonexistent/path/abc123.md"])
        .assert()
        .failure()
        .stderr(predicates::str::contains("Failed to read file"));
}

#[test]
fn review_serves_plan_content() {
    let tmp = tempfile::NamedTempFile::new().expect("create temp file");
    std::fs::write(tmp.path(), "# My Review Content").expect("write");

    let (child, port) = spawn_review_flow(tmp.path().to_str().unwrap());

    // GET /api/plan — should return rendered HTML containing plan content
    let mut response = ureq::get(&format!("http://127.0.0.1:{port}/api/plan"))
        .call()
        .expect("GET /api/plan failed");
    assert_eq!(response.status(), 200, "expected 200 OK from /api/plan");

    let body = response
        .body_mut()
        .read_to_string()
        .expect("response body read failed");
    assert!(
        body.contains("My Review Content"),
        "GET /api/plan: expected body to contain 'My Review Content', got: {}",
        &body[..body.len().min(500)]
    );

    // Clean up: POST allow to let the process exit
    let _ = ureq::post(&format!("http://127.0.0.1:{port}/api/decide"))
        .send_json(serde_json::json!({ "behavior": "allow" }));

    let _ = child.wait_with_output();
}

#[test]
fn review_config_default_labels() {
    let tmp = tempfile::NamedTempFile::new().expect("create temp file");
    std::fs::write(tmp.path(), "# Test").expect("write");

    let (child, port) = spawn_review_flow(tmp.path().to_str().unwrap());

    let mut response = ureq::get(&format!("http://127.0.0.1:{port}/api/config"))
        .call()
        .expect("GET /api/config failed");
    assert_eq!(response.status(), 200);

    let body: serde_json::Value =
        serde_json::from_str(&response.body_mut().read_to_string().unwrap()).unwrap();
    assert_eq!(body["approve_label"].as_str(), Some("Approve"));
    assert_eq!(body["deny_label"].as_str(), Some("Deny"));

    // Clean up
    let _ = ureq::post(&format!("http://127.0.0.1:{port}/api/decide"))
        .send_json(serde_json::json!({ "behavior": "allow" }));
    let _ = child.wait_with_output();
}

#[test]
fn review_config_custom_labels() {
    let tmp = tempfile::NamedTempFile::new().expect("create temp file");
    std::fs::write(tmp.path(), "# Test").expect("write");

    let (child, port) =
        spawn_review_flow_with_labels(tmp.path().to_str().unwrap(), "No issues", "Leave feedback");

    let mut response = ureq::get(&format!("http://127.0.0.1:{port}/api/config"))
        .call()
        .expect("GET /api/config failed");
    assert_eq!(response.status(), 200);

    let body: serde_json::Value =
        serde_json::from_str(&response.body_mut().read_to_string().unwrap()).unwrap();
    assert_eq!(body["approve_label"].as_str(), Some("No issues"));
    assert_eq!(body["deny_label"].as_str(), Some("Leave feedback"));

    // Clean up
    let _ = ureq::post(&format!("http://127.0.0.1:{port}/api/decide"))
        .send_json(serde_json::json!({ "behavior": "allow" }));
    let _ = child.wait_with_output();
}
