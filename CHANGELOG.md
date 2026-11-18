# Änderungsprotokoll

Die Versionen entsprechen den Meilensteinen der Entwicklung. Die Tags `v3.4` und
`v3.5` stammen aus einer früheren Zählung und liegen zeitlich vor `v0.1`.

## v0.9 – Sicherheit, Migration & Produktivität (2026-07-23)

- **Zwei-Faktor-Anmeldung (TOTP)** mit QR-Einrichtung, Backup-Codes, Pflicht je
  Rolle (`TOTP_REQUIRED_ROLES`) und Audit-Protokoll.
- **Migration aus j-lawyer.org:** idempotenter Import von Akten, Kontakten,
  Beteiligten, Dokumenten und Kalendereinträgen über die j-lawyer-REST-API.
- **Akte-Detail neu:** Feed-Ansicht mit gebündelten Tabs und Key-Facts-Panel.

## v0.8 – Intelligence & Tools (2026-03-07)

- BI-Dashboard mit KPI-Kacheln, Trends und Filtern; Export als CSV, XLSX und PDF.
- PDF-Werkzeuge über Stirling-PDF: Zusammenführen, Teilen, Drehen, Komprimieren,
  Wasserzeichen, Schwärzen.
- Helena: Falldaten-Auto-Fill, Fallzusammenfassung, aktenübergreifender KI-Chat,
  Vorlagenvorschläge.
- Bidirektionaler CalDAV-Abgleich mit Google und Apple Kalender.

## v0.6.1 – Fehlerbehebungen (2026-03-06)

- Triage und Behebung von 18 gesammelten Fehlern.

## v0.6 – Stabilisierung (2026-03-04)

- Keine TypeScript-Fehler mehr, Build bricht bei Typfehlern ab.
- Einheitliche Umgebungsvariablen, Error Boundaries für alle Bereiche.

## v0.5 – Mandantenportal (2026-03-03)

- Eigenes Portal für Mandanten: Aktenstatus, freigegebene Dokumente, sichere
  Nachrichten mit Anhängen, Einladung per Link, E-Mail-Benachrichtigungen.

## v0.4 – Quest & Polish (2026-03-03)

- Gamification als Steuerungsinstrument: Quests, XP, Level, Runen, Streaks,
  Team-Bossfight gegen den Backlog, Item-Shop, Heldenkarte, Team-Dashboard.
- Klickbare KPI-Karten, OCR-Wiederherstellung, leere Zustände.

## v0.3 – Kanzlei-Collaboration (2026-03-02)

- Echtzeit-Nachrichten mit Kanälen und Akten-Threads.
- Rechtsprechungsüberwachung: neue Urteile werden semantisch gegen alle Akten
  geprüft, Helena schreibt ein Briefing.
- Falldatenblätter mit Vorlagen-Workflow und Freigabe durch Admins.

## v0.2 – Helena als Agent (2026-02-28)

- ReAct-Agent mit begrenzter Schrittzahl, deterministische Schriftsatz-Pipeline,
  @-Aufgaben, Entwurfs-Freigabe, Hintergrund-Scanner mit Warnungen, Akten-Gedächtnis.

## v0.1 – Helena RAG (2026-02-27)

- Drei Wissensquellen (Gesetze, Urteile, Schriftsatzmuster) mit Hybrid-Suche und
  Cross-Encoder-Reranking.

## v3.5 – Production Ready (2026-02-26)

- Docker-Produktionsbuild, Glass-Oberfläche mit oklch-Designtokens, Dunkelmodus.

## v3.4 – Vollständige Kanzleisoftware (2026-02-25)

- Aus dem MVP wird eine Kanzleisoftware mit 64 Funktionen: Fristenberechnung,
  E-Mail, Dokumenten-Pipeline, Finanzen, KI, beA-Anbindung, Sicherheit.
