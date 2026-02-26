import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { parseCsv, rowToKontakt, type ImportMapping, type ImportResult } from "@/lib/kontakte/csv-import";
import { parseVCards } from "@/lib/kontakte/vcard-import";

/**
 * POST /api/kontakte/import — Import contacts from CSV or vCard.
 * Accepts multipart/form-data with:
 *   - file: The CSV or vCard file
 *   - format: "csv" | "vcard"
 *   - mapping: JSON string of column→field mapping (CSV only)
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const format = formData.get("format") as string;
  const mappingStr = formData.get("mapping") as string | null;

  if (!file) {
    return NextResponse.json({ error: "Keine Datei hochgeladen" }, { status: 400 });
  }

  const text = await file.text();

  if (format === "vcard") {
    return handleVCardImport(text);
  }

  if (format === "csv") {
    if (!mappingStr) {
      return NextResponse.json({ error: "Feld-Zuordnung fehlt" }, { status: 400 });
    }
    const mapping: ImportMapping = JSON.parse(mappingStr);
    return handleCsvImport(text, mapping);
  }

  return NextResponse.json({ error: "Unbekanntes Format. Unterstützt: csv, vcard" }, { status: 400 });
}

async function handleCsvImport(text: string, mapping: ImportMapping): Promise<NextResponse> {
  const { rows } = parseCsv(text);
  const result: ImportResult = { total: rows.length, imported: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const kontaktData = rowToKontakt(rows[i], mapping);
    if (!kontaktData) {
      result.skipped++;
      result.errors.push({ row: i + 2, error: "Pflichtfeld fehlt (Nachname oder Firma)" });
      continue;
    }

    try {
      // Parse geburtsdatum if present
      if (kontaktData.geburtsdatum) {
        const parsed = new Date(kontaktData.geburtsdatum);
        kontaktData.geburtsdatum = isNaN(parsed.getTime()) ? undefined : parsed;
      }
      // Clean empty strings
      for (const key of Object.keys(kontaktData)) {
        if (kontaktData[key] === "") kontaktData[key] = null;
      }

      await prisma.kontakt.create({ data: kontaktData as Prisma.KontaktCreateInput });
      result.imported++;
    } catch (err: any) {
      result.errors.push({ row: i + 2, error: err.message?.slice(0, 100) ?? "Unbekannter Fehler" });
    }
  }

  return NextResponse.json(result);
}

async function handleVCardImport(text: string): Promise<NextResponse> {
  const contacts = parseVCards(text);
  const result: ImportResult = { total: contacts.length, imported: 0, skipped: 0, errors: [] };

  for (let i = 0; i < contacts.length; i++) {
    try {
      const data: any = { ...contacts[i] };

      // Parse geburtsdatum
      if (data.geburtsdatum) {
        const parsed = new Date(data.geburtsdatum);
        data.geburtsdatum = isNaN(parsed.getTime()) ? undefined : parsed;
      }

      // Clean undefined/empty values
      for (const key of Object.keys(data)) {
        if (data[key] === undefined || data[key] === "") delete data[key];
      }

      await prisma.kontakt.create({ data });
      result.imported++;
    } catch (err: any) {
      result.errors.push({ row: i + 1, error: err.message?.slice(0, 100) ?? "Unbekannter Fehler" });
    }
  }

  return NextResponse.json(result);
}
