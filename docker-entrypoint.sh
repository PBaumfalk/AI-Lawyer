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

echo "==> Running Prisma migrate deploy..."
node node_modules/prisma/build/index.js migrate deploy

echo "==> Checking if database needs seeding..."
NEEDS_SEED=$(node -e "
  const { PrismaClient } = require('@prisma/client');
  const p = new PrismaClient();
  p.user.count().then(c => { console.log(c === 0 ? 'yes' : 'no'); p.\$disconnect(); }).catch(() => { console.log('yes'); p.\$disconnect(); });
" 2>/dev/null)

if [ "$NEEDS_SEED" = "yes" ]; then
  echo "==> Running Prisma seed (first run)..."
  node node_modules/tsx/dist/cli.mjs prisma/seed.ts || echo "    Seed failed (non-fatal)"
else
  echo "==> Database already seeded, skipping"
fi

echo "==> Starting: $@"
exec "$@"
