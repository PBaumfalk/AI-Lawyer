---
created: 2026-02-26T22:12:27.452Z
title: Helena QA-Gates und Audit-Trail
area: api
files:
  - src/app/api/ki-chat/route.ts
  - src/lib/helena/orchestrator.ts
  - prisma/schema.prisma
---

## Problem

Ohne messbare Qualitätskriterien ist "Helena ist besser geworden" Bauchgefühl. Jede Änderung an Chunking, Reranker, Prompts oder Wissensquellen kann unbemerkt Qualität verschlechtern. Außerdem fehlt ein Audit-Trail: Kanzleien müssen nachvollziehen können, welche Quellen für welchen Schriftsatz genutzt wurden.

Dieses Todo ist bewusst nach den Wissensquellen-Todos priorisiert — erst wenn Inhalte existieren, kann man sie sinnvoll evaluieren.

## Solution

### 1. Goldset / Testkatalog

**50–200 typische Kanzlei-Queries je Bereich** (wächst organisch aus echter Nutzung):

Kategorien:
- KSchG-Klage (Zuständigkeit, Frist, Anträge, Streitwert)
- Lohnklage (Verzug, Zinsen, Abzüge)
- Abmahnung/Unterlassung
- Einstweilige Verfügung (Verfügungsanspruch, -grund)
- Mahnverfahren (Antrag, Widerspruch, Übergang streitiges Verfahren)
- Fristen (Klagefrist KSchG, Berufungsfristen, Verjährung)
- Kostenfragen (Streitwert, PKH-Voraussetzungen)

Format: `goldset/queries/[bereich]/[id].yaml`
```yaml
query: "Erstelle KSchG-Klage, fristlose Kündigung, Industrie-Mechaniker, 3.200 EUR brutto"
expected_norms: ["KSchG § 1", "KSchG § 4", "ArbGG § 2"]
expected_muster_type: "kschg-klage"
expected_streitwert_range: [9000, 10000]
must_contain: ["Kündigungsschutzklage", "Weiterbeschäftigung", "Anlage"]
must_not_contain: ["halluziniertes_az"]
```

---

### 2. Metriken

**Retrieval-Metriken** (automatisch messbar):
- `Recall@k`: Sind erwartete Normen/Urteile/Muster in Top-k?
- `MRR` (Mean Reciprocal Rank): Wie weit oben steht die relevante Quelle?
- `No-result-Rate`: Wie oft liefert Hybrid Search keine Treffer?

**Output-Metriken** (teils LLM-as-Judge):
- Zitiergenauigkeit: Fundstelle vorhanden + korrekt referenziert?
- Halluzinationsrate: Normen/AZ die nicht im Retrieval-Kontext waren
- Formale Vollständigkeit: Rubrum ✓, Anträge ✓, Beweisangebot ✓, Anlagen ✓
- Streitwert-Korrektheit: Berechnung gegen kosten_rules

---

### 3. Release-Gates

Neue Daten/Chunking/Reranker gehen erst live wenn Score-Schwellen gehalten:
```
Recall@5 Normen    >= 0.85
Recall@5 Muster    >= 0.80
Halluzinationsrate <= 0.05
Formale Vollst.    >= 0.90
Streitwert-Korrektheit >= 0.95
```

CI-Integration: Test-Suite läuft bei jedem Deploy gegen Goldset-Subset (~20 Queries).

---

### 4. Audit-Trail (pro Schriftsatz)

DB-Tabelle `schriftsatz_retrieval_log`:
```
schriftsatz_id FK
akte_id FK
erstellt_am
query_text
retrieval_belege: jsonb[]  // [{chunk_id, quelle, stand, score}, ...]
kosten_regeln_version: string
prompt_version: string
modell: string
```

Anzeige in UI: "Helena hat für diesen Entwurf X Normen, Y Urteile und Z Muster-Bausteine verwendet" — mit aufklappbaren Quellen-Links.

**Logging-Policy:**
- Keine Mandantendaten in Logs/Traces (nur anonymisierte Query-Hashes für Metriken)
- Retrieval-Belege in DB (nicht in externen Log-Diensten)
- Volltext der Query nur in `schriftsatz_retrieval_log`, nicht in generischen App-Logs

---

### Implementierungsreihenfolge

1. Goldset-Struktur + erste 20 Queries (Arbeitsrecht) anlegen
2. Retrieval-Metriken-Runner (Offline-Skript gegen pgvector)
3. Schriftsatz-Retrieval-Log-Tabelle + UI-Anzeige
4. Output-Metriken (LLM-as-Judge für Halluzinations-Check)
5. CI-Integration Release-Gates
