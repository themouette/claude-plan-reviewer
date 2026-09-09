# Tier 1: testability refactor + unit tests for the self-update core

## Goal

Close the zero-coverage gap on the pure/testable parts of the self-update
path in `src/update.rs`. No behavior changes — extraction plus tests.

## Changes

### 1. Extract `normalize_target_version`

Move the inline normalization out of `perform_update()` into a testable
function, preserving exact current behavior:

```rust
/// Normalize a user-supplied target version:
/// - None -> None (no specific version requested)
/// - "latest" -> None (explicit latest)
/// - "vX.Y.Z" -> "X.Y.Z" (strip v prefix)
fn normalize_target_version(target_version: Option<String>) -> Option<String>
```

`perform_update` calls it; no logic change.

### 2. Make `clear_update_cache` testable

Follow the file's existing `_with_home` pattern:

```rust
fn clear_update_cache()            // unchanged wrapper, reads HOME, delegates
fn clear_update_cache_in(home: &Path)   // testable core
```

### 3. Unit tests (new, in the existing `mod tests`)

- **`normalize_target_version`**: None → None; `"latest"` → None;
  `"v0.2.0"` → `"0.2.0"`; `"0.2.0"` → `"0.2.0"` (no double-strip);
  `"latest"` exact-match only (no case folding — documents current behavior).
- **`sanitize_version`** — the terminal-escape-injection defense (T-04-07):
  - plain semver passes through (`"1.2.3"` → `"1.2.3"`)
  - allowed punctuation retained: `.`, `-`, `+` (e.g. `"1.0.0-rc.1+build"`)
  - CR/LF stripped (`"1.0\r\n0"` → `"1.00"`)
  - ESC escape sequence stripped (`"v1.0\x1b]50;...\x07"` → `"v1.0"`)
  - ANSI CSI stripped (`"\x1b[2J"` alone → empty)
  - control chars / unicode filtered (`"1.0\x00"` → `"1.0"`)
- **`clear_update_cache_in`**: removes an existing `update-check.json`;
  no panic/error when the file is missing.

## Verification

`cargo test` (new tests + existing 38), `cargo fmt`,
`cargo clippy -- -D warnings`.

## Out of scope (tier 2, later)

- Mock-server integration test for `get_latest_version` / `perform_update`
  download path and the `Releases::latest()` ordering assumption.
- `current_platform` refactor.
