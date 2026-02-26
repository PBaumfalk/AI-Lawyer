# AI-Lawyer

AI-First Kanzleisoftware — vollständig browserbasiert, selbst gehostet, DSGVO-konform.

Vereint Akten- und Adressverwaltung, Dokumentenmanagement mit integrierter Textverarbeitung, Fristen/Kalender, E-Mail-Veraktung und KI-gestützte Workflows in einer einzigen Webanwendung. Keine Desktop-Installation, kein externes Office erforderlich.

---

## Inhalt

- [Tech-Stack](#tech-stack)
- [Voraussetzungen](#voraussetzungen)
- [Schnellstart (Docker Compose)](#schnellstart-docker-compose)
- [Lokale Entwicklung](#lokale-entwicklung)
- [Umgebungsvariablen](#umgebungsvariablen)
- [Standard-Zugangsdaten](#standard-zugangsdaten)
- [Verfügbare Skripte](#verfügbare-skripte)

---

## Tech-Stack

| Schicht | Technologie |
|---|---|
| Frontend | Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes, Custom Server (Socket.IO) |
| Datenbank | PostgreSQL 16 + Prisma ORM + pgvector |
| Volltextsuche | Meilisearch |
| Dateispeicher | MinIO (S3-kompatibel) |
| Textverarbeitung | OnlyOffice Docs (Docker) |
| AI/LLM | Vercel AI SDK, OpenAI / Anthropic / Ollama |
| Job-Queues | BullMQ + Redis |
| Auth | NextAuth.js v5 (RBAC) |
| Deployment | Docker Compose |

---

## Voraussetzungen

**Für Docker Compose (empfohlen):**

- [Docker](https://docs.docker.com/get-docker/) ≥ 24
- [Docker Compose](https://docs.docker.com/compose/) ≥ 2.20
- ~8 GB freier RAM (inkl. Ollama-Modell)
- ~20 GB freier Speicherplatz

**Für lokale Entwicklung:**

- Node.js ≥ 20
- npm ≥ 10
- PostgreSQL 16 mit `pgvector`-Extension
- Redis ≥ 7
- Laufende Instanzen von MinIO, Meilisearch, OnlyOffice (oder via Docker)

---

## Schnellstart (Docker Compose)

```bash
# 1. Repository klonen
git clone https://github.com/PBaumfalk/AI-Lawyer.git
cd AI-Lawyer

# 2. Umgebungsvariablen anlegen
cp .env.example .env
# .env öffnen und mindestens NEXTAUTH_SECRET + EMAIL_ENCRYPTION_KEY anpassen

# 3. Stack starten (erster Start dauert einige Minuten)
docker compose up -d

# 4. Datenbank migrieren und Seed-Daten laden
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed
```

Die Anwendung ist danach unter **http://localhost:3000** erreichbar.

> **Hinweis:** Beim ersten Start lädt Ollama automatisch das Standardmodell (`mistral:7b`). Das kann je nach Verbindung 5–15 Minuten dauern. Fortschritt mit `docker compose logs -f ollama` verfolgen.

### Dienste und Ports

| Dienst | Port | Beschreibung |
|---|---|---|
| AI-Lawyer App | 3000 | Hauptanwendung |
| MinIO Console | 9001 | Datei-Speicher-Verwaltung |
| Meilisearch | 7700 | Suchindex (intern) |
| OnlyOffice | 8080 | Dokumenten-Server |
| PostgreSQL | 5432 | Datenbank (intern) |
| Redis | 6379 | Job-Queues (intern) |
| Ollama | 11434 | Lokales LLM |

---

## Lokale Entwicklung

```bash
# 1. Repository klonen und Abhängigkeiten installieren
git clone https://github.com/PBaumfalk/AI-Lawyer.git
cd AI-Lawyer
npm install

# 2. Umgebungsvariablen anlegen
cp .env.example .env
# .env an lokale Verbindungsdaten anpassen (DATABASE_URL, REDIS_URL etc.)

# 3. Infrastruktur-Dienste starten (ohne App)
docker compose up -d db redis minio meilisearch onlyoffice

# 4. Datenbank migrieren und Seed-Daten laden
npm run db:migrate
npm run db:seed

# 5. Entwicklungsserver starten
npm run dev

# 6. (Optional) Worker-Prozess starten (BullMQ-Jobs)
npm run dev:worker
```

Die Anwendung ist unter **http://localhost:3000** erreichbar.

---

## Umgebungsvariablen

Alle Variablen sind in `.env.example` dokumentiert. Die wichtigsten für den Produktivbetrieb:

| Variable | Beschreibung |
|---|---|
| `DATABASE_URL` | PostgreSQL-Verbindungs-URL |
| `NEXTAUTH_SECRET` | Zufälliger Secret-String für NextAuth (≥ 32 Zeichen) |
| `EMAIL_ENCRYPTION_KEY` | AES-256-GCM-Key für IMAP/SMTP-Passwörter (≥ 32 Zeichen) |
| `OPENAI_API_KEY` | OpenAI API-Key (leer lassen für Ollama-only) |
| `ANTHROPIC_API_KEY` | Anthropic API-Key (optional) |
| `AI_PROVIDER` | `openai` \| `anthropic` \| `ollama` |
| `ONLYOFFICE_SECRET` | JWT-Secret für OnlyOffice (leer lassen wenn JWT deaktiviert) |

---

## Standard-Zugangsdaten

Nach `db:seed` ist folgendes Test-Konto aktiv:

| Feld | Wert |
|---|---|
| E-Mail | `admin@kanzlei-baumfalk.de` |
| Passwort | `password123` |
| Rolle | `ADMIN` |

**Diese Zugangsdaten vor dem Produktivbetrieb unbedingt ändern.**

---

## Verfügbare Skripte

```bash
npm run dev           # Entwicklungsserver (Next.js mit Turbopack)
npm run build         # Produktions-Build
npm run start         # Produktionsserver starten
npm run dev:worker    # BullMQ-Worker (Entwicklung, mit Watch)

npm run db:migrate    # Prisma-Migrationen ausführen
npm run db:push       # Schema ohne Migration pushen (Entwicklung)
npm run db:seed       # Seed-Daten laden
npm run db:studio     # Prisma Studio öffnen
npm run db:generate   # Prisma Client neu generieren

npm run lint          # ESLint
```

---

## Rollen

| Rolle | Beschreibung |
|---|---|
| `ADMIN` | Vollzugriff, Nutzerverwaltung, Einstellungen |
| `ANWALT` | Akten, Dokumente, KI-Funktionen, Freigabe |
| `SACHBEARBEITER` | Akten, Dokumente, Fristen |
| `SEKRETARIAT` | Akten lesen, E-Mails, Kalender |
| `PRAKTIKANT` | Lesezugriff |

---

## Lizenz

Proprietär — Kanzlei Baumfalk, Dortmund. Alle Rechte vorbehalten.
