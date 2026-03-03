# Requirements: AI-Lawyer v0.4 Quest & Polish

**Defined:** 2026-03-02
**Core Value:** Ein Anwalt kann Akten, Dokumente, Fristen, E-Mails und Finanzen vollständig im Browser verwalten, während eine autonome KI-Agentin aktenübergreifend lernt und als digitale Rechtsanwaltsfachangestellte mitarbeitet — ohne dass KI-generierte Inhalte jemals automatisch versendet oder finalisiert werden.

## v0.4 Requirements

### Gamification Core

- [x] **GAME-01**: User hat ein GameProfile mit XP, Level, Runen, Streak-Tage und Klasse
- [x] **GAME-02**: XP-basiertes Level-System mit linearer Progression (sachliche Titel pro Level-Range)
- [x] **GAME-03**: Runen als separate Belohnungswährung (getrennt von XP, nur Runen sind ausgebbar)
- [x] **GAME-04**: Streak-Tracking mit automatischem Freeze bei Urlaub/Abwesenheit (kein Streak-Bruch bei Nicht-Arbeitstagen)
- [x] **GAME-05**: Klassen-Zuweisung basierend auf RBAC-Rolle (Jurist=ANWALT, Schreiber=SACHBEARBEITER, Wächter=SEKRETARIAT, Quartiermeister=ADMIN)
- [x] **GAME-06**: DSGVO-konforme Datenarchitektur (eigenes GameProfile nur selbst sichtbar, Team-Daten nur aggregiert)
- [x] **GAME-07**: Gamification ist opt-in sichtbar (Dashboard-Widget, kein Zwang, keine Push-Notifications)
- [x] **GAME-08**: Dashboard-Widget zeigt heutige Quests, XP-Bar, Level, Runen und Streak

### Quest System

- [x] **QUEST-01**: 5 Daily Quests mit maschinenlesbarer Bedingungslogik (JSON DSL in Quest.bedingung)
- [x] **QUEST-02**: Quest-Bedingungen evaluieren automatisch gegen echte Prisma-Daten (Fristen, Wiedervorlagen, Rechnungen, Akten)
- [x] **QUEST-03**: Quest-Completion wird nach Geschäftsaktion geprüft (fire-and-forget, blockiert nie Business-Logik)
- [x] **QUEST-04**: Klassen-spezifische Quests (unterschiedliche Quests pro RBAC-Rolle/Klasse)
- [x] **QUEST-05**: Weekly Quests für strukturelle Ziele (Backlog-Reduktion, Abrechnung, Akten-Checks)
- [x] **QUEST-06**: Special Quests / zeitlich begrenzte Kampagnen (Admin-konfigurierbar mit Start-/Enddatum)
- [x] **QUEST-07**: Nightly Cron (23:55) als Safety Net für verpasste Quest-Checks und Streak-Finalisierung
- [x] **QUEST-08**: Quest-Deep-Link: Klick auf Quest öffnet direkt die gefilterte Ansicht (z.B. heutige Fristen)

### Bossfight

- [x] **BOSS-01**: Bossfight-Mechanik mit HP = offene Wiedervorlagen (Team kämpft gemeinsam gegen Backlog-Monster)
- [x] **BOSS-02**: 4 Boss-Phasen mit eskalierenden Belohnungen (Phase 3: mehr Runen, Phase 4: Legendary-Trophäe)
- [x] **BOSS-03**: Team-Fortschritts-Banner auf Dashboard mit Echtzeit-Updates via Socket.IO
- [x] **BOSS-04**: Boss-Activation konfigurierbar (Admin setzt Schwellenwert für Backlog-Größe)

### Anti-Missbrauch

- [x] **ABUSE-01**: Qualifizierte Erledigung (Wiedervorlage zählt nur mit Status-Änderung + Vermerk + ggf. Folge-WV)
- [x] **ABUSE-02**: Runen-Deckel (max. 40 Runen/Tag aus Wiedervorlagen, darüber nur XP)
- [x] **ABUSE-03**: Random Audits (1-3% Stichprobe: System fragt "Erledigung bestätigen?", bei Ablehnung Punkte zurück)
- [x] **ABUSE-04**: Atomic Prisma-Increments für XP/Runen (Race Condition Prevention bei gleichzeitigen Completions)

### Item-Shop

- [x] **SHOP-01**: Item-Katalog mit 4 Seltenheitsstufen (Common, Rare, Epic, Legendary)
- [x] **SHOP-02**: Kosmetische Items kaufbar mit Runen (Avatar-Rahmen, Banner, Profil-Titel, Abschluss-Animation)
- [x] **SHOP-03**: Komfort-Perks kaufbar (z.B. Fokus-Siegel: 30 Min Fokuszeit-Block als interne Priorität)
- [x] **SHOP-04**: Inventar-Verwaltung pro User (gekaufte Items, aktive Ausrüstung)
- [x] **SHOP-05**: Level-Gate für Legendary Items (erst ab Level 25 mit Proof-Badge kaufbar)

### Heldenkarte (Profil)

- [x] **PROFIL-01**: Profil-Seite als "Heldenkarte" (Avatar, Klasse, Level, Titel, aktive Kosmetik)
- [x] **PROFIL-02**: Badge-Schaukasten (nur erspielbare Badges, nie kaufbar: Fristenwächter, Bannbrecher etc.)
- [x] **PROFIL-03**: Quest-Historie (abgeschlossene Quests mit Datum und Belohnung)

### Team-Dashboard

- [ ] **TEAM-01**: Erfüllungsquote Kernquests als Team-Aggregat (kein per-Person Breakdown)
- [ ] **TEAM-02**: Backlog-Delta pro Woche (Trend-Anzeige: steigend/fallend/stabil)
- [ ] **TEAM-03**: Bossfight-Gesamtschaden als Team-Aggregat
- [ ] **TEAM-04**: Monatsreporting (Backlog-Delta, Billing-Delta, Quest-Erfüllungsquoten als PDF/CSV)

### Quick Wins

- [x] **QW-01**: KPI-Cards in Akte-Detail anklickbar → navigiert zum jeweiligen Tab
- [x] **QW-02**: OCR-Recovery-Flow mit Banner (Retry OCR + Vision-Analyse Fallback + Manuelle Texteingabe)
- [x] **QW-03**: Empty States mit Icon, Erklärtext und max. 2 CTAs (beA, E-Mail, Zeiterfassung etc.)
- [x] **QW-04**: "Nachrichten" KPI-Card umbenennen zu "Chat" und auf Channel-Messages verlinken
- [x] **QW-05**: Zeiterfassung: "—" → "Keine Kategorie" (grau), leere Beschreibung → "Beschreibung hinzufügen" Link

## Future Requirements

### Gamification Erweiterungen (v0.5+)

- **GAME-F01**: Adaptive Quest-Generierung (Backlog-Größe → Quest-Schwierigkeit)
- **GAME-F02**: Saisonale Events (Weihnachts-Quest, Jahresabschluss-Kampagne)
- **GAME-F03**: Cross-Kanzlei Benchmark (opt-in, anonymisiert)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Public Leaderboard (per-Person) | Leaderboard-Loser-Effect, toxische Konkurrenz in 5-Personen-Team |
| Real-Money Rewards / Gehalts-Link | Arbeitsrecht (Vergütungsbestandteil), Overjustification Effect |
| Mandatory Participation / Penalty | Erzwungene Gamification erzeugt Ressentiment |
| AI-generierte Quests | Unvorhersehbar, unmöglich/trivial, Latenz — 5 Dailys sind klare Routinen |
| Gamification von Helena-Nutzung | Incentiviert unnötige KI-Calls, verschwendet Compute |
| Kaufbare XP / Level-Boosts | Zerstört Bedeutung der Level-Progression |
| Push-Notifications für Quests | Werden nach einer Woche ignoriert, aktiv resented |
| Komplexe Skill-Trees | Over-Engineering, Meta-Gaming statt echte Arbeit |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| GAME-01 | Phase 33 | Complete |
| GAME-02 | Phase 33 | Complete |
| GAME-03 | Phase 33 | Complete |
| GAME-04 | Phase 33 | Complete |
| GAME-05 | Phase 33 | Complete |
| GAME-06 | Phase 33 | Complete |
| GAME-07 | Phase 34 | Complete |
| GAME-08 | Phase 34 | Complete |
| QUEST-01 | Phase 33 | Complete |
| QUEST-02 | Phase 33 | Complete |
| QUEST-03 | Phase 33 | Complete |
| QUEST-04 | Phase 37 | Complete |
| QUEST-05 | Phase 37 | Complete |
| QUEST-06 | Phase 37 | Complete |
| QUEST-07 | Phase 33 | Complete |
| QUEST-08 | Phase 34 | Complete |
| BOSS-01 | Phase 35 | Complete |
| BOSS-02 | Phase 35 | Complete |
| BOSS-03 | Phase 35 | Complete |
| BOSS-04 | Phase 35 | Complete |
| ABUSE-01 | Phase 38 | Complete |
| ABUSE-02 | Phase 38 | Complete |
| ABUSE-03 | Phase 38 | Complete |
| ABUSE-04 | Phase 38 | Complete |
| SHOP-01 | Phase 39 | Complete |
| SHOP-02 | Phase 39 | Complete |
| SHOP-03 | Phase 39 | Complete |
| SHOP-04 | Phase 39 | Complete |
| SHOP-05 | Phase 39 | Complete |
| PROFIL-01 | Phase 40 | Complete |
| PROFIL-02 | Phase 40 | Complete |
| PROFIL-03 | Phase 40 | Complete |
| TEAM-01 | Phase 41 | Pending |
| TEAM-02 | Phase 41 | Pending |
| TEAM-03 | Phase 41 | Pending |
| TEAM-04 | Phase 41 | Pending |
| QW-01 | Phase 36 | Complete |
| QW-02 | Phase 36 | Complete |
| QW-03 | Phase 36 | Complete |
| QW-04 | Phase 36 | Complete |
| QW-05 | Phase 36 | Complete |

**Coverage:**
- v0.4 requirements: 41 total
- Mapped to phases: 41
- Unmapped: 0

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-02 after roadmap creation (41/41 mapped)*
