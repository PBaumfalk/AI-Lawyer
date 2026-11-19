import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  // tsconfig sets jsx: "preserve" for Next.js. Vite 8 (oxc) honours that and
  // leaves JSX untransformed, so .tsx imports in tests failed to parse.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    globals: true,
    server: { deps: { inline: ['next-auth'] } },
    environment: 'node',
    // Integration tests need a real PostgreSQL; they run via vitest.integration.config.ts
    exclude: ['**/node_modules/**', 'tests/integration/**', 'tests/e2e/**', 'AI-Lawyer-Webseite/**', '.next/**', '.claude/**'],
    // bcrypt and date loops are CPU-bound; under heavy machine load (CI runners,
    // parallel builds) the 5s default produced false failures.
    testTimeout: 20000,
  },
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      // next-auth imports "next/server" without extension, which Node's ESM
      // resolver rejects outside the Next.js bundler.
      { find: /^next\/server$/, replacement: 'next/server.js' },
      // Persimmon icons, same alias as next.config.mjs
      { find: /^lucide-react$/, replacement: path.resolve(__dirname, './src/components/icons/lucide-compat.tsx') },
    ],
  },
})
