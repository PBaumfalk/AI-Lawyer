# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v3.4 — Full-Featured Kanzleisoftware

**Shipped:** 2026-02-25
**Phases:** 13 (9 planned + 4 gap-closure) | **Plans:** 38 | **Tasks:** 105

### What Was Built
- Redis + BullMQ + Socket.IO real-time infrastructure with admin monitoring, health checks, graceful shutdown
- BGB-compliant Fristenberechnung (50+ tests), OnlyOffice co-editing with Track Changes, Vorlagen with Briefkopf, Ordner-Schemata
- Full IMAP IDLE + SMTP email client: three-pane inbox, compose with DMS attachments, Veraktung, ticket creation
- Auto-OCR document pipeline (Stirling-PDF) with RAG ingestion (German legal chunking, pgvector), PDF viewer
- Complete financial module: RVG calculator (KostBRaeG 2025, 157 tests), invoicing, XRechnung + ZUGFeRD, Aktenkonto with Fremdgeld compliance, DATEV/SEPA export, Zeiterfassung
- Multi-provider AI (Ollama/OpenAI/Anthropic) with RAG document chat, proactive Helena agent, auto-Fristenerkennung, beA integration
- RBAC with Dezernate, DSGVO compliance (anonymization, Auskunftsrecht PDF), system-wide Audit-Trail, Versand-Gate

### What Worked
- **Extreme throughput:** 90k LOC across 13 phases in 2 days — wave-based plan parallelization kept velocity high
- **Audit-driven quality:** 7 audit cycles caught real bugs (Pruefprotokoll query, dead code, missing wiring) before shipping
- **Gap-closure phases:** Decimal phase insertion (2.1, 2.2, 3.1, 4.1) fixed integration issues without disrupting numbering
- **Prisma schema as source of truth:** All data model changes started in schema, propagated cleanly to API + UI
- **Hand-built complex specs:** XRechnung CII XML hand-built instead of fighting @e-invoice-eu/core library — full EN16931 control
- **Non-fatal patterns:** Versand-Gate uses try-catch so document status failures never block email sends

### What Was Inefficient
- **4 of 13 phases were gap-closure insertions** — initial phase planning missed wiring/integration work. Phases 2.1, 2.2, 3.1, 4.1 were all "wire X to Y" work that should have been included in original plans
- **Multiple audit rounds needed:** 7 audit cycles to reach 64/64. Earlier audits would have caught gaps sooner
- **Tech debt from velocity:** Bull Board PUT stub (501), misleading comments in chat-input.tsx, worker log.level mutation deferred — minor but accumulated
- **Docker build issues deferred:** Webpack errors in financial module files block Docker builds (dev mode works). Not resolved during milestone

### Patterns Established
- **Decimal phase insertion:** Phase X.1 for urgent gap-closure work between existing phases
- **BullMQ queue chaining:** Upload triggers OCR, OCR triggers embedding, embedding triggers AI scan — fully async pipeline
- **Redis-backed Socket.IO:** Cross-process real-time events via `getSocketEmitter()` singleton
- **Multi-provider AI factory:** `getModel(provider, model)` with runtime switching, token tracking wrapper, rate limiting
- **Versand-Gate:** Non-fatal document status validation before send operations
- **esbuild bundling pipeline:** Separate build targets for server.ts and worker.ts with ESM output
- **Builder pattern for calculators:** RvgCalculator with fluent API, auto-Anrechnung, versioned fee tables

### Key Lessons
1. **Plan wiring phases explicitly.** 31% of phases (4/13) were unplanned gap-closure insertions. Future milestones should include "integration wiring" tasks in original phase plans, not as afterthoughts.
2. **Audit early, not just at the end.** Running audits only after all phases complete meant 7 cycles to converge. Auditing after each major domain (email, finance, AI) would catch gaps earlier.
3. **Hand-build when libraries fight you.** The XRechnung CII XML hand-build was faster and more correct than wrestling with @e-invoice-eu/core. For domain-specific specs with clear documentation, hand-building gives full control.
4. **Non-fatal wrappers for cross-cutting concerns.** The Versand-Gate pattern (try-catch around status checks) prevents cascading failures. Apply this to other cross-cutting validations.
5. **Docker build must be verified during milestone, not deferred.** Dev-mode success does not guarantee production build success.

### Cost Observations
- Model mix: ~40% opus (execution), ~35% sonnet (research/planning), ~25% haiku (verification/extraction)
- Sessions: ~15 sessions across 2 days
- Notable: Sustained ~750 LOC/hour across 90k LOC. Wave-based parallelization of plans was the key velocity multiplier.

---

## Milestone: v3.5 — Production Ready

**Shipped:** 2026-02-26
**Phases:** 2 (10–11) | **Plans:** 10 | **Files changed:** 234 | **+26,707 / -1,020 lines**

### What Was Built
- Docker production build fully fixed — Next.js compiles clean, all 9 services healthy (app, worker, postgres, redis, minio, meilisearch, stirling-pdf, onlyoffice, ollama)
- Complete oklch design token foundation — 4 glass blur tiers (8/16/24/40px), gradient mesh background, macOS scrollbars, full dark mode CSS structure
- Motion/React v11 spring physics — animated glass sidebar (backdrop-blur-xl), modal entry, button spring, count-up KPI animations; prefers-reduced-motion guards
- Glass component library — GlassCard (variants), GlassPanel (4 elevation tiers), GlassKpiCard, glass-input form primitives, glass-shimmer skeleton
- All 26 dashboard pages migrated to glass design — 0 `font-heading` in page files, all UI/form/list success criteria satisfied

### What Worked
- **Extreme velocity:** 10 plans across 234 files in ~4 min average/plan — glass design system was well-scoped and incremental
- **Design-token-first approach:** Defining oklch variables and glass-* utility classes in globals.css before migrating components made page migrations mechanical
- **Wave-based page migration:** Grouping pages by domain (dashboard, akten, kontakte, email, finanzen, admin) with one plan per domain kept each plan focused
- **Gap-closure Plan 07:** Catching remaining pages (KalenderListe, 3 admin/email pages) in a dedicated gap plan before archiving = clean slate
- **Motion/React types compatible with React 19:** The @ts-expect-error approach was unnecessary — motion v12.34.3 types are fully compatible

### What Was Inefficient
- **Phase 11 had 7 plans (not 6):** The gap-closure Plan 07 was needed despite thorough initial planning. Two deferred pages (admin/system, admin/settings) slipped through the SC7 check.
- **10-03 was very dense:** Gap closure phase combining vector-store fix + Docker rebuild + OnlyOffice URL + Stirling-PDF security + Ollama integration in one plan. Should have been 2 plans.
- **Scope reduction happened mid-milestone:** Phases 12-14 (FD, BI, Export) were planned but removed. Better to scope down at requirements time, not after planning.

### Patterns Established
- **oklch everywhere:** Color tokens use `oklch(L% C H)` syntax; Tailwind references `var(--token-name)` not `hsl(var(--token-name))`
- **Glass elevation model:** 4 tiers (subtle/default/elevated/overlay) map to blur levels (8/16/24/40px) and opacity levels
- **GlassKpiCard with count-up:** `useCountUp` hook with Motion number animation — reusable KPI display pattern
- **NEXT_PHASE build-flag:** Detect SSR build-time vs runtime to skip file transports in pino-roll
- **127.0.0.1 in Alpine healthchecks:** `localhost` resolves to IPv6 in Alpine; use explicit IPv4 address

### Key Lessons
1. **Scope decisions should happen at requirements time.** Removing Phases 12-14 mid-milestone created audit noise (13 orphaned requirements). Decide scope before planning phases.
2. **Glass design systems are highly iterative.** Expect 10–15% more pages to need migration than initially scoped. Build a gap-closure plan into every UI milestone.
3. **NEXT_PHASE flag pattern is reusable.** Any module that uses file I/O at module-load-time needs a build-time guard. Document this pattern for future heavy server modules.
4. **Docker healthchecks need IPv4 explicit.** Alpine's `localhost` → IPv6 gotcha affects all future Docker Alpine services. Use `127.0.0.1` everywhere.
5. **Motion/React v11 + React 19 is safe.** Don't add @ts-expect-error preemptively for upstream type mismatches — check actual type signatures first.

### Cost Observations
- Model mix: ~30% opus (complex migrations), ~60% sonnet (page-by-page migration), ~10% haiku (verification)
- Sessions: ~5 sessions across 2 days
- Notable: ~4 min/plan average — design-token-first approach made page migration very predictable

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Plans | Key Change |
|-----------|----------|--------|-------|------------|
| v3.4 | ~15 | 13 | 38 | First milestone with GSD workflow; gap-closure phases proved effective |
| v3.5 | ~5 | 2 | 10 | Design-token-first approach; scope reduction should happen at requirements time |

### Cumulative Quality

| Milestone | Tests | Requirements | Audit Cycles | Tech Debt Items |
|-----------|-------|-------------|-------------|-----------------|
| v3.4 | 207+ (Frist + RVG) | 64/64 | 7 | 5 (non-blocking) |
| v3.5 | 207+ (unchanged) | 5/18 shipped (13 deferred) | 1 | 2 (font-heading, .glass alias — non-blocking) |

### Top Lessons (Verified Across Milestones)

1. Plan integration wiring explicitly — gap-closure phases are effective but reactive
2. Audit incrementally rather than only at milestone boundary
3. Prisma schema as source of truth scales well across 60+ models
4. Scope decisions belong at requirements time — mid-milestone removals create audit noise
5. Design-token-first: define tokens before migrating components — makes page migrations mechanical
