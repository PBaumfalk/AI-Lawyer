import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import {
  Ticket,
  FolderOpen,
  User,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TicketSearchBar } from "@/components/tickets/ticket-search-bar";
import { TicketTagBadge } from "@/components/tickets/ticket-tag-badge";
import {
  TicketStatusSelect,
  TicketVerantwortlichSelect,
} from "@/components/tickets/ticket-quick-actions";

interface TicketsPageProps {
  searchParams: Promise<{
    status?: string;
    prioritaet?: string;
    q?: string;
    tag?: string;
    faelligkeit?: string;
    akteId?: string;
    sort?: string;
  }>;
}

const statusColors: Record<string, string> = {
  OFFEN:
    "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  IN_BEARBEITUNG:
    "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  ERLEDIGT:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
};

const statusLabels: Record<string, string> = {
  OFFEN: "Offen",
  IN_BEARBEITUNG: "In Bearbeitung",
  ERLEDIGT: "Erledigt",
};

const prioritaetColors: Record<string, string> = {
  NIEDRIG: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-muted-foreground",
  NORMAL: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  HOCH: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  KRITISCH: "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
};

const prioritaetLabels: Record<string, string> = {
  NIEDRIG: "Niedrig",
  NORMAL: "Normal",
  HOCH: "Hoch",
  KRITISCH: "Kritisch",
};

const statusIcons: Record<string, React.ElementType> = {
  OFFEN: Clock,
  IN_BEARBEITUNG: AlertTriangle,
  ERLEDIGT: CheckCircle2,
};

function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function isOverdue(date: Date | null, status: string): boolean {
  if (!date || status === "ERLEDIGT") return false;
  return new Date(date) < new Date(new Date().toDateString());
}

export default async function TicketsPage({ searchParams }: TicketsPageProps) {
  const { status, prioritaet, q, tag, faelligkeit, akteId, sort } = await searchParams;

  const where: any = {};

  if (status) where.status = status;
  if (prioritaet) where.prioritaet = prioritaet;
  if (tag) where.tags = { has: tag };
  if (akteId) where.akteId = akteId;
  if (q) {
    where.OR = [
      { titel: { contains: q, mode: "insensitive" } },
      { beschreibung: { contains: q, mode: "insensitive" } },
    ];
  }

  // Due date filter
  if (faelligkeit) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    if (faelligkeit === "heute") {
      where.faelligAm = { gte: today, lte: endOfToday };
    } else if (faelligkeit === "ueberfaellig") {
      where.faelligAm = { lt: today };
      where.status = { not: "ERLEDIGT" };
    } else if (faelligkeit === "7tage") {
      const in7Days = new Date(today);
      in7Days.setDate(in7Days.getDate() + 7);
      where.faelligAm = { gte: today, lte: in7Days };
    }
  }

  // Build orderBy based on sort param
  let orderBy: any[];
  switch (sort) {
    case "faelligkeit":
      orderBy = [{ faelligAm: "asc" }, { createdAt: "desc" }];
      break;
    case "prioritaet":
      orderBy = [{ prioritaet: "desc" }, { createdAt: "desc" }];
      break;
    case "aktualisiert":
      orderBy = [{ updatedAt: "desc" }];
      break;
    default:
      orderBy = [{ status: "asc" }, { createdAt: "desc" }];
  }

  const [tickets, total, akten, users] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
        verantwortlich: { select: { id: true, name: true } },
      },
      orderBy,
      take: 50,
    }),
    prisma.ticket.count({ where }),
    prisma.akte.findMany({
      where: { status: "OFFEN" },
      select: { id: true, aktenzeichen: true },
      orderBy: { aktenzeichen: "asc" },
      take: 200,
    }),
    prisma.user.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading text-foreground">
            Tickets
          </h1>
          <p className="text-muted-foreground mt-1">
            {total} Ticket{total !== 1 ? "s" : ""}
            {q ? ` für "${q}"` : " insgesamt"}
          </p>
        </div>
        <Link href="/tickets/neu">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Neues Ticket
          </Button>
        </Link>
      </div>

      {/* Search & Filters */}
      <TicketSearchBar
        basePath="/tickets"
        defaultSearch={q}
        defaultStatus={status}
        defaultPrioritaet={prioritaet}
        defaultTag={tag}
        defaultFaelligkeit={faelligkeit}
        defaultAkteId={akteId}
        defaultSort={sort}
        akten={akten}
      />

      {/* Table */}
      {tickets.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Ticket className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">
            {q || status || prioritaet || tag || faelligkeit || akteId
              ? "Keine Tickets für diese Suche gefunden."
              : "Noch keine Tickets vorhanden."}
          </p>
          {!q && !status && !prioritaet && !tag && !faelligkeit && !akteId && (
            <Link href="/tickets/neu">
              <Button>Erstes Ticket anlegen</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 dark:border-white/[0.06]">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                  Titel
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3 hidden md:table-cell">
                  Akte
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3 hidden lg:table-cell">
                  Verantwortlich
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3 hidden md:table-cell">
                  Fälligkeit
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3 hidden md:table-cell">
                  Priorität
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3 hidden lg:table-cell">
                  Tags
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 dark:divide-white/[0.04]">
              {tickets.map((ticket) => {
                const StatusIcon = statusIcons[ticket.status] ?? Clock;
                const overdue = isOverdue(ticket.faelligAm, ticket.status);

                return (
                  <tr
                    key={ticket.id}
                    className="hover:bg-white/30 dark:hover:bg-white/[0.04] transition-colors"
                  >
                    {/* Status quick-action */}
                    <td className="px-6 py-4">
                      <TicketStatusSelect
                        ticketId={ticket.id}
                        currentStatus={ticket.status}
                      />
                    </td>

                    {/* Titel */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/tickets/${ticket.id}`}
                          className="text-sm font-medium text-foreground hover:text-brand-600 transition-colors"
                        >
                          {ticket.titel}
                        </Link>
                        <Badge
                          className={`text-[10px] ${prioritaetColors[ticket.prioritaet] ?? ""}`}
                        >
                          {prioritaetLabels[ticket.prioritaet] ?? ticket.prioritaet}
                        </Badge>
                      </div>
                      {ticket.beschreibung && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5 max-w-[300px]">
                          {ticket.beschreibung.substring(0, 100)}
                        </p>
                      )}
                    </td>

                    {/* Akte */}
                    <td className="px-6 py-4 hidden md:table-cell">
                      {ticket.akte ? (
                        <Link
                          href={`/akten/${ticket.akte.id}`}
                          className="flex items-center gap-1.5 text-sm text-brand-600 hover:underline"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          {ticket.akte.aktenzeichen}
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">&mdash;</span>
                      )}
                    </td>

                    {/* Verantwortlich quick-action */}
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <TicketVerantwortlichSelect
                        ticketId={ticket.id}
                        currentUserId={ticket.verantwortlichId}
                        users={users}
                      />
                    </td>

                    {/* Fälligkeit */}
                    <td className="px-6 py-4 hidden md:table-cell">
                      {ticket.faelligAm ? (
                        <span
                          className={`flex items-center gap-1.5 text-sm ${
                            overdue
                              ? "text-rose-600 dark:text-rose-400 font-medium"
                              : "text-foreground/80"
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(ticket.faelligAm)}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">&mdash;</span>
                      )}
                    </td>

                    {/* Priorität */}
                    <td className="px-6 py-4 hidden md:table-cell">
                      <Badge
                        className={`text-xs ${prioritaetColors[ticket.prioritaet] ?? ""}`}
                      >
                        {prioritaetLabels[ticket.prioritaet] ?? ticket.prioritaet}
                      </Badge>
                    </td>

                    {/* Tags */}
                    <td className="px-6 py-4 hidden lg:table-cell">
                      {ticket.tags.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {ticket.tags.map((t) => (
                            <TicketTagBadge
                              key={t}
                              tag={t}
                              className="text-[10px] px-1.5 py-0"
                            />
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">&mdash;</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
