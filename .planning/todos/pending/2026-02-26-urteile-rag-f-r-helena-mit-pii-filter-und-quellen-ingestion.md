---
created: 2026-02-26T22:08:00.245Z
title: Urteile-RAG für Helena mit PII-Filter und Quellen-Ingestion
area: api
files:
  - src/lib/embedding/embedder.ts
  - src/lib/embedding/chunker.ts
  - src/lib/embedding/vector-store.ts
  - src/app/api/ki-chat/route.ts
  - src/lib/queue/processors/
  - prisma/schema.prisma
---

## Problem

Helena kann keine Urteile zitieren oder Argumentationsmuster aus der Rechtsprechung ziehen — weder automatisch bei Anfragen noch als strukturierten Kontext für eine Akte. Das reduziert die Qualität juristischer Antworten erheblich, da LLM-Basiswissen veraltet und halluzinationsanfällig für Aktenzeichen/Leitsätze ist.

Urteile unterscheiden sich von Gesetzen in zwei kritischen Punkten:
1. **Keine einheitliche Quelle** — Rechtsprechung ist über BMJ-Portal, Gerichts-RSS-Feeds und Community-DBs verteilt
2. **Datenschutzrisiko** — auch öffentliche Urteilsportale enthalten teils unzureichend anonymisierte PII (Namen, Adressen, Aktenzeichen-Querverweise)

## Solution

### Architektur: analog zu Gesetze-RAG, aber eigene Tabelle und Pipeline

**Eigene DB-Tabelle `urteil_chunks`** (getrennt von `law_chunks` und `document_chunks`):
```
gericht, datum, aktenzeichen, instanz,
rechtsgebiet, leitsatz_snippet, tenor_snippet,
quelle_url, stand_anonymisierung, pii_geprueft
```

### Datenquellen (priorisiert)

1. **Rechtsprechung-im-Internet (BMJ/BfJ)** — Prio 1
   - Bundesgerichte, BVerfG, BPatG ab 2010
   - Höchste Qualität, direkt maschinenlesbar
   - URL: https://www.rechtsprechung-im-internet.de

2. **Open Legal Data (API/Dumps)** — Prio 2
   - Breite Abdeckung, API für skalierbaren Aufbau
   - URL: https://openlegaldata.io

3. **BAG RSS-Feeds** — Prio 3 (Arbeitsrecht-Boost)
   - Aktuelle BAG-Entscheidungen als Update-Kanal
   - Besonders relevant wenn Kanzlei-Schwerpunkt Arbeitsrecht

4. **openJur** — erst nach PII-Filter-Implementierung
   - Große freie DB, aber bekannte Anonymisierungslücken
   - Nur nutzen wenn PII-Check verlässlich läuft

### PII-Filter (Pflicht vor Indexierung)

Vor dem Embedding jedes Urteils:
- Regex + NER-basierter Filter für: Namen, Adressen, selten Aktenzeichen-Querverweise
- Flag `pii_geprueft: true/false` + `stand_anonymisierung` in Metadaten
- Bei Fund: entweder Redaktion (Platzhalter "[Name]") oder Ausschluss aus Index
- Kandidat: spaCy `de_core_news_sm` oder lokales NER-Modell via Ollama

### Chunking-Strategie

Urteile sind länger als Gesetzesparagraphen → Hierarchisches Chunking:
- **Ebene 1 (Embedding)**: Randnummer / Abschnitt (~500–800 Token)
- **Ebene 2 (Prompt-Kontext)**: Tenor + Leitsatz immer als Parent-Chunk
- Metadaten auf jedem Chunk: gericht, az, datum, rechtsgebiet, quelle_url

### Retrieval & Helena-Integration

- Hybrid Search: pgvector (semantisch) + PostgreSQL `ts_vector` (Aktenzeichen, exakte Begriffe)
- Retrieval-Trigger: automatisch bei Anfragen mit Rechtsprechungsbezug
- Bot-Antwortformat: immer (a) Gericht + AZ + Datum, (b) Leitsatz/Tenor-Snippet, (c) Quellenlink, (d) "nicht amtlich"-Hinweis

### Update-Mechanismus

- BMJ + BAG: RSS-Feeds täglich prüfen, nur neue Entscheidungen indexieren
- Open Legal Data: API-Diff oder Dump-Abgleich (Frequenz je nach API-Limits)
- Ausschluss: Urteile mit `pii_geprueft: false` werden nicht indexiert, nur geloggt

### Implementierungsreihenfolge

1. PII-Filter-Modul (unabhängig von Quelle)
2. BMJ-Ingestion-Worker (BullMQ, analog OCR-Prozessor)
3. `urteil_chunks`-Tabelle + Schema-Migration
4. Helena-Integration (Retrieval-Trigger + Prompt-Format)
5. Open Legal Data + BAG-RSS-Update-Jobs
6. Optional: openJur wenn PII-Filter validiert
