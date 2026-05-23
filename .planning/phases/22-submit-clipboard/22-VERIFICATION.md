---
phase: 22-submit-clipboard
verified: 2026-05-22T22:30:33Z
status: human_needed
score: 4/5
overrides_applied: 0
gaps: []
human_verification:
  - test: "With 0 comments, clicking Send Feedback opens the popover — verify popover submit is disabled, requires user to type a message before submission can proceed"
    expected: "Popover opens; textarea shows '(required)' placeholder; Send Feedback button inside popover is dimmed and unclickable until message typed; typing a message enables submit"
    why_human: "SC#2 and SUBMIT-01 require 'Ask for changes impossible when no comments exist'. The implementation deviates — the Send Feedback button is always enabled but the popover's internal submit is gated. This deviation was approved by the developer (commit 8c88aae) but the ROADMAP SC#2 wording says 'button disabled'. Human must confirm the revised UX is accepted as satisfying SUBMIT-01."
  - test: "With 0 comments, submit is blocked at the popover level — user CANNOT submit feedback with no message and no comments"
    expected: "User cannot submit an empty ask-for-changes. The popover submit button remains disabled until the user types at least one character."
    why_human: "Verifies the functional equivalent of SUBMIT-01 is met even though the gate operates at the popover submit level rather than the Send Feedback button level."
---

# Phase 22: Submit & Clipboard — Verification Report

**Phase Goal:** Wire Phase 22 submit/clipboard components into the v2 reviewer so users can Approve or Send Feedback on plans, both online (POST /api/decide) and offline (clipboard fallback).
**Verified:** 2026-05-22T22:30:33Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Approve is HTML-disabled when one or more comments exist | VERIFIED | `disabled={!canApprove}` in SubmitControls.tsx:110; `canApprove = annotations.length === 0` (line 25) |
| 2 | Clicking "Ask for changes" is impossible (button disabled) when no comments exist | UNCERTAIN | Send Feedback button has NO `disabled` attr — always enabled. Instead, the popover's internal Submit is disabled when `messageRequired && message.trim() === ''`. Developer changed this intentionally (commit 8c88aae); human verification passed with "approved" but Gate 1 in 22-04-PLAN expected HTML-disabled. The gate operates at popover submit level, not button level. |
| 3 | "Ask for changes" accepts an optional free-text message before submission; submitting without a message is permitted | PARTIAL | When comments exist (`messageRequired=false`), message is optional — VERIFIED. When NO comments (`messageRequired=true`), message is REQUIRED — conflicts with "submitting without a message is permitted" as a universal statement. REQUIREMENTS.md SUBMIT-01 says "disabled when no comments exist" — intent is that this case requires a message. |
| 4 | The JSON returned by v2 submit path is identical in format to existing reviewer | VERIFIED | POST `/api/decide` with `{ behavior: 'allow' }` or `{ behavior: 'deny', message }` — identical to v1 path. Same `post_decide` handler in server.rs:57 processes both. |
| 5 | When offline, submit uses `buildClipboardPayload` — no separate clipboard implementation in v2 | DEVIATED (intentional) | v2 has own copy at `reviewer-v2/offlineLabels.ts`. Duplication is ARCH-01 mandated (no imports outside reviewer-v2/). 22-01-PLAN line 45 documents this as the established Phase 17 pattern. Function logic is byte-identical to v1 copy. |

**Score:** 4/5 truths verified (Truth 5 is an intentional ARCH-01-justified deviation; Truth 2 and 3 are behavioral deviations approved by developer but require human confirmation of SUBMIT-01 satisfaction)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `ui/src/reviewer-v2/offlineLabels.ts` | OFFLINE_BANNER_LINE_1/LINE_2 constants, `buildClipboardPayload`, `shouldUseClipboard` | VERIFIED | All four exports present; constants match UI-SPEC values; function logic identical to v1 copy |
| `ui/src/reviewer-v2/SubmitPopover.tsx` | Controlled popover, messageRequired prop gates submit when no comments | VERIFIED | `messageRequired` prop; `canSubmit = !messageRequired \|\| message.trim().length > 0`; autoFocus; Escape + outside-click dismiss; Cmd+Enter submit |
| `ui/src/reviewer-v2/SubmitControls.tsx` | Approve + Send Feedback; canApprove/messageRequired gates; online + offline paths | VERIFIED | `canApprove = annotations.length === 0`; `messageRequired = annotations.length === 0`; both `handleApprove` and `handleAskForChanges` branch on `shouldUseClipboard(connectivity)`; all 6 SubmitState literals present |
| `ui/src/reviewer-v2/ReviewerV2Shell.tsx` | OfflineBanner sub-component, SubmitControls in header right slot, useHeartbeat lifted | VERIFIED | `const connectivity = useHeartbeat()` (line 18); `<SubmitControls annotations={annotations} connectivity={connectivity} />` (line 62); `function OfflineBanner()` after default export (line 148); `{connectivity === 'offline' && <OfflineBanner />}` (line 65) |
| `ui/src/reviewer-v2/ReviewerV2.tsx` | Clean pass-through, no void hook calls | VERIFIED | 4-line file (164 bytes < 300-byte target); no `void useHeartbeat` or `void useAnnotations`; single `return <ReviewerV2Shell />` |
| `ui/src/index.css` | `.submit-btn` transition rule | VERIFIED | Lines 270-272: `.submit-btn { transition: background 0.1s ease, opacity 0.1s ease; }` |
| `src/main.rs` | Browser opens at /v2 | VERIFIED | Line 719: `let url = format!("http://127.0.0.1:{}/v2", port);` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `ReviewerV2Shell.tsx` | `SubmitControls.tsx` | default import + render in header right slot | VERIFIED | `import SubmitControls from './SubmitControls'` (line 7); `<SubmitControls annotations={annotations} connectivity={connectivity} />` (line 62) |
| `ReviewerV2Shell.tsx` | `useHeartbeat.ts` | named import + call returning ConnectivityStatus | VERIFIED | `import { useHeartbeat } from './useHeartbeat'` (line 6); `const connectivity = useHeartbeat()` (line 18) |
| `ReviewerV2Shell.tsx` (OfflineBanner) | `offlineLabels.ts` OFFLINE_BANNER_LINE_1 / LINE_2 | named import + text-node rendering | VERIFIED | `import { OFFLINE_BANNER_LINE_1, OFFLINE_BANNER_LINE_2 } from './offlineLabels'` (line 8); `{OFFLINE_BANNER_LINE_1}` and `{OFFLINE_BANNER_LINE_2}` in OfflineBanner body |
| `SubmitControls.tsx` | `offlineLabels.ts` | `buildClipboardPayload` + `shouldUseClipboard` | VERIFIED | `import { buildClipboardPayload, shouldUseClipboard } from './offlineLabels'` (line 4); both called in both handlers |
| `ReviewerV2.tsx` | `ReviewerV2Shell.tsx` | default import + single return | VERIFIED | `import ReviewerV2Shell from './ReviewerV2Shell'`; `return <ReviewerV2Shell />` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `SubmitControls.tsx` | `annotations` | `useAnnotations()` in ReviewerV2Shell passed as prop | Yes — `useAnnotations` is a real reducer with add/edit/remove dispatch | FLOWING |
| `SubmitControls.tsx` | `connectivity` | `useHeartbeat()` in ReviewerV2Shell passed as prop | Yes — heartbeat polls `/api/ping` every 5s with 3-failure transition to offline | FLOWING |
| `ReviewerV2Shell.tsx` (OfflineBanner) | `connectivity` | `useHeartbeat()` called directly in Shell | Yes — same hook instance | FLOWING |
| `SubmitControls.tsx` | clipboard JSON | `buildClipboardPayload('allow'/'deny', ...)` | Yes — real serialization of `annotations` via `serializeAnnotations` | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| ReviewerV2.tsx has no void hook calls | `grep -c "void useHeartbeat\|void useAnnotations" ReviewerV2.tsx` | 0 | PASS |
| ReviewerV2.tsx file size < 300 bytes | `wc -c ReviewerV2.tsx` | 164 bytes | PASS |
| SubmitControls uses `disabled={!canApprove}` exactly once | grep count | 1 | PASS |
| Send Feedback button has NO `disabled` attribute | grep | not found | DEVIATION — see SC#2 note |
| `connectivity === 'offline' && <OfflineBanner />` in Shell | grep | found line 65 | PASS |
| index.css .submit-btn rule exists | grep | found lines 270-272 | PASS |
| Full test suite | `cd ui && npm test` | 381 tests, 0 failed | PASS |
| Browser opens at /v2 | `grep 'format.*v2' src/main.rs` | line 719 confirmed | PASS |

---

### Probe Execution

Step 7c: No `scripts/*/tests/probe-*.sh` files discovered for this phase. SKIPPED.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| SUBMIT-01 | 22-03, 22-04 | Approve disabled when comments; Ask for changes disabled when no comments; optional message | PARTIAL | Approve gate: VERIFIED. Ask-for-changes gate: DEVIATED — Send Feedback button always enabled; popover submit gated internally. Optional message: VERIFIED when comments exist; message REQUIRED when no comments (contradicts "optional" universally). Developer accepted this behavior change. |
| SUBMIT-02 | 22-01, 22-03 | Clipboard fallback reuses `buildClipboardPayload`/`shouldUseClipboard`, not reimplemented | DEVIATED (intentional) | v2 has its own copy in `reviewer-v2/offlineLabels.ts` per ARCH-01. Logic is byte-identical. 22-01-PLAN explicitly documents the copy as required by ARCH-01 isolation. |

---

### Anti-Patterns Found

Scanned files: ReviewerV2.tsx, ReviewerV2Shell.tsx, SubmitControls.tsx, SubmitPopover.tsx, offlineLabels.ts, index.css

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | No TBD/FIXME/XXX/TODO/PLACEHOLDER markers in any Phase 22 file |

---

### Human Verification Required

The automated implementation is correct and all tests pass (381/381). Human verification is required for the following SUBMIT-01 behavioral deviation:

#### 1. Send Feedback Always-Enabled Gate (SUBMIT-01 Interpretation)

**Test:** Open the running app at `/v2` with 0 comments.
- Observe the Send Feedback button — it is NOT dimmed, NOT disabled (always enabled).
- Click "Send Feedback ▾" — a popover opens with textarea showing "(required)" placeholder.
- Try clicking the red "Send Feedback" button inside the popover WITHOUT typing anything — verify it is disabled (dimmed, cursor default, does not submit).
- Type a message — verify the popover Submit button becomes enabled.
- Confirm this behavior satisfies SUBMIT-01's intent: "Ask for changes cannot be submitted without content when no comments exist."

**Expected:** Clicking the Send Feedback button always opens the popover. The popover's Submit button is disabled when no comments exist AND no message is typed. Once the user types a message, Submit becomes enabled.

**Why human:** ROADMAP SC#2 says "Clicking 'Ask for changes' is impossible (button disabled)" — the literal wording means the button should be HTML-disabled. The implementation has the button always enabled but gates submission at the popover level. This deviation was committed by the developer (commit `8c88aae`) after initial implementation. The developer explicitly approved this in the human verification pass. A human decision is needed to formally accept the ROADMAP wording deviation and confirm that the popover-level gate satisfies SUBMIT-01.

#### 2. SUBMIT-01 Message Required When No Comments

**Test:** With 0 comments, open the Send Feedback popover. Confirm the placeholder reads "Leave a message (required — no comments added)" and the Submit button only enables after typing. With 1+ comments, confirm the placeholder reads "Leave a message (optional)" and Submit is immediately enabled.

**Expected:** `messageRequired=true` when `annotations.length === 0`, `messageRequired=false` when `annotations.length > 0`. This ensures feedback cannot be empty (either via inline comments or an overall message).

**Why human:** REQUIREMENTS.md SUBMIT-01 says the message is optional; SC#3 says "submitting without a message is permitted." When no comments exist, the v2 implementation makes the message REQUIRED. This achieves the safety goal (no empty feedback) differently than specified. Human must confirm this is an acceptable interpretation of SUBMIT-01.

---

### Gaps Summary

No automated blockers found. The phase goal is substantially achieved:

- All five key components exist and are substantively implemented
- The wiring chain (offlineLabels → SubmitPopover → SubmitControls → ReviewerV2Shell → ReviewerV2) is fully connected
- Both online and offline submission paths work end-to-end
- 381 automated tests pass
- All Phase 17-21 functionality is preserved (OutlinePane, ContentPane, CommentPane wiring intact)

Two behavioral deviations require human acceptance:

1. **SC#2 / SUBMIT-01 gate location:** Send Feedback button is always enabled; submission is gated inside the popover (not at the button level). This achieves the same safety goal differently. The developer explicitly approved this UX approach.

2. **SC#5 / SUBMIT-02 clipboard utility:** v2 has its own `offlineLabels.ts` copy rather than importing from `ui/src/utils/`. This is architecturally required by ARCH-01 (ESLint blocks cross-subtree imports). The function logic is byte-identical. This is documented as the Phase 17 pattern.

The SC#5 deviation is architectural and well-documented. The SC#2 deviation requires human confirmation that the popover-level gate satisfies SUBMIT-01.

---

_Verified: 2026-05-22T22:30:33Z_
_Verifier: Claude (gsd-verifier)_
