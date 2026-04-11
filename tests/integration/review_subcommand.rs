use std::net::TcpStream;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

/// Bind a TcpListener to port 0, let the OS assign a free port, and return both
/// the port number and the listener.
///
/// The caller MUST keep the returned listener alive until the child process has
/// been spawned, then drop it immediately before calling `wait_for_port`.  This
/// eliminates the TOCTOU window where another process could claim the port
/// between the discovery call and the child's bind.
fn find_free_port() -> (u16, std::net::TcpListener) {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    (port, listener)
}

/// Poll `TcpStream::connect` in a loop with 50 ms sleep.
/// Returns `true` if the connection succeeds before `timeout`, `false` otherwise.
fn wait_for_port(port: u16, timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if TcpStream::connect(format!("127.0.0.1:{port}")).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    false
}

/// Return the path to the compiled `plan-reviewer` binary.
fn binary_path() -> std::path::PathBuf {
    assert_cmd::cargo::cargo_bin("plan-reviewer")
}

/// Spawn the binary with `--no-browser --port <port> review <file_path>`.
///
/// CRITICAL: stdin is set to Stdio::null() — the review subcommand must NOT
/// read stdin. This also avoids any deadlock from an unclosed stdin pipe.
///
/// Returns the `Child` handle. The caller must call `wait_with_output()` after
/// posting a decision.
fn spawn_review_flow(file_path: &str, port: u16) -> std::process::Child {
    let home = tempfile::TempDir::new().unwrap();
    // Leak the TempDir so it outlives the child process.
    let home = Box::leak(Box::new(home));
    Command::new(binary_path())
        .env("HOME", home.path())
        .args([
            "--no-browser",
            "--port",
            &port.to_string(),
            "review",
            file_path,
        ])
        .stdin(Stdio::null()) // CRITICAL: review does NOT read stdin
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("failed to spawn plan-reviewer review")
}

/// Spawn the binary with custom --approve-label and --deny-label flags.
///
/// The positional `file` argument comes AFTER the named flags because clap
/// parses named args before positional ones.
fn spawn_review_flow_with_labels(
    file_path: &str,
    approve_label: &str,
    deny_label: &str,
    port: u16,
) -> std::process::Child {
    let home = tempfile::TempDir::new().unwrap();
    let home = Box::leak(Box::new(home));
    Command::new(binary_path())
        .env("HOME", home.path())
        .args([
            "--no-browser",
            "--port",
            &port.to_string(),
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
        .expect("failed to spawn plan-reviewer review with labels")
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[test]
fn review_approve() {
    let tmp = tempfile::NamedTempFile::new().expect("create temp file");
    std::fs::write(tmp.path(), "# Test Plan\n\n1. Step one\n2. Step two").expect("write");

    let (port, _port_guard) = find_free_port();
    let child = spawn_review_flow(tmp.path().to_str().unwrap(), port);
    drop(_port_guard); // release the reserved port so the child can bind to it

    assert!(
        wait_for_port(port, Duration::from_secs(10)),
        "server did not start within 10 seconds on port {port}"
    );

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

    let (port, _port_guard) = find_free_port();
    let child = spawn_review_flow(tmp.path().to_str().unwrap(), port);
    drop(_port_guard); // release the reserved port so the child can bind to it

    assert!(
        wait_for_port(port, Duration::from_secs(10)),
        "server did not start within 10 seconds on port {port}"
    );

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

    let (port, _port_guard) = find_free_port();
    let child = spawn_review_flow(tmp.path().to_str().unwrap(), port);
    drop(_port_guard); // release the reserved port so the child can bind to it

    assert!(
        wait_for_port(port, Duration::from_secs(10)),
        "server did not start within 10 seconds on port {port}"
    );

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

    let (port, _port_guard) = find_free_port();
    let child = spawn_review_flow(tmp.path().to_str().unwrap(), port);
    drop(_port_guard); // release the reserved port so the child can bind to it

    assert!(
        wait_for_port(port, Duration::from_secs(10)),
        "server did not start within 10 seconds on port {port}"
    );

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

    let (port, _port_guard) = find_free_port();
    let child = spawn_review_flow_with_labels(
        tmp.path().to_str().unwrap(),
        "No issues",
        "Leave feedback",
        port,
    );
    drop(_port_guard); // release the reserved port so the child can bind to it

    assert!(
        wait_for_port(port, Duration::from_secs(10)),
        "server did not start within 10 seconds on port {port}"
    );

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
