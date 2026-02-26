# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci

# ── Stage 2: Build the application ──────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Copy pdfjs worker to public/ (avoids Terser import.meta error)
# pdfjs-dist version in package.json MUST match what react-pdf expects (pinned to 5.4.296).
# A version mismatch between worker and library causes silent PDF load failures in the browser.
RUN mkdir -p public && cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs

# Generate Prisma client (needs dummy DATABASE_URL since .env is excluded)
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# Build Next.js in standalone mode (no .env — env vars come from docker-compose at runtime)
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npm run build

# Bundle server.ts and worker.ts with esbuild
RUN npx tsx scripts/build-server.ts
RUN npx tsx scripts/build-worker.ts

# ── Stage 3: Production runner ──────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy esbuild bundled outputs (custom server + worker)
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/dist-worker ./dist-worker

# Copy Prisma schema + seed for runtime migrations
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Copy pino transports (not included by Next.js standalone — resolved dynamically at runtime)
COPY --from=builder /app/node_modules/pino ./node_modules/pino
COPY --from=builder /app/node_modules/pino-roll ./node_modules/pino-roll
COPY --from=builder /app/node_modules/pino-abstract-transport ./node_modules/pino-abstract-transport
COPY --from=builder /app/node_modules/pino-std-serializers ./node_modules/pino-std-serializers
COPY --from=builder /app/node_modules/sonic-boom ./node_modules/sonic-boom
COPY --from=builder /app/node_modules/real-require ./node_modules/real-require
COPY --from=builder /app/node_modules/on-exit-leak-free ./node_modules/on-exit-leak-free
COPY --from=builder /app/node_modules/quick-format-unescaped ./node_modules/quick-format-unescaped
COPY --from=builder /app/node_modules/atomic-sleep ./node_modules/atomic-sleep
COPY --from=builder /app/node_modules/thread-stream ./node_modules/thread-stream
COPY --from=builder /app/node_modules/safe-stable-stringify ./node_modules/safe-stable-stringify
COPY --from=builder /app/node_modules/date-fns ./node_modules/date-fns

# Copy pdf-parse (external in esbuild worker bundle — needed for OCR text extraction)
COPY --from=builder /app/node_modules/pdf-parse ./node_modules/pdf-parse

# Copy seed dependencies (tsx needs esbuild + get-tsconfig at runtime)
COPY --from=builder /app/node_modules/tsx ./node_modules/tsx
COPY --from=builder /app/node_modules/esbuild ./node_modules/esbuild
COPY --from=builder /app/node_modules/@esbuild ./node_modules/@esbuild
COPY --from=builder /app/node_modules/get-tsconfig ./node_modules/get-tsconfig
COPY --from=builder /app/node_modules/resolve-pkg-maps ./node_modules/resolve-pkg-maps
COPY --from=builder /app/node_modules/typescript ./node_modules/typescript
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY --from=builder /app/package.json ./package.json

# Copy entrypoint script
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Create log directory for pino-roll file transport at runtime
RUN mkdir -p /var/log/ai-lawyer && chown nextjs:nodejs /var/log/ai-lawyer

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
