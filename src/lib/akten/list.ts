import type { AkteStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildAkteAccessFilter } from "@/lib/rbac";

export interface AktenListQuery {
  q?: string;
  status?: string;
  take?: number;
}

const STATUS = new Set<AkteStatus>(["OFFEN", "RUHEND", "ARCHIVIERT", "GESCHLOSSEN"]);

/**
 * Where-clause for the staff Akten list: access filter AND status AND search.
 * The search covers Aktenzeichen, Kurzrubrum, "wegen" and the names of all
 * Beteiligte, as the search field's placeholder promises.
 */
export function aktenListWhere(
  user: { id: string; role: UserRole },
  { q, status }: AktenListQuery
): Prisma.AkteWhereInput {
  const and: Prisma.AkteWhereInput[] = [buildAkteAccessFilter(user.id, user.role)];
  if (status && STATUS.has(status as AkteStatus)) {
    and.push({ status: status as AkteStatus });
  }
  const term = q?.trim();
  if (term) {
    const c = { contains: term, mode: "insensitive" as const };
    and.push({
      OR: [
        { aktenzeichen: c },
        { kurzrubrum: c },
        { wegen: c },
        {
          beteiligte: {
            some: {
              kontakt: { OR: [{ vorname: c }, { nachname: c }, { firma: c }] },
            },
          },
        },
      ],
    });
  }
  return { AND: and };
}

export function listAktenForUser(
  user: { id: string; role: UserRole },
  query: AktenListQuery
) {
  return prisma.akte.findMany({
    where: aktenListWhere(user, query),
    include: {
      anwalt: { select: { name: true } },
      sachbearbeiter: { select: { name: true } },
      beteiligte: {
        include: {
          kontakt: { select: { vorname: true, nachname: true, firma: true } },
        },
      },
    },
    orderBy: { geaendert: "desc" },
    take: query.take ?? 50,
  });
}

/** Akten a user may pick in selection lists (tickets, e-mail, ...). */
export function listAktenOptionsForUser(
  user: { id: string; role: UserRole },
  statuses: AkteStatus[] = ["OFFEN", "RUHEND"]
) {
  return prisma.akte.findMany({
    where: { AND: [buildAkteAccessFilter(user.id, user.role), { status: { in: statuses } }] },
    select: { id: true, aktenzeichen: true, kurzrubrum: true },
    orderBy: { aktenzeichen: "desc" },
  });
}
