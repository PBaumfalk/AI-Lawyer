# Requirements: AI-Lawyer — Helena Agent v0.2

**Defined:** 2026-02-27
**Core Value:** Helena wird vom Chat-Bot zum autonomen Agenten — ReAct-Loop mit Tool-Calling, deterministischer Schriftsatz-Orchestrator, proaktiver Background-Scanner mit Alerts, per-Akte Memory und QA-Gates mit Audit-Trail.

## v0.2 Requirements

### Agent Core (AGNT)

- [ ] **AGNT-01**: Helena kann autonom über einen ReAct-Loop (Reason→Act→Observe) mehrstufige Aufgaben ausführen (max 20 Steps, dann Fallback-Meldung)
- [ ] **AGNT-02**: Helena hat 9 Read-Only-Tools (read_akte, read_dokumente, read_fristen, read_zeiterfassung, search_gesetze, search_urteile, search_muster, get_kosten_rules, search_alle_akten)
- [ ] **AGNT-03**: Helena hat 5 Write-Tools die immer als Draft/Vorschlag erzeugt werden (create_draft_dokument, create_draft_frist, create_notiz, create_alert, update_akte_rag)
- [ ] **AGNT-04**: Helena-Agent läuft in zwei Modi: Inline (5-Step-Cap, HTTP-Request) für schnelle Chat-Interaktion und Background (20-Step-Cap, BullMQ-Worker) für komplexe Aufgaben
- [ ] **AGNT-05**: Ollama-Tool-Call-Response-Guard: Erkennt und korrigiert JSON-als-Content statt tool_calls (qwen3.5:35b Kompatibilität)
- [ ] **AGNT-06**: Token-Budget-Manager begrenzt LLM-Kontextverbrauch pro Agent-Run (kein Context-Window-Overflow)
- [ ] **AGNT-07**: BullMQ Helena-Task-Queue mit lockDuration:120000 und job.updateProgress() pro Step (Anti-Stall)

### Orchestrator (ORCH)

- [ ] **ORCH-01**: Deterministic Schriftsatz-Orchestrator mit festem Ablauf: Intent-Erkennung → Slot-Filling → RAG-Retrieval → Output-Assembly → ERV-Validator
- [ ] **ORCH-02**: Intent-Router erkennt Klageart, Stadium, Gerichtszweig aus Nutzeranfrage (KSchG-Klage, Mahnung, EV-Antrag, etc.)
- [ ] **ORCH-03**: SchriftsatzSchema als Zod-typisiertes Zwischenformat (Rubrum, Anträge, Sachverhalt, Rechtliche Würdigung, Beweisangebote, Anlagen, Kosten, Formales)
- [ ] **ORCH-04**: Slot-Filling mit automatischer Rückfrage bei fehlenden Pflichtfeldern (Kläger, Beklagter, Kündigungsdatum etc.)
- [ ] **ORCH-05**: Einheitlicher Platzhalter-Standard über alle Muster und Output ({{Kläger_Name}}, {{Streitwert_EUR}} etc.)
- [ ] **ORCH-06**: ERV/beA-Validator als letzter Schritt mit warnungen[] (PDF/A, Signaturpflicht, Dateigrößen-Limits)
- [ ] **ORCH-07**: Jeder Schriftsatz-Entwurf enthält retrieval_belege[] (welche Chunks genutzt wurden — Audit-Trail)

### Task-System (TASK)

- [ ] **TASK-01**: @Helena-Tagging in Notiz/Kommentar-Feldern wird als HelenaTask geparst und in die Queue eingestellt
- [ ] **TASK-02**: HelenaTask Prisma-Modell mit Status-Flow (PENDING → RUNNING → DONE / FAILED / WAITING_APPROVAL)
- [ ] **TASK-03**: HelenaTask speichert vollständigen Agent-Trace (Gedanken + Tool-Aufrufe als JSON steps[])
- [ ] **TASK-04**: Task-Prioritäten (1-10) mit höherer Priorität für manuell zugewiesene Tasks vs Background-Scanner
- [ ] **TASK-05**: Task-Abbruch via UI setzt Status auf ABGEBROCHEN — Agent-Loop prüft zwischen Steps

### Draft-Approval (DRFT)

- [ ] **DRFT-01**: HelenaDraft Prisma-Modell (PENDING → ACCEPTED / REJECTED / EDITED) mit Typ (DOKUMENT, FRIST, NOTIZ, ALERT)
- [ ] **DRFT-02**: ENTWURF-Gate auf Prisma-Middleware-Ebene: Helena-erstellte Dokumente können nie status!=ENTWURF haben (BRAK 2025 / BRAO §43)
- [ ] **DRFT-03**: Draft-Anzeige im Akte-Feed visuell markiert ("Helena-Entwurf · ausstehend") mit Accept/Reject/Edit Buttons
- [ ] **DRFT-04**: Bei Ablehnung: Feedback-Feld wird in Helena-Kontext gespeichert (Lerneffekt für zukünftige Entwürfe)
- [ ] **DRFT-05**: Akzeptierter Draft wird automatisch als Dokument/Frist/Notiz in der Akte angelegt
- [ ] **DRFT-06**: Socket.IO Benachrichtigung an Zuständigen wenn Helena einen Draft erstellt hat

### Proaktiver Scanner (SCAN)

- [ ] **SCAN-01**: Täglicher Background-Scanner (BullMQ-Cron, konfigurierbar) prüft alle offenen Akten
- [ ] **SCAN-02**: Frist-Check: Fristen < 7 Tage ohne zugehöriges Dokument → FRIST_KRITISCH Alert
- [ ] **SCAN-03**: Inaktivitäts-Check: Akte > 30 Tage keine Aktivität → Wiedervorlage-Vorschlag
- [ ] **SCAN-04**: Anomalie-Check: Fristablauf ohne Dokument, unvollständige Beteiligte, fehlender Gegenstandswert → Flag
- [ ] **SCAN-05**: Neu-Urteil-Check: neue Urteile seit letztem Scan zu Rechtsgebiet der Akte → Hinweis
- [ ] **SCAN-06**: Konfigurierbare Schwellenwerte pro Check-Typ (Tage, Aktivitäts-Schwelle etc.)

### Alert-System (ALRT)

- [ ] **ALRT-01**: HelenaAlert Prisma-Modell mit 6 Typen (FRIST_KRITISCH, AKTE_INAKTIV, BETEILIGTE_FEHLEN, DOKUMENT_FEHLT, WIDERSPRUCH, NEUES_URTEIL)
- [ ] **ALRT-02**: Alert-Center im Dashboard mit Filter nach Typ, Akte, Priorität und Gelesen/Ungelesen
- [ ] **ALRT-03**: Alerts erscheinen im Akte-Feed als Helena-Event (visuell differenziert von manuellen Einträgen)
- [ ] **ALRT-04**: Alert-Deduplizierung: gleicher Alert-Typ + gleiche Akte innerhalb 24h wird nicht doppelt erzeugt
- [ ] **ALRT-05**: Kritische Alerts (FRIST_KRITISCH) erzeugen zusätzlich Socket.IO Push-Notification

### Helena Memory (MEM)

- [ ] **MEM-01**: Per-Akte Helena-Kontext (Zusammenfassung, erkannte Risiken, nächste Schritte, offene Fragen, relevante Normen/Urteile)
- [ ] **MEM-02**: Memory wird bei jedem Helena-Aufruf in dieser Akte als Kontext geladen ("Helena erinnert sich")
- [ ] **MEM-03**: Automatischer Memory-Refresh wenn Akte seit letztem Scan verändert wurde (neues Dokument, neue Frist etc.)
- [ ] **MEM-04**: DSGVO-konform: Memory-Einträge werden bei Akten-Löschung kaskadierend gelöscht (Art. 17 DSGVO)

### QA-Gates + Audit (QA)

- [ ] **QA-01**: Goldset-Testkatalog mit ≥20 Queries (Arbeitsrecht: KSchG, Lohnklage, Abmahnung, EV, Mahnverfahren, Fristen, Kosten)
- [ ] **QA-02**: Retrieval-Metriken automatisch messbar: Recall@k, MRR, No-result-Rate
- [ ] **QA-03**: Halluzinations-Check: §-Referenzen und Aktenzeichen in Helena-Antworten werden gegen Retrieval-Chunks verifiziert (nicht LLM-fabricated)
- [ ] **QA-04**: Schriftsatz-Retrieval-Log pro Entwurf (schriftsatz_id, query_text, retrieval_belege[], prompt_version, modell)
- [ ] **QA-05**: UI-Anzeige: "Helena hat X Normen, Y Urteile, Z Muster-Bausteine verwendet" mit aufklappbaren Quellen-Links
- [ ] **QA-06**: Release-Gates: Recall@5 Normen ≥0.85, Halluzinationsrate ≤0.05, Formale Vollständigkeit ≥0.90
- [ ] **QA-07**: Keine Mandantendaten in Logs (nur anonymisierte Query-Hashes für Metriken)

### Akte-Detail UI (UI)

- [ ] **UI-01**: Akte-Detail Activity Feed ersetzt Tab-basierte Navigation — chronologischer Feed mit allen Events (Dokumente, Fristen, E-Mails, Helena-Drafts, Alerts, Notizen)
- [ ] **UI-02**: Composer im Feed: Nutzer kann direkt im Feed Notizen schreiben und @Helena taggen
- [ ] **UI-03**: Helena vs Human Attribution: jeder Feed-Eintrag zeigt klar ob von Helena oder Mensch erstellt
- [ ] **UI-04**: Alert-Center Dashboard-Widget mit Badge-Count für ungelesene Alerts
- [ ] **UI-05**: Helena-Task-Status im Chat: Laufende Tasks zeigen Fortschritt (Step X von Y, aktuelles Tool)
- [ ] **UI-06**: Draft-Review inline im Feed: Accept/Reject/Edit ohne Seitenwechsel

## Future Requirements (v0.3+)

### Spracheingabe/Sprachausgabe
- **VOICE-01**: Whisper STT — Mic-Button im Chat-Input, Aufnahme → Transkript → Eingabefeld
- **VOICE-02**: TTS — Lautsprecher-Icon an Helena-Nachrichten, Audio-Streaming, Auto-Play Toggle

### Erweiterte Agent-Fähigkeiten
- **AGNT-08**: Cross-Akte semantische Suche (related case detection)
- **AGNT-09**: Helena lernt aus Ablehnungen (Feedback-Loop mit Prompt-Tuning)
- **AGNT-10**: Multi-Agent-Orchestration (Helena delegiert Sub-Tasks)

## Out of Scope

| Feature | Reason |
|---------|--------|
| E-Mails versenden | BRAK 2025 + BRAO §43 — KI darf nie auto-versenden |
| Dokumente als "final" markieren | Menschliche Freigabe ist Pflicht |
| Fristen als "erledigt" markieren | Haftungsrisiko — nur Anwalt darf Fristen erledigen |
| Kostenbuchungen erstellen | Finanzielle Aktionen nur durch Menschen |
| Speech/Voice (Whisper + TTS) | Deferred to v0.3 — kein Core-Agent-Feature |
| §§ Knowledge Graph / Verweisketten | Eigenes Multi-Monats-Projekt |
| Automatisierte Sachverhalt-Generierung | Halluzinationsraten zu hoch für kuratierte Narrative |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AGNT-01 | Phase 20 | Pending |
| AGNT-02 | Phase 20 | Pending |
| AGNT-03 | Phase 20 | Pending |
| AGNT-04 | Phase 20 | Pending |
| AGNT-05 | Phase 20 | Pending |
| AGNT-06 | Phase 20 | Pending |
| AGNT-07 | Phase 21 | Pending |
| ORCH-01 | Phase 22 | Pending |
| ORCH-02 | Phase 22 | Pending |
| ORCH-03 | Phase 22 | Pending |
| ORCH-04 | Phase 22 | Pending |
| ORCH-05 | Phase 22 | Pending |
| ORCH-06 | Phase 22 | Pending |
| ORCH-07 | Phase 22 | Pending |
| TASK-01 | Phase 21 | Pending |
| TASK-02 | Phase 19 | Pending |
| TASK-03 | Phase 21 | Pending |
| TASK-04 | Phase 21 | Pending |
| TASK-05 | Phase 21 | Pending |
| DRFT-01 | Phase 19 | Pending |
| DRFT-02 | Phase 23 | Pending |
| DRFT-03 | Phase 23 | Pending |
| DRFT-04 | Phase 23 | Pending |
| DRFT-05 | Phase 23 | Pending |
| DRFT-06 | Phase 23 | Pending |
| SCAN-01 | Phase 24 | Pending |
| SCAN-02 | Phase 24 | Pending |
| SCAN-03 | Phase 24 | Pending |
| SCAN-04 | Phase 24 | Pending |
| SCAN-05 | Phase 24 | Pending |
| SCAN-06 | Phase 24 | Pending |
| ALRT-01 | Phase 19 | Pending |
| ALRT-02 | Phase 24 | Pending |
| ALRT-03 | Phase 24 | Pending |
| ALRT-04 | Phase 24 | Pending |
| ALRT-05 | Phase 24 | Pending |
| MEM-01 | Phase 19 | Pending |
| MEM-02 | Phase 25 | Pending |
| MEM-03 | Phase 25 | Pending |
| MEM-04 | Phase 25 | Pending |
| QA-01 | Phase 26 | Pending |
| QA-02 | Phase 26 | Pending |
| QA-03 | Phase 26 | Pending |
| QA-04 | Phase 26 | Pending |
| QA-05 | Phase 26 | Pending |
| QA-06 | Phase 26 | Pending |
| QA-07 | Phase 26 | Pending |
| UI-01 | Phase 26 | Pending |
| UI-02 | Phase 26 | Pending |
| UI-03 | Phase 26 | Pending |
| UI-04 | Phase 26 | Pending |
| UI-05 | Phase 26 | Pending |
| UI-06 | Phase 26 | Pending |

**Coverage:**
- v0.2 requirements: 53 total
- Mapped to phases: 53
- Unmapped: 0

---
*Requirements defined: 2026-02-27*
*Last updated: 2026-02-27 after roadmap creation*
