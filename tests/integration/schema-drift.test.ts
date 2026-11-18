import { execSync } from 'node:child_process'
import { describe, it, expect } from 'vitest'

// Indexes on Unsupported("vector") columns cannot be expressed in schema.prisma;
// they come from prisma/migrations/manual_*.sql and are the only allowed difference.
const ALLOWED = new Set([
  'DROP INDEX "akten_summary_embedding_hnsw";',
  'DROP INDEX "document_chunks_embedding_idx";',
  'DROP INDEX "law_chunks_embedding_hnsw";',
  'DROP INDEX "muster_chunks_embedding_hnsw";',
  'DROP INDEX "urteil_chunks_embedding_hnsw";',
])

describe('Datenbankschema', () => {
  it('Migrationen + manuelle SQL ergeben exakt schema.prisma', () => {
    const out = execSync(
      `npx prisma migrate diff --from-url "${process.env.TEST_DATABASE_URL}" --to-schema-datamodel prisma/schema.prisma --script`,
      { stdio: 'pipe' },
    ).toString()
    const statements = out
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^(CREATE|ALTER|DROP)\b/.test(l))
      .filter((l) => !ALLOWED.has(l))
    expect(statements).toEqual([])
  })
})
