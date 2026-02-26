---
created: 2026-02-26T22:12:27.451Z
title: Helena Orchestrator und Schriftsatz Output-Schema
area: api
files:
  - src/app/api/ki-chat/route.ts
  - src/lib/embedding/vector-store.ts
  - src/lib/queue/processors/
  - prisma/schema.prisma
---

## Problem

Die 4 Wissensquellen (Gesetze, Urteile, Muster, Kosten/ERV) existieren als separate Komponenten ohne deterministischen Klebstoff. Helena würde sie adhoc per Prompt kombinieren — das führt zu inkonsistenten Schriftsätzen, fehlenden Pflichtteilen und nicht nachvollziehbaren Ergebnissen. Außerdem fehlt ein standardisiertes Zwischenformat, das aus "Kontext + Regeln" ein konsistentes Schriftsatz-Produkt macht.

## Solution

### 1. Flow-Orchestrator (deterministisch, kein "Prompt-Improv")

Separates Modul `src/lib/helena/orchestrator.ts` mit festem Ablauf je Intent:

**Intent-Router:** erkennt Klageart, Stadium, Gerichtszweig aus Nutzeranfrage
```
Intent: KSchG-Klage
  → Slot-Filling: Kläger, Beklagter, Kündigungsdatum, Kündigungsgrund, Zugang
  → muster_chunks: Top-5 KSchG-Klagemuster
  → law_chunks: §§ KSchG, ArbGG Zuständigkeit
  → urteil_chunks: aktuelle BAG-Rspr. zu Kündigungsschutz
  → kosten_rules: Streitwert (3 Bruttomonatsgehälter), RVG-Gebühren
  → Output-Assembler: Schema befüllen
  → ERV/beA-Validator: Format prüfen
```

**Schrittreihenfolge (fix):**
1. Intake/Slot-Filling (Pflichtfelder klären — fehlende → Rückfrage)
2. Muster-Chunks retrieven (Top-k, Hybrid Search)
3. Normen laden (verknüpfte Akte-Normen zuerst, dann automatisch Top-k)
4. Urteile laden (Top-k + PII-Check-Flag prüfen)
5. Kosten-Regeln anwenden (deterministisch)
6. Output-Assembler
7. ERV/beA-Validator

**Konfliktauflösung:** Akte-verknüpfte Normen > automatisch retrievte Normen > LLM-Basiswissen

**Erklärbarkeit:** jede Antwort enthält `retrieval_belege[]` (welche Chunks genutzt wurden)

---

### 2. Schriftsatz-Zwischenformat (YAML/JSON-Schema)

Kein direktes "LLM gibt Markdown aus" — erst strukturiertes Intermediate, dann Rendering:

```typescript
interface SchriftsatzSchema {
  meta: {
    verfahrensart: string        // "KSchG-Klage" | "Mahnung" | "EV-Antrag" | ...
    gerichtszweig: string        // "Arbeitsgericht" | "Amtsgericht" | ...
    instanz: string              // "1. Instanz" | "Berufung" | ...
    erstellt_am: string
    quellen: RetrievalBeleg[]    // Audit-Trail
  }
  rubrum: {
    klaeger: Partei
    beklagter: Partei
    gericht: string
    aktenzeichen?: string
  }
  antraege: Antrag[]             // Pflicht — Fehlen = Validator-Fehler
  sachverhalt: Abschnitt[]
  rechtliche_wuerdigung: Abschnitt[]
  beweisangebote: Beweisangebot[]
  anlagen: Anlage[]              // mit Nummerierung K 1, K 2, ...
  kosten: {
    streitwert: number
    gerichtskosten: number
    anwaltskosten: number
    berechnung_quelle: string    // welche GKG/RVG-Regel
  }
  formales: {
    erv_validiert: boolean
    pdf_a_konform: boolean
    signatur_erforderlich: boolean
    warnungen: string[]
  }
}
```

---

### 3. Platzhalter-Standard

Einheitliche Benennung über alle Muster, Formulare, Output:
- `{{Kläger_Name}}`, `{{Kläger_Anschrift}}`, `{{Beklagter_Name}}`
- `{{Kündigungsdatum}}`, `{{Kündigungsgrund}}`, `{{Kündigungszugang}}`
- `{{Anlage_K1}}`, `{{Anlage_K2}}`
- `{{Streitwert_EUR}}`, `{{Gerichtsstand}}`

Typen: string | date | currency | reference — mit Pflicht/optional-Flag

---

### 4. ERV/beA-Validator (Ausgabe-Nachprüfung)

Regel-JSON `src/lib/helena/erv-rules.json`:
- PDF/A-Versionen je Gericht/Bundesland
- Dateigrößen-Limits
- Signaturpflicht (qualifiziert vs. einfach)
- Übermittlungsweg (beA → EGVP, Ausnahmen)

Validator läuft als letzter Schritt, gibt `warnungen[]` aus (kein Hard-Fail, nur markieren).
