# 21 — Betrieb und Sicherung

Dieses Kapitel beschreibt den laufenden Betrieb: welche Daten wo liegen, was gesichert werden muss, wie ein Update abläuft, welche Hintergrund-Jobs laufen und wo Sie nachsehen, wenn etwas hakt. Die Befehle gehen davon aus, dass Sie im Projektordner stehen und `COMPOSE_FILE` wie in [Kapitel 19](19-installation.md#installation-schritt-für-schritt) gesetzt ist.

## Dienste und Volumes

Compose legt für jeden Dienst ein benanntes Volume an. Der Name bekommt den Projektnamen vorangestellt, standardmäßig den Ordnernamen in Kleinbuchstaben (z. B. `ai-lawyer_pgdata`). Prüfen Sie die tatsächlichen Namen mit `docker volume ls`.

| Volume | Dienst | Inhalt | Sichern? |
| --- | --- | --- | --- |
| `pgdata` | `db` | Alle Fachdaten: Akten, Kontakte, Fristen, Rechnungen, E-Mails (Text), Audit-Trail, Einstellungen, OCR-Text, Vektoren für die Wissenssuche | **ja, unbedingt** |
| `miniodata` | `minio` | Alle Dateien: Dokumente mit Versionen, PDF-Vorschauen, Vorlagen, Briefköpfe, E-Mail-Anhänge, Portal-Uploads | **ja, unbedingt** |
| `meilidata` | `meilisearch` | Volltextindex der Dokumente | nein, lässt sich neu aufbauen |
| `redisdata` | `redis` | Warteschlangen, geplante Jobs, Abklingzeiten | nein (siehe unten) |
| `ollama_data` | `ollama` | heruntergeladene KI-Modelle | nein, lässt sich neu laden (mehrere GB) |
| `onlyoffice_data`, `onlyoffice_log` | `onlyoffice` | Arbeitsdateien und Protokolle von OnlyOffice | nein |
| `stirling_configs`, `stirling_logs`, `stirling_tessdata` | `stirling-pdf` | Einstellungen, Protokolle, OCR-Sprachdaten | nein |
| `app_logs`, `worker_logs` | `app`, `worker` | Protokolldateien | nach Bedarf |
| `languagetool_ngrams` | `languagetool` | Sprachdaten (nur Profil `full`) | nein |

### Was gesichert werden muss

Drei Dinge, und nur zusammen sind sie eine brauchbare Sicherung:

1. **Die PostgreSQL-Datenbank** als Dump.
2. **Die MinIO-Daten** (Volume `miniodata`). Die Datenbank enthält nur die Pfade der Dateien; ohne MinIO sind alle Dokumente weg.
3. **Die Geheimnisse:** Ihre `.env`, gegebenenfalls eine eigene Zusatzdatei (z. B. `docker-compose.kanzlei.yml`) und vor allem `EMAIL_ENCRYPTION_KEY`. Ohne diesen Schlüssel lassen sich die gespeicherten Zugangsdaten für E-Mail, CalDAV und j-lawyer, die KI-API-Schlüssel und die Zwei-Faktor-Geheimnisse der Benutzer nicht mehr entschlüsseln ([Kapitel 20](20-konfiguration.md#anmeldung-und-sicherheit)).

Datenbank und Dateien sichert `scripts/backup.sh` verschlüsselt in ein externes Repository. Die Geheimnisse gehören **nicht** in dieselbe Sicherung, sondern getrennt verwahrt (siehe [Schlüssel und Geheimnisse verwahren](#schlüssel-und-geheimnisse-verwahren)).

**Meilisearch** muss nicht gesichert werden: Der Index entsteht aus der Datenbank (Name, Ordner, Schlagwörter, OCR-Text). `scripts/restore.sh` baut ihn nach einer Wiederherstellung automatisch neu auf.

**Redis** muss nicht gesichert werden. Die zeitgesteuerten Jobs registriert der Worker bei jedem Start neu. Verloren gehen nur Jobs, die zum Zeitpunkt des Ausfalls warteten. Dokumente mit fehlgeschlagener OCR stellt der Worker beim Start selbst wieder in die Warteschlange.

## Sicherung

### Wie gesichert wird

`scripts/backup.sh` verwendet [restic](https://restic.net) (Version 0.19.1, offizielles Docker-Image `restic/restic:0.19.1`; auf dem Server muss nichts installiert werden). restic verschlüsselt und authentifiziert alle Daten (AES-256-CTR mit Poly1305-AES), bevor sie den Server verlassen, speichert dedupliziert (jede Nacht wandern nur Änderungen über die Leitung) und kann das Ziel selbst auf Beschädigung prüfen. Das Ziel – S3-kompatibler Objektspeicher, SFTP, rest-server oder alles, was rclone kann – sieht nur verschlüsselte Pakete.

Ein Lauf:

1. hält `app` und `worker` an, damit niemand schreibt,
2. erzeugt den Dump (`pg_dump -Fc`), prüft ihn mit `pg_restore -l` und bildet seine SHA-256-Prüfsumme,
3. hält `minio` an und schreibt einen Snapshot aus Dump, Prüfsumme, `INFO.txt` (Zeitpunkt, Git-Stand, Dateianzahl) und dem ganzen Volume `miniodata` (Dateien, Versionen, Bucket-Einstellungen) ins Repository,
4. startet die angehaltenen Dienste wieder – auch bei einem Fehler, und nur die, die vorher liefen,
5. löscht alte Snapshots nach der Aufbewahrungsregel (`restic forget --prune`),
6. prüft das Repository (`restic check`, dazu täglich ein anderes Dreißigstel der Daten vollständig gelesen und entschlüsselt – in 30 Tagen ist alles einmal geprüft),
7. schreibt die Statusdateien und meldet Erfolg oder Fehler an eine Überwachung (optional).

Die Anwendung ist während Schritt 1–4 nicht erreichbar. Bei einer nächtlichen Sicherung sind das nach der ersten Sicherung meist unter einer Minute; die **erste** Sicherung lädt alles hoch und kann bei großen Beständen Stunden dauern – starten Sie sie von Hand außerhalb der Bürozeit.

Der Exit-Code ist bei jedem Fehler ungleich 0. Die `.env` wird standardmäßig nicht mitgesichert.

### Einrichten (einmalig)

**1. Externes Ziel beschaffen.** Ein Verzeichnis auf demselben Server oder einer daran angeschlossenen Platte ist **keine** externe Sicherung (Brand, Diebstahl, Ransomware und Überspannung treffen Original und Kopie zugleich); das Skript warnt in diesem Fall bei jedem Lauf. Geeignet sind zum Beispiel:

| Ziel | Was Sie brauchen | `RESTIC_REPOSITORY` |
| --- | --- | --- |
| S3-Objektspeicher (Hetzner, IONOS, Wasabi, AWS, MinIO an anderem Standort) | Bucket, Endpoint, Access-Key und Secret-Key nur für diesen Bucket | `s3:https://<endpoint>/<bucket>/ai-lawyer` |
| SFTP (Hetzner Storage Box, NAS an anderem Ort) | Host, Benutzer, eigener SSH-Schlüssel ohne Passphrase, `known_hosts` | `sftp:<benutzer>@<host>:/ai-lawyer` |
| rest-server an anderem Ort | URL, Benutzer, Passwort; am besten mit `--append-only` betrieben | `rest:https://<host>:8000/ai-lawyer` |

Für Auftragsverarbeitung und Standort gelten die üblichen Regeln (AV-Vertrag, Speicherort in der EU). Die Daten verlassen den Server nur verschlüsselt; der Anbieter kann sie ohne Ihren Schlüssel nicht lesen. Schalten Sie, wo angeboten, Objekt-Versionierung oder Object Lock ein: Dann kann auch ein Angreifer mit den Zugangsdaten des Servers alte Sicherungen nicht löschen.

**2. Konfiguration außerhalb des Projektordners anlegen:**

```bash
sudo install -d -m 700 /etc/ai-lawyer
sudo install -m 600 scripts/backup.env.example /etc/ai-lawyer/backup.env
sudo nano /etc/ai-lawyer/backup.env      # Ziel und Zugangsdaten eintragen
```

Die Datei hat das Format von `docker run --env-file`: eine Zeile `KEY=wert`, keine Anführungszeichen, kein `export`, Kommentare nur als eigene Zeile. Steht noch ein Platzhalter (`BITTE_EINTRAGEN`) darin, bricht das Skript ab. Das Repository-Passwort gehört **nicht** in diese Datei.

**3. Schlüssel erzeugen und Repository anlegen:**

```bash
cd /opt/ai-lawyer          # Projektordner
sudo scripts/backup.sh init
```

`init` erzeugt, falls noch nicht vorhanden, `/etc/ai-lawyer/backup.key` (64 Zufallszeichen, Rechte `600`) und legt das Repository an. Das Skript lehnt eine Schlüsseldatei mit anderen Rechten als `600`/`400` ab, ebenso eine Schlüsseldatei im Projektordner und ein Passwort in `backup.env` oder in der Umgebungsvariable `RESTIC_PASSWORD`. Den Schlüssel gibt es nie aus.

`sudo` verwirft Umgebungsvariablen. Braucht Ihre Installation `COMPOSE_FILE` (siehe [Kapitel 19](19-installation.md#installation-schritt-für-schritt)), geben Sie sie in der Zeile mit: `sudo COMPOSE_FILE=docker-compose.yml scripts/backup.sh`.

**4. Schlüssel sofort ein zweites Mal verwahren** (nächster Abschnitt) – ohne ihn ist jede Sicherung wertlos.

**5. Erste Sicherung von Hand, dann automatisieren:**

```bash
sudo scripts/backup.sh               # erste, volle Sicherung
sudo scripts/backup.sh snapshots     # Ergebnis ansehen
```

### Schlüssel und Geheimnisse verwahren

Für eine Wiederherstellung nach Totalverlust des Servers brauchen Sie vier Dinge, die **nicht** auf dem Server und **nicht** im Sicherungsziel liegen dürfen:

| Was | Wozu |
| --- | --- |
| Inhalt von `/etc/ai-lawyer/backup.key` | entschlüsselt das Repository |
| Inhalt von `/etc/ai-lawyer/backup.env` (Ziel und Zugangsdaten) | Zugriff auf das Sicherungsziel |
| die `.env` des Projekts, insbesondere `EMAIL_ENCRYPTION_KEY`, `NEXTAUTH_SECRET`, `POSTGRES_PASSWORD`, `MINIO_SECRET_KEY`, `MEILISEARCH_API_KEY` | ohne `EMAIL_ENCRYPTION_KEY` bleiben E-Mail-, CalDAV- und j-lawyer-Zugangsdaten, KI-Schlüssel und Zwei-Faktor-Geheimnisse unlesbar |
| gegebenenfalls eigene Compose-Zusatzdateien | gleiche Konfiguration wie vorher |

So verwahren:

- **Passwortmanager/Tresor der Kanzlei:** je ein Eintrag „AI-Lawyer Sicherungsschlüssel“ (Inhalt der Schlüsseldatei), „AI-Lawyer Sicherungsziel“ (Inhalt von `backup.env`) und „AI-Lawyer .env“. Zugriff nur für die Personen, die eine Wiederherstellung durchführen dürfen.
- **Zweite Kopie offline:** Schlüssel und `.env` ausdrucken (`cat /etc/ai-lawyer/backup.key` am Bildschirm, nicht in Tickets, Chats oder E-Mails kopieren), in einen verschlossenen Umschlag mit Datum, in den Safe oder ins Bankschließfach.
- Nach jeder Änderung der `.env` (z. B. neues Passwort) die verwahrte Fassung erneuern. `EMAIL_ENCRYPTION_KEY` nie ändern, solange Sicherungen mit dem alten Stand wiederhergestellt werden sollen.

**Schlüssel wiederherstellen** auf einem neuen Server:

```bash
sudo install -d -m 700 /etc/ai-lawyer
sudo sh -c 'umask 077; cat > /etc/ai-lawyer/backup.key'   # Schlüssel einfügen, Strg+D
sudo chmod 600 /etc/ai-lawyer/backup.key
```

Achten Sie darauf, dass kein Zeilenumbruch oder Leerzeichen hinzukommt, das nicht im Original war (restic liest die erste Zeile). Ein falscher Schlüssel führt zur Meldung „falsches Repository-Passwort“, es wird nichts verändert.

Wer die Datei `.env` lieber mit im (verschlüsselten) Snapshot haben will, setzt `BACKUP_INCLUDE_ENV=1`. Dann genügen für die Wiederherstellung Schlüssel und Zugangsdaten zum Ziel; die getrennte Verwahrung der `.env` empfehlen wir trotzdem.

### Automatisieren

**systemd (empfohlen):** Vorlagen liegen in `scripts/systemd/`. Pfad `/opt/ai-lawyer` in der `.service`-Datei an Ihren Projektordner anpassen, dann:

```bash
sudo cp scripts/systemd/ai-lawyer-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ai-lawyer-backup.timer
systemctl list-timers ai-lawyer-backup.timer       # nächster Lauf
journalctl -u ai-lawyer-backup.service             # Protokoll
```

Der Timer läuft täglich um 02:30 Uhr (bis 15 Minuten Streuung) und holt einen verpassten Lauf nach, wenn der Server zu der Zeit aus war. Ein Fehlschlag erscheint in `systemctl --failed`.

**Cron** (Alternative, als root):

```cron
30 2 * * * cd /opt/ai-lawyer && COMPOSE_FILE=docker-compose.yml scripts/backup.sh >> /var/log/ai-lawyer-backup.log 2>&1
```

Cron kennt die Umgebung der Anmelde-Shell nicht; setzen Sie `COMPOSE_FILE` so wie in Ihrer Installation. Die Worker-Nachtjobs (01:00–03:30, siehe [Hintergrund-Jobs](#hintergrund-jobs)) stören die Sicherung nicht, weil der Worker während der Sicherung angehalten ist; sie laufen danach weiter.

### Fehlgeschlagene Sicherungen bemerken

Eine Sicherung, deren Ausfall niemand bemerkt, ist keine. Drei Wege, kombinierbar:

1. **Statusdateien** in `/var/lib/ai-lawyer/backup/`: `last-success` (Zeitpunkt, Snapshot-ID, Dauer der letzten erfolgreichen Sicherung) und `last-run` (`status=ok` oder `status=fehler` mit Meldung). Keine Geheimnisse darin.
2. **Prüfskript** für die Überwachung (Icinga/Nagios, Cron mit Mail, Uptime Kuma):
   ```bash
   scripts/backup-status.sh          # Exit 0 = aktuell, 1 = zu alt oder letzter Lauf fehlgeschlagen, 2 = nie gesichert
   BACKUP_MAX_AGE_HOURS=26 scripts/backup-status.sh
   ```
3. **Ping an einen Überwachungsdienst** (empfohlen, weil er auch einen ganz ausgefallenen Server bemerkt): `BACKUP_HEALTHCHECK_URL` in `backup.env` setzen, z. B. auf einen Check bei healthchecks.io oder einer eigenen Healthchecks-Instanz. Das Skript ruft `…/start` zu Beginn, die URL selbst bei Erfolg und `…/fail` bei einem Fehler auf (mit kurzer Meldung, ohne Geheimnisse). Bleibt der Erfolgs-Ping aus, meldet der Dienst sich per Mail.

### Einstellungen

Vorrang: Umgebungsvariable vor `backup.env` vor Standard.

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `BACKUP_CONFIG` | `/etc/ai-lawyer/backup.env` | Datei mit Ziel und Zugangsdaten |
| `RESTIC_PASSWORD_FILE` | `/etc/ai-lawyer/backup.key` | Schlüsseldatei (Rechte `600`) |
| `RESTIC_REPOSITORY` | – | Ziel, siehe Tabelle oben |
| `BACKUP_KEEP_DAILY` / `_WEEKLY` / `_MONTHLY` / `_YEARLY` / `_LAST` | `7` / `5` / `12` / `0` / `0` | Aufbewahrung (`0` = Regel aus). Gibt es weniger Tage/Wochen als verlangt, behält restic zusätzlich den ältesten Snapshot |
| `BACKUP_PRUNE` | `1` | nicht mehr benötigte Daten im Ziel löschen |
| `BACKUP_CHECK` | `1` | `restic check` nach jeder Sicherung |
| `BACKUP_READ_DATA_SUBSET` | `auto` | täglich rollierend 1/30 der Daten lesen; oder z. B. `5%`, `1/10`; `0` = nur Struktur |
| `BACKUP_HEALTHCHECK_URL` | – | Ping-URL (s. o.) |
| `BACKUP_STOP` | `1` | `0` sichert ohne Anhalten; gleichzeitige Uploads können dann zwischen Datenbank und Dateien auseinanderlaufen |
| `BACKUP_INCLUDE_ENV` | `0` | `1` legt die `.env` mit in den Snapshot |
| `BACKUP_STATE_DIR` | `/var/lib/ai-lawyer/backup` | Statusdateien |
| `BACKUP_HOSTNAME`, `BACKUP_TAG` | Rechnername, `ai-lawyer` | Kennzeichnung der Snapshots |
| `BACKUP_SSH_DIR` | – | für `sftp:`: Ordner mit Schlüssel und `known_hosts`, wird als `/root/.ssh` eingebunden |
| `BACKUP_DOCKER_NETWORK` | – | Docker-Netz für den restic-Container (nur für Sonderfälle) |
| `RESTIC_IMAGE` | `restic/restic:0.19.1` | feste Version; Updates bewusst einspielen |
| `COMPOSE_FILE`, `COMPOSE_PROJECT_NAME` | | werden wie bei `docker compose` beachtet |

Weitere Befehle: `scripts/backup.sh check --read-data` (alle Daten im Ziel lesen und prüfen, dauert und kostet ggf. Abrufgebühren), `scripts/backup.sh unlock` (Sperre nach einem Absturz entfernen).

Die Seite **Einstellungen** bietet zusätzlich einen Export und Import der Einstellungen, das ist keine Datensicherung ([Kapitel 16](16-einstellungen-und-vorlagen.md)).

**Ältere Sicherungen** aus der Zeit vor restic (Ordner `backups/<Zeitstempel>/` mit `db.dump` und `minio.tar.gz`) stellt `scripts/restore.sh` nicht mehr her. Dafür das Skript aus dem Git-Stand `ed2f5c9` verwenden (`git show ed2f5c9:scripts/restore.sh > /tmp/restore-alt.sh`). Diese Ordner sind unverschlüsselt und enthalten eine Kopie der `.env` – nach Umstellung löschen.

## Wiederherstellung

```bash
scripts/restore.sh --list                    # Snapshots anzeigen
scripts/restore.sh                           # neuester Snapshot, fragt nach („ja“)
scripts/restore.sh --snapshot 1a2b3c4d       # bestimmter Snapshot
scripts/restore.sh --yes                     # ohne Rückfrage
```

Das Skript

1. entschlüsselt den Snapshot in ein Docker-Volume (`restic restore --verify`), prüft die Prüfsumme und Lesbarkeit des Dumps und die Dateianzahl von MinIO – bei falschem Schlüssel, unerreichbarem Ziel oder beschädigten Daten bricht es hier ab, **ohne etwas zu verändern**,
2. hält `app` und `worker` an,
3. spielt den Dump in eine frische Datenbank `ailawyer_restore` ein (eine Transaktion) und tauscht sie erst nach Erfolg gegen `ailawyer` aus; bei einem Fehler bleibt die bisherige Datenbank unverändert, und es bleiben keine Tabellen aus späteren Updates zurück,
4. ersetzt den Inhalt des Volumes `miniodata` und startet MinIO (`minio-init` passt die Besitzrechte an),
5. verwirft den Meilisearch-Index und startet `app` und `worker` (wartet, bis sie bereit sind),
6. **baut den Suchindex automatisch neu auf** (`node dist-worker/reindex-suche.mjs` im App-Container) und gibt die Zahl der indexierten Dokumente aus. Schlägt das fehl, endet das Skript mit Exit-Code ungleich 0 und nennt den Befehl zum Wiederholen; die Daten sind dann bereits wiederhergestellt.

Danach eine Stichprobe machen (anmelden, Akte öffnen, Dokument herunterladen, im Editor öffnen, Volltextsuche). Platzbedarf während der Wiederherstellung: Datenbank kurz doppelt, dazu der entschlüsselte Snapshot im Docker-Speicher.

**Auf einem neuen Server (Totalverlust):**

1. AI-Lawyer in **derselben Version** installieren ([Kapitel 19](19-installation.md)), aber noch nicht starten.
2. Die verwahrte `.env` in den Projektordner legen (`chmod 600 .env`). Ohne sie bricht `restore.sh` ab (außer der Snapshot wurde mit `BACKUP_INCLUDE_ENV=1` erstellt).
3. `/etc/ai-lawyer/backup.env` und `/etc/ai-lawyer/backup.key` aus der Verwahrung zurücklegen (siehe [Schlüssel wiederherstellen](#schlüssel-und-geheimnisse-verwahren)).
4. Images bauen (`docker compose build app worker`), dann `sudo scripts/restore.sh`.
5. `docker compose up -d` für die übrigen Dienste und KI-Modelle laden, falls `ollama_data` neu ist. Das Entrypoint-Skript findet die Benutzer vor und überspringt den Seed.

### Wiederherstellung testen

```bash
npm ci                              # einmalig, für den Bundle-Build
scripts/test-backup-restore.sh
```

Der Test läuft vollständig isoliert unter dem Projektnamen `ailawyer-backuptest` (eigene Container, Volumes und Netze, keine Ports nach außen außer einem zufälligen auf `127.0.0.1`, Wegwerf-`.env` und Wegwerf-Schlüssel) und berührt eine laufende Installation nicht. Er startet `db`, `minio`, `meilisearch`, einen schlanken Stellvertreter des App-Containers mit demselben Reindex-Programm und – als Sicherungsziel – einen **zweiten, getrennten MinIO-Container** mit S3-Schnittstelle. Geprüft wird:

- Einrichtung mit `init`, Schlüsseldatei mit Rechten `600`, Ablehnung bei `644`,
- zwei Sicherungen, Aufbewahrung, Statusdateien, `backup-status.sh`, Pings an einen Testempfänger, keine Geheimnisse im Protokoll,
- Sicherung mit falschem Schlüssel: Exit-Code ≠ 0, Status `fehler`, `/fail`-Ping,
- Wiederherstellung eines bestimmten Snapshots über veränderte Daten,
- Wiederherstellung mit falschem Schlüssel: Abbruch, Bestand unverändert,
- **Totalverlust** (alle Volumes und der restic-Cache gelöscht), Wiederherstellung nur aus dem S3-Ziel, Vergleich von Datenbank-Prüfsummen und Dateiinhalt, und die Volltextsuche findet das Testdokument **ohne manuellen Reindex**,
- ein manipuliertes Datenpaket im Ziel: `restic check --read-data` meldet den Fehler, die Wiederherstellung bricht ohne Änderung ab.

Zum Schluss räumt er alles ab und meldet `ERGEBNIS: BESTANDEN` mit Laufzeiten (Exit-Code 0). Er dauert etwa zwei Minuten.

Der Test belegt die Mechanik, nicht Ihre Sicherungen und nicht Ihr Ziel. Spielen Sie zusätzlich regelmäßig (z. B. vierteljährlich) eine echte Sicherung aus dem externen Ziel auf einem Testrechner ein – mit dem verwahrten Schlüssel, nicht mit dem vom Server.

## Suchindex neu aufbauen

`scripts/restore.sh` erledigt das automatisch. Von Hand (z. B. nach einem Meilisearch-Update):

```bash
docker compose exec app node dist-worker/reindex-suche.mjs
```

Das Programm löscht den Index `dokumente`, legt ihn mit den richtigen Einstellungen neu an, indexiert alle Dokumente aus der Datenbank in Blöcken zu 500 und vergleicht am Ende die Anzahl im Index mit der Datenbank. Ausgabe z. B. `Suchindex-Neuaufbau fertig: 412 indexiert, 412 im Index (3.1 s)`; bei einem Fehler Exit-Code 1 mit Meldung. Es lässt sich beliebig oft wiederholen. Während des Neuaufbaus liefert die Suche unvollständige Treffer.

Dieselbe Logik steht angemeldet als Admin über `POST /api/dokumente/reindex` bereit (Antwort z. B. `{ success: true, indexed: 412 }`). Die Vektoren für die Helena-Wissenssuche liegen in PostgreSQL und sind davon nicht betroffen.

## Updates

1. **Sichern** mit `scripts/backup.sh` ([Sicherung](#sicherung)). Vor jedem Update, ohne Ausnahme.
2. Neue Version holen und das [Änderungsprotokoll](../../CHANGELOG.md) lesen:
   ```bash
   git fetch --tags && git pull
   ```
3. Neu bauen und starten:
   ```bash
   docker compose up -d --build
   docker compose logs -f app
   ```
   Beim Start führt `docker-entrypoint.sh` `prisma migrate deploy` und die manuellen SQL-Dateien aus ([Kapitel 19](19-installation.md#erster-start-was-docker-entrypointsh-tut)).
4. Prüfen: **System** (`/admin/system`) zeigt „Alle Systeme betriebsbereit“, der **Job-Monitor** zeigt keine neuen Fehler.

Ein zusätzlicher Abgleich mit `db push` ist nicht mehr nötig und soll unterbleiben: Die Migrationen bilden das Schema vollständig ab. Installationen, die früher per `db push` ergänzt wurden, bringt die idempotente Migration `20261118120000_schema_sync` beim ersten Start der neuen Version auf denselben Stand. Bricht `migrate deploy` oder `apply-manual-migrations.js` ab, startet der Container nicht und meldet die Ursache in `docker compose logs app`; spielen Sie dann die Sicherung von vorher ein, statt die Datenbank von Hand anzupassen.

**Umstieg von einer älteren Installation:** Die Compose-Datei liest seit dieser Version alle Werte aus der `.env` und verlangt dort `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `MINIO_SECRET_KEY` und `MEILISEARCH_API_KEY`. Tragen Sie für PostgreSQL und MinIO die **bisherigen** Werte ein (früher fest `ailawyer` bzw. `ailawyer123`), denn ein neuer Wert ändert die Zugangsdaten in bestehenden Daten nicht; das Passwort danach gezielt ändern ([Kapitel 20](20-konfiguration.md#datenbank-und-redis)). Für Redis und Meilisearch dürfen Sie neue Werte wählen; der Suchindex ist danach gegebenenfalls neu aufzubauen ([Suchindex neu aufbauen](#suchindex-neu-aufbauen)). Das MinIO-Image wechselt auf `cgr.dev/chainguard/minio`; `minio-init` passt dabei die Besitzrechte des Volumes an.

**Rückweg:** Image der vorigen Version bauen (`git checkout <alter Tag>`, `docker compose up -d --build`) und, falls das neue Update die Datenbank verändert hat, die Sicherung von vorher mit `scripts/restore.sh` einspielen. Ein Downgrade der Datenbank ohne Dump gibt es nicht.

Die Fremd-Images stehen größtenteils auf `latest` (MinIO, OnlyOffice, Stirling-PDF, Ollama, Redis-Hauptversion 7). `docker compose pull` holt dort jeweils die neueste Version. Für vorhersehbare Updates tragen Sie in einer Zusatzdatei feste Versionen ein (für MinIO genügt `MINIO_IMAGE` in der `.env`).

## Hintergrund-Jobs

Der Dienst `worker` verarbeitet 20 Warteschlangen (BullMQ über Redis, definiert in `src/lib/queue/queues.ts`, Verarbeitung in `src/worker.ts`). Fehlgeschlagene Jobs werden standardmäßig bis zu dreimal wiederholt, nach 10 Sekunden, 1 Minute und 5 Minuten. Erledigte Jobs bleiben 24 Stunden, fehlgeschlagene 7 Tage sichtbar (Ausnahme `helena-task`: 7 bzw. 30 Tage).

**Zeitgesteuert** (Zeitzone Europe/Berlin):

| Warteschlange | Zeitpunkt | Aufgabe |
| --- | --- | --- |
| `frist-reminder` | täglich 06:00, einstellbar (`fristen.scan_zeit`) | Fristen prüfen, Erinnerungen und Eskalationen |
| `scanner` | täglich 01:00 (`scanner.cron_schedule`, abschaltbar) | Akten regelbasiert prüfen, Warnungen erzeugen |
| `gesetze-sync` | täglich 02:00 | Gesetze von GitHub abgleichen |
| `akte-embedding` | täglich 02:30 | Zusammenfassungs-Vektoren der Akten auffrischen |
| `urteile-sync` | täglich 03:00 | neue Bundesurteile aus RSS laden und gegen Akten prüfen |
| `ai-proactive` | alle 4 Stunden (`ai.scan_interval`), wenn **Proaktive Aktenanalyse** an ist | Helena sucht in Akten nach Aufgaben |
| `ai-briefing` | täglich 07:00 (`ai.briefing_time`), wenn zusätzlich **Tagesbriefing** an ist | Briefing für Anwältinnen und Anwälte |
| `gamification` | 00:05, 23:55, montags 00:00 | Tageswechsel, Nachlauf, Wochenstand |
| `caldav-sync` | alle 15 Minuten | Abgleich mit externen Kalendern |

Änderungen an `fristen.scan_zeit` und `scanner.cron_schedule` übernimmt der Worker sofort. Die KI-Zeitpläne liest er nur beim Start; nach einer Änderung unter **Einstellungen → KI** starten Sie den Worker neu (`docker compose restart worker`).

**Auf Anforderung:** `email-send`, `email-sync`, `document-ocr`, `document-preview`, `document-embedding`, `ai-scan`, `ner-pii`, `muster-ingestion`, `helena-task`, `portal-notification` und `test` (nur für den Healthcheck des Workers).

Außer den Warteschlangen hält der Worker dauerhafte IMAP-Verbindungen zu allen aktiven Postfächern.

### Job-Monitor

Admins sehen unter **Job-Monitor** (`/admin/jobs`) alle Warteschlangen mit ihren Zählern. Ein Klick auf eine Warteschlange klappt die Jobs auf, gefiltert nach **Aktiv**, **Wartend**, **Abgeschlossen**, **Fehlgeschlagen**, **Verzoegert**, **Pausiert**.

| Knopf | Wirkung |
| --- | --- |
| **Aktualisieren** | Zähler neu laden |
| **Wiederholen** | einen fehlgeschlagenen Job erneut einreihen |
| **Bereinigen** | bis zu 1000 Jobs mit dem gerade gewählten Status entfernen |
| **Jetzt synchronisieren** | nur bei `gesetze-sync`: Abgleich sofort starten |

Das Paket Bull Board ist zwar installiert, die Seite ist aber eine eigene Ansicht auf Basis von `/api/admin/jobs`.

## Systemstatus und Protokolle

### Healthcheck

`GET /api/health` prüft parallel PostgreSQL, Redis, MinIO, Meilisearch, OnlyOffice, den Worker (ist ein Worker an der Warteschlange `test` angemeldet?), Ollama und Stirling-PDF.

| Aufruf | Antwort |
| --- | --- |
| ohne Anmeldung | `{"status":"ok"}`, `"degraded"` oder `"down"`. HTTP 200, solange PostgreSQL und Redis laufen, sonst 503. |
| als Admin angemeldet | dazu jeder Dienst mit Status, Antwortzeit und Fehlermeldung |

Docker nutzt den Endpunkt alle 30 Sekunden für den Healthcheck von `app`. Für eine externe Überwachung fragen Sie ihn von außen ab und werten `status` aus; `degraded` heißt, dass ein Nebendienst wie OCR oder KI fehlt.

Bei jedem Aufruf schickt AI-Lawyer allen Admins eine E-Mail, wenn ein Dienst ausgefallen ist, höchstens einmal pro Stunde und Dienst. Das setzt SMTP voraus ([Kapitel 20](20-konfiguration.md#e-mail-versand-des-systems-smtp)).

### Seite System

Unter **System** (`/admin/system`, nur ADMIN) steht oben „Alle Systeme betriebsbereit“ oder „Eingeschraenkter Betrieb“ mit Laufzeit und Zeitpunkt der letzten Prüfung, darunter eine Kachel je Dienst. **Auto-Refresh** aktualisiert alle 30 Sekunden.

Der Bereich **Systemprotokoll** zeigt die letzten 200 Einträge mit Filtern **Level** und **Quelle**. Er liest die Datei `<LOG_FILE_PATH>/app.log` im App-Container. Erscheint „Log-Datei nicht gefunden. Logs sind nur in der Produktionsumgebung verfuegbar.“, nutzen Sie die Kommandozeile: Die Protokolle des Workers liegen in einem eigenen Volume, das der App-Container nicht sieht, und die Dateinamen der Rotation weichen von `app.log` ab.

### Protokolle auf der Kommandozeile

Jeder Prozess schreibt im Produktionsbetrieb JSON-Zeilen (pino) auf die Standardausgabe **und** in rotierende Dateien unter `LOG_FILE_PATH` (täglich oder ab 10 MB, Endung `.log`).

```bash
docker compose logs -f app worker                 # live
docker compose logs --since 1h worker | grep '"level":50'   # Fehler der letzten Stunde
docker compose exec worker ls -l /var/log/ai-lawyer/
```

Pegel 50 ist `error`, 60 `fatal`. `LOG_LEVEL` steuert, wie viel geschrieben wird ([Kapitel 20](20-konfiguration.md#protokolle-und-worker)). Die Rotation löscht alte Dateien nicht von selbst. Beobachten Sie die Größe der Volumes `app_logs` und `worker_logs` und räumen Sie bei Bedarf auf. Docker selbst speichert die Standardausgabe zusätzlich; begrenzen Sie das in `/etc/docker/daemon.json` (`"log-opts": {"max-size": "50m", "max-file": "5"}`).

### Häufige Befunde

| Anzeige | Bedeutung | Was tun |
| --- | --- | --- |
| Worker „No workers registered“ | Worker läuft nicht oder hängt beim Start | `docker compose logs worker`; oft wartet er auf einen Dienst, z. B. Ollama oder Stirling-PDF |
| Ollama *unhealthy* | Ollama nicht erreichbar | `docker compose logs ollama`; bei `docker-compose.gpu.yml` GPU-Treiber und NVIDIA Container Toolkit prüfen |
| Viele fehlgeschlagene Jobs in `document-embedding` | Einbettungsmodell fehlt | `docker compose exec ollama ollama pull blaifa/multilingual-e5-large-instruct` |
| Fehlgeschlagene Jobs in `gesetze-sync` mit Ratenlimit | GitHub-Limit ohne Token | `GITHUB_TOKEN` setzen |
| Helena-Aufgabe mit dem Fehler „Worker wurde neu gestartet — Task war noch in Bearbeitung“ | Worker wurde während der Aufgabe neu gestartet; beim Start setzt er laufende Aufgaben auf fehlgeschlagen | Aufgabe neu stellen |
| Login zeigt „Die Anmeldung ist gerade nicht möglich, weil der Anmeldeschutz nicht erreichbar ist“; im Log `"event":"login_limiter_unavailable"` | Redis nicht erreichbar oder zu langsam (über 1 s). Neue Anmeldungen werden absichtlich abgelehnt, statt ungebremst durchgelassen; angemeldete Personen arbeiten weiter | `docker compose ps redis`, `docker compose logs redis`; nach dem Neustart von Redis geht die Anmeldung von selbst wieder. Für eine Überwachung nach `login_limiter_unavailable` im Log alarmieren |
| Alle Mitarbeitenden bekommen gleichzeitig „Zu viele Anmeldeversuche“ | Hinter einem Reverse-Proxy ohne `TRUST_PROXY_HOPS=1` sehen alle Anfragen wie eine Quelle aus | `TRUST_PROXY_HOPS=1` in der `.env`, `docker compose up -d app` ([Kapitel 20](20-konfiguration.md)) |

## Ressourcenbedarf im Betrieb

- **Arbeitsspeicher:** OnlyOffice und Stirling-PDF sind auf je 4 GB begrenzt (nur `docker-compose.yml`). Ollama hält ein geladenes Modell im (Grafik-)Speicher. Messen Sie mit `docker stats` unter Last, bevor Sie den Server endgültig dimensionieren.
- **Plattenplatz:** wächst vor allem mit `miniodata` (Dokumente, jede Version ist eine eigene Datei, dazu PDF-Vorschauen) und `pgdata` (OCR-Text, Vektoren der Gesetze, Urteile und Muster). Dazu kommen Protokolle und `ollama_data` mit den Modellen.
- **Redis** läuft mit `--maxmemory-policy noeviction` und speichert per AOF auf die Platte. Ist der Speicher voll, lehnt Redis Schreibzugriffe ab; Jobs schlagen dann fehl.
- **Nachtlast:** Zwischen 01:00 und 03:30 laufen Scanner, Gesetzes- und Urteilsabgleich mit Einbettungen. Das erzeugt Last auf Ollama und Datenbank.

---

Weiter: [22 — Architektur und Entwicklung](22-architektur-und-entwicklung.md) · [Zur Übersicht](README.md)
