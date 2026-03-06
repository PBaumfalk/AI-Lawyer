---
phase: 52-adhoc-bugfixes
created: 2026-03-06
milestone: v0.6.1
---

# Phase 52 — Context & Scope

## Phase Boundary

**Phase 52 ist ein reiner Bugfix-Sprint. Keine neuen Features.**

Erlaubt:
- Korrekturen an bestehendem Code (Type-Fixes, Hook-Reihenfolge, Env-Var-Namen)
- Sicherheits-Patches für bekannte Vulnerabilities
- Fehlende Error-Boundaries / Recovery-UX hinzufügen
- ESLint-Config-Korrekturen

Nicht erlaubt:
- Neue Features oder Screens
- Neue Datenbankmodelle oder Tabellen (nur Spaltenanpassungen wenn für Bug-Fix zwingend)
- Änderungen an bestehender Architektur (Auth, API-Struktur, Datenmodell)
- Major-Version-Upgrades (Prisma, Next.js)

**Rationale:** v0.6.1 ist ein Stabilitätsmeilenstein. Scope-Creep gefährdet die Regression-Freiheit der Kernflows (Akte, E-Mail, Helena).

---

## Entscheidungskriterien P0/P1 vs P2

### P0 — Sofortiger Handlungsbedarf

Mindestens eine der folgenden Bedingungen:
- Feature ist komplett defekt oder unnutzbar
- React/Next.js-Regeln verletzt → Runtime-Crash möglich
- TypeScript-Compilerfehler, die den Build blockieren (nach `ignoreBuildErrors: false` in Phase 51)
- Sicherheitslücke mit direktem Ausnutzungsrisiko in Produktion

**Beispiel:** BUG-06 (Rules of Hooks), BUG-07 (TS-Fehler im Build)

### P1 — Wichtig, aber kein sofortiger Ausfall

Mindestens eine der folgenden Bedingungen:
- Feature funktioniert, aber erzeugt falsche Daten / falsches Feedback
- Umgebungsvariablen-Inkonsistenz → Features fallen still auf Fallbacks zurück
- Fehlende Recovery-UX → User-facing Crash-Screen ohne Ausweg
- TypeScript-Fehler ohne Build-Blockierung (aber erhöhtes Regression-Risiko)

**Beispiel:** BUG-10 (Ollama Env-Var), BUG-11 (Stirling-PDF Port), BUG-12 (Error Boundaries)

### P2 — Tech Debt mit messbarem Nutzen

Keine unmittelbare Beeinträchtigung, aber:
- Bekannte Sicherheits-Vulnerabilities mit CVSS ≥ 7
- Lint-Konfigurationsfehler, die künftige Bugs maskieren
- Code-Hygiene-Issues, die Developer-Velocity signifikant beeinträchtigen

**Beispiel:** BUG-13 (npm audit), BUG-14 (ESLint config)

### P3 — Backlog

- Kein Funktionsausfall
- Kein Sicherheitsrisiko
- Refactoring-Aufwand überwiegt kurzfristigen Nutzen
- Erfordert eigenen Migrationssprint

**Beispiel:** BUG-16 (Prisma Major Upgrade), BUG-17 (Silent Catches)

---

## Referenzen

- Bug-Backlog: `.planning/phases/52-adhoc-bugfixes/52-TRIAGE.md`
- Systemaudit-Log: `.planning/debug/systematic-health-audit.md`
- Phase-51-Deferred: `.planning/phases/51-systematic-bug-audit-fix/deferred-items.md`
- Phase-51-Summaries: `.planning/phases/51-systematic-bug-audit-fix/51-0{1-4}-SUMMARY.md`

## Fix Waves

| Plan | Wave | Inhalt |
|------|------|--------|
| 52-02 | Wave 1 | BUG-06 bis BUG-12 (P0/P1) |
| 52-03 | Wave 2 | BUG-13 bis BUG-15 (P2) |
| Deferred | - | BUG-16 bis BUG-18 (P3) |

## Erfolgskriterien Phase 52

1. Alle P0/P1-Bugs sind behoben oder explizit deferred mit Begründung
2. Tests laufen lokal ohne harte Abhängigkeit (Ollama-Gate korrekt, nicht als Fehler gewertet)
3. Keine Regressionen in Kernflows: Akte, E-Mail, Helena
4. `npx tsc --noEmit` und `npx next build` schlagen fehlerfrei durch
