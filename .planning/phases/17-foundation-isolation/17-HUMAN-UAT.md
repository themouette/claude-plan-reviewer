# Phase 17 — Human UAT Checklist

**Status:** pending  
**Generated:** 2026-05-20  
**Phase:** 17 foundation-isolation

All automated checks passed (11/12). The following items require a human browser session to verify.

---

## UAT-01: /v2 renders 3-column shell (LAYOUT-01 + LAYOUT-02)

**Steps:**

```bash
# 1. Build the binary
cargo build --release

# 2. Start the server
./target/release/plan-reviewer
```

3. Open `http://127.0.0.1:4717/v2` in a browser  
4. Confirm:
   - [ ] 3-column layout is visible: outline aside (200px) | content main (flex-1) | comments aside (280px)
   - [ ] 48px header bar is rendered at the top
   - [ ] Column borders or visual separation between columns is visible
   - [ ] Placeholder labels ("Outline", "Content", "Comments") or equivalent content is shown
   - [ ] DevTools → Network tab shows `GET /api/ping` within 5 seconds (heartbeat polling active)

---

## UAT-02: /v1 (root) unchanged (LAYOUT-02 regression check)

5. Open `http://127.0.0.1:4717/` in a browser  
6. Confirm:
   - [ ] Original v1 reviewer UI renders unchanged
   - [ ] No v2 shell, no routing leak

---

## Resolution

Once verified, mark status as `approved` and proceed with:

```
/gsd:execute-phase 17 --auto --no-transition
```

Or run manually:

```bash
gsd-sdk query phase.complete "17"
```
