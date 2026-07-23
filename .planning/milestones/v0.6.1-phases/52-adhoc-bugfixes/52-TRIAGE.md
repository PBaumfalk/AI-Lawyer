---
created: 2026-03-06
phase: 52-adhoc-bugfixes
source: debug/*, systematic-health-audit
---

# Phase 52 — Bug Triage

## Bugs

### BUG-01: Briefkopf nicht angewendet bei Dokument-Erstellung (aus-vorlage)

- **Severity:** P0
- **Area:** Akte / Dokumente
- **Status:** FIXED (awaiting_human_verify)
- **Wave:** Fixed before Phase 52 (Phase 51 adjacent)
- **Repro:** Standardbriefkopf in Einstellungen > Briefköpfe konfigurieren und als Standard markieren. Neues Dokument "aus Vorlage" im Akte-Dokumenten-Tab erstellen — kein Briefkopf erscheint.
- **Source:** `.planning/debug/briefkopf-not-applied.md`
- **Fix applied:** `applyBriefkopfToDocx()` in `/api/akten/[id]/dokumente/aus-vorlage/route.ts` und `/api/akten/[id]/dokumente/neu/route.ts` ergänzt; Anwälte-Feld in Prisma+UI+DOCX-Generation hinzugefügt; Ordner-Schemata Edit-Button implementiert.
- **Files:** `prisma/schema.prisma`, `src/lib/briefkopf.ts`, `src/app/api/briefkopf/route.ts`, `src/app/api/briefkopf/[id]/route.ts`, `src/components/briefkopf/briefkopf-editor.tsx`, `src/app/api/akten/[id]/dokumente/aus-vorlage/route.ts`, `src/app/api/akten/[id]/dokumente/neu/route.ts`, `src/components/einstellungen/ordner-schemata-tab.tsx`

---

### BUG-02: DOCX-Vorschau hängt dauerhaft ("Vorschau wird generiert...")

- **Severity:** P0
- **Area:** Akte / Dokumente / Infra
- **Status:** FIXED (awaiting_human_verify)
- **Wave:** Fixed before Phase 52 (Phase 51 adjacent)
- **Repro:** DOCX-Datei hochladen, Detailseite öffnen — Vorschau bleibt für immer hängen. Docker-Worker- und Stirling-PDF-Container laufen nicht in Dev.
- **Source:** `.planning/debug/docx-preview-broken.md`
- **Fix applied:** BullMQ + Stirling-PDF-Pipeline durch direkten OnlyOffice-Conversion-API-Aufruf ersetzt. Neues `convertDocumentToPdf()` in `src/lib/onlyoffice.ts`. Preview-Route und Upload-Route aktualisiert. Frontend-UX verbessert.
- **Files:** `src/lib/onlyoffice.ts`, `src/app/api/dokumente/[id]/preview/route.ts`, `src/app/api/akten/[id]/dokumente/route.ts`, `src/components/dokumente/document-detail.tsx`

---

### BUG-03: Helena hat keinen Akten-Kontext

- **Severity:** P0
- **Area:** Helena / KI
- **Status:** RESOLVED (user verified)
- **Wave:** Fixed before Phase 52 (Phase 51)
- **Repro:** Helena befragen während eine Akte selektiert ist — keine Akten-Informationen in der Antwort.
- **Root cause:** Raw-SQL-Query verwendete `"Dokument"` (Prisma-Modellname) statt `"dokumente"` (PostgreSQL-Tabellenname via `@@map`). Fehler wurde silent gecatcht → Chain A lieferte leeren String. Zusätzlich war `## Denkprozess`-Instruction am Ende des SYSTEM_PROMPT_BASE, sodass der LLM nachfolgendem Kontext ignorierte.
- **Source:** `.planning/debug/helena-no-akte-context.md`
- **Fix applied:** Commits `5f3237e` + `3750679`.

---

### BUG-04: Helena langsame Antworten

- **Severity:** P1
- **Area:** Helena / KI / Performance
- **Status:** RESOLVED (user verified)
- **Wave:** Fixed before Phase 52 (Phase 51)
- **Repro:** Jede Helena-Anfrage dauert sehr lange, keine Fehler sichtbar.
- **Root cause:** Chain A–D liefen sequenziell; keine Caching; kein RAG-Skip für einfache Nachrichten.
- **Source:** `.planning/debug/helena-slow-responses.md`
- **Fix applied:** Parallelisierung via Promise.all, Settings-Cache mit TTL, RAG-Skip-Heuristik (`shouldSkipRag()`), Abort-Handler im Frontend.

---

### BUG-05: OCR-Pipeline und PDF-Vorschau defekt

- **Severity:** P0
- **Area:** Akte / Dokumente / Infra
- **Status:** RESOLVED (user verified)
- **Wave:** Fixed before Phase 52 (Phase 51)
- **Repro:** OCR startet nicht. PDF-Vorschau zeigt nichts. Docker läuft.
- **Root cause:** 5 separate Probleme: `pdf-parse` v2 API-Change, falsche Preview-URL im Frontend, fehlende `groesse`-Aktualisierung nach OCR, Turbopack-Canvas-Alias fehlend, `pdfjs-dist`-Versionsmismatch.
- **Source:** `.planning/debug/ocr-pdf-preview-broken.md`
- **Fix applied:** Alle 5 Issues behoben (Phase 51).

---

### BUG-06: React Hooks Violation — admin/rollen/page.tsx

- **Severity:** P0
- **Area:** Admin
- **Status:** OPEN
- **Wave:** 1 (52-02)
- **Repro:** `admin/rollen/page.tsx:82` — `useCallback` nach Early-Returns (Zeilen 59–73). Verletzt Rules of Hooks. Kann zu React-Runtime-Crash führen.
- **Source:** `.planning/debug/systematic-health-audit.md`
- **Fix:** `useCallback`-Aufruf vor die Early-Returns verschieben.
- **Files:** `src/app/(dashboard)/admin/rollen/page.tsx`

---

### BUG-07: TypeScript-Fehler in falldaten-tab.tsx (durch Build-Config maskiert)

- **Severity:** P1
- **Area:** Akte / Falldaten
- **Status:** OPEN
- **Wave:** 1 (52-02)
- **Repro:** `src/components/akten/falldaten-tab.tsx:309-310` — `TemplateField.typ` ist `string`, aber `FalldatenForm` erwartet `FalldatenFeldTypDB`-Union. `beschreibung` ist `string | null`, aber `TemplateSchema` erwartet `string | undefined`. War zuvor durch `ignoreBuildErrors: true` maskiert; nach Phase 51 schlägt Build an.
- **Source:** `.planning/debug/systematic-health-audit.md`
- **Fix:** Type-Cast oder Interface-Anpassung in falldaten-tab.tsx.
- **Files:** `src/components/akten/falldaten-tab.tsx`

---

### BUG-08: special-quests/route.ts — nicht-Route-Export

- **Severity:** P1
- **Area:** Gamification
- **Status:** OPEN
- **Wave:** 1 (52-02)
- **Repro:** `src/app/api/gamification/special-quests/route.ts:29` exportiert `CONDITION_TEMPLATES` — Next.js erlaubt in Route-Dateien nur Route-Handler-Exports. Kann Runtime-Probleme verursachen.
- **Source:** `.planning/debug/systematic-health-audit.md`
- **Fix:** `CONDITION_TEMPLATES` in eine separate Datei (z. B. `src/lib/gamification/condition-templates.ts`) auslagern.
- **Files:** `src/app/api/gamification/special-quests/route.ts`

---

### BUG-09: compose-popup.tsx — TS2448 saveDraft Block-Scope-Fehler

- **Severity:** P1
- **Area:** E-Mail
- **Status:** OPEN
- **Wave:** 1 (52-02)
- **Repro:** `src/components/email/compose-popup.tsx:153` — `saveDraft` wird in `useEffect` referenziert, aber nach Phase 51 ist die Variable-Deklarationsreihenfolge ein Problem (`TS2448`). Aus Phase 51 deferred.
- **Source:** `.planning/phases/51-systematic-bug-audit-fix/deferred-items.md`
- **Fix:** `useCallback`-Deklaration von `saveDraft` vor das `useEffect`, das es referenziert, verschieben.
- **Files:** `src/components/email/compose-popup.tsx`

---

### BUG-10: Ollama Env-Var-Inkonsistenz (OLLAMA_BASE_URL vs OLLAMA_URL)

- **Severity:** P1
- **Area:** Infra / Helena / KI
- **Status:** OPEN
- **Wave:** 1 (52-02)
- **Repro:** In Docker (OLLAMA_URL gesetzt) verwenden `src/lib/ai/ollama.ts`, `provider.ts`, `complexity-classifier.ts`, `defaults.ts` den falschen Env-Var-Namen (`OLLAMA_BASE_URL`). In Local Dev analog invertiert. Beide Modi fallen auf Hardcoded-Defaults zurück, die falsch sein können.
- **Source:** `.planning/debug/systematic-health-audit.md`
- **Fix:** `OLLAMA_BASE_URL` als einheitlichen Env-Var-Namen überall verwenden (`.env` und `docker-compose` angleichen).
- **Files:** `src/lib/health/checks.ts`, `src/lib/pii/ner-filter.ts`, `src/lib/embedding/embedder.ts`, `src/lib/ai/reranker.ts` (auf `OLLAMA_BASE_URL` umstellen)

---

### BUG-11: Stirling-PDF Health-Check falscher Port (8090 statt 8081)

- **Severity:** P1
- **Area:** Infra / Health
- **Status:** OPEN
- **Wave:** 1 (52-02)
- **Repro:** Health-Dashboard zeigt Stirling immer als unhealthy in Local Dev, weil `src/lib/health/checks.ts:48` Fallback `http://localhost:8090` verwendet. `docker-compose` mappt `8081:8080`, `.env` setzt `http://localhost:8081`.
- **Source:** `.planning/debug/systematic-health-audit.md`
- **Fix:** Fallback-URL auf `http://localhost:8081` korrigieren.
- **Files:** `src/lib/health/checks.ts`

---

### BUG-12: Fehlende Error Boundaries (error.tsx / loading.tsx / not-found.tsx)

- **Severity:** P1
- **Area:** Infra / App
- **Status:** OPEN
- **Wave:** 1 (52-02)
- **Repro:** Jeder unbehandelte Fehler in einem Server Component führt zu leerem/generischem Error-Screen ohne Recovery. Komplette Abwesenheit von `error.tsx`, `loading.tsx`, `not-found.tsx` in allen Route-Gruppen.
- **Source:** `.planning/debug/systematic-health-audit.md`
- **Fix:** `error.tsx` für Root, Dashboard und Portal Route-Gruppen; `loading.tsx` für Key-Route-Gruppen; `not-found.tsx` für Root.
- **Files:** `src/app/error.tsx`, `src/app/(dashboard)/error.tsx`, `src/app/(portal)/error.tsx`, `src/app/not-found.tsx`, diverse `loading.tsx`

---

### BUG-13: npm Security Vulnerabilities (5 high) — Next.js 14.2.35

- **Severity:** P2
- **Area:** Infra / Security
- **Status:** OPEN
- **Wave:** 2 (52-03)
- **Repro:** `npm audit` zeigt 11 Vulnerabilities (2 low, 4 moderate, 5 high) in `next@14.2.35` und `minimatch`. Betrifft DoS via Image Optimizer + HTTP Request Deserialization.
- **Source:** `.planning/debug/systematic-health-audit.md`
- **Fix:** Upgrade auf Next.js 14.x neuester Patch oder Planung für v15-Migration. Risikoabschätzung nötig.
- **Files:** `package.json`

---

### BUG-14: ESLint-Config referenziert nicht vorhandene @typescript-eslint-Regel

- **Severity:** P2
- **Area:** Infra / DX
- **Status:** OPEN
- **Wave:** 2 (52-03)
- **Repro:** 8 Dateien enthalten `eslint-disable-next-line @typescript-eslint/no-explicit-any`, aber `.eslintrc.json` enthält keine `@typescript-eslint`-Extension. Führt zu 7 ESLint "Definition for rule not found"-Fehlern.
- **Source:** `.planning/debug/systematic-health-audit.md`
- **Fix:** `.eslintrc.json` um `@typescript-eslint`-Plugin erweitern oder `eslint-disable`-Kommentare entfernen.
- **Files:** `.eslintrc.json`, `chat-layout.tsx`, `db.ts`, `nummernkreis.ts`, `quest-evaluator.ts`, `boss-engine.ts`, `retrieval-log.ts`

---

### BUG-15: 317 ESLint Warnings (no-unused-vars) in ~80 Dateien

- **Severity:** P2
- **Area:** Code Quality / DX
- **Status:** OPEN
- **Wave:** 2 (52-03)
- **Repro:** `npx next lint` zeigt 317 Warnungen für unbenutzte Imports und Variablen in ~80 Dateien.
- **Source:** `.planning/debug/systematic-health-audit.md`
- **Fix:** Systematische Bereinigung der größten Offender (Core-Feature-Komponenten priorisieren).
- **Files:** Circa 80 Dateien quer durch `src/`

---

### BUG-16: Prisma Major Version Behind (v5.22 vs v7.4.2)

- **Severity:** P3
- **Area:** Infra / Tech Debt
- **Status:** OPEN
- **Wave:** Deferred
- **Repro:** `package.json` zeigt Prisma 5.22.0. Aktuell ist 7.4.2 (2 Major-Versionen dahinter). Kumulierte Tech-Schulden.
- **Source:** `.planning/debug/systematic-health-audit.md`
- **Rationale für Deferral:** Major-Upgrade mit Breaking Changes; kein unmittelbarer Funktionsausfall; benötigt eigenen Testdurchlauf + Migrationsprüfung. Zu risikoreich für Bugfix-Sprint.

---

### BUG-17: 80 Silent `.catch(() => {})` Blöcke in 59 Dateien

- **Severity:** P3
- **Area:** Code Quality / Infra
- **Status:** OPEN
- **Wave:** Deferred
- **Repro:** ~80 leere Catch-Blöcke in 59 Dateien swalloen potenziell wichtige Fehler in User-facing Flows.
- **Source:** `.planning/debug/systematic-health-audit.md`
- **Rationale für Deferral:** Viele sind Fire-and-Forget (Logging, Audit-Events) und korrekt. Audit aller Blöcke ist aufwändig und birgt Regressionsrisiko. Für dediziertes Error-Handling-Refactoring reservieren.

---

### BUG-18: `<img>`-Tags statt `next/image` (Performance)

- **Severity:** P3
- **Area:** Performance / Frontend
- **Status:** OPEN
- **Wave:** Deferred
- **Repro:** `briefkopf-editor.tsx`, `audit-timeline.tsx`, `portal-sidebar.tsx` verwenden `<img>` statt `<Image />` von Next.js. LCP-Impact.
- **Source:** `.planning/debug/systematic-health-audit.md`
- **Rationale für Deferral:** Keine funktionale Regression; rein performative Verbesserung. Passend für v0.7 UI/UX-Sprint.

---

## Fix Waves

### Wave 1 — 52-02: P0/P1 Kritische Fixes

Enthält nur Bugs mit direktem Funktionsausfall, Crash-Risiko, oder falschen Daten.
Kein Scope-Creep, keine neuen Features.

| Bug | Titel | Severity | Rationale |
|-----|-------|----------|-----------|
| BUG-06 | React Hooks Violation rollen/page.tsx | P0 | Rules-of-Hooks-Verletzung → Runtime-Crash möglich |
| BUG-07 | TypeScript-Fehler falldaten-tab.tsx | P1 | Build-Fehler nach Phase 51 (ignoreBuildErrors: false) |
| BUG-08 | special-quests Route-Export | P1 | Unerlaubter Export in Next.js Route-Datei → Runtime-Risiko |
| BUG-09 | compose-popup.tsx TS2448 saveDraft | P1 | Deferred von Phase 51; TypeScript-Compilerfehler im Email-Compose |
| BUG-10 | Ollama Env-Var-Inkonsistenz | P1 | Helena + KI-Features fallen auf falsche Defaults zurück in Docker/Local |
| BUG-11 | Stirling-PDF Health-Check Port 8090 | P1 | Health-Dashboard immer falsch → falsche Betriebswahrnehmung |
| BUG-12 | Fehlende Error Boundaries | P1 | Unbehandelte Fehler → blank/generic Crash-Screens ohne Recovery |

**Scope-Grenze Wave 1:** Nur Korrekturen an bestehenden Dateien. Kein Umbau, keine Architekturänderungen.

---

### Wave 2 — 52-03: P2 Tech Debt (niedrig-riskant)

Enthält Verbesserungen, die kein Crash-Risiko haben, aber Code-Qualität und Sicherheit verbessern.
Erlaubt wenn Low-Risk (kein Umbau, keine Breaking Changes).

| Bug | Titel | Severity | Rationale |
|-----|-------|----------|-----------|
| BUG-13 | npm Security Vulnerabilities (5 high) | P2 | Security-Patching nach Risikoabschätzung; Upgrade-Pfad prüfen |
| BUG-14 | ESLint-Config @typescript-eslint fehlt | P2 | Verhindert korrekte Lint-Auswertung; einfacher Config-Fix |
| BUG-15 | 317 ESLint Warnings (no-unused-vars) | P2 | Code-Hygiene; nach BUG-14 fix sinnvoller zu bereinigen |

**Scope-Grenze Wave 2:** Keine neuen Features. Keine Major-Upgrades (Prisma, Next.js Major). Low-Risk-Fixes only.

---

### Deferred — P3 / Hohe Komplexität

Items explizit deferred mit Begründung. Nicht Teil von Phase 52.

| Bug | Titel | Rationale für Deferral |
|-----|-------|------------------------|
| BUG-16 | Prisma Major Upgrade (v5 → v7) | Major-Upgrade mit Breaking Changes, benötigt eigenen Migrationssprint. Kein unmittelbarer Ausfall. |
| BUG-17 | 80 Silent `.catch(() => {})` Blöcke | Viele sind korrekt (Fire-and-Forget). Vollständiger Audit risikoreich, eigener Refactoring-Sprint nötig. |
| BUG-18 | `<img>` statt `next/image` | Rein performativ, kein Funktionsausfall. Passend für v0.7 UI/UX-Sprint. |

---

## Summary

| Wave | Bugs | Anzahl |
|------|------|--------|
| Already Fixed (vor Phase 52) | BUG-01 bis BUG-05 | 5 |
| Wave 1 — 52-02 (P0/P1) | BUG-06 bis BUG-12 | 7 |
| Wave 2 — 52-03 (P2) | BUG-13 bis BUG-15 | 3 |
| Deferred (P3) | BUG-16 bis BUG-18 | 3 |
| **Total** | | **18** |
