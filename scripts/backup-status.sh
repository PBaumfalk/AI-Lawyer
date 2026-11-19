#!/usr/bin/env bash
# AI-Lawyer – prüft, ob die letzte erfolgreiche Sicherung aktuell genug ist.
# Für Monitoring (Nagios/Icinga-Stil, Cron mit Mail, Uptime-Kuma "Push" o. ä.).
#
# Aufruf: scripts/backup-status.sh
#   BACKUP_STATE_DIR      Statusordner von scripts/backup.sh (Standard: /var/lib/ai-lawyer/backup)
#   BACKUP_MAX_AGE_HOURS  maximales Alter der letzten erfolgreichen Sicherung (Standard: 26)
#
# Exit-Code: 0 = aktuell, 1 = zu alt oder letzter Lauf fehlgeschlagen,
#            2 = noch nie erfolgreich gesichert / Status nicht lesbar.
# Liest nur die Statusdateien, braucht weder Docker noch Schlüssel.

set -euo pipefail

STATE=${BACKUP_STATE_DIR:-/var/lib/ai-lawyer/backup}
MAX_H=${BACKUP_MAX_AGE_HOURS:-26}
case "$MAX_H" in ''|*[!0-9]*) echo "BACKUP_MAX_AGE_HOURS muss eine Zahl sein" >&2; exit 2 ;; esac

val() { sed -n "s/^$1=//p" "$2" | head -n1; }

if [ ! -r "$STATE/last-success" ]; then
  echo "KRITISCH: keine erfolgreiche Sicherung verzeichnet ($STATE/last-success fehlt)"
  exit 2
fi
T=$(val time_epoch "$STATE/last-success")
case "$T" in ''|*[!0-9]*) echo "KRITISCH: $STATE/last-success unlesbar"; exit 2 ;; esac
AGE_H=$(( ($(date +%s) - T) / 3600 ))
SNAP=$(val snapshot "$STATE/last-success")
WHEN=$(val time "$STATE/last-success")

RC=0
if [ "$AGE_H" -ge "$MAX_H" ]; then
  echo "KRITISCH: letzte erfolgreiche Sicherung vor $AGE_H h ($WHEN, Snapshot $SNAP) – Grenze $MAX_H h"
  RC=1
else
  echo "OK: letzte erfolgreiche Sicherung vor $AGE_H h ($WHEN, Snapshot $SNAP)"
fi
if [ -r "$STATE/last-run" ] && [ "$(val status "$STATE/last-run")" != ok ]; then
  echo "KRITISCH: letzter Lauf fehlgeschlagen ($(val time "$STATE/last-run")): $(val message "$STATE/last-run")"
  RC=1
fi
exit "$RC"
