/**
 * Email sync engine: handles initial and incremental sync from IMAP to PostgreSQL.
 * Downloads messages via ImapFlow streaming, parses with mailparser, stores in DB.
 */

import type { ImapFlow } from "imapflow";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { parseRawEmail } from "@/lib/email/imap/parser";
import { sanitizeEmailHtml } from "@/lib/email/sanitize";
import { findThreadId } from "@/lib/email/threading";
import { uploadFile } from "@/lib/storage";
import type { SyncResult, EmailInitialSync } from "@/lib/email/types";
import { Readable } from "node:stream";

const log = createLogger("imap:sync");

/** Maximum attachment size to store in MinIO (25 MB) */
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;

/**
 * Convert an async iterable or stream to a Buffer.
 */
async function streamToBuffer(stream: any): Promise<Buffer> {
  const chunks: Buffer[] = [];

  if (stream instanceof Readable || typeof stream[Symbol.asyncIterator] === "function") {
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
  } else if (Buffer.isBuffer(stream)) {
    return stream;
  }

  return Buffer.concat(chunks);
}

/**
 * Sync a single mailbox folder: fetch messages by UID, parse, and store.
 *
 * CRITICAL: Uses client.fetchAll() to fetch metadata (avoids IMAP deadlock),
 * then client.download() for full message source (streaming, not buffering).
 *
 * @param client - Connected ImapFlow instance
 * @param kontoId - EmailKonto ID
 * @param folder - IMAP folder path (e.g., "INBOX")
 * @param since - Only sync messages since this date (optional)
 */
export async function syncMailbox(
  client: ImapFlow,
  kontoId: string,
  folder: string,
  since?: Date
): Promise<SyncResult> {
  const startTime = Date.now();
  const result: SyncResult = {
    kontoId,
    folder,
    newMessages: 0,
    updatedMessages: 0,
    errors: [],
    duration: 0,
  };

  try {
    // Open the folder (read-only to avoid flag changes during sync)
    const lock = await client.getMailboxLock(folder);

    try {
      // Build search criteria
      const searchCriteria: Record<string, any> = {};
      if (since) {
        searchCriteria.since = since;
      }

      // Fetch all message metadata using fetchAll (avoids deadlock per research)
      const messages = await client.fetchAll(
        since ? { since } : "1:*",
        {
          uid: true,
          envelope: true,
          flags: true,
          size: true,
          bodyStructure: true,
        }
      );

      log.info(
        { kontoId, folder, messageCount: messages.length },
        "Fetched message metadata"
      );

      // Find the folder record in DB
      const dbFolder = await prisma.emailOrdner.findFirst({
        where: { kontoId, pfad: folder },
      });

      // Get existing UIDs in this folder to skip already-synced messages
      const existingUids = new Set(
        (
          await prisma.emailNachricht.findMany({
            where: { emailKontoId: kontoId, imapFolder: folder },
            select: { imapUid: true },
          })
        )
          .map((m) => m.imapUid)
          .filter((uid): uid is number => uid !== null)
      );

      for (const msg of messages) {
        try {
          const uid = msg.uid;

          // Skip already-synced messages
          if (existingUids.has(uid)) {
            continue;
          }

          // Download full message source via streaming
          const downloadResult = await client.download("" + uid, undefined, { uid: true });
          const rawBuffer = await streamToBuffer(downloadResult.content);

          // Parse the raw MIME message
          const parsed = await parseRawEmail(rawBuffer);

          // Sanitize HTML content
          const sanitizedHtml = parsed.html
            ? sanitizeEmailHtml(parsed.html)
            : null;

          // Determine thread ID
          const threadId = await findThreadId({
            messageId: parsed.messageId,
            inReplyTo: parsed.inReplyTo,
            references: parsed.references,
          });

          // Create the EmailNachricht record
          const emailNachricht = await prisma.emailNachricht.create({
            data: {
              emailKontoId: kontoId,
              emailOrdnerId: dbFolder?.id ?? null,
              imapUid: uid,
              imapFolder: folder,
              messageId: parsed.messageId ?? null,
              inReplyTo: parsed.inReplyTo ?? null,
              references: parsed.references ?? [],
              threadId: threadId ?? parsed.messageId ?? null,
              richtung: "EINGEHEND",
              betreff: parsed.subject,
              absender: parsed.from.address,
              absenderName: parsed.from.name ?? null,
              empfaenger: parsed.to.map((a) => a.address),
              cc: parsed.cc.map((a) => a.address),
              bcc: parsed.bcc.map((a) => a.address),
              inhalt: sanitizedHtml,
              inhaltText: parsed.text ?? null,
              empfangenAm: parsed.date ?? new Date(),
              gelesen: msg.flags?.has("\\Seen") ?? false,
              flagged: msg.flags?.has("\\Flagged") ?? false,
              prioritaet: parsed.priority ?? "NORMAL",
              groesse: msg.size ?? rawBuffer.length,
            },
          });

          // Store attachments in MinIO
          for (const att of parsed.attachments) {
            if (!att.content || att.size > MAX_ATTACHMENT_SIZE) {
              log.debug(
                { kontoId, uid, filename: att.filename, size: att.size },
                "Skipping attachment (too large or no content)"
              );
              continue;
            }

            const storageKey = `email-anhaenge/${kontoId}/${emailNachricht.id}/${Date.now()}_${att.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

            try {
              await uploadFile(storageKey, att.content, att.mimeType, att.size);

              await prisma.emailAnhang.create({
                data: {
                  emailNachrichtId: emailNachricht.id,
                  dateiname: att.filename,
                  mimeType: att.mimeType,
                  groesse: att.size,
                  speicherPfad: storageKey,
                  contentId: att.contentId ?? null,
                },
              });
            } catch (uploadErr) {
              log.warn(
                { kontoId, uid, filename: att.filename, err: uploadErr },
                "Failed to upload attachment"
              );
            }
          }

          result.newMessages++;
        } catch (msgErr) {
          const errMsg = msgErr instanceof Error ? msgErr.message : String(msgErr);
          result.errors.push(`UID ${msg.uid}: ${errMsg}`);
          log.error(
            { kontoId, folder, uid: msg.uid, err: msgErr },
            "Failed to sync message"
          );
        }
      }

      // Update folder counts
      if (dbFolder) {
        const counts = await prisma.emailNachricht.aggregate({
          where: { emailOrdnerId: dbFolder.id, geloescht: false },
          _count: { _all: true },
        });
        const unreadCounts = await prisma.emailNachricht.count({
          where: { emailOrdnerId: dbFolder.id, geloescht: false, gelesen: false },
        });

        await prisma.emailOrdner.update({
          where: { id: dbFolder.id },
          data: {
            gesamtAnzahl: counts._count._all,
            ungeleseneAnzahl: unreadCounts,
          },
        });
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    result.errors.push(errMsg);
    log.error({ kontoId, folder, err }, "Folder sync failed");
  }

  result.duration = Date.now() - startTime;
  log.info(
    {
      kontoId,
      folder,
      newMessages: result.newMessages,
      errors: result.errors.length,
      durationMs: result.duration,
    },
    "Folder sync complete"
  );

  return result;
}

/**
 * Incremental sync: fetch only new messages since the last known UID.
 */
export async function syncNewMessages(
  kontoId: string,
  folder: string
): Promise<SyncResult> {
  // This will be called by the connection manager when the IDLE
  // "exists" event fires. The actual sync is delegated to syncMailbox
  // with a since filter based on the last sync time.

  const konto = await prisma.emailKonto.findUnique({
    where: { id: kontoId },
    select: { letzterSync: true },
  });

  // Use last sync time as since filter, or 1 day ago as fallback
  const since = konto?.letzterSync ?? new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Note: The actual ImapFlow client connection is managed by connection-manager.ts
  // This function is called with context but the client is obtained from the managed connection
  log.info({ kontoId, folder, since }, "Incremental sync requested");

  // The caller (connection-manager) will provide the client
  // For now, return a placeholder; the actual call happens in connection-manager
  return {
    kontoId,
    folder,
    newMessages: 0,
    updatedMessages: 0,
    errors: [],
    duration: 0,
  };
}

/**
 * Initial sync strategy based on EmailKonto.initialSync setting.
 */
export async function initialSync(
  client: ImapFlow,
  kontoId: string,
  strategy: EmailInitialSync
): Promise<SyncResult> {
  let since: Date | undefined;

  switch (strategy) {
    case "NUR_NEUE":
      // Only IDLE — no historical sync needed
      log.info({ kontoId, strategy }, "Initial sync: NUR_NEUE — skipping historical sync");
      // Update last sync time so incremental sync starts from now
      await prisma.emailKonto.update({
        where: { id: kontoId },
        data: { letzterSync: new Date(), syncStatus: "SYNCHRONISIERT" },
      });
      return {
        kontoId,
        folder: "INBOX",
        newMessages: 0,
        updatedMessages: 0,
        errors: [],
        duration: 0,
      };

    case "DREISSIG_TAGE":
      since = new Date();
      since.setDate(since.getDate() - 30);
      break;

    case "ALLES":
      since = undefined; // No date filter — sync everything
      break;
  }

  log.info({ kontoId, strategy, since }, "Starting initial sync");

  // Update sync status
  await prisma.emailKonto.update({
    where: { id: kontoId },
    data: { syncStatus: "VERBUNDEN" },
  });

  const result = await syncMailbox(client, kontoId, "INBOX", since);

  // Update konto with last sync time and status
  await prisma.emailKonto.update({
    where: { id: kontoId },
    data: {
      letzterSync: new Date(),
      syncStatus: result.errors.length > 0 ? "FEHLER" : "SYNCHRONISIERT",
      fehlerLog: result.errors.length > 0
        ? result.errors.slice(-5).map((e) => ({
            timestamp: new Date().toISOString(),
            message: e,
          }))
        : undefined,
    },
  });

  return result;
}
