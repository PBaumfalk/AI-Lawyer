---
phase: 53
plan: 01
subsystem: ui-akte-detail
tags: [ux, tabs, kpi, empty-states, key-facts]
dependency_graph:
  requires: []
  provides: [akte-detail-tab-reduction, key-facts-panel, contextual-empty-states]
  affects: [akte-detail-client, akte-detail-tabs, activity-feed]
tech_stack:
  added: []
  patterns: [overflow-dropdown, contextual-empty-state, key-facts-panel]
key_files:
  created: []
  modified:
    - src/components/akten/akte-detail-tabs.tsx
    - src/components/akten/activity-feed.tsx
    - src/app/(dashboard)/akten/[id]/akte-detail-client.tsx
decisions:
  - "Tab overflow uses a simple Popover-style dropdown (no DropdownMenu component needed)"
  - "Key-Facts Panel renders null if akte has no relevant data (zero-state safe)"
  - "Chat KPI card conditionally hidden when chatNachrichten == 0"
metrics:
  duration: 15min
  completed: 2026-03-06
---

# Phase 53 Plan 01: Akte-Detail UX — Tab-Reduktion, Key-Facts, Empty States Summary

**One-liner:** Tab-Reduktion auf 5 sichtbare Tabs mit Overflow-Menu, Key-Facts-Panel fuer Schnellkontext und kontextuelle Empty States im ActivityFeed.

## What Was Built

### Tab-Reduktion

Reduziert von 7 auf 5 sichtbare Tabs:
- Main tabs: Aktivitaeten | Dokumente | Termine & Fristen | Finanzen | Falldaten
- Overflow "..." menu (rechts neben TabsList): Chat, Portal
- Overflow-Button zeigt aktiven Zustand wenn ein Overflow-Tab aktiv ist

### Key-Facts-Panel

Kompakter Streifen zwischen KPI-Cards und Tabs, zeigt:
- Streitwert (formatiert als EUR)
- Sachgebiet
- Naechste Frist (mit Datum + Tage-Countdown, Warnung wenn <= 7 Tage via AlertTriangle)
- Mandant-Name (erste MANDANT-Beteiligte)
- Gegner-Name (erste GEGNER/GEGNERVERTRETER-Beteiligte)
Panel rendert `null` wenn keine Info vorhanden.

### Chat KPI-Card

Wird ausgeblendet wenn `_count.chatNachrichten === 0`.

### Kontextuelle Empty States

`FeedEmptyState`-Komponente im ActivityFeed zeigt je nach aktivem Filter:
- **E-Mails**: Icon + Text + CTAs "Posteingang oeffnen" + "Alle E-Mails anzeigen"
- **Helena**: Icon + erklaerende Text
- **Alle anderen**: generischer Icon + Text

## Deviations from Plan

### Already Implemented

Several items from the todos were already implemented in previous phases:
- Aktivitaeten als Default-Tab (war bereits "feed" mit defaultValue="feed")
- Composer im ActivityFeed (ActivityFeedComposer war bereits vorhanden)
- Filter chips im ActivityFeed (waren bereits implementiert)
- KPI-Cards klickbar (waren bereits in akte-detail-client.tsx implementiert)
- Zeiterfassung "Keine Kategorie" und "Beschreibung hinzufuegen" (waren bereits implementiert)

### What Was Implemented

Only the delta (missing items) were implemented:
- [Rule 2 - Missing feature] Tab overflow menu was missing — implemented as simple state-based dropdown
- [Rule 2 - Missing feature] Key-Facts panel was completely missing — added above tabs
- [Rule 2 - Missing feature] Chat KPI conditional hide was missing — added
- [Rule 2 - Missing feature] Contextual empty states in ActivityFeed — added FeedEmptyState component

## Self-Check

- [x] `src/components/akten/akte-detail-tabs.tsx` modified
- [x] `src/components/akten/activity-feed.tsx` modified
- [x] `src/app/(dashboard)/akten/[id]/akte-detail-client.tsx` modified
- [x] TypeScript check: PASSED (npx tsc --noEmit)
- [x] Build check: PASSED (npx next build)
- [x] Commit: 976997e
