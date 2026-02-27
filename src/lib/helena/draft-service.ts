/**
 * Helena Draft Service -- business logic for the draft approval workflow.
 *
 * Handles the lifecycle of HelenaDraft records:
 * - acceptDraft: Creates real Dokument/KalenderEintrag/AktenActivity + marks ACCEPTED
 * - rejectDraft: Stores structured feedback, updates HelenaMemory rejection patterns
 * - undoAcceptDraft: Reverts accepted draft within 5s window
 * - editDraft: Updates draft content, returns to PENDING status
 *
 * BRAK 2025 / BRAO 43: AI-created Dokument records are always ENTWURF.
 * The $extends gate in db.ts enforces this globally, but we also set it
 * explicitly inside transactions as a defense-in-depth measure.
 */

import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import type { HelenaDraftTyp, Prisma } from "@prisma/client";

const log = createLogger("helena-draft-service");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AcceptResult {
  draftId: string;
  createdId: string;
  typ: HelenaDraftTyp;
}

export interface RejectResult {
  draftId: string;
  /** Whether auto-revise should be triggered */
  shouldAutoRevise: boolean;
  akteId: string;
  parentDraftId: string;
  revisionCount: number;
}

export interface RejectFeedback {
  categories?: string[];
  text?: string;
  noRevise?: boolean;
}

// ---------------------------------------------------------------------------
// acceptDraft
// ---------------------------------------------------------------------------

/**
 * Accept a HelenaDraft and create the corresponding real record.
 *
 * Uses $transaction to ensure atomicity. Explicitly sets status: "ENTWURF"
 * on Dokument records as defense-in-depth (Prisma $extends gate may not
 * fire inside interactive transactions in Prisma 5.22).
 */
export async function acceptDraft(
  draftId: string,
  reviewerId: string,
): Promise<AcceptResult> {
  return prisma.$transaction(async (tx) => {
    // 1. Load draft, verify PENDING
    const draft = await tx.helenaDraft.findUniqueOrThrow({
      where: { id: draftId },
    });

    if (draft.status !== "PENDING") {
      throw new Error(
        `Draft ${draftId} hat Status ${draft.status}, erwartet PENDING`,
      );
    }

    const meta = (draft.meta as Record<string, unknown>) ?? {};
    let createdId: string;

    // 2. Create real record based on draft type
    switch (draft.typ) {
      case "DOKUMENT": {
        const dokument = await tx.dokument.create({
          data: {
            akteId: draft.akteId,
            name: draft.titel,
            dateipfad:
              (meta.dateipfad as string) ?? `helena-draft/${draftId}`,
            mimeType: (meta.mimeType as string) ?? "text/plain",
            groesse:
              (meta.groesse as number) ?? Buffer.byteLength(draft.inhalt),
            erstelltDurch: "ai",
            status: "ENTWURF", // Explicit -- defense-in-depth for BRAK 2025
            createdById: reviewerId,
          },
        });
        createdId = dokument.id;
        break;
      }

      case "FRIST": {
        const datumStr = meta.datum as string | undefined;
        if (!datumStr) {
          throw new Error(
            `Draft ${draftId}: Frist erfordert meta.datum`,
          );
        }
        const kalenderEintrag = await tx.kalenderEintrag.create({
          data: {
            akteId: draft.akteId,
            typ: "FRIST",
            titel: draft.titel,
            beschreibung: draft.inhalt,
            datum: new Date(datumStr),
            verantwortlichId: reviewerId,
            ganztaegig: (meta.ganztaegig as boolean) ?? true,
          },
        });
        createdId = kalenderEintrag.id;
        break;
      }

      case "NOTIZ": {
        const activity = await tx.aktenActivity.create({
          data: {
            akteId: draft.akteId,
            typ: "NOTIZ",
            titel: draft.titel,
            inhalt: draft.inhalt,
            userId: reviewerId,
          },
        });
        createdId = activity.id;
        break;
      }

      case "ALERT": {
        // ALERT drafts create an AktenActivity as well (alerts are separate)
        const alertActivity = await tx.aktenActivity.create({
          data: {
            akteId: draft.akteId,
            typ: "HELENA_ALERT",
            titel: draft.titel,
            inhalt: draft.inhalt,
            userId: reviewerId,
            meta: { draftId, draftTyp: draft.typ } as Prisma.InputJsonValue,
          },
        });
        createdId = alertActivity.id;
        break;
      }

      default:
        throw new Error(`Unbekannter Draft-Typ: ${draft.typ}`);
    }

    // 3. Update draft status
    await tx.helenaDraft.update({
      where: { id: draftId },
      data: {
        status: "ACCEPTED",
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        undoExpiresAt: new Date(Date.now() + 5000),
      },
    });

    // 4. Create activity entry
    await tx.aktenActivity.create({
      data: {
        akteId: draft.akteId,
        typ: "HELENA_DRAFT",
        titel: "Helena-Entwurf angenommen",
        userId: reviewerId,
        meta: {
          draftId,
          createdId,
          draftTyp: draft.typ,
        } as Prisma.InputJsonValue,
      },
    });

    log.info(
      { draftId, createdId, typ: draft.typ },
      "Draft accepted",
    );

    return { draftId, createdId, typ: draft.typ };
  });
}

// ---------------------------------------------------------------------------
// rejectDraft
// ---------------------------------------------------------------------------

/**
 * Reject a HelenaDraft with structured feedback.
 *
 * Stores feedback categories and free text on the draft record,
 * and upserts rejection patterns into HelenaMemory for future improvement.
 */
export async function rejectDraft(
  draftId: string,
  reviewerId: string,
  feedback: RejectFeedback,
): Promise<RejectResult> {
  const { categories, text, noRevise } = feedback;

  // 1. Load and verify draft
  const draft = await prisma.helenaDraft.findUniqueOrThrow({
    where: { id: draftId },
  });

  if (draft.status !== "PENDING") {
    throw new Error(
      `Draft ${draftId} hat Status ${draft.status}, erwartet PENDING`,
    );
  }

  // 2. Update draft with rejection data
  await prisma.helenaDraft.update({
    where: { id: draftId },
    data: {
      status: "REJECTED",
      feedback: JSON.stringify({
        categories,
        text,
        noRevise,
        reviewerId,
        reviewedAt: new Date().toISOString(),
      }),
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      feedbackCategories: categories ?? [],
      noRevise: noRevise ?? false,
    },
  });

  // 3. Upsert rejection patterns into HelenaMemory (keep last 50)
  if ((categories && categories.length > 0) || text) {
    const pattern = {
      draftTyp: draft.typ,
      categories: categories ?? [],
      text: text ?? "",
      timestamp: new Date().toISOString(),
    };

    const existing = await prisma.helenaMemory.findUnique({
      where: { akteId: draft.akteId },
    });

    const content = (existing?.content as Record<string, unknown>) ?? {};
    const rejectionPatterns = Array.isArray(content.rejectionPatterns)
      ? (content.rejectionPatterns as unknown[])
      : [];

    // Keep last 50 entries
    rejectionPatterns.push(pattern);
    if (rejectionPatterns.length > 50) {
      rejectionPatterns.splice(0, rejectionPatterns.length - 50);
    }

    await prisma.helenaMemory.upsert({
      where: { akteId: draft.akteId },
      create: {
        akteId: draft.akteId,
        content: {
          ...content,
          rejectionPatterns,
        } as Prisma.InputJsonValue,
      },
      update: {
        content: {
          ...content,
          rejectionPatterns,
        } as Prisma.InputJsonValue,
        version: (existing?.version ?? 0) + 1,
        lastRefreshedAt: new Date(),
      },
    });
  }

  // 4. Create activity entry
  await prisma.aktenActivity.create({
    data: {
      akteId: draft.akteId,
      typ: "HELENA_DRAFT",
      titel: "Helena-Entwurf abgelehnt",
      userId: reviewerId,
      meta: {
        draftId,
        draftTyp: draft.typ,
        categories,
        noRevise,
      } as Prisma.InputJsonValue,
    },
  });

  const shouldAutoRevise =
    !(noRevise ?? false) &&
    ((categories && categories.length > 0) || !!text);

  log.info(
    { draftId, shouldAutoRevise, revisionCount: draft.revisionCount },
    "Draft rejected",
  );

  return {
    draftId,
    shouldAutoRevise,
    akteId: draft.akteId,
    parentDraftId: draftId,
    revisionCount: draft.revisionCount + 1,
  };
}

// ---------------------------------------------------------------------------
// undoAcceptDraft
// ---------------------------------------------------------------------------

/**
 * Undo an accepted draft within the 5-second window.
 *
 * Deletes the created record, reverts draft to PENDING,
 * and removes the "angenommen" AktenActivity.
 */
export async function undoAcceptDraft(
  draftId: string,
  createdId: string,
  typ: string,
  reviewerId: string,
): Promise<void> {
  return prisma.$transaction(async (tx) => {
    // 1. Load draft, verify ACCEPTED + undo window
    const draft = await tx.helenaDraft.findUniqueOrThrow({
      where: { id: draftId },
    });

    if (draft.status !== "ACCEPTED") {
      throw new Error(
        `Draft ${draftId} hat Status ${draft.status}, erwartet ACCEPTED`,
      );
    }

    if (!draft.undoExpiresAt || draft.undoExpiresAt < new Date()) {
      throw new Error("Undo-Fenster abgelaufen");
    }

    // 2. Delete created record
    switch (typ) {
      case "DOKUMENT":
        await tx.dokument.delete({ where: { id: createdId } });
        break;
      case "FRIST":
        await tx.kalenderEintrag.delete({ where: { id: createdId } });
        break;
      case "NOTIZ":
      case "ALERT":
        await tx.aktenActivity.delete({ where: { id: createdId } });
        break;
      default:
        throw new Error(`Unbekannter Typ fuer Undo: ${typ}`);
    }

    // 3. Revert draft to PENDING
    await tx.helenaDraft.update({
      where: { id: draftId },
      data: {
        status: "PENDING",
        reviewedById: null,
        reviewedAt: null,
        undoExpiresAt: null,
      },
    });

    // 4. Delete the "angenommen" activity
    // Find the most recent HELENA_DRAFT activity for this draft
    const activities = await tx.aktenActivity.findMany({
      where: {
        akteId: draft.akteId,
        typ: "HELENA_DRAFT",
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const acceptActivity = activities.find((a) => {
      const meta = a.meta as Record<string, unknown> | null;
      return meta?.draftId === draftId && a.titel === "Helena-Entwurf angenommen";
    });

    if (acceptActivity) {
      await tx.aktenActivity.delete({ where: { id: acceptActivity.id } });
    }

    log.info({ draftId, createdId, typ }, "Draft accept undone");
  });
}

// ---------------------------------------------------------------------------
// editDraft
// ---------------------------------------------------------------------------

/**
 * Edit a draft's content. Returns to PENDING status for another review.
 *
 * Per user decision: "After editing any type: draft returns to ausstehend
 * for another review."
 */
export async function editDraft(
  draftId: string,
  reviewerId: string,
  updates: {
    titel?: string;
    inhalt?: string;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  // 1. Load draft, verify PENDING or EDITED
  const draft = await prisma.helenaDraft.findUniqueOrThrow({
    where: { id: draftId },
  });

  if (draft.status !== "PENDING" && draft.status !== "EDITED") {
    throw new Error(
      `Draft ${draftId} hat Status ${draft.status}, Bearbeitung nur bei PENDING/EDITED moeglich`,
    );
  }

  // 2. Build update data
  const updateData: Record<string, unknown> = {
    // Net result: draft stays/returns to PENDING for another review
    status: "PENDING",
  };

  if (updates.titel !== undefined) {
    updateData.titel = updates.titel;
  }
  if (updates.inhalt !== undefined) {
    updateData.inhalt = updates.inhalt;
  }
  if (updates.meta !== undefined) {
    // Merge with existing meta
    const existingMeta = (draft.meta as Record<string, unknown>) ?? {};
    updateData.meta = { ...existingMeta, ...updates.meta };
  }

  await prisma.helenaDraft.update({
    where: { id: draftId },
    data: updateData as Prisma.HelenaDraftUpdateInput,
  });

  // 3. Create activity entry
  await prisma.aktenActivity.create({
    data: {
      akteId: draft.akteId,
      typ: "HELENA_DRAFT",
      titel: "Helena-Entwurf bearbeitet",
      userId: reviewerId,
      meta: {
        draftId,
        draftTyp: draft.typ,
        editedFields: Object.keys(updates).filter(
          (k) => updates[k as keyof typeof updates] !== undefined,
        ),
      } as Prisma.InputJsonValue,
    },
  });

  log.info({ draftId, editedFields: Object.keys(updates) }, "Draft edited");
}
