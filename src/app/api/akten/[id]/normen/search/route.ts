import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAkteAccess } from "@/lib/rbac";

// GET /api/akten/[id]/normen/search?q=... -- ILIKE search on law_chunks for the add-norm modal
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: akteId } = await params;

  const access = await requireAkteAccess(akteId);
  if (access.error) return access.error;

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  // Minimum 2 characters to avoid full-table scans
  if (q.length < 2) {
    return NextResponse.json([]);
  }

  // ILIKE search on gesetzKuerzel, paragraphNr, or titel — safe parameter binding
  const results = await prisma.$queryRaw<
    Array<{
      id: string;
      gesetzKuerzel: string;
      paragraphNr: string;
      titel: string;
      content: string;
      sourceUrl: string | null;
      syncedAt: Date;
    }>
  >`
    SELECT id, "gesetzKuerzel", "paragraphNr", titel,
           LEFT(content, 300) AS content,
           "sourceUrl", "syncedAt"
    FROM law_chunks
    WHERE
      "gesetzKuerzel" ILIKE ${"%" + q + "%"}
      OR "paragraphNr" ILIKE ${"%" + q + "%"}
      OR titel ILIKE ${"%" + q + "%"}
    ORDER BY "gesetzKuerzel" ASC, "paragraphNr" ASC
    LIMIT 20
  `;

  return NextResponse.json(results);
}
