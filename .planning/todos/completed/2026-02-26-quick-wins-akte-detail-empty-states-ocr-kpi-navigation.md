---
created: 2026-02-26T23:15:34.879Z
title: Quick-Wins Akte-Detail — Empty States, OCR-Recovery, KPI-Navigation
area: ui
files:
  - src/app/(app)/akten/[id]/
  - src/components/akten/akte-detail-tabs.tsx
  - src/components/akten/dokumente/
---

## Problem

Mehrere konkrete UX-Schwachstellen in der Akte-Detailansicht, die in einem Tag fixbar sind, aber täglich stören:

1. **KPI-Cards sind dekorativ, nicht navigierbar** — "5 Termine/Fristen" anklicken macht nichts
2. **"OCR fehlgeschlagen"** zeigt nur ein Mini-Retry-Icon, kein Recovery-Flow
3. **Empty States sind tote Enden** — "Keine beA-Aktivitäten", "0 veraktete E-Mails" ohne Handlungsoption
4. **"Nachrichten: 0"** KPI-Card suggeriert ein Feature das nicht existiert/leer ist
5. **Zeiterfassung-Einträge ohne Beschreibung** — "—" als Kategorie, kein Kontext sichtbar

## Solution

### 1. KPI-Cards → anklickbar, navigieren zum Tab

Jede KPI-Card (`src/components/akten/akte-detail-tabs.tsx` o.ä.) wird ein `<button>` / Link der direkt zum jeweiligen Tab springt:

```
3 Beteiligte      → Tab "Beteiligte"
1 Dokumente       → Tab "Dokumente"
5 Termine/Fristen → Tab "Termine & Fristen"
4 E-Mails         → Tab "E-Mails"
36 Zeiterfassung  → Tab "Zeiterfassung"
0 Nachrichten     → Tab "Aktivitäten" (umbenannt, s. Feed-Umbau-Todo)
```

Hover-State: leichte Elevation / Cursor pointer. Kein anderes visuelles Design nötig.

---

### 2. OCR fehlgeschlagen → Recovery-Flow

Statt Mini-Icon: inline Recovery-Banner am Dokument-Eintrag:

```
┌─────────────────────────────────────────────────────────┐
│ ⚠ OCR fehlgeschlagen                                     │
│ Der Text konnte nicht automatisch erkannt werden.        │
│ [↺ Erneut versuchen]  [🔍 Vision-Analyse]  [✎ Manuell] │
└─────────────────────────────────────────────────────────┘
```

- **Erneut versuchen** → OCR-Job neu in Queue einreihen
- **Vision-Analyse** → Seitenbilder → GPT-4o Vision für Textextraktion (Fallback)
- **Manuell** → Texteingabe-Overlay (User tippt/diktiert den Inhalt)

---

### 3. Empty States → Handlungsfähig

**Prüfprotokoll ("Keine beA-Aktivitäten"):**
```
🛡 Noch keine beA-Aktivitäten

Sobald Schriftsätze über beA übermittelt werden,
erscheinen sie hier automatisch.

[beA konfigurieren →]  (nur wenn beA noch nicht eingerichtet)
```

**E-Mails ("0 veraktete E-Mails"):**
```
✉ Noch keine E-Mails verknüpft

E-Mails können direkt aus dem Posteingang zu dieser
Akte hinzugefügt werden.

[E-Mail verfassen →]  [E-Mail-Posteingang öffnen →]
```

Keine leere weiße Fläche mehr — Icon + kurzer Erklärtext + max. 2 CTAs.

---

### 4. "Nachrichten: 0" KPI-Card

Umbenennen zu "Chat" oder — wenn der Aktenchat noch nicht produktionsreif ist — KPI-Card ausblenden bis Feature existiert. Kein "0" für ein leeres Feature zeigen.

---

### 5. Zeiterfassung — Beschreibung im Quick-Entry sichtbar

In der Zeiterfassungs-Tabelle:
- "—" in Kategorie-Spalte → grau "Keine Kategorie" (statt Strich)
- Leere Beschreibung → kleiner Hinweis-Link "Beschreibung hinzufügen" inline

Zusätzlich: beim nächsten Zeit-Eintrag (ob automatisch oder manuell) sofort Beschreibungsfeld fokussieren.
