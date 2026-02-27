import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { abortTask } from "@/lib/queue/processors/helena-task.processor";
import { z } from "zod";

// ---------------------------------------------------------------------------
// GET /api/helena/tasks/[id] -- full task detail with steps trace
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // 1. Auth check
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  // 2. Fetch task with relations
  const task = await prisma.helenaTask.findUnique({
    where: { id },
    include: {
      akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
      user: { select: { id: true, name: true } },
      drafts: {
        select: {
          id: true,
          typ: true,
          status: true,
          titel: true,
          createdAt: true,
        },
      },
    },
  });

  if (!task) {
    return NextResponse.json(
      { error: "Task nicht gefunden" },
      { status: 404 },
    );
  }

  // 3. Ownership check: user sees own tasks, ADMIN sees all
  if (task.userId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Keine Berechtigung" },
      { status: 403 },
    );
  }

  return NextResponse.json({ task });
}

// ---------------------------------------------------------------------------
// PATCH /api/helena/tasks/[id] -- abort a running task
// ---------------------------------------------------------------------------

const patchSchema = z.object({
  action: z.literal("abort"),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // 1. Auth check
  const result = await requireAuth();
  if (result.error) return result.error;
  const { session } = result;

  // 2. Validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltige Eingabe" },
      { status: 400 },
    );
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungueltige Aktion", details: parsed.error.errors },
      { status: 400 },
    );
  }

  // 3. Fetch task
  const task = await prisma.helenaTask.findUnique({
    where: { id },
  });

  if (!task) {
    return NextResponse.json(
      { error: "Task nicht gefunden" },
      { status: 404 },
    );
  }

  // 4. Ownership check
  if (task.userId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Keine Berechtigung" },
      { status: 403 },
    );
  }

  // 5. Status check: only PENDING or RUNNING can be aborted
  if (task.status !== "PENDING" && task.status !== "RUNNING") {
    return NextResponse.json(
      { error: "Task kann nicht abgebrochen werden", status: task.status },
      { status: 409 },
    );
  }

  // 6. Update task status to ABGEBROCHEN
  await prisma.helenaTask.update({
    where: { id },
    data: {
      status: "ABGEBROCHEN",
      completedAt: new Date(),
    },
  });

  // 7. Signal in-process AbortController (returns false if task already finished or worker restarted)
  const abortedInProcess = abortTask(id);

  return NextResponse.json({ success: true, abortedInProcess });
}
