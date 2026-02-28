# Phase 26: Activity Feed UI + QA-Gates - Research

**Researched:** 2026-02-28
**Domain:** Activity Feed UI (React/Next.js) + QA Infrastructure (Retrieval Metrics, Goldset Testing)
**Confidence:** HIGH

## Summary

Phase 26 has two distinct halves: (1) transforming the Akte detail page from a 12-tab layout into a unified Activity Feed with 3 retained tabs plus a sticky composer for @Helena interaction, and (2) building a QA infrastructure layer with goldset tests, retrieval metrics, hallucination checks, and release gates. Both halves build on extensive existing infrastructure -- the AktenActivity model already has 8 event types being written by the draft-service and scanner-service, Socket.IO event infrastructure is mature with task progress events, and the Schriftsatz pipeline already tracks retrieval_belege[] for audit trails.

The UI work is primarily a restructuring exercise: the current `akte-detail-tabs.tsx` (899 lines, 12 tabs) will be refactored into 4 tabs (Feed default + Dokumente + Kalender + Finanzen), absorbing Uebersicht, Beteiligte, Historie, Warnungen, Pruefprotokoll, and E-Mails into feed entries. The existing AkteHistorie component's vertical timeline with filter chips is the primary pattern to extend. The QA work requires a new Prisma model (SchriftsatzRetrievalLog), a goldset test fixture set, and metric computation utilities with an admin-only dashboard page.

**Primary recommendation:** Build the Activity Feed as a separate component tree (not inline in akte-detail-tabs.tsx), using the existing AktenActivity Prisma model as the data source with a new `/api/akten/[id]/feed` endpoint. For QA, create a `src/lib/helena/qa/` module with goldset fixtures, metric calculators, and a CLI-compatible API endpoint for CI release gates.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Feed becomes the **default tab** on Akte detail page
- **3 tabs kept** alongside: Dokumente, Kalender, Finanzen (combined Aktenkonto + Rechnungen + Zeiterfassung)
- Feed **absorbs**: Uebersicht, Beteiligte, Historie, Warnungen, Pruefprotokoll, E-Mails -- these all appear as feed entries
- Existing `akte-detail-tabs.tsx` gets restructured: Feed tab (default) + Dokumente + Kalender + Finanzen
- Filter chips **match AktenActivityTyp enum** directly: Alle | Dokumente | Fristen | E-Mails | Helena | Notizen | Status
- "Helena" chip combines HELENA_DRAFT + HELENA_ALERT
- "Status" chip combines BETEILIGTE + STATUS_CHANGE
- Primary click **expands entry inline** showing more detail (preview, actions)
- Small link icon **navigates to the kept tab** for deeper interaction
- Composer: **Sticky bottom** of feed, always visible like a chat input
- Composer supports **notes + @Helena mentions only** -- no document upload or Frist creation
- Simple textarea with @Helena trigger button
- @Helena task flow: User note appears **immediately**, "Helena denkt nach..." spinner with step progress (Step X/Y, current tool name), Helena's draft appears as **next feed entry** with inline Accept/Edit/Reject
- Uses existing HelenaTask step tracking via Socket.IO
- Draft review: Accept/Reject buttons **directly on the feed entry** -- no modal. Edit opens a **small inline editor** within the feed entry
- Helena vs Human attribution: same card layout, Helena entries get robot icon + "Helena" label, Helena drafts get **brand blue left border** (oklch(45% 0.2 260)), Helena alerts get **severity-colored left border** (rose/amber/emerald), human entries get no colored border
- Source display (QA-05): **Collapsible sources section** below Helena draft content. Collapsed: "Quellen: 3 Normen, 2 Urteile, 1 Muster" summary. Expanded: references with links
- Alert-Center dashboard widget: Badge count on **sidebar nav item** next to Alerts link. Already has Socket.IO `helena:alert-badge` wired. No separate header bell icon
- QA dashboard: **Admin-only** /qa-dashboard page (ADMIN role gate). Shows goldset results, Recall@k, MRR, hallucination rate
- Release gates: **CLI command / API endpoint** that runs goldset and checks thresholds. Recall@5 Normen >= 0.85, Halluzinationsrate <= 0.05, Formale Vollstaendigkeit >= 0.90. Returns clear pass/fail report
- PII protection: Anonymized query hashes only in **retrieval metrics logs** (separate table). Normal app logs keep full context

### Claude's Discretion
- Exact loading skeleton design for feed
- Feed pagination strategy (infinite scroll vs load-more)
- Goldset query selection (which 20+ Arbeitsrecht scenarios)
- Hallucination check algorithm implementation
- Feed entry expand/collapse animation
- Composer keyboard shortcuts

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UI-01 | Akte-Detail Activity Feed ersetzt Tab-basierte Navigation -- chronologischer Feed mit allen Events | AktenActivity model already has 8 event types; new `/api/akten/[id]/feed` endpoint with cursor pagination; restructure akte-detail-tabs.tsx from 12 to 4 tabs |
| UI-02 | Composer im Feed: Nutzer kann direkt im Feed Notizen schreiben und @Helena taggen | Existing `at-mention-parser.ts` for @Helena detection; `task-service.ts` for task creation; sticky bottom composer component with textarea |
| UI-03 | Helena vs Human Attribution: jeder Feed-Eintrag zeigt klar ob von Helena oder Mensch erstellt | AktenActivity.userId is null for Helena/system events; robot icon + "Helena" label + brand blue left border for Helena; existing severityBadgeClass pattern for alert colors |
| UI-04 | Alert-Center Dashboard-Widget mit Badge-Count fuer ungelesene Alerts | Sidebar already has `badgeKey: "unreadAlerts"` wired with Socket.IO `helena:alert-badge` event -- already functional, verify/polish only |
| UI-05 | Helena-Task-Status im Chat: Laufende Tasks zeigen Fortschritt (Step X von Y, aktuelles Tool) | Socket.IO events already emit `helena:task-started/progress/completed/failed`; need to listen in feed and render spinner entry with step info |
| UI-06 | Draft-Review inline im Feed: Accept/Reject/Edit ohne Seitenwechsel | Existing `draft-card.tsx` and `draft-pinned-section.tsx` patterns for Accept/Edit/Reject; adapt for inline feed entry with small editor |
| QA-01 | Goldset-Testkatalog mit >=20 Queries (Arbeitsrecht) | New `src/lib/helena/qa/goldset.ts` with fixture arrays; test scenarios for KSchG, Lohnklage, Abmahnung, EV, Mahnverfahren, Fristen, Kosten |
| QA-02 | Retrieval-Metriken automatisch messbar: Recall@k, MRR, No-result-Rate | Pure computation functions; run each goldset query through RAG pipeline, compare retrieved chunks against expected references |
| QA-03 | Halluzinations-Check: §-Referenzen und Aktenzeichen werden gegen Retrieval-Chunks verifiziert | Regex extraction of § references and Aktenzeichen from draft text; verify each against retrieval_belege[]; flag any not found in source chunks |
| QA-04 | Schriftsatz-Retrieval-Log pro Entwurf | New Prisma model SchriftsatzRetrievalLog with fields: schriftsatzId, queryHash, retrievalBelege, promptVersion, modell, recallAt5 |
| QA-05 | UI-Anzeige: "Helena hat X Normen, Y Urteile, Z Muster-Bausteine verwendet" mit aufklappbaren Quellen-Links | Collapsible section below Helena draft content; data comes from HelenaDraft.meta.retrieval_belege or SchriftsatzRetrievalLog |
| QA-06 | Release-Gates: Recall@5 Normen >= 0.85, Halluzinationsrate <= 0.05, Formale Vollstaendigkeit >= 0.90 | API endpoint `/api/admin/qa/release-gate` that runs goldset, computes metrics, returns pass/fail JSON report |
| QA-07 | Keine Mandantendaten in Logs (nur anonymisierte Query-Hashes fuer Metriken) | SHA-256 hash of query text in SchriftsatzRetrievalLog; Node.js `crypto.createHash('sha256')` is built-in |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (Next.js) | 14+ | Activity Feed UI components | Already in project stack |
| Prisma | 5.22+ | AktenActivity queries, new SchriftsatzRetrievalLog model | Already in project, single source of truth |
| Socket.IO client | 4.8.3 | Real-time feed updates, task progress | Already wired with useSocket() hook |
| Vitest | 4.0.18 | Goldset test execution | Already configured in project |
| Node.js crypto | built-in | SHA-256 query hashing for PII protection | No external dependency needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | (already installed) | Feed entry icons, robot icon for Helena | Icon per entry type |
| sonner | (already installed) | Toast notifications for composer submit | Existing toast pattern |
| zod | (already installed) | Goldset fixture schema validation | Type-safe test fixtures |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Cursor pagination (load-more) | Infinite scroll (IntersectionObserver) | Load-more is simpler, more predictable, matches existing AkteHistorie pattern |
| Inline editor (textarea) | TipTap rich text | Textarea is sufficient for notes; TipTap adds complexity for no benefit in this context |
| SHA-256 (built-in crypto) | uuid/nanoid for anonymization | SHA-256 is deterministic (same query produces same hash), enabling dedup and correlation |

**Installation:**
```bash
# No new packages needed -- all dependencies are already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   └── akten/
│       ├── akte-detail-tabs.tsx        # Restructured: 4 tabs (Feed + Dokumente + Kalender + Finanzen)
│       ├── activity-feed.tsx           # New: main feed component with filter chips + entry list
│       ├── activity-feed-entry.tsx     # New: polymorphic entry component (renders based on typ)
│       ├── activity-feed-composer.tsx  # New: sticky bottom composer with @Helena trigger
│       ├── activity-feed-skeleton.tsx  # New: loading skeleton for feed
│       └── helena-task-progress.tsx    # New: inline task progress spinner entry
├── app/
│   ├── api/akten/[id]/feed/
│   │   └── route.ts                   # New: feed endpoint (AktenActivity + cursor pagination)
│   ├── api/admin/qa/
│   │   ├── goldset/route.ts           # New: run goldset tests
│   │   └── release-gate/route.ts      # New: release gate check
│   └── (dashboard)/qa-dashboard/
│       └── page.tsx                   # New: admin-only QA metrics page
└── lib/
    └── helena/
        └── qa/
            ├── goldset.ts             # New: goldset fixture definitions
            ├── metrics.ts             # New: Recall@k, MRR, hallucination check
            └── retrieval-log.ts       # New: SchriftsatzRetrievalLog service
```

### Pattern 1: Polymorphic Feed Entry Rendering
**What:** A single FeedEntry component that renders differently based on AktenActivityTyp
**When to use:** Feed entries have different shapes (documents, deadlines, alerts, drafts, notes)
**Example:**
```typescript
// Pattern: switch on entry.typ to render appropriate sub-component
function ActivityFeedEntry({ entry }: { entry: FeedEntryData }) {
  const [expanded, setExpanded] = useState(false);

  const isHelena = entry.userId === null; // null userId = Helena/system
  const borderClass = isHelena
    ? entry.typ === "HELENA_ALERT"
      ? severityBorderClass(entry.meta?.severity)
      : "border-l-2 border-[oklch(45%_0.2_260)]" // Brand blue for Helena drafts
    : ""; // No colored border for human entries

  return (
    <div className={cn("glass-card rounded-xl", borderClass)}>
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left">
        {/* Header: icon + title + timestamp + attribution */}
        <FeedEntryHeader entry={entry} isHelena={isHelena} />
      </button>
      {expanded && <FeedEntryDetail entry={entry} />}
    </div>
  );
}
```

### Pattern 2: Sticky Composer at Feed Bottom
**What:** Always-visible textarea at the bottom of the feed for notes and @Helena mentions
**When to use:** Feed tab is active
**Example:**
```typescript
// Sticky bottom -- flex layout: feed scrolls, composer stays fixed
function ActivityFeed({ akteId }: { akteId: string }) {
  return (
    <div className="flex flex-col h-[calc(100vh-300px)]">
      {/* Filter chips */}
      <FeedFilterBar activeFilter={filter} onChange={setFilter} />

      {/* Scrollable feed entries */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {entries.map(entry => <ActivityFeedEntry key={entry.id} entry={entry} />)}
        {hasMore && <LoadMoreButton onClick={loadMore} />}
      </div>

      {/* Sticky composer */}
      <ActivityFeedComposer akteId={akteId} onNoteCreated={prependEntry} />
    </div>
  );
}
```

### Pattern 3: Socket.IO Task Progress in Feed
**What:** When user sends @Helena via composer, a spinner entry appears in feed showing step progress
**When to use:** After @Helena task is enqueued
**Example:**
```typescript
// Listen for helena:task-progress Socket.IO events
function useHelenaTaskProgress(akteId: string) {
  const { socket } = useSocket();
  const [activeTasks, setActiveTasks] = useState<Map<string, TaskProgress>>(new Map());

  useEffect(() => {
    if (!socket) return;

    const handleStarted = (data: { taskId: string; akteId: string; auftrag: string }) => {
      if (data.akteId !== akteId) return;
      setActiveTasks(prev => new Map(prev).set(data.taskId, {
        taskId: data.taskId, auftrag: data.auftrag, step: 0, maxSteps: 20, toolName: null
      }));
    };

    const handleProgress = (data: { taskId: string; akteId: string; stepNumber: number; maxSteps: number; toolName?: string }) => {
      if (data.akteId !== akteId) return;
      setActiveTasks(prev => {
        const next = new Map(prev);
        const existing = next.get(data.taskId);
        if (existing) {
          next.set(data.taskId, { ...existing, step: data.stepNumber, maxSteps: data.maxSteps, toolName: data.toolName ?? null });
        }
        return next;
      });
    };

    const handleCompleted = (data: { taskId: string }) => {
      setActiveTasks(prev => { const next = new Map(prev); next.delete(data.taskId); return next; });
    };

    socket.on("helena:task-started", handleStarted);
    socket.on("helena:task-progress", handleProgress);
    socket.on("helena:task-completed", handleCompleted);
    socket.on("helena:task-failed", handleCompleted);

    return () => {
      socket.off("helena:task-started", handleStarted);
      socket.off("helena:task-progress", handleProgress);
      socket.off("helena:task-completed", handleCompleted);
      socket.off("helena:task-failed", handleCompleted);
    };
  }, [socket, akteId]);

  return activeTasks;
}
```

### Pattern 4: QA Metrics Computation (Pure Functions)
**What:** Recall@k and MRR computed as pure functions over goldset results
**When to use:** Goldset evaluation endpoint and QA dashboard
**Example:**
```typescript
/**
 * Recall@k: fraction of expected items found in top-k retrieval results.
 * For each goldset query, compare retrieved chunk references against expected references.
 */
export function recallAtK(
  retrieved: string[],  // Retrieved chunk references
  expected: string[],   // Expected references from goldset
  k: number = 5,
): number {
  const topK = retrieved.slice(0, k);
  const found = expected.filter(ref => topK.some(r => r.includes(ref)));
  return expected.length > 0 ? found.length / expected.length : 0;
}

/**
 * MRR (Mean Reciprocal Rank): average of 1/rank for the first relevant result.
 */
export function mrr(
  retrieved: string[],
  expected: string[],
): number {
  for (let i = 0; i < retrieved.length; i++) {
    if (expected.some(ref => retrieved[i].includes(ref))) {
      return 1 / (i + 1);
    }
  }
  return 0;
}
```

### Pattern 5: Hallucination Check via Regex Extraction
**What:** Extract § references and Aktenzeichen from draft text, verify against retrieval sources
**When to use:** After draft generation, before presenting to user
**Example:**
```typescript
/**
 * Extract all § references from generated text.
 * Matches patterns like: § 622 BGB, §§ 1, 2 KSchG, Art. 12 GG
 */
export function extractParagraphRefs(text: string): string[] {
  const pattern = /(?:§§?\s*\d+[\s,]*(?:(?:Abs\.\s*\d+|S\.\s*\d+|Nr\.\s*\d+)[\s,]*)*\s*[A-Z][A-Za-z]*(?:\s*[A-Z][A-Za-z]*)?|Art\.\s*\d+\s*[A-Z]+)/g;
  return [...text.matchAll(pattern)].map(m => m[0].trim());
}

/**
 * Check each extracted reference against retrieval_belege[].
 * Returns refs that appear in text but NOT in any retrieval source.
 */
export function findHallucinations(
  draftText: string,
  belege: RetrievalBeleg[],
): string[] {
  const refs = extractParagraphRefs(draftText);
  const sourceTexts = belege.map(b => b.referenz + " " + b.auszug).join(" ");
  return refs.filter(ref => {
    // Normalize and check if the reference appears in any source
    const normalized = ref.replace(/\s+/g, " ");
    return !sourceTexts.includes(normalized) && !sourceTexts.includes(ref);
  });
}
```

### Anti-Patterns to Avoid
- **Do NOT create separate API endpoints per feed entry type:** Use a single `/api/akten/[id]/feed` endpoint that queries AktenActivity (already unified). The model already covers all 8 event types.
- **Do NOT refetch full page on feed update:** Use Socket.IO events to prepend new entries to the local state (like the banner pattern in draft-pinned-section.tsx).
- **Do NOT store PII in retrieval logs:** Always hash queries with SHA-256 before storing in SchriftsatzRetrievalLog. Normal app logs ([HELENA] tags) keep full context separately.
- **Do NOT auto-insert feed entries from Socket.IO:** Follow the existing banner refetch pattern (Socket.IO shows "new entries available" banner, user clicks to reload) to avoid race conditions with server ordering.
- **Do NOT put goldset data in the database:** Goldset fixtures are static test data in code (TypeScript arrays), not DB records. They define expected retrieval results for known queries.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cursor pagination | Custom offset/limit with skip | Prisma cursor pagination on createdAt+id | Already proven in AkteHistorie, handles concurrent inserts correctly |
| @Helena mention parsing | New regex | Existing `at-mention-parser.ts` | Already handles HTML stripping, case-insensitive, tested |
| Toast notifications | Custom notification system | `sonner` (already installed) | Project-wide pattern, consistent UX |
| Socket.IO room management | Custom subscription logic | Existing `akte-socket-bridge.tsx` pattern | Join/leave akte room on mount/unmount |
| Query hashing for PII | External hashing library | Node.js `crypto.createHash('sha256')` | Built-in, no dependency, deterministic |
| Date formatting | Custom formatter | Existing `relativeTime()` functions in alert-center.tsx and draft-card.tsx | Already German-localized, consistent across components |
| Severity colors | New color scheme | Existing `severityBadgeClass()` from akte-alerts-section.tsx | Already defined: rose/amber/emerald for high/medium/low |

**Key insight:** The Activity Feed is fundamentally a restructuring of existing patterns, not a greenfield build. The AkteHistorie timeline, DraftCard actions, AlertSection styling, and Socket.IO event infrastructure are all proven and should be reused directly.

## Common Pitfalls

### Pitfall 1: Feed Entry Ordering with Real-Time Inserts
**What goes wrong:** New feed entries from Socket.IO arrive out of order or duplicate with cursor-paginated data
**Why it happens:** Socket.IO events arrive before the next cursor fetch includes them, or concurrent writes create ordering ambiguity
**How to avoid:** Use the existing banner refetch pattern (from draft-pinned-section.tsx): Socket.IO events show a "Neue Eintraege verfuegbar" banner, user clicks to reload. Never auto-insert entries into the sorted list.
**Warning signs:** Duplicate entries in the feed, entries appearing in wrong chronological position

### Pitfall 2: Composer Creates Both Note AND Helena Task
**What goes wrong:** @Helena mention creates a note in the feed but also needs to trigger a HelenaTask -- if done sequentially, the user sees the note but the task might fail silently
**Why it happens:** Two separate operations (AktenActivity create + HelenaTask enqueue) are not atomic
**How to avoid:** Create both in a single API call. The endpoint creates AktenActivity (NOTIZ type) immediately, then calls `createHelenaTask()`. If task creation fails, the note still exists (fail-open). Show error toast only if task enqueue fails.
**Warning signs:** Notes appear without Helena response, @Helena mentions silently ignored

### Pitfall 3: Goldset Tests Require Live RAG Infrastructure
**What goes wrong:** QA goldset tests fail because they need pgvector chunks, embeddings, and model access
**Why it happens:** Goldset tests that exercise the full RAG pipeline require seeded test data in the database
**How to avoid:** Design goldset tests at two levels: (1) Unit tests with mocked retrieval (test metric computation logic), (2) Integration tests that require a running database with seeded legal chunks. The release gate endpoint uses level 2, running against real data.
**Warning signs:** All goldset tests pass in CI but fail locally (or vice versa) due to missing seeded data

### Pitfall 4: Inline Draft Editor State Management
**What goes wrong:** User edits a draft inline, navigates away, comes back -- edit state is lost or conflicts with server state
**Why it happens:** Local component state for inline editing is ephemeral
**How to avoid:** Keep inline editing simple: just a textarea that replaces the draft content display. On save, PATCH the draft via API. On cancel, revert to original content. No complex state management needed. The draft lock mechanism already exists (DraftLockIndicator).
**Warning signs:** Edit conflicts, lost changes, stale draft content displayed

### Pitfall 5: Finanzen Tab Combining Three Existing Tabs
**What goes wrong:** Combining Aktenkonto + Rechnungen + Zeiterfassung into one "Finanzen" tab loses the clear separation users expect
**Why it happens:** Three independent components need a sub-navigation within the tab
**How to avoid:** Use a simple sub-tab or accordion pattern within the Finanzen tab. Three sections: Aktenkonto (AktenkontoLedger), Rechnungen (InvoiceList), Zeiterfassung (AkteZeiterfassungTab). Each already works standalone.
**Warning signs:** Users can't find financial features, UI feels cluttered

### Pitfall 6: § Reference Extraction False Positives
**What goes wrong:** Hallucination check flags valid references that use slightly different formatting
**Why it happens:** "§ 622 Abs. 1 BGB" in draft text might not exactly match "BGB § 622" in retrieval source
**How to avoid:** Normalize references before comparison: extract the core number + law abbreviation, ignore ordering differences. Use fuzzy matching (contains check on normalized form). Accept LOW hallucination rate threshold (0.05 = 5%) to account for edge cases.
**Warning signs:** High false positive rate in hallucination detection, valid drafts flagged

## Code Examples

### Feed API Endpoint (Cursor Pagination)
```typescript
// Source: Follows existing /api/akten/[id]/historie/route.ts pattern
// GET /api/akten/[id]/feed?cursor=xxx&take=20&typ=HELENA_DRAFT,HELENA_ALERT
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: akteId } = await params;
  const access = await requireAkteAccess(akteId);
  if (access.error) return access.error;

  const { searchParams } = new URL(request.url);
  const take = Math.min(parseInt(searchParams.get("take") ?? "20"), 100);
  const cursor = searchParams.get("cursor");
  const typ = searchParams.get("typ"); // Comma-separated AktenActivityTyp values

  const where: Prisma.AktenActivityWhereInput = { akteId };
  if (typ) {
    const types = typ.split(",").map(s => s.trim()).filter(Boolean);
    where.typ = types.length === 1 ? types[0] as AktenActivityTyp : { in: types as AktenActivityTyp[] };
  }

  const entries = await prisma.aktenActivity.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { user: { select: { id: true, name: true } } },
  });

  const hasMore = entries.length > take;
  const items = hasMore ? entries.slice(0, take) : entries;

  return NextResponse.json({
    items,
    nextCursor: hasMore ? items[items.length - 1]?.id : null,
    hasMore,
  });
}
```

### Composer Note + @Helena Submission
```typescript
// POST /api/akten/[id]/feed -- create note, optionally trigger Helena task
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: akteId } = await params;
  const session = await requireAuth();
  const { text } = await request.json();

  // 1. Always create a NOTIZ activity entry
  const activity = await prisma.aktenActivity.create({
    data: {
      akteId,
      userId: session.user.id,
      typ: "NOTIZ",
      titel: text.slice(0, 100),
      inhalt: text,
    },
  });

  // 2. Check for @Helena mention
  const helenaInstruction = parseHelenaMention(text);
  let taskId: string | null = null;

  if (helenaInstruction) {
    try {
      const task = await createHelenaTask({
        userId: session.user.id,
        userRole: session.user.role,
        userName: session.user.name ?? "Benutzer",
        akteId,
        auftrag: helenaInstruction,
        prioritaet: 8, // Manual @-tag priority
        quelle: "at-mention",
      });
      taskId = task.id;
    } catch (error) {
      // Fail-open: note was created, just Helena task failed
      log.error("Failed to create Helena task", { error });
    }
  }

  return NextResponse.json({ activity, taskId });
}
```

### SchriftsatzRetrievalLog Prisma Schema Addition
```prisma
// New model for QA-04: Retrieval log per Schriftsatz draft
model SchriftsatzRetrievalLog {
  id              String   @id @default(cuid())
  schriftsatzId   String   // HelenaDraft ID (the Schriftsatz draft)
  draft           HelenaDraft @relation(fields: [schriftsatzId], references: [id], onDelete: Cascade)

  queryHash       String   // SHA-256 hash of the query text (PII-safe)
  retrievalBelege Json     // Full RetrievalBeleg[] array
  promptVersion   String   // Prompt template version identifier
  modell          String   // Model name used for generation
  recallAt5       Float?   // Pre-computed Recall@5 if goldset query

  createdAt       DateTime @default(now())

  @@index([schriftsatzId])
  @@index([createdAt])
  @@map("schriftsatz_retrieval_logs")
}
```

### Release Gate API Response Format
```typescript
// GET /api/admin/qa/release-gate
interface ReleaseGateResult {
  passed: boolean;
  timestamp: string;
  metrics: {
    recallAt5Normen: { value: number; threshold: number; passed: boolean };
    halluzinationsrate: { value: number; threshold: number; passed: boolean };
    formaleVollstaendigkeit: { value: number; threshold: number; passed: boolean };
    mrr: { value: number; threshold: null; passed: true }; // Informational, no threshold
    noResultRate: { value: number; threshold: null; passed: true };
  };
  goldsetSize: number;
  failedQueries: Array<{
    queryId: string;
    description: string;
    failedMetrics: string[];
  }>;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 12-tab Akte detail | 4-tab with unified Activity Feed | Phase 26 | Simpler navigation, chronological context |
| Separate Pruefprotokoll/Warnungen tabs | Absorbed into feed entries | Phase 26 | Unified timeline view |
| No QA metrics for Helena | Goldset + Recall@k + MRR + hallucination check | Phase 26 | Measurable quality gates |
| Manual quality spot-checking | Automated release gates in CI | Phase 26 | Reproducible quality assurance |

**Deprecated/outdated:**
- Tab-based navigation for Uebersicht, Beteiligte, Historie, Warnungen, Pruefprotokoll, E-Mails -- all absorbed into feed
- DraftDetailModal for inline review -- replaced by inline expand/edit within feed entries
- Separate AkteHistorie component -- superseded by Activity Feed (but AkteHistorie's timeline pattern is the foundation)

## Open Questions

1. **Feed Entry Hydration for Absorbed Tabs**
   - What we know: Feed entries come from AktenActivity model (8 types). Some types (DOKUMENT, FRIST) need extra data from related models (Dokument details, KalenderEintrag details) for the expanded view.
   - What's unclear: Should the feed endpoint eagerly join related data, or should expansion trigger a separate fetch?
   - Recommendation: Use meta JSON field on AktenActivity (already exists) to store key display data at creation time. For full details (like document preview), lazy-fetch on expand. This keeps the feed endpoint fast for the common case.

2. **Goldset Data Seeding for Integration Tests**
   - What we know: QA goldset tests need real RAG chunks in pgvector to exercise the full retrieval pipeline.
   - What's unclear: How to reliably seed test legal data (Gesetze, Urteile, Muster chunks) for CI environments.
   - Recommendation: Create a seed script (`prisma/seed-qa.ts`) that inserts a minimal set of Arbeitsrecht chunks with known embeddings. Run before goldset integration tests. For unit tests, mock the search functions.

3. **Feed Performance with High Activity Akten**
   - What we know: Some Akten may accumulate hundreds or thousands of activity entries over time.
   - What's unclear: At what volume does cursor pagination become slow? AktenActivity has `@@index([akteId, createdAt])` which should handle it.
   - Recommendation: Start with cursor pagination (take=20 per page, load-more button). The existing index covers the query pattern. Monitor query times. If needed later, add a materialized view or archival strategy.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/components/akten/akte-detail-tabs.tsx` -- 899-line file showing current 12-tab structure, AkteHistorie timeline pattern, filter chips
- Existing codebase: `src/components/helena/draft-card.tsx` -- DraftCard with Accept/Edit/Reject actions, type icons, status badges
- Existing codebase: `src/components/helena/alert-center.tsx` -- Alert list with Socket.IO live updates, severity styling, pagination
- Existing codebase: `src/components/helena/draft-pinned-section.tsx` -- Socket.IO banner refetch pattern for new drafts
- Existing codebase: `src/lib/helena/at-mention-parser.ts` -- @Helena mention detection (parseHelenaMention, hasHelenaMention)
- Existing codebase: `src/lib/helena/task-service.ts` -- HelenaTask creation and BullMQ enqueue
- Existing codebase: `src/lib/queue/processors/helena-task.processor.ts` -- Socket.IO events: task-started/progress/completed/failed
- Existing codebase: `src/lib/helena/schriftsatz/schemas.ts` -- RetrievalBeleg type definition
- Existing codebase: `src/lib/helena/schriftsatz/rag-assembler.ts` -- RAG pipeline with retrieval_belege[] collection
- Existing codebase: `src/lib/helena/draft-service.ts` -- AktenActivity creation on draft accept
- Existing codebase: `src/lib/scanner/service.ts` -- AktenActivity creation for scanner alerts
- Existing codebase: `src/components/layout/sidebar.tsx` -- badgeKey pattern, alert badge Socket.IO wiring
- Existing codebase: `prisma/schema.prisma` -- AktenActivity model, AktenActivityTyp enum (8 types), HelenaDraft, HelenaAlert, HelenaTask models
- Existing codebase: `src/components/socket-provider.tsx` -- useSocket() hook, connection lifecycle
- Existing codebase: `src/components/akten/akte-socket-bridge.tsx` -- Akte room join/leave pattern

### Secondary (MEDIUM confidence)
- Information Retrieval metrics (Recall@k, MRR) are standard IR evaluation metrics well-documented in academic literature
- SHA-256 hashing via Node.js `crypto` module is the standard approach for deterministic anonymization

### Tertiary (LOW confidence)
- Goldset query selection for Arbeitsrecht (which specific 20+ scenarios to include) -- needs domain expert validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, no new dependencies
- Architecture: HIGH - All patterns derived directly from existing codebase components
- Pitfalls: HIGH - Based on direct analysis of existing Socket.IO event handling and Prisma query patterns
- QA metrics: MEDIUM - Recall@k and MRR computation is straightforward, but goldset query selection requires domain knowledge
- Hallucination check: MEDIUM - Regex-based § extraction works for common patterns but may miss edge cases

**Research date:** 2026-02-28
**Valid until:** 2026-03-28 (stable -- all based on existing project infrastructure)
