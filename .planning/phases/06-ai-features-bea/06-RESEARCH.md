# Phase 6: AI Features + beA -- Research

**Created:** 2025-02-25
**Purpose:** Everything the planner needs to write implementation plans for Phase 6
**Scope:** REQ-KI-002 through REQ-KI-012, REQ-BA-001 through REQ-BA-006

---

## 1. What Exists Today (Codebase Inventory)

### 1.1 AI Infrastructure (Phase 4 built)

**Embedding pipeline (working, in worker.ts):**
- `src/lib/embedding/chunker.ts` -- German legal text splitter using `@langchain/textsplitters` RecursiveCharacterTextSplitter (1000 chars, 200 overlap, German legal section separators: Tenor, Tatbestand, Entscheidungsgruende, Gruende)
- `src/lib/embedding/embedder.ts` -- Ollama embedding via `blaifa/multilingual-e5-large-instruct` (1024 dimensions). E5 instruction format: `passage: ` prefix for documents, `query: ` prefix for search. Batch processing (5 at a time). Graceful skip when Ollama unavailable.
- `src/lib/embedding/vector-store.ts` -- pgvector CRUD: `insertChunks()`, `deleteChunks()`, `searchSimilar()` (cosine similarity with HNSW index), `getEmbeddingStats()`. Search is Akte-scoped by default.
- `src/lib/queue/processors/embedding.processor.ts` -- BullMQ job: check Ollama -> chunk -> embed -> store. Concurrency: 1.

**Prisma models:**
- `DocumentChunk` -- id, dokumentId, chunkIndex, content (text), embedding (vector(1024)), modelVersion, createdAt. HNSW index on embedding. Akte-scoped via JOIN to Dokument.
- `AiConversation` -- id, akteId (nullable), userId, titel, messages (Json array of {role, content, timestamp}), model, tokenCount. Exists but unused.
- `ChatNachricht` -- id, akteId, userId (null = AI-generated), nachricht (text), bezugDokumentId. Currently used for AI-generated drafts.
- `BeaNachricht` -- id, akteId, nachrichtenId (unique external ID), betreff, absender, empfaenger, inhalt, status (EINGANG/GELESEN/ZUGEORDNET/GESENDET/FEHLER), pruefprotokoll (Json), anhaenge (Json), gesendetAm, empfangenAm.

**OpenClaw API routes (existing, token-authenticated):**
- `POST /api/openclaw/process` -- Triggers processing of ai:-tagged tickets. Checks Ollama health first. Max 20 tasks per run.
- `GET /api/openclaw/process` -- Health/status: Ollama availability + pending AI task count.
- `GET /api/openclaw/tasks` -- List ai:-tagged tickets with filters.
- `GET/PATCH /api/openclaw/tasks/[id]` -- Read/update single ai:-tagged task.
- `POST /api/openclaw/drafts` -- Create AI draft (writes ChatNachricht with userId=null).
- `POST /api/openclaw/notes` -- Create AI case note (ChatNachricht, userId=null).
- `GET /api/openclaw/akten/[id]/context` -- Read case context for AI (metadata, parties, document list, open calendar entries). Excludes ocrText for performance.

**AI task processing (`src/lib/ai/`):**
- `ollama.ts` -- Direct Ollama REST client. `ollamaGenerate()` (stream=false), `ollamaHealthCheck()`. Defaults: mistral:7b, temperature 0.3, 32k context.
- `prompt-templates.ts` -- Template system for 5 actions: summary, draft, check, monitor, auto. German system prompt. `tagToAction()` maps ai:* tags.
- `process-tasks.ts` -- `processTaggedTasks()`: finds open ai:-tagged tickets, acquires lock (atomic updateMany), generates via Ollama, writes ChatNachricht result, marks ERLEDIGT with ai:done tag.

**Auth:**
- `src/lib/openclaw-auth.ts` -- Bearer token validation for OpenClaw endpoints (OPENCLAW_GATEWAY_TOKEN env). Constant-time comparison.
- `src/lib/versand-gate.ts` -- `checkDokumenteFreigegeben()` + `markDokumenteVersendet()`. Enforces FREIGEGEBEN status before any send.

**Document status system:**
- `DokumentStatus` enum: ENTWURF -> ZUR_PRUEFUNG -> FREIGEGEBEN -> VERSENDET
- `erstelltDurch` field on Dokument: "user" | "ai" | "system"
- `freigegebenDurchId` + `freigegebenAm` for approval audit trail

**UI (existing pages):**
- `/ki-entwuerfe` -- Lists AI-generated ChatNachricht (where userId=null). Filter by Akte, date, search. Links to detail. Badges: "KI-Entwurf" + "nicht freigegeben".
- `/bea` -- Stub page ("befindet sich in Entwicklung")
- Sidebar: "KI-Entwuerfe" (Bot icon) and "beA" (Shield icon) already present.

### 1.2 Worker Infrastructure

`src/worker.ts` runs these BullMQ queues:
- test, frist-reminder, email-send, email-sync, document-ocr (concurrency:1), document-preview (concurrency:2), document-embedding (concurrency:1)
- IMAP IDLE connections for email
- Settings subscription via Redis pub/sub
- pgvector extension + HNSW index ensured at startup
- Graceful shutdown for all workers + IMAP + SMTP

### 1.3 Docker Stack

- Ollama in docker-compose with profile `["ai"]` -- requires `docker compose --profile ai up`
- 8GB memory limit for Ollama container
- OLLAMA_URL env on worker: `http://ollama:11434`
- No AI SDK packages installed yet (only `@langchain/core` + `@langchain/textsplitters` for chunking)

### 1.4 NPM Dependencies (AI-relevant)

Currently installed: `@langchain/core@^1.1.27`, `@langchain/textsplitters@^1.0.1`, `pgvector@^0.2.1`
NOT installed: `ai` (Vercel AI SDK), `@ai-sdk/openai`, `@ai-sdk/anthropic`, `ollama-ai-provider`

### 1.5 Settings Infrastructure

`SystemSetting` model with key/value/type/category. `src/lib/settings/service.ts` provides `getSetting()`, `getSettingTyped()`, `getAllSettings()`. Redis pub/sub for live updates to worker.

---

## 2. Research Findings: AI SDK

### 2.1 Version Strategy

The `ai` npm package is currently at v6.x. The project context mentions "Vercel AI SDK v4" due to a zod 3.23.8 lock. Research findings:

- **AI SDK v4.x**: Requires `zod@^3.23.8` (compatible with our lock). Packages: `ai@^4.0`, `@ai-sdk/openai@^1.0`, `@ai-sdk/anthropic@^1.0`.
- **AI SDK v5.x**: Still supports `zod@^3.23.8` but adds zod@4 support. Breaking changes: CoreMessage->ModelMessage, maxTokens->maxOutputTokens, useChat API changes.
- **AI SDK v6.x**: Requires `zod@^3.24.0` or `zod@^4.1.8`. Not compatible with our zod lock.

**Decision required:** Use `ai@^4.0` to maintain zod 3.23.8 compatibility, OR upgrade zod to unlock v5/v6. The v4 API is stable and sufficient for our needs (streaming, multi-provider, structured output). Recommend v4 for safety.

### 2.2 Multi-Provider Architecture

With AI SDK v4:
```
npm install ai @ai-sdk/openai @ai-sdk/anthropic
```

For Ollama, use community provider `ollama-ai-provider-v2`:
```
npm install ollama-ai-provider-v2
```

Provider switching pattern:
```typescript
import { createOllama } from 'ollama-ai-provider-v2';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

// Factory based on SystemSetting
function getModel() {
  const provider = getSetting('ai.provider'); // 'ollama' | 'openai' | 'anthropic'
  switch (provider) {
    case 'ollama': return createOllama({ baseURL: ollamaUrl })('mistral:7b');
    case 'openai': return createOpenAI({ apiKey })('gpt-4o');
    case 'anthropic': return createAnthropic({ apiKey })('claude-sonnet-4-20250514');
  }
}
```

### 2.3 Streaming Support

AI SDK v4 provides `streamText()` for token-by-token streaming. Next.js API route pattern:
```typescript
import { streamText } from 'ai';
export async function POST(req) {
  const result = streamText({ model: getModel(), messages, system });
  return result.toDataStreamResponse();
}
```

Client-side with `useChat` hook from `@ai-sdk/react`:
```typescript
const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
  api: '/api/ki-chat',
  body: { akteId },
});
```

### 2.4 Structured Output

AI SDK v4 supports `generateObject()` for typed responses:
```typescript
const { object } = await generateObject({
  model,
  schema: z.object({ deadlines: z.array(deadlineSchema) }),
  prompt: `Extract deadlines from: ${text}`,
});
```

This is critical for deadline/party extraction in the proactive agent.

### 2.5 Impact on Existing Code

The current `src/lib/ai/ollama.ts` (direct fetch to Ollama) must be **replaced** by the AI SDK provider abstraction. The prompt templates in `prompt-templates.ts` can be reused but need adaptation to the AI SDK message format. The `processTaggedTasks()` flow in `process-tasks.ts` should switch from direct Ollama calls to AI SDK calls via the provider factory.

**Migration path:**
1. Install AI SDK + providers
2. Create `src/lib/ai/provider.ts` with factory function reading from SystemSetting
3. Refactor `ollama.ts` -> use AI SDK
4. Keep `src/lib/embedding/embedder.ts` as-is (embedding uses Ollama REST directly, AI SDK embedding API is separate)

---

## 3. Research Findings: beA Integration

### 3.1 bea.expert REST API

**Provider:** be next GmbH (bea.expert)
**Pricing:** EUR 10/month per lawyer mailbox (monthly) or EUR 7/month (yearly). EUR 70/month for firm-wide mailbox.
**License model:** Per SAFE-ID activation.

**Authentication flow:**
1. Login process and session key decryption happen **exclusively in the browser** (client-side JavaScript)
2. The software token (beA hardware/software token) stays in the browser and is never transmitted to the server
3. After successful login, session keys for message decryption are obtained
4. The API is stateless -- the application manages session keys independently

**Critical architecture implication:** The bea.expert API requires **browser-side cryptography** for the login and decryption. This means:
- The beA login CANNOT happen server-side (no automated background polling)
- A user must be logged in via browser to retrieve/send beA messages
- Session keys are ephemeral and browser-bound
- This is fundamentally different from IMAP (which runs in the worker process)

**Available functions (~40):**
- `PostboxOverview` -- List all accessible mailboxes
- `FolderOverview` -- List folders in a mailbox
- `GetMessage` -- Retrieve a specific message (with decryption)
- `SendMessage` -- Send a beA message with attachments
- `SaveMessage` -- Save a draft message
- `eEBanswer` -- Send electronic acknowledgment of receipt
- `MoveMessage` -- Move message between folders
- `DeleteMessage` -- Delete a message

**Client libraries:** JavaScript (open source on GitLab), PHP, Python. JavaScript library: `bea.expert_api.js`. GitHub repo archived May 2025, likely moved to GitLab at `gitlab.com/beaexpert/`.

**Demo application:** `app.bea.expert` (web app showing folder overview using software token).

### 3.2 beA Integration Architecture

Given the browser-only authentication requirement, the beA integration must work differently from email:

```
User Action Flow:
1. User navigates to /bea
2. Frontend loads bea.expert JS library
3. User authenticates with software token (browser-side)
4. Browser receives session keys
5. Browser calls bea.expert REST API endpoints
6. Results displayed in UI
7. Incoming messages saved to BeaNachricht via our API
8. Auto-Zuordnung runs server-side after message is stored
```

**Key difference from email:** No background worker sync. All beA operations are user-initiated from the browser. However, once messages are fetched and stored, Helena can scan them server-side like emails.

### 3.3 beA Data Model (existing Prisma)

The `BeaNachricht` model already has the right shape:
- `nachrichtenId` (unique external beA message ID)
- `akteId` (nullable, for Akte assignment)
- `betreff`, `absender`, `empfaenger`, `inhalt`
- `status` enum: EINGANG, GELESEN, ZUGEORDNET, GESENDET, FEHLER
- `pruefprotokoll` (Json) -- for Pruefprotokoll data
- `anhaenge` (Json) -- for attachment references
- `gesendetAm`, `empfangenAm`

**Missing fields to add:**
- `eebStatus` (eEB sent/pending/not required)
- `eebDatum` (when eEB was acknowledged)
- `xjustizData` (Json, parsed XJustiz content)
- `safeIdAbsender` (sender's SAFE-ID for contact matching)
- `safeIdEmpfaenger` (recipient's SAFE-ID)

### 3.4 SAFE-ID Management

The `Kontakt` model already has a `beaSafeId` field. The UX decision says Safe-IDs are managed on each contact. When sending beA messages, the recipient's SAFE-ID is automatically pulled from the contact record.

---

## 4. Research Findings: XJustiz

### 4.1 Version Status

- **Current valid version:** XJustiz 3.5.1 (as of March 2025)
- **Version 3.6.2** released and available for download
- **Version 3.7** planned for April 30, 2026
- **Version 3.4.1** still supported by parsers (openXJV supports 3.4.1 through 3.6.2)

The CONTEXT.md mentions "XJustiz v3.4.1 Namespaces" but the current standard is 3.5.1. We should support **3.4.1 through 3.5.1** at minimum, as courts may send either version.

### 4.2 XJustiz Structure

XJustiz messages consist of:
- **Grunddaten:** Basic case data (Aktenzeichen, Verfahrensgegenstand, etc.)
- **Instanzen:** Court instances the case has passed through
- **Beteiligte:** Parties involved (names, roles, addresses, SAFE-IDs)
- **Termine:** Hearing dates and deadlines
- **Fachdaten:** Domain-specific data depending on message type

Key namespace pattern: `xjustiz_NNNN` where NNNN is a module number:
- `xjustiz_0005` -- Message envelope (Nachricht)
- `xjustiz_0300` -- Instanzdaten (court instance data)

### 4.3 XJustiz Parser Implementation Strategy

**No existing TypeScript/JavaScript XJustiz parser exists.** Options:

1. **XSLT transformation** (like openXJV's original approach) -- not suitable for React rendering
2. **XML -> JSON parser with namespace awareness** -- recommended approach:
   - Use `fast-xml-parser` (npm, fast, namespace-aware)
   - Build typed interfaces matching XJustiz schema structure
   - Create a `src/lib/xjustiz/parser.ts` that extracts Grunddaten, Instanzen, Beteiligte, Termine
   - Create React viewer components that render the parsed data as structured tables

**Recommended approach:** Hand-built parser targeting the specific XJustiz elements we care about (Grunddaten, Beteiligte, Instanzen, Termine). Full XSD-to-TypeScript generation is overengineered for our needs -- we only need to display the data, not validate it.

### 4.4 Reference Implementation

**openXJV** (Python, maintained): Supports XJustiz 2.4.1 through 3.6.2. Renders Grunddaten, Beteiligte, Instanzen as structured views. XSLT-based transformation with Python backend. Useful as reference for which fields to extract and how to display them.

---

## 5. Research Findings: Embedding Models

### 5.1 Current Setup

Using `blaifa/multilingual-e5-large-instruct` (1024 dimensions) via Ollama. This is a solid choice for multilingual text including German legal text.

### 5.2 Alternatives Considered

| Model | Dimensions | Context | German Quality | Ollama Available |
|-------|-----------|---------|----------------|------------------|
| multilingual-e5-large-instruct | 1024 | 514 tokens | Good | Yes (current) |
| jina-embeddings-v3 | 1024 | 8192 tokens | Better (SOTA multilingual) | No (requires Jina API) |
| bge-m3 | 1024 | 8192 tokens | Good | Yes |
| nomic-embed-text | 768 | 8192 tokens | Fair | Yes |

### 5.3 Recommendation

**Keep multilingual-e5-large-instruct** for Phase 6. It works, embeddings are already stored, and switching would require re-embedding all documents (the `modelVersion` field supports this but it is expensive). The 514-token context limit is mitigated by our 1000-char chunking (roughly 250 German tokens per chunk, well within limit).

If quality issues emerge in document chat, `bge-m3` via Ollama is a drop-in replacement with the same 1024 dimensions and longer context. The `modelVersion` tracking in DocumentChunk makes this safe.

---

## 6. Proactive Agent Architecture

### 6.1 Decision from CONTEXT: Event-Driven

Helena triggers on every new document/email (event-driven), plus periodic scans every 4 hours for stale cases and proactive initiatives.

### 6.2 Implementation Approach

**Event-driven triggers (real-time):**
- OCR completion -> embedding completion -> BullMQ job for AI scan
- Email sync (new email stored) -> BullMQ job for AI scan
- beA message stored -> BullMQ job for AI scan

**Periodic triggers (cron):**
- Every 4 hours: Helena checks active Akten for missing steps, stale cases
- Daily at configurable time: Morning briefing generation per user

### 6.3 New BullMQ Queues Needed

```
ai-scan          -- Triggered by document/email events. Scans one item for deadlines, parties, suggestions.
ai-briefing      -- Daily cron. Generates morning briefing per user.
ai-proactive     -- Every 4 hours. Checks stale cases, suggests next actions.
```

### 6.4 Helena Suggestion Feed

New Prisma model needed:
```prisma
model HelenaSuggestion {
  id          String   @id @default(cuid())
  userId      String   // Target user
  akteId      String?  // Related case
  typ         String   // FRIST_ERKANNT | ANTWORT_ENTWURF | BETEILIGTE_ERKANNT | DOKUMENT_KLASSIFIZIERT | TERMIN_VORSCHLAG | HINWEIS
  titel       String   // Short title
  inhalt      String   @db.Text // Full content / preview
  quellen     Json?    // Source references [{dokumentId, name, passage}]
  status      String   @default("NEU") // NEU | UEBERNOMMEN | ABGELEHNT | BEARBEITET
  feedback    String?  // POSITIV | NEGATIV
  linkedId    String?  // ID of created entity (KalenderEintrag, Dokument, etc.)
  createdAt   DateTime @default(now())
  readAt      DateTime?
}
```

### 6.5 Helena Bot User

Per CONTEXT: Helena has its own User record with avatar. Created during onboarding/seed.
```prisma
// In seed.ts, create:
User { name: "Helena", email: "helena@system.local", role: "SYSTEM", ... }
```
All AI actions attributed to this user in audit trail. ChatNachricht.userId = helenaUserId (instead of null).

### 6.6 Idempotency (REQ-KI-011)

Per requirement: "pro Ticket+Tag max 1 Ergebnis/Tag". Implementation:
- Before processing, check if a HelenaSuggestion with same (akteId, typ, source) exists for today
- Skip if duplicate found
- Retry max 2 times on failure
- Tag with `ai:error` on permanent failure

### 6.7 Security Boundaries (HARD LIMITS)

Code-enforced in the AI provider layer:
1. NEVER call email send endpoints
2. NEVER call beA send endpoints
3. NEVER set DokumentStatus to FREIGEGEBEN or VERSENDET
4. NEVER set KalenderEintrag.erledigt = true
5. NEVER delete any records
6. NEVER modify financial data

Implementation: The provider factory should NOT expose tools for these operations. The existing `versand-gate.ts` already blocks sending non-FREIGEGEBEN documents.

---

## 7. Document Chat Architecture (RAG)

### 7.1 Flow

```
User types question in /ki-chat
  -> POST /api/ki-chat (streaming)
  -> Generate query embedding (Ollama, query: prefix)
  -> searchSimilar() from vector-store.ts (Akte-scoped, top 10)
  -> Filter by confidence threshold (e.g., score > 0.5)
  -> Build context from retrieved chunks
  -> streamText() with AI SDK provider
  -> Stream response with inline source references
  -> Save to AiConversation
  -> Track token usage
```

### 7.2 Source Citations

Format per CONTEXT: Inline numbered references [1], [2]. Below answer: source list with document name + relevant passage, clickable to open document.

Implementation: Instruct LLM in system prompt to cite sources as [1], [2]. Post-process response to link numbers to the retrieved chunks. Return both the streamed text and a `sources` array.

### 7.3 Confidence Threshold

Per CONTEXT: Natural language uncertainty ("Ich bin mir nicht sicher..."), no numeric scores shown. Implementation:
- If highest chunk score < 0.5: LLM receives instruction to express uncertainty
- If no chunks found: Return "Dazu habe ich keine ausreichenden Informationen in den Akten gefunden."

### 7.4 Chat History

Per CONTEXT: Separate chat history per Akte. The `AiConversation` model already supports this (akteId + userId + messages Json array). UI: History grouped by Akte in left sidebar of /ki-chat.

### 7.5 Token Tracking (REQ-KI-008)

New Prisma model:
```prisma
model TokenUsage {
  id        String   @id @default(cuid())
  userId    String
  akteId    String?
  funktion  String   // CHAT | SCAN | ENTWURF | BRIEFING
  provider  String   // ollama | openai | anthropic
  model     String
  tokensIn  Int
  tokensOut Int
  createdAt DateTime @default(now())
}
```

Aggregation for dashboard: SUM by day/week/month, broken down by user and function.

Monthly budget: Store in SystemSetting `ai.monthly_budget_tokens`. At 80% -> warning notification. At 100% -> pause proactive scanning, chat stays on.

---

## 8. Schema Changes Needed

### 8.1 New Models

```
HelenaSuggestion    -- Proactive suggestions feed
TokenUsage          -- Token tracking per request
```

### 8.2 Modified Models

**BeaNachricht** -- Add: eebStatus, eebDatum, xjustizData (Json), safeIdAbsender, safeIdEmpfaenger
**Kanzlei** -- No changes needed (settings via SystemSetting)
**User** -- Add: `isSystem Boolean @default(false)` for Helena bot user

### 8.3 New SystemSettings Keys

```
ai.provider         -- 'ollama' | 'openai' | 'anthropic'
ai.provider.apiKey  -- Encrypted API key for cloud providers
ai.provider.model   -- Selected model name
ai.ollama.url       -- Ollama endpoint URL
ai.monthly_budget   -- Monthly token budget
ai.scan_enabled     -- Boolean, enable/disable proactive scanning
ai.scan_interval    -- Cron expression for periodic scans (default: every 4h)
ai.briefing_enabled -- Boolean
ai.briefing_time    -- Time for daily briefing (default: 07:00)
bea.api_url         -- bea.expert API endpoint
bea.enabled         -- Boolean
```

---

## 9. Risk Analysis

### 9.1 High Risk

| Risk | Mitigation |
|------|------------|
| bea.expert API requires browser-side auth (no background sync) | Document this limitation clearly. beA messages only fetched when user is on /bea page. Once stored, Helena scans them server-side. |
| Ollama + Mistral 7B may produce low-quality German legal text | System prompt engineering + structured output (generateObject) for extraction tasks. Clear "ENTWURF" badges. Lawyer always reviews. |
| Token usage with Ollama is "free" but slow. Users may expect ChatGPT speed. | Set expectations in UI ("Helena denkt nach..."). Show progress indicator. Streaming helps perceived latency. |
| XJustiz parser complexity -- many versions and namespaces | Start with minimal parser (Grunddaten, Beteiligte, Instanzen only). Expand based on actual beA messages received. |

### 9.2 Medium Risk

| Risk | Mitigation |
|------|------------|
| AI SDK v4 may have bugs or missing features vs v6 | v4 is stable, widely used. Core features (streaming, multi-provider) are mature. Can upgrade later. |
| Helena suggestion quality may overwhelm users with noise | Accept/dismiss tracking. Start conservative (high confidence threshold). Tune based on feedback data. |
| beA software token flow may be complex to implement | Use bea.expert JS library directly. Follow app.bea.expert demo. Keep scope minimal for v1. |
| Rate limiting for Ollama (single model, sequential inference) | Queue-based architecture already in place. Concurrency:1 for AI scan queue. |

### 9.3 Low Risk

| Risk | Mitigation |
|------|------------|
| pgvector performance with growing corpus | HNSW index already in place. 1024-dim vectors. Fine for thousands of documents. |
| Embedding model change needed | modelVersion field on DocumentChunk supports safe upgrades. |

---

## 10. Plan Boundaries

### Plan 06-01: Multi-Provider AI Setup + KI-Entwurf Workflow + Rate Limits

**Requirements:** REQ-KI-002, REQ-KI-009, REQ-KI-012

**Scope:**
- Install AI SDK v4 packages: `ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `ollama-ai-provider-v2`
- Create `src/lib/ai/provider.ts` -- Provider factory reading from SystemSetting. Supports ollama (default), openai, anthropic.
- Refactor `src/lib/ai/ollama.ts` to use AI SDK under the hood (keep backward compat for process-tasks.ts initially)
- Create SystemSettings for AI provider configuration (ai.provider, ai.provider.apiKey, ai.provider.model, ai.ollama.url)
- Add Einstellungen page for AI provider selection (Admin-only): dropdown for provider, API key input, model selection, test button
- Create Helena bot user in seed.ts (name: "Helena", isSystem: true, avatar)
- Add `isSystem` field to User model
- Enforce KI-Entwurf workflow: all AI outputs get DokumentStatus.ENTWURF or equivalent. Add badges "KI" + "nicht freigegeben" on AI-generated items. Verify versand-gate blocks non-FREIGEGEBEN sends.
- Rate limiting on /api/openclaw/process (ADMIN only per REQ-KI-012). Add rate-limit middleware.
- Create `TokenUsage` model + tracking middleware that wraps AI SDK calls
- Admin AI dashboard stub (tokens today/week/month, per-user breakdown)
- Graceful degradation: "Helena ist gerade nicht verfuegbar" banner when Ollama/provider is down
- Onboarding wizard stub: Ollama connection test, model selection

**Files to create/modify:**
- NEW: `src/lib/ai/provider.ts`
- NEW: `src/app/(dashboard)/einstellungen/ki/page.tsx`
- NEW: `src/app/api/ki/provider-test/route.ts`
- MODIFY: `prisma/schema.prisma` (TokenUsage model, User.isSystem)
- MODIFY: `prisma/seed.ts` (Helena user)
- MODIFY: `src/lib/ai/ollama.ts` (wrap with AI SDK)
- MODIFY: `src/lib/settings/defaults.ts` (AI settings)
- NEW: `src/lib/ai/token-tracker.ts`

**Estimated complexity:** 3 tasks, ~15 files

### Plan 06-02: RAG Retrieval API + Document Chat UI + Source Citations + Chat History

**Requirements:** REQ-KI-003, REQ-KI-007, REQ-KI-010

**Scope:**
- Create streaming chat API: `POST /api/ki-chat` -- accepts messages + akteId, retrieves relevant chunks via searchSimilar(), builds RAG context, streams response via AI SDK, returns source references
- Create `/ki-chat` page (replacing/merging /ki-entwuerfe):
  - Chat-first layout: big chat area center-stage
  - Akte selector dropdown
  - Conversation history sidebar (grouped by Akte)
  - Quick-action buttons: "Zusammenfassung erstellen", "Fristen pruefen", "Schriftsatz entwerfen", "Beteiligte identifizieren"
  - "Fallzusammenfassung" one-click on Akte detail
  - Token-by-token streaming with `useChat` hook
  - Inline numbered references [1], [2] with source list below
  - Confidence handling: natural language uncertainty
  - Full Markdown rendering (react-markdown)
  - Drag & drop file upload into chat (OCR + embed on the fly)
  - Save AI output: "Als Entwurf speichern" + "Als Dokument speichern"
  - Shareable conversations (copy link)
- AiConversation CRUD: save/load/delete conversations per user per Akte
- Token tracking per chat request
- Redirect /ki-entwuerfe -> /ki-chat (merge old page)
- Update sidebar: rename "KI-Entwuerfe" to "Helena"
- Cmd+K "Helena fragen" integration in Command Palette

**Files to create/modify:**
- NEW: `src/app/api/ki-chat/route.ts` (streaming)
- NEW: `src/app/(dashboard)/ki-chat/page.tsx`
- NEW: `src/app/(dashboard)/ki-chat/[conversationId]/page.tsx`
- NEW: `src/components/ki/chat-layout.tsx`
- NEW: `src/components/ki/chat-messages.tsx`
- NEW: `src/components/ki/chat-input.tsx`
- NEW: `src/components/ki/source-citations.tsx`
- NEW: `src/components/ki/conversation-sidebar.tsx`
- MODIFY: `src/components/layout/sidebar.tsx` (rename KI-Entwuerfe -> Helena)
- MODIFY: `src/lib/embedding/vector-store.ts` (cross-Akte search toggle)
- NEW: `src/app/api/ki-chat/conversations/route.ts`
- NEW: `src/app/api/ki-chat/conversations/[id]/route.ts`

**Estimated complexity:** 3-4 tasks, ~20 files

### Plan 06-03: Proactive Agent (Helena) + Deadline Recognition + Party Recognition

**Requirements:** REQ-KI-004, REQ-KI-005, REQ-KI-006, REQ-KI-008, REQ-KI-011

**Scope:**
- Create `HelenaSuggestion` model in Prisma
- Create BullMQ queues: ai-scan, ai-briefing, ai-proactive
- ai-scan processor: Triggered when new document/email/beA message is stored. Uses AI SDK generateObject() to extract:
  - Deadlines -> creates ENTWURF KalenderEintrag
  - Parties -> suggests Kontakte/Beteiligte
  - Document classification -> suggests tags + DMS folder
  - Response drafts -> creates ChatNachricht draft
- ai-proactive processor: Every 4h cron. Scans active Akten for stale cases, missing steps.
- ai-briefing processor: Daily cron. Generates morning briefing per user. "3 Fristen heute faellig, 2 E-Mails brauchen Antwort..."
- Helena Suggestions feed page: `/helena` (or merged into /ki-chat under a "Vorschlaege" tab)
  - Card-based feed: icon, title, preview excerpt, Akte link
  - Actions: Uebernehmen / Ablehnen / Bearbeiten
  - Daumen hoch/runter feedback
- Notification bell integration for new suggestions
- Inline "KI-Antwort verfuegbar" banner in email detail view
- Helena calendar suggestion integration: suggests Termine (not just Fristen)
- Idempotency enforcement (REQ-KI-011): max 1 result per ticket+day, retry max 2, ai:error tag
- Token usage tracking for all proactive scans
- Monthly budget enforcement: pause scans at 100%, warn at 80%
- Style learning: track accepted/dismissed for prompt tuning (metadata only, no fine-tuning)
- @Helena mention support in Akten threads (future-stub)

**Files to create/modify:**
- MODIFY: `prisma/schema.prisma` (HelenaSuggestion)
- NEW: `src/lib/ai/scan-processor.ts`
- NEW: `src/lib/ai/briefing-processor.ts`
- NEW: `src/lib/ai/proactive-processor.ts`
- NEW: `src/lib/ai/deadline-extractor.ts`
- NEW: `src/lib/ai/party-extractor.ts`
- NEW: `src/app/api/helena/suggestions/route.ts`
- NEW: `src/app/api/helena/suggestions/[id]/route.ts`
- NEW: `src/components/ki/helena-feed.tsx`
- NEW: `src/components/ki/suggestion-card.tsx`
- MODIFY: `src/worker.ts` (register ai-scan, ai-briefing, ai-proactive queues)
- MODIFY: `src/lib/queue/processors/embedding.processor.ts` (trigger ai-scan after embedding)
- MODIFY: email sync processor (trigger ai-scan after new email)

**Estimated complexity:** 4 tasks, ~20 files

### Plan 06-04: beA Integration via bea.expert REST API

**Requirements:** REQ-BA-001, REQ-BA-002, REQ-BA-003, REQ-BA-004, REQ-BA-005, REQ-BA-006

**Scope:**
- Add bea.expert JS library integration (load from CDN or bundle)
- Create beA authentication flow:
  - `/bea` page with login dialog (software token input)
  - Browser-side session key management
  - Session state management in React context
- beA inbox/outbox UI:
  - Message list with status indicators
  - Message detail view with rendered content
  - Auto-assignment to Akten (via Aktenzeichen, Gerichtsbezug, Beteiligte matching)
  - Confirmation dialog when assignment is uncertain
- beA send functionality:
  - Compose form with recipient (SAFE-ID lookup from Kontakte), subject, content
  - Document attachment picker (from DMS, only FREIGEGEBEN documents)
  - RBAC: only ANWALT can send (versand-gate.ts check)
  - No Freigabe-Workflow for beA (direct send per CONTEXT decision)
- eEB (Elektronisches Empfangsbekenntnis):
  - One-click button on incoming Zustellung
  - Sends eEB back with date via eEBanswer API function
  - Update BeaNachricht with eebStatus + eebDatum
- Pruefprotokoll:
  - Button "Pruefprotokoll anzeigen" on each message
  - Renders pruefprotokoll Json as structured view
- SAFE-ID management:
  - Field on Kontakt edit form (already exists: beaSafeId)
  - Auto-pull when composing beA message
- XJustiz parser + viewer:
  - `src/lib/xjustiz/parser.ts` -- Extract Grunddaten, Beteiligte, Instanzen, Termine from XJustiz XML
  - `src/components/bea/xjustiz-viewer.tsx` -- Render parsed data as structured tables
  - Inline viewer in beA message detail for XJustiz attachments
- Extend BeaNachricht model: eebStatus, eebDatum, xjustizData, safeIdAbsender, safeIdEmpfaenger
- Helena integration: after beA message stored, trigger ai-scan (same as email/document)
- beA SystemSettings: bea.api_url, bea.enabled

**Files to create/modify:**
- MODIFY: `prisma/schema.prisma` (BeaNachricht fields)
- NEW: `src/lib/bea/client.ts` (bea.expert API wrapper)
- NEW: `src/lib/bea/session.ts` (browser-side session management)
- NEW: `src/lib/xjustiz/parser.ts`
- NEW: `src/app/(dashboard)/bea/page.tsx` (replace stub)
- NEW: `src/app/(dashboard)/bea/[id]/page.tsx` (message detail)
- NEW: `src/app/(dashboard)/bea/compose/page.tsx` (send form)
- NEW: `src/app/api/bea/messages/route.ts` (CRUD for BeaNachricht)
- NEW: `src/app/api/bea/messages/[id]/route.ts`
- NEW: `src/app/api/bea/messages/[id]/eeb/route.ts`
- NEW: `src/app/api/bea/auto-assign/route.ts`
- NEW: `src/components/bea/bea-inbox.tsx`
- NEW: `src/components/bea/bea-message-detail.tsx`
- NEW: `src/components/bea/bea-compose.tsx`
- NEW: `src/components/bea/xjustiz-viewer.tsx`
- NEW: `src/components/bea/pruefprotokoll-viewer.tsx`
- NEW: `src/components/bea/eeb-button.tsx`
- MODIFY: `src/components/layout/sidebar.tsx` (verify beA position)

**Estimated complexity:** 4 tasks, ~25 files

---

## 11. Requirement Traceability

| REQ-ID | Plan | Key Deliverable |
|--------|------|-----------------|
| REQ-KI-002 | 06-01 | Provider factory with Ollama/OpenAI/Anthropic via AI SDK v4 |
| REQ-KI-003 | 06-02 | Akte-scoped document chat with RAG retrieval |
| REQ-KI-004 | 06-03 | Helena proactive scanning on new documents/emails |
| REQ-KI-005 | 06-03 | Deadline extraction -> ENTWURF KalenderEintrag |
| REQ-KI-006 | 06-03 | Party extraction -> suggested Beteiligte |
| REQ-KI-007 | 06-02 | AiConversation per user per Akte |
| REQ-KI-008 | 06-01 + 06-03 | TokenUsage model + monthly budget + admin dashboard |
| REQ-KI-009 | 06-01 | All AI output = ENTWURF, badges, versand-gate enforcement |
| REQ-KI-010 | 06-02 | Source citations [1][2] with document name + passage |
| REQ-KI-011 | 06-03 | Idempotency per ticket+day, retry max 2, ai:error tag |
| REQ-KI-012 | 06-01 | Rate limits on /api/openclaw/process (ADMIN only) |
| REQ-BA-001 | 06-04 | beA inbox via bea.expert, auto-assign to Akten |
| REQ-BA-002 | 06-04 | beA send with document attachments (ANWALT only) |
| REQ-BA-003 | 06-04 | eEB one-click acknowledgment |
| REQ-BA-004 | 06-04 | Pruefprotokoll viewer |
| REQ-BA-005 | 06-04 | SAFE-ID on Kontakt (already exists, wire to beA compose) |
| REQ-BA-006 | 06-04 | XJustiz parser + inline viewer |

---

## 12. Open Questions for Planner

1. **AI SDK v4 vs v5:** The CONTEXT says "AI SDK v4 wegen zod 3.23.8 Lock". Confirm: should we pin to v4 or is upgrading zod acceptable? (Recommendation: pin v4 for safety, upgrade later)
2. **Helena page vs /ki-chat:** The CONTEXT says merge /ki-entwuerfe into /ki-chat and rename sidebar to "Helena". Should the Helena suggestions feed also live on /ki-chat as a tab, or be a separate page?
3. **beA browser-only auth:** The bea.expert API requires browser-side authentication. This means no background polling for beA messages. Is this acceptable, or should we investigate alternative beA integration approaches?
4. **Ollama model pull:** The docker-compose has Ollama but no model pre-pulled. Should the onboarding wizard handle `ollama pull mistral:7b` automatically, or is this a manual step?
5. **Cross-Akte chat:** The CONTEXT mentions a toggle for cross-Akte queries. This requires searching ALL Akten the user has access to. RBAC filtering in vector search needs implementation -- should this be in 06-02 or deferred?

---

## 13. Dependencies Between Plans

```
06-01 (AI SDK + Provider)
  |
  +---> 06-02 (Document Chat)  -- needs provider factory for streaming
  |
  +---> 06-03 (Proactive Agent) -- needs provider factory for scanning
  |
  +---> 06-04 (beA) -- needs Helena scan integration after message stored

06-02 and 06-03 are independent of each other but both depend on 06-01.
06-04 depends partially on 06-03 (Helena scanning beA messages) but core beA functionality is independent.
```

**Recommended execution order:** 06-01 -> 06-02 -> 06-03 -> 06-04

---

*Research completed: 2025-02-25*
*Researcher: Phase Research Agent*
*Ready for: /gsd:plan-phase*
