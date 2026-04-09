---
phase: quick-260409-kev
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - Cargo.toml
  - src/render.rs
autonomous: true
requirements: []
must_haves:
  truths:
    - "A markdown link with `javascript:` URI scheme produces no `href` containing `javascript:` in the server's HTML output"
    - "A markdown link with `data:` URI scheme produces no `href` containing `data:` in the server's HTML output"
    - "Normal http/https/mailto links render correctly and are not stripped"
  artifacts:
    - path: "Cargo.toml"
      provides: "ammonia 4 dependency"
      contains: "ammonia"
    - path: "src/render.rs"
      provides: "ammonia sanitization after comrak"
      contains: "ammonia::Builder"
  key_links:
    - from: "src/render.rs"
      to: "ammonia::Builder"
      via: "called after markdown_to_html(), before return"
      pattern: "ammonia::Builder::new\\(\\)"
---

<objective>
Close security threats T-01-04 and T-03-01 (CR-01) by adding ammonia post-processing to
src/render.rs. comrak's `unsafe_` flag only controls raw HTML passthrough — it does NOT
filter `href` attribute values, so `[label](javascript:alert(1))` emits an unfiltered
`<a href="javascript:alert(1)">` regardless of comrak settings. ammonia sanitizes the
comrak HTML output and enforces a URL scheme allowlist on all `href` and `src` attributes,
stripping `javascript:` and `data:` URIs before HTML reaches AppState and the browser.

Purpose: Close the two OPEN security threats identified in 01-SECURITY.md audit.
Output: Cargo.toml with ammonia 4 dependency; src/render.rs calling ammonia after comrak.
</objective>

<execution_context>
@/Users/julien.muetton/Projects/lab/claude-plan-reviewer/.claude/get-shit-done/workflows/execute-plan.md
@/Users/julien.muetton/Projects/lab/claude-plan-reviewer/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/julien.muetton/Projects/lab/claude-plan-reviewer/src/render.rs
@/Users/julien.muetton/Projects/lab/claude-plan-reviewer/Cargo.toml
@/Users/julien.muetton/Projects/lab/claude-plan-reviewer/.planning/phases/01-hook-review-ui/01-SECURITY.md

<interfaces>
<!-- Current render.rs — full file (11 lines) -->
```rust
use comrak::{markdown_to_html, Options};

pub fn render_plan_html(markdown: &str) -> String {
    let mut options = Options::default();
    options.extension.table = true;
    options.extension.tasklist = true;
    options.extension.strikethrough = true;
    options.extension.autolink = true;
    // Do NOT set options.render.unsafe_ = true — plan content is sanitized
    markdown_to_html(markdown, &options)
}
```

<!-- ammonia 4.1.2 API used in this plan -->
```rust
// Builder::url_schemes signature
pub fn url_schemes(&mut self, value: HashSet<&'a str>) -> &mut Self

// Builder::clean signature — returns Document, call .to_string() to get String
pub fn clean(&self, src: &str) -> Document
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add ammonia dependency and sanitize comrak output in render.rs</name>
  <files>Cargo.toml, src/render.rs</files>
  <behavior>
    - Test 1: `render_plan_html("[xss](javascript:alert(1))")` — output must NOT contain `javascript:`
    - Test 2: `render_plan_html("[data](data:text/html,<h1>hi</h1>)")` — output must NOT contain `data:`
    - Test 3: `render_plan_html("[ok](https://example.com)")` — output MUST contain `href="https://example.com"`
    - Test 4: `render_plan_html("[mail](mailto:a@b.com)")` — output MUST contain `href="mailto:a@b.com"`
    - Test 5: `render_plan_html("[plain](http://example.com)")` — output MUST contain `href="http://example.com"`
  </behavior>
  <action>
**Step 1 — Cargo.toml:** Add `ammonia = "4"` to `[dependencies]`. No feature flags needed; the default feature set is sufficient.

**Step 2 — src/render.rs (write failing tests first):** Add a `#[cfg(test)]` module at the bottom of render.rs with the five test cases listed in `<behavior>`. Run `cargo test render` — all tests must FAIL before implementation (the current code returns raw comrak output with no filtering).

**Step 3 — src/render.rs (implement):** Rewrite `render_plan_html` to:

```rust
use std::collections::HashSet;
use comrak::{markdown_to_html, Options};

pub fn render_plan_html(markdown: &str) -> String {
    let mut options = Options::default();
    options.extension.table = true;
    options.extension.tasklist = true;
    options.extension.strikethrough = true;
    options.extension.autolink = true;
    // Do NOT set options.render.unsafe_ = true — plan content is sanitized
    let html = markdown_to_html(markdown, &options);

    // Strip javascript: and data: URIs from href/src attributes.
    // comrak's unsafe_=false only blocks raw HTML passthrough; it does NOT
    // filter href values emitted from markdown link syntax. ammonia enforces
    // a strict URL scheme allowlist on all href and src attributes.
    ammonia::Builder::new()
        .url_schemes(HashSet::from(["https", "http", "mailto"]))
        .clean(&html)
        .to_string()
}
```

Note: The allowlist is intentionally tight — `https`, `http`, `mailto` only. This excludes the 20+ schemes in ammonia's default set (bitcoin, magnet, ftp, etc.) that are irrelevant to plan content. Fragment-only links (`href="#"`) are safe: ammonia passes href values that contain no scheme as-is.

**Step 4 — Verify tests pass:** Run `cargo test render` — all five tests must now PASS.

**Step 5 — Full build check:** Run `cargo build` to confirm no compile errors and that ammonia 4 resolves correctly.
  </action>
  <verify>
    <automated>cargo test render -- --nocapture</automated>
  </verify>
  <done>
    - All five render tests pass (javascript: stripped, data: stripped, https/http/mailto preserved)
    - `cargo build` succeeds with no errors or warnings about unused imports
    - `grep -n "ammonia" src/render.rs` confirms the call is present
    - `grep "ammonia" Cargo.toml` shows the dependency
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| comrak output → AppState | Rendered HTML crosses here; must be clean before storage |
| AppState.plan_html → browser DOM | dangerouslySetInnerHTML injects HTML; ammonia ensures no javascript: or data: URIs reach here |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-04 | Spoofing | comrak HTML output / render_plan_html | mitigate | ammonia::Builder with url_schemes allowlist (https, http, mailto) applied after markdown_to_html() in src/render.rs — strips javascript: and data: from all href/src attributes |
| T-03-01 | Tampering | dangerouslySetInnerHTML in App.tsx | mitigate | Server-side ammonia sanitization closes the vector upstream; planHtml arriving at the browser already has javascript: and data: href values removed |
</threat_model>

<verification>
After the task completes:

1. `cargo test render -- --nocapture` — all five behavioral tests pass
2. `cargo build` — clean build, no errors
3. Manual spot-check: In a test or REPL, call `render_plan_html("[xss](javascript:alert(1))")` and confirm the output contains no `javascript:` substring
4. Security audit closure: re-run `/gsd-secure-phase 01-hook-review-ui` — T-01-04 and T-03-01 should flip to CLOSED
</verification>

<success_criteria>
- ammonia = "4" present in Cargo.toml [dependencies]
- src/render.rs imports ammonia and calls ammonia::Builder::new().url_schemes(...).clean(&html).to_string() after markdown_to_html()
- URL scheme allowlist is exactly: "https", "http", "mailto"
- All five behavioral tests pass: javascript: stripped, data: stripped, https/http/mailto preserved
- cargo build succeeds
- Threats T-01-04 and T-03-01 confirmed mitigated by re-running /gsd-secure-phase
</success_criteria>

<output>
After completion, create `.planning/quick/260409-kev-add-ammonia-crate-to-sanitize-javascript/260409-kev-SUMMARY.md`
</output>
