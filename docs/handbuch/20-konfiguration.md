# 20 — Konfiguration

Dieses Kapitel listet alle Umgebungsvariablen, die AI-Lawyer liest, mit Standardwert und Wirkung. Grundlage sind `.env.example`, die beiden Compose-Dateien und jede Stelle im Code, die `process.env` liest.

## Wie die Werte in die Container kommen

Das ist der wichtigste Punkt dieses Kapitels, weil er oft missverstanden wird:

- **`docker-compose.yml`** trägt alle Werte fest im Abschnitt `environment:` ein. Eine `.env` im Projektordner hat auf diese Container **keine Wirkung**. Auch nicht die von `setup.sh` erzeugte.
- **`docker-compose.portainer.yml`** liest Werte über Platzhalter (`${NEXTAUTH_URL:?…}`) aus der `.env` bzw. aus den Stack-Variablen in Portainer. Aber auch hier gelangt nur in den Container, was die Datei ausdrücklich aufführt.
- Variablen, die in keiner Compose-Datei stehen (z. B. SMTP, `TOTP_REQUIRED_ROLES`, `JLAWYER_ALLOW_PRIVATE_URLS`, `GITHUB_TOKEN`), tragen Sie in einer eigenen Zusatzdatei ein, wie in [Kapitel 19](19-installation.md#installation-schritt-für-schritt) gezeigt. Achten Sie darauf, ob die Variable im Dienst `app`, im Dienst `worker` oder in beiden gebraucht wird (Spalte **Dienst** unten).
- `.env.example` ist auf die lokale Entwicklung ausgelegt (`localhost`-Adressen) und enthält einige Variablen, die der Code nicht liest. Sie sind unten gekennzeichnet.
- Viele Einstellungen stehen nicht in Variablen, sondern in der Datenbank (Tabelle `system_settings`) und werden in der Oberfläche gepflegt: KI-Anbieter, Modell, API-Schlüssel, Uhrzeit des Fristen-Scans, beA, Gamification. Siehe [Kapitel 16](16-einstellungen-und-vorlagen.md).

Nach jeder Änderung: `docker compose up -d` (erzeugt die betroffenen Container neu). Ein bloßes `restart` übernimmt geänderte Compose-Werte nicht.

**Legende:** *Pflicht* = ohne sinnvollen Wert funktioniert ein Kernbereich nicht. *Optional* = Funktion entfällt oder ein Standard greift. Standardwert = Rückfallwert im Code, wenn die Variable fehlt; in Klammern der Wert aus `docker-compose.yml`, wo er abweicht.

## Adresse und Anmeldung

| Variable | Dienst | Standard | Pflicht | Wirkung |
| --- | --- | --- | --- | --- |
| `NEXTAUTH_URL` | app | – (`http://localhost:3000`) | Pflicht | Öffentliche Adresse der Anwendung. NextAuth leitet daraus Rücksprungadressen ab. Grundlage für Links in Portal-Einladungen, Passwort-Reset-Mails und Portal-Benachrichtigungen. In der Portainer-Datei auch Grundlage für `MINIO_PUBLIC_URL` und `ONLYOFFICE_URL`. Ohne Schrägstrich am Ende und ohne Port, wenn Sie die Portainer-Datei nutzen. |
| `NEXTAUTH_SECRET` | app, worker | – (`dev-secret-change-in-production-abc123xyz`) | Pflicht | Signiert die Sitzungs-Tokens (JWT), das Zwischen-Token der Zwei-Faktor-Anmeldung und prüft die Socket.IO-Anmeldung. NextAuth akzeptiert auch `AUTH_SECRET`. Wechsel meldet alle ab. Erzeugen: `openssl rand -base64 32`. |
| `AUTH_TRUST_HOST` | app | – (`"true"`) | Pflicht hinter Proxy | NextAuth vertraut dem `Host`-Header. In beiden Compose-Dateien gesetzt. |
| `TOTP_REQUIRED_ROLES` | app | leer | optional | Kommagetrennte Rollen, die Zwei-Faktor-Anmeldung einrichten müssen, z. B. `ADMIN,ANWALT`. Betroffene ohne eingerichtetes TOTP werden auf `/2fa-setup-required` umgeleitet; erreichbar bleibt nur `/einstellungen`. Ausgewertet in der Middleware (`src/lib/auth.config.ts`). Die Datenbank-Einstellung `auth.totp.requiredRoles` wird dagegen nirgends gelesen. |

Rollennamen: `ADMIN`, `ANWALT`, `SACHBEARBEITER`, `SEKRETARIAT`, `MANDANT` ([Kapitel 15](15-benutzer-und-rollen.md)).

## Anmeldung und Sicherheit

| Variable | Dienst | Standard | Pflicht | Wirkung |
| --- | --- | --- | --- | --- |
| `EMAIL_ENCRYPTION_KEY` | app, worker | – (`dev-email-encryption-key-change-in-production-32chars`) | Pflicht | Schlüssel für AES-256-GCM. Damit werden die Zugangsdaten der E-Mail-Postfächer, der CalDAV-Konten und der j-lawyer-Verbindung verschlüsselt in der Datenbank abgelegt. Mindestens 32 Zeichen, sonst Fehler „EMAIL_ENCRYPTION_KEY muss mindestens 32 Zeichen lang sein.“ Erzeugen: `openssl rand -hex 32`. **Nicht nachträglich ändern**, sonst sind alle gespeicherten Zugangsdaten unlesbar. Gehört in die Sicherung ([Kapitel 21](21-betrieb-und-sicherung.md#was-gesichert-werden-muss)). |
| `JLAWYER_ALLOW_PRIVATE_URLS` | app | nicht gesetzt | optional | Nur der Wert `true` erlaubt bei der j-lawyer-Migration Adressen im eigenen Netz (`localhost`, private IP-Bereiche) und unverschlüsseltes `http`. Sonst: „Private/lokale Hosts sind nicht erlaubt. Fuer On-Premises-Installationen JLAWYER_ALLOW_PRIVATE_URLS=true setzen.“ ([Kapitel 17](17-migration-aus-j-lawyer.md)) |
| `OPENCLAW_GATEWAY_TOKEN` | app | nicht gesetzt | optional | Token für die Schnittstelle `/api/openclaw/*` (Aufgaben, Entwürfe, Notizen für ein externes Agenten-Gateway). Ohne Wert lehnen diese Endpunkte jede Anfrage ab. Wer sie nutzt: langen Zufallswert setzen, **nie** den Beispielwert aus `.env.example`, denn die Endpunkte sind von der normalen Anmeldung ausgenommen. |
| `OPENCLAW_GATEWAY_URL` | – | – | – | Steht in `.env.example`, wird vom Code nicht gelesen. |

## Datenbank und Redis

| Variable | Dienst | Standard | Pflicht | Wirkung |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | app, worker | – | Pflicht | PostgreSQL-Verbindung für Prisma. In Compose aus Benutzer `ailawyer`, Passwort und Host `db` zusammengesetzt. |
| `POSTGRES_PASSWORD` | nur Compose (Portainer-Datei) | `ailawyer` | dringend empfohlen | Setzt das Passwort im Container `db` und in beiden `DATABASE_URL`. Nach dem ersten Start ändert eine neue Angabe das Passwort in der bestehenden Datenbank **nicht**; dann zusätzlich per `ALTER USER ailawyer PASSWORD '…';` anpassen. |
| `REDIS_URL` | app, worker | `redis://localhost:6379` (`redis://redis:6379`) | Pflicht | Warteschlangen (BullMQ), Socket.IO-Adapter, Sperren für Ratenbegrenzung und Abklingzeit der Systemwarnungen. |

## Dateispeicher (MinIO)

| Variable | Dienst | Standard | Pflicht | Wirkung |
| --- | --- | --- | --- | --- |
| `MINIO_ENDPOINT` | app, worker | `localhost` (`minio`) | Pflicht | Hostname für Server-Zugriffe. |
| `MINIO_PORT` | app, worker | `9000` | Pflicht | Port der S3-API. |
| `MINIO_ACCESS_KEY` | app, worker | `ailawyer` | Pflicht | Zugangsschlüssel, in der Portainer-Datei zugleich `MINIO_ROOT_USER`. |
| `MINIO_SECRET_KEY` | app, worker | `ailawyer123` | Pflicht, **ändern** | Geheimschlüssel, zugleich `MINIO_ROOT_PASSWORD`. Wie beim Datenbankpasswort gilt: Nach dem ersten Start ändert ein neuer Wert die Zugangsdaten in den bestehenden MinIO-Daten nicht automatisch. |
| `MINIO_BUCKET` | app, worker | `dokumente` | optional | Name des Buckets. Wird beim ersten Upload angelegt. |
| `MINIO_USE_SSL` | app, worker | `false` | optional | `true` = HTTPS zu MinIO. |
| `MINIO_PUBLIC_URL` | app | `http(s)://MINIO_ENDPOINT:MINIO_PORT` (`http://localhost:9000`; Portainer: `NEXTAUTH_URL`) | Pflicht für Downloads | Adresse, auf die die vorsignierten Download-Links zeigen. Muss vom Browser erreichbar sein, z. B. `https://dateien.kanzlei.example` ([Kapitel 19](19-installation.md#reverse-proxy-mit-https)). Gültigkeit der Links: eine Stunde. |

## Suche (Meilisearch)

| Variable | Dienst | Standard | Pflicht | Wirkung |
| --- | --- | --- | --- | --- |
| `MEILISEARCH_URL` | app, worker | `http://localhost:7700` (`http://meilisearch:7700`) | Pflicht | Adresse des Suchdienstes. |
| `MEILISEARCH_API_KEY` | app, worker | `ailawyer-meili-key` | Pflicht, **ändern** | Schlüssel; in Compose zugleich `MEILI_MASTER_KEY` des Containers. |

## OnlyOffice

| Variable | Dienst | Standard | Pflicht | Wirkung |
| --- | --- | --- | --- | --- |
| `ONLYOFFICE_URL` | app | `http://localhost:8080` | Pflicht | Adresse, unter der der **Browser** OnlyOffice erreicht. Steht hier `localhost` oder `127.0.0.1`, setzt die App Hostname und Protokoll aus der Anfrage ein und behält den Port (8080). Jeder andere Wert wird unverändert verwendet. Hinter HTTPS fest setzen, z. B. `https://office.kanzlei.example`. |
| `ONLYOFFICE_INTERNAL_URL` | app | Wert von `ONLYOFFICE_URL` (`http://onlyoffice:80`) | Pflicht in Docker | Adresse für Server-zu-Server-Aufrufe (Konvertierung nach PDF, Healthcheck, Umschreiben der Rückgabe-URLs). |
| `ONLYOFFICE_SECRET` | app | leer (`dev-onlyoffice-secret`) | Pflicht | Gemeinsames JWT-Geheimnis mit OnlyOffice (`JWT_SECRET` im Container). Ohne Wert signiert die App nicht; der Container hat JWT aber eingeschaltet, also scheitert der Editor. Beide Werte müssen gleich sein. |
| `APP_INTERNAL_URL` | app | `http://host.docker.internal:3000` (`http://app:3000`) | Pflicht in Docker | Adresse, unter der OnlyOffice die App erreicht, um Dokumente zu laden und Speicherstände zurückzuschicken (`/api/onlyoffice/…`). |

## OCR und PDF (Stirling-PDF)

| Variable | Dienst | Standard | Pflicht | Wirkung |
| --- | --- | --- | --- | --- |
| `STIRLING_PDF_URL` | app, worker | `http://stirling-pdf:8080` (OCR, PDF-Werkzeuge); im Healthcheck `http://localhost:8081` | Pflicht für OCR | Adresse von Stirling-PDF. In beiden Compose-Dateien `http://stirling-pdf:8080`. |

## KI

| Variable | Dienst | Standard | Pflicht | Wirkung |
| --- | --- | --- | --- | --- |
| `OLLAMA_URL` | app, worker | `http://localhost:11434` (`http://ollama:11434`) | Pflicht | Adresse von Ollama für Einbettungen, Reranking, Erkennung personenbezogener Daten und den Healthcheck. Außerdem Startwert der Datenbank-Einstellung **Ollama-URL** beim ersten Worker-Start. |
| `EMBEDDING_MODEL` | worker, app | `blaifa/multilingual-e5-large-instruct` | optional, **nicht ändern** | Modell für die Einbettungen. Die Datenbankspalten haben fest 1024 Dimensionen (`vector(1024)`). Der Beispielwert `nomic-embed-text` in `.env.example` passt **nicht** dazu; lassen Sie die Variable weg. |

Was **nicht** über Variablen geht: KI-Anbieter, Modell, API-Schlüssel und Ollama-URL für Helena liest `src/lib/ai/provider.ts` aus der Datenbank (`ai.provider`, `ai.provider.model`, `ai.provider.apiKey`, `ai.ollama.url`). Ein Admin stellt sie unter **Einstellungen → KI** ein ([Kapitel 19](19-installation.md#ki-einrichten-und-modelle-laden), [Kapitel 16](16-einstellungen-und-vorlagen.md)). Standard nach der Installation: Ollama mit `qwen3.5:35b`.

Folgende Variablen aus `.env.example`, `setup.sh` bzw. der Portainer-Datei liest der Code **nicht**. Sie können sie weglassen:

| Variable | Bemerkung |
| --- | --- |
| `AI_PROVIDER`, `AI_MODEL` | Ersetzt durch die Einstellungen in der Oberfläche. |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | API-Schlüssel stehen in **Einstellungen → KI**. |
| `OLLAMA_BASE_URL` | Ersetzt durch `OLLAMA_URL`. |
| `OLLAMA_DEFAULT_MODEL` | Die Modelle, die beim Start gezogen werden, stehen fest in `docker-entrypoint.sh`. |
| `OLLAMA_NUM_CTX` | Die Kontextgröße wird nicht an Ollama übergeben. |

## E-Mail-Versand des Systems (SMTP)

Diese Werte gelten für Mails, die AI-Lawyer selbst verschickt: Fristerinnerungen (Worker), Portal-Einladungen, Passwort-Reset im Portal (App), Portal-Benachrichtigungen (Worker) und Warnungen an Admins, wenn ein Dienst ausfällt (App). Die Postfächer der Anwälte für Ein- und Ausgang werden dagegen in der Oberfläche eingerichtet ([Kapitel 7](07-email-und-tickets.md)).

| Variable | Dienst | Standard | Pflicht | Wirkung |
| --- | --- | --- | --- | --- |
| `SMTP_HOST` | app, worker | `localhost` | optional | SMTP-Server. |
| `SMTP_PORT` | app, worker | `587` | optional | Port. |
| `SMTP_SECURE` | app, worker | `false` | optional | `true` = TLS von Beginn an (meist Port 465). |
| `SMTP_USER` | app, worker | leer | optional | Benutzer. **Ohne `SMTP_USER` gilt der Versand als nicht eingerichtet** und wird stillschweigend übersprungen (Log: „Email not configured (SMTP_HOST/SMTP_USER missing), skipping“). |
| `SMTP_PASS` | app, worker | leer | optional | Passwort. |
| `SMTP_FROM` | app, worker | `noreply@kanzlei.local` | optional | Absender. |

Keine der beiden Compose-Dateien reicht SMTP-Werte durch; tragen Sie sie in der Zusatzdatei für `app` **und** `worker` ein.

## Mandantenportal

| Variable | Dienst | Standard | Pflicht | Wirkung |
| --- | --- | --- | --- | --- |
| `PORTAL_BASE_URL` | worker | `NEXTAUTH_URL` + `/portal` | optional | Basis der Links in Portal-Benachrichtigungen. |
| `NEXT_PUBLIC_APP_URL` | app | `NEXTAUTH_URL` | optional | Basis des Links in der Passwort-Reset-Mail des Portals. Als `NEXT_PUBLIC_`-Variable wird sie beim Build eingesetzt. |
| `NEXT_PUBLIC_KANZLEI_NAME` | Build | `Kanzlei` | optional | Kanzleiname auf der Seite zur Portal-Aktivierung. Wirkt nur beim Bauen des Images; das `Dockerfile` reicht sie derzeit nicht durch, es erscheint also „Kanzlei“. |

## Gesetze und Urteile

| Variable | Dienst | Standard | Pflicht | Wirkung |
| --- | --- | --- | --- | --- |
| `GITHUB_TOKEN` | worker | nicht gesetzt | empfohlen | Für den nächtlichen Abgleich der Gesetze aus `bundestag/gesetze`. Ohne Token gilt das GitHub-Limit von 60 Anfragen pro Stunde (Log-Warnung), mit Token 5000. Ein Token ohne besondere Rechte genügt. |

## Protokolle und Worker

| Variable | Dienst | Standard | Pflicht | Wirkung |
| --- | --- | --- | --- | --- |
| `LOG_LEVEL` | app, worker | `info` | optional | `trace`, `debug`, `info`, `warn`, `error`, `fatal`. |
| `LOG_FILE_PATH` | app, worker | `/var/log/ai-lawyer/app` (Worker: `/var/log/ai-lawyer/worker`) | optional | Pfad der rotierenden Protokolldatei (täglich bzw. ab 10 MB, Endung `.log`). Nur bei `NODE_ENV=production`. Details in [Kapitel 21](21-betrieb-und-sicherung.md#systemstatus-und-protokolle). |
| `WORKER_CONCURRENCY` | worker | `5` | optional | Gleichzeitige Jobs je Warteschlange für die meisten Warteschlangen. Einige haben feste Werte (Fristen-Scan 1, E-Mail-Versand 3, E-Mail-Abgleich 2). |

## Laufzeit (vom Image gesetzt)

| Variable | Standard | Wirkung |
| --- | --- | --- |
| `NODE_ENV` | `production` im Image | Schaltet Dateiprotokolle, sichere Cookies und strengere TLS-Prüfung bei SMTP ein. |
| `PORT` | `3000` | Port des Servers. |
| `HOSTNAME` | `0.0.0.0` | Schnittstelle des Servers. |
| `NEXT_PHASE` | – | Wird von Next.js beim Build gesetzt; nicht von Hand setzen. |

## Variablen nur für Compose

| Variable | Wirkung |
| --- | --- |
| `COMPOSE_FILE` | Liste der Compose-Dateien, getrennt durch `:`. Spart das `-f` bei jedem Befehl. |
| `POSTGRES_PASSWORD` | siehe oben. |

Im Container von OnlyOffice stehen außerdem `JWT_ENABLED`, `JWT_SECRET`, `JWT_HEADER`, `JWT_IN_BODY`, `ALLOW_PRIVATE_IP_ADDRESS` und `ALLOW_META_IP_ADDRESS`. Die beiden letzten müssen `true` bleiben, sonst darf OnlyOffice die App im Docker-Netz nicht abrufen.

## Wenn etwas nicht klappt

| Meldung | Bedeutung | Was tun |
| --- | --- | --- |
| `NEXTAUTH_URL is required` (beim `docker compose up`) | Pflichtvariable der Portainer-Datei fehlt. | In `.env` bzw. Portainer setzen. Gleiches gilt für `NEXTAUTH_SECRET` und `EMAIL_ENCRYPTION_KEY`. |
| „EMAIL_ENCRYPTION_KEY muss mindestens 32 Zeichen lang sein. Bitte in .env setzen.“ | Schlüssel fehlt oder ist zu kurz. | `openssl rand -hex 32`, Container neu erzeugen. |
| `ONLYOFFICE_SECRET is not configured` im Log | App kann keine Tokens für OnlyOffice erzeugen. | `ONLYOFFICE_SECRET` setzen, gleich `JWT_SECRET`. |
| „Private/lokale Hosts sind nicht erlaubt …“ | j-lawyer liegt im eigenen Netz. | `JLAWYER_ALLOW_PRIVATE_URLS=true` im Dienst `app`. |
| „Ungültiger oder fehlender OpenClaw-Token“ | Aufruf von `/api/openclaw/*` ohne gültiges Token. | Token setzen oder Aufrufer prüfen. |
| Keine Fristerinnerungen per Mail | SMTP nicht gesetzt oder nur im Dienst `app`. | `SMTP_*` auch für `worker` setzen. |

---

Weiter: [21 — Betrieb und Sicherung](21-betrieb-und-sicherung.md) · [Zur Übersicht](README.md)
