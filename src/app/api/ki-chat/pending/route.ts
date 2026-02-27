/**
 * GET/DELETE /api/ki-chat/pending
 *
 * GET: Check for pending Schriftsatz Rueckfrage for current user + Akte.
 * Returns the pending state if one exists (for proactive reminder).
 *
 * DELETE: Dismiss (Verwerfen) a pending Rueckfrage.
 * Silently clears the pending state.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  loadPendingPipeline,
  clearPendingPipeline,
  MAX_ROUNDS,
} from "@/lib/helena/schriftsatz/pending-pipeline";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 },
    );
  }

  const akteId = req.nextUrl.searchParams.get("akteId");
  if (!akteId) {
    return NextResponse.json({ pending: null });
  }

  const pending = await loadPendingPipeline(session.user.id, akteId);

  if (!pending) {
    return NextResponse.json({ pending: null });
  }

  // Return state for frontend display -- filter out unfilled/placeholder slots
  const filledSlots = Object.entries(pending.slotState)
    .filter(
      ([, v]) =>
        v !== null &&
        !(typeof v === "string" && String(v).startsWith("{{")),
    )
    .reduce(
      (acc, [k, v]) => ({ ...acc, [k]: v }),
      {} as Record<string, unknown>,
    );

  return NextResponse.json({
    pending: {
      rueckfrage: pending.rueckfrage,
      round: pending.round,
      maxRounds: MAX_ROUNDS,
      filledSlots,
      expiresAt: pending.expiresAt.toISOString(),
    },
  });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 },
    );
  }

  const akteId = req.nextUrl.searchParams.get("akteId");
  if (!akteId) {
    return NextResponse.json({ ok: true });
  }

  await clearPendingPipeline(session.user.id, akteId);

  return NextResponse.json({ ok: true });
}
