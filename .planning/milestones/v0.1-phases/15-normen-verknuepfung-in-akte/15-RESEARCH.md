# Phase 15: Normen-Verknüpfung in Akte - Research

**Researched:** 2026-02-27
**Domain:** Next.js API routes, Prisma AkteNorm model, React dialog/search UI, ki-chat system-prompt extension
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GESETZ-04 | Nutzer kann §§ strukturiert an Akte verknüpfen — Suchmodal über law_chunks, Hinzufügen mit optionaler Notiz, Anzeige als Chip-Liste in Akte-Detailseite; pinned Normen werden in Helenas System-Kontext für die Akte injiziert | AkteNorm Prisma model already exists (Phase 12) with fields: id, akteId, gesetzKuerzel, paragraphNr, anmerkung?, addedById, createdAt; unique constraint (akteId, gesetzKuerzel, paragraphNr); searchLawChunks() already available in src/lib/gesetze/ingestion.ts; ki-chat Chain A already fetches structured Akte context — pinned norms extend that block; search dialog follows beteiligte-add-dialog.tsx pattern (setTimeout debounce + fetch) |
</phase_requirements>

---

## Summary

Phase 15 is a pure application-logic phase: no new npm packages, no schema migrations (the `akte_normen` table was created in Phase 12), no new background workers. The work divides into three layers:

**Layer 1 — API:** Two new Next.js route handlers under `/api/akten/[id]/normen`. `GET` returns all normen for an Akte (sorted newest-first). `POST` adds a norm (looks up the matching law_chunk to copy gesetzKuerzel + paragraphNr + titel + content, creates the AkteNorm row). `DELETE /api/akten/[id]/normen/[normId]` removes a norm. A fourth route `GET /api/akten/[id]/normen/search?q=...` wraps `searchLawChunks()` for the modal's live search.

**Layer 2 — UI:** A new `NormenSection` component rendered in the Akte detail page (added to the Übersicht tab or below it as a standalone section). The section shows the chip-list of pinned norms. An "Norm hinzufügen" button opens a `NormSearchModal` (follows the `BeteiligteAddDialog` search pattern: `useState` + `setTimeout(300ms)` debounce + `fetch` + results list). Each chip is clickable to open a `NormDetailSheet` (Radix Sheet) showing the full § text and source link. Each chip has a remove button (X) that calls `DELETE`.

**Layer 3 — Helena integration:** The ki-chat Chain A block already constructs an `--- AKTEN-KONTEXT ---` block from the Akte data. This block must be extended with pinned normen: a single additional `prisma.akteNorm.findMany({ where: { akteId } })` inside Chain A, followed by a join to `law_chunks` to retrieve content. The injected block goes into the system prompt as `--- PINNED NORMEN (Akte ${aktenzeichen}) ---`. This is HIGHEST priority context (appears before GESETZE-QUELLEN from Chain D). When pinned norms are present, Chain D still runs but the system prompt explicitly instructs Helena to prioritize pinned norms over auto-retrieved normen.

**Primary recommendation:** Build the API first (3 route handlers), then the UI in one component (`NormenSection` containing `NormSearchModal` and `NormDetailSheet`), then extend Chain A. The modal search calls the normen/search endpoint (not a raw API), keeping law_chunks access server-side only.

---

## Standard Stack

### Core (all already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@prisma/client` | ^5.22.0 | `prisma.akteNorm` CRUD + `prisma.lawChunk.findFirst()` for content lookup | AkteNorm model exists from Phase 12; no schema change needed |
| `@radix-ui/react-dialog` | ^1.1.4 | Search modal overlay | Already installed; used via `alert-dialog.tsx` pattern; a `dialog.tsx` wrapper needed (see below) |
| `@radix-ui/react-sheet` or Sheet from shadcn | — | Norm detail side panel | `src/components/ui/sheet.tsx` already exists |
| `next/navigation` `useRouter` | Next.js 14+ | `router.refresh()` after add/remove to re-fetch server component data | Identical to `BeteiligteAddDialog` pattern |
| `sonner` | installed | Toast notifications on success/error | Already used in all dialogs |
| `zod` | installed | API request validation | Standard — used in all existing API routes |

### No New npm Packages Required

All required libraries are already present. `@radix-ui/react-dialog` is installed (`package.json:40`). If a `dialog.tsx` shadcn wrapper does not yet exist in `src/components/ui/`, it must be created from the Radix primitive — but this is a 30-line wrapper, not a new dependency.

**Installation:**
```bash
# No new packages needed
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `router.refresh()` after mutations | Optimistic UI / React Query | `router.refresh()` is the established pattern in this codebase (see `BeteiligteAddDialog`). Optimistic UI adds complexity for minor UX gain in an admin tool. |
| Separate `/api/law-chunks/search` endpoint | Inline `searchLawChunks()` in normen/search route | Keeping search server-side (in the normen API) avoids exposing raw law_chunks content to the client and reuses existing auth+RBAC middleware. |
| Sheet (side panel) for norm detail | Dialog | Sheet is better UX for reading long § text. The project already has `sheet.tsx`. Dialog better for short confirmations. |
| Full text in chip tooltip | Separate detail view | § text can be 500-2000 chars — too long for tooltip. Sheet (side panel) is appropriate. |

---

## Architecture Patterns

### Recommended File Structure

```
src/
├── app/
│   ├── api/
│   │   └── akten/
│   │       └── [id]/
│   │           └── normen/
│   │               ├── route.ts          # GET (list) + POST (add)
│   │               ├── search/
│   │               │   └── route.ts      # GET ?q=... (search law_chunks)
│   │               └── [normId]/
│   │                   └── route.ts      # DELETE (remove)
│   └── (dashboard)/
│       └── akten/
│           └── [id]/
│               └── page.tsx              # MODIFY: include normen in Prisma query + pass to NormenSection
├── components/
│   ├── akten/
│   │   └── normen-section.tsx            # NEW: chip-list + NormSearchModal + NormDetailSheet
│   └── ui/
│       └── dialog.tsx                    # NEW if not exists: Radix Dialog wrapper (30 lines)
└── app/
    └── api/
        └── ki-chat/
            └── route.ts                  # MODIFY: Chain A fetches normen + injects into system prompt
```

### Pattern 1: AkteNorm API Route — GET + POST

**What:** List all pinned normen for an Akte; add a new norm.

**When to use:** Standard Next.js route pattern. Follows beteiligte route exactly.

```typescript
// Source: mirrors src/app/api/akten/[id]/beteiligte/route.ts pattern

// GET /api/akten/[id]/normen
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: akteId } = await params;

  const access = await requireAkteAccess(akteId);
  if (access.error) return access.error;

  const normen = await prisma.akteNorm.findMany({
    where: { akteId },
    include: { addedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(normen);
}

// POST /api/akten/[id]/normen
const addNormSchema = z.object({
  gesetzKuerzel: z.string().min(1),
  paragraphNr:   z.string().min(1),
  anmerkung:     z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: akteId } = await params;

  const access = await requireAkteAccess(akteId, { requireEdit: true });
  if (access.error) return access.error;
  const { session } = access;

  const body = await request.json();
  const parsed = addNormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Verify the law_chunk exists
  const chunk = await prisma.lawChunk.findFirst({
    where: {
      gesetzKuerzel: parsed.data.gesetzKuerzel,
      paragraphNr: parsed.data.paragraphNr,
    },
  });
  if (!chunk) {
    return NextResponse.json(
      { error: "Norm nicht in law_chunks gefunden" },
      { status: 404 }
    );
  }

  // Check for duplicates (unique constraint: akteId + gesetzKuerzel + paragraphNr)
  const existing = await prisma.akteNorm.findUnique({
    where: {
      akteId_gesetzKuerzel_paragraphNr: {
        akteId,
        gesetzKuerzel: parsed.data.gesetzKuerzel,
        paragraphNr: parsed.data.paragraphNr,
      },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Diese Norm ist bereits an die Akte verknüpft" },
      { status: 409 }
    );
  }

  const norm = await prisma.akteNorm.create({
    data: {
      akteId,
      gesetzKuerzel: parsed.data.gesetzKuerzel,
      paragraphNr: parsed.data.paragraphNr,
      anmerkung: parsed.data.anmerkung ?? null,
      addedById: session.user.id,
    },
    include: { addedBy: { select: { name: true } } },
  });

  await logAuditEvent({
    userId: session.user.id,
    akteId,
    aktion: "NORM_VERKNUEPFT",
    details: { gesetzKuerzel: norm.gesetzKuerzel, paragraphNr: norm.paragraphNr },
  });

  return NextResponse.json(norm, { status: 201 });
}
```

### Pattern 2: AkteNorm DELETE Route

```typescript
// Source: mirrors beteiligte DELETE pattern

// DELETE /api/akten/[id]/normen/[normId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; normId: string }> }
) {
  const { id: akteId, normId } = await params;

  const access = await requireAkteAccess(akteId, { requireEdit: true });
  if (access.error) return access.error;
  const { session } = access;

  const norm = await prisma.akteNorm.findUnique({
    where: { id: normId },
  });
  if (!norm || norm.akteId !== akteId) {
    return NextResponse.json({ error: "Norm nicht gefunden" }, { status: 404 });
  }

  await prisma.akteNorm.delete({ where: { id: normId } });

  await logAuditEvent({
    userId: session.user.id,
    akteId,
    aktion: "NORM_ENTFERNT",
    details: { gesetzKuerzel: norm.gesetzKuerzel, paragraphNr: norm.paragraphNr },
  });

  return new NextResponse(null, { status: 204 });
}
```

### Pattern 3: Norm Search API Route

**What:** Wraps `searchLawChunks()` for the modal's live search. Because `searchLawChunks()` requires a pre-computed embedding (vector search), the search route uses Prisma full-text search on `gesetzKuerzel + paragraphNr + titel` via `ILIKE`. This is appropriate for the Norm search use case: users will type "§ 626 BGB" or "Kündigung" — a simple text match on `paragraphNr` and `titel` is sufficient for lookup. Vector search is not needed here (the pinning workflow is explicit selection, not semantic discovery).

**Critical architectural decision:** The normen search endpoint uses SQL `ILIKE` on `law_chunks` — NOT vector embedding — because:
1. Users search for specific §§ by number (e.g. "§ 626") — exact/prefix match is correct
2. Generating an embedding for each keypress (debounced at 300ms) would require an Ollama round-trip per search — 200ms-10s latency is unacceptable for a search modal
3. The `searchLawChunks()` function (embedding-based) is appropriate for semantic RAG, not for user-driven norm lookup

```typescript
// GET /api/akten/[id]/normen/search?q=...
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: akteId } = await params;

  const access = await requireAkteAccess(akteId);
  if (access.error) return access.error;

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json([]);
  }

  // Text search on law_chunks — ILIKE on gesetzKuerzel, paragraphNr, titel
  const results = await prisma.$queryRaw<
    Array<{
      id: string;
      gesetzKuerzel: string;
      paragraphNr: string;
      titel: string;
      content: string;
      sourceUrl: string | null;
      syncedAt: Date;
    }>
  >`
    SELECT id, "gesetzKuerzel", "paragraphNr", titel, content, "sourceUrl", "syncedAt"
    FROM law_chunks
    WHERE
      "gesetzKuerzel" ILIKE ${'%' + q + '%'}
      OR "paragraphNr" ILIKE ${'%' + q + '%'}
      OR titel ILIKE ${'%' + q + '%'}
    ORDER BY "gesetzKuerzel" ASC, "paragraphNr" ASC
    LIMIT 20
  `;

  return NextResponse.json(results);
}
```

**Note on ILIKE parameter injection:** Prisma tagged template literals escape values. The `${'%' + q + '%'}` pattern is safe — Prisma uses parameterized queries. However, because the `%` wildcards must be part of the parameter string (not the SQL template), wrap q in JavaScript: `${'%' + q + '%'}`.

### Pattern 4: NormenSection UI Component

**What:** Client component rendered in the Akte detail page. Shows pinned norm chips; opens search modal; opens detail sheet.

**Location:** Below the Übersicht tab content OR as a permanent section directly in the page (not behind a tab). A permanent section is recommended — pinned norms are a key persistent context indicator for the Akte, not secondary data. Placement: between the stats row and the `AkteDetailTabs` component, or at the bottom of the Übersicht tab.

**UI structure:**
```
┌─ Verknüpfte Normen ──────────────────────────────────────────┐
│ [BGB § 626 ×] [KSchG § 1 ×] [ArbGG § 46 ×]  [+ Hinzufügen] │
└──────────────────────────────────────────────────────────────┘
```

Each chip is a `Badge` with a clickable label (opens detail sheet) and an X button (removes norm).

```typescript
// Source: follows BeteiligteAddDialog search pattern from src/components/akten/beteiligte-add-dialog.tsx

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { X, Plus, Search, Loader2, Scale } from "lucide-react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog"; // or import from ui/dialog.tsx wrapper

interface PinnedNorm {
  id: string;
  gesetzKuerzel: string;
  paragraphNr: string;
  anmerkung: string | null;
  addedBy: { name: string };
  createdAt: string;
}

interface SearchResult {
  id: string;
  gesetzKuerzel: string;
  paragraphNr: string;
  titel: string;
  content: string;
  sourceUrl: string | null;
  syncedAt: string;
}

export function NormenSection({
  akteId,
  initialNormen,
}: {
  akteId: string;
  initialNormen: PinnedNorm[];
}) {
  const router = useRouter();
  const [normen, setNormen] = useState<PinnedNorm[]>(initialNormen);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailNorm, setDetailNorm] = useState<SearchResult | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  // Debounced search — 300ms, identical to BeteiligteAddDialog pattern
  useEffect(() => {
    if (!modalOpen) return;
    const timer = setTimeout(() => {
      if (search.length >= 2) {
        setSearching(true);
        fetch(`/api/akten/${akteId}/normen/search?q=${encodeURIComponent(search)}`)
          .then(r => r.json())
          .then(setResults)
          .catch(() => {})
          .finally(() => setSearching(false));
      } else {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, modalOpen, akteId]);

  async function handleAdd(result: SearchResult, anmerkung?: string) {
    setAdding(true);
    try {
      const res = await fetch(`/api/akten/${akteId}/normen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gesetzKuerzel: result.gesetzKuerzel,
          paragraphNr: result.paragraphNr,
          anmerkung: anmerkung || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fehler beim Hinzufügen");
      }
      toast.success(`${result.gesetzKuerzel} ${result.paragraphNr} verknüpft`);
      setModalOpen(false);
      setSearch("");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(normId: string) {
    setRemoving(normId);
    try {
      const res = await fetch(`/api/akten/${akteId}/normen/${normId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Fehler beim Entfernen");
      toast.success("Norm entfernt");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium text-sm text-foreground">Verknüpfte Normen</h3>
          {normen.length > 0 && (
            <span className="text-xs text-muted-foreground">({normen.length})</span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setModalOpen(true)}
        >
          <Plus className="w-3 h-3 mr-1" />
          Norm hinzufügen
        </Button>
      </div>

      {/* Chip list */}
      {normen.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Noch keine Normen verknüpft. Normen fließen automatisch in Helenas Kontext ein.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {normen.map(norm => (
            <div
              key={norm.id}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border bg-background text-xs font-medium"
            >
              <button
                onClick={() => {
                  // Load full detail from search results or fetch
                  fetch(`/api/akten/${akteId}/normen/search?q=${encodeURIComponent(norm.paragraphNr + ' ' + norm.gesetzKuerzel)}`)
                    .then(r => r.json())
                    .then((data: SearchResult[]) => {
                      const match = data.find(
                        d => d.gesetzKuerzel === norm.gesetzKuerzel && d.paragraphNr === norm.paragraphNr
                      );
                      if (match) { setDetailNorm(match); setDetailOpen(true); }
                    });
                }}
                className="text-primary hover:underline"
              >
                {norm.gesetzKuerzel} {norm.paragraphNr}
              </button>
              {norm.anmerkung && (
                <span className="text-muted-foreground">· {norm.anmerkung.slice(0, 30)}</span>
              )}
              <button
                onClick={() => handleRemove(norm.id)}
                disabled={removing === norm.id}
                className="ml-1 text-muted-foreground hover:text-destructive"
                aria-label="Norm entfernen"
              >
                {removing === norm.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search modal and detail sheet rendered below */}
      {/* ... (Dialog + Sheet components) */}
    </div>
  );
}
```

### Pattern 5: ki-chat Chain A Extension (Pinned Norms in System Prompt)

**What:** Extend Chain A (Akte context block) to fetch pinned normen and inject them as the highest-priority law context for the Akte.

**How:** Inside the Chain A closure in `ki-chat/route.ts`, after fetching the Akte, add a `prisma.akteNorm.findMany()` call. For each pinned norm, fetch the corresponding law_chunk content. Build a separate block in the system prompt.

**Where in the prompt:** The PINNED NORMEN block goes BETWEEN the AKTEN-KONTEXT block and the QUELLEN block. This ordering signals priority: Akte metadata > Pinned norms (highest legal priority for this Akte) > Retrieved document chunks > Auto-retrieved law chunks (Chain D).

**Critical design decision:** Do NOT join `akte_normen` with `law_chunks` in a single Prisma query, because `law_chunks` uses `Unsupported("vector(1024)")` — Prisma cannot do JOINs across unsupported types. Instead:
1. `prisma.akteNorm.findMany({ where: { akteId } })` — returns the pinned norm metadata
2. For each pinned norm, `prisma.lawChunk.findFirst({ where: { gesetzKuerzel, paragraphNr } })` — fetches content

For performance: wrap both in `Promise.all()` or use a single `$queryRaw` JOIN.

```typescript
// Source: extends ki-chat/route.ts Chain A — verified against current file structure

// Inside Chain A closure, after fetching Akte data:
let pinnedNormenBlock = "";

if (akteId) {
  const pinnedNormen = await prisma.akteNorm.findMany({
    where: { akteId },
    orderBy: { createdAt: "asc" },
  });

  if (pinnedNormen.length > 0) {
    // Fetch law_chunk content for each pinned norm (parallel)
    const chunkPromises = pinnedNormen.map(norm =>
      prisma.lawChunk.findFirst({
        where: {
          gesetzKuerzel: norm.gesetzKuerzel,
          paragraphNr: norm.paragraphNr,
        },
        select: { titel: true, content: true, sourceUrl: true, syncedAt: true },
      })
    );
    const chunks = await Promise.all(chunkPromises);

    pinnedNormenBlock = `\n\n--- PINNED NORMEN (Akte ${aktenzeichen} — höchste Priorität) ---\n`;
    pinnedNormen.forEach((norm, i) => {
      const chunk = chunks[i];
      if (!chunk) return;
      const standDate = new Date(chunk.syncedAt).toLocaleDateString("de-DE", {
        day: "2-digit", month: "2-digit", year: "numeric",
      });
      pinnedNormenBlock += `\n[P${i + 1}] ${norm.gesetzKuerzel} ${norm.paragraphNr}: ${chunk.titel}\n`;
      pinnedNormenBlock += `${chunk.content}\n`;
      if (norm.anmerkung) {
        pinnedNormenBlock += `Anmerkung des Anwalts: ${norm.anmerkung}\n`;
      }
      pinnedNormenBlock += `HINWEIS: nicht amtlich — Stand: ${standDate} | Quelle: ${chunk.sourceUrl ?? "https://www.gesetze-im-internet.de/"}\n`;
    });
    pinnedNormenBlock += "\n--- ENDE PINNED NORMEN ---";
    pinnedNormenBlock += "\n\nDiese Normen wurden vom Anwalt explizit für diese Akte verknüpft. Beziehe dich bevorzugt auf diese §§.";
  }
}

// System prompt assembly order:
// 1. SYSTEM_PROMPT_BASE + aktenKontextBlock
// 2. pinnedNormenBlock         ← NEW (highest legal priority for this Akte)
// 3. sources (QUELLEN)         ← document chunks
// 4. lawChunks (GESETZE-QUELLEN) ← auto-retrieved
```

**Performance consideration:** If an Akte has 10 pinned normen, this adds 10 `prisma.lawChunk.findFirst()` calls. These are indexed by `@@index([gesetzKuerzel])` and `@@index([paragraphNr])` (Phase 12 schema), so each is ~1ms. Total: ~10-20ms added to Chain A. Acceptable.

**Alternative (single raw query):** Use a `$queryRaw` JOIN between `akte_normen` and `law_chunks` to fetch content in one round-trip. This avoids N+1 but requires raw SQL. The `Promise.all()` approach is simpler and still fast enough (10 parallel DB calls is fine).

### Pattern 6: Akte Detail Page — Normen Include

**What:** The `akte/[id]/page.tsx` server component fetches the Akte via Prisma. It must be extended to include normen (for `initialNormen` prop to `NormenSection`).

```typescript
// Source: extends src/app/(dashboard)/akten/[id]/page.tsx Prisma query

const akte = await prisma.akte.findUnique({
  where: { id },
  include: {
    // ... existing includes ...
    normen: {
      include: { addedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    },
  },
});

// Pass to NormenSection:
<NormenSection
  akteId={id}
  initialNormen={serializedAkte.normen}
/>
```

**Placement in page.tsx:** Between the stats row and `<AkteDetailTabs>`, or inside the Übersicht tab. Recommended: standalone section between stats and tabs — it is always visible, not hidden behind a tab click. This is consistent with the "KPI-Cards als Navigation" UX note in project memory (permanent prominent placement).

### Anti-Patterns to Avoid

- **Embedding-based search in the norm search modal:** The modal should use ILIKE text search, NOT vector similarity. Users search by known § number — exact text match is better. Embedding + Ollama for each keypress would be 200ms-10s per search — unacceptable.
- **Fetching law_chunk content from the client:** The client should never call `/api/law-chunks` directly. All law_chunk data flows through the normen API routes, which apply RBAC middleware.
- **JOIN between akte_normen and law_chunks in Prisma:** Prisma cannot JOIN tables with `Unsupported()` column types in normal queries. Use separate Prisma calls or `$queryRaw`.
- **Blocking ki-chat on pinned norm fetch when no Akte is selected:** Only run the pinned norm lookup when `akteId` is set. Always skip when `akteId` is null (global Helena chat context).
- **Caching pinned norms in React state across page navigations:** `router.refresh()` is the correct invalidation mechanism. React state (`initialNormen`) is stale after mutation — always call `router.refresh()` to re-run the server component and get fresh data.
- **Adding normen to the AkteData TypeScript interface in akte-detail-tabs.tsx:** The `NormenSection` is a standalone component with its own `initialNormen` prop. Do NOT add normen to the `AkteData` interface in `akte-detail-tabs.tsx` — that interface already has 11 fields. Keep concerns separated.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Norm text display | Custom markdown renderer | Pass raw content string to `<pre>` or `<p>` with `whitespace-pre-wrap` | Gesetz content is plain text (no Markdown in law_chunks.content after parsing); no renderer needed |
| Modal overlay | Custom CSS overlay + event capture | `@radix-ui/react-dialog` (already installed) | Focus trap, keyboard dismiss (Esc), aria-modal, scroll lock — all handled |
| Debounced search | `lodash.debounce` | `setTimeout` + `clearTimeout` in `useEffect` (300ms) | Already the established pattern in `BeteiligteAddDialog` — consistent, no new dependency |
| RBAC check | Manual session check in route | `requireAkteAccess(akteId, { requireEdit: true })` | Existing RBAC helper handles auth + Akte membership check + role check uniformly |
| Duplicate norm check | Custom query | Prisma `findUnique` on the `@@unique([akteId, gesetzKuerzel, paragraphNr])` compound index + 409 response | DB-level uniqueness is already enforced; check before write to return helpful error |
| Audit logging | Custom DB write | `logAuditEvent()` from `@/lib/audit` | Established audit trail pattern used in all mutation routes |

**Key insight:** This phase is entirely glue code — connecting the already-built `akte_normen` table (Phase 12), the already-built `law_chunks` table and `searchLawChunks()` (Phase 14), and the already-built ki-chat route. There is no new algorithmic work.

---

## Common Pitfalls

### Pitfall 1: Prisma JOIN Limitation with Unsupported Column Types

**What goes wrong:** Attempting `prisma.akteNorm.findMany({ include: { ... lawChunk ... } })` fails — `AkteNorm` has no direct relation to `LawChunk` in the schema (they share `gesetzKuerzel + paragraphNr` as a logical key, but there is no FK from `akte_normen` to `law_chunks`). Even if a relation existed, Prisma cannot include relations on models with `Unsupported()` columns in standard typed queries.

**Why it happens:** `LawChunk.embedding` is `Unsupported("vector(1024)")`. Prisma's type generator cannot produce a usable TypeScript type for this field in `include` expressions.

**How to avoid:** Fetch `AkteNorm[]` first, then fetch `LawChunk` content separately per norm (N+1 with `Promise.all()` is fine for N ≤ 20). Or use `prisma.$queryRaw` with a SQL JOIN — raw results bypass TypeScript type limitations.

**Warning signs:** TypeScript error `Type 'AkteNorm' does not have property 'lawChunk'` or `Argument of type '...' is not assignable` in Prisma include expressions.

### Pitfall 2: Stale `initialNormen` Prop After Mutations

**What goes wrong:** After adding or removing a norm, the component calls `router.refresh()` which re-runs the server component and passes fresh `initialNormen`. BUT if the developer initializes local React state from `initialNormen` with `useState(initialNormen)`, the state is set once at mount and does NOT update on `router.refresh()` because the component re-renders with new props but `useState` ignores the new initial value.

**Why it happens:** `useState(initialNormen)` — the initial value is only used on first render. Subsequent `router.refresh()` passes new `initialNormen` props but the state remains stale.

**How to avoid:** Option A (recommended): Use `initialNormen` directly as prop (not local state) — the server component provides fresh data after refresh. Keep local state only for in-flight mutation indicators (`removing`, `adding`). Option B: Use `useEffect(() => { setNormen(initialNormen); }, [initialNormen])` to sync prop changes into state.

**Warning signs:** Chip disappears from UI immediately (optimistic remove), but reappears after 500ms (stale state re-syncs) — or vice versa.

### Pitfall 3: ILIKE Parameter Injection Safety

**What goes wrong:** When building the ILIKE search query, developers may attempt to interpolate `q` directly into the SQL template string: `` `WHERE titel ILIKE '%${q}%'` ``. This bypasses Prisma's parameterized query system and creates a SQL injection vulnerability.

**Why it happens:** Misunderstanding of how Prisma tagged template literals work — only `${expression}` within the template creates a bound parameter.

**How to avoid:** Always pass the wildcard-wrapped string as a bound parameter: `${'%' + q + '%'}`. Prisma escapes this value and passes it as a SQL parameter.

**Warning signs:** TypeScript does not catch this; testing with `q = "'; DROP TABLE law_chunks; --"` would reveal the issue.

### Pitfall 4: Missing Norm Content When law_chunks Table is Empty

**What goes wrong:** If Phase 14 ingestion has not yet run (law_chunks is empty), the normen search endpoint returns zero results. More critically, for any AkteNorm already added, the ki-chat Chain A fetches content with `prisma.lawChunk.findFirst()` → `null`. The system prompt injection code must guard against `null` chunks.

**Why it happens:** Phase 14 runs the initial ingestion asynchronously (nightly cron or manual trigger). In development, law_chunks may be empty.

**How to avoid:** In Chain A, skip the content injection for any norm where `chunk === null`. In the search modal, show "Keine Normen gefunden. law_chunks-Tabelle ist möglicherweise leer." when results are empty.

**Warning signs:** System prompt contains `[P1] BGB § 626: undefined` or similar.

### Pitfall 5: Dialog Wrapper Component Missing

**What goes wrong:** `@radix-ui/react-dialog` is installed but the project does not have a `src/components/ui/dialog.tsx` shadcn wrapper (only `alert-dialog.tsx` exists). Direct import of the Radix primitive is verbose.

**Why it happens:** The shadcn CLI generates `dialog.tsx` on-demand. The project never needed a general-purpose Dialog (existing modals use custom overlay divs like `BeteiligteAddDialog`).

**How to avoid:** Either (A) create a `dialog.tsx` wrapper following the shadcn pattern (30 lines, use `@radix-ui/react-dialog` directly — verified installed), or (B) build the norm search modal using the same pattern as `BeteiligteAddDialog`: a conditional render with `position: fixed` overlay div + `z-50`. Option B is consistent with existing codebase style and avoids creating a new component.

**Warning signs:** Import error `Cannot find module '@/components/ui/dialog'`.

### Pitfall 6: Chip Click Detail Fetch Performance

**What goes wrong:** Clicking a chip triggers a search API call (`/api/akten/[id]/normen/search?q=...`) to fetch the full content for the detail sheet. If the modal search was already used, the result may be in React state — but chips show data from `initialNormen` (no content field). A second API call on click introduces latency.

**Why it happens:** `initialNormen` (from `prisma.akteNorm.findMany()`) does not include `content` — AkteNorm stores only gesetzKuerzel + paragraphNr, not the full § text. The full text is in `law_chunks`.

**How to avoid:** Option A: Add a dedicated `GET /api/akten/[id]/normen/[normId]` endpoint that returns the AkteNorm joined with law_chunk content. Option B: On chip click, fetch `/api/akten/[id]/normen/search?q=${paragraphNr}+${gesetzKuerzel}` (reuse the search endpoint). Option B is simpler (reuses existing code). The latency is acceptable (one DB query, ~5ms). Show a loading spinner while fetching.

---

## Code Examples

Verified patterns from official sources and codebase inspection:

### Prisma AkteNorm findMany with content join (parallel fetch)

```typescript
// Source: prisma/schema.prisma AkteNorm model (lines 1035-1049) — direct inspection

const pinnedNormen = await prisma.akteNorm.findMany({
  where: { akteId },
  orderBy: { createdAt: "asc" },
});

// Parallel law_chunk content fetch — no N+1 problem with Promise.all
const chunks = await Promise.all(
  pinnedNormen.map(norm =>
    prisma.lawChunk.findFirst({
      where: {
        gesetzKuerzel: norm.gesetzKuerzel,
        paragraphNr: norm.paragraphNr,
      },
      select: { titel: true, content: true, sourceUrl: true, syncedAt: true },
    })
  )
);
```

### ILIKE search on law_chunks

```typescript
// Source: Prisma $queryRaw pattern from src/lib/gesetze/ingestion.ts — adapted for text search

const results = await prisma.$queryRaw<LawChunkRow[]>`
  SELECT id, "gesetzKuerzel", "paragraphNr", titel,
         LEFT(content, 300) AS content,
         "sourceUrl", "syncedAt"
  FROM law_chunks
  WHERE
    "gesetzKuerzel" ILIKE ${'%' + q + '%'}
    OR "paragraphNr" ILIKE ${'%' + q + '%'}
    OR titel ILIKE ${'%' + q + '%'}
  ORDER BY "gesetzKuerzel" ASC, "paragraphNr" ASC
  LIMIT 20
`;
```

Note: `LEFT(content, 300)` is used in the search response to avoid sending large content fields to the client in the search list. The full content is only fetched when the user clicks a chip or selects a result.

### System prompt injection order in ki-chat/route.ts

```typescript
// Source: current src/app/api/ki-chat/route.ts lines 452-483 — extended

let systemPrompt = SYSTEM_PROMPT_BASE + aktenKontextBlock;

// Priority order: NO_SOURCES / LOW_CONFIDENCE instruction
if (confidenceFlag === "none") systemPrompt += NO_SOURCES_INSTRUCTION;
else if (confidenceFlag === "low") systemPrompt += LOW_CONFIDENCE_INSTRUCTION;

// [NEW] Pinned norms — highest legal priority context for this Akte
if (pinnedNormenBlock) {
  systemPrompt += pinnedNormenBlock;
}

// Document retrieval sources
if (sources.length > 0) {
  systemPrompt += "\n\n--- QUELLEN ---\n";
  sources.forEach((src, i) => {
    systemPrompt += `\n[${i + 1}] Dokument: ${src.dokumentName} (Akte: ${src.akteAktenzeichen})\n${src.contextContent}\n`;
  });
  systemPrompt += "\n--- ENDE QUELLEN ---";
}

// Auto-retrieved law chunks (Chain D) — lower priority than pinned
if (lawChunks.length > 0) {
  systemPrompt += "\n\n--- GESETZE-QUELLEN (nicht amtlich) ---\n";
  lawChunks.forEach((norm, i) => {
    // ... existing format ...
  });
  systemPrompt += "\n--- ENDE GESETZE-QUELLEN ---";
  systemPrompt += "\n\nWenn du Normen zitierst, füge immer den 'nicht amtlich'-Hinweis und den Quellenlink hinzu.";
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No explicit § pinning — Helena retrieved normen auto (Chain D) | Anwalt kann §§ explizit an Akte pinnen — pinned normen haben höchste LLM-Priorität | Phase 15 | Explizite Rechtsstrategie: Anwalt gibt vor welche §§ für den Fall zentral sind; Helena referenziert diese bevorzugt |
| law_chunks auto-retrieval only (semantic, score-based) | law_chunks: two modes — (1) semantic auto-retrieval via Chain D, (2) explicit pin-selection via AkteNorm | Phase 15 | Kombination aus automatischer Relevanz-Erkennung und manueller Kuratierung |
| No annotation on retrieved normen | Pinned normen can carry Anwalt's `anmerkung` — injected into system prompt | Phase 15 | Anwalt kann "§ 626 BGB — zentrale Norm, Kündigung aus wichtigem Grund" direkt in Helenas Kontext einbetten |

**Deprecated/outdated:**
- Nothing from prior phases is deprecated by Phase 15. This phase extends, not replaces, Chain D.

---

## Open Questions

1. **Chip click detail fetch — dedicated endpoint vs reuse search?**
   - What we know: `initialNormen` lacks content. A fetch is required on chip click.
   - What's unclear: Should the planner create a `GET /api/akten/[id]/normen/[normId]` detail endpoint, or reuse the search endpoint?
   - Recommendation: Reuse search endpoint with targeted query (`?q=gesetzKuerzel+paragraphNr`). One less API route to build. The search result includes sufficient content. If result is not found (edge case: law_chunks was resynced and gesetzKuerzel changed), show a fallback message.

2. **Placement of NormenSection in the page**
   - What we know: Page currently has stats row + AkteDetailTabs. Übersicht tab already has substantial content.
   - What's unclear: Should normen be a permanent section (always visible, before tabs) or a tab section?
   - Recommendation: Permanent section between stats row and AkteDetailTabs. Pinned norms are always-relevant metadata for the Akte, not secondary data hidden behind a tab. Consistent with MEMORY.md note about KPI-Cards as navigation.

3. **Chain A performance impact with many pinned norms**
   - What we know: `Promise.all()` on N law_chunk fetches. `law_chunks` has HNSW index on embedding but also `@@index([gesetzKuerzel])` and `@@index([paragraphNr])` for fast findFirst. N ≤ 20 in practice.
   - What's unclear: Exact latency. Each `findFirst` should be ~1ms with the index.
   - Recommendation: Use `Promise.all()`. If performance is a concern after implementation, replace with a single `$queryRaw` JOIN (but only if measurements show > 50ms total).

4. **Anmerkung (optional note) UX in search modal**
   - What we know: The `anmerkung` field on AkteNorm is optional.
   - What's unclear: Should the search modal have an inline textarea for anmerkung before confirming, or should anmerkung be editable after adding?
   - Recommendation: Show a small optional textarea below the selected norm in the modal before adding. The interaction is: search → select result → optionally type anmerkung → click "Hinzufügen". This is the same as the `notizen` field in BeteiligteAddDialog.

---

## Sources

### Primary (HIGH confidence)

- `prisma/schema.prisma` lines 1035-1049 — AkteNorm model confirmed: id, akteId, gesetzKuerzel, paragraphNr, anmerkung?, addedById, createdAt; unique constraint (akteId, gesetzKuerzel, paragraphNr); index (akteId) — Phase 12 schema, no migration needed in Phase 15
- `prisma/schema.prisma` lines 964-979 — LawChunk model confirmed: gesetzKuerzel, paragraphNr, titel, content, parentContent, embedding (Unsupported), modelVersion, syncedAt, sourceUrl; @@index([gesetzKuerzel]) and @@index([paragraphNr]) present — fast findFirst by gesetzKuerzel+paragraphNr
- `prisma/schema.prisma` line 730 — Akte.normen relation confirmed: `normen AkteNorm[]`
- `src/app/api/ki-chat/route.ts` — Chain A/B/C/D structure confirmed; system prompt construction verified; pinnedNormenBlock insertion point identified after aktenKontextBlock
- `src/lib/gesetze/ingestion.ts` — searchLawChunks(), buildSourceUrl(), LawChunkResult type — all verified directly
- `src/components/akten/beteiligte-add-dialog.tsx` — setTimeout 300ms debounce + fetch pattern confirmed; state management pattern (search, results, loading, adding) — the NormSearchModal follows this exactly
- `src/app/api/akten/[id]/beteiligte/route.ts` — POST + DELETE pattern with requireAkteAccess + logAuditEvent + 201/204 responses — AkteNorm routes follow this identically
- `package.json` line 40 — `@radix-ui/react-dialog: ^1.1.4` confirmed installed
- `src/components/ui/sheet.tsx` — confirmed exists for NormDetailSheet
- `src/components/ui/badge.tsx` — confirmed exists with outline variant for norm chips
- `prisma/migrations/20260226234332_add_rag_schema_foundation/migration.sql` — `akte_normen` table confirmed in DB; unique index confirmed

### Secondary (MEDIUM confidence)

- Prisma `$queryRaw` ILIKE parameter safety: Prisma documentation confirms tagged template literals produce parameterized queries; `${'%' + q + '%'}` is the correct pattern for wildcard parameters (verified against Prisma docs pattern and existing usage in `ingestion.ts`)

### Tertiary (LOW confidence — flag for validation)

- Performance of N parallel `prisma.lawChunk.findFirst()` calls in Chain A — assumption that 10 calls × ~1ms = ~10ms total. Should be empirically validated after implementation.
- ILIKE search performance on `law_chunks` without a trigram index (`pg_trgm`). The `gesetzKuerzel` and `paragraphNr` ILIKE queries benefit from standard B-tree indexes for prefix matches but NOT for inner-string matches (`%text%`). For 50k+ law_chunks rows, `ILIKE '%Kündigung%'` on `titel` could require a seq scan. Consider `pg_trgm` GIN index if search performance is poor. Not a blocker — user will typically search by § number (e.g. "§ 626") which benefits from the index.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; all patterns verified directly in codebase files
- Architecture: HIGH — AkteNorm schema verified from migration SQL and Prisma schema; ki-chat integration point verified from current route.ts; UI pattern verified from BeteiligteAddDialog
- Pitfalls: HIGH — Prisma Unsupported() join limitation is a known Prisma constraint; ILIKE injection pattern verified; stale state pitfall is a standard React pattern issue

**Research date:** 2026-02-27
**Valid until:** 2026-04-27 (stable — no external APIs, all patterns internal to the codebase)
