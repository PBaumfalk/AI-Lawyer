import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAuditEvent } from "@/lib/audit";
import type { UserRole } from "@prisma/client";

// GET /api/einstellungen/export -- Export all settings as JSON
export async function GET() {
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
      { error: "Nur Administratoren koennen Einstellungen exportieren" },
      { status: 403 }
    );
  }

  // Gather all exportable data
  const [systemSettings, fristPresets, briefkoepfe, ordnerSchemata] =
    await Promise.all([
      prisma.systemSetting.findMany({
        orderBy: [{ category: "asc" }, { key: "asc" }],
      }),
      prisma.fristPreset.findMany({
        orderBy: [{ kategorie: "asc" }, { sortierung: "asc" }],
      }),
      prisma.briefkopf.findMany({
        select: {
          id: true,
          name: true,
          kanzleiName: true,
          adresse: true,
          telefon: true,
          fax: true,
          email: true,
          website: true,
          steuernr: true,
          ustIdNr: true,
          iban: true,
          bic: true,
          bankName: true,
          braoInfo: true,
          istStandard: true,
          // Intentionally skip dateipfad and logoUrl (files must be uploaded separately)
        },
      }),
      prisma.ordnerSchema.findMany({
        orderBy: { name: "asc" },
      }),
    ]);

  const exportData = {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    systemSettings: systemSettings.map((s) => ({
      key: s.key,
      value: s.value,
      type: s.type,
      category: s.category,
      label: s.label,
    })),
    fristPresets: fristPresets.map((p) => ({
      name: p.name,
      fristArt: p.fristArt,
      dauerWochen: p.dauerWochen,
      dauerMonate: p.dauerMonate,
      dauerTage: p.dauerTage,
      istNotfrist: p.istNotfrist,
      defaultVorfristen: p.defaultVorfristen,
      kategorie: p.kategorie,
      beschreibung: p.beschreibung,
      rechtsgrundlage: p.rechtsgrundlage,
      sortierung: p.sortierung,
      aktiv: p.aktiv,
    })),
    briefkoepfe: briefkoepfe.map((b) => ({
      name: b.name,
      kanzleiName: b.kanzleiName,
      adresse: b.adresse,
      telefon: b.telefon,
      fax: b.fax,
      email: b.email,
      website: b.website,
      steuernr: b.steuernr,
      ustIdNr: b.ustIdNr,
      iban: b.iban,
      bic: b.bic,
      bankName: b.bankName,
      braoInfo: b.braoInfo,
      istStandard: b.istStandard,
    })),
    ordnerSchemata: ordnerSchemata.map((o) => ({
      name: o.name,
      sachgebiet: o.sachgebiet,
      ordner: o.ordner,
      istStandard: o.istStandard,
    })),
  };

  await logAuditEvent({
    userId: session.user.id,
    aktion: "EINSTELLUNGEN_EXPORTIERT",
    details: {
      settingsCount: systemSettings.length,
      presetsCount: fristPresets.length,
      briefkoepfeCount: briefkoepfe.length,
      ordnerSchemataCount: ordnerSchemata.length,
    },
  });

  const datum = new Date().toISOString().split("T")[0];

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="kanzlei-einstellungen-${datum}.json"`,
    },
  });
}
