/**
 * Helena Draft Notification Helpers
 *
 * Sends notifications via the notification service (persisted + Socket.IO)
 * and broadcasts live events to Akte rooms for real-time feed updates.
 *
 * Recipients: triggering user + Akte owner (if different).
 */

import { createNotification } from "@/lib/notifications/service";
import { getSocketEmitter } from "@/lib/socket/emitter";
import { createLogger } from "@/lib/logger";

const log = createLogger("draft-notification");

export async function notifyDraftCreated(draft: {
  id: string;
  akteId: string;
  userId: string;
  typ: string;
  titel: string;
}, akteAnwaltId: string | null) {
  // Recipients: triggering user + Akte owner (if different)
  const recipientSet = new Set<string>();
  recipientSet.add(draft.userId);
  if (akteAnwaltId && akteAnwaltId !== draft.userId) {
    recipientSet.add(akteAnwaltId);
  }
  const recipients = Array.from(recipientSet);

  for (const recipientId of recipients) {
    try {
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
    } catch (err) {
      log.warn({ err, recipientId }, "Failed to create draft notification");
    }
  }

  // Emit to akte room for live feed update banner
  try {
    getSocketEmitter()
      .to(`akte:${draft.akteId}`)
      .emit("helena:draft-created", {
        draftId: draft.id,
        typ: draft.typ,
        titel: draft.titel,
      });
  } catch (err) {
    log.warn({ err }, "Failed to emit draft event to akte room");
  }
}

export async function notifyDraftRevision(draft: {
  id: string;
  akteId: string;
  userId: string;
  typ: string;
  titel: string;
  parentDraftId: string;
}, akteAnwaltId: string | null) {
  const recipientSet2 = new Set<string>();
  recipientSet2.add(draft.userId);
  if (akteAnwaltId && akteAnwaltId !== draft.userId) {
    recipientSet2.add(akteAnwaltId);
  }
  const recipients2 = Array.from(recipientSet2);

  for (const recipientId of recipients2) {
    try {
      await createNotification({
        type: "helena:draft-revision",
        title: `Helena-Entwurf ueberarbeitet: ${draft.titel}`,
        message: `Helena hat eine Revision erstellt.`,
        userId: recipientId,
        data: {
          draftId: draft.id,
          akteId: draft.akteId,
          parentDraftId: draft.parentDraftId,
          link: `/akten/${draft.akteId}?draft=${draft.id}`,
        },
      });
    } catch (err) {
      log.warn({ err, recipientId }, "Failed to create revision notification");
    }
  }

  try {
    getSocketEmitter()
      .to(`akte:${draft.akteId}`)
      .emit("helena:draft-revision", {
        draftId: draft.id,
        typ: draft.typ,
        titel: draft.titel,
        parentDraftId: draft.parentDraftId,
      });
  } catch (err) {
    log.warn({ err }, "Failed to emit revision event to akte room");
  }
}
