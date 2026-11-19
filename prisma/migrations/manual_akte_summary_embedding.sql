-- HNSW-Index für Akten-Zusammenfassungen. Prisma kann Indizes auf
-- Unsupported("vector")-Spalten nicht abbilden, deshalb manuell.
-- Die Spalten selbst legt die Migration 20261118120000_schema_sync an.
CREATE INDEX IF NOT EXISTS akten_summary_embedding_hnsw
  ON akten USING hnsw ("summaryEmbedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
