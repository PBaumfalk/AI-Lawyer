import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateAuskunftPdf } from "@/lib/dsgvo/auskunft";
import { logAuditEvent } from "@/lib/audit";

/**
 * GET /api/dsgvo/auskunft?kontaktId=xxx - Generate Auskunftsrecht PDF for a Kontakt.
 * ADMIN only.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const kontaktId = searchParams.get("kontaktId");

  if (!kontaktId) {
    return NextResponse.json({ error: "kontaktId ist erforderlich" }, { status: 400 });
  }

  try {
    const pdfBuffer = await generateAuskunftPdf(kontaktId);

    // Log the export
    await logAuditEvent({
      userId: session.user.id,
      aktion: "DSGVO_AUSKUNFT_EXPORTIERT",
      details: { kontaktId },
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="datenauskunft-${kontaktId}.pdf"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
