import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Building2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { KontakteSearchBar } from "@/components/kontakte/kontakte-search-bar";
import { KontakteToolbar } from "@/components/kontakte/kontakte-toolbar";
import { GlassPanel } from "@/components/ui/glass-panel";

interface KontaktePageProps {
  searchParams: Promise<{ q?: string; typ?: string; tag?: string }>;
}

export default async function KontaktePage({
  searchParams,
}: KontaktePageProps) {
  const { q, typ, tag } = await searchParams;

  const where: any = {};
  if (typ) where.typ = typ;
  if (tag) where.tags = { has: tag };
  if (q) {
    where.OR = [
      { nachname: { contains: q, mode: "insensitive" } },
      { vorname: { contains: q, mode: "insensitive" } },
      { firma: { contains: q, mode: "insensitive" } },
      { kurzname: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { ort: { contains: q, mode: "insensitive" } },
      { telefon: { contains: q, mode: "insensitive" } },
      { mandantennummer: { contains: q, mode: "insensitive" } },
      { ustIdNr: { contains: q, mode: "insensitive" } },
    ];
  }

  const [kontakte, total, allKontakteTags] = await Promise.all([
    prisma.kontakt.findMany({
      where,
      orderBy: [{ nachname: "asc" }, { firma: "asc" }],
      take: 50,
      include: {
        _count: { select: { beteiligte: true } },
      },
    }),
    prisma.kontakt.count({ where }),
    // Get all distinct tags for filter chips
    prisma.kontakt.findMany({
      where: { tags: { isEmpty: false } },
      select: { tags: true },
    }),
  ]);

  // Collect unique tags sorted alphabetically
  const tagSet = new Set<string>();
  for (const k of allKontakteTags) {
    for (const t of k.tags) tagSet.add(t);
  }
  const availableTags = Array.from(tagSet).sort();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Kontakte
          </h1>
          <p className="text-muted-foreground mt-1">
            {total} Kontakt{total !== 1 ? "e" : ""}{" "}
            {q ? `für "${q}"` : "insgesamt"}
          </p>
        </div>
        <KontakteToolbar />
      </div>

      {/* Search & Filters */}
      <KontakteSearchBar
        defaultSearch={q}
        defaultTyp={typ}
        defaultTag={tag}
        availableTags={availableTags}
      />

      {/* Table */}
      {kontakte.length === 0 ? (
        <GlassPanel elevation="panel" className="p-12 text-center">
          <p className="text-slate-400 mb-4">
            {q || tag
              ? "Keine Kontakte für diese Suche gefunden."
              : "Noch keine Kontakte vorhanden."}
          </p>
          {!q && !tag && (
            <Link href="/kontakte/neu">
              <Button>Ersten Kontakt anlegen</Button>
            </Link>
          )}
        </GlassPanel>
      ) : (
        <GlassPanel elevation="panel" className="overflow-hidden rounded-xl">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--glass-border-color)]">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                  Typ
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                  Name / Firma
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3 hidden md:table-cell">
                  Ort
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3 hidden lg:table-cell">
                  Kontaktdaten
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3 hidden xl:table-cell">
                  Mandanten-Nr.
                </th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3 hidden lg:table-cell">
                  Akten
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--glass-border-color)]">
              {kontakte.map((kontakt, idx) => {
                const displayName =
                  kontakt.typ === "NATUERLICH"
                    ? `${kontakt.vorname ?? ""} ${kontakt.nachname ?? ""}`.trim()
                    : kontakt.firma ?? "";

                return (
                  <tr
                    key={kontakt.id}
                    className={`hover:bg-white/30 dark:hover:bg-white/[0.05] transition-colors${idx < 10 ? " list-item-in" : ""}`}
                    style={idx < 10 ? { animationDelay: `${idx * 50}ms` } : undefined}
                  >
                    <td className="px-6 py-4">
                      <div className="w-8 h-8 rounded-full bg-white/20 dark:bg-white/[0.06] flex items-center justify-center">
                        {kontakt.typ === "NATUERLICH" ? (
                          <User className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/kontakte/${kontakt.id}`}
                        className="text-sm font-medium text-brand-600 hover:underline"
                      >
                        {displayName || "—"}
                      </Link>
                      {kontakt.typ === "JURISTISCH" && kontakt.rechtsform && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {kontakt.rechtsform}
                        </p>
                      )}
                      {kontakt.typ === "JURISTISCH" && kontakt.nachname && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Ansprechpartner: {kontakt.vorname ? `${kontakt.vorname} ` : ""}
                          {kontakt.nachname}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground/80 hidden md:table-cell">
                      {kontakt.ort
                        ? `${kontakt.plz ? kontakt.plz + " " : ""}${kontakt.ort}`
                        : "—"}
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <div className="space-y-0.5">
                        {kontakt.email && (
                          <p className="text-sm text-foreground/80 truncate max-w-[200px]">
                            {kontakt.email}
                          </p>
                        )}
                        {kontakt.telefon && (
                          <p className="text-xs text-muted-foreground">
                            {kontakt.telefon}
                          </p>
                        )}
                        {!kontakt.email && !kontakt.telefon && (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden xl:table-cell">
                      {kontakt.mandantennummer ? (
                        <span className="text-xs font-mono text-foreground/80">{kontakt.mandantennummer}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground/80 hidden lg:table-cell">
                      {kontakt._count.beteiligte > 0
                        ? kontakt._count.beteiligte
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </GlassPanel>
      )}
    </div>
  );
}
