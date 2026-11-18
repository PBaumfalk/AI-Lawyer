import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { buildAkteAccessFilter } from "@/lib/rbac";
import { findAccessibleTicket } from "@/lib/tickets/access";
import { ticketEmailsInclude } from "@/lib/tickets/emails";
import { TicketDetail } from "@/components/tickets/ticket-detail";

interface TicketDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TicketDetailPage({ params }: TicketDetailPageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();
  const user = { id: session.user.id!, role: (session.user as any).role };

  const [ticket, users] = await Promise.all([
    findAccessibleTicket(user, id, {
        akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
        verantwortlich: { select: { id: true, name: true } },
        ...ticketEmailsInclude,
    }),
    prisma.user.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!ticket) notFound();

  const akten = await prisma.akte.findMany({
    where: { AND: [buildAkteAccessFilter(user.id, user.role), { status: "OFFEN" }] },
    select: { id: true, aktenzeichen: true },
    orderBy: { aktenzeichen: "asc" },
    take: 200,
  });

  return (
    <TicketDetail
      ticket={{
        id: ticket.id,
        titel: ticket.titel,
        beschreibung: ticket.beschreibung,
        status: ticket.status,
        prioritaet: ticket.prioritaet,
        faelligAm: ticket.faelligAm?.toISOString() ?? null,
        verantwortlichId: ticket.verantwortlichId,
        akteId: ticket.akteId,
        tags: ticket.tags,
        erledigtAm: ticket.erledigtAm?.toISOString() ?? null,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
        akte: ticket.akte,
        verantwortlich: ticket.verantwortlich,
        emails: ticket.emailNachrichten,
      }}
      users={users}
      akten={akten}
    />
  );
}
