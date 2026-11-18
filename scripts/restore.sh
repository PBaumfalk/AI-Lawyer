#!/usr/bin/env bash
# AI-Lawyer – Wiederherstellung einer Sicherung von scripts/backup.sh
#
# Aufruf:
#   scripts/restore.sh [--yes] <backup-ordner>
#
# Ablauf: Prüfsummen kontrollieren → Bestätigung → app/worker anhalten →
# Datenbank per pg_restore in frische DB einspielen und austauschen → MinIO-Volume
# ersetzen → MinIO starten (minio-init passt Besitzrechte an) → Meilisearch-
# Index verwerfen → app/worker starten → Hinweis zum Neuaufbau des Suchindex.
#
# ACHTUNG: überschreibt die aktuelle Datenbank und alle Dateien in MinIO.
#
# Umgebungsvariablen:
#   APP_SERVICES          Dienste, die angehalten und danach gestartet werden
#                         (Standard: "app worker")
#   BACKUP_HELPER_IMAGE   Image mit tar/gzip (Standard: pgvector/pgvector:pg16)
#   ENV_FILE              Ziel der .env (Standard: <Projekt>/.env); fehlt sie,
#                         wird die gesicherte Kopie dorthin gelegt
#   COMPOSE_FILE, COMPOSE_PROJECT_NAME  werden von docker compose direkt ausgewertet.

set -euo pipefail
umask 077

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
PROJECT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)

APP_SERVICES=${APP_SERVICES-app worker}
BACKUP_HELPER_IMAGE=${BACKUP_HELPER_IMAGE:-pgvector/pgvector:pg16}
ENV_FILE=${ENV_FILE:-$PROJECT_DIR/.env}
DB_USER=ailawyer
DB_NAME=ailawyer

log() { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"; }
die() { printf '[%s] FEHLER: %s\n' "$(date '+%H:%M:%S')" "$*" >&2; exit 1; }
dc() { docker compose "$@"; }
# Compose-Fortschrittsausgabe nur bei Fehler zeigen
quiet() { local out; if ! out=$("$@" 2>&1); then printf '%s\n' "$out" >&2; return 1; fi; }
usage() { echo "Aufruf: $0 [--yes] <backup-ordner>" >&2; exit 2; }

YES=0
SRC=""
while [ $# -gt 0 ]; do
  case "$1" in
    -y|--yes) YES=1 ;;
    -h|--help) usage ;;
    -*) echo "Unbekannte Option: $1" >&2; usage ;;
    *) [ -z "$SRC" ] || usage; SRC=$1 ;;
  esac
  shift
done
[ -n "$SRC" ] || usage
[ -d "$SRC" ] || die "Ordner nicht gefunden: $SRC"
SRC=$(cd "$SRC" && pwd)
cd "$PROJECT_DIR"

if command -v sha256sum >/dev/null 2>&1; then SHA="sha256sum"
elif command -v shasum >/dev/null 2>&1; then SHA="shasum -a 256"
else die "weder sha256sum noch shasum gefunden"; fi

# ── Prüfen ───────────────────────────────────────────────────────────────────
for f in db.dump minio.tar.gz SHA256SUMS; do
  [ -f "$SRC/$f" ] || die "$f fehlt in $SRC"
done
log "Prüfe Prüfsummen in $SRC"
( cd "$SRC" && $SHA -c SHA256SUMS ) || die "Prüfsummen stimmen nicht – Sicherung beschädigt, Abbruch ohne Änderung"
for f in db.dump minio.tar.gz; do
  grep -q " \*\{0,1\}$f\$" "$SRC/SHA256SUMS" || die "$f ist nicht in SHA256SUMS erfasst"
done

PROJECT=${COMPOSE_PROJECT_NAME:-$(dc config --no-interpolate 2>/dev/null | sed -n 's/^name: //p' | head -n1)}
[ -n "$PROJECT" ] || die "Compose-Projektname nicht ermittelbar"

if [ ! -f "$ENV_FILE" ]; then
  [ -f "$SRC/.env" ] || die "$ENV_FILE fehlt und die Sicherung enthält keine .env"
  cp "$SRC/.env" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  log ".env aus der Sicherung nach $ENV_FILE gelegt (Rechte 600)"
fi

echo
[ -f "$SRC/INFO.txt" ] && sed 's/^/    /' "$SRC/INFO.txt"
echo
echo "Ziel: Compose-Projekt '$PROJECT' in $PROJECT_DIR"
echo "Die aktuelle Datenbank und ALLE Dateien in MinIO werden durch die Sicherung ersetzt."
if [ "$YES" -ne 1 ]; then
  printf 'Fortfahren? Zum Bestätigen "ja" eingeben: '
  read -r answer || answer=""
  [ "$answer" = "ja" ] || die "abgebrochen, nichts verändert"
fi

START=$SECONDS

find_volume() {
  local v
  v=$(docker volume ls -q --filter "label=com.docker.compose.project=$PROJECT" \
        --filter "label=com.docker.compose.volume=$1" | head -n1)
  [ -n "$v" ] || v="${PROJECT}_$1"
  docker volume inspect "$v" >/dev/null 2>&1 || return 1
  echo "$v"
}

# ── 1. Anwendung anhalten ────────────────────────────────────────────────────
if [ -n "$APP_SERVICES" ]; then
  log "1/5 Halte an: $APP_SERVICES"
  # shellcheck disable=SC2086
  dc stop $APP_SERVICES >/dev/null 2>&1 || true
else
  log "1/5 APP_SERVICES leer – keine Anwendungsdienste anzuhalten"
fi

# ── 2. Datenbank ─────────────────────────────────────────────────────────────
log "2/5 Datenbank starten und auf Bereitschaft warten"
quiet dc up -d db
# pg_isready über TCP: während der Erstinitialisierung lauscht nur ein
# temporärer Server auf dem Unix-Socket, der gleich wieder beendet wird.
i=0
until dc exec -T db pg_isready -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; do
  i=$((i + 1)); [ "$i" -le 90 ] || die "Datenbank nach 3 Minuten nicht bereit"
  sleep 2
done
# Eingespielt wird in eine frische Datenbank <name>_restore, die erst nach
# Erfolg die bisherige ersetzt. So bleibt bei einem Fehler der alte Stand
# erhalten, und es bleiben keine Tabellen/Typen zurück, die erst nach der
# Sicherung entstanden sind (z. B. durch Migrationen eines Updates) – das würde
# ein pg_restore --clean direkt in die bestehende Datenbank nicht leisten.
TMP_DB="${DB_NAME}_restore"
psql_admin() { dc exec -T -e PGOPTIONS="-c client_min_messages=warning" db psql -U "$DB_USER" -d postgres -XAtq -v ON_ERROR_STOP=1 -c "$1"; }
log "    pg_restore in frische Datenbank $TMP_DB (eine Transaktion)"
psql_admin "DROP DATABASE IF EXISTS \"$TMP_DB\";" >/dev/null
psql_admin "CREATE DATABASE \"$TMP_DB\" OWNER \"$DB_USER\";" >/dev/null
if ! dc exec -T db pg_restore -U "$DB_USER" -d "$TMP_DB" --clean --if-exists \
    --no-owner --single-transaction --exit-on-error < "$SRC/db.dump"; then
  psql_admin "DROP DATABASE IF EXISTS \"$TMP_DB\";" >/dev/null 2>&1 || true
  die "pg_restore fehlgeschlagen – bisherige Datenbank unverändert. app/worker sind angehalten (Start: docker compose up -d $APP_SERVICES)"
fi
log "    ersetze Datenbank $DB_NAME durch den wiederhergestellten Stand"
psql_admin "DROP DATABASE IF EXISTS \"$DB_NAME\" WITH (FORCE);" >/dev/null
psql_admin "ALTER DATABASE \"$TMP_DB\" RENAME TO \"$DB_NAME\";" >/dev/null

# ── 3. MinIO-Dateien ─────────────────────────────────────────────────────────
log "3/5 MinIO-Volume ersetzen"
dc stop minio >/dev/null 2>&1 || true
# Auf einem neuen Server legt "create" Container und Volume an, ohne zu starten
MINIO_VOL=$(find_volume miniodata) || { dc create minio >/dev/null 2>&1 || true; MINIO_VOL=$(find_volume miniodata); } \
  || die "Volume miniodata des Projekts $PROJECT nicht gefunden"
docker run --rm -i -v "$MINIO_VOL:/data" --entrypoint sh "$BACKUP_HELPER_IMAGE" -c \
  'set -e; find /data -mindepth 1 -maxdepth 1 -exec rm -rf {} +; tar xzf - -C /data' \
  < "$SRC/minio.tar.gz"
log "    starte MinIO (minio-init setzt Besitzrechte auf UID 65532)"
quiet dc up -d --wait minio

# ── 4. Suchindex verwerfen ───────────────────────────────────────────────────
# Der Index wird nicht gesichert und auch nicht automatisch neu aufgebaut.
# Damit keine Treffer auf nicht mehr vorhandene Dokumente zeigen, wird er hier
# gelöscht; POST /api/dokumente/reindex legt ihn neu an und füllt ihn.
log "4/5 Meilisearch"
if dc ps --status running --services 2>/dev/null | grep -qx meilisearch; then
  if dc exec -T meilisearch sh -c \
      'curl -fsS -o /dev/null -X DELETE -H "Authorization: Bearer $MEILI_MASTER_KEY" http://localhost:7700/indexes/dokumente'; then
    log "    Index 'dokumente' verworfen"
  else
    log "    WARNUNG: Index 'dokumente' ließ sich nicht löschen (evtl. gab es ihn nicht)"
  fi
else
  log "    Dienst meilisearch läuft nicht – Index beim Neuaufbau (s. u.) anlegen lassen"
fi

# ── 5. Anwendung starten ─────────────────────────────────────────────────────
if [ -n "$APP_SERVICES" ]; then
  log "5/5 Starte: $APP_SERVICES"
  # shellcheck disable=SC2086
  quiet dc up -d $APP_SERVICES
else
  log "5/5 APP_SERVICES leer – keine Anwendungsdienste zu starten"
fi

log "Wiederherstellung fertig in $((SECONDS - START)) s."
cat <<'EOF'

Noch zu tun:
  1. Suchindex neu aufbauen (geschieht NICHT automatisch): als ADMIN anmelden und in
     der Entwicklerkonsole des Browsers ausführen:
       await (await fetch("/api/dokumente/reindex", { method: "POST" })).json()
     (Handbuch Kapitel 21, „Suchindex neu aufbauen“)
  2. Prüfen, dass EMAIL_ENCRYPTION_KEY in der .env dem Stand der Sicherung entspricht,
     sonst lassen sich gespeicherte Zugangsdaten und 2FA-Geheimnisse nicht entschlüsseln.
  3. Stichprobe: anmelden, Akte öffnen, Dokument herunterladen und im Editor öffnen.
EOF
