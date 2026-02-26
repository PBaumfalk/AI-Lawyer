import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import {
  Ticket,
  FolderOpen,
  Mail,
  User,
  ArrowLeft,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { TicketSearchBar } from "@/components/email/ticket-search-bar";
import { TicketTagBadge } from "@/components/tickets/ticket-tag-badge";

interface TicketsPageProps {
  searchParams: Promise<{
    status?: string;
    prioritaet?: string;
    q?: string;
    tag?: string;
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

export default async function TicketsPage({ searchParams }: TicketsPageProps) {
  const { status, prioritaet, q, tag } = await searchParams;

  const where: any = {
    // Only show tickets created from emails
    emails: { some: {} },
  };

  if (status) where.status = status;
  if (prioritaet) where.prioritaet = prioritaet;
  if (tag) where.tags = { has: tag };
  if (q) {
    where.OR = [
      { titel: { contains: q, mode: "insensitive" } },
      { beschreibung: { contains: q, mode: "insensitive" } },
    ];
  }

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        akte: { select: { id: true, aktenzeichen: true, kurzrubrum: true } },
        verantwortlich: { select: { id: true, name: true } },
        emails: { select: { id: true, betreff: true, absender: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 50,
    }),
    prisma.ticket.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/email"
          className="p-2 rounded-lg hover:bg-white/20 dark:hover:bg-white/[0.06] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-muted-foreground" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-heading text-foreground">
            E-Mail-Tickets
          </h1>
          <p className="text-muted-foreground mt-1">
            {total} Ticket{total !== 1 ? "s" : ""}
            {q ? ` für „${q}"` : " aus E-Mails"}
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <TicketSearchBar
        defaultSearch={q}
        defaultStatus={status}
        defaultPrioritaet={prioritaet}
        defaultTag={tag}
      />

      {/* Ticket list */}
      {tickets.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <Ticket className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">
            {q || status
              ? "Keine Tickets für diese Suche gefunden."
              : "Noch keine Tickets aus E-Mails erstellt."}
          </p>
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden">
          <div className="divide-y divide-white/10 dark:divide-white/[0.04]">
            {tickets.map((ticket) => {
              const StatusIcon = statusIcons[ticket.status] ?? Clock;
              const email = ticket.emails[0];

              return (
                <div
                  key={ticket.id}
                  className="px-6 py-4 hover:bg-white/30 dark:hover:bg-white/[0.05] transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Status icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      <StatusIcon
                        className={`w-5 h-5 ${
                          ticket.status === "ERLEDIGT"
                            ? "text-emerald-500"
                            : ticket.status === "IN_BEARBEITUNG"
                            ? "text-blue-500"
                            : "text-amber-500"
                        }`}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-sm font-medium text-foreground">
                          {ticket.titel}
                        </h3>
                        <Badge
                          className={`text-xs ${statusColors[ticket.status] ?? ""}`}
                        >
                          {statusLabels[ticket.status] ?? ticket.status}
                        </Badge>
                        <Badge
                          className={`text-xs ${prioritaetColors[ticket.prioritaet] ?? ""}`}
                        >
                          {prioritaetLabels[ticket.prioritaet] ?? ticket.prioritaet}
                        </Badge>
                      </div>

                      {ticket.beschreibung && (
                        <p className="text-xs text-muted-foreground truncate mb-2">
                          {ticket.beschreibung.substring(0, 150)}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        {/* Source email */}
                        {email && (
                          <Link
                            href={`/email/${email.id}`}
                            className="flex items-center gap-1 hover:text-brand-600"
                          >
                            <Mail className="w-3 h-3" />
                            <span className="truncate max-w-[200px]">
                              {email.absender}
                            </span>
                          </Link>
                        )}

                        {/* Akte link */}
                        {ticket.akte && (
                          <Link
                            href={`/akten/${ticket.akte.id}`}
                            className="flex items-center gap-1 hover:text-brand-600"
                          >
                            <FolderOpen className="w-3 h-3" />
                            {ticket.akte.aktenzeichen}
                          </Link>
                        )}

                        {/* Verantwortlich */}
                        {ticket.verantwortlich && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {ticket.verantwortlich.name}
                          </span>
                        )}

                        {/* Fälligkeit */}
                        {ticket.faelligAm && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(ticket.faelligAm).toLocaleDateString("de-DE", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit",
                            })}
                          </span>
                        )}

                        {/* Tags */}
                        {ticket.tags.length > 0 && (
                          <div className="flex gap-1">
                            {ticket.tags.map((t) => (
                              <TicketTagBadge
                                key={t}
                                tag={t}
                                className="text-[10px] px-1.5 py-0"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
