---
phase: 10-docker-build-fix
plan: 03
status: complete
completed: 2026-02-26
---

# Plan 10-03 Summary: Vector-Store Fix + Docker Rebuild + KI-Chat Verification

## What Was Done

### Task 1: vector-store.ts raw SQL column fix (commit 657ffc1)
- Fixed all raw SQL queries to use quoted camelCase column names matching Prisma schema
- `dokument_id` → `"dokumentId"`, `chunk_index` → `"chunkIndex"`, `model_version` → `"modelVersion"`
- Fixed JOIN columns: `akte_id` → `"akteId"`, `anwalt_id` → `"anwaltId"`, `sachbearbeiter_id` → `"sachbearbeiterId"`
- Updated `RawRow` type and `mapRow` function to match camelCase keys
- Fixed `getEmbeddingStats` model_version → modelVersion

### Task 2: Docker rebuild + KI-Chat verification (multiple commits in separate session)
Executed in parallel session (Tab A). All fixes deployed and verified working:

**Docker & Infrastructure:**
- GPU reservation (`--gpus all`) added to Ollama in docker-compose (610db29)
- `SERVER_HOST` variable for public URLs — OnlyOffice, MinIO, NextAuth (574940e)
- OnlyOffice URL auto-derived from request Host header — no config needed (bbd0303)
- Stirling-PDF: `SECURITY_ENABLELOGIN=false` to prevent 401 on cached security config
- Dockerfile: `mkdir -p public` fix, `pdf-parse` copied to runner stage (5b45e9d)

**OCR Pipeline:**
- `pdf-parse` added to esbuild externals — dynamic require now works correctly
- Worker re-queues all FEHLGESCHLAGEN OCR docs automatically on startup (a2fe65f)

**KI-Chat (Helena) — end-to-end fixed:**
- `useChat` lifted to ChatLayout — shared state between ChatInput and ChatMessages (d827665)
- Streaming fixed: `refreshKey` removed from ChatMessages key (f48ad8b)
- `UIMessage` type used instead of `Message` for @ai-sdk/react v1.x (7e8d976)
- Default model switched to `qwen3.5:35b` (a47c8d1)
- Structured Akte context injected into Helena system prompt (Beteiligte, Fristen, Aktenzeichen) (0a183d9)
- Helena now answers with general legal knowledge when no RAG docs found

**Setup & Documentation:**
- README, MIT license, setup.sh, Portainer compose, interactive seed users (4cb3c2f–8449529)

## Outcome

KI-Chat (Helena) works end-to-end in Docker production environment:
- Messages send and receive correctly
- Streaming works live
- RAG search works (no more column-not-found errors)
- Akte context enriches Helena's responses
- OCR pipeline retries failed documents automatically

## Decisions

- [10-03] pdf-parse must be esbuild external + copied in Dockerfile runner stage
- [10-03] useChat must live in parent layout, not in leaf components
- [10-03] OnlyOffice public URL auto-derived from request headers (no SERVER_HOST needed for OO)
- [10-03] Stirling-PDF requires SECURITY_ENABLELOGIN=false when security config volume exists
- [10-03] Ollama requires explicit --gpus all flag in docker-compose (GPU not inherited)
- [10-03] Helena relaxed: answers with general legal knowledge even without RAG hits
- [10-03] qwen3.5:35b as default Ollama model (replaces mistral:7b)
