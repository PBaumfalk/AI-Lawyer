# Requirements: AI-Lawyer

**Defined:** 2026-02-27
**Core Value:** Ein Anwalt kann Akten, Dokumente, Fristen, E-Mails und Finanzen vollständig im Browser verwalten, während eine proaktive KI-Agentin aktenübergreifend lernt, automatisch Entwürfe erstellt, Fristen erkennt und als digitale Rechtsanwaltsfachangestellte mitarbeitet — ohne dass KI-generierte Inhalte jemals automatisch versendet werden.

## v1 Requirements

Requirements für v0.1 Helena RAG. Jede Anforderung mapped auf eine Roadmap-Phase.

### RAG Pipeline Quality

- [ ] **RAGQ-01**: Hybrid Search — Helenas Retrieval kombiniert Meilisearch BM25 und pgvector cosine via Reciprocal Rank Fusion (RRF, k=60) mit je N=50 Kandidaten pro Quelle
- [ ] **RAGQ-02**: Parent-Child Chunking — Dokumente werden in 500-Token Kind-Chunks (Embedding/Retrieval) und 2.000-Token Parent-Chunks (LLM-Prompt-Kontext) aufgeteilt; bestehende document_chunks erhalten chunkType-Enum (STANDALONE/PARENT/CHILD)
- [ ] **RAGQ-03**: Cross-Encoder Reranking — Top-50 RRF-Ergebnisse werden via Ollama auf Top-10 reranked; Fallback auf RRF-Reihenfolge wenn P95-Latenz > 3s oder Ollama-Fehler

### Gesetze-RAG

- [ ] **GESETZ-01**: Bundesgesetze aus bundestag/gesetze GitHub-Repo in eigene `law_chunks`-Tabelle ingested (hierarchisch nach §/Absatz, Metadaten: gesetz, paragraf, absatz, stand, quelle_url); HNSW-Index auf embedding-Spalte
- [ ] **GESETZ-02**: Täglicher automatischer Sync (BullMQ cron 02:00 Europe/Berlin) — geänderte Dateien werden erkannt und re-indexiert; Encoding-Smoke-Test (§-Zeichen) als ersten Ingestion-Schritt
- [ ] **GESETZ-03**: Helena retrievet automatisch Top-5 Normen-Chunks bei Anfragen mit Rechtsbezug; jede Norm wird mit "nicht amtlich — Stand: [Datum]"-Hinweis und Quellenlink zitiert
- [ ] **GESETZ-04**: Nutzer kann §§ strukturiert an Akte verknüpfen — Suchmodal über law_chunks, Hinzufügen mit optionaler Notiz, Anzeige als Chip-Liste in Akte-Detailseite; pinned Normen werden in Helenas System-Kontext für die Akte injiziert

### Urteile-RAG

- [ ] **URTEIL-01**: BMJ Rechtsprechung-im-Internet in eigene `urteil_chunks`-Tabelle ingested (alle 7 Bundesgerichts-RSS-Feeds: BGH, BAG, BVerwG, BFH, BSG, BPatG, BVerfG); HNSW-Index auf embedding-Spalte
- [ ] **URTEIL-02**: BAG RSS-Feed als täglicher inkrementeller Update-Kanal für Arbeitsrecht-Entscheidungen
- [ ] **URTEIL-03**: NER-basierter PII-Filter via Ollama (5+ German-Legal-Few-Shot-Beispiele + Institution-Whitelist-Regex für Gerichtsnamen) — nur Urteile mit `pii_geprueft: true` werden indexiert
- [ ] **URTEIL-04**: Helena zitiert Urteile immer mit Gericht + AZ + Datum + Leitsatz-Snippet + Quellenlink; AZ kommen ausschließlich aus `urteil_chunks.citation`-Metadaten (nie LLM-generiert)

### Arbeitswissen-RAG

- [ ] **ARBW-01**: Amtliche Formulare (BMJ-Vordrucke, Arbeitsgerichts-Vordrucke, Mahnformulare) in eigene `muster_chunks`-Tabelle ingested; Platzhalter normiert (`{{KLAEGER_NAME}}`, `{{KUENDIGUNGSDATUM}}` etc.)
- [ ] **ARBW-02**: Admin-UI unter `/admin/muster` für Upload kanzlei-eigener Schriftsatzmuster (DOCX/PDF → MinIO `muster-uploads/`, nie in Git); shadcn/ui Dateitabelle mit NER-Status-Spalte
- [ ] **ARBW-03**: PII-Anonymisierung vor Ingestion kanzlei-eigener Muster via Ollama NER (identisches Modul wie URTEIL-03); Status-Machine `PENDING_NER → NER_RUNNING → INDEXED | REJECTED_PII_DETECTED` — kein Bypass-Pfad (BRAO §43a)
- [ ] **ARBW-04**: Kanzlei-eigene Muster erhalten höchsten Retrieval-Boost (über öffentliche Formulare); Schriftsatz-Relevanz-Score in Metadaten
- [ ] **ARBW-05**: Helena erstellt strukturierte Schriftsatz-Entwürfe (Rubrum, Anträge, Begründung mit Platzhaltern) aus muster_chunks + relevanten law_chunks + urteil_chunks + Akten-Kontext; Ausgabe immer als ENTWURF mit expliziten `{{PLATZHALTER}}`

## v2 Requirements

Deferred. Nicht in v0.1 Roadmap.

### RAG Qualität (v0.2+)

- **RAGQ-04**: Abbreviation Expansion vor Embedding (iVm → "in Verbindung mit", aF/nF/idF) für bessere Semantic-Retrieval-Qualität
- **RAGQ-05**: Schriftsatz-Modus: Vollständige KSchG-Klage, einstweilige Verfügung als generierter Entwurf nach ARBW-05-Basis-Schriftsätzen

### Urteile (v0.2+)

- **URTEIL-05**: Open Legal Data API oder openJur als zusätzliche Urteile-Quelle (nach Validierung des PII-Filters)
- **URTEIL-06**: OLG-Entscheidungen (nicht-Bundesgerichte) über Länder-Justizportale

### Wissensquellen (v0.2+)

- **ARBW-06**: GKG/RVG-Kostenregeln als strukturierter Regel-JSON für Helena (ergänzt bestehenden RVG-Kalkulatur)
- **ARBW-07**: ERV/beA Ausgabe-Validator — Prüfung von Helena-Ausgaben gegen Formvorschriften

### Falldatenblätter / BI / Export (aus v3.5)

- **FD-01** bis **FD-04**: Falldatenblatt-Framework — Rechtsgebiet-spezifische Feldschemas
- **BI-01** bis **BI-05**: BI-Dashboard KPI-Kacheln
- **EXP-01** bis **EXP-04**: CSV/XLSX Export

## Out of Scope

Explicitly excluded for v0.1.

| Feature | Reason |
|---------|--------|
| §§ Knowledge Graph / Verweisketten | Multi-Monats-Projekt, kein Mehrwert für core Retrieval |
| juris / beck-online Integration | Lizenzkosten + kein öffentliches API |
| Automatische Sachverhalt-Generierung | Halluzinationsrisiko zu hoch für juristische Narrative |
| Qwen3-Reranker-4B als dedizierter Reranker | Availability in aktueller Ollama-Version unverified; Option A (qwen3.5:35b LLM-as-reranker) ist validated |
| Cross-Encoder via ONNX/@xenova/transformers | Nur als Fallback wenn Option A P95 > 3s — kein Scope-Creep |
| DSGVO Verarbeitungsverzeichnis-Eintrag | Prozess-Gap, nicht Code — außerhalb GSD-Scope |

## Traceability

Welche Phasen welche Anforderungen abdecken.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RAGQ-01 | Phase 13 | Pending |
| RAGQ-02 | Phase 12 | Pending |
| RAGQ-03 | Phase 13 | Pending |
| GESETZ-01 | Phase 14 | Pending |
| GESETZ-02 | Phase 14 | Pending |
| GESETZ-03 | Phase 14 | Pending |
| GESETZ-04 | Phase 15 | Pending |
| URTEIL-01 | Phase 17 | Pending |
| URTEIL-02 | Phase 17 | Pending |
| URTEIL-03 | Phase 16 | Pending |
| URTEIL-04 | Phase 17 | Pending |
| ARBW-01 | Phase 18 | Pending |
| ARBW-02 | Phase 18 | Pending |
| ARBW-03 | Phase 16 | Pending |
| ARBW-04 | Phase 18 | Pending |
| ARBW-05 | Phase 18 | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-02-27*
*Last updated: 2026-02-27 — traceability filled by roadmapper*
