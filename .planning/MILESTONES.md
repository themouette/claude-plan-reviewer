# Milestones

## v0.1.0 MVP (Shipped: 2026-04-10)

**Phases completed:** 4 phases, 14 plans, 24 tasks

**Key accomplishments:**

- Compilable Rust binary with ExitPlanMode stdin parse, comrak GFM rendering, clap --no-browser flag, and serde_json stdout-only write — proves stdout discipline before any server code exists
- Axum server on OS-assigned port with oneshot decision channel, 540s timeout, 3-second watchdog, and placeholder HTML — full stdin-to-stdout hook loop operational before React UI exists
- React+TS+Vite frontend with Tailwind CSS, full plan review UI (loading/error/reviewing/confirmed states, Enter-to-approve, deny with required message, confirmation auto-close), and build.rs npm pipeline — all UI-SPEC.md colors, copy, and interactions implemented exactly
- React SPA embedded in binary via rust-embed + axum-embed: placeholder HTML removed, debug asset check added, full Phase 1 end-to-end flow verified by automation
- One-liner:
- React annotation system: types, serializeAnnotations (8 tests passing), useTextSelection hook, TabBar/DiffView/AnnotationSidebar components ready for App.tsx wiring in Plan 03
- Layout (D-01):
- One-liner:
- One-liner:
- One-liner:
- One-liner:
- One-liner:

---
