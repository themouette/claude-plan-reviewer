use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};

// Fixture constants — raw JSON injected as stdin
const HOOK_INPUT_CLAUDE: &str = include_str!("../fixtures/hook_input_claude.json");
const HOOK_INPUT_GEMINI: &str = include_str!("../fixtures/hook_input_gemini.json");

/// Return the path to the compiled `plan-reviewer` binary.
/// Uses `CARGO_BIN_EXE_plan_reviewer` env var set by Cargo during test compilation.
fn binary_path() -> std::path::PathBuf {
    assert_cmd::cargo::cargo_bin("plan-reviewer")
}

/// Read stderr lines from `reader` until the "Review UI: <url>" line is found.
/// Returns `(url, port)`. Panics if the line is not found or if parsing fails.
///
/// Parses the URL generically — works regardless of the host (127.0.0.1, a VM IP,
/// or any value set via `--base-url`).
fn read_review_line_from_stderr<R: std::io::Read>(reader: R) -> (String, u16) {
    let reader = BufReader::new(reader);
    for line in reader.lines() {
        let line = line.expect("failed to read stderr line");
        if let Some(url) = line.strip_prefix("Review UI: ") {
            let port = parse_port_from_url(url).unwrap_or_else(|| {
                panic!("failed to parse port from URL in stderr line: {line:?}")
            });
            return (url.to_string(), port);
        }
    }
    panic!("binary exited before printing 'Review UI:' to stderr");
}

/// Extract the port number from a URL string like `http://host:PORT/path`.
fn parse_port_from_url(url: &str) -> Option<u16> {
    let without_scheme = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))
        .unwrap_or(url);
    let host_port = without_scheme.split('/').next().unwrap_or("");
    host_port.rsplit(':').next()?.trim().parse().ok()
}

fn read_port_from_stderr<R: std::io::Read>(reader: R) -> u16 {
    read_review_line_from_stderr(reader).1
}

/// Spawn the binary with `--no-browser --port 0`, write `fixture_json` to
/// stdin, then CLOSE stdin (critical: the binary's `read_to_string` blocks on
/// stdin until EOF; not closing stdin causes a deadlock — see RESEARCH.md Pitfall 4).
///
/// Reads the OS-assigned port from the binary's stderr ("Review UI: <url>")
/// before returning — this is race-free because the binary has already bound the port
/// when it prints that line.
///
/// Returns `(Child, port)`. The caller must call `wait_with_output()` to collect
/// stdout/stderr after posting a decision.
fn spawn_hook_flow(fixture_json: &str) -> (std::process::Child, tempfile::TempDir, u16) {
    let home = tempfile::TempDir::new().unwrap();

    let mut child = Command::new(binary_path())
        .env("HOME", home.path())
        .args(["--no-browser", "--port", "0"])
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

    // Read the port the binary bound to from its stderr output.
    // The binary prints "Review UI: <url>" once the server is ready.
    let stderr = child.stderr.take().expect("stderr not captured");
    let port = read_port_from_stderr(stderr);

    (child, home, port)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[test]
fn server_cycle_approve_claude() {
    let (child, _home, port) = spawn_hook_flow(HOOK_INPUT_CLAUDE);

    // POST allow decision — port was read from stderr, so the server is already up
    let response = ureq::post(&format!("http://127.0.0.1:{port}/api/decide"))
        .send_json(serde_json::json!({ "behavior": "allow" }))
        .expect("POST /api/decide failed");
    assert_eq!(response.status(), 200, "expected 200 OK from /api/decide");

    // Binary should exit within ~4 seconds (3s watchdog after decision)
    let output = child.wait_with_output().expect("failed to wait for child");
    assert!(output.status.success(), "expected exit code 0");

    assert!(
        !output.stdout.is_empty(),
        "stdout was empty — binary may have exited before writing JSON"
    );
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
    let (child, _home, port) = spawn_hook_flow(HOOK_INPUT_CLAUDE);

    // POST deny decision with message
    let response = ureq::post(&format!("http://127.0.0.1:{port}/api/decide"))
        .send_json(serde_json::json!({ "behavior": "deny", "message": "Missing error handling" }))
        .expect("POST /api/decide failed");
    assert_eq!(response.status(), 200, "expected 200 OK from /api/decide");

    let output = child.wait_with_output().expect("failed to wait for child");
    assert!(output.status.success(), "expected exit code 0");

    assert!(
        !output.stdout.is_empty(),
        "stdout was empty — binary may have exited before writing JSON"
    );
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
    let (child, _home, port) = spawn_hook_flow(HOOK_INPUT_GEMINI);

    let response = ureq::post(&format!("http://127.0.0.1:{port}/api/decide"))
        .send_json(serde_json::json!({ "behavior": "allow" }))
        .expect("POST /api/decide failed");
    assert_eq!(response.status(), 200, "expected 200 OK from /api/decide");

    let output = child.wait_with_output().expect("failed to wait for child");
    assert!(output.status.success(), "expected exit code 0");

    assert!(
        !output.stdout.is_empty(),
        "stdout was empty — binary may have exited before writing JSON"
    );
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
    let (child, _home, port) = spawn_hook_flow(HOOK_INPUT_GEMINI);

    let response = ureq::post(&format!("http://127.0.0.1:{port}/api/decide"))
        .send_json(serde_json::json!({ "behavior": "deny", "message": "Needs tests" }))
        .expect("POST /api/decide failed");
    assert_eq!(response.status(), 200, "expected 200 OK from /api/decide");

    let output = child.wait_with_output().expect("failed to wait for child");
    assert!(output.status.success(), "expected exit code 0");

    assert!(
        !output.stdout.is_empty(),
        "stdout was empty — binary may have exited before writing JSON"
    );
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

#[test]
fn server_cycle_ping_returns_200() {
    let (child, _home, port) = spawn_hook_flow(HOOK_INPUT_CLAUDE);

    // Hit the new heartbeat endpoint. Statelessness check: GET only, no body.
    let response = ureq::get(&format!("http://127.0.0.1:{port}/api/ping"))
        .call()
        .expect("GET /api/ping failed");
    assert_eq!(response.status(), 200, "GET /api/ping must return 200 OK");

    // Defend against SPA fallback masking a missing route: the SPA fallback
    // serves index.html (text/html) for any unknown path. A real /api/ping
    // route returns no body and no Content-Type: text/html. We assert the
    // response is NOT HTML — if the route were removed, the fallback would
    // serve index.html and this assertion would fail.
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    assert!(
        !content_type.contains("text/html"),
        "GET /api/ping returned text/html — route is missing and SPA fallback served index.html (content-type: {content_type:?})"
    );

    // Clean up: post a decision so the binary exits cleanly. Without this,
    // the spawned child blocks on the decision channel and the test would
    // hang on wait_with_output.
    let decide = ureq::post(&format!("http://127.0.0.1:{port}/api/decide"))
        .send_json(serde_json::json!({ "behavior": "allow" }))
        .expect("POST /api/decide failed");
    assert_eq!(decide.status(), 200);

    let output = child.wait_with_output().expect("failed to wait for child");
    assert!(
        output.status.success(),
        "binary exited non-zero after ping + decide cycle"
    );
}

/// Spawn the binary in `code-review` mode with `--no-browser --port 0`.
/// The code-review subcommand reads no hook input from stdin, so stdin is set
/// to Stdio::null() (no pipe to write to, no EOF needed).
///
/// Reads the OS-assigned port from the binary's stderr ("Review UI: <url>")
/// before returning — this is race-free because the binary has already bound the port
/// when it prints that line.
///
/// Returns `(Child, TempDir, port)`. The caller holds the TempDir until after
/// `wait_with_output()` completes so the home directory outlives the child process.
fn spawn_code_review_flow() -> (std::process::Child, tempfile::TempDir, u16) {
    let home = tempfile::TempDir::new().unwrap();

    let mut child = Command::new(binary_path())
        .env("HOME", home.path())
        .args(["--no-browser", "--port", "0", "code-review"])
        .stdin(Stdio::null()) // code-review reads no stdin
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("failed to spawn plan-reviewer code-review");

    // Read the port the binary bound to from its stderr output.
    let stderr = child.stderr.take().expect("stderr not captured");
    let port = read_port_from_stderr(stderr);

    (child, home, port)
}

// ---------------------------------------------------------------------------
// --bind and --base-url integration tests
// ---------------------------------------------------------------------------

/// Spawn hook flow with extra CLI arguments inserted before the subcommand.
fn spawn_hook_flow_with_args(
    fixture_json: &str,
    extra_args: &[&str],
) -> (std::process::Child, tempfile::TempDir, String, u16) {
    let home = tempfile::TempDir::new().unwrap();
    let mut args = vec!["--no-browser", "--port", "0"];
    args.extend_from_slice(extra_args);
    args.push("review-hook");

    let mut child = Command::new(binary_path())
        .env("HOME", home.path())
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("failed to spawn plan-reviewer");

    child
        .stdin
        .as_mut()
        .unwrap()
        .write_all(fixture_json.as_bytes())
        .unwrap();
    drop(child.stdin.take());

    let stderr = child.stderr.take().expect("stderr not captured");
    let (url, port) = read_review_line_from_stderr(stderr);

    (child, home, url, port)
}

#[test]
fn server_cycle_explicit_bind_works() {
    // --bind 127.0.0.1 is the default, but passing it explicitly should produce
    // identical behavior — this verifies the flag is threaded correctly.
    let (child, _home, url, port) =
        spawn_hook_flow_with_args(HOOK_INPUT_CLAUDE, &["--bind", "127.0.0.1"]);

    assert!(
        url.starts_with("http://127.0.0.1:"),
        "printed URL should use 127.0.0.1 bind address, got: {url}"
    );

    let resp = ureq::get(&format!("http://127.0.0.1:{port}/api/ping"))
        .call()
        .expect("GET /api/ping failed");
    assert_eq!(resp.status(), 200);

    ureq::post(&format!("http://127.0.0.1:{port}/api/decide"))
        .send_json(serde_json::json!({ "behavior": "allow" }))
        .expect("POST /api/decide failed");
    let output = child.wait_with_output().expect("failed to wait for child");
    assert!(output.status.success(), "binary exited non-zero");
}

#[test]
fn server_cycle_base_url_overrides_printed_url() {
    // --base-url sets the host shown to the user / opened in the browser,
    // independently from --bind. The server still binds on 127.0.0.1 and is
    // reachable there; the printed URL uses the base-url host.
    let (child, _home, url, port) = spawn_hook_flow_with_args(
        HOOK_INPUT_CLAUDE,
        &["--bind", "127.0.0.1", "--base-url", "http://127.0.0.2"],
    );

    assert!(
        url.starts_with("http://127.0.0.2:"),
        "printed URL should use --base-url host, got: {url}"
    );

    // Server is reachable on the bind address (127.0.0.1), not necessarily the base-url
    let resp = ureq::get(&format!("http://127.0.0.1:{port}/api/ping"))
        .call()
        .expect("GET /api/ping on bind address failed");
    assert_eq!(resp.status(), 200);

    ureq::post(&format!("http://127.0.0.1:{port}/api/decide"))
        .send_json(serde_json::json!({ "behavior": "allow" }))
        .expect("POST /api/decide failed");
    let output = child.wait_with_output().expect("failed to wait for child");
    assert!(output.status.success(), "binary exited non-zero");
}

#[test]
fn server_cycle_ipv6_bind_works() {
    // Verify that --bind ::1 starts the server and the API is reachable on the
    // IPv6 loopback address. This exercises the SocketAddr::new path in server.rs
    // which correctly brackets IPv6 addresses (bare "::1:port" is invalid syntax).
    let (child, _home, _url, port) =
        spawn_hook_flow_with_args(HOOK_INPUT_CLAUDE, &["--bind", "::1"]);

    let resp = ureq::get(&format!("http://[::1]:{port}/api/ping"))
        .call()
        .expect("GET /api/ping on [::1] failed");
    assert_eq!(resp.status(), 200);

    ureq::post(&format!("http://[::1]:{port}/api/decide"))
        .send_json(serde_json::json!({ "behavior": "allow" }))
        .expect("POST /api/decide on [::1] failed");
    let output = child.wait_with_output().expect("failed to wait for child");
    assert!(output.status.success(), "binary exited non-zero");
}

#[test]
fn server_cycle_code_review_submit() {
    let (child, _home, port) = spawn_code_review_flow();

    // POST code-review payload — no "behavior" key (this is the shape the
    // code-review frontend sends). The current handler requires "behavior" and
    // returns 422 (RED state). After the fix (Wave 1) this returns 200.
    let response = ureq::post(&format!("http://127.0.0.1:{port}/api/decide"))
        .send_json(serde_json::json!({ "message": "looks good", "comments": [] }))
        .expect("POST /api/decide failed");
    assert_eq!(
        response.status(),
        200,
        "expected 200 OK — schema mismatch would return 422"
    );

    let output = child.wait_with_output().expect("failed to wait for child");
    assert!(output.status.success(), "expected exit code 0");

    assert!(
        !output.stdout.is_empty(),
        "stdout was empty — binary may have exited before writing JSON"
    );
    let json: serde_json::Value =
        serde_json::from_slice(&output.stdout).expect("stdout is not valid JSON");

    // code-review flow uses build_opencode_output — flat {behavior: "allow"}
    assert_eq!(
        json["behavior"].as_str(),
        Some("allow"),
        "code-review submit: expected behavior == \"allow\" in stdout"
    );
}

#[cfg(test)]
mod parse_port_tests {
    use super::parse_port_from_url;

    #[test]
    fn ipv4_with_path() {
        assert_eq!(parse_port_from_url("http://127.0.0.1:8080/"), Some(8080));
        assert_eq!(
            parse_port_from_url("http://192.168.1.42:3456/code-review"),
            Some(3456)
        );
    }

    #[test]
    fn ipv4_without_path() {
        assert_eq!(parse_port_from_url("http://127.0.0.1:9000"), Some(9000));
    }

    #[test]
    fn https_scheme() {
        assert_eq!(
            parse_port_from_url("https://myserver.local:4433/"),
            Some(4433)
        );
    }

    #[test]
    fn ipv6_with_port() {
        assert_eq!(parse_port_from_url("http://[::1]:8080/"), Some(8080));
    }

    #[test]
    fn not_a_url() {
        assert_eq!(parse_port_from_url("not-a-url"), None);
        assert_eq!(parse_port_from_url(""), None);
    }
}
