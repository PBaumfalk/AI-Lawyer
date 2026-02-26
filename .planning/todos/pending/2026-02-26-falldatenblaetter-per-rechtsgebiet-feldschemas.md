---
created: 2026-02-26T22:14:02.074Z
title: Falldatenblaetter per-Rechtsgebiet Feldschemas
area: general
files: []
---

## Problem

Jede Akte hat ein Rechtsgebiet (z.B. Arbeitsrecht, Familienrecht, Verkehrsrecht). Aktuell gibt es keine Möglichkeit, rechtsgebietsspezifische Falldaten strukturiert zu erfassen — z.B. für Arbeitsrecht: Kündigungsdatum, Arbeitgeber, Lohn; für Familienrecht: Scheidungsdatum, Kinder, Unterhalt. Diese Daten werden heute entweder gar nicht oder als unstrukturierte Notizen erfasst.

War Phase 12 im Roadmap — wurde zugunsten wichtigerer Features zurückgestellt.

## Solution

- Admin-UI (Settings) zum Definieren von Feldschemas pro Rechtsgebiet (Feldname, Typ: Text/Datum/Zahl/Boolean, Pflicht/Optional)
- Dynamisches Rendering der definierten Felder im Akte-Erstellen/Bearbeiten-Formular
- Anzeige der gespeicherten Falldaten als eigene Sektion auf der Akte-Detailseite
- 3 vorkonfigurierte Beispielschemas: Arbeitsrecht, Familienrecht, Verkehrsrecht mit realistischen Feldern
- Prisma-Modell für strukturierte Speicherung (kein ad-hoc JSON ohne Schema)

**Erfolgsktiterien (aus ursprünglichem Roadmap):**
1. Admin kann Feldschema für ein Rechtsgebiet erstellen/bearbeiten via Settings-UI
2. Akte-Formular rendert dynamisch die definierten Felder des zugeordneten Rechtsgebiets
3. Gespeicherte Falldaten erscheinen auf der Akte-Detailseite in dedizierter Sektion
4. Mindestens 3 vorkonfigurierte Beispielschemas existieren
5. Falldaten in DB mit korrektem Prisma-Modell gespeichert
