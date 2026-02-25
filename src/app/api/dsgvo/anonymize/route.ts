import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { anonymizeKontakt } from "@/lib/dsgvo/anonymize";

/**
 * POST /api/dsgvo/anonymize - Anonymize a Kontakt's personal data.
 * ADMIN only. Supports dry-run mode.
 *
 * Body: { kontaktId, grund, dryRun?, forceOverrideRetention? }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const body = await request.json();
  const { kontaktId, grund, dryRun, forceOverrideRetention } = body;

  if (!kontaktId) {
    return NextResponse.json({ error: "kontaktId ist erforderlich" }, { status: 400 });
  }
  if (!dryRun && !grund) {
    return NextResponse.json({ error: "Grund ist erforderlich" }, { status: 400 });
  }

  const result = await anonymizeKontakt(kontaktId, session.user.id, grund ?? "", {
    dryRun: !!dryRun,
    forceOverrideRetention: !!forceOverrideRetention,
  });

  if (!result.success) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
