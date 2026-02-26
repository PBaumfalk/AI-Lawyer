import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseCsv, autoMapHeaders } from "@/lib/kontakte/csv-import";
import { parseVCards } from "@/lib/kontakte/vcard-import";

/**
 * POST /api/kontakte/import/preview — Preview import data.
 * Returns headers, auto-mapping, and sample rows for CSV,
 * or parsed contacts for vCard.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const format = formData.get("format") as string;

  if (!file) {
    return NextResponse.json({ error: "Keine Datei hochgeladen" }, { status: 400 });
  }

  const text = await file.text();

  if (format === "vcard") {
    const contacts = parseVCards(text);
    return NextResponse.json({
      format: "vcard",
      total: contacts.length,
      preview: contacts.slice(0, 5),
    });
  }

  if (format === "csv") {
    const { headers, rows } = parseCsv(text);
    const autoMapping = autoMapHeaders(headers);

    return NextResponse.json({
      format: "csv",
      headers,
      total: rows.length,
      autoMapping,
      preview: rows.slice(0, 5),
    });
  }

  return NextResponse.json({ error: "Unbekanntes Format" }, { status: 400 });
}
