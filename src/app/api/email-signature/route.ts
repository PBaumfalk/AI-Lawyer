import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSignatureForUser } from "@/lib/email/signature";

/**
 * GET /api/email-signature?kontoId=
 *
 * Returns the rendered email signature HTML for the authenticated user
 * and the specified email account (kontoId). The signature template
 * is stored on the EmailKonto and rendered with user profile data.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const kontoId = req.nextUrl.searchParams.get("kontoId");
  if (!kontoId) {
    return NextResponse.json(
      { error: "kontoId Parameter fehlt" },
      { status: 400 }
    );
  }

  try {
    const signature = await getSignatureForUser(session.user.id, kontoId);
    return NextResponse.json({ signature });
  } catch (err) {
    console.error("[email-signature] Error:", err);
    return NextResponse.json(
      { error: "Fehler beim Laden der Signatur" },
      { status: 500 }
    );
  }
}
