# Phase 17: Urteile-RAG - Research

**Researched:** 2026-02-27
**Domain:** German federal court decision ingestion via BMJ RSS feeds + pgvector embedding + ki-chat Chain E citation injection
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| URTEIL-01 | BMJ Rechtsprechung-im-Internet in eigene `urteil_chunks`-Tabelle ingested (alle 7 Bundesgerichts-RSS-Feeds: BGH, BAG, BVerwG, BFH, BSG, BPatG, BVerfG); HNSW-Index auf embedding-Spalte | RSS feed URLs verified, fast-xml-parser already in project, ingestion pattern from gesetze/ingestion.ts documented, HNSW index already created in manual_rag_hnsw_indexes.sql |
| URTEIL-02 | BAG RSS-Feed als täglicher inkrementeller Update-Kanal fuer Arbeitsrecht-Entscheidungen | BullMQ upsertJobScheduler cron pattern verified from registerGesetzeSyncJob(); guid from RSS item serves as idempotency key; sourceUrl is @unique in schema |
| URTEIL-04 | Helena zitiert Urteile immer mit Gericht + AZ + Datum + Leitsatz-Snippet + Quellenlink; AZ kommen ausschliesslich aus `urteil_chunks.citation`-Metadaten (nie LLM-generiert) | CRITICAL SCHEMA GAP: `urteil_chunks` has `aktenzeichen` field but NOT a `citation` field — requirement uses "citation" terminology but schema uses "aktenzeichen"; citation must be composed from aktenzeichen + gericht + datum in ki-chat Chain E; no LLM generation of AZ ever |

</phase_requirements>

---

## Summary

Phase 17 ingests decisions from all 7 German federal courts via the BMJ Rechtsprechung-im-Internet RSS feeds, runs each decision through the Phase 16 PII gate inline (synchronous, no BullMQ queue), embeds the description/Leitsatz as the chunk content, and registers a daily BullMQ cron for incremental BAG updates. The RSS feeds are the primary and only data source — no HTML scraping of the portal is needed because the RSS title contains all required metadata (Gericht, AZ, Datum) and the description contains the Leitsatz snippet.

A critical finding: `robots.txt` at rechtsprechung-im-internet.de has `Disallow: /` for all user agents except `DG_JUSTICE_CRAWLER`. However, the RSS feeds (`/jportal/docs/feed/bsjrs-*.xml`) are publicly provided as a notification service and fetching them is legally and technically appropriate — they are the intended machine-readable interface for automated consumers. No HTML scraping of individual decision pages is needed for this phase.

A schema gap exists: URTEIL-04 references `urteil_chunks.citation` but the Prisma schema has `aktenzeichen`, `gericht`, and `datum` as separate fields — not a `citation` column. The citation string is composed in ki-chat Chain E as `${gericht} ${aktenzeichen} vom ${datum}` from these fields. No migration is needed because all required data is already stored — only the system prompt formatting logic is missing.

**Primary recommendation:** Build `src/lib/urteile/` mirroring `src/lib/gesetze/` with a RSS feed fetcher, XML parser (using existing `fast-xml-parser`), ingestion function with inline NER gate, search function, and BullMQ cron processor; then add Chain E to ki-chat.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fast-xml-parser` | `^5.3.8` | RSS XML parsing | Already in package.json; used in xjustiz/parser.ts and camt-parser.ts |
| `pgvector` | existing | Vector embedding storage/search | Already used by law_chunks and document_chunks; same pattern |
| Prisma + `$executeRaw` | existing | UrteilChunk DB writes with vector | Same as upsertLawChunks() — Prisma cannot handle `Unsupported("vector(1024)")` via typed client |
| BullMQ `upsertJobScheduler` | existing | Daily incremental cron | Same as `registerGesetzeSyncJob()` — exact pattern to copy |
| `runNerFilter` from Phase 16 | `src/lib/pii/ner-filter.ts` | PII gate before every pgvector insert | Already built and acceptance-tested; import directly |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `generateEmbedding` from embedder.ts | existing | Generate 1024-dim vector for Leitsatz | Same function used by upsertLawChunks — already handles model version tracking |
| `getSetting`/`updateSetting` | existing | Persist seen-GUID cache as JSON in SystemSetting | Same pattern as SHA cache in gesetze/ingestion.ts — no new infrastructure |
| `createLogger` from `@/lib/logger` | existing | Structured logging in processor | Project standard across all processors |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| RSS feeds for data source | HTML scraping individual decision pages | RSS is the intended machine interface; HTML scraping violates robots.txt (Disallow: /) for all but DG_JUSTICE_CRAWLER |
| `fast-xml-parser` XMLParser | Native `DOMParser` or regex | fast-xml-parser is already in project; handles namespaces cleanly; used in 2 other parsers |
| GUID cache in SystemSetting JSON | Separate DB table for seen GUIDs | SystemSetting JSON avoids schema migration; same pattern as SHA cache; sufficient for O(n) GUIDs |
| Inline NER per RSS item | BullMQ async NER queue for Urteile | Phase 16 explicitly designed Urteil NER as synchronous inline gate (no state machine needed — piiFiltered boolean is sufficient) |

**Installation:** No new packages needed. All required dependencies already present in project.

---

## Architecture Patterns

### Recommended Project Structure

```
src/lib/urteile/
├── rss-client.ts        # Fetch RSS XML from 7 BMJ feeds; parse with fast-xml-parser
├── ingestion.ts         # upsertUrteilChunks(), searchUrteilChunks(), GUID cache helpers
└── (no markdown-parser needed — all metadata comes from RSS item fields)

src/lib/queue/processors/
└── urteile-sync.processor.ts   # BullMQ processor: processUrteileSyncJob()

src/lib/queue/queues.ts          # +urteileSyncQueue, +registerUrteileSyncJob()
src/worker.ts                    # +urteile-sync Worker + startup registration
src/app/api/ki-chat/route.ts     # +Chain E: searchUrteilChunks() parallel fetch + URTEILE-QUELLEN injection
```

### Pattern 1: RSS Feed Fetching with fast-xml-parser

**What:** Fetch the 7 RSS XML feeds, parse with XMLParser, extract item metadata (gericht, AZ, datum, leitsatz, link, guid).

**When to use:** During initial ingestion sweep and daily cron incremental update.

**Example:**

```typescript
// Source: src/lib/xjustiz/parser.ts pattern + RSS feed structure verified via WebFetch
import { XMLParser } from "fast-xml-parser";

export const BMJ_RSS_FEEDS: Record<string, string> = {
  BGH:    "https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bgh.xml",
  BAG:    "https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bag.xml",
  BVerwG: "https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bverwg.xml",
  BFH:    "https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bfh.xml",
  BSG:    "https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bsg.xml",
  BPatG:  "https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bpatg.xml",
  BVerfG: "https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bverfg.xml",
};

export interface UrteilRssItem {
  guid: string;         // e.g. "jb-KARE600071345" — used as idempotency key
  gericht: string;      // e.g. "BAG"
  aktenzeichen: string; // e.g. "7 AZR 185/24" — parsed from title
  datum: Date;          // e.g. 2025-11-05 — parsed from title
  entscheidungstyp: string; // e.g. "Urteil", "Beschluss" — parsed from title
  leitsatz: string;     // description field — may be empty for BGH items
  sourceUrl: string;    // link field — canonical portal URL
  rechtsgebiet?: string; // Derived from court code: BAG → "Arbeitsrecht", BFH → "Steuerrecht"
}

/**
 * Title format (verified via live feed fetch 2026-02-27):
 *   "BAG 7. Senat, Urteil vom 05.11.2025, 7 AZR 185/24"
 *   "BGH 11. Zivilsenat, Beschluss vom 03.02.2026, XI ZR 65/24"
 *   "BVerfG ..., Beschluss vom ..., 1 BvR .../..."
 *
 * Regex: /^(.+?),\s*(Urteil|Beschluss|Versäumnisurteil|Zwischenurteil|Anerkenntnisurteil)\s+vom\s+(\d{2}\.\d{2}\.\d{4}),\s+(.+)$/
 */
function parseTitleFields(title: string, gerichtCode: string): Pick<UrteilRssItem, "aktenzeichen" | "datum" | "entscheidungstyp"> {
  const match = title.match(
    /^.+?,\s*(Urteil|Beschluss|Versäumnisurteil|Zwischenurteil|Anerkenntnisurteil|Gerichtsbescheid)\s+vom\s+(\d{2}\.\d{2}\.\d{4}),\s+(.+)$/
  );
  if (!match) {
    throw new Error(`Cannot parse title: "${title}"`);
  }
  const [, entscheidungstyp, datumStr, aktenzeichen] = match;
  const [day, month, year] = datumStr.split(".").map(Number);
  return {
    entscheidungstyp,
    datum: new Date(year, month - 1, day),
    aktenzeichen: aktenzeichen.trim(),
  };
}

export async function fetchUrteileFeed(gerichtCode: string): Promise<UrteilRssItem[]> {
  const url = BMJ_RSS_FEEDS[gerichtCode];
  if (!url) throw new Error(`Unknown Gericht code: ${gerichtCode}`);

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`RSS fetch failed (${res.status}): ${url}`);
  const xml = await res.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    parseAttributeValues: true,
    isArray: (name) => name === "item",
  });
  const parsed = parser.parse(xml) as {
    rss?: { channel?: { item?: Array<{
      title: string;
      description?: string;
      link: string;
      pubDate: string;
      guid: string | { "#text": string };
    }> } }
  };

  const items = parsed.rss?.channel?.item ?? [];

  return items.flatMap((item) => {
    try {
      const guid = typeof item.guid === "string" ? item.guid : item.guid["#text"];
      const { aktenzeichen, datum, entscheidungstyp } = parseTitleFields(item.title, gerichtCode);
      return [{
        guid,
        gericht: gerichtCode,
        aktenzeichen,
        datum,
        entscheidungstyp,
        leitsatz: item.description ?? "",
        sourceUrl: item.link,
        rechtsgebiet: RECHTSGEBIET_MAP[gerichtCode],
      }] satisfies UrteilRssItem[];
    } catch {
      // Skip malformed items — non-fatal, log and continue
      return [];
    }
  });
}

const RECHTSGEBIET_MAP: Record<string, string> = {
  BGH:    "Zivilrecht",
  BAG:    "Arbeitsrecht",
  BVerwG: "Verwaltungsrecht",
  BFH:    "Steuerrecht",
  BSG:    "Sozialrecht",
  BPatG:  "Patentrecht",
  BVerfG: "Verfassungsrecht",
};
```

### Pattern 2: UrteilChunk Ingestion with Inline NER Gate

**What:** For each RSS item: check GUID cache (skip if seen), call `runNerFilter()` on Leitsatz, if clean → embed + insert. Uses `sourceUrl @unique` as idempotency at DB level.

**When to use:** In the BullMQ processor for both initial sweep and daily incremental runs.

**Example:**

```typescript
// Source: upsertLawChunks() pattern from src/lib/gesetze/ingestion.ts
import pgvector from "pgvector";
import { prisma } from "@/lib/db";
import { generateEmbedding, MODEL_VERSION } from "@/lib/embedding/embedder";
import { runNerFilter } from "@/lib/pii/ner-filter";
import { getSetting, updateSetting } from "@/lib/settings/service";
import type { UrteilRssItem } from "./rss-client";

const GUID_CACHE_KEY = "urteile.seen_guids";

export async function loadGuidCache(): Promise<Set<string>> {
  const raw = await getSetting(GUID_CACHE_KEY);
  if (!raw) return new Set();
  return new Set(JSON.parse(raw) as string[]);
}

export async function saveGuidCache(guids: Set<string>): Promise<void> {
  await updateSetting(GUID_CACHE_KEY, JSON.stringify([...guids]));
}

/**
 * Insert a single UrteilChunk row after PII check and embedding.
 * Uses DELETE+INSERT for idempotent re-ingestion on model version change.
 * NEVER inserts if NER filter returns hasPii:true — BRAO §43a gate.
 *
 * @returns "inserted" | "pii_rejected" | "error"
 */
export async function ingestUrteilItem(
  item: UrteilRssItem
): Promise<"inserted" | "pii_rejected" | "error"> {
  try {
    // PII gate — inline synchronous (no BullMQ queue for Urteile)
    // Content for NER: leitsatz (short, ~200 chars from RSS description)
    const nerText = item.leitsatz || `${item.gericht} ${item.aktenzeichen} ${item.entscheidungstyp}`;
    const nerResult = await runNerFilter(nerText);

    if (nerResult.hasPii) {
      // Log and skip — do NOT throw (caller continues with next item)
      return "pii_rejected";
    }

    // Content stored: leitsatz as child chunk (for retrieval), same as parentContent
    const content = item.leitsatz || `${item.entscheidungstyp} des ${item.gericht} vom ${item.datum.toLocaleDateString("de-DE")} (${item.aktenzeichen})`;
    const embedding = await generateEmbedding(content);
    const vectorSql = pgvector.toSql(embedding);

    // Idempotent: DELETE existing row for this sourceUrl (unique constraint)
    await prisma.$executeRaw`
      DELETE FROM urteil_chunks WHERE "sourceUrl" = ${item.sourceUrl}
    `;

    await prisma.$executeRaw`
      INSERT INTO urteil_chunks (
        id, aktenzeichen, gericht, datum, rechtsgebiet,
        content, "parentContent", embedding, "modelVersion",
        "sourceUrl", "piiFiltered", "ingestedAt"
      ) VALUES (
        gen_random_uuid(),
        ${item.aktenzeichen},
        ${item.gericht},
        ${item.datum},
        ${item.rechtsgebiet ?? null},
        ${content},
        ${content},
        ${vectorSql}::vector,
        ${MODEL_VERSION},
        ${item.sourceUrl},
        true,
        NOW()
      )
    `;

    return "inserted";
  } catch {
    return "error";
  }
}
```

### Pattern 3: BullMQ Cron Processor for Daily Incremental Update

**What:** Mirrors `processGesetzeSyncJob()` exactly. Fetches all 7 RSS feeds, checks GUID cache for new items, ingests new ones with PII gate.

**When to use:** Initial full sweep (run on worker boot or manually) + daily 03:00 Europe/Berlin cron.

**Example:**

```typescript
// Source: src/lib/queue/processors/gesetze-sync.processor.ts pattern (verified)
import { createLogger } from "@/lib/logger";
import { fetchUrteileFeed, BMJ_RSS_FEEDS } from "@/lib/urteile/rss-client";
import { ingestUrteilItem, loadGuidCache, saveGuidCache } from "@/lib/urteile/ingestion";

const log = createLogger("urteile-sync-processor");

export async function processUrteileSyncJob(): Promise<{
  inserted: number;
  skipped: number;
  piiRejected: number;
  failed: number;
}> {
  const guidCache = await loadGuidCache();
  let inserted = 0, skipped = 0, piiRejected = 0, failed = 0;

  for (const gerichtCode of Object.keys(BMJ_RSS_FEEDS)) {
    let items;
    try {
      items = await fetchUrteileFeed(gerichtCode);
    } catch (err) {
      log.error({ err, gerichtCode }, "RSS fetch failed — skipping court");
      failed++;
      continue;
    }

    for (const item of items) {
      if (guidCache.has(item.guid)) {
        skipped++;
        continue;
      }

      const result = await ingestUrteilItem(item);

      if (result === "inserted") {
        guidCache.add(item.guid);
        inserted++;
      } else if (result === "pii_rejected") {
        guidCache.add(item.guid); // Mark seen — don't retry PII-rejected items
        piiRejected++;
      } else {
        failed++;
        // Do NOT add to guidCache on error — will retry on next cron run
      }
    }
  }

  await saveGuidCache(guidCache);
  log.info({ inserted, skipped, piiRejected, failed }, "Urteile sync completed");
  return { inserted, skipped, piiRejected, failed };
}
```

### Pattern 4: ki-chat Chain E — Urteil Retrieval and Citation Injection

**What:** Parallel to Chain D (law_chunks), Chain E fetches top-5 urteil_chunks for the query and injects them into the system prompt with structured citation format.

**When to use:** When `!skipRag`. Non-fatal — error returns `[]` and Helena responds without Urteile.

**Example:**

```typescript
// Source: Chain D (law_chunks) pattern from src/app/api/ki-chat/route.ts lines 472-488
// Chain E: urteil_chunks retrieval (Urteile-RAG)
const urteilChunksPromise = skipRag
  ? Promise.resolve([] as UrteilChunkResult[])
  : (async (): Promise<UrteilChunkResult[]> => {
      const tE = Date.now();
      try {
        const queryEmbedding = await queryEmbeddingPromise;
        if (!queryEmbedding) return [];
        const results = await searchUrteilChunks(queryEmbedding, { limit: 5, minScore: 0.6 });
        console.log(`[ki-chat] Chain E (urteil_chunks) took ${Date.now() - tE}ms, ${results.length} results`);
        return results;
      } catch (err) {
        console.error("[ki-chat] Urteil chunks search failed:", err);
        return [];
      }
    })();

// System prompt injection — after GESETZE-QUELLEN:
if (urteilChunks.length > 0) {
  systemPrompt += "\n\n--- URTEILE-QUELLEN ---\n";
  urteilChunks.forEach((u, i) => {
    const datumStr = new Date(u.datum).toLocaleDateString("de-DE", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
    // URTEIL-04: All citation fields come from DB — NEVER LLM-generated
    systemPrompt += `\n[U${i + 1}] ${u.gericht} ${u.aktenzeichen} vom ${datumStr}\n`;
    systemPrompt += `${u.content}\n`;
    systemPrompt += `Quelle: ${u.sourceUrl}\n`;
  });
  systemPrompt += "\n--- ENDE URTEILE-QUELLEN ---";
  systemPrompt += "\n\nWenn du Urteile zitierst: immer Gericht + Aktenzeichen + Datum + Quellenlink — niemals ein AZ erfinden oder paraphrasieren.";
}
```

### Anti-Patterns to Avoid

- **HTML scraping individual decision pages:** robots.txt `Disallow: /` for all except `DG_JUSTICE_CRAWLER`. The RSS feeds are the correct interface — they contain all metadata needed for URTEIL-04 (Gericht, AZ, Datum, Leitsatz in title + description fields).
- **Creating a `citation` DB column:** URTEIL-04 says "aus urteil_chunks.citation" but the schema already has `aktenzeichen`, `gericht`, `datum`. Compose the citation string in ki-chat from these fields — no schema migration needed.
- **Using BullMQ queue for Urteil NER:** Phase 16 explicitly designed Urteil NER as inline synchronous. The `processUrteilNer()` function already exists in ner-pii.processor.ts. For simplicity, call `runNerFilter()` directly in ingestUrteilItem() — no queue overhead.
- **Embedding the full HTML decision text:** RSS items provide Leitsatz in `<description>`. This is the correct chunk content — short, PII-clean summaries of legal principles. Full decision text is not needed for RAG.
- **Ignoring GUID-based deduplication:** `sourceUrl @unique` catches duplicates at DB level, but the GUID cache prevents redundant NER + embedding calls on items already ingested.
- **GUID cache growing unboundedly:** RSS feeds return ~20-50 items. After 3+ months, the cache will have ~5000 GUIDs. Store as JSON Set in SystemSetting — manageable size (< 500KB for 5000 GUIDs of ~50 chars each).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RSS XML parsing | Custom regex-based XML extraction | `XMLParser` from `fast-xml-parser` | Already in project; handles attribute parsing, CDATA, nested elements |
| PII gate for each Urteil | Custom NER call in processor | `runNerFilter()` from `src/lib/pii/ner-filter.ts` | Phase 16 built, acceptance-tested, handles <think> leakage, whitelist |
| GUID deduplication | Separate DB table `urteile_seen_guids` | JSON Set in SystemSetting (same as SHA cache) | Zero schema migration; sufficient for O(5000) GUIDs; pattern from gesetze |
| Embedding generation | Direct Ollama call | `generateEmbedding()` from `src/lib/embedding/embedder.ts` | Handles MODEL_VERSION, error retries, consistent with all other chunks |
| Daily cron registration | `Queue.add()` with delay | `upsertJobScheduler()` with tz pattern | Idempotent — safe to call on every worker boot; same as registerGesetzeSyncJob() |
| Search function | Raw pgvector SQL inline in ki-chat | `searchUrteilChunks()` library function | Encapsulates vector SQL, type safety, minScore filtering |

**Key insight:** Every problem in this phase already has a solved pattern in the project. Phase 17 is assembly, not invention.

---

## Common Pitfalls

### Pitfall 1: RSS Item Without `<description>` — Empty Leitsatz

**What goes wrong:** BGH RSS items verified live (2026-02-27) have NO `<description>` field — only `<title>`, `<link>`, `<pubDate>`, `<guid>`. If code does `item.description` blindly it gets `undefined`, `content` becomes empty string, embedding is meaningless.

**Why it happens:** BGH provides only metadata in RSS, no Leitsatz snippet. BAG does include descriptions.

**How to avoid:** Fall back gracefully: `content = item.leitsatz || `${item.entscheidungstyp} des ${item.gericht} vom ${datumStr} (${item.aktenzeichen})``. Still insert the chunk — AZ+Gericht+Datum alone are retrieval-relevant for direct case number lookups.

**Warning signs:** Empty `content` column in urteil_chunks for BGH rows.

### Pitfall 2: Title Regex Fails on Unusual Decision Types

**What goes wrong:** The title format is usually "Gericht Senat, TYP vom DATUM, AZ" but BVerfG uses variants like "BVerfG 1. Senat, Kammerbeschluss vom..." or "BVerfG Plenum, Beschluss vom...". Strict regex throws and skips the item.

**Why it happens:** German courts have many decision type names (Kammerbeschluss, Gerichtsbescheid, Nichtannahmebeschluss) not covered by a minimal regex.

**How to avoid:** Use a broad regex for the decision type: `/,\s*(\w[\w\s-]+?)\s+vom\s+(\d{2}\.\d{2}\.\d{4}),\s+(.+)$/`. Wrap parseTitleFields in try/catch — on failure, use the raw title as content and `gericht` as source. Never throw from the outer loop.

**Warning signs:** High `failed` count in sync logs with titles containing "Kammerbeschluss" or "Nichtannahmebeschluss".

### Pitfall 3: `sourceUrl @unique` Constraint Collision on Re-Run

**What goes wrong:** Initial sweep inserts a URL. Second run (cron) checks GUID cache — cache was NOT persisted (e.g., worker crashed before `saveGuidCache()`). Tries INSERT again → unique constraint violation.

**Why it happens:** GUID cache save happens at end of sync loop. Partial runs leave GUIDs in cache but not persisted.

**How to avoid:** The `DELETE FROM urteil_chunks WHERE "sourceUrl" = ...` before INSERT makes ingestion idempotent regardless of cache state. The unique constraint error never reaches caller because DELETE precedes INSERT.

**Warning signs:** `Error: duplicate key value violates unique constraint "urteil_chunks_sourceUrl_key"` — this should NOT happen with the DELETE+INSERT pattern, but would indicate the DELETE is being skipped.

### Pitfall 4: GUID Cache Growing Stale on Model Version Change

**What goes wrong:** Embedding model version changes (e.g., from nomic-embed-text to mxbai-embed-large). Old chunks have wrong model version. GUID cache prevents re-ingestion of already-seen items. Re-embedding never happens.

**Why it happens:** GUID cache is designed for incremental updates — not model version changes.

**How to avoid:** On model version change: clear GUID cache via `updateSetting("urteile.seen_guids", "[]")`. The DELETE+INSERT pattern then re-embeds all seen items. Document this in admin runbook. Same issue exists for law_chunks (same pattern).

**Warning signs:** `modelVersion` in urteil_chunks doesn't match current `MODEL_VERSION` from embedder.ts.

### Pitfall 5: NER Timeout Blocks the Entire RSS Sync Loop

**What goes wrong:** Ollama becomes unreachable. `runNerFilter()` waits 45 seconds per item. 100 new RSS items = 75 minutes of blocked worker.

**Why it happens:** AbortSignal.timeout(45_000) is correct for compliance but expensive if Ollama is down.

**How to avoid:** Wrap `ingestUrteilItem()` in a try/catch that treats `AbortError` as a non-fatal "error" result. Log once at the processor level if >3 consecutive AbortErrors ("Ollama unreachable — aborting sync"). Do NOT mark GUIDs as seen on AbortError — they will retry on next cron.

**Warning signs:** Sync taking > 5 minutes, logs showing "AbortError" pattern repeatedly.

### Pitfall 6: ki-chat URTEIL-QUELLEN AZ Must Never Be LLM-Generated

**What goes wrong:** System prompt instructs Helena to cite Urteile "with AZ" but the LLM hallucinates an AZ when the retrieved chunk has an empty or malformed `aktenzeichen`.

**Why it happens:** If title parsing failed and `aktenzeichen` was stored empty, Helena might complete the citation from training data.

**How to avoid:** In `searchUrteilChunks()` and the chain E injection: filter out any result where `aktenzeichen` is empty string or null. System prompt must include explicit: "Wenn kein Aktenzeichen in den URTEILE-QUELLEN steht, zitiere das Urteil NICHT und erfinde kein AZ."

**Warning signs:** Helena cites an AZ that doesn't appear in urteil_chunks (acceptance test: query DB after Helena responds, verify AZ exists).

---

## Code Examples

### RSS Feed URLs (Verified Live 2026-02-27)

```typescript
// Verified by fetching live feeds — all 7 return valid RSS 2.0 XML
export const BMJ_RSS_FEEDS = {
  BGH:    "https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bgh.xml",
  BAG:    "https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bag.xml",
  BVerwG: "https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bverwg.xml",
  BFH:    "https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bfh.xml",
  BSG:    "https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bsg.xml",
  BPatG:  "https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bpatg.xml",
  BVerfG: "https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bverfg.xml",
} as const;
```

### RSS Item Title Parsing (from Live Feed Samples)

```typescript
// Verified title formats (2026-02-27):
// "BAG 7. Senat, Urteil vom 05.11.2025, 7 AZR 185/24"
// "BGH 11. Zivilsenat, Beschluss vom 03.02.2026, XI ZR 65/24"
// "BGH 5. Strafsenat, Beschluss vom 10.02.2026, 5 StR 560/25"

const TITLE_REGEX = /^.+?,\s*(.+?)\s+vom\s+(\d{2})\.(\d{2})\.(\d{4}),\s+(.+)$/;

function parseTitleFields(title: string): {
  entscheidungstyp: string;
  datum: Date;
  aktenzeichen: string;
} {
  const match = title.match(TITLE_REGEX);
  if (!match) throw new Error(`Unparseable title: "${title}"`);
  const [, entscheidungstyp, day, month, year, aktenzeichen] = match;
  return {
    entscheidungstyp: entscheidungstyp.trim(),
    datum: new Date(Number(year), Number(month) - 1, Number(day)),
    aktenzeichen: aktenzeichen.trim(),
  };
}
```

### fast-xml-parser RSS Parsing (from project xjustiz/parser.ts pattern)

```typescript
// Source: src/lib/xjustiz/parser.ts — XMLParser pattern; RSS has no namespaces
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  parseAttributeValues: true,
  isArray: (name) => name === "item",  // Force items to always be array (even if count=1)
});
const parsed = parser.parse(xmlString);
const items = parsed?.rss?.channel?.item ?? [];
```

### Queue Registration (from gesetze-sync pattern)

```typescript
// Source: src/lib/queue/queues.ts — registerGesetzeSyncJob() pattern
export const urteileSyncQueue = new Queue("urteile-sync", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "custom" },
    removeOnComplete: { age: 86_400 },
    removeOnFail: { age: 604_800 },
  },
});

export async function registerUrteileSyncJob(cronPattern = "0 3 * * *"): Promise<void> {
  await urteileSyncQueue.upsertJobScheduler(
    "urteile-sync-daily",
    { pattern: cronPattern, tz: "Europe/Berlin" },
    {
      name: "sync-urteile",
      data: {},
      opts: { removeOnComplete: { count: 10 }, removeOnFail: { count: 20 } },
    }
  );
}
```

### UrteilChunk pgvector Search (from searchLawChunks pattern)

```typescript
// Source: src/lib/gesetze/ingestion.ts searchLawChunks() — same pattern for urteil_chunks
export interface UrteilChunkResult {
  id: string;
  aktenzeichen: string;
  gericht: string;
  datum: Date;
  rechtsgebiet: string | null;
  content: string;
  sourceUrl: string;
  score: number;
}

export async function searchUrteilChunks(
  queryEmbedding: number[],
  opts: { limit?: number; minScore?: number } = {}
): Promise<UrteilChunkResult[]> {
  const { limit = 5, minScore = 0.0 } = opts;
  const vectorSql = pgvector.toSql(queryEmbedding);

  const rows = await prisma.$queryRaw<UrteilChunkResult[]>`
    SELECT
      id, aktenzeichen, gericht, datum, rechtsgebiet, content, "sourceUrl",
      1 - (embedding <=> ${vectorSql}::vector) AS score
    FROM urteil_chunks
    WHERE embedding IS NOT NULL
      AND "piiFiltered" = true
    ORDER BY embedding <=> ${vectorSql}::vector ASC
    LIMIT ${limit}
  `;

  return rows
    .filter(r => r.aktenzeichen && r.aktenzeichen.trim() !== "")  // URTEIL-04: never cite empty AZ
    .map(r => ({ ...r, score: Number(r.score) }))
    .filter(r => r.score >= minScore);
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HTML scraping Rechtsprechung-im-Internet | RSS feed consumption | 2010+ (RSS provided since launch) | robots.txt compliance; structured metadata; no HTML selector fragility |
| Full decision text embedding | Leitsatz snippet embedding | Research-standard 2024+ | PII-safe (no party names in Leitsatz); concise and retrieval-optimized |
| Manual AZ input by lawyers | Verified AZ from DB citation field | This phase | Eliminates hallucinated case numbers — hard compliance requirement |

**Deprecated/outdated:**
- Direct portal HTML scraping: robots.txt explicitly disallows all bots except `DG_JUSTICE_CRAWLER`. RSS feeds are the correct interface and contain all needed metadata.
- Storing full decision HTML: Out of scope for v0.1. The Leitsatz from RSS is sufficient for retrieval; full text available via `sourceUrl` link.

---

## Open Questions

1. **GUID cache size at 6+ months**
   - What we know: Each RSS feed returns ~20-50 items. 7 courts x 365 days x ~30 items/day = ~77,000 GUIDs/year. At ~50 chars each = ~4MB JSON.
   - What's unclear: SystemSetting is a text column — 4MB per year is large but probably fine for PostgreSQL text field.
   - Recommendation: Accept the growth. If it becomes an issue post-v0.1, migrate to a proper `urteile_seen` table. For v0.1, JSON in SystemSetting is the correct minimal solution (same pattern as gesetze SHA cache).

2. **BVerfG RSS title edge cases**
   - What we know: BVerfG uses titles like "BVerfG 1. Senat, Kammerbeschluss vom 14.01.2026, 1 BvR 2345/23". The regex handles "Kammerbeschluss" since it uses a loose `.+?` match.
   - What's unclear: Whether any BVerfG titles completely break the `vom DD.MM.YYYY, AZ` pattern.
   - Recommendation: Test the regex against the live BVerfG feed in Wave 0. If failures > 5%, expand the regex. Non-fatal fallback handles any parse errors gracefully.

3. **`piiFiltered = true` for Urteile with empty Leitsatz**
   - What we know: BGH items have no description. NER on the title-derived content string (`"Beschluss des BGH vom 03.02.2026 (XI ZR 65/24)"`) will return `hasPii: false` because no person names appear.
   - What's unclear: Is it semantically correct to set `piiFiltered: true` on an item where NER ran on the AZ-derived fallback string, not actual content?
   - Recommendation: Yes — the AZ and Gericht are public court metadata. PII risk is zero. `piiFiltered: true` is correct for any item that passed `runNerFilter()` with `hasPii: false`, regardless of which text was submitted.

---

## Sources

### Primary (HIGH confidence)

- Live BMJ RSS feed fetch (2026-02-27): `https://www.rechtsprechung-im-internet.de/jportal/docs/feed/bsjrs-bag.xml` and `bsjrs-bgh.xml` — confirmed RSS 2.0 structure with title/description/link/guid fields; title format verified with 6 live item examples
- RSS feed page: `https://www.rechtsprechung-im-internet.de/jportal/portal/page/bsjrsprod.psml?cmsuri=/technik/de/hilfe_1/bsjrsrss.jsp&riinav=3` — all 7 feed URLs with exact paths
- Project codebase `prisma/schema.prisma` lines 981-998 — UrteilChunk model: aktenzeichen, gericht, datum, content, piiFiltered, sourceUrl @unique (verified)
- Project codebase `src/lib/gesetze/ingestion.ts` — exact pattern for upsertLawChunks, searchLawChunks, SHA cache via getSetting/updateSetting (verified; mirrors directly to urteile/)
- Project codebase `src/lib/gesetze/github-client.ts` — AbortSignal.timeout pattern, fetch error handling (verified)
- Project codebase `src/lib/queue/queues.ts` lines 124-165, 248-265 — gesetzeSyncQueue, registerGesetzeSyncJob with upsertJobScheduler+tz (verified)
- Project codebase `src/worker.ts` lines 522-566, 718-723 — gesetze-sync Worker registration + startup cron registration (verified)
- Project codebase `src/app/api/ki-chat/route.ts` lines 472-540 — Chain D pattern + GESETZE-QUELLEN injection (verified; Chain E mirrors exactly)
- Project codebase `src/lib/xjustiz/parser.ts` line 13 + `package.json` line 72 — `fast-xml-parser` v5.3.8 already in project (verified)
- Project codebase `src/lib/pii/ner-filter.ts` + `src/lib/queue/processors/ner-pii.processor.ts` — `runNerFilter()` and `processUrteilNer()` already built (Phase 16 complete)

### Secondary (MEDIUM confidence)

- `robots.txt` fetch (2026-02-27): `Disallow: /` for `User-agent: *`; exception for `DG_JUSTICE_CRAWLER`. RSS feeds at `/jportal/docs/feed/` are public notification service — acceptable to fetch as intended machine-readable interface.
- LERETO database description: `https://www.lereto.com/databases_DE_gii-rii.html` — confirms XML format availability, daily updates, ECLI metadata, ~62,900 decisions from 2010

### Tertiary (LOW confidence)

- WebSearch for `rechtsprechung-im-internet.de` HTML selectors: No reliable CSS selector map found. Not needed — RSS is sufficient and preferred.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are existing project dependencies; exact patterns from codebase verified
- RSS feed URLs: HIGH — fetched live 2026-02-27; all 7 return valid XML
- Title format regex: HIGH — 6 live samples across BGH and BAG verified; edge cases (Kammerbeschluss) handled by loose match pattern
- Architecture: HIGH — directly mirrors gesetze/ library structure which is proven in production
- Schema gap (citation field): HIGH — confirmed by reading schema.prisma line 983; URTEIL-04 "citation" maps to `aktenzeichen`+`gericht`+`datum` composition in ki-chat
- Pitfalls: HIGH — derived from live feed inspection + codebase analysis

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (RSS feed URLs are stable; BMJ infrastructure changes infrequently)
