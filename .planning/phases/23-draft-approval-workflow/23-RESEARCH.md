# Phase 23: Draft-Approval Workflow - Research

**Researched:** 2026-02-27
**Domain:** Prisma query extensions, draft approval UX, Socket.IO real-time notifications, BRAK-compliant enforcement
**Confidence:** HIGH

## Summary

Phase 23 takes the existing HelenaDraft model (created in Phase 19, populated by agent tools in Phase 20 and the Schriftsatz pipeline in Phase 22) and builds the full lifecycle around it: enforcement that Helena can never create non-ENTWURF documents, a rich review UI in the Akte feed, a global draft inbox, real-time notifications via Socket.IO, and a rejection-feedback pipeline that stores context for Helena's learning.

The codebase already has all the infrastructure in place. HelenaDraft exists in Prisma schema with PENDING/ACCEPTED/REJECTED/EDITED status and DOKUMENT/FRIST/NOTIZ/ALERT types. Five write tools already create drafts as PENDING. Socket.IO is fully wired: server setup with Redis adapter, cookie-based auth, room management (user/role/akte rooms), Redis emitter for worker-to-browser events, notification service (createNotification), and a React provider (NotificationProvider + useSocket hook) with sonner toasts. The AktenActivity model already has a HELENA_DRAFT type. The Prisma client (v5.22) singleton is in `src/lib/db.ts` and needs to be wrapped with `$extends` for the ENTWURF gate.

**Primary recommendation:** Implement the ENTWURF gate using Prisma Client Extensions (`$extends` with query component) on the singleton prisma instance. Build the draft review API as new routes under `/api/helena/drafts`. Extend the existing notification service with a `helena:draft-created` notification type. Add schema fields for revision tracking (parentDraftId self-relation, revisionCount). Build the global inbox as a new sidebar page at `/entwuerfe`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Distinct card style -- different background or subtle dashed border to clearly stand apart from regular feed entries
- Each draft shows its type icon (document/calendar/note) and label like "Entwurf: Frist"
- Compact info: type, title, timestamp, status badge ("ausstehend"), origin conversation link
- Show which user triggered the Helena interaction that created the draft
- For Frist drafts: proposed deadline date shown prominently on the card
- For Dokument drafts: title only, no preview thumbnail
- Pending drafts pinned to top of Akte feed, grouped by type with expand/collapse
- Pinned section is collapsible (user can hide temporarily)
- No bulk actions -- each draft must be reviewed individually (BRAK compliance)
- Rejected drafts collapse/hide (move to "Verlauf" section) -- keeps feed clean
- Accepted drafts leave a trace entry in the feed timeline
- Badge count on Akte detail page (inside Akte only, not in Akten-Uebersicht list)
- No aging indicator -- all pending drafts look the same regardless of age
- Revisions appear as new linked cards ("Revision von [Original]") -- both original and revision visible
- Inline diff available ("Vergleichen" button) between original and revised draft
- Cap at 3 revisions -- after 3 rejections, draft is marked "Manuell bearbeiten"
- Dedicated "Entwuerfe" sidebar item with badge count
- Filter by Akte and draft type (Dokument/Frist/Notiz), sorted by newest first
- Show triggering user per draft
- Action buttons (Annehmen/Bearbeiten/Ablehnen) always visible on the card
- One-click accept -- no confirmation dialog, immediately creates the real record
- Accept uses Helena's proposed defaults -- no target customization at accept time
- 5-second undo toast after accepting -- safety net for accidental accepts
- Minimal accept feedback
- Detail view opens in a centered modal with full rendered draft content
- Keyboard shortcuts in modal: A (Annehmen), B (Bearbeiten), R (Ablehnen)
- Arrow key navigation between drafts in modal
- Real-time hard lock via Socket.IO when someone opens a draft
- Dokument drafts: "Bearbeiten" opens WYSIWYG editor
- Frist drafts: "Bearbeiten" opens Frist-specific form
- Notiz drafts: "Bearbeiten" opens simple text area modal
- After editing any type: draft returns to "ausstehend" for another review
- Rejection reason is optional
- Content-focused categories: "Inhaltlich falsch", "Unvollstaendig", "Ton/Stil unpassend", "Formatierung"
- Free text field for elaboration -- no character limit
- "Nicht ueberarbeiten" discard option available
- Rejection with feedback triggers auto-revise
- Notification fires when revision is ready
- Revision card shows feedback context
- Global user preferences extracted from rejection patterns across all Akten
- ANWALT role always has approval rights (non-removable, BRAK requirement)
- Akte owner can configure additional approval rights
- New draft notification: Toast + bell badge (dual notification)
- Toast is clickable -- navigates directly to the draft detail modal
- Toast auto-dismisses after 5 seconds
- No notification sound -- visual only
- Recipients: triggering user + Akte owner (if different)
- Revision-ready notifications use same style as new draft notifications
- Bell dropdown groups notifications by Akte
- Same treatment for self-triggered vs other-triggered drafts
- In-app notifications only -- no browser push notifications
- Draft-specific mute toggle in user profile/settings
- Live feed update: "1 neuer Entwurf" banner indicator (user clicks to load) -- not auto-insert

### Claude's Discretion
- Exact card styling (colors, shadows, border treatment) within the distinct card style decision
- Loading skeleton and transition animations
- Error state handling for failed accept/reject operations
- Toast positioning and animation style
- Exact lock timeout duration and cleanup behavior
- Prisma middleware implementation details for ENTWURF gate

### Deferred Ideas (OUT OF SCOPE)
- Helena-Einstellungen page -- UI for viewing and managing Helena's learned preferences from rejection patterns. The data is stored in this phase, the management UI belongs in a future phase.
- General DND (Do Not Disturb) notification mode -- a system-wide notification mute that goes beyond draft-specific. Belongs in a general notification settings phase.
- Browser/OS push notifications -- in-app only for now, push notifications are a separate feature.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DRFT-02 | ENTWURF-Gate auf Prisma-Middleware-Ebene: Helena-erstellte Dokumente koennen nie status!=ENTWURF haben (BRAK 2025 / BRAO 43) | Use Prisma Client Extensions `$extends` with query component on `dokument.create` and `dokument.update`. Intercept any create/update where `erstelltDurch === "ai"` and force `status: "ENTWURF"`. Apply on the singleton `prisma` instance in `src/lib/db.ts`. |
| DRFT-03 | Draft-Anzeige im Akte-Feed visuell markiert ("Helena-Entwurf - ausstehend") mit Accept/Reject/Edit Buttons | Build draft cards as React components consuming HelenaDraft data from API. Pinned section at top of Akte feed. Cards show type icon, title, timestamp, status badge, action buttons. Use existing GlassPanel + Badge components. |
| DRFT-04 | Bei Ablehnung: Feedback-Feld wird in Helena-Kontext gespeichert (Lerneffekt fuer zukuenftige Entwuerfe) | Store feedback in HelenaDraft.feedback field (already exists, nullable text). Extract rejection patterns and store in HelenaMemory.content JSON under new `rejectionPatterns` key. Use upsert on HelenaMemory (already @unique on akteId). |
| DRFT-05 | Akzeptierter Draft wird automatisch als Dokument/Frist/Notiz in der Akte angelegt | Accept endpoint creates the real record: DOKUMENT -> prisma.dokument.create, FRIST -> prisma.kalenderEintrag.create, NOTIZ -> append to akte.notizen field. Mark draft as ACCEPTED with reviewedById and reviewedAt. Create AktenActivity entry. |
| DRFT-06 | Socket.IO Benachrichtigung an Zustaendigen wenn Helena einen Draft erstellt hat | Use existing `createNotification()` service with new type `"helena:draft-created"`. Emit to `user:{userId}` room (triggering user) and `user:{anwaltId}` room (Akte owner). Add `"helena:draft-created"` and `"helena:draft-revision"` to NotificationType union. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | ^5.22.0 | ORM with Client Extensions for ENTWURF gate | Already installed. `$extends` query component replaces deprecated `$use` middleware. Type-safe query interception. |
| Socket.IO | ^4.8.3 | Real-time draft notifications and locking | Already installed with Redis adapter, auth middleware, room management. |
| @socket.io/redis-emitter | (installed) | Worker-to-browser events for draft notifications | Already used by notification service for cross-process event delivery. |
| sonner | ^1.7.1 | Toast notifications for draft events | Already used throughout the app. Supports action buttons and auto-dismiss. |
| Next.js App Router | 14+ | API routes for draft CRUD and pages for global inbox | Already the app framework. Route handlers at `/api/helena/drafts/`. |
| shadcn/ui | (installed) | UI components for draft cards, modals, forms | Already used throughout. Badge, Button, Dialog, Sheet components. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | (installed) | Request validation for draft API endpoints | Validate accept/reject/edit request bodies |
| lucide-react | (installed) | Icons for draft type indicators | FileText (DOKUMENT), Calendar (FRIST), StickyNote (NOTIZ) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prisma $extends query | Prisma $use middleware | $use is deprecated since 4.16, removed in 6.14. $extends is the current approach and provides type safety. |
| Socket.IO hard lock | Optimistic locking with version field | Hard lock was a locked decision -- prevents conflicting approval actions entirely. |
| AktenActivity for feed | Separate query on HelenaDraft | Activity model already has HELENA_DRAFT type -- unified feed query is simpler. |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── db.ts                          # Extend with $extends ENTWURF gate
│   ├── helena/
│   │   ├── draft-service.ts           # Accept/reject/edit business logic
│   │   └── draft-notification.ts      # Draft-specific notification helpers
│   ├── notifications/
│   │   └── types.ts                   # Add helena:draft-created type
│   └── socket/
│       └── rooms.ts                   # Add draft lock events
├── app/
│   ├── api/helena/
│   │   └── drafts/
│   │       ├── route.ts               # GET (list drafts), POST (unused -- drafts created by tools)
│   │       └── [id]/
│   │           ├── route.ts           # GET (single draft), PATCH (accept/reject/edit)
│   │           ├── lock/route.ts      # POST (acquire lock), DELETE (release lock)
│   │           └── undo/route.ts      # POST (undo accept within 5s window)
│   └── (dashboard)/
│       └── entwuerfe/
│           └── page.tsx               # Global draft inbox
└── components/
    └── helena/
        ├── draft-card.tsx             # Draft card for feed display
        ├── draft-detail-modal.tsx     # Modal with full content + keyboard shortcuts
        ├── draft-pinned-section.tsx   # Pinned drafts at top of Akte feed
        ├── draft-reject-form.tsx      # Rejection feedback form (categories + free text)
        ├── draft-inbox.tsx            # Global inbox component
        └── draft-lock-indicator.tsx   # "Wird von [Name] geprueft" overlay
```

### Pattern 1: ENTWURF Gate via Prisma Client Extensions
**What:** Intercept all `dokument.create` and `dokument.update` operations at the Prisma level to enforce that AI-created documents always have `status: "ENTWURF"`.
**When to use:** Every database operation on the Dokument model goes through this gate -- no bypass possible.
**Example:**
```typescript
// src/lib/db.ts
import { PrismaClient } from "@prisma/client";

const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === "development"
    ? ["query", "error", "warn"]
    : ["error"],
});

export const prisma = basePrisma.$extends({
  query: {
    dokument: {
      async create({ args, query }) {
        // BRAK 2025 / BRAO 43: AI-created documents MUST be ENTWURF
        if (args.data.erstelltDurch === "ai") {
          args.data.status = "ENTWURF";
        }
        return query(args);
      },
      async update({ args, query }) {
        // Prevent AI-created documents from being promoted past ENTWURF
        // unless a human explicitly reviews (freigegebenDurchId set)
        if (
          args.data.status &&
          args.data.status !== "ENTWURF" &&
          !args.data.freigegebenDurchId
        ) {
          // Check if existing document was AI-created
          const existing = await basePrisma.dokument.findUnique({
            where: args.where,
            select: { erstelltDurch: true },
          });
          if (existing?.erstelltDurch === "ai") {
            // Only allow status change if a human reviewer is set
            args.data.status = "ENTWURF";
          }
        }
        return query(args);
      },
    },
  },
});
```

**IMPORTANT:** The return type of `$extends()` is `PrismaClient` (with extended type), so the exported `prisma` constant keeps the same public API. All existing imports of `prisma` from `@/lib/db` automatically get the ENTWURF gate.

### Pattern 2: Draft Accept with Undo Window
**What:** One-click accept creates the real record immediately but provides a 5-second undo window via toast. If undone, the created record is deleted and the draft reverts to PENDING.
**When to use:** Every draft acceptance.
**Example:**
```typescript
// src/lib/helena/draft-service.ts
export async function acceptDraft(
  draftId: string,
  reviewerId: string,
): Promise<AcceptResult> {
  return prisma.$transaction(async (tx) => {
    const draft = await tx.helenaDraft.findUniqueOrThrow({
      where: { id: draftId },
      include: { akte: { select: { anwaltId: true } } },
    });

    if (draft.status !== "PENDING") {
      throw new Error("Draft ist nicht ausstehend");
    }

    // Create the real record based on draft type
    let createdId: string;
    switch (draft.typ) {
      case "DOKUMENT":
        const doc = await tx.dokument.create({
          data: {
            akteId: draft.akteId,
            name: draft.titel,
            // ... map from draft
            erstelltDurch: "ai",
            status: "ENTWURF", // Enforced by gate, but explicit
            createdById: reviewerId,
          },
        });
        createdId = doc.id;
        break;
      case "FRIST":
        // Create KalenderEintrag from draft.meta
        break;
      case "NOTIZ":
        // Append to akte.notizen
        break;
    }

    // Mark draft as accepted
    await tx.helenaDraft.update({
      where: { id: draftId },
      data: {
        status: "ACCEPTED",
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
    });

    // Create activity entry
    await tx.aktenActivity.create({
      data: {
        akteId: draft.akteId,
        userId: reviewerId,
        typ: "HELENA_DRAFT",
        titel: "Helena-Entwurf angenommen",
        meta: { draftId, createdId, draftTyp: draft.typ },
      },
    });

    return { draftId, createdId, typ: draft.typ };
  });
}
```

### Pattern 3: Draft Lock via Socket.IO
**What:** When a user opens a draft for review, acquire a hard lock that prevents others from acting. Lock stored in-memory (Redis) with TTL.
**When to use:** When opening draft detail modal.
**Example:**
```typescript
// Lock management using Redis with TTL
// POST /api/helena/drafts/[id]/lock
export async function POST(request, { params }) {
  const { id: draftId } = await params;
  const session = await requireAuth();

  const redis = getRedisClient();
  const lockKey = `draft-lock:${draftId}`;

  // Try to acquire lock (SET NX with TTL)
  const acquired = await redis.set(
    lockKey,
    JSON.stringify({ userId: session.user.id, userName: session.user.name }),
    "EX", 300, // 5 minute TTL
    "NX",
  );

  if (!acquired) {
    const existing = JSON.parse(await redis.get(lockKey));
    return NextResponse.json(
      { locked: true, lockedBy: existing.userName },
      { status: 409 },
    );
  }

  // Broadcast lock to akte room
  getSocketEmitter()
    .to(`akte:${draft.akteId}`)
    .emit("draft:locked", { draftId, lockedBy: session.user.name });

  return NextResponse.json({ locked: false });
}
```

### Pattern 4: Rejection Feedback to Helena Context
**What:** On rejection, store structured feedback in draft and extract patterns into HelenaMemory for the Akte.
**When to use:** Every rejection with feedback.
**Example:**
```typescript
// src/lib/helena/draft-service.ts
export async function rejectDraft(
  draftId: string,
  reviewerId: string,
  feedback: {
    categories?: string[];  // ["Inhaltlich falsch", "Ton/Stil unpassend"]
    text?: string;          // Free text elaboration
    noRevise?: boolean;     // "Nicht ueberarbeiten" flag
  },
) {
  return prisma.$transaction(async (tx) => {
    const draft = await tx.helenaDraft.findUniqueOrThrow({
      where: { id: draftId },
    });

    // Store feedback on draft
    const feedbackJson = JSON.stringify({
      categories: feedback.categories ?? [],
      text: feedback.text ?? "",
      noRevise: feedback.noRevise ?? false,
      reviewerId,
      reviewedAt: new Date().toISOString(),
    });

    await tx.helenaDraft.update({
      where: { id: draftId },
      data: {
        status: "REJECTED",
        feedback: feedbackJson,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
    });

    // Update HelenaMemory with rejection pattern
    if (feedback.categories?.length || feedback.text) {
      const memory = await tx.helenaMemory.findUnique({
        where: { akteId: draft.akteId },
      });

      const content = (memory?.content as Record<string, unknown>) ?? {};
      const patterns = (content.rejectionPatterns as unknown[]) ?? [];
      patterns.push({
        draftTyp: draft.typ,
        categories: feedback.categories,
        text: feedback.text,
        timestamp: new Date().toISOString(),
      });

      // Keep last 50 patterns per Akte
      const trimmed = patterns.slice(-50);

      await tx.helenaMemory.upsert({
        where: { akteId: draft.akteId },
        create: {
          akteId: draft.akteId,
          content: { ...content, rejectionPatterns: trimmed },
        },
        update: {
          content: { ...content, rejectionPatterns: trimmed },
          version: { increment: 1 },
        },
      });
    }

    // Create activity entry
    await tx.aktenActivity.create({
      data: {
        akteId: draft.akteId,
        userId: reviewerId,
        typ: "HELENA_DRAFT",
        titel: "Helena-Entwurf abgelehnt",
        meta: { draftId, categories: feedback.categories },
      },
    });
  });
}
```

### Anti-Patterns to Avoid
- **HTTP-only middleware for ENTWURF gate:** Bypassed by direct Prisma calls from worker processes, internal services, or migration scripts. The gate MUST be at the Prisma query level.
- **Optimistic concurrency for draft review:** User decision requires hard locks via Socket.IO. Don't use version fields / retry loops.
- **Auto-inserting drafts into feed:** User decision specifies banner indicator ("1 neuer Entwurf") that user clicks to load. Don't push new cards into the DOM automatically.
- **Storing lock state in PostgreSQL:** Lock is ephemeral. Use Redis with TTL (SET NX EX). Database locks would create unnecessary write pressure and require cleanup cron.
- **Bulk accept/reject:** Explicitly forbidden by BRAK compliance decision. Each draft must be reviewed individually.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Real-time event delivery | Custom WebSocket server | Existing Socket.IO + Redis emitter (`getSocketEmitter()`) | Already wired with auth, rooms, Redis adapter. Cross-process support. |
| Toast notifications | Custom notification UI | sonner (already imported throughout app) | Supports action buttons, auto-dismiss, positioning. Used everywhere else. |
| Draft notification persistence | Custom notification table | Existing `Notification` model + `createNotification()` | Full CRUD, Socket.IO delivery, notification provider on client. |
| Distributed lock | Custom lock table | Redis SET NX EX | TTL auto-cleanup, no stale locks, no cron needed. |
| Form validation | Manual validation | zod schemas (used in all existing API routes) | Type inference, error messages, consistent with project patterns. |
| Modal/dialog | Custom modal | shadcn/ui Dialog or Sheet component | Already available, accessible, keyboard-friendly. |

**Key insight:** The project already has a complete notification pipeline (DB persistence + Socket.IO delivery + React provider + sonner toasts). Phase 23 just needs to add new notification types and emit them at the right points. Similarly, Socket.IO rooms are already set up -- draft locking just adds new event types to the existing infrastructure.

## Common Pitfalls

### Pitfall 1: Prisma $extends Type Narrowing
**What goes wrong:** The return type of `$extends()` is a new type, not exactly `PrismaClient`. Code that type-checks for `PrismaClient` explicitly (e.g., function signatures) may fail.
**Why it happens:** `$extends` wraps the client in a proxy with additional type information.
**How to avoid:** Export the extended client as-is. All tool contexts already type their `prisma` parameter as `PrismaClient` -- this works because the extended client is structurally compatible. If TypeScript complains, use `as unknown as PrismaClient` at the export site (common Prisma pattern).
**Warning signs:** TypeScript errors about incompatible types when passing prisma to functions.

### Pitfall 2: Transaction Context Bypasses $extends
**What goes wrong:** Inside `prisma.$transaction(async (tx) => { ... })`, the `tx` parameter does NOT include `$extends` query hooks. The ENTWURF gate is bypassed.
**Why it happens:** Prisma transactions create a new client context without extensions.
**How to avoid:** Use interactive transactions for draft acceptance, but manually enforce the ENTWURF status inside the transaction body. The $extends gate is the safety net for all OTHER code paths. Inside the accept transaction, explicitly set `status: "ENTWURF"` and `erstelltDurch: "ai"` on the created Dokument.
**Warning signs:** AI-created documents appearing with non-ENTWURF status. Add a database CHECK constraint as a secondary safety net.

### Pitfall 3: Undo Window Race Condition
**What goes wrong:** User accepts draft, then another user acts on the created record during the 5-second undo window. Undo deletes the record, causing data loss.
**Why it happens:** The undo window and the real record creation are not coordinated.
**How to avoid:** Create the record with a `pendingUndo: true` flag (or use a separate staging table). Only make the record visible to other users after the undo window expires. Alternatively, the simpler approach: create immediately, and if undo is triggered, soft-delete the record and revert the draft to PENDING. The 5-second window makes race conditions extremely unlikely in practice.
**Warning signs:** Orphaned references, 404 errors on recently created records.

### Pitfall 4: Socket.IO Lock Stale After Tab Close
**What goes wrong:** User opens draft modal, acquires lock, then closes browser tab. Lock remains in Redis until TTL expires.
**Why it happens:** Socket.IO `disconnect` event fires, but the lock cleanup handler may not be registered.
**How to avoid:** Register a `disconnect` handler on the socket that releases all locks held by that user. Also use a reasonable TTL (5 minutes) so stale locks auto-expire. Add a "steal lock" capability for ANWALT role as a safety valve.
**Warning signs:** "Wird von [Name] geprueft" persisting long after the user left.

### Pitfall 5: HelenaDraft Schema Missing Revision Fields
**What goes wrong:** Revision tracking (parentDraftId, revisionCount) is not in the current Prisma schema. Building revision UI without schema support requires workarounds.
**Why it happens:** Phase 19 created the base HelenaDraft model without revision tracking (it was not in the original DRFT-01 requirement).
**How to avoid:** Add a Prisma migration in the first plan to add `parentDraftId` (nullable self-FK) and `revisionCount` (Int, default 0) to HelenaDraft. Also add a `feedbackCategories` JSON field for structured rejection categories.
**Warning signs:** Trying to track revisions through HelenaDraft.meta JSON instead of proper relational fields.

## Code Examples

### Draft Notification Helper
```typescript
// src/lib/helena/draft-notification.ts
import { createNotification } from "@/lib/notifications/service";
import { getSocketEmitter } from "@/lib/socket/emitter";

export async function notifyDraftCreated(draft: {
  id: string;
  akteId: string;
  userId: string;  // triggering user
  typ: string;
  titel: string;
}, akteAnwaltId: string | null) {
  const recipients = new Set<string>();
  recipients.add(draft.userId);
  if (akteAnwaltId && akteAnwaltId !== draft.userId) {
    recipients.add(akteAnwaltId);
  }

  for (const recipientId of recipients) {
    await createNotification({
      type: "helena:draft-created",
      title: `Neuer Helena-Entwurf: ${draft.titel}`,
      message: `Helena hat einen ${draft.typ}-Entwurf erstellt.`,
      userId: recipientId,
      data: {
        draftId: draft.id,
        akteId: draft.akteId,
        draftTyp: draft.typ,
        link: `/akten/${draft.akteId}?draft=${draft.id}`,
      },
    });
  }

  // Also emit to akte room for live feed update
  getSocketEmitter()
    .to(`akte:${draft.akteId}`)
    .emit("helena:draft-created", {
      draftId: draft.id,
      typ: draft.typ,
      titel: draft.titel,
    });
}
```

### Draft Card Component Skeleton
```tsx
// src/components/helena/draft-card.tsx
"use client";

import { FileText, Calendar, StickyNote, Check, Pencil, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const TYPE_ICONS = {
  DOKUMENT: FileText,
  FRIST: Calendar,
  NOTIZ: StickyNote,
  ALERT: StickyNote,
} as const;

const TYPE_LABELS = {
  DOKUMENT: "Dokument",
  FRIST: "Frist",
  NOTIZ: "Notiz",
  ALERT: "Hinweis",
} as const;

interface DraftCardProps {
  draft: {
    id: string;
    typ: string;
    titel: string;
    status: string;
    createdAt: string;
    user: { name: string };
    meta?: Record<string, unknown>;
    lockedBy?: string | null;
  };
  onAccept: (id: string) => void;
  onEdit: (id: string) => void;
  onReject: (id: string) => void;
  onOpenDetail: (id: string) => void;
}

export function DraftCard({ draft, onAccept, onEdit, onReject, onOpenDetail }: DraftCardProps) {
  const Icon = TYPE_ICONS[draft.typ as keyof typeof TYPE_ICONS] ?? StickyNote;
  const label = TYPE_LABELS[draft.typ as keyof typeof TYPE_LABELS] ?? draft.typ;
  const isPending = draft.status === "PENDING";
  const isLocked = !!draft.lockedBy;

  return (
    <div
      className="border border-dashed border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-950/20 rounded-lg p-4 cursor-pointer"
      onClick={() => onOpenDetail(draft.id)}
    >
      {/* ... card content ... */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-violet-600" />
          <span className="text-sm font-medium">Entwurf: {label}</span>
          <Badge variant="outline">ausstehend</Badge>
        </div>
        {isPending && !isLocked && (
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="ghost" onClick={() => onAccept(draft.id)}>
              <Check className="w-4 h-4" />
              Annehmen
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onEdit(draft.id)}>
              <Pencil className="w-4 h-4" />
              Bearbeiten
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onReject(draft.id)}>
              <X className="w-4 h-4" />
              Ablehnen
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Undo Accept Pattern
```typescript
// Client-side: after successful accept
const handleAccept = async (draftId: string) => {
  const result = await fetch(`/api/helena/drafts/${draftId}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "accept" }),
  });

  if (result.ok) {
    const { createdId, typ } = await result.json();

    toast("Angenommen", {
      action: {
        label: "Rueckgaengig",
        onClick: async () => {
          await fetch(`/api/helena/drafts/${draftId}/undo`, {
            method: "POST",
            body: JSON.stringify({ createdId, typ }),
          });
          // Refresh feed
        },
      },
      duration: 5000,
    });
  }
};
```

## Schema Changes Required

The following Prisma schema changes are needed before implementation:

```prisma
model HelenaDraft {
  // ... existing fields ...

  // NEW: Revision tracking
  parentDraftId  String?
  parentDraft    HelenaDraft?  @relation("DraftRevisions", fields: [parentDraftId], references: [id])
  revisions      HelenaDraft[] @relation("DraftRevisions")
  revisionCount  Int           @default(0)  // 0 = original, 1-3 = revisions

  // NEW: Structured rejection categories (separate from free-text feedback)
  feedbackCategories String[]  // ["Inhaltlich falsch", "Ton/Stil unpassend"]
  noRevise           Boolean   @default(false)  // "Nicht ueberarbeiten" flag

  // NEW: Soft-delete for undo window
  undoExpiresAt      DateTime?  // Set on accept, cleared after 5s or on undo

  @@index([parentDraftId])
}
```

Also add to NotificationType in `src/lib/notifications/types.ts`:
```typescript
export type NotificationType =
  // ... existing types ...
  | "helena:draft-created"
  | "helena:draft-revision"
  | "helena:draft-accepted"
  | "helena:draft-rejected";
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma `$use` middleware | Prisma `$extends` query component | Prisma 4.16 (deprecated $use), 6.14 (removed $use) | Must use `$extends` for the ENTWURF gate. Project uses Prisma 5.22 where $use is deprecated but functional -- use $extends for forward compatibility. |
| Manual Socket.IO event wiring | Redis emitter + notification service | Already in project | Draft notifications should use the existing `createNotification()` + `getSocketEmitter()` pattern, not build a parallel notification channel. |

**Deprecated/outdated:**
- `prisma.$use()`: Deprecated in Prisma 4.16, removed in 6.14. Use `prisma.$extends({ query: { ... } })` instead.
- HelenaSuggestion model: Legacy model from v0.1 (still in schema). Phase 23 works exclusively with HelenaDraft (v0.2 model). Do not confuse the two.

## Open Questions

1. **$extends inside $transaction**
   - What we know: Prisma `$extends` query hooks may not fire inside interactive transactions (`$transaction(async (tx) => ...)`). The `tx` client is a different context.
   - What's unclear: Whether Prisma 5.22 propagates $extends hooks into transactions. Prisma docs are ambiguous on this.
   - Recommendation: Assume hooks DO NOT fire in transactions. Manually enforce ENTWURF status in all transaction bodies. Add a PostgreSQL CHECK constraint as a database-level safety net: `ALTER TABLE dokumente ADD CONSTRAINT chk_ai_entwurf CHECK (erstellt_durch != 'ai' OR status = 'ENTWURF')`.

2. **Undo window implementation strategy**
   - What we know: User wants 5-second undo after accept. The record is created immediately.
   - What's unclear: Whether to use soft-delete (flag) or hard-delete on undo. Whether the created record should be "hidden" during the undo window.
   - Recommendation: Create the record immediately (no hiding), undo performs hard-delete of the created record and reverts draft to PENDING. The 5-second window is extremely short -- race conditions are negligible. If undo is triggered after the record has been modified by another user, show an error toast and skip the undo.

3. **Auto-revise triggering**
   - What we know: Rejection with feedback triggers Helena to auto-generate a revised draft. Cap at 3 revisions.
   - What's unclear: Whether auto-revise should run inline (HTTP) or background (BullMQ). Whether the user should see a loading indicator on the rejected card.
   - Recommendation: Use background (BullMQ) via existing `createHelenaTask()`. The user decided "Notification fires when revision is ready (no loading state on card)" -- so background is the correct choice. Enqueue a task with `auftrag` containing the original prompt + feedback context, and `quelle: "auto-revise"`.

## Sources

### Primary (HIGH confidence)
- Project codebase: `prisma/schema.prisma` -- HelenaDraft model, DokumentStatus enum, AktenActivity model
- Project codebase: `src/lib/db.ts` -- current Prisma client singleton (no extensions yet)
- Project codebase: `src/lib/socket/` -- complete Socket.IO infrastructure (server, auth, rooms, emitter)
- Project codebase: `src/lib/notifications/service.ts` -- notification creation + Socket.IO delivery
- Project codebase: `src/components/notifications/notification-provider.tsx` -- client-side notification handling
- Project codebase: `src/lib/helena/tools/_write/` -- all 4 draft creation tools
- Project codebase: `src/lib/helena/schriftsatz/index.ts` -- pipeline draft creation
- [Prisma Client Extensions query docs](https://www.prisma.io/docs/orm/prisma-client/client-extensions/query) -- $extends API

### Secondary (MEDIUM confidence)
- [Prisma middleware deprecation](https://www.prisma.io/docs/orm/prisma-client/client-extensions/middleware) -- $use deprecated in 4.16, removed in 6.14

### Tertiary (LOW confidence)
- $extends behavior inside $transaction -- multiple forum posts suggest hooks do not fire, but no official confirmation for Prisma 5.22 specifically. Treat as unreliable; code defensively.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and actively used in project
- Architecture: HIGH - patterns follow existing project conventions exactly (notification service, Socket.IO rooms, API route structure)
- Pitfalls: MEDIUM - $extends transaction behavior needs validation during implementation; undo window race condition mitigation is a judgment call

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stable -- no external dependency changes expected)
