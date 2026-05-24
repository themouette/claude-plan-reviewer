---
created: 2026-05-24T21:35:08.384Z
title: Phase 26 commit navigation UX feedback and fixes
area: ui
files:
  - ui/src/
---

## Problem

Phase 26 (Commit Navigation) has been tested and produced 5 issues requiring a follow-up phase:

1. **Expand all broken** — the expand-all button is not working in the diff viewer
2. **Commit drawer must push content** — the commit drawer currently overlays the main diff panel; it should push/shift the content instead
3. **Diff stats not shown** — total files changed, additions count, and deletions count should be visible somewhere in the UI
4. **Commit selection UX redesign** — current checkbox multi-select model is broken UX:
   - Click a commit → single-select; main panel shows commit header + that commit's diff
   - CMD+click or Shift+click → add to selection; main panel shows list of selected commits (short hash + title, expandable to full diff)
   - All commits selected → main panel labels as "diff from branch XXXX"
5. **Branch/tag pills in commit list** — when a commit has a branch or tag ref attached, show it inline as a pill (e.g. `branch:main`, `tag:v0.6.0`)

## Solution

Create a new phase (Phase 26.1 or 27 after renumbering) that addresses all 5 items together. The commit selection redesign is the most substantial — it changes the interaction model from checkbox-based to click/CMD+click/Shift+click (standard OS multi-select pattern). Discuss the approach before planning.
