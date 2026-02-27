---
status: resolved
trigger: "Helena KI-Assistentin is very slow on every response. No errors, just slow performance."
created: 2026-02-27T00:00:00Z
updated: 2026-02-27T09:00:00Z
resolved: 2026-02-27T09:00:00Z
---

## Resolution

Three rounds of fixes applied across multiple sessions:

1. **Backend parallelization** — Chain A (Akte context), Chain B (RAG), Chain C (model config), Chain D (law_chunks) now run in parallel via Promise.all. Settings reads cached with TTL. Embedding timeout added.

2. **Frontend UX** — handleNewChat() and handleSelectConversation() now call stop() to abort in-flight requests. Added onError handler and error display UI in ChatMessages.

3. **RAG skip heuristic** — shouldSkipRag() skips embedding + hybrid search + reranker + law_chunks for short conversational queries (greetings, "ja"/"nein"/"danke"). Saves 2 Ollama round-trips + multiple DB queries per simple message.

Verified: User confirmed Helena responds faster.
