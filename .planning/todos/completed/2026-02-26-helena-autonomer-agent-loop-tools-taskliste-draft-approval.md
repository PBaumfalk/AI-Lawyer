---
created: 2026-02-26T23:15:34.881Z
title: Helena — Autonomer Agent-Loop, Tools, Taskliste, Draft-Approval
area: api
files:
  - src/lib/helena/
  - src/lib/queue/processors/
  - src/app/api/helena/
  - prisma/schema.prisma
---

## Problem

Die bestehenden Helena-Todos beschreiben ihr Wissen (Gesetze, Urteile, Muster, RAG-Qualität) und ihre Ausgabe (Orchestrator, QA). Was fehlt, ist das Herzstück: Helena als autonomer Agent der selbständig in der Kanzleisoftware arbeitet — nicht nur antwortet wenn gefragt.

Helena soll die **Intelligenz der Kanzlei** sein:
- Sie fliegt selbständig durch alle Akten
- Sie führt ihr zugewiesene Aufgaben aus (@-Tagging durch Nutzer)
- Sie schlägt Entwürfe vor (nie direkt committen)
- Sie meldet Anomalien proaktiv
- Sie liest Akten und reichert das RAG selbst an
- Sie kennt alle Funktionen der Software

## Vision (konkret)

```
Anwalt öffnet Akte → taggt Helena: "@Helena Klageschrift vorbereiten"
    ↓
Helena: liest Akte + Beteiligte + Falldaten + Fristen
        sucht relevante §§ (Gesetze-RAG)
        sucht aktuelle BAG-Rspr. (Urteile-RAG)
        wählt passendes Muster (Arbeitswissen-RAG)
        berechnet Streitwert (kosten_rules)
        erstellt Klageschrift-Entwurf
        legt ihn als "Entwurf (Helena)" in Dokumente ab
        erstellt Notiz: "Klageschrift vorbereitet — bitte prüfen"
        ↓
Anwalt sieht Entwurf → prüft → akzeptiert / lehnt ab / bearbeitet
```

Gleichzeitig, im Hintergrund, ohne Tag:
```
Helena scannt alle offenen Akten täglich
→ findet: Frist in 3 Tagen, kein Dokument vorhanden → Alert
→ findet: Akte seit 30 Tagen keine Aktivität → Wiedervorlage-Vorschlag
→ findet: neues BAG-Urteil zu laufendem KSchG-Mandat → Hinweis in Akte
→ speichert Akten-Kontext in Helena-RAG (was sie gelesen hat)
```

---

## Architektur

### 1. Agent-Loop (ReAct: Reason → Act → Observe)

```typescript
// src/lib/helena/agent.ts
async function helenaAgentLoop(task: HelenaTask): Promise<HelenaResult> {
  const context = await gatherContext(task.akteId)

  while (!done) {
    const thought = await llm.reason(context, task, availableTools)
    const action = thought.nextAction

    if (action.type === 'TOOL') {
      const result = await executeTool(action.tool, action.params)
      context.observations.push(result)
    }

    if (action.type === 'DRAFT') {
      await createDraft(action.content, task)
      done = true
    }

    if (action.type === 'ALERT') {
      await createAlert(action.message, task.akteId)
      done = true
    }
  }
}
```

**Max-Steps-Limit** (Anti-Loop): max. 20 Tool-Aufrufe pro Task, dann Fallback: "Helena konnte Aufgabe nicht abschließen — fehlende Informationen: [...]"

---

### 2. Tool-Set (was Helena tun darf)

**Lesen (read-only, immer erlaubt):**
```
read_akte(akteId)              → Aktenmetadaten, Falldaten, Beteiligte
read_dokumente(akteId)         → Dokumentenliste + Volltexte (via RAG)
read_fristen(akteId)           → Termine, Fristen, Wiedervorlagen
read_zeiterfassung(akteId)     → Zeitbuchungen
search_gesetze(query)          → law_chunks (Hybrid Search)
search_urteile(query)          → urteil_chunks (Hybrid Search)
search_muster(typ, rechtsgebiet) → muster_chunks
get_kosten_rules(verfahrensart) → Streitwert/RVG-Regeln
search_alle_akten(query)       → Kanzlei-weite Suche
```

**Schreiben (immer als Draft/Vorschlag, nie direkt):**
```
create_draft_dokument(akteId, typ, inhalt)   → Entwurf in Dokumente
create_draft_frist(akteId, datum, typ, titel) → Frist-Vorschlag
create_notiz(akteId, inhalt, typ)            → Aktennotiz
create_alert(akteId, typ, nachricht)         → Alert für Zuständigen
update_akte_rag(akteId, zusammenfassung)     → Helena-Kontext in RAG
```

**Niemals direkt (immer menschliche Freigabe):**
- E-Mails versenden
- Dokumente als "final" markieren
- Fristen als "erledigt" markieren
- Kostenbuchungen erstellen

---

### 3. Task-System (@-Tagging)

**Wie Nutzer Helena beauftragen:**

In jedem Kommentar/Notiz-Feld: `@Helena [Aufgabe]`

Beispiele:
- `@Helena Klageschrift vorbereiten`
- `@Helena Fristenkette für Berufung anlegen`
- `@Helena Akte zusammenfassen für Mandantengespräch`
- `@Helena Neues Urteil: BAG 2 AZR 123/25 — relevant für diese Akte?`

**DB-Tabelle `HelenaTask`:**
```prisma
model HelenaTask {
  id           String         @id @default(cuid())
  akteId       String
  auftragText  String         // "@Helena ..."
  auftraggeberI String        // User-ID
  status       TaskStatus     // PENDING | RUNNING | DONE | FAILED | WAITING_APPROVAL
  prioritaet   Int            @default(5)
  erstelltAm   DateTime       @default(now())
  gestartetAm  DateTime?
  abgeschlossenAm DateTime?
  drafts       HelenaDraft[]
  alerts       HelenaAlert[]
  logs         HelenaLog[]    // Gedanken + Tool-Aufrufe (für Nachvollziehbarkeit)
}
```

---

### 4. Proaktiver Background-Scanner

**Täglicher Cron-Job** (BullMQ, läuft nachts):

```
Für jede offene Akte:
1. Frist-Check: Fristen < 7 Tage ohne zugehöriges Dokument → Alert
2. Inaktivitäts-Check: > 30 Tage keine Aktivität → Wiedervorlage-Vorschlag
3. Neu-Urteil-Check: neue Urteile seit letztem Scan zu diesem Rechtsgebiet → Hinweis
4. Akten-RAG-Update: Akte neu gelesen seit > 7 Tagen → Zusammenfassung aktualisieren
5. Anomalie-Check: Fristablauf ohne Dokument, unvollständige Beteiligte, fehlender Gegenstandswert → Flag
```

Konfigurierbar: welche Checks aktiv sind, Schwellenwerte (7 Tage / 30 Tage etc.)

---

### 5. Draft-Approval-Workflow

Alles was Helena schreibt landet als Draft, nie direkt live:

```
Helena erstellt Entwurf
    ↓
Benachrichtigung an Zuständigen: "Helena hat Entwurf erstellt: [Titel]"
    ↓
Nutzer sieht Draft in Akte (visuell markiert: "Helena-Entwurf · ausstehend")
    ↓
[✓ Übernehmen]  [✎ Bearbeiten]  [✗ Ablehnen + Feedback]
    ↓
Bei Ablehnung: Feedback geht in Helena-Kontext (Lerneffekt via Prompt-Tuning / Goldset)
```

**DB-Tabelle `HelenaDraft`:**
```prisma
model HelenaDraft {
  id           String      @id @default(cuid())
  taskId       String?
  akteId       String
  typ          DraftTyp    // DOKUMENT | FRIST | NOTIZ | ALERT
  inhalt       Json        // Typ-spezifischer Payload
  status       DraftStatus // PENDING | ACCEPTED | REJECTED | EDITED
  feedback     String?     // Bei Ablehnung
  erstelltAm   DateTime    @default(now())
  entschiedenAm DateTime?
  entschiedenVon String?
}
```

---

### 6. Helena-Memory (Akten-RAG-Feedback-Loop)

Wenn Helena eine Akte liest, speichert sie eine strukturierte Zusammenfassung:

```
helena_akte_kontext:
  akteId, gelesen_am, zusammenfassung,
  erkannte_risiken[], nächste_schritte[],
  offene_fragen[], relevante_normen[], relevante_urteile[]
```

Diese Zusammenfassung wird bei jedem Helena-Aufruf in dieser Akte als Kontext geladen — sie "erinnert sich" was sie zuletzt wusste.

---

### 7. Alert-System

Helenas Meldungen wenn "was komisch ist":

```
Alert-Typen:
  FRIST_KRITISCH       → "Klageschrift einreichen in 2 Tagen — noch kein Entwurf"
  AKTE_INAKTIV         → "Akte seit 45 Tagen ohne Aktivität"
  BETEILIGTE_FEHLEN    → "Gegner-Anwalt nicht erfasst — für Schriftsatz benötigt"
  DOKUMENT_FEHLT       → "Arbeitsvertrag nicht vorhanden — wird für KSchG-Klage benötigt"
  WIDERSPRUCH          → "Kündigungsdatum in Falldaten ≠ Datum im hochgeladenen Dokument"
  NEUES_URTEIL         → "Neues BAG-Urteil zu § 626 BGB relevant für diese Akte"
```

Alerts erscheinen in:
- Akte-Feed (als Helena-Event, visuell differenziert)
- Kanzlei-Dashboard (Alert-Center)
- Optional: E-Mail/Push wenn kritisch

---

### Abhängigkeiten (müssen vorher existieren)

- `improve-helena-rag-pipeline` — Hybrid Search + Reranking
- `gesetze-rag-helena` — search_gesetze Tool
- `urteile-rag-helena` — search_urteile Tool
- `arbeitswissen-rag-helena` — search_muster + get_kosten_rules
- `helena-orchestrator-output-schema` — Draft-Format-Standard
- `akte-detail-feed-umbau` — UI für Draft-Anzeige + Alert-Feed

---

### Implementierungsreihenfolge

1. Tool-Definitionen + Tool-Executor (read-only Tools zuerst)
2. Agent-Loop (ReAct) + BullMQ-Job
3. @-Tagging Parser + HelenaTask-Tabelle
4. Draft-Approval UI (Feed-Eintrag + Accept/Reject)
5. Background-Scanner (Frist-Check + Inaktivitäts-Check)
6. Helena-Memory (Akten-RAG-Feedback-Loop)
7. Alert-System + Alert-Center im Dashboard
8. Anomalie-Erkennung (Widersprüche, fehlende Dokumente)
