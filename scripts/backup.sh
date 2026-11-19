#!/usr/bin/env bash
# AI-Lawyer – verschlüsselte Datensicherung mit restic (PostgreSQL + MinIO)
#
# Aufruf (als root bzw. Benutzer mit Docker-Rechten, im Projektordner oder von überall):
#   scripts/backup.sh [run]            Sicherung, Aufbewahrung, Prüfung (Standard)
#   scripts/backup.sh init             Schlüsseldatei erzeugen (falls fehlt) und Repository anlegen
#   scripts/backup.sh check [--read-data]   Integrität des Repositorys prüfen
#   scripts/backup.sh snapshots        vorhandene Sicherungen auflisten
#   scripts/backup.sh unlock           veraltete Sperre nach Absturz entfernen
#
# restic verschlüsselt und authentifiziert alles (AES-256-CTR + Poly1305-AES),
# bevor es das Gerät verlässt, und speichert dedupliziert. Es läuft im
# offiziellen Docker-Image, auf dem Host muss nichts installiert werden.
#
# Ablauf "run":
#   1. app und worker anhalten (BACKUP_STOP=1), pg_dump -Fc in ein Staging-Volume,
#      Lesbarkeit mit pg_restore -l prüfen, Prüfsumme bilden
#   2. minio anhalten, Snapshot von Dump + MinIO-Volume ins Repository schreiben
#   3. Dienste wieder starten (auch bei Fehlern)
#   4. Aufbewahrung: restic forget --prune (BACKUP_KEEP_*)
#   5. Prüfung: restic check, dazu --read-data-subset (BACKUP_READ_DATA_SUBSET)
#   6. Statusdatei schreiben, optional Ping an BACKUP_HEALTHCHECK_URL
#
# Konfiguration: siehe scripts/lib/backup-common.sh und Handbuch Kapitel 21.
# Zusätzlich hier:
#   BACKUP_STOP              1 (Standard): app/worker/minio während der Sicherung anhalten
#   BACKUP_INCLUDE_ENV       1: .env mit in den Snapshot legen (Standard 0 – sie enthält
#                            Schlüssel und gehört getrennt verwahrt)
#   ENV_FILE                 .env für BACKUP_INCLUDE_ENV (Standard: <Projekt>/.env)
#   BACKUP_KEEP_LAST/DAILY/WEEKLY/MONTHLY/YEARLY
#                            Aufbewahrung (Standard 0/7/5/12/0; 0 = Regel aus)
#   BACKUP_PRUNE             1 (Standard): nach forget nicht mehr benötigte Daten löschen
#   BACKUP_CHECK             1 (Standard): restic check nach jeder Sicherung
#   BACKUP_READ_DATA_SUBSET  auto (Standard: täglich 1/30 rollierend, in 30 Tagen alles),
#                            oder z. B. "5%" / "1/10"; 0 = nur Strukturprüfung
#   BACKUP_HEALTHCHECK_URL   Ping-URL (healthchecks.io-kompatibel: /start, Erfolg, /fail)
#   COMPOSE_FILE, COMPOSE_PROJECT_NAME  werden von docker compose direkt ausgewertet.
#
# Exit-Code 0 nur, wenn Sicherung, Aufbewahrung und Prüfung erfolgreich waren.

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

usage() {
  sed -n '3,9p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 2
}

CMD=${1:-run}
[ $# -eq 0 ] || shift
case "$CMD" in
  run|init|check|snapshots|unlock) ;;
  -h|--help|help) usage ;;
  *) echo "Unbekannter Befehl: $CMD" >&2; usage ;;
esac

command -v docker >/dev/null 2>&1 || die "docker nicht gefunden"
load_backup_config "$PROJECT_DIR"

# ── init ─────────────────────────────────────────────────────────────────────
if [ "$CMD" = init ]; then
  if [ ! -e "$RESTIC_PASSWORD_FILE" ]; then
    mkdir -p "$(dirname "$RESTIC_PASSWORD_FILE")"
    chmod 700 "$(dirname "$RESTIC_PASSWORD_FILE")" 2>/dev/null || true
    # 48 Zufallsbytes, Base64 (64 Zeichen), ohne Zeilenumbruch in der Mitte
    if command -v openssl >/dev/null 2>&1; then
      openssl rand -base64 48 | tr -d '\n' > "$RESTIC_PASSWORD_FILE"
    else
      head -c 48 /dev/urandom | base64 | tr -d '\n' > "$RESTIC_PASSWORD_FILE"
    fi
    chmod 600 "$RESTIC_PASSWORD_FILE"
    log "Neue Schlüsseldatei erzeugt: $RESTIC_PASSWORD_FILE (Rechte 600)"
    cat <<EOF

  WICHTIG: Ohne diesen Schlüssel sind ALLE Sicherungen unbrauchbar.
  Jetzt eine zweite Kopie getrennt vom Server verwahren, z. B.:
    - im Passwortmanager/Tresor der Kanzlei (Inhalt der Datei als Eintrag), und
    - ausgedruckt in einem verschlossenen Umschlag im Safe.
  Inhalt anzeigen (nur am Bildschirm, nicht in Tickets/Chats kopieren):
    cat $RESTIC_PASSWORD_FILE

EOF
  fi
  check_key_file
  log "Lege Repository an: $(redact_repo "$RESTIC_REPOSITORY")"
  rc=0; restic_run init || rc=$?
  [ "$rc" -eq 0 ] || die "restic init fehlgeschlagen ($(restic_error_hint "$rc")); ist das Repository schon eingerichtet, ist nichts zu tun"
  log "Repository eingerichtet. Erste Sicherung: scripts/backup.sh"
  exit 0
fi

check_key_file

case "$CMD" in
  snapshots)
    rc=0; restic_run snapshots --tag "$BACKUP_TAG" "$@" || rc=$?
    [ "$rc" -eq 0 ] || die "$(restic_error_hint "$rc")"
    exit 0 ;;
  unlock)
    restic_run unlock; exit $? ;;
  check)
    args=(check)
    if [ "${1:-}" = "--read-data" ]; then args+=(--read-data); fi
    log "Prüfe Repository $(redact_repo "$RESTIC_REPOSITORY") (${args[*]})"
    rc=0; restic_run "${args[@]}" || rc=$?
    [ "$rc" -eq 0 ] || die "restic check meldet Fehler – Repository beschädigt oder nicht erreichbar ($(restic_error_hint "$rc"))"
    log "Repository in Ordnung"
    exit 0 ;;
esac

# ── run ──────────────────────────────────────────────────────────────────────
setting BACKUP_STOP 1
setting BACKUP_INCLUDE_ENV 0
setting ENV_FILE "$PROJECT_DIR/.env"
setting BACKUP_KEEP_LAST 0
setting BACKUP_KEEP_DAILY 7
setting BACKUP_KEEP_WEEKLY 5
setting BACKUP_KEEP_MONTHLY 12
setting BACKUP_KEEP_YEARLY 0
setting BACKUP_PRUNE 1
setting BACKUP_CHECK 1
setting BACKUP_READ_DATA_SUBSET auto
setting BACKUP_READ_DATA_DAYS 30
for v in BACKUP_KEEP_LAST BACKUP_KEEP_DAILY BACKUP_KEEP_WEEKLY BACKUP_KEEP_MONTHLY BACKUP_KEEP_YEARLY BACKUP_READ_DATA_DAYS; do
  case "${!v}" in ''|*[!0-9]*) die "$v muss eine Zahl sein" ;; esac
done

DB_USER=ailawyer
DB_NAME=ailawyer
PROJECT=$(compose_project)
STAGE_VOL="${PROJECT}_backup-staging"

mkdir -p "$BACKUP_STATE_DIR" || die "Statusordner $BACKUP_STATE_DIR nicht anlegbar (BACKUP_STATE_DIR setzen?)"
LOCK="$BACKUP_STATE_DIR/.lock"
mkdir "$LOCK" 2>/dev/null || die "Es läuft bereits eine Sicherung ($LOCK). Falls nicht: Ordner löschen."

STOPPED=""
OK=0
FAIL_MSG="abgebrochen"
START=$SECONDS
SNAPSHOT_ID=""

write_status() {
  # $1 = ok|fehler, $2 = Meldung
  local now epoch tmp
  now=$(date '+%Y-%m-%dT%H:%M:%S%z'); epoch=$(date +%s)
  tmp="$BACKUP_STATE_DIR/.last-run.tmp"
  {
    echo "status=$1"
    echo "time=$now"
    echo "time_epoch=$epoch"
    echo "duration_s=$((SECONDS - START))"
    echo "message=$2"
  } > "$tmp" && mv "$tmp" "$BACKUP_STATE_DIR/last-run"
  if [ "$1" = ok ]; then
    tmp="$BACKUP_STATE_DIR/.last-success.tmp"
    {
      echo "time=$now"
      echo "time_epoch=$epoch"
      echo "snapshot=$SNAPSHOT_ID"
      echo "duration_s=$((SECONDS - START))"
    } > "$tmp" && mv "$tmp" "$BACKUP_STATE_DIR/last-success"
  fi
  chmod 644 "$BACKUP_STATE_DIR/last-run" "$BACKUP_STATE_DIR/last-success" 2>/dev/null || true
}

restart_stopped() {
  [ -n "$STOPPED" ] || return 0
  log "Starte angehaltene Dienste wieder:$STOPPED"
  local rest="" s
  for s in $STOPPED; do [ "$s" = minio ] || rest="$rest $s"; done
  case "$STOPPED" in *minio*) quiet dc up -d --wait minio || warn "minio ließ sich nicht starten – bitte prüfen!" ;; esac
  # shellcheck disable=SC2086
  [ -z "$rest" ] || quiet dc start $rest || warn "Dienste$rest ließen sich nicht starten – bitte prüfen!"
  STOPPED=""
}

cleanup() {
  local rc=$?
  set +e
  restart_stopped
  docker volume rm -f "$STAGE_VOL" >/dev/null 2>&1 || true
  if [ "$OK" -eq 1 ]; then
    write_status ok "Snapshot $SNAPSHOT_ID"
    hc_ping ok "Snapshot $SNAPSHOT_ID in $((SECONDS - START)) s"
  else
    [ "$rc" -ne 0 ] || rc=1
    write_status fehler "$FAIL_MSG"
    hc_ping fail "$FAIL_MSG"
    printf '[%s] SICHERUNG FEHLGESCHLAGEN: %s\n' "$(date '+%H:%M:%S')" "$FAIL_MSG" >&2
  fi
  rmdir "$LOCK" 2>/dev/null || true
  exit "$rc"
}
trap cleanup EXIT
trap 'FAIL_MSG="abgebrochen (Signal)"; exit 130' INT TERM

step() { FAIL_MSG=$1; log "$1"; }

hc_ping start
log "Sicherung nach $(redact_repo "$RESTIC_REPOSITORY") (Projekt: $PROJECT, Host: $BACKUP_HOSTNAME)"

step "0/5 Repository erreichbar und Schlüssel korrekt?"
rc=0; restic_run cat config >/dev/null || rc=$?
[ "$rc" -eq 0 ] || { FAIL_MSG="Repository nicht nutzbar: $(restic_error_hint "$rc")"; exit 1; }

dc ps --status running --services 2>/dev/null | grep -qx db \
  || { FAIL_MSG="Dienst db läuft nicht (docker compose up -d db)"; exit 1; }
MINIO_VOL=$(find_volume miniodata) || { FAIL_MSG="Volume miniodata des Projekts $PROJECT nicht gefunden"; exit 1; }

docker volume rm -f "$STAGE_VOL" >/dev/null 2>&1 || true
docker volume create "$STAGE_VOL" >/dev/null
helper_sh "$STAGE_VOL:/s" -- 'mkdir -p /s/db /s/meta /s/config'

RUNNING=$(dc ps --status running --services 2>/dev/null || true)
if [ "$BACKUP_STOP" = "1" ]; then
  APP_STOP=""
  for s in app worker; do
    if printf '%s\n' "$RUNNING" | grep -qx "$s"; then APP_STOP="$APP_STOP $s"; fi
  done
  if [ -n "$APP_STOP" ]; then
    log "    halte an:$APP_STOP (keine Schreibzugriffe während der Sicherung)"
    STOPPED="$APP_STOP"
    # shellcheck disable=SC2086
    quiet dc stop $APP_STOP
  fi
else
  warn "BACKUP_STOP=0: Sicherung im laufenden Betrieb – gleichzeitige Uploads können zwischen DB und Dateien auseinanderlaufen"
fi

# ── 1. Datenbank ──────────────────────────────────────────────────────────────
step "1/5 Datenbank: pg_dump -Fc"
dc exec -T db pg_dump -U "$DB_USER" -Fc "$DB_NAME" | helper_sh "$STAGE_VOL:/s" -- 'cat > /s/db/db.dump'
helper_sh "$STAGE_VOL:/s" -- '
  set -e
  test -s /s/db/db.dump
  pg_restore -l /s/db/db.dump > /dev/null
  cd /s/db && sha256sum db.dump > SHA256SUMS
  echo "    db.dump: $(du -h db.dump | cut -f1), $(pg_restore -l db.dump | grep -c " TABLE DATA ") Tabellen mit Daten"'

# ── 2. MinIO + Snapshot ──────────────────────────────────────────────────────
step "2/5 MinIO-Volume $MINIO_VOL und Snapshot schreiben"
if [ "$BACKUP_STOP" = "1" ] && printf '%s\n' "$RUNNING" | grep -qx minio; then
  log "    halte minio an (konsistenter Dateistand)"
  STOPPED="$STOPPED minio"
  quiet dc stop minio
fi
MINIO_STATS=$(helper_sh "$MINIO_VOL:/data:ro" -- 'echo "$(find /data -type f | wc -l) $(du -sk /data | cut -f1)"')
{
  echo "erstellt:      $(date '+%Y-%m-%d %H:%M:%S %z')"
  echo "projekt:       $PROJECT"
  echo "host:          $BACKUP_HOSTNAME"
  echo "git:           $(git -C "$PROJECT_DIR" describe --tags --always --dirty 2>/dev/null || echo unbekannt)"
  echo "datenbank:     $DB_NAME (Benutzer $DB_USER), pg_dump -Fc"
  echo "minio_dateien: ${MINIO_STATS% *}"
  echo "minio_kib:     ${MINIO_STATS#* }"
  echo "env_enthalten: $BACKUP_INCLUDE_ENV"
} | helper_sh "$STAGE_VOL:/s" -- 'cat > /s/meta/INFO.txt'

if [ "$BACKUP_INCLUDE_ENV" = "1" ]; then
  [ -f "$ENV_FILE" ] || { FAIL_MSG="BACKUP_INCLUDE_ENV=1, aber $ENV_FILE fehlt"; exit 1; }
  warn "BACKUP_INCLUDE_ENV=1: .env (mit Schlüsseln) wird – verschlüsselt – mitgesichert"
  helper_sh "$STAGE_VOL:/s" -- 'cat > /s/config/.env && chmod 600 /s/config/.env' < "$ENV_FILE"
fi

RESTIC_MOUNTS=(-v "$STAGE_VOL:/backup/stage:ro" -v "$MINIO_VOL:/backup/minio:ro")
OUT=$(mktemp "${TMPDIR:-/tmp}/ailawyer-backup.XXXXXX")
rc=0
restic_run backup /backup --tag "$BACKUP_TAG" --host "$BACKUP_HOSTNAME" --no-scan 2>&1 | tee "$OUT" | sed 's/^/    /' || rc=$?
SNAPSHOT_ID=$(sed -n 's/^snapshot \([0-9a-f]*\) saved.*/\1/p' "$OUT" | tail -n1)
rm -f "$OUT"
RESTIC_MOUNTS=()
[ "$rc" -eq 0 ] && [ -n "$SNAPSHOT_ID" ] || { FAIL_MSG="restic backup fehlgeschlagen: $(restic_error_hint "$rc")"; exit 1; }
restart_stopped
log "    Snapshot $SNAPSHOT_ID gespeichert, Dienste laufen wieder ($((SECONDS - START)) s)"

# ── 3. Aufbewahrung ──────────────────────────────────────────────────────────
step "3/5 Aufbewahrung (forget)"
KEEP=()
[ "$BACKUP_KEEP_LAST" -eq 0 ]    || KEEP+=(--keep-last "$BACKUP_KEEP_LAST")
[ "$BACKUP_KEEP_DAILY" -eq 0 ]   || KEEP+=(--keep-daily "$BACKUP_KEEP_DAILY")
[ "$BACKUP_KEEP_WEEKLY" -eq 0 ]  || KEEP+=(--keep-weekly "$BACKUP_KEEP_WEEKLY")
[ "$BACKUP_KEEP_MONTHLY" -eq 0 ] || KEEP+=(--keep-monthly "$BACKUP_KEEP_MONTHLY")
[ "$BACKUP_KEEP_YEARLY" -eq 0 ]  || KEEP+=(--keep-yearly "$BACKUP_KEEP_YEARLY")
if [ ${#KEEP[@]} -eq 0 ]; then
  log "    keine Aufbewahrungsregel gesetzt – alle Snapshots bleiben"
else
  PRUNE=()
  [ "$BACKUP_PRUNE" != "1" ] || PRUNE=(--prune)
  rc=0
  restic_run forget --tag "$BACKUP_TAG" --host "$BACKUP_HOSTNAME" "${KEEP[@]}" ${PRUNE[@]+"${PRUNE[@]}"} 2>&1 | sed 's/^/    /' || rc=$?
  [ "$rc" -eq 0 ] || { FAIL_MSG="restic forget fehlgeschlagen: $(restic_error_hint "$rc")"; exit 1; }
fi

# ── 4. Prüfung ───────────────────────────────────────────────────────────────
if [ "$BACKUP_CHECK" = "1" ]; then
  CHECK=(check)
  case "$BACKUP_READ_DATA_SUBSET" in
    0|"") ;;
    auto)
      n=$(( $(date +%s) / 86400 % BACKUP_READ_DATA_DAYS + 1 ))
      CHECK+=(--read-data-subset "$n/$BACKUP_READ_DATA_DAYS") ;;
    *) CHECK+=(--read-data-subset "$BACKUP_READ_DATA_SUBSET") ;;
  esac
  step "4/5 Integritätsprüfung (${CHECK[*]})"
  rc=0
  restic_run "${CHECK[@]}" 2>&1 | sed 's/^/    /' || rc=$?
  [ "$rc" -eq 0 ] || { FAIL_MSG="restic check meldet Fehler – Repository prüfen! ($(restic_error_hint "$rc"))"; exit 1; }
else
  log "4/5 BACKUP_CHECK=0 – keine Integritätsprüfung"
fi

step "5/5 Status schreiben"
OK=1
log "Fertig in $((SECONDS - START)) s: Snapshot $SNAPSHOT_ID, Status in $BACKUP_STATE_DIR/last-success"
