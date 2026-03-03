/**
 * PATCH /api/gamification/shop/equip -- Toggle equip/unequip
 *
 * Auth + opt-in guard follows dashboard route pattern.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { equipItem, unequipItem } from "@/lib/gamification/shop-service";

const equipSchema = z.object({
  inventoryItemId: z.string().min(1),
  equip: z.boolean(),
});

export async function PATCH(request: Request) {
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
    const { inventoryItemId, equip } = equipSchema.parse(body);

    const item = equip
      ? await equipItem(userId, inventoryItemId)
      : await unequipItem(userId, inventoryItemId);

    return NextResponse.json({ success: true, item });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Fehler";

    const businessErrors = [
      "Nicht gefunden",
      "Perks koennen nicht ausgeruestet werden",
      "Bereits verbraucht",
    ];

    if (businessErrors.includes(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

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
