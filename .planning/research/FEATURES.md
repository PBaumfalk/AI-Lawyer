# Feature Research

**Domain:** Legal AI Agent — Helena Agent v2 (Autonomous Agent Capabilities for German Kanzlei Software)
**Researched:** 2026-02-27
**Confidence:** MEDIUM — agent loop patterns HIGH from official Vercel AI SDK docs; legal domain specifics MEDIUM from multiple corroborating sources; German professional-responsibility constraints HIGH from BRAK/BRAO official sources; @-mention UX and activity feed patterns MEDIUM from established SaaS analogues

---

## Context: What Already Exists (Do Not Rebuild)

This is research for a SUBSEQUENT MILESTONE adding autonomous agent capabilities to an existing ~91,300-LOC codebase. The following is already shipped and must be integrated with, not replaced:

- Helena chat with per-Akte RAG (pgvector + Meilisearch, Vercel AI SDK v4)
- Hybrid Search (BM25 + pgvector + cross-encoder reranking) — shipped in v0.1
- ENTWURF workflow: all AI output = ENTWURF status; human must promote to FREIGEGEBEN before any action
- Real-time notifications via Socket.IO (custom server.ts on port 3000)
- BullMQ job queues with Redis for background processing (async, retry, cron)
- Multi-provider AI (Ollama qwen3.5:35b / OpenAI / Anthropic)
- Audit-Trail (logAuditEvent, per-Akte + system-wide)
- KI-Entwürfe-Workspace (list + detail + save as Dokument/Aktennotiz)

New agent features must integrate via BullMQ (background processing), Socket.IO (real-time updates), and the existing ENTWURF promotion workflow.

---

## Feature Landscape

### Category 1: ReAct Agent-Loop

The foundation that makes Helena an agent rather than a chatbot. ReAct (Reasoning + Acting) interleaves Thought, Action, and Observation in a loop until a terminal answer is reached.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Multi-step tool-calling loop | A legal AI agent must chain: retrieve law → search case documents → check calendar → draft response. A single-pass LLM cannot do this reliably | MEDIUM | Vercel AI SDK v4+ supports `generateText` with `maxSteps` and `stopWhen: stepCountIs(N)`. Already using AI SDK — no new framework needed. Cap at 10 steps to prevent runaway loops |
| Transparent reasoning trace (Thought log) | Lawyers must be able to see WHY Helena did what she did — professional duty under BRAO §43a | LOW | Log each ReAct step (Thought/Action/Observation) to a structured JSON column on `KIEntwurf` model. Display as collapsible trace in Entwurf detail view |
| Hard step cap with graceful degradation | Runaway loops are a production liability — infinite tool calls burning GPU or hitting rate limits | LOW | `stopWhen: stepCountIs(10)` in generateText. On cap hit: return partial result with "Analyse unvollständig — bitte manuell vervollständigen" in ENTWURF |
| Tool result injection back into context | Each tool call result must feed the next reasoning step | LOW | Handled natively by Vercel AI SDK: tool calls appended to conversation history automatically, new generation triggered |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Zod-typed tool registry | Type-safe tool definitions prevent schema drift between tool definition and tool implementation — critical when tools mutate DB or calendar | LOW | Define each Helena tool as `tool({ description, parameters: z.object({...}), execute })` using Vercel AI SDK tool helper. Zod validation at tool input boundary |
| Per-Akte agent context injection | Helena's system prompt is dynamically constructed per Akte — Beteiligte, Rechtsgebiet, pinned Normen, open Fristen — enabling case-aware reasoning without extra tool calls | MEDIUM | Build `buildHelenaContext(akteId)` that assembles a structured system-prompt section. Inject at agent startup. Re-use across all agent invocations for that Akte |
| Agent invocation audit log | Every agent run (trigger, steps, tools called, tokens used) stored with ENTWURF reference | LOW | Extend existing `logAuditEvent` schema with `agentRunId`, `steps[]` JSON |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| LangGraph / custom state machine orchestrator | Perceived as "proper" agent framework | Project already uses Vercel AI SDK v4 which has native multi-step tool calling. Adding LangGraph introduces a competing abstraction layer, new dependency tree, and inconsistent streaming interfaces | `generateText` with `maxSteps` + `stopWhen` covers all required agent patterns within the existing SDK |
| Unlimited agent recursion / self-spawning agents | Maximum flexibility for complex tasks | Unbounded loops burn GPU quota, risk hallucination amplification, make debugging impossible | Hard cap at 10 steps per invocation; complex multi-phase work modeled as separate BullMQ jobs that each spawn a bounded agent |
| Autonomous action without human gate | Maximum efficiency | Absolute No-Go per BRAK 2025; BRAO §43 professional responsibility lies with Anwalt; EU AI Act high-risk classification for legal decisions | All agent outputs land in ENTWURF. No action taken until human promotes. ENTWURF gate is non-negotiable |

---

### Category 2: Tool-Calling — Legal Domain Tool Set

The tools Helena can call during her reasoning loop. Each tool is a typed function the LLM invokes by name with structured arguments.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `searchAktenDokumente(query, akteId)` | Helena must retrieve relevant Akte documents during reasoning — core RAG tool | LOW | Already exists as Helena RAG retrieval; wrap as agent tool. Returns: [{chunkId, score, excerpt, dokumentTitle}] |
| `searchGesetze(query)` | Legal reasoning requires norm retrieval — "Was gilt nach § 626 BGB?" | LOW | Wraps law_chunks hybrid search (built in v0.1). Returns: [{normId, paragraph, text, standDatum}] |
| `searchUrteile(query)` | Case law grounding — prevents hallucinated citations | LOW | Wraps urteil_chunks hybrid search. Returns: [{urteilId, gericht, az, datum, leitsatz}] |
| `getAkteMetadata(akteId)` | Agent needs structured case facts — Beteiligte, Rechtsgebiet, Sachstand — without reading all documents | LOW | Query Prisma Akte model. Returns typed AkteContext object. Required for Rubrum in Schriftsatz |
| `getFristen(akteId)` | Deadline awareness is mandatory for any legal task planning | LOW | Query Termin model WHERE akteId AND typ='FRIST'. Returns: [{datum, beschreibung, priority, daysRemaining}] |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| `createEntwurf(akteId, inhalt, typ)` | Helena can produce structured output and store it as ENTWURF in one tool call — no copy-paste | LOW | Calls existing KIEntwurf create logic. Status always ENTWURF. Returns entwurfId for Socket.IO notification. This is the primary output tool |
| `createFristEntwurf(akteId, datum, beschreibung)` | Auto-detected deadlines stored as calendar ENTWURF items — lawyer approves or rejects | LOW | Creates Termin with status=ENTWURF. Already partly implemented in Helena proactive scan. Wrap as explicit tool |
| `addNormToAkte(akteId, normId)` | Agent can pin relevant norms discovered during reasoning — captures agent knowledge for future queries | LOW | Calls AkteNorm create (built in v0.1). Returns confirmation |
| `searchMuster(query)` | Agent retrieves kanzlei-specific templates for Schriftsatz drafting | LOW | Wraps muster_chunks hybrid search. Returns: [{musterId, titel, kategorie, excerpt}] |
| `getEmailContext(akteId, limit)` | Email threads often contain key facts (deadlines, counter-party positions) | MEDIUM | Query Email model WHERE akteId, limit=10. Strip attachments, return subject+snippet. Allows agent to ground drafts in correspondence |
| `createAktennotiz(akteId, inhalt)` | Agent can record observations as structured Aktennotiz ENTWURF — audit trail of agent reasoning output | LOW | Calls existing Aktennotiz create. Status=ENTWURF |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| `sendEmail(to, subject, body)` as agent tool | Maximum automation | Absolute No-Go — sending email = irreversible action; violates BRAK AI sending prohibition; professional liability for mis-sent correspondence | `createEmailEntwurf(akteId, ...)` only — agent creates draft, human sends |
| `deleteDocument(dokumentId)` as agent tool | Cleanup tasks | Irreversible; data loss risk; audit trail gaps | Agent can flag documents for review; deletion is human-only action |
| `updateBeteiligte(...)` as agent tool | Agent-detected parties should update records | Write access to authoritative legal data via autonomous agent = high error risk | `suggestBeteiligte(...)` creates a structured suggestion ENTWURF; human confirms via existing Beteiligte-suggestion flow |
| Tools without Zod schema validation | Simpler to implement | LLM-generated tool arguments will occasionally have wrong types; unvalidated calls against Prisma = DB errors or silent data corruption | All tool parameters must use `z.object()` with `.describe()` on every field. Zod `.safeParse()` before execution |

---

### Category 3: @-Mention Task System

UX pattern for delegating work to Helena explicitly, from within the case context.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| @Helena mention in Akte comment/message triggers agent | Natural, familiar UX (Slack, GitHub, Linear all use @-mention as delegation primitive) | MEDIUM | Parse message text for `@helena` or `@Helena` prefix. Extract task description after @. Enqueue BullMQ `helena-task` job. Show "Helena arbeitet daran..." state |
| Task progress indicator in UI | User must know agent is working — perceived responsiveness | LOW | Socket.IO room per Akte; emit `helena:thinking`, `helena:step:{n}`, `helena:done`. Show animated spinner in chat thread with step description |
| Task result linked to originating mention | User traces from "I asked Helena X" to "Helena produced Y" | LOW | Store `mentionId` on KIEntwurf. Display "Helena hat einen Entwurf erstellt" reply in the thread with direct link to ENTWURF |
| Fail gracefully with user-readable error | Agent failures (timeout, tool error, LLM error) must not leave task in limbo | LOW | BullMQ job failure handler emits `helena:failed` via Socket.IO. Show error message with retry option and agent trace for debugging |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Task queue with per-Akte serialization | Multiple concurrent requests for same Akte should not produce conflicting drafts | MEDIUM | BullMQ job group per `akteId` with concurrency=1 per group. Subsequent @-mentions queue behind running job for that Akte |
| @Helena with structured intent detection | "@Helena erstelle Klageschrift gegen [Beklagter]" — extract task type + target automatically | MEDIUM | Intent classification prompt runs first (fast, no tools), routes to specialized agent persona (Schriftsatz-Modus, Fristencheck-Modus, Recherche-Modus). Each mode has tailored system prompt and tool set |
| Suggested @Helena commands | New users don't know what to ask — proactive suggestions reduce onboarding friction | LOW | Show contextual suggestions below chat input: "Erstelle Schriftsatz-Entwurf", "Prüfe Fristen", "Recherchiere Rechtslage zu §..." |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Free-form @Helena without task scoping | Maximum flexibility | Without scoping, agent has no stable tool set — tries to do everything, takes too many steps, produces generic output | Detect intent first; route to bounded agent mode with specific tool list |
| Real-time streaming agent output character-by-character | Looks impressive | For background BullMQ tasks, streaming to UI requires persistent SSE/WS connection per job. Complexity not justified when task takes 10-30s | Emit structured progress events (step names, not token streams); show completed ENTWURF when done |

---

### Category 4: Draft-Approval Workflow (ENTWURF → FREIGEGEBEN)

The human-in-the-loop mechanism for all agent-produced content.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Accept / Reject / Edit actions on every ENTWURF | Standard review UX; every legal AI platform that survives uses this gate | LOW | Already exists as KI-Entwurf workflow. Ensure all agent-created items (Schriftsatz, Frist, Aktennotiz, Norm-suggestion) route through the same ENTWURF flow |
| Rejection reason capture | Helena learns from rejections if reason is structured | LOW | Add `ablehnungsGrund: string?` to KIEntwurf model. Dropdown options: "Sachlich falsch", "Unvollständig", "Falsches Format", "Andere". Free-text for edge cases |
| Diff view for edited ENTWURFs | Lawyer edits draft before accepting — must see what changed vs original | MEDIUM | Store original AI output separately in `originalInhalt` field. Show diff on "Bearbeiten" action. Use existing OnlyOffice Track Changes or client-side diff library |
| "Alle ablehnen" bulk action | Multiple queued ENTWURFs from an agent run; lawyer wants to dismiss quickly | LOW | Bulk reject endpoint with optional shared Ablehnungsgrund |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| ENTWURF expiry and cleanup | Stale drafts from old agent runs clutter the workspace | LOW | Add `expiresAt` to KIEntwurf. BullMQ daily cron auto-archives ENTWURFs older than 30 days with status=ABGELAUFEN. Notify owner via Socket.IO |
| Agent trace in ENTWURF detail | Lawyer can audit every tool call that produced this draft — transparency for professional responsibility | LOW | Display `agentTrace` (Thought/Action/Observation JSON array) as collapsible "Wie Helena zu diesem Entwurf kam" section |
| One-click promote to FREIGEGEBEN + action | Accept ENTWURF and immediately open it in OnlyOffice / attach to beA send / schedule Frist in one gesture | MEDIUM | Post-promotion action sheet: "In OnlyOffice öffnen", "An beA anhängen", "Zu Kalender hinzufügen". Routes based on ENTWURF type |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-promote ENTWURF after N days without action | Reduces backlog | Professional liability — an unreviewed AI draft that auto-promotes and reaches court is a BRAO violation. Frankfurt Sept 2025 case directly on point | ENTWURFs age out to ABGELAUFEN, never auto-promote. Nagging notification instead |
| Single-click blind accept without preview | Speed | Lawyer must have meaningful opportunity to review — BRAK 2025 guidelines explicitly require this | Keep two-step: open ENTWURF detail → then Accept button. Prevent single-click accept from list view |

---

### Category 5: Proactive Scanning

Helena checks cases automatically, without user prompting, and surfaces findings as ENTWURFs or alerts.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Fristencheck on newly-uploaded documents | Legal professionals expect AI to catch deadlines in Schriftsätze — this is table stakes for 2026 legal AI | MEDIUM | Already partially implemented. Wrap as scheduled BullMQ job: after OCR completes on a new upload, trigger helena-frist-scan job. Output: Frist ENTWURF per detected deadline |
| Beteiligte-Erkennung from new documents | New documents often name parties not yet in Akte — Helena flags missing Beteiligte | MEDIUM | Already partially implemented. Extend to all new uploads, not just specific ones |
| Daily Akte health scan per assigned Anwalt | Proactive monitoring: open Fristen in 7 days, new unveraktete emails, stale tickets | MEDIUM | BullMQ daily cron (02:00 Uhr, outside office hours). Per Akte with `status='OFFEN'` and assigned user. Emit findings as Alert items |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Semantic similarity cross-Akte (detect related cases) | New Akte involving same Beklagte/Gläubiger detected automatically — conflict check extension | HIGH | Run embedding similarity on Beteiligte names + Sachverhalt snippet against existing Akte embeddings. Surface as low-priority alert "Ähnliche Akte gefunden: [AZ]" |
| Auto-suggest Rechtsgrundlage for new Akte | When a new Akte is opened in Rechtsgebiet Arbeitsrecht, Helena immediately suggests the 3 most relevant Normen | MEDIUM | Trigger on Akte creation. Lightweight retrieval (no full agent loop) from law_chunks using Rechtsgebiet as query. Output: AkteNorm ENTWURFs |
| Verjährungs-Radar (statute of limitations) | Proactively alert when Verjährungsfrist approaches for Akte with no Klage filed | HIGH | Parse Akte creation date + Rechtsgebiet → compute applicable Verjährungsfrist (§195 BGB = 3 Jahre standard; §199 BGB Kenntniserfordernis). Alert at 6 months before expiry. Needs a mapping table of Rechtsgebiet → Verjährungsnorm |
| Email-triggered scan (new IMAP message → Helena reads + flags) | Email from Gericht or Gegner often contains deadlines or action items | MEDIUM | After IMAP IDLE delivers new email for a known Akte: enqueue helena-email-scan job. Extracts: Fristen, Beteiligte, Handlungsempfehlungen. Output: ENTWURF with structured findings |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Continuous real-time scanning (scan every document the moment it arrives in all Akten) | Maximum freshness | GPU-exhausting for qwen3.5:35b; scanning a 100-Akte firm simultaneously would take hours; Socket.IO broadcast flood | Trigger-based: scan on upload complete, scan on email arrival, daily cron for health checks. Never scan all Akten simultaneously |
| Helena autonomously contacts counter-parties based on scan findings | Closing the loop automatically | Irreversible action; professional conduct violation; BRAK prohibition on unsupervised AI correspondence | Helena creates correspondence ENTWURF + alert; Anwalt reviews and sends manually |

---

### Category 6: Agent Memory — Per-Case Context Persistence

What Helena remembers about a case across sessions.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Conversation history per Akte, persisted | Lawyer resumes context: "As we discussed yesterday, the Beklagte argues..." — Helena must recall | LOW | Already shipped: `ChatMessage` model per user per Akte. Inject last N=20 messages into agent system context |
| Key facts extraction (Fallblatt / Case Snapshot) | Running full document RAG on every agent invocation is slow and expensive. Helena should maintain a cached "what I know about this case" summary | HIGH | New `AkteSnapshot` model: KI-generated summary, last updated timestamp. Rebuilt on major events (new document, new Beteiligte, status change). Inject into system prompt header. Regeneration = BullMQ job |
| Pinned context items (Normen, decisions) | Lawyer has explicitly told Helena "always remember this norm for this case" — should persist | LOW | Existing AkteNorm model (built v0.1). Already injectable into context. Add similar AkteUrteile model |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Memory quality indicator ("Kontext aktuell / veraltet") | AkteSnapshot may be outdated if new documents arrived since last rebuild | LOW | Compare `snapshot.updatedAt` vs latest `Dokument.createdAt`. Display "Kontext vom [datum]" with refresh button in Helena chat header |
| Semantic memory summarization (episodic → semantic compression) | Over many months, chat history grows too large for context injection. Need compression | HIGH | After 50+ messages, run summarization job: compress old episodic messages into a "Zusammenfassung" block stored in AkteSnapshot. Retain last 10 messages verbatim. Standard pattern from LangChain memory research |
| Cross-session preference learning (per-Anwalt) | Helena learns individual Anwalt's style preferences: short vs verbose, formal vs informal | VERY HIGH | Requires per-user preference model and fine-tuning or few-shot injection. Defer — too complex for this milestone |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Storing memory in LLM fine-tune / LoRA | Deep personalization | Requires GPU infrastructure for continuous training, evaluation pipeline, validation that learned preferences don't bleed across users/cases | Prompt-injection memory: structured facts in system prompt is simpler, auditable, and correctable |
| Unlimited conversation history in context | Complete recall | Context window overflow kills generation; qwen3.5:35b has 32k context; 200 messages of chat + documents fills it | Sliding window: 20 recent messages + AkteSnapshot header. Historical messages queryable but not in active context |

---

### Category 7: Alert System

Priority-routed notifications from Helena and the system to the right person at the right time.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Priority levels (Kritisch / Hoch / Mittel / Info) | Not all alerts are equal — a Verjährungsfrist alarm is not the same as "Helena has a suggestion" | LOW | 4-tier severity. Kritisch = 🔴 banner + Sound. Hoch = 🟡 badge. Mittel = notification bell. Info = feed entry only |
| Role-based alert routing | Frist alerts go to Anwalt; admin alerts go to ADMIN; general suggestions go to assigned Sachbearbeiter | LOW | AlertRule model: `{eventType, minPriority, targetRole, targetUserId?}`. Alert creation resolves recipients from rules |
| In-app notification center (bell icon) | Standard SaaS pattern — users expect a central alert hub | LOW | Already partially implemented via Socket.IO notifications. Extend with Alert model in Prisma: `{id, userId, eventType, priority, payload, readAt, akteId?}` |
| Frist reminder cascade (7d → 3d → 1d) | Already implemented in v3.4 for calendar. Helena agent alerts should use same pattern | LOW | Re-use existing BullMQ Frist-reminder cron. Extend to include Helena-detected Fristen (status=FREIGEGEBEN only — not ENTWURFs) |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Alert digest (daily summary email) | Lawyers away from desk need a digest — avoids notification overload | MEDIUM | BullMQ daily digest job (08:00 Uhr). Aggregate unread Hoch+Kritisch alerts per user. Send via existing SMTP. HTML template with case links |
| Alert snooze ("Erinnere mich morgen") | Lawyers working on something else can defer without losing the alert | LOW | `snoozeUntil: DateTime` on Alert model. BullMQ delayed job re-delivers at snoozeUntil |
| Alert → ENTWURF conversion ("Lass Helena das bearbeiten") | One-click from alert to delegating work to Helena | MEDIUM | Alert actions: [Jetzt anzeigen] [Später erinnern] [An Helena delegieren]. "Delegieren" creates a @Helena BullMQ task linked to the alert |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Push notifications to mobile | Lawyers are never away from computer (browser-only app) | App is Chrome-only; no mobile app exists; implementing Web Push for a non-PWA is wasted effort | Email digest for away-from-desk alerting; real-time in-app for at-desk |
| Slack/Teams integration for alerts | Firms use external tools | Out of scope (self-hosted, no external SaaS dependencies for core features); distracts from building in-app experience | In-app notification center + email digest covers the need |

---

### Category 8: QA Evaluation — Measuring Legal AI Quality

How to know Helena is working correctly.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Token usage tracking per agent run | Cost control and anomaly detection | LOW | Already shipped: token tracking per user/Akte. Extend with `agentRunId` to attribute tokens to specific agent tasks |
| ENTWURF rejection rate metric | If >30% of Helena's ENTWURFs are rejected, quality is poor — actionable signal | LOW | Admin dashboard: group KIEntwurf by ablehnungsGrund, rejection rate per week. Trend chart |
| Step count per agent run logging | Average steps per task + outliers where agent took 9/10 steps (near cap) signals prompt engineering issues | LOW | Store `stepCount` on AgentRun model. Admin dashboard: histogram |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Goldset evaluation suite (30-50 labeled queries) | Structured measurement of retrieval quality and answer accuracy — the only way to know if RAG improvements actually help | HIGH | Create a labeled dataset: {query, expected_sources[], expected_answer_snippet}. Run evaluation job weekly. Metrics: Recall@5, Precision@5, Answer faithfulness (checked against expected sources) |
| Hallucination detection (citation grounding check) | Helena cites a case or norm — verify the citation actually came from retrieved chunks, not LLM fabrication | HIGH | Post-generation: for each §-reference and AZ in Helena's answer, check if it appears in the retrieved chunks used. Flag as "Nicht aus Quellen belegt" if not found. Display warning badge on affected citations |
| User feedback on individual answers (thumbs up/down) | Fastest labeling mechanism — lawyers rate answers inline | LOW | Thumbs up/down on each Helena message. Store as `AnswerFeedback`. Export for goldset labeling and weekly quality reports |
| A/B baseline comparison (with/without agent loop) | Know if the ReAct loop actually improves over simple RAG | MEDIUM | Evaluation mode in admin: run same query set against single-pass RAG and full agent loop. Compare rejection rates and feedback scores |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Automated hallucination detection via external API (Vectara Hallucination Evaluator, etc.) | Turnkey solution | Client data sent to external service — DSGVO violation; breaks self-hosted principle | In-house citation grounding check: compare citations to retrieved chunk IDs. Simpler and sufficient |
| Continuous A/B testing on production users | Statistical rigor | Users in legal context should not receive experimentally degraded AI — professional liability risk | Offline evaluation on goldset; manual A/B by admin on demand |

---

### Category 9: Activity Feed UI

Slack/GitHub-style chronological log of case activity.

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Per-Akte activity feed (Timeline) | Case management platforms universally show a timeline — what happened, when, by whom | MEDIUM | New `ActivityEvent` model: {id, akteId, userId?, agentRunId?, eventType, payload, createdAt}. Display as vertical timeline in Akte detail. Replaces manual Aktennotizen for system events |
| Event types: Dokument hochgeladen, Frist erstellt, E-Mail veraktet, Helena Entwurf erstellt, Status geändert | Completeness — lawyers must reconstruct the case history | LOW | Map existing audit log events to ActivityEvent types. Extend logAuditEvent to also write ActivityEvent |
| Helena events clearly distinguished from human events | Professional responsibility — must always know who did what | LOW | ActivityEvent has `source: 'USER' | 'HELENA' | 'SYSTEM'`. Display with distinct icon/color: human avatar vs Helena chip |
| Real-time update via Socket.IO | Feed feels live — new events appear without page refresh | LOW | Emit `akte:activity` on ActivityEvent create. Client subscribes to per-Akte Socket.IO room |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Filterable feed (Nur Helena / Nur Fristen / Nur Dokumente) | Busy cases accumulate hundreds of events — lawyers need signal, not noise | LOW | Client-side filter chips. ActivityEvent.eventType enum as filter dimension |
| Activity digest per Akte (on Akte open after absence) | "While you were away, 3 documents were uploaded and Helena created 2 ENTWURFs" — removes need to scroll entire feed | MEDIUM | Compute delta since last `UserAkteView.lastSeen` timestamp. Show collapsed summary at top of feed |
| @-mention trail in feed | See who was mentioned and what Helena produced for each mention | LOW | @Helena tasks generate ActivityEvent on start and on completion. Renders as threaded sub-events |
| Export feed as PDF/CSV for court file documentation | German procedural requirements: Akte must be reconstructable for court | MEDIUM | Export button on activity feed. PDF via existing pdf-lib + Briefkopf. CSV of structured events |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Global cross-Akte activity feed | Firm-wide "what's happening" view | Privacy: RBAC means not every user sees every Akte. Building a cross-Akte feed requires re-checking access on every event render — expensive | Dashboard KPI widgets (Neue Akten, offene Entwürfe) give the firm-wide overview without per-event privacy checks |
| Emoji reactions on activity items | Fun, familiar from Slack | Out of place in professional legal context; German Kanzlei culture is formal | Skip entirely |

---

## Feature Dependencies

```
[ReAct Agent-Loop (generateText + maxSteps)]
    requires --> [Vercel AI SDK v4] (already exists)
    requires --> [BullMQ Worker] (already exists)
    requires --> [Tool Registry — Zod typed tools] (NEW)

[Tool Registry]
    requires --> [searchAktenDokumente] (wraps existing Helena RAG)
    requires --> [searchGesetze] (wraps law_chunks from v0.1)
    requires --> [searchUrteile] (wraps urteil_chunks from v0.1)
    requires --> [getAkteMetadata] (Prisma query)
    requires --> [getFristen] (Prisma query)
    requires --> [createEntwurf] (wraps existing KIEntwurf create)

[@-Mention Task System]
    requires --> [ReAct Agent-Loop] (agent is triggered by mention)
    requires --> [BullMQ helena-task queue] (NEW queue)
    requires --> [Socket.IO per-Akte room] (already exists)
    requires --> [Intent classification prompt] (NEW)

[Draft-Approval Workflow (enhanced)]
    requires --> [KI-Entwurf model + ENTWURF workflow] (already exists)
    requires --> [agentTrace field on KIEntwurf] (NEW Prisma field)
    requires --> [ablehnungsGrund field on KIEntwurf] (NEW Prisma field)

[Proactive Scanning]
    requires --> [ReAct Agent-Loop] (uses agent for complex scans)
    requires --> [BullMQ daily cron] (already exists)
    requires --> [OCR completion event] (already exists — extend trigger)
    requires --> [IMAP IDLE event] (already exists — extend trigger)

[Agent Memory — AkteSnapshot]
    requires --> [AkteSnapshot Prisma model] (NEW)
    requires --> [BullMQ snapshot-rebuild job] (NEW)
    requires --> [ReAct Agent-Loop] (snapshot injected into system context)

[Alert System]
    requires --> [Alert Prisma model] (NEW)
    requires --> [AlertRule Prisma model] (NEW)
    requires --> [Socket.IO notification channel] (already exists — extend)
    requires --> [Existing BullMQ Frist-reminder cron] (already exists)
    requires --> [SMTP for digests] (already exists)

[Activity Feed]
    requires --> [ActivityEvent Prisma model] (NEW — or extend existing Audit log)
    requires --> [Socket.IO akte:activity event] (NEW event type)
    requires --> [All agent actions emit ActivityEvent] (NEW integration point)

[QA Evaluation]
    requires --> [AgentRun Prisma model with stepCount, tokens] (NEW)
    requires --> [ENTWURF ablehnungsGrund] (from Draft-Approval workflow above)
    requires --> [AnswerFeedback Prisma model] (NEW)
    requires --> [Goldset dataset] (NEW — manually curated)
    requires --> [Citation grounding checker] (NEW — post-generation validation)
```

### Critical Dependency Notes

- **Tool Registry is the foundation** — all other agent features depend on a working set of Zod-typed tools. Build this first before any agent mode.
- **@-Mention requires working ReAct Loop** — do not build the UX trigger until the underlying agent can actually complete tasks reliably.
- **Proactive Scanning should use the same agent infrastructure** as @-Mention — same BullMQ queue, same tool registry, same ENTWURF output. Don't build two separate Helena execution paths.
- **AkteSnapshot blocks semantic memory compression** — the snapshot model is shared infrastructure for both Agent Memory and efficient context injection for all agent invocations.
- **Activity Feed needs to be wired to all other agent features** — it's the logging layer, not a standalone feature. Build the model early; wire events iteratively.
- **QA Evaluation can be built incrementally** — token tracking and ENTWURF rejection rates can ship with the first agent features; Goldset evaluation is a later addition.

---

## MVP Definition

### v0.2 Launch With (Helena Agent v2 — Core Agent Capabilities)

- [ ] **Tool Registry (6 core tools)** — `searchAktenDokumente`, `searchGesetze`, `searchUrteile`, `getAkteMetadata`, `getFristen`, `createEntwurf` — the minimum set for useful legal agent work
- [ ] **ReAct Agent-Loop** via `generateText` with `maxSteps=10` — bounded, auditable, fails gracefully
- [ ] **@Helena mention trigger** — in Akte chat/message area, triggers BullMQ job, Socket.IO progress events, ENTWURF result
- [ ] **Enhanced ENTWURF** — add `agentTrace`, `ablehnungsGrund` fields; display trace in detail view
- [ ] **Alert System (Priority + Role-routing)** — Alert model, AlertRule, in-app notification center extension
- [ ] **Activity Feed (per-Akte)** — ActivityEvent model, timeline UI, Helena vs Human distinction, Socket.IO real-time

### Add After Validation (v0.2.x)

- [ ] **Proactive Scanning** — email-triggered scan, daily health scan; only after agent loop is stable
- [ ] **AkteSnapshot (Agent Memory)** — reduces per-invocation latency; add after seeing performance issues in practice
- [ ] **QA Metrics in Admin** — rejection rate dashboard, step count histogram; add once enough data exists
- [ ] **Additional tools** — `createFristEntwurf`, `addNormToAkte`, `searchMuster`, `createAktennotiz`, `getEmailContext`
- [ ] **Alert snooze + digest email** — polish after core alerting works
- [ ] **Activity Feed export (PDF/CSV)** — add when court documentation need arises

### Future Consideration (v0.3+)

- [ ] **Goldset Evaluation Suite** — requires 2-3 months of production data to label meaningful queries
- [ ] **Hallucination citation-grounding check** — high implementation complexity; validate with simpler metrics first
- [ ] **Semantic cross-Akte similarity** — Verjährungs-Radar, related case detection — high value, high complexity
- [ ] **Intent-routing to specialized agent modes** — Schriftsatz-Modus, Recherche-Modus — after v0.2 proves stable
- [ ] **Episodic → Semantic memory compression** — only needed when Akten age past ~50 chat sessions

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Tool Registry (6 core tools) | HIGH | LOW | P1 |
| ReAct Agent-Loop (generateText maxSteps) | HIGH | LOW | P1 |
| @Helena mention trigger + BullMQ | HIGH | MEDIUM | P1 |
| Enhanced ENTWURF (agentTrace, ablehnungsGrund) | HIGH | LOW | P1 |
| Alert System (Priority + Role-routing) | HIGH | MEDIUM | P1 |
| Activity Feed (per-Akte timeline) | HIGH | MEDIUM | P1 |
| Proactive Scanning (email + daily cron) | HIGH | MEDIUM | P2 |
| AkteSnapshot (agent memory) | MEDIUM | MEDIUM | P2 |
| Additional tools (createFristEntwurf, searchMuster, etc.) | MEDIUM | LOW | P2 |
| Alert digest + snooze | MEDIUM | LOW | P2 |
| QA metrics dashboard (rejection rate, step count) | MEDIUM | LOW | P2 |
| Activity feed export (PDF/CSV) | MEDIUM | LOW | P2 |
| Goldset evaluation suite | HIGH | HIGH | P3 |
| Hallucination citation grounding | HIGH | HIGH | P3 |
| Verjährungs-Radar | HIGH | HIGH | P3 |
| Cross-Akte semantic similarity | MEDIUM | HIGH | P3 |
| Episodic → Semantic memory compression | MEDIUM | HIGH | P3 |

---

## Legal Domain Constraints (Non-Negotiable)

These are not design choices — they are professional conduct requirements under BRAK 2025 and BRAO.

| Constraint | Source | Implementation |
|------------|--------|----------------|
| All AI output = ENTWURF; never auto-action | BRAK 2025 AI guidelines, BRAO §43 | ENTWURF status enforced in `createEntwurf` tool; no `sendEmail`, `submitToBeA`, `signDocument` tools may exist |
| AI must not send correspondence autonomously | BRAK 2025; Frankfurt court Sept 2025 precedent | Email compose tool creates ENTWURF only; `sendEmail` is not in the tool registry |
| Lawyer must have opportunity to review before action | BRAO §43a competence duty | Two-step approval: open ENTWURF detail → explicit Accept. No single-click blind accept from list |
| All agent actions must be auditable | GoBD (German bookkeeping principles for digital records), 10-year retention | Every tool call logged in agentTrace; AgentRun model with full step log |
| Client data must not leave premises | DSGVO Art. 5(1)(f), BRAK confidentiality duty | Only self-hosted LLM (Ollama qwen3.5:35b) for tasks involving real client data; OpenAI/Anthropic only for tasks on anonymized/synthetic content |
| AI must be disclosed when used | BRAO §43a transparency; EU AI Act Art. 52 | KI badge on all ENTWURF items; "Von Helena erstellt" label visible to all users with access to the draft |

---

## Competitor Feature Analysis

| Feature | Harvey AI | Legora | Definely (LangGraph) | Helena (this project) |
|---------|-----------|--------|----------------------|----------------------|
| ReAct agent loop | Yes (cloud) | Yes (cloud) | Yes (LangGraph) | Vercel AI SDK generateText + maxSteps (self-hosted) |
| Case file integration | Partial | Partial | Contract-specific | Embedded in Akte — full case context |
| ENTWURF / approval gate | Yes | Yes | Redline review | KI-Entwurf with trace, rejection reason, BRAO-compliant |
| Proactive scanning | Limited | Email-triggered | No | Daily cron + event-triggered (email, upload) |
| Self-hosted / DSGVO | No (US cloud) | No (EU cloud, DPA required) | No (cloud) | Yes — full Docker Compose, zero egress |
| Tool registry transparency | No | No | No | agentTrace visible in ENTWURF detail |
| German legal knowledge sources | Yes (proprietary) | Partial | No | bundestag/gesetze + BMJ (v0.1) |
| Activity feed | No | No | No | Per-Akte timeline with Helena/Human distinction |
| Professional responsibility compliance | US law focus | EU framework | Not legal-specific | BRAK 2025 + BRAO explicitly modeled |

**Helena's differentiated position:** The combination of (1) self-hosted DSGVO compliance, (2) BRAO-explicit ENTWURF gate, (3) transparent agent trace, (4) per-Akte embedded context (not standalone research tool), and (5) German legal knowledge sources is unique. No competitor combines all five.

---

## Sources

- Vercel AI SDK agent loop and tool calling: [AI SDK Agents — Vercel](https://vercel.com/kb/guide/how-to-build-ai-agents-with-vercel-and-the-ai-sdk), [AI SDK Loop Control docs](https://ai-sdk.dev/docs/agents/loop-control), [AI SDK Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- AI SDK 5 and 6 features (maxSteps, stopWhen, Agent abstraction): [AI SDK 5 Release](https://vercel.com/blog/ai-sdk-5), [AI SDK 6 Release](https://vercel.com/blog/ai-sdk-6)
- ReAct agent pattern: [ReAct pattern TypeScript 2026](https://noqta.tn/en/tutorials/ai-agent-react-pattern-typescript-vercel-ai-sdk-2026), [AG2 ReAct Loops](https://docs.ag2.ai/latest/docs/blog/2025/06/12/ReAct-Loops-in-GroupChat/)
- Legal AI agent tools (Harvey, Legora, Spellbook): [Spellbook Legal AI](https://www.spellbook.legal/), [Legora](https://legora.com/), [Harvey AI](https://www.harvey.ai/), [Definely + LangGraph case study](https://www.blog.langchain.com/customers-definely/)
- Legal AI hallucination rates: [Stanford Law: Legal RAG Hallucinations study](https://dho.stanford.edu/wp-content/uploads/Legal_RAG_Hallucinations.pdf), [Lakera: Hallucination guide 2026](https://www.lakera.ai/blog/guide-to-hallucinations-in-large-language-models)
- RAG evaluation metrics (Goldset, Recall@k, faithfulness): [Label Your Data: RAG Evaluation 2026](https://labelyourdata.com/articles/llm-fine-tuning/rag-evaluation), [Confident AI: LLM Evaluation Metrics](https://www.confident-ai.com/blog/llm-evaluation-metrics-everything-you-need-for-llm-evaluation)
- Agent memory patterns (episodic, semantic, compression): [The New Stack: Memory for AI Agents](https://thenewstack.io/memory-for-ai-agents-a-new-paradigm-of-context-engineering/), [AWS AgentCore long-term memory](https://aws.amazon.com/blogs/machine-learning/building-smarter-ai-agents-agentcore-long-term-memory-deep-dive/)
- Activity feed and agentic UX patterns: [UI Patterns: Activity Stream](https://ui-patterns.com/patterns/ActivityStream), [Smashing Magazine: Designing for Agentic AI](https://www.smashingmagazine.com/2026/02/designing-agentic-ai-practical-ux-patterns/)
- BRAK AI guidelines and BRAO professional responsibility: [BRAK 2025 AI stance via advofleet](https://www.advofleet.com/insights/the-ripple-effects-of-the-2025-aba-ethics-opinion-on-generative-ai-in-european-law-firms), [Fordham Law: Legal profession and AI 2026](https://news.law.fordham.edu/blog/2026/01/28/what-the-legal-profession-needs-to-know-about-ai-in-2026/), [Germany AI regulatory landscape](https://www.legal500.com/guides/chapter/germany-artificial-intelligence/)
- Frankfurt court AI hallucination liability: Library of Congress Global Legal Monitor Feb 2026 (Germany Regional Court rules AI-generated expert report inadmissible)

---

*Feature research for: Helena Agent v2 — ReAct Loop, Tool Registry, @-Mention, Draft-Approval, Proactive Scanning, Agent Memory, Alerts, QA, Activity Feed*
*Researched: 2026-02-27*
