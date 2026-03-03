import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AkteUebersicht } from "@/components/portal/akte-uebersicht";
import { NaechsteSchritteCard } from "@/components/portal/naechste-schritte-card";
import { SachstandTimeline } from "@/components/portal/sachstand-timeline";

export const dynamic = "force-dynamic";

interface PortalAkteDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PortalAkteDetailPage({
  params,
}: PortalAkteDetailPageProps) {
  const { id } = await params;

  // Defense-in-depth auth check (layout is the primary gate)
  const session = await auth();
  if (!session?.user || (session.user as any).role !== "MANDANT") {
    redirect("/portal/login");
  }

  // Fetch Akte detail with Gegner + Gericht info for Uebersicht content
  const akte = await prisma.akte.findUnique({
    where: { id },
    select: {
      id: true,
      sachgebiet: true,
      status: true,
      naechsteSchritte: true,
      beteiligte: {
        where: { rolle: { in: ["GEGNER", "GERICHT"] } },
        select: {
          rolle: true,
          kontakt: {
            select: {
              vorname: true,
              nachname: true,
              firma: true,
            },
          },
        },
      },
    },
  });

  if (!akte) {
    redirect("/portal/dashboard");
  }

  // Extract Gegner and Gericht display names
  const gegnerNames = akte.beteiligte
    .filter((b) => b.rolle === "GEGNER")
    .map((b) =>
      b.kontakt.firma
        ? b.kontakt.firma
        : [b.kontakt.vorname, b.kontakt.nachname].filter(Boolean).join(" ")
    );

  const gerichtNames = akte.beteiligte
    .filter((b) => b.rolle === "GERICHT")
    .map((b) => b.kontakt.firma ?? "");

  const gegnerDisplay = gegnerNames.length > 0 ? gegnerNames.join(", ") : null;
  const gerichtDisplay =
    gerichtNames.filter(Boolean).length > 0
      ? gerichtNames.filter(Boolean).join(", ")
      : null;

  return (
    <div className="space-y-6">
      {/* Two-column layout: Timeline (left 2/3) + Info sidebar (right 1/3) */}
      <div className="flex flex-col-reverse lg:flex-row gap-6">
        {/* Left column: Timeline */}
        <div className="flex-1 lg:w-2/3">
          <SachstandTimeline akteId={akte.id} />
        </div>

        {/* Right column: Overview + Naechste Schritte */}
        <div className="lg:w-1/3 space-y-4">
          <AkteUebersicht
            sachgebiet={akte.sachgebiet}
            status={akte.status}
            gegnerName={gegnerDisplay}
            gerichtName={gerichtDisplay}
          />
          <NaechsteSchritteCard
            naechsteSchritte={akte.naechsteSchritte}
          />
        </div>
      </div>
    </div>
  );
}
