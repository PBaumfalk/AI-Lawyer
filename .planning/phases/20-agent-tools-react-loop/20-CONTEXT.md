# Phase 20: Agent Tools + ReAct Loop - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Helena can execute bounded multi-step reasoning with tool calls as a pure TypeScript library testable in isolation — the engine that powers all agent features. Includes 14+ tools (read + write), a ReAct loop with iteration caps, stall detection, token budget management, Ollama response guard, and dual-mode execution (inline vs background). This phase builds the core library; downstream phases (Task-System, Orchestrator, Memory, Activity Feed) consume it.

</domain>

<decisions>
## Implementation Decisions

### Tool Architecture
- **Tiered data access:** Summary tools return compact key fields (ID, title, status, dates, short summary). Separate `_detail` variants return full records. Two separate tool definitions per entity — LLM picks the right one.
- **Tool format:** Vercel AI SDK `tool()` format with Zod schemas for runtime parameter validation
- **Single factory API:** `createHelenaTools({ prisma, userId, akteId })` returns all tool instances with shared context
- **Plugin pattern:** Each tool is a self-contained module (schema + handler + description). Auto-discovered from directory. Adding a tool = create a file.
- **English descriptions:** Tool names and descriptions in English for best LLM comprehension. German domain terms (Akte, Frist, Rechtsgebiet) kept as-is.
- **No tool cap:** Expose all tools to the LLM. No pre-filtering by context.
- **Parallel tool calls:** If the LLM returns multiple tool_calls in one response, execute them concurrently.
- **In-run caching:** Cache tool results by (tool_name, params_hash) for one agent run duration. Saves tokens and avoids redundant DB queries.

### Read Tools (9 + detail variants)
- **read_akte / read_akte_detail:** User-scoped via RBAC — Helena only sees Akten the logged-in user has access to
- **read_dokumente / read_dokumente_detail:** Summary vs full document metadata
- **read_fristen:** All deadlines with status filter parameter (active/past/all)
- **read_zeiterfassung:** Time tracking entries per Akte
- **search_gesetze / search_urteile / search_muster:** Return formatted citation objects (§, Az., Muster title) with relevance scores — not raw chunks
- **get_kosten_rules:** Return structured RVG fee tables with values + calculation rules — Helena can compute costs directly
- **search_alle_akten:** Cross-case search, user-scoped via RBAC
- **search_web:** General web search via search API for current legal info, BGH decisions, etc.

### Write Tools (5 + 1 extra)
- **create_draft_dokument:** Text draft stored as markdown/HTML in database. Rendering to DOCX/PDF happens in approval step via OnlyOffice.
- **create_draft_frist:** Draft deadline proposal
- **create_notiz:** Both Akte-bound AND general notes (no Akte required for cross-case research)
- **create_alert:** Free-form alerts with severity level (info/warning/critical)
- **update_akte_rag:** Both RAG summary enrichment AND select field updates (status, tags, Rechtsgebiet) — all as draft proposals requiring user approval
- **create_draft_zeiterfassung:** Helena can propose time entries as drafts. User approves before they count.
- **All write-tools create drafts/proposals** — never final records directly. Draft appears as rich preview card in Helena chat feed with Approve/Edit buttons.

### Tool Behavior
- **Source attribution:** Every tool result carries source metadata (DB table, RAG chunk, search result) — Helena can cite sources in responses
- **Error handling:** Tool failures return structured error messages as observations. Agent sees them and can reason about recovery. Never crashes the loop.
- **PII filtering:** Applied at a higher layer before tool results enter the ReAct loop context. Tools return raw data, filter strips PII.
- **Audit trail:** Every tool call logged: tool name, parameters, result summary, user, timestamp. Full compliance trail.
- **Rate limiting:** Admin-configurable rate limits per user per hour to prevent abuse and control costs
- **Role-based tool filtering:** ADMIN/ANWALT get all tools. SACHBEARBEITER: all read + limited write. SEKRETARIAT: read-only + create_notiz. PRAKTIKANT: read-only.

### ReAct Loop
- **Stall detection:** If Helena calls the same tool with same params 2+ times, or 3 consecutive steps produce no new information → stall detected
- **Stall action:** Force final answer via injected system message — "Gib jetzt deine beste Antwort mit dem, was du bisher hast."
- **Token budget:** Truncate oldest tool results first when approaching 75% of context window. Keep system prompt, recent results, and user message intact. FIFO.
- **Streaming:** Tool call results streamed to chat as they come in — user sees each observation live, like watching the agent think
- **Global timeouts:** 30s for inline mode, 3min for background mode

### Dual-Mode Execution
- **Mode selection:** Lightweight LLM classifier determines complexity before main agent run — simple → inline (5-step), complex → background (20-step)
- **Inline cap behavior:** When 5-step cap hit, offer to continue in background mode ("Möchtest du, dass ich im Hintergrund weitermache?")
- **Background progress:** Live progress updates in chat: "Schritt 3/20: Durchsuche Gesetze..."
- **Cancel button:** User can abort background tasks. Helena stops and returns partial results.
- **Multi-tasking:** User can keep chatting while background task runs. New messages queue up or start separate inline conversations.
- **Mode indicator:** Subtle badge/icon next to Helena's message showing ⚡ Inline or 🔄 Hintergrund

### LLM Provider Routing
- **Multi-tier local:** Tier 1 (simple tasks) = small ~2B model (e.g., LFM2-24B-A2B from Liquid AI, configurable). Tier 2 (complex tasks) = big 20B+ model (e.g., qwen3.5:35b). Tier 3 (cloud) = OpenAI/Anthropic.
- **Admin-configurable:** Admin panel/config defines tier1_model, tier2_model, tier3_model with Ollama model names. Fully flexible.
- **Same classifier picks both:** The complexity classifier determines mode (inline/bg) AND model tier in one decision.
- **Auto-escalation:** If tier 1 model stalls or guard detects issues, automatically retry with tier 2. Transparent to user.
- **Cloud opt-in:** Admin can configure specific task types (e.g., Schriftsatz drafting) to use cloud. Everything else stays local. Cloud also activates if all local models are down.
- **Ollama response guard:** Applied to ALL local model responses (not just flagged models). Detects and corrects JSON-as-content.

### Helena Persona
- **Tone:** Friendly professional, Du-Form. Warm but competent, still accurate. Occasional light tone.
- **Language:** Always German regardless of input language
- **First contact:** Brief intro on first use: "Hi, ich bin Helena! Ich kann Akten durchsuchen, Gesetze nachschlagen und Entwürfe erstellen. Was kann ich für dich tun?"
- **System prompt:** Detailed per-tool guidance — system prompt includes instructions for when to use which tool

### Testing
- Unit tests per tool factory function with mocked Prisma
- Integration tests for ReAct loop with mock LLM responses

### Claude's Discretion
- Exact plugin directory structure and auto-discovery mechanism
- Token counting implementation details (tiktoken vs approximation)
- Complexity classifier prompt design
- Exact progress update format and Socket.IO event structure
- LLM response parsing internals
- Cache invalidation strategy within a run

</decisions>

<specifics>
## Specific Ideas

- Multi-tier LLM routing inspired by how different model sizes handle different complexity levels — small for lookups, big for reasoning
- Liquid AI's LFM2-24B-A2B as a candidate for the small/fast tier: https://docs.liquid.ai/lfm/getting-started/welcome
- "Everything local via Ollama" as the primary philosophy — cloud is a prepared fallback, not the default
- Tool observations streamed live to chat "like watching Claude Code think" — transparency builds trust
- Draft preview cards in chat with Approve/Edit — direct interaction without page navigation

</specifics>

<deferred>
## Deferred Ideas

- Conversation memory across sessions — Phase 25 (Helena Memory)
- BullMQ task queue integration — Phase 21 (@Helena Task-System)
- Cost tracking dashboard for LLM token usage — future admin feature
- Model health monitoring (check if Ollama is responding before routing) — operational concern, not core library

</deferred>

---

*Phase: 20-agent-tools-react-loop*
*Context gathered: 2026-02-27*
