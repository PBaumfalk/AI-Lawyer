#!/usr/bin/env bash
# AI-Lawyer – Wiederherstellung aus dem verschlüsselten restic-Repository
#
# Aufruf:
#   scripts/restore.sh [--yes] [--snapshot <ID>|latest]
#   scripts/restore.sh --list            vorhandene Snapshots anzeigen
#
# Ablauf:
#   1. Snapshot (Standard: neuester mit Tag BACKUP_TAG) in ein Staging-Volume
#      entschlüsseln (restic restore --verify), Prüfsumme und Lesbarkeit des
#      Datenbank-Dumps sowie Dateianzahl von MinIO kontrollieren
#      → bei falschem Schlüssel oder beschädigten Daten Abbruch OHNE Änderung
#   2. Bestätigung (außer --yes)
#   3. app/worker anhalten, Datenbank in frische DB <name>_restore einspielen
#      und erst nach Erfolg gegen die bisherige tauschen
#   4. MinIO-Volume ersetzen, MinIO starten (minio-init setzt Besitzrechte)
#   5. Meilisearch-Index verwerfen, app/worker starten
#   6. Suchindex automatisch neu aufbauen (node dist-worker/reindex-suche.mjs im
#      App-Container) und Anzahl prüfen
#
# ACHTUNG: überschreibt die aktuelle Datenbank und alle Dateien in MinIO.
#
# Voraussetzungen: .env (mit dem EMAIL_ENCRYPTION_KEY des gesicherten Stands)
# liegt im Projektordner, Repository-Zugang (BACKUP_CONFIG) und Schlüsseldatei
# (RESTIC_PASSWORD_FILE) sind vorhanden – siehe Handbuch Kapitel 21.
#
# Umgebungsvariablen (zusätzlich zu scripts/lib/backup-common.sh):
#   APP_SERVICES      Dienste, die angehalten und danach gestartet werden (Standard: "app worker")
#   REINDEX           1 (Standard): Suchindex nach dem Start neu aufbauen; 0: überspringen
#   REINDEX_SERVICE   Dienst, in dem der Neuaufbau läuft (Standard: app)
#   REINDEX_TRIES     Versuche, falls Meilisearch/DB noch nicht bereit (Standard: 5)
#   ENV_FILE          .env des Projekts (Standard: <Projekt>/.env); fehlt sie und enthält
#                     der Snapshot eine (.env nur bei BACKUP_INCLUDE_ENV=1), wird diese verwendet
#   COMPOSE_FILE, COMPOSE_PROJECT_NAME  werden von docker compose direkt ausgewertet.

# Befehle für Container stehen absichtlich in einfachen Anführungszeichen
# (werden dort ausgewertet, nicht hier):
# shellcheck disable=SC2016
set -euo pipefail
umask 077

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
PROJECT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
cd "$PROJECT_DIR"
# shellcheck source=lib/backup-common.sh
. "$SCRIPT_DIR/lib/backup-common.sh"

usage() { echo "Aufruf: $0 [--yes] [--snapshot <ID>|latest] | --list" >&2; exit 2; }

YES=0
SNAP=latest
LIST=0
while [ $# -gt 0 ]; do
  case "$1" in
    -y|--yes) YES=1 ;;
    -s|--snapshot) [ $# -ge 2 ] || usage; SNAP=$2; shift ;;
    -l|--list) LIST=1 ;;
    -h|--help) usage ;;
    *) echo "Unbekannte Option: $1" >&2; usage ;;
  esac
  shift
done
case "$SNAP" in latest|[0-9a-f][0-9a-f][0-9a-f][0-9a-f]*) ;; *) die "Snapshot-ID ungültig: $SNAP" ;; esac

command -v docker >/dev/null 2>&1 || die "docker nicht gefunden"
load_backup_config "$PROJECT_DIR"
check_key_file

APP_SERVICES=${APP_SERVICES-app worker}
REINDEX=${REINDEX:-1}
REINDEX_SERVICE=${REINDEX_SERVICE:-app}
REINDEX_TRIES=${REINDEX_TRIES:-5}
ENV_FILE=${ENV_FILE:-$PROJECT_DIR/.env}
DB_USER=ailawyer
DB_NAME=ailawyer

if [ "$LIST" = 1 ]; then
  rc=0; restic_run snapshots --tag "$BACKUP_TAG" || rc=$?
  [ "$rc" -eq 0 ] || die "$(restic_error_hint "$rc")"
  exit 0
fi

PROJECT=$(compose_project)
STAGE_VOL="${PROJECT}_restore-staging"
cleanup() {
  [ "${KEEP_STAGING:-0}" = 1 ] || docker volume rm -f "$STAGE_VOL" >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'exit 130' INT TERM

START=$SECONDS

# ── 1. Entschlüsseln und prüfen (noch keine Änderung) ────────────────────────
log "1/6 Snapshot '$SNAP' aus $(redact_repo "$RESTIC_REPOSITORY") entschlüsseln"
SEL=("$SNAP")
[ "$SNAP" != latest ] || SEL+=(--tag "$BACKUP_TAG")
rc=0; restic_run snapshots "${SEL[@]}" 2>&1 | sed 's/^/    /' || rc=$?
[ "$rc" -eq 0 ] || die "Repository nicht lesbar: $(restic_error_hint "$rc") – nichts verändert"

docker volume rm -f "$STAGE_VOL" >/dev/null 2>&1 || true
docker volume create "$STAGE_VOL" >/dev/null
RESTIC_MOUNTS=(-v "$STAGE_VOL:/restore")
rc=0
restic_run restore "${SEL[@]}" --target /restore --verify 2>&1 | sed 's/^/    /' || rc=$?
RESTIC_MOUNTS=()
[ "$rc" -eq 0 ] || die "restic restore fehlgeschlagen: $(restic_error_hint "$rc") – nichts verändert"

log "    prüfe Prüfsumme und Lesbarkeit des Datenbank-Dumps, Dateien von MinIO"
helper_sh "$STAGE_VOL:/r" -- '
  set -e
  B=/r/backup
  test -f $B/stage/db/db.dump || { echo "db.dump fehlt im Snapshot" >&2; exit 1; }
  test -d $B/minio || { echo "MinIO-Daten fehlen im Snapshot" >&2; exit 1; }
  cd $B/stage/db
  sha256sum -c SHA256SUMS > /tmp/sha.out || { cat /tmp/sha.out >&2; exit 1; }
  sed "s/^/    /" /tmp/sha.out
  pg_restore -l db.dump > /dev/null
  want=$(sed -n "s/^minio_dateien: *//p" $B/stage/meta/INFO.txt)
  have=$(find $B/minio -type f | wc -l)
  echo "    MinIO: $have Dateien (laut Sicherung: $want)"
  test "$want" = "$have" || { echo "Dateianzahl MinIO weicht ab" >&2; exit 1; }' \
  || die "Snapshot unvollständig oder beschädigt – nichts verändert"

echo
helper_sh "$STAGE_VOL:/r" -- 'sed "s/^/    /" /r/backup/stage/meta/INFO.txt'
echo

if [ ! -f "$ENV_FILE" ]; then
  if helper_sh "$STAGE_VOL:/r" -- 'test -s /r/backup/stage/config/.env'; then
    helper_sh "$STAGE_VOL:/r" -- 'cat /r/backup/stage/config/.env' > "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    log ".env aus dem Snapshot nach $ENV_FILE gelegt (Rechte 600)"
  else
    die "$ENV_FILE fehlt. Die .env (insbesondere EMAIL_ENCRYPTION_KEY, NEXTAUTH_SECRET, Passwörter) aus der getrennten Verwahrung zurücklegen (Handbuch Kap. 21) – nichts verändert"
  fi
fi

echo "Ziel: Compose-Projekt '$PROJECT' in $PROJECT_DIR"
echo "Die aktuelle Datenbank und ALLE Dateien in MinIO werden durch den Snapshot ersetzt."
if [ "$YES" -ne 1 ]; then
  printf 'Fortfahren? Zum Bestätigen "ja" eingeben: '
  read -r answer || answer=""
  [ "$answer" = "ja" ] || die "abgebrochen, nichts verändert"
fi

# ── 2. Anwendung anhalten ────────────────────────────────────────────────────
if [ -n "$APP_SERVICES" ]; then
  log "2/6 Halte an: $APP_SERVICES"
  # shellcheck disable=SC2086
  dc stop $APP_SERVICES >/dev/null 2>&1 || true
fi

# ── 3. Datenbank ─────────────────────────────────────────────────────────────
log "3/6 Datenbank starten und auf Bereitschaft warten"
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
# Sicherung entstanden sind.
TMP_DB="${DB_NAME}_restore"
psql_admin() { dc exec -T -e PGOPTIONS="-c client_min_messages=warning" db psql -U "$DB_USER" -d postgres -XAtq -v ON_ERROR_STOP=1 -c "$1"; }
log "    pg_restore in frische Datenbank $TMP_DB (eine Transaktion)"
psql_admin "DROP DATABASE IF EXISTS \"$TMP_DB\";" >/dev/null
psql_admin "CREATE DATABASE \"$TMP_DB\" OWNER \"$DB_USER\";" >/dev/null
if ! helper_sh "$STAGE_VOL:/r:ro" -- 'cat /r/backup/stage/db/db.dump' \
    | dc exec -T db pg_restore -U "$DB_USER" -d "$TMP_DB" --clean --if-exists \
        --no-owner --single-transaction --exit-on-error; then
  psql_admin "DROP DATABASE IF EXISTS \"$TMP_DB\";" >/dev/null 2>&1 || true
  die "pg_restore fehlgeschlagen – bisherige Datenbank unverändert. app/worker sind angehalten (Start: docker compose up -d $APP_SERVICES)"
fi
log "    ersetze Datenbank $DB_NAME durch den wiederhergestellten Stand"
psql_admin "DROP DATABASE IF EXISTS \"$DB_NAME\" WITH (FORCE);" >/dev/null
psql_admin "ALTER DATABASE \"$TMP_DB\" RENAME TO \"$DB_NAME\";" >/dev/null

# ── 4. MinIO-Dateien ─────────────────────────────────────────────────────────
log "4/6 MinIO-Volume ersetzen"
dc stop minio >/dev/null 2>&1 || true
# Auf einem neuen Server legt "create" Container und Volume an, ohne zu starten
MINIO_VOL=$(find_volume miniodata) || { dc create minio >/dev/null 2>&1 || true; MINIO_VOL=$(find_volume miniodata); } \
  || die "Volume miniodata des Projekts $PROJECT nicht gefunden"
helper_sh "$STAGE_VOL:/r:ro" "$MINIO_VOL:/data" -- \
  'set -e; find /data -mindepth 1 -maxdepth 1 -exec rm -rf {} +; cp -a /r/backup/minio/. /data/'
log "    starte MinIO (minio-init setzt Besitzrechte auf UID 65532)"
quiet dc up -d --wait minio

# ── 5. Suchindex verwerfen, Anwendung starten ────────────────────────────────
log "5/6 Meilisearch-Index verwerfen, Anwendung starten"
quiet dc up -d --wait meilisearch
if dc exec -T meilisearch sh -c \
    'curl -fsS -o /dev/null -X DELETE -H "Authorization: Bearer $MEILI_MASTER_KEY" http://localhost:7700/indexes/dokumente'; then
  log "    Index 'dokumente' verworfen"
else
  log "    Index 'dokumente' war nicht vorhanden"
fi
if [ -n "$APP_SERVICES" ]; then
  log "    starte: $APP_SERVICES (wartet auf Bereitschaft, beim ersten Start mit Migrationen)"
  # shellcheck disable=SC2086
  quiet dc up -d --wait --wait-timeout 900 $APP_SERVICES \
    || die "Daten wiederhergestellt, aber $APP_SERVICES starten nicht – docker compose logs prüfen"
fi

# ── 6. Suchindex neu aufbauen ────────────────────────────────────────────────
if [ "$REINDEX" = 1 ]; then
  log "6/6 Suchindex neu aufbauen (Dienst $REINDEX_SERVICE)"
  dc exec -T "$REINDEX_SERVICE" test -f dist-worker/reindex-suche.mjs \
    || die "Daten wiederhergestellt, aber das Image von $REINDEX_SERVICE enthält dist-worker/reindex-suche.mjs nicht (zu alt). Neu bauen und Index aufbauen: docker compose build app worker && docker compose up -d app worker && docker compose exec app node dist-worker/reindex-suche.mjs"
  n=0
  until OUT=$(dc exec -T "$REINDEX_SERVICE" node dist-worker/reindex-suche.mjs 2>&1) \
        && printf '%s\n' "$OUT" | grep -q '^REINDEX_OK '; do
    printf '%s\n' "$OUT" | sed 's/^/    /' >&2
    n=$((n + 1))
    [ "$n" -lt "$REINDEX_TRIES" ] \
      || die "Daten wiederhergestellt, Suchindex-Neuaufbau aber fehlgeschlagen. Erneut: docker compose exec $REINDEX_SERVICE node dist-worker/reindex-suche.mjs"
    log "    Versuch $n fehlgeschlagen, neuer Versuch in 10 s"
    sleep 10
  done
  printf '%s\n' "$OUT" | grep -v '^REINDEX_OK ' | sed 's/^/    /'
  INDEXED=$(printf '%s\n' "$OUT" | sed -n 's/^REINDEX_OK indexiert=\([0-9]*\).*/\1/p')
  log "    $INDEXED Dokument(e) im Suchindex"
else
  log "6/6 REINDEX=0 – Suchindex NICHT neu aufgebaut (nachholen: docker compose exec app node dist-worker/reindex-suche.mjs)"
fi

log "Wiederherstellung fertig in $((SECONDS - START)) s."
cat <<'EOF'

Bitte prüfen:
  1. EMAIL_ENCRYPTION_KEY in der .env muss dem Stand der Sicherung entsprechen,
     sonst lassen sich gespeicherte Zugangsdaten und 2FA-Geheimnisse nicht entschlüsseln.
  2. Stichprobe: anmelden, Akte öffnen, Dokument herunterladen, Volltextsuche testen.
EOF
