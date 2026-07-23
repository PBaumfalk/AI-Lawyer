---
created: 2026-02-26T23:15:34.880Z
title: Akte-Detail Feed-Umbau — Composer und Tab-Reduktion
area: ui
files:
  - src/app/(app)/akten/[id]/
  - src/components/akten/akte-detail-tabs.tsx
  - src/components/akten/historie/
  - src/components/akten/nachrichten/
  - prisma/schema.prisma
---

## Problem

Die Akte-Detailansicht hat 11 Tabs und zwingt den Nutzer bei jedem Öffnen zu einer Navigation-Entscheidung. Gleichzeitig existiert der Feed bereits — die "Historie (22)"-Tab ist schon eine chronologische Timeline, nur am falschen Ort, zu technisch formatiert und ohne Eingabe-Möglichkeit.

Das mentale Modell "Was ist passiert, was ist als Nächstes zu tun?" wird nicht unterstützt.

## Solution

### Evolutionsstrategie (kein Big Bang)

Der bestehende Code bleibt weitgehend — die Historie-Tab wird zum zentralen Feed, Tabs werden reduziert, ein Composer kommt hinzu.

---

### Schritt 1: Historie → "Aktivitäten" als Default-Tab

**Umbenennen + als erster Tab setzen:**
```
Aktivitäten | Dokumente | Termine & Fristen | Finanzen | ··· (Overflow)
```

**Event-Texte säubern** (aktuell zu technisch):
```
Vorher: "mimeType: application/vnd.openxmlformats-officedocument..."
Nachher: "PDF hochgeladen · 70.4 KB"

Vorher: "Akte bearbeitet — cmm3s1u9r000113shncfyw0e0 → cmm3s1ua..."
Nachher: "Zuständigkeit geändert — Anwalt: Patrick Baumfalk, SB: Anna Meier"
```

**Filterchips oberhalb des Feeds:**
```
[Alle] [Fristen] [Dokumente] [Kommunikation] [Zeit] [System ↓]
```
"System"-Events (technische Änderungen) standardmäßig ausgeblendet, aufklappbar.

---

### Schritt 2: Composer (persistent, unten im Feed)

Festes Input-Feld am unteren Rand der Aktivitäten-View:

```
┌────────────────────────────────────────────────────────────┐
│  Notiz hinzufügen...                              [Senden] │
│  ☎ Telefonnotiz  ✅ Aufgabe  📎 Dokument  ⏱ Zeit         │
└────────────────────────────────────────────────────────────┘
```

**Telefonnotiz-Overlay** (eigener Mini-Flow):
- Beteiligter (Dropdown: Mandant / Gegner / Gericht / Sonstige)
- Ergebnis (erreicht / nicht erreicht / Rückruf vereinbart / Info hinterlassen)
- Stichworte (Freitext)
- Nächster Schritt (Checkboxen: Rückruf, E-Mail, Frist, Dokument)
- Speichern → erscheint als Feed-Event

**Aufgabe/Frist:**
- Direkt aus Composer: Titel + Datum + Typ (Frist / Termin / Wiedervorlage) → in Feed + Termine-Tab

---

### Schritt 3: Tab-Reduktion

**Von 11 auf 4-5 sichtbare Tabs:**

```
Aktivitäten  |  Dokumente  |  Termine & Fristen  |  Finanzen  |  ···
```

**"···"-Overflow-Menü** enthält:
- Beteiligte
- Falldaten
- Aktenkonto / Rechnungen
- Zeiterfassung (auch über Composer erreichbar)
- Prüfprotokoll
- E-Mails

Alternativ: Beteiligte + Falldaten als **Drawer** (öffnet von rechts), nicht als Tab — dann kein Kontextwechsel.

---

### Schritt 4: Key-Facts-Panel (sticky, oberhalb Tabs)

Kompakter Block zwischen Header und Tabs (immer sichtbar, kein Tab):

```
Gegenstandswert: 15.000 € · Gericht: ArbG Dortmund · Phase: Klage
Nächste Frist: Klageschrift einreichen · 05.03.2026 (6 Tage) ⚠
Mandant: Thomas Müller · Gegner: Schmidt & Partner GmbH
```

Editierbar per Klick auf Wert (Inline-Edit oder kleiner Drawer), kein Tab-Wechsel zu "Übersicht" nötig.

---

### Datenmodell-Erweiterung

Neue Tabelle `AktenEvent` (oder Erweiterung bestehender Historie):
```prisma
model AktenEvent {
  id          String    @id @default(cuid())
  akteId      String
  typ         EventTyp  // NOTIZ | TELEFONNOTIZ | AUFGABE | DOKUMENT | ZEIT | SYSTEM | CHAT
  inhalt      String?
  metadaten   Json?     // flexible Felder je Typ
  erstelltVon String
  erstelltAm  DateTime  @default(now())
  akte        Akte      @relation(...)
  autor       User      @relation(...)
}
```

System-Events (bestehende Historie) werden als `typ: SYSTEM` migriert — kein Datenverlust.

---

### Implementierungsreihenfolge

1. Historie-Tab umbenennen + als Default setzen + Event-Texte säubern (1 Tag)
2. Filterchips (1 Tag)
3. Key-Facts-Panel sticky (1 Tag)
4. Composer: Notiz + einfache Aufgabe (2 Tage)
5. Telefonnotiz-Overlay (1 Tag)
6. Tab-Reduktion + Overflow-Menü (1 Tag)
7. AktenEvent-Tabelle + Migration bestehender Historie (1 Tag)

---

### Was NICHT in diesem Todo ist

- AI-Features im Feed (Helena-Zusammenfassung, AI-Extraktion) → Helena-Orchestrator-Todo
- Aktenchat als vollwertiger Kanal → separates Feature nach Feed-Umbau
- Telefonnotiz Voice-to-Text → Phase 2
