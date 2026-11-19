import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Integration tests against a real PostgreSQL (pgvector) database.
 *
 *   TEST_DATABASE_URL=postgresql://test:test@localhost:55433/test npm run test:integration
 *
 * The global setup wipes that database and builds the schema exactly like the
 * container entrypoint does (prisma migrate deploy + manual SQL), so drift
 * between migrations and schema.prisma fails the run.
 */
export default defineConfig({
  test: {
    globals: true,
    server: { deps: { inline: ['next-auth'] } },
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['tests/integration/global-setup.ts'],
    setupFiles: ['tests/integration/setup.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
  },
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      // next-auth imports "next/server" without extension, which Node's ESM
      // resolver rejects outside the Next.js bundler.
      { find: /^next\/server$/, replacement: 'next/server.js' },
    ],
  },
})
