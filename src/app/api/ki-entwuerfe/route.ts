import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac";

/**
 * GET /api/ki-entwuerfe -- list AI-generated chat messages (userId = null)
 * Supports filters: akteId, datum (today/7tage/30tage), q (search text)
 */
export async function GET(req: NextRequest) {
  // RBAC: KI access requires canUseKI permission (all roles have this)
  const result = await requirePermission("canUseKI");
  if (result.error) return result.error;

  const { searchParams } = new URL(req.url);
  const akteId = searchParams.get("akteId") ?? "";
  const datum = searchParams.get("datum") ?? "";
  const q = searchParams.get("q") ?? "";
  const take = Math.min(parseInt(searchParams.get("take") ?? "50"), 100);
  const skip = parseInt(searchParams.get("skip") ?? "0");

  const where: any = {
    userId: null, // AI-generated messages only
  };

  if (akteId) where.akteId = akteId;

  if (q) {
    where.nachricht = { contains: q, mode: "insensitive" };
  }

  if (datum) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (datum === "heute") {
      where.createdAt = { gte: now };
    } else if (datum === "7tage") {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      where.createdAt = { gte: d };
    } else if (datum === "30tage") {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      where.createdAt = { gte: d };
    }
  }

  const [items, total] = await Promise.all([
    prisma.chatNachricht.findMany({
      where,
      include: {
        akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
        bezugDokument: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.chatNachricht.count({ where }),
  ]);

  return Response.json({ items, total });
}
