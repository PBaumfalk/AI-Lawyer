# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** Ein Anwalt kann Akten, Dokumente, Fristen, E-Mails und Finanzen vollstaendig im Browser verwalten, waehrend eine proaktive KI-Agentin aktenuebergreifend lernt, automatisch Entwuerfe erstellt, Fristen erkennt und als digitale Rechtsanwaltsfachangestellte mitarbeitet.
**Current focus:** v3.5 Production Ready -- Phase 11: Glass UI Migration

## Current Position

Phase: 11 of 14 (Glass UI Migration)
Plan: 1 of 6 completed
Status: In progress
Last activity: 2026-02-26 -- Completed Plan 01 (Glass UI Foundation)

Progress: [######░░░░░░░░░░░░░░░░░░░░░░░░] 20%

## Performance Metrics

**Velocity:**
- Total plans completed: 38 (v3.4)
- v3.5 plans completed: 2
- Total execution time: see milestones/v3.4-ROADMAP.md

**By Phase (v3.5):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 10. Docker Build Fix | 3/3 | ~60min | ~20min |
| 11. Glass UI Migration | 1/6 | ~3min | ~3min |
| 12. Falldatenblaetter | 0/? | - | - |
| 13. BI-Dashboard | 0/? | - | - |
| 14. Export | 0/? | - | - |

## Accumulated Context

### Decisions

All v3.4 decisions archived in PROJECT.md Key Decisions table.

**Phase 11 Design Decisions (2026-02-26):**
- [11] Sidebar: Glass sidebar (backdrop-blur-xl transparent) — replaces Slate-900
- [11] Fonts: SF Pro Display → Inter → system-ui — replaces DM Serif Display / DM Sans
- [11] Animations: Motion/React v11 spring physics — adds to CSS transitions
- [11] Dark Mode: Full Light/Dark with .dark class strategy — new capability
- [11] Glass tiers: 4 blur levels (8px / 16px / 24px / 40px)
- [11] Design reference: /Users/patrickbaumfalk/Projekte/GVZ-Claude
- [11-01] Tailwind color references use raw var(--*) instead of hsl(var(--*)) — required for oklch CSS variable values to work correctly
- [11-01] UserSettings model created as separate table (not field on User) — extensible for future per-user settings
- [11-01] prisma db push deferred until Docker DB is running; schema validated, client generated

- [10-01] Use NEXT_PHASE env var to detect build-time SSR and skip pino-roll file transport
- [10-01] Add force-dynamic to health route to prevent static generation timeout on Redis
- [10-02] Use 127.0.0.1 in Alpine Docker healthchecks (localhost resolves to IPv6)
- [10-02] Copy date-fns into Docker runner stage (pino-roll transitive dependency)
- [10-03] pdf-parse must be esbuild external + copied in Dockerfile runner stage
- [10-03] useChat must live in parent layout component, not in leaf components
- [10-03] OnlyOffice public URL auto-derived from request Host header
- [10-03] Stirling-PDF requires SECURITY_ENABLELOGIN=false when security config volume exists
- [10-03] Ollama requires explicit --gpus all flag in docker-compose
- [10-03] qwen3.5:35b as default Ollama model (replaces mistral:7b)
- [10-03] Helena answers with general legal knowledge even without RAG hits

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-26
Stopped at: Completed 11-01-PLAN.md (Glass UI Foundation)
