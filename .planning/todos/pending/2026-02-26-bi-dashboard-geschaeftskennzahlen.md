---
created: 2026-02-26T22:17:46.239Z
title: BI-Dashboard Geschaeftskennzahlen
area: ui
files: []
---

## Problem

Entscheidungsträger (ADMIN, ANWALT) haben keinen schnellen Überblick über die wichtigsten Geschäftskennzahlen. Diese müssen aktuell manuell aus verschiedenen Bereichen zusammengesucht werden (Akten, Rechnungen, Fristen).

War Phase 12 im Roadmap — wurde zugunsten des Export-Features zurückgestellt.

## Solution

KPI-Tiles auf dem Dashboard, nur sichtbar für ADMIN und ANWALT (RBAC).

**Erfolgskriterien (aus ursprünglichem Roadmap):**
1. KPI-Tile "Neue Akten pro Monat" — aktueller Monatscount + Trend vs. Vormonat
2. KPI-Tile "Offene Posten" — Gesamtsumme unbezahlter Rechnungen
3. KPI-Tile "Fällige Fristen" — Anzahl Fristen in den nächsten 7 Tagen
4. KPI-Tile "Umsatz pro Monat" — aktueller Monatsumsatz
5. BI-Dashboard-Sektion nur für ADMIN/ANWALT sichtbar (RBAC auf API + UI)

**Abhängigkeiten:** Phase 10 (stabiler Build), liest bestehende Prisma-Models (Akte, Rechnung, Frist)
**Requirements:** BI-01, BI-02, BI-03, BI-04, BI-05
