import { NextRequest, NextResponse } from "next/server";
import { requireAuth, buildAkteAccessFilter } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { undoAcceptDraft } from "@/lib/helena/draft-service";
import { z } from "zod";

// ---------------------------------------------------------------------------
// POST /api/helena/drafts/[id]/undo -- revert an accepted draft within 5s
// ---------------------------------------------------------------------------

const UndoSchema = z.object({
  createdId: z.string().min(1),
  typ: z.enum(["DOKUMENT", "FRIST", "NOTIZ", "ALERT"]),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // 1. Auth check
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  // 2. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltige Eingabe" },
      { status: 400 },
    );
  }

  const parsed = UndoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungueltige Eingabe", details: parsed.error.errors },
      { status: 400 },
    );
  }

  // 3. Verify draft exists and user has Akte access
  const draft = await prisma.helenaDraft.findUnique({
    where: { id },
    select: { akteId: true, status: true, undoExpiresAt: true },
  });

  if (!draft) {
    return NextResponse.json(
      { error: "Draft nicht gefunden" },
      { status: 404 },
    );
  }

  const akteFilter = buildAkteAccessFilter(
    session.user.id,
    session.user.role,
  );
  const akteAccess = await prisma.akte.findFirst({
    where: { id: draft.akteId, ...akteFilter },
    select: { id: true },
  });

  if (!akteAccess) {
    return NextResponse.json(
      { error: "Draft nicht gefunden" },
      { status: 404 },
    );
  }

  // 4. Execute undo
  try {
    await undoAcceptDraft(
      id,
      parsed.data.createdId,
      parsed.data.typ,
      session.user.id,
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);

    if (errMsg.includes("Undo-Fenster abgelaufen")) {
      return NextResponse.json(
        { error: "Undo-Fenster abgelaufen (5 Sekunden)" },
        { status: 409 },
      );
    }

    if (errMsg.includes("erwartet ACCEPTED")) {
      return NextResponse.json(
        { error: errMsg },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Interner Fehler", details: errMsg },
      { status: 500 },
    );
  }
}
