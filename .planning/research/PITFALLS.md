# Pitfalls Research

**Domain:** Multi-tool AI coding agent hook manager (Rust binary + React+TS frontend)
**Researched:** 2026-04-10, updated 2026-05-05 (v0.5.0 Offline Resilience additions)
**Confidence:** HIGH for existing system pitfalls, MEDIUM for opencode/codestral integration pitfalls (config formats still evolving), LOW for codestral as coding agent hook target

---

## Critical Pitfalls

### Pitfall 1: opencode Does Not Have an ExitPlanMode-Equivalent Hook

**What goes wrong:**
The integration.rs stubs label opencode as "unsupported" because "OpenCode does not have a plan approval hook in its config format." This assessment may have been correct at v0.1.0, but the opencode ecosystem is moving fast. Implementing the opencode integration by assuming it mirrors Claude Code's `ExitPlanMode` PermissionRequest pattern will produce a non-functional integration.

**Why it happens:**
OpenCode's hook mechanism is fundamentally different from Claude Code's. Claude Code uses a stdio JSON protocol: a hook binary receives a JSON payload on stdin and writes a structured JSON decision to stdout. OpenCode's hook system is plugin-based (TypeScript/JavaScript files in `.opencode/plugin/` or `~/.config/opencode/plugin/`), with event-driven hooks like `tool.execute.before`. The `permission.asked` hook exists in the SDK types but as of early 2026 is documented as not being triggered by the permission system (GitHub issue #7006). There is no direct equivalent to ExitPlanMode that accepts an external binary via a settings file key.

**How to avoid:**
Before implementing, verify the current opencode hook model against official docs at https://opencode.ai/docs/ and the changelog. The correct integration path for opencode (if it exists) is likely a plugin file, not a settings.json entry. Implement only after confirming the exact hook API, stdin/stdout contract, and whether blocking execution is possible. Flag opencode as "coming soon" with a link to the tracked issue rather than shipping a broken integration.

**Warning signs:**
- Implementing opencode install by mimicking `install_claude` and writing to `~/.config/opencode/opencode.json` without verifying the config schema
- Assuming the `supported: false` stub in integration.rs is just a placeholder that can be flipped to `true` without spec work
- The opencode `permission.asked` plugin hook being listed in types but never fired (confirmed bug as of early 2026)

**Phase to address:**
Integration research phase (before any opencode install/uninstall code is written). Flag as "needs spec validation" in the phase plan.

---

### Pitfall 2: Codestral Is a Model, Not a Coding Agent — No Hook Infrastructure Exists

**What goes wrong:**
The current integration.rs stub says: "Codestral is a model, not a coding agent with hook infrastructure. No settings file to configure." This is accurate. However, the v0.3.0 milestone lists "codestral integration — full hook wiring" as a target feature. If this is pursued without resolving what "codestral integration" actually means at the agent level, the feature ships as unreachable.

**Why it happens:**
Codestral is Mistral AI's code generation model. As a model, it has no agent runtime, no hooks, and no config file path. The agent using Codestral (e.g., Continue.dev, Cursor, a custom CLI) would need its own hook support. "Codestral integration" is likely shorthand for "integration with whatever agent runtime uses Codestral as its model," not integration with the model itself.

**How to avoid:**
Resolve the milestone ambiguity before coding: which agent runtime is meant? Mistral Code (the CLI agent, announced 2025)? Continue.dev configured to use Codestral? A generic "Mistral agent" integration? Each has a different config path and hook format. If no specific agent runtime is targeted, remove codestral from the milestone scope or rename it to accurately describe the target.

**Warning signs:**
- The phrase "codestral integration" in the milestone scope without specifying which agent runtime
- Writing `codestral_settings_path()` by analogy with `claude_settings_path()` without finding the actual path
- "codestral supported: true" flip in integration.rs without a corresponding config path + hook format discovered

**Phase to address:**
Pre-implementation definition phase. Resolve scope ambiguity before the integration phase begins.

---

### Pitfall 3: stdout Pollution Kills the Hook Protocol

**What goes wrong:**
The hook flow (default subcommand) writes exactly one thing to stdout: the JSON decision from `serde_json::to_writer(std::io::stdout(), &output)`. Any other write to stdout — a stray `println!`, a library that logs to stdout, or a debug build flag left on — causes Claude Code (and any future tool) to receive malformed JSON, silently breaking plan review. The hook caller sees the output as garbage and either errors out or applies a wrong decision.

**Why it happens:**
Rust's `println!` is stdout; `eprintln!` is stderr. The existing code is disciplined about this (install.rs/uninstall.rs use `println!` for status, hook flow uses `eprintln!` for diagnostics). The risk grows when adding new integration code that reuses patterns from install.rs in the hook path, or when a new dependency calls `println!` internally.

**How to avoid:**
The existing architecture is correct: only `serde_json::to_writer(stdout(), &output)` touches stdout in the hook path. Enforce this as a rule when adding new integration detection code: any "is this integration installed?" check called during the hook flow must use only `eprintln!` for diagnostics. Add an integration test that pipes the binary in hook mode and asserts `stdout` is valid JSON and `stdout.lines().count() == 1`.

**Warning signs:**
- New code in `run_hook_flow()` or `async_main()` calling `println!`
- A dependency added to `Cargo.toml` that prints to stdout on initialization
- install/uninstall helper functions being called (accidentally) from the hook path

**Phase to address:**
Hook flow phase; verified by test that asserts stdout is parseable JSON.

---

### Pitfall 4: Config Path Collision When Multiple Integrations Share a Config File

**What goes wrong:**
Claude Code uses `~/.claude/settings.json`. If opencode or any other agent also uses a config file at a path that plan-reviewer writes to, multiple integrations could corrupt each other's config on install/uninstall. More subtly: if two integrations use the same config key structure (e.g., both use a `hooks` key), the idempotency check for integration A might falsely pass for integration B.

**Why it happens:**
Each integration has its own config schema, but the code currently only implements Claude Code's schema. When opencode support is added, the developer may copy the `install_claude` pattern. If opencode uses a `hooks` key with a different sub-schema, the idempotency check (`claude_is_installed`) could be accidentally applied to the wrong config file, or the opencode idempotency check might match on a Claude-installed entry.

**How to avoid:**
Each integration must have its own:
- Config path function (e.g., `opencode_settings_path(home: &str) -> PathBuf`)
- Idempotency key (a unique marker that is specific to plan-reviewer and that integration)
- Install/uninstall functions that never touch other integrations' files

Never share idempotency logic across integrations. The `claude_is_installed` function checks for `"matcher": "ExitPlanMode"` — the opencode equivalent must check for a different, opencode-specific marker.

**Warning signs:**
- `is_installed` functions that take a generic `serde_json::Value` and apply the same check across integrations
- A single `settings_path(integration: &IntegrationSlug)` function that dispatches to different paths — correct approach, but only if each branch has integration-specific idempotency logic
- Uninstall removing entries from the wrong config file

**Phase to address:**
Integration install/uninstall phase; verified by unit tests for each integration's idempotency check.

---

### Pitfall 5: Config File Merging in opencode Breaks Naive Write Strategies

**What goes wrong:**
OpenCode merges multiple config files (global at `~/.config/opencode/opencode.json`, project-local at `./opencode.json`, plus env vars and XDG paths). Writing only to the global config may not produce the expected result if a project-level config overrides it. Conversely, writing to a project-level config installs the hook only for that project, not globally.

**Why it happens:**
Claude Code has a single global settings.json. OpenCode has a layered merge system. The naive approach of mimicking `install_claude` by writing to a single file will either install the hook only for one project (wrong) or miss that the hook is already installed via a higher-precedence layer (idempotency failure).

**How to avoid:**
Default to writing the global config file (`~/.config/opencode/opencode.json`) for the opencode integration, but document this limitation. Warn users if a project-level config exists that might override the hook. The idempotency check should read all config layers (or at minimum the global one) to determine if the hook is already active.

**Warning signs:**
- opencode install succeeds silently but the hook never fires because a project config overrides it
- install reports "already installed" when the hook is in a project config that was deleted
- An opencode `is_installed` check that reads only one config file layer

**Phase to address:**
opencode integration phase; verify with manual test that global install works for a project without a local opencode.json.

---

### Pitfall V5-01: Heartbeat Transitions to Offline State on Transient Network Blip, Not Server Death

**What goes wrong:**
The heartbeat polls `/api/ping`. A single failed poll — caused by a browser's brief GC pause, a slow DNS lookup on localhost, or a 20ms packet loss — triggers the "server is dead" offline state. The user sees the UI shift to clipboard mode while the server is still running. This is especially bad because the transition should be one-way: once the UI believes the server is dead and shows the clipboard fallback, it cannot go back to online submit (because the user may have already copied JSON and the server may have actually died in the meantime).

**Why it happens:**
A naive implementation uses a single failed fetch as the offline signal: `fetch('/api/ping').catch(() => setOffline(true))`. One failed request is not a reliable signal. Local servers on 127.0.0.1 do occasionally drop a request when the OS is under load, even if the process is alive.

**Consequences:**
- False offline state → user copies JSON and pastes into Claude → Claude receives it, processes it → the server is still running and waiting for a POST to `/api/decide` → the Rust binary eventually times out at 540 seconds and emits a deny decision that races with the pasted result.
- If the server is actually alive, the `run_review_flow` function will time out and write its own JSON to stdout, potentially confusing Claude (double-result scenario in the `annotate.md` Step 4 path).

**Prevention:**
Require N consecutive failures before declaring offline (minimum 2, recommend 3). The poll interval and failure count must be tuned together: 5-second interval with 3 required failures = 15 seconds to confirm death. That window is acceptable for a 540-second timeout. Use `AbortSignal.timeout()` on each ping fetch so a hung connection does not prevent the next poll from starting.

**Detection (warning signs):**
- Single-failure offline transition in code review
- No `AbortSignal` or timeout on the ping fetch (a hung connection blocks the interval)
- `setInterval` without clearing on unmount (the poller runs forever if component ever unmounts)
- Polling continues after the UI enters `offline` or `confirmed` states

**Phase to address:**
Heartbeat phase. Write a test that mocks the fetch to fail once then succeed, and assert the UI remains in `reviewing` state.

---

### Pitfall V5-02: Clipboard API Fails Silently When Called Outside User Gesture or Without Document Focus

**What goes wrong:**
`navigator.clipboard.writeText()` requires both a secure context (HTTPS or localhost — satisfied here) and transient user activation (a recent user gesture). When called in a `useEffect` or event handler that fires asynchronously after a timer, Firefox and Safari reject the call with a `NotAllowedError` and the promise rejects silently if the `.catch()` is not handled. Chrome is more permissive but not guaranteed.

The specific risk: if the "Copy to clipboard" button's `onClick` handler does any async work before calling `writeText()` — for example, re-serializing annotations — the async gap may break the transient activation chain in Safari/Firefox.

**Why it happens:**
`navigator.clipboard` is a Permissions Policy-gated API. Transient activation expires after a short window (typically 1 second in WebKit). Any async boundary (awaited fetch, promise chain, `setTimeout` with 0ms delay) between the user gesture and the `writeText()` call may void the activation in stricter browsers. Since the target users are macOS developers, Safari is a real risk.

**Consequences:**
The user clicks "Copy to clipboard", nothing is copied (or a browser permission dialog appears that most users don't know to accept), and no feedback is given because the error is swallowed. The user then pastes nothing into Claude.

**Prevention:**
- Serialize annotations synchronously before entering the async boundary: compute the JSON string first, then call `navigator.clipboard.writeText(json)` directly inside the `onClick` handler without any `await` before it.
- Wrap in try/catch and show a visible error banner if the API is unavailable or denied.
- Provide a textarea fallback showing the JSON that the user can manually copy (select-all + Cmd+C always works). This fallback must be trivially accessible — not behind another click.
- Never call `writeText()` from a `useEffect` or timer callback.

**Detection (warning signs):**
- `async function handleClipboard() { const json = await serialize(); await navigator.clipboard.writeText(json) }` — double async boundary
- No catch handler on the clipboard promise
- No visible user feedback (success toast or error message) after the copy attempt
- No textarea fallback for browsers where the API is blocked

**Phase to address:**
Clipboard fallback phase. Manual test: trigger clipboard copy in Safari and Firefox, confirm copy succeeds and is followed by visible success feedback.

---

### Pitfall V5-03: The Approve Path Hits `/api/decide` After Server Death — Error State Is Wrong

**What goes wrong:**
The current `approve()` and `deny()` handlers both `catch()` errors and transition `appState` to `'error'`, which renders `ErrorView` ("Could not load plan / The plan reviewer failed to connect to the local server. Check that the binary is still running, then reload this page."). When the server is dead intentionally (the offline resilience scenario), this error message is confusing — the user gets the error because they clicked "Approve" on a dead server, not because anything broke.

The deeper problem: the existing `AppState` type is `'loading' | 'error' | 'reviewing' | 'confirmed'`. Adding offline resilience requires distinguishing between:
1. Initial load failure (server was never reachable) — current `error` state
2. Server died after load, user still annotating — new `offline` state
3. User submits while offline — clipboard copy, then `confirmed` (or a new `clipboard-done` state)

Conflating (1) and (2) into the same `error` state means the UI shows the wrong message and wrong buttons.

**Why it happens:**
The existing state machine was designed for a binary outcome: server is up at load time, or it isn't. The offline resilience feature introduces a third timeline: server dies mid-session. Without explicitly modeling this in the state machine, the offline state leaks into the `error` state.

**Prevention:**
Extend `AppState` before writing any heartbeat logic:
```typescript
type AppState = 'loading' | 'error' | 'reviewing' | 'offline' | 'confirmed'
```
Where `offline` means: data is loaded, the server is confirmed dead, the user can still annotate and copy to clipboard. Every conditional that was `appState !== 'reviewing'` must be audited — `offline` may need to act like `reviewing` for annotation purposes but like a different state for submit purposes.

The `approve()` and `deny()` functions must gate on `appState === 'reviewing'` (currently they do) but must NOT transition to `'error'` when a network failure occurs in the `offline` flow — they must either be disabled or redirect to the clipboard path.

**Detection (warning signs):**
- `approve()` and `deny()` still call `fetch('/api/decide')` when `appState === 'offline'`
- `ErrorView` renders when the server dies mid-session (not just on initial load failure)
- The "Approve" button is still present and clickable in offline mode with no change to its behavior
- `offline` state not in the TypeScript union — TypeScript does not prevent `setAppState('offline')`

**Phase to address:**
State machine phase (before heartbeat implementation). Define the full `AppState` union with all transitions before implementing any offline behavior.

---

### Pitfall V5-04: Stale Heartbeat Interval Continues After Submit or Confirm

**What goes wrong:**
The heartbeat `setInterval` is set up in a `useEffect`. If the cleanup function is not correct, or if the heartbeat is not cancelled when the app enters `confirmed` or `error` state, the interval continues firing. After the user submits and transitions to `confirmed`, each subsequent ping to `/api/ping` will fail (the server exits after the decision is written). Each failure increments the failure counter. If the counter hits the threshold, `setOffline(true)` fires on a component that is in `confirmed` state — potentially re-rendering into the offline UI, overwriting the confirmation screen.

**Why it happens:**
`setInterval` cleanup in React requires the cleanup function returned from `useEffect` to call `clearInterval`. If the `useEffect` dependency array includes `appState`, React will re-run the effect on every state transition (correct: it will also clear the previous interval). But if the implementation uses a ref to hold the interval ID and clears it only on unmount (the `[]` deps pattern), the interval fires in all states.

**Consequences:**
- After approval, the UI briefly shows the "Server went offline" banner before the component unmounts.
- The 3-second watchdog in `async_main` keeps the server alive for 3 seconds after decision — so the first ping after confirm may succeed, but subsequent ones fail, triggering false offline transition.

**Prevention:**
Gate the offline transition: `if (appState !== 'reviewing') return` inside the heartbeat failure handler. Stop polling as soon as `appState` is not `'reviewing'`. Prefer stopping the interval immediately when entering `offline`, `confirmed`, or `error` states rather than relying on component unmount.

**Detection (warning signs):**
- Heartbeat `useEffect` has `[]` deps with no state check inside the failure handler
- `setOffline(true)` can be called when `appState === 'confirmed'`
- The confirmed screen flickers or disappears after the server exits

**Phase to address:**
Heartbeat phase. Test: trigger approve, wait 4 seconds, assert `confirmed` screen is still visible (not replaced by offline banner).

---

### Pitfall V5-05: The `run_review_flow` Stdout Write Races With Clipboard JSON

**What goes wrong:**
`plan-reviewer review <file>` runs in the background via `run_in_background: true` in the annotate.md Bash tool call. The process eventually writes its decision to stdout (either via user action through `/api/decide`, or via the 540-second timeout). The annotate.md Step 4 currently instructs Claude to parse that stdout JSON.

In the offline fallback, the user copies JSON to clipboard and pastes it into the conversation. But the Rust process is still running (the 540-second timeout has not fired). Claude now receives:
1. The pasted clipboard JSON in the conversation (as user input)
2. The eventual stdout JSON from the Rust process (whenever it times out or the server receives a decision)

These two JSON objects will have different shapes. The pasted clipboard JSON uses `{"behavior":"allow"}` or `{"behavior":"deny","message":"..."}` — the same format as the `run_review_flow` output (which uses `build_opencode_output`). But if Claude has already processed the pasted clipboard result and started acting on it, the belated stdout result is noise.

**Why it happens:**
`run_in_background: true` means Claude waits for the process to complete and reads its stdout. When the user pastes clipboard JSON before the process completes, Claude is handling two result streams for the same review.

**Consequences:**
- If Step 4 of annotate.md blindly trusts stdout, the clipboard paste is ignored.
- If Step 4 is updated to accept clipboard paste, Claude must know to ignore the eventual stdout result (or the process must be killed before timeout).
- The 540-second timeout means the process keeps the review session "open" for up to 9 minutes after the user has already submitted via clipboard — this is confusing if the user tries to start a new review.

**Prevention:**
The annotate.md Step 4 update must explicitly teach Claude the disambiguation logic:
- If the user pastes JSON that matches the expected format before the background process completes, treat that as the result and describe the process as "server timed out, result was provided via clipboard."
- Claude should not wait for the background process stdout once a valid clipboard paste is received.
- The clipboard JSON format must be identical to the stdout format so Step 4 does not need format-specific parsing.

The `/api/ping` endpoint response does not need to carry session data, but the clipboard JSON must include the same `behavior` / `message` fields as the stdout result — no new fields that Claude's Step 4 parser won't understand.

**Detection (warning signs):**
- Step 4 updated to handle pasted JSON, but the Rust process eventually writes a second result to stdout after timeout
- The clipboard JSON format differs from the stdout format (e.g., different field names)
- annotate.md Step 4 does not tell Claude what to do when both pasted JSON and stdout JSON are present

**Phase to address:**
Slash command update phase. The annotate.md rewrite must be co-designed with the clipboard JSON format to ensure both paths produce identical-format output.

---

### Pitfall V5-06: `/api/ping` Endpoint Added to Server But Not to Decision-Consumed State

**What goes wrong:**
The `/api/ping` endpoint must exist on the axum router and return 200 as long as the server is alive. This is straightforward to add. The subtle pitfall: the existing `CancellationToken` is dropped immediately after `start_server` returns (line 131 in server.rs: `drop(token)`), which means graceful shutdown is not used — the process exits via `process::exit(0)` from the 3-second watchdog. When the Rust process is killed by Claude Code's timeout, it receives SIGTERM (on Unix), and the OS forcibly terminates it. Any in-flight `/api/ping` request at that moment gets a TCP RST (connection reset) rather than a clean HTTP response.

This is fine for the heartbeat — a TCP RST correctly signals "server is gone" and the `fetch()` promise rejects with a network error. The pitfall is that the heartbeat code must treat both `response.ok === false` AND a thrown network error as a failure signal, not just one of those two.

**Why it happens:**
A common mistake is `const ok = await fetch('/api/ping').then(r => r.ok).catch(() => false)` — this correctly handles the network error case. But if the code is written as:
```typescript
const res = await fetch('/api/ping')
if (!res.ok) failureCount++
```
...the throw from `fetch()` on network error is uncaught, and the interval silently stops running (the uncaught promise rejection does not increment the counter).

**Prevention:**
Always wrap the ping fetch in try/catch, and count both `!res.ok` and thrown exceptions as failures:
```typescript
try {
  const res = await fetch('/api/ping', { signal: AbortSignal.timeout(3000) })
  if (res.ok) successCount++; else failureCount++
} catch {
  failureCount++
}
```

The `AbortSignal.timeout(3000)` is critical — without it, a fetch to a dead server can hang for 60+ seconds (browser's TCP connection timeout) before rejecting. The heartbeat interval would effectively pause for 60 seconds, defeating the purpose.

**Detection (warning signs):**
- `fetch('/api/ping')` without `AbortSignal.timeout()` or equivalent
- Heartbeat error handler that only handles `!res.ok` but not the thrown exception
- `console.error` in the catch block but no failure counter increment

**Phase to address:**
Heartbeat phase. Test: kill the server process mid-poll and verify the offline state is reached within poll-interval * (N+1) seconds (not 60+ seconds later).

---

### Pitfall V5-07: Offline State Machine Allows Partial Decision (Approve Without Annotations)

**What goes wrong:**
In the current online flow, the "Approve" button calls `fetch('/api/decide')` which sends `{"behavior":"allow"}` — no annotations, no deny message. This is the expected approval path. In the offline clipboard flow, clicking "Approve" (or "No issues" in the annotate flow) must produce clipboard JSON of `{"behavior":"allow"}` without any annotations. If the clipboard export is implemented only on the "Submit Denial" button (because that's where annotations live), the approve path in offline mode has no clipboard export.

**Why it happens:**
The annotation/deny path is the complex one — it has a deny message + annotations + `serializeAnnotations`. The approve path is trivial online. When implementing offline support, developers naturally focus on the complex deny path and forget that approve also needs a clipboard export path.

**Consequences:**
User wants to approve with no feedback. Server is offline. Clicks "Approve". Nothing happens (the fetch fails silently) or the app transitions to `error`. The approve action is lost.

**Prevention:**
Both approve and deny paths must have offline clipboard behavior:
- Offline approve: copy `{"behavior":"allow"}` to clipboard, show "Copied to clipboard — paste into Claude" message.
- Offline deny: copy `{"behavior":"deny","message":"<serialized>"}` to clipboard, show the same message.
The button labels ("Copy to clipboard") must replace the original button labels in offline mode for both buttons.

**Detection (warning signs):**
- Clipboard export implemented only in the deny flow handler
- The "Approve" button in offline mode still calls `fetch('/api/decide')`
- "Approve" button disabled in offline mode with no clipboard alternative

**Phase to address:**
Clipboard fallback phase. Test: enter offline mode, click Approve, assert clipboard contains `{"behavior":"allow"}`.

---

### Pitfall V5-08: The Serialized Clipboard JSON Does Not Match `build_opencode_output` Format

**What goes wrong:**
`run_review_flow` in main.rs calls `build_opencode_output(&decision)` to produce the stdout JSON. That function produces:
- Allow: `{"behavior":"allow"}`
- Deny: `{"behavior":"deny","message":"<text>"}`

The clipboard export must produce the same JSON shape. If the clipboard export uses a different field name (e.g., `{"decision":"allow"}` or `{"result":"allow","annotations":[...]}` or includes extra fields like `{"behavior":"allow","annotations":[]}`) then annotate.md Step 4 must handle two different formats — one from stdout, one from clipboard. That is brittle and likely to break silently.

**Why it happens:**
The clipboard export is implemented on the frontend in TypeScript, independently of the Rust `build_opencode_output` function. Without an explicit contract test or shared spec, the two implementations drift.

**Prevention:**
- Document the exact clipboard JSON format in the spec before implementing either the frontend clipboard export or the annotate.md Step 4 update.
- The format must be: `{"behavior":"allow"}` or `{"behavior":"deny","message":"<serialized-annotations-string>"}`.
- The message field must contain the same text that `serializeAnnotations(denyMessage, overallComment, annotations)` produces — the existing function output, not a re-structured JSON object.
- Add a TypeScript unit test that asserts the clipboard JSON output matches the expected format for both allow and deny cases.

**Detection (warning signs):**
- Frontend clipboard JSON uses `decision` instead of `behavior` as the key
- Deny clipboard JSON embeds annotations as a nested object rather than a serialized string
- No test for the clipboard JSON output format

**Phase to address:**
Clipboard fallback phase, before annotate.md is updated. The JSON format spec must be pinned before the slash command is rewritten.

---

### Pitfall V5-09: annotate.md Step 4 Pasted JSON Parsing Is Ambiguous — Claude Cannot Reliably Detect It

**What goes wrong:**
The annotate.md Step 4 will be updated to handle pasted JSON as a fallback. But Claude Code's slash command does not have a dedicated "wait for user input" primitive. The updated Step 4 must instruct Claude to recognize when the user has pasted the clipboard JSON as a reply in the conversation — but normal user messages in a review context could also contain JSON-like text. Claude might try to parse a user's comment that happens to contain braces as the fallback result.

**Why it happens:**
The slash command runs in Claude's conversation context. Step 3 launches the background process and Step 4 waits for stdout. Adding "if the user pastes JSON, use that instead" makes Step 4 ambiguous: how does Claude distinguish `{"behavior":"deny","message":"fix the tests"}` pasted by the user as the review result, from `{"behavior":"deny"}` mentioned by the user as an example in a follow-up question?

**Prevention:**
The annotate.md instructions for the pasted JSON path must:
1. Instruct the user to paste only the JSON (not embed it in a sentence) by showing the exact format they will receive.
2. Instruct Claude to accept pasted JSON only if it is the user's complete message or clearly delineated (e.g., in a code block).
3. Specify that the JSON must contain a `behavior` key with value `"allow"` or `"deny"` to be treated as a review result.
4. Explicitly state that this handling only applies if the background process has not yet completed (i.e., the user is pasting before seeing stdout output).

The fallback UX in the browser UI should show a clear instruction like: "Paste this JSON into the Claude conversation as your reply:" followed by the JSON in a code block or textarea.

**Detection (warning signs):**
- Step 4 says "if the user pastes JSON" without specifying what constitutes valid JSON
- No description of the exact format the pasted JSON must have
- Claude confuses a user question about JSON format with the review result
- The clipboard UI shows no instructions for how to paste

**Phase to address:**
Slash command update phase. The annotate.md rewrite must include exact instructions for the pasted-JSON recognition heuristic.

---

### Pitfall V5-10: Process Exit Race — Rust Watchdog Exits Before Stdout Flushes

**What goes wrong:**
`async_main` spawns a 3-second watchdog that calls `std::process::exit(0)` after the decision is received. The decision is returned from `async_main` to the calling function, which then calls `serde_json::to_writer(std::io::stdout(), &output_json)`. If the watchdog fires before this write completes — which is only possible if the write is slow (very large JSON) or if Rust's buffered writer does not flush on `process::exit` — the stdout pipe closes before Claude reads all the bytes.

This is an existing pitfall, not new to v0.5.0, but v0.5.0 increases its surface: when the user submits via clipboard (offline mode), the Rust process hits the 540-second timeout and writes its own deny decision to stdout. The watchdog then fires 3 seconds after that timeout decision. If Claude has already processed the clipboard result in the conversation, this late stdout write is read by Claude as a second result, which Claude may try to process again.

**Prevention:**
The watchdog's 3-second sleep gives the stdout write time to complete (the write is fast — tiny JSON). This is sufficient for the online path. For the offline path, the 540-second timeout is long enough that the user will have already acted on clipboard JSON. The annotate.md Step 4 update must explicitly say: if the background process exits and produces stdout JSON after the user has already pasted clipboard JSON, ignore the stdout result.

**Detection (warning signs):**
- annotate.md Step 4 does not handle the "received stdout result after clipboard paste" case
- The stdout JSON from the timeout decision confuses Claude after a clipboard submit

**Phase to address:**
Slash command update phase. Annotate.md must explicitly address the double-result case.

---

## Moderate Pitfalls

### Pitfall 6: FOUC (Flash of Unstyled Content) on Theme Load

**What goes wrong:**
The theme preference is stored in `localStorage`. On page load, React renders first with the default (dark) CSS variables, then reads localStorage and applies the light theme. This causes a visible flash — the page renders dark, then instantly switches to light. For a tool opened every time Claude Code creates a plan, this flicker is noticed immediately.

**Why it happens:**
The Vite + React setup renders the `<div id="root">` contents after JS hydration. If the theme toggle reads localStorage inside a React `useEffect` or `useState`, it runs after the first paint. The current `index.html` has no inline script in `<head>`, so there is no way to apply the theme class before first paint.

**How to avoid:**
Add a small inline `<script>` in `index.html`'s `<head>` (before any CSS or JS imports) that reads `localStorage.getItem('theme')` and sets `document.documentElement.classList.add('dark')` or `document.documentElement.setAttribute('data-theme', 'dark')`. This runs synchronously before any rendering, eliminating the flash. With Tailwind v4, the `@custom-variant dark` directive must reference the class or attribute the script sets.

**Warning signs:**
- Theme toggle implemented entirely inside React state with no `<head>` script
- The inline script is present but runs after `<script type="module" src="/src/main.tsx">` (wrong order)
- The chosen Tailwind `@custom-variant` selector doesn't match the attribute/class the inline script sets

**Phase to address:**
Theme switcher phase. Verify by loading the page with light theme stored and confirming no visible dark flash.

---

### Pitfall 7: highlight.js CSS Theme Mismatch After Theme Switch

**What goes wrong:**
The current frontend imports `highlight.js/styles/github-dark.css` statically at the top of `App.tsx`. When light mode is added, code blocks will continue to use dark syntax highlighting regardless of the selected theme. Users with light mode enabled will see dark code blocks on a light background — a jarring visual inconsistency.

**Why it happens:**
highlight.js does not bundle paired light/dark themes. Each theme is a separate CSS file. The current static import hardcodes dark mode. Switching themes at runtime requires either swapping the stylesheet link or bundling both themes and toggling via CSS media query or class selector.

**How to avoid:**
Import both `github-dark.css` and `github.css` and use CSS class or data-attribute scoping to activate only one at a time. Move both imports into `index.css` wrapped in the appropriate variant selectors so the Tailwind build handles the scoping. Keep both theme imports from applying simultaneously — last-import-wins without scoping produces broken colors.

**Warning signs:**
- `import 'highlight.js/styles/github-dark.css'` remains as a static top-level import with no light equivalent
- Light mode added to Tailwind but code blocks remain dark
- Both themes imported with no scoping — both apply simultaneously, last-import wins

**Phase to address:**
Theme switcher phase. Verify by toggling theme and checking code block colors match the selected mode.

---

### Pitfall 8: Annotation Type Exhaustiveness — Switch Statements Without Compile-Time Guarantees

**What goes wrong:**
The annotation type system uses a TypeScript union `type AnnotationType = 'comment' | 'delete' | 'replace'`. Multiple switch statements across `AnnotationSidebar.tsx`, `serializeAnnotations.ts`, `App.tsx`, and `types.ts` handle these cases. When new predefined action types are added (e.g., `'clarify' | 'needs-test' | 'out-of-scope'`), each switch must be updated. Missing one silently: `getTypeColor()` falls through to undefined, `getBadgeLabel()` returns undefined, `serializeAnnotations()` silently skips the new type.

**Why it happens:**
TypeScript's union type provides compile-time checking inside switch statements only when `noImplicitReturns` and `strict` are enabled and the switch has a proper default/exhaustive check. The current switches (in `getTypeColor`, `getBadgeLabel`, `getTypeBadgeBackground`, `typeLabel`) have no exhaustive check — they rely on all cases being covered manually.

**How to avoid:**
Add an exhaustive check helper: `function assertNever(x: never): never { throw new Error('Unhandled case: ' + x); }` and add a `default: return assertNever(type)` to each switch on `AnnotationType`. This turns a silent runtime bug into a compile-time error when a new type is added. Alternatively, move all type-specific metadata (color, label, background) into a lookup object keyed by `AnnotationType` so there is a single source of truth.

**Warning signs:**
- New type added to the union in `types.ts` but `serializeAnnotations.ts` compiles without error (means the switch is missing a default: assertNever guard)
- `getTypeColor` returns `undefined` for a new annotation type — the badge renders with no color
- `typeLabel` returns `undefined` in `serializeAnnotations` — the summary line reads `**undefined**: 1`

**Phase to address:**
Annotation type expansion phase. Add exhaustive check guards before adding any new annotation types.

---

### Pitfall 9: Predefined Action Types Must Serialize Meaningfully to the Hook Protocol

**What goes wrong:**
New predefined annotation types like `clarify this`, `needs test`, `search internet`, `out of scope` must produce meaningful text in the `deny` message sent to Claude Code (the `message` field in `HookOutput::deny()`). If a new type serializes as `[SEARCH_INTERNET] on: "some text"` with no further instruction, the AI receiving it may not know what action to take.

**Why it happens:**
The current types (`comment`, `delete`, `replace`) are action-oriented: they tell the AI what to do with the selected text. The new predefined types are more intent-oriented: they tell the AI *why* the reviewer flagged something, not what to do with it. The `serializeAnnotations` function (and its test suite) needs to produce readable, actionable text for these new types that the downstream AI can follow.

**How to avoid:**
Define the serialized text output for each new annotation type before implementing the UI. Each type needs: a human-readable label, a serialization template (what appears in the deny message), and a description of how the AI should respond. Write the serialization spec as a test in `serializeAnnotations.test.ts` before implementing it.

**Warning signs:**
- A new type added to `AnnotationType` union but `serializeAnnotations.test.ts` has no test for it
- The serialized output for `'search-internet'` type is just `[SEARCH_INTERNET] on: "selected text"` with no instruction
- `typeLabel` function not updated for the new type (produces `undefined` in summary)

**Phase to address:**
Annotation type expansion phase. Tests first, implementation second.

---

### Pitfall 10: Tailwind v4 `@custom-variant dark` Completely Replaces `prefers-color-scheme`

**What goes wrong:**
Adding `@custom-variant dark (&:where(.dark, .dark *));` to `index.css` disables the default `prefers-color-scheme: dark` media query behavior. Users who have OS-level dark mode set will no longer get automatic dark mode — they must explicitly set the preference in the UI. On first load (before any localStorage preference is set), the app defaults to whatever the CSS fallback is (likely light), ignoring the OS setting.

**Why it happens:**
Tailwind v4's `@custom-variant dark` completely overrides the default dark variant definition. The default variant uses `@media (prefers-color-scheme: dark)`. Overriding it with a class-only strategy removes the media query behavior entirely.

**How to avoid:**
Use a combined variant that respects both the class/data-attribute and the OS preference when no explicit preference is stored. The variant should: apply dark styles when `[data-theme='dark']` is set explicitly, and fall back to `@media (prefers-color-scheme: dark)` when no `data-theme` is present. The inline `<head>` script should not set `data-theme` when no localStorage value is found — leave the OS preference to take effect naturally.

**Warning signs:**
- After implementing the theme switcher, OS dark mode is ignored on first load
- Users who never opened the theme switcher see the wrong default theme
- `@custom-variant dark` definition uses class-only selector with no media query fallback

**Phase to address:**
Theme switcher phase. Verify by clearing localStorage and checking that OS dark mode preference is honored.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Flipping `supported: true` for opencode/codestral before spec is confirmed | Unblocks UI work | Ships a broken integration that errors on install | Never — keep `supported: false` until the config path and hook format are verified |
| Using `claude_is_installed` logic for opencode idempotency | Reuses existing code | False positives/negatives if config schemas overlap | Never — each integration needs its own idempotency key |
| Static `github-dark.css` import with a TODO comment for light mode | Fast to ship dark-only | Light mode PR forces a CSS refactor | Acceptable in v0.1.0 scope, not acceptable in v0.3.0 theme phase |
| AnnotationType switch without exhaustive guard | Works for current 3 types | Silent runtime failure when 4th type is added | Never for switch statements on a union type that will expand |
| Storing theme in localStorage without inline `<head>` script | Simple implementation | Visible FOUC on every page load for light-mode users | Never — the fix is 5 lines of inline JS |
| Writing opencode config to project-local `opencode.json` | Avoids global config mutation | Hook only works per-project, confuses users | Never — global install is the expected behavior |
| Single-failure heartbeat offline transition | Simple to implement | False offline on transient blip; user loses in-progress annotations | Never — require N consecutive failures |
| Calling `writeText()` after an async gap | Feels clean | Breaks silently in Safari/Firefox (NotAllowedError) | Never — serialize synchronously, then call writeText immediately |
| Clipboard export only on the deny path | Most cases need it on deny | Approve path in offline mode silently does nothing | Never — both approve and deny need clipboard fallback |
| Different JSON format for clipboard vs stdout | Frontend-convenient | Double Step 4 parsing logic in annotate.md; will drift | Never — clipboard JSON must be byte-for-byte compatible with build_opencode_output |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| opencode install | Writing a `hooks.ExitPlanMode` key to `~/.config/opencode/opencode.json` by analogy with Claude Code | opencode uses a plugin file (TypeScript in `~/.config/opencode/plugin/`), not a config key; find the correct event hook and plugin path first |
| opencode idempotency | Checking if "the hook is installed" by reading the config JSON for a marker | The hook likely lives in a plugin file, not the main JSON config; idempotency check must look for the plugin file's existence and content |
| codestral | Treating it as an agent runtime with a settings.json | Codestral is a model; the correct target is an agent runtime that uses Codestral (Mistral Code CLI, Continue.dev, etc.) |
| highlight.js theme | Importing only `github-dark.css` and toggling the theme class | Must import both light and dark themes and use CSS scoping to activate only one at a time |
| Tailwind dark variant | Adding `@custom-variant dark (&:where(.dark, .dark *))` and calling it done | Must also handle the OS-preference fallback case for users without a stored preference |
| opencode config layers | Writing only to global config | Warn users if a project config might override the global hook registration |
| Heartbeat ping (v0.5.0) | Single fetch failure → setOffline(true) | Require N consecutive failures; use AbortSignal.timeout() to bound each ping |
| Clipboard API (v0.5.0) | Calling writeText() after await | Serialize synchronously; call writeText() directly in onClick with no async gap before it |
| Clipboard JSON format (v0.5.0) | Frontend invents its own format | Must match build_opencode_output exactly: `{"behavior":"allow"}` or `{"behavior":"deny","message":"..."}` |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Writing user-supplied strings into integration config files | Config injection — a malicious binary path could embed shell metacharacters | The binary path comes from `current_exe()`, not user input; validate it is an absolute path before writing |
| Reading `HOME` silently as empty string (WR-02 debt) | Hook wiring writes to relative path `.claude/settings.json` instead of absolute path, installing into cwd | Fix WR-02: hard-exit when `HOME` is empty, never fall back to empty string |
| opencode plugin file execution | A plugin file in `.opencode/plugin/` runs arbitrary JS — a malicious project config could redirect the hook | Document that the global plugin path should be used; warn users about project-level plugin overrides |
| Stdout write in hook path outside of the single `serde_json::to_writer` call | Any stray stdout write corrupts the hook protocol; could enable injection of fake JSON structures | Test harness that asserts stdout is exactly one valid JSON object |
| Clipboard JSON injection (v0.5.0) | If the clipboard JSON is not sanitized and Claude executes it as a command, malformed annotations could inject instructions | The `serializeAnnotations` output is already plain text, not code; the JSON shape is fixed; no eval path exists |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Theme toggle that causes FOUC on every load | Jarring flash; makes the tool feel broken | Inline `<head>` script sets theme before first paint |
| New annotation types with no explanation in the UI | User clicks "out of scope" not knowing what it sends to Claude | Each predefined type should have a tooltip/description explaining what the AI receives |
| opencode install succeeds silently but hook never fires | User thinks integration is working; it is not | After install, print a verification hint pointing to the docs |
| Light theme breaking code block readability (dark hljs on light bg) | Code is unreadable; user blames the tool | Swap hljs theme atomically with the Tailwind dark variant |
| Predefined annotation types mixed in the floating affordance with structural types | Too many options (3 structural + 6 predefined = 9 buttons) cause decision paralysis | Separate structural types (comment/delete/replace) from predefined action tags in the UI |
| Offline banner that blocks the annotation sidebar (v0.5.0) | User cannot add more annotations after server dies | Banner must be non-blocking (top-of-screen notification strip, not a modal) |
| No success feedback after clipboard copy (v0.5.0) | User does not know if the copy succeeded | Show "Copied!" badge on the button for 2 seconds after writeText() resolves |
| No textarea fallback when clipboard API is blocked (v0.5.0) | User has no way to export annotations | Show the JSON in a read-only textarea below the "Copy" button as a fallback |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **opencode install:** Flipping `supported: true` in integration.rs — verify the config path, hook format, and idempotency check are all implemented and tested
- [ ] **opencode install:** Install success message — verify the hook actually fires by running a test plan in opencode
- [ ] **codestral install:** Defined scope — verify which agent runtime is targeted before any code is written
- [ ] **Theme switcher:** Light/dark toggle works in dev — verify no FOUC on hard reload with light theme stored in localStorage
- [ ] **Theme switcher:** Tailwind dark classes apply — verify code blocks also switch highlight.js theme (not just Tailwind colors)
- [ ] **Theme switcher:** OS preference honored — verify fresh load (no localStorage) respects OS dark mode setting
- [ ] **Annotation new types:** New union member added — verify every switch in the codebase has an exhaustive check that fails at compile time
- [ ] **Annotation new types:** serializeAnnotations updated — verify new types produce readable, actionable text in the deny message
- [ ] **Annotation new types:** Test suite updated — verify `serializeAnnotations.test.ts` covers every new type
- [ ] **WR-01 (unwrap on malformed settings.json):** Now addressed for Claude — verify opencode config parsing also uses safe error handling (no `.unwrap()` on config reads)
- [ ] **WR-02 ($HOME empty string):** Fix applied — verify HOME empty causes hard exit, not silent empty-path writes, for ALL integrations not just Claude Code
- [ ] **Heartbeat (v0.5.0):** N-consecutive-failure threshold implemented — verify single failure does not trigger offline state
- [ ] **Heartbeat (v0.5.0):** AbortSignal.timeout() on each ping — verify dead server is detected within expected window, not after 60-second TCP timeout
- [ ] **Heartbeat (v0.5.0):** Interval cleared on confirmed/error/offline states — verify confirmed screen is not overwritten by late offline transition
- [ ] **Clipboard (v0.5.0):** writeText() called synchronously in onClick — verify copy works in Safari and Firefox
- [ ] **Clipboard (v0.5.0):** Approve AND deny paths both have clipboard fallback — verify offline approve produces `{"behavior":"allow"}` in clipboard
- [ ] **Clipboard (v0.5.0):** JSON format matches build_opencode_output — verify `{"behavior":"allow"}` or `{"behavior":"deny","message":"..."}` exactly
- [ ] **Clipboard (v0.5.0):** Textarea fallback exists when writeText() fails — verify blocked clipboard shows selectable JSON text
- [ ] **annotate.md (v0.5.0):** Step 4 handles pasted JSON with explicit format description — verify Claude cannot confuse a user comment with the result JSON
- [ ] **annotate.md (v0.5.0):** Step 4 handles double-result case (clipboard paste + eventual stdout) — verify the step explicitly says to prefer the paste result

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| opencode install wired to wrong config path | MEDIUM | Uninstall (removes wrong file entry), re-spec the correct path, reinstall |
| stdout pollution breaks Claude Code hook | HIGH | Every plan review session fails silently; requires a binary update + redistribution |
| Annotation exhaustiveness failure (new type returns undefined) | LOW | Add missing case to switch, rebuild frontend, rust-embed picks up new assets |
| FOUC on theme load | LOW | Add inline `<head>` script, rebuild frontend |
| highlight.js dark/light mismatch | LOW | Import both themes with correct scoping, rebuild frontend |
| opencode config merge issue (project overrides global) | MEDIUM | Document the limitation; add a warning to the install output |
| Codestral scope remains unresolved at end of milestone | LOW | Keep `supported: false`, update the stub's reason string, document in release notes |
| False offline on transient blip (v0.5.0) | LOW | Increase N threshold or reduce poll interval; frontend-only change, no binary update |
| Clipboard copy fails silently (v0.5.0) | MEDIUM | Add textarea fallback; users lose annotations until fixed binary ships |
| Clipboard JSON format mismatch (v0.5.0) | HIGH | Claude parses wrong format; annotate.md Step 4 fails; requires binary update to fix annotate.md |
| Double-result in annotate.md (v0.5.0) | MEDIUM | Update annotate.md (binary update required); annotate.md is written fresh on every install |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| opencode has no ExitPlanMode equivalent (P1) | Integration spec phase (before coding) | Confirmed hook API documented; stub remains `supported: false` until spec complete |
| Codestral is a model not an agent (P2) | Milestone scope definition | Scope document identifies which agent runtime is targeted |
| stdout pollution kills hook protocol (P3) | Hook flow phase | Integration test: pipe binary in hook mode, assert stdout is valid single-line JSON |
| Config path collision across integrations (P4) | Integration install/uninstall phase | Unit tests: each integration's `is_installed` function tested with the other's config |
| opencode config merge breaks naive writes (P5) | opencode integration phase | Manual test: global install works for project without local opencode.json |
| FOUC on theme load (P6) | Theme switcher phase | Visual test: hard reload with light theme in localStorage, no dark flash |
| highlight.js CSS mismatch (P7) | Theme switcher phase | Visual test: toggle to light, verify code blocks use light hljs theme |
| Annotation exhaustiveness (P8) | Annotation type expansion phase | Compile-time: TypeScript error when adding type without updating all switches |
| Annotation serialization for action types (P9) | Annotation type expansion phase | Test: `serializeAnnotations.test.ts` covers every new type with expected output |
| Tailwind v4 dark variant removes OS preference (P10) | Theme switcher phase | Test: clear localStorage, verify OS dark mode preference honored |
| Transient-blip false offline (V5-01) | Heartbeat phase | Unit test: one failed ping does not set offline; three consecutive do |
| Clipboard API user-gesture requirement (V5-02) | Clipboard fallback phase | Manual test in Safari + Firefox: copy works; textarea fallback visible on failure |
| AppState conflation error/offline (V5-03) | State machine design (first) | TypeScript: `offline` in union; `ErrorView` not rendered when server dies mid-session |
| Stale heartbeat after confirm (V5-04) | Heartbeat phase | Integration test: approve → wait → assert confirmed screen stable, no offline banner |
| Dual-result race (stdout + clipboard paste) (V5-05) | Slash command update phase | Manual test: clipboard submit → verify annotate.md Step 4 resolves correctly |
| Ping fetch without AbortSignal.timeout() (V5-06) | Heartbeat phase | Code review gate: no `fetch('/api/ping')` without timeout signal |
| Approve-path missing in offline mode (V5-07) | Clipboard fallback phase | Test: offline approve produces `{"behavior":"allow"}` in clipboard |
| Clipboard/stdout JSON format mismatch (V5-08) | Clipboard fallback phase (spec first) | Unit test: clipboard export matches build_opencode_output output for same decision |
| Ambiguous pasted-JSON detection in annotate.md (V5-09) | Slash command update phase | Manual test: paste JSON in Claude conversation, verify correct Step 4 interpretation |
| Watchdog/stdout race (V5-10) | Slash command update phase | annotate.md review: double-result case explicitly handled in Step 4 instructions |

---

## Sources

- opencode config format: https://opencode.ai/docs/config/ — global path `~/.config/opencode/opencode.json`, JSONC format, multi-layer merge
- opencode plugin hook system: https://opencode.ai/docs/plugins/ — TypeScript plugin files, `tool.execute.before` / `tool.execute.after` hooks
- `permission.ask` hook not triggered (known bug as of early 2026): https://github.com/sst/opencode/issues/7006
- opencode hooks support issue (shows plugin model, not CLI hooks): https://github.com/sst/opencode/issues/1473
- opencode tool.execute.before subagent bypass (security limitation): https://github.com/sst/opencode/issues/5894
- Tailwind CSS v4 dark mode: https://tailwindcss.com/docs/dark-mode — `@custom-variant` replaces v3 `darkMode: 'class'` config
- Tailwind v4 dark mode conflict with prefers-color-scheme: https://github.com/tailwindlabs/tailwindcss/discussions/17810
- highlight.js theme switching (maintainers declined auto-pairing): https://github.com/highlightjs/highlight.js/issues/3652
- FOUC prevention with Vite + React Tailwind v4: https://medium.com/@balpetekserhat/how-i-fixed-tailwind-css-v4-dark-mode-not-working-in-a-vite-react-project-d7f0b3a31184
- Clipboard API writeText MDN: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText
- Clipboard API user gesture interoperability issue (Safari/Firefox vs Chrome divergence): https://github.com/w3c/clipboard-apis/issues/182
- Clipboard API secure context and localhost: https://web.dev/articles/async-clipboard
- AbortSignal.timeout() for fetch: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static
- axum graceful shutdown and keep-alive connection behavior with Chrome: https://github.com/tokio-rs/axum/issues/2611
- axum CancellationToken shutdown discussion: https://github.com/tokio-rs/axum/discussions/2565
- Tokio runtime shutdown race conditions: https://github.com/tokio-rs/tokio/issues/7056
- Current hook.rs / install.rs / uninstall.rs / integration.rs / types.ts / serializeAnnotations.ts / App.tsx / main.rs / server.rs: examined directly from codebase (v0.5.0 pre-implementation)
- Known tech debt items WR-01–WR-04: .planning/PROJECT.md

---
*Pitfalls research for: Multi-tool AI coding agent hook manager (v0.5.0 offline resilience additions)*
*Originally researched: 2026-04-10 | Updated: 2026-05-05*
