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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Plans | Key Change |
|-----------|----------|--------|-------|------------|
| v3.4 | ~15 | 13 | 38 | First milestone with GSD workflow; gap-closure phases proved effective |

### Cumulative Quality

| Milestone | Tests | Requirements | Audit Cycles | Tech Debt Items |
|-----------|-------|-------------|-------------|-----------------|
| v3.4 | 207+ (Frist + RVG) | 64/64 | 7 | 5 (non-blocking) |

### Top Lessons (Verified Across Milestones)

1. Plan integration wiring explicitly — gap-closure phases are effective but reactive
2. Audit incrementally rather than only at milestone boundary
3. Prisma schema as source of truth scales well across 60+ models
