---
plan: 16-01
phase: 16-slash-command-fallback
status: complete
self_check: PASSED
---

# Summary: Slash Command Fallback — Clipboard Paste Path (16-01)

## What Was Built

Updated `annotate_content` in `src/integrations/claude.rs` — the string written to
`commands/annotate.md` by `plan-reviewer install claude` — so that Step 4 now branches
on empty vs non-empty stdout from the background `plan-reviewer review` process.

**Two changes:**

1. **`annotate_content` Step 4 rewritten** — The new Step 4 structure:
   - Explains the process exits either on user click OR on server kill (process cleanup)
   - When stdout contains JSON: handles `allow` and `deny` identically to the previous implementation
   - When stdout is empty: asks the user to paste the clipboard JSON written by Phase 15's
     "Copy to clipboard" button, then handles pasted `allow`/`deny` payloads the same way

2. **Unit test updated** — `install_creates_annotate_md_with_expected_content` now asserts
   both new clipboard-fallback strings are present in the installed `annotate.md` file.

## Verification

- `grep "If no output is received" src/integrations/claude.rs` → 2 matches (annotate_content + test)
- `grep "please paste the JSON" src/integrations/claude.rs` → 2 matches (annotate_content + test)
- `grep "Review complete" src/integrations/claude.rs` → matches (allow path unchanged)
- `grep "Feedback received" src/integrations/claude.rs` → matches (deny path unchanged)
- `cargo test install_creates_annotate_md_with_expected_content` → 1 passed
- All 108 other tests pass; 1 pre-existing failure (`install_returns_err_when_binary_path_is_none`) predates this phase

## Key Files

### key-files.created
- path: src/integrations/claude.rs
  role: Updated annotate_content Step 4 with clipboard fallback branch

## Commits

- `feat(16-01): add clipboard fallback to annotate.md Step 4 (SLC-01)` — d1f8476

## Deviations

None. Implementation followed the plan exactly.
