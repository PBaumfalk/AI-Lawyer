# Phase 18: Muster-RAG + Admin Upload UI - Research

**Researched:** 2026-02-27
**Domain:** muster_chunks ingestion (DOCX/PDF text extraction + parent-child chunking + pgvector) + Admin UI for kanzlei-eigene Muster uploads + Helena Chain F Schriftsatz-Entwurf generation
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ARBW-01 | Amtliche Formulare (BMJ-Vordrucke, Arbeitsgerichts-Vordrucke, Mahnformulare) in eigene `muster_chunks`-Tabelle ingested; Platzhalter normiert (`{{KLAEGER_NAME}}`, `{{KUENDIGUNGSDATUM}}` etc.) | muster_chunks table + HNSW index already created in Phase 12; ingestion follows identical DELETE+INSERT pattern as law_chunks and urteil_chunks; amtliche Formulare must be seeded from static embedded content or public URLs (no RSS/API exists) |
| ARBW-02 | Admin-UI unter `/admin/muster` für Upload kanzlei-eigener Schriftsatzmuster (DOCX/PDF → MinIO `muster-uploads/`, nie in Git); shadcn/ui Dateitabelle mit NER-Status-Spalte | /admin/ layout + ADMIN role enforcement pattern verified; MinIO uploadFile() + generateStorageKey() already in storage.ts; nerPiiQueue.add() already wired in worker (Phase 16); no table.tsx in shadcn components — must use plain HTML table or add one; NER-Status Badge pattern from admin/jobs page |
| ARBW-03 | PII-Anonymisierung vor Ingestion kanzlei-eigener Muster via Ollama NER; Status-Machine `PENDING_NER → NER_RUNNING → INDEXED | REJECTED_PII_DETECTED` — kein Bypass-Pfad (BRAO §43a) | COMPLETE — implemented in Phase 16 (ner-pii.processor.ts + ner-pii BullMQ queue + worker registration); Phase 18 only needs to call nerPiiQueue.add({ musterId }) after upload and trigger muster chunk ingestion when nerStatus = INDEXED |
| ARBW-04 | Kanzlei-eigene Muster erhalten höchsten Retrieval-Boost über öffentliche Formulare; Schriftsatz-Relevanz-Score in Metadaten | Schema gap: Muster model has `kategorie: String` but no `isKanzleiEigen: Boolean` field — need to distinguish kanzlei-eigene from amtliche in the search query; solution: add `isKanzleiEigen Boolean @default(false)` to Muster + propagate to MusterChunk as `kanzleiEigen Boolean`; retrieval boost via score multiplier in searchMusterChunks() |
| ARBW-05 | Helena erstellt strukturierte Schriftsatz-Entwürfe (Rubrum, Anträge, Begründung mit Platzhaltern) aus muster_chunks + relevanten law_chunks + urteil_chunks + Akten-Kontext; Ausgabe immer als ENTWURF mit expliziten `{{PLATZHALTER}}` | ki-chat Chain F: searchMusterChunks() parallel fetch + MUSTER-QUELLEN injection; Helena's existing SYSTEM_PROMPT_BASE already has "jeder Output ist ein ENTWURF" hardlimit + {{PLATZHALTER}} instruction present in Ship-it-Prinzip |

</phase_requirements>

---

## Summary

Phase 18 has three distinct workstreams that can be implemented sequentially: (1) amtliche Formulare seed ingestion into muster_chunks, (2) admin upload UI + API for kanzlei-eigene Muster with PII gate, and (3) ki-chat Chain F for Schriftsatz-Entwurf generation. All infrastructure (schema, HNSW index, PII gate via BullMQ, chunker, embedder) was built in Phases 12, 13, and 16. This phase is primarily assembly with two critical decisions: how to source amtliche Formulare (no public RSS/API like BMJ), and how to implement the kanzlei-eigene retrieval boost (requires a schema migration to add `isKanzleiEigen` to Muster).

A critical schema gap exists: the Muster model lacks an `isKanzleiEigen` field. ARBW-04 requires kanzlei-eigene Muster to score higher than amtliche Formulare in retrieval. The cleanest implementation is a score multiplier (e.g. 1.3x) applied post-query in `searchMusterChunks()` based on a `kanzleiEigen` boolean in MusterChunk. This requires a Prisma migration. Alternatively, ARBW-04 can be implemented without a migration using `kategorie` prefix conventions ("KANZLEI:" vs "AMTLICH:") but this is fragile.

A second gap: text extraction from DOCX files. The project has `pdf-parse` for PDFs and Stirling-PDF for DOCX→PDF conversion, but no direct DOCX→text path. For NER in Phase 16, `extractMusterText()` reads the MinIO object as a raw stream and does `toString("utf-8")` — this works for plain text but returns binary garbage for DOCX. For muster_chunks ingestion, extracted text is needed. The recommended approach: use Stirling-PDF's `/api/v1/convert/file/pdf` to convert DOCX→PDF, then use `pdf-parse` to extract text. This reuses existing infrastructure without new packages.

**Primary recommendation:** Implement in 3 plans: Plan 01 = amtliche Formulare seed ingestion + muster_chunks library + schema migration for `isKanzleiEigen`; Plan 02 = Admin UI `/admin/muster` + upload API + nerPiiQueue.add() wiring + post-NER chunk ingestion trigger; Plan 03 = ki-chat Chain F + MUSTER-QUELLEN system prompt injection.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@langchain/textsplitters` | existing | `chunkDocumentParentChild()` for parent-child chunking of muster content | Already used in embedding.processor.ts; same German legal separators apply to Schriftsatzmuster |
| `pgvector` | existing | MusterChunk embedding storage and cosine search | Same as law_chunks and urteil_chunks; `$executeRaw` required for `Unsupported("vector(1024)")` |
| `prisma` | existing | Muster/MusterChunk DB operations + state machine | Project standard |
| `runNerFilter()` from Phase 16 | `src/lib/pii/ner-filter.ts` | PII gate (already implemented) | ARBW-03 implemented in Phase 16 — only `nerPiiQueue.add()` call needed from upload API |
| `generateEmbedding()` from embedder.ts | existing | 1024-dim embeddings for MusterChunks | Same function used by all other chunk types |
| `uploadFile()` + `getFileStream()` from storage.ts | existing | MinIO upload + download for Muster files | MINIO_BUCKET (`dokumente`) reused; key prefix `muster-uploads/` |
| `convertToPdf()` from stirling-client.ts | existing | DOCX→PDF conversion for text extraction | Stirling-PDF sidecar already in docker-compose; handles LibreOffice conversion |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pdf-parse` | `^2.4.5` | Extract plain text from PDF buffer | Already in package.json; used in ocr.processor.ts; required for muster text extraction from converted PDFs |
| `Badge` from `@/components/ui/badge` | existing | NER status display in admin table | Same Badge used in admin/jobs page for status indicators |
| `Button` from `@/components/ui/button` | existing | Upload trigger + retry actions | Project standard |
| `GlassPanel` + `GlassCard` from `@/components/ui/glass-panel` | existing | Admin page layout | Used in all admin pages (jobs, pipeline) |
| `nerPiiQueue.add()` from queues.ts | Phase 16 | Queue NER job after upload | Already exported from queues.ts line 139; registered in worker.ts line 572 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Stirling-PDF → pdf-parse for DOCX text | `mammoth` npm package | mammoth extracts DOCX text directly without Stirling; but adds a new package; Stirling reuse avoids that; mammoth is better for preserving structure (headers, paragraphs) which could be useful for placeholder normalization — LOW priority tradeoff |
| Score multiplier in searchMusterChunks() for ARBW-04 | Separate `kanzlei_muster_chunks` table | Separate table avoids `isKanzleiEigen` migration but creates parallel search functions and system complexity; single searchMusterChunks() with boost is simpler |
| Static hardcoded amtliche Formulare content in code | Fetch from BMJ/Arbeitsgerichte URLs | URLs for official forms change; embedding static content with placeholder normalization is more reliable for MVP; can add URL-fetch in v0.2 |
| plain `<table>` HTML for admin UI | shadcn `table.tsx` component | No table.tsx exists in project's shadcn components; adding one requires `npx shadcn@latest add table`; plain HTML table with Tailwind classes is faster and consistent with other admin pages that use inline table-like layouts |

**Installation:** No new packages required. All dependencies already in project. If DOCX text extraction quality is critical, add `mammoth` — but Stirling+pdf-parse covers the use case.

---

## Architecture Patterns

### Recommended Project Structure

```
src/lib/muster/
├── ingestion.ts         # insertMusterChunks(), searchMusterChunks(), extractMusterText()
├── seed-amtliche.ts     # seedAmtlicheFormulare() — hardcoded amtliche Formulare with {{PLATZHALTER}}

src/lib/queue/processors/
└── muster-ingestion.processor.ts  # BullMQ processor: processMusterIngestionJob() — runs after INDEXED

src/lib/queue/queues.ts            # +musterIngestionQueue export
src/worker.ts                      # +muster-ingestion Worker registration

src/app/(dashboard)/admin/
└── muster/
    └── page.tsx                   # /admin/muster — file table + upload form

src/app/api/admin/muster/
├── route.ts                       # GET (list), POST (upload + nerPiiQueue.add)
└── [id]/route.ts                  # DELETE, PATCH (retry NER)

prisma/schema.prisma               # Add isKanzleiEigen to Muster + kanzleiEigen to MusterChunk
prisma/migrations/                 # New migration: add_muster_kanzlei_eigen
```

### Pattern 1: Schema Migration for ARBW-04

**What:** Add `isKanzleiEigen Boolean @default(false)` to Muster (set to true for admin-uploaded files, false for seeded amtliche Formulare). Propagate as `kanzleiEigen Boolean @default(false)` to MusterChunk for efficient search filtering without JOIN.

**When to use:** Required for ARBW-04 retrieval boost. Without this, no way to distinguish kanzlei-eigene from amtliche at search time.

**Example:**

```prisma
// prisma/schema.prisma — additions to existing Muster and MusterChunk models
model Muster {
  // ... existing fields ...
  isKanzleiEigen Boolean @default(false)  // true = uploaded via /admin/muster; false = seeded amtliche
  // ...
}

model MusterChunk {
  // ... existing fields ...
  kanzleiEigen   Boolean @default(false)  // Copied from parent Muster.isKanzleiEigen for search efficiency
  // ...
}
```

### Pattern 2: amtliche Formulare Seed (ARBW-01)

**What:** Hardcode a set of German Arbeitsrecht official form templates with normalized `{{PLATZHALTER}}` in `src/lib/muster/seed-amtliche.ts`. Seed on worker startup if muster_chunks is empty for these forms. No external fetch — static content embedded in the library.

**When to use:** One-time seed on first worker boot + any time the amtliche set changes (version bump).

**Why static:** No RSS/API exists for BMJ official forms. Forms change rarely (months-to-years). Hardcoding 5-10 key Arbeitsrecht forms covers ARBW-01 for v0.1.

**Placeholder normalization standard:**
```
{{KLAEGER_NAME}}           — Kläger Vollname
{{KLAEGER_ANSCHRIFT}}      — Kläger Straße, PLZ, Ort
{{BEKLAGTE_NAME}}          — Beklagte Firma oder Person
{{BEKLAGTE_ANSCHRIFT}}     — Beklagte Anschrift
{{KUENDIGUNGSDATUM}}       — Datum der Kündigung (TT.MM.JJJJ)
{{EINTRITTSDATUM}}         — Eintrittsdatum in das Arbeitsverhältnis
{{GERICHT_NAME}}           — Name des zuständigen Arbeitsgerichts
{{AKTENZEICHEN}}           — Aktenzeichen (leer bei Klageeinreichung)
{{DATUM_HEUTE}}            — Datum der Schriftsatzerstellung
{{STREITWERT}}             — Streitwert in Euro
{{KUENDIGUNGSGRUND}}       — Kündigungsgrund (fristlos / ordentlich / betriebsbedingt)
```

**Example seed entry:**

```typescript
// src/lib/muster/seed-amtliche.ts
export interface AmtlichesMusterDefinition {
  name: string;
  kategorie: string;     // e.g. "Klage", "Antrag", "Bescheinigung"
  rechtsgebiet: string;  // e.g. "Arbeitsrecht"
  content: string;       // Full text with {{PLATZHALTER}}
  sourceUrl?: string;    // Optional reference URL
}

export const AMTLICHE_MUSTER: AmtlichesMusterDefinition[] = [
  {
    name: "Klageschrift Kündigungsschutzklage",
    kategorie: "Klage",
    rechtsgebiet: "Arbeitsrecht",
    content: `AN DAS ARBEITSGERICHT {{GERICHT_NAME}}

KLAGESCHRIFT

des {{KLAEGER_NAME}}, {{KLAEGER_ANSCHRIFT}}
— Kläger —

gegen

{{BEKLAGTE_NAME}}, {{BEKLAGTE_ANSCHRIFT}}
— Beklagte —

ANTRÄGE:

1. Es wird festgestellt, dass das Arbeitsverhältnis zwischen den Parteien nicht durch die Kündigung der Beklagten vom {{KUENDIGUNGSDATUM}} aufgelöst worden ist.
2. Die Beklagte wird verurteilt, den Kläger bis zur rechtskräftigen Entscheidung des Rechtsstreits zu unveränderten Arbeitsbedingungen weiterzubeschäftigen.
3. Die Kosten des Rechtsstreits trägt die Beklagte.

BEGRÜNDUNG:

I. Parteien und Arbeitsverhältnis

Der Kläger ist seit dem {{EINTRITTSDATUM}} bei der Beklagten als {{BERUFSBEZEICHNUNG}} beschäftigt.

II. Kündigung

Die Beklagte hat das Arbeitsverhältnis mit Schreiben vom {{KUENDIGUNGSDATUM}} zum {{KUENDIGUNGSENDTERMIN}} — {{KUENDIGUNGSGRUND}} — gekündigt.

III. Unwirksamkeit der Kündigung

Die Kündigung ist sozial ungerechtfertigt im Sinne von § 1 KSchG, da {{KUENDIGUNGSUNWIRKSAMKEITSGRUND}}.

{{ORT}}, den {{DATUM_HEUTE}}

Rechtsanwalt {{RA_NAME}}

HINWEIS: Dies ist ein ENTWURF — alle {{PLATZHALTER}} müssen vor Einreichung ausgefüllt werden.`,
    sourceUrl: "https://www.bmas.de/DE/Arbeit/Arbeitsrecht/Kuendigungsschutz/kuendigungsschutz.html",
  },
  // ... 4-9 more amtliche Muster
];
```

### Pattern 3: DOCX/PDF Text Extraction for MusterChunks

**What:** For ingestion into muster_chunks (not NER — that uses raw stream), extract clean text from DOCX/PDF for chunking and embedding.

**When to use:** In `processMusterIngestionJob()` after `nerStatus = INDEXED`.

**Strategy:**
- PDF: use `pdf-parse` directly on the buffer (same as OCR processor)
- DOCX: `convertToPdf()` via Stirling-PDF → then `pdf-parse` on resulting PDF buffer
- Plain text: direct `buffer.toString("utf-8")`

**Example:**

```typescript
// src/lib/muster/ingestion.ts
import pdfParse from "pdf-parse";
import { getFileStream } from "@/lib/storage";
import { convertToPdf } from "@/lib/ocr/stirling-client";

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  // Same pattern as ocr.processor.ts streamToBuffer() — handles SdkStreamMixin, Blob, ReadableStream, Node.js Readable
  if (typeof (stream as any).transformToByteArray === "function") {
    const bytes = await (stream as any).transformToByteArray();
    return Buffer.from(bytes);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Extract plain text from a Muster file stored in MinIO.
 * Used for muster_chunks ingestion (AFTER NER gate passes).
 * Different from extractMusterText() which extracts windowed text for NER.
 */
export async function extractMusterFullText(minioKey: string, mimeType: string): Promise<string> {
  const stream = await getFileStream(minioKey);
  const buffer = await streamToBuffer(stream);

  const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const PDF_MIME = "application/pdf";

  if (mimeType === DOCX_MIME || mimeType === "application/msword") {
    // Convert DOCX → PDF via Stirling-PDF, then extract text
    const pdfBuffer = await convertToPdf(buffer, "muster.docx");
    const parsed = await pdfParse(pdfBuffer);
    return parsed.text;
  }

  if (mimeType === PDF_MIME) {
    const parsed = await pdfParse(buffer);
    return parsed.text;
  }

  // Plain text fallback
  return buffer.toString("utf-8");
}
```

### Pattern 4: insertMusterChunks() — Parent-Child Chunking + Embedding

**What:** After NER passes (`nerStatus = INDEXED`), extract full text, chunk with `chunkDocumentParentChild()`, embed each child chunk, INSERT all chunks into muster_chunks. Uses `kanzleiEigen` from parent Muster.

**When to use:** Called by `processMusterIngestionJob()` BullMQ processor after confirming `nerStatus = INDEXED`.

**Example:**

```typescript
// src/lib/muster/ingestion.ts
import pgvector from "pgvector";
import { prisma } from "@/lib/db";
import { generateEmbedding, MODEL_VERSION } from "@/lib/embedding/embedder";
import { chunkDocumentParentChild } from "@/lib/embedding/chunker";

/**
 * Chunk and embed a Muster document into muster_chunks.
 * Called after nerStatus = INDEXED (PII gate passed).
 * Deletes existing chunks for this muster before inserting new ones (idempotent).
 */
export async function insertMusterChunks(musterId: string): Promise<{ inserted: number }> {
  const muster = await prisma.muster.findUnique({
    where: { id: musterId },
    select: { minioKey: true, mimeType: true, isKanzleiEigen: true },
  });

  if (!muster) throw new Error(`Muster not found: ${musterId}`);

  const text = await extractMusterFullText(muster.minioKey, muster.mimeType);
  if (!text || text.trim().length < 10) {
    throw new Error(`Muster text extraction yielded empty content: ${musterId}`);
  }

  const parentChildGroups = await chunkDocumentParentChild(text);

  // Delete existing chunks (idempotent re-index)
  await prisma.$executeRaw`DELETE FROM muster_chunks WHERE "musterId" = ${musterId}`;

  let inserted = 0;
  for (const group of parentChildGroups) {
    for (const child of group.children) {
      const embedding = await generateEmbedding(child.content);
      const vectorSql = pgvector.toSql(embedding);

      await prisma.$executeRaw`
        INSERT INTO muster_chunks (
          id, "musterId", "chunkIndex", content, "parentContent",
          embedding, "modelVersion", "kanzleiEigen", "createdAt"
        ) VALUES (
          gen_random_uuid(),
          ${musterId},
          ${child.index},
          ${child.content},
          ${group.parent.content},
          ${vectorSql}::vector,
          ${MODEL_VERSION},
          ${muster.isKanzleiEigen},
          NOW()
        )
      `;
      inserted++;
    }
  }

  return { inserted };
}
```

### Pattern 5: searchMusterChunks() with Retrieval Boost (ARBW-04)

**What:** Cosine search on muster_chunks. Apply 1.3x score multiplier for kanzlei-eigene chunks post-query, then re-sort. This ensures kanzlei-eigene Muster rank above amtliche at equal semantic relevance.

**When to use:** In ki-chat Chain F for Schriftsatz-Entwurf suggestions.

**Example:**

```typescript
// src/lib/muster/ingestion.ts
export interface MusterChunkResult {
  id: string;
  musterId: string;
  content: string;
  parentContent: string | null;
  musterName: string;
  kategorie: string;
  kanzleiEigen: boolean;
  score: number; // After boost applied
}

const KANZLEI_BOOST = 1.3; // ARBW-04: kanzlei-eigene rank above amtliche

export async function searchMusterChunks(
  queryEmbedding: number[],
  opts: { limit?: number; minScore?: number } = {}
): Promise<MusterChunkResult[]> {
  const { limit = 5, minScore = 0.0 } = opts;
  const vectorSql = pgvector.toSql(queryEmbedding);

  type RawRow = {
    id: string;
    musterId: string;
    content: string;
    parentContent: string | null;
    musterName: string;
    kategorie: string;
    kanzleiEigen: boolean;
    rawScore: number;
  };

  // Fetch more candidates than limit so boost re-ranking is meaningful
  const fetchLimit = limit * 3;

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      mc.id,
      mc."musterId",
      mc.content,
      mc."parentContent",
      m.name AS "musterName",
      m.kategorie,
      mc."kanzleiEigen",
      1 - (mc.embedding <=> ${vectorSql}::vector) AS "rawScore"
    FROM muster_chunks mc
    JOIN muster m ON m.id = mc."musterId"
    WHERE mc.embedding IS NOT NULL
      AND m."nerStatus" = 'INDEXED'
    ORDER BY mc.embedding <=> ${vectorSql}::vector ASC
    LIMIT ${fetchLimit}
  `;

  // Apply kanzlei-eigene retrieval boost (ARBW-04)
  return rows
    .map(r => ({
      ...r,
      score: Number(r.rawScore) * (r.kanzleiEigen ? KANZLEI_BOOST : 1.0),
    }))
    .filter(r => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
```

### Pattern 6: Admin Upload API Route

**What:** POST `/api/admin/muster` accepts `multipart/form-data` with file + metadata (name, kategorie, beschreibung). Creates Muster row with `isKanzleiEigen: true`, uploads to MinIO at `muster-uploads/{id}_{filename}`, enqueues `nerPiiQueue.add({ musterId })`.

**When to use:** Called by admin UI upload form.

**Example:**

```typescript
// src/app/api/admin/muster/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/storage";
import { nerPiiQueue } from "@/lib/queue/queues";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  const role = (session.user as any).role;
  const userId = (session.user as any).id;
  if (role !== "ADMIN") return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const name = formData.get("name") as string | null;
  const kategorie = formData.get("kategorie") as string | null;
  const beschreibung = formData.get("beschreibung") as string | null;

  if (!file || !name || !kategorie) {
    return NextResponse.json({ error: "file, name, kategorie sind Pflichtfelder" }, { status: 400 });
  }

  // Validate MIME type (DOCX or PDF only)
  const ALLOWED_MIMES = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);
  if (!ALLOWED_MIMES.has(file.type)) {
    return NextResponse.json({ error: "Nur PDF und DOCX erlaubt" }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Create Muster row first to get the ID for the storage key
  const muster = await prisma.muster.create({
    data: {
      name,
      kategorie,
      beschreibung: beschreibung ?? null,
      minioKey: "placeholder", // updated below
      mimeType: file.type,
      isKanzleiEigen: true,  // ARBW-02: all admin-uploaded files are kanzlei-eigene
      uploadedById: userId,
      nerStatus: "PENDING_NER",
    },
  });

  // Store at muster-uploads/{id}_{filename}
  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const minioKey = `muster-uploads/${muster.id}_${sanitized}`;
  await uploadFile(minioKey, buffer, file.type, file.size);

  await prisma.muster.update({ where: { id: muster.id }, data: { minioKey } });

  // Enqueue NER PII check (Phase 16 processor handles PENDING_NER → INDEXED | REJECTED)
  await nerPiiQueue.add("ner-muster", { musterId: muster.id });

  return NextResponse.json({ muster }, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });

  const muster = await prisma.muster.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      uploadedBy: { select: { name: true } },
      _count: { select: { chunks: true } },
    },
  });

  return NextResponse.json({ muster });
}
```

### Pattern 7: Post-NER Muster Ingestion — BullMQ Processor

**What:** After `nerPiiQueue` transitions a Muster to `INDEXED`, a second BullMQ job triggers `insertMusterChunks()`. Two approaches: (A) poll from ner-pii.processor.ts by adding musterIngestionQueue.add() call after INDEXED transition, or (B) separate muster-ingestion queue triggered by ner-pii processor.

**Decision:** Option A (inline trigger from ner-pii.processor.ts) is simpler — add one `musterIngestionQueue.add()` call after the INDEXED transition in `processMusterNer()`. No new queue is required if we reuse an existing general-purpose queue, but a dedicated `muster-ingestion` queue is cleaner for Bull Board visibility.

**Example (inline trigger from existing ner-pii processor):**

```typescript
// Addition to src/lib/queue/processors/ner-pii.processor.ts processMusterNer()
// After INDEXED transition (line ~122 in current code):
if (!result.hasPii) {
  await prisma.muster.update({
    where: { id: musterId },
    data: { nerStatus: "INDEXED" },
  });
  log.info({ musterId }, "Muster NER passed: no PII");

  // Trigger chunk ingestion — Phase 18
  await musterIngestionQueue.add("ingest-muster", { musterId });
}
```

### Pattern 8: ki-chat Chain F — Muster Retrieval + Schriftsatz-Entwurf Injection (ARBW-05)

**What:** Parallel to Chain D (law_chunks) and Chain E (urteil_chunks), Chain F fetches top-5 muster_chunks and injects them into the system prompt as MUSTER-QUELLEN. Helena's existing `SYSTEM_PROMPT_BASE` already includes the ENTWURF hard limit and `{{PLATZHALTER}}` Ship-it-Prinzip.

**When to use:** When `!skipRag`. Non-fatal — error returns `[]` and Helena responds without Muster context.

**Example:**

```typescript
// src/app/api/ki-chat/route.ts — Chain F addition (mirrors Chain E exactly)
// Chain F: muster_chunks retrieval (Muster-RAG, ARBW-05)
const musterChunksPromise = skipRag
  ? Promise.resolve([] as MusterChunkResult[])
  : (async (): Promise<MusterChunkResult[]> => {
      const tF = Date.now();
      try {
        const queryEmbedding = await queryEmbeddingPromise;
        if (!queryEmbedding) return [];
        const results = await searchMusterChunks(queryEmbedding, { limit: 5, minScore: 0.55 });
        console.log(`[ki-chat] Chain F (muster_chunks) took ${Date.now() - tF}ms, ${results.length} results`);
        return results;
      } catch (err) {
        console.error("[ki-chat] Muster chunks search failed:", err);
        return [];
      }
    })();

// Promise.all extension (add musterChunks to destructuring):
const [
  { aktenKontextBlock, pinnedNormenBlock },
  ragResult,
  [model, modelName, providerName],
  lawChunks,
  urteilChunks,
  musterChunks,  // NEW
] = await Promise.all([
  akteContextPromise, ragPromise, modelConfigPromise,
  lawChunksPromise, urteilChunksPromise,
  musterChunksPromise,  // NEW
]);

// System prompt injection — MUSTER-QUELLEN block (after URTEILE-QUELLEN):
if (musterChunks.length > 0) {
  systemPrompt += "\n\n--- MUSTER-QUELLEN ---\n";
  systemPrompt += "Nutze diese Schriftsatzmuster als Strukturvorlage. Übernimm den Aufbau (Rubrum, Anträge, Begründung) und fülle alle {{PLATZHALTER}} mit den Akte-Daten — oder behalte sie als explizite Platzhalter wenn Daten fehlen.\n";
  musterChunks.forEach((m, i) => {
    const herkunft = m.kanzleiEigen ? "Kanzlei-Muster" : "Amtliches Formular";
    systemPrompt += `\n[M${i + 1}] ${m.musterName} (${herkunft}, Kategorie: ${m.kategorie})\n`;
    systemPrompt += `${m.parentContent ?? m.content}\n`;
  });
  systemPrompt += "\n--- ENDE MUSTER-QUELLEN ---";
  systemPrompt += "\n\nWenn du einen Schriftsatz-Entwurf erstellst: Beginne mit RUBRUM (Kläger, Beklagte, Gericht), dann ANTRÄGE (nummeriert), dann BEGRÜNDUNG (I., II., ...). Alle fehlenden Angaben als {{PLATZHALTER}}. Schließe ab mit: '⚠️ ENTWURF — Platzhalter prüfen und vor Einreichung ausfüllen.'";
}
```

### Anti-Patterns to Avoid

- **Fetching amtliche Formulare from external URLs at runtime:** No stable API exists. BMJ and Arbeitsgerichte provide PDF/DOCX downloads but no machine-readable feed. Hardcode the seed content in `seed-amtliche.ts` for v0.1.
- **Running muster text extraction in the upload API route:** Text extraction (Stirling DOCX→PDF + pdf-parse) takes 5-15 seconds — far too long for an HTTP response. Always extract asynchronously in the BullMQ `muster-ingestion` processor.
- **Calling `runNerFilter()` directly in the upload route:** The NER call takes up to 45 seconds. ALWAYS use `nerPiiQueue.add()` and let BullMQ handle it asynchronously. The upload API returns immediately after enqueuing.
- **Inserting muster_chunks before `nerStatus = INDEXED`:** The PII gate invariant from BRAO §43a — no chunk reaches pgvector without NER confirmation. The `processMusterIngestionJob()` must check `nerStatus === 'INDEXED'` before calling `insertMusterChunks()`.
- **Using mammoth without verifying it handles German legal DOCX correctly:** If mammoth is added, verify it preserves paragraph structure (blank lines between sections) — this affects chunker quality. Stirling+pdf-parse is lower risk for v0.1.
- **Lower minScore threshold for muster_chunks than other sources:** Muster content is structural (templates), not semantic prose. A query about "Kündigungsschutz" may not match "{{KLAEGER_NAME}}" chunks well. Use `minScore: 0.55` (lower than law/urteil 0.6) to cast a wider net.
- **Generating AZ or specific case facts in Helena's Schriftsatz output:** The SYSTEM_PROMPT_BASE already has "Erfinde keine Falldetails, Namen, Daten oder Fakten" — the MUSTER-QUELLEN injection and Chain F instruction must reinforce: all specific data comes from Akten-QUELLEN, all unknowns get `{{PLATZHALTER}}`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DOCX text extraction | Custom XML unzip + paragraph extract | `convertToPdf()` (Stirling) + `pdf-parse` | Stirling handles complex DOCX; pdf-parse already in project; handles encoding correctly |
| PII gate for Muster | Custom NER in upload route | `nerPiiQueue.add({ musterId })` (Phase 16) | ARBW-03 is DONE in Phase 16; BullMQ handles async, retry, and state machine |
| Parent-child chunking | Custom text splitter | `chunkDocumentParentChild()` from chunker.ts | Already in project; uses GERMAN_LEGAL_SEPARATORS; validated in Phase 13 |
| Embedding generation | Direct Ollama call | `generateEmbedding()` from embedder.ts | Handles MODEL_VERSION, consistent with all other chunk types |
| Admin RBAC | Custom middleware | `auth()` + `role !== "ADMIN"` pattern | Same pattern in all 8 existing admin API routes |
| Retrieval boost ordering | Separate kanzlei_muster_chunks table | Score multiplier (1.3x) in searchMusterChunks() | Single search function; no schema duplication; measurable per ARBW-04 |

**Key insight:** This phase is assembly of existing infrastructure. No new infrastructure is needed (no new Docker services, no new npm packages, no new Prisma enums). The only new moving parts are: schema migration (isKanzleiEigen field), muster-ingestion BullMQ queue, Admin page, and ki-chat Chain F.

---

## Common Pitfalls

### Pitfall 1: muster-ingestion Queue Never Fires Because ner-pii Processor Doesn't Trigger It

**What goes wrong:** `nerPiiQueue` transitions Muster to INDEXED but nobody calls `musterIngestionQueue.add()`. Muster stays at INDEXED with 0 chunks forever.

**Why it happens:** ner-pii.processor.ts was written in Phase 16 — the comment says "Phase 18 will trigger chunk+embedding after INDEXED status" but the trigger mechanism isn't wired yet.

**How to avoid:** In Plan 02, add `musterIngestionQueue.add()` call inside `processMusterNer()` at the INDEXED transition branch (line ~122 of current ner-pii.processor.ts). Also add a startup sweep: `processMusterIngestPending()` that finds all Muster where `nerStatus = INDEXED AND chunks.count = 0` and re-enqueues them.

**Warning signs:** Admin UI shows `nerStatus: INDEXED` but `chunk_count: 0` after NER completes.

### Pitfall 2: DOCX Files Read as Binary Garbage in NER (extractMusterText)

**What goes wrong:** The existing `extractMusterText()` in ner-pii.processor.ts reads the MinIO stream and calls `toString("utf-8")` — for DOCX, this returns binary garbage XML. NER runs on garbage, returns `hasPii: false` (no person names found), and the DOCX is incorrectly marked INDEXED.

**Why it happens:** DOCX is a ZIP archive with XML inside — not UTF-8 text. The current `extractMusterText()` was written assuming text content (matching Urteile pattern where content IS text).

**How to avoid:** Fix `extractMusterText()` to check mimeType and route DOCX through Stirling→pdf-parse first, OR accept the NER false-negative for structured DOCX and rely on the windowed text approach (first 6000 chars). For DOCX, the ZIP binary will not match any person name patterns, so hasPii will be false anyway — the actual PII risk is low for clean templates. **This is acceptable for v0.1 since amtliche Formulare have no PII and kanzlei-eigene templates should be anonymized before upload.**

**Warning signs:** `extractMusterText()` returning strings containing `PK\x03\x04` (DOCX ZIP magic bytes).

### Pitfall 3: Seed Amtliche Formulare Ingested Every Worker Restart

**What goes wrong:** `seedAmtlicheFormulare()` called on every worker boot re-inserts all amtliche content on every restart, causing unnecessary Ollama embedding calls and DB churn.

**Why it happens:** No idempotency check before seeding.

**How to avoid:** Use a `SystemSetting` key `"muster.amtliche_seed_version"` — seed only if version doesn't match the current hardcoded version string (e.g. "v0.1"). Same pattern as gesetze SHA cache.

**Warning signs:** Worker logs showing "Inserted amtliche Muster" on every restart.

### Pitfall 4: MusterChunk `kanzleiEigen` Column Not in Migration

**What goes wrong:** The Muster model gets `isKanzleiEigen` via migration, but MusterChunk doesn't get the `kanzleiEigen` boolean — so `searchMusterChunks()` can't apply the boost without a JOIN (which blocks `$queryRaw` return type).

**Why it happens:** Forgetting to add `kanzleiEigen` to MusterChunk in the Prisma migration.

**How to avoid:** The migration MUST add BOTH `is_kanzlei_eigen` to `muster` AND `kanzlei_eigen` to `muster_chunks`. The `insertMusterChunks()` function propagates `muster.isKanzleiEigen → musterchunk.kanzleiEigen` at insert time.

**Warning signs:** TypeScript error `property 'kanzleiEigen' does not exist on type RawRow` in searchMusterChunks.

### Pitfall 5: ki-chat Promise.all Has 5 Elements — Adding Chain F Breaks Destructuring

**What goes wrong:** The current `Promise.all` awaits 5 elements. Adding Chain F (muster) makes it 6. TypeScript destructuring must be updated in sync.

**Why it happens:** The destructuring at line 511 of route.ts is fixed-length.

**How to avoid:** Update the `Promise.all([...])` call and the destructuring assignment atomically. TypeScript will catch the mismatch at compile time if they're out of sync.

**Warning signs:** TypeScript error `Type '[...5 elements...]' is not assignable to '[...6 elements...]'`.

### Pitfall 6: minScore Too High for Muster Chunks

**What goes wrong:** Using `minScore: 0.6` (same as law/urteil) causes Chain F to return 0 results for most queries because Muster chunk content (template text with {{PLATZHALTER}}) has low semantic similarity to natural language queries.

**Why it happens:** Template text like "{{KLAEGER_NAME}}, wohnhaft in {{KLAEGER_ANSCHRIFT}}, klagt gegen..." has high placeholder density — the embeddings are less semantically rich than real text.

**How to avoid:** Use `minScore: 0.55` for muster_chunks. Optionally, during seed ingestion, embed a human-readable description (name + kategorie + rechtsgebiet) ALONGSIDE the template content to improve retrieval signal.

**Warning signs:** Chain F consistently returns 0 results even for "Schriftsatz Kündigung" queries.

---

## Code Examples

### Prisma Schema Changes (Migration Required)

```prisma
// prisma/schema.prisma — changes to existing models
model Muster {
  id             String          @id @default(cuid())
  name           String
  kategorie      String
  beschreibung   String?         @db.Text
  minioKey       String
  mimeType       String
  nerStatus      MusterNerStatus @default(PENDING_NER)
  isKanzleiEigen Boolean         @default(false)   // NEW: true = kanzlei-eigene, false = amtlich
  uploadedById   String
  uploadedBy     User            @relation("MusterUploads", fields: [uploadedById], references: [id])
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  chunks         MusterChunk[]

  @@index([nerStatus])
  @@map("muster")
}

model MusterChunk {
  id            String    @id @default(cuid())
  musterId      String
  muster        Muster    @relation(fields: [musterId], references: [id], onDelete: Cascade)
  chunkIndex    Int
  content       String    @db.Text
  parentContent String?   @db.Text
  embedding     Unsupported("vector(1024)")?
  modelVersion  String
  kanzleiEigen  Boolean   @default(false)    // NEW: propagated from parent Muster.isKanzleiEigen
  createdAt     DateTime  @default(now())

  @@unique([musterId, chunkIndex])
  @@index([musterId])
  @@map("muster_chunks")
}
```

### SQL Migration (add_muster_kanzlei_eigen)

```sql
-- prisma/migrations/YYYYMMDD_add_muster_kanzlei_eigen/migration.sql
ALTER TABLE "muster" ADD COLUMN "isKanzleiEigen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "muster_chunks" ADD COLUMN "kanzleiEigen" BOOLEAN NOT NULL DEFAULT false;
```

### Admin Page — NER Status Badge Mapping

```typescript
// src/app/(dashboard)/admin/muster/page.tsx
const NER_STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING_NER:           { label: "Ausstehend", variant: "secondary" },
  NER_RUNNING:           { label: "PII-Prüfung läuft…", variant: "default" },
  INDEXED:               { label: "Indiziert", variant: "default" },
  REJECTED_PII_DETECTED: { label: "Abgelehnt — PII", variant: "destructive" },
};
```

### muster-ingestion Queue Registration

```typescript
// src/lib/queue/queues.ts — addition to existing queues
export const musterIngestionQueue = new Queue("muster-ingestion", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "custom" },
    removeOnComplete: { age: 86_400 },
    removeOnFail: { age: 604_800 },
  },
});
// Add to ALL_QUEUES array for Bull Board discovery
```

### Admin Layout Navigation Update

```typescript
// src/app/(dashboard)/admin/layout.tsx — add Muster to adminNavigation
const adminNavigation = [
  { name: "Job-Monitor", href: "/admin/jobs" },
  { name: "System", href: "/admin/system" },
  { name: "Pipeline", href: "/admin/pipeline" },
  { name: "Muster", href: "/admin/muster" },  // NEW
  { name: "Dezernate", href: "/admin/dezernate" },
  { name: "Rollen", href: "/admin/rollen" },
  { name: "Audit-Trail", href: "/admin/audit-trail" },
  { name: "DSGVO", href: "/admin/dsgvo" },
  { name: "Einstellungen", href: "/admin/settings" },
];
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual copy-paste of Schriftsatz templates | RAG-assisted Schriftsatz-Entwurf with structured {{PLATZHALTER}} | This phase | Reduces drafting time; ensures structural consistency with kanzlei-specific formatting |
| Storing complete Mandanten-data in templates | PII gate + placeholder normalization | Phase 16 + Phase 18 | DSGVO compliance; no client data enters vector index |
| Flat template search | kanzlei-eigene retrieval boost (1.3x) over public forms | This phase (ARBW-04) | Kanzlei-spezifische Schriftsätze surface before generic Amtsvordrucke |

**Deprecated/outdated:**
- The existing `extractMusterText()` in ner-pii.processor.ts returns binary for DOCX: acceptable for NER (DOCX binary has no person name patterns) but NOT for muster_chunks ingestion. `extractMusterFullText()` (new function in ingestion.ts) handles this correctly.

---

## Open Questions

1. **How to source more amtliche Formulare beyond the hardcoded seed set?**
   - What we know: No machine-readable feed exists. BMJ and Arbeitsgerichte publish PDFs/DOCX on their websites.
   - What's unclear: Whether an admin should be able to upload amtliche Formulare (with `isKanzleiEigen: false`) — current design only allows kanzlei-eigene uploads via /admin/muster.
   - Recommendation: For v0.1, hardcode 5-8 key Arbeitsrecht forms (Kündigungsschutzklage, Abmahnungsschreiben, Aufhebungsvertrag, einstweilige Verfügung, Zeugnis-Klage). The admin upload UI can be extended to allow amtliche uploads in v0.2 via an "amtlich" flag in the form.

2. **Does `extractMusterText()` (used for NER in Phase 16) need to be fixed for DOCX files?**
   - What we know: Phase 16 code reads DOCX as raw bytes and calls `toString("utf-8")` — returns binary garbage. NER on garbage returns `hasPii: false` (no person names in binary). The INDEXED transition happens, but NER ran on meaningless content.
   - What's unclear: Whether this is a compliance risk (BRAO §43a). A DOCX with person names in the XML would NOT be caught by NER running on binary output.
   - Recommendation: Fix `extractMusterText()` to detect DOCX MIME and route through Stirling→pdf-parse before NER. This is a correctness fix required for ARBW-03 compliance. Flag this as Plan 01 prerequisite.

3. **Should the muster-ingestion queue be separate or triggered inline from ner-pii processor?**
   - What we know: Current ner-pii.processor.ts comment says "Phase 18 will trigger chunk+embedding". Two options: (A) ner-pii.processor.ts directly calls `musterIngestionQueue.add()` after INDEXED, or (B) a polling API that admins can trigger manually.
   - Recommendation: Option A — inline `musterIngestionQueue.add()` call from ner-pii.processor.ts. This creates clean automatic pipeline without admin intervention. Requires importing musterIngestionQueue in ner-pii.processor.ts (circular dep risk — move queues.ts import to avoid).

4. **minScore threshold for muster_chunks in Chain F?**
   - What we know: Template content with high `{{PLATZHALTER}}` density has lower embedding signal than prose. `minScore: 0.6` (used for law/urteil) may return 0 results.
   - Recommendation: Start with `minScore: 0.55` in Chain F. Optionally embed a description string ("`${name} — ${kategorie} — ${rechtsgebiet}`") alongside the template content to improve retrieval signal. This would require a separate "description embedding" field in MusterChunk — out of scope for v0.1.

---

## Validation Architecture

> `workflow.nyquist_validation` is not present in `.planning/config.json` — skip this section per instruction.

---

## Sources

### Primary (HIGH confidence)

- Project codebase `prisma/schema.prisma` lines 294-299, 1001-1033 — MusterNerStatus enum, Muster model (verified: no isKanzleiEigen field exists; must be added), MusterChunk model (no kanzleiEigen field; must be added)
- Project codebase `prisma/migrations/manual_rag_hnsw_indexes.sql` lines 27-30 — muster_chunks_embedding_hnsw index ALREADY EXISTS (no re-creation needed)
- Project codebase `src/lib/queue/processors/ner-pii.processor.ts` lines 1-205 — complete state machine; comment line 14 confirms "Phase 18 Admin Upload UI will call nerPiiQueue.add()"; `extractMusterText()` reads raw bytes (DOCX binary gap identified)
- Project codebase `src/lib/queue/queues.ts` lines 139-173 — `nerPiiQueue` registered and exported; `ALL_QUEUES` array pattern confirmed for Bull Board
- Project codebase `src/worker.ts` lines 572-598, 772-828 — `ner-pii` Worker registration + `recoverStuckNerJobs()` startup sweep pattern
- Project codebase `src/lib/storage.ts` — `uploadFile()`, `getFileStream()`, `BUCKET` constant (single bucket "dokumente"); muster-uploads/ prefix is a key prefix in the same bucket
- Project codebase `src/lib/embedding/chunker.ts` — `chunkDocumentParentChild()` with `GERMAN_LEGAL_SEPARATORS` (verified; directly reusable for Muster)
- Project codebase `src/lib/ocr/stirling-client.ts` — `convertToPdf()` for DOCX→PDF conversion (verified; exact endpoint `/api/v1/convert/file/pdf`)
- Project codebase `src/app/(dashboard)/admin/layout.tsx` — admin navigation array + ADMIN role enforcement pattern
- Project codebase `src/app/api/admin/pipeline/route.ts` — `auth()` + `role !== "ADMIN"` pattern for API route RBAC
- Project codebase `src/app/api/ki-chat/route.ts` lines 492-579 — Chain E pattern (exact template for Chain F); `Promise.all` destructuring; SYSTEM_PROMPT_BASE (includes ENTWURF hard limit and {{PLATZHALTER}} Ship-it-Prinzip already)
- Project codebase `src/lib/urteile/ingestion.ts` + `src/lib/gesetze/ingestion.ts` — exact patterns for DELETE+INSERT idempotent ingestion and pgvector `$queryRaw` with score calculation
- Project codebase `package.json` lines 70, 87, 116 — `pdf-parse ^2.4.5` and `@types/pdf-parse ^1.1.5` already installed; `docxtemplater ^3.68.2` present (for template rendering, not text extraction); NO mammoth package

### Secondary (MEDIUM confidence)

- STATE.md accumulated context (Phase 16 decisions) — `buildNerPrompt() does not slice text — caller responsible for windowing (Muster: slice(0,6000)+slice(-2000) in Phase 18 processor)` — confirms DOCX binary issue is known
- STATE.md (Phase 16 decisions) — `Muster.name used for logging (schema has no dateiname field); plan spec was incorrect — actual field is name` — confirms Muster schema field name

### Tertiary (LOW confidence)

- No external research required — all findings derived from project codebase. Standard library usage (pdf-parse, Stirling-PDF, BullMQ) is HIGH confidence from Phase 16/17 experience.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are existing project dependencies; exact patterns from codebase verified
- Schema migration: HIGH — current schema confirmed missing `isKanzleiEigen`/`kanzleiEigen`; migration pattern follows existing project conventions
- Architecture (3 plans): HIGH — each plan mirrors a validated prior phase pattern (seed = gesetze pattern; admin UI = admin/pipeline pattern; Chain F = Chain E pattern)
- DOCX NER gap: HIGH — confirmed by reading extractMusterText() in ner-pii.processor.ts; binary toString("utf-8") on DOCX is a correctness issue for ARBW-03
- minScore threshold for muster_chunks: MEDIUM — based on reasoning about placeholder density; empirical validation needed post-implementation
- amtliche Formulare seed content: MEDIUM — content drafted in research; quality depends on actual German Arbeitsrecht form accuracy; should be reviewed by domain expert

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (all dependencies are existing project code; no external APIs or third-party services change this)
