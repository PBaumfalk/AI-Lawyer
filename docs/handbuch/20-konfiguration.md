# 20 — Konfiguration

Dieses Kapitel listet alle Umgebungsvariablen, die AI-Lawyer liest, mit Standardwert und Wirkung. Grundlage sind `.env.example`, die Compose-Dateien und jede Stelle im Code, die `process.env` liest.

## Wie die Werte in die Container kommen

- **`docker-compose.yml`** liest alle Werte aus der Datei `.env` im selben Ordner (erzeugt von `./setup.sh` oder per `cp .env.example .env`). Die Geheimnisse sind Pflicht: Fehlt eines, bricht `docker compose up` mit einer Meldung wie „POSTGRES_PASSWORD fehlt in .env“ ab, statt mit Entwicklungswerten zu starten. `app` und `worker` erhalten dieselben Werte (gemeinsamer Block `x-app-env`).
- **`docker-compose.portainer.yml`** liest Werte über Platzhalter aus der `.env` bzw. aus den Stack-Variablen in Portainer. Pflicht sind dort nur `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `EMAIL_ENCRYPTION_KEY` und `ONLYOFFICE_SECRET`; der Worker erhält keine SMTP- und KI-Werte ([Kapitel 19](19-installation.md#zwei-compose-dateien)).
- In beiden Fällen gelangt nur in den Container, was die Compose-Datei ausdrücklich aufführt. Variablen, die in keiner Compose-Datei stehen (`GITHUB_TOKEN`, `PORTAL_BASE_URL`, `NEXT_PUBLIC_APP_URL`, `EMBEDDING_MODEL`), tragen Sie bei Bedarf in einer eigenen Zusatzdatei ein (z. B. `docker-compose.kanzlei.yml` mit einem Abschnitt `services: worker: environment:`), die Sie über `COMPOSE_FILE` einbinden.
- Der Abschnitt „Nur lokale Entwicklung“ in `.env.example` (`DATABASE_URL`, `REDIS_URL`, `MINIO_ENDPOINT` usw.) gilt nur für `npm run dev` ohne Docker. In den Containern setzt die Compose-Datei diese Werte selbst auf die Docker-internen Adressen.
- Viele Einstellungen stehen nicht in Variablen, sondern in der Datenbank (Tabelle `system_settings`) und werden in der Oberfläche gepflegt: KI-Anbieter, Modell, API-Schlüssel, Uhrzeit des Fristen-Scans, beA, Gamification. Siehe [Kapitel 16](16-einstellungen-und-vorlagen.md).

Nach jeder Änderung: `docker compose up -d` (erzeugt die betroffenen Container neu). Ein bloßes `restart` übernimmt geänderte Werte nicht. `KANZLEI_NAME` wirkt erst nach einem neuen Build (`docker compose up -d --build`).

**Legende:** *Pflicht* = ohne Wert startet Compose nicht oder ein Kernbereich funktioniert nicht. *Optional* = Funktion entfällt oder ein Standard greift. Standardwert = Rückfallwert im Code, wenn die Variable fehlt; in Klammern der Wert, den `docker-compose.yml` fest setzt oder als Standard einträgt.

## Adresse und Anmeldung

| Variable | Dienst | Standard | Pflicht | Wirkung |
| --- | --- | --- | --- | --- |
| `NEXTAUTH_URL` | app | – | Pflicht | Öffentliche Adresse der Anwendung. NextAuth leitet daraus Rücksprungadressen ab. Grundlage für Links in Portal-Einladungen, Passwort-Reset-Mails und Portal-Benachrichtigungen. In der Portainer-Datei auch Grundlage für `MINIO_PUBLIC_URL` und `ONLYOFFICE_URL`. Ohne Schrägstrich am Ende und ohne Port, wenn Sie die Portainer-Datei nutzen. |
| `NEXTAUTH_SECRET` | app, worker | – | Pflicht | Signiert die Sitzungs-Tokens (JWT), das Zwischen-Token der Zwei-Faktor-Anmeldung und prüft die Socket.IO-Anmeldung. NextAuth akzeptiert auch `AUTH_SECRET`. Wechsel meldet alle ab. `setup.sh` erzeugt ihn mit `openssl rand -hex 32`. |
| `AUTH_TRUST_HOST` | app | – (`"true"`) | Pflicht hinter Proxy | NextAuth vertraut dem `Host`-Header. In beiden Compose-Dateien gesetzt. |
| `TOTP_REQUIRED_ROLES` | app | leer | optional | Kommagetrennte Rollen, die Zwei-Faktor-Anmeldung einrichten müssen, z. B. `ADMIN,ANWALT`. Betroffene ohne eingerichtetes TOTP werden auf `/2fa-setup-required` umgeleitet; erreichbar bleibt nur `/einstellungen`. Ausgewertet in der Middleware (`src/lib/auth.config.ts`). Die Datenbank-Einstellung `auth.totp.requiredRoles` wird dagegen nirgends gelesen. |

Rollennamen: `ADMIN`, `ANWALT`, `SACHBEARBEITER`, `SEKRETARIAT`, `MANDANT` ([Kapitel 15](15-benutzer-und-rollen.md)).

## Anmeldung und Sicherheit

| Variable | Dienst | Standard | Pflicht | Wirkung |
| --- | --- | --- | --- | --- |
| `EMAIL_ENCRYPTION_KEY` | app, worker | – | Pflicht | Schlüssel für AES-256-GCM (Ableitung per scrypt). Damit werden verschlüsselt in der Datenbank abgelegt: die Zugangsdaten der E-Mail-Postfächer, der CalDAV-Konten und der j-lawyer-Verbindung, die KI-API-Schlüssel aus **Einstellungen → KI** und die Zwei-Faktor-Geheimnisse (TOTP) der Benutzer. Mindestens 32 Zeichen, sonst Fehler „EMAIL_ENCRYPTION_KEY muss mindestens 32 Zeichen lang sein.“ Erzeugen: `openssl rand -hex 32`. **Nicht nachträglich ändern**, sonst sind alle gespeicherten Zugangsdaten, KI-Schlüssel und TOTP-Geheimnisse unlesbar (Log: „Secret setting could not be decrypted (EMAIL_ENCRYPTION_KEY changed?)“). Gehört in die Sicherung ([Kapitel 21](21-betrieb-und-sicherung.md#was-gesichert-werden-muss)). |
| `INITIAL_ADMIN_EMAIL` | app | `admin@kanzlei.de` | optional | Anmeldename des einzigen Kontos, das der allererste Start anlegt. Danach ohne Wirkung. |
| `INITIAL_ADMIN_PASSWORD` | app | leer | empfohlen | Startpasswort dieses Kontos, mindestens 12 Zeichen (kürzer: Start bricht ab). Leer: Zufallspasswort, einmalig im Log der App. Nach der ersten Anmeldung ändern und aus `.env` löschen ([Kapitel 19](19-installation.md#erste-anmeldung)). |
| `SEED_DEMO` | app | `false` | optional | `true` legt beim allerersten Start zusätzlich Beispielkonten (Passwort `password123`), Kontakte, eine Akte und E-Mails an. Nur zum Ausprobieren. |
| `TRUST_PROXY_HOPS` | app | `0` | bei Reverse-Proxy | Anzahl vertrauenswürdiger Proxys direkt vor der App. `0`: Die Adresse der TCP-Verbindung zählt, `X-Forwarded-For` wird ignoriert (sonst könnte jeder Client seine Adresse fälschen). Hinter Caddy/nginx/Traefik `1`; der Proxy muss `X-Forwarded-For` anhängen. |
| `LOGIN_LIMIT_QUELLE_KONTO`, `LOGIN_LIMIT_QUELLE`, `LOGIN_LIMIT_KONTO_GESAMT`, `LOGIN_LIMIT_TOTP`, `LOGIN_LIMIT_FENSTER_SEKUNDEN` | app | `10`, `100`, `50`, `10`, `900` | optional | Grenzen des Anmeldeschutzes ([Kapitel 15](15-benutzer-und-rollen.md#anmeldeschutz)). |
| `LIMITER_TIMEOUT_MS`, `LIMITER_CONNECT_WAIT_MS` | app | `500`, `1000` | optional | Wie lange der Anmeldeschutz auf Redis wartet, bevor er eine Anmeldung mit „gerade nicht möglich“ ablehnt. |
| `JLAWYER_ALLOW_PRIVATE_URLS` | app | nicht gesetzt | optional | Nur der Wert `true` erlaubt bei der j-lawyer-Migration Adressen im eigenen Netz (`localhost`, private IP-Bereiche) und unverschlüsseltes `http`. Sonst: „Private/lokale Hosts sind nicht erlaubt. Fuer On-Premises-Installationen JLAWYER_ALLOW_PRIVATE_URLS=true setzen.“ ([Kapitel 17](17-migration-aus-j-lawyer.md)) |
| `OPENCLAW_GATEWAY_TOKEN` | app | nicht gesetzt | optional | Token für die Schnittstelle `/api/openclaw/*` (Aufgaben, Entwürfe, Notizen für ein externes Agenten-Gateway). Ohne Wert lehnen diese Endpunkte jede Anfrage ab. Wer sie nutzt: langen Zufallswert setzen, **nie** den Beispielwert aus `.env.example`, denn die Endpunkte sind von der normalen Anmeldung ausgenommen. |

## Datenbank und Redis

| Variable | Dienst | Standard | Pflicht | Wirkung |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | app, worker | – | Pflicht | PostgreSQL-Verbindung für Prisma. In Compose aus Benutzer `ailawyer`, `POSTGRES_PASSWORD` und Host `db` zusammengesetzt; in der `.env` nur für die lokale Entwicklung. |
| `POSTGRES_PASSWORD` | nur Compose | – (Portainer: `ailawyer`) | Pflicht | Setzt das Passwort im Container `db` und in `DATABASE_URL` von App und Worker. Nach dem ersten Start ändert eine neue Angabe das Passwort in der bestehenden Datenbank **nicht**; dann zusätzlich per `ALTER USER ailawyer PASSWORD '…';` anpassen. |
| `REDIS_PASSWORD` | nur Compose | – (Portainer: nicht vorgesehen) | Pflicht | Passwort von Redis (`--requirepass`); geht in `REDIS_URL` von App und Worker ein. Die Portainer-Datei betreibt Redis ohne Passwort. |
| `REDIS_URL` | app, worker | `redis://localhost:6379` (`redis://:REDIS_PASSWORD@redis:6379`) | Pflicht | Warteschlangen (BullMQ), Socket.IO-Adapter, Sperren für Ratenbegrenzung und Abklingzeit der Systemwarnungen. In der `.env` nur für die lokale Entwicklung. |

## Dateispeicher (MinIO)

| Variable | Dienst | Standard | Pflicht | Wirkung |
| --- | --- | --- | --- | --- |
| `MINIO_ENDPOINT` | app, worker | `localhost` (`minio`) | Pflicht | Hostname für Server-Zugriffe. |
| `MINIO_PORT` | app, worker | `9000` | Pflicht | Port der S3-API. |
| `MINIO_ACCESS_KEY` | app, worker | `ailawyer` | Pflicht | Zugangsschlüssel, zugleich `MINIO_ROOT_USER` des Containers. |
| `MINIO_SECRET_KEY` | app, worker | `ailawyer123` (Compose: Pflicht, kein Standard; Portainer: `ailawyer123`) | Pflicht | Geheimschlüssel, zugleich `MINIO_ROOT_PASSWORD`. Wie beim Datenbankpasswort gilt: Nach dem ersten Start ändert ein neuer Wert die Zugangsdaten in den bestehenden MinIO-Daten nicht automatisch. |
| `MINIO_BUCKET` | app, worker | `dokumente` | optional | Name des Buckets. Wird beim ersten Upload angelegt. |
| `MINIO_USE_SSL` | app, worker | `false` | optional | `true` = HTTPS zu MinIO. |
| `MINIO_PUBLIC_URL` | app | `http(s)://MINIO_ENDPOINT:MINIO_PORT` (`http://localhost:9000`; Portainer: `NEXTAUTH_URL`; `setup.sh`: App-Adresse mit Port 9000) | Pflicht für Downloads | Adresse, auf die die vorsignierten Download-Links zeigen. Muss vom Browser erreichbar sein, z. B. `https://dateien.kanzlei.example` ([Kapitel 19](19-installation.md#reverse-proxy-mit-https)). Gültigkeit der Links: eine Stunde. |
| `MINIO_IMAGE` | nur Compose | `cgr.dev/chainguard/minio:latest` | optional | Anderes MinIO-Image, z. B. ein eigener Spiegel. Gilt für `minio` und `minio-init`. Das Image muss `mc` enthalten ([Kapitel 19](19-installation.md#bekannte-stolpersteine)). |

## Suche (Meilisearch)

| Variable | Dienst | Standard | Pflicht | Wirkung |
| --- | --- | --- | --- | --- |
| `MEILISEARCH_URL` | app, worker | `http://localhost:7700` (`http://meilisearch:7700`) | Pflicht | Adresse des Suchdienstes. |
| `MEILISEARCH_API_KEY` | app, worker | `ailawyer-meili-key` (Compose: Pflicht, kein Standard) | Pflicht | Schlüssel; in Compose zugleich `MEILI_MASTER_KEY` des Containers. |

## OnlyOffice

| Variable | Dienst | Standard | Pflicht | Wirkung |
| --- | --- | --- | --- | --- |
| `ONLYOFFICE_URL` | app | `http://localhost:8080` (`setup.sh`: App-Adresse mit Port 8080) | Pflicht | Adresse, unter der der **Browser** OnlyOffice erreicht. Steht hier `localhost` oder `127.0.0.1`, setzt die App Hostname und Protokoll aus der Anfrage ein und behält den Port (8080). Jeder andere Wert wird unverändert verwendet. Hinter HTTPS fest setzen, z. B. `https://office.kanzlei.example`. |
| `ONLYOFFICE_INTERNAL_URL` | app | Wert von `ONLYOFFICE_URL` (`http://onlyoffice:80`) | Pflicht in Docker | Adresse für Server-zu-Server-Aufrufe (Konvertierung nach PDF, Healthcheck, Umschreiben der Rückgabe-URLs). |
| `ONLYOFFICE_SECRET` | app | leer | Pflicht | Gemeinsames JWT-Geheimnis mit OnlyOffice. Beide Compose-Dateien geben denselben Wert an die App und als `JWT_SECRET` an den OnlyOffice-Container; fehlt er, bricht Compose ab. |
| `APP_INTERNAL_URL` | app | `http://host.docker.internal:3000` (`http://app:3000`) | Pflicht in Docker | Adresse, unter der OnlyOffice die App erreicht, um Dokumente zu laden und Speicherstände zurückzuschicken (`/api/onlyoffice/…`). |

## OCR und PDF (Stirling-PDF)

| Variable | Dienst | Standard | Pflicht | Wirkung |
| --- | --- | --- | --- | --- |
| `STIRLING_PDF_URL` | app, worker | `http://stirling-pdf:8080` (OCR, PDF-Werkzeuge); im Healthcheck `http://localhost:8081` | Pflicht für OCR | Adresse von Stirling-PDF. In beiden Compose-Dateien `http://stirling-pdf:8080`. |

## KI

| Variable | Dienst | Standard | Pflicht | Wirkung |
| --- | --- | --- | --- | --- |
| `OLLAMA_URL` | app, worker | `http://localhost:11434` (`http://ollama:11434`) | Pflicht | Adresse von Ollama für Einbettungen, Reranking, Erkennung personenbezogener Daten und den Healthcheck. Außerdem Startwert der Datenbank-Einstellung **Ollama-URL** beim ersten Worker-Start. |
| `EMBEDDING_MODEL` | worker, app | `blaifa/multilingual-e5-large-instruct` | optional, **nicht ändern** | Modell für die Einbettungen. Die Datenbankspalten haben fest 1024 Dimensionen (`vector(1024)`); ein anderes Modell muss ebenfalls 1024-dimensionale Vektoren liefern. Die Compose-Dateien reichen die Variable nicht durch. |
| `AI_PROVIDER` | worker | `ollama` | optional | Startwert für den KI-Anbieter (`ollama`, `openai` oder `anthropic`). Wird nur beim allerersten Worker-Start übernommen, solange die Einstellung in der Datenbank noch nicht existiert. |
| `AI_MODEL` | worker | leer | optional | Startwert für das Modell; leer = Standard des Anbieters (`qwen3.5:35b`, `gpt-4o`, `claude-sonnet-4-20250514`). |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | worker | leer | optional | Startwert für den API-Schlüssel des in `AI_PROVIDER` gewählten Anbieters; wird verschlüsselt gespeichert. |

Danach gilt ausschließlich die Oberfläche: Anbieter, Modell, API-Schlüssel und Ollama-URL für Helena liest `src/lib/ai/provider.ts` aus der Datenbank (`ai.provider`, `ai.provider.model`, `ai.provider.apiKey`, `ai.ollama.url`). Ein Admin ändert sie unter **Einstellungen → KI** ([Kapitel 19](19-installation.md#ki-einrichten-und-modelle-laden), [Kapitel 16](16-einstellungen-und-vorlagen.md)). Eine spätere Änderung der Variablen wirkt nicht mehr.

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

`docker-compose.yml` reicht die SMTP-Werte aus der `.env` an `app` **und** `worker` durch. Die Portainer-Datei gibt sie nur an `app`; Fristerinnerungen und Portal-Benachrichtigungen per Mail entfallen dort.

## Mandantenportal

| Variable | Dienst | Standard | Pflicht | Wirkung |
| --- | --- | --- | --- | --- |
| `PORTAL_BASE_URL` | worker | `NEXTAUTH_URL` + `/portal` | optional | Basis der Links in Portal-Benachrichtigungen. |
| `NEXT_PUBLIC_APP_URL` | app | `NEXTAUTH_URL` | optional | Basis des Links in der Passwort-Reset-Mail des Portals. Als `NEXT_PUBLIC_`-Variable wird sie beim Build eingesetzt. |
| `KANZLEI_NAME` | Build | `Kanzlei` | optional | Kanzleiname auf der Seite zur Portal-Aktivierung. `docker-compose.yml` gibt ihn als Build-Argument `NEXT_PUBLIC_KANZLEI_NAME` an das `Dockerfile`; er wird beim Bauen eingesetzt, eine Änderung braucht `docker compose up -d --build`. Die Portainer-Datei kennt ihn nicht (dort erscheint „Kanzlei“). |

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
| `COMPOSE_FILE` | Liste der Compose-Dateien, getrennt durch `:`, z. B. `docker-compose.yml:docker-compose.gpu.yml`. Spart das `-f` bei jedem Befehl. |
| `PUBLIC_BIND` | Netzwerkschnittstelle, an die App (3000), OnlyOffice (8080) und MinIO (9000) gebunden werden. Standard `0.0.0.0`; hinter einem Reverse Proxy `127.0.0.1`. Alle übrigen Dienste hören fest nur auf `127.0.0.1`. |
| `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `MINIO_IMAGE`, `KANZLEI_NAME` | siehe oben. |
| `OLLAMA_MEMORY_LIMIT` | nur Portainer-Datei: Speichergrenze für Ollama, Standard `8g`. |

Im Container von OnlyOffice stehen außerdem `JWT_ENABLED`, `JWT_SECRET`, `JWT_HEADER`, `JWT_IN_BODY`, `ALLOW_PRIVATE_IP_ADDRESS` und `ALLOW_META_IP_ADDRESS`. Die beiden letzten müssen `true` bleiben, sonst darf OnlyOffice die App im Docker-Netz nicht abrufen.

## Wenn etwas nicht klappt

| Meldung | Bedeutung | Was tun |
| --- | --- | --- |
| „… fehlt in .env“ (beim `docker compose up` mit `docker-compose.yml`) bzw. `… is required` (Portainer) | Pflichtvariable fehlt. | In `.env` bzw. Portainer setzen oder `./setup.sh` erneut ausführen. |
| „EMAIL_ENCRYPTION_KEY muss mindestens 32 Zeichen lang sein. Bitte in .env setzen.“ | Schlüssel fehlt oder ist zu kurz. | `openssl rand -hex 32`, Container neu erzeugen. |
| `ONLYOFFICE_SECRET is not configured` im Log | App kann keine Tokens für OnlyOffice erzeugen (nur bei eigener Compose-Datei möglich). | `ONLYOFFICE_SECRET` setzen, gleich `JWT_SECRET`. |
| NOAUTH-Fehler von Redis im Log | `REDIS_URL` ohne oder mit falschem Passwort. | Container mit `docker compose up -d` neu erzeugen; bei lokaler Entwicklung `REDIS_URL` in der `.env` prüfen. |
| „Private/lokale Hosts sind nicht erlaubt …“ | j-lawyer liegt im eigenen Netz. | `JLAWYER_ALLOW_PRIVATE_URLS=true` im Dienst `app`. |
| „Ungültiger oder fehlender OpenClaw-Token“ | Aufruf von `/api/openclaw/*` ohne gültiges Token. | Token setzen oder Aufrufer prüfen. |
| Keine Fristerinnerungen per Mail | SMTP nicht gesetzt (oder Portainer-Datei, die SMTP nur an `app` gibt). | `SMTP_*` in der `.env` setzen; bei Portainer eine Zusatzdatei für `worker`. |

---

Weiter: [21 — Betrieb und Sicherung](21-betrieb-und-sicherung.md) · [Zur Übersicht](README.md)
