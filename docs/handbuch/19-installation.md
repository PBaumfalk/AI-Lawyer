# 19 — Installation

Dieses Kapitel führt vom leeren Linux-Server bis zur ersten Anmeldung. Es richtet sich an die IT. Rechnen Sie für die erste Installation mit einem halben Tag, vor allem wegen der großen Docker-Images und des KI-Modells.

> **Stand der Software.** AI-Lawyer ist laut README noch nicht für den Produktivbetrieb freigegeben. Testen Sie Installation, Sicherung und Wiederherstellung ([Kapitel 21](21-betrieb-und-sicherung.md)) mit Testdaten, bevor echte Mandantendaten hineinkommen. Die bekannten Stolpersteine stehen unten im Abschnitt [Bekannte Stolpersteine](#bekannte-stolpersteine) und in [Kapitel 23](23-einschraenkungen-und-fragen.md).

## Was installiert wird

AI-Lawyer besteht aus neun Docker-Diensten, dazu einem optionalen zehnten:

| Dienst | Image | Aufgabe |
| --- | --- | --- |
| `app` | eigener Build (`Dockerfile`) | Oberfläche und API, Port 3000 |
| `worker` | derselbe Build, Befehl `node dist-worker/index.js` | Hintergrund-Jobs (OCR, E-Mail, Fristen, KI) |
| `db` | `pgvector/pgvector:pg16` | PostgreSQL 16 mit pgvector |
| `redis` | `redis:7-alpine` | Warteschlangen (BullMQ) |
| `minio` | `minio/minio:latest` | Dateispeicher (S3-kompatibel) |
| `meilisearch` | `getmeili/meilisearch:v1.11` | Volltextsuche |
| `onlyoffice` | `onlyoffice/documentserver:latest` | Bearbeiten von Dokumenten im Browser |
| `stirling-pdf` | `stirlingtools/stirling-pdf:latest-fat` | OCR und PDF-Werkzeuge |
| `ollama` | `ollama/ollama:latest` | lokale KI-Modelle |
| `languagetool` | `erikvl87/languagetool:latest` | nur mit `--profile full`, im Code derzeit nicht angebunden |

Den Aufbau im Einzelnen erklärt [Kapitel 22](22-architektur-und-entwicklung.md).

## Voraussetzungen

**Software:** ein aktuelles 64-Bit-Linux (z. B. Debian 12 oder Ubuntu 24.04), Docker Engine mit dem Plugin Docker Compose V2 (`docker compose`, nicht `docker-compose`), `git` und `openssl`. `setup.sh` bricht ab, wenn Docker, Compose V2 oder der Docker-Dienst fehlen.

**Speicherplatz:** `setup.sh` warnt unter 15 GB freiem Platz („Docker images + Ollama model require ~15-20 GB“). Das ist knapp bemessen: Die Images von OnlyOffice und Stirling-PDF (Variante `latest-fat`) sind groß, das Standardmodell kommt dazu, und Dokumente wachsen mit. Planen Sie mindestens 100 GB auf SSD ein.

**Arbeitsspeicher und Prozessor:** Die Compose-Datei begrenzt OnlyOffice auf 4 GB (2 GB reserviert) und Stirling-PDF auf 4 GB. Dazu kommen PostgreSQL, Meilisearch, Redis, App und Worker. Die folgenden Werte sind Richtwerte, keine gemessenen Mindestwerte:

| Einsatz | CPU | RAM | GPU |
| --- | --- | --- | --- |
| Ausprobieren ohne lokales Sprachmodell (KI über OpenAI/Anthropic, Ollama nur für Einbettungen) | 4 Kerne | 16 GB | keine |
| Kanzleibetrieb mit lokalem Standardmodell `qwen3.5:35b` | 8 Kerne | 64 GB | NVIDIA mit 24 GB VRAM oder mehr |
| Lokales Modell ohne GPU | 16 Kerne | 64 GB | keine (Antworten dauern dann sehr lange) |

**Warum Ollama auch bei Cloud-KI nötig ist:** Unabhängig vom gewählten KI-Anbieter laufen drei Funktionen immer über Ollama (`OLLAMA_URL`): die Einbettungen für die Wissenssuche (`src/lib/embedding/embedder.ts`, Modell `blaifa/multilingual-e5-large-instruct`), das Reranking der Suchtreffer (`src/lib/ai/reranker.ts`, fest `qwen3.5:35b`) und die Erkennung personenbezogener Daten in Schriftsatzmustern (`src/lib/pii/ner-filter.ts`). Außerdem startet `app` erst, wenn der Ollama-Container gesund ist.

**GPU:** `docker-compose.yml` reserviert für Ollama alle NVIDIA-GPUs (`driver: nvidia`). Dafür muss auf dem Server der NVIDIA-Treiber und das NVIDIA Container Toolkit installiert sein. Ohne beides scheitert `docker compose up` beim Ollama-Container. Abhilfe steht unter [Bekannte Stolpersteine](#bekannte-stolpersteine).

**Netz:** Eine eigene Domain mit drei Hostnamen ist für den Betrieb mit HTTPS am einfachsten, etwa `ailawyer.kanzlei.example` (Anwendung), `office.kanzlei.example` (OnlyOffice) und `dateien.kanzlei.example` (MinIO für Downloads). Warum drei, erklärt der Abschnitt [Reverse Proxy mit HTTPS](#reverse-proxy-mit-https).

**Ausgehende Verbindungen:** Der Worker lädt nachts Gesetze von GitHub (`bundestag/gesetze`) und Urteile aus den RSS-Feeds von `rechtsprechung-im-internet.de`. Beim ersten Start zieht er außerdem die Ollama-Modelle.

## Zwei Compose-Dateien

Im Repository liegen zwei Compose-Dateien. Sie unterscheiden sich mehr, als die Namen vermuten lassen:

| Punkt | `docker-compose.yml` | `docker-compose.portainer.yml` |
| --- | --- | --- |
| Geheimnisse und Passwörter | fest eingetragen (`dev-secret-change-in-production-abc123xyz` usw.) | aus Variablen; `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `EMAIL_ENCRYPTION_KEY` sind Pflicht (`:?` – sonst bricht Compose ab) |
| Liest die `.env`? | nein, die Datei enthält keine `${…}`-Platzhalter | ja, für alle Platzhalter |
| `POSTGRES_PASSWORD`, `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY`, `MEILISEARCH_API_KEY` | fest `ailawyer` / `ailawyer123` / `ailawyer-meili-key` | einstellbar, gleiche Standardwerte |
| Veröffentlichte Ports | 3000, 5432, 6379, 9000, 9001, 7700, 8080, 8081, 11434 (LanguageTool 8010) | nur 3000, 5432, 9001, 8080 |
| `MINIO_PUBLIC_URL` | `http://localhost:9000` | gleich `NEXTAUTH_URL` |
| `ONLYOFFICE_URL` | `http://localhost:8080` | `${NEXTAUTH_URL}:8080` |
| Meilisearch | `MEILI_ENV: development` | `MEILI_ENV: production` |
| Ollama | reserviert alle NVIDIA-GPUs | ohne GPU, Speichergrenze 8 GB |
| Stirling-PDF | `latest-fat` | `latest` |
| OnlyOffice-Speichergrenzen | 4 GB / 2 GB reserviert | keine |
| Worker | Healthcheck, wartet auch auf Stirling-PDF | ohne Healthcheck |
| LanguageTool | als Profil `full` | fehlt |
| `AI_PROVIDER`, `AI_MODEL`, API-Schlüssel | nicht gesetzt | gesetzt, aber vom Code nicht gelesen ([Kapitel 20](20-konfiguration.md#ki)) |

**Empfehlung:** Für einen Server mit echten Daten nehmen Sie `docker-compose.portainer.yml` mit einer `.env` und ergänzen eine eigene, kleine Zusatzdatei (siehe [Schritt für Schritt](#installation-schritt-für-schritt)). `docker-compose.yml` eignet sich zum Ausprobieren auf einem einzelnen Rechner.

> **Achtung bei `setup.sh`.** Das Skript schreibt eine `.env` mit frisch erzeugten Geheimnissen, startet aber `docker compose build` und `docker compose up -d` ohne `-f`, also mit `docker-compose.yml`. Diese Datei liest die `.env` nicht. Die Container laufen dann mit den fest eingetragenen Entwicklungs-Geheimnissen, der Adresse `http://localhost:3000` und ohne die gewählte KI-Einstellung. Für einen Test auf dem eigenen Rechner ist das in Ordnung, für einen Server nicht.

## Schnellstart mit setup.sh (nur zum Ausprobieren)

So läuft das Skript ab:

1. Repository holen und Skript starten:
   ```bash
   git clone https://github.com/PBaumfalk/AI-Lawyer.git
   cd AI-Lawyer
   ./setup.sh
   ```
2. Das Skript prüft Docker, Docker Compose V2, ob der Docker-Dienst läuft, und den freien Platz.
3. Gibt es schon eine `.env`, fragt es „Overwrite and reconfigure? [y/N]“. Mit **Enter** bleibt die alte Datei.
4. Es fragt nach der **App URL** (Standard `http://localhost:3000`) und dem KI-Anbieter: **1** Ollama (`qwen3.5:35b`), **2** OpenAI (`gpt-4o`, mit API-Schlüssel), **3** Anthropic (`claude-sonnet-4-6`, mit API-Schlüssel).
5. Es erzeugt mit `openssl` `NEXTAUTH_SECRET`, `EMAIL_ENCRYPTION_KEY` und `ONLYOFFICE_SECRET`, kopiert `.env.example` nach `.env` und trägt die Werte ein.
6. Nach „Jetzt bauen und starten? [Y/n]“ baut es die Images (erster Build 5–10 Minuten) und startet alle Dienste.
7. Es wartet bis zu fünf Minuten, bis der Container `ailawyer-app` als *healthy* gilt, und zeigt dann die Adressen und die Beispielkonten.

Die Angaben aus Schritt 4 wirken wegen der Achtung oben nicht auf die Container. Den KI-Anbieter stellen Sie nach dem Login ohnehin in der Oberfläche ein (siehe [KI einrichten](#ki-einrichten-und-modelle-laden)).

## Installation Schritt für Schritt

1. **Repository holen**
   ```bash
   git clone https://github.com/PBaumfalk/AI-Lawyer.git /opt/ai-lawyer
   cd /opt/ai-lawyer
   ```
2. **`.env` anlegen.** Die Datei liegt neben den Compose-Dateien und wird von `docker compose` für die Platzhalter gelesen. Mindestens:
   ```bash
   NEXTAUTH_URL=https://ailawyer.kanzlei.example
   NEXTAUTH_SECRET=<openssl rand -base64 32>
   EMAIL_ENCRYPTION_KEY=<openssl rand -hex 32>
   ONLYOFFICE_SECRET=<openssl rand -hex 24>
   POSTGRES_PASSWORD=<langes Passwort>
   MINIO_ACCESS_KEY=ailawyer
   MINIO_SECRET_KEY=<langes Passwort>
   MEILISEARCH_API_KEY=<openssl rand -hex 24>
   COMPOSE_FILE=docker-compose.portainer.yml:docker-compose.kanzlei.yml
   ```
   `ONLYOFFICE_SECRET` ist in der Portainer-Datei formal optional, praktisch aber Pflicht: Ohne Wert erhält OnlyOffice das Geheimnis `changeme`, die App signiert gar nicht, und der Editor öffnet keine Dokumente. Mit `COMPOSE_FILE` braucht später kein Befehl mehr `-f`. Alle Variablen erklärt [Kapitel 20](20-konfiguration.md). Schützen Sie die Datei mit `chmod 600 .env`.
3. **Zusatzdatei `docker-compose.kanzlei.yml` anlegen.** Sie trägt ein, was die Portainer-Datei nicht anbietet, und bindet die Ports nur an `127.0.0.1`, damit sie ausschließlich über den Reverse Proxy erreichbar sind. `!override` und `!reset` setzen Docker Compose 2.24.4 oder neuer voraus.
   ```yaml
   services:
     app:
       ports: !override
         - "127.0.0.1:3000:3000"
       environment:
         ONLYOFFICE_URL: https://office.kanzlei.example
         MINIO_PUBLIC_URL: https://dateien.kanzlei.example
         TOTP_REQUIRED_ROLES: ADMIN,ANWALT
         SMTP_HOST: smtp.kanzlei.example
         SMTP_PORT: "587"
         SMTP_USER: ailawyer@kanzlei.example
         SMTP_PASS: ${SMTP_PASS}
         SMTP_FROM: ailawyer@kanzlei.example
     worker:
       environment:
         SMTP_HOST: smtp.kanzlei.example
         SMTP_PORT: "587"
         SMTP_USER: ailawyer@kanzlei.example
         SMTP_PASS: ${SMTP_PASS}
         SMTP_FROM: ailawyer@kanzlei.example
     db:
       ports: !reset []
     minio:
       image: <Ihr MinIO-Image, siehe Stolpersteine>
       ports: !override
         - "127.0.0.1:9000:9000"
     onlyoffice:
       ports: !override
         - "127.0.0.1:8080:80"
     ollama:
       deploy: !override
         resources:
           reservations:
             devices:
               - driver: nvidia
                 count: all
                 capabilities: [gpu]
   ```
   Den `ollama`-Block lassen Sie weg, wenn der Server keine NVIDIA-GPU hat. Die Speichergrenze von 8 GB aus der Portainer-Datei bleibt dann bestehen. Für `qwen3.5:35b` reicht sie nicht; ersetzen Sie sie dann durch einen höheren Wert oder nutzen Sie ein kleineres Modell (siehe unten). Die MinIO-Konsole (Port 9001) brauchen Sie nur zur Fehlersuche; ohne Eintrag bleibt sie auf allen Schnittstellen offen.
4. **Prüfen**, ob Compose die Dateien zusammenbekommt:
   ```bash
   docker compose config --quiet && echo OK
   ```
5. **Bauen und starten:**
   ```bash
   docker compose up -d --build
   docker compose logs -f app
   ```
6. **Reverse Proxy einrichten** (nächster Abschnitt) und **Migrationslücke schließen** (Abschnitt [Erster Start](#erster-start-was-docker-entrypointsh-tut)).

## Mit Portainer

1. Portainer → **Stacks** → **Add stack** → **Repository**.
2. Repository-URL `https://github.com/PBaumfalk/AI-Lawyer`, Compose-Pfad `docker-compose.portainer.yml`.
3. Unter **Environment variables** mindestens `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `EMAIL_ENCRYPTION_KEY` und `ONLYOFFICE_SECRET` setzen, besser auch `POSTGRES_PASSWORD`, `MINIO_SECRET_KEY` und `MEILISEARCH_API_KEY`.
4. **Deploy the stack**. Das Image wird auf dem Server gebaut, der erste Lauf dauert entsprechend.

Grenzen dieses Wegs: Alles, was nicht als Variable in der Datei steht (`MINIO_PUBLIC_URL`, `ONLYOFFICE_URL`, SMTP, `TOTP_REQUIRED_ROLES`, ein anderes MinIO-Image), lässt sich in Portainer nicht ohne Änderung der Compose-Datei setzen. Dafür brauchen Sie einen eigenen Fork des Repositorys oder den Weg über die Kommandozeile oben.

## Reverse Proxy mit HTTPS

Der Browser spricht mit drei Diensten direkt. Das ergibt sich aus dem Code:

| Ziel | Intern | Warum der Browser hin muss |
| --- | --- | --- |
| Anwendung | `app:3000` | Oberfläche, API, Socket.IO unter `/socket.io/` |
| OnlyOffice | `onlyoffice:80` (Host-Port 8080) | Der Browser lädt `…/web-apps/apps/api/documents/api.js` direkt von `ONLYOFFICE_URL`; der Editor hält WebSocket-Verbindungen. |
| MinIO | `minio:9000` | Downloads laufen über vorsignierte S3-Links auf `MINIO_PUBLIC_URL` (`src/lib/storage.ts`, `getDownloadUrl`), Pfad `/dokumente/akten/…` bzw. `/dokumente/vorlagen/…`. |

Zwei Hinweise zur Wahl der Adressen:

- **OnlyOffice:** Steht `ONLYOFFICE_URL` auf `localhost`, leitet die App die Adresse aus der Anfrage ab (Hostname aus `X-Forwarded-Host`, Protokoll aus `X-Forwarded-Proto`) und hängt den Port 8080 an. Hinter einem HTTPS-Proxy wird daraus `https://ailawyer…:8080`, was ohne TLS auf Port 8080 nicht funktioniert. Setzen Sie `ONLYOFFICE_URL` daher fest auf einen eigenen Hostnamen. Gleiches gilt für den Portainer-Standard `${NEXTAUTH_URL}:8080`.
- **MinIO:** Ein eigener Hostname ist nötig, weil der Bucket `dokumente` heißt und sich der Pfad `/dokumente/…` mit der Seite `/dokumente/[id]` der Anwendung überschneiden würde. Der Proxy muss den `Host`-Header unverändert weitergeben, sonst passt die Signatur der Links nicht.

Die Anwendung erlaubt Uploads bis 100 MB je Datei (`src/app/api/akten/[id]/dokumente/route.ts`), setzen Sie das Limit am Proxy etwas höher.

### Beispiel Caddy

Caddy holt die Zertifikate selbst und leitet WebSockets ohne Zusatz weiter.

```caddy
ailawyer.kanzlei.example {
    request_body {
        max_size 110MB
    }
    reverse_proxy 127.0.0.1:3000
}

office.kanzlei.example {
    reverse_proxy 127.0.0.1:8080 {
        header_up X-Forwarded-Proto https
    }
}

dateien.kanzlei.example {
    request_body {
        max_size 110MB
    }
    reverse_proxy 127.0.0.1:9000
}
```

### Beispiel nginx

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 443 ssl http2;
    server_name ailawyer.kanzlei.example;
    ssl_certificate     /etc/letsencrypt/live/ailawyer.kanzlei.example/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ailawyer.kanzlei.example/privkey.pem;
    client_max_body_size 110m;

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }
}

server {
    listen 443 ssl http2;
    server_name office.kanzlei.example;
    # ssl_certificate … wie oben
    client_max_body_size 110m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl http2;
    server_name dateien.kanzlei.example;
    # ssl_certificate … wie oben
    client_max_body_size 110m;

    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_set_header Host $http_host;
        proxy_buffering off;
    }
}
```

Dazu jeweils ein `server`-Block auf Port 80, der auf HTTPS umleitet. Die Antwortzeit von 300 Sekunden für die Anwendung ist großzügig gewählt, weil Helena-Anfragen mit lokalem Modell lange dauern können.

**Interne Wege bleiben im Docker-Netz:** OnlyOffice holt Dokumente und schickt Speicherstände über `APP_INTERNAL_URL` (`http://app:3000`, Pfad `/api/onlyoffice/…`), die App spricht OnlyOffice über `ONLYOFFICE_INTERNAL_URL` (`http://onlyoffice:80`) an. Diese Wege laufen nicht über den Proxy.

**Socket.IO:** Der Block `/socket.io/` ist für die Echtzeit-Aktualisierungen gedacht. Im aktuellen Docker-Image läuft Socket.IO allerdings nicht (siehe [Kapitel 23](23-einschraenkungen-und-fragen.md#bekannte-einschränkungen)). Der Block schadet nicht und ist vorbereitet, wenn das behoben ist.

**Firewall:** Docker schreibt eigene iptables-Regeln und umgeht dabei `ufw`. Ein Port, den Compose auf `0.0.0.0` veröffentlicht, ist auch dann von außen erreichbar, wenn `ufw` ihn sperrt. Deshalb die Bindung an `127.0.0.1` in Schritt 3. Redis hat kein Passwort, Meilisearch und MinIO haben Standardschlüssel. Prüfen Sie mit `ss -tlnp` von einem anderen Rechner aus, was offen ist.

## Erster Start: was docker-entrypoint.sh tut

Beide Container `app` und `worker` starten über `docker-entrypoint.sh`. Das Skript:

1. wartet bis zu 30 × 2 Sekunden auf PostgreSQL (`db:5432`),
2. führt `prisma migrate deploy` aus und bricht bei einem Fehler ab (`set -e`; der Container startet dann neu),
3. spielt die Dateien `prisma/migrations/manual_*.sql` ein (pgvector, HNSW-Indizes, Gamification-Tabellen u. a.). Jede Anweisung läuft einzeln, Fehler werden nur protokolliert (`⚠ <Datei>: …`),
4. prüft, ob es Benutzer gibt. Wenn nicht, läuft `prisma/seed.ts`. Ein Fehler hier ist nicht fatal („Seed failed (non-fatal)“),
5. **nur im Worker:** prüft, ob Ollama die Modelle `qwen3.5:35b` und `blaifa/multilingual-e5-large-instruct` hat, und lädt fehlende herunter,
6. startet den eigentlichen Prozess.

Beim ersten Worker-Start legt der Worker außerdem Standardeinstellungen, amtliche Formulare, Falldaten-Vorlagen, die Kanäle für Team-Nachrichten, Quests und Shop-Artikel an und registriert die zeitgesteuerten Jobs ([Kapitel 21](21-betrieb-und-sicherung.md#hintergrund-jobs)).

> **Pflichtschritt: Migrationslücke schließen.** Die Prisma-Migrationen sind unvollständig. Unter anderem fehlen die Tabelle `portal_invites` und die Spalte `users.inviteToken`. `migrate deploy` allein ergibt deshalb eine Datenbank, in der das Mandantenportal und weitere Funktionen nicht arbeiten. Gleichen Sie die Datenbank nach dem ersten Start einmal mit dem Schema ab:
>
> ```bash
> docker compose run --rm --entrypoint node app \
>   node_modules/prisma/build/index.js db push --skip-generate
> docker compose run --rm --entrypoint node app prisma/apply-manual-migrations.js
> docker compose restart app worker
> ```
>
> Die Reihenfolge ist wichtig: Erst muss `migrate deploy` (beim ersten Start) gelaufen sein, damit die Tabelle `_prisma_migrations` existiert. Sonst bricht `migrate deploy` bei späteren Starts ab, weil die Datenbank „nicht leer“ ist. Fragt `db push` nach Datenverlust, brechen Sie ab und klären Sie die Ursache; auf einer frischen Installation sollte das nicht vorkommen. Nach dem Neustart legt das Entrypoint-Skript die Beispielkonten an, falls der Seed beim ersten Mal an fehlenden Tabellen gescheitert ist. Die Lücke soll mit v1.0 geschlossen werden.

## Erste Anmeldung und Beispielkonten

Öffnen Sie `NEXTAUTH_URL` im Browser.

![Anmeldeseite von AI-Lawyer](../screenshots/login.png)

Der Seed hat angelegt:

| E-Mail | Rolle | Passwort |
| --- | --- | --- |
| `admin@kanzlei.de` | ADMIN | `password123` |
| `anwalt@kanzlei.de` | ANWALT | `password123` |
| `sachbearbeiter@kanzlei.de` | SACHBEARBEITER | `password123` |

Dazu die Kanzlei „Kanzlei Baumfalk“, einige Beispielkontakte und eine Beispielakte sowie den Systembenutzer `helena@system.local` (nicht anmeldbar).

> **Passwörter sofort ändern.** Das Passwort `password123` steht öffentlich im Repository. Die Oberfläche bietet für Kanzleikonten derzeit **keine** Funktion, ein Passwort zu ändern oder ein neues Konto anzulegen (nur Mandanten im Portal können ihr Passwort ändern). Bis das nachgerüstet ist, geht beides nur über die Datenbank.

Passwort ändern:

```bash
HASH=$(docker compose exec -T app node -e \
  "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" 'NeuesLangesPasswort')
docker compose exec -T db psql -U ailawyer -d ailawyer -c \
  "UPDATE users SET \"passwordHash\"='$HASH' WHERE email='admin@kanzlei.de';"
```

Eigenes Konto anlegen (Rolle `ADMIN`, `ANWALT`, `SACHBEARBEITER` oder `SEKRETARIAT`):

```bash
docker compose exec -T db psql -U ailawyer -d ailawyer -c \
  "INSERT INTO users (id, email, name, \"passwordHash\", role, aktiv, \"kanzleiId\", \"createdAt\", \"updatedAt\")
   SELECT 'u' || md5(random()::text), 'ra.mustermann@kanzlei.example', 'Max Mustermann', '$HASH', 'ANWALT', true, \"kanzleiId\", now(), now()
   FROM users WHERE email='admin@kanzlei.de';"
```

Beispielkonten abschalten: `UPDATE users SET aktiv=false WHERE email IN ('anwalt@kanzlei.de','sachbearbeiter@kanzlei.de');`. Ein deaktiviertes Konto kann sich nicht mehr anmelden (`src/lib/auth.ts`). Die Beispielakte und -kontakte löschen Sie in der Oberfläche. Rollen und Rechte erklärt [Kapitel 15](15-benutzer-und-rollen.md).

Richten Sie für die Admin-Konten die Zwei-Faktor-Anmeldung ein und erzwingen Sie sie über `TOTP_REQUIRED_ROLES` ([Kapitel 20](20-konfiguration.md#adresse-und-anmeldung)).

## KI einrichten und Modelle laden

Welchen KI-Anbieter Helena nutzt, steht **nicht** in Umgebungsvariablen, sondern in der Datenbank. Ein Admin stellt ihn unter **Einstellungen → KI** (`/einstellungen/ki`) ein:

1. **KI-Provider** wählen: **Ollama (Lokal)**, **OpenAI** oder **Anthropic**.
2. Bei OpenAI oder Anthropic den **API-Schluessel** eintragen.
3. **Modell** eintragen. Standard ist `qwen3.5:35b` für Ollama, `gpt-4o` für OpenAI, `claude-sonnet-4-20250514` für Anthropic (`src/lib/ai/provider.ts`).
4. Bei Ollama die **Ollama-URL** prüfen (in Docker `http://ollama:11434`).
5. **Verbindung testen**, dann **Einstellungen speichern**.

Der Worker zieht die beiden Standardmodelle beim Start selbst. Bei großen Modellen bricht dieser Abruf oft vorzeitig ab („Ollama pull failed … (non-fatal)“). Laden Sie die Modelle deshalb von Hand und beobachten Sie den Fortschritt:

```bash
docker compose exec ollama ollama pull qwen3.5:35b
docker compose exec ollama ollama pull blaifa/multilingual-e5-large-instruct
docker compose exec ollama ollama list
```

Das Einbettungsmodell ist fest mit 1024 Dimensionen in der Datenbank verankert (`vector(1024)`). Ändern Sie `EMBEDDING_MODEL` nicht auf ein Modell mit anderer Dimension; der Wert `nomic-embed-text` aus `.env.example` passt nicht ([Kapitel 20](20-konfiguration.md#ki)).

Ein kleineres Chat-Modell (z. B. für einen Server ohne GPU) können Sie mit `ollama pull` laden und unter **Modell** eintragen. Das Reranking verlangt aber weiter `qwen3.5:35b`; fehlt es, scheitert dieser Schritt der Wissenssuche.

Was Helena kann und welche Grenzen gelten, steht in [Kapitel 9](09-helena.md). KI-Entwürfe prüft immer ein Mensch, bevor sie die Kanzlei verlassen.

## Bekannte Stolpersteine

| Problem | Ursache | Workaround |
| --- | --- | --- |
| `pull access denied` oder kein Download für `minio/minio:latest` | Das Image ist auf Docker Hub nicht mehr frei verfügbar. | In der Zusatzdatei unter `minio: image:` ein eigenes, gespiegeltes oder fest versioniertes Image eintragen, das Sie vorher mit `docker pull` geprüft haben. Es muss `mc` enthalten, weil der Healthcheck `mc ready local` aufruft. |
| Portal-Einladungen, Passwort-Reset im Portal oder Seed scheitern mit „table … does not exist“ / „column … does not exist“ | Migrationen unvollständig (`portal_invites`, `users.inviteToken` u. a.) | `npx prisma db push` statt nur `migrate deploy`, im Container wie oben unter [Erster Start](#erster-start-was-docker-entrypointsh-tut). |
| `could not select device driver "nvidia"` beim Start | `docker-compose.yml` reserviert eine NVIDIA-GPU, der Server hat keine oder kein NVIDIA Container Toolkit. | Toolkit installieren oder die GPU-Reservierung entfernen: in einer Zusatzdatei `ollama: deploy: !reset {}`. |
| `app` startet nicht, `docker compose ps` zeigt `ollama` als *unhealthy* | `app` wartet auf einen gesunden Ollama-Container. | `docker compose logs ollama` prüfen. |
| Editor bleibt leer oder meldet einen Token-Fehler | `ONLYOFFICE_SECRET` leer oder anders als `JWT_SECRET` des OnlyOffice-Containers; oder `ONLYOFFICE_URL` vom Browser nicht erreichbar | Beide Werte gleich setzen; `ONLYOFFICE_URL` auf einen Hostnamen mit HTTPS setzen. |
| Downloads führen auf `localhost:9000` oder liefern `SignatureDoesNotMatch` | `MINIO_PUBLIC_URL` zeigt nicht auf eine vom Browser erreichbare Adresse, oder der Proxy ändert den `Host`-Header. | `MINIO_PUBLIC_URL` auf `https://dateien…` setzen, `Host` unverändert weiterreichen. |
| Healthcheck-Timeout bei `setup.sh` | Erster Start mit Migrationen und Modell-Downloads dauert länger als fünf Minuten. | `docker compose logs -f app` beobachten, abwarten. |

---

Weiter: [20 — Konfiguration](20-konfiguration.md) · [Zur Übersicht](README.md)
