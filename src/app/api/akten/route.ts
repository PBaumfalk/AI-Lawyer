import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateAktenzeichen } from "@/lib/aktenzeichen";
import { logAuditEvent } from "@/lib/audit";
import { requireAuth, requirePermission, buildAkteAccessFilter } from "@/lib/rbac";
import { z } from "zod";

const createAkteSchema = z.object({
  kurzrubrum: z.string().min(1, "Kurzrubrum ist erforderlich"),
  wegen: z.string().optional(),
  sachgebiet: z.enum([
    "ARBEITSRECHT", "FAMILIENRECHT", "VERKEHRSRECHT", "MIETRECHT",
    "STRAFRECHT", "ERBRECHT", "SOZIALRECHT", "INKASSO",
    "HANDELSRECHT", "VERWALTUNGSRECHT", "SONSTIGES",
  ]),
  gegenstandswert: z.number().positive().optional(),
  anwaltId: z.string().optional(),
  sachbearbeiterId: z.string().optional(),
  notizen: z.string().optional(),
});

// GET /api/akten -- list cases (filtered by RBAC access)
export async function GET(request: NextRequest) {
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("q");
  const take = Math.min(parseInt(searchParams.get("take") ?? "50"), 100);
  const skip = parseInt(searchParams.get("skip") ?? "0");

  // Build access filter based on user role
  const accessFilter = buildAkteAccessFilter(session.user.id, session.user.role);

  const where: any = { ...accessFilter };
  if (status) where.status = status;
  if (search) {
    // Merge search OR with existing access OR
    const searchOR = [
      { aktenzeichen: { contains: search, mode: "insensitive" } },
      { kurzrubrum: { contains: search, mode: "insensitive" } },
      { wegen: { contains: search, mode: "insensitive" } },
    ];
    if (where.OR) {
      // Access filter has OR (non-ADMIN) -- use AND to combine
      where.AND = [{ OR: where.OR }, { OR: searchOR }];
      delete where.OR;
    } else {
      where.OR = searchOR;
    }
  }

  const [akten, total] = await Promise.all([
    prisma.akte.findMany({
      where,
      include: {
        anwalt: { select: { id: true, name: true } },
        sachbearbeiter: { select: { id: true, name: true } },
        beteiligte: {
          include: {
            kontakt: {
              select: { vorname: true, nachname: true, firma: true, typ: true },
            },
          },
        },
        _count: { select: { dokumente: true, kalenderEintraege: true } },
      },
      orderBy: { geaendert: "desc" },
      take,
      skip,
    }),
    prisma.akte.count({ where }),
  ]);

  return NextResponse.json({ akten, total });
}

// POST /api/akten -- create new case
export async function POST(request: NextRequest) {
  // RBAC: require canCreateAkte permission
  const result = await requirePermission("canCreateAkte");
  if (result.error) return result.error;
  const { session } = result;

  const body = await request.json();
  const parsed = createAkteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const userId = session.user.id;
  const userRole = session.user.role;
  const kanzleiId = session.user.kanzleiId;

  const akte = await prisma.akte.create({
    data: {
      aktenzeichen: await generateAktenzeichen(),
      kurzrubrum: parsed.data.kurzrubrum,
      wegen: parsed.data.wegen || null,
      sachgebiet: parsed.data.sachgebiet as any,
      gegenstandswert: parsed.data.gegenstandswert ?? null,
      anwaltId: parsed.data.anwaltId || (userRole === "ANWALT" ? userId : null),
      sachbearbeiterId: parsed.data.sachbearbeiterId || null,
      kanzleiId: kanzleiId || null,
      notizen: parsed.data.notizen || null,
    },
    include: {
      anwalt: { select: { name: true } },
      sachbearbeiter: { select: { name: true } },
    },
  });

  // Audit log
  await logAuditEvent({
    userId,
    akteId: akte.id,
    aktion: "AKTE_ERSTELLT",
    details: { aktenzeichen: akte.aktenzeichen, kurzrubrum: akte.kurzrubrum },
  });

  // Check for Keine Akte ohne Frist/WV warning
  const activeFristenWv = await prisma.kalenderEintrag.count({
    where: {
      akteId: akte.id,
      erledigt: false,
      typ: { in: ["FRIST", "WIEDERVORLAGE"] },
    },
  });

  const warning =
    activeFristenWv === 0
      ? "Diese Akte hat weder eine laufende Frist noch eine Wiedervorlage."
      : undefined;

  return NextResponse.json({ ...akte, warning }, { status: 201 });
}
