#!/usr/bin/env bash
# AI-Lawyer – Datensicherung (PostgreSQL + MinIO + Kopie der .env)
#
# Aufruf (im Projektordner oder von überall):
#   scripts/backup.sh
#
# Umgebungsvariablen:
#   BACKUP_DIR            Zielordner (Standard: <Projekt>/backups)
#   BACKUP_KEEP           Anzahl aufbewahrter Sicherungen (Standard: 14, 0 = alle behalten)
#   BACKUP_STOP           1 (Standard): app, worker und minio während der Dateisicherung
#                         kurz anhalten; 0: im laufenden Betrieb sichern (nicht konsistent)
#   BACKUP_HELPER_IMAGE   Image mit tar/gzip für das Volume (Standard: pgvector/pgvector:pg16,
#                         liegt durch den Dienst db ohnehin vor)
#   ENV_FILE              zu sichernde .env (Standard: <Projekt>/.env)
#   COMPOSE_FILE, COMPOSE_PROJECT_NAME  werden von docker compose direkt ausgewertet.
#
# Ergebnis: BACKUP_DIR/<JJJJMMTT-HHMMSS>/ mit
#   db.dump        pg_dump im Custom-Format (-Fc)
#   minio.tar.gz   Inhalt des Volumes miniodata (Buckets, Versionen, MinIO-Metadaten)
#   .env           Kopie der Konfiguration (Rechte 600) – enthält Schlüssel!
#   INFO.txt       Zeitpunkt, Git-Stand, Projektname (keine Geheimnisse)
#   SHA256SUMS     Prüfsummen aller Dateien
#
# Exit-Code 0 nur, wenn alle Schritte erfolgreich waren.

set -euo pipefail
umask 077

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
PROJECT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
cd "$PROJECT_DIR"

BACKUP_DIR=${BACKUP_DIR:-$PROJECT_DIR/backups}
BACKUP_KEEP=${BACKUP_KEEP:-14}
BACKUP_STOP=${BACKUP_STOP:-1}
BACKUP_HELPER_IMAGE=${BACKUP_HELPER_IMAGE:-pgvector/pgvector:pg16}
ENV_FILE=${ENV_FILE:-$PROJECT_DIR/.env}
DB_USER=ailawyer
DB_NAME=ailawyer

log() { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"; }
die() { printf '[%s] FEHLER: %s\n' "$(date '+%H:%M:%S')" "$*" >&2; exit 1; }
dc() { docker compose "$@"; }
# Compose-Fortschrittsausgabe nur bei Fehler zeigen
quiet() { local out; if ! out=$("$@" 2>&1); then printf '%s\n' "$out" >&2; return 1; fi; }

sha256_tool() {
  if command -v sha256sum >/dev/null 2>&1; then echo "sha256sum"
  elif command -v shasum >/dev/null 2>&1; then echo "shasum -a 256"
  else die "weder sha256sum noch shasum gefunden"; fi
}

case "$BACKUP_KEEP" in ''|*[!0-9]*) die "BACKUP_KEEP muss eine Zahl sein" ;; esac
command -v docker >/dev/null 2>&1 || die "docker nicht gefunden"
SHA=$(sha256_tool)

# Projektname ohne Interpolation ermitteln (liest keine Geheimnisse aus)
PROJECT=${COMPOSE_PROJECT_NAME:-$(dc config --no-interpolate 2>/dev/null | sed -n 's/^name: //p' | head -n1)}
[ -n "$PROJECT" ] || die "Compose-Projektname nicht ermittelbar (docker compose config schlägt fehl?)"

find_volume() {
  # $1 = Volume-Name aus der Compose-Datei
  local v
  v=$(docker volume ls -q --filter "label=com.docker.compose.project=$PROJECT" \
        --filter "label=com.docker.compose.volume=$1" | head -n1)
  [ -n "$v" ] || v="${PROJECT}_$1"
  docker volume inspect "$v" >/dev/null 2>&1 || return 1
  echo "$v"
}

mkdir -p "$BACKUP_DIR"
LOCK="$BACKUP_DIR/.lock"
mkdir "$LOCK" 2>/dev/null || die "Es läuft bereits eine Sicherung ($LOCK). Falls nicht: Ordner löschen."

TS=$(date '+%Y%m%d-%H%M%S')
TARGET="$BACKUP_DIR/$TS"
PARTIAL="$TARGET.partial"
STOPPED=""
OK=0

cleanup() {
  if [ -n "$STOPPED" ]; then
    log "Starte angehaltene Dienste wieder: $STOPPED"
    # shellcheck disable=SC2086
    dc start $STOPPED >/dev/null 2>&1 || printf 'WARNUNG: Dienste %s ließen sich nicht starten – bitte prüfen!\n' "$STOPPED" >&2
    STOPPED=""
  fi
  if [ "$OK" -ne 1 ] && [ -d "$PARTIAL" ]; then
    rm -rf "$PARTIAL"
    printf 'Sicherung unvollständig, Teilergebnis %s entfernt.\n' "$PARTIAL" >&2
  fi
  rmdir "$LOCK" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT TERM

START=$SECONDS
log "Sicherung nach $TARGET (Projekt: $PROJECT)"
mkdir -p "$PARTIAL"

# ── 1. Datenbank ──────────────────────────────────────────────────────────────
dc ps --status running --services 2>/dev/null | grep -qx db \
  || die "Dienst db läuft nicht. Starten mit: docker compose up -d db"
log "1/3 Datenbank: pg_dump -Fc"
dc exec -T db pg_dump -U "$DB_USER" -Fc "$DB_NAME" > "$PARTIAL/db.dump"
[ -s "$PARTIAL/db.dump" ] || die "db.dump ist leer"
# Lesbarkeit prüfen: Inhaltsverzeichnis des Dumps muss sich auflisten lassen
dc exec -T db pg_restore -l < "$PARTIAL/db.dump" > /dev/null || die "db.dump ist nicht lesbar"
log "    db.dump: $(du -h "$PARTIAL/db.dump" | cut -f1)"

# ── 2. MinIO-Dateien ─────────────────────────────────────────────────────────
# Gesichert wird das Volume als Ganzes (tar), nicht per mc mirror: so bleiben
# Objektversionen, Bucket-Einstellungen und MinIO-interne Metadaten (.minio.sys)
# erhalten, es werden keine Zugangsdaten gebraucht und die Wiederherstellung
# ergibt exakt denselben Zustand.
MINIO_VOL=$(find_volume miniodata) || die "Volume miniodata des Projekts $PROJECT nicht gefunden"
if [ "$BACKUP_STOP" = "1" ]; then
  RUNNING=$(dc ps --status running --services 2>/dev/null || true)
  for s in app worker minio; do
    if printf '%s\n' "$RUNNING" | grep -qx "$s"; then STOPPED="$STOPPED $s"; fi
  done
  if [ -n "$STOPPED" ]; then
    log "    halte kurz an:$STOPPED"
    # shellcheck disable=SC2086
    quiet dc stop $STOPPED
  fi
else
  log "    BACKUP_STOP=0: Sicherung im laufenden Betrieb (gleichzeitige Uploads können fehlen)"
fi
log "2/3 MinIO: Volume $MINIO_VOL"
docker run --rm -v "$MINIO_VOL:/data:ro" --entrypoint tar "$BACKUP_HELPER_IMAGE" \
  czf - -C /data . > "$PARTIAL/minio.tar.gz"
if [ -n "$STOPPED" ]; then
  log "    starte wieder:$STOPPED"
  # Reihenfolge: minio zuerst und bis "healthy" abwarten, dann app/worker
  REST=""
  for s in $STOPPED; do [ "$s" = minio ] || REST="$REST $s"; done
  case "$STOPPED" in *minio*) quiet dc up -d --wait minio ;; esac
  # shellcheck disable=SC2086
  [ -z "$REST" ] || quiet dc start $REST
  STOPPED=""
fi
tar -tzf "$PARTIAL/minio.tar.gz" > /dev/null || die "minio.tar.gz ist beschädigt"
log "    minio.tar.gz: $(du -h "$PARTIAL/minio.tar.gz" | cut -f1)"

# ── 3. Konfiguration ─────────────────────────────────────────────────────────
log "3/3 Konfiguration"
if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "$PARTIAL/.env"
  chmod 600 "$PARTIAL/.env"
  log "    .env kopiert (enthält Schlüssel, u. a. EMAIL_ENCRYPTION_KEY – getrennt aufbewahren!)"
else
  log "    WARNUNG: $ENV_FILE nicht gefunden – ohne EMAIL_ENCRYPTION_KEY sind verschlüsselte Einstellungen nicht wiederherstellbar"
fi

{
  echo "erstellt:     $(date '+%Y-%m-%d %H:%M:%S %z')"
  echo "projekt:      $PROJECT"
  echo "rechner:      $(hostname)"
  echo "git:          $(git -C "$PROJECT_DIR" describe --tags --always --dirty 2>/dev/null || echo unbekannt)"
  echo "datenbank:    $DB_NAME (Benutzer $DB_USER), pg_dump -Fc"
  echo "minio-volume: $MINIO_VOL"
} > "$PARTIAL/INFO.txt"

# Prüfsummen (inkl. .env, ohne SHA256SUMS selbst)
( cd "$PARTIAL" && ls -A | grep -vx SHA256SUMS | while IFS= read -r f; do $SHA "$f"; done ) > "$PARTIAL/SHA256SUMS"
( cd "$PARTIAL" && $SHA -c SHA256SUMS > /dev/null ) || die "Prüfsummenkontrolle fehlgeschlagen"

mv "$PARTIAL" "$TARGET"
OK=1

# ── Aufbewahrung ─────────────────────────────────────────────────────────────
if [ "$BACKUP_KEEP" -gt 0 ]; then
  # nur vollständige Sicherungen dieses Skripts (Zeitstempel-Name + SHA256SUMS)
  ALL=$(cd "$BACKUP_DIR" && for d in [0-9]*-[0-9]*; do
          if [ -f "$d/SHA256SUMS" ]; then echo "$d"; fi
        done | grep -v '\.partial$' | sort; true)
  COUNT=$(printf '%s\n' "$ALL" | grep -c . || true)
  if [ "$COUNT" -gt "$BACKUP_KEEP" ]; then
    printf '%s\n' "$ALL" | head -n $((COUNT - BACKUP_KEEP)) | while IFS= read -r old; do
      [ -n "$old" ] || continue
      log "Aufbewahrung ($BACKUP_KEEP): entferne $old"
      rm -rf "${BACKUP_DIR:?}/$old"
    done
  fi
fi

log "Fertig in $((SECONDS - START)) s: $TARGET"
