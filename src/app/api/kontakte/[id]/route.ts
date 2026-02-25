import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit";

const updateKontaktSchema = z.object({
  typ: z.enum(["NATUERLICH", "JURISTISCH"]).optional(),
  // Natural person
  anrede: z.string().nullable().optional(),
  titel: z.string().nullable().optional(),
  vorname: z.string().nullable().optional(),
  nachname: z.string().nullable().optional(),
  geburtsdatum: z.string().nullable().optional(),
  // Natural person (extended)
  geburtsname: z.string().nullable().optional(),
  geburtsort: z.string().nullable().optional(),
  geburtsland: z.string().nullable().optional(),
  staatsangehoerigkeiten: z.array(z.string()).optional(),
  familienstand: z.enum(["LEDIG", "VERHEIRATET", "GESCHIEDEN", "VERWITWET", "LEBENSPARTNERSCHAFT"]).nullable().optional(),
  beruf: z.string().nullable().optional(),
  branche: z.string().nullable().optional(),
  // Legal entity
  firma: z.string().nullable().optional(),
  rechtsform: z.string().nullable().optional(),
  // Legal entity (extended)
  kurzname: z.string().nullable().optional(),
  registerart: z.enum(["HRB", "HRA", "VR", "PR", "GNR", "SONSTIGE"]).nullable().optional(),
  registernummer: z.string().nullable().optional(),
  registergericht: z.string().nullable().optional(),
  gruendungsdatum: z.string().nullable().optional(),
  geschaeftszweck: z.string().nullable().optional(),
  wirtschaftlichBerechtigte: z.any().nullable().optional(),
  // Address (legacy)
  strasse: z.string().nullable().optional(),
  plz: z.string().nullable().optional(),
  ort: z.string().nullable().optional(),
  land: z.string().nullable().optional(),
  // Communication
  telefon: z.string().nullable().optional(),
  telefon2: z.string().nullable().optional(),
  mobil: z.string().nullable().optional(),
  fax: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  email2: z.string().email().nullable().optional().or(z.literal("")),
  website: z.string().nullable().optional(),
  // Communication (extended)
  bevorzugteKontaktart: z.enum(["EMAIL", "TELEFON", "BRIEF", "FAX", "BEA"]).nullable().optional(),
  kontaktzeiten: z.string().nullable().optional(),
  korrespondenzSprachen: z.array(z.string()).optional(),
  // Legal identifiers
  beaSafeId: z.string().nullable().optional(),
  aktenzeichen: z.string().nullable().optional(),
  steuernr: z.string().nullable().optional(),
  // Tax & Bank
  finanzamt: z.string().nullable().optional(),
  ustIdNr: z.string().nullable().optional(),
  iban: z.string().nullable().optional(),
  bic: z.string().nullable().optional(),
  kontoinhaber: z.string().nullable().optional(),
  zahlungsmodalitaeten: z.string().nullable().optional(),
  bonitaetseinschaetzung: z.string().nullable().optional(),
  // Legal status
  minderjaehrig: z.boolean().optional(),
  unterBetreuung: z.boolean().optional(),
  geschaeftsunfaehig: z.boolean().optional(),
  // Internal
  mandantennummer: z.string().nullable().optional(),
  mandatsKategorie: z.enum(["A_KUNDE", "DAUERAUFTRAGGEBER", "GELEGENHEITSMANDANT", "PRO_BONO", "SONSTIGE"]).nullable().optional(),
  akquisekanal: z.string().nullable().optional(),
  einwilligungEmail: z.boolean().optional(),
  einwilligungNewsletter: z.boolean().optional(),
  einwilligungAi: z.boolean().optional(),
  // Notes & custom data
  notizen: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.any()).nullable().optional(),
});

// GET /api/kontakte/[id] — get single contact
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;

  const kontakt = await prisma.kontakt.findUnique({
    where: { id },
    include: {
      beteiligte: {
        include: {
          akte: {
            select: {
              id: true,
              aktenzeichen: true,
              kurzrubrum: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      adressen: { orderBy: [{ istHaupt: "desc" }, { createdAt: "asc" }] },
      identitaetsPruefungen: { orderBy: { createdAt: "desc" } },
      vollmachtenAlsGeber: {
        include: { nehmer: { select: { id: true, vorname: true, nachname: true, firma: true, typ: true } } },
        orderBy: { createdAt: "desc" },
      },
      kontaktDokumente: { orderBy: { createdAt: "desc" } },
      beziehungenVon: {
        include: { zuKontakt: { select: { id: true, vorname: true, nachname: true, firma: true, typ: true } } },
        orderBy: { createdAt: "desc" },
      },
      beziehungenZu: {
        include: { vonKontakt: { select: { id: true, vorname: true, nachname: true, firma: true, typ: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!kontakt) {
    return NextResponse.json({ error: "Kontakt nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json(kontakt);
}

// PATCH /api/kontakte/[id] — update contact
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateKontaktSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.kontakt.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Kontakt nicht gefunden" }, { status: 404 });
  }

  const data: any = { ...parsed.data };
  // Convert empty strings to null
  for (const key of Object.keys(data)) {
    if (data[key] === "") data[key] = null;
  }
  // Parse date fields
  for (const dateField of ["geburtsdatum", "gruendungsdatum"]) {
    if (data[dateField] && typeof data[dateField] === "string") {
      data[dateField] = new Date(data[dateField]);
    } else if (data[dateField] === null || data[dateField] === "") {
      data[dateField] = null;
    }
  }

  const kontakt = await prisma.kontakt.update({
    where: { id },
    data,
  });

  // Audit log: Safe-ID change
  if (
    parsed.data.beaSafeId !== undefined &&
    parsed.data.beaSafeId !== existing.beaSafeId
  ) {
    const kontaktName = existing.vorname
      ? `${existing.vorname} ${existing.nachname || ""}`.trim()
      : existing.firma || "Unbekannt";

    logAuditEvent({
      userId: session.user.id,
      aktion: "BEA_SAFEID_GEAENDERT",
      details: {
        kontaktId: id,
        kontaktName,
        alteSafeId: existing.beaSafeId || null,
        neueSafeId: parsed.data.beaSafeId,
        ergebnis: "ERFOLG",
      },
    }).catch(() => {});
  }

  return NextResponse.json(kontakt);
}

// DELETE /api/kontakte/[id] — delete contact
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { id } = await params;

  const kontakt = await prisma.kontakt.findUnique({
    where: { id },
    include: { _count: { select: { beteiligte: true } } },
  });

  if (!kontakt) {
    return NextResponse.json({ error: "Kontakt nicht gefunden" }, { status: 404 });
  }

  // Prevent deletion if contact is still assigned as party in any case
  if (kontakt._count.beteiligte > 0) {
    return NextResponse.json(
      {
        error: `Kontakt ist noch ${kontakt._count.beteiligte} Akte(n) als Beteiligter zugeordnet. Bitte zuerst alle Zuordnungen entfernen.`,
      },
      { status: 409 }
    );
  }

  await prisma.kontakt.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
