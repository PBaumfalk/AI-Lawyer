---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/phases/53-ui-ux-quick-wins/53-01-PLAN.md
  - .planning/phases/53-ui-ux-quick-wins/53-02-PLAN.md
  - .planning/ROADMAP.md
  - .planning/STATE.md
autonomous: true
requirements: ["quick-todos"]

must_haves:
  truths:
    - "Alle offenen Todos in .planning/todos/pending/ werden abgearbeitet — ohne Rückfragen"
    - "Phase 53 wird vollständig geplant und sofort ausgeführt"
    - "Danach werden alle verbleibenden Pending-Todos der Reihe nach abgearbeitet"
  artifacts:
    - path: ".planning/phases/53-ui-ux-quick-wins/53-01-PLAN.md"
      provides: "Akte-Detail UX Redesign Ausführungsplan"
    - path: ".planning/phases/53-ui-ux-quick-wins/53-02-PLAN.md"
      provides: "Key-Facts & Quick Actions Ausführungsplan"
  key_links:
    - from: ".planning/todos/pending/"
      to: ".planning/phases/53-ui-ux-quick-wins/"
      via: "Todo-Inhalte fließen direkt in Task-Actions"
---

<objective>
Alle offenen Todos in .planning/todos/pending/ der Reihe nach abarbeiten, beginnend mit den Phase-53-relevanten Todos (Akte-Detail-UX + Key-Facts), ohne Rückfragen oder Pausen.

Purpose: Maximalen Fortschritt ohne manuelle Steuerung. Todos werden in PLAN-Dateien überführt und sofort ausgeführt.

Output: Phase 53 vollständig geplant und ausgeführt; alle abgearbeiteten Todos archiviert oder als done markiert.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/todos/pending/2026-02-26-akte-detail-feed-umbau-composer-und-tab-reduktion.md
@.planning/todos/pending/2026-02-26-quick-wins-akte-detail-empty-states-ocr-kpi-navigation.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Phase 53 Pläne erstellen und ausführen — Akte-Detail UX</name>
  <files>
    .planning/phases/53-ui-ux-quick-wins/53-01-PLAN.md
    src/components/akten/akte-detail-tabs.tsx
    src/app/(app)/akten/[id]/page.tsx
    src/components/akten/historie/
  </files>
  <action>
Verzeichnis `.planning/phases/53-ui-ux-quick-wins/` anlegen.

Plan 53-01 erstellen mit diesen Aufgaben (aus den Todos direkt ableiten, KEINE Rückfragen):

**Todo-Quellen:**
- `.planning/todos/pending/2026-02-26-akte-detail-feed-umbau-composer-und-tab-reduktion.md`
- `.planning/todos/pending/2026-02-26-quick-wins-akte-detail-empty-states-ocr-kpi-navigation.md`

**Umzusetzende Punkte (Prioritätsreihenfolge, alle P1):**

1. **Tab-Reduktion**: Von 11 auf 4-5 sichtbare Tabs. Reihenfolge: "Aktivitäten | Dokumente | Termine & Fristen | Finanzen | ···". "···"-Overflow-Menü enthält: Beteiligte, Falldaten, Zeiterfassung, E-Mails, Prüfprotokoll. In `src/components/akten/akte-detail-tabs.tsx` umsetzen.

2. **Historie-Tab → "Aktivitäten" umbenennen + als Default-Tab setzen**: Bestehender Code bleibt — nur umbenennen + Reihenfolge ändern. Event-Texte säubern: "mimeType: application/..." → "PDF hochgeladen · 70.4 KB"; UUID-Ketten → lesbaren Text.

3. **Filterchips oberhalb des Feeds**: [Alle] [Fristen] [Dokumente] [Kommunikation] [Zeit] [System ↓]. "System"-Events standardmäßig ausgeblendet, client-seitig gefiltert (kein API-Change nötig).

4. **KPI-Cards klickbar**: Jede KPI-Card wird ein Link/Button der direkt zum jeweiligen Tab scrollt/navigiert. Hover: `cursor-pointer`, leichte Ring-Elevation.

5. **Empty States mit CTAs**: "Keine beA-Aktivitäten" → Icon + Text + optional [beA konfigurieren]. "0 veraktete E-Mails" → Icon + Text + [E-Mail verfassen] + [Posteingang öffnen].

6. **"Nachrichten: 0" KPI-Card ausblenden** wenn Count = 0 (Feature nicht produktionsreif).

Plan 53-01 erstellen, dann sofort ausführen. Nach Ausführung: SUMMARY anlegen, Todos als done markieren (Datei nach `.planning/todos/done/` verschieben oder Frontmatter `status: done` setzen).
  </action>
  <verify>
    <automated>test -f .planning/phases/53-ui-ux-quick-wins/53-01-PLAN.md && test -f .planning/phases/53-ui-ux-quick-wins/53-01-SUMMARY.md</automated>
  </verify>
  <done>Plan 53-01 existiert und wurde ausgeführt. SUMMARY vorhanden. Akte-Detail hat max 5 sichtbare Tabs, KPI-Cards sind klickbar, Empty States haben CTAs.</done>
</task>

<task type="auto">
  <name>Task 2: Phase 53 Plan 02 erstellen und ausführen — Key-Facts & Composer</name>
  <files>
    .planning/phases/53-ui-ux-quick-wins/53-02-PLAN.md
    src/components/akten/akte-detail-tabs.tsx
    src/app/(app)/akten/[id]/page.tsx
    src/components/akten/
  </files>
  <action>
Plan 53-02 erstellen mit diesen Aufgaben (direkt aus Todos, KEINE Rückfragen):

**Umzusetzende Punkte:**

1. **Key-Facts-Panel (sticky, oberhalb Tabs)**: Kompakter Block zwischen Header und Tabs, immer sichtbar. Zeigt: Gegenstandswert, Gericht/Phase, Nächste Frist (mit Warnung wenn < 7 Tage), Mandant + Gegner. Editierbar per Klick auf Wert (Inline-Edit oder kleiner Drawer). Daten aus bestehenden Akte-Feldern — kein Schema-Change nötig.

2. **Composer (persistent, unten im Aktivitäten-Feed)**: Festes Input-Feld. Felder: Freitext-Notiz + [Senden]-Button. Quick-Action-Buttons darunter: [Telefonnotiz] [Aufgabe] [Dokument hochladen] [Zeit erfassen]. Notiz speichert als neues `AktenHistorie`-Event (typ NOTIZ) — bestehende Tabelle nutzen, kein neues Schema erforderlich. Telefonnotiz: einfaches Overlay mit Beteiligte-Dropdown + Ergebnis-Dropdown + Freitext. Aufgabe: Titel + Datum → in bestehende Fristen/Termine-Tabelle einfügen.

3. **Zeiterfassung-Tabelle verbessern**: "—" in Kategorie → grau "Keine Kategorie". Leere Beschreibung → Inline-Link "Beschreibung hinzufügen".

Plan 53-02 erstellen, dann sofort ausführen. Nach Ausführung: SUMMARY anlegen. Roadmap + STATE.md aktualisieren: Phase 53 als complete markieren.
  </action>
  <verify>
    <automated>test -f .planning/phases/53-ui-ux-quick-wins/53-02-PLAN.md && test -f .planning/phases/53-ui-ux-quick-wins/53-02-SUMMARY.md</automated>
  </verify>
  <done>Plan 53-02 existiert und wurde ausgeführt. SUMMARY vorhanden. Key-Facts-Panel sichtbar, Composer im Aktivitäten-Tab vorhanden. STATE.md zeigt Phase 53 complete.</done>
</task>

<task type="auto">
  <name>Task 3: Verbleibende Todos sichten und restliche Phase 53 abschliessen</name>
  <files>
    .planning/STATE.md
    .planning/ROADMAP.md
  </files>
  <action>
Nach Abschluss von Task 1 und 2:

1. Alle abgearbeiteten Todos aus `.planning/todos/pending/` nach `.planning/todos/done/` verschieben (oder `status: done` in Frontmatter setzen, je nachdem was im Projekt etabliert ist).

2. Verbleibende Todos in `.planning/todos/pending/` sichten — prüfen welche als nächstes relevant sind (Phase 54 oder spätere Phasen).

3. STATE.md aktualisieren:
   - `current_phase: 54 — stability-crash-audit (Ready to plan)`
   - `stopped_at: Phase 53 complete. Ready to plan Phase 54 (stability-crash-audit).`
   - `last_updated: aktuelle Zeit`

4. ROADMAP.md aktualisieren: Phase 53 als complete markieren mit Datum.

5. Wenn weitere Pending-Todos direkt auf Phase 54 (stability-crash-audit) einzahlen: Direkt Phase 54 Pläne erstellen und ausführen — ohne Rückfragen.
  </action>
  <verify>
    <automated>grep -q "53.*complete\|53.*Complete\|Phase 53" .planning/ROADMAP.md && grep -q "54" .planning/STATE.md</automated>
  </verify>
  <done>STATE.md zeigt Phase 54 als nächste Phase. ROADMAP.md zeigt Phase 53 als abgeschlossen. Abgearbeitete Todos sind archiviert.</done>
</task>

</tasks>

<verification>
- `test -d .planning/phases/53-ui-ux-quick-wins/`
- `test -f .planning/phases/53-ui-ux-quick-wins/53-01-SUMMARY.md`
- `test -f .planning/phases/53-ui-ux-quick-wins/53-02-SUMMARY.md`
- `grep -q "Phase 53" .planning/ROADMAP.md`
</verification>

<success_criteria>
- Phase 53 vollständig ausgeführt (beide Pläne mit SUMMARY)
- Akte-Detail: max 5 sichtbare Tabs, Aktivitäten als Default, KPI-Cards klickbar, Empty States mit CTAs
- Key-Facts-Panel oberhalb der Tabs sichtbar
- Composer im Aktivitäten-Tab vorhanden
- STATE.md auf Phase 54 vorgerückt
- Abgearbeitete Todos archiviert
</success_criteria>

<output>
Nach Completion: `.planning/quick/1-abarbeiten-aller-offenen-todos-in-reihen/1-SUMMARY.md` erstellen.
</output>
