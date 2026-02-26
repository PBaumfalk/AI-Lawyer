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

# Pull default Ollama models if this is the worker
if echo "$@" | grep -q "dist-worker"; then
  OLLAMA_HOST="${OLLAMA_URL:-http://ollama:11434}"
  echo "==> Checking Ollama models..."

  for MODEL_NAME in "qwen3.5:35b" "blaifa/multilingual-e5-large-instruct"; do
    SHORT_NAME=$(echo "$MODEL_NAME" | cut -d: -f1 | sed 's|.*/||')
    HAS_MODEL=$(node -e "
      fetch('${OLLAMA_HOST}/api/tags').then(r => r.json()).then(d => {
        const has = (d.models || []).some(m => m.name.includes('${SHORT_NAME}'));
        console.log(has ? 'yes' : 'no');
      }).catch(() => console.log('no'));
    " 2>/dev/null)

    if [ "$HAS_MODEL" != "yes" ]; then
      echo "==> Pulling ${MODEL_NAME} (this may take a few minutes on first run)..."
      node -e "
        fetch('${OLLAMA_HOST}/api/pull', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({name: '${MODEL_NAME}', stream: false})
        }).then(r => r.json()).then(d => {
          if (d.error) { console.error('    Pull error:', d.error); process.exit(1); }
          console.log('==> ${MODEL_NAME} ready');
        }).catch(e => { console.error('    Pull failed:', e.message); process.exit(1); });
      " || echo "    Ollama pull failed for ${MODEL_NAME} (non-fatal)"
    else
      echo "==> ${MODEL_NAME} already available"
    fi
  done
fi

echo "==> Starting: $@"
exec "$@"
