---
created: 2026-02-26T22:19:15.838Z
title: Export CSV XLSX Akten Kontakte Finanzen
area: ui
files: []
---

## Problem

Nutzer können Kerndaten nicht exportieren — für externe Analyse, Reporting und Compliance-Zwecke wird CSV/XLSX-Export benötigt. Betrifft Akten, Kontakte und Finanzdaten.

War Phase 12 im Roadmap — zurückgestellt.

## Solution

Download-Buttons in den jeweiligen Listen, Export über API-Route mit korrekte Encoding.

**Erfolgskriterien (aus ursprünglichem Roadmap):**
1. Akten-Liste als CSV exportieren, mit aktuell aktiven Filtern
2. Kontakte-Liste als CSV exportieren
3. Finanzdaten (Rechnungen, Aktenkonto-Einträge) als CSV exportieren
4. XLSX als alternatives Format für alle drei Bereiche wählbar
5. Exportierte Dateien mit deutschen Spaltenüberschriften und korrektem Umlaut-Encoding (UTF-8 BOM für CSV)

**Abhängigkeiten:** Phase 10 (stabiler Build), liest bestehende Datenmodelle
**Requirements:** EXP-01, EXP-02, EXP-03, EXP-04
