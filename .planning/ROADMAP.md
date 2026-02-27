# Roadmap: AI-Lawyer

## Milestones

- ✅ **v3.4 Full-Featured Kanzleisoftware** — Phases 1-9 (shipped 2026-02-25)
- ✅ **v3.5 Production Ready** — Phases 10-11 (shipped 2026-02-26)
- 🚧 **v0.1 Helena RAG** — Phases 12-18 (in progress)

## Phases

<details>
<summary>v3.4 Full-Featured Kanzleisoftware (Phases 1-9) -- SHIPPED 2012-02-25</summary>

- [x] Phase 1: Infrastructure Foundation (3/3 plans) -- completed 2012-02-24
- [x] Phase 2: Deadline Calculation + Document Templates (6/6 plans) -- completed 2012-02-24
- [x] Phase 2.1: Wire Frist-Reminder Pipeline + Settings Init (1/1 plan) -- completed 2012-02-24
- [x] Phase 2.2: Fix API Routes + UI Paths (1/1 plan) -- completed 2012-02-24
- [x] Phase 3: Email Client (4/4 plans) -- completed 2012-02-24
- [x] Phase 3.1: Wire Email Real-Time + Compose Integration (1/1 plan) -- completed 2012-02-24
- [x] Phase 4: Document Pipeline (OCR + RAG Ingestion) (3/3 plans) -- completed 2012-02-24
- [x] Phase 4.1: Wire Akte Real-Time + Email Compose + Admin Pipeline (1/1 plan) -- completed 2012-02-24
- [x] Phase 5: Financial Module (6/6 plans) -- completed 2012-02-24
- [x] Phase 6: AI Features + beA (5/5 plans) -- completed 2012-02-25
- [x] Phase 7: Rollen/Sicherheit + Compliance + Observability (3/3 plans) -- completed 2012-02-25
- [x] Phase 8: Integration Hardening (3/3 plans) -- completed 2012-02-25
- [x] Phase 9: Final Integration Wiring + Tech Debt (1/1 plan) -- completed 2012-02-25

**Total: 13 phases, 38 plans, 105 tasks, 64/64 requirements**

See: `milestones/v3.4-ROADMAP.md` for full phase details.

</details>

<details>
<summary>✅ v3.5 Production Ready (Phases 10-11) — SHIPPED 2026-02-26</summary>

- [x] Phase 10: Docker Build Fix (3/3 plans) — completed 2026-02-25
- [x] Phase 11: Glass UI Migration (7/7 plans) — completed 2026-02-26

**Total: 2 phases, 10 plans**

See: `milestones/v3.5-ROADMAP.md` for full phase details.

</details>

### 🚧 v0.1 Helena RAG (In Progress)

**Milestone Goal:** Helena mit drei Wissensquellen ausstatten (Gesetze, Urteile, Schriftsatzmuster) und die RAG-Pipeline durch Hybrid Search, Parent-Child Chunking und Cross-Encoder Reranking auf NotebookLM-Qualität heben.

- [x] **Phase 12: RAG Schema Foundation** — Prisma-Migrationen für LawChunk, UrteilChunk, Muster, MusterChunk, AkteNorm; chunkType-Enum und parentChunkId auf DocumentChunk; HNSW-Indexes (completed 2026-02-26)
- [ ] **Phase 13: Hybrid Search + Reranking** — RRF-Fusion (Meilisearch BM25 + pgvector) mit k=60, Cross-Encoder Reranking via Ollama, Parent-Child Chunker; ki-chat-Route auf hybridSearch umgestellt
- [ ] **Phase 14: Gesetze-RAG** — bundestag/gesetze GitHub-Sync in law_chunks, täglicher BullMQ-Cron, Encoding-Smoke-Test; Helena retrievet automatisch Top-5 Normen bei Rechtsfragen
- [ ] **Phase 15: Normen-Verknüpfung in Akte** — AkteNorm-API, Norm-Suchmodal in Akte-Detailseite, Chip-Liste, pinned Normen in Helenas System-Kontext
- [ ] **Phase 16: PII-Filter** — Regex + Ollama NER (5+ Few-Shot-Beispiele, Institution-Whitelist), Acceptance-Test auf 10 echten Gerichtsentscheidungen; Status-Machine PENDING_NER → INDEXED | REJECTED
- [ ] **Phase 17: Urteile-RAG** — BMJ-Scraper für 7 Bundesgerichte, BAG RSS-Feed, urteil_chunks mit PII-Gate; Helena zitiert Urteile mit Gericht + AZ + Datum + Quellenlink
- [ ] **Phase 18: Muster-RAG + Admin Upload UI** — Amtliche Formulare in muster_chunks, Admin-UI /admin/muster, PII-Gate für kanzlei-eigene Muster, Retrieval-Boost, Helena Schriftsatz-Entwurf

## Phase Details

### Phase 12: RAG Schema Foundation
**Goal**: Die Datenbankstruktur für alle drei Wissensquellen und Parent-Child-Chunking existiert und ist produktionsbereit — alle nachfolgenden Phasen können Daten schreiben ohne Schema-Konflikte
**Depends on**: Phase 11
**Requirements**: RAGQ-02
**Success Criteria** (what must be TRUE):
  1. `prisma migrate deploy` läuft fehlerfrei durch — neue Tabellen LawChunk, UrteilChunk, Muster, MusterChunk, AkteNorm sind in der DB angelegt
  2. Bestehende DocumentChunk-Zeilen haben chunkType = STANDALONE — kein NULL-Zustand, keine broken Retrieval-JOINs
  3. HNSW-Index auf embedding-Spalte jeder neuen Chunk-Tabelle existiert — `EXPLAIN ANALYZE` zeigt Index-Scan, keinen Seq-Scan
  4. Prisma-Client ist generiert — TypeScript kennt alle neuen Models ohne Laufzeitfehler
**Plans**: 1 plan

Plans:
- [ ] 12-01-PLAN.md — Schema changes (5 new models + DocumentChunk extension) + Prisma migration + HNSW indexes

### Phase 13: Hybrid Search + Reranking
**Goal**: Helenas Retrieval kombiniert BM25 und Vector-Suche via RRF und reranked mit Cross-Encoder — messbar bessere Antwortqualität bei bestehenden Akten-Dokumenten, bevor neue Wissensquellen befüllt werden
**Depends on**: Phase 12
**Requirements**: RAGQ-01, RAGQ-03
**Success Criteria** (what must be TRUE):
  1. Helena-Antworten im ki-chat enthalten Quellen aus sowohl Meilisearch-BM25 als auch pgvector-Cosine — RRF-Fusion ist aktiv
  2. Exakte §-Nummern und Aktenzeichen-Strings aus Dokumenten werden korrekt retrieved — BM25-Beitrag ist nachweisbar
  3. Reranking reduziert den Kandidaten-Pool auf Top-10 — bei P95-Latenz > 3s fällt das System automatisch auf RRF-Reihenfolge zurück ohne Fehler
  4. Parent-Chunk-Inhalt (2.000 Token) wird als LLM-Kontext übergeben, Kind-Chunk (500 Token) als Retrieval-Unit — Antworten enthalten vollständige §-Absätze, keine abgeschnittenen Fragmente
**Plans**: 3 plans

Plans:
- [ ] 13-01-PLAN.md — New library files: reranker.ts (Ollama batch reranker + RrfCandidate) + hybrid-search.ts (RRF orchestrator + hybridSearch)
- [ ] 13-02-PLAN.md — Upgrade chunker.ts (chunkDocumentParentChild) + vector-store.ts (insertParentChildChunks, fetchParentContent, updated searchSimilar)
- [ ] 13-03-PLAN.md — Wire embedding.processor.ts (parent-child pipeline) + ki-chat/route.ts (hybridSearch + contextContent)

### Phase 14: Gesetze-RAG
**Goal**: Bundesgesetze aus bundestag/gesetze sind in law_chunks indiziert und werden täglich aktualisiert — Helena kann Rechtsfragen mit verifizierten Normen statt LLM-Trainingsdaten beantworten
**Depends on**: Phase 13
**Requirements**: GESETZ-01, GESETZ-02, GESETZ-03
**Success Criteria** (what must be TRUE):
  1. law_chunks enthält indexierte Bundesgesetz-Paragraphen — eine Anfrage an Helena zu "§ 626 BGB" liefert den korrekten Norm-Text als Quelle zurück
  2. BullMQ-Cron läuft täglich um 02:00 Europe/Berlin — geänderte Gesetze werden re-indexiert, unveränderte übersprungen
  3. Encoding-Smoke-Test schlägt an vor der Ingestion wenn §-Zeichen als "Â§" erscheinen — fehlerhafte Dateien werden übersprungen, kein Silent-Corrupt-Data
  4. Jede zitierte Norm in einer Helena-Antwort trägt den Hinweis "nicht amtlich — Stand: [Datum]" und einen Quellenlink zur Gesetzesstelle
**Plans**: TBD

### Phase 15: Normen-Verknüpfung in Akte
**Goal**: Anwälte können §§ strukturiert an Akten pinnen — pinned Normen fließen automatisch in Helenas System-Kontext für genau diese Akte ein
**Depends on**: Phase 14
**Requirements**: GESETZ-04
**Success Criteria** (what must be TRUE):
  1. Über ein Suchmodal in der Akte-Detailseite kann ein Anwalt eine Norm aus law_chunks suchen und mit optionaler Notiz zur Akte hinzufügen
  2. Hinzugefügte Normen erscheinen als Chip-Liste in der Akte-Detailseite — per Klick öffnet sich die Normdetail-Ansicht
  3. Helenas Antworten im Akte-Kontext referenzieren pinned Normen bevorzugt — der System-Prompt enthält den Norm-Text der gepinnten §§
  4. Normen können aus der Akte entfernt werden — der System-Kontext aktualisiert sich sofort
**Plans**: TBD

### Phase 16: PII-Filter
**Goal**: Ein Ollama-NER-basierter PII-Filter ist implementiert und acceptance-getestet — Gerichtsentscheidungen und kanzlei-eigene Muster können DSGVO-konform indexiert werden
**Depends on**: Phase 12
**Requirements**: URTEIL-03, ARBW-03
**Success Criteria** (what must be TRUE):
  1. Der PII-Filter verarbeitet 10 bekannte Gerichtsentscheidungen: 0 Institutionsnamen (Bundesgerichtshof, Amtsgericht Köln etc.) werden fälschlicherweise redaktiert
  2. Vollständige Personennamen (Kläger, Beklagte) aus echten Urteilen überstehen den Filter nicht — kein unredaktiertes Klarname-Fragment gelangt in die Embedding-Pipeline
  3. Die Status-Machine PENDING_NER → NER_RUNNING → INDEXED | REJECTED_PII_DETECTED existiert — kein Bypass-Pfad führt zu pgvector ohne NER_COMPLETE-Zustand
  4. Bei Ollama-Timeout (> 45s) schlägt der Job fehl und bleibt auf PENDING_NER — keine Silent-Indexierung ohne PII-Prüfung
**Plans**: TBD

### Phase 17: Urteile-RAG
**Goal**: Entscheidungen aller 7 Bundesgerichte und BAG-RSS-Updates sind PII-gefiltert in urteil_chunks indiziert — Helena zitiert Urteile nur aus verifizierten Metadaten, nie aus LLM-Imagination
**Depends on**: Phase 16
**Requirements**: URTEIL-01, URTEIL-02, URTEIL-04
**Success Criteria** (what must be TRUE):
  1. urteil_chunks ist mit Entscheidungen aus den 7 BMJ-RSS-Feeds befüllt — eine Arbeitsrecht-Frage an Helena liefert mindestens ein BAG-Urteil als Quelle
  2. BAG RSS-Feed wird täglich inkrementell verarbeitet — neue Entscheidungen erscheinen ohne manuellen Eingriff in urteil_chunks
  3. Jedes Helena-Zitat eines Urteils enthält Gericht + Aktenzeichen + Datum + Leitsatz-Snippet + Quellenlink — kein einziges AZ ist LLM-generiert (alle kommen aus urteil_chunks.citation)
  4. Kein Urteil mit pii_geprueft = false ist in urteil_chunks — die PII-Gate-Invariante hält über alle Ingestion-Pfade
**Plans**: TBD

### Phase 18: Muster-RAG + Admin Upload UI
**Goal**: Amtliche Formulare und kanzlei-eigene Schriftsatzmuster sind in muster_chunks indiziert — Helena erstellt strukturierte Schriftsatz-Entwürfe aus dem Kanzlei-Wissen, niemals als fertiges Dokument
**Depends on**: Phase 16
**Requirements**: ARBW-01, ARBW-02, ARBW-03, ARBW-04, ARBW-05
**Success Criteria** (what must be TRUE):
  1. muster_chunks enthält normierte amtliche Formulare mit einheitlichen Platzhaltern ({{KLAEGER_NAME}} etc.) — Helena schlägt bei passenden Anfragen das korrekte Formular vor
  2. Ein Admin kann unter /admin/muster eine DOCX- oder PDF-Datei hochladen — die Datei landet in MinIO und der NER-Status (PENDING / NER_RUNNING / INDEXED / REJECTED) ist in der Dateitabelle sichtbar
  3. Kanzlei-eigene Muster erhalten einen messbaren Retrieval-Boost über öffentliche Formulare — kanzleispezifische Schriftsätze erscheinen bei Arbeitsrecht-Anfragen vor generischen Vordrucken
  4. Kein kanzlei-eigenes Muster mit unredaktierten Mandantendaten gelangt in pgvector — REJECTED_PII_DETECTED-Status verhindert die Indexierung ohne Bypass-Möglichkeit
  5. Helena liefert Schriftsatz-Entwürfe mit Rubrum, Anträgen und Begründung — der Output enthält explizite {{PLATZHALTER}} und ist als ENTWURF markiert, niemals als fertiger Schriftsatz
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 12 → 13 → 14 → 15 → 16 → 17 → 18
Note: Phase 16 (PII-Filter) depends on Phase 12, not 15. Phases 14-15 and 16 can be sequenced as 12 → 13 → 14 → 15 → 16 → 17 → 18.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 12. RAG Schema Foundation | 1/1 | Complete    | 2026-02-26 | - |
| 13. Hybrid Search + Reranking | 2/3 | In Progress|  | - |
| 14. Gesetze-RAG | v0.1 | 0/TBD | Not started | - |
| 15. Normen-Verknüpfung in Akte | v0.1 | 0/TBD | Not started | - |
| 16. PII-Filter | v0.1 | 0/TBD | Not started | - |
| 17. Urteile-RAG | v0.1 | 0/TBD | Not started | - |
| 18. Muster-RAG + Admin Upload UI | v0.1 | 0/TBD | Not started | - |
