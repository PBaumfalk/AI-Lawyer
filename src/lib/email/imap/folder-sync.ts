/**
 * IMAP folder synchronization: mirrors IMAP folder structure to EmailOrdner in the database.
 * Detects special folders (INBOX, Sent, Drafts, Trash, Junk, Archive) by SPECIAL-USE flags and name patterns.
 */

import type { ImapFlow } from "imapflow";
import type { EmailSpezialTyp } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";

const log = createLogger("imap:folders");

/** Map of SPECIAL-USE flags to our SpezialTyp enum */
const SPECIAL_USE_MAP: Record<string, EmailSpezialTyp> = {
  "\\Inbox": "INBOX",
  "\\Sent": "SENT",
  "\\Drafts": "DRAFTS",
  "\\Trash": "TRASH",
  "\\Junk": "JUNK",
  "\\Archive": "ARCHIVE",
  "\\All": "ARCHIVE", // Gmail uses \All for Archive
};

/** Fallback name patterns for detecting special folders (case-insensitive) */
const NAME_PATTERNS: Record<string, EmailSpezialTyp> = {
  inbox: "INBOX",
  sent: "SENT",
  "sent items": "SENT",
  "sent messages": "SENT",
  gesendet: "SENT",
  "gesendete objekte": "SENT",
  "gesendete elemente": "SENT",
  drafts: "DRAFTS",
  draft: "DRAFTS",
  "entwürfe": "DRAFTS",
  entwuerfe: "DRAFTS",
  trash: "TRASH",
  "deleted items": "TRASH",
  "deleted messages": "TRASH",
  papierkorb: "TRASH",
  "gelöschte objekte": "TRASH",
  "gelöschte elemente": "TRASH",
  junk: "JUNK",
  "junk e-mail": "JUNK",
  spam: "JUNK",
  archive: "ARCHIVE",
  archiv: "ARCHIVE",
  "all mail": "ARCHIVE",
};

/**
 * Detect the special type of a folder from SPECIAL-USE flags and name.
 */
function detectSpezialTyp(
  path: string,
  name: string,
  specialUse?: string
): EmailSpezialTyp {
  // 1. Check SPECIAL-USE flag
  if (specialUse && SPECIAL_USE_MAP[specialUse]) {
    return SPECIAL_USE_MAP[specialUse];
  }

  // 2. Check INBOX by path (always "INBOX" regardless of locale)
  if (path.toUpperCase() === "INBOX") {
    return "INBOX";
  }

  // 3. Check name patterns
  const lowerName = name.toLowerCase();
  if (NAME_PATTERNS[lowerName]) {
    return NAME_PATTERNS[lowerName];
  }

  return "CUSTOM";
}

/** Sorting priority for special folder types */
const SORT_ORDER: Record<EmailSpezialTyp, number> = {
  INBOX: 0,
  SENT: 1,
  DRAFTS: 2,
  ARCHIVE: 3,
  JUNK: 4,
  TRASH: 5,
  CUSTOM: 10,
};

/**
 * Synchronize IMAP folders to the database for a given mailbox.
 * Creates new folders, updates existing ones, marks deleted ones.
 *
 * @param client - Connected ImapFlow instance
 * @param kontoId - EmailKonto ID
 */
export async function syncFolders(
  client: ImapFlow,
  kontoId: string
): Promise<void> {
  log.info({ kontoId }, "Starting folder sync");

  // List all mailboxes from IMAP
  const tree = await client.list();

  // Get existing folders from DB
  const existing = await prisma.emailOrdner.findMany({
    where: { kontoId },
  });
  const existingByPath = new Map(existing.map((f) => [f.pfad, f]));

  const seenPaths = new Set<string>();

  for (const mailbox of tree) {
    const path = mailbox.path;
    const name = mailbox.name;
    const specialUse = (mailbox as any).specialUse as string | undefined;
    const spezialTyp = detectSpezialTyp(path, name, specialUse);
    const sortierung = SORT_ORDER[spezialTyp] ?? 10;

    seenPaths.add(path);

    const existingFolder = existingByPath.get(path);

    if (existingFolder) {
      // Update existing folder
      await prisma.emailOrdner.update({
        where: { id: existingFolder.id },
        data: { name, spezialTyp, sortierung },
      });
    } else {
      // Create new folder
      await prisma.emailOrdner.create({
        data: {
          kontoId,
          name,
          pfad: path,
          spezialTyp,
          sortierung,
          ungeleseneAnzahl: 0,
          gesamtAnzahl: 0,
        },
      });
    }
  }

  // Remove folders that no longer exist on IMAP (skip if they have messages)
  for (const folder of existing) {
    if (!seenPaths.has(folder.pfad)) {
      const messageCount = await prisma.emailNachricht.count({
        where: { emailOrdnerId: folder.id },
      });

      if (messageCount === 0) {
        await prisma.emailOrdner.delete({ where: { id: folder.id } });
        log.info({ kontoId, path: folder.pfad }, "Removed orphaned folder");
      }
    }
  }

  log.info({ kontoId, folderCount: seenPaths.size }, "Folder sync complete");
}

/**
 * Create a new folder on the IMAP server and in the database.
 */
export async function createImapFolder(
  client: ImapFlow,
  kontoId: string,
  path: string
): Promise<string> {
  await client.mailboxCreate(path);

  const folder = await prisma.emailOrdner.create({
    data: {
      kontoId,
      name: path.split("/").pop() ?? path,
      pfad: path,
      spezialTyp: "CUSTOM",
      sortierung: 10,
      ungeleseneAnzahl: 0,
      gesamtAnzahl: 0,
    },
  });

  log.info({ kontoId, path }, "Created IMAP folder");
  return folder.id;
}

/**
 * Rename a folder on the IMAP server and in the database.
 */
export async function renameImapFolder(
  client: ImapFlow,
  kontoId: string,
  oldPath: string,
  newPath: string
): Promise<void> {
  await client.mailboxRename(oldPath, newPath);

  await prisma.emailOrdner.updateMany({
    where: { kontoId, pfad: oldPath },
    data: {
      pfad: newPath,
      name: newPath.split("/").pop() ?? newPath,
    },
  });

  log.info({ kontoId, oldPath, newPath }, "Renamed IMAP folder");
}

/**
 * Delete a folder on the IMAP server and in the database.
 */
export async function deleteImapFolder(
  client: ImapFlow,
  kontoId: string,
  path: string
): Promise<void> {
  await client.mailboxDelete(path);

  await prisma.emailOrdner.deleteMany({
    where: { kontoId, pfad: path },
  });

  log.info({ kontoId, path }, "Deleted IMAP folder");
}
