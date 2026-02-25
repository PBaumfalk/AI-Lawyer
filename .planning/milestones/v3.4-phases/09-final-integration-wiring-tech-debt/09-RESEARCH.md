# Phase 9: Final Integration Wiring + Tech Debt - Research

**Researched:** 2026-02-25
**Domain:** Integration wiring, dead code removal, TypeScript fixes, UI completion
**Confidence:** HIGH

## Summary

Phase 9 is a wiring and cleanup phase. All code already exists -- the work is connecting existing pieces that were not wired during their original phases, plus resolving 6 tech debt items identified by the 6th milestone audit. No new libraries, no new architecture.

The two integration gaps (INT-B01 and INT-B02) are straightforward: INT-B01 requires calling the existing `markDokumenteVersendet()` function after successful email/beA sends, and INT-B02 requires emitting a `document:embedding-complete` Socket.IO event from the embedding worker's completion handler (following the exact same pattern as the existing `document:ocr-complete` event). The remaining 5 tech debt items are: dead code removal (`syncNewMessages`), a TypeScript audit note that is no longer an actual error, a stub replacement (chat-input drag-drop), and a missing UI section (document audit history).

**Primary recommendation:** Execute all 7 items in a single plan. Each item is small (5-20 lines changed), they touch different files with no interdependencies, and the total change set is under 200 lines.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-EM-006 | Compose-View with Akte link, DMS attachments, SMTP send via BullMQ | INT-B01 fix: `markDokumenteVersendet()` call in `emailSendProcessor` after successful SMTP send |
| REQ-BA-002 | beA-Postausgang: Nachrichten senden mit Dokumentenanhang | INT-B01 fix: `markDokumenteVersendet()` call in POST `/api/bea/messages` after outgoing message creation |
| REQ-DV-010 | WOPI-Protokoll stabil (Laden/Speichern zuverlaessig) | Indirectly related: VERSENDET status is part of the document lifecycle managed through WOPI |
| REQ-KI-001 | RAG-Pipeline: Embedding-Storage, Chunking, Embedding-Job | INT-B02 fix: Socket.IO event from embedding worker signals browser that document is RAG-searchable |
| REQ-DV-005 | OCR-Status speichern + anzeigen (Badge + manueller Retry) | INT-B02 fix: Embedding completion event is the downstream signal after OCR, completing the pipeline visibility |
</phase_requirements>

## Standard Stack

### Core

No new libraries required. All work uses existing project code.

| Library | Version | Purpose | Already Used |
|---------|---------|---------|--------------|
| @socket.io/redis-emitter | (installed) | Emit events from worker to browser | Yes, in `src/lib/socket/emitter.ts` |
| bullmq | (installed) | Worker job processing with completion events | Yes, in `src/worker.ts` |
| prisma | (installed) | DB updates for document status transition | Yes, throughout |
| pdf-lib | v1.17.1 | ZUGFeRD PDF embedding (e-rechnung.ts) | Yes, in `src/lib/finance/invoice/e-rechnung.ts` |

### Supporting

No supporting libraries needed.

### Alternatives Considered

None -- this phase uses only existing code.

**Installation:**
```bash
# No new packages required
```

## Architecture Patterns

### Recommended Project Structure

No new files or directories. All changes are modifications to existing files:

```
src/
  lib/email/smtp/send-processor.ts   # Add markDokumenteVersendet() call
  app/api/bea/messages/route.ts      # Add markDokumenteVersendet() call
  worker.ts                          # Add embedding completion Socket.IO event
  lib/email/imap/sync.ts             # Remove syncNewMessages() dead code
  lib/finance/invoice/e-rechnung.ts  # Verify/fix PDFRawStream.of TS error
  components/ki/chat-input.tsx        # Replace drag-drop stub with toast
  components/dokumente/document-detail.tsx  # Add audit history section
```

### Pattern 1: markDokumenteVersendet() After Successful Send (INT-B01)

**What:** Call the existing `markDokumenteVersendet()` function after confirmed successful email/beA transmission.

**When to use:** After the SMTP `sendMail()` succeeds (email) or after the beA `BeaNachricht` is created with `status: "GESENDET"` (beA).

**Email send (src/lib/email/smtp/send-processor.ts):**

The email send processor (`emailSendProcessor`) already has the email record loaded with its attachments. After `transporter.sendMail()` succeeds and the status is updated to `GESENDET`, the DMS attachment IDs need to be extracted and passed to `markDokumenteVersendet()`.

CRITICAL: The email send processor does NOT currently have access to the original DMS attachment IDs. The `EmailNachricht` record stores `anhaenge` (EmailAnhang records) but the original `dms-{id}` references are in the request body (stored during queueing). The email job data (`EmailSendJob`) only contains `{ emailNachrichtId, kontoId, userId }`.

Two approaches:
1. **Store DMS doc IDs in job data** -- Extend `EmailSendJob` type to include `dmsDocumentIds: string[]`, pass them when queueing in `POST /api/email-send`.
2. **Store DMS doc IDs on the EmailNachricht record** -- But there is no field for this.

**Recommended:** Option 1. When queueing the email send job in `src/app/api/email-send/route.ts`, pass the extracted `dmsIds` array as part of the job data. The processor then calls `markDokumenteVersendet(job.data.dmsDocumentIds)` after successful send.

```typescript
// In src/app/api/email-send/route.ts, when adding to queue:
const job = await emailSendQueue.add("send-email", {
  emailNachrichtId: email.id,
  kontoId: data.kontoId,
  userId: session.user.id,
  dmsDocumentIds: dmsIds, // NEW: pass through for VERSENDET marking
}, { delay, jobId: `send-${email.id}`, ... });

// In src/lib/email/smtp/send-processor.ts, after successful send:
import { markDokumenteVersendet } from "@/lib/versand-gate";
// After prisma.emailNachricht.update({ sendeStatus: "GESENDET" })
if (job.data.dmsDocumentIds?.length) {
  await markDokumenteVersendet(job.data.dmsDocumentIds);
}
```

**beA send (src/app/api/bea/messages/route.ts):**

For beA, the `dokumentIds` are directly available in the request body. Call `markDokumenteVersendet()` after the BeaNachricht is created with status GESENDET.

```typescript
// In POST /api/bea/messages, after prisma.beaNachricht.create():
if (data.status === "GESENDET" && data.dokumentIds?.length) {
  await markDokumenteVersendet(data.dokumentIds);
}
```

### Pattern 2: Socket.IO Embedding Completion Event (INT-B02)

**What:** Emit a `document:embedding-complete` event from the embedding worker's completion handler, following the exact same pattern used for OCR completion.

**Reference pattern (OCR completion in worker.ts lines 229-257):**
```typescript
ocrWorker.on("completed", (job) => {
  if (!job) return;
  const ocrPayload = {
    dokumentId: job.data.dokumentId,
    akteId: job.data.akteId,
    fileName: job.data.fileName,
    status: "ABGESCHLOSSEN",
  };
  socketEmitter.to(`akte:${job.data.akteId}`).emit("document:ocr-complete", ocrPayload);
  // Also emit to user room for global toast
  prisma.dokument
    .findUnique({ where: { id: job.data.dokumentId }, select: { createdById: true } })
    .then((doc) => {
      if (doc?.createdById) {
        socketEmitter.to(`user:${doc.createdById}`).emit("document:ocr-complete", ocrPayload);
      }
    })
    .catch(() => {});
});
```

**Apply same pattern to embedding worker (worker.ts lines 355-361):**
```typescript
embeddingWorker.on("completed", (job) => {
  if (!job) return;
  log.info({ jobId: job.id, dokumentId: job.data.dokumentId }, "Embedding job completed");

  const embeddingPayload = {
    dokumentId: job.data.dokumentId,
    akteId: job.data.akteId,
    status: "ABGESCHLOSSEN",
  };
  socketEmitter.to(`akte:${job.data.akteId}`).emit("document:embedding-complete", embeddingPayload);
  prisma.dokument
    .findUnique({ where: { id: job.data.dokumentId }, select: { createdById: true } })
    .then((doc) => {
      if (doc?.createdById) {
        socketEmitter.to(`user:${doc.createdById}`).emit("document:embedding-complete", embeddingPayload);
      }
    })
    .catch((err) => {
      log.warn({ err, dokumentId: job.data.dokumentId }, "Failed to look up user for embedding notification");
    });
});
```

### Pattern 3: Dead Code Removal (syncNewMessages)

**What:** Remove the `syncNewMessages()` function from `src/lib/email/imap/sync.ts`.

**Analysis:** The function (lines 279-309) is never imported anywhere. It was intended to be called by the connection manager's IDLE handler, but the connection manager (`connection-manager.ts` line 111) calls `syncMailbox()` directly instead. The function is a stub that returns a placeholder result.

**Action:** Delete lines 276-309 (the doc comment + function). No imports reference it.

### Pattern 4: PDFRawStream.of TypeScript Error

**What:** The 6th audit flagged "Pre-existing PDFStream.of TypeScript error in e-rechnung.ts".

**Investigation result:** This appears to be a false alarm or already resolved. The code at line 520 uses `PDFRawStream.of()`, not `PDFStream.of()`. The pdf-lib type definitions at `node_modules/pdf-lib/ts3.4/cjs/core/objects/PDFRawStream.d.ts` confirm that `PDFRawStream.of` is a valid static method (`static of: (dict: PDFDict, contents: Uint8Array) => PDFRawStream`). Running `npx tsc --noEmit` produces no errors for this file.

**Decision note (from STATE.md [05-04]):** "PDFRawStream.of() for embedded file streams (PDFStream base class has no .of() in pdf-lib v1.17.1)" -- This confirms the decision was already to use `PDFRawStream.of()` which is correct.

**Action:** Verify with `npx tsc --noEmit` during execution. If clean, mark as resolved (no change needed). If there is a runtime error, the fix is ensuring the import is `PDFRawStream` not `PDFStream` (already correct in current code).

### Pattern 5: Chat Input Drag-Drop (Stub Replacement)

**What:** Replace the `alert()` stub in `chat-input.tsx` with a proper toast notification.

**Current code (lines 124-131):**
```typescript
const handleDrop = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  setIsDragOver(false);
  alert("Dokument wird verarbeitet, bitte warten...");
}, []);
```

**Replace with toast:** Import the toast utility and show a non-blocking notification. Since the project does not have a full file upload in chat yet, the toast should indicate the feature is planned.

```typescript
import { toast } from "sonner"; // or project's toast utility

const handleDrop = useCallback((e: React.DragEvent) => {
  e.preventDefault();
  setIsDragOver(false);
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    toast.info("Dokument-Upload in den Chat wird in einer spaeteren Version unterstuetzt.", {
      description: `${files.length} Datei(en) abgelegt`,
    });
  }
}, []);
```

### Pattern 6: Document Detail Audit History Section

**What:** Add an "Historie" section to the document detail page showing audit events for that document.

**Existing infrastructure:**
- `GET /api/akten/[id]/historie` -- Returns audit logs for an Akte (paginated, filterable by aktion)
- `AuditTimeline` component (`src/components/audit/audit-timeline.tsx`) -- Reusable timeline renderer
- `logAuditEvent` logs `DOKUMENT_HOCHGELADEN`, `DOKUMENT_GELOESCHT`, `DOKUMENT_STATUS_GEAENDERT`, `DOKUMENT_ANGESEHEN` events

**Challenge:** The existing historie API filters by `akteId`, not by `dokumentId`. To show document-specific audit history, we need either:
1. Filter audit logs by `akteId` AND filter client-side for entries where `details.dokumentId` matches, OR
2. Add a new query parameter to the existing API route to filter by `details.dokumentId`.

**Recommended:** Option 2 -- Add `dokumentId` query parameter to `GET /api/akten/[id]/historie`, use Prisma JSON filter: `details: { path: ['dokumentId'], equals: dokumentId }`. This is more efficient and avoids over-fetching.

Then in `document-detail.tsx`, add an "Historie" section after the "Versionsverlauf" section that fetches and displays the document's audit trail using the `AuditTimeline` component in compact mode.

### Anti-Patterns to Avoid

- **Calling markDokumenteVersendet() before send confirmation:** Only call AFTER actual transmission succeeds. Never in the pre-send route handler.
- **Emitting Socket.IO events for failed embedding jobs:** Only emit the `embedding-complete` event on success. Failed embedding should not emit a "complete" event (it would confuse the UI).
- **Hard-deleting syncNewMessages:** Do NOT also remove the `syncMailbox` function which IS used. Only remove `syncNewMessages` (lines 276-309).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Socket.IO event emission from worker | Custom WebSocket code | `@socket.io/redis-emitter` (existing `getSocketEmitter()`) | Already set up, tested, handles Redis pub/sub |
| Document status transition | Direct SQL UPDATE | `markDokumenteVersendet()` in `versand-gate.ts` | Existing function with proper WHERE guard (only FREIGEGEBEN -> VERSENDET) |
| Audit timeline UI | New custom component | `AuditTimeline` from `src/components/audit/audit-timeline.tsx` | Fully-featured, reusable, already used in admin audit trail and Akte detail |

**Key insight:** Every piece of code needed already exists. This phase is pure wiring and cleanup.

## Common Pitfalls

### Pitfall 1: Missing DMS Document IDs in Email Send Processor

**What goes wrong:** The email send processor cannot call `markDokumenteVersendet()` because it does not have the original DMS document IDs from the compose form.
**Why it happens:** The `EmailSendJob` type only contains `{ emailNachrichtId, kontoId, userId }` -- the DMS attachment IDs were extracted in the API route but not passed through.
**How to avoid:** Extend `EmailSendJob` type to include `dmsDocumentIds?: string[]` and pass the extracted `dmsIds` array when enqueuing in `POST /api/email-send`.
**Warning signs:** `markDokumenteVersendet()` is called with an empty array.

### Pitfall 2: Double-Marking Documents VERSENDET

**What goes wrong:** A document attached to both an email and a beA message gets marked VERSENDET twice.
**Why it happens:** Both the email processor and beA route call `markDokumenteVersendet()` independently.
**How to avoid:** `markDokumenteVersendet()` already guards against this -- it only updates where `status: "FREIGEGEBEN"`. The second call is a no-op. No additional guard needed.

### Pitfall 3: Embedding Event Emitted Before Chunks Stored

**What goes wrong:** Socket.IO event fires but pgvector INSERT has not committed yet.
**Why it happens:** BullMQ's `completed` event fires AFTER the processor function returns, meaning `insertChunks()` has already completed by the time the event handler runs.
**How to avoid:** This is already safe because the `completed` event only fires after `processEmbeddingJob()` resolves. No race condition.

### Pitfall 4: Removing Wrong Function from sync.ts

**What goes wrong:** Accidentally removing `syncMailbox()` or `initialSync()` which ARE actively used.
**Why it happens:** They are all in the same file.
**How to avoid:** Only remove `syncNewMessages()` (the function starting at line 279). Verify no imports reference it first.

### Pitfall 5: Toast Import in chat-input.tsx

**What goes wrong:** Using `alert()` replacement but importing from wrong toast library.
**Why it happens:** Multiple toast libraries exist in the ecosystem.
**How to avoid:** Check existing toast usage in the project. Look for existing imports of `sonner` or another toast library.

## Code Examples

### Example 1: Email Send Processor with markDokumenteVersendet

```typescript
// src/lib/email/smtp/send-processor.ts
// After line 122 (after prisma.emailNachricht.update GESENDET):
import { markDokumenteVersendet } from "@/lib/versand-gate";

// In the success branch, after updating status to GESENDET:
if (job.data.dmsDocumentIds && job.data.dmsDocumentIds.length > 0) {
  try {
    await markDokumenteVersendet(job.data.dmsDocumentIds);
    log.info(
      { emailNachrichtId, docCount: job.data.dmsDocumentIds.length },
      "Marked DMS documents as VERSENDET"
    );
  } catch (err) {
    // Non-fatal: document status update failure should not fail the email send
    log.warn({ err, emailNachrichtId }, "Failed to mark documents as VERSENDET (non-fatal)");
  }
}
```

### Example 2: beA Route with markDokumenteVersendet

```typescript
// src/app/api/bea/messages/route.ts
// After the BeaNachricht is created and before the response:
import { markDokumenteVersendet } from "@/lib/versand-gate"; // already imported

// After prisma.beaNachricht.create():
if (data.status === "GESENDET" && data.dokumentIds && data.dokumentIds.length > 0) {
  try {
    await markDokumenteVersendet(data.dokumentIds);
  } catch {
    // Non-fatal
  }
}
```

### Example 3: Embedding Completion Socket.IO Event

```typescript
// src/worker.ts -- replace embeddingWorker.on("completed") handler:
embeddingWorker.on("completed", (job) => {
  if (!job) return;
  log.info({ jobId: job.id, dokumentId: job.data.dokumentId }, "Embedding job completed");

  const embeddingPayload = {
    dokumentId: job.data.dokumentId,
    akteId: job.data.akteId,
    status: "ABGESCHLOSSEN",
  };

  socketEmitter.to(`akte:${job.data.akteId}`).emit("document:embedding-complete", embeddingPayload);

  prisma.dokument
    .findUnique({ where: { id: job.data.dokumentId }, select: { createdById: true } })
    .then((doc) => {
      if (doc?.createdById) {
        socketEmitter.to(`user:${doc.createdById}`).emit("document:embedding-complete", embeddingPayload);
      }
    })
    .catch((err) => {
      log.warn({ err, dokumentId: job.data.dokumentId }, "Failed to look up user for embedding notification");
    });
});
```

### Example 4: Document Audit History in Detail Page

```typescript
// In src/components/dokumente/document-detail.tsx, add after version history section:
<section>
  <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
    Historie
  </h3>
  <DocumentHistorie dokumentId={dokument.id} akteId={dokument.akte.id} />
</section>

// New component (inline in same file or separate):
function DocumentHistorie({ dokumentId, akteId }: { dokumentId: string; akteId: string }) {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/akten/${akteId}/historie?aktion=DOKUMENT_HOCHGELADEN,DOKUMENT_GELOESCHT,DOKUMENT_STATUS_GEAENDERT,DOKUMENT_ANGESEHEN&take=20`)
      .then(res => res.json())
      .then(data => {
        // Client-side filter for this specific document
        const filtered = data.items.filter((item: any) =>
          item.details?.dokumentId === dokumentId || item.details?.dokumentName === dokument.name
        );
        setItems(filtered);
      })
      .finally(() => setLoading(false));
  }, [dokumentId, akteId]);

  return <AuditTimeline items={items} hasMore={false} compact showAkteLink={false} />;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `alert()` for unimplemented features | Toast notifications (non-blocking) | Standard UX practice | Better UX, no modal blocking |
| No VERSENDET transition | Call markDokumenteVersendet() after confirmed send | Phase 9 | Document lifecycle complete |
| No embedding completion signal | Socket.IO event mirrors OCR pattern | Phase 9 | Browser knows when doc is RAG-ready |

## Open Questions

1. **Toast library in chat-input.tsx**
   - What we know: The project uses toast notifications elsewhere
   - What's unclear: Which toast library is used (sonner, react-hot-toast, or custom)
   - Recommendation: Check existing imports in the codebase during execution to match

2. **Document audit history filtering approach**
   - What we know: The `/api/akten/[id]/historie` route exists with aktion filter
   - What's unclear: Whether server-side `dokumentId` filtering or client-side filtering is preferred
   - Recommendation: Use client-side filtering (simpler, one less API change) -- the audit log entries already contain `dokumentId` in their `details` JSON. If performance is an issue with many entries, add server-side Prisma JSON path filter later.

3. **PDFRawStream.of TypeScript error -- still present?**
   - What we know: Running `npx tsc --noEmit` produces NO errors. The code correctly uses `PDFRawStream.of()` which has valid types in pdf-lib.
   - What's unclear: Whether the audit's finding was based on a different TypeScript configuration or an older state
   - Recommendation: Verify during execution. If `tsc --noEmit` is clean, mark as resolved with no changes needed.

## Sources

### Primary (HIGH confidence)
- `src/lib/versand-gate.ts` -- `markDokumenteVersendet()` function definition (lines 110-122)
- `src/worker.ts` -- OCR completion Socket.IO event pattern (lines 229-257), embedding worker (lines 343-376)
- `src/lib/email/smtp/send-processor.ts` -- Email send processor (lines 26-162)
- `src/app/api/bea/messages/route.ts` -- beA message creation (lines 81-239)
- `src/lib/email/imap/sync.ts` -- `syncNewMessages()` dead code (lines 279-309)
- `src/lib/finance/invoice/e-rechnung.ts` -- PDFRawStream.of usage (line 520)
- `src/components/ki/chat-input.tsx` -- Drag-drop stub (lines 114-131)
- `src/components/dokumente/document-detail.tsx` -- Document detail page (missing Historie)
- `.planning/v3.4-MILESTONE-AUDIT.md` -- 6th audit findings (INT-B01, INT-B02, tech debt list)
- `node_modules/pdf-lib/ts3.4/cjs/core/objects/PDFRawStream.d.ts` -- PDFRawStream.of type definition

### Secondary (MEDIUM confidence)
- `src/lib/email/imap/connection-manager.ts` -- Confirms `syncNewMessages` is NOT used (line 111 calls `syncMailbox` directly)
- `src/components/audit/audit-timeline.tsx` -- Reusable AuditTimeline component for document history display

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries, all existing code
- Architecture: HIGH - Patterns already established (OCR event pattern, versand-gate pattern)
- Pitfalls: HIGH - Codebase fully analyzed, all edge cases identified (DMS ID pass-through is the main one)

**Research date:** 2026-02-25
**Valid until:** Indefinite (codebase-specific findings, not version-dependent)
