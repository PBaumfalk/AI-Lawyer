import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { AktenSearchBar } from "@/components/akten/akten-search-bar";

interface AktenPageProps {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function AktenPage({ searchParams }: AktenPageProps) {
  const { q, status } = await searchParams;

  const where: any = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { aktenzeichen: { contains: q, mode: "insensitive" } },
      { kurzrubrum: { contains: q, mode: "insensitive" } },
      { wegen: { contains: q, mode: "insensitive" } },
    ];
  }

  const akten = await prisma.akte.findMany({
    where,
    include: {
      anwalt: { select: { name: true } },
      sachbearbeiter: { select: { name: true } },
      beteiligte: {
        include: {
          kontakt: {
            select: { vorname: true, nachname: true, firma: true },
          },
        },
      },
    },
    orderBy: { geaendert: "desc" },
    take: 50,
  });

  const statusColor: Record<string, string> = {
    OFFEN:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    RUHEND:
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    ARCHIVIERT:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
    GESCHLOSSEN:
      "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
  };

  const sachgebietLabels: Record<string, string> = {
    ARBEITSRECHT: "Arbeitsrecht",
    FAMILIENRECHT: "Familienrecht",
    VERKEHRSRECHT: "Verkehrsrecht",
    MIETRECHT: "Mietrecht",
    STRAFRECHT: "Strafrecht",
    ERBRECHT: "Erbrecht",
    SOZIALRECHT: "Sozialrecht",
    INKASSO: "Inkasso",
    HANDELSRECHT: "Handelsrecht",
    VERWALTUNGSRECHT: "Verwaltungsrecht",
    SONSTIGES: "Sonstiges",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading text-foreground">
            Akten
          </h1>
          <p className="text-muted-foreground mt-1">
            {akten.length} Akte{akten.length !== 1 ? "n" : ""}{" "}
            {q ? `für "${q}"` : "insgesamt"}
          </p>
        </div>
        <Link href="/akten/neu">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Neue Akte
          </Button>
        </Link>
      </div>

      {/* Search & Filters */}
      <AktenSearchBar defaultSearch={q} defaultStatus={status} />

      {/* Table */}
      {akten.length === 0 ? (
        <div className="glass rounded-xl p-12 text-center">
          <p className="text-muted-foreground mb-4">
            {q
              ? "Keine Akten für diese Suche gefunden."
              : "Noch keine Akten vorhanden."}
          </p>
          {!q && (
            <Link href="/akten/neu">
              <Button>Erste Akte anlegen</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 dark:border-white/[0.06]">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                  Aktenzeichen
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                  Rubrum
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                  Sachgebiet
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                  Anwalt
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 dark:divide-white/[0.04]">
              {akten.map((akte) => (
                <tr
                  key={akte.id}
                  className="hover:bg-white/30 dark:hover:bg-white/[0.04] transition-colors"
                >
                  <td className="px-6 py-4">
                    <Link
                      href={`/akten/${akte.id}`}
                      className="text-sm font-mono text-brand-600 hover:underline"
                    >
                      {akte.aktenzeichen}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-foreground">
                      {akte.kurzrubrum}
                    </p>
                    {akte.wegen && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        wegen {akte.wegen}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground/80">
                    {sachgebietLabels[akte.sachgebiet] ?? akte.sachgebiet}
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground/80">
                    {akte.anwalt?.name ?? "\u2014"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        statusColor[akte.status] ?? ""
                      }`}
                    >
                      {akte.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
