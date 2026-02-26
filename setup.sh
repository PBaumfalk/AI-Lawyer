#!/bin/bash
set -e

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC} $1"; }
info() { echo -e "${BLUE}→${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

echo ""
echo -e "${BOLD}AI-Lawyer Setup${NC}"
echo "──────────────────────────────────────"
echo ""

# ─── Prerequisites ────────────────────────────────────────────────────────────
info "Checking prerequisites..."

command -v docker >/dev/null 2>&1 || fail "Docker not found. Install from https://docs.docker.com/get-docker/"
ok "Docker $(docker --version | grep -oE '[0-9]+\.[0-9]+')"

docker compose version >/dev/null 2>&1 || fail "Docker Compose V2 not found. Update Docker Desktop or install the plugin."
ok "Docker Compose $(docker compose version --short)"

if ! docker info >/dev/null 2>&1; then
  fail "Docker daemon is not running. Please start Docker."
fi
ok "Docker daemon running"

echo ""

# ─── .env ─────────────────────────────────────────────────────────────────────
if [ -f ".env" ]; then
  warn ".env already exists — skipping. Edit it manually if needed."
else
  info "Creating .env from .env.example..."
  cp .env.example .env

  # Generate NEXTAUTH_SECRET
  if command -v openssl >/dev/null 2>&1; then
    SECRET=$(openssl rand -base64 32)
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s|your-secret-here-change-in-production|${SECRET}|g" .env
    else
      sed -i "s|your-secret-here-change-in-production|${SECRET}|g" .env
    fi
    ok "NEXTAUTH_SECRET generated"
  else
    warn "openssl not found — NEXTAUTH_SECRET not auto-generated. Set it manually in .env"
  fi

  # Generate EMAIL_ENCRYPTION_KEY
  if command -v openssl >/dev/null 2>&1; then
    ENC_KEY=$(openssl rand -hex 32)
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s|your-random-32-char-encryption-key-here|${ENC_KEY}|g" .env
    else
      sed -i "s|your-random-32-char-encryption-key-here|${ENC_KEY}|g" .env
    fi
    ok "EMAIL_ENCRYPTION_KEY generated"
  fi

  ok ".env created"
fi

echo ""

# ─── Disk space ───────────────────────────────────────────────────────────────
info "Checking available disk space..."
AVAILABLE_GB=$(df -BG . | awk 'NR==2 {gsub("G",""); print $4}')
if [ "$AVAILABLE_GB" -lt 15 ]; then
  warn "Less than 15 GB free (${AVAILABLE_GB} GB). Docker images + Ollama model require ~15-20 GB."
else
  ok "${AVAILABLE_GB} GB free"
fi

echo ""

# ─── Build & Start ────────────────────────────────────────────────────────────
info "Building Docker images (this may take 5-10 minutes on first run)..."
docker compose build

echo ""
info "Starting all services..."
docker compose up -d

echo ""

# ─── Wait for app ─────────────────────────────────────────────────────────────
info "Waiting for app to become healthy..."
ATTEMPTS=0
MAX_ATTEMPTS=60

while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' ailawyer-app 2>/dev/null || echo "starting")
  if [ "$STATUS" = "healthy" ]; then
    break
  fi
  ATTEMPTS=$((ATTEMPTS + 1))
  printf "\r  Waiting... (%ds)" $((ATTEMPTS * 5))
  sleep 5
done

echo ""

if [ "$STATUS" = "healthy" ]; then
  ok "App is healthy"
else
  warn "App health check timed out. Check logs: docker compose logs app"
fi

echo ""

# ─── Summary ──────────────────────────────────────────────────────────────────
echo -e "${BOLD}Setup complete.${NC}"
echo ""
echo -e "  App:           ${GREEN}http://localhost:3000${NC}"
echo -e "  MinIO Console: http://localhost:9001"
echo -e "  OnlyOffice:    http://localhost:8080"
echo ""
echo -e "  Login:    ${BOLD}admin@kanzlei-baumfalk.de${NC}"
echo -e "  Passwort: ${BOLD}password123${NC}"
echo ""
echo -e "${YELLOW}Hinweis:${NC} Ollama lädt das Sprachmodell (mistral:7b) beim ersten Start herunter."
echo -e "         Das kann je nach Verbindung 5-15 Minuten dauern."
echo -e "         Fortschritt: ${BOLD}docker compose logs -f ollama${NC}"
echo ""
