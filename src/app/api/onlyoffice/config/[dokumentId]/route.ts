import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildEditorConfig, resolvePublicOnlyOfficeUrl } from "@/lib/onlyoffice";

/**
 * GET /api/onlyoffice/config/[dokumentId] -- returns ONLYOFFICE editor configuration.
 * Query params: ?mode=edit|view (default: edit)
 *
 * Uses stable document key (version-based) for co-editing support.
 * Enforces Schreibschutz: If document status is FREIGEGEBEN or VERSENDET,
 * always returns view-mode config regardless of requested mode.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dokumentId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const { dokumentId } = await params;
  const { searchParams } = new URL(request.url);
  const mode = (searchParams.get("mode") ?? "edit") as "edit" | "view";

  const dokument = await prisma.dokument.findUnique({
    where: { id: dokumentId },
  });

  if (!dokument) {
    return NextResponse.json(
      { error: "Dokument nicht gefunden" },
      { status: 404 }
    );
  }

  try {
    const config = buildEditorConfig({
      dokumentId: dokument.id,
      fileName: dokument.name,
      mimeType: dokument.mimeType,
      userId: session.user.id!,
      userName: session.user.name ?? "Unbekannt",
      version: dokument.version,
      dokumentStatus: dokument.status,
      mode,
    });

    const onlyofficeUrl = resolvePublicOnlyOfficeUrl(request.headers);

    console.log(
      `[ONLYOFFICE] Config for ${dokument.name}: key=${config.document.key}, mode=${config.editorConfig.mode}, status=${dokument.status}, url=${onlyofficeUrl}`
    );

    return NextResponse.json({
      config,
      onlyofficeUrl,
      dokumentStatus: dokument.status,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Fehler beim Erstellen der Editor-Konfiguration";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
