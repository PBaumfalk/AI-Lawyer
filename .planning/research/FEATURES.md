# Feature Research

**Domain:** Legal RAG — Helena KI-Agentin v0.1 (Hybrid Search, Knowledge Sources, German Law UX)
**Researched:** 2026-02-27
**Confidence:** MEDIUM — pipeline patterns HIGH from multiple authoritative sources; German legal UX patterns MEDIUM from citation standards + court case evidence; cross-encoder German model availability LOW (needs verification)

---

## Context: What Already Exists (Do Not Rebuild)

This is research for a SUBSEQUENT MILESTONE adding to an existing ~91,300-LOC codebase. The following is already shipped:

- Helena proactive agent with document RAG (pgvector, multilingual-e5-large-instruct)
- Current RAG: top-10 cosine similarity, 1000-char chunks → LLM prompt (no hybrid, no reranking)
- Meilisearch full-text search (case documents already indexed)
- Multi-provider AI (Ollama qwen3.5:35b / OpenAI / Anthropic) via Vercel AI SDK v4
- BullMQ async processing pipeline with daily cron support
- KI-Entwurf workflow: all AI output = ENTWURF status, human approval required before any action
- Quellennachweise on AI answers (document + paragraph, already displayed)

New features must integrate into this existing infrastructure — not replace it.

---

## Feature Landscape

### Category A: RAG Pipeline Quality (Internal — lawyers see better answers, not the mechanism)

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Accurate §-number exact-match retrieval | Lawyers query "Was sagt § 626 BGB?" — pure semantic fails on exact statutory references | MEDIUM | Current cosine-only misses AZ lookups like "3 AZR 123/22"; BM25 via Meilisearch already exists |
| Source attribution on every AI claim | BRAO §43a — lawyer must verify before using AI output; without source, output is unusable | LOW | Already partially shipped; must extend to new knowledge sources (law_chunks, urteil_chunks) |
| "Nicht amtlich" disclaimer on cited norms | gesetze-im-internet.de uses this standard wording; lawyers recognize it as appropriate caveat | LOW | BMJV precedent: "Nicht amtlich konsolidiert. Maßgeblich ist die im BGBl. veröffentlichte Fassung." |
| "Stand: [Datum]" on retrieved norm text | Lawyer must know if they are looking at current or outdated law text | LOW | Store sync_date on law_chunks; display alongside norm citation |

#### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Hybrid Search (Meilisearch BM25 + pgvector via RRF) | Legal text has exact statutory references (§ 626 BGB, AZ 3 AZR 123/22) that pure semantic misses; hybrid catches both modes | MEDIUM | RRF merge function in retrieval service; alpha ≈ 0.4 (60% BM25 / 40% dense) as legal-domain starting point; tune with labeled validation queries |
| Parent-Child Chunking (400-512 token child / 1500-2000 token parent) | Child retrieved with precision, parent returned to LLM for full context; prevents truncated §§ or Urteil sections | MEDIUM | Requires schema change (parent_chunk_id FK on doc_chunks + law_chunks + urteil_chunks); re-ingestion BullMQ job for existing documents |
| Cross-Encoder Reranking via local model | +33-40% retrieval accuracy per research; adds 200-400ms — acceptable since LLM generation is already 2-8s | HIGH | Ollama cross-encoder availability as of early 2026 limited; may require direct HuggingFace HTTP inference; German multilingual model preferred over English ms-marco |

#### Anti-Features (Do Not Build)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Cross-encoder via external Cohere/OpenAI Rerank API | Simplest path to quality reranking | Client data leaves premises → DSGVO violation; breaks self-hosted principle | Local Ollama or HuggingFace inference only |
| LLM-as-Reranker (GPT-4 scoring each retrieved chunk) | Highest theoretical accuracy | 10-50x token cost per query; adds 3-8s latency; overkill when cross-encoder achieves 40% gain at fraction of cost | Cross-encoder is the right tradeoff |
| Real-time norm fetch on every query (live Bundestag API) | Always-fresh law text | Latency-prohibitive; Bundestag API rate-limits at 25 concurrent; network failure blocks query | Daily BullMQ cron sync into law_chunks; show "Stand: [datum]" |

---

### Category B: German Legal Knowledge Sources

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Gesetze-RAG (bundestag/gesetze → law_chunks) | Lawyers ask "Was sagt § X Y?" constantly; Helena answering from training data = hallucination risk | HIGH | bundestag/gesetze GitHub repo is public domain, actively maintained, XML format parseable by Absatz; daily BullMQ cron sync |
| Urteile-RAG with NER PII-filter | Lawyers in Arbeitsrecht/Strafrecht need case law citations; BAG/BGH decisions must come from real sources, not LLM fabrication | HIGH | NER pass via Ollama required BEFORE embedding — DSGVO Art. 9 + BDSG §22 apply to names in decisions; Frankfurt court Sept 2025 case of fabricated BGH citations = live liability risk |
| Arbeitswissen-RAG (amtliche Formulare + kanzlei-eigene Muster) | Kanzlei-specific workflow knowledge enables Helena to draft from actual firm templates rather than generic patterns | MEDIUM | Admin-upload UI to MinIO; PII-anonymization pass (remove real client names from old Schriftsätze used as Muster) before embedding |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Normen-Verknüpfung in Akte (pin §§ to a case) | Lawyer pins "§ 626 BGB" to a case → Helena automatically uses pinned norms as grounding context for this case's questions; prevents Helena from retrieving irrelevant norms | MEDIUM | New Prisma model AkteNorm; UI: search modal over law_chunks → one-click add; pinned norms injected into Helena system context per Akte |
| Schriftsatz-Entwurf from Muster (Helena draft mode) | Helena produces structured Klageschrift sections from firm templates + Akte facts — saves 2-4 hours per draft | HIGH | Depends on seeded muster_chunks; output is ENTWURF with explicit placeholders; section-by-section outline safer than single-pass prose for Sachverhalt (hallucination risk) |
| BAG RSS incremental sync for Arbeitsrecht | Latest BAG decisions ingested automatically; relevant for Kanzlei Baumfalk's Arbeitsrecht focus | LOW | RSS feed parsing in BullMQ cron; de-duplicate by AZ before embedding |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full German case law mirror (juris/beck-online import) | Comprehensive coverage sounds valuable | Terabytes of data; commercial licensing required for juris/beck; PII at scale requires industrial NER; ingestion cost unrealistic for self-hosted | BMJ Rechtsprechung-im-Internet (public domain, manageable volume) is sufficient |
| Auto-generated Schriftsatz sent to beA without review | Maximum automation | Absolute No-Go per BRAK 2025; BRAO §43 professional responsibility lies with Anwalt; Frankfurt court Sept 2025 found lawyer liable for AI-hallucinated BGH citations in submission | ENTWURF workflow already enforced; Anwalt must promote to FREIGEGEBEN before beA send |
| §§ Knowledge Graph (Verweisketten, BGB→HGB→ZPO cross-refs) | Deep legal intelligence | Building + maintaining a full cross-reference graph is a separate multi-month project; not needed for basic norm retrieval | Normen-Verknüpfung in Akte covers the practical use case |
| Real-time citation verification against live juris/beck API | Safety net for hallucinations | No public API; commercial licensing; breaks self-hosted principle | Retrieval-grounded-only citations from law_chunks/urteil_chunks; "Nicht amtlich" disclaimer for transparency |

---

### Category C: Legal UX — Citation Display and Workflow

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Norm display with § number, law abbreviation, Absatz text, Stand-datum | Standard legal reference format; lawyers recognize "§ 626 BGB Abs. 1" immediately | LOW | Display as structured card, not raw text; include Stand date |
| Urteil citation with Gericht + AZ + Datum + Leitsatz snippet | NJW house style is the de facto German legal citation standard; Gericht abbreviation + Entscheidungsart + Datum + AZ | LOW | Format: "BAG, Urteil v. 25.04.2023 – 2 AZR 234/22"; AZ MUST be verbatim from retrieved chunk, never LLM-generated |
| "KI-Treffer prüfen" warning on all retrieved legal sources | Lawyers have professional duty to verify (BRAO §43a); recent court cases show AI citation liability risk is real | LOW | Already have ENTWURF badge system; extend to citation cards |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "Zur Akte hinzufügen" one-click from norm/Urteil card | Frictionless workflow: lawyer finds relevant § → one click → pinned to Akte; no copy-paste needed | LOW | Calls AkteNorm create endpoint; updates Normen widget in Akte detail |
| Helena auto-suggest norms for Akte based on Rechtsgebiet | When lawyer opens Akte, Helena proactively suggests "Folgende Normen könnten relevant sein: § 626 BGB, § 1 KSchG" based on Rechtsgebiet field | MEDIUM | Triggered on Akte open; lightweight retrieval from law_chunks using Rechtsgebiet as query; not full RAG chain |
| Structured Schriftsatz outline with explicit placeholders | Helena output has `[MANDANT_NAME]`, `[SACHVERHALT_DATUM]` etc. clearly marked — lawyer knows exactly what to fill in | LOW | Prompt engineering in Helena Schriftsatz mode; section headers matching ZPO §253 structure |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-populate Sachverhalt section from Akte facts | Full automation appeals | Sachverhalt in a Schriftsatz is a curated legal narrative — LLM-generated facts can subtly misstate dates, amounts, party names; lawyer liability if wrong | Outline with bullet-point prompts + explicit placeholders; lawyer writes the narrative using Helena's structure |
| Display raw Urteil full-text inline in chat | Complete information | Long Urteile (10-30 pages) destroy chat readability; overwhelming for lawyer | Leitsatz snippet + "Volltext" button linking to BMJ source URL |

---

## Feature Dependencies

```
[Hybrid Search RRF]
    requires --> [Meilisearch BM25 results] (already exists)
    requires --> [pgvector cosine results] (already exists)
    requires --> [RRF merge function in retrieval service] (NEW)

[Parent-Child Chunking]
    requires --> [Schema: parent_chunk_id on doc_chunks/law_chunks/urteil_chunks] (NEW Prisma model)
    requires --> [Re-ingestion pipeline for existing documents] (NEW BullMQ job)
    requires --> [Retrieval service: fetch parent after child match] (NEW)

[Cross-Encoder Reranking]
    requires --> [Hybrid Search — diverse candidate pool ≥20] (must come first)
    requires --> [German multilingual cross-encoder model available locally] (NEEDS VERIFICATION)

[Gesetze-RAG]
    requires --> [bundestag/gesetze sync BullMQ cron] (NEW)
    requires --> [law_chunks Prisma model] (NEW)
    requires --> [XML parser for Absatz structure] (NEW)
    requires --> [Embedding pipeline extended to law_chunks] (extends existing)

[Urteile-RAG]
    requires --> [BMJ scraper / BAG RSS parser] (NEW)
    requires --> [NER PII-filter via Ollama BEFORE ingestion] (NEW — non-negotiable blocker)
    requires --> [urteil_chunks Prisma model] (NEW)

[Arbeitswissen-RAG]
    requires --> [Admin-Upload UI to MinIO] (NEW)
    requires --> [muster_chunks Prisma model] (NEW)
    requires --> [PII-anonymization pass on old Schriftsätze] (NEW)

[Normen-Verknüpfung in Akte]
    requires --> [Gesetze-RAG] (law_chunks must be seeded for norm search)
    requires --> [AkteNorm Prisma model] (NEW)
    requires --> [Akte-Detail UI: Normen widget] (NEW)

[Helena auto-suggest Normen]
    requires --> [Gesetze-RAG] (source data)
    requires --> [Normen-Verknüpfung in Akte] (storage target)

[Schriftsatz-Entwurf (Helena mode)]
    requires --> [Arbeitswissen-RAG seeded with actual Muster] (NEW — cannot draft from empty)
    requires --> [KI-Entwurf workflow] (already exists)
    requires --> [Helena Schriftsatz-Modus prompt] (NEW)
```

### Dependency Notes

- **Hybrid Search is the foundation** — every knowledge source (Gesetze, Urteile, Muster) benefits from BM25+semantic fusion. Build before knowledge sources are seeded.
- **Parent-Child Chunking is independent** of knowledge sources and can ship simultaneously — improves existing document RAG immediately.
- **Cross-Encoder Reranking must come after Hybrid Search** — applying reranking to 10 cosine-only results wastes latency without sufficient candidate diversity.
- **Urteile-RAG is blocked by NER PII-filter** — DSGVO requires pseudonymization before storing names from court decisions in pgvector. Do not ingest without this step.
- **Schriftsatz-Entwurf requires seeded muster_chunks** — Helena cannot draft from an empty collection. Admin-upload UI must be operational and templates uploaded before this feature is useful.
- **Normen-Verknüpfung blocks on Gesetze-RAG** — AkteNorm UI has no data to search without law_chunks populated.

---

## Technical Reference: Key Patterns

### Hybrid Search RRF

**Formula:** `RRF_score(d) = Σ 1/(k + rank_i(d))` where k=60 (standard constant, recommended by Elasticsearch)

**Weight for German legal text:** Start with alpha=0.4 (60% BM25, 40% dense). BM25 prioritized because exact statutory references (§ numbers, Aktenzeichen) must match precisely. Tune via labeled validation query set (10-20 representative queries from the firm).

**Implementation:** Meilisearch query returns ranked list A. pgvector query returns ranked list B. TypeScript RRF merge function in retrieval service. Feed merged top-N to LLM.

**Expected improvement:** Legal hybrid search documented at 87% of user-relevant documents in top 10 vs. lower for single-modality. (Source: ragaboutit.com 2025)

### Parent-Child Chunk Sizes for Legal Text

| Chunk Type | Tokens | Use |
|------------|--------|-----|
| Child (embedding) | 400-512 | High-precision retrieval; maps to individual Absatz or sentence cluster |
| Parent (LLM context) | 1500-2000 | Full §-Paragraph or Urteil-section; prevents truncated legal reasoning |
| Overlap on child | 10-20% | Preserves cross-reference context at chunk boundaries |

Legal documents benefit from larger overlap to preserve cross-references (source: unstructured.io chunking guide 2025).

### Cross-Encoder Latency Budget

| Stage | Latency |
|-------|---------|
| First-stage retrieval (hybrid) | 50-100ms |
| Cross-encoder reranking (50-100 candidates) | 200-400ms |
| LLM generation (qwen3.5:35b on GPU) | 2000-8000ms |
| **Total overhead from reranking** | ~5-15% |

Decision: Reranking overhead is acceptable given LLM generation dominates. Apply only after first-stage produces ≥20 diverse candidates.

### German Legal Citation Formats

**Norm (Gesetze):**
```
§ 626 BGB Abs. 1 — Fristlose Kündigung aus wichtigem Grund
Stand: 01.01.2025 | Quelle: bundestag/gesetze (nicht amtlich)
```

**Urteil:**
```
BAG, Urteil v. 25.04.2023 – 2 AZR 234/22
Bundesarbeitsgericht | Arbeitsrecht
Leitsatz: [first 2 sentences verbatim from retrieved chunk]
Quelle: rechtsprechung-im-internet.de
```

NJW (Neue Juristische Wochenschrift) house style is the de facto citation standard. Components: Gericht abbreviation + Entscheidungsart + Datum + Aktenzeichen. (Source: Wikipedia German legal citation; Harvard Law Library guide)

### Klageschrift Section Structure (ZPO §253)

Mandatory sections a complete Schriftsatz-Entwurf must address:
1. **Rubrum** — Gericht, Parteien (Kläger/Beklagter + Bevollmächtigte), Streitwert
2. **Anträge** — Hauptantrag + Hilfsanträge (precise wording matters for Rechtskraft)
3. **Sachverhalt** — Chronological facts (DO NOT auto-generate; use structured outline + placeholders)
4. **Rechtliche Würdigung** — §§ citations, subsumption, legal argument chain
5. **Beweisangebote** — Evidence list (Zeugen, Urkunden, Sachverständige per §§ 284-294 ZPO)
6. **Streitwertangabe** — For court fee calculation

---

## MVP Definition

### v0.1 Launch With

- [ ] **Hybrid Search RRF** — pipeline foundation; relatively self-contained; immediate quality improvement for existing document RAG
- [ ] **Parent-Child Chunking** — highest ROI for existing documents; schema + re-ingestion job; independent of knowledge sources
- [ ] **Gesetze-RAG** (bundestag/gesetze sync + law_chunks + embedding) — highest lawyer value; authoritative public-domain source; enables Normen-Verknüpfung
- [ ] **Normen-Verknüpfung in Akte** — depends on Gesetze-RAG; concrete lawyer workflow (search → add → display in Akte)
- [ ] **Urteile-RAG + NER PII-filter** — needed for Arbeitsrecht focus; NER-filter is non-negotiable before launch per DSGVO
- [ ] **Arbeitswissen-RAG + Admin-Upload UI** — enables Schriftsatz-Entwurf; MinIO upload + muster_chunks pipeline

### Add After Validation (v0.1.x)

- [ ] **Cross-Encoder Reranking** — validate German model quality first; add after hybrid search is stable baseline
- [ ] **Schriftsatz-Entwurf (Helena Schriftsatz-Modus)** — only useful after admin has seeded real firm templates
- [ ] **BAG RSS incremental sync** — low effort add-on after BMJ static sync proven; incremental Arbeitsrecht coverage
- [ ] **Helena auto-suggest Normen on Akte open** — UX polish; depends on Normen-Verknüpfung being used in practice first

### Future Consideration (v0.2+)

- [ ] **§§ Knowledge Graph / Verweisketten** — separate multi-month project; not needed for core use case
- [ ] **Commercial legal DB integration (juris, beck-online)** — licensing cost + no public API; only if BMJ coverage proves insufficient
- [ ] **Automated Sachverhalt generation** — requires higher LLM reliability than current state; revisit when hallucination rates demonstrably lower

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Hybrid Search RRF | HIGH | MEDIUM | P1 |
| Parent-Child Chunking | HIGH | MEDIUM | P1 |
| Gesetze-RAG (law_chunks + sync) | HIGH | HIGH | P1 |
| Normen-Verknüpfung in Akte | HIGH | MEDIUM | P1 |
| Urteile-RAG + NER PII-filter | HIGH | HIGH | P1 |
| Arbeitswissen-RAG + Admin-Upload | MEDIUM | MEDIUM | P1 |
| Cross-Encoder Reranking | MEDIUM | HIGH | P2 |
| Schriftsatz-Entwurf (Helena mode) | HIGH | HIGH | P2 |
| BAG RSS incremental sync | LOW | LOW | P2 |
| Helena auto-suggest Normen | MEDIUM | LOW | P2 |
| §§ Knowledge Graph | MEDIUM | VERY HIGH | P3 |

**Priority key:**
- P1: Must have for v0.1 launch
- P2: Add when P1 stable and validated
- P3: Future milestone

---

## Competitor Feature Analysis

| Feature | Noxtua (DE sovereign AI) | LexisNexis / Westlaw | Beck-online KI | Helena (this project) |
|---------|--------------------------|----------------------|----------------|----------------------|
| Gesetze-RAG | Yes (proprietary corpus) | Yes (licensed) | Yes (licensed) | bundestag/gesetze public domain, self-hosted |
| Urteil citation | Yes, with source links | Yes, verified corpus | Yes | BMJ public domain; strict retrieval-only (no hallucination) |
| Schriftsatz drafting | Structured outline | Limited | No | Section-by-section ENTWURF with placeholders (ZPO §253 structure) |
| Hybrid search | Unknown (proprietary) | Unknown | Unknown | RRF over Meilisearch + pgvector |
| DSGVO compliance | EU sovereign, certified | US-based, complex DPAs | German servers | Self-hosted, zero data egress |
| Hallucination safeguard | Disclaimer only | Disclaimer only | Disclaimer only | Retrieval-grounded-only citations + ENTWURF workflow |
| Case file integration | Standalone tool | Standalone research | Standalone | Embedded in Akte — Normen pinned to specific cases |
| Self-hosted | No (cloud) | No (cloud) | No (cloud) | Yes (Docker Compose) |

**Helena's differentiated position:** The combination of self-hosted (DSGVO) + retrieval-grounded-only citations (liability) + Normen pinned to Akte (workflow integration) + ENTWURF enforcement (professional duty) is unique. No competitor combines all four.

---

## Sources

- RRF formula and legal domain weight (alpha=0.4): [RAGAboutIt: Query-Aware Hybrid Retrieval](https://ragaboutit.com/beyond-basic-rag-building-query-aware-hybrid-retrieval-systems-that-scale/), [Elastic Hybrid Search Guide](https://www.elastic.co/what-is/hybrid-search), [Weaviate Hybrid Search Explained](https://weaviate.io/blog/hybrid-search-explained)
- Parent-Child chunking sizes: [Databricks Ultimate Chunking Guide](https://community.databricks.com/t5/technical-blog/the-ultimate-guide-to-chunking-strategies-for-rag-applications/ba-p/113089), [Unstructured: Chunking for RAG best practices](https://unstructured.io/blog/chunking-for-rag-best-practices), [Seahorse: Parent-Child in LangChain](https://medium.com/@seahorse.technologies.sl/parent-child-chunking-in-langchain-for-advanced-rag-e7c37171995a)
- Cross-encoder accuracy and latency: [Ailog: +40% Accuracy with Cross-Encoders](https://app.ailog.fr/en/blog/guides/reranking), [RAGAboutIt: Reranking Bottleneck](https://ragaboutit.com/the-reranking-bottleneck-why-your-rag-retriever-is-hiding-the-best-documents/), [ZeroEntropy: Reranking Model Guide 2026](https://www.zeroentropy.dev/articles/ultimate-guide-to-choosing-the-best-reranking-model-in-2025)
- bundestag/gesetze source: [GitHub: bundestag/gesetze](https://github.com/bundestag/gesetze), [GitHub: bundestag/gesetze-tools](https://github.com/bundestag/gesetze-tools)
- German legal citation standard: [Wikipedia: German legal citation](https://en.wikipedia.org/wiki/German_legal_citation), [Harvard Law Library: Finding German court decisions](https://asklib.law.harvard.edu/faq/115439)
- AI hallucination liability in German courts: [jura.cc: KI-Fehlzitate vor Gericht](https://www.jura.cc/rechtstipps/ki-fehlzitate-vor-gericht-was-anwaeltinnen-und-anwaelte-jetzt-wissen-muessen/), [Library of Congress: Germany Regional Court AI Expert Report Inadmissible (Feb 2026)](https://www.loc.gov/item/global-legal-monitor/2026-02-04/germany-regional-court-rules-ai-generated-expert-report-inadmissible)
- Legal RAG patterns and citation accuracy: [Harvard JOLT: RAG for legal work](https://jolt.law.harvard.edu/digest/retrieval-augmented-generation-rag-towards-a-promising-llm-architecture-for-legal-work), [Datategy: How Law Firms Use RAG](https://www.datategy.net/2025/04/14/how-law-firms-use-rag-to-boost-legal-research/)
- Noxtua competitor: [Noxtua.com](https://www.noxtua.com/)
- KI tools for German law firms: [nucamp.co: Top 10 AI Tools German Legal 2025](https://www.nucamp.co/blog/coding-bootcamp-germany-deu-legal-top-10-ai-tools-every-legal-professional-in-germany-should-know-in-2025)

---

*Feature research for: Helena RAG v0.1 — Hybrid Search + Legal Knowledge Sources + German Law UX*
*Researched: 2026-02-27*
