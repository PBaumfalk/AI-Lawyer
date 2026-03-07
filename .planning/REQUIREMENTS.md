# Requirements: AI-Lawyer

**Defined:** 2026-03-07
**Core Value:** Ein Anwalt kann Akten, Dokumente, Fristen, E-Mails und Finanzen vollständig im Browser verwalten, während eine autonome KI-Agentin als digitale Rechtsanwaltsfachangestellte mitarbeitet — und Mandanten über ein eigenes Portal Sachstand, Dokumente und Nachrichten einsehen können.

## v0.9 Requirements

Requirements for v0.9 Security, Migration & Productivity. Each maps to roadmap phases.

### Authentifizierung

- [x] **AUTH-01**: User kann TOTP 2FA in Profil-Einstellungen aktivieren (QR-Code scannen, Code verifizieren)
- [x] **AUTH-02**: User muss nach Passwort-Login einen 6-stelligen TOTP-Code eingeben
- [x] **AUTH-03**: User kann Backup-Codes generieren und als Fallback verwenden
- [x] **AUTH-04**: Admin kann 2FA-Pflicht pro Rolle konfigurieren (z.B. ANWALT + ADMIN muessen 2FA haben)

### Migration

- [ ] **MIG-01**: Admin kann J-Lawyer REST API Verbindung konfigurieren (URL + Credentials)
- [ ] **MIG-02**: System importiert alle Akten mit Metadaten, Aktenzeichen und Zustaendigkeiten
- [ ] **MIG-03**: System importiert alle Kontakte/Adressen mit Deduplizierung
- [ ] **MIG-04**: System importiert Beteiligte mit korrekter Rollen-Zuordnung je Akte
- [ ] **MIG-05**: System importiert Dokumente (Binary nach MinIO, Metadaten nach DB)
- [ ] **MIG-06**: System importiert Kalendereintraege, Fristen und Wiedervorlagen
- [ ] **MIG-07**: Migration ist idempotent (Re-Run ueberschreibt statt dupliziert via jlawyer_id)
- [ ] **MIG-08**: System zeigt Abschlussbericht (X Akten, Y Kontakte, Z Dokumente, N Fehler)

### Feed-Umbau

- [ ] **FEED-01**: Historie-Tab heisst "Aktivitaeten" und ist Default-Tab beim Oeffnen einer Akte
- [ ] **FEED-02**: Event-Texte sind menschenlesbar (keine IDs, keine MIME-Types)
- [ ] **FEED-03**: Filterchips oberhalb des Feeds (Alle, Fristen, Dokumente, Kommunikation, Zeit, System)
- [ ] **FEED-04**: Composer am Feed-Ende fuer Notizen, Telefonnotizen und Aufgaben
- [ ] **FEED-05**: Telefonnotiz-Overlay mit Beteiligtem, Ergebnis, Stichworte, naechster Schritt
- [ ] **FEED-06**: Tab-Reduktion von 11 auf 4-5 sichtbare Tabs mit Overflow-Menue
- [ ] **FEED-07**: Key-Facts-Panel sticky oberhalb Tabs (Gegenstandswert, Gericht, Phase, naechste Frist, Mandant/Gegner)

## Future Requirements

Deferred to post-v0.9 milestones.

### Helena Sprache

- **VOICE-01**: Spracheingabe via Whisper (Diktat zu Text im Chat-Input)
- **VOICE-02**: Sprachausgabe via TTS (Helena liest Antworten vor)

### Mahnwesen

- **MAHN-01**: Mahnstufen-Konfiguration (1./2./3. Mahnung + Mahngebuehren)
- **MAHN-02**: Automatischer Mahnlauf mit Faelligkeitspruefung
- **MAHN-03**: Mahn-PDF mit Kanzlei-Briefkopf

## Out of Scope

| Feature | Reason |
|---------|--------|
| Helena Spracheingabe/TTS | Komfort-Feature, kein Blocker fuer Go-Live |
| Mahnwesen | Eigenes Modul, nach Launch als Erweiterung |
| Multi-Kanzlei Migration | Nur J-Lawyer als Quellsystem, kein generischer Importer |
| Live-Sync J-Lawyer | Einmalige Migration, kein dauerhafter Abgleich |
| Offline-Modus | Real-time ist Core Value |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 59 | Complete |
| AUTH-02 | Phase 59 | Complete |
| AUTH-03 | Phase 59 | Complete |
| AUTH-04 | Phase 59 | Complete |
| MIG-01 | Phase 60 | Pending |
| MIG-02 | Phase 60 | Pending |
| MIG-03 | Phase 60 | Pending |
| MIG-04 | Phase 60 | Pending |
| MIG-05 | Phase 60 | Pending |
| MIG-06 | Phase 60 | Pending |
| MIG-07 | Phase 60 | Pending |
| MIG-08 | Phase 60 | Pending |
| FEED-01 | Phase 61 | Pending |
| FEED-02 | Phase 61 | Pending |
| FEED-03 | Phase 61 | Pending |
| FEED-04 | Phase 62 | Pending |
| FEED-05 | Phase 62 | Pending |
| FEED-06 | Phase 63 | Pending |
| FEED-07 | Phase 63 | Pending |

**Coverage:**
- v0.9 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 after roadmap creation*
