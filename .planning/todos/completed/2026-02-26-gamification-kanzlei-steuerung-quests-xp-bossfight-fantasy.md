---
created: 2026-02-26T23:30:00.000Z
title: Gamification — Kanzlei-Steuerung, Quests, XP, Bossfight, Fantasy
area: ui
files:
  - src/app/(app)/dashboard/
  - src/app/(app)/profil/
  - prisma/schema.prisma
  - src/lib/queue/processors/
---

## Problem

Kanzlei-Routinen (Wiedervorlagen, Fristen, Abrechnung, Aktenpflege) werden nicht konsequent abgearbeitet. Es fehlt ein Steuerungsinstrument das Disziplin motiviert — ohne Kontrolle durch Druck, sondern durch klare, faire Belohnungslogik.

Gamification ist hier kein Spiel, sondern ein Führungsinstrument: Backlog sichtbar machen, Konstanz belohnen, Teamfortschritt zeigen.

## Vision

```
Anwalt öffnet Dashboard → sieht 3 Daily Quests
→ "Die Siegel des Tages: Alle heutigen Fristen geprüft + Vermerk" → 80 XP, 8 Runen
→ klickt Quest → öffnet direkt gefilterte Fristen-Liste
→ erledigt qualifiziert (Vermerk + Statuswechsel) → Quest hakt ab
→ Bossfight-Balken: "Wustwurm (350 Köpfe) — 23 Schaden heute"
→ Team sieht gemeinsamen Fortschritt
```

---

## Kern-Konzept

### Punktearten (klar getrennt)

| Währung | Bedeutung | Zweck |
|---|---|---|
| XP | Erfahrungspunkte | Level-Fortschritt (Langzeit) |
| Runen (Credits) | Belohnungswährung | Shop / Einlösen |
| Streak | Serienbonus | Konstanz belohnen |
| Impact Score | Kanzlei-Beitrag | Dashboard/Controlling |

---

### Quest-Typen

**Daily Quests (Pflicht-Routinen):**

| Quest | Bedingung | XP | Runen |
|---|---|---|---|
| "Die Siegel des Tages" | Alle heutigen Fristen geprüft + Vermerk | 80 | 8 |
| "Die Chroniken entwirren" | 12 qualif. Wiedervorlagen (Vermerk + Next Step) | 60 | 12 |
| "Prägung der Münzen" | 2 Rechnungen ausgelöst ODER 2 Akten abrechnungsreif | 60 | 10 |
| "Ordnung im Skriptorium" | 5 Akten: nächster Schritt + Datum gesetzt | 40 | 5 |
| "Bote der Klarheit" | 5 Anfragen dokumentiert beantwortet | 30 | 4 |

**Weekly Quests (größere Hebel):**
- "Die Schlacht um den Backlog": Wiedervorlagen -20%
- "Der Schatzmeister": Alle abrechnungsreifen Akten der Woche abgerechnet
- "Die Bibliothek der Ordnung": 20 Akten-Vollständigkeits-Checks

**Special Quests (zeitlich begrenzte Kampagnen):**
- "Wiedervorlagen-Reset-Woche"
- "Abrechnungsoffensive"

---

### Klassen (= RBAC-Rollen)

| Klasse | RBAC-Rolle | Fokus |
|---|---|---|
| Jurist | ANWALT | Fristen, Schriftsätze, Strategie, Abrechnung |
| Schreiber | SACHBEARBEITER | Recherche, Entwürfe, Aktenstruktur |
| Wächter | SEKRETARIAT | Fristenanlage, Posteingang, Dokumentation |
| Quartiermeister | ADMIN | Backlog-Steuerung, Teamziele, Controlling |

Jede Klasse hat eigene Daily-Quests, aber gemeinsame Kernquests (Fristen, Abrechnung).

---

### Level-System

XP-basiert, mit sachlichen Titeln:
- Level 1–10: "Junior Workflow"
- Level 11–20: "Workflow Stabil"
- Level 21–30: "Backlog Controller"
- Level 31–40: "Billing Driver"
- Level 41–50: "Kanzlei-Operator"

Badges für dauerhafte Leistungen (nur erspielbar, nicht kaufbar):
- "Fristenwächter": 30 Tage ohne Fristversäumnis + vollständige Doku
- "Backlog halbiert"
- "100 Rechnungen ausgelöst"
- "Bannbrecher": 7 Tage Kernquests ohne Unterbrechung

---

### Streak-System

- 3 Tage Kernquest erfüllt: +10% Runen
- 7 Tage: +25% Runen
- Streak bricht nur bei Kernquest-Ausfall (Urlaub/Abwesenheit → "Pause"-Status, kein Streak-Bruch)

---

### Bossfight: "Backlog-Monster"

**Herzstück des Systems — höchster Team-Motivationswert.**

Boss = Backlog. Lebenspunkte = offene Wiedervorlagen.
Jede qualifizierte Erledigung macht Schaden. Team sieht Fortschritt in Echtzeit.

Beispiel-Boss: "Der Wustwurm (350 Köpfe)"
- Phase 1 (100%–75%): Standard
- Phase 2 (75%–50%): Team-Bonus freigeschaltet (z.B. gemeinsamer Office-Benefit)
- Phase 3 (50%–25%): "Wut-Phase" — Boss gibt mehr Runen beim Schaden
- Phase 4 (25%–0%): Finale — Legendary-Trophäe für alle Beteiligten

Bossfight ist immer aktiv wenn Backlog > Schwellenwert (konfigurierbar).

---

### Anti-Missbrauch (kritisch)

**Qualifizierte Erledigung** — Wiedervorlage zählt NUR wenn:
- Status geändert + kurzer Vermerk + ggf. nächste Wiedervorlage gesetzt ODER Akte abgeschlossen

**Runen-Deckel:**
- Max. 40 Runen/Tag aus Wiedervorlagen → darüber nur XP (kein Runen-Farming)
- No double-dip: Rechnung schreiben ≠ gleichzeitig "Akte abgeschlossen"

**Random Audits (1–3%):**
- System fragt stichprobenartig: "Erledigung bestätigen — Vermerk vorhanden?"
- Bei Ablehnung: Punkte für diese Erledigung werden zurückgenommen

---

### Item-Shop (Phase 2)

**Wichtig: IP-freie eigene Fantasy-Namen** (keine Tolkien/Star Wars-Referenzen im Produkt — intern OK, aber nicht produktionsreif)

Item-Typen:
1. **Relikte** (kosmetisch): Avatar-Rahmen, Banner, Profil-Titel, Abschluss-Animation
2. **Artefakte** (kleine Komfort-Perks, nicht spielentscheidend):
   - "Fokus-Siegel": 30 Min Fokuszeit-Block (interne Priorität, kein Pflicht-Bypass)
   - "Vorlagenrolle": 1×/Woche Standardantwort-Template mit Aktenstammdaten
3. **Trophäen** (Prestige, nur erspielbar — nie kaufbar)

Seltenheit: Common / Rare / Epic / Legendary
Legendary erst ab Level 25+ mit "Proof"-Badge (z.B. Fristenhygiene 14 Tage).

**Hinweis arbeitsrechtlich:** Komfort-Perks als "interne Priorität/Organisation" formulieren, nicht als Vergütungsbestandteil.

---

## Datenmodell (Prisma)

```prisma
model UserGameProfile {
  id          String   @id @default(cuid())
  userId      String   @unique
  xp          Int      @default(0)
  level       Int      @default(1)
  runen       Int      @default(0)
  streakTage  Int      @default(0)
  streakAktiv Boolean  @default(false)
  letzteQuestAm DateTime?
  klasse      Klasse   // JURIST | SCHREIBER | WAECHTER | QUARTIERMEISTER
  completions QuestCompletion[]
  inventar    InventarItem[]
}

model Quest {
  id           String    @id @default(cuid())
  name         String
  beschreibung String
  typ          QuestTyp  // DAILY | WEEKLY | SPECIAL | BOSSFIGHT
  klasse       Klasse?   // null = alle Klassen
  xpReward     Int
  runenReward  Int
  bedingung    Json      // maschinenlesbare Bedingungslogik
  aktiv        Boolean   @default(true)
  completions  QuestCompletion[]
}

model QuestCompletion {
  id          String   @id @default(cuid())
  userId      String
  questId     String
  abgeschlossenAm DateTime @default(now())
  verifiziert Boolean  @default(false)
  auditFlag   Boolean  @default(false)
  user        UserGameProfile @relation(...)
  quest       Quest    @relation(...)
}

model Bossfight {
  id           String   @id @default(cuid())
  name         String
  maxHp        Int      // = initiale Backlog-Größe
  aktuelleHp   Int
  aktiv        Boolean  @default(true)
  phase        Int      @default(1)  // 1-4
  gestartetAm  DateTime @default(now())
  abgeschlossenAm DateTime?
}
```

---

## UI

### Dashboard-Widget (pro Nutzer)
- Heutige Quests (3–5) mit 1-Klick-Start (öffnet gefilterte Liste)
- Fortschrittsbalken "Kernquest heute: erfüllt / offen"
- XP-Bar, Level, Runen, Streak
- Bossfight-Banner (Teamfortschritt, sichtbar für alle)

### Profil als "Heldenkarte"
- Avatar + Klasse + Level + Titel
- Inventar-Slots (Phase 2)
- Badge-Schaukasten
- Quest-Historie

### Team-Ansicht (für ADMIN/Quartiermeister)
- Erfüllungsquote Kernquests nach Person (aggregiert)
- Backlog-Delta pro Woche
- Bossfight-Gesamtschaden pro Person

---

## Implementierungsplan

### Phase 1 (MVP — höchste Priorität)
1. `UserGameProfile` + `Quest` + `QuestCompletion` DB-Schema
2. 5 Daily Quests statisch (hardcoded) + Quest-Bedingungslogik
3. XP/Runen/Level-Berechnung + Streak
4. Dashboard-Widget (Quests + Fortschritt)
5. 1 Bossfight "Der Wustwurm" mit Team-Fortschritts-Banner

### Phase 2
6. Klassen-spezifische Quests + Weekly Quests
7. Anti-Missbrauch: Runen-Deckel + Random Audits
8. Item-Shop (kosmetisch) + Inventar
9. Adaptive Quest-Generierung (Backlog-Größe → Quest-Schwierigkeit)

### Phase 3
10. Special Quests / Kampagnen
11. Team-Dashboard (Controlling)
12. Reporting (Monat: Backlog-Delta, Billing-Delta, Quest-Erfüllungsquoten)
