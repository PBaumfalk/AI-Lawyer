# AI-Lawyer

AI-First Kanzleisoftware — vollständig browserbasiert, selbst gehostet, DSGVO-konform.

Vereint Akten- und Adressverwaltung, Dokumentenmanagement mit integrierter Textverarbeitung, Fristen/Kalender, E-Mail-Veraktung und KI-gestützte Workflows in einer einzigen Webanwendung. Keine Desktop-Installation, kein externes Office erforderlich.

---

## Inhalt

- [Tech-Stack](#tech-stack)
- [Voraussetzungen](#voraussetzungen)
- [Installation via setup.sh](#installation-via-setupsh)
- [Installation via Portainer](#installation-via-portainer)
- [Umgebungsvariablen](#umgebungsvariablen)
- [Standard-Zugangsdaten](#standard-zugangsdaten)
- [Rollen](#rollen)

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

- [Docker](https://docs.docker.com/get-docker/) ≥ 24 (inkl. Docker Compose V2)
- ~8 GB freier RAM
- ~20 GB freier Speicherplatz

---

## Installation via setup.sh

Für lokale Server oder VMs — interaktives Setup-Skript.

```bash
git clone https://github.com/PBaumfalk/AI-Lawyer.git
cd AI-Lawyer
./setup.sh
```

Das Skript fragt nach:

- **App-URL** (z.B. `http://localhost:3000` oder `https://ailawyer.meinserver.de`)
- **AI-Provider** — Ollama (lokal, kein API-Key), OpenAI oder Anthropic
- **API-Key** (nur bei OpenAI / Anthropic)

Danach generiert es automatisch alle Secrets, baut die Images und startet alle Services.

> Beim ersten Start lädt Ollama das Sprachmodell (`mistral:7b`) herunter — das kann je nach Verbindung 5–15 Minuten dauern. Fortschritt: `docker compose logs -f ollama`

---

## Installation via Portainer

Für Server mit [Portainer](https://www.portainer.io/) — kein SSH oder Terminal nötig.

### 1. Stack anlegen

1. Portainer öffnen → **Stacks** → **+ Add stack**
2. Name eingeben: `ai-lawyer`
3. **Build method:** `Repository`
4. **Repository URL:** `https://github.com/PBaumfalk/AI-Lawyer`
5. **Compose path:** `docker-compose.portainer.yml`

### 2. Pflicht-Variablen setzen

Unter **Environment variables** folgende Werte eintragen:

| Variable | Wert |
|---|---|
| `NEXTAUTH_URL` | URL der App, z.B. `https://ailawyer.meinserver.de` |
| `NEXTAUTH_SECRET` | Zufälliger String ≥ 32 Zeichen |
| `EMAIL_ENCRYPTION_KEY` | Zufälliger Hex-String, 64 Zeichen |
| `ONLYOFFICE_SECRET` | Beliebiger String |

Secrets generieren (lokal ausführen):

```bash
openssl rand -base64 32   # NEXTAUTH_SECRET
openssl rand -hex 32      # EMAIL_ENCRYPTION_KEY
openssl rand -base64 24   # ONLYOFFICE_SECRET
```

### 3. Optionale Variablen (KI-Anbieter)

| Variable | Wert |
|---|---|
| `AI_PROVIDER` | `openai` \| `anthropic` \| `ollama` (Standard: `ollama`) |
| `AI_MODEL` | z.B. `gpt-4o` oder `mistral:7b` |
| `OPENAI_API_KEY` | OpenAI API-Key (nur bei `AI_PROVIDER=openai`) |
| `ANTHROPIC_API_KEY` | Anthropic API-Key (nur bei `AI_PROVIDER=anthropic`) |

### 4. Stack deployen

**Deploy the stack** klicken. Portainer klont das Repository, baut die Images und startet alle Services.

Die App ist unter der konfigurierten `NEXTAUTH_URL` erreichbar, sobald der `ailawyer-app`-Container den Status **healthy** hat.

---

## Umgebungsvariablen

Alle Variablen sind in [`.env.example`](.env.example) dokumentiert.

---

## Standard-Zugangsdaten

| E-Mail | Rolle | Passwort |
|---|---|---|
| `admin@kanzlei.de` | ADMIN | `password123` |
| `anwalt@kanzlei.de` | ANWALT | `password123` |
| `sachbearbeiter@kanzlei.de` | SACHBEARBEITER | `password123` |

**Vor dem Produktivbetrieb unbedingt ändern.**

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

[MIT License](LICENSE) — Copyright (c) 2026 Patrick Baumfalk
