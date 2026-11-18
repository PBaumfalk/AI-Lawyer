#!/usr/bin/env bash
# AI-Lawyer – Rundlauftest für scripts/backup.sh und scripts/restore.sh
#
# Startet nur db, minio-init, minio und meilisearch unter dem eigenen Projektnamen
# "ailawyer-backuptest" (eigene Volumes, eigene Containernamen, keine Host-Ports,
# Wegwerf-.env). Eine laufende Installation wird nicht berührt.
#
# Ablauf:
#   1. Testdaten anlegen (Tabelle mit pgvector-Spalte, Objekt in MinIO)
#   2. Sichern (inkl. Aufbewahrungsregel und .env-Kopie prüfen)
#   3. Beschädigte Sicherung muss abgelehnt werden
#   4. Daten verändern, Wiederherstellung über den laufenden Bestand, vergleichen
#   5. Volumes löschen (Totalverlust), Wiederherstellung auf leeren Bestand, vergleichen
#   6. Alles abräumen
#
# Exit-Code 0 nur, wenn alle Prüfungen bestanden sind.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
PROJECT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
cd "$PROJECT_DIR"

TEST_PROJECT=ailawyer-backuptest
WORK=$(mktemp -d "${TMPDIR:-/tmp}/ailawyer-backuptest.XXXXXX")

export COMPOSE_PROJECT_NAME=$TEST_PROJECT
export COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml:$SCRIPT_DIR/docker-compose.backuptest.yml"
export COMPOSE_ENV_FILES="$WORK/.env"      # ersetzt die .env im Projektordner
export ENV_FILE="$WORK/.env"
export BACKUP_DIR="$WORK/backups"
export APP_SERVICES=""                      # app/worker gibt es im Test nicht

log()  { printf '\n[test %s] %s\n' "$(date '+%H:%M:%S')" "$*"; }
fail() { printf '\n[test] FEHLGESCHLAGEN: %s\n' "$*" >&2; exit 1; }
dc()   { docker compose "$@"; }

cleanup() {
  rc=$?
  [ "$COMPOSE_PROJECT_NAME" = "$TEST_PROJECT" ] || { echo "Projektname verändert – räume nicht ab" >&2; exit 1; }
  log "Aufräumen (Projekt $TEST_PROJECT, Container und Volumes)"
  dc down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$WORK"
  if [ "$rc" -eq 0 ]; then echo "ERGEBNIS: BESTANDEN"; else echo "ERGEBNIS: FEHLGESCHLAGEN (Exit $rc)"; fi
  exit "$rc"
}
trap cleanup EXIT

rnd() { od -An -N16 -tx1 /dev/urandom | tr -d ' \n'; }
if command -v sha256sum >/dev/null 2>&1; then SHA="sha256sum"; else SHA="shasum -a 256"; fi

# Wegwerf-Konfiguration (nur Werte, die die Compose-Datei verlangt)
cat > "$WORK/.env" <<EOF
POSTGRES_PASSWORD=$(rnd)
REDIS_PASSWORD=$(rnd)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$(rnd)
EMAIL_ENCRYPTION_KEY=$(rnd)$(rnd)
MINIO_ACCESS_KEY=backuptest
MINIO_SECRET_KEY=$(rnd)
MEILISEARCH_API_KEY=$(rnd)
ONLYOFFICE_SECRET=$(rnd)
EOF
chmod 600 "$WORK/.env"

psql_q() { dc exec -T db psql -U ailawyer -d ailawyer -XAtq -v ON_ERROR_STOP=1 -c "$1"; }
# mc im MinIO-Container; Zugangsdaten kommen aus dessen Umgebung
mc_run() { dc exec -T minio sh -c 'export MC_HOST_t="http://${MINIO_ROOT_USER}:${MINIO_ROOT_PASSWORD}@127.0.0.1:9000"; '"$1"; }
meili() { dc exec -T meilisearch sh -c 'curl -sS -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $MEILI_MASTER_KEY" '"$1"; }
wait_db() {
  i=0
  until dc exec -T db pg_isready -h 127.0.0.1 -U ailawyer -d ailawyer >/dev/null 2>&1; do
    i=$((i + 1)); [ "$i" -le 60 ] || fail "db nicht bereit"; sleep 2
  done
}
snapshot() {
  # Zustand von Datenbank und MinIO als Text
  psql_q "SELECT id, txt, emb::text FROM backup_test ORDER BY id"
  mc_run 'mc ls --recursive t/dokumente' | awk '{print $NF}' | sort
  mc_run 'mc cat t/dokumente/akten/test/blob.bin' | $SHA | cut -d' ' -f1
}

dc down -v --remove-orphans >/dev/null 2>&1 || true   # Reste eines abgebrochenen Laufs

log "Starte db, minio und meilisearch (Projekt $TEST_PROJECT)"
dc up -d --wait db minio meilisearch
wait_db

log "1. Testdaten anlegen"
psql_q "CREATE EXTENSION IF NOT EXISTS vector;
        CREATE TABLE backup_test (id int PRIMARY KEY, txt text, emb vector(3));
        INSERT INTO backup_test VALUES (1, 'Prüfung äöüß € – Originalzustand', '[1,2,3]');"
head -c 1048576 /dev/urandom > "$WORK/blob.bin"
mc_run 'mc mb --ignore-existing t/dokumente >/dev/null && mc pipe t/dokumente/akten/test/blob.bin >/dev/null' < "$WORK/blob.bin"
BLOB_SHA=$($SHA "$WORK/blob.bin" | cut -d' ' -f1)
EXPECTED=$(snapshot)
printf '%s\n' "$EXPECTED" | sed 's/^/    /'
printf '%s\n' "$EXPECTED" | grep -q "$BLOB_SHA" || fail "Testobjekt nicht korrekt in MinIO"

log "2. Sichern (BACKUP_KEEP=2, zwei alte Attrappen vorhanden)"
for d in 20000101-000000 20000102-000000; do mkdir -p "$BACKUP_DIR/$d"; : > "$BACKUP_DIR/$d/SHA256SUMS"; done
T0=$SECONDS
BACKUP_KEEP=2 "$SCRIPT_DIR/backup.sh"
BACKUP_SECS=$((SECONDS - T0))
BK=$(cd "$BACKUP_DIR" && ls -d 2[0-9]*-* | grep -v '^2000' | tail -n1)
[ -n "$BK" ] || fail "kein Sicherungsordner entstanden"
BK="$BACKUP_DIR/$BK"
ls -la "$BK" | sed 's/^/    /'
[ ! -d "$BACKUP_DIR/20000101-000000" ] || fail "Aufbewahrung: älteste Sicherung nicht entfernt"
[ -d "$BACKUP_DIR/20000102-000000" ] || fail "Aufbewahrung: zu viel entfernt"
cmp -s "$WORK/.env" "$BK/.env" || fail ".env-Kopie weicht ab"
[ "$(ls -l "$BK/.env" | cut -c1-10)" = "-rw-------" ] || fail ".env-Kopie hat nicht die Rechte 600"
echo "    Aufbewahrung und .env-Kopie: ok"

log "3. Beschädigte Sicherung muss abgelehnt werden"
cp -R "$BK" "$WORK/kaputt"
printf 'x' >> "$WORK/kaputt/minio.tar.gz"
if "$SCRIPT_DIR/restore.sh" --yes "$WORK/kaputt" > "$WORK/kaputt.log" 2>&1; then
  fail "restore.sh hat eine beschädigte Sicherung akzeptiert"
fi
grep -q "Prüfsummen stimmen nicht" "$WORK/kaputt.log" || { cat "$WORK/kaputt.log"; fail "unerwartete Fehlermeldung"; }
echo "    abgelehnt: ok"

log "4. Daten verändern und über den laufenden Bestand wiederherstellen"
psql_q "UPDATE backup_test SET txt = 'verändert' WHERE id = 1;
        INSERT INTO backup_test VALUES (2, 'nach der Sicherung', '[0,0,0]');
        CREATE TABLE nach_sicherung (x int);"
echo "neu" | mc_run 'mc pipe t/dokumente/akten/test/neu.txt >/dev/null'
meili "-X POST -H 'Content-Type: application/json' --data '{\"uid\":\"dokumente\",\"primaryKey\":\"id\"}' http://localhost:7700/indexes" >/dev/null
i=0; until [ "$(meili http://localhost:7700/indexes/dokumente)" = "200" ]; do
  i=$((i + 1)); [ "$i" -le 30 ] || fail "Meilisearch-Index nicht angelegt"; sleep 1; done
[ "$(snapshot)" != "$EXPECTED" ] || fail "Veränderung hat nicht gegriffen"
T0=$SECONDS
"$SCRIPT_DIR/restore.sh" --yes "$BK"
RESTORE1_SECS=$((SECONDS - T0))
wait_db
ACTUAL=$(snapshot)
[ "$ACTUAL" = "$EXPECTED" ] || { printf 'erwartet:\n%s\nerhalten:\n%s\n' "$EXPECTED" "$ACTUAL"; fail "Zustand nach Wiederherstellung (laufend) weicht ab"; }
echo "    Zustand identisch mit Sicherung: ok"
LEFT=$(psql_q "SELECT count(*) FROM pg_tables WHERE tablename = 'nach_sicherung'")
[ "$LEFT" = "0" ] || fail "nach der Sicherung angelegte Tabelle ist noch vorhanden"
echo "    nach der Sicherung angelegte Tabelle entfernt: ok"
i=0; until [ "$(meili http://localhost:7700/indexes/dokumente)" = "404" ]; do
  i=$((i + 1)); [ "$i" -le 30 ] || fail "Meilisearch-Index wurde nicht verworfen"; sleep 1; done
echo "    Meilisearch-Index verworfen: ok"

log "5. Totalverlust: Container und Volumes löschen, dann wiederherstellen"
dc down -v >/dev/null 2>&1
if docker volume ls -q | grep -q "^${TEST_PROJECT}_"; then fail "Test-Volumes noch vorhanden"; fi
echo "    Volumes von $TEST_PROJECT gelöscht"
T0=$SECONDS
"$SCRIPT_DIR/restore.sh" --yes "$BK"
RESTORE2_SECS=$((SECONDS - T0))
wait_db
ACTUAL=$(snapshot)
[ "$ACTUAL" = "$EXPECTED" ] || { printf 'erwartet:\n%s\nerhalten:\n%s\n' "$EXPECTED" "$ACTUAL"; fail "Zustand nach Wiederherstellung (leer) weicht ab"; }
echo "    Zustand identisch mit Sicherung: ok"
printf '%s\n' "$ACTUAL" | sed 's/^/    /'

log "Dauer: Sicherung ${BACKUP_SECS} s, Wiederherstellung laufend ${RESTORE1_SECS} s, nach Totalverlust ${RESTORE2_SECS} s"
