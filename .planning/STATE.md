# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** Ein Anwalt kann Akten, Dokumente, Fristen, E-Mails und Finanzen vollstaendig im Browser verwalten, waehrend eine proaktive KI-Agentin aktenuebergreifend lernt, automatisch Entwuerfe erstellt, Fristen erkennt und als digitale Rechtsanwaltsfachangestellte mitarbeitet.
**Current focus:** v3.5 Production Ready -- Phase 11: Glass UI Migration

## Current Position

Phase: 11 of 14 (Glass UI Migration)
Plan: 3 of 6 completed
Status: In progress
Last activity: 2026-02-26 -- Completed Plan 03 (Glass UI Primitives)

Progress: [################░░░░░░░░░░░░░░] 50%

## Performance Metrics

**Velocity:**
- Total plans completed: 38 (v3.4)
- v3.5 plans completed: 2
- Total execution time: see milestones/v3.4-ROADMAP.md

**By Phase (v3.5):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 10. Docker Build Fix | 3/3 | ~60min | ~20min |
| 11. Glass UI Migration | 3/6 | ~8min | ~3min |
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
- [11-02] motion@12.34.3 types are compatible with React 19 — removed @ts-expect-error directives that would have caused TS2578 errors
- [11-02] Active nav item: oklch(45% 0.2 260/0.15) bg + 2px left border — brand-blue indicator pattern established
- [11-03] button.tsx asChild path uses plain Slot without Motion — Spring on Slot would conflict with children transforms
- [11-03] @ts-expect-error retained on motion.button — motion v11 + React 19 ButtonHTMLAttributes mismatch is upstream issue, runtime correct
- [11-03] Glass form control pattern: glass-input class replaces border/bg-background in all Input/Textarea/Select
- [11-03] Skeleton uses glass-shimmer class (not animate-pulse bg-muted) — consistent with glass design system

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
Stopped at: Completed 11-03-PLAN.md (Glass UI Primitives)
