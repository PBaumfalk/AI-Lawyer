import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  validateOpenClawToken,
  unauthorizedResponse,
} from "@/lib/openclaw-auth";

/**
 * GET /api/openclaw/tasks
 *
 * Returns tickets tagged with ai:* that are open or in progress.
 * Optional filters: ?status=OFFEN&tag=ai:auto&akteId=xxx
 *
 * Scope: READ only ai:-tagged tasks.
 */
export async function GET(req: NextRequest) {
  if (!validateOpenClawToken(req)) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const tag = searchParams.get("tag");
  const akteId = searchParams.get("akteId");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

  const where: any = {
    // Only return tasks with at least one ai: tag
    tags: { hasSome: tag ? [tag] : [] },
  };

  // If no specific tag filter, find any task with ai:* tags
  if (!tag) {
    // Prisma doesn't support array prefix matching natively,
    // so we query all and filter in-app. For performance with large datasets,
    // consider a raw SQL query with array_to_string LIKE 'ai:%'.
    delete where.tags;
  }

  if (status) where.status = status;
  if (akteId) where.akteId = akteId;

  const tickets = await prisma.ticket.findMany({
    where,
    include: {
      akte: {
        select: {
          id: true,
          aktenzeichen: true,
          kurzrubrum: true,
          sachgebiet: true,
        },
      },
      verantwortlich: { select: { id: true, name: true } },
    },
    orderBy: [{ prioritaet: "desc" }, { faelligAm: "asc" }],
    take: limit,
  });

  // Filter to only include tasks with ai: tags
  const aiTasks = tickets.filter((t) =>
    t.tags.some((tag) => tag.startsWith("ai:"))
  );

  return Response.json({
    tasks: aiTasks,
    count: aiTasks.length,
  });
}
