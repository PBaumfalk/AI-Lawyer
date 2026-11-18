/**
 * Emails linked to a ticket. Tickets are linked to the current email model
 * (EmailNachricht.ticketId, set by POST /api/emails/[id]/ticket) — the
 * legacy EmailMessage relation (`emails`) is no longer written by anything.
 *
 * Shared by the ticket API, the ticket pages and TicketDetail.
 */
import type { Prisma, UserRole, TicketStatus, TicketPrioritaet } from "@prisma/client";
import { ticketAccessWhere } from "@/lib/tickets/access";

export const ticketEmailsInclude = {
  emailNachrichten: {
    select: { id: true, betreff: true, absender: true },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.TicketInclude;

export interface TicketEmail {
  id: string;
  betreff: string;
  absender: string;
}

/** Query for /email/tickets: tickets created from emails, visible to the user. */
export function emailTicketsWhere(
  user: { id: string; role: UserRole },
  filter: { status?: string; prioritaet?: string; q?: string; tag?: string }
): Prisma.TicketWhereInput {
  const and: Prisma.TicketWhereInput[] = [ticketAccessWhere(user), { emailNachrichten: { some: {} } }];
  if (filter.status) and.push({ status: filter.status as TicketStatus });
  if (filter.prioritaet) and.push({ prioritaet: filter.prioritaet as TicketPrioritaet });
  if (filter.tag) and.push({ tags: { has: filter.tag } });
  if (filter.q) {
    and.push({
      OR: [
        { titel: { contains: filter.q, mode: "insensitive" } },
        { beschreibung: { contains: filter.q, mode: "insensitive" } },
      ],
    });
  }
  return { AND: and };
}
