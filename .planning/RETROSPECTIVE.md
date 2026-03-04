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

## Milestone: v0.1 — Helena RAG

**Shipped:** 2026-02-27
**Phases:** 7 (12–18) | **Plans:** 19 | **Commits:** 243

### What Was Built
- Hybrid Search via RRF (Meilisearch BM25 + pgvector cosine, k=60, N=50) + Cross-Encoder Reranking (Ollama, top-50 → top-10, 3s timeout fallback) — all ki-chat retrievals upgraded
- Parent-Child Chunking: 500-token retrieval chunks linked to 2000-token context chunks via self-referential Prisma relation + ChunkType enum
- Gesetze-RAG: bundestag/gesetze GitHub Sync → law_chunks (HNSW), daily BullMQ cron at 02:00, encoding smoke test, Helena Chain D with "nicht amtlich" disclaimer
- §§-Verknüpfung in Akte: NormenSection UI (search modal + chip-list), AkteNorm API routes, ki-chat Chain A (pinned normen at highest system prompt priority)
- NER PII-Filter: Ollama few-shot (5+ German legal examples) + institution whitelist (20+ regex patterns), state machine PENDING_NER → NER_RUNNING → INDEXED | REJECTED_PII_DETECTED
- Urteile-RAG: 7 BMJ RSS feeds → urteil_chunks with double PII gate (inline + query-time), daily BAG incremental sync via GUID cache, ki-chat Chain E (kein LLM-generiertes AZ)
- Muster-RAG + Admin UI: amtliche Formulare with {{PLATZHALTER}}, /admin/muster upload (MinIO), async NER via BullMQ, 1.3× kanzlei boost, ki-chat Chain F (ENTWURF Schriftsätze)

### What Worked
- **6-chain parallel ki-chat:** All chains (A=pinned normen, B=hybrid search, C=model config, D=gesetze, E=urteile, F=muster) launch as independent async IIFEs, collected by a single Promise.all — zero blocking, shared queryEmbedding generated once
- **Double PII gate pattern for Urteile:** Inline `runNerFilter()` before INSERT + `piiFiltered=true` query filter — two independent gates, neither is a single point of failure
- **Integration checker caught a real bug:** The `params` not awaited pattern in admin/muster/[id]/route.ts was missed by phase verification but caught by the integration checker — demonstrating the value of cross-phase wiring analysis
- **Inline NER for Urteile, BullMQ NER for Muster:** The two-track approach (synchronous for per-item pipeline, async state machine for user-uploaded files) was architecturally correct for each use case
- **HNSW indexes via manual SQL:** Follows the existing `manual_pgvector_index.sql` pattern — Prisma doesn't generate HNSW DDL, manual-sql approach is consistent and clean

### What Was Inefficient
- **Phase 12 SUMMARY missing `requirements_completed` field:** The one SUMMARY without this field (12-01) caused a "partial" flag in the 3-source cross-reference, requiring manual verification. Cost: minor audit friction.
- **processUrteilNer() dead code:** Phase 16 created a BullMQ dispatch path for Urteil NER that Phase 17 never uses (it went inline). Planning didn't coordinate this cross-phase decision. Dead code should be removed.
- **adhoc-bugfixes session mid-milestone:** Reasoning UI + multiple bugfixes were done in an ad-hoc session outside the GSD phase structure — valuable work but context saved only in .continue-here.md, not in SUMMARY/VERIFICATION artifacts.

### Patterns Established
- **6-chain parallel ki-chat:** Pattern for adding additional knowledge source = new `ChainXPromise` IIFE + await in Promise.all + system prompt injection block. Zero changes to other chains.
- **Double PII gate:** Inline NER before INSERT + query-time piiFiltered/nerStatus filter on retrieval — defense in depth for DSGVO compliance.
- **RSS incremental sync with GUID cache:** `loadGuidCache/saveGuidCache` via SystemSetting — idempotent, avoids re-processing seen items. Reusable for any RSS-based sync.
- **seedAmtlicheFormulare() at worker startup with SystemSetting guard:** One-time idempotent seed without cron complexity. Apply to any hardcoded dataset.
- **Next.js 15 params Promise:** Always `const { id } = await params;` for dynamic route params. Sync access returns undefined in Next.js 15 App Router.

### Key Lessons
1. **Integration checker is essential.** Phase-level verification passed for ARBW-02 but the cross-phase params issue was only caught by the integration checker. Always run it.
2. **Coordinate cross-phase implementation decisions during planning.** The processUrteilNer dead code resulted from Phase 16 and Phase 17 independently choosing different NER approaches. A brief inter-phase planning note would have prevented this.
3. **SUMMARY frontmatter quality matters.** Missing `requirements_completed` in even one SUMMARY creates audit friction. Standardize this field across all plans.
4. **LLM-as-reranker is validated for legal RAG.** qwen3.5:35b as cross-encoder (not dedicated Qwen3-Reranker-4B) works well — 3s timeout fallback prevents latency blowup.
5. **Double PII gating is the right DSGVO pattern.** The overhead of two checks is negligible; the protection against silent indexing of PII is non-negotiable for §43a BRAO compliance.

### Cost Observations
- Model mix: ~35% opus (execution/integration), ~55% sonnet (planning/research), ~10% haiku (extraction)
- Sessions: ~8 sessions across 2 days
- Notable: Integration checker (gsd-integration-checker) found the ARBW-02 defect that phase verifiers missed — strong ROI for cross-phase wiring analysis

---

## Milestone: v0.2 — Helena Agent

**Shipped:** 2026-02-28
**Phases:** 10 (19-27 + 23.1) | **Plans:** 23 | **Tasks:** 53 | **Commits:** 131

### What Was Built
- ReAct Agent-Loop: 14 tools (9 read + 5 write), bounded execution (5/20 steps inline/background), Ollama response guard, token budget manager, complexity classifier, rate limiter — 46 tests pass
- Deterministic Schriftsatz-Orchestrator: Intent-Router (Klageart/Stadium/Gerichtszweig), Slot-Filling mit automatischer Rueckfrage, RAG Assembly (4000 chars/section), ERV/beA-Validator, multi-turn via PendingSchriftsatz
- @Helena Task-System: @-mention parsing, BullMQ helena-task queue (lockDuration:120s), Socket.IO progress, task abort, REST API
- Draft-Approval Workflow: ENTWURF Prisma $extends gate (BRAK 2025), HelenaDraft lifecycle (accept/reject/edit), feedback-to-context, Socket.IO notifications, global draft inbox
- Background-Scanner (BullMQ cron): Frist-Check, Inaktivitaets-Check, Anomalie-Check, Alert-Deduplizierung, Auto-Resolve, Eskalation, Alert-Center UI + Sidebar-Badge
- Helena Memory: per-Akte Kontext (Zusammenfassung, Risiken, naechste Schritte), auto-refresh, DSGVO cascade delete, 5min cooldown
- Activity Feed UI: Akte-Detail Feed replaces 8 tabs (921→152 LOC), Composer with @Helena tagging, Helena vs Human Attribution, inline Draft-Review
- QA-Gates: Goldset (20 Queries Arbeitsrecht), Retrieval-Metriken (Recall@k, MRR), Halluzinations-Check, Release-Gates, Schriftsatz-Retrieval-Log

### What Worked
- **Zero new npm packages:** All agent capabilities (ReAct, tools, scanner, memory, QA) built entirely on existing AI SDK v4 + BullMQ + Prisma + Socket.IO — no dependency bloat
- **Deterministic pipeline for Schriftsatz:** Using generateObject instead of free-form ReAct for legal filings gives predictable, Zod-validated output — right architectural choice for structured legal documents
- **Defense-in-depth ENTWURF gate:** Prisma $extends (not HTTP middleware) enforces BRAK compliance at database level — cannot be bypassed by any code path
- **Activity Feed consolidation:** Replacing 8 tabs with a single chronological feed (921→152 LOC) was both UX improvement and code simplification
- **Milestone audit with gap-closure phases:** Phase 23.1 and Phase 27 closed integration gaps identified by audit — pattern from v3.4 still effective
- **Rule-based complexity classifier:** No LLM call for mode/tier selection keeps routing fast and deterministic

### What Was Inefficient
- **2 gap-closure phases still needed (23.1 + 27):** Despite planning integration more carefully, cross-phase wiring gaps (notification in write tools, API paths, retrieval logging) were only caught by audit. 2 of 10 phases (20%) were gap-closure.
- **SCAN-05 deferred without alternative:** Neu-Urteil-Check was planned but requires cross-Akte semantic search not yet built. Should have been identified as infeasible during requirements, not during implementation.
- **TypeScript type mismatches accumulated:** helena/index.ts has ~5 pre-existing TS errors from StepUpdate adapter. These were known but not fixed during the milestone — accumulated tech debt.
- **Release gate hardcodes:** QA dashboard shows metrics but gate evaluation hardcodes hallucination/Vollstaendigkeit to 0/pass until a goldset POST is actually executed. No automated goldset runner exists.

### Patterns Established
- **Prisma $extends for business rules:** Use $extends (not deprecated middleware) for domain-invariant constraints (ENTWURF gate, BRAK compliance). Prisma 5 recommended pattern.
- **ExtendedPrismaClient type:** All modules importing Prisma use ExtendedPrismaClient from db.ts, not raw PrismaClient — ensures $extends behavior is always present.
- **createDraftActivity helper:** Centralized AktenActivity creation for drafts — all 5 write tool sites + Schriftsatz pipeline use the same helper with try-catch safety.
- **Banner refetch pattern:** New events trigger banner notification, user clicks to reload — avoids race conditions with server ordering for feeds and draft lists.
- **PendingSchriftsatz for multi-turn:** @@unique([userId, akteId]) for one pending pipeline per user per Akte — clean conversation state for Rueckfragen.
- **HTML comment metadata in message content:** <!--schriftsatz:...--> preserves pipeline state across useChat re-renders.

### Key Lessons
1. **Gap-closure phases are still needed at ~20%.** Despite more careful upfront planning, integration wiring still gets missed. Accept this as a consistent pattern and budget 1-2 gap-closure phases per milestone.
2. **Requirements feasibility check is missing.** SCAN-05 was infeasible at requirements time (needs cross-Akte search). Add a "feasibility gate" during requirements definition: can this be built with current architecture?
3. **Prisma $extends is the right pattern for business invariants.** ENTWURF gate proves that database-level enforcement is safer than any middleware approach. Apply to future invariants.
4. **TypeScript errors should be fixed immediately.** Deferring helena/index.ts type fixes created persistent noise. Future milestones should include a "zero TS errors" constraint.
5. **QA gates need automated runners.** Release gates are only meaningful if the goldset actually executes automatically (CI or manual script). The dashboard alone is insufficient.

### Cost Observations
- Model mix: ~35% opus (execution), ~50% sonnet (planning/research), ~15% haiku (verification/extraction)
- Sessions: ~10 sessions across 2 days
- Notable: 23 plans in 2 days (~5 min/plan avg). Zero new dependencies — all complexity was pure TypeScript on existing stack.

---

## Milestone: v0.3 — Kanzlei-Collaboration

**Shipped:** 2026-03-02
**Phases:** 5 (28-32) | **Plans:** 13 | **Tasks:** 25 | **Commits:** 63

### What Was Built
- Falldatenblaetter Template System: DB-backed templates with 8 field types, Gruppen-first builder, community submit/approve workflow, 10 Sachgebiet seed templates
- In-Akte Falldaten Forms: Auto-template assignment, Pflichtfeld highlighting, completeness tracking, unsaved changes guard
- SCAN-05 Neu-Urteil-Check: Cross-Akte semantic search (pgvector HNSW, cosine similarity + Sachgebiet pre-filter), LLM-Briefing, NEUES_URTEIL alerts
- Messaging Backend: Channel/Message Prisma models, 14 REST routes, Socket.IO rooms, @mention notifications, @Helena channel response, AKTE-Kanal lazy-creation
- Messaging UI: Split-layout /nachrichten page, ChannelSidebar (unread badges), MessageComposer (@mention picker, DMS attachments), TypingIndicator, AkteChannelTab

### What Worked
- **Lazy-creation pattern for AKTE channels:** Channels created on first visit with RBAC-sync from Akte permissions — zero manual setup
- **Banner refetch pattern:** New messages trigger banner notification → click reloads list — consistent with Activity Feed pattern, prevents race conditions
- **Community template workflow:** ENTWURF → EINGEREICHT → GENEHMIGT/ABGELEHNT mirrors draft-approval pattern from v0.2 — users intuitively understand status flow

### What Was Inefficient
- **Nightly cron for embeddings:** Akte summaryEmbedding only refreshes at 02:30 — acceptable staleness for 5-person Kanzlei but not ideal for larger teams
- **@Helena in ALLGEMEIN channels silently ignored:** Design decision (Helena needs akteId context) but no user-facing message explaining why @Helena doesn't respond
- **Akte stats counter stale:** Shows old chatNachrichten count instead of Channel Messages — known pre-existing issue not resolved

### Patterns Established
- **Lazy channel creation with RBAC sync:** AKTE channels auto-created on first visit, membership synced from Akte verantwortlich/dezernat
- **Sacgebiet pre-filter for semantic search:** Cosine similarity + Sachgebiet enum reduces false positives in cross-Akte matching
- **Community template lifecycle:** ENTWURF → EINGEREICHT → GENEHMIGT/ABGELEHNT with admin approval gate

### Key Lessons
1. **Lazy creation beats eager seed.** AKTE channels created on demand are simpler than pre-seeding channels for all Akten. Apply to future per-entity resources.
2. **Nightly embedding refresh is acceptable at kanzlei scale.** On-demand would add complexity for marginal benefit with <50 users. Revisit if team size grows.
3. **Silent behavior needs user communication.** @Helena ignoring ALLGEMEIN messages without explanation confuses users. Always show feedback for rejected actions.

### Cost Observations
- Model mix: ~35% opus (execution), ~50% sonnet (planning), ~15% haiku (verification)
- Sessions: ~8 sessions across 3 days
- Notable: 13 plans in 3 days (~4.6 min/plan avg) — messaging UI was more complex than expected (Socket.IO rooms + real-time)

---

## Milestone: v0.4 — Quest & Polish

**Shipped:** 2026-03-03
**Phases:** 10 (33-42) | **Plans:** 21 | **Commits:** 108

### What Was Built
- Gamification Engine: UserGameProfile + Quest + QuestCompletion Prisma models, Quest DSL evaluator (count + delta conditions), XP/Level/Runen/Streak system, BullMQ async quest processing, daily reset + nightly safety-net crons, DSGVO-compliant opt-in architecture
- Bossfight: Team Backlog-Monster with HP = open Wiedervorlagen, 4-phase progression (escalating Runen rewards), Socket.IO real-time HP bar + damage feed + canvas-confetti celebration, admin activation threshold
- Quest Depth: Class-specific daily quests per RBAC role (~15 daily), weekly delta quests (WeeklySnapshot baselines, Monday cron), Special Quest campaigns (admin CRUD with condition templates), QuestWidget with grouped sections and deep-links
- Anti-Missbrauch: Qualified WV completion (30+ char Vermerk), Redis INCR daily Runen cap (40/day), 2% random audits with Sonner action toast, atomic Prisma $transaction, P2002 idempotent dedup, 24h auto-confirm BullMQ job
- Item-Shop + Heldenkarte: 18-item catalog (5 Common, 5 Rare, 5 Epic, 3 Legendary), atomic Runen purchase, cosmetic equip/unequip, 3 comfort perks (streak-schutz, doppel-runen, fokus-siegel), Heldenkarte profile with 8 achievement badges and quest history
- Team-Dashboard + Reporting: Admin KPIs (quest fulfillment rate, backlog delta trend with Recharts, bossfight damage aggregates), monthly PDF/CSV export with Kanzlei Briefkopf
- Quick Wins: Clickable KPI cards, OCR recovery banner (retry + Vision-Analyse + manual text), empty states in 4 tabs, Chat rename, Zeiterfassung inline editing

### What Worked
- **Quest DSL with JSON conditions:** Machine-readable quest definitions made evaluator generic — adding new quest types (delta, count) required zero evaluator rewrites, just new condition shapes
- **Absent-until-loaded pattern for widgets:** QuestWidget, BossfightBanner, Heldenkarte all return null until fetch completes — no layout shift, no loading spinners, clean progressive enhancement
- **Atomic Prisma $transaction for rewards:** XP + Runen + QuestCompletion record in single transaction with P2002 catch for concurrent dedup — zero drift across all phases
- **Condition templates for Special Quests:** Admin selects a preset template, fills values — never writes raw JSON. Server-side template definitions prevent invalid conditions
- **Only 1 gap-closure phase (Phase 42):** Down from 2-4 in previous milestones — better upfront planning paid off
- **Shared team-metrics.ts service:** Called by both server page and API route — avoids self-fetch pattern, single source of truth for aggregated team data

### What Was Inefficient
- **Phase 42 still needed for perk wiring:** streak-schutz and doppel-runen were tracked but not wired to actual effects until gap closure. Should have been in Phase 39's scope.
- **Manual migration SQL:** Docker not running during dev, so all 4 Prisma migrations were created as manual SQL. Works but loses Prisma migration history tracking.
- **Doppel-runen 2h window edge case:** If perk activates and quest check only runs via nightly safety net >2h later, doubling is missed. Product-level edge case not worth fixing at kanzlei scale.

### Patterns Established
- **Quest DSL evaluator pattern:** JSON `bedingung` → `evaluateQuestCondition()` → Prisma COUNT/delta query. Add new quest types by extending the condition union type.
- **Redis INCR+EXPIRE for daily caps:** Mirrors rate-limiter.ts pattern. Key: `runen-cap:${userId}:${yyyymmdd}`, EXPIRE 86400s. Fail-open on Redis errors.
- **Absent-until-loaded widget pattern:** Component returns null until first fetch completes. No loading state, no CLS, works with server-rendered pages.
- **Kanzlei Socket.IO room:** `kanzlei:{kanzleiId}` room for team-wide broadcasts (bossfight, audits). Auto-join in SocketProvider on connect.
- **Rarity tier design tokens:** COMMON=sky, RARE=violet, EPIC=amber, LEGENDARY=rose oklch color mapping. Consistent across ShopItemCard, RarityBadge, AvatarFrame.
- **Traffic light trend colors:** emerald=fallend (good), rose=steigend (bad), amber=stabil — matching risk color system from Akte detail.
- **PDF Briefkopf pattern:** Reused invoice pdf-generator layout (A4, 20mm margins) for Team Dashboard monthly report.

### Key Lessons
1. **Perk effects must be wired in the same phase as perk purchase.** Phase 39 created shop + inventory but deferred actual effect wiring to Phase 42. This is the "integration gap at feature boundary" pattern — the phase that introduces the concept should also wire its effects.
2. **Quest DSL is extensible.** The count/delta union approach worked well for 3 quest types. If a third condition type is needed, the pattern scales cleanly.
3. **Gap-closure phases are shrinking.** v3.4 had 4 gap phases (31%), v0.2 had 2 (20%), v0.4 had 1 (10%). Upfront planning is improving but some integration gaps remain inevitable.
4. **DSGVO opt-in architecture pays off.** Making gamification opt-in from Phase 33 meant no DSGVO concerns surfaced in any later phase. Bake compliance into schema, not afterthought middleware.
5. **Manual Prisma migrations are fragile.** 4 manual SQL migrations in v0.4 work but lose prisma migrate history. When Docker runs, these need to be reconciled. Consider running Docker for migration generation even if app runs outside.

### Cost Observations
- Model mix: ~35% opus (execution), ~50% sonnet (planning/research), ~15% haiku (verification)
- Sessions: ~8 sessions across 2 days
- Notable: 21 plans in 2 days (~4 min/plan avg). Only 1 new npm dependency (canvas-confetti, 6KB). Gap-closure phases down to 10% from 31% in v3.4.

---

## Milestone: v0.5 — Mandantenportal

**Shipped:** 2026-03-03
**Phases:** 8 (43-50, incl. 2 gap-closure) | **Plans:** 14 | **Commits:** 60

### What Was Built
- Portal Infrastructure: MANDANT role in UserRole enum, /portal/* route group with Glass UI layout, auth-guarded middleware, PortalSidebar/PortalHeader with Kanzlei branding
- Invite-based Auth: PortalInvite model with secure tokens (crypto.randomUUID), account activation, JWT session with 30min auto-logout + 5min warning, password reset flow, anti-enumeration (always 200)
- DSGVO-compliant Data Room: Server-side isolation via Kontakt→Beteiligter chain, multi-Akte selection with auto-redirect for single-Akte, simplified timeline (mandantSichtbar flag), naechsteSchritte text with accent-border card
- Granular Document Sharing: Per-document mandantSichtbar toggle (default false), presigned MinIO download URLs, Mandant upload to dedicated folder (50MB limit, skip OCR/RAG), Anwalt notification on upload
- Secure Portal Messaging: PORTAL ChannelTyp with lazy creation and P2002 race handling, Mandant-Anwalt messaging, file attachments (5 files, 25MB each), 10s polling, @mention stripping
- Transactional Email Notifications: BullMQ portal-notification queue, 3 event types (neue-nachricht, neues-dokument, sachstand-update), date-based deduplication, DSGVO einwilligungEmail gate, 3 retries with backoff

### What Worked
- **Server-side data isolation pattern:** Kontakt→Beteiligter chain enforced at Prisma query level (not client-side filter) — 404 not 403 on unauthorized access hides Akte existence
- **Reuse of existing patterns:** Portal messaging reuses channel-service.ts/message-service.ts from v0.3, document upload reuses MinIO patterns from v3.4 — zero new libraries needed
- **Milestone audit + gap closure phases:** Two audits identified real gaps (auth redirect loops, missing navigation). Phase 49 and 50 closed all 6 gaps cleanly
- **10s polling instead of Socket.IO:** Simpler architecture for portal, sufficient for Mandant use case, avoids complexity of portal-side Socket.IO setup
- **(portal-public) route group pattern:** Clean separation of unauthenticated pages (login, activate, password reset) from guarded portal pages — fixed all redirect loop issues

### What Was Inefficient
- **2 gap-closure phases needed (49 + 50):** Auth pages trapped in guarded layout (redirect loops) and missing navigation links were only caught by milestone audit, not during phase verification
- **Portal email deep links don't redirect post-login:** Deep links in notification emails go to /portal/dashboard after login, not to the linked resource — requires post-login redirect callback (deferred)
- **Phase 49 scope was broader than expected:** Route group restructuring required moving 7 pages, fixing URL structure, creating /portal/profil page — what seemed like a small fix touched 10 files

### Patterns Established
- **(portal-public) route group for unauthenticated pages:** Next.js route groups cleanly separate guarded vs public pages without middleware complexity
- **Server-side Kontakt→Beteiligter chain for Mandant access:** Single query pattern for all portal API routes — `requireMandantAkteAccess()` in portal-access.ts
- **BullMQ portal-notification with date-based dedup:** `${type}:${akteId}:${mandantId}:${YYYY-MM-DD}` key prevents duplicate notifications within 24h
- **Tab navigation for multi-section portal pages:** PortalAkteTabs with usePathname + active underline — reusable for any portal page with sub-sections
- **Mandant uploads skip pipeline:** erstelltDurch='mandant' marker, no OCR/RAG/preview processing — simplified pipeline for external uploads

### Key Lessons
1. **Auth page placement matters.** Login, activation, and password reset pages MUST be outside any auth-guarded layout. This seems obvious but was missed in initial implementation — always verify unauthenticated flows early.
2. **Milestone audit is essential for portal-type features.** Portal features create E2E flows (invite→activate→login→use) that span multiple phases. Only end-to-end audit catches flow-breaking issues like redirect loops.
3. **10s polling is good enough for portal MVP.** Socket.IO would add complexity for marginal UX improvement at kanzlei scale (<50 Mandanten). Revisit if real-time becomes a user complaint.
4. **Per-document Freigabe (default false) is the right DSGVO pattern.** Explicit opt-in per document means Anwalt always makes a conscious decision — no accidental data exposure.
5. **v0.5 completed in 1 day (8 phases, 14 plans).** Portal features built heavily on existing patterns (messaging, document management, auth) — reuse velocity pays off exponentially.

### Cost Observations
- Model mix: ~35% opus (execution), ~50% sonnet (planning/research), ~15% haiku (verification)
- Sessions: ~6 sessions in 1 day
- Notable: 14 plans in 1 day (~4 min/plan avg). Zero new npm dependencies. Pattern reuse from v0.2/v0.3 messaging enabled fastest milestone yet.

---

## Milestone: v0.6 — Stabilisierung

**Shipped:** 2026-03-04
**Phases:** 1 (Phase 51) | **Plans:** 4 | **Tasks:** 8 | **Commits:** 20

### What Was Built
- Fixed React hooks violations, TypeScript type mismatches, non-route API exports, Stirling PDF health check port
- Standardized OLLAMA_URL env var across 4 files with consistent localhost fallback
- Removed 8 invalid ESLint disable comments referencing unconfigured rules
- Fixed compose-popup auto-save stale closure (later removed entirely in post-phase fix)
- Glass-styled error boundaries for root/dashboard/portal with German recovery UI + custom 404
- Added npm test/test:watch scripts, fixed create_draft_dokument test mock (missing findUnique + module mocks)
- Enabled build-time TypeScript error checking (ignoreBuildErrors: false)

### What Worked
- **Health audit as scope definition:** No formal requirements needed — the systematic-health-audit.md defined clear P0/P1/P2 priorities, making planning mechanical
- **All fixes were surgical:** 4 plans, 8 tasks, 55 files — focused scope with zero feature creep
- **Post-phase fix pattern:** Commit e21ab34 (removing compose-popup auto-save) was a clean post-phase fix that superseded the in-phase closure fix — demonstrating that verification catches real issues
- **Error boundary self-containment:** Using inline Tailwind instead of GlassPanel imports prevents cascading failures — correct architectural choice for error recovery code

### What Was Inefficient
- **Stabilization milestone is lightweight but still requires full ceremony:** 1 phase with 4 plans + audit + milestone completion is overhead for what was essentially a focused bugfix session
- **Phase 51 stats inflation in CLI:** gsd-tools reported "16 phases, 46 plans" because it counted all prior milestone phases — the actual v0.6 work was 1 phase, 4 plans
- **No REQUIREMENTS.md created:** Stabilization milestones don't map well to the REQ-ID pattern — health audit findings were the de facto requirements

### Patterns Established
- **Health audit as requirements source:** For stabilization milestones, systematic health audit replaces formal REQUIREMENTS.md
- **Inline Tailwind in error boundaries:** Never import application components in error.tsx files — cascading import failures defeat the purpose
- **ignoreBuildErrors: false as default:** TypeScript errors caught at build time prevent silent regressions
- **Module-level vi.mock for fire-and-forget helpers:** Test files must mock modules that import side-effect-heavy helpers (draft-notification, draft-activity)

### Key Lessons
1. **Stabilization milestones are valuable but should be lightweight.** A single health audit → fix → verify cycle is sufficient. The GSD ceremony (research, plan-check, verifier) adds overhead without proportional value for bugfix work.
2. **Build-time TS checking should have been enabled from v3.4.** 7 milestones shipped with `ignoreBuildErrors: true` — any TS regression in those milestones was invisible until runtime. Enable immediately for all new projects.
3. **Post-phase fixes are normal.** The compose-popup removal after phase close demonstrates that verification sometimes reveals the original fix was insufficient. Clean post-phase commits are better than reopening phases.
4. **Tech debt should be surfaced, not just listed.** The audit cataloged Prisma 7.x upgrade, Next.js CVEs, and 317 ESLint warnings — these need dedicated milestone scope, not just bullet points.

### Cost Observations
- Model mix: ~40% opus (execution), ~40% sonnet (planning/audit), ~20% haiku (verification)
- Sessions: ~3 sessions in 1 day
- Notable: Fastest milestone end-to-end — 4 plans averaged ~2.5 min each. Stabilization benefits from well-defined scope.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Plans | Key Change |
|-----------|----------|--------|-------|------------|
| v3.4 | ~15 | 13 | 38 | First milestone with GSD workflow; gap-closure phases proved effective |
| v3.5 | ~5 | 2 | 10 | Design-token-first approach; scope reduction should happen at requirements time |
| v0.1 | ~8 | 7 | 19 | 6-chain parallel ki-chat; integration checker caught cross-phase bug missed by phase verifiers |
| v0.2 | ~10 | 10 | 23 | Zero new dependencies; gap-closure phases still ~20%; Prisma $extends for business invariants |
| v0.3 | ~8 | 5 | 13 | Lazy channel creation; community template workflow; nightly embedding refresh at kanzlei scale |
| v0.4 | ~8 | 10 | 21 | Quest DSL evaluator; gap-closure down to 10%; absent-until-loaded widget pattern; DSGVO opt-in from day one |
| v0.5 | ~6 | 8 | 14 | Pattern reuse from v0.2/v0.3 enables fastest milestone; portal-public route group; server-side data isolation |
| v0.6 | ~3 | 1 | 4 | Health audit as requirements source; stabilization is lightweight; build-time TS checking enabled |

### Cumulative Quality

| Milestone | Tests | Requirements | Audit Cycles | Tech Debt Items |
|-----------|-------|-------------|-------------|-----------------|
| v3.4 | 207+ (Frist + RVG) | 64/64 | 7 | 5 (non-blocking) |
| v3.5 | 207+ (unchanged) | 5/18 shipped (13 deferred) | 1 | 2 (font-heading, .glass alias — non-blocking) |
| v0.1 | 207+ (unchanged) | 16/16 | 1 (+ integration check) | 2 (processUrteilNer dead code, NER attempts:1) |
| v0.2 | 253+ (Frist + RVG + Helena 46) | 52/53 (1 deferred) | 2 (audit + re-audit) | 5 (TS errors, stub, taskId, gate hardcodes, SCAN-05) |
| v0.3 | 253+ (unchanged) | 20/20 | 1 | 5 (@Helena ALLGEMEIN, sidebar badge, stats counter, embedding refresh, TS errors) |
| v0.4 | 253+ (unchanged) | 41/41 | 1 | 4 (quest-evaluator any, fire-and-forget catch, doppel-runen edge, pre-existing TS) |
| v0.5 | 253+ (unchanged) | 25/25 | 2 (audit + re-audit) | 4 (console.error in route, email deep links, pre-existing TS, adhoc phase) |
| v0.6 | 417+ (vitest enabled) | N/A (stabilization) | 1 | 10 (Prisma 7.x, Next.js CVEs, 317 ESLint warnings, 67 routes no try-catch, 80 silent catch, draft API, UAT tests, etc.) |

### Top Lessons (Verified Across Milestones)

1. Plan integration wiring explicitly — gap-closure phases are effective but reactive (trending down: 31% → 20% → 10%)
2. Audit incrementally rather than only at milestone boundary
3. Prisma schema as source of truth scales well across 85+ models
4. Scope decisions belong at requirements time — both mid-milestone removals and infeasible requirements create noise
5. Design-token-first: define tokens before migrating components — makes page migrations mechanical
6. Integration checker is non-negotiable — phase-level verification misses cross-phase wiring defects
7. Coordinate cross-phase implementation decisions during planning — prevents dead code from independent choices
8. Near-zero-dependency milestones are the norm — v0.4 added only canvas-confetti (6KB) across 21 plans
9. Prisma $extends for business invariants — database-level enforcement is safer than middleware
10. DSGVO compliance baked into schema (opt-in field, self-only visibility) prevents compliance concerns in all downstream phases
11. Absent-until-loaded pattern for progressive enhancement — no CLS, no loading spinners, works with SSR
12. Pattern reuse compounds — portal messaging/documents/auth built on v0.2/v0.3 patterns, enabling 14 plans in 1 day
13. Auth pages must be outside guarded layouts — always verify unauthenticated E2E flows (invite→activate→login) before marking auth phases complete
14. Enable build-time TS checking (ignoreBuildErrors: false) from day one — silent regressions across 7 milestones were avoidable
15. Stabilization milestones benefit from health-audit-as-requirements — skip formal REQ-IDs when scope is defined by audit findings
