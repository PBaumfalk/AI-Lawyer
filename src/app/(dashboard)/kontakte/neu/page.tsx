import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { KontaktForm } from "@/components/kontakte/kontakt-form";
import { prisma } from "@/lib/db";

export default async function NeuerKontaktPage() {
  const feldDefs = await prisma.kontaktFeldDefinition.findMany({
    where: { aktiv: true },
    orderBy: { sortierung: "asc" },
  });

  const customFieldDefs = feldDefs.map((f) => ({
    id: f.id,
    key: f.key,
    label: f.label,
    typ: f.typ,
    optionen: f.optionen as { value: string; label: string }[] | null,
    pflicht: f.pflicht,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/kontakte"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Zurück zur Übersicht
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">
          Neuer Kontakt
        </h1>
        <p className="text-muted-foreground mt-1">
          Erstellen Sie einen neuen Kontakt (natürliche oder juristische Person).
        </p>
      </div>

      <KontaktForm mode="create" customFieldDefs={customFieldDefs} />
    </div>
  );
}
