# Phase 17: Foundation & Isolation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 17-foundation-isolation
**Areas discussed:** Heartbeat isolation, Annotation store shape, ESLint coupling rule form, Routing mechanism

---

## Heartbeat Isolation

| Option | Description | Selected |
|--------|-------------|----------|
| Import useHeartbeat directly | hooks/ is shared infrastructure, not App.tsx state. DI-based, fully tested. | (revised) |
| Copy into reviewer-v2/ | Full isolation — reviewer-v2/hooks/useHeartbeat.ts owns its own copy. v1 deletion is clean. | ✓ |
| You decide | Leave to planner. | |

**User's choice:** Copy into reviewer-v2/ (after clarification — see below)
**Notes:** User clarified that the coupling direction was misunderstood in the first question. The real requirement is that reviewer-v2/ should NOT import from v1 at all, so that v1 can be deleted cleanly. This overrode the initial "import directly" recommendation. reviewer-v2/ also gets its own ConnectivityStatus state — two independent pollers, same `/api/ping` endpoint.

---

## Coupling Direction Clarification

| Option | Description | Selected |
|--------|-------------|----------|
| Copy into reviewer-v2/ what v2 needs | Total isolation. v1 deletion is clean. Some duplication. | ✓ |
| Create src/shared/ folder | Move utilities to shared/. No duplication but requires file moves. | |
| Hybrid: copy pure utils, reuse hook | Only cross-boundary import is the hook itself. | |

**User's choice:** Copy into reviewer-v2/ what v2 needs
**Notes:** User explicitly stated the goal: "v1 should be easy to remove, so reviewer-v2/ should not import from v1." This drives all isolation decisions.

---

## Annotation Store Shape

| Option | Description | Selected |
|--------|-------------|----------|
| useReducer with typed actions | Predictable state, no new dep, testable by calling reducer directly without React renderer. | ✓ |
| useState array in root | Simplest. Harder to test transitions in isolation. | |
| Zustand store | New dep. Testable outside React. Overkill for local single-user tool. | |

**User's choice:** useReducer with typed actions

| Option | Description | Selected |
|--------|-------------|----------|
| reviewer-v2/store/annotations.ts — pure reducer | Reducer and types are pure functions. Root component wires useReducer. | |
| reviewer-v2/hooks/useAnnotations.ts — hook wrapper | Hook wraps useReducer, exposes add/edit/remove helpers. | ✓ |
| You decide | Leave to planner. | |

**User's choice:** reviewer-v2/hooks/useAnnotations.ts — hook wrapper

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: id, anchorText, comment, type | Starting point. Later phases extend with anchorOffset, sectionId. | ✓ |
| Full type from the start | Include all fields now. Risk of premature design. | |

**User's choice:** Minimal for phase 17: id, anchorText, comment, type

---

## ESLint Coupling Rule Form

**Note:** The initial question described the coupling rule backwards. After user clarification, the correct rule is: files inside `reviewer-v2/` must not import from outside `reviewer-v2/` (not the other way around).

| Option | Description | Selected |
|--------|-------------|----------|
| no-restricted-imports on reviewer-v2/ files | files: ['**/reviewer-v2/**'], blocks ../ relative imports. Zero new deps. | ✓ |
| eslint-plugin-boundaries | Declarative zone-based enforcement. New dep. Better for multi-zone. | |
| Custom ESLint rule | Maximum control, significant boilerplate for single constraint. | |

**User's choice:** no-restricted-imports on reviewer-v2/ files
**Notes:** User rejected the initial question because the coupling direction was wrong. The correct direction is enforced on reviewer-v2/ files (they cannot import from local paths outside reviewer-v2/). v1 MAY import from reviewer-v2/ if useful.

---

## Routing Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Inline pathname check in main.tsx | window.location.pathname.startsWith('/v2'). Zero new dep. | ✓ |
| Install wouter (~1.5KB) | Tiny router dep. Good for more routes. | |
| Install react-router v7 | Full router. Overkill for 2 routes. | |

**User's choice:** Inline pathname check in main.tsx

| Option | Description | Selected |
|--------|-------------|----------|
| /v2 path prefix | startsWith('/v2'). Matches REQUIREMENTS.md LAYOUT-01. | ✓ |
| /#/v2 hash | Hash-based. Works without server support but server already handles paths. | |
| ?v=2 query param | Simpler but less conventional. | |

**User's choice:** /v2 path prefix

---

## Claude's Discretion

- Specific Tailwind classes and CSS Grid vs Flexbox for the 3-column shell
- Directory structure within `reviewer-v2/` beyond `hooks/` and `utils/`
- Whether `reviewer-v2/utils/connectivity.ts` is verbatim copy or stripped minimum

## Deferred Ideas

None — discussion stayed within phase scope.
