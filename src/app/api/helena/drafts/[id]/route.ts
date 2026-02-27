import { NextRequest, NextResponse } from "next/server";
import { requireAuth, buildAkteAccessFilter } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { acceptDraft, rejectDraft, editDraft } from "@/lib/helena/draft-service";
import { createHelenaTask } from "@/lib/helena/task-service";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Zod schema for PATCH actions
// ---------------------------------------------------------------------------

const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept") }),
  z.object({
    action: z.literal("reject"),
    categories: z.array(z.string()).optional(),
    text: z.string().optional(),
    noRevise: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("edit"),
    titel: z.string().optional(),
    inhalt: z.string().optional(),
    meta: z.record(z.unknown()).optional(),
  }),
]);

// ---------------------------------------------------------------------------
// GET /api/helena/drafts/[id] -- single draft with full detail
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // 1. Auth check
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  // 2. Load draft with relations
  const draft = await prisma.helenaDraft.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true } },
      akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
      parentDraft: {
        select: {
          id: true,
          titel: true,
          status: true,
          feedbackCategories: true,
          feedback: true,
          createdAt: true,
        },
      },
      revisions: {
        select: {
          id: true,
          titel: true,
          status: true,
          revisionCount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      reviewedBy: { select: { id: true, name: true } },
    },
  });

  if (!draft) {
    return NextResponse.json(
      { error: "Draft nicht gefunden" },
      { status: 404 },
    );
  }

  // 3. Verify Akte access
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

  return NextResponse.json({ draft });
}

// ---------------------------------------------------------------------------
// PATCH /api/helena/drafts/[id] -- accept / reject / edit
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // 1. Auth check
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  // 2. RBAC: only ANWALT and SACHBEARBEITER can accept/reject drafts
  const allowedRoles = ["ADMIN", "ANWALT", "SACHBEARBEITER"];
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json(
      { error: "Keine Berechtigung fuer Draft-Aktionen" },
      { status: 403 },
    );
  }

  // 3. Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltige Eingabe" },
      { status: 400 },
    );
  }

  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungueltige Aktion", details: parsed.error.errors },
      { status: 400 },
    );
  }

  // 4. Verify draft exists and user has Akte access
  const draft = await prisma.helenaDraft.findUnique({
    where: { id },
    select: { akteId: true, status: true, revisionCount: true },
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

  // 5. Route to action handler
  const action = parsed.data;

  try {
    switch (action.action) {
      case "accept": {
        const acceptResult = await acceptDraft(id, session.user.id);
        return NextResponse.json(acceptResult);
      }

      case "reject": {
        const rejectResult = await rejectDraft(id, session.user.id, {
          categories: action.categories,
          text: action.text,
          noRevise: action.noRevise,
        });

        // Auto-revise: enqueue new task if revisionCount < 3 and not noRevise
        if (rejectResult.shouldAutoRevise && rejectResult.revisionCount < 3) {
          try {
            // Load original draft for auto-revise context
            const originalDraft = await prisma.helenaDraft.findUnique({
              where: { id },
              select: {
                inhalt: true,
                helenaTaskId: true,
                helenaTask: { select: { auftrag: true } },
              },
            });

            const originalAuftrag =
              originalDraft?.helenaTask?.auftrag ??
              "Ueberarbeite den folgenden Entwurf";

            const feedbackContext = [
              action.categories?.length
                ? `Kategorien: ${action.categories.join(", ")}`
                : "",
              action.text ? `Feedback: ${action.text}` : "",
            ]
              .filter(Boolean)
              .join(". ");

            await createHelenaTask({
              userId: session.user.id,
              userRole: session.user.role,
              userName: session.user.name,
              akteId: rejectResult.akteId,
              auftrag: `[Auto-Revise] ${originalAuftrag}. Ablehnungsgrund: ${feedbackContext}`,
              prioritaet: 7,
              quelle: "auto-revise",
            });
          } catch (err) {
            // Non-blocking: auto-revise failure should not fail the rejection
            const errMsg = err instanceof Error ? err.message : String(err);
            // Log but don't fail -- user can manually trigger revision
            console.warn("Auto-revise enqueue failed:", errMsg);
          }
        }

        return NextResponse.json({
          ...rejectResult,
          autoReviseTriggered:
            rejectResult.shouldAutoRevise && rejectResult.revisionCount < 3,
          revisionCapReached: rejectResult.revisionCount >= 3,
        });
      }

      case "edit": {
        await editDraft(id, session.user.id, {
          titel: action.titel,
          inhalt: action.inhalt,
          meta: action.meta,
        });
        return NextResponse.json({ success: true });
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);

    // Conflict errors (wrong status)
    if (errMsg.includes("erwartet PENDING") || errMsg.includes("erwartet ACCEPTED")) {
      return NextResponse.json({ error: errMsg }, { status: 409 });
    }

    return NextResponse.json(
      { error: "Interner Fehler", details: errMsg },
      { status: 500 },
    );
  }
}
