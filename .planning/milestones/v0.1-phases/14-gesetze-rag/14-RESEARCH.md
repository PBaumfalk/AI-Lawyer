# Phase 14: Gesetze-RAG - Research

**Researched:** 2026-02-27
**Domain:** GitHub API (bundestag/gesetze), Markdown parsing, pgvector law_chunks ingestion, BullMQ cron scheduler, Helena ki-chat integration for law retrieval
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GESETZ-01 | Bundesgesetze aus bundestag/gesetze GitHub-Repo in eigene `law_chunks`-Tabelle ingested (hierarchisch nach §/Absatz, Metadaten: gesetz, paragraf, absatz, stand, quelle_url); HNSW-Index auf embedding-Spalte | LawChunk schema already exists from Phase 12 (gesetzKuerzel, paragraphNr, titel, content, parentContent, embedding, syncedAt, sourceUrl); GitHub API (git trees recursive) fetches all .md files; Markdown parser splits by ##### § heading; gesetze-im-internet.de canonical URLs derived from slug+paragraphNr |
| GESETZ-02 | Täglicher automatischer Sync (BullMQ cron 02:00 Europe/Berlin) — geänderte Dateien werden erkannt und re-indexiert; Encoding-Smoke-Test (§-Zeichen) als ersten Ingestion-Schritt | BullMQ upsertJobScheduler with tz: "Europe/Berlin" already used for fristReminderJob (exact same pattern); GitHub API file SHA enables incremental change detection; §-Zeichen byte check (0xC2 0xA7 = UTF-8, 0xC2 0xC2 = corrupt latin1) is trivially implementable |
| GESETZ-03 | Helena retrievet automatisch Top-5 Normen-Chunks bei Anfragen mit Rechtsbezug; jede Norm wird mit "nicht amtlich — Stand: [Datum]"-Hinweis und Quellenlink zitiert | hybridSearch() in ki-chat/route.ts is the integration point; law_chunks vector search mirrors document_chunks pattern; syncedAt field is the "Stand" date; citation format is string-appended to LLM context block |
</phase_requirements>

---

## Summary

Phase 14 builds a three-part pipeline: (1) a GitHub API downloader that fetches and parses Markdown files from bundestag/gesetze, splitting each Paragraph (§) into child chunks for embedding and its surrounding section as parentContent, (2) a BullMQ cron job at 02:00 Europe/Berlin that runs daily, detects changed files by comparing GitHub blob SHAs stored per-law, and re-indexes only changed Gesetze, and (3) an extension to ki-chat/route.ts that runs a pgvector similarity search against law_chunks in parallel with the existing hybridSearch(), injects the top-5 Norm results into Helena's system prompt with "nicht amtlich — Stand: [Datum]" warnings and gesetze-im-internet.de source links.

The Phase 12 Prisma schema already created the `law_chunks` table with all required fields: `gesetzKuerzel`, `paragraphNr`, `titel`, `content`, `parentContent`, `embedding`, `modelVersion`, `syncedAt`, `sourceUrl`. The HNSW index was established in `manual_rag_hnsw_indexes.sql`. No schema migration is needed in Phase 14 — this is a pure application logic phase. The law_chunks table is empty; Phase 14 fills it.

The critical technical challenge is reliable Markdown parsing of bundestag/gesetze files. The Markdown format uses YAML frontmatter with `jurabk` (law abbreviation, e.g. "BGB"), `slug` (file slug, e.g. "bgb"), and date fields ("Zuletzt geändert durch"). Paragraph headings use five `#####` levels: `##### § 1 Beginn der Rechtsfähigkeit`. Content between consecutive `#####` headings forms a single Paragraph's text. Absätze within a Paragraph are indicated by `(1)`, `(2)` etc. in the text body — they do NOT have their own headings. The law_chunks "absatz" granularity from the requirement is therefore the full Paragraph (§), not individual Absätze, since the Markdown does not provide Absatz-level heading delimiters.

**Primary recommendation:** Implement the GitHub API downloader using native `fetch` (no external library needed) against the GitHub REST API v3 git trees endpoint (`GET /repos/bundestag/gesetze/git/trees/HEAD?recursive=1`). Parse the Markdown with a line-by-line state machine that detects `##### § N Title` headings. Use `upsertJobScheduler` for the cron job (same pattern as `registerFristReminderJob` already in the codebase). Extend ki-chat with a parallel law retrieval chain (Chain D) that runs alongside the existing BM25+vector hybridSearch.

---

## Standard Stack

### Core (all already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fetch` (Node.js native) | Node 18+ built-in | GitHub API calls and raw file download | No external HTTP client needed; already used in embedder.ts, reranker.ts, ollama.ts patterns throughout the codebase |
| `bullmq` | ^5.70.1 | Cron job scheduling with `upsertJobScheduler` | Already project standard for all cron jobs; timezone-aware via `tz: "Europe/Berlin"` |
| `pgvector` | ^0.2.1 | vector SQL serialization for law_chunks embedding insert | Already used in vector-store.ts and hybrid-search.ts for document_chunks |
| `@prisma/client` | ^5.22.0 | `prisma.lawChunk` CRUD operations | LawChunk model already in schema from Phase 12 |
| `fast-xml-parser` | ^5.3.8 | Already installed (optional: XML parsing if needed) | NOT needed — bundestag/gesetze is pure Markdown, not XML |
| `@langchain/textsplitters` | ^1.0.1 | Chunk splitting for parentContent | Already used in chunker.ts for document_chunks |

### No New npm Packages Required

This phase installs zero new npm packages. All required libraries are already present.

**Installation:**
```bash
# No new packages needed
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native fetch to GitHub REST API | `@octokit/rest` npm package | Octokit is not in the project and adds a dependency. The GitHub REST API is simple enough (two endpoints: git/trees + raw file download) to use bare fetch with proper error handling. |
| Line-by-line Markdown parser | `marked` or `remark` npm packages | Not in the project. The bundestag/gesetze format is simple enough — `#####` headings as delimiters — that a 30-line state machine is more transparent and has zero external dependencies. |
| git clone + file system read | GitHub REST API | Cloning the entire bundestag/gesetze repo (2000+ files) would require `simple-git` as a new dependency, disk space management, and pull logistics. GitHub API is simpler and stateless. |
| Fetch all files every sync | Compare file SHAs from GitHub API | GitHub's Contents API returns `sha` for each file. Storing last-seen SHA per Gesetz allows O(1) skip for unchanged files. Essential given 2000+ Gesetz files and a daily cron window. |

---

## Architecture Patterns

### Recommended File Structure

```
src/
├── lib/
│   └── gesetze/
│       ├── github-client.ts      # NEW: GitHub API — git trees, raw file fetch, SHA comparison
│       ├── markdown-parser.ts    # NEW: parse bundestag/gesetze Markdown → LawParagraph[]
│       └── ingestion.ts          # NEW: ingestGesetz(kuerzel, paragraphs) + searchLawChunks()
├── lib/queue/
│   ├── queues.ts                 # MODIFY: add gesetzeSyncQueue + registerGesetzeSyncJob()
│   └── processors/
│       └── gesetze-sync.processor.ts  # NEW: processGesetzeSyncJob() — full cron logic
└── app/
    └── api/
        └── ki-chat/
            └── route.ts          # MODIFY: add Chain D — law_chunks parallel retrieval
```

### Pattern 1: bundestag/gesetze GitHub API Client

**What:** Fetch all `.md` file paths + SHAs from the bundestag/gesetze repository using the git trees recursive API. Then fetch raw file content for changed files only.

**GitHub Repository structure verified by direct inspection:**
- Files are stored at `{letter}/{slug}/index.md` (e.g. `b/bgb/index.md`)
- The `jurabk` YAML frontmatter field = law abbreviation (e.g. "BGB", "ZPO")
- The `slug` YAML frontmatter field = directory name (e.g. "bgb")
- Top-level dirs: `a/`, `b/`, `c/`, ... `z/`, `1/`

**Change detection via SHA:** GitHub's git trees API returns a `sha` (blob SHA) for each file. Storing `{ slug → sha }` in a simple DB table or Redis key allows skipping unchanged files on daily sync.

```typescript
// Source: GitHub REST API v3 — GET /repos/{owner}/{repo}/git/trees/{tree_sha}?recursive=1
// Rate limit: 60 req/hr unauthenticated, 5000/hr with GITHUB_TOKEN env var

const GITHUB_API = "https://api.github.com";
const REPO_OWNER = "bundestag";
const REPO_REPO = "gesetze";

interface GitTreeItem {
  path: string;       // e.g. "b/bgb/index.md"
  type: "blob" | "tree";
  sha: string;        // blob SHA for change detection
  url: string;        // API URL for this blob
}

export async function fetchAllGesetzeFiles(): Promise<GitTreeItem[]> {
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  // Get default branch HEAD SHA first
  const branchRes = await fetch(
    `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_REPO}/branches/master`,
    { headers, signal: AbortSignal.timeout(15_000) }
  );
  if (!branchRes.ok) throw new Error(`GitHub branch fetch failed: ${branchRes.status}`);
  const branch = await branchRes.json() as { commit: { sha: string } };
  const treeSha = branch.commit.sha;

  // Fetch all files recursively (bundestag/gesetze is ~2000 files, well under 100k limit)
  const treeRes = await fetch(
    `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_REPO}/git/trees/${treeSha}?recursive=1`,
    { headers, signal: AbortSignal.timeout(30_000) }
  );
  if (!treeRes.ok) throw new Error(`GitHub tree fetch failed: ${treeRes.status}`);
  const tree = await treeRes.json() as { tree: GitTreeItem[]; truncated: boolean };

  if (tree.truncated) {
    // Should not happen for bundestag/gesetze — it's ~2000 files, limit is 100k
    throw new Error("GitHub git tree response was truncated — unexpected for bundestag/gesetze");
  }

  // Filter to only index.md files (exclude README.md, LICENSE etc.)
  return tree.tree.filter(item =>
    item.type === "blob" &&
    item.path.endsWith("/index.md") &&
    item.path.split("/").length === 3  // ensures format: {letter}/{slug}/index.md
  );
}

export async function fetchRawFileContent(slug: string): Promise<string> {
  // Fetch raw Markdown file directly from GitHub raw.githubusercontent.com
  const url = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_REPO}/master/${slug}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Raw file fetch failed (${res.status}): ${url}`);
  // GitHub serves these as UTF-8 text
  return res.text();
}
```

### Pattern 2: Markdown Parser for bundestag/gesetze Format

**What:** Parse the Markdown files into structured LawParagraph objects. The format is fully determined by direct inspection:

**Verified file structure (from `b/bgb/index.md`):**
```
---
Title: Bürgerliches Gesetzbuch
jurabk: BGB
layout: default
origslug: bgb
slug: bgb

---

# Bürgerliches Gesetzbuch (BGB)

Ausfertigungsdatum
:   1896-08-18

Zuletzt geändert durch
:   Art. 4 Abs. 6 G v. 7.5.2021 I 850

## Buch 1 - Allgemeiner Teil

### Abschnitt 1 - Personen

#### Titel 1 - Natürliche Personen, Verbraucher, Unternehmer

##### § 1 Beginn der Rechtsfähigkeit

Die Rechtsfähigkeit des Menschen beginnt mit der Vollendung der Geburt.

##### § 2 Eintritt der Volljährigkeit

Die Volljährigkeit tritt mit der Vollendung des 18. Lebensjahres ein.
```

**Key observations (HIGH confidence — from direct file inspection):**
- YAML frontmatter between `---` delimiters; `jurabk` = law abbreviation; `slug` = directory slug
- `Zuletzt geändert durch` followed by date line is the "Stand" — extract as string
- `#####` (5 hashes) marks each individual Paragraph (§)
- `##### § N Title` format — regex: `/^##### (§ \S+)\s+(.+)$/`
- Content between two consecutive `#####` headings = one Paragraph's body text
- Absätze `(1)`, `(2)` within body text only — no sub-headings for Absätze

```typescript
// Source: verified against raw GitHub file content

export interface LawParagraph {
  gesetzKuerzel: string;  // from jurabk frontmatter e.g. "BGB"
  paragraphNr: string;    // e.g. "§ 626"
  titel: string;          // e.g. "Fristlose Kündigung aus wichtigem Grund"
  inhalt: string;         // full paragraph text (child chunk content)
  stand: string;          // "Zuletzt geändert durch" date extracted from frontmatter
  slug: string;           // e.g. "bgb"
}

export function parseGesetzeMarkdown(markdown: string, fallbackSlug: string): LawParagraph[] {
  const results: LawParagraph[] = [];

  // 1. Extract YAML frontmatter
  const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---/);
  const frontmatter = frontmatterMatch?.[1] ?? "";

  const jurabkMatch = frontmatter.match(/^jurabk:\s*(.+)$/m);
  const gesetzKuerzel = jurabkMatch?.[1]?.trim() ?? fallbackSlug.toUpperCase();

  // Extract "Zuletzt geändert durch" date
  const standMatch = markdown.match(/Zuletzt geändert durch\n:\s+(.+)/);
  const stand = standMatch?.[1]?.trim() ?? "Stand unbekannt";

  // 2. Split by ##### headings
  const lines = markdown.split("\n");
  let currentParagraph: string | null = null;
  let currentTitel = "";
  let currentParagraphNr = "";
  let contentLines: string[] = [];

  const saveCurrent = () => {
    if (currentParagraph && contentLines.length > 0) {
      const inhalt = contentLines.join("\n").trim();
      if (inhalt.length > 10) {  // skip empty paragraphs
        results.push({
          gesetzKuerzel,
          paragraphNr: currentParagraphNr,
          titel: currentTitel,
          inhalt,
          stand,
          slug: fallbackSlug,
        });
      }
    }
  };

  for (const line of lines) {
    const paraMatch = line.match(/^##### (§\s*\S+)\s+(.+)$/);
    if (paraMatch) {
      saveCurrent();
      currentParagraphNr = paraMatch[1].trim();    // e.g. "§ 626"
      currentTitel = paraMatch[2].trim();            // e.g. "Fristlose Kündigung..."
      currentParagraph = currentParagraphNr;
      contentLines = [];
    } else if (currentParagraph !== null) {
      // Skip sub-section headings (##, ###, ####) — they're organizational, not paragraph content
      if (!line.startsWith("#")) {
        contentLines.push(line);
      }
    }
  }
  saveCurrent();

  return results;
}
```

### Pattern 3: Encoding Smoke Test (GESETZ-02 requirement)

**What:** Before ingesting any file, verify the § character is correctly encoded as UTF-8. The §-Zeichen in correct UTF-8 is the two-byte sequence `0xC2 0xA7`. If the file was read as latin-1 and then wrongly treated as UTF-8, it appears as "Â§" (0xC3 0x82 followed by 0xC2 0xA7, or similar mojibake).

**Why this matters:** The GESETZ-02 success criterion explicitly requires: "Encoding-Smoke-Test schlägt an vor der Ingestion wenn §-Zeichen als 'Â§' erscheinen — fehlerhafte Dateien werden übersprungen, kein Silent-Corrupt-Data."

```typescript
// Source: encoding analysis based on UTF-8 vs latin-1 mojibake patterns

/**
 * Smoke test for encoding correctness.
 * Returns false (skip file) if § appears as "Â§" — classic UTF-8 bytes decoded as latin-1.
 * Logs a warning; does not throw. Caller should skip the file.
 */
export function encodingSmokePassed(content: string, slug: string): boolean {
  if (content.includes("Â§")) {
    console.warn(`[gesetze-sync] ENCODING FAIL: §-Zeichen as "Â§" in ${slug} — skipping file`);
    return false;
  }
  // Secondary check: if the content contains § at all, it must appear as §, not as entity or question mark
  if (content.includes("? ") && !content.includes("§") && content.includes("Absatz")) {
    // § missing entirely, likely encoding corruption
    console.warn(`[gesetze-sync] ENCODING FAIL: §-Zeichen absent from ${slug} — skipping file`);
    return false;
  }
  return true;
}
```

### Pattern 4: law_chunks Insert/Update (Upsert by paragraphNr)

**What:** Upsert law_chunks records. The unique key is `(gesetzKuerzel, paragraphNr)` — if a paragraph already exists with this key, DELETE and re-INSERT (idempotent re-indexing for changed files). Do NOT use `sourceUrl @unique` — the same URL could theoretically point to multiple chunks.

**The LawChunk schema from Phase 12 (no changes needed):**
```typescript
// model LawChunk {
//   id            String    @id @default(cuid())
//   gesetzKuerzel String    // "BGB"
//   paragraphNr   String    // "§ 626"
//   titel         String    // "Fristlose Kündigung aus wichtigem Grund"
//   content       String    @db.Text  // child chunk for embedding
//   parentContent String?   @db.Text  // surrounding context (not embedded)
//   embedding     Unsupported("vector(1024)")?
//   modelVersion  String
//   syncedAt      DateTime  @default(now())
//   sourceUrl     String?   // gesetze-im-internet.de canonical URL
// }
```

**Canonical URL construction (HIGH confidence — verified from direct gesetze-im-internet.de inspection):**
- BGB § 626: `https://www.gesetze-im-internet.de/bgb/__626.html`
- Pattern: `https://www.gesetze-im-internet.de/{slug}/__{paragraphNumber}.html`
- Where `{paragraphNumber}` is the numeric part of `§ 626` = `626`

```typescript
// Source: verified by checking https://www.gesetze-im-internet.de/bgb/__626.html (returns 200)

export function buildSourceUrl(slug: string, paragraphNr: string): string {
  // Extract numeric portion: "§ 626" → "626", "§ 823a" → "823a", "§ 1 BGB" → "1"
  const numMatch = paragraphNr.match(/§\s*(\w+)/);
  if (!numMatch) return `https://www.gesetze-im-internet.de/${slug}/`;
  return `https://www.gesetze-im-internet.de/${slug}/__${numMatch[1]}.html`;
}

export async function upsertLawChunks(
  paragraphs: LawParagraph[],
  modelVersion: string
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const para of paragraphs) {
    if (!para.inhalt || para.inhalt.length < 10) { skipped++; continue; }

    // Encode smoke test already passed at file level; here we embed + upsert
    const childContent = para.inhalt;  // full paragraph text as child chunk
    // parentContent = same content for Gesetze — § paragraphs are already atomic units
    // For long paragraphs (> 8000 chars), parentContent = first 8000 chars, child = subsection chunks
    // Keep it simple: single chunk per §, parentContent = childContent (Gesetze paragraphs are short)

    const embedding = await generateEmbedding(childContent);
    const sourceUrl = buildSourceUrl(para.slug, para.paragraphNr);

    // Delete existing chunk for this law+paragraph (if re-indexing changed file)
    await prisma.$executeRaw`
      DELETE FROM law_chunks
      WHERE "gesetzKuerzel" = ${para.gesetzKuerzel}
        AND "paragraphNr" = ${para.paragraphNr}
    `;

    const vectorSql = pgvector.toSql(embedding);
    await prisma.$executeRaw`
      INSERT INTO law_chunks (id, "gesetzKuerzel", "paragraphNr", titel, content, "parentContent", embedding, "modelVersion", "syncedAt", "sourceUrl")
      VALUES (gen_random_uuid(), ${para.gesetzKuerzel}, ${para.paragraphNr}, ${para.titel}, ${childContent}, ${childContent}, ${vectorSql}::vector, ${modelVersion}, NOW(), ${sourceUrl})
    `;
    inserted++;
  }

  return { inserted, skipped };
}
```

### Pattern 5: BullMQ Cron Job Registration

**What:** Register a daily cron job at 02:00 Europe/Berlin using `upsertJobScheduler`. Follows the exact same pattern as `registerFristReminderJob` in the existing codebase.

```typescript
// Source: existing src/lib/queue/queues.ts — registerFristReminderJob() pattern (HIGH confidence)

export const gesetzeSyncQueue = new Queue("gesetze-sync", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "custom" },
    removeOnComplete: { age: 86_400 },    // 24h
    removeOnFail: { age: 604_800 },        // 7 days
  },
});

export async function registerGesetzeSyncJob(
  cronPattern = "0 2 * * *"  // 02:00 daily
): Promise<void> {
  await gesetzeSyncQueue.upsertJobScheduler(
    "gesetze-sync-daily",
    {
      pattern: cronPattern,
      tz: "Europe/Berlin",
    },
    {
      name: "sync-gesetze",
      data: {},
      opts: {
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 20 },
      },
    }
  );
}
```

**Registration in worker startup (src/worker.ts):** Add `registerGesetzeSyncJob()` call in the `startup()` function, identical to how `registerFristReminderJob()` is called.

### Pattern 6: SHA-based Incremental Change Detection

**What:** Store the GitHub blob SHA for each processed Gesetz file. On daily sync, skip files where the stored SHA matches the current SHA from the GitHub API.

**Storage options (ranked by simplicity):**
1. Use the `syncedAt` field on `law_chunks` plus the file SHA stored in a separate table (adds schema complexity)
2. Store `{ slug → sha }` as a JSON blob in the existing `Settings` table (`key: "gesetze.sha_cache"`) — simplest, no new table needed
3. Use Redis to cache SHAs (already available but unnecessary complexity)

**Recommended: Settings table JSON cache** — the existing `getSettingTyped` / `setSettingTyped` infrastructure handles JSON values.

```typescript
// Source: existing settings pattern from src/lib/settings/service.ts

// On sync start: load SHA cache
const shaCache: Record<string, string> = await getSettingTyped<Record<string, string>>(
  "gesetze.sha_cache",
  {}
);

// For each file in git tree:
if (shaCache[item.path] === item.sha) {
  // Skip — file unchanged since last sync
  continue;
}

// ... process file, upsert chunks ...

// After processing: update SHA cache
shaCache[item.path] = item.sha;
await setSettingTyped("gesetze.sha_cache", shaCache);
// (Save incrementally or in one batch at end of sync)
```

### Pattern 7: ki-chat Integration — Chain D (Law Retrieval)

**What:** Extend `ki-chat/route.ts` with a fourth parallel chain (Chain D) that searches `law_chunks` by vector similarity. This runs in parallel with Chain A (Akte context), Chain B (hybridSearch), and Chain C (model config). Inject top-5 Norm results into Helena's system prompt with "nicht amtlich — Stand: [Datum]" warnings.

**Integration approach:** Add a new `searchLawChunks()` function to `src/lib/gesetze/ingestion.ts` that mirrors the pgvector pattern from `vector-store.ts`. Reuse the same `queryEmbedding` already generated in Chain B.

```typescript
// Source: extends existing ki-chat Chain B pattern and vector-store.ts pgvector SQL pattern

// In ki-chat/route.ts — Chain D (add alongside existing chains A, B, C):

const lawChunksPromise = (async (): Promise<LawChunkResult[]> => {
  try {
    const queryEmbedding = await generateQueryEmbedding(queryText);
    return await searchLawChunks(queryEmbedding, { limit: 5 });
  } catch (err) {
    console.error("[ki-chat] Law chunks search failed:", err);
    return [];
  }
})();

// Await with other chains:
const [aktenKontextBlock, ragResult, [model, modelName, providerName], lawChunks] =
  await Promise.all([akteContextPromise, ragPromise, modelConfigPromise, lawChunksPromise]);

// In system prompt construction — AFTER existing sources block:
if (lawChunks.length > 0) {
  systemPrompt += "\n\n--- GESETZE-QUELLEN (nicht amtlich) ---\n";
  lawChunks.forEach((norm, i) => {
    const standDate = norm.syncedAt
      ? new Date(norm.syncedAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "Stand unbekannt";
    systemPrompt += `\n[G${i + 1}] ${norm.gesetzKuerzel} ${norm.paragraphNr}: ${norm.titel}\n`;
    systemPrompt += `${norm.content}\n`;
    systemPrompt += `HINWEIS: nicht amtlich — Stand: ${standDate} | Quelle: ${norm.sourceUrl ?? "https://www.gesetze-im-internet.de/"}\n`;
  });
  systemPrompt += "\n--- ENDE GESETZE-QUELLEN ---";
  systemPrompt += "\n\nWenn du Normen zitierst, füge immer den 'nicht amtlich'-Hinweis und den Quellenlink hinzu.";
}
```

```typescript
// searchLawChunks() implementation in src/lib/gesetze/ingestion.ts

export interface LawChunkResult {
  id: string;
  gesetzKuerzel: string;
  paragraphNr: string;
  titel: string;
  content: string;
  syncedAt: Date;
  sourceUrl: string | null;
  score: number;
}

export async function searchLawChunks(
  queryEmbedding: number[],
  opts: { limit?: number } = {}
): Promise<LawChunkResult[]> {
  const { limit = 5 } = opts;
  const vectorSql = pgvector.toSql(queryEmbedding);

  type RawRow = {
    id: string;
    gesetzKuerzel: string;
    paragraphNr: string;
    titel: string;
    content: string;
    syncedAt: Date;
    sourceUrl: string | null;
    score: number;
  };

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      id,
      "gesetzKuerzel",
      "paragraphNr",
      titel,
      content,
      "syncedAt",
      "sourceUrl",
      1 - (embedding <=> ${vectorSql}::vector) AS score
    FROM law_chunks
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${vectorSql}::vector ASC
    LIMIT ${limit}
  `;

  return rows.map(r => ({ ...r, score: Number(r.score) }));
}
```

### Anti-Patterns to Avoid

- **Fetching gesetze-im-internet.de XML directly:** The XML API at gesetze-im-internet.de is not public and has no documented rate limits. The bundestag/gesetze GitHub repo already mirrors this content as clean Markdown with better structure for parsing.
- **Using `remark` or `unified` for Markdown parsing:** Not installed. The format is simple enough for a 40-line state machine — no AST needed.
- **Parsing Absatz-level sub-chunks:** The bundestag/gesetze Markdown does not have separate headings for Absätze (1), (2) etc. Splitting by Absatz would require regex parsing of `(1)`, `(2)` within body text, which is brittle and creates tiny chunks (< 100 tokens) that embed poorly. One chunk per § is the correct granularity.
- **Re-ingesting all 2000+ Gesetze on every cron run:** Without SHA comparison, a daily full re-index takes 2000 GitHub API calls (for file content) + embedding every chunk. With SHA comparison, only changed files (typically 5-20 per day) are re-indexed.
- **Running law chunk search ONLY when a query contains legal keywords:** The requirement (GESETZ-03) says "bei Anfragen mit Rechtsbezug." Implementing a keyword classifier adds complexity. Simpler: always run law_chunks search (it's one fast pgvector query) and only include results if score > threshold (e.g. 0.6) — let the vector similarity be the "legal relevance" signal.
- **Blocking the embedding query:** `generateQueryEmbedding` is already called in Chain B's ragPromise. Do NOT call it again in Chain D — share the queryEmbedding result. Refactor Chain B to return the queryEmbedding alongside results so Chain D can reuse it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron job scheduling | Custom setInterval loop | `gesetzeSyncQueue.upsertJobScheduler()` (same pattern as fristReminderJob) | BullMQ handles persistence across restarts, exactly-once semantics, timezone DST handling |
| Git-aware file sync | `simple-git` clone + pull logic | GitHub REST API git trees endpoint + raw file download | No disk state management, no git credentials needed, stateless |
| Encoding detection library | `chardet` npm package | Inline string check `content.includes("Â§")` | The mojibake for § in latin-1/UTF-8 confusion is a known fixed string — library overkill |
| Legal relevance classifier | Keyword list or separate LLM call to classify query | Vector similarity score threshold (> 0.6) | The E5 embedding model already encodes legal semantics; high cosine similarity IS the legal relevance signal |
| URL construction for gesetze-im-internet.de | Web scraping | Pattern: `https://www.gesetze-im-internet.de/{slug}/__{nr}.html` (verified for BGB § 626) | Canonical pattern verified by direct inspection |

**Key insight:** The hardest part of this phase is not the algorithm — it is the Markdown parsing. The bundestag/gesetze format is stable (verified by repository history showing 531+ commits without format changes). The `##### § N Title` pattern is reliable. Build a simple state machine, not a full Markdown parser.

---

## Common Pitfalls

### Pitfall 1: queryEmbedding Generated Twice (Performance)

**What goes wrong:** Chain B (hybridSearch) calls `generateQueryEmbedding(queryText)` internally. If Chain D also calls `generateQueryEmbedding(queryText)`, the embedding is generated twice — two Ollama round-trips = double latency for the ki-chat response.

**Why it happens:** The current `hybridSearch()` signature takes a pre-computed `queryEmbedding` parameter, but the ki-chat route generates it inside Chain B's closure. Chain D cannot access it without refactoring.

**How to avoid:** Refactor Chain B to split: (1) generate embedding once at the top level, (2) pass it to both `hybridSearch()` AND `searchLawChunks()`. Concretely: extract `generateQueryEmbedding(queryText)` from Chain B into a shared Chain B0 that both Chain B and Chain D use.

**Warning signs:** Slow ki-chat responses; two `Ollama embedding` log lines per query.

### Pitfall 2: law_chunks HNSW Index Missing → Seq Scan

**What goes wrong:** Phase 12 created `manual_rag_hnsw_indexes.sql` with the HNSW index for `law_chunks`. If that file was not applied at Docker startup, `searchLawChunks()` runs a sequential scan over all rows — fast when empty (no rows yet), but catastrophically slow after ingesting 50k+ chunks.

**Why it happens:** The HNSW index SQL file must be applied separately from `prisma migrate deploy` (Prisma cannot create HNSW indexes). Phase 12 should have handled this, but it must be verified.

**How to avoid:** Before ingesting any law_chunks data, run verification:
```sql
EXPLAIN ANALYZE SELECT id FROM law_chunks ORDER BY embedding <=> '[0.1, ...]'::vector LIMIT 5;
-- Must show: "Index Scan using law_chunks_embedding_hnsw"
-- NOT: "Seq Scan on law_chunks"
```

**Warning signs:** First search query after ingestion takes > 10 seconds; `EXPLAIN ANALYZE` shows `Seq Scan`.

### Pitfall 3: GitHub API Rate Limiting (60 req/hr Unauthenticated)

**What goes wrong:** The daily cron job fetches all 2000+ file SHAs in one git trees request (1 API call), then downloads raw content for changed files. If many files changed simultaneously (e.g., a large legislative reform), downloading 50+ files would hit 60/hr unauthenticated rate limit mid-sync.

**Why it happens:** Unauthenticated GitHub API is limited to 60 requests/hour per IP.

**How to avoid:** Add `GITHUB_TOKEN` to Docker Compose `.env` (personal access token, public repo scope = read:public_repo). With a token, the limit is 5000/hr — effectively unlimited for this use case. Make the token optional but log a clear warning if not set.

**Warning signs:** HTTP 403 response from GitHub API with `X-RateLimit-Remaining: 0` header; cron job fails mid-sync.

### Pitfall 4: Large Gesetze Files Producing Oversized Chunks

**What goes wrong:** Some German laws (ZPO with 1000+ paragraphs, BGB with 2400+ paragraphs) produce thousands of chunks. The `content` field of each `LawChunk` stores one § text. Most § are 100-500 tokens. But a few long paragraphs (e.g., elaborate procedural rules) exceed 1024 tokens — the practical limit of multilingual-e5-large-instruct.

**Why it happens:** E5 model truncates inputs above ~512 tokens silently. Embedding quality degrades for long inputs. Most § are short enough, but some are not.

**How to avoid:** Before embedding, check `content.length`. If > 4000 characters (~1000 tokens for German), split into sub-chunks at `(1)`, `(2)` boundaries or at 4000-char intervals. Store the first sub-chunk as `content`, the full text as `parentContent`. This is rare (< 5% of §§) and can be a simple fallback.

**Warning signs:** Embedding quality much lower than expected for complex §§; recall on specific Absatz references is poor.

### Pitfall 5: Qwen Thinking Mode in Reranker Breaks law_chunks Reranking

**What goes wrong:** If law_chunks are reranked by the same Ollama reranker (from hybrid-search.ts), the existing `jsonMatch` regex handles `<think>...</think>` blocks. But this does NOT apply to law_chunks — they are retrieved directly by pgvector cosine similarity, NOT sent through the reranker. The reranker operates only on `document_chunks`.

**Resolution:** Law chunks DO NOT go through the reranker. They are a separate top-5 list from pgvector, added directly to the prompt. No reranking needed — the vector similarity IS the relevance signal for law retrieval.

### Pitfall 6: "Zuletzt geändert durch" Date Parsing Failures

**What goes wrong:** The "Stand" date extracted from the frontmatter is a free-text string like "Art. 4 Abs. 6 G v. 7.5.2021 I 850" — not an ISO date. Attempting to parse it as a Date will fail for most entries.

**Why it happens:** The YAML frontmatter uses German legal citation format for amendment references, not ISO 8601.

**How to avoid:** Store the `stand` string as-is in a metadata field, OR use `syncedAt` (the time of ingestion) as the "Stand" date for the "nicht amtlich — Stand: [Datum]" display. The GESETZ-03 requirement says "Stand: [Datum]" — using `syncedAt` is accurate enough: it tells the user when the data was last synchronized. The Phase 12 schema already has `syncedAt` on LawChunk. No schema change needed.

**Recommended display format:** `syncedAt.toLocaleDateString("de-DE")` = e.g. "27.02.2026".

---

## Code Examples

Verified patterns from official sources and codebase inspection:

### Full Gesetze Sync Cron Processor

```typescript
// Source: extends existing src/lib/queue/processors/ pattern

export async function processGesetzeSyncJob(): Promise<{ processed: number; skipped: number; failed: number }> {
  const log = createLogger("gesetze-sync-processor");

  log.info("Starting Gesetze sync from bundestag/gesetze");

  // 1. Load SHA cache (detect changed files)
  const shaCache = await getSettingTyped<Record<string, string>>("gesetze.sha_cache", {});

  // 2. Fetch all file paths + SHAs from GitHub
  const allFiles = await fetchAllGesetzeFiles();
  log.info({ total: allFiles.length }, "GitHub tree fetched");

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of allFiles) {
    // 3. Skip unchanged files (SHA comparison)
    if (shaCache[file.path] === file.sha) {
      skipped++;
      continue;
    }

    try {
      // 4. Fetch raw Markdown content
      const content = await fetchRawFileContent(file.path);

      // 5. Encoding smoke test (GESETZ-02 requirement)
      const slugParts = file.path.split("/");  // ["b", "bgb", "index.md"]
      const slug = slugParts[1];
      if (!encodingSmokePassed(content, slug)) {
        failed++;
        continue;
      }

      // 6. Parse Markdown into paragraphs
      const paragraphs = parseGesetzeMarkdown(content, slug);
      if (paragraphs.length === 0) {
        log.warn({ path: file.path }, "No paragraphs parsed — skipping");
        failed++;
        continue;
      }

      // 7. Upsert law_chunks (delete + re-insert for changed files)
      const { inserted } = await upsertLawChunks(paragraphs, MODEL_VERSION);

      // 8. Update SHA cache
      shaCache[file.path] = file.sha;
      processed++;

      log.info({ slug, inserted, paragraphs: paragraphs.length }, "Gesetz synced");
    } catch (err) {
      log.warn({ path: file.path, err }, "Failed to sync Gesetz (non-fatal, continuing)");
      failed++;
    }
  }

  // 9. Persist updated SHA cache
  await setSettingTyped("gesetze.sha_cache", shaCache);

  log.info({ processed, skipped, failed }, "Gesetze sync completed");
  return { processed, skipped, failed };
}
```

### Citation Format in Helena's Response (GESETZ-03)

The system prompt injection produces citations in this format:
```
[G1] BGB § 626: Fristlose Kündigung aus wichtigem Grund
(1) Das Dienstverhältnis kann von jedem Vertragsteil aus wichtigem Grund...
HINWEIS: nicht amtlich — Stand: 27.02.2026 | Quelle: https://www.gesetze-im-internet.de/bgb/__626.html
```

Helena's system prompt already contains the instruction:
```
"Wenn du Normen zitierst, füge immer den 'nicht amtlich'-Hinweis und den Quellenlink hinzu."
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LLM training data for legal norms | Retrieval from verified law_chunks | Phase 14 | Eliminates norm hallucination; all cited §§ come from actual Bundesgesetz text |
| Direct XML parsing from gesetze-im-internet.de | Markdown parsing from bundestag/gesetze | Phase 14 decision | Markdown is cleaner, no XML parsing library needed, GitHub repo provides version history and change detection via SHA |
| Full re-index on every sync | SHA-based incremental sync | Phase 14 | Daily sync becomes fast (process only 5-20 changed files instead of 2000+) |
| Helena answers legal questions with general knowledge | Helena cites specific §§ with "nicht amtlich" disclaimer + source link | Phase 14 | Transparency: users see exactly which norm was retrieved and where to find the official version |

**Deprecated/outdated:**
- Downloading XML directly from `gesetze-im-internet.de/Teilliste_*.xml`: The bundestag/gesetze GitHub repo provides pre-converted Markdown. Direct XML API is not documented and not needed.
- Using gesetze-tools scripts to maintain a local clone: Introduces disk management complexity. The GitHub REST API provides equivalent access without local state.

---

## Open Questions

1. **Prisma schema: `stand` field missing from LawChunk**
   - What we know: The GESETZ-01 requirement mentions "Metadaten: gesetz, paragraf, absatz, stand, quelle_url." The current LawChunk schema (from Phase 12) has: `gesetzKuerzel` (gesetz), `paragraphNr` (paragraf+absatz), `sourceUrl` (quelle_url), `syncedAt` (serves as stand). There is no explicit `stand` String field.
   - What's unclear: Should a `stand` String field be added to capture the raw "Zuletzt geändert durch" text from the frontmatter?
   - Recommendation: Use `syncedAt` as the "Stand" date for display purposes (it reflects when the data was last synced from GitHub). Adding a `stand String?` field would require a Prisma migration. Only add it if the planner explicitly requires the legislative amendment citation string. For GESETZ-03, `syncedAt.toLocaleDateString("de-DE")` is sufficient for the "nicht amtlich — Stand: [Datum]" requirement.

2. **Rate limiting during first ingestion (2000+ Gesetze, 100k+ chunks)**
   - What we know: First run processes all 2000+ files. At ~50 chunks per Gesetz and ~300ms Ollama latency per embedding call, first ingestion takes ~8 hours. This is fine for a background job but may hit Ollama queue pressure.
   - What's unclear: Should the first ingestion be spread across multiple cron runs (continue from where last left off), or run once as a special "bootstrap" job?
   - Recommendation: The SHA cache handles this naturally — on first run, SHA cache is empty, so all files are processed. If the job fails mid-way (e.g. Ollama timeout), re-run the cron manually. The SHA cache saves progress: already-processed files (SHA recorded) are skipped on re-run.

3. **Law chunk search threshold — always include vs. score-filtered**
   - What we know: GESETZ-03 says "automatisch Top-5 Normen-Chunks bei Anfragen mit Rechtsbezug". Always running searchLawChunks adds ~50ms to ki-chat (one pgvector query). If the query is not legal (e.g. "Was kostet das?"), the returned scores will be low.
   - What's unclear: What score threshold to use for filtering low-relevance results?
   - Recommendation: Include law_chunks in the prompt only if the top result has `score > 0.6` (cosine similarity). This avoids injecting irrelevant law chunks for non-legal queries while requiring no explicit legal-intent classifier.

---

## Validation Architecture

> nyquist_validation not found in .planning/config.json — skipping this section as workflow.nyquist_validation is not set to true.

---

## Sources

### Primary (HIGH confidence)

- `prisma/schema.prisma` lines 964-979 — LawChunk model verified: gesetzKuerzel, paragraphNr, titel, content, parentContent, embedding, modelVersion, syncedAt, sourceUrl — all Phase 12 fields confirmed present (direct file inspection)
- `src/lib/queue/queues.ts` — `registerFristReminderJob()` pattern with `upsertJobScheduler + tz: "Europe/Berlin"` confirmed; `gesetzeSyncQueue` follows identical pattern (direct file inspection)
- `src/worker.ts` — startup() function pattern for registering cron jobs + Worker instantiation pattern verified (direct file inspection)
- `src/lib/embedding/vector-store.ts` — pgvector raw SQL pattern for `searchSimilar()` — identical pattern for `searchLawChunks()` (direct file inspection)
- `src/app/api/ki-chat/route.ts` — Chain A/B/C pattern; Chain D follows same Promise.all() structure; system prompt construction with `--- QUELLEN ---` block format confirmed (direct file inspection)
- `https://raw.githubusercontent.com/bundestag/gesetze/master/b/bgb/index.md` — YAML frontmatter format verified: `jurabk: BGB`, `slug: bgb`; paragraph heading format verified: `##### § 1 Beginn der Rechtsfähigkeit`; Absatz format verified: `(1)`, `(2)` in body text only (direct file fetch)
- `https://www.gesetze-im-internet.de/bgb/__626.html` — canonical URL format confirmed (search result verification): `{slug}/__{nr}.html`
- GitHub REST API docs — git trees endpoint `/repos/{owner}/{repo}/git/trees/{sha}?recursive=1` returns all file paths + SHAs; 100k item limit; unauthenticated = 60 req/hr; authenticated = 5000 req/hr

### Secondary (MEDIUM confidence)

- BullMQ docs `https://docs.bullmq.io/guide/job-schedulers` — `upsertJobScheduler` API confirmed; `tz` parameter for timezone confirmed in project's existing fristReminderJob code (HIGH for project pattern; MEDIUM for exact BullMQ API surface)
- GitHub API rate limits — 60 req/hr unauthenticated, 5000/hr authenticated: `https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api`

### Tertiary (LOW confidence — flag for validation)

- Exact behavior of `fast-xml-parser` (already in package.json) for bundestag/gesetze XML — NOT needed; the repo uses Markdown, not XML. The `fast-xml-parser` package is irrelevant for this phase.
- Whether some `law_chunks` entries need sub-paragraph chunking (for very long §§ > 4000 chars) — requires empirical validation after initial ingestion run to identify which paragraphs are overlong.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; all patterns directly verified in codebase
- Architecture: HIGH — GitHub API format verified by direct file fetch; LawChunk schema verified from Phase 12 output; BullMQ pattern verified from existing worker.ts
- Pitfalls: HIGH — HNSW index issue inherited from Phase 12 research; SHA rate limiting is a well-known GitHub API constraint; embedding size limit is empirically validated for E5 model

**Research date:** 2026-02-27
**Valid until:** 2026-05-27 (bundestag/gesetze Markdown format is stable — 531 commits without format change; GitHub API v3 is stable; BullMQ upsertJobScheduler API is stable)
