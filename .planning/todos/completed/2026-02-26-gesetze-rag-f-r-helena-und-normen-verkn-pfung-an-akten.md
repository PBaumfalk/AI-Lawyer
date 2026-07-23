---
created: 2026-02-26T22:04:41.451Z
title: Gesetze-RAG für Helena und Normen-Verknüpfung an Akten
area: api
files:
  - src/lib/embedding/embedder.ts
  - src/lib/embedding/chunker.ts
  - src/lib/embedding/vector-store.ts
  - src/app/api/ki-chat/route.ts
  - src/lib/queue/processors/
  - prisma/schema.prisma
  - src/app/(app)/akten/[id]/
---

## Problem

Helena hat keinen Zugriff auf Bundesgesetze — Antworten zu Rechtsfragen stützen sich ausschließlich auf Akteninhalte und das Basiswissen des LLM. Das LLM halluziniert Normen oder gibt veraltete Fassungen wieder.

Zusätzlich gibt es keine Möglichkeit, in einer Akte konkrete §§ strukturiert zu verknüpfen (z. B. "BGB § 626 Abs. 1 — fristlose Kündigung"), was Wiederauffindbarkeit und Helenas Kontextqualität für die Akte einschränkt.

## Solution

**Zwei separate, zusammenhängende Features:**

### 1. Gesetze-RAG für Helena

Ingestion-Pipeline für Bundesgesetze in pgvector als eigenständiger Knowledge-Index (getrennt von Akte-Chunks):

- **Datenquelle**: `bundestag/gesetze` GitHub-Repo (Markdown, strukturiert nach Gesetz/§/Absatz) als Einstieg; Update-Mechanismus via RSS-Feed Gesetze-im-Internet (täglich)
- **Chunking**: Hierarchisch nach §/Absatz (~500–1.000 Token/Chunk), Metadaten: `gesetz`, `kurztitel`, `paragraf`, `absatz`, `stand`, `quelle_url`
- **Retrieval**: Hybrid (pgvector + PostgreSQL `ts_vector`) — wichtig für Normzitate ("§ 626 BGB") UND Konzept-Suche ("fristlose Kündigung")
- **Helena-Prompt**: Bei Anfragen mit Rechtsbezug automatisch Top-5 Normen-Chunks als zusätzlicher Kontext; immer mit Hinweis "nicht amtlich" + Link
- **Eigene DB-Tabelle**: `law_chunks` (getrennt von `document_chunks`)
- **Ingestion-Worker**: BullMQ-Job, einmalig bulk + danach inkrementell per RSS

### 2. Manuelle Normen-Verknüpfung an Akten

UI + Datenmodell damit Nutzer spezifische §§ strukturiert an eine Akte hängen können:

- **DB**: neue Tabelle `akte_normen` (akte_id FK, gesetz, paragraf, absatz, notiz, erstellt_von, erstellt_am)
- **UI**: Suche in Akte-Detail (z. B. "§ 626 BGB" eintippen → Autocomplete aus law_chunks-Index → Hinzufügen mit optionaler Notiz)
- **Helena-Kontext**: Beim Öffnen einer Akte werden verknüpfte Normen automatisch in Helenas System-Kontext geladen (höhere Priorität als automatisches Retrieval)
- **Anzeige**: Eigene Sektion in Akte-Detail (unterhalb KPI-Cards oder Tab), Chip-Liste der verknüpften Normen mit Volltext-Tooltip

### Rechtlicher Rahmen
- Gesetze sind amtliche Werke → urheberrechtsfrei (§ 5 UrhG)
- Hinweis "nicht amtlich" + Quellenlink ist Pflicht in UI und Helena-Antworten
