-- ============================================================================
-- HNSW Indexes for RAG Schema Foundation (Phase 12)
-- ============================================================================
-- Run after prisma migrate deploy to create vector similarity indexes.
-- Prisma cannot generate HNSW indexes — these are applied manually.
--
-- Apply via: psql -U <user> -d <db> -f prisma/migrations/manual_rag_hnsw_indexes.sql
-- Or include in the Docker entrypoint / startup script alongside manual_pgvector_index.sql.
--
-- Parameters: m=16 (connections per layer), ef_construction=64 (build accuracy)
-- Matches existing document_chunks_embedding_idx parameters exactly.
-- ============================================================================

-- Gesetze chunks
CREATE INDEX IF NOT EXISTS law_chunks_embedding_hnsw
  ON law_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Urteil chunks
CREATE INDEX IF NOT EXISTS urteil_chunks_embedding_hnsw
  ON urteil_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Muster chunks
CREATE INDEX IF NOT EXISTS muster_chunks_embedding_hnsw
  ON muster_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
