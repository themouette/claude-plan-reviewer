use std::io::Write;
use std::net::TcpStream;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

// Fixture constants — raw JSON injected as stdin
const HOOK_INPUT_CLAUDE: &str = include_str!("../fixtures/hook_input_claude.json");
const HOOK_INPUT_GEMINI: &str = include_str!("../fixtures/hook_input_gemini.json");

/// Bind a TcpListener to port 0, let the OS assign a free port, then return it.
/// There is a small TOCTOU window between dropping the listener and the binary
/// binding to the same port; this is acceptable in tests.
fn find_free_port() -> u16 {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    listener.local_addr().unwrap().port()
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
/// Uses `CARGO_BIN_EXE_plan_reviewer` env var set by Cargo during test compilation.
fn binary_path() -> std::path::PathBuf {
    assert_cmd::cargo::cargo_bin("plan-reviewer")
}

/// Spawn the binary with `--no-browser --port <port>`, write `fixture_json` to
/// stdin, then CLOSE stdin (critical: the binary's `read_to_string` blocks on
/// stdin until EOF; not closing stdin causes a deadlock — see RESEARCH.md Pitfall 4).
///
/// Returns the `Child` handle. The caller must call `wait_with_output()` to
/// collect stdout/stderr after posting a decision.
fn spawn_hook_flow(fixture_json: &str, port: u16) -> std::process::Child {
    let home = tempfile::TempDir::new().unwrap();
    // Leak the TempDir so it outlives the child process.
    // Acceptable in tests — the OS cleans /tmp on reboot.
    let home = Box::leak(Box::new(home));

    let mut child = Command::new(binary_path())
        .env("HOME", home.path())
        .args(["--no-browser", "--port", &port.to_string()])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("failed to spawn plan-reviewer");

    // Write hook JSON to stdin then close the pipe (EOF triggers read_to_string to return)
    child
        .stdin
        .as_mut()
        .unwrap()
        .write_all(fixture_json.as_bytes())
        .unwrap();
    drop(child.stdin.take()); // CRITICAL: close stdin pipe

    child
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[test]
fn server_cycle_approve_claude() {
    let port = find_free_port();
    let child = spawn_hook_flow(HOOK_INPUT_CLAUDE, port);

    assert!(
        wait_for_port(port, Duration::from_secs(10)),
        "server did not start within 10 seconds on port {port}"
    );

    // POST allow decision
    let response = ureq::post(&format!("http://127.0.0.1:{port}/api/decide"))
        .send_json(serde_json::json!({ "behavior": "allow" }))
        .expect("POST /api/decide failed");
    assert_eq!(response.status(), 200, "expected 200 OK from /api/decide");

    // Binary should exit within ~4 seconds (3s watchdog after decision)
    let output = child.wait_with_output().expect("failed to wait for child");
    assert!(output.status.success(), "expected exit code 0");

    let json: serde_json::Value =
        serde_json::from_slice(&output.stdout).expect("stdout is not valid JSON");

    // Claude format: nested hookSpecificOutput
    assert_eq!(
        json["hookSpecificOutput"]["decision"]["behavior"].as_str(),
        Some("allow"),
        "Claude approve: expected hookSpecificOutput.decision.behavior == \"allow\""
    );
    assert_eq!(
        json["hookSpecificOutput"]["hookEventName"].as_str(),
        Some("PermissionRequest"),
        "Claude approve: expected hookSpecificOutput.hookEventName == \"PermissionRequest\""
    );
}

#[test]
fn server_cycle_deny_claude() {
    let port = find_free_port();
    let child = spawn_hook_flow(HOOK_INPUT_CLAUDE, port);

    assert!(
        wait_for_port(port, Duration::from_secs(10)),
        "server did not start within 10 seconds on port {port}"
    );

    // POST deny decision with message
    let response = ureq::post(&format!("http://127.0.0.1:{port}/api/decide"))
        .send_json(serde_json::json!({ "behavior": "deny", "message": "Missing error handling" }))
        .expect("POST /api/decide failed");
    assert_eq!(response.status(), 200, "expected 200 OK from /api/decide");

    let output = child.wait_with_output().expect("failed to wait for child");
    assert!(output.status.success(), "expected exit code 0");

    let json: serde_json::Value =
        serde_json::from_slice(&output.stdout).expect("stdout is not valid JSON");

    assert_eq!(
        json["hookSpecificOutput"]["decision"]["behavior"].as_str(),
        Some("deny"),
        "Claude deny: expected behavior == \"deny\""
    );
    assert_eq!(
        json["hookSpecificOutput"]["decision"]["message"].as_str(),
        Some("Missing error handling"),
        "Claude deny: expected message == \"Missing error handling\""
    );
}

#[test]
fn server_cycle_approve_gemini() {
    let port = find_free_port();
    let child = spawn_hook_flow(HOOK_INPUT_GEMINI, port);

    assert!(
        wait_for_port(port, Duration::from_secs(10)),
        "server did not start within 10 seconds on port {port}"
    );

    let response = ureq::post(&format!("http://127.0.0.1:{port}/api/decide"))
        .send_json(serde_json::json!({ "behavior": "allow" }))
        .expect("POST /api/decide failed");
    assert_eq!(response.status(), 200, "expected 200 OK from /api/decide");

    let output = child.wait_with_output().expect("failed to wait for child");
    assert!(output.status.success(), "expected exit code 0");

    let json: serde_json::Value =
        serde_json::from_slice(&output.stdout).expect("stdout is not valid JSON");

    // Gemini format: flat {decision: "allow"} — no hookSpecificOutput
    assert_eq!(
        json["decision"].as_str(),
        Some("allow"),
        "Gemini approve: expected decision == \"allow\""
    );
    assert!(
        json.get("hookSpecificOutput").is_none(),
        "Gemini approve: must NOT have hookSpecificOutput key"
    );
}

#[test]
fn server_cycle_deny_gemini() {
    let port = find_free_port();
    let child = spawn_hook_flow(HOOK_INPUT_GEMINI, port);

    assert!(
        wait_for_port(port, Duration::from_secs(10)),
        "server did not start within 10 seconds on port {port}"
    );

    let response = ureq::post(&format!("http://127.0.0.1:{port}/api/decide"))
        .send_json(serde_json::json!({ "behavior": "deny", "message": "Needs tests" }))
        .expect("POST /api/decide failed");
    assert_eq!(response.status(), 200, "expected 200 OK from /api/decide");

    let output = child.wait_with_output().expect("failed to wait for child");
    assert!(output.status.success(), "expected exit code 0");

    let json: serde_json::Value =
        serde_json::from_slice(&output.stdout).expect("stdout is not valid JSON");

    assert_eq!(
        json["decision"].as_str(),
        Some("deny"),
        "Gemini deny: expected decision == \"deny\""
    );
    assert_eq!(
        json["reason"].as_str(),
        Some("Needs tests"),
        "Gemini deny: expected reason == \"Needs tests\""
    );
    assert!(
        json["systemMessage"]
            .as_str()
            .unwrap_or("")
            .contains("Plan denied"),
        "Gemini deny: systemMessage should contain \"Plan denied\""
    );
}
