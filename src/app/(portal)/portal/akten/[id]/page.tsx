import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getMandantAkten,
  requireMandantAkteAccess,
} from "@/lib/portal-access";
import { prisma } from "@/lib/db";
import { AkteUebersicht } from "@/components/portal/akte-uebersicht";
import { NaechsteSchritteCard } from "@/components/portal/naechste-schritte-card";
import { SachstandTimeline } from "@/components/portal/sachstand-timeline";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PortalAkteDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PortalAkteDetailPage({
  params,
}: PortalAkteDetailPageProps) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user || (session.user as any).role !== "MANDANT") {
    redirect("/portal/login");
  }

  // Verify Mandant has access to this Akte
  const access = await requireMandantAkteAccess(id, session.user.id);
  if (access.error) {
    redirect("/portal/dashboard");
  }

  // Fetch Akte detail with Gegner + Gericht info (server-side, no API call needed)
  const akte = await prisma.akte.findUnique({
    where: { id },
    select: {
      id: true,
      aktenzeichen: true,
      kurzrubrum: true,
      wegen: true,
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

  // Determine if back link should show (only for multi-Akte Mandanten)
  const allAkten = await getMandantAkten(session.user.id);
  const hasMultipleAkten = allAkten.length > 1;

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
      {/* Back link (only for multi-Akte Mandanten) */}
      {hasMultipleAkten && (
        <Link
          href="/portal/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Zurueck zur Uebersicht
        </Link>
      )}

      {/* Page title */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {akte.aktenzeichen}
        </h1>
        <p className="text-muted-foreground mt-0.5">{akte.kurzrubrum}</p>
      </div>

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
