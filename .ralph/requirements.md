# specs/requirements.md – Technische Spezifikation AI-Lawyer

## 1. Systemarchitektur

### 1.1 Architektur-Überblick

┌─────────────────────────────────────────────────────┐
│ Browser (Client) │
│ Next.js App (React) + OnlyOffice Editor (iframe) │
└──────────────┬────────────────────────┬──────────────┘
│ HTTPS/WSS │ WOPI
▼ ▼
┌──────────────────────┐ ┌─────────────────────────┐
│ Next.js Backend │ │ OnlyOffice Document │
│ (API Routes/tRPC) │ │ Server (Docker) │
│ + AI Service Layer │ └─────────────────────────┘
└──────┬───────┬───────┘
│ │
▼ ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│PostgreSQL│ │ MinIO │ │Meilisearch│ │ LLM API │
│+pgvector │ │ (S3) │ │(Volltext) │ │(OpenAI/ │
│ │ │ │ │ │ │ Ollama) │
└──────────┘ └──────────┘ └──────────┘ └──────────┘

### 1.2 Deployment

- **Docker Compose** mit folgenden Services: `app` (Next.js), `db` (PostgreSQL 16 + pgvector), `minio` (Dateispeicher), `meilisearch` (Suche), `onlyoffice` (Textverarbeitung), `ollama` (optional, Self-Hosted LLM)
- Reverse Proxy: Traefik oder Caddy für HTTPS/SSL
- Backup: Automatisierte pg_dump + MinIO-Sync

### 1.3 Authentifizierung & Autorisierung

- NextAuth.js v5 mit Credentials Provider (E-Mail/Passwort)
- Session-basiert (JWT oder Database Sessions)
- Rollen: ADMIN, ANWALT, SACHBEARBEITER, SEKRETARIAT, PRAKTIKANT
- Gruppenbasierte Akten-Zugriffsrechte (ein Anwalt sieht nur seine Akten, Admin sieht alles)
- 2FA optional (TOTP)

## 2. Modul-Spezifikationen

### 2.1 Aktenverwaltung

**API-Endpunkte:**
- `GET /api/akten` – Liste aller Akten (paginiert, filterbar)
- `POST /api/akten` – Neue Akte anlegen
- `GET /api/akten/[id]` – Akte abrufen (inkl. Beteiligte, Dokumente, Kalender)
- `PUT /api/akten/[id]` – Akte bearbeiten
- `POST /api/akten/[id]/archivieren` – Akte archivieren
- `GET /api/akten/[id]/historie` – Änderungshistorie
- `POST /api/akten/[id]/conflict-check` – Interessenkonfliktprüfung

**Aktenzeichen-Format:**
- Standard: `{lfd. Nr. 5-stellig}/{Jahreszahl 2-stellig}` → z.B. `00042/26`
- Konfigurierbar über Admin-Einstellungen (Schema: N=lfd. Nummer, Y=Jahr, C=Buchstabe, R=Zufallsziffer)

**Conflict Check:**
- Bei Aktenanlage: Automatische Prüfung aller Beteiligten gegen bestehende Akten
- Warnung bei Namensübereinstimmung (Mandant in Akte A = Gegner in Akte B)
- AI-Enhanced: Semantischer Abgleich (Firmenvarianten, Namensschreibweisen)

**Sachgebietsspezifische Falldatenblätter:**
- Konfigurierbare Formulare pro Sachgebiet (JSON-Schema basiert)
- Vordefinierte Templates: Arbeitsrecht (Kündigungsschutz, Elternzeit, Vertragsprüfung), Familienrecht, Verkehrsrecht (Unfallschaden), Mietrecht, Strafrecht, Erbrecht, Sozialrecht, Inkasso

### 2.2 Dokumentenmanagement

**Speicherung:**
- Dateien in MinIO (S3-kompatibel), Metadaten in PostgreSQL
- Ordnerstruktur pro Akte (verschachtelt möglich)
- Versionierung: Jede Änderung = neue Version, alte Versionen bleiben erhalten

**Vorlagensystem:**
- Vorlagen in DOCX-Format mit Platzhaltern: `{{mandant.name}}`, `{{akte.aktenzeichen}}`, `{{gegner.anwalt}}`, `{{datum.heute}}`, `{{frist.ablauf}}` etc.
- Beim Erstellen: Platzhalter automatisch mit Akten-/Adressdaten befüllen
- Vorlagenkategorien: Schriftsätze, Klageschriften, Mandatsvollmacht, Mahnungen, etc.

**Volltextsuche:**
- OCR bei Upload (Tesseract oder Cloud-OCR)
- Indexierung in Meilisearch
- Suche über: Dokumenteninhalt, Dateiname, Tags, Aktenzeichen

### 2.3 Textverarbeitung (Browser-basiert)

**Option A – OnlyOffice Docs Developer Edition:**
- Docker-Container, Einbindung per iframe + WOPI-Protokoll
- Native DOCX/XLSX/PPTX-Unterstützung
- Echtzeit-Collaboration
- Track Changes, Kommentare, Versionierung
- PDF-Export

**Option B – TipTap Pro (Fallback):**
- Headless WYSIWYG-Editor (ProseMirror-basiert)
- Custom Extensions für juristische Vorlagen
- Export nach DOCX (via docx.js) und PDF (via html2pdf)
- Collaboration via Yjs

**Anforderungen:**
- Absätze, Überschriften, Nummerierte/unnummerierte Listen
- Tabellen (mit Rahmen, Zellformatierung)
- Fußnoten, Seitennummerierung, Kopf-/Fußzeilen
- Inhaltsverzeichnis (auto-generiert)
- Felder/Platzhalter die aus Aktendaten befüllt werden
- PDF-Export mit Briefkopf der Kanzlei

### 2.4 Kalender & Fristenberechnung

**Fristenarten:**
- Tagesfristen (z.B. 2 Wochen)
- Monatsfristen (z.B. 1 Monat)
- Jahresfristen
- Fristen mit Vor- und Nachfrist

**Berechnungsregeln:**
- §§ 187-193 BGB (Fristberechnung)
- Wochenend-/Feiertags-Verschiebung auf nächsten Werktag
- Feiertagskalender pro Bundesland (konfigurierbar, Standard: NRW)
- Sonderfälle: Zustellungsdatum vs. Verkündungsdatum

**Warnungen:**
- Frist-Erinnerungen: 7 Tage, 3 Tage, 1 Tag vorher
- Vorfrist-Erinnerung (konfigurierbar)
- Warnung wenn letzter offener Kalendereintrag einer Akte erledigt wird
- Dashboard-Widget: Fällige Fristen heute/diese Woche

### 2.5 AI-Funktionen

**RAG-Pipeline:**
1. Dokumente werden beim Upload per Embedding-Modell (text-embedding-3-small oder lokales Modell) vektorisiert
2. Vektoren in pgvector gespeichert (pro Akte isoliert)
3. Bei Anfrage: Semantische Suche → relevante Chunks → LLM-Prompt mit Kontext

**Funktionen pro Akte:**
- **Zusammenfassung**: Gesamte Akte oder einzelnes Dokument zusammenfassen
- **Document Chat**: Fragen an Dokumente stellen ("Welche Frist wurde gesetzt?", "Was fordert der Gegner?")
- **Antwort-Entwurf**: Auf Basis eingehender Schriftsätze Antwort vorformulieren
- **Fristenerkennung**: Automatisch Fristen aus Gerichtsdokumenten extrahieren
- **Beteiligte-Erkennung**: Automatisch Parteien aus Dokumenten extrahieren
- **Fallzusammenfassung**: Timeline + Key Facts einer Akte generieren
- **Diktat**: Sprache-zu-Text in E-Mails und Notizen (Whisper/Deepgram)

**LLM-Konfiguration:**
- Admin kann Provider wählen (OpenAI, Anthropic, Ollama/lokales Modell)
- Prompt-Templates pro Funktion (anpassbar)
- Token-Usage-Tracking pro User/Akte
- Kontingent-Management (monatliches Token-Budget pro Kanzlei)

### 2.6 beA-Integration

**Technische Anforderungen:**
- Authentifizierung per Softwarezertifikat (.p12)
- OSCI-Protokoll über EGVP-Infrastruktur
- XJustiz-Standard für strukturierten Datenaustausch
- Safe-ID-Verwaltung (Speicherung und Verifizierung an Kontakt)

**Funktionen:**
- Posteingang: beA-Nachrichten empfangen, automatisch Akten zuordnen
- Postausgang: Nachrichten aus Akte heraus senden (mit Dokumentenanhang)
- eEB: Elektronisches Empfangsbekenntnis anfordern und beantworten
- Prüfprotokoll: Zustellnachweis anzeigen und archivieren
- Gerichtsadressen: Import und Pflege aus beA-Verzeichnis

### 2.7 Finanzen

**RVG-Berechnung:**
- Aktuelle VV-Nummern und Gebührentabellen
- Streitwert-basierte Berechnung
- Einigungsgebühr, Verfahrensgebühr, Terminsgebühr etc.
- Auslagenpauschale, MwSt
- Export als Rechnung (PDF)

**Aktenkonto:**
- Soll/Haben pro Akte
- Buchungstypen: Einnahme, Ausgabe, Fremdgeld, Auslage
- Automatische Zuordnung bei Kontoauszug-Import

## 3. Nicht-funktionale Anforderungen

### 3.1 Performance
- Seiten-Ladezeit < 2 Sekunden
- Suche < 500ms (Meilisearch)
- AI-Zusammenfassung < 30 Sekunden (abhängig von Dokumentgröße)
- Gleichzeitige Nutzer: mindestens 20

### 3.2 Sicherheit
- HTTPS überall (kein HTTP)
- Passwörter: bcrypt/argon2 mit Salt
- CSRF-Schutz, XSS-Prävention, SQL-Injection-Schutz (Prisma)
- Audit-Trail: Wer hat wann was geändert
- Verschlüsselung at rest (PostgreSQL, MinIO)
- Session-Timeout konfigurierbar (Standard: 8 Stunden)

### 3.3 DSGVO
- Löschkonzept: Mandantendaten nach Aufbewahrungsfrist löschbar
- Auskunftsrecht: Export aller personenbezogenen Daten
- Einwilligungsmanagement
- Auftragsverarbeitungsvertrag für Cloud-LLM-Nutzung
- Option: Alle KI-Funktionen mit Self-Hosted-Modell (Ollama) ohne Datenabfluss

### 3.4 Barrierefreiheit
- WCAG 2.1 Level AA
- Tastaturnavigation für alle Funktionen
- ARIA-Labels, Screenreader-Kompatibilität
- Farbkontraste gemäß Richtlinien
