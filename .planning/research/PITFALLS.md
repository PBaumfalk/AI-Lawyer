# Pitfalls Research

**Domain:** Helena Agent v2 — Autonomous Agent Capabilities added to existing AI-Lawyer (Next.js/Prisma/BullMQ/Ollama/Vercel AI SDK v4)
**Researched:** 2026-02-27
**Confidence:** MEDIUM-HIGH (agent-loop, BullMQ, Ollama tool-calling pitfalls from verified GitHub issues + official docs; BRAK/BRAO legal compliance from official BRAK PDF Dec 2024; DSGVO from EDPB 2025 opinion; hallucination rates from Stanford peer-reviewed study 2025)

> This file covers pitfalls specific to adding autonomous agent capabilities to an existing legal software system. For v0.1 Helena RAG pitfalls (hybrid search, German law ingestion, NER PII, parent-child chunking), see git history of this file (2026-02-26 version).

---

## Critical Pitfalls

### Pitfall 1: ReAct Agent Infinite Loop — No Iteration Cap or Exit Condition

**What goes wrong:**
The ReAct agent loop (Reason → Act → Observe → Reason …) runs until a stop condition is met. Without an explicit iteration cap, two failure modes occur: (1) the agent calls the same tool repeatedly because the tool result does not satisfy the success condition it inferred from the system prompt, and (2) two tools form a circular dependency — Tool A's output triggers Tool B, Tool B's output triggers Tool A. At Ollama's qwen3.5:35b inference speed (~2s/call), a 30-iteration loop runs for 60 seconds undetected, consuming the BullMQ worker slot, blocking other jobs, and accumulating tokens.

**Why it happens:**
Developers implement the core loop as `while (!finalAnswer) { step() }` without threading in a circuit breaker. The LLM is often inconsistent about emitting the "Final Answer" token that signals loop termination — especially under tool call hallucinations where qwen3.5:35b returns JSON as `content` instead of invoking the tool.

**How to avoid:**
- Hard cap: `maxIterations: 10` on every agent executor instance. Never exceed 15 for any legal task.
- Implement a **stall detector**: if the last N tool calls are identical (same tool name + same arguments), abort and return a partial result with an explanatory error to the user.
- Track per-agent-run token consumption. Abort when `usedTokens > 8000` (Ollama context budget, leaving headroom for the final response).
- Log every tool invocation with timestamps. Alert (Socket.IO event to admin dashboard) when any agent run exceeds 5 iterations — that is a signal of a design problem.
- Use Vercel AI SDK `maxSteps` parameter (available in `generateText` / `streamText` with tool calls) as a second-layer hard stop independent of application logic.

**Warning signs:**
- BullMQ active job count stays at maximum concurrency for minutes with no completion.
- Same tool name appearing 3+ times consecutively in agent run logs.
- Ollama GPU memory at 100% with no new requests being accepted — worker slot occupied by looping agent.
- User-visible: Helena spinner runs for >30s on a query that should resolve in <10s.

**Phase to address:** Phase 1 (ReAct agent foundation). Iteration cap and stall detector must be present before any tool is wired up.

---

### Pitfall 2: Ollama qwen3.5:35b Tool Call Hallucination — JSON as Content, Not Tool Invocation

**What goes wrong:**
Ollama's implementation of the tool-calling protocol for Qwen3 models is unstable as of early 2026. Documented failure modes (GitHub issues #11135, #11662): the model produces the correct JSON structure for a tool call but Ollama returns it as `message.content` (a string) instead of `message.tool_calls` (the structured array). The Vercel AI SDK sees no tool invocation, interprets the response as a final answer, and returns the raw JSON to the user. In a legal context, Helena appears to answer with a malformed JSON blob instead of the intended Schriftsatz draft or calendar entry.

A second failure mode: after Ollama upgrade (observed in v0.9.2+), qwen3.5 selects the wrong tool — it identifies the correct tool in its reasoning trace but calls a different one. This is silent unless the called tool validates its arguments strictly.

**Why it happens:**
Ollama's tool-calling parser for Qwen3 uses the model's native tool-call format, which conflicts with the OpenAI-compatible API format that Vercel AI SDK v4 expects. The mismatch is version-dependent and regressions are introduced without breaking changes in Ollama releases.

**How to avoid:**
- **Pin Ollama version** in Docker Compose. Do not use `latest` tag. Test tool calling after every Ollama version bump before shipping.
- Implement a **response type guard** in the agent layer: after each LLM call, assert that if the model's reasoning trace mentions a tool name, a corresponding tool call must be present in the response. If not, log the discrepancy and re-issue the request with temperature=0.
- Add **argument schema validation** (Zod) to every tool's `execute` function. If arguments do not match the schema, return a structured error to the agent loop rather than throwing — this gives the agent a chance to correct itself.
- As fallback: if Ollama tool calls fail consistently in production, implement a **text-mode ReAct prompt** that extracts tool calls from raw text using regex (`Action: tool_name\nAction Input: {json}`). This is less elegant but more reliable.
- Test tool calling with a dedicated smoke test that calls each registered tool through the full Ollama + Vercel AI SDK stack — not unit tests with mocked LLM responses.

**Warning signs:**
- Agent run logs show `finalAnswer: true` with content matching a JSON schema — tool call returned as content.
- Zod validation errors in tool `execute` functions with wrong argument types — wrong tool called.
- `tool_calls` array empty in Ollama response logs despite model reasoning mentioning a tool name.
- Ollama version in Docker Compose changed recently and tool-calling regression started.

**Phase to address:** Phase 1 (ReAct agent foundation + tool wiring). Smoke test suite for tool calling must pass before any agent feature goes to production.

---

### Pitfall 3: KI Auto-Send Bypass — ENTWURF Enforcement Gaps in Agent-Created Documents

**What goes wrong:**
The existing system has a send gate: `ENTWURF`-status documents cannot be dispatched via beA or SMTP. Helena Agent v2 creates documents programmatically via tools. If the tool that creates a document does not explicitly set `status: 'ENTWURF'` — or if it creates the document directly in the file system / MinIO without going through the Prisma document creation path — it may bypass the ENTWURF guard entirely. A document created by the agent with no `status` field defaults to `null`, which the send gate may not catch.

BRAK Leitfaden KI-Einsatz (December 2024, §43 BRAO): "KI-Tools können unterstützen, die finale Kontrolle und rechtliche Bewertung müssen stets durch einen menschlichen Juristen erfolgen." An auto-sent document is a professional conduct violation — not a UX bug.

**Why it happens:**
Agent tools are implemented as service functions that call internal APIs or Prisma directly. The ENTWURF enforcement lives in the document creation endpoint (`POST /api/akten/[id]/dokumente`). Agent tools that bypass the HTTP layer also bypass the middleware enforcement. The agent's `createDraft` tool might call `prisma.dokument.create()` directly, forgetting `status: 'ENTWURF'` in the create payload.

**How to avoid:**
- All agent tools that create documents MUST go through the same HTTP endpoint as the UI (`POST /api/akten/[id]/dokumente`). Never call `prisma.dokument.create()` directly from a tool.
- Add a **Prisma middleware** (using `prisma.$use`) that throws if any `dokument.create` or `dokument.update` call would result in `status = null`. This is a last-resort guard at the DB layer.
- The send gate (`POST /api/akten/[id]/dokumente/[docId]/versenden`) must check `status === 'ENTWURF'` at the DB read, not trust the client payload. This already exists — verify it covers documents created by agents as well.
- In the Activity Feed, every agent-created document must display the `KI`-badge and `Nicht freigegeben`-badge. Never suppress these badges programmatically.
- Add an integration test: simulate agent creating a document → attempt to send via beA → assert 403 response.

**Warning signs:**
- Agent-created documents appearing in beA Postausgang without user approval.
- `SELECT status FROM dokument WHERE "createdBy" = 'helena-agent'` returns any value other than `ENTWURF`.
- Send gate logs showing successful dispatch of a document without a `FREIGEGEBEN` status — enforcement gap.
- UI showing agent documents without the `KI` badge.

**Phase to address:** Phase 2 (Draft-creation tools). ENTWURF enforcement must be verified by integration test before shipping any tool that creates documents.

---

### Pitfall 4: Legal Hallucination — Wrong § References and Fabricated Aktenzeichen in Agent Drafts

**What goes wrong:**
Stanford research (2025, peer-reviewed): leading legal AI tools hallucinate 17–33% of the time on legal queries even with RAG. Specific failure modes relevant to German law: (1) citing a real statute but wrong paragraph/absatz ("§ 823 BGB Abs. 3" — Abs. 3 does not exist in §823), (2) fabricating Aktenzeichen with plausible-but-wrong year or division ("BGH XII ZR 45/23" when the retrieved chunk contains "BGH XII ZR 45/22"), (3) mixing Gesetze versions — citing §-reference from a law that was amended after the retrieved chunk's indexing date.

For a Schriftsatz agent that produces court-filing drafts, a single hallucinated citation can result in €2,500–€31,100 in sanctions (documented 2025 US cases; German disciplinary consequences under §43 BRAO are analogous).

**Why it happens:**
LLMs interpolate from training data when retrieved context is ambiguous or incomplete. The model "knows" German law patterns from training and fills gaps rather than returning "unknown." Parent-child chunking mitigates this but does not eliminate it — if the chunk boundary falls mid-citation, the model generates the missing half from memory.

**How to avoid:**
- System prompt hard constraint: "Zitiere ausschließlich §-Normen und Aktenzeichen, die wörtlich in den bereitgestellten Kontextblöcken erscheinen. Erfinde keine §-Nummern, Absatz-Nummern oder Aktenzeichen."
- **Post-generation verification**: extract all §-references from the agent output using regex (`/§\s*\d+[a-z]?\s*(Abs\.\s*\d+)?/g`). For each, check: (a) does a `law_chunk` with this reference exist in the RAG index? (b) is the `gueltigBis` date still current? Flag mismatches in the UI as "Quellennachweis nicht verifiziert."
- Extract Aktenzeichen from generated text and verify each against the `citation` metadata of retrieved `urteil_chunks`. If no match, render with a warning icon.
- Mandatory disclaimer appended to every agent-generated legal draft: "Hinweis: KI-generierter Entwurf. Alle zitierten Normen und Entscheidungen sind vor Verwendung zu verifizieren." This is non-removable in the UI.
- Restrict agent draft scope: Helena produces draft text for human editing, never final argumentation. System prompt must state this explicitly.

**Warning signs:**
- §-references in agent output not matching any indexed `law_chunks.normReference` field.
- Aktenzeichen in agent output not matching any `urteil_chunks.citation` field.
- Users reporting incorrect law citations upon manual review.
- Agent producing §-references with "Abs." numbers that do not exist in the actual statute.

**Phase to address:** Phase 2 (Schriftsatz-draft tool). Post-generation §-verification must be in the tool's `execute` function before shipping.

---

### Pitfall 5: Context Window Overflow — Agent Accumulates Too Much History

**What goes wrong:**
A ReAct agent loop with tools passes the entire conversation history (system prompt + all prior reasoning steps + all tool results) to the LLM on every iteration. At Ollama qwen3.5:35b with a 32k context window, this exhausts the budget quickly: system prompt (~2k tokens) + RAG context (2–4 retrieved chunks × 2000 tokens = 4–8k tokens) + 5 reasoning steps × 500 tokens = ~14k tokens after 5 iterations. At iteration 8, the context exceeds 32k — Ollama silently truncates from the beginning, losing the original user intent and all early tool results. The model then produces nonsensical output or loops.

"Lost in the middle" effect compounds this: even when content fits, LLMs weigh the beginning and end more heavily. Critical context injected in the middle of a long agent history is under-attended.

**Why it happens:**
Developers build the initial agent loop by concatenating messages without a token budget. The first 10 test queries work fine (short tool results). The failure appears only when a tool returns a long document or the agent requires many steps for a complex legal task.

**How to avoid:**
- Implement a **token budget manager**: before each LLM call, measure total tokens using `tiktoken` (or a rough char-to-token estimate: 4 chars ≈ 1 token for German). If projected tokens > 24k (75% of qwen3.5:35b 32k window), truncate the oldest tool result entries from the middle of history, preserving the first message (user intent) and the last 2 tool results (recent context).
- Cap individual tool results: if a tool returns >2000 tokens, truncate and summarize: return the first 1500 tokens + "… [gekürzt, {N} weitere Zeichen]."
- For background scanner agents (nightly jobs), process each Akte independently — never accumulate context across Akten. Each Akte scan is a fresh agent context.
- Log token count at each agent step. Alert when any step's context exceeds 20k tokens.

**Warning signs:**
- Agent output quality drops noticeably on queries requiring >6 tool calls.
- Ollama returning shorter-than-expected responses on long agent runs — context truncation.
- Agent "forgetting" the original user question in its final answer after many steps.
- BullMQ job memory consumption growing linearly with agent iteration count.

**Phase to address:** Phase 1 (agent foundation). Token budget manager must be part of the base agent executor, not a later addition.

---

### Pitfall 6: Background Scanner Cost Explosion — Nightly LLM Scan Over All Akten

**What goes wrong:**
A nightly scanner that calls the LLM for each Akte in the database scales linearly with case count. At 200 Akten × 3 documents per Akte × 1500 tokens per document = 900k input tokens per night. At Ollama (free, GPU-bound) this is viable but occupies the GPU for hours, blocking interactive Helena use until 6am. If the kanzlei switches to cloud LLM (OpenAI gpt-4o-mini) for performance, 900k tokens/night at $0.15/1M tokens = $0.135/night — negligible. But if the scan accidentally sends full document content (not summaries) to a cloud LLM, and those documents contain Mandant personal data, this triggers a DSGVO data processor agreement breach — not a cost issue but a regulatory one.

The second cost explosion: false positive alerts. If the scanner produces 50 alerts per night and each alert triggers an email + a BullMQ notification job, the signal-to-noise ratio collapses. Anwälte stop reading alerts within a week, defeating the purpose.

**Why it happens:**
Developers implement the scanner as a BullMQ cron job that iterates all active Akten without scope filtering. The alert threshold is too low ("any change detected = alert"). The cloud LLM fallback is enabled globally, including for Akte document content.

**How to avoid:**
- **Scope filter**: scan only Akten with activity in the last 7 days (new documents, new emails, new calendar entries). Most legal cases are dormant — scanning them nightly is wasteful.
- **Summary-only scan**: the scanner sends only the Akte metadata + a pre-computed 200-token summary (cached in the `akte_summary` table, updated on document change), not full document content to the LLM.
- **DSGVO guard on cloud LLM**: the scanner must use Ollama only when processing content from `document_chunks` (client Akte data). Cloud LLM is permitted only for `law_chunks` and `urteil_chunks` (public data). Hard enforce this in the provider selection logic.
- **Alert deduplication**: an alert for a given Akte+AlertType combination is suppressed if the same alert was sent within the last 48 hours.
- **Alert throttle per run**: cap the nightly scanner at 10 alerts per run. Log the rest as "suppressed — over daily threshold." This forces alert quality to improve.
- Monitor nightly scan duration via BullMQ job completion timestamps. Alert the admin if a nightly scan takes >2 hours — signals scope has grown too large.

**Warning signs:**
- Nightly BullMQ scan jobs occupying the worker from 2am–8am, blocking morning Helena queries.
- Alert inbox volume growing faster than case count — threshold too low.
- Ollama GPU memory at 100% at 6am when users start work — scanner not finished.
- `SELECT COUNT(*) FROM helena_alerts WHERE "createdAt" > NOW() - INTERVAL '24h'` returns >50 — alert explosion.

**Phase to address:** Phase 3 (Background scanner). Scope filter and alert dedup must be designed before implementation. Monitor nightly runtime in staging before production deploy.

---

### Pitfall 7: Agent Memory and DSGVO — Per-Case AI Summaries as Personal Data Processing

**What goes wrong:**
Helena's per-case AI summaries (`akte_summary` table) contain synthesized personal data: party names, claim amounts, procedural history, attorney assessments. Under DSGVO Art. 4(2), generating these summaries is "processing" of personal data. Three compliance failures: (1) No `Verarbeitungsverzeichnis` (Article 30 processing record) entry for AI summary generation. (2) Summaries persist beyond the case retention period (10-year GoBD obligation applies to case files; AI summaries are derivative — retention period is unclear). (3) A DSGVO Art. 15 data subject access request requires providing all stored data about a person, including AI-generated summaries that mention them — this is rarely implemented.

**Why it happens:**
Developers treat AI summaries as ephemeral cache (not "real data"), so they do not apply the same compliance discipline as to primary case records. The summary is stored in PostgreSQL but excluded from the DSGVO anonymization tool that already handles `akte` and `kontakt` records.

**How to avoid:**
- Add `akte_summary` to the Verarbeitungsverzeichnis with: purpose (legal case management), legal basis (Art. 6(1)(b) — contract performance), retention period (same as parent Akte, 10 years minimum for GoBD), and the Ollama-self-hosted processing note (no data leaves the premises).
- Extend the existing DSGVO anonymization tool (already in the system) to cover `akte_summary`: when an Akte is anonymized or deleted, the corresponding summary must be anonymized or deleted.
- Link `akte_summary.akteId` with `ON DELETE CASCADE` to ensure summaries are deleted when the parent Akte is deleted.
- For the Art. 15 data subject access request PDF export (already implemented), query `akte_summary` for the data subject's Akten and include a section "KI-generierte Fallzusammenfassungen."
- Stale summary detection: if a summary's `updatedAt` is >30 days older than the Akte's last `updatedAt`, mark it `STALE` and re-generate on next access — do not serve outdated summaries to the agent as context.

**Warning signs:**
- `SELECT a.id FROM akte_summary a LEFT JOIN akte ak ON a."akteId" = ak.id WHERE ak."deletedAt" IS NOT NULL AND a.id IS NOT NULL` returns rows — summaries orphaned after Akte deletion.
- DSGVO Auskunft PDF export does not include any AI summary content.
- `akte_summary.updatedAt` timestamps months behind the Akte's last document upload.
- No `Verarbeitungsverzeichnis` entry for "Helena AI Fallzusammenfassung."

**Phase to address:** Phase 3 (Agent memory). DSGVO compliance for summaries must be addressed before the first summary is generated in production.

---

### Pitfall 8: BullMQ Agent Jobs — Stalled Jobs and Missing AbortSignal Propagation

**What goes wrong:**
BullMQ marks a job "stalled" when it does not call `job.updateProgress()` or complete within `stalledInterval` (default: 30s). A long-running agent job (e.g., a nightly Akte scan with 5 tool calls at ~3s each = 15s minimum, plus LLM inference) exceeds 30s without progress updates and gets re-queued. The same agent job then runs twice concurrently, creating duplicate alerts and duplicate document drafts.

Second failure: when a BullMQ worker shuts down (Docker restart, graceful shutdown), active agent jobs receive a `SIGTERM`. Without an `AbortController` signal propagated to the in-flight Ollama call, the Ollama request completes after the worker exits, the response is lost, and the job is marked failed without partial results saved.

**Why it happens:**
BullMQ's `stalledInterval` is not configured for long-running jobs. The existing worker handles fast OCR jobs (30s typical) — the stalledInterval was set for those. Agent jobs are a different profile. `AbortSignal` propagation was added to Vercel AI SDK but is not wired to BullMQ's shutdown signal by default.

**How to avoid:**
- Call `job.updateProgress()` inside the agent loop at every step iteration. This resets the stall timer.
- Set `lockDuration: 120000` (2 minutes) on the BullMQ worker for the `helena-agent` queue specifically. This gives the job 2 minutes before it is considered stalled.
- Wire `AbortController` to BullMQ's graceful shutdown:
  ```typescript
  const controller = new AbortController();
  worker.on('closing', () => controller.abort());
  // Pass controller.signal to streamText / generateText
  ```
- On abort: save partial agent results to the job's `returnValue` before exiting so they can be inspected.
- Use BullMQ's `removeOnComplete: { count: 1000 }` and `removeOnFail: { count: 500 }` to prevent Redis memory from filling with completed agent job payloads (agent jobs store large LLM conversations in `job.data`).
- Set `concurrency: 1` for the `helena-agent` queue on the same Ollama GPU — parallel agent jobs compete for GPU memory and cause Ollama OOM errors.

**Warning signs:**
- BullMQ dashboard showing the same agent job ID in "active" state twice — duplicate execution from stall recovery.
- Duplicate calendar entries or duplicate alert emails for the same Akte — stalled job ran twice.
- Redis memory growing steadily — large job payloads accumulating.
- Worker restart causing Ollama to continue processing a request for a job that no longer has a waiting worker.

**Phase to address:** Phase 1 (BullMQ agent queue setup). Queue configuration must be separate from the existing OCR/email queues.

---

### Pitfall 9: Activity Feed Performance — N+1 Queries and Real-Time Flood

**What goes wrong:**
An Activity Feed that shows all agent actions across all Akten in real time creates two performance problems: (1) Database N+1: each activity event requires a separate query for the referenced entity (Akte name, document title, user name). With 50 events in the feed, this is 50+1 DB queries per page load. (2) Socket.IO event flood: a nightly scanner running on 200 Akten emits 200+ `helena:activity` events in rapid succession. Each connected browser client re-renders the feed 200 times, causing UI jank and potential React state update floods.

**Why it happens:**
Activity feeds are typically prototyped with a simple `activity.findMany()` + relation includes. The include-based approach in Prisma hides the fact that each included relation is a separate SQL query under the hood unless explicitly joined. Socket.IO events are emitted per-job-completion without batching.

**How to avoid:**
- Use a single Prisma query with explicit `include` for `akte`, `dokument`, `user` — Prisma will JOIN, not N+1, when using nested `include` correctly. Verify with `DEBUG=prisma:query` that the feed query issues ≤3 SQL statements.
- Add a **composite index** on `(akteId, createdAt DESC)` on the `helena_activity` table for Akte-scoped feed queries.
- Paginate the feed: default to 20 events, infinite scroll for more. Never load >100 events at once.
- **Batch Socket.IO emissions**: the nightly scanner collects all events and emits a single `helena:activityBatch` event with an array after each Akte completes, not one event per action. The frontend processes the batch in one React state update.
- **RBAC filter on Socket.IO**: a user must only receive `helena:activity` events for Akten they have read access to. Implement this via Socket.IO rooms keyed to Akte ID, not broadcast-to-all.
- Add a `helena_activity.ttl` field and a weekly cleanup job: delete activity events older than 90 days. Legal audit-relevant actions go to `audit_log` (permanent), not `helena_activity` (transient UX).

**Warning signs:**
- `DEBUG=prisma:query` showing 51 SQL statements for loading a 50-event feed — N+1 present.
- Browser DevTools showing 200 incoming Socket.IO frames within 10 seconds during a nightly scan — unthrottled emission.
- Activity feed visibly re-rendering dozens of times per second during scanner runs — state update flood.
- Redis memory spike during nightly scan — Socket.IO adapter broadcasting large event payloads.

**Phase to address:** Phase 4 (Activity Feed). DB query plan must be verified before UI ships. Socket.IO batching must be in the scanner from day one.

---

### Pitfall 10: QA Evaluation — Goodhart's Law and Gold Set Bias

**What goes wrong:**
Building a QA evaluation set ("gold standard") of 50 Helena queries with expected answers to measure recall and precision. Three failure modes: (1) **Goodhart's Law**: once the gold set becomes the optimization target, prompt engineering over-fits to it. Helena achieves 90% recall on the gold set but regresses on real Anwalt queries that differ in phrasing. (2) **Gold set bias**: if the gold set is built from the same documents that were used to build the RAG index, the evaluation is circular. A query whose answer is in the index will score well regardless of retrieval quality. (3) **Metric mismatch**: optimizing for retrieval recall (does the correct chunk appear in the top-10?) does not measure whether the generated answer is legally correct. A chunk can be retrieved correctly but the LLM can still hallucinate the answer.

**Why it happens:**
QA evaluation for RAG is taken from IR (information retrieval) literature where "correct document retrieved" is the success metric. Legal AI needs a different metric: "legally accurate answer generated." These are different things and require different evaluation approaches.

**How to avoid:**
- **Separate gold set sources**: the gold set queries must reference documents NOT used to calibrate the ingestion pipeline. Use Akten from the previous 3 months that the developers have not read during development.
- **Two-metric system**: measure (a) retrieval quality: MRR@10 on the gold set, and (b) answer quality: human review of generated answers by the Anwalt (or a legal practitioner), not the developer. Target: 100% of gold set answers reviewed by a non-developer.
- **Adversarial queries**: include 10 queries where the correct answer is "Ich habe keine ausreichende Information, um das zu beantworten." Measure whether Helena hallucinates an answer (false positive) vs. correctly refusing.
- **Rotate the gold set**: replace 20% of gold set queries each quarter with new queries from real Anwalt sessions. This prevents over-fitting.
- **Separate evaluation from development**: the developer who implements a feature should not evaluate it on the gold set they built. Have the Anwalt (end user) run the evaluation.

**Warning signs:**
- Gold set recall metric improves consistently while real Anwalt satisfaction scores do not — over-fitting.
- All gold set queries are in the same legal domain (e.g., all Arbeitsrecht) — domain bias.
- No adversarial "I don't know" queries in the gold set — hallucination not measured.
- Developer runs gold set evaluation after every prompt change — Goodhart's law in action.

**Phase to address:** Phase 5 (QA evaluation framework). Gold set must be reviewed and approved by the Anwalt before any metric is used as a success criterion.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| No iteration cap on ReAct loop | Simpler initial implementation | Infinite loops in production, BullMQ worker starvation | Never — iteration cap is day-one requirement |
| Agent tools calling Prisma directly (bypassing HTTP API) | Less boilerplate | Bypasses middleware (ENTWURF guard, RBAC, audit logging) | Never for document-creating tools |
| Global cloud LLM for all agent calls including Akte document content | Better answer quality | DSGVO data processor agreement required; client data to cloud provider | Only if a DSGVO-compliant DPA with provider is signed |
| Nightly scan with no scope filter (all Akten) | Complete coverage | GPU occupied 4–8h nightly, blocks interactive use | Prototype only — add scope filter before production |
| Gold set built from same documents as RAG index | Fast evaluation setup | Circular evaluation, metric does not reflect real quality | Prototype only — use separate held-out documents |
| Single BullMQ concurrency for all queues (OCR + agent + email) | Simple queue setup | Agent jobs starve OCR/email processing; agent GPU + OCR GPU conflict | Never — separate concurrency settings per queue type |
| Activity feed without RBAC Socket.IO room filter | Simpler socket logic | Users see other Anwälte's Akte activity — confidentiality breach | Never |
| Agent memory (akte_summary) excluded from DSGVO anonymization | Less code to write | DSGVO Art. 17 right to erasure not honored | Never — include in anonymization from the start |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Vercel AI SDK v4 + Ollama tool calls | Trusting that Ollama returns tool calls in the correct format; not validating response structure | Always validate the response: check `response.toolCalls` array exists and is non-empty before processing. Fall back to text-mode ReAct if `toolCalls` is empty despite model reasoning about a tool |
| BullMQ + long-running Ollama calls | Not propagating `AbortSignal` to Ollama fetch; job stalls on worker shutdown | Wire `AbortController` to both BullMQ `worker.on('closing')` and the `streamText`/`generateText` `abortSignal` parameter |
| Socket.IO + Activity Feed RBAC | Broadcasting `helena:activity` events to all connected clients | Join clients to per-Akte Socket.IO rooms on login. Emit only to rooms the user belongs to based on their Akte access permissions |
| BullMQ + agent job stall detection | Using the default `stalledInterval: 30000` for agent jobs that take >30s | Set `lockDuration: 120000` per-worker for the `helena-agent` queue. Call `job.updateProgress(step)` inside the agent loop on every iteration |
| Prisma + agent-created documents | Agent tool calling `prisma.dokument.create()` directly | Agent tools must call the internal service function that enforces `status: 'ENTWURF'` and fires the audit log event, not raw Prisma |
| DSGVO + akte_summary table | Treating AI summaries as non-personal-data cache | Include in Verarbeitungsverzeichnis, anonymization pipeline, and Art. 15 data subject access export |
| Goodhart's Law + QA gold set | Using retrieval recall as the sole quality metric | Require human (Anwalt) review of generated answers as the primary quality gate; use retrieval MRR as a secondary signal only |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| ReAct loop with no token budget | Agent quality degrades after 5+ iterations; final answer ignores early context | Token budget manager: truncate oldest tool results when approaching 75% of context window | At iteration 6+ with large tool results (>500 tokens each) |
| Activity feed N+1 queries | Feed page load >2s; DB connection pool exhausted under moderate load | Single Prisma query with nested `include`; verify with `DEBUG=prisma:query` | At >20 events per feed load |
| Nightly scanner over all Akten (no scope filter) | GPU occupied 4–8h; morning interactive use degraded | Scope to Akten with activity in last 7 days; summary-only scan | At >100 Akten in the database |
| Agent job concurrency > 1 on single Ollama GPU | Ollama OOM errors; first job runs but second job fails immediately | `concurrency: 1` for `helena-agent` queue; secondary queue for lower-priority scans | Any time 2 agent jobs run simultaneously |
| No progress calls in long agent jobs | BullMQ stall recovery re-queues job; duplicate execution | `job.updateProgress(stepN)` at each agent iteration | After 30s without progress update (BullMQ default stalledInterval) |
| Socket.IO event flood during nightly scan | Browser client re-renders 200+ times; UI freeze for active users | Batch events; emit `helena:activityBatch` once per Akte, not per action | When nightly scan processes >20 Akten |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Cloud LLM receiving `document_chunks` content | DSGVO data processor agreement breach; client confidentiality under BRAO §43a | Hard enforce: if LLM provider is not Ollama AND query includes `document_chunks`, reject with error and redirect to Ollama |
| Agent creating documents without `status: 'ENTWURF'` | KI-generierter Inhalt versendet ohne Anwaltskontrolle — BRAK 2024 KI-Leitfaden violation; BRAO §43 breach | Prisma middleware asserting `status = 'ENTWURF'` on every document create. Agent tools go through HTTP API, not raw Prisma |
| Activity Feed without RBAC filter | User sees Akte activity from cases they have no access to — attorney-client confidentiality breach | Socket.IO room-based RBAC; verify room membership against Akte access permissions on every join |
| akte_summary not covered by Art. 17 erasure | DSGVO right to erasure not honored for AI-generated summaries | `ON DELETE CASCADE` from `akte` to `akte_summary`; include in anonymization routine |
| Stale agent memory used as context | Agent acts on outdated case summary — wrong §-deadlines, wrong party status, wrong case outcome | Staleness check: if `akte_summary.updatedAt < akte.updatedAt - 30 days`, mark stale and regenerate before using as context |
| No audit log for agent actions | Cannot demonstrate to BRAK/Rechtsanwaltskammer which actions Helena took autonomously | Every agent tool invocation writes an `audit_log` entry with `actor: 'helena-agent'`, `action`, `akteId`, `timestamp`, and the tool's arguments |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No disclaimer on agent-generated drafts | Anwalt may mistake agent draft for approved document; professional liability | Permanent "KI-Entwurf — nicht freigegeben" banner on every agent-created document; non-dismissable until Anwalt explicitly approves |
| Agent running silently in background with no status | Anwalt does not know if Helena is working or stalled; opens a ticket "Is the system broken?" | Real-time progress indicator via Socket.IO: "Helena analysiert Akte ... (Schritt 3/5)" during agent execution |
| Alert inbox flooded with false positives | Anwalt stops reading alerts within 3 days; important alerts missed | Alert deduplication + throttle (max 10/night). Allow Anwalt to set alert sensitivity per Rechtsgebiet |
| Activity Feed showing helena-agent actions mixed with human actions without visual distinction | Anwalt cannot tell which actions were autonomous vs. human-initiated | Visual differentiation: helena-agent actions have a distinct robot icon + blue accent; human actions use standard user avatar |
| Agent tool error returned as legal content | Anwalt receives a JSON error object or stack trace in the middle of a Schriftsatz draft | All agent tool errors must be caught and converted to user-readable German: "Helena konnte Dokument X nicht erstellen: [reason]" |
| QA evaluation score shown to Anwalt as "Helena accuracy: 87%" | Anwalt trusts agent output without review; Goodhart metric misrepresents real quality | Never show internal evaluation metrics to end users. Show instead: "Quellennachweis: X von Y Zitaten verifiziert" — a transparent, per-response metric |

---

## "Looks Done But Isn't" Checklist

- [ ] **ReAct Loop Cap:** Often missing the stall detector — verify agent loop aborts on 3 consecutive identical tool calls, not just on `maxIterations`.
- [ ] **Ollama Tool Call Format:** Often missing the response type guard — verify `response.toolCalls` is validated after every LLM call; deploy a smoke test that calls each tool through the full Ollama stack.
- [ ] **ENTWURF Gate for Agent Documents:** Often missing the Prisma middleware guard — query `SELECT status FROM dokument WHERE "createdBy" = 'helena-agent'` and assert all rows have `status = 'ENTWURF'`.
- [ ] **§-Reference Post-Verification:** Often missing — verify the agent's `execute` function runs regex extraction + `law_chunks.normReference` lookup on every generated draft before returning to the user.
- [ ] **BullMQ AbortSignal Wiring:** Often missing — verify that stopping the Docker worker container causes the in-flight Ollama call to be cancelled (not continued until completion), confirmed by Ollama server logs.
- [ ] **DSGVO akte_summary Coverage:** Often missing — verify `DELETE FROM akte WHERE id = $id` also deletes the corresponding `akte_summary` row (test with explicit cascade test).
- [ ] **Activity Feed RBAC:** Often missing — verify that user B cannot receive `helena:activity` Socket.IO events for Akte that user B does not have read access to.
- [ ] **Nightly Scanner Scope Filter:** Often missing — verify BullMQ cron job processes only Akten with `updatedAt > NOW() - INTERVAL '7 days'`; confirm with job logs showing Akte count processed.
- [ ] **Alert Deduplication:** Often missing — trigger the same alert condition twice; verify only one alert email is sent within the 48h suppression window.
- [ ] **Audit Log for Agent Actions:** Often missing — run an agent tool, then query `SELECT * FROM audit_log WHERE actor = 'helena-agent'` and verify the entry exists with correct `akteId` and `action`.
- [ ] **Gold Set Independence:** Often missing — verify that gold set queries reference Akten from a date range not used during RAG index calibration.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Agent infinite loop fills BullMQ queue | MEDIUM | Emergency: set `concurrency: 0` on `helena-agent` worker to drain. Delete stuck jobs from BullMQ dashboard. Deploy iteration cap hotfix. Restore concurrency. |
| Agent document sent without ENTWURF status | HIGH | Notify Anwalt immediately. Revoke document in beA if possible. Audit all agent-created documents since the bug was introduced. Patch Prisma middleware same day. Assess BRAO disciplinary exposure. |
| Cloud LLM received Akte personal data | HIGH | Revoke API key immediately. Audit cloud provider logs for data exposure. Assess DSGVO Art. 33 72-hour breach notification obligation. Re-deploy with hard Ollama-only guard for Akte content. |
| akte_summary contains data of deleted Akte | MEDIUM | `DELETE FROM akte_summary WHERE "akteId" NOT IN (SELECT id FROM akte)`. Add `ON DELETE CASCADE`. Assess if deleted subject's summary was served to the agent — if yes, DSGVO Art. 17 violation logged. |
| Nightly scanner causes GPU starvation all morning | LOW | Temporarily disable scanner cron. Add scope filter (active Akten only). Re-enable with monitoring of nightly runtime. |
| Activity Feed N+1 causing DB connection pool exhaustion | MEDIUM | Feature-flag: disable real-time feed, fall back to polling every 30s. Fix Prisma query to use nested include. Re-enable WebSocket feed after fix. |
| Gold set over-fitted — Helena regresses on real queries | MEDIUM | Rebuild gold set from new Anwalt sessions. Revert prompt engineering changes made against old gold set. Re-run evaluation with new set. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Infinite ReAct loop | Phase 1: Agent foundation | Integration test: trigger tool that always returns "not done" → assert agent aborts at maxIterations |
| Ollama tool call format | Phase 1: Ollama integration | Smoke test: each tool invoked via full Ollama stack in test environment |
| ENTWURF bypass in agent tools | Phase 2: Document creation tools | Query `dokument WHERE "createdBy"='helena-agent'` after integration test; assert all ENTWURF |
| Legal hallucination / §-reference | Phase 2: Schriftsatz draft tool | Post-generation §-verification runs on every test draft; 0 unverified references accepted |
| Context window overflow | Phase 1: Agent foundation | Token budget manager tested with 10-step agent run containing large tool results |
| Background scanner cost | Phase 3: Nightly scanner | Nightly runtime in staging < 90 minutes; alert count < 10 per run |
| akte_summary DSGVO | Phase 3: Agent memory | Cascade delete test; Verarbeitungsverzeichnis entry created before first production summary |
| BullMQ stalled agent jobs | Phase 1: Queue configuration | AbortSignal propagation test; stall timer set to 120s; progress calls verified in loop |
| Activity Feed N+1 | Phase 4: Activity Feed UI | `DEBUG=prisma:query` shows ≤3 SQL statements for 20-event feed load |
| QA gold set bias | Phase 5: QA evaluation | Gold set sources documented; Anwalt review of 100% of generated answers confirmed |

---

## Sources

- [BRAK Leitfaden KI-Einsatz in der Kanzlei (December 2024, official PDF)](https://www.brak.de/fileadmin/service/publikationen/Handlungshinweise/BRAK_Leitfaden_mit_Hinweisen_zum_KI-Einsatz_Stand_12_2024.pdf)
- [Stanford HAI: Hallucination-Free? Legal AI Tools Hallucinate 17–33% (2025, peer-reviewed)](https://law.stanford.edu/wp-content/uploads/2024/05/Legal_RAG_Hallucinations.pdf)
- [Ollama Issue #11135: Qwen3 Tool Call Hallucination](https://github.com/ollama/ollama/issues/11135)
- [Ollama Issue #11662: Issues calling tools with qwen3:32b](https://github.com/ollama/ollama/issues/11662)
- [BullMQ Official Docs: Timeout Jobs](https://docs.bullmq.io/patterns/timeout-jobs)
- [BullMQ Official Docs: Stalled Jobs](https://docs.bullmq.io/guide/workers/stalled-jobs)
- [Vercel AI SDK: Stopping Streams + abortSignal](https://ai-sdk.dev/docs/advanced/stopping-streams)
- [EDPB: AI Privacy Risks and Mitigations in LLMs (April 2025)](https://www.edpb.europa.eu/system/files/2025-04/ai-privacy-risks-and-mitigations-in-llms.pdf)
- [IAPP: Engineering GDPR Compliance in Agentic AI (2025)](https://iapp.org/news/a/engineering-gdpr-compliance-in-the-age-of-agentic-ai)
- [Redis: Context Window Overflow (2026)](https://redis.io/blog/context-window-overflow/)
- [Factory.ai: The Context Window Problem — Scaling Agents Beyond Token Limits](https://factory.ai/news/context-window-problem)
- [LangChain Forum: Tool-calling agent infinite loop patterns](https://community.latenode.com/t/tool-calling-agent-enters-infinite-loop-with-custom-function/34439)
- [Goodhart's Law in AI Evaluation — Collinear AI (2025)](https://blog.collinear.ai/p/gaming-the-system-goodharts-law-exemplified-in-ai-leaderboard-controversy)
- Project context: `/Users/patrickbaumfalk/Projekte/AI-Lawyer/.planning/PROJECT.md` (AI-Lawyer v3.5 + v0.1 Helena RAG milestone)

---

*Pitfalls research for: Helena Agent v2 — autonomous agent capabilities added to existing AI-Lawyer*
*Researched: 2026-02-27*
