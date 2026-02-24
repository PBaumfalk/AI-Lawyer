-- ============================================================================
-- pgvector Extension + HNSW Index
-- ============================================================================
-- Run after `prisma db push` to create the vector extension and HNSW index.
-- Prisma cannot generate vector operations, so this is applied manually.
--
-- Apply via: psql -U <user> -d <db> -f prisma/migrations/manual_pgvector_index.sql
-- Or include in a Docker entrypoint / startup script.
-- ============================================================================

-- Enable pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create HNSW index for efficient cosine similarity search
-- Parameters: m=16 (connections per layer), ef_construction=64 (build-time accuracy)
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
