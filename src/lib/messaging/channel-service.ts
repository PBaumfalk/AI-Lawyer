/**
 * Channel service -- CRUD operations, membership management, and seed function.
 *
 * All business logic for channels lives here. API routes call these functions
 * and remain thin.
 */

import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { getSetting, updateSetting } from "@/lib/settings/service";
import type { Channel } from "@prisma/client";

const log = createLogger("messaging:channel");

// Type alias for Prisma interactive transactions (compatible with extended client)
type PrismaTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const SEED_VERSION = "v0.3";
const SEED_SETTING_KEY = "messaging.channels_seed_version";

/**
 * Generate a URL-safe slug from a channel name.
 *
 * Replaces German umlauts, lowercases, strips non-alphanumeric characters,
 * and collapses multiple hyphens.
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\u00e4/g, "ae")
    .replace(/\u00f6/g, "oe")
    .replace(/\u00fc/g, "ue")
    .replace(/\u00df/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Create a new ALLGEMEIN channel with the creator auto-added as a member.
 *
 * Returns 409-style error if slug already exists.
 * Only for ALLGEMEIN channels -- AKTE channels are created via lazy creation.
 */
export async function createChannel(params: {
  name: string;
  beschreibung?: string;
  erstelltVonId: string;
  typ?: "ALLGEMEIN";
}): Promise<{ channel?: Channel; error?: string; status?: number }> {
  const { name, beschreibung, erstelltVonId, typ = "ALLGEMEIN" } = params;
  const slug = generateSlug(name);

  // Check slug uniqueness
  const existing = await prisma.channel.findUnique({ where: { slug } });
  if (existing) {
    return { error: "Ein Kanal mit diesem Namen existiert bereits", status: 409 };
  }

  // Create channel + auto-add creator as member in a transaction
  const channel = await prisma.$transaction(async (tx) => {
    const ch = await tx.channel.create({
      data: {
        name,
        slug,
        beschreibung,
        typ,
        erstelltVonId,
      },
    });

    await tx.channelMember.create({
      data: {
        channelId: ch.id,
        userId: erstelltVonId,
      },
    });

    return ch;
  });

  return { channel };
}

/**
 * Seed default channels (#allgemein, #organisation) on worker startup.
 *
 * Follows the seedFalldatenTemplates guard pattern:
 * - Check SystemSetting for seed version
 * - Skip if already seeded at current version
 * - Find ADMIN user as creator
 * - Auto-join ALL active users
 */
export async function seedDefaultChannels(): Promise<void> {
  const currentVersion = await getSetting(SEED_SETTING_KEY);
  if (currentVersion === SEED_VERSION) {
    log.debug("Default channels already seeded (version %s)", SEED_VERSION);
    return;
  }

  log.info("Seeding default channels (version %s)...", SEED_VERSION);

  // Find system user or first ADMIN as creator
  const creator = await prisma.user.findFirst({
    where: { isSystem: true, aktiv: true },
  });
  const adminUser = creator ?? await prisma.user.findFirst({
    where: { role: "ADMIN", aktiv: true },
  });
  if (!adminUser) {
    throw new Error("No active ADMIN or system user found -- cannot seed channels");
  }

  const defaults = [
    { name: "Allgemein", slug: "allgemein", beschreibung: "Allgemeiner Kanzlei-Kanal" },
    { name: "Organisation", slug: "organisation", beschreibung: "Organisatorisches und Verwaltung" },
  ];

  // Get all active users for auto-join
  const allUsers = await prisma.user.findMany({
    where: { aktiv: true },
    select: { id: true },
  });

  for (const ch of defaults) {
    const existing = await prisma.channel.findUnique({ where: { slug: ch.slug } });
    if (existing) {
      log.debug("Channel #%s already exists, skipping", ch.slug);
      continue;
    }

    const channel = await prisma.channel.create({
      data: {
        name: ch.name,
        slug: ch.slug,
        beschreibung: ch.beschreibung,
        typ: "ALLGEMEIN",
        erstelltVonId: adminUser.id,
      },
    });

    // Auto-join ALL active users
    await prisma.channelMember.createMany({
      data: allUsers.map((u) => ({
        channelId: channel.id,
        userId: u.id,
      })),
      skipDuplicates: true,
    });

    log.info("Seeded channel #%s with %d members", ch.slug, allUsers.length);
  }

  await updateSetting(SEED_SETTING_KEY, SEED_VERSION);
  log.info("Default channels seeded successfully");
}

/**
 * Create or retrieve a PORTAL channel for a specific Mandant+Akte pair.
 *
 * Lazy-creates the channel on first access with both Mandant and Anwalt as members.
 * Handles P2002 race condition for concurrent creation attempts.
 */
export async function createPortalChannel(params: {
  akteId: string;
  mandantUserId: string;
  mandantName: string;
  anwaltUserId: string;
  akteKurzrubrum?: string;
}): Promise<{ channel?: Channel; error?: string; status?: number }> {
  const { akteId, mandantUserId, mandantName, anwaltUserId, akteKurzrubrum } = params;

  // Check for existing PORTAL channel for this Mandant+Akte pair
  const existing = await prisma.channel.findFirst({
    where: { akteId, typ: "PORTAL", mandantUserId },
  });
  if (existing) {
    return { channel: existing };
  }

  const slug = generateSlug(`portal-${akteId.slice(0, 8)}-${mandantUserId.slice(0, 8)}`);
  const channelName = `Portal: ${mandantName}${akteKurzrubrum ? ` - ${akteKurzrubrum}` : ""}`;

  try {
    const channel = await prisma.$transaction(async (tx) => {
      const ch = await tx.channel.create({
        data: {
          name: channelName,
          slug,
          typ: "PORTAL",
          akteId,
          mandantUserId,
          erstelltVonId: mandantUserId,
        },
      });

      // Add both Mandant and Anwalt as channel members
      const memberIds = [mandantUserId, anwaltUserId].filter(Boolean);
      const uniqueIds = Array.from(new Set(memberIds));

      await tx.channelMember.createMany({
        data: uniqueIds.map((userId) => ({
          channelId: ch.id,
          userId,
        })),
        skipDuplicates: true,
      });

      return ch;
    });

    return { channel };
  } catch (err: unknown) {
    // Race condition: P2002 on compound unique (akteId + typ + mandantUserId)
    if (
      typeof err === "object" && err !== null &&
      "code" in err && (err as { code: string }).code === "P2002"
    ) {
      const raceWinner = await prisma.channel.findFirst({
        where: { akteId, typ: "PORTAL", mandantUserId },
      });
      if (raceWinner) {
        return { channel: raceWinner };
      }
    }
    log.error({ err, akteId, mandantUserId }, "Failed to create portal channel");
    return { error: "Kanal konnte nicht erstellt werden", status: 500 };
  }
}

/**
 * Gather unique user IDs that should have membership in an AKTE channel.
 *
 * Collects from: anwaltId, sachbearbeiterId, all Dezernat members for that Akte.
 * Returns a deduplicated array.
 */
export async function gatherAkteMemberIds(
  tx: PrismaTransaction,
  akteId: string
): Promise<string[]> {
  const akte = await tx.akte.findUnique({
    where: { id: akteId },
    select: {
      anwaltId: true,
      sachbearbeiterId: true,
      dezernate: {
        select: {
          mitglieder: {
            select: { id: true },
            where: { aktiv: true },
          },
        },
      },
    },
  });

  if (!akte) return [];

  const memberSet = new Set<string>();

  if (akte.anwaltId) memberSet.add(akte.anwaltId);
  if (akte.sachbearbeiterId) memberSet.add(akte.sachbearbeiterId);

  for (const dezernat of akte.dezernate) {
    for (const mitglied of dezernat.mitglieder) {
      memberSet.add(mitglied.id);
    }
  }

  return Array.from(memberSet);
}

/**
 * Re-sync members for an AKTE channel based on current Akte RBAC.
 *
 * Adds missing ChannelMember rows but does NOT remove existing members
 * (they may have been explicitly added).
 */
export async function syncAkteChannelMembers(
  channelId: string,
  akteId: string
): Promise<void> {
  const memberIds = await prisma.$transaction(async (tx) => {
    return gatherAkteMemberIds(tx, akteId);
  });

  if (memberIds.length === 0) return;

  await prisma.channelMember.createMany({
    data: memberIds.map((userId) => ({
      channelId,
      userId,
    })),
    skipDuplicates: true,
  });
}

/**
 * Get the unread message count for a user in a channel.
 *
 * Counts messages after lastReadAt, excluding:
 * - Own messages (authorId !== userId)
 * - Soft-deleted messages (deletedAt is null)
 *
 * Returns 0 if user is not a member.
 */
export async function getUnreadCount(
  channelId: string,
  userId: string
): Promise<number> {
  const member = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId } },
    select: { lastReadAt: true },
  });
  if (!member) return 0;

  return prisma.message.count({
    where: {
      channelId,
      createdAt: { gt: member.lastReadAt },
      authorId: { not: userId },
      deletedAt: null,
    },
  });
}
