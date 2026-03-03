# Phase 36: Quick Wins - Research

**Researched:** 2026-03-02
**Domain:** Akte detail view UX polish, OCR recovery, empty states, inline editing
**Confidence:** HIGH

## Summary

Phase 36 addresses five requirements that eliminate dead-end states in the Akte detail view and document management. The work is purely UI/UX polish with two new API endpoints (vision-analyse, manual text save) and minor modifications to existing components. All building blocks exist in the codebase: the tab system supports programmatic switching via `setActiveTab`, the OCR pipeline has retry infrastructure, the Zeiterfassung API already accepts PATCH with `kategorie` and `beschreibung` fields, and the EmailEmptyState component provides the exact pattern for empty states.

The primary technical risk is the Vision-Analyse feature, which requires sending a document image to the AI provider (Ollama/OpenAI/Anthropic) for text extraction. The AI SDK v4 supports image attachments via `generateText` with file content, but this has not been tested in the project with MinIO presigned URLs. The manual text entry path is straightforward -- save text, chunk it, and pipe through the existing embedding queue.

**Primary recommendation:** Build a reusable `EmptyState` component and `OcrRecoveryBanner` component. Use the existing `handleTabChange` mechanism for KPI click-to-tab navigation. Vision-Analyse should use `generateText` with the document's presigned URL as an image attachment.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- KPI card click switches to corresponding tab within the same page (not navigation)
- Tab mapping: Dokumente -> dokumente, Termine/Fristen -> kalender, E-Mails -> email (if tab exists), Zeiterfassung -> finanzen tab + auto-scroll to Zeiterfassung section, Chat -> nachrichten, Beteiligte -> feed (Aktivitaeten)
- StatMini component needs onClick prop and hover styles added
- OCR recovery banner shown in document detail view only (right panel, top of metadata area)
- All 3 recovery options shown as buttons simultaneously: Retry OCR, Vision-Analyse, Manuelle Texteingabe
- Vision-Analyse uses existing AI SDK with vision capability
- Manual text entry: inline expanding textarea below banner (not modal)
- Banner replaces/extends OcrStatusBadge for FEHLGESCHLAGEN in document detail
- Document list continues showing OcrStatusBadge with existing retry behavior
- Shared reusable EmptyState component (icon, title, description, optional CTA slots)
- Follow EmailEmptyState pattern: centered container, rounded icon circle, title, description, optional button
- Role-based CTAs matching what each role can actually do
- Tabs needing empty states: Dokumente, Termine & Fristen, Nachrichten/Chat, Zeiterfassung (in Finanzen tab)
- Rename "Nachrichten" to "Chat" in KPI card label AND tab trigger
- Zeiterfassung: null kategorie -> "Keine Kategorie" in muted gray, clickable to open inline category dropdown
- Zeiterfassung: empty beschreibung -> "Beschreibung hinzufuegen" as clickable inline edit

### Claude's Discretion
- Exact empty state icons per tab (appropriate Lucide icon selection)
- Loading skeleton design for recovery operations
- Exact spacing and typography within the recovery banner
- Error handling when Vision-Analyse fails
- Zeiterfassung category dropdown implementation details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| QW-01 | KPI-Cards in Akte-Detail anklickbar -> navigiert zum jeweiligen Tab | StatMini component at line 142-162 of page.tsx needs onClick + hover. AkteDetailTabs exposes `handleTabChange` and `activeTab` state. Requires lifting setActiveTab or passing callback. |
| QW-02 | OCR-Recovery-Flow mit Banner (Retry OCR + Vision-Analyse Fallback + Manuelle Texteingabe) | OcrStatusBadge handles retry. DocumentDetail shows OCR status in right panel. New banner replaces badge for FEHLGESCHLAGEN. Vision needs new API endpoint using AI SDK generateText with image. Manual text needs endpoint to save text + trigger embedding queue. |
| QW-03 | Empty States mit Icon, Erklaetext und max. 2 CTAs (beA, E-Mail, Zeiterfassung etc.) | EmailEmptyState provides exact pattern. Each tab's content component has conditional rendering for empty arrays. Role info from useSession. |
| QW-04 | "Nachrichten" KPI-Card umbenennen zu "Chat" und auf Channel-Messages verlinken | StatMini label prop change in page.tsx. TabsTrigger text change in akte-detail-tabs.tsx. |
| QW-05 | Zeiterfassung: "---" -> "Keine Kategorie" (grau), leere Beschreibung -> "Beschreibung hinzufuegen" Link | AkteZeiterfassungTab line 298 shows `e.kategorie ?? "---"`. PATCH /api/finanzen/zeiterfassung accepts kategorie (nullable) and beschreibung. Taetigkeitskategorien API exists at /api/finanzen/taetigkeitskategorien. |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js 14 | App Router | Page routing, server components | Project foundation |
| React 18 | - | UI components | Project foundation |
| Tailwind CSS | 3.x | Styling | Project foundation |
| shadcn/ui Tabs | - | Tab system in AkteDetailTabs | Already used for tab management |
| Lucide React | - | Icons | Project icon library |
| Sonner | - | Toast notifications | Used for async operation feedback |
| Vercel AI SDK v4 | - | Vision text extraction | Already configured with multi-provider support |
| BullMQ | - | Job queue for embedding | Existing embedding pipeline |

### No New Dependencies

This phase requires zero new npm packages. All features are built with existing stack.

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/
    ui/
      empty-state.tsx           # NEW: Reusable EmptyState component
    dokumente/
      ocr-recovery-banner.tsx   # NEW: Recovery banner for FEHLGESCHLAGEN docs
      ocr-status-badge.tsx      # UNCHANGED: List view continues using this
      document-detail.tsx       # MODIFIED: Integrates recovery banner
    finanzen/
      akte-zeiterfassung-tab.tsx # MODIFIED: Inline edit for kategorie/beschreibung
    akten/
      akte-detail-tabs.tsx      # MODIFIED: Rename Nachrichten->Chat, accept onTabChange
  app/
    (dashboard)/akten/[id]/
      page.tsx                  # MODIFIED: KPI onClick, pass setActiveTab
    api/dokumente/[id]/
      vision/route.ts           # NEW: Vision-based text extraction endpoint
      manual-text/route.ts      # NEW: Manual text save endpoint
```

### Pattern 1: KPI Click-to-Tab Navigation

**What:** StatMini cards become clickable, triggering tab switches in AkteDetailTabs.
**When to use:** Connecting summary stats to their detail views.

The challenge is that StatMini is a server-rendered inline component in page.tsx, while AkteDetailTabs manages tab state client-side. The solution requires:

1. Extract StatMini to a client component or wrap the stats grid in a client component
2. Pass a callback from AkteDetailTabs (or use a shared ref/context) for tab switching
3. For Zeiterfassung: switch to `finanzen` tab, then scroll to the Zeiterfassung section

**Implementation approach:**
```typescript
// Option A: Lift activeTab state to page level via client wrapper
// page.tsx stays server component, but stats grid + tabs share state

// Client wrapper component:
"use client";

function AkteDetailClient({ akte }: { akte: AkteData }) {
  const [activeTab, setActiveTab] = useState("feed");

  const tabMap: Record<string, string> = {
    "Beteiligte": "feed",
    "Dokumente": "dokumente",
    "Termine/Fristen": "kalender",
    "E-Mails": "email",      // only if tab exists
    "Zeiterfassung": "finanzen",
    "Chat": "nachrichten",
  };

  const handleKpiClick = (label: string) => {
    const tab = tabMap[label];
    if (tab) {
      setActiveTab(tab);
      // For Zeiterfassung, scroll after tab switch
      if (label === "Zeiterfassung") {
        setTimeout(() => {
          document.getElementById("zeiterfassung-section")
            ?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    }
  };

  return (
    <>
      <StatsGrid akte={akte} onKpiClick={handleKpiClick} />
      <AkteDetailTabs akte={akte} activeTab={activeTab} onTabChange={setActiveTab} />
    </>
  );
}
```

**Key consideration:** AkteDetailTabs currently manages its own `activeTab` state internally. To support external tab switching from KPI cards, the tab state needs to be either:
- Lifted to a shared parent (recommended -- simpler, less coupling)
- Controlled via a ref callback

The cleanest approach: make AkteDetailTabs accept `externalTab` and `onTabChange` props, using controlled Tabs component pattern that shadcn/ui already supports via `value` + `onValueChange`.

### Pattern 2: OCR Recovery Banner (State Machine)

**What:** A banner component that manages recovery flow states for failed OCR documents.
**When to use:** In DocumentDetail right panel when ocrStatus === "FEHLGESCHLAGEN".

```typescript
type RecoveryState =
  | "idle"           // Show 3 recovery buttons
  | "retrying"       // OCR retry in progress
  | "vision"         // Vision analysis in progress
  | "manual"         // Manual text entry textarea expanded
  | "saving"         // Saving manual text
  | "success"        // Recovery succeeded (flash green, then hide)
  | "error";         // Recovery failed (show error + retry options)

interface OcrRecoveryBannerProps {
  dokumentId: string;
  akteId: string;
  ocrFehler: string | null;
  onRecoveryComplete: () => void; // Triggers refetch of document
}
```

The banner replaces OcrStatusBadge in DocumentDetail for FEHLGESCHLAGEN status only. The document list (DokumenteTab) continues using OcrStatusBadge with its existing retry button.

### Pattern 3: Reusable EmptyState Component

**What:** Shared component for all empty tab states.
**When to use:** When a tab's data array is empty.

```typescript
interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  actions?: Array<{
    label: string;
    icon?: React.ElementType;
    onClick?: () => void;
    href?: string;
    roles?: string[];  // Only show for these roles
  }>;
}
```

Pattern follows EmailEmptyState exactly:
- Centered flex container
- w-16 h-16 rounded-full icon circle (bg-slate-100 dark:bg-slate-800)
- Icon in muted-foreground/50
- Title: text-base font-medium
- Description: text-sm text-muted-foreground max-w-xs
- Buttons: max 2, using Button component

### Pattern 4: Inline Editing for Zeiterfassung

**What:** Click-to-edit pattern for kategorie and beschreibung fields in the time entry table.
**When to use:** For null/empty fields that need user input.

```typescript
// Inline edit cell component
function InlineEditCell({
  value,
  placeholder,
  onSave,
  type = "text",
}: {
  value: string | null;
  placeholder: string;
  onSave: (newValue: string) => Promise<void>;
  type?: "text" | "select";
}) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value ?? "");

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-muted-foreground/60 hover:text-foreground cursor-pointer transition-colors"
      >
        {value || placeholder}
      </button>
    );
  }

  // For text: input with save-on-blur/enter
  // For select: dropdown with category options from API
}
```

The PATCH `/api/finanzen/zeiterfassung` endpoint already accepts `{ id, beschreibung?, kategorie? }` -- no backend changes needed. The `GET /api/finanzen/taetigkeitskategorien` endpoint returns the list of categories for the dropdown.

### Anti-Patterns to Avoid
- **Creating email tab when no email konto exists:** The email KPI card click should be a no-op or show a toast if no email tab exists. Do not create a phantom tab.
- **Modal for manual text entry:** CONTEXT.md explicitly says inline textarea, not modal. Expanding textarea below the banner keeps context.
- **Global state for tab switching:** Do not use Zustand/context for something as localized as tab state. Lift state to nearest common parent.
- **Refetching entire Akte after recovery:** Only refetch the document detail (fetchDocument), not the entire page.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text chunking + embedding | Custom chunker | `chunkDocumentParentChild` + `embeddingQueue.add()` | Existing pipeline handles parent-child chunks, pgvector storage, Meilisearch indexing |
| OCR retry | Custom retry logic | `POST /api/dokumente/[id]/ocr` | Existing endpoint resets status and enqueues BullMQ job |
| Role-based visibility | Custom role checking | `useSession` + `(session?.user as any)?.role` | Project pattern, already used in 5+ components |
| Category list | Hardcoded categories | `GET /api/finanzen/taetigkeitskategorien` | API exists, returns active categories with defaults |
| Tab component | Custom tabs | shadcn/ui `Tabs` with `value`/`onValueChange` | Already the pattern used in AkteDetailTabs |

**Key insight:** The OCR pipeline (OCR -> text extraction -> Meilisearch indexing -> embedding queue -> AI scan) must be replicated for both Vision-Analyse and Manual Text paths. The simplest approach: both new endpoints save ocrText to the Dokument row, then enqueue an embedding job (same as the OCR processor does in lines 232-238 of ocr.processor.ts).

## Common Pitfalls

### Pitfall 1: Server Component Cannot Have onClick
**What goes wrong:** StatMini is defined inline in page.tsx (a server component). Adding onClick will fail at build time.
**Why it happens:** Server components cannot have event handlers.
**How to avoid:** Either extract the stats grid into a client component, or create a client wrapper that imports StatMini and adds interactivity. The page.tsx can remain a server component for the data fetch.
**Warning signs:** Build error "Event handlers cannot be passed to client component props."

### Pitfall 2: AkteDetailTabs Internal State Not Externally Controllable
**What goes wrong:** AkteDetailTabs currently uses `useState("feed")` internally. Passing an external tab value without refactoring will cause the component to ignore it.
**Why it happens:** The Tabs component is controlled by the internal `activeTab` state.
**How to avoid:** Refactor AkteDetailTabs to accept optional `externalTab` prop. When present, use it as the `value` for the Tabs component. The `handleTabChange` callback should call both internal setState and an optional `onTabChange` prop. OR: lift state entirely to parent.
**Warning signs:** KPI clicks do nothing visible.

### Pitfall 3: Vision-Analyse with Ollama May Not Support Images
**What goes wrong:** Ollama with qwen3.5:35b may not support vision/image inputs. Only specific models (e.g., llava, bakllava) support vision.
**Why it happens:** The project default model is qwen3.5:35b which is a text-only model.
**How to avoid:** The Vision-Analyse API endpoint should check the provider: if OpenAI (gpt-4o) or Anthropic (claude-sonnet-4), use them directly with image attachment. If Ollama, either use a vision-capable model (llava) or fall back gracefully with an error message. The endpoint should handle this gracefully.
**Warning signs:** "Model does not support image inputs" error.

### Pitfall 4: Presigned URL Expiry for Vision Analysis
**What goes wrong:** MinIO presigned URLs have a default expiry (7 days in this project). But the vision API call is synchronous -- this is not actually a problem. The real issue: the AI SDK needs the image as a Buffer or URL, not a presigned URL to MinIO (which may not be reachable from Ollama's network).
**Why it happens:** Ollama runs in Docker, MinIO presigned URLs use the public endpoint which may not resolve inside Docker network.
**How to avoid:** Fetch the document from MinIO server-side (using `getFileStream`), convert to base64, and pass as inline image data to the AI SDK's `generateText`. Do NOT pass the presigned URL.
**Warning signs:** Network timeout or 404 from within Ollama container.

### Pitfall 5: Empty State Renders When Data is Loading
**What goes wrong:** Empty state flashes briefly before data loads, creating visual flicker.
**Why it happens:** Initial state is empty array, loading state not checked.
**How to avoid:** Always check `loading` state before showing empty state. Pattern: `if (loading) return <Skeleton />; if (data.length === 0) return <EmptyState />;`
**Warning signs:** Flash of empty state on every tab switch.

### Pitfall 6: Zeiterfassung Scroll After Tab Switch
**What goes wrong:** scrollIntoView fires before the Finanzen tab content is rendered, finding no element.
**Why it happens:** Tab content is lazy-rendered; DOM element doesn't exist until tab is active and React renders.
**How to avoid:** Use a small setTimeout (100ms) or requestAnimationFrame after setActiveTab to allow React to render the tab content before scrolling. Or use a useEffect that watches for activeTab === "finanzen" and scrolls when the target element appears.
**Warning signs:** Zeiterfassung KPI card switches to Finanzen tab but doesn't scroll.

## Code Examples

### Existing: StatMini Component (needs modification)
```typescript
// Source: src/app/(dashboard)/akten/[id]/page.tsx lines 142-162
// Current: no onClick, no hover
function StatMini({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="glass-card rounded-xl px-4 py-3 flex items-center gap-3">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <div>
        <p className="text-lg font-semibold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
```

### Existing: EmailEmptyState Pattern (to replicate)
```typescript
// Source: src/components/email/email-empty-state.tsx
// Key structure: centered flex, icon circle, title, desc, optional button
<div className="flex flex-col items-center justify-center h-full p-8 text-center">
  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
    <Mail className="w-8 h-8 text-muted-foreground/50" />
  </div>
  <h3 className="text-base font-medium text-foreground mb-1">Title</h3>
  <p className="text-sm text-muted-foreground mb-4 max-w-xs">Description</p>
  <Button variant="outline" size="sm">CTA</Button>
</div>
```

### Existing: OCR Retry Endpoint
```typescript
// Source: src/app/api/dokumente/[id]/ocr/route.ts
// Resets ocrStatus to AUSSTEHEND, clears error, enqueues BullMQ job
// The recovery banner's "Retry OCR" button calls this same endpoint
```

### Existing: Embedding Pipeline Entry Point
```typescript
// Source: src/lib/queue/processors/ocr.processor.ts lines 232-238
// After saving ocrText, enqueue embedding job:
if (extractedText && extractedText.length > 0) {
  await embeddingQueue.add("embed-document", {
    dokumentId,
    akteId,
    ocrText: extractedText,
  });
}
// Vision-Analyse and Manual Text endpoints must replicate this pattern
```

### Existing: Zeiterfassung PATCH Schema
```typescript
// Source: src/app/api/finanzen/zeiterfassung/route.ts lines 33-39
const updateSchema = z.object({
  id: z.string().min(1),
  beschreibung: z.string().optional(),
  kategorie: z.string().nullable().optional(),
  abrechenbar: z.boolean().optional(),
  dauer: z.number().int().min(1).optional(),
});
// Already supports kategorie (nullable) and beschreibung -- no backend changes needed
```

### Existing: Tab System (Controlled)
```typescript
// Source: src/components/akten/akte-detail-tabs.tsx line 147
<Tabs defaultValue="feed" value={activeTab} onValueChange={handleTabChange}>
// Already uses controlled pattern with value + onValueChange
// Just need to expose setActiveTab or accept external control
```

### New: Vision-Analyse API Endpoint Pattern
```typescript
// POST /api/dokumente/[id]/vision
// 1. Fetch document from MinIO
// 2. Convert to base64 image
// 3. Call AI SDK generateText with image attachment
// 4. Save extracted text as ocrText
// 5. Enqueue embedding job
// 6. Update ocrStatus to ABGESCHLOSSEN

import { getModel } from "@/lib/ai/provider";
import { generateText } from "ai";
import { getFileStream } from "@/lib/storage";
import { embeddingQueue } from "@/lib/queue/queues";

// For image documents: read buffer, base64 encode, pass to generateText
const buffer = await streamToBuffer(await getFileStream(dokument.dateipfad));
const base64 = buffer.toString("base64");
const mimeType = dokument.mimeType; // e.g., "image/jpeg"

const model = await getModel();
const { text } = await generateText({
  model,
  messages: [{
    role: "user",
    content: [
      {
        type: "image",
        image: buffer, // AI SDK v4 accepts Buffer directly
        mimeType: dokument.mimeType,
      },
      {
        type: "text",
        text: "Extrahiere den gesamten Text aus diesem Dokument. Gib nur den extrahierten Text zurueck, keine Kommentare.",
      },
    ],
  }],
  maxTokens: 4096,
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static KPI cards | Clickable KPI cards with tab navigation | This phase | UX: no more dead-end stats |
| OCR failure = dead end | Recovery banner with 3 options | This phase | Documents always recoverable |
| Blank tabs when empty | Contextual empty states with CTAs | This phase | Users always know what to do |
| "---" for null values | Clickable inline placeholders | This phase | Inline editing reduces friction |

## Open Questions

1. **Vision model availability with Ollama**
   - What we know: qwen3.5:35b is text-only. OpenAI gpt-4o and Anthropic claude-sonnet-4 support vision.
   - What's unclear: Whether Ollama users have a vision model pulled (llava, bakllava, etc.)
   - Recommendation: Try configured model first. If it fails with a vision error, return a user-friendly error suggesting they switch to OpenAI/Anthropic or pull a vision model. Do not hard-fail.

2. **PDF documents with Vision-Analyse**
   - What we know: AI SDK image attachment works with image MIME types (jpeg, png, etc.)
   - What's unclear: How to handle PDF documents for vision -- PDFs are not images
   - Recommendation: For PDFs, convert first page to image using the existing preview infrastructure (Stirling-PDF), then pass that image. Or: only enable Vision-Analyse for image MIME types, since PDFs already go through the Stirling OCR path. The banner can conditionally show/hide Vision-Analyse based on MIME type.

3. **E-Mail tab existence**
   - What we know: There is no dedicated email tab in AkteDetailTabs currently. Emails are separate at /email.
   - What's unclear: Whether E-Mail KPI click should navigate to /email page or be a no-op
   - Recommendation: E-Mail KPI click should either navigate to `/email?akteId=${akteId}` (if such filtering exists) or show a toast "E-Mail-Ansicht oeffnen" as a soft link. Since there's no email tab in AkteDetailTabs, this cannot be a tab switch.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** - All component files read and analyzed directly
  - `src/app/(dashboard)/akten/[id]/page.tsx` - StatMini, page structure
  - `src/components/akten/akte-detail-tabs.tsx` - Tab system, controlled state
  - `src/components/dokumente/document-detail.tsx` - Document detail layout, OCR status display
  - `src/components/dokumente/ocr-status-badge.tsx` - Existing OCR retry behavior
  - `src/components/email/email-empty-state.tsx` - Empty state pattern
  - `src/components/finanzen/akte-zeiterfassung-tab.tsx` - Zeiterfassung table, null rendering
  - `src/app/api/dokumente/[id]/ocr/route.ts` - OCR retry endpoint
  - `src/app/api/finanzen/zeiterfassung/route.ts` - PATCH schema (kategorie, beschreibung)
  - `src/app/api/finanzen/taetigkeitskategorien/route.ts` - Category list endpoint
  - `src/lib/queue/processors/ocr.processor.ts` - Full OCR pipeline
  - `src/lib/queue/processors/embedding.processor.ts` - Embedding pipeline
  - `src/lib/ai/provider.ts` - Multi-provider AI factory

### Secondary (MEDIUM confidence)
- **Vercel AI SDK v4 documentation** - Image attachment support in generateText (known from training data, used in project patterns)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All components examined, zero new dependencies
- Architecture: HIGH - All integration points verified in code, patterns well-established
- Pitfalls: HIGH - Based on direct code analysis (server component constraints, controlled state, Docker networking)
- Vision-Analyse: MEDIUM - AI SDK image support verified in code patterns, but Ollama vision model availability is project-specific

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (30 days -- stable domain, no fast-moving dependencies)
