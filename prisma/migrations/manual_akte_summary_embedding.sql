-- Phase 30: Akte summary embedding for SCAN-05 Neu-Urteil-Check
-- Apply via: psql or in worker startup (idempotent via IF NOT EXISTS)
ALTER TABLE akten ADD COLUMN IF NOT EXISTS "summaryEmbedding" vector(1024);
ALTER TABLE akten ADD COLUMN IF NOT EXISTS "summaryEmbeddingAt" TIMESTAMP;

-- HNSW index for efficient cosine similarity search on Akte embeddings
CREATE INDEX IF NOT EXISTS akten_summary_embedding_hnsw
  ON akten USING hnsw ("summaryEmbedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
