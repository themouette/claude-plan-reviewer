---
phase: 01-hook-review-ui
asvs_level: L1
audited: 2026-04-09
threats_total: 2
threats_closed: 2
threats_open: 0
---

# Security Audit — Phase 01: Hook Review UI

## Summary

**Threats Closed:** 2/2
**Threats Open:** 0/2
**ASVS Level:** L1

Both registered threats for this phase are CLOSED. The ammonia URL scheme allowlist
added to `src/render.rs` after `markdown_to_html()` closes both T-01-04 and T-03-01.

---

## Threat Verification

### T-01-04 — CLOSED

| Field | Value |
|-------|-------|
| Category | Spoofing |
| Component | comrak HTML output |
| Disposition | mitigate |
| Declared Mitigation | ammonia URL scheme allowlist (https/http/mailto only) in src/render.rs after markdown_to_html() |
| Files Searched | src/render.rs |

**Finding:** `src/render.rs` lines 18-21 call `ammonia::Builder::new()` with
`.url_schemes(HashSet::from(["https", "http", "mailto"]))` applied to the output of
`markdown_to_html()`. This is the exact mitigation pattern declared in the threat register.
`javascript:` and `data:` URIs in markdown link hrefs are stripped by ammonia before the
HTML is returned from `render_plan_html()` and stored in `AppState.plan_html`.

Five unit tests (lines 29-71) confirm correctness:
- `javascript_uri_is_stripped` — verifies `javascript:` does not survive
- `data_uri_is_stripped` — verifies `data:` does not survive
- `https_link_is_preserved` — verifies `https://` href is retained
- `http_link_is_preserved` — verifies `http://` href is retained
- `mailto_link_is_preserved` — verifies `mailto:` href is retained

**Evidence:** `src/render.rs:18-21`

---

### T-03-01 — CLOSED

| Field | Value |
|-------|-------|
| Category | Tampering |
| Component | dangerouslySetInnerHTML |
| Disposition | mitigate |
| Declared Mitigation | Server-side ammonia sanitization in src/render.rs before HTML reaches AppState.plan_html |
| Files Searched | ui/src/App.tsx, src/render.rs |

**Finding:** `ui/src/App.tsx` line 281 continues to inject `planHtml` via
`dangerouslySetInnerHTML={{ __html: planHtml }}` with no client-side sanitization.
This is acceptable because the declared mitigation is server-side: the HTML injected
into the browser is the output of `render_plan_html()`, which now passes comrak output
through `ammonia::Builder` with the strict URL scheme allowlist before the value is
stored in `AppState.plan_html`. The `javascript:` and `data:` URI vectors are neutralized
at the server before the HTML ever reaches the browser.

The previous audit finding that "comrak's `unsafe_` OFF does not address `javascript:`
link hrefs" remains accurate. The mitigation is now correctly implemented via ammonia
rather than relying solely on comrak's `unsafe_` flag.

**Evidence:** `src/render.rs:18-21` (ammonia sanitizes before `AppState` storage);
`ui/src/App.tsx:281` (receives already-clean HTML from `/api/plan`).

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
| 01-03-SUMMARY.md | "No new threat surface. dangerouslySetInnerHTML mitigated by comrak unsafe_ OFF" | Maps to T-03-01 (not unregistered). Executor's original mitigation claim was incorrect — comrak unsafe_ OFF does not filter href values. Threat is now correctly closed via ammonia, not via comrak alone. |

---

## Audit Trail

| Date | Auditor | Result | Notes |
|------|---------|--------|-------|
| 2026-04-09 | gsd-security-auditor (initial) | OPEN_THREATS (0/2 closed) | ammonia not present; javascript: URI not filtered |
| 2026-04-09 | gsd-security-auditor (re-audit) | SECURED (2/2 closed) | ammonia::Builder with url_schemes allowlist added to src/render.rs:18-21; T-01-04 and T-03-01 closed |
