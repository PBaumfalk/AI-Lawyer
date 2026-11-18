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
3. **Die Geheimnisse:** Ihre `.env`, gegebenenfalls eine eigene Zusatzdatei (z. B. `docker-compose.kanzlei.yml`) und vor allem `EMAIL_ENCRYPTION_KEY`. Ohne diesen Schlüssel lassen sich die gespeicherten Zugangsdaten für E-Mail, CalDAV und j-lawyer, die KI-API-Schlüssel und die Zwei-Faktor-Geheimnisse der Benutzer nicht mehr entschlüsseln ([Kapitel 20](20-konfiguration.md#anmeldung-und-sicherheit)). Bewahren Sie die Geheimnisse getrennt von den Daten auf, etwa im Passwortmanager der Kanzlei.

Der Dump enthält Mandantendaten im Klartext. Zugangsdaten, KI-API-Schlüssel und Zwei-Faktor-Geheimnisse liegen darin verschlüsselt (mit `EMAIL_ENCRYPTION_KEY`); Zwei-Faktor-Geheimnisse aus der Zeit vor dieser Verschlüsselung bleiben im Klartext, bis der Benutzer die Zwei-Faktor-Anmeldung neu einrichtet. `scripts/backup.sh` legt eine Kopie der `.env` mit in den Sicherungsordner, damit eine Wiederherstellung auf dem Server vollständig ist. Bevor Sicherungen den Server verlassen, verschlüsseln Sie sie oder nehmen die `.env` heraus und bewahren sie getrennt auf.

**Meilisearch** muss nicht gesichert werden: Der Index entsteht aus der Datenbank (Name, Ordner, Schlagwörter, OCR-Text). Nach einer Wiederherstellung bauen Sie ihn neu auf (siehe [Suchindex neu aufbauen](#suchindex-neu-aufbauen)).

**Redis** muss nicht gesichert werden. Die zeitgesteuerten Jobs registriert der Worker bei jedem Start neu. Verloren gehen nur Jobs, die zum Zeitpunkt des Ausfalls warteten. Dokumente mit fehlgeschlagener OCR stellt der Worker beim Start selbst wieder in die Warteschlange.

## Sicherung

`scripts/backup.sh` sichert alles Nötige mit einem Befehl:

```bash
scripts/backup.sh
```

Das Skript legt `backups/<JJJJMMTT-HHMMSS>/` an mit:

| Datei | Inhalt |
| --- | --- |
| `db.dump` | Datenbank (`pg_dump -Fc`, im laufenden Betrieb konsistent) |
| `minio.tar.gz` | das ganze Volume `miniodata` (Dateien, Versionen, Bucket-Einstellungen) |
| `.env` | Kopie der Konfiguration, Rechte `600`, **enthält alle Schlüssel** |
| `INFO.txt` | Zeitpunkt, Git-Stand, Projektname |
| `SHA256SUMS` | Prüfsummen aller Dateien |

Für die Dateisicherung hält das Skript `app`, `worker` und `minio` kurz an (bei wenigen GB einige Sekunden) und startet danach nur die Dienste wieder, die vorher liefen, auch bei einem Fehler. Es prüft den Dump (`pg_restore -l`) und das Archiv, schreibt erst in einen Ordner `….partial` und benennt ihn erst nach Erfolg um. Der Exit-Code ist bei jedem Fehler ungleich 0.

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `BACKUP_DIR` | `./backups` | Zielordner |
| `BACKUP_KEEP` | `14` | so viele Sicherungen bleiben, ältere löscht das Skript (`0` = alle behalten) |
| `BACKUP_STOP` | `1` | `0` sichert MinIO ohne Anhalten; gleichzeitige Uploads können dann fehlen |
| `ENV_FILE` | `./.env` | zu sichernde Konfiguration |
| `COMPOSE_FILE`, `COMPOSE_PROJECT_NAME` | | werden wie bei `docker compose` beachtet |

**Nächtlich per Cron** (z. B. `crontab -e` des Benutzers, der Docker bedienen darf), außerhalb der Worker-Nachtjobs (01:00–03:30, siehe [Hintergrund-Jobs](#hintergrund-jobs)):

```cron
30 23 * * * cd /srv/ai-lawyer && COMPOSE_FILE=docker-compose.yml BACKUP_DIR=/srv/backup/ai-lawyer scripts/backup.sh >> /var/log/ai-lawyer-backup.log 2>&1
```

Cron kennt die Umgebung der Anmelde-Shell nicht; setzen Sie `COMPOSE_FILE` in der Zeile so wie in Ihrer Installation. Prüfen Sie das Protokoll und den Exit-Code (z. B. über eine Überwachung, die bei fehlender neuer Sicherung warnt).

**Wichtig:**

- Die Sicherung enthält Mandantendaten im Klartext (siehe [Was gesichert werden muss](#was-gesichert-werden-muss)), und die mitgesicherte `.env` enthält `EMAIL_ENCRYPTION_KEY`. Wer beides hat, hat alles. Verschlüsseln Sie Sicherungen, bevor sie den Server verlassen (z. B. `restic`, `borg` oder `age`), und bewahren Sie die `.env` zusätzlich getrennt auf, etwa im Passwortmanager der Kanzlei. Ohne `EMAIL_ENCRYPTION_KEY` sind die verschlüsselten Einstellungen nicht wiederherstellbar ([Kapitel 20](20-konfiguration.md#anmeldung-und-sicherheit)).
- Eine eigene Zusatzdatei (z. B. `docker-compose.kanzlei.yml`) sichert das Skript nicht mit; sie gehört ins Git-Repository der Kanzlei oder in die getrennte Ablage.
- Eine Kopie auf derselben Platte schützt nicht vor Plattenausfall. Kopieren Sie `BACKUP_DIR` regelmäßig auf ein anderes Gerät.

Die Seite **Einstellungen** bietet zusätzlich einen Export und Import der Einstellungen, das ist keine Datensicherung ([Kapitel 16](16-einstellungen-und-vorlagen.md)).

## Wiederherstellung

```bash
scripts/restore.sh backups/20261118-233000          # fragt nach, Bestätigung mit „ja“
scripts/restore.sh --yes backups/20261118-233000    # ohne Rückfrage
```

Das Skript

1. prüft die Prüfsummen und bricht bei Abweichung ab, ohne etwas zu verändern,
2. hält `app` und `worker` an,
3. spielt den Dump in eine frische Datenbank `ailawyer_restore` ein (eine Transaktion) und tauscht sie erst nach Erfolg gegen `ailawyer` aus; bei einem Fehler bleibt die bisherige Datenbank unverändert, und es bleiben keine Tabellen aus späteren Updates zurück,
4. ersetzt den Inhalt des Volumes `miniodata` und startet MinIO (`minio-init` passt die Besitzrechte an),
5. verwirft den Meilisearch-Index `dokumente`,
6. startet `app` und `worker`.

Danach von Hand: **Suchindex neu aufbauen** (nächster Abschnitt), denn das geschieht nicht automatisch, und eine Stichprobe machen (anmelden, Akte öffnen, Dokument herunterladen und im Editor öffnen). Die Datenbank braucht während der Wiederherstellung kurz doppelten Platz.

**Auf einem neuen Server:** AI-Lawyer in **derselben Version** installieren ([Kapitel 19](19-installation.md)), aber noch nicht starten; die Sicherung auf den Server kopieren und `scripts/restore.sh` aufrufen. Fehlt die `.env`, legt das Skript die gesicherte Kopie mit Rechten `600` an. Dann `docker compose up -d` für die übrigen Dienste und KI-Modelle laden, falls `ollama_data` neu ist. Das Entrypoint-Skript findet die Benutzer vor und überspringt den Seed.

### Wiederherstellung testen

```bash
scripts/test-backup-restore.sh
```

Der Test startet nur `db`, `minio` und `meilisearch` unter dem eigenen Projektnamen `ailawyer-backuptest` (eigene Container und Volumes, keine Ports, Wegwerf-`.env`) und berührt eine laufende Installation nicht. Er legt Testdaten an, sichert, prüft die Aufbewahrungsregel, lässt eine beschädigte Sicherung ablehnen, stellt über veränderte Daten (inklusive Verwerfen des Suchindex) und nach dem Löschen aller Volumes wieder her und vergleicht jeweils Datenbankinhalt und Datei-Prüfsumme. Zum Schluss räumt er alles ab und meldet `ERGEBNIS: BESTANDEN` (Exit-Code 0). Er dauert unter einer Minute.

Der Test belegt die Mechanik, nicht Ihre Sicherungen. Spielen Sie zusätzlich regelmäßig (z. B. vierteljährlich) eine echte Sicherung auf einem Testrechner ein.

## Suchindex neu aufbauen

Eine Schaltfläche dafür gibt es nicht. Der Endpunkt `POST /api/dokumente/reindex` (nur Rolle ADMIN) legt den Index `dokumente` an, falls er fehlt, und indexiert alle Dokumente aus der Datenbank neu. Am einfachsten rufen Sie ihn angemeldet als Admin in der Entwicklerkonsole des Browsers auf:

```js
await (await fetch("/api/dokumente/reindex", { method: "POST" })).json()
```

Die Antwort lautet z. B. `{ success: true, indexed: 412, message: "412 Dokumente indexiert" }`. Bei vielen Dokumenten dauert das einige Minuten; der Aufruf arbeitet die Dokumente nacheinander ab. Die Vektoren für die Helena-Wissenssuche liegen in PostgreSQL und sind davon nicht betroffen.

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

## Ressourcenbedarf im Betrieb

- **Arbeitsspeicher:** OnlyOffice und Stirling-PDF sind auf je 4 GB begrenzt (nur `docker-compose.yml`). Ollama hält ein geladenes Modell im (Grafik-)Speicher. Messen Sie mit `docker stats` unter Last, bevor Sie den Server endgültig dimensionieren.
- **Plattenplatz:** wächst vor allem mit `miniodata` (Dokumente, jede Version ist eine eigene Datei, dazu PDF-Vorschauen) und `pgdata` (OCR-Text, Vektoren der Gesetze, Urteile und Muster). Dazu kommen Protokolle und `ollama_data` mit den Modellen.
- **Redis** läuft mit `--maxmemory-policy noeviction` und speichert per AOF auf die Platte. Ist der Speicher voll, lehnt Redis Schreibzugriffe ab; Jobs schlagen dann fehl.
- **Nachtlast:** Zwischen 01:00 und 03:30 laufen Scanner, Gesetzes- und Urteilsabgleich mit Einbettungen. Das erzeugt Last auf Ollama und Datenbank.

---

Weiter: [22 — Architektur und Entwicklung](22-architektur-und-entwicklung.md) · [Zur Übersicht](README.md)
