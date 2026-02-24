#!/bin/sh
set -e

echo "==> Waiting for PostgreSQL..."
MAX_RETRIES=30
RETRY_COUNT=0
until node -e "
  const net = require('net');
  const s = net.createConnection({host: 'db', port: 5432});
  s.on('connect', () => { s.end(); process.exit(0); });
  s.on('error', () => process.exit(1));
" 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "ERROR: PostgreSQL not available after ${MAX_RETRIES} retries"
    exit 1
  fi
  echo "    PostgreSQL not ready (attempt ${RETRY_COUNT}/${MAX_RETRIES}), waiting..."
  sleep 2
done
echo "==> PostgreSQL is ready"

echo "==> Running Prisma db push (schema sync)..."
node node_modules/prisma/build/index.js db push --skip-generate

echo "==> Running Prisma db seed..."
node node_modules/tsx/dist/cli.mjs prisma/seed.ts || echo "    Seed skipped (may already exist)"

echo "==> Starting custom server..."
exec node dist-server/index.js
