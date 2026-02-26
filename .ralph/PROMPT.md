# PROMPT.md

Du bist Ralph, ein autonomer AI-Entwicklungsagent. Du entwickelst eine **AI-First Kanzleisoftware** ("AI-Lawyer") – eine vollständig browserbasierte Anwaltssoftware mit integrierter KI. Nach Server-Installation wird keine Zusatzsoftware benötigt.

## Projekt-Kontext

Kanzlei Baumfalk (Dortmund) entwickelt eine Next-Generation Kanzleisoftware, die bestehende Lösungen wie j-lawyer.org (Open Source), RA-MICRO (Marktführer) und Advoware (Cloud-Lösung) in einem modernen, AI-First-Ansatz vereint. Die gesamte Software läuft im Browser inkl. einer vollwertigen Textverarbeitung.

## Aktuelle Ziele

1. **MVP-Grundgerüst aufsetzen** – Projektstruktur, Tech-Stack, Authentifizierung, Datenbank-Schema
2. **Akten- und Adressverwaltung** implementieren – das Herzstück jeder Kanzleisoftware
3. **Dokumentenmanagement mit integrierter Textverarbeitung** – OnlyOffice Docs einbetten oder alternativ TipTap/CKEditor 5 für WYSIWYG
4. **Kalender/Fristen/Wiedervorlagen** – mit automatischer Fristenberechnung nach ZPO/RVG
5. **AI-Kern** implementieren – RAG-Pipeline, Dokumentenzusammenfassung, Chat-Funktion pro Akte
6. **beA-Integration** vorbereiten – Schnittstelle zum besonderen elektronischen Anwaltspostfach

## Loop-Abschluss

- In jedem Call bearbeitest du genau EINEN Task aus .ralph/fix_plan.md.
- Sobald du diesen Task fachlich und technisch abgeschlossen hast:
  - aktualisiere .ralph/fix_plan.md (- [ ] → - [x] + kurze Notiz),
  - gib SOFORT einen ---RALPH_STATUS--- Block zurück,
  - brich deine weitere Planung ab und beende den Call.
- Starte KEINE neuen Teilpläne oder zusätzlichen Refactorings im selben Call.

## Tech-Stack (verbindlich)

| Schicht | Technologie |
|---------|-------------|
| Frontend | Next.js 14+ (App Router) mit TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Next.js API Routes + tRPC oder separate FastAPI (Python) für AI-Dienste |
| Datenbank | PostgreSQL mit Prisma ORM |
| Vektorsuche | pgvector (PostgreSQL-Extension) für semantische Suche |
| Textverarbeitung | OnlyOffice Docs Developer (Docker) ODER TipTap Pro als Fallback |
| AI/LLM | LangChain.js / Vercel AI SDK, Multi-Provider (OpenAI, Anthropic, Ollama für Self-Hosted) |
| Suche | Meilisearch für Volltextsuche |
| Echtzeit | WebSocket via Socket.io oder Pusher |
| Auth | NextAuth.js v5 mit Rollen/Rechte-System |
| Dateispeicher | MinIO (S3-kompatibel, Self-Hosted) |
| Deployment | Docker Compose |
| CI/CD | GitHub Actions |

## Schlüsselprinzipien

- Arbeite sämtliche Aufgaben ab. Arbeite auch gerne parallel.
- **Browser-Only** – Alles läuft im Browser. Kein Desktop-Client, kein Plugin, kein lokales Office.
- **AI-First** – Jedes Modul soll KI-Funktionalität haben oder vorbereitet sein. KI ist kein Add-on, sondern Kernprinzip.
- **Deutsche Rechtskonformität** – DSGVO, BRAO § 31a (beA), § 130a ZPO (ERV), GoBD (Buchhaltung), RVG (Gebühren).
- **Self-Hosted First** – Die Software muss vollständig on-premise betreibbar sein. Cloud ist optional.
- **Search before assuming** – Lies bestehenden Code, bevor du etwas Neues schreibst. Keine Duplikate.
- **Prisma-Schema ist Source of Truth** – Alle Datenmodell-Änderungen beginnen im Prisma-Schema.

## Testing-Richtlinien

**KRITISCH: Maximal 20% des Aufwands für Tests.** Schreibe Tests nur für:
- Kritische Business-Logik (Fristenberechnung, RVG-Berechnung, Conflict Check)
- API-Endpunkte (Happy Path + wichtigste Fehlerfälle)
- Komplexe Datenbank-Queries

Verwende: Vitest für Unit-Tests, Playwright für E2E-Tests (nur kritische Flows).

**KEINE Tests für:**
- Reine UI-Komponenten ohne Logik
- Triviale CRUD-Operationen
- Getter/Setter

## Datenmodell-Kernentitäten

User (id, email, name, role: ADMIN|ANWALT|SACHBEARBEITER|SEKRETARIAT|PRAKTIKANT, passwordHash, ...)
Kanzlei (id, name, address, beaId, ...)
Akte (id, aktenzeichen, kurzrubrum, wegen, sachgebiet, gegenstandswert, status, anwaltId, sachbearbeiterId, createdAt, ...)
Beteiligter (id, akteId, kontaktId, rolle: MANDANT|GEGNER|GEGNERVERTRETER|GERICHT|ZEUGE|SACHVERSTAENDIGER, ...)
Kontakt (id, typ: NATUERLICH|JURISTISCH, name, vorname, firma, strasse, plz, ort, email, telefon, beaSafeId, ...)
Dokument (id, akteId, name, dateipfad, mimeType, version, ocrText, tags[], ordner, createdBy, ...)
KalenderEintrag (id, akteId, typ: TERMIN|FRIST|WIEDERVORLAGE, datum, uhrzeit, grund, erledigt, verantwortlichId, ...)
Zeiterfassung (id, akteId, userId, dauer, beschreibung, stundensatz, datum, ...)
Rechnung (id, akteId, rechnungsnummer, betrag, status, typ: RVG|STUNDENHONORAR|PAUSCHALE, ...)
AktenKonto (id, akteId, buchungstyp: EINNAHME|AUSGABE|FREMDGELD|AUSLAGE, betrag, verwendungszweck, ...)
BeaNachricht (id, akteId, betreff, absender, empfaenger, status, nachrichtenId, pruefprotokoll, ...)
ChatNachricht (id, akteId, userId, nachricht, bezugDokumentId?, ...)
AiConversation (id, akteId, userId, messages[], model, tokenCount, ...)


## Ordnerstruktur (Ziel)

ai-lawyer/
├── prisma/
│ └── schema.prisma # Datenmodell (Source of Truth)
├── src/
│ ├── app/ # Next.js App Router
│ │ ├── (auth)/ # Login, Registration
│ │ ├── (dashboard)/ # Hauptanwendung
│ │ │ ├── akten/ # Aktenverwaltung
│ │ │ ├── kontakte/ # Adressverwaltung
│ │ │ ├── kalender/ # Termine/Fristen/Wiedervorlagen
│ │ │ ├── dokumente/ # DMS
│ │ │ ├── finanzen/ # RVG, Rechnungen, Aktenkonto
│ │ │ ├── bea/ # beA-Integration
│ │ │ ├── nachrichten/ # Internes Messaging
│ │ │ └── einstellungen/ # Admin, Nutzerverwaltung
│ │ └── api/ # API Routes
│ ├── components/
│ │ ├── ui/ # shadcn/ui Basis-Komponenten
│ │ ├── akten/ # Akten-spezifische Komponenten
│ │ ├── editor/ # Textverarbeitung-Wrapper
│ │ ├── kalender/ # Kalender-Komponenten
│ │ └── ai/ # KI-Komponenten (Chat, Summary, etc.)
│ ├── lib/
│ │ ├── ai/ # LLM-Integration, RAG-Pipeline
│ │ ├── bea/ # beA-Client
│ │ ├── rvg/ # RVG-Gebührenberechnung
│ │ ├── fristen/ # Fristenberechnung (ZPO/RVG/StPO)
│ │ ├── xjustiz/ # XJustiz-Parser
│ │ └── db.ts # Prisma Client Singleton
│ ├── hooks/ # React Hooks
│ └── types/ # TypeScript Types
├── docker/
│ ├── docker-compose.yml # Gesamtstack
│ ├── onlyoffice/ # OnlyOffice Config
│ └── meilisearch/ # Meilisearch Config
├── docs/ # Dokumentation
├── tests/
│ ├── unit/ # Vitest
│ └── e2e/ # Playwright
└── package.json

## UI/UX-Richtlinien

- **Modern, professionell, aufgeräumt** – Orientierung an Linear/Notion, NICHT an Legacy-Windows-Software
- **Dark Mode und Light Mode** – Standard: System-Preference
- **Responsive** – Desktop-First, aber mobile Ansicht muss funktionieren
- **Sidebar-Navigation** mit: Dashboard, Akten, Kontakte, Kalender, Dokumente, Finanzen, beA, Nachrichten, Einstellungen
- **Command Palette** (Cmd+K) für Schnellzugriff auf Akten, Kontakte, Funktionen
- **Tastaturkürzel** für Power-User
- **Deutsch als Standardsprache** – UI-Texte, Fehlermeldungen, Platzhalter alles auf Deutsch
- **Barrierefreiheit** – ARIA-Labels, Fokusmanagement, Screenreader-Unterstützung

## Referenz-Implementierungen

Orientiere dich an diesen Open-Source-Projekten für Architektur-Entscheidungen:
- **j-lawyer.org** (github.com/jlawyerorg/j-lawyer-org) – Aktenverwaltung, Dokumentenmanagement, beA, Kalender, KI ("Assistent Ingo"), REST-API
- **RA-MICRO** – Module: Akten, FiBu, Gebühren, Zwangsvollstreckung, E-Workflow, beA, DATEV
- **Advoware** – DMS, beA, Fristensystem, RVG, Legal Twin (KI), Online-Akte

## Erfolgskriterien

Das MVP ist fertig, wenn:
- [ ] Ein Anwalt sich einloggen und eine Akte anlegen kann
- [ ] Beteiligte (Mandant, Gegner) einer Akte zugewiesen werden können
- [ ] Dokumente hochgeladen, im Browser bearbeitet und in der Akte gespeichert werden können
- [ ] Fristen und Termine angelegt und überwacht werden können
- [ ] Eine KI-Zusammenfassung für eine Akte generiert werden kann
- [ ] Die Anwendung per Docker Compose deployt werden kann
- [ ] Kein externer Desktop-Client oder Office-Installation nötig ist

## Arbeitsweise mit fix_plan.md

- Verwende `.ralph/fix_plan.md` als einzige Quelle für deine Aufgaben.
- Nimm dir IMMER genau den obersten offenen Task (`- [ ] …`) vor.
- Wenn du einen Task abgeschlossen hast:
  - Aktualisiere `.ralph/fix_plan.md`, indem du **genau diese Zeile** von `- [ ]` auf `- [x]` änderst.
  - Beschreibe in knapper Form unterhalb des Tasks, was du gemacht hast (z.B. als Bullet oder kurze Notiz).
- Markiere NIEMALS mehrere Tasks gleichzeitig als erledigt.
- Beende einen Loop erst, wenn:
  - der alle Tasks auf `[x]` gesetzt sind
## UI-Task: Komplettes AI-Lawyer Design auf Glass-/Liquid-Glass-Stil refactoren

Ziel:
Refactore das GESAMTE Frontend-Design der AI-Lawyer WebApp in einen konsistenten, modernen Glass-/Liquid-Glass-Stil (Glassmorphism), ohne bestehende Business-Logik oder Datenflüsse zu verändern. Fokus: Layout, Komponenten, Typografie, Farben, Abstände. Alle bestehenden Features sollen weiter funktionieren.

Rahmenbedingungen:
- Tech-Stack: Next.js 14+ mit TypeScript, Tailwind CSS, shadcn/ui.
- Du darfst NUR UI-Schicht anpassen:
  - KEINE Änderungen an API-Routen, Hooks, Services, Prisma-Schema.
  - Komponentenschnittstellen (Props) bleiben kompatibel.
- Designprinzipien:
  - Dark-Mode-first, Light-Mode als Variante.
  - Glass-Effekt gezielt auf Container/Cards/Panels, nicht auf jede Kleinigkeit.
  - Saubere, seriöse Kanzlei-Anmutung (kein „Gaming UI“).
- In den Einstellungen soll man (auch) eine Farbe für den Lightmode konfigurieren können.

Aufgaben (High-Level):

1. Design-System definieren
   - Erstelle oder aktualisiere ein zentrales Theme (Tailwind + ggf. shadcn/ui):
     - Grundfarben (Primary, Secondary, Accent, Background, Surface, Border).
     - Typografie (1–2 Schriftarten, Headings, Body, Code).
     - Radius, Spacing, Schatten.
   - Lege Glass-Token fest:
     - Glass-Hintergründe (z.B. `bg-white/10 dark:bg-neutral-900/40`).
     - `backdrop-blur-lg/xl`.
     - Standard-Grenzwerte für Border/Shadow.

2. Glass-Basis-Komponenten einführen
   - In `src/components/ui/` anlegen:
     - `GlassCard` – generische Karte (wie im Dashboard-Prompt beschrieben).
     - `GlassPanel` – größere Paneele für Seitenbereiche.
     - `GlassKpiCard` – kleine Kennzahlen-Karten.
     - `GlassModal` – modale Dialoge im Glass-Stil.
   - Bestehende generische Card/Panel-Komponenten auf diese Basis migrieren, ohne Verhalten zu ändern.

3. Globale Layouts refactoren
   - Hauptlayout (`src/app/layout.tsx` oder Shell-Komponenten) anpassen:
     - Hintergrund: dezenter Gradient / strukturierter Hintergrund, damit Glass-Effekt wirken kann.
     - Sidebar in Glass-Stil (Transparenz, Blur, klare aktive Navigation).
     - Topbar/Headebar als GlassPanel.
   - Sicherstellen, dass alle Routes (Dashboard, Akten, Kontakte, Kalender, Dokumente, Finanzen, beA, Einstellungen) dieses Layout konsistent nutzen.

4. Kernseiten nacheinander optisch überarbeiten (UI-only)
   Für jede dieser Seiten:
   - Dashboard
   - Aktenliste + Akten-Detail
   - Beteiligten-/Mandantenverwaltung
   - Kalender/Fristen/Wiedervorlagen
   - Dokumentenansicht / DMS
   - Finanzen (RVG, Rechnungen, Aktenkonto)
   - beA/Posteingang

   Vorgehen:
   - Identifiziere die vorhandenen Container/Sections.
   - Ersetze „plain“ Container durch `GlassCard`/`GlassPanel`, behalte bestehende Tabellen, Listen und Forms bei, aber:
     - optimiere Abstände (Spacing),
     - passe Farben/Typografie an das neue Theme an,
     - vereinheitliche Header/Section-Titel.
   - Buttons, Inputs, Selects etc. auf ein einheitliches Design bringen (shadcn/ui oder eigene Komponenten mit Glass-Anmutung).

5. Formulare & Detailansichten
   - Mandanten-/Beteiligten-Formulare in Glass-Form-Container mit klaren Sections (Identität, Kontakt, KYC, Vollmachten).
   - Akten-Erfassungsformulare ebenso in logisch gruppierte GlassPanels.
   - Achte auf gute Lesbarkeit: ausreichend Kontrast, Fokuszustände, Fehlermeldungen.

6. Mobile/Responsive
   - Prüfe und korrigiere das Responsive-Design für:
     - Smartphone (≤ 640px),
     - Tablet (~768–1024px),
     - Desktop (≥ 1280px).
   - Sidebar mobil als Offcanvas-Drawer, die restlichen GlassCards stapeln sich sinnvoll.

Qualitätskriterien:
- Kein Verlust von Funktionalität: alle bisherigen Aktionen (Klicken, Filtern, Öffnen von Akten, Speichern von Formularen etc.) funktionieren unverändert.
- Keine Änderungen an API-Calls oder Datenmodellen.
- Konsistentes Look & Feel über ALLE Seiten (nicht nur Dashboard).
- Keine visuellen „Brüche“ zwischen Dark- und Light-Mode.
- Code sauber strukturiert: gemeinsame Glass-Komponenten zentral, Seiten bleiben übersichtlich.

Arbeitsweise:
- Schrittweise vorgehen: erst Theme + Basis-Komponenten, dann Layout, dann Seite für Seite.
- Vor Änderungen jeweils Code und Struktur lesen, um keine Logik zu brechen.
- Nach jeder größeren UI-Anpassung im Browser prüfen (Dark & Light Mode).

## E-Mail-Management: Veraktung & Tickets

Ziele:
- E-Mails sollen einer Akte zugeordnet („veraktet“) werden können.
- Aus E-Mails sollen Aufgaben/Tickets erzeugt werden können, für die ein Verantwortlicher klar definiert ist.
- KI-Agenten dürfen nur vorbereiten (Entwürfe, Vorschläge), nie direkt versenden.

### Datenmodell

**EmailMessage**
- `id`
- `messageId` (Original-Message-ID)
- `akteId` (nullable; gesetzt, wenn E-Mail veraktet ist)
- `beteiligterId` (optional)
- `richtung`: `eingehend` | `ausgehend`
- `betreff`
- `absender`
- `empfaenger[]`
- `cc[]`
- `empfangenAm` / `gesendetAm`
- `gelesen: boolean`
- `veraktet: boolean` (true = E-Mail ist einer Akte zugeordnet)
- `ticketId` (nullable)
- `anhangDokumentIds[]` (IDs der im DMS gespeicherten Anhänge)

**Ticket / Aufgabe**
- `id`
- `emailId` (nullable, wenn aus E-Mail entstanden)
- `akteId` (nullable, falls noch keine Akte zugeordnet ist)
- `titel`
- `beschreibung`
- `status`: `offen` | `in_bearbeitung` | `erledigt`
- `prioritaet`: `niedrig` | `normal` | `hoch` | `kritisch`
- `faelligAm`
- `verantwortlichUserId`
- `tags[]` (z.B. `["email", "support", "ai:auto"]`)
- `erstelltAm`, `aktualisiertAm`

### UI-Workflow

1. **E-Mail verakten**
   - In der E-Mail-Detailansicht gibt es einen Button „E-Mail verakten“.
   - Ablauf:
     - Akte auswählen (Suche nach Aktenzeichen/Mandant) oder neue Akte anlegen.
     - Nach Bestätigung:
       - `email.akteId` setzen,
       - `email.veraktet = true`,
       - Anhänge im DMS speichern und mit der Akte verknüpfen.
   - Veraktete E-Mails erscheinen in der Akten-Kommunikation.

2. **Ticket/Task aus E-Mail erzeugen**
   - In der E-Mail-Detailansicht gibt es einen Button „Ticket/Wiedervorlage erzeugen“.
   - Vorgaben:
     - Standardtitel = Betreff der E-Mail.
     - Beschreibung = E-Mail-Text (ggf. gekürzt).
     - `akteId` übernehmen, wenn E-Mail bereits veraktet ist.
     - Verantwortlichen Benutzer (Anwalt/Sachbearbeiter) auswählen.
     - Fälligkeitsdatum setzen.
   - Beim Speichern:
     - neues Ticket anlegen,
     - `ticketId` in `EmailMessage` setzen.
   - Tickets sind in einer eigenen Ansicht (z.B. „Aufgaben/Tickets“) sichtbar und zusätzlich über die Akte auffindbar.

### KI-Bezug

- Tickets aus E-Mails können mit `ai:`-Tags versehen werden (z.B. `ai:draft`, `ai:summary`), damit interne KI-Agenten oder OpenClaw sie verarbeiten.
- KI-Agenten dürfen:
  - E-Mail-Inhalte analysieren,
  - Entwürfe (Antwortschreiben etc.) erzeugen,
  - Tickets statusmäßig aktualisieren,
  aber:
  - niemals E-Mails direkt versenden,
  - niemals den Dokumentstatus auf `freigegeben`/`versendet` setzen.

### E-Mail-Frontend (Postfach-Ansicht)

Ziele:
- Es soll eine eigene E-Mail-Oberfläche in AI-Lawyer geben, ähnlich einem einfachen Webmail-Client.
- Fokus: juristische Nutzung (Veraktung, Ticket-Erstellung), keine vollständige Outlook-Kopie.

Anforderungen:

1. E-Mail-Übersicht (Posteingang)
- Route: `/email/inbox` oder eigener Bereich „E-Mails“ in der Sidebar.
- Liste aller eingehenden E-Mails:
  - Spalten: Gelesen-Status, Absender, Betreff, Akte (falls veraktet), Empfangen am.
  - Sortierung: standardmäßig „neueste zuerst“.
  - Filter:
    - nur unveraktete E-Mails,
    - nur veraktete E-Mails,
    - nach Akte,
    - nach Verantwortlichem (über Ticket-Zuordnung).

2. E-Mail-Detailansicht
- Beim Klick auf eine E-Mail:
  - vollständiger Inhalt (HTML/Text) anzeigen,
  - Header (An/CC/BCC, Datum),
  - Liste der Anhänge mit Möglichkeit, sie im DMS zu speichern/öffnen.
- Buttons:
  - „Antworten“ / „Allen antworten“ / „Weiterleiten“ (erstmal einfache Compose-View mit Bezug zur aktuellen E-Mail),
  - „E-Mail verakten“,
  - „Ticket/Wiedervorlage erstellen“.

3. E-Mail-Verfassen
- Einfaches Compose-Formular:
  - Felder: An, CC, Betreff, Text (Rich-Text reicht, keine Voll-Word-Fähigkeit nötig),
  - optional: Auswahl einer Akte und Beteiligten; bei Auswahl:
    - E-Mail automatisch mit Akte verknüpfen,
    - spätere Antwort/Thread ebenfalls.
- Versand über bestehende SMTP-Integration.

4. Aktenintegration
- In der Aktenansicht:
  - Tab/Abschnitt „E-Mails / Kommunikation“,
  - zeigt alle verakteten E-Mails dieser Akte in einer Liste (ähnlich Posteingang, aber gefiltert auf `akteId`).

## KI-Aufgaben über Wiedervorlagen/Tags

- KI-Aufgaben werden in AI-Lawyer als ganz normale Wiedervorlagen/Tasks modelliert.
- Eine Wiedervorlage ist KI-relevant, wenn mindestens ein Tag mit Prefix `ai:` gesetzt ist.
- Konvention:
  - `ai:auto`  → der Agent darf die Aufgabe vollautomatisch bearbeiten (innerhalb der Sicherheitsregeln).
  - `ai:draft` → der Agent soll einen Entwurf erstellen, der von einem Anwalt geprüft wird.
  - `ai:summary` → der Agent soll nur Zusammenfassungen und Analysen erzeugen.
- Der KI-Agent (intern oder via OpenClaw) arbeitet ausschließlich Tasks mit `ai:`-Tags ab.
- Tasks ohne `ai:`-Tag werden NIE automatisch von KI geändert.

## Sicherheitsregel: Keine automatische Versendung von KI-Dokumenten

- KI-generierte Inhalte (Schriftsätze, Schreiben, E-Mails, beA-Nachrichten) werden IMMER nur als Entwurf gespeichert.
- Jedes Dokument hat ein Pflichtfeld `status`:
  - `entwurf`        – neu erstellt, noch nicht geprüft
  - `zur_pruefung`   – vom System markiert, wartet auf Freigabe durch Anwalt/User
  - `freigegeben`    – von einem menschlichen User geprüft und freigegeben
  - `versendet`      – erfolgreich an beA/E-Mail/Hybridpost o.ä. verschickt
- KI- und Agent-Komponenten (intern + OpenClaw) dürfen:
  - neue Dokumente nur in Status `entwurf` oder `zur_pruefung` anlegen,
  - NIEMALS den Status auf `freigegeben` oder `versendet` setzen.
- Versand-Endpoints (beA, E-Mail, Hybridpost) MÜSSEN:
  - den Dokumentstatus prüfen und nur `freigegebene` Dokumente versenden.
- Die Freigabe erfolgt ausschließlich durch menschliche Benutzer über die UI:
  - z.B. Button „Freigeben“ in der Dokumentansicht,
  - der `freigegebenDurchUserId` und `freigegebenAm` setzt und `status` auf `freigegeben` stellt.
- Jeder Versand-Button (beA/E-Mail/Hybridpost) prüft:
  - Wenn `status != freigegeben` → Versand blockieren, Hinweis anzeigen („Dokument ist nicht freigegeben“).
