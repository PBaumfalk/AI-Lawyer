#!/bin/bash
set -e

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ok()   { echo -e "${GREEN}✓${NC} $1"; }
info() { echo -e "${BLUE}→${NC} $1"; }
warn() { echo -e "${YELLOW}!${NC} $1"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }
ask()  { echo -e "${CYAN}?${NC} $1"; }

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

# ─── Disk space ───────────────────────────────────────────────────────────────
AVAILABLE_GB=$(df -BG . | awk 'NR==2 {gsub("G",""); print $4}')
if [ "$AVAILABLE_GB" -lt 15 ]; then
  warn "Less than 15 GB free (${AVAILABLE_GB} GB). Docker images + Ollama model require ~15-20 GB."
else
  ok "${AVAILABLE_GB} GB free"
fi

echo ""

# ─── Interactive configuration ────────────────────────────────────────────────
if [ -f ".env" ]; then
  warn ".env already exists."
  ask "Overwrite and reconfigure? [y/N]"
  read -r OVERWRITE
  if [[ ! "$OVERWRITE" =~ ^[Yy]$ ]]; then
    echo ""
    info "Keeping existing .env — skipping configuration."
    echo ""
    SKIP_CONFIG=true
  fi
fi

if [ "$SKIP_CONFIG" != "true" ]; then
  echo -e "${BOLD}Configuration${NC}"
  echo "──────────────────────────────────────"
  echo ""

  # App URL
  ask "App URL (default: http://localhost:3000):"
  read -r INPUT_URL
  APP_URL="${INPUT_URL:-http://localhost:3000}"
  ok "App URL: $APP_URL"
  echo ""

  # AI Provider
  echo -e "  AI provider:"
  echo -e "  ${BOLD}1)${NC} Ollama (local, kostenlos, kein API-Key nötig) ${GREEN}[empfohlen]${NC}"
  echo -e "  ${BOLD}2)${NC} OpenAI (GPT-4o, benötigt API-Key)"
  echo -e "  ${BOLD}3)${NC} Anthropic (Claude, benötigt API-Key)"
  ask "Wahl [1/2/3] (default: 1):"
  read -r AI_CHOICE

  case "$AI_CHOICE" in
    2)
      AI_PROVIDER="openai"
      AI_MODEL="gpt-4o"
      ask "OpenAI API-Key (sk-...):"
      read -r OPENAI_KEY
      [ -z "$OPENAI_KEY" ] && warn "Kein API-Key eingegeben — kann später in .env gesetzt werden."
      ;;
    3)
      AI_PROVIDER="anthropic"
      AI_MODEL="claude-sonnet-4-6"
      ask "Anthropic API-Key (sk-ant-...):"
      read -r ANTHROPIC_KEY
      [ -z "$ANTHROPIC_KEY" ] && warn "Kein API-Key eingegeben — kann später in .env gesetzt werden."
      ;;
    *)
      AI_PROVIDER="ollama"
      AI_MODEL="qwen3.5:35b"
      ;;
  esac
  ok "AI Provider: $AI_PROVIDER ($AI_MODEL)"
  echo ""

  # Generate secrets
  if command -v openssl >/dev/null 2>&1; then
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    EMAIL_ENC_KEY=$(openssl rand -hex 32)
    ONLYOFFICE_SECRET=$(openssl rand -base64 24 | tr -d '/+=')
  else
    warn "openssl nicht gefunden — Secrets werden als Platzhalter gesetzt. Bitte manuell in .env ändern."
    NEXTAUTH_SECRET="change-me-$(date +%s)"
    EMAIL_ENC_KEY="change-me-$(date +%s)-32charkey-placeholder"
    ONLYOFFICE_SECRET="change-me-onlyoffice"
  fi

  # Write .env
  cp .env.example .env

  SED_CMD="sed -i"
  [[ "$OSTYPE" == "darwin"* ]] && SED_CMD="sed -i ''"

  $SED_CMD "s|NEXTAUTH_URL=.*|NEXTAUTH_URL=\"${APP_URL}\"|" .env
  $SED_CMD "s|your-secret-here-change-in-production|${NEXTAUTH_SECRET}|" .env
  $SED_CMD "s|your-random-32-char-encryption-key-here|${EMAIL_ENC_KEY}|" .env
  $SED_CMD "s|your-onlyoffice-secret|${ONLYOFFICE_SECRET}|" .env
  $SED_CMD "s|^AI_PROVIDER=.*|AI_PROVIDER=\"${AI_PROVIDER}\"|" .env
  $SED_CMD "s|^AI_MODEL=.*|AI_MODEL=\"${AI_MODEL}\"|" .env

  [ -n "$OPENAI_KEY" ]    && $SED_CMD "s|OPENAI_API_KEY=.*|OPENAI_API_KEY=\"${OPENAI_KEY}\"|" .env
  [ -n "$ANTHROPIC_KEY" ] && $SED_CMD "s|ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=\"${ANTHROPIC_KEY}\"|" .env

  ok ".env erstellt"
  echo ""
fi

# ─── Summary before building ──────────────────────────────────────────────────
echo -e "${BOLD}Bereit zum Starten${NC}"
echo "──────────────────────────────────────"
echo -e "  URL:         ${APP_URL:-$(grep NEXTAUTH_URL .env | cut -d'"' -f2)}"
echo -e "  AI Provider: ${AI_PROVIDER:-$(grep ^AI_PROVIDER .env | cut -d'"' -f2)}"
echo ""
ask "Jetzt bauen und starten? [Y/n]"
read -r CONFIRM
if [[ "$CONFIRM" =~ ^[Nn]$ ]]; then
  echo ""
  info "Abgebrochen. Starte manuell mit: docker compose up -d"
  exit 0
fi

echo ""

# ─── Build & Start ────────────────────────────────────────────────────────────
info "Building Docker images (erster Build dauert 5-10 Minuten)..."
docker compose build

echo ""
info "Starting all services..."
docker compose up -d

echo ""

# ─── Wait for app ─────────────────────────────────────────────────────────────
info "Warte auf App-Healthcheck..."
ATTEMPTS=0
MAX_ATTEMPTS=60

while [ $ATTEMPTS -lt $MAX_ATTEMPTS ]; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' ailawyer-app 2>/dev/null || echo "starting")
  if [ "$STATUS" = "healthy" ]; then
    break
  fi
  ATTEMPTS=$((ATTEMPTS + 1))
  printf "\r  %ds..." $((ATTEMPTS * 5))
  sleep 5
done

echo ""

if [ "$STATUS" = "healthy" ]; then
  ok "App ist healthy"
else
  warn "Healthcheck-Timeout. Logs prüfen: docker compose logs app"
fi

echo ""

# ─── Done ─────────────────────────────────────────────────────────────────────
FINAL_URL=$(grep NEXTAUTH_URL .env | cut -d'"' -f2 | head -1)
[ -z "$FINAL_URL" ] && FINAL_URL="http://localhost:3000"

echo -e "${BOLD}Fertig.${NC}"
echo ""
echo -e "  App:           ${GREEN}${FINAL_URL}${NC}"
echo -e "  MinIO Console: ${FINAL_URL%:*}:9001"
echo ""
echo -e "  ${BOLD}Zugangsdaten${NC}"
echo -e "  admin@kanzlei.de          → ADMIN"
echo -e "  anwalt@kanzlei.de         → ANWALT"
echo -e "  sachbearbeiter@kanzlei.de → SACHBEARBEITER"
echo -e "  Passwort: ${BOLD}password123${NC} (bitte nach Login ändern)"
echo ""
echo -e "${YELLOW}Hinweis:${NC} Ollama lädt qwen3.5:35b beim ersten Start herunter (5-15 Min)."
echo -e "         Fortschritt: ${BOLD}docker compose logs -f ollama${NC}"
echo ""
