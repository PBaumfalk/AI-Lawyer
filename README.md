# AI-Lawyer

**AI-First Kanzleisoftware** — vollständig browserbasiert, selbst gehostet, DSGVO-konform.

Vereint Akten- und Adressverwaltung, Dokumentenmanagement mit integrierter Textverarbeitung, Fristen- und Kalenderverwaltung, E-Mail-Veraktung, KI-gestützte Schriftsatzerstellung und ein Mandantenportal in einer einzigen Webanwendung. Keine Desktop-Installation, kein externes Office erforderlich.

> ~141.000 Zeilen TypeScript &bull; 84 Prisma-Modelle &bull; 196 API-Endpunkte &bull; 9 Docker-Services

---

## Inhalt

- [Features](#features)
- [Tech-Stack](#tech-stack)
- [Architektur](#architektur)
- [Voraussetzungen](#voraussetzungen)
- [Installation](#installation)
- [Umgebungsvariablen](#umgebungsvariablen)
- [Standard-Zugangsdaten](#standard-zugangsdaten)
- [Rollen & Berechtigungen](#rollen--berechtigungen)
- [Lizenz](#lizenz)

---

## Features

### Aktenverwaltung

- Anlegen, Bearbeiten, Archivieren und Schließen von Akten mit vollständigem Audit-Trail
- Konfigurierbares Aktenzeichen-Schema
- Statusverwaltung: Offen, Ruhend, Archiviert, Geschlossen
- 11 Sachgebiete (Arbeitsrecht, Familienrecht, Strafrecht, Verkehrsrecht u.a.)
- Beteiligtenverwaltung: Mandant, Gegner, Gegnervertreter, Gericht, Zeuge, Sachverständiger
- Automatische Konfliktprüfung bei Neuanlage
- Gegenstandswert-Tracking mit Dezimalpräzision
- Verknüpfung mit Normen (BGB, StPO etc.) inkl. KI-Analyse
- Aktivitäts-Feed pro Akte
- Dezernat-basierte Zugriffssteuerung

### Adress- und Mandantenverwaltung

- Natürliche und juristische Personen
- Mehrere Adressen, Telefonnummern und E-Mail-Adressen pro Kontakt
- KYC-Identitätsprüfung mit Risikobewertung (Niedrig, Mittel, Hoch)
- Vollmachtsverwaltung mit Dokumentenanhang
- Kontaktbeziehungen (Ehepartner, Kind, Arbeitgeber, Geschäftsführer etc.)
- Mandantenkategorisierung: A-Kunde, Dauerauftraggeber, Gelegenheitsmandant, Pro Bono
- Benutzerdefinierte Felder über JSON-Schema
- Massenimport mit Vorschau-Validierung
- DSGVO-konforme Anonymisierung

### Dokumentenmanagement

- Upload mit automatischer Versionierung
- Statusverwaltung: Entwurf, Zur Prüfung, Freigegeben, Versendet
- OnlyOffice-Integration — Dokumente direkt im Browser bearbeiten (DOCX, XLSX, PPTX, ODT)
- OCR-Texterkennung via Stirling-PDF (Tesseract, Deutsch/Englisch)
- Drei OCR-Fallback-Pfade: Retry, Vision-Analyse (GPT-4o), manuelle Texteingabe
- Volltextindizierung über Meilisearch
- MinIO-Speicher mit Versionshistorie
- PDF-Vorschaugenerierung
- Tag-System für Dokumentenkategorisierung
- Sichtbarkeitssteuerung für Mandantenportal

### KI-Assistent (Helena)

- **ReAct-Agent** mit 14 spezialisierten Tools und begrenzter Ausführung (5/20 Schritte)
- Tools: Akte lesen, Dokumente lesen, Fristen lesen, Zeiterfassung lesen, Gesetze suchen, Urteile suchen, Muster suchen, Websuche, Kosten berechnen, Entwürfe erstellen, Fristen anlegen, Alerts setzen, Notizen erstellen
- **Deterministische Schriftsatz-Pipeline** (schema-basiert, kein ReAct für kritische Dokumente)
- Platzhalter-System mit automatischer Feldbefüllung aus Aktenkontext
- 50+ Klageart-Vorlagen
- Multi-Turn-Rückfragen bei fehlenden Informationen
- RAG-Integration mit pgvector-Embeddings für kontextbezogene Recherche
- Multi-Provider: OpenAI, Anthropic, Ollama (lokal)
- Token-Tracking und Nutzungsstatistiken
- QA-Dashboard mit Halluzinationserkennung
- Rollenbasierte Tool-Einschränkungen

### E-Mail & beA

- IMAP-Posteingangs-Synchronisierung mit Threading
- E-Mail-Veraktung: automatische Zuordnung zu Akten
- Zeitversetzter Versand
- Mehrere E-Mail-Konten mit Zuweisungsregeln
- beA-Integration (besonderes elektronisches Anwaltspostfach)
- beA-Auto-Zuweisung: Nachricht → Akte → Ticket → Bearbeiter
- EEB-Quittierung
- Verschlüsselte Speicherung sensibler Daten (AES-256)

### Team-Nachrichten

- Kanal-System: Allgemeine Kanäle und aktenbezogene Kanäle
- Echtzeit-Kommunikation via Socket.IO
- Nachrichtenreaktionen und Threading
- Lesebestätigungen
- Suchintegration über Meilisearch
- Separater Portal-Kanal für Mandantenkommunikation

### Kalender & Fristen

- Vier Eintragstypen: Termin, Frist, Wiedervorlage, Fokuszeit
- Fristenrechner mit deutschen Feiertagen (feiertagejs)
- Fristvorlagen für häufige Fristen (14-Tage-Frist, 30-Tage-Frist etc.)
- Fristenzettel-Generierung
- Werktags-Berechnung (Wochenenden/Feiertage überspringen)
- Verlängerung und Quittierung
- Verantwortlichkeiten und Vertreterregelung

### Zeiterfassung & Abrechnung

- Timer mit Start/Stop/Pause pro Akte
- 20+ vordefinierte Tätigkeitskategorien
- Stundensatz-Verwaltung

**RVG-Abrechnung:**
- Automatische Gebührenberechnung nach Gegenstandswert und Verfahrensart
- Abrechnungsmodelle: Stundenhonorar, RVG, Pauschale

**Rechnungswesen:**
- Rechnungserstellung mit konfigurierbarem Nummernkreis
- Rechnungsstatus: Entwurf, Gestellt, Bezahlt, Mahnung, Storniert
- PDF-Rechnungen mit Kanzlei-Briefkopf
- E-Rechnung (XRechnung-Format)
- SEPA-Export
- Mahnwesen mit Mahnstufen
- DATEV-Export
- Buchungsperioden-Verwaltung
- Kostenstellen
- Anderkonto-Führung (Fremdgeld)

### Mandantenportal

- Einladungsbasiertes Onboarding mit kryptografischen Token
- Mandanten sehen nur ihre zugewiesenen Akten
- Dokumenteinsicht (nur freigegebene Dokumente)
- Nachrichtenkanal zum Anwalt mit 10-Sekunden-Polling
- Aktivitäts-Timeline pro Akte
- Profilverwaltung mit Passwortänderung
- Passwort-Reset-Flow
- BullMQ-Benachrichtigungen mit tagesbasierter Deduplizierung und DSGVO-Gate

### Gamification

- XP- und Level-System mit Fortschrittsbalken
- 3–5 tägliche Quests mit automatischer Verifikation gegen Echtdaten
- Streaks mit Werktags-Erkennung (Urlaub/Krankheit/Feiertage unterbrechen nicht)
- Runen-Währung zum Einlösen im Item-Shop
- Bossfight „Backlog-Monster" — Team-Fortschritts-Banner mit HP-Balken
- 4 Spielklassen nach RBAC-Rolle: Jurist, Schreiber, Wächter, Quartiermeister
- Item-Shop: Relikte (kosmetisch), Artefakte (Komfort), Trophäen (Prestige)
- Wöchentliche Quests für strategische Ziele
- Anti-Gaming: Mindestlänge, Abkühlung, Tages-Deckel, Stichproben-Audit
- DSGVO-konform: Opt-in, anonymisiertes Team-Dashboard, 12-Monats-Löschung

### Falldatenblätter

- JSON-Schema-basierte Datenvorlagen pro Sachgebiet
- Genehmigungsworkflow: Entwurf → Eingereicht → Genehmigt/Abgelehnt
- Versionierung und Standardvorlagen
- Dynamische Feldtypen

### Volltextsuche

- Globale Suche über Akten, Kontakte, Dokumente, E-Mails und Nachrichten
- Facettierte Ergebnisse mit Filtern
- Echtzeit-Indizierung bei Upload/Änderung
- Relevanz-Ranking mit Highlighting

### Administration

- Nutzer- und Rollenverwaltung mit Aktivierung/Deaktivierung
- Dezernat-Struktur (Abteilungen)
- Urlaubs- und Vertretungsverwaltung
- DSGVO-Anonymisierung mit Audit-Trail
- System-Einstellungen und Kanzlei-Stammdaten
- BullMQ-Job-Monitor (Bull Board)
- QA-Dashboard für KI-Qualitätsmetriken
- Muster-Verwaltung mit NER-basierter PII-Erkennung
- Admin-Override mit Audit-Protokollierung
- System-Health und Log-Viewer

---

## Tech-Stack

| Schicht | Technologie |
|---|---|
| Frontend | Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes, Custom Server (Socket.IO) |
| Datenbank | PostgreSQL 16 + Prisma ORM (84 Modelle) + pgvector |
| Volltextsuche | Meilisearch v1.11 |
| Dateispeicher | MinIO (S3-kompatibel) |
| Textverarbeitung | OnlyOffice Docs (Docker) |
| AI/LLM | Vercel AI SDK v4 — OpenAI, Anthropic, Ollama |
| Job-Queues | BullMQ + Redis 7 |
| Echtzeit | Socket.IO + Redis Adapter |
| Auth | NextAuth.js v5 (5 Rollen, RBAC) |
| PDF/OCR | Stirling-PDF (Tesseract), pdf-lib, pdf-parse |
| E-Mail | Nodemailer, IMAPFlow, Mailparser |
| Deployment | Docker Compose (9 Services) |

---

## Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│  Next.js App (React, Tailwind, shadcn/ui, Socket.IO)        │
└──────────────┬──────────────────────────────┬───────────────┘
               │ HTTPS                        │ WebSocket
┌──────────────▼──────────────────────────────▼───────────────┐
│  app (Next.js + Custom Server)              Port 3000       │
│  ├─ API Routes (196 Endpunkte)                              │
│  ├─ Server Components + Server Actions                      │
│  └─ Socket.IO Server (Team-Nachrichten, Gamification)       │
└──┬──────┬──────┬──────┬──────┬──────┬──────┬───────────────┘
   │      │      │      │      │      │      │
   ▼      ▼      ▼      ▼      ▼      ▼      ▼
┌─────┐┌─────┐┌─────┐┌──────┐┌─────┐┌──────┐┌──────────┐
│ db  ││redis││minio││meili ││only ││stirl.││ ollama   │
│PG16 ││  7  ││ S3  ││search││office││ PDF  ││ LLM     │
│pgvec││     ││     ││      ││     ││ OCR  ││         │
└─────┘└──┬──┘└─────┘└──────┘└─────┘└──────┘└──────────┘
          │
   ┌──────▼──────┐
   │   worker    │
   │  BullMQ     │
   │  13+ Queues │
   └─────────────┘
```

**Docker-Services:**

| Service | Image | Funktion |
|---|---|---|
| `app` | Custom (Dockerfile) | Next.js Application Server + Socket.IO |
| `worker` | Custom (Dockerfile) | BullMQ Job-Prozessor (OCR, Embedding, E-Mail-Sync, Gamification) |
| `db` | pgvector/pgvector:pg16 | PostgreSQL mit Vektorsuche |
| `redis` | redis:7-alpine | Cache, Job-Broker, Socket.IO Adapter |
| `minio` | minio/minio | S3-kompatibler Dateispeicher |
| `meilisearch` | getmeili/meilisearch:v1.11 | Volltextsuche |
| `onlyoffice` | onlyoffice/documentserver | Browser-Textverarbeitung |
| `stirling-pdf` | stirlingtools/stirling-pdf | OCR und PDF-Konvertierung |
| `ollama` | ollama/ollama | Lokale LLM-Inferenz |

**Hintergrund-Queues (BullMQ):**

OCR, Embedding, Akte-Embedding, Helena-Tasks, Dokumenten-Vorschau, Muster-Ingestion, NER/PII, Gesetze-Sync, Urteile-Sync, Gamification, Portal-Benachrichtigungen, E-Mail-Sync

---

## Voraussetzungen

- [Docker](https://docs.docker.com/get-docker/) ≥ 24 (inkl. Docker Compose V2)
- ~8 GB freier RAM
- ~20 GB freier Speicherplatz

---

## Installation

### Option 1: Setup-Skript (empfohlen)

```bash
git clone https://github.com/PBaumfalk/AI-Lawyer.git
cd AI-Lawyer
./setup.sh
```

Das Skript fragt interaktiv nach:

- **App-URL** (z.B. `https://ailawyer.meinserver.de`)
- **AI-Provider** — Ollama (lokal, kein API-Key), OpenAI oder Anthropic
- **API-Key** (nur bei OpenAI / Anthropic)

Danach generiert es automatisch alle Secrets, baut die Images und startet alle Services.

### Option 2: Docker Compose (manuell)

```bash
git clone https://github.com/PBaumfalk/AI-Lawyer.git
cd AI-Lawyer

# .env anlegen (siehe Umgebungsvariablen)
cp .env.example .env
# Secrets anpassen ...

docker compose -f docker-compose.portainer.yml up -d --build
```

### Option 3: Portainer

1. Portainer → **Stacks** → **Add stack** → **Repository**
2. **Repository URL:** `https://github.com/PBaumfalk/AI-Lawyer`
3. **Compose path:** `docker-compose.portainer.yml`
4. Pflicht-Variablen unter **Environment variables** setzen (siehe unten)
5. **Deploy the stack**

### Neustart / Rebuild

```bash
docker compose -f docker-compose.portainer.yml down
docker compose -f docker-compose.portainer.yml up -d --build --force-recreate
```

---

## Umgebungsvariablen

### Pflicht

| Variable | Beschreibung | Generieren |
|---|---|---|
| `NEXTAUTH_URL` | Öffentliche URL der App | z.B. `https://ailawyer.meinserver.de` |
| `NEXTAUTH_SECRET` | Session-Verschlüsselung | `openssl rand -base64 32` |
| `EMAIL_ENCRYPTION_KEY` | E-Mail-Datenverschlüsselung | `openssl rand -hex 32` |
| `ONLYOFFICE_SECRET` | OnlyOffice JWT-Secret | `openssl rand -base64 24` |

### Optional

| Variable | Standard | Beschreibung |
|---|---|---|
| `AI_PROVIDER` | `ollama` | `openai`, `anthropic` oder `ollama` |
| `AI_MODEL` | `qwen3.5:35b` | Modellname des gewählten Providers |
| `OPENAI_API_KEY` | — | API-Key für OpenAI |
| `ANTHROPIC_API_KEY` | — | API-Key für Anthropic |
| `POSTGRES_PASSWORD` | `ailawyer` | Datenbank-Passwort |
| `MINIO_ACCESS_KEY` | `ailawyer` | MinIO Zugangsdaten |
| `MINIO_SECRET_KEY` | `ailawyer123` | MinIO Zugangsdaten |
| `MEILISEARCH_API_KEY` | `ailawyer-meili-key` | Meilisearch Master-Key |
| `LOG_LEVEL` | `info` | Log-Level (debug, info, warn, error) |
| `WORKER_CONCURRENCY` | `5` | Parallele Worker-Jobs |

Alle Variablen sind in [`.env.example`](.env.example) dokumentiert.

---

## Standard-Zugangsdaten

| E-Mail | Rolle | Passwort |
|---|---|---|
| `admin@kanzlei.de` | ADMIN | `password123` |
| `anwalt@kanzlei.de` | ANWALT | `password123` |
| `sachbearbeiter@kanzlei.de` | SACHBEARBEITER | `password123` |

> **Vor dem Produktivbetrieb unbedingt alle Passwörter ändern.**

---

## Rollen & Berechtigungen

| Rolle | Beschreibung |
|---|---|
| `ADMIN` | Vollzugriff — Nutzerverwaltung, System-Einstellungen, Audit-Trail, DSGVO |
| `ANWALT` | Akten, Dokumente, KI, Freigabe, beA-Versand, Abrechnung |
| `SACHBEARBEITER` | Akten, Dokumente, Fristen, KI, Zeiterfassung |
| `SEKRETARIAT` | Akten lesen, E-Mails, Kalender, Fristen |
| `MANDANT` | Portal — eigene Akten einsehen, Dokumente, Nachrichten an Anwalt |

**Zugriffssteuerung:**

- Direkte Zuweisung (Anwalt/Sachbearbeiter auf Akte)
- Dezernat-Mitgliedschaft
- Admin-Override (mit Audit-Trail)
- Portal: Kontakt → Beteiligter → Akte (Einladungsbasiert)

---

## Lizenz

[MIT License](LICENSE) — Copyright (c) 2026 Patrick Baumfalk
