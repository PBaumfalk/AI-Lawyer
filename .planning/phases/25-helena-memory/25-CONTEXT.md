# Phase 25: Helena Memory - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Helena remembers case context across sessions — stored summary, risks, next steps, open questions, strategy — and automatically refreshes her understanding when a case changes. DSGVO cascade delete on Akte deletion. This phase does NOT add new agent tools, UI components, or change the chat interface layout — it adds a memory service layer that both invocation paths (ki-chat streaming and background tasks) use.

</domain>

<decisions>
## Implementation Decisions

### Memory Content Structure
- Detailed summary (1-2 paragraphs): full narrative covering case type, parties, core dispute, timeline, key events, procedural history, substantive positions
- Capture case strategy: remember the lawyer's stated approach from conversations (e.g., "Kuendigungsschutzklage + parallele Vergleichsverhandlung")
- Richer JSON structure with these fields:
  - `summary` — detailed case narrative
  - `risks` — recognized risks and vulnerabilities
  - `nextSteps` — pending actions and deadlines
  - `openQuestions` — unanswered questions about the case
  - `relevantNorms` — key legal provisions
  - `strategy` — lawyer's stated approach/plan
  - `keyEvents` — case timeline with significant events
  - `beteiligteNotes` — per-party insights and observations
  - `proceduralStatus` — current Verfahrensstand
- Memory generated from BOTH Akte structured data (documents, deadlines, Beteiligte) AND past Helena conversations (AiConversation history for that Akte)

### Staleness Detection
- Simple timestamp comparison: `HelenaMemory.lastRefreshedAt < Akte.updatedAt` = stale
- No tracking of specific change types — any Akte change triggers staleness

### Auto-Refresh Trigger
- Refresh happens on Helena invocation (both ki-chat and background task) when stale
- Adds 5-15s latency on first call after Akte changes — acceptable tradeoff for simplicity
- Show user indicator during refresh: "Helena aktualisiert ihr Fallgedaechtnis..." (transparent UX)

### Chat Integration
- BOTH ki-chat (streaming) and helena-task (background) load HelenaMemory
- BOTH paths trigger memory refresh if stale — consistent behavior
- Shared `formatMemoryForPrompt()` function used by both system prompt builders (SYSTEM_PROMPT_BASE in ki-chat and buildSystemPrompt in agent)

### Prompt Formatting
- Structured German markdown format with clear sections:
  - `## Fallgedaechtnis (Stand: DD.MM.YYYY)`
  - `### Aenderungen seit letztem Gespraech` — diff summary of what changed since last memory update (new docs, updated deadlines, new Beteiligte)
  - `### Zusammenfassung` — detailed case narrative
  - `### Erkannte Risiken` — bullet list of risks
  - `### Strategie` — lawyer's stated approach
  - `### Naechste Schritte` — pending actions
  - `### Offene Fragen` — unanswered questions
- Change summary enables Helena to proactively address new developments

### Claude's Discretion
- Minimum refresh cooldown interval (to prevent rapid-fire regeneration during bulk operations)
- Token budget cap for memory section in system prompt (balance depth vs. available context window)
- Memory generation prompt design (what instructions to give the LLM for synthesis)
- How to handle cases with no conversation history (initial memory from Akte data only)
- Exact handling of the "Aenderungen" diff (track previous content vs. detect changes from Akte data)

</decisions>

<specifics>
## Specific Ideas

- Helena should be able to say things like "Ich sehe, dass seit unserem letzten Gespraech die Betriebsratsanhoerung eingegangen ist..." — proactive awareness of changes
- Memory should feel like Helena genuinely understands the case, not just regurgitates bullet points
- The `formatMemoryForPrompt()` function is the single source of truth for how memory appears in the LLM prompt — both ki-chat and agent use it

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `HelenaMemory` Prisma model: already exists with `akteId @unique`, JSON `content`, `version` counter, `lastRefreshedAt`, `onDelete: Cascade` (DSGVO handled at schema level)
- `system-prompt.ts` (`buildSystemPrompt()`): already accepts `helenaMemory` param, currently dumps as raw JSON — needs structured formatting
- `helena-task.processor.ts`: already loads HelenaMemory and passes to `runHelenaAgent()` — add staleness check + refresh before this
- `AiConversation` model: stores past chat history per Akte — source for conversation-based memory synthesis
- `token-budget.ts`: existing token estimation utilities that could inform memory token cap

### Established Patterns
- BullMQ for background processing (`src/lib/queue/`)
- Socket.IO for real-time events (`src/lib/socket/emitter.ts`)
- Prisma singleton at `src/lib/db.ts`
- German-language system prompts with structured markdown sections
- AI provider abstraction via `src/lib/ai/provider.ts` (getModel/getModelName)

### Integration Points
- `ki-chat/route.ts`: needs HelenaMemory loading + staleness check + refresh + `formatMemoryForPrompt()` injection into system prompt (new Chain alongside existing A-F)
- `helena-task.processor.ts`: already loads memory — add staleness check + refresh trigger before agent run
- `system-prompt.ts`: replace raw JSON dump with `formatMemoryForPrompt()` call
- `src/lib/helena/index.ts` (`runHelenaAgent`): already passes helenaMemory through — may need update for refresh indicator callback

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 25-helena-memory*
*Context gathered: 2026-02-28*
