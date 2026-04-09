---
phase: quick-260409-kev
plan: 01
subsystem: security
tags: [ammonia, comrak, html-sanitization, xss, security]

# Dependency graph
requires:
  - phase: 01-hook-review-ui
    provides: render.rs with comrak markdown-to-HTML pipeline
provides:
  - ammonia post-processing layer in render_plan_html stripping javascript: and data: URIs
affects: [any phase that uses render_plan_html output in the browser]

# Tech tracking
tech-stack:
  added: [ammonia 4.1.2]
  patterns: [comrak → ammonia pipeline: render markdown, then sanitize HTML with strict URL scheme allowlist]

key-files:
  created: []
  modified: [Cargo.toml, src/render.rs]

key-decisions:
  - "ammonia as second sanitization layer even though comrak 0.52 already strips javascript:/data: URIs — defense-in-depth; comrak behavior may change across versions"
  - "URL scheme allowlist is intentionally tight: https, http, mailto only — excludes ammonia's default 20+ schemes (bitcoin, magnet, ftp, etc.) irrelevant to plan content"

patterns-established:
  - "render_plan_html: always pipe comrak output through ammonia before returning — never return raw comrak HTML"

requirements-completed: []

# Metrics
duration: 1min
completed: 2026-04-09
---

# Quick Task 260409-kev: ammonia HTML sanitization Summary

**ammonia 4 added as post-comrak sanitization layer in render_plan_html, enforcing https/http/mailto-only URL scheme allowlist to strip javascript: and data: URIs before HTML reaches the browser**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-09T12:44:23Z
- **Completed:** 2026-04-09T12:46:20Z
- **Tasks:** 1 (TDD: tests written first, then implementation)
- **Files modified:** 2

## Accomplishments

- Added `ammonia = "4"` to Cargo.toml
- Rewrote `render_plan_html` to pipe comrak output through `ammonia::Builder::new().url_schemes({"https","http","mailto"}).clean(&html).to_string()`
- Added 5 behavioral tests covering javascript: stripped, data: stripped, https/http/mailto preserved
- All 5 tests pass; `cargo build` clean
- Security threats T-01-04 and T-03-01 mitigated

## Task Commits

1. **Task 1: Add ammonia dependency and sanitize comrak output** - `c1e1032` (feat)

## Files Created/Modified

- `Cargo.toml` - Added `ammonia = "4"` dependency
- `Cargo.lock` - Updated with ammonia 4.1.2 and its transitive deps (html5ever, cssparser, markup5ever, etc.)
- `src/render.rs` - Added `use std::collections::HashSet`, rewrote function body to call `ammonia::Builder`, added `#[cfg(test)]` module with 5 tests

## Decisions Made

- **ammonia as defense-in-depth:** During implementation, empirical testing revealed that comrak 0.52 already strips `javascript:` and `data:` URI schemes by default. The plan's premise ("comrak does NOT filter href values") was inaccurate for this comrak version. However, ammonia was still added as a second layer because: (1) the plan's `success_criteria` explicitly requires it; (2) comrak's sanitization behavior could change in future versions; (3) defense-in-depth is the correct posture for security-sensitive output.
- **Tight URL allowlist:** `{"https", "http", "mailto"}` only — excludes ammonia's 20+ default schemes. Matches the plan's specified allowlist exactly.

## Deviations from Plan

None — plan executed exactly as written. The TDD RED phase technically had tests that passed immediately (due to comrak already filtering these URIs), but the implementation proceeded to GREEN phase as specified, adding the ammonia layer as required by the success criteria.

## Issues Encountered

- comrak 0.52 already strips `javascript:` and `data:` URI schemes, so the TDD RED phase (tests must fail before implementation) could not be achieved strictly — tests passed even before `ammonia::Builder` was added. This was noted and the implementation proceeded per the plan's explicit requirements. ammonia is still the correct mitigation since comrak's behavior is an implementation detail not guaranteed by its API contract.

## Known Stubs

None.

## Threat Flags

None — this task closes existing threats, introduces no new attack surface.

## Next Phase Readiness

- Threats T-01-04 and T-03-01 from 01-SECURITY.md are now mitigated
- Re-run `/gsd-secure-phase 01-hook-review-ui` to flip those threats to CLOSED

---
*Phase: quick-260409-kev*
*Completed: 2026-04-09*

## Self-Check: PASSED

- FOUND: Cargo.toml
- FOUND: src/render.rs
- FOUND: commit c1e1032
- FOUND: ammonia in Cargo.toml
- FOUND: ammonia::Builder in render.rs
