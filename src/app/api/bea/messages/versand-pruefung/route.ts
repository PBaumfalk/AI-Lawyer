import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { UserRole } from "@prisma/client";
import { requirePermission } from "@/lib/rbac";
import { resolveEmailAnhaenge } from "@/lib/email/anhaenge";
import type { BeaVersandPruefungRequest, BeaVersandPruefungResponse } from "@/lib/bea/versand";

const schema: z.ZodType<BeaVersandPruefungRequest> = z.object({
  dokumentIds: z.array(z.string().min(1)).max(100),
});

/**
 * POST /api/bea/messages/versand-pruefung — pre-flight before a beA send.
 * Checks Akte access and the Versand-Gate (FREIGEGEBEN) for the documents
 * BEFORE bea.expert transmits anything, so a send is never performed that
 * could not be recorded afterwards.
 */
export async function POST(request: NextRequest) {
  const result = await requirePermission("canSendBeA");
  if (result.error) return result.error;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validierungsfehler", details: parsed.error.flatten() }, { status: 400 });
  }

  const user = { id: result.session!.user.id, role: result.session!.user.role as UserRole };
  const check = await resolveEmailAnhaenge(
    user,
    parsed.data.dokumentIds.map((dokumentId) => ({ quelle: "dms" as const, dokumentId }))
  );
  const response: BeaVersandPruefungResponse = check.ok
    ? { ok: true, errors: [] }
    : {
        ok: false,
        errors: Array.isArray(check.details)
          ? (check.details as BeaVersandPruefungResponse["errors"])
          : [{ dokumentId: "", name: "", status: String(check.status), reason: check.error }],
      };
  return NextResponse.json(response, { status: check.ok ? 200 : 400 });
}
