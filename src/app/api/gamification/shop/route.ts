/**
 * GET /api/gamification/shop -- Catalog + inventory + balance
 * POST /api/gamification/shop -- Purchase an item
 *
 * Auth + opt-in guard follows dashboard route pattern.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getOrCreateGameProfile,
  getLevelForXp,
} from "@/lib/gamification/game-profile-service";
import { purchaseItem } from "@/lib/gamification/shop-service";

const purchaseSchema = z.object({
  shopItemId: z.string().min(1),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 },
    );
  }

  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { gamificationOptIn: true, role: true },
  });

  if (!user?.gamificationOptIn) {
    return NextResponse.json(
      { error: "Gamification nicht aktiviert" },
      { status: 404 },
    );
  }

  const profile = await getOrCreateGameProfile(userId, user.role);
  const level = getLevelForXp(profile.xp);

  const [items, inventory] = await Promise.all([
    prisma.shopItem.findMany({
      where: { aktiv: true },
      orderBy: [{ rarity: "asc" }, { typ: "asc" }, { sortierung: "asc" }],
    }),
    prisma.userInventoryItem.findMany({
      where: { userId },
      include: { shopItem: true },
    }),
  ]);

  return NextResponse.json({ runen: profile.runen, level, items, inventory });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 },
    );
  }

  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { gamificationOptIn: true },
  });

  if (!user?.gamificationOptIn) {
    return NextResponse.json(
      { error: "Gamification nicht aktiviert" },
      { status: 404 },
    );
  }

  try {
    const body = await request.json();
    const { shopItemId } = purchaseSchema.parse(body);

    const inventoryItem = await purchaseItem(userId, shopItemId);
    return NextResponse.json({ success: true, inventoryItem });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler";

    // Known business errors
    const businessErrors = [
      "Item nicht verfuegbar",
      "Kein GameProfile",
      "Level 25 erforderlich",
      "Nicht genuegend Runen",
    ];

    if (businessErrors.includes(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Zod validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Ungueltige Eingabe" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Interner Fehler" },
      { status: 500 },
    );
  }
}
