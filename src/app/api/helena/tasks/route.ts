import { NextRequest, NextResponse } from "next/server";
import { requireAuth, buildAkteAccessFilter } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { createHelenaTask } from "@/lib/helena/task-service";
import { z } from "zod";

// ---------------------------------------------------------------------------
// POST /api/helena/tasks -- create a new Helena task
// ---------------------------------------------------------------------------

const createSchema = z.object({
  akteId: z.string().min(1),
  auftrag: z.string().min(1).max(5000),
  prioritaet: z.number().int().min(1).max(10).optional(),
  quelle: z.enum(["at-mention", "manual", "scanner", "chat"]).optional(),
});

export async function POST(request: NextRequest) {
  // 1. Auth check
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  // 2. Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltige Eingabe" },
      { status: 400 },
    );
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungueltige Eingabe", details: parsed.error.errors },
      { status: 400 },
    );
  }

  const { akteId, auftrag, prioritaet, quelle } = parsed.data;

  // 3. Verify user has access to the Akte
  const accessFilter = buildAkteAccessFilter(session.user.id, session.user.role);
  const akte = await prisma.akte.findFirst({
    where: { id: akteId, ...accessFilter },
    select: { id: true },
  });

  if (!akte) {
    return NextResponse.json(
      { error: "Akte nicht gefunden" },
      { status: 404 },
    );
  }

  // 4. Create task and enqueue BullMQ job
  const task = await createHelenaTask({
    userId: session.user.id,
    userRole: session.user.role,
    userName: session.user.name,
    akteId,
    auftrag,
    prioritaet,
    quelle,
  });

  return NextResponse.json({ task }, { status: 201 });
}

// ---------------------------------------------------------------------------
// GET /api/helena/tasks -- list tasks (paginated, filterable)
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // 1. Auth check
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  // 2. Parse query params
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const akteId = searchParams.get("akteId");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));

  // 3. Build WHERE clause
  const where: Record<string, unknown> = {};

  // Users see only their own tasks; ADMIN sees all
  if (session.user.role !== "ADMIN") {
    where.userId = session.user.id;
  }

  if (status) {
    where.status = status;
  }

  if (akteId) {
    where.akteId = akteId;
  }

  // 4. Query with pagination
  const skip = (page - 1) * pageSize;

  const [tasks, total] = await Promise.all([
    prisma.helenaTask.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      include: {
        akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
      },
    }),
    prisma.helenaTask.count({ where }),
  ]);

  return NextResponse.json({ tasks, total, page, pageSize });
}
