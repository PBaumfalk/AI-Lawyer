import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { KontaktForm } from "@/components/kontakte/kontakt-form";

interface KontaktBearbeitenPageProps {
  params: Promise<{ id: string }>;
}

export default async function KontaktBearbeitenPage({
  params,
}: KontaktBearbeitenPageProps) {
  const { id } = await params;

  const [kontakt, feldDefs] = await Promise.all([
    prisma.kontakt.findUnique({
      where: { id },
      include: {
        adressen: { orderBy: [{ istHaupt: "desc" }, { createdAt: "asc" }] },
        identitaetsPruefungen: { orderBy: { createdAt: "desc" } },
        vollmachtenAlsGeber: {
          include: { nehmer: { select: { id: true, vorname: true, nachname: true, firma: true, typ: true } } },
          orderBy: { createdAt: "desc" },
        },
        kontaktDokumente: { orderBy: { createdAt: "desc" } },
        beziehungenVon: {
          include: { zuKontakt: { select: { id: true, vorname: true, nachname: true, firma: true, typ: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.kontaktFeldDefinition.findMany({
      where: { aktiv: true },
      orderBy: { sortierung: "asc" },
    }),
  ]);

  if (!kontakt) notFound();

  const serialized = JSON.parse(JSON.stringify(kontakt));

  const customFieldDefs = feldDefs.map((f) => ({
    id: f.id,
    key: f.key,
    label: f.label,
    typ: f.typ,
    optionen: f.optionen as { value: string; label: string }[] | null,
    pflicht: f.pflicht,
  }));

  const displayName =
    kontakt.typ === "NATUERLICH"
      ? `${kontakt.vorname ?? ""} ${kontakt.nachname ?? ""}`.trim()
      : kontakt.firma ?? "";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/kontakte/${id}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Zurück zu {displayName}
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">
          Kontakt bearbeiten
        </h1>
        <p className="text-muted-foreground mt-1">
          {displayName}
        </p>
      </div>

      <KontaktForm kontakt={serialized} mode="edit" customFieldDefs={customFieldDefs} />
    </div>
  );
}
