---
phase: 01-hook-review-ui
asvs_level: L1
audited: 2026-04-09
threats_total: 2
threats_closed: 0
threats_open: 2
---

# Security Audit — Phase 01: Hook Review UI

## Summary

**Threats Closed:** 0/2
**Threats Open:** 2/2
**ASVS Level:** L1

Both registered threats for this phase are OPEN. The declared mitigation ("comrak
sanitizes HTML by default, unsafe_ OFF") is insufficient for the specific XSS vector
cited in the threat register: `javascript:` URIs in markdown link href attributes.

---

## Threat Verification

### T-01-04 — OPEN

| Field | Value |
|-------|-------|
| Category | Spoofing |
| Component | comrak HTML output |
| Disposition | mitigate |
| Declared Mitigation | comrak unsafe_ OFF strips XSS in rendered plan HTML |
| Files Searched | src/render.rs |

**Finding:** `src/render.rs` sets no `options.render.unsafe_` flag (correctly left as
default false). However, comrak's `unsafe_` flag controls only raw HTML block and inline
HTML passthrough (`<script>`, `<iframe>`, etc.). It does NOT filter `href` attribute
values on anchor elements generated from markdown link syntax. A markdown input of
`[label](javascript:alert(1))` emits `<a href="javascript:alert(1)">label</a>` through
comrak regardless of the `unsafe_` setting. No post-processing with ammonia or any URL
scheme allowlist is present in `src/render.rs` or `src/server.rs`. The mitigation
pattern is not implemented.

**Evidence of absence:** No call to `ammonia`, `clean`, or any URL filtering function
exists in `src/render.rs`. No link sanitization occurs between `markdown_to_html()` and
the value stored in `AppState.plan_html`.

---

### T-03-01 — OPEN

| Field | Value |
|-------|-------|
| Category | Tampering |
| Component | dangerouslySetInnerHTML |
| Disposition | mitigate |
| Declared Mitigation | comrak unsafe_ OFF; XSS vectors stripped at server before browser |
| Files Searched | ui/src/App.tsx, src/render.rs |

**Finding:** `ui/src/App.tsx` lines 279-283 inject `planHtml` directly via
`dangerouslySetInnerHTML={{ __html: planHtml }}` with no client-side sanitization
(no DOMPurify, no link filtering, no CSP sandbox attribute). The `planHtml` value
originates from the server's `GET /api/plan` response, which returns the output of
`render_plan_html()` verbatim. As established for T-01-04, `javascript:` URIs in link
href values survive comrak rendering and reach the browser DOM unmodified. Clicking such
a link executes the URI scheme in the browser's security context.

The SUMMARY.md threat flag from plan 01-03 incorrectly asserts this is mitigated:
> "The dangerouslySetInnerHTML usage is mitigated by comrak's server-side sanitization
> (unsafe_ OFF in src/render.rs per T-03-01)."
This assessment is inaccurate. comrak's `unsafe_ OFF` does not address `javascript:`
link hrefs. The flag maps to T-03-01 (not unregistered) but the executor's conclusion
is wrong — the threat remains open.

**Evidence of absence:** No DOMPurify import, no link href filtering, no `sandbox`
attribute on the plan container, and no CSP meta tag in `ui/index.html` that would
block `javascript:` navigation.

---

## Accepted Risks Log

No threats accepted in this phase.

---

## Transfer Documentation

No threats transferred in this phase.

---

## Unregistered Flags

| Source | Flag Description | Assessment |
|--------|-----------------|------------|
| 01-03-SUMMARY.md | "No new threat surface. dangerouslySetInnerHTML mitigated by comrak unsafe_ OFF" | Maps to T-03-01 (not unregistered). Executor's mitigation claim is incorrect — threat remains open. |

---

## Remediation Guidance

To close T-01-04 and T-03-01, implement ONE of the following (server-side preferred):

**Option A — Server-side: ammonia URL sanitization (recommended)**

In `src/render.rs`, after calling `markdown_to_html()`, pass the result through
`ammonia::Builder` with a URL scheme allowlist restricting `href` to `https`, `http`,
`mailto`, and `#`. This strips `javascript:` and `data:` URIs at the source before the
HTML is stored in `AppState.plan_html`.

Add to `Cargo.toml`: `ammonia = "3"`

```rust
// src/render.rs — after markdown_to_html()
let clean = ammonia::Builder::new()
    .url_schemes(std::collections::HashSet::from(["https", "http", "mailto"]))
    .clean(&html)
    .to_string();
```

**Option B — Client-side: DOMPurify with FORCE_BODY + FORBID_ATTR**

Add `dompurify` to `ui/package.json` and sanitize before setting state:

```tsx
import DOMPurify from 'dompurify'
// …
setPlanHtml(DOMPurify.sanitize(data.plan_html, { FORBID_ATTR: ['href'] }))
// or use ALLOWED_URI_REGEXP to allowlist http/https/mailto
```

**Option C — Accept**

If the risk is accepted (plan content is already trusted because it originates from
Claude Code on the same machine and the browser is opened only by the binary), document
the acceptance rationale in this file's Accepted Risks Log and re-run /gsd-secure-phase.

---

## Re-audit Instructions

After implementing a mitigation, re-run `/gsd-secure-phase` targeting this phase.
The auditor will grep for the mitigation pattern (e.g., `ammonia` in `src/render.rs`
or `DOMPurify` in `ui/src/App.tsx`) and update this file.
