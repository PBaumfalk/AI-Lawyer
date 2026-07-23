# Phase 30: SCAN-05 Neu-Urteil-Check - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

The system proactively detects when newly ingested court decisions (from daily BMJ RSS sync) are relevant to active cases, and alerts the responsible user with a Helena-generated briefing. Covers: Akte summary embeddings, cross-Akte semantic matching after Urteil ingestion, NEUES_URTEIL alerts with LLM briefings, and admin threshold configuration.

</domain>

<decisions>
## Implementation Decisions

### Akte-Summary Embedding
- Use everything available for the summary: kurzrubrum + sachgebiet + wegen + HelenaMemory.content (summary, risks, relevantNorms) + Falldaten JSON + pinned Normen
- Store embedding as a new vector column directly on the Akte model (Prisma migration)
- Refresh via nightly BullMQ cron, running before the scanner checks — rebuild all active Akte embeddings daily
- Akten without HelenaMemory or Falldaten still get embedded from core fields (graceful degradation)

### Matching + Threshold
- Match as a batch after processUrteileSyncJob() completes — all newly inserted Urteile against all active Akten in one pass
- Single global cosine similarity threshold (default ~0.72) stored in SystemSetting — per-Sachgebiet thresholds deferred to SCAN-F01
- Alert all Akten above threshold per Urteil — no artificial cap on matches
- Pre-filter by Sachgebiet: only match Urteile against Akten with matching rechtsgebiet, then run semantic similarity within that subset

### Alert + Briefing
- Alert title format: "Relevantes Urteil fuer [Akte Kurzrubrum]" — user-centric, highlights which Akte is affected
- Briefing uses structured format with sections: 1) Was wurde entschieden? 2) Warum relevant fuer diese Akte? 3) Moegliche Auswirkungen — requires LLM call (Helena/Ollama)
- No auto-resolve for NEUES_URTEIL alerts — stay until manually dismissed (a relevant Urteil is always relevant)
- Severity is score-based: map cosine similarity to severity (higher similarity = higher severity)

### Admin Threshold UI
- Threshold setting lives in existing Scanner settings section (alongside scanner.enabled, frist_threshold_hours etc.)
- UI control: range slider 0.50-0.95 with current value displayed and "Strenger" / "Lockerer" labels
- Separate scanner.neues_urteil_enabled toggle — admin can disable Urteil matching independently from main scanner

### Claude's Discretion
- Exact text concatenation format and field ordering for Akte summary embedding
- Whether the admin sees a match count preview when adjusting threshold (feedback vs complexity tradeoff)
- Exact severity-to-score mapping ranges
- LLM prompt design for the structured briefing

</decisions>

<specifics>
## Specific Ideas

- The briefing should feel like a short Anwaltsnotiz — professional, concise, actionable
- Matching should work even for Akten with minimal data (just kurzrubrum + sachgebiet)
- The daily cron pattern should mirror existing urteile-sync timing: Urteile sync first, then Akte embedding refresh, then cross-matching

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `generateEmbedding()` / `generateQueryEmbedding()` in `src/lib/embedding/embedder.ts`: Ollama E5 embeddings with passage/query prefixes (1024 dimensions)
- `createScannerAlert()` in `src/lib/scanner/service.ts`: Full alert pipeline (24h dedup, AktenActivity, Socket.IO badge, notification)
- `resolveAlertRecipients()`: Handles Akte Verantwortlicher + Vertreter routing
- `searchUrteilChunks()` in `src/lib/urteile/ingestion.ts`: pgvector cosine similarity search pattern
- `getSettingTyped()` / `updateSetting()`: SystemSetting read/write for configurable thresholds
- `processScanner()` in `src/workers/processors/scanner.ts`: Scanner processor pattern (config load, check runs, resolve, escalate)

### Established Patterns
- BullMQ cron jobs for daily processing (urteile-sync runs at 02:00)
- GUID cache pattern for deduplication (SystemSetting JSON storage)
- Raw SQL for pgvector operations (`prisma.$executeRaw` / `prisma.$queryRaw`)
- CheckResult interface for scanner check outputs
- HelenaAlertTyp enum already includes NEUES_URTEIL value
- createNotification() for push notifications

### Integration Points
- `processUrteileSyncJob()` return value (inserted count) — trigger cross-matching after completion
- Scanner processor — add Neu-Urteil check as new check function alongside frist/inaktiv/anomalie
- HelenaMemory model: structured JSON with summary, risks, relevantNorms per Akte
- Akte model: kurzrubrum, sachgebiet, wegen, falldaten (JSON), falldatenTemplateId
- Alert-Center UI: already renders NEUES_URTEIL type (enum exists, UI handles all types)

</code_context>

<deferred>
## Deferred Ideas

- SCAN-F01: Per-Sachgebiet relevance thresholds — already tracked as future requirement
- Helena reads past NEUES_URTEIL alerts to build case strategy recommendations — separate phase
- Urteil-to-Urteil citation graph (which Urteile cite each other) — separate capability

</deferred>

---

*Phase: 30-scan-05-neu-urteil-check*
*Context gathered: 2026-02-28*
