# shellcheck shell=bash
# AI-Lawyer – gemeinsame Funktionen für scripts/backup.sh, scripts/restore.sh
# und scripts/backup-status.sh. Wird per "source" geladen, nicht direkt ausgeführt.
#
# Konfiguration (Vorrang: Umgebungsvariable > BACKUP_CONFIG-Datei > Standard)
#
#   BACKUP_CONFIG          Datei mit Ziel und Zugangsdaten im Format von
#                          "docker run --env-file": eine Zeile KEY=wert, keine
#                          Anführungszeichen, kein "export", Kommentare nur als
#                          eigene Zeile mit #. Standard: /etc/ai-lawyer/backup.env
#   RESTIC_PASSWORD_FILE   Schlüsseldatei des Repositorys (Rechte 600, außerhalb
#                          des Projektordners). Standard: /etc/ai-lawyer/backup.key
#   RESTIC_REPOSITORY      Ziel, z. B. s3:https://s3.example.eu/bucket/ai-lawyer,
#                          sftp:backup@host:/srv/ai-lawyer, rest:https://host/ai-lawyer
#   RESTIC_IMAGE           Standard: restic/restic:0.19.1
#   RESTIC_CACHE_VOLUME    Docker-Volume für den restic-Cache (Standard: ailawyer-restic-cache)
#   BACKUP_DOCKER_NETWORK  optionales Docker-Netz für den restic-Container
#   BACKUP_SSH_DIR         für sftp:-Ziele: Ordner mit Schlüssel + known_hosts (→ /root/.ssh:ro)
#   BACKUP_HOSTNAME        Hostname in den Snapshots (Standard: hostname -s)
#   BACKUP_TAG             Tag der Snapshots (Standard: ai-lawyer)
#   BACKUP_STATE_DIR       Statusdateien für Monitoring (Standard: /var/lib/ai-lawyer/backup)
#   BACKUP_HELPER_IMAGE    Image mit sh/tar/sha256sum/pg_restore (Standard: pgvector/pgvector:pg16)
#
# Dieses Skript gibt keine Geheimnisse aus: Zugangsdaten gehen nur über
# --env-file bzw. die Schlüsseldatei (read-only eingebunden) an den Container.

BC_DEFAULT_RESTIC_IMAGE="restic/restic:0.19.1"

log()  { printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"; }
warn() { printf '[%s] WARNUNG: %s\n' "$(date '+%H:%M:%S')" "$*" >&2; }
die()  { printf '[%s] FEHLER: %s\n' "$(date '+%H:%M:%S')" "$*" >&2; exit 1; }
dc()   { docker compose "$@"; }
# Ausgabe nur bei Fehler zeigen
quiet() { local out; if ! out=$("$@" 2>&1); then printf '%s\n' "$out" >&2; return 1; fi; }

# Wert eines Schlüssels aus BACKUP_CONFIG (wörtlich, ohne Auswertung)
cfg_get() {
  [ -n "${BACKUP_CONFIG:-}" ] && [ -r "$BACKUP_CONFIG" ] || return 1
  local line
  line=$(grep -E "^[[:space:]]*$1=" "$BACKUP_CONFIG" | tail -n1) || return 1
  printf '%s' "${line#*=}"
}

# setting NAME STANDARD – Umgebung > Konfigurationsdatei > Standard
setting() {
  local name=$1 def=$2 val
  if [ -n "${!name+x}" ]; then return 0; fi
  if val=$(cfg_get "$name"); then
    printf -v "$name" '%s' "$val"
  else
    printf -v "$name" '%s' "$def"
  fi
}

file_mode() {
  # Oktalrechte einer Datei, GNU- oder BSD-stat
  stat -c '%a' "$1" 2>/dev/null || stat -f '%Lp' "$1"
}

# Repository-URL ohne Benutzer/Passwort (für Ausgaben)
redact_repo() {
  printf '%s' "$1" | sed -E 's#(://)[^/@]+@#\1***@#'
}

# Lädt und prüft die Konfiguration. $1 = Projektordner
load_backup_config() {
  local project_dir=$1
  BACKUP_CONFIG=${BACKUP_CONFIG:-/etc/ai-lawyer/backup.env}
  if [ ! -f "$BACKUP_CONFIG" ]; then
    warn "Konfigurationsdatei $BACKUP_CONFIG nicht gefunden – nur Umgebungsvariablen werden verwendet"
    BACKUP_CONFIG=""
  fi
  setting RESTIC_REPOSITORY ""
  setting RESTIC_PASSWORD_FILE /etc/ai-lawyer/backup.key
  setting RESTIC_IMAGE "$BC_DEFAULT_RESTIC_IMAGE"
  setting RESTIC_CACHE_VOLUME ailawyer-restic-cache
  setting BACKUP_DOCKER_NETWORK ""
  setting BACKUP_HOSTNAME "$(hostname -s 2>/dev/null || hostname)"
  setting BACKUP_TAG ai-lawyer
  setting BACKUP_STATE_DIR /var/lib/ai-lawyer/backup
  setting BACKUP_HELPER_IMAGE pgvector/pgvector:pg16
  setting BACKUP_HEALTHCHECK_URL ""
  setting BACKUP_SSH_DIR ""
  export RESTIC_REPOSITORY

  [ -n "$RESTIC_REPOSITORY" ] || die "RESTIC_REPOSITORY ist nicht gesetzt (in ${BACKUP_CONFIG:-BACKUP_CONFIG} oder als Umgebungsvariable)"
  if [ -n "$BACKUP_CONFIG" ] && grep -q 'BITTE_EINTRAGEN\|BUCKETNAME' "$BACKUP_CONFIG"; then
    die "$BACKUP_CONFIG enthält noch Platzhalter aus der Vorlage (BITTE_EINTRAGEN/BUCKETNAME)"
  fi
  if [ -n "$BACKUP_CONFIG" ] && grep -qE '^[[:space:]]*RESTIC_PASSWORD=' "$BACKUP_CONFIG"; then
    die "RESTIC_PASSWORD steht in $BACKUP_CONFIG – das Passwort gehört ausschließlich in die Schlüsseldatei (RESTIC_PASSWORD_FILE)"
  fi
  if [ -n "${RESTIC_PASSWORD:-}" ]; then
    die "RESTIC_PASSWORD ist als Umgebungsvariable gesetzt – bitte nur RESTIC_PASSWORD_FILE verwenden"
  fi

  case "$RESTIC_PASSWORD_FILE" in /*) ;; *) die "RESTIC_PASSWORD_FILE muss ein absoluter Pfad sein" ;; esac
  case "$RESTIC_PASSWORD_FILE/" in
    "$project_dir"/*) die "Schlüsseldatei liegt im Projektordner ($RESTIC_PASSWORD_FILE) – sie gehört nicht neben Quellcode und Daten, Standard: /etc/ai-lawyer/backup.key" ;;
  esac

  # Lokales Ziel? Ein Verzeichnis auf demselben Gerät ist keine externe Sicherung.
  REPO_IS_LOCAL=0
  case "$RESTIC_REPOSITORY" in
    s3:*|sftp:*|rest:*|rclone:*|b2:*|azure:*|gs:*|swift:*) ;;
    local:*|/*) REPO_IS_LOCAL=1 ;;
    *) die "RESTIC_REPOSITORY hat ein unbekanntes Format (erwartet s3:, sftp:, rest:, rclone:, b2:, azure:, gs:, swift: oder absoluter Pfad)" ;;
  esac
  if [ "$REPO_IS_LOCAL" = 1 ]; then
    REPO_LOCAL_PATH=${RESTIC_REPOSITORY#local:}
    warn "Das Repository liegt lokal ($REPO_LOCAL_PATH). Das ist KEINE externe Sicherung: Brand, Diebstahl, Ransomware oder ein Plattendefekt treffen Original und Kopie zugleich."
  elif printf '%s' "$RESTIC_REPOSITORY" | grep -qE '(://|@)(localhost|127\.[0-9.]+|\[::1\])([:/]|$)'; then
    warn "Das Repository zeigt auf diesen Rechner ($(redact_repo "$RESTIC_REPOSITORY")) – das ist keine externe Sicherung."
  fi
}

# Prüft die Schlüsseldatei (existiert, nicht leer, Rechte höchstens 600)
check_key_file() {
  [ -f "$RESTIC_PASSWORD_FILE" ] || die "Schlüsseldatei $RESTIC_PASSWORD_FILE fehlt. Neu einrichten: scripts/backup.sh init – bei bestehendem Repository die verwahrte Kopie zurücklegen (Handbuch Kap. 21)"
  [ -r "$RESTIC_PASSWORD_FILE" ] || die "Schlüsseldatei $RESTIC_PASSWORD_FILE nicht lesbar (Skript als root bzw. Besitzer ausführen)"
  [ -s "$RESTIC_PASSWORD_FILE" ] || die "Schlüsseldatei $RESTIC_PASSWORD_FILE ist leer"
  local mode
  mode=$(file_mode "$RESTIC_PASSWORD_FILE") || die "Rechte von $RESTIC_PASSWORD_FILE nicht ermittelbar"
  case "$mode" in
    600|400) ;;
    *) die "Schlüsseldatei $RESTIC_PASSWORD_FILE hat die Rechte $mode – erlaubt sind 600 oder 400 (chmod 600 $RESTIC_PASSWORD_FILE)" ;;
  esac
}

# Zusätzliche Mounts für den restic-Container (Array, vom Aufrufer gesetzt)
RESTIC_MOUNTS=()

# restic im Container ausführen; Argumente gehen an restic
restic_run() {
  local args=(run --rm -i
    --hostname "$BACKUP_HOSTNAME"
    -e RESTIC_REPOSITORY
    -e RESTIC_PASSWORD_FILE=/run/secrets/restic-key
    -e RESTIC_CACHE_DIR=/cache
    -v "$RESTIC_PASSWORD_FILE:/run/secrets/restic-key:ro"
    -v "$RESTIC_CACHE_VOLUME:/cache")
  [ -z "$BACKUP_CONFIG" ] || args+=(--env-file "$BACKUP_CONFIG")
  [ -z "$BACKUP_DOCKER_NETWORK" ] || args+=(--network "$BACKUP_DOCKER_NETWORK")
  # SFTP: eigener Schlüssel + known_hosts, nur lesbar eingebunden
  [ -z "$BACKUP_SSH_DIR" ] || args+=(-v "$BACKUP_SSH_DIR:/root/.ssh:ro")
  if [ "$REPO_IS_LOCAL" = 1 ]; then
    mkdir -p "$REPO_LOCAL_PATH"
    args+=(-v "$REPO_LOCAL_PATH:$REPO_LOCAL_PATH")
  fi
  # -e RESTIC_REPOSITORY übernimmt den Wert aus der Umgebung und hat Vorrang vor --env-file
  docker "${args[@]}" ${RESTIC_MOUNTS[@]+"${RESTIC_MOUNTS[@]}"} "$RESTIC_IMAGE" "$@"
}

# Verständliche Meldung zu restic-Exit-Codes (restic >= 0.17)
restic_error_hint() {
  case "$1" in
    10) echo "Repository existiert nicht (noch nicht eingerichtet? scripts/backup.sh init)" ;;
    11) echo "Repository ist gesperrt (läuft eine andere Sicherung? sonst: scripts/backup.sh unlock)" ;;
    12) echo "falsches Repository-Passwort – Schlüsseldatei passt nicht zu diesem Repository" ;;
    3)  echo "nicht alle Dateien konnten gelesen werden – Sicherung unvollständig" ;;
    1)  echo "restic meldet einen Fehler (Einzelheiten in der Ausgabe darüber)" ;;
    *)  echo "restic-Exit-Code $1 (Ziel erreichbar? Zugangsdaten korrekt?)" ;;
  esac
}

# Compose-Projektname ohne Interpolation (liest keine Geheimnisse aus)
compose_project() {
  local p
  p=${COMPOSE_PROJECT_NAME:-$(dc config --no-interpolate 2>/dev/null | sed -n 's/^name: //p' | head -n1)}
  [ -n "$p" ] || die "Compose-Projektname nicht ermittelbar (docker compose config schlägt fehl?)"
  printf '%s' "$p"
}

# find_volume <compose-volume> – voller Docker-Volume-Name des Projekts
find_volume() {
  local v
  v=$(docker volume ls -q --filter "label=com.docker.compose.project=$PROJECT" \
        --filter "label=com.docker.compose.volume=$1" | head -n1)
  [ -n "$v" ] || v="${PROJECT}_$1"
  docker volume inspect "$v" >/dev/null 2>&1 || return 1
  printf '%s' "$v"
}

# Hilfscontainer mit gemounteten Volumes: helper <mounts...> -- <sh-skript>
helper_sh() {
  local mounts=()
  while [ $# -gt 0 ] && [ "$1" != "--" ]; do mounts+=(-v "$1"); shift; done
  shift
  docker run --rm -i ${mounts[@]+"${mounts[@]}"} --entrypoint sh "$BACKUP_HELPER_IMAGE" -c "$1"
}

# Healthchecks-kompatibler Ping (start | ok | fail). URL wird nie ausgegeben.
hc_ping() {
  [ -n "${BACKUP_HEALTHCHECK_URL:-}" ] || return 0
  local url=${BACKUP_HEALTHCHECK_URL%/}
  case "$1" in
    start) url="$url/start" ;;
    fail)  url="$url/fail" ;;
  esac
  command -v curl >/dev/null 2>&1 || { warn "curl fehlt – keine Benachrichtigung"; return 0; }
  if [ -n "${2:-}" ]; then
    curl -fsS -m 10 --retry 3 -o /dev/null --data-raw "$2" "$url" >/dev/null 2>&1 || warn "Benachrichtigung ($1) nicht zustellbar"
  else
    curl -fsS -m 10 --retry 3 -o /dev/null "$url" >/dev/null 2>&1 || warn "Benachrichtigung ($1) nicht zustellbar"
  fi
}
