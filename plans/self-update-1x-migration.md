# Upgrade `self_update` 0.44 → 1.x to clear quick-xml advisories

## Goal

Clear the two remaining `cargo audit` vulnerabilities — `quick-xml` 0.38.4
(RUSTSEC-2026-0194, RUSTSEC-2026-0195, both 7.5 high) — which are pinned
transitively by `self_update` 0.44. Upgrading `self_update` to 1.x pulls
`quick-xml` ≥ 0.41 and gets the audit to fully clean.

## Scope of change

Only `src/update.rs` (lines 1–160ish) and `Cargo.toml` touch the self_update
API. The ~1200 lines of integration-refresh/migration logic and their tests
are untouched.

## Changes

### 1. `Cargo.toml`

```toml
# before
self_update = { version = "0.44", default-features = false, features = ["archive-tar", "compression-flate2", "reqwest", "rustls"] }

# after
self_update = { version = "1", default-features = false, features = ["archive-tar", "compression-tar-gz", "reqwest", "rustls", "github"] }
```

Feature renames per upstream migration guide:
- `compression-flate2` → `compression-tar-gz`
- `github` backend feature must now be explicit when `default-features = false`

### 2. `src/update.rs` — `perform_update()`

| 0.44 API | 1.x API |
|---|---|
| `.target_version_tag(&format!("v{}", version))` | `.release_tag(&format!("v{}", version))` |
| `.target(platform)` | unchanged (still exists in 1.x) |
| `.no_confirm(skip_confirm)` | verify still present; adapt if renamed |
| `builder.build().and_then(\|u\| u.update())` → `status.version()` | unchanged shape; status type renamed `UpdateStatus` → `ReleaseStatus` |

### 3. `src/update.rs` — `get_latest_version()`

`ReleaseList::fetch()` now returns `self_update::Releases` instead of
`Vec<Release>`, and `Release` fields became getters:

```rust
// before
releases.first().map(|r| r.version.trim_start_matches('v').to_string())

// after
releases.latest().map(|r| r.version().trim_start_matches('v').to_string())
```

## Test/verification plan

- `cargo test` — existing 38 tests must pass (the `update.rs` tests cover
  `refresh_integrations` logic which is untouched; the API-adapted functions
  are network-bound glue around the self_update library)
- `cargo fmt && cargo clippy -- -D warnings`
- `cargo audit` — expect 0 vulnerabilities (only the 2 informational git2
  unsoundness warnings remain, no fix available)
- `cargo build --release` sanity build

## Residual risks

- `no_confirm` / progress-bar setter names in 1.x need empirical confirmation
  via rustc during implementation (documented migration guide doesn't list
  them); will adapt to whatever the 1.x builder exposes.
- `self_update` 1.x default feature `progress-bar` pulls a progress-bar dep —
  we keep `default-features = false`, so no new heavy deps.
- Update behavior itself (GitHub release asset naming, `bin_path_in_archive`)
  is unchanged by the upgrade; `plan-reviewer update --check` exercises
  `ReleaseList` against the real repo for a manual smoke test after merge.
