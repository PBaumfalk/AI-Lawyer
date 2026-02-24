import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import type { UserRole } from "@prisma/client";

interface ImportData {
  version: string;
  exportedAt?: string;
  systemSettings?: Array<{
    key: string;
    value: string;
    type: string;
    category: string;
    label?: string;
  }>;
  fristPresets?: Array<{
    name: string;
    fristArt: string;
    dauerWochen?: number | null;
    dauerMonate?: number | null;
    dauerTage?: number | null;
    istNotfrist: boolean;
    defaultVorfristen: number[];
    kategorie: string;
    beschreibung?: string | null;
    rechtsgrundlage?: string | null;
    sortierung?: number;
    aktiv?: boolean;
  }>;
  briefkoepfe?: Array<{
    name: string;
    kanzleiName?: string | null;
    adresse?: string | null;
    telefon?: string | null;
    fax?: string | null;
    email?: string | null;
    website?: string | null;
    steuernr?: string | null;
    ustIdNr?: string | null;
    iban?: string | null;
    bic?: string | null;
    bankName?: string | null;
    braoInfo?: string | null;
    istStandard?: boolean;
  }>;
  ordnerSchemata?: Array<{
    name: string;
    sachgebiet?: string | null;
    ordner: string[];
    istStandard?: boolean;
  }>;
}

// POST /api/einstellungen/import -- Import settings from JSON
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  const role = (session.user as any).role as UserRole;
  if (role !== "ADMIN") {
    return NextResponse.json(
      { error: "Nur Administratoren koennen Einstellungen importieren" },
      { status: 403 }
    );
  }

  let data: ImportData;
  try {
    data = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltige JSON-Datei" },
      { status: 400 }
    );
  }

  // Validate structure
  if (!data.version) {
    return NextResponse.json(
      { error: "Fehlende Versionsinformation in der Import-Datei" },
      { status: 400 }
    );
  }

  const summary = {
    systemSettings: { imported: 0, skipped: 0 },
    fristPresets: { imported: 0, skipped: 0 },
    briefkoepfe: { imported: 0, skipped: 0 },
    ordnerSchemata: { imported: 0, skipped: 0 },
  };

  // Import SystemSettings (upsert by key)
  if (data.systemSettings && Array.isArray(data.systemSettings)) {
    for (const setting of data.systemSettings) {
      if (!setting.key || setting.value === undefined) {
        summary.systemSettings.skipped++;
        continue;
      }
      await prisma.systemSetting.upsert({
        where: { key: setting.key },
        update: { value: setting.value },
        create: {
          key: setting.key,
          value: setting.value,
          type: setting.type ?? "string",
          category: setting.category ?? "general",
          label: setting.label ?? setting.key,
        },
      });
      summary.systemSettings.imported++;
    }
  }

  // Import FristPresets (upsert by name)
  if (data.fristPresets && Array.isArray(data.fristPresets)) {
    for (const preset of data.fristPresets) {
      if (!preset.name || !preset.fristArt) {
        summary.fristPresets.skipped++;
        continue;
      }
      // Find existing by name
      const existing = await prisma.fristPreset.findFirst({
        where: { name: preset.name },
      });
      if (existing) {
        await prisma.fristPreset.update({
          where: { id: existing.id },
          data: {
            fristArt: preset.fristArt,
            dauerWochen: preset.dauerWochen ?? null,
            dauerMonate: preset.dauerMonate ?? null,
            dauerTage: preset.dauerTage ?? null,
            istNotfrist: preset.istNotfrist,
            defaultVorfristen: preset.defaultVorfristen,
            kategorie: preset.kategorie,
            beschreibung: preset.beschreibung ?? null,
            rechtsgrundlage: preset.rechtsgrundlage ?? null,
            sortierung: preset.sortierung ?? 0,
            aktiv: preset.aktiv ?? true,
          },
        });
      } else {
        await prisma.fristPreset.create({
          data: {
            name: preset.name,
            fristArt: preset.fristArt,
            dauerWochen: preset.dauerWochen ?? null,
            dauerMonate: preset.dauerMonate ?? null,
            dauerTage: preset.dauerTage ?? null,
            istNotfrist: preset.istNotfrist,
            defaultVorfristen: preset.defaultVorfristen,
            kategorie: preset.kategorie,
            beschreibung: preset.beschreibung ?? null,
            rechtsgrundlage: preset.rechtsgrundlage ?? null,
            sortierung: preset.sortierung ?? 0,
            aktiv: preset.aktiv ?? true,
          },
        });
      }
      summary.fristPresets.imported++;
    }
  }

  // Import OrdnerSchemata (upsert by name)
  if (data.ordnerSchemata && Array.isArray(data.ordnerSchemata)) {
    for (const schema of data.ordnerSchemata) {
      if (!schema.name || !Array.isArray(schema.ordner)) {
        summary.ordnerSchemata.skipped++;
        continue;
      }
      const existing = await prisma.ordnerSchema.findFirst({
        where: { name: schema.name },
      });
      if (existing) {
        await prisma.ordnerSchema.update({
          where: { id: existing.id },
          data: {
            sachgebiet: (schema.sachgebiet as any) ?? null,
            ordner: schema.ordner,
            istStandard: schema.istStandard ?? false,
          },
        });
      } else {
        await prisma.ordnerSchema.create({
          data: {
            name: schema.name,
            sachgebiet: (schema.sachgebiet as any) ?? null,
            ordner: schema.ordner,
            istStandard: schema.istStandard ?? false,
          },
        });
      }
      summary.ordnerSchemata.imported++;
    }
  }

  // Import Briefkoepfe metadata (skip files -- only metadata)
  if (data.briefkoepfe && Array.isArray(data.briefkoepfe)) {
    for (const bk of data.briefkoepfe) {
      if (!bk.name) {
        summary.briefkoepfe.skipped++;
        continue;
      }
      const existing = await prisma.briefkopf.findFirst({
        where: { name: bk.name },
      });
      const bkData = {
        kanzleiName: bk.kanzleiName ?? null,
        adresse: bk.adresse ?? null,
        telefon: bk.telefon ?? null,
        fax: bk.fax ?? null,
        email: bk.email ?? null,
        website: bk.website ?? null,
        steuernr: bk.steuernr ?? null,
        ustIdNr: bk.ustIdNr ?? null,
        iban: bk.iban ?? null,
        bic: bk.bic ?? null,
        bankName: bk.bankName ?? null,
        braoInfo: bk.braoInfo ?? null,
        istStandard: bk.istStandard ?? false,
      };
      if (existing) {
        await prisma.briefkopf.update({
          where: { id: existing.id },
          data: bkData,
        });
      } else {
        await prisma.briefkopf.create({
          data: { name: bk.name, ...bkData },
        });
      }
      summary.briefkoepfe.imported++;
    }
  }

  await logAuditEvent({
    userId: session.user.id,
    aktion: "EINSTELLUNGEN_IMPORTIERT",
    details: {
      version: data.version,
      exportedAt: data.exportedAt,
      summary,
    },
  });

  return NextResponse.json({
    success: true,
    summary,
  });
}
