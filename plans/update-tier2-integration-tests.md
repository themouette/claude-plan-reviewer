# Tier 2: mock-GitHub integration tests for the self-update path

## Goal

Cover the network paths of `plan-reviewer update` with integration tests
against a local mock of the GitHub releases API: `get_latest_version`,
`check_and_display`, and the actual download/replace in `perform_update`.

## Facts established (from vendored self_update 1.3.0 source)

- `api_base_url()` exists on both `ReleaseListBuilder` and `UpdateBuilder`
  → clean injection point for the mock server
- Wire format: `{base}/repos/{owner}/{name}/releases`, standard GitHub
  release JSON (`tag_name`, `assets[].name`, `assets[].url` — download URL
  comes from the JSON we serve, so the mock controls it end-to-end)
- Pagination follows `Link` headers; a plain array response should be a
  single page (confirm empirically with a catch-all logging route)
- `Releases::latest()` takes the **first** element (backend ordering,
  newest-first for GitHub), not the semver max — documented upstream.
  Our code relies on GitHub's newest-first ordering; tests will encode
  this as an explicit documented assumption.

## Changes

### 1. Production: API base injection (`src/update.rs`)

```rust
fn github_api_base() -> Option<String> {
    std::env::var("PLAN_REVIEWER_GITHUB_API_BASE").ok().filter(|s| !s.is_empty())
}
```

- `get_latest_version()`: call `.api_base_url(base)` on the
  `ReleaseList` builder when the env var is set
- `perform_update()`: same for the `Update` builder
- No behavior change when unset. Side benefit: usable against GitHub
  Enterprise.
- Add a comment documenting the ordering assumption (newest-first).

### 2. Dev-dependencies (`Cargo.toml`)

Add `tar` and `flate2` (runtime-generated fixture archives — the asset
filename embeds the host target triple, so a static checked-in fixture
cannot work).

### 3. New test file `tests/integration/update_subcommand.rs`

Test harness pieces:
- axum mock server (pattern already used by `server_cycle.rs`):
  - `GET /repos/themouette/claude-plan-reviewer/releases` → configurable
    release-list JSON (plus a catch-all logging route during bring-up to
    confirm the exact request sequence/JSON fields self_update expects)
  - `GET /download/<asset>` → tar.gz containing
    `claude-plan-reviewer-<triple>/plan-reviewer` with fake marker bytes
- Fixture builder: release JSON + tar.gz via tar/flate2
- Subprocess runner: spawn the test binary with
  `PLAN_REVIEWER_GITHUB_API_BASE=http://127.0.0.1:<port>` and isolated
  `HOME` (pattern from `install_uninstall.rs`)

Tests:
1. `update_check_reports_new_version` — mock serves `v0.9.0` newest-first;
   `update --check` prints "New version available: 0.9.0" + changelog URL
2. `update_check_already_latest` — mock serves only current version →
   "already running the latest version", exit 0
3. `update_check_unreachable` — mock returns 404/garbage → exit 1 with
   "Unable to check for updates"
4. `update_replaces_binary` — the critical one: copy the debug binary to a
   tempdir (so self-replacement targets the copy, NOT
   `target/debug/plan-reviewer`), run `update --yes`, assert exit 0,
   "Successfully updated to version 0.9.0", and the copy's bytes now match
   the fake marker
5. `update_latest_takes_first_release` — ordering assumption guard:
   documents that `get_latest_version` picks the first list entry
   (GitHub's newest-first contract), e.g. list with v0.9.0 first and an
   older release second → picks 0.9.0
6. `update_pinned_version_tag` — `update --version v0.9.0 --yes` path
   (release_tag normalization end-to-end)

## Verification

`cargo test` (all existing + new), `cargo fmt`,
`cargo clippy -- -D warnings`. Watch test runtime — subprocess tests
should keep the suite in single-digit seconds.

## Risks / unknowns (empirical, expected small)

- Exact JSON field names and request sequence self_update expects →
  resolve with the catch-all logging route in the first 30 min; fixture
  adjusts to whatever the parser needs
- Asset-name matching (`target()` is substring match) — fixture names
  mirror cargo-dist's real scheme `plan-reviewer-v0.9.0-<triple>.tar.gz`
- rustls/reqwest against `http://127.0.0.1` — plain HTTP should be fine
  since the URL is fully controlled by the mock

## Out of scope

- Changing `get_latest_version` to semver-max instead of first-element
  (upstream documents first-element as the contract for built-in
  backends; real GitHub is newest-first). Can revisit if ever pointed at
  an unofficial GitHub-compatible server.
- `current_platform` coverage (still compile-time consts).
