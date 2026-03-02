import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  completionId: z.string().min(1),
  decision: z.enum(["CONFIRMED", "DECLINED"]),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validierungsfehler" }, { status: 400 });
  }

  const { completionId, decision } = parsed.data;

  // Find completion and verify ownership
  const completion = await prisma.questCompletion.findUnique({
    where: { id: completionId },
  });

  if (!completion || completion.userId !== session.user.id) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  if (completion.auditStatus !== "PENDING") {
    return NextResponse.json({ message: "Bereits verarbeitet" });
  }

  if (decision === "CONFIRMED") {
    // Credit the pending rewards atomically
    await prisma.$transaction(async (tx) => {
      await tx.userGameProfile.update({
        where: { userId: completion.userId },
        data: {
          xp: { increment: completion.pendingXp },
          runen: { increment: completion.pendingRunen },
        },
      });
      await tx.questCompletion.update({
        where: { id: completionId },
        data: {
          auditStatus: "CONFIRMED",
          xpVerdient: completion.pendingXp,
          runenVerdient: completion.pendingRunen,
        },
      });
    });
  } else {
    // DECLINED: no rewards, mark as declined
    await prisma.questCompletion.update({
      where: { id: completionId },
      data: { auditStatus: "DECLINED" },
    });
  }

  return NextResponse.json({ ok: true });
}
