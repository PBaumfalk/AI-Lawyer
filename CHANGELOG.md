# Änderungsprotokoll

Die Versionen entsprechen den Meilensteinen der Entwicklung. Die Tags `v3.4` und
`v3.5` stammen aus einer früheren Zählung und liegen zeitlich vor `v0.1`.

## Unveröffentlicht – Betriebsreife

- **Kein bekanntes Startpasswort mehr:** Eine Produktionsinstallation legt nur
  noch ein Administratorkonto mit `INITIAL_ADMIN_PASSWORD` an (von `setup.sh`
  zufällig erzeugt). Beispielkonten mit `password123` nur noch mit `SEED_DEMO=true`.
- **Benutzerverwaltung** unter Admin → Benutzer: Konten anlegen, Rollen ändern,
  deaktivieren, Passwort und Zwei-Faktor zurücksetzen. Eigenes Passwort ändern
  unter Einstellungen → Sicherheit.
- **Sitzungen folgen dem Konto:** Deaktivieren, Rollenwechsel und
  Passwortwechsel wirken sofort statt erst nach Ablauf des 30-Tage-JWT.
- **Anmeldeschutz ohne Aussperren:** Grenzen je Quelle+Konto (10/15 min), je
  Quelle (100) und – nur bei verteilten Angriffen – je Konto (50), dann nur noch
  Geräte mit Geräte-Cookie. Fremde können ein Konto nicht mehr durch
  Fehlversuche sperren. `X-Forwarded-For` zählt nur mit `TRUST_PROXY_HOPS`.
  Admin: **Entsperren** ohne Passwortwechsel. Zwei-Faktor-Codes, „Passwort
  vergessen“ (Portal), Aktivierung und eigener Passwortwechsel ebenfalls
  begrenzt; gleiche Laufzeit für unbekannte Konten. `/api/auth/totp/init`
  prüfte Passwörter vorher ohne Begrenzung.
- **Redis-Ausfall:** Neue Anmeldungen werden mit 503 und verständlicher
  Meldung abgelehnt statt ungebremst zugelassen (Timeouts 0,5 s/1 s,
  automatische Wiederkehr, Log-Signal `login_limiter_unavailable`);
  bestehende Sitzungen bleiben gültig.
- **Next.js 15.5.29 und React 19:** behebt drei kritische RCE-Lücken
  (GHSA-p293-qw3h-jr36, GHSA-2xp9-vwfh-vxw4, GHSA-2464-fhr4-w9xw), für die es in
  Next 14 keinen Patch gibt.
- **Mobil:** Seitenleiste startet auf schmalen Bildschirmen eingeklappt,
  Kopfzeile und Reiterleisten laufen nicht mehr über den Rand.
- **Browsertests** (`npm run test:e2e`, Playwright mit lokalem Chrome) für
  Anmeldung, Drosselung, Ausfall des Anmeldeschutzes, Benutzerverwaltung und
  Passwortwechsel auf Desktop und 390 px.
- **Zwei-Faktor-Umgehung geschlossen:** Konten mit TOTP ließen sich mit dem
  Passwort allein anmelden, wenn man die Anmeldeseite umging.
- **Datensicherung verschlüsselt und extern:** `scripts/backup.sh` sichert
  Datenbank und MinIO mit restic 0.19.1 (Docker-Image, AES-256 + Poly1305,
  dedupliziert) in ein externes Ziel (S3, SFTP, rest-server); Schlüssel in
  `/etc/ai-lawyer/backup.key`, Zugangsdaten in `/etc/ai-lawyer/backup.env`,
  beides außerhalb des Repos. Aufbewahrung (`forget --prune`), rollierende
  Integritätsprüfung (`check --read-data-subset`), Statusdateien,
  `scripts/backup-status.sh` für die Überwachung, optionaler
  Healthchecks-Ping, systemd-Timer-Vorlage. Die `.env` wird nicht mehr
  mitgesichert (nur mit `BACKUP_INCLUDE_ENV=1`). Sicherungen im alten
  Ordnerformat stellt `restore.sh` nicht mehr her (Handbuch Kap. 21).
- **Wiederherstellung ohne Handarbeit:** `scripts/restore.sh` entschlüsselt
  und prüft den Snapshot vor jeder Änderung und baut danach den Suchindex
  automatisch neu auf (`node dist-worker/reindex-suche.mjs`, auch einzeln
  nutzbar). Der Reindex prüft jetzt jeden Meilisearch-Task und die
  Dokumentanzahl, statt Fehler zu verschlucken.
- **Rundlauftest** `scripts/test-backup-restore.sh`: Sicherung in einen
  getrennten S3-Container, Totalverlust, Wiederherstellung inklusive Suche,
  Negativtests mit falschem Schlüssel und manipuliertem Repository.
- **Abhängigkeiten:** Sicherheitslücken in Produktionspaketen von 49 auf 20
  (kritisch 5 → 0 nach dem Next-15-Update).

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
