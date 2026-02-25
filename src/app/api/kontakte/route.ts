import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/rbac";
import { z } from "zod";

const createKontaktSchema = z.object({
  typ: z.enum(["NATUERLICH", "JURISTISCH"]),
  // Natural person
  anrede: z.string().optional(),
  titel: z.string().optional(),
  vorname: z.string().optional(),
  nachname: z.string().optional(),
  geburtsdatum: z.string().optional(),
  // Natural person (extended)
  geburtsname: z.string().optional(),
  geburtsort: z.string().optional(),
  geburtsland: z.string().optional(),
  staatsangehoerigkeiten: z.array(z.string()).optional(),
  familienstand: z.enum(["LEDIG", "VERHEIRATET", "GESCHIEDEN", "VERWITWET", "LEBENSPARTNERSCHAFT"]).nullable().optional(),
  beruf: z.string().optional(),
  branche: z.string().optional(),
  // Legal entity
  firma: z.string().optional(),
  rechtsform: z.string().optional(),
  // Legal entity (extended)
  kurzname: z.string().optional(),
  registerart: z.enum(["HRB", "HRA", "VR", "PR", "GNR", "SONSTIGE"]).nullable().optional(),
  registernummer: z.string().optional(),
  registergericht: z.string().optional(),
  gruendungsdatum: z.string().optional(),
  geschaeftszweck: z.string().optional(),
  wirtschaftlichBerechtigte: z.any().optional(),
  // Address (legacy)
  strasse: z.string().optional(),
  plz: z.string().optional(),
  ort: z.string().optional(),
  land: z.string().optional(),
  // Communication
  telefon: z.string().optional(),
  telefon2: z.string().optional(),
  mobil: z.string().optional(),
  fax: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  email2: z.string().email().optional().or(z.literal("")),
  website: z.string().optional(),
  // Communication (extended)
  bevorzugteKontaktart: z.enum(["EMAIL", "TELEFON", "BRIEF", "FAX", "BEA"]).nullable().optional(),
  kontaktzeiten: z.string().optional(),
  korrespondenzSprachen: z.array(z.string()).optional(),
  // Legal identifiers
  beaSafeId: z.string().optional(),
  aktenzeichen: z.string().optional(),
  steuernr: z.string().optional(),
  // Tax & Bank
  finanzamt: z.string().optional(),
  ustIdNr: z.string().optional(),
  iban: z.string().optional(),
  bic: z.string().optional(),
  kontoinhaber: z.string().optional(),
  zahlungsmodalitaeten: z.string().optional(),
  bonitaetseinschaetzung: z.string().optional(),
  // Legal status
  minderjaehrig: z.boolean().optional(),
  unterBetreuung: z.boolean().optional(),
  geschaeftsunfaehig: z.boolean().optional(),
  // Internal
  mandantennummer: z.string().optional(),
  mandatsKategorie: z.enum(["A_KUNDE", "DAUERAUFTRAGGEBER", "GELEGENHEITSMANDANT", "PRO_BONO", "SONSTIGE"]).nullable().optional(),
  akquisekanal: z.string().optional(),
  einwilligungEmail: z.boolean().optional(),
  einwilligungNewsletter: z.boolean().optional(),
  einwilligungAi: z.boolean().optional(),
  // Notes & custom data
  notizen: z.string().optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.any()).optional(),
}).refine(
  (data) => {
    if (data.typ === "NATUERLICH") return !!data.nachname;
    return !!data.firma;
  },
  { message: "Nachname (natürliche Person) oder Firma (juristische Person) ist erforderlich" }
);

// GET /api/kontakte -- search/list contacts (shared, no Akte-level restriction)
export async function GET(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const typ = searchParams.get("typ");
  const tag = searchParams.get("tag");
  const take = Math.min(parseInt(searchParams.get("take") ?? "50"), 100);
  const skip = parseInt(searchParams.get("skip") ?? "0");

  const where: any = {};
  if (typ) where.typ = typ;
  if (tag) where.tags = { has: tag };
  if (q) {
    where.OR = [
      { nachname: { contains: q, mode: "insensitive" } },
      { vorname: { contains: q, mode: "insensitive" } },
      { firma: { contains: q, mode: "insensitive" } },
      { kurzname: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { ort: { contains: q, mode: "insensitive" } },
      { telefon: { contains: q, mode: "insensitive" } },
      { mandantennummer: { contains: q, mode: "insensitive" } },
      { ustIdNr: { contains: q, mode: "insensitive" } },
    ];
  }

  const [kontakte, total] = await Promise.all([
    prisma.kontakt.findMany({
      where,
      orderBy: [{ nachname: "asc" }, { firma: "asc" }],
      take,
      skip,
      include: {
        _count: { select: { beteiligte: true } },
      },
    }),
    prisma.kontakt.count({ where }),
  ]);

  return NextResponse.json({ kontakte, total });
}

// POST /api/kontakte -- create new contact
export async function POST(request: NextRequest) {
  const postResult = await requireAuth();
  if (postResult.error) return postResult.error;

  const body = await request.json();
  const parsed = createKontaktSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data: any = { ...parsed.data };
  // Convert empty strings to null
  for (const key of Object.keys(data)) {
    if (data[key] === "") data[key] = null;
  }
  // Parse date fields
  if (data.geburtsdatum) {
    data.geburtsdatum = new Date(data.geburtsdatum);
  }
  if (data.gruendungsdatum) {
    data.gruendungsdatum = new Date(data.gruendungsdatum);
  }

  const kontakt = await prisma.kontakt.create({ data });

  return NextResponse.json(kontakt, { status: 201 });
}
