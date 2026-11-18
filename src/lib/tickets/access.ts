import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildAkteAccessFilter } from "@/lib/rbac";

type U = { id: string; role: UserRole };

/**
 * Tickets without an Akte are team tasks and visible to all staff.
 * Tickets linked to an Akte follow that Akte's access rules.
 */
export function ticketAccessWhere(user: U): Prisma.TicketWhereInput {
  if (user.role === "ADMIN") return {};
  if (user.role === "MANDANT") return { id: { in: [] } };
  return { OR: [{ akteId: null }, { akte: buildAkteAccessFilter(user.id, user.role) }] };
}

export async function findAccessibleTicket<T extends Prisma.TicketInclude>(
  user: U,
  id: string,
  include?: T
) {
  return prisma.ticket.findFirst({
    where: { AND: [{ id }, ticketAccessWhere(user)] },
    include,
  }) as Promise<Prisma.TicketGetPayload<{ include: T }> | null>;
}
