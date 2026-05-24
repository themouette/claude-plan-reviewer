---
phase: 26-commit-navigation
plan: "01"
subsystem: frontend
tags: [tdd, typescript, react-hook, commit-navigation]
dependency_graph:
  requires: []
  provides:
    - ui/src/code-review/types.ts#Commit
    - ui/src/code-review/hooks/useCommits.ts
  affects:
    - ui/src/code-review/hooks/useCommits.test.ts
tech_stack:
  added: []
  patterns:
    - injectable-doFetch (mirrors useDiff pattern exactly)
    - cancelledRef (mount-safety, React 19 strict-mode)
    - loading-init-true (avoids react-hooks/set-state-in-effect violation)
key_files:
  created:
    - ui/src/code-review/hooks/useCommits.ts
    - ui/src/code-review/hooks/useCommits.test.ts
  modified:
    - ui/src/code-review/types.ts
decisions:
  - "useCommits has no reload/refetch method — commits are stable per session (D-12)"
  - "loading initialized to true to avoid react-hooks/set-state-in-effect violation (matches useDiff pattern)"
  - "cancelledRef pattern prevents setState after unmount in React 19 strict mode"
metrics:
  duration: "2 minutes"
  completed: "2026-05-24T14:50:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
---

# Phase 26 Plan 01: useCommits Hook + Commit Type Summary

**One-liner:** Commit TypeScript interface (snake_case per Rust JSON wire) + injectable fetchCommitsOnce pure function + useCommits React hook with cancelledRef, all TDD (RED f0c3b7d / GREEN 3b5b53c).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Commit interface + write failing tests (RED) | f0c3b7d | types.ts, useCommits.test.ts |
| 2 | Implement fetchCommitsOnce + useCommits (GREEN) | 3b5b53c | useCommits.ts |

## Test Output (GREEN)

```
 RUN  v4.1.4

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Duration  288ms
```

Three test cases pass:
1. Resolves to `{ commits, error: null }` on 200 response
2. Resolves to `{ commits: [], error: 'fetch failed' }` on non-ok response
3. Resolves to `{ commits: [], error: 'network error' }` when doFetch throws

## Deviations from Plan

None - plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. The `Commit` interface mirrors the existing Rust struct; `fetchCommitsOnce` calls the pre-existing `/api/commits` endpoint (Phase 24). No new threat surface.

## TDD Gate Compliance

- RED gate commit: f0c3b7d (`test(26-01): add failing useCommits tests + Commit type`) — vitest confirmed failing
- GREEN gate commit: 3b5b53c (`feat(26-01): implement useCommits hook`) — vitest confirms 3 passed
- REFACTOR gate: not needed — implementation is a clean structural copy of useDiff

## Self-Check: PASSED

- [x] `ui/src/code-review/types.ts` — contains `export interface Commit` (1 match)
- [x] `ui/src/code-review/hooks/useCommits.ts` — exists, contains `fetchCommitsOnce`, `useCommits`, `cancelledRef`, no `refetch`, no `reviewer-v2/`
- [x] `ui/src/code-review/hooks/useCommits.test.ts` — exists, contains `describe('fetchCommitsOnce'`, 3 `it(` cases
- [x] Commit f0c3b7d exists (`test(26-01): add failing useCommits tests + Commit type`)
- [x] Commit 3b5b53c exists (`feat(26-01): implement useCommits hook`)
- [x] `npx vitest run code-review/hooks/useCommits.test.ts` exits 0 with "3 passed"
- [x] `npx eslint --max-warnings 0` exits 0
- [x] `npx tsc --noEmit` exits 0
