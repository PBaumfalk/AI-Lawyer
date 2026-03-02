/**
 * Message service -- send, edit, soft-delete messages with Socket.IO broadcasting
 * and @mention notification handling.
 *
 * All business logic for messages lives here. API routes call these functions
 * and remain thin.
 */

import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { getSocketEmitter } from "@/lib/socket/emitter";
import { createNotification } from "@/lib/notifications/service";
import { hasHelenaMention, parseHelenaMention } from "@/lib/helena/at-mention-parser";
import { createHelenaTask } from "@/lib/helena/task-service";
import type { Message } from "@prisma/client";
import type { MessageNewPayload, MessageEditedPayload, MessageDeletedPayload } from "./types";

const log = createLogger("messaging:message");

/**
 * Send a new message to a channel.
 *
 * 1. Creates the message in the database
 * 2. Emits `message:new` to the channel room via Socket.IO
 * 3. Processes @mentions -- expands @alle, creates notifications
 * 4. Checks for @Helena mention in AKTE channels
 *
 * @returns The created message with author included
 */
export async function sendMessage(params: {
  channelId: string;
  authorId: string;
  body: string;
  mentions?: string[];
  attachments?: unknown[];
  parentId?: string;
}): Promise<Message & { author: { id: string; name: string | null; avatarUrl: string | null; isSystem: boolean } }> {
  const { channelId, authorId, body, mentions = [], attachments, parentId } = params;

  // 1. Create message
  const message = await prisma.message.create({
    data: {
      channelId,
      authorId,
      body,
      mentions: mentions.length > 0 ? mentions : undefined,
      attachments: attachments ? (attachments as never) : undefined,
      parentId,
    },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true, isSystem: true } },
    },
  });

  // 2. Emit to channel room via Socket.IO
  const payload: MessageNewPayload = {
    id: message.id,
    channelId,
    authorId: message.authorId,
    authorName: message.author.name || "Unbekannt",
    authorAvatarUrl: message.author.avatarUrl,
    body: message.body,
    mentions: message.mentions as string[] | null,
    attachments: message.attachments as unknown[] | null,
    parentId: message.parentId,
    createdAt: message.createdAt.toISOString(),
    isSystem: message.author.isSystem,
  };

  getSocketEmitter()
    .to(`channel:${channelId}`)
    .emit("message:new", payload);

  // 3. Process @mentions -- expand @alle, create notifications
  const rawMentions = mentions.filter((id) => id !== "__alle__");
  let mentionTargets: string[];

  if (mentions.includes("__alle__")) {
    // Expand @alle to all channel members (excluding author)
    const allMembers = await prisma.channelMember.findMany({
      where: { channelId },
      select: { userId: true },
    });
    mentionTargets = allMembers
      .map((m) => m.userId)
      .filter((id) => id !== authorId);
  } else {
    mentionTargets = rawMentions.filter((id) => id !== authorId);
  }

  // Deduplicate mention targets
  const uniqueTargets = Array.from(new Set(mentionTargets));

  // Fire-and-forget notifications for mentioned users
  for (const userId of uniqueTargets) {
    createNotification({
      type: "message:mention",
      title: `${message.author.name || "Jemand"} hat dich erwaehnt`,
      message: body.slice(0, 100),
      userId,
      data: { channelId, messageId: message.id },
    }).catch((err) => {
      log.warn({ err, userId, messageId: message.id }, "Failed to send mention notification");
    });
  }

  // 4. Check for @Helena mention in AKTE channels
  if (hasHelenaMention(body)) {
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { typ: true, akteId: true },
    });

    if (channel?.typ === "AKTE" && channel.akteId) {
      const instruction = parseHelenaMention(body);
      if (instruction) {
        // Look up author details for Helena task
        const author = await prisma.user.findUnique({
          where: { id: authorId },
          select: { role: true, name: true },
        });

        createHelenaTask({
          userId: authorId,
          userRole: author?.role || "SACHBEARBEITER",
          userName: author?.name || "Unbekannt",
          akteId: channel.akteId,
          auftrag: instruction,
          prioritaet: 8,
          quelle: "at-mention",
          channelId, // Post Helena response back to this channel
        }).catch((err) => {
          log.warn({ err, channelId, akteId: channel.akteId }, "Failed to create Helena task from channel mention");
        });
      }
    }
  }

  return message;
}

/**
 * Edit an existing message.
 *
 * Only the original author can edit their own messages.
 * Updates body + sets editedAt timestamp.
 * Emits `message:edited` to the channel room.
 */
export async function editMessage(
  messageId: string,
  newBody: string,
  userId: string
): Promise<{ message?: Message; error?: string; status?: number }> {
  // Fetch message to verify ownership
  const existing = await prisma.message.findUnique({
    where: { id: messageId },
    select: { authorId: true, channelId: true, deletedAt: true },
  });

  if (!existing) {
    return { error: "Nachricht nicht gefunden", status: 404 };
  }

  if (existing.deletedAt) {
    return { error: "Geloeschte Nachricht kann nicht bearbeitet werden", status: 400 };
  }

  if (existing.authorId !== userId) {
    return { error: "Nur der Autor kann diese Nachricht bearbeiten", status: 403 };
  }

  const message = await prisma.message.update({
    where: { id: messageId },
    data: {
      body: newBody,
      editedAt: new Date(),
    },
  });

  // Emit edit event to channel room
  const payload: MessageEditedPayload = {
    id: message.id,
    channelId: message.channelId,
    body: message.body,
    editedAt: message.editedAt!.toISOString(),
  };

  getSocketEmitter()
    .to(`channel:${message.channelId}`)
    .emit("message:edited", payload);

  return { message };
}

/**
 * Soft-delete a message.
 *
 * Author can delete their own messages. ADMIN can delete any message.
 * Sets deletedAt timestamp and clears body to empty string.
 * Emits `message:deleted` to the channel room.
 */
export async function softDeleteMessage(
  messageId: string,
  userId: string,
  userRole: string
): Promise<{ error?: string; status?: number }> {
  // Fetch message to verify ownership or admin rights
  const existing = await prisma.message.findUnique({
    where: { id: messageId },
    select: { authorId: true, channelId: true, deletedAt: true },
  });

  if (!existing) {
    return { error: "Nachricht nicht gefunden", status: 404 };
  }

  if (existing.deletedAt) {
    return { error: "Nachricht ist bereits geloescht", status: 400 };
  }

  if (existing.authorId !== userId && userRole !== "ADMIN") {
    return { error: "Keine Berechtigung zum Loeschen dieser Nachricht", status: 403 };
  }

  await prisma.message.update({
    where: { id: messageId },
    data: {
      deletedAt: new Date(),
      body: "", // Clear body on soft-delete
    },
  });

  // Emit delete event to channel room
  const payload: MessageDeletedPayload = {
    id: messageId,
    channelId: existing.channelId,
  };

  getSocketEmitter()
    .to(`channel:${existing.channelId}`)
    .emit("message:deleted", payload);

  return {};
}
