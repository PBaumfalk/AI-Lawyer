/**
 * Shop Service
 *
 * Purchase, equip/unequip, and perk activation logic.
 * All mutating operations use $transaction for atomicity.
 */

import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { getLevelForXp } from "./game-profile-service";
import { LEGENDARY_LEVEL_GATE } from "./types";

const log = createLogger("shop-service");

// ─── Purchase ────────────────────────────────────────────────────────────────

/**
 * Purchase a shop item. Atomic Runen deduction inside $transaction.
 * Validates: item exists + aktiv, profile exists, level gate for LEGENDARY, sufficient Runen.
 */
export async function purchaseItem(userId: string, shopItemId: string) {
  return prisma.$transaction(async (tx) => {
    // 1. Validate item
    const item = await tx.shopItem.findUnique({ where: { id: shopItemId } });
    if (!item || !item.aktiv) {
      throw new Error("Item nicht verfuegbar");
    }

    // 2. Validate profile
    const profile = await tx.userGameProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new Error("Kein GameProfile");
    }

    // 3. Level gate for LEGENDARY
    if (item.rarity === "LEGENDARY") {
      const level = getLevelForXp(profile.xp);
      if (level < LEGENDARY_LEVEL_GATE) {
        throw new Error("Level 25 erforderlich");
      }
    }

    // 4. Balance check
    if (profile.runen < item.preis) {
      throw new Error("Nicht genuegend Runen");
    }

    // 5. Atomic decrement
    await tx.userGameProfile.update({
      where: { userId },
      data: { runen: { decrement: item.preis } },
    });

    // 6. Create inventory entry
    const inventoryItem = await tx.userInventoryItem.create({
      data: { userId, shopItemId: item.id },
    });

    log.info({ userId, shopItemId, preis: item.preis }, "Item purchased");
    return inventoryItem;
  });
}

// ─── Equip / Unequip ─────────────────────────────────────────────────────────

/**
 * Equip an inventory item. Unequips all same-type items first (one-active-per-type).
 * Perks and consumed items cannot be equipped.
 */
export async function equipItem(userId: string, inventoryItemId: string) {
  return prisma.$transaction(async (tx) => {
    // 1. Validate inventory item ownership
    const invItem = await tx.userInventoryItem.findUnique({
      where: { id: inventoryItemId },
      include: { shopItem: true },
    });
    if (!invItem || invItem.userId !== userId) {
      throw new Error("Nicht gefunden");
    }

    // 2. Perks cannot be equipped
    if (invItem.shopItem.typ === "PERK") {
      throw new Error("Perks koennen nicht ausgeruestet werden");
    }

    // 3. Consumed items cannot be equipped
    if (invItem.verbraucht) {
      throw new Error("Bereits verbraucht");
    }

    // 4. Unequip all same-type items for this user
    await tx.userInventoryItem.updateMany({
      where: {
        userId,
        ausgeruestet: true,
        shopItem: { typ: invItem.shopItem.typ },
      },
      data: { ausgeruestet: false },
    });

    // 5. Equip the new item
    const updated = await tx.userInventoryItem.update({
      where: { id: inventoryItemId },
      data: { ausgeruestet: true },
      include: { shopItem: true },
    });

    return updated;
  });
}

/**
 * Unequip an inventory item.
 */
export async function unequipItem(userId: string, inventoryItemId: string) {
  const invItem = await prisma.userInventoryItem.findUnique({
    where: { id: inventoryItemId },
  });
  if (!invItem || invItem.userId !== userId) {
    throw new Error("Nicht gefunden");
  }

  return prisma.userInventoryItem.update({
    where: { id: inventoryItemId },
    data: { ausgeruestet: false },
  });
}

// ─── Perk Activation ─────────────────────────────────────────────────────────

/**
 * Activate a perk item. Marks as consumed and executes perk effect.
 * - fokus-siegel: Creates a FOKUSZEIT KalenderEintrag (30 min)
 * - streak-schutz: Marks consumed (streak calc checks inventory)
 * - doppel-runen: Marks consumed with activatedAt (quest-service checks window)
 */
export async function activatePerk(userId: string, inventoryItemId: string) {
  return prisma.$transaction(async (tx) => {
    // 1. Validate
    const invItem = await tx.userInventoryItem.findUnique({
      where: { id: inventoryItemId },
      include: { shopItem: true },
    });
    if (!invItem || invItem.userId !== userId) {
      throw new Error("Nicht gefunden");
    }

    // 2. Must be a perk
    if (invItem.shopItem.typ !== "PERK") {
      throw new Error("Kein Perk");
    }

    // 3. Must not be consumed
    if (invItem.verbraucht) {
      throw new Error("Bereits verbraucht");
    }

    const now = new Date();

    // 4. Mark consumed
    const updated = await tx.userInventoryItem.update({
      where: { id: inventoryItemId },
      data: { verbraucht: true, activatedAt: now },
      include: { shopItem: true },
    });

    // 5. Execute perk effect
    const perkType = (invItem.shopItem.metadata as Record<string, unknown>)
      .perkType as string;

    switch (perkType) {
      case "fokus-siegel": {
        const durationMinutes =
          ((invItem.shopItem.metadata as Record<string, unknown>)
            .durationMinutes as number) ?? 30;
        await tx.kalenderEintrag.create({
          data: {
            typ: "FOKUSZEIT",
            titel: "Fokus-Siegel aktiv",
            beschreibung: "30 Minuten Fokuszeit",
            datum: now,
            datumBis: new Date(now.getTime() + durationMinutes * 60 * 1000),
            verantwortlichId: userId,
          },
        });
        break;
      }
      case "streak-schutz": {
        // Tracked by consumed UserInventoryItem with perkType "streak-schutz"
        // Streak calculation checks for active streak-schutz in inventory
        log.info({ userId }, "Streak-Schutz activated");
        break;
      }
      case "doppel-runen": {
        // Tracked by consumed UserInventoryItem with activatedAt timestamp
        // Quest-service checks for active doppel-runen (activatedAt within 2h)
        log.info({ userId }, "Doppel-Runen activated");
        break;
      }
      default:
        log.warn({ userId, perkType }, "Unknown perk type activated");
    }

    log.info({ userId, inventoryItemId, perkType }, "Perk activated");
    return updated;
  });
}
