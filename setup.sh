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
# POSIX df (-P, 1K blocks) works on Linux and macOS; df -BG is GNU-only.
AVAILABLE_GB=$(df -Pk . | awk 'NR==2 {print int($4/1048576)}')
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
      [ -z "$OPENAI_KEY" ] && warn "Kein API-Key eingegeben — später unter Einstellungen → KI eintragen."
      ;;
    3)
      AI_PROVIDER="anthropic"
      AI_MODEL="claude-sonnet-4-6"
      ask "Anthropic API-Key (sk-ant-...):"
      read -r ANTHROPIC_KEY
      [ -z "$ANTHROPIC_KEY" ] && warn "Kein API-Key eingegeben — später unter Einstellungen → KI eintragen."
      ;;
    *)
      AI_PROVIDER="ollama"
      AI_MODEL="qwen3.5:35b"
      ;;
  esac
  ok "AI Provider: $AI_PROVIDER ($AI_MODEL)"
  echo ""

  # Generate secrets
  command -v openssl >/dev/null 2>&1 || fail "openssl wird zum Erzeugen der Geheimnisse benötigt."
  gen() { openssl rand -hex "$1"; }

  # Write KEY="value" into .env (portable: no sed -i, which differs on macOS/Linux
  # and broke here before because "sed -i ''" was word-split into a wrong suffix).
  set_env() {
    local key="$1" value="$2" tmp
    tmp="$(mktemp)"
    awk -v k="$key" -v v="$value" 'BEGIN{done=0}
      $0 ~ "^"k"=" { print k"=\""v"\""; done=1; next } { print }
      END { if (!done) print k"=\""v"\"" }' .env > "$tmp" && mv "$tmp" .env
  }

  cp .env.example .env
  set_env NEXTAUTH_URL "$APP_URL"
  set_env NEXTAUTH_SECRET "$(gen 32)"
  set_env EMAIL_ENCRYPTION_KEY "$(gen 32)"
  set_env ONLYOFFICE_SECRET "$(gen 24)"
  PG_PW="$(gen 24)"; REDIS_PW="$(gen 24)"
  set_env POSTGRES_PASSWORD "$PG_PW"
  set_env REDIS_PASSWORD "$REDIS_PW"
  # Same credentials for local development against the published 127.0.0.1 ports
  set_env DATABASE_URL "postgresql://ailawyer:${PG_PW}@localhost:5432/ailawyer?schema=public"
  set_env REDIS_URL "redis://:${REDIS_PW}@localhost:6379"
  set_env MINIO_SECRET_KEY "$(gen 24)"
  set_env MEILISEARCH_API_KEY "$(gen 24)"
  set_env INITIAL_ADMIN_PASSWORD "$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"
  HOST_PART="${APP_URL%:*}"
  set_env MINIO_PUBLIC_URL "${HOST_PART}:9000"
  set_env ONLYOFFICE_URL "${HOST_PART}:8080"
  set_env AI_PROVIDER "$AI_PROVIDER"
  set_env AI_MODEL "$AI_MODEL"
  [ -n "$OPENAI_KEY" ]    && set_env OPENAI_API_KEY "$OPENAI_KEY"
  [ -n "$ANTHROPIC_KEY" ] && set_env ANTHROPIC_API_KEY "$ANTHROPIC_KEY"
  chmod 600 .env
  OFFEN=$(grep -v '^[[:space:]]*#' .env | grep -c "ÄNDERN" || true)
  if [ "$OFFEN" -gt 0 ]; then
    fail "In .env sind noch Platzhalter: ${OFFEN} Stelle(n). Bitte prüfen."
  fi
  ok ".env erstellt"
  echo ""
fi

# ─── Summary before building ──────────────────────────────────────────────────
echo -e "${BOLD}Bereit zum Starten${NC}"
echo "──────────────────────────────────────"
echo -e "  URL:         ${APP_URL:-$(grep NEXTAUTH_URL .env | cut -d'"' -f2)}"
echo -e "  AI Provider: ${AI_PROVIDER:-$(grep ^AI_PROVIDER .env | cut -d'"' -f2)}"

# GPU for Ollama only when the NVIDIA runtime is available
COMPOSE_FILES=(-f docker-compose.yml)
if command -v nvidia-smi >/dev/null 2>&1 && docker info 2>/dev/null | grep -qi nvidia; then
  COMPOSE_FILES+=(-f docker-compose.gpu.yml)
  ok "NVIDIA-GPU erkannt – Ollama nutzt die GPU"
else
  warn "Keine NVIDIA-GPU – Ollama läuft auf der CPU (langsam für große Modelle)"
fi
echo ""
ask "Jetzt bauen und starten? [Y/n]"
read -r CONFIRM
if [[ "$CONFIRM" =~ ^[Nn]$ ]]; then
  echo ""
  info "Abgebrochen. Starte manuell mit: docker compose ${COMPOSE_FILES[*]} up -d"
  exit 0
fi

echo ""

# ─── Build & Start ────────────────────────────────────────────────────────────
info "Building Docker images (erster Build dauert 5-10 Minuten)..."
docker compose "${COMPOSE_FILES[@]}" build

echo ""
info "Starting all services..."
docker compose "${COMPOSE_FILES[@]}" up -d

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
echo -e "  MinIO-Konsole: nur auf dem Server erreichbar (http://127.0.0.1:9001)"
echo ""
echo -e "  ${BOLD}Zugangsdaten${NC}"
ADMIN_MAIL=$(grep '^INITIAL_ADMIN_EMAIL=' .env | cut -d'"' -f2)
echo -e "  Benutzer: ${BOLD}${ADMIN_MAIL:-admin@kanzlei.de}${NC} (ADMIN)"
echo -e "  Passwort: steht als INITIAL_ADMIN_PASSWORD in .env (nur für den ersten Login)"
echo -e "            anzeigen mit: ${BOLD}grep INITIAL_ADMIN_PASSWORD .env${NC}"
echo -e "  Danach:   Einstellungen → Sicherheit → Passwort ändern,"
echo -e "            Mitarbeiter unter Admin → Benutzer anlegen."
echo ""
echo -e "${YELLOW}Hinweis:${NC} Ollama lädt qwen3.5:35b beim ersten Start herunter (5-15 Min)."
echo -e "         Fortschritt: ${BOLD}docker compose logs -f ollama${NC}"
echo ""
