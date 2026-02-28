# Phase 22: Deterministic Schriftsatz Orchestrator - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Helena drafts legally-structured court filings and extrajudicial documents via a deterministic pipeline (Intent-Router → Slot-Filling → RAG Assembly → ERV-Validator), not free-form agent output. Every section is validated against retrieved legal sources with a full audit trail (retrieval_belege[]). Output is always a HelenaDraft (ENTWURF), never a final document.

</domain>

<decisions>
## Implementation Decisions

### Supported Klagearten & Scope
- All Rechtsgebiete from the start (Arbeitsrecht, Zivilrecht, Familienrecht, Mietrecht, etc.) — no restriction to a single area
- All Stadien: Erstinstanz, Berufung, Revision, Beschwerde, einstweiliger Rechtsschutz
- Both sides: Klage + Klageerwiderung, Antrag + Erwiderung, Berufung + Berufungserwiderung, Replik/Duplik
- Gerichtliche AND aussergerichtliche Schriftsaetze (Abmahnungen, Kuendigungsschreiben, Vergleichsvorschlaege, Aufforderungsschreiben)
- Goldstandard / highest quality bar: KSchG-Klage + Lohn-/Gehaltsklage — these are daily bread and must work flawlessly

### Intent-Router
- Auto-Erkennung from natural language input — Helena identifies Rechtsgebiet, Klageart, Stadium, and Rolle (Klaeger/Beklagter) automatically
- Uses Akte-Kontext for smarter intent recognition: Rechtsgebiet der Akte, vorhandene Beteiligte, existing Dokumente → fewer Rueckfragen needed
- Auto-derives zustaendiges Gericht from Akte + Streitwert (ArbG, LG, AG, OLG, LAG) — user confirms
- On uncertainty: Helena asks back rather than guessing wrong

### Rueckfrage-Verhalten (Slot-Filling)
- Conversational style: one question at a time (not batched, not form-like)
- Maximum pre-fill from Akte data: Klaeger from Mandant, Beklagter from Gegner, Gericht from Sachgebiet — only ask what genuinely cannot be derived
- Active warnings on uncertain inferences (e.g., "Achtung: Kuendigungszugang am [Datum] — 3-Wochen-Frist laeuft am [Datum] ab")
- When user cannot answer ("weiss ich noch nicht"): set {{PLATZHALTER}} and mark Schriftsatz as incomplete — can be completed later

### Section Quality
- Rechtliche Wuerdigung: Hybrid approach — fully written paragraphs per Anspruchsgrundlage, but with {{ERGAENZUNG}} placeholders where case-specific details are missing
- Beweisangebote: Fully automatic from Akten-Dokumente — Helena scans documents and assigns them as evidence ("Beweis: Kuendigungsschreiben vom [Datum] (Anlage K1)")
- Anlagenliste: Fully automatic — Helena numbers through (K1-Kn for Klaeger, B1-Bn for Beklagter), assigns to Beweisangebote, creates Anlagenverzeichnis
- Streitwert: Automatic calculation from Klageart + Akte data (e.g., 3 Bruttogehaelter bei KSchG) with Kostenvorschuss-Hinweis (GKG-Tabelle)

### ERV-Validator
- Warnings only, never hard-blocks — Anwalt always has final say
- Inhaltliche AND formale Validierung equally important:
  - Inhaltlich: Rubrum-Vollstaendigkeit, Parteienbezeichnung, Anschrift, Az., Antragswortlaut (§ 253 ZPO)
  - Formal: PDF/A-Konformitaet, Dateigroesse < 60MB, Signatur-Anforderung, Seitenzahl
- Rechtsgebietsspezifische Pruefungen: KSchG 3-Wochen-Frist, Schlichtungsklausel § 15a EGZPO, Mahnbescheid-Voraussetzungen, Gebuehrenvorschuss ArbG, etc.
- Validation result: Checkliste visible at the end of the draft — green checks for fulfilled, yellow warnings for problems. Anwalt sees at a glance what's missing.

### Claude's Discretion
- Exact Zod schema field structure for SchriftsatzSchema (as long as all mandatory sections from roadmap are covered)
- Internal pipeline architecture (how stages chain together)
- RAG query strategy per section (how many chunks, which sources to prioritize)
- Error handling and retry behavior within the pipeline
- Exact wording of Rueckfrage prompts

</decisions>

<specifics>
## Specific Ideas

- KSchG-Klage and Lohnklage as primary test cases — if these work perfectly, the system is ready
- Helena should feel like a junior ReFa who knows the law but asks the Anwalt for case-specific facts
- Platzhalter convention already established in v0.1 ({{PLATZHALTER}}) — reuse same format
- Draft-Approval workflow is Phase 23 — this phase only produces the SchriftsatzSchema and HelenaDraft, not the approval UI

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 22-deterministic-schriftsatz-orchestrator*
*Context gathered: 2026-02-27*
