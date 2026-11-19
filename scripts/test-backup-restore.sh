#!/usr/bin/env bash
# AI-Lawyer – Rundlauftest für scripts/backup.sh und scripts/restore.sh
#
# Alles läuft isoliert unter eigenen Namen (Projekt "ailawyer-backuptest",
# Container/Volumes/Netz mit Präfix ailawyer-backuptest-, keine Host-Ports außer
# einem zufälligen auf 127.0.0.1 für den Benachrichtigungsempfänger, Wegwerf-.env,
# Wegwerf-Schlüssel). Eine laufende Installation wird nicht berührt.
#
#   - db, minio, meilisearch aus docker-compose.yml
#   - "reindexer": Stellvertreter des App-Containers mit demselben Bundle
#     dist-worker/reindex-suche.mjs (scripts/backuptest-reindexer.Dockerfile)
#   - ein ZWEITER, separater MinIO-Container als S3-Sicherungsziel (Stellvertreter
#     für den externen Speicher; belegt die S3-Anbindung, ist aber kein anderes Gerät)
#
# Ablauf:
#   0. Bundle bauen, Image bauen, S3-Ziel starten, Stack starten, Migrationen
#   1. Testdaten: Tabelle mit pgvector-Spalte, Benutzer/Akte/Dokument mit
#      durchsuchbarem Text, Objekt in MinIO, Suchindex
#   2. backup.sh init (Schlüssel erzeugen, Repository anlegen), zwei Sicherungen,
#      Aufbewahrung, Statusdatei, backup-status.sh, Benachrichtigung
#   3. Negativtest: Sicherung mit falschem Schlüssel → Exit != 0, Status "fehler", /fail-Ping
#   4. Daten verändern, Wiederherstellung (--snapshot <ID>) über den laufenden Bestand
#   5. Negativtest: Wiederherstellung mit falschem Schlüssel → Abbruch, nichts verändert
#   6. Totalverlust (Volumes + restic-Cache weg), Wiederherstellung (latest),
#      Vergleich und Suche OHNE manuellen Reindex
#   7. Negativtest: Repository-Objekt im S3-Ziel manipulieren → restic check
#      --read-data meldet Fehler, Wiederherstellung bricht ohne Änderung ab
#   8. Alles abräumen
#
# Voraussetzungen: Docker, node_modules im Projektordner (npm ci) für den Bundle-Build.
# Exit-Code 0 nur, wenn alle Prüfungen bestanden sind.

# Befehle für Container stehen absichtlich in einfachen Anführungszeichen
# (werden dort ausgewertet, nicht hier):
# shellcheck disable=SC2016
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
PROJECT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
cd "$PROJECT_DIR"

TEST_PROJECT=ailawyer-backuptest
P=$TEST_PROJECT
WORK=$(mktemp -d "${TMPDIR:-/tmp}/ailawyer-backuptest.XXXXXX")
WORK=$(cd "$WORK" && pwd -P)
S3_NAME=$P-s3
S3_NET=$P-s3net
S3_VOL=$P-s3data
HC_NAME=$P-hc
CACHE_VOL=$P-restic-cache
IMAGE=$P-reindexer:local

export COMPOSE_PROJECT_NAME=$TEST_PROJECT
export COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml:$SCRIPT_DIR/docker-compose.backuptest.yml"
export COMPOSE_ENV_FILES="$WORK/.env"      # ersetzt die .env im Projektordner
export ENV_FILE="$WORK/.env"
export BACKUP_CONFIG="$WORK/backup.env"
export RESTIC_PASSWORD_FILE="$WORK/keys/backup.key"
export RESTIC_CACHE_VOLUME=$CACHE_VOL
export BACKUP_DOCKER_NETWORK=$S3_NET
export BACKUP_STATE_DIR="$WORK/state"
export BACKUP_HOSTNAME=backuptest
export APP_SERVICES=reindexer
export REINDEX_SERVICE=reindexer
export REINDEX_TRIES=2

log()  { printf '\n[test %s] %s\n' "$(date '+%H:%M:%S')" "$*"; }
ok()   { printf '    ok: %s\n' "$*"; }
fail() { printf '\n[test] FEHLGESCHLAGEN: %s\n' "$*" >&2; exit 1; }
dc()   { docker compose "$@"; }
TIMES=""
timed() { # timed <name> <befehl...>
  local name=$1 t0=$SECONDS; shift
  "$@"
  TIMES="$TIMES$(printf '    %-48s %4d s' "$name" $((SECONDS - t0)))"$'\n'
}

cleanup() {
  rc=$?
  set +e
  [ "$COMPOSE_PROJECT_NAME" = "$TEST_PROJECT" ] || { echo "Projektname verändert – räume nicht ab" >&2; exit 1; }
  log "Aufräumen (nur Objekte mit Präfix $P)"
  dc down -v --remove-orphans >/dev/null 2>&1
  docker rm -f "$S3_NAME" "$HC_NAME" >/dev/null 2>&1
  docker volume rm -f "$S3_VOL" "$CACHE_VOL" "${P}_backup-staging" "${P}_restore-staging" >/dev/null 2>&1
  docker network rm "$S3_NET" >/dev/null 2>&1
  [ "${KEEP_IMAGE:-0}" = 1 ] || docker rmi "$IMAGE" >/dev/null 2>&1
  rm -rf "$WORK"
  if [ -n "$TIMES" ]; then printf '\nLaufzeiten:\n%s' "$TIMES"; fi
  if [ "$rc" -eq 0 ]; then echo "ERGEBNIS: BESTANDEN"; else echo "ERGEBNIS: FEHLGESCHLAGEN (Exit $rc)"; fi
  exit "$rc"
}
trap cleanup EXIT

rnd() { od -An -N16 -tx1 /dev/urandom | tr -d ' \n'; }
if command -v sha256sum >/dev/null 2>&1; then SHA="sha256sum"; else SHA="shasum -a 256"; fi

[ -d node_modules ] || fail "node_modules fehlt – vorher npm ci ausführen"

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

# S3-Ziel: eigene Zugangsdaten, nur über --env-file
S3_USER=restic-$(rnd | cut -c1-8)
S3_PASS=$(rnd)
printf 'MINIO_ROOT_USER=%s\nMINIO_ROOT_PASSWORD=%s\n' "$S3_USER" "$S3_PASS" > "$WORK/s3.env"
cat > "$BACKUP_CONFIG" <<EOF
# Testkonfiguration (Format docker --env-file)
RESTIC_REPOSITORY=s3:http://$S3_NAME:9000/restic-repo/ai-lawyer
AWS_ACCESS_KEY_ID=$S3_USER
AWS_SECRET_ACCESS_KEY=$S3_PASS
BACKUP_KEEP_DAILY=7
BACKUP_KEEP_WEEKLY=5
BACKUP_KEEP_MONTHLY=12
EOF
chmod 600 "$BACKUP_CONFIG" "$WORK/s3.env"

psql_q() { dc exec -T db psql -U ailawyer -d ailawyer -XAtq -v ON_ERROR_STOP=1 -c "$1"; }
mc_run() { dc exec -T minio sh -c 'export MC_HOST_t="http://${MINIO_ROOT_USER}:${MINIO_ROOT_PASSWORD}@127.0.0.1:9000"; '"$1"; }
s3_mc()  { docker exec -i "$S3_NAME" sh -c 'export MC_HOST_s="http://${MINIO_ROOT_USER}:${MINIO_ROOT_PASSWORD}@127.0.0.1:9000"; '"$1"; }
search() { # search <wort> → JSON-Antwort von Meilisearch
  dc exec -T meilisearch sh -c 'curl -sS -X POST -H "Authorization: Bearer $MEILI_MASTER_KEY" -H "Content-Type: application/json" --data "{\"q\":\"$0\"}" http://localhost:7700/indexes/dokumente/search' "$1"
}
wait_db() {
  local i=0
  until dc exec -T db pg_isready -h 127.0.0.1 -U ailawyer -d ailawyer >/dev/null 2>&1; do
    i=$((i + 1)); [ "$i" -le 60 ] || fail "db nicht bereit"; sleep 2
  done
}
state() {
  # Zustand von Datenbank und MinIO als Text
  psql_q "SELECT id, txt, emb::text FROM backup_test ORDER BY id"
  psql_q "SELECT 'dokumente', count(*), md5(coalesce(string_agg(d::text, '|' ORDER BY d.id), '')) FROM dokumente d"
  psql_q "SELECT 'akten', count(*), md5(coalesce(string_agg(a::text, '|' ORDER BY a.id), '')) FROM akten a"
  mc_run 'mc ls --recursive t/dokumente' | awk '{print $NF}' | sort
  mc_run 'mc cat t/dokumente/akten/bt-1/beweis.bin' | $SHA | cut -d' ' -f1
}
expect_same() { # expect_same <erwartet> <kontext>
  local actual; actual=$(state)
  [ "$actual" = "$1" ] || { printf 'erwartet:\n%s\nerhalten:\n%s\n' "$1" "$actual"; fail "Zustand weicht ab ($2)"; }
}

dc down -v --remove-orphans >/dev/null 2>&1 || true   # Reste eines abgebrochenen Laufs
docker rm -f "$S3_NAME" "$HC_NAME" >/dev/null 2>&1 || true
docker volume rm -f "$S3_VOL" "$CACHE_VOL" >/dev/null 2>&1 || true

# ── 0. Vorbereitung ──────────────────────────────────────────────────────────
log "0. Bundle dist-worker/reindex-suche.mjs bauen (wie im Dockerfile)"
build_bundle() { npx tsx scripts/build-worker.ts > "$WORK/build.log" 2>&1 || { cat "$WORK/build.log"; fail "Bundle-Build fehlgeschlagen"; }; }
timed "Bundle bauen" build_bundle
mkdir -p "$WORK/ctx/dist-worker"
cp -R prisma "$WORK/ctx/prisma"
cp dist-worker/reindex-suche.mjs "$WORK/ctx/dist-worker/"
PRISMA_VERSION=$(node -p 'require("./node_modules/prisma/package.json").version')
build_image() { docker build -q -t "$IMAGE" --build-arg "PRISMA_VERSION=$PRISMA_VERSION" -f "$SCRIPT_DIR/backuptest-reindexer.Dockerfile" "$WORK/ctx" >/dev/null; }
timed "Reindexer-Image bauen (Prisma $PRISMA_VERSION)" build_image

log "   S3-Sicherungsziel als separater Container $S3_NAME (Netz $S3_NET)"
MINIO_IMAGE=$(dc config --images 2>/dev/null | grep -i minio | head -n1)
docker network create "$S3_NET" >/dev/null
docker run -d --name "$S3_NAME" --network "$S3_NET" --env-file "$WORK/s3.env" \
  -v "$S3_VOL:/data" "$MINIO_IMAGE" server /data >/dev/null
i=0; until docker exec "$S3_NAME" mc ready local >/dev/null 2>&1; do
  i=$((i + 1)); [ "$i" -le 30 ] || fail "S3-Ziel startet nicht"; sleep 1; done
s3_mc 'mc mb s/restic-repo >/dev/null'
ok "Bucket restic-repo angelegt"

log "   Benachrichtigungsempfänger (protokolliert nur Aufrufe)"
docker run -d --name "$HC_NAME" -p 127.0.0.1::8000 python:3.12-slim-bookworm python -u -c '
import http.server as h
class H(h.BaseHTTPRequestHandler):
    def antwort(self):
        self.rfile.read(int(self.headers.get("Content-Length") or 0))
        self.send_response(200); self.end_headers()
    do_GET = do_POST = antwort
h.HTTPServer(("", 8000), H).serve_forever()' >/dev/null
HC_PORT=$(docker port "$HC_NAME" 8000/tcp | head -n1 | sed 's/.*://')
HC_PATH="/ping/$(rnd)"
echo "BACKUP_HEALTHCHECK_URL=http://127.0.0.1:$HC_PORT$HC_PATH" >> "$BACKUP_CONFIG"
hc_log() { docker logs "$HC_NAME" 2>&1 | grep -o "\"[A-Z]* ${HC_PATH}[^ ]*" | tr -d '"' || true; }

log "   Stack starten: db, minio, meilisearch, reindexer (Projekt $TEST_PROJECT)"
start_stack() { dc up -d --wait db minio meilisearch reindexer >/dev/null 2>&1 || dc up -d --wait db minio meilisearch reindexer; }
timed "Stack starten" start_stack
wait_db
migrate() {
  dc exec -T reindexer node node_modules/prisma/build/index.js migrate deploy > "$WORK/migrate.log" 2>&1 \
    || { cat "$WORK/migrate.log"; fail "prisma migrate deploy fehlgeschlagen"; }
  dc exec -T reindexer node prisma/apply-manual-migrations.js >> "$WORK/migrate.log" 2>&1 \
    || { cat "$WORK/migrate.log"; fail "manuelle Migrationen fehlgeschlagen"; }
}
timed "Migrationen (wie docker-entrypoint.sh)" migrate
ok "$(psql_q "SELECT count(*) FROM pg_tables WHERE schemaname='public'") Tabellen angelegt"

# ── 1. Testdaten ─────────────────────────────────────────────────────────────
log "1. Testdaten anlegen"
WORT="Quokkabeweis$(rnd | cut -c1-6)"
psql_q "CREATE EXTENSION IF NOT EXISTS vector;
        CREATE TABLE backup_test (id int PRIMARY KEY, txt text, emb vector(3));
        INSERT INTO backup_test VALUES (1, 'Prüfung äöüß € – Originalzustand', '[1,2,3]');"
DOC_ID=$(dc exec -T -e WORT="$WORT" reindexer node -e '
  const { PrismaClient } = require("@prisma/client");
  const p = new PrismaClient();
  (async () => {
    const u = await p.user.create({ data: { email: "backuptest@example.invalid", name: "Erika Sicherung", passwordHash: "x" } });
    const a = await p.akte.create({ data: { aktenzeichen: "BT-1/26", kurzrubrum: "Sicherung ./. Totalverlust" } });
    const d = await p.dokument.create({ data: {
      akteId: a.id, createdById: u.id, name: "Zeugenaussage.pdf", dateipfad: "akten/bt-1/beweis.bin",
      mimeType: "application/pdf", groesse: 1048576,
      ocrText: "Die Zeugin bestätigt den " + process.env.WORT + " vom 3. März." } });
    console.log(d.id);
    await p.$disconnect();
  })().catch((e) => { console.error(e); process.exit(1); });')
[ -n "$DOC_ID" ] || fail "Dokument nicht angelegt"
head -c 1048576 /dev/urandom > "$WORK/beweis.bin"
mc_run 'mc mb --ignore-existing t/dokumente >/dev/null && mc pipe t/dokumente/akten/bt-1/beweis.bin >/dev/null' < "$WORK/beweis.bin"
BLOB_SHA=$($SHA "$WORK/beweis.bin" | cut -d' ' -f1)
dc exec -T reindexer node dist-worker/reindex-suche.mjs | sed 's/^/    /'
search "$WORT" | grep -q "\"id\":\"$DOC_ID\"" || fail "Testdokument vor der Sicherung nicht im Suchindex"
EXPECTED=$(state)
printf '%s\n' "$EXPECTED" | sed 's/^/    /'
printf '%s\n' "$EXPECTED" | grep -q "$BLOB_SHA" || fail "Testobjekt nicht korrekt in MinIO"
ok "Dokument $DOC_ID mit Suchwort $WORT, Objekt sha256 ${BLOB_SHA:0:16}…"

# ── 2. Sichern ───────────────────────────────────────────────────────────────
log "2. Repository einrichten (backup.sh init erzeugt Schlüssel) und sichern"
"$SCRIPT_DIR/backup.sh" init 2>&1 | grep -v '^\s*cat ' | sed 's/^/    /'
[ -s "$RESTIC_PASSWORD_FILE" ] || fail "Schlüsseldatei nicht erzeugt"
mode=$(stat -c '%a' "$RESTIC_PASSWORD_FILE" 2>/dev/null || stat -f '%Lp' "$RESTIC_PASSWORD_FILE")
[ "$mode" = 600 ] || fail "Schlüsseldatei hat Rechte $mode statt 600"
ok "Schlüsseldatei mit Rechten 600"
chmod 644 "$RESTIC_PASSWORD_FILE"
if "$SCRIPT_DIR/backup.sh" snapshots > "$WORK/perm.log" 2>&1; then fail "Schlüsseldatei mit Rechten 644 wurde akzeptiert"; fi
grep -q "Rechte 644" "$WORK/perm.log" || { cat "$WORK/perm.log"; fail "unerwartete Meldung bei 644"; }
chmod 600 "$RESTIC_PASSWORD_FILE"
ok "Schlüsseldatei mit Rechten 644 abgelehnt"

timed "Sicherung 1 (erste, voll)" "$SCRIPT_DIR/backup.sh" > "$WORK/backup1.log" 2>&1 \
  || { cat "$WORK/backup1.log"; fail "Sicherung 1 fehlgeschlagen"; }
sed 's/^/    /' "$WORK/backup1.log"
grep -q "$S3_PASS" "$WORK/backup1.log" && fail "S3-Passwort im Protokoll"
grep -qF "$(cat "$RESTIC_PASSWORD_FILE")" "$WORK/backup1.log" && fail "Repository-Schlüssel im Protokoll"
grep -q "$HC_PATH" "$WORK/backup1.log" && fail "Healthcheck-URL im Protokoll"
ok "keine Geheimnisse im Protokoll"
SNAP1=$(sed -n 's/^snapshot=//p' "$BACKUP_STATE_DIR/last-success")
[ -n "$SNAP1" ] || fail "last-success ohne Snapshot-ID"
sleep 1
# Aufbewahrung deterministisch prüfen: restic >= 0.17 behält bei keep-daily
# zusätzlich den ältesten Snapshot, solange es weniger Tage als verlangt gibt.
timed "Sicherung 2 (inkrementell, keep-last=1)" env BACKUP_KEEP_LAST=1 BACKUP_KEEP_DAILY=0 \
  BACKUP_KEEP_WEEKLY=0 BACKUP_KEEP_MONTHLY=0 "$SCRIPT_DIR/backup.sh" > "$WORK/backup2.log" 2>&1 \
  || { cat "$WORK/backup2.log"; fail "Sicherung 2 fehlgeschlagen"; }
grep -E 'Added to the repository|processed|snapshot .* saved|remove|keep|read-data|no errors' "$WORK/backup2.log" | sed 's/^/    /'
SNAP2=$(sed -n 's/^snapshot=//p' "$BACKUP_STATE_DIR/last-success")
[ "$SNAP2" != "$SNAP1" ] || fail "zweite Sicherung ohne neuen Snapshot"
"$SCRIPT_DIR/backup.sh" snapshots --json > "$WORK/snaps.json" 2>/dev/null
NSNAP=$(grep -o '"short_id"' "$WORK/snaps.json" | wc -l | tr -d ' ')
[ "$NSNAP" = 1 ] || fail "Aufbewahrung: $NSNAP Snapshots statt 1 (keep-last=1)"
ok "Aufbewahrung: nach 2 Sicherungen mit keep-last=1 bleibt 1 Snapshot, alter Snapshot entfernt"
sed 's/^/    /' "$BACKUP_STATE_DIR/last-success"
"$SCRIPT_DIR/backup-status.sh" | sed 's/^/    /' || fail "backup-status.sh meldet Fehler nach erfolgreicher Sicherung"
if BACKUP_MAX_AGE_HOURS=0 "$SCRIPT_DIR/backup-status.sh" >/dev/null; then fail "backup-status.sh mit Grenze 0 h nicht fehlgeschlagen"; fi
ok "backup-status.sh: aktuell → 0, zu alt → 1"
hc_log | sed 's/^/    Ping: /'
[ "$(hc_log | grep -c "^GET $HC_PATH/start")" -ge 2 ] || fail "kein Start-Ping"
[ "$(hc_log | grep -c "^POST $HC_PATH\$")" -ge 2 ] || fail "kein Erfolgs-Ping"

log "3. Negativtest: Sicherung mit falschem Schlüssel"
printf 'falsch-%s' "$(rnd)" > "$WORK/keys/wrong.key"; chmod 600 "$WORK/keys/wrong.key"
if RESTIC_PASSWORD_FILE="$WORK/keys/wrong.key" "$SCRIPT_DIR/backup.sh" > "$WORK/wrong-backup.log" 2>&1; then
  fail "Sicherung mit falschem Schlüssel meldet Erfolg"
fi
grep -q "falsches Repository-Passwort" "$WORK/wrong-backup.log" || { cat "$WORK/wrong-backup.log"; fail "Fehlermeldung unklar"; }
grep 'FEHLER\|FEHLGESCHLAGEN' "$WORK/wrong-backup.log" | sed 's/^/    /'
grep -q '^status=fehler' "$BACKUP_STATE_DIR/last-run" || fail "last-run nicht auf fehler"
[ "$(sed -n 's/^snapshot=//p' "$BACKUP_STATE_DIR/last-success")" = "$SNAP2" ] || fail "last-success wurde verändert"
if "$SCRIPT_DIR/backup-status.sh" > "$WORK/status.log"; then fail "backup-status.sh erkennt fehlgeschlagenen Lauf nicht"; fi
sed 's/^/    /' "$WORK/status.log"
hc_log | grep -q "^POST $HC_PATH/fail" || fail "kein /fail-Ping"
ok "Exit != 0, Status 'fehler', /fail-Ping, last-success unverändert"

# ── 4. Wiederherstellung über laufenden Bestand ──────────────────────────────
log "4. Daten verändern und Snapshot $SNAP2 über den laufenden Bestand wiederherstellen"
psql_q "UPDATE backup_test SET txt = 'verändert' WHERE id = 1;
        INSERT INTO backup_test VALUES (2, 'nach der Sicherung', '[0,0,0]');
        CREATE TABLE nach_sicherung (x int);
        UPDATE dokumente SET name = 'umbenannt.pdf' WHERE id = '$DOC_ID';"
echo "neu" | mc_run 'mc pipe t/dokumente/akten/bt-1/neu.txt >/dev/null'
dc exec -T reindexer node dist-worker/reindex-suche.mjs >/dev/null
search umbenannt | grep -q "\"id\":\"$DOC_ID\"" || fail "Veränderung nicht im Index"
[ "$(state)" != "$EXPECTED" ] || fail "Veränderung hat nicht gegriffen"
timed "Wiederherstellung über laufenden Bestand" "$SCRIPT_DIR/restore.sh" --yes --snapshot "$SNAP2" > "$WORK/restore1.log" 2>&1 \
  || { cat "$WORK/restore1.log"; fail "Wiederherstellung 1 fehlgeschlagen"; }
sed 's/^/    /' "$WORK/restore1.log"
wait_db
expect_same "$EXPECTED" "nach Wiederherstellung über laufenden Bestand"
ok "Zustand identisch mit Sicherung (DB-Prüfsummen, MinIO-Objekte, Objekt-sha256)"
[ "$(psql_q "SELECT count(*) FROM pg_tables WHERE tablename = 'nach_sicherung'")" = 0 ] || fail "nach der Sicherung angelegte Tabelle noch vorhanden"
ok "nach der Sicherung angelegte Tabelle entfernt"
search umbenannt | grep -q '"estimatedTotalHits":0' || fail "veralteter Indexeintrag nach Wiederherstellung"
search "$WORT" | grep -q "\"id\":\"$DOC_ID\"" || fail "Testdokument nach Wiederherstellung nicht auffindbar"
ok "Suchindex automatisch neu aufgebaut: '$WORT' gefunden, veralteter Name nicht mehr"

# ── 5. Falscher Schlüssel bei der Wiederherstellung ──────────────────────────
log "5. Negativtest: Wiederherstellung mit falschem Schlüssel"
psql_q "INSERT INTO backup_test VALUES (3, 'Marker vor Fehlversuch', '[3,3,3]');"
BEFORE=$(state)
if RESTIC_PASSWORD_FILE="$WORK/keys/wrong.key" "$SCRIPT_DIR/restore.sh" --yes > "$WORK/wrong-restore.log" 2>&1; then
  fail "Wiederherstellung mit falschem Schlüssel meldet Erfolg"
fi
grep 'FEHLER' "$WORK/wrong-restore.log" | sed 's/^/    /'
grep -q "falsches Repository-Passwort" "$WORK/wrong-restore.log" || { cat "$WORK/wrong-restore.log"; fail "Fehlermeldung unklar"; }
expect_same "$BEFORE" "nach fehlgeschlagener Wiederherstellung"
ok "sichtbar abgebrochen, Bestand unverändert"
psql_q "DELETE FROM backup_test WHERE id = 3;"

# ── 6. Totalverlust ──────────────────────────────────────────────────────────
log "6. Totalverlust: Container, Volumes und restic-Cache löschen, dann wiederherstellen"
dc down -v >/dev/null 2>&1
docker volume rm -f "$CACHE_VOL" >/dev/null
if docker volume ls -q | grep -q "^${TEST_PROJECT}_"; then fail "Test-Volumes noch vorhanden"; fi
ok "Volumes von $TEST_PROJECT und restic-Cache gelöscht; übrig: S3-Ziel, Schlüsseldatei, .env, backup.env"
timed "Wiederherstellung nach Totalverlust" "$SCRIPT_DIR/restore.sh" --yes > "$WORK/restore2.log" 2>&1 \
  || { cat "$WORK/restore2.log"; fail "Wiederherstellung 2 fehlgeschlagen"; }
sed 's/^/    /' "$WORK/restore2.log"
wait_db
expect_same "$EXPECTED" "nach Totalverlust"
ok "Zustand identisch mit Sicherung"
printf '%s\n' "$EXPECTED" | sed 's/^/    /'
HITS=$(search "$WORT")
printf '%s\n' "$HITS" | grep -q "\"id\":\"$DOC_ID\"" || { echo "$HITS"; fail "Suche findet das Testdokument nach Totalverlust nicht"; }
printf '%s\n' "$HITS" | grep -o '"estimatedTotalHits":[0-9]*' | sed 's/^/    /'
ok "Suche findet '$WORT' (Dokument $DOC_ID) ohne manuellen Reindex"

# ── 7. Manipuliertes Repository ──────────────────────────────────────────────
log "7. Negativtest: ein Datenpaket im S3-Ziel manipulieren"
PACK=$(s3_mc 'mc ls --json --recursive s/restic-repo/ai-lawyer/data/' \
  | sed -n 's/.*"size":\([0-9]*\).*"key":"\([^"]*\)".*/\1 \2/p' | sort -n | tail -n1 | cut -d" " -f2)
[ -n "$PACK" ] || fail "kein Datenpaket gefunden"
s3_mc "mc cat s/restic-repo/ai-lawyer/data/$PACK" > "$WORK/pack"
SIZE=$(wc -c < "$WORK/pack" | tr -d ' ')
# ein Byte in der Mitte invertieren
OFF=$((SIZE / 2))
B=$(dd if="$WORK/pack" bs=1 skip="$OFF" count=1 2>/dev/null | od -An -tu1 | tr -d ' ')
# shellcheck disable=SC2059 # Byte per Oktal-Escape
printf "\\$(printf '%03o' $((255 - B)))" | dd of="$WORK/pack" bs=1 seek="$OFF" conv=notrunc 2>/dev/null
s3_mc "mc pipe s/restic-repo/ai-lawyer/data/$PACK >/dev/null" < "$WORK/pack"
ok "Paket data/$PACK ($SIZE Bytes): Byte $OFF verändert"
if "$SCRIPT_DIR/backup.sh" check > "$WORK/check-struct.log" 2>&1; then
  echo "    restic check (nur Struktur): keine Fehler – erwartbar, Inhalte werden erst mit --read-data gelesen"
else
  echo "    restic check (nur Struktur): Fehler gemeldet"
fi
if "$SCRIPT_DIR/backup.sh" check --read-data > "$WORK/check.log" 2>&1; then
  cat "$WORK/check.log"; fail "restic check --read-data hat die Manipulation nicht bemerkt"
fi
grep -iE 'error|fehler|corrupt|mismatch' "$WORK/check.log" | head -n5 | sed 's/^/    /'
ok "restic check --read-data meldet Fehler (Exit != 0)"
psql_q "INSERT INTO backup_test VALUES (4, 'Marker vor Restore aus beschädigtem Repo', '[4,4,4]');"
BEFORE=$(state)
if "$SCRIPT_DIR/restore.sh" --yes > "$WORK/corrupt-restore.log" 2>&1; then
  fail "Wiederherstellung aus manipuliertem Repository meldet Erfolg"
fi
grep 'FEHLER' "$WORK/corrupt-restore.log" | sed 's/^/    /'
expect_same "$BEFORE" "nach Restore-Versuch aus manipuliertem Repository"
ok "Wiederherstellung bricht ab, Bestand unverändert"

log "Alle Prüfungen bestanden"
