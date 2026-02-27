# Project Research Summary

**Project:** Helena Agent v2 — Autonomous Agent Capabilities for AI-Lawyer
**Domain:** Legal AI Agent (German Kanzlei Software — ReAct loop, @-tagging, draft-approval, background scanner, memory, alerts, QA, activity feed)
**Researched:** 2026-02-27
**Confidence:** HIGH (stack/architecture verified against live codebase and official docs; legal compliance from BRAK official PDF; pitfalls from GitHub issues + peer-reviewed research)

## Executive Summary

Helena Agent v2 extends an existing, fully operational legal case management system (~91,300 LOC) with autonomous agent capabilities. The codebase already ships: Helena RAG chat with hybrid search, BullMQ job queues, Socket.IO real-time, and a multi-provider AI stack (Ollama/OpenAI/Anthropic via Vercel AI SDK v4). The research conclusion is emphatic: zero new npm packages are required. Every agent capability — ReAct loop, deterministic Schriftsatz orchestration, nightly scanner, per-case memory, alert delivery, activity feed — is buildable on the existing infrastructure. The recommended approach is additive TypeScript implementation layered on `generateText` + `tools` (AI SDK v4), BullMQ step-job pattern, Prisma for structured state, and Socket.IO for real-time delivery.

The recommended architecture splits Helena into two execution modes: an inline mode (streaming chat, max 5 tool steps, immediate response) and a background mode (BullMQ worker, max 20 steps, progress via Socket.IO events). This split is the critical design decision — running long agent loops inside HTTP requests causes timeout failures. Complex tasks (Schriftsatz drafting, research chains) are handed off to BullMQ immediately and the user is directed to the Activity Feed for results. Legal document creation uses a deterministic sequential `generateObject` orchestrator rather than free-form agent exploration, because German court filings have mandatory structural requirements (§ 253 ZPO) that an unconstrained agent cannot reliably satisfy.

The key risks are: (1) Ollama qwen3.5:35b has documented tool call format instability — all tool invocations need response validation and smoke testing before any agent feature ships; (2) German professional conduct rules (BRAK 2025, BRAO §43) are non-negotiable — all agent output must land in ENTWURF status and a human must explicitly promote before any action; (3) an AI SDK upgrade to v5/v6 would require breaking changes across 8 existing files and must be deferred to a separate milestone (v0.3-sdk-upgrade). Mitigating all three risks requires iteration caps on the ReAct loop, Prisma middleware enforcement of ENTWURF status on every agent-created document, and pinning the Ollama Docker image version.

## Key Findings

### Recommended Stack

The existing stack handles everything needed. No new production packages are required. The AI SDK must stay on v4.3.19 — upgrading to v5/v6 introduces 6 breaking API changes across 8 files including `CoreMessage → ModelMessage`, `parameters → inputSchema`, and `toDataStreamResponse → toUIMessageStreamResponse`. Similarly, Zod must stay on v3 — Zod v4 is a peer dependency of AI SDK v5+. A dedicated tech-debt milestone (`v0.3-sdk-upgrade`) should handle the SDK migration after v0.2 ships.

New Prisma models do all the heavy lifting: `HelenaTask` (multi-step job with step log JSON), `HelenaDraft` (structured agent output), `HelenaAlert` (time-critical proactive notifications), `HelenaMemory` (per-case key-value agent memory), and `AktenActivity` (event feed). These are additive — no existing models are removed or modified structurally.

**Core technologies:**
- `ai@^4.3.19` (Vercel AI SDK v4, existing): `generateText` with `tools` for ReAct loop; `generateObject` for deterministic Schriftsatz sections — stay on v4, v5/v6 migration is a separate milestone
- `bullmq@^5.70.1` (existing): step-job pattern with `job.updateData()` for restart-safe long-running agent execution; `0 2 * * *` cron for nightly scanner; `lockDuration: 120000` required for helena-agent queue
- `zod@^3.23.8` (existing): tool parameter schemas and structured output schemas — stay on v3 to avoid AI SDK peer dep chain conflict
- PostgreSQL + Prisma (existing): HelenaTask/HelenaDraft/HelenaAlert/HelenaMemory as structured queryable state; no new Docker services required
- Socket.IO + `@socket.io/redis-emitter` (existing): real-time agent progress, draft-ready notifications, activity feed delivery — zero new infrastructure

**Zero new npm packages.** All agent capabilities are custom TypeScript built on existing dependencies:
- ReAct agent loop: custom `while` loop on `generateText` + tools (`src/lib/helena/agent-loop.ts`)
- Deterministic Schriftsatz orchestrator: sequential `generateObject` calls (`src/lib/helena/schriftsatz-orchestrator.ts`)
- Helena memory: Prisma `HelenaMemory` upserts (`src/lib/helena/memory.ts`)
- Nightly scanner: BullMQ processor with cron `0 2 * * *` (`src/lib/queue/processors/scanner.processor.ts`)
- Alert service: Prisma write + Socket.IO emit (`src/lib/helena/alert-service.ts`)
- Citation Recall@k: string fingerprint matching (`src/lib/helena/qa-gate.ts`)

### Expected Features

**Must have (table stakes) — v0.2 launch:**
- Tool Registry (6 core tools): `searchAktenDokumente`, `searchGesetze`, `searchUrteile`, `getAkteMetadata`, `getFristen`, `createEntwurf` — the minimum for useful legal agent work
- ReAct Agent-Loop: `generateText` with `maxSteps=10` (inline) / `maxSteps=20` (background) — bounded, auditable, graceful degradation at step cap
- @Helena mention trigger: parse `@Helena` in Akte chat, extract intent, enqueue BullMQ `helena-task` job, emit Socket.IO progress events, store ENTWURF result
- Enhanced ENTWURF: add `agentTrace`, `ablehnungsGrund` fields; display step trace in detail view — required for BRAO transparency
- Alert System (Priority + Role-routing): HelenaAlert model, severity tiers (INFO/WARNUNG/KRITISCH), in-app notification center extension
- Activity Feed (per-Akte): AktenActivity timeline, Helena vs Human visual distinction, Socket.IO real-time update

**Should have (competitive) — v0.2.x:**
- Proactive Scanning: email-triggered scan, daily health scan for Frist/Inaktivität/anomalies — only after core agent loop is stable
- AkteSnapshot (Agent Memory): reduces per-invocation latency; build after observing real performance issues in production
- Additional tools: `createFristEntwurf`, `addNormToAkte`, `searchMuster`, `createAktennotiz`, `getEmailContext`
- Alert snooze (`snoozeUntil: DateTime`), daily digest email (08:00 BullMQ), Alert → ENTWURF delegation action
- QA metrics in admin: ENTWURF rejection rate dashboard, step count histogram

**Defer (v0.3+):**
- Goldset evaluation suite — requires 2-3 months of production data to label meaningful queries
- Hallucination citation-grounding check — high implementation complexity; validate with simpler rejection-rate metrics first
- Verjährungs-Radar and cross-Akte semantic similarity — high value, high complexity
- Specialized agent modes (Schriftsatz-Modus, Recherche-Modus) — after v0.2 proves stable
- Episodic → Semantic memory compression — only when Akten age past ~50 chat sessions

**Hard anti-features (never build):**
- `sendEmail` as agent tool — irreversible, BRAK 2025 prohibition on autonomous AI correspondence
- `deleteDocument` as agent tool — irreversible, data loss risk, audit trail gap
- Auto-approve ENTWURF after N days — absolute BRAO violation (Frankfurt court precedent Sept 2025)
- LangChain.js agent classes — incomplete JS port, adds abstraction layer without value for bounded use case
- Cloud LLM for Akte document content — requires DSGVO data processor agreement; violates self-hosted constraint

### Architecture Approach

The architecture is deliberately additive. Four core new components sit on top of the existing stack: (1) `src/lib/ai/orchestrator.ts` — the background ReAct executor callable from both BullMQ worker and API routes; (2) `src/lib/ai/agent-tools.ts` — shared tool factory functions injected with runtime context (userId, akteId) used by both inline streaming chat and background orchestrator; (3) `src/lib/queue/processors/helena-task.processor.ts` — thin BullMQ wrapper that validates job data and calls the orchestrator; and (4) the Activity Feed UI component backed by a unified REST endpoint and Socket.IO subscriptions. The build order is strictly: schema migration → shared tool library → orchestrator + BullMQ worker → API routes → ki-chat route modification → Activity Feed UI → scanner extension.

**Major components:**
1. `HelenaOrchestrator` (`src/lib/ai/orchestrator.ts`) — background ReAct loop using `generateText` with tools; persists each step to `HelenaTask.steps` JSON via `onStepFinish`; emits Socket.IO progress events; max 20 steps; AbortController wired to BullMQ worker shutdown signal
2. `agent-tools.ts` (`src/lib/ai/`) — shared tool definitions; factory functions accept userId/akteId at runtime; used by both `streamText` (inline chat, 5-step cap) and `generateText` (background, 20-step cap); Zod parameter validation on all tools
3. Schriftsatz Orchestrator (`src/lib/helena/schriftsatz-orchestrator.ts`) — sequential `generateObject` calls for each legally-mandated document section (§ 253 ZPO); deterministic structure enforced by Zod schemas; separate from the ReAct agent loop
4. BullMQ queues: `helena-agent` (on-demand @-tag tasks, concurrency=1, lockDuration=120s), `helena-scanner` (nightly cron `0 2 * * *`), existing OCR/email/embedding queues unchanged
5. Prisma data models: `HelenaTask` (step log JSON), `HelenaDraft` (structured output with quellen metadata), `HelenaAlert` (proactive notifications with fristDatum), `HelenaMemory` (per-case key-value), `AktenActivity` (feed events)
6. Activity Feed UI: REST initial load + Socket.IO room subscriptions per-user and per-Akte; RBAC-filtered at socket room join; batch Socket.IO events from scanner to prevent UI flood

### Critical Pitfalls

1. **ReAct Infinite Loop** — implement `maxIterations: 10` hard cap AND a stall detector (abort if last 3 tool calls are identical); call `job.updateProgress()` on every agent step to reset BullMQ's 30s stall timer; set `lockDuration: 120000` on the `helena-agent` queue worker. Must be in Phase 1 before any tool is wired. Warning signs: same tool name 3+ times consecutively in logs; Ollama GPU at 100% with no new requests accepted.

2. **Ollama qwen3.5:35b Tool Call Hallucination** — Ollama returns tool call JSON as `message.content` instead of `message.tool_calls` (documented GitHub issues #11135, #11662); validate `response.toolCalls` array after every LLM call; implement text-mode ReAct fallback if tool calls fail consistently; pin Ollama Docker image version; run smoke test for every registered tool through the full Ollama stack before shipping any agent feature.

3. **ENTWURF Status Bypass in Agent Tools** — agent tools that call `prisma.dokument.create()` directly bypass the HTTP middleware ENTWURF guard; all document-creating tools must route through the HTTP API endpoint; add Prisma middleware (`prisma.$use`) asserting `status = 'ENTWURF'` on every document create as last-resort guard; integration test: simulate agent create → attempt beA send → assert 403. This is a BRAO §43 professional conduct violation, not a UX bug.

4. **Legal Hallucination in Schriftsatz Drafts** — Stanford 2025 peer-reviewed research: legal AI tools hallucinate 17–33% on legal queries even with RAG; implement post-generation §-reference verification (regex extract + `law_chunks.normReference` lookup) and Aktenzeichen verification against `urteil_chunks.citation`; system prompt hard constraint: cite only norms appearing verbatim in retrieved context; mandatory non-removable "KI-Entwurf — alle Normen vor Verwendung prüfen" disclaimer on every agent draft.

5. **Context Window Overflow** — 32k token qwen3.5:35b context exhausts after 5-8 agent iterations with large tool results (system prompt ~2k + 4 RAG chunks ~8k + 5 reasoning steps ~2.5k = ~14k at step 5); implement token budget manager (truncate oldest tool results when approaching 75% of context window); cap individual tool results at 2000 tokens with truncation indicator; must be in Phase 1 agent foundation before any task runs.

6. **DSGVO Compliance for Agent Memory** — AI-generated case summaries and `HelenaMemory` entries contain synthesized personal data; must be added to Verarbeitungsverzeichnis; `ON DELETE CASCADE` from parent Akte; covered by existing DSGVO anonymization pipeline; staleness check required (if `memory.updatedAt < akte.updatedAt - 30 days`, mark stale). Must be addressed in Phase 3 before first summary generates in production.

7. **BullMQ Agent Job Stalling and AbortSignal** — default `stalledInterval: 30s` was set for fast OCR jobs; agent jobs take 40-60s minimum; without `lockDuration: 120000`, the same agent job re-queues and runs twice, producing duplicate drafts and alerts; wire `AbortController` to BullMQ `worker.on('closing')` and pass `abortSignal` to `generateText` to prevent Ollama continuing after worker shutdown.

8. **Activity Feed N+1 Queries and Socket.IO Event Flood** — feed page load issues 51 SQL statements for 50 events without nested `include`; nightly scanner emitting 200 individual `helena:activity` events causes browser React re-renders 200+ times; use single Prisma query with nested `include` for feed; batch Socket.IO emissions as `helena:activityBatch` per Akte; RBAC-filter Socket.IO rooms so users only receive events for Akten they can access.

## Implications for Roadmap

Based on combined research, a 7-phase build order is recommended, driven by schema-first dependencies, legal compliance gate requirements, and the two-mode agent architecture (inline vs. background).

### Phase 1: Agent Foundation and BullMQ Infrastructure
**Rationale:** Database schema, shared tool library, ReAct loop core, and BullMQ queue configuration are the prerequisite for every subsequent feature. All critical pitfalls (infinite loop, context overflow, stall detection, Ollama tool call validation) must be addressed here — retrofitting these safeguards after user-visible features ship is exponentially harder and risks professional liability exposure.
**Delivers:** Working `HelenaOrchestrator` executing bounded ReAct loops in a BullMQ worker; shared `agent-tools.ts` with all 6 core tool factory functions; Prisma schema migration (HelenaTask, HelenaDraft, HelenaAlert, HelenaMemory, AktenActivity); BullMQ `helena-agent` queue with `lockDuration: 120000` and `concurrency: 1`; iteration cap + stall detector (3 identical consecutive tool calls → abort); token budget manager (truncate at 75% of 32k context); Ollama tool call response validation with smoke test suite per tool.
**Addresses (from FEATURES.md):** Tool Registry (6 core tools), ReAct Agent-Loop foundation
**Avoids (from PITFALLS.md):** Pitfall 1 (infinite loop), Pitfall 2 (Ollama tool call format), Pitfall 5 (context window overflow), Pitfall 7 (BullMQ stalled jobs)
**Research flag:** Standard patterns (Vercel AI SDK generateText + tools well-documented in official docs); no phase research needed.

### Phase 2: @Helena Mention Trigger and Enhanced ENTWURF
**Rationale:** Once the agent loop is verified working, the UX trigger that exposes it to users is the highest-value deliverable. Enhanced ENTWURF (agentTrace, ablehnungsGrund) must ship alongside because BRAO transparency requirements apply from the first user-facing agent invocation — there is no grace period.
**Delivers:** @Helena mention parsing in Akte chat (`@helena` / `@Helena` prefix detection), BullMQ job enqueue on mention, Socket.IO progress events (`helena:thinking`, `helena:step:{n}`, `helena:done`), ENTWURF result linked to originating mention; enhanced KIEntwurf model with `agentTrace` (Thought/Action/Observation JSON array) and `ablehnungsGrund` (dropdown + free text) fields; agent trace display as collapsible "Wie Helena zu diesem Entwurf kam" section in ENTWURF detail view.
**Addresses (from FEATURES.md):** @Helena mention trigger, Enhanced ENTWURF workflow, intent detection for task routing
**Avoids (from PITFALLS.md):** Pitfall 3 (ENTWURF status bypass — integration test: agent create → beA send → assert 403 required before shipping); Pitfall 4 (legal hallucination — §-reference post-verification in createEntwurf tool execute function)
**Research flag:** Standard patterns; no phase research needed.

### Phase 3: Deterministic Schriftsatz Orchestration and Legal Draft QA Gates
**Rationale:** Schriftsatz generation is the highest-value agent capability for a German Kanzlei. It requires a separate deterministic orchestrator (not free-form ReAct) because court filing structure is legally mandated (§ 253 ZPO, § 130 ZPO). QA gates (Citation Recall@k, LLM-as-judge hallucination detection, format compliance checks) ship with this phase — an unverified Schriftsatz draft with hallucinated §-references creates immediate professional liability.
**Delivers:** `schriftsatz-orchestrator.ts` with sequential `generateObject` calls per legally-mandated section; three QA gates (`qa-gate.ts`): Citation Recall@k string fingerprint matching, LLM-as-judge hallucination detection via `generateObject`, deterministic format compliance regex; `searchMuster` tool for kanzlei-specific templates; `HelenaGoldset` Prisma model for regression testing; mandatory non-removable draft disclaimer in UI.
**Uses (from STACK.md):** `generateObject` + Zod schemas (Zod v3, stay on v4 → blocked by AI SDK v4 peer dep), existing `hybridSearch()` for muster_chunks/law_chunks/urteil_chunks
**Avoids (from PITFALLS.md):** Pitfall 4 (legal hallucination — §-verification mandatory before phase ships, 0 unverified references in test drafts accepted); Pitfall 10 (QA gold set bias — gold set must use held-out documents not used in RAG calibration; Anwalt reviews 100% of gold set answers)
**Research flag:** Needs deeper research on German court filing structural requirements for system prompt design (ZPO §253 Klageschrift sections, §130 Allgemeine Formerfordernisse, §78 Anwaltszwang). A German attorney should review the Zod section schemas before this phase is planned in detail.

### Phase 4: Alert System and Proactive Background Scanner
**Rationale:** Alerts and the background scanner are operationally coupled — the scanner is the primary alert producer. The DSGVO pitfall for agent-generated memory/summaries containing personal data must be addressed in this phase before any summary is persisted to production. Scanner scope filtering is a hard requirement before production deployment — an unfiltered nightly scan on 100+ Akten occupies the GPU from 2am to 8am.
**Delivers:** HelenaAlert model with severity tiers (INFO/WARNUNG/KRITISCH) and role-based routing; in-app notification center extension; nightly BullMQ cron scanner (`0 2 * * *`); 6 scanner checks: Fristen within 7 days, inactivity >30 days, OCR failures, RVG overdue >60 days, @-task no response >4h, beA unprocessed >24h; scope filter (Akten with `updatedAt > NOW() - INTERVAL '7 days'`); alert deduplication (48h suppression window per Akte+AlertType); cap 10 alerts per nightly run; DSGVO compliance for agent-generated data (Verarbeitungsverzeichnis entry, ON DELETE CASCADE to parent Akte, inclusion in anonymization pipeline).
**Addresses (from FEATURES.md):** Proactive scanning (email-triggered + daily cron), Alert system (priority + role routing), alert dedup + throttle
**Avoids (from PITFALLS.md):** Pitfall 6 (scanner cost explosion — scope filter mandatory, nightly runtime < 90 min target), Pitfall 7 (DSGVO akte_summary — must be addressed before first summary in production), Pitfall 8 (Activity Feed Socket.IO flood — batch events from scanner)
**Research flag:** Standard patterns for BullMQ cron and alert routing; no phase research needed.

### Phase 5: Activity Feed UI
**Rationale:** The Activity Feed is the primary UI surface for all agent output. It can only be built after the data layer (Phase 1 schema), agent tasks (Phase 2), and alerts (Phase 4) exist. The database query plan must be verified before shipping — N+1 queries at 50+ events per feed load will exhaust the DB connection pool under moderate usage.
**Delivers:** Unified `/api/helena/activity` endpoint (tasks + drafts + alerts merged, sorted by createdAt); `activity-feed.tsx` component (REST initial load + Socket.IO real-time via per-Akte rooms); task-card, draft-card, alert-card components with distinct Helena vs Human visual treatment (robot icon + blue accent for agent actions); Akte detail "Aktivitäten" tab; `/ki-chat?tab=tasks` TaskDashboard for cross-Akte view; filterable feed (Nur Helena / Nur Fristen / Nur Dokumente); RBAC Socket.IO room filtering; batched Socket.IO events from scanner.
**Implements (from ARCHITECTURE.md):** ActivityFeed component, Task Dashboard, Socket.IO room-based RBAC delivery pattern, Pattern 5 (Activity Feed via existing Socket.IO infrastructure)
**Avoids (from PITFALLS.md):** Pitfall 9 (Activity Feed N+1 — verify with `DEBUG=prisma:query` ≤3 SQL statements for 20-event feed; Socket.IO RBAC room filtering required; `helena:activityBatch` from scanner)
**Research flag:** Standard patterns; no phase research needed.

### Phase 6: Agent Memory (AkteSnapshot and HelenaMemory)
**Rationale:** Memory is an optimization that reduces per-invocation latency and enables more context-aware agent reasoning. It should be built after observing real performance characteristics in production (Phases 2-5). Adding it too early optimizes for a hypothetical bottleneck and adds DSGVO compliance surface area before the agent is proven useful.
**Delivers:** `HelenaMemory` Prisma model (per-case key-value with standardized keys: `sachverhalt_summary`, `bekannte_fristen`, `mandant_ziele`, `letzte_aktion`, `prozessstand`); `AkteSnapshot` model with staleness detection (`snapshot.updatedAt < akte.updatedAt - 30 days` → stale); BullMQ snapshot-rebuild job triggered on major Akte events (new Dokument, new Beteiligte, status change); memory size limits (max 20 key-value pairs per Akte, 90-day TTL on entries); memory injected into agent system prompt header; DSGVO cascade delete from Akte; inclusion in Art. 15 data subject access export.
**Addresses (from FEATURES.md):** AkteSnapshot (reduced per-invocation latency), per-case context persistence across sessions, memory quality indicator ("Kontext vom [datum]" with refresh button)
**Avoids (from PITFALLS.md):** Pitfall 7 (DSGVO — memory as personal data requiring Verarbeitungsverzeichnis entry and cascade delete)
**Research flag:** Standard patterns (Prisma upsert memory, BullMQ trigger on entity change); no phase research needed.

### Phase 7: QA Evaluation Framework and Admin Metrics
**Rationale:** QA evaluation requires production data to label meaningful gold set queries. Building the framework before 2-3 months of production usage produces a biased evaluation that measures prompt engineering instead of real-world quality. This phase ships after sufficient production agent runs have accumulated to support a meaningful held-out evaluation set.
**Delivers:** ENTWURF rejection rate dashboard (grouped by ablehnungsGrund dropdown selection, weekly trend chart); step count histogram (admin dashboard — identify near-cap agent runs); AgentRun Prisma model with token attribution per task; `HelenaGoldset` evaluation dataset (30-50 queries, held-out from RAG calibration documents, including 10 adversarial "I don't know" queries); weekly BullMQ evaluation cron comparing Recall@k against baseline; thumbs up/down feedback on Helena chat messages (`AnswerFeedback` model); alert when Recall@k drops >10% from established baseline.
**Addresses (from FEATURES.md):** QA evaluation (rejection rate, step count, goldset, user feedback), admin metrics dashboard
**Avoids (from PITFALLS.md):** Pitfall 10 (Goodhart's Law — gold set requires Anwalt review of 100% of generated answers as primary quality gate, not developer review; rotate 20% of queries quarterly; never show internal evaluation metrics to end users — show per-response "X von Y Zitaten verifiziert" instead)
**Research flag:** Needs phase research on held-out gold set methodology for German legal domain — specifically structuring adversarial queries and preventing circular evaluation bias when the RAG index and gold set share source documents.

### Phase Ordering Rationale

- **Dependency chain is strict:** Schema (Phase 1) must exist before any API route or worker; shared tool library before both ki-chat and orchestrator changes; orchestrator before Activity Feed has data to display.
- **Legal compliance gates Phases 2 and 3:** ENTWURF enforcement (integration test with beA send attempt) and §-reference post-verification must pass before any agent output reaches users. These are not optional polish items — they are BRAO professional conduct requirements.
- **Scanner (Phase 4) before Activity Feed UI (Phase 5):** The feed needs real events to display. Prototyping the UI before data exists requires mock data that misrepresents real event volume and timing.
- **Memory (Phase 6) is explicitly deferred:** The agent loop functions correctly without memory — memory is a latency and context-quality optimization. Building it before observing real performance characteristics risks over-engineering for a hypothetical bottleneck.
- **QA evaluation (Phase 7) requires production data:** A gold set built from development-time data has circular evaluation bias (Pitfall 10). The framework ships after the Anwalt has accumulated real queries over 2-3 months.
- **No LangChain, no new agent frameworks:** All agent capabilities fit within the existing Vercel AI SDK v4 `generateText` + `tools` API. Adding a competing abstraction layer would create maintenance burden and streaming interface conflicts.

### Research Flags

Phases needing deeper research during planning:
- **Phase 3 (Schriftsatz Orchestration):** German procedural law structural requirements for court filings (§ 253 ZPO Klageschrift, § 130 ZPO Allgemeine Vorschriften, Rubrum requirements) need to be mapped to Zod section schemas and system prompt design. A German attorney should review the section schema definitions before this phase ships. Specifically: which sections are legally mandated vs. optional, and what the Antrag must contain for different Schriftsatz types (Klageschrift vs. Berufung vs. Abmahnung).
- **Phase 7 (QA Evaluation):** The held-out gold set methodology for German legal domain needs specific research. Standard IR evaluation (Recall@k, MRR@10) does not measure legal correctness — a chunk can be retrieved correctly but the LLM can still hallucinate the answer. German-legal-specific adversarial queries (citing non-existent §-Absatz, fabricated Aktenzeichen) need to be designed with practitioner input.

Phases with standard patterns (skip phase research):
- **Phase 1:** Vercel AI SDK v4 tool calling and BullMQ step-job patterns are documented in official docs. Direct codebase inspection confirms all integration points (queues.ts, worker.ts, ki-chat/route.ts).
- **Phase 2:** @-mention parsing and BullMQ job enqueue follow well-established SaaS patterns (Slack, GitHub Issues, Linear). Socket.IO progress events already implemented for OCR and embedding pipelines in the codebase.
- **Phase 4:** BullMQ cron and alert routing are standard. Scanner scope filtering is straightforward SQL. Deduplication pattern follows existing Vorfristen-reminder cron idempotency pattern.
- **Phase 5:** Activity Feed with REST + Socket.IO is a solved problem. RBAC filtering follows existing Socket.IO room conventions already used for per-Akte document pipeline notifications.
- **Phase 6:** Prisma upsert memory pattern is trivial. AkteSnapshot staleness detection follows the same pattern as the existing HelenaSuggestion cache invalidation.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new packages confirmed by cross-referencing existing package.json against required capabilities. AI SDK v4 breaking changes verified from official migration guides (HIGH). Zod v3 vs v4 peer dep constraint verified from official Zod versioning docs (HIGH). |
| Features | HIGH for compliance constraints; MEDIUM for UX patterns | BRAK/BRAO legal constraints are from official December 2024 BRAK PDF (HIGH). @-mention UX patterns inferred from SaaS analogues with multiple corroborating sources (MEDIUM). Agent memory compression (episodic → semantic) is emerging practice with limited production validation data (MEDIUM). |
| Architecture | HIGH | Based on direct codebase inspection of `src/app/api/ki-chat/route.ts`, `src/worker.ts`, `src/lib/ai/proactive-processor.ts`, `src/lib/queue/queues.ts`, `prisma/schema.prisma`. All integration points verified against live code. The two-mode design (inline 5-step vs. background 20-step) matches existing infrastructure capabilities exactly. |
| Pitfalls | HIGH for BullMQ/Ollama/DSGVO; MEDIUM for QA evaluation | Ollama tool call format issues from active GitHub issues with reproducible cases (HIGH). BRAK 2025 Leitfaden is official BRAK PDF (HIGH). BullMQ stall behavior from official BullMQ docs (HIGH). QA gold set methodology is emerging practice with limited German-legal-specific guidance (MEDIUM). Stanford hallucination research is peer-reviewed (HIGH). |

**Overall confidence:** HIGH

### Gaps to Address

- **Ollama Docker image version:** Current Docker Compose must be audited for `latest` tag on the Ollama service. Tool call behavior (Pitfall 2) is version-dependent and regressions are introduced without breaking changes. Pin to a specific version before Phase 1 ships. Verify pinned version does not have known tool call regressions for qwen3.5:35b.
- **qwen3.5:35b step latency measurement:** Estimated at 2-3s per tool call step, making a 20-step background task 40-60s minimum. This needs empirical measurement on the production GPU to validate that `lockDuration: 120000` (2 minutes) is sufficient. If step latency is higher, `lockDuration` needs adjustment.
- **Schriftsatz section schemas:** The Zod schemas for individual Schriftsatz sections (Tatbestand, Rechtliche Würdigung, Antrag structure) need validation against actual court filing requirements before Phase 3 is planned in detail. A German attorney practitioner should review the schema before Phase 3 planning.
- **BRAK 2025 exact disclosure requirements:** The December 2024 BRAK Leitfaden was cited but the exact text of AI transparency disclosure requirements (which the "Von Helena erstellt" badge must satisfy) should be reviewed before Phase 2 ships the ENTWURF badge design.
- **BullMQ `helenaTaskQueue` naming convention:** The existing codebase uses `aiScanQueue`, `aiBriefingQueue`, `aiProactiveQueue`. The new queue should follow the same naming — confirm `helenaTaskQueue` or `aiHelenaQueue` against the existing `queues.ts` convention before Phase 1 schema is finalized.

## Sources

### Primary (HIGH confidence)
- Vercel AI SDK v4 tool calling: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling — `parameters:` vs `inputSchema:` distinction confirmed
- AI SDK v4 to v5 migration guide: https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0 — all 6 breaking changes verified
- AI SDK v5 to v6 migration guide: https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0 — `ToolLoopAgent`, `stopWhen: stepCountIs(20)` default confirmed
- BullMQ step-job pattern: https://docs.bullmq.io/patterns/process-step-jobs — `job.updateData()` for restart-safe checkpointing confirmed
- BullMQ stalled jobs: https://docs.bullmq.io/guide/workers/stalled-jobs — `lockDuration` and `stalledInterval` configuration confirmed
- Vercel AI SDK AbortSignal: https://ai-sdk.dev/docs/advanced/stopping-streams — `abortSignal` parameter confirmed for `generateText`
- BRAK Leitfaden KI-Einsatz (December 2024): https://www.brak.de/fileadmin/service/publikationen/Handlungshinweise/BRAK_Leitfaden_mit_Hinweisen_zum_KI-Einsatz_Stand_12_2024.pdf — professional conduct constraints (§43 BRAO, never auto-send)
- Direct codebase inspection: `src/app/api/ki-chat/route.ts`, `src/worker.ts`, `src/lib/ai/proactive-processor.ts`, `src/lib/queue/queues.ts`, `prisma/schema.prisma` (models 1456-1820)
- npm registry: `npm view ai version` = 6.0.103 current; project on `^4.3.19` — verified 2026-02-27

### Secondary (MEDIUM confidence)
- Stanford HAI: Legal AI Hallucination study 17-33% (2025, peer-reviewed): https://law.stanford.edu/wp-content/uploads/2024/05/Legal_RAG_Hallucinations.pdf — hallucination rate baseline for legal RAG
- Ollama GitHub issue #11135: Qwen3 tool call hallucination — JSON as content instead of tool_calls
- Ollama GitHub issue #11662: qwen3:32b tool call failures — version-dependent regression confirmed
- EDPB AI Privacy Risks and Mitigations (April 2025): https://www.edpb.europa.eu/system/files/2025-04/ai-privacy-risks-and-mitigations-in-llms.pdf — DSGVO Art. 15 and Art. 17 for AI-generated summaries
- LangChain.js vs Vercel AI SDK comparison: https://strapi.io/blog/langchain-vs-vercel-ai-sdk-vs-openai-sdk-comparison-guide — LangChain JS incomplete vs Python port confirmed
- LLM-as-judge hallucination detection: https://www.datadoghq.com/blog/ai/llm-hallucination-detection/ — production-validated approach, confirmed for cost efficiency vs self-consistency
- ReAct agent pattern in TypeScript 2026: https://noqta.tn/en/tutorials/ai-agent-react-pattern-typescript-vercel-ai-sdk-2026 — implementation pattern corroboration
- Goodhart's Law in AI evaluation: https://blog.collinear.ai/p/gaming-the-system-goodharts-law-exemplified-in-ai-leaderboard-controversy — gold set methodology risks

### Tertiary (LOW confidence)
- Competitor feature analysis (Harvey AI, Legora, Definely) — sourced from marketing pages, not technical documentation; used only for feature comparison context, not implementation guidance
- qwen3.5:35b step inference latency (2-3s per call) — community benchmarks on similar hardware; hardware-dependent, needs empirical validation on production GPU before BullMQ `lockDuration` is finalized

---
*Research completed: 2026-02-27*
*Ready for roadmap: yes*
