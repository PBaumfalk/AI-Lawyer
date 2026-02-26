# AI-Lawyer

AI-First Kanzleisoftware — vollständig browserbasiert, selbst gehostet, DSGVO-konform.

Vereint Akten- und Adressverwaltung, Dokumentenmanagement mit integrierter Textverarbeitung, Fristen/Kalender, E-Mail-Veraktung und KI-gestützte Workflows in einer einzigen Webanwendung. Keine Desktop-Installation, kein externes Office erforderlich.

---

## Inhalt

- [Tech-Stack](#tech-stack)
- [Voraussetzungen](#voraussetzungen)
- [Installation](#installation)
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

## Installation

```bash
git clone https://github.com/PBaumfalk/AI-Lawyer.git
cd AI-Lawyer
./setup.sh
```

Das Skript erstellt `.env`, generiert Secrets, baut die Images und startet alle Services.

Die Anwendung ist danach unter **http://localhost:3000** erreichbar.

> Beim ersten Start lädt Ollama das Sprachmodell (`mistral:7b`) herunter — das kann je nach Verbindung 5–15 Minuten dauern. Fortschritt: `docker compose logs -f ollama`

### Dienste und Ports

| Dienst | Port |
|---|---|
| AI-Lawyer App | 3000 |
| MinIO Console | 9001 |
| OnlyOffice | 8080 |
| Ollama | 11434 |

---

## Umgebungsvariablen

Alle Variablen sind in `.env.example` dokumentiert. `setup.sh` generiert `NEXTAUTH_SECRET` und `EMAIL_ENCRYPTION_KEY` automatisch. Für KI-Funktionen mit externen Anbietern:

| Variable | Beschreibung |
|---|---|
| `OPENAI_API_KEY` | OpenAI API-Key (optional, Ollama läuft ohne) |
| `ANTHROPIC_API_KEY` | Anthropic API-Key (optional) |
| `AI_PROVIDER` | `openai` \| `anthropic` \| `ollama` (Standard: `ollama`) |

---

## Standard-Zugangsdaten

| | |
|---|---|
| E-Mail | `admin@kanzlei-baumfalk.de` |
| Passwort | `password123` |
| Rolle | `ADMIN` |

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
