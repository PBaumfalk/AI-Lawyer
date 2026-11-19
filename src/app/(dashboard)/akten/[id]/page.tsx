import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { KONTAKT_ADRESSEN_INCLUDE } from "@/lib/kontakte/liste";
import { auth } from "@/lib/auth";
import { canAccessAkte } from "@/lib/rbac";
import { Sparkles } from "lucide-react";
import { AkteDetailHeader } from "@/components/akten/akte-detail-header";
import { NormenSection } from "@/components/akten/normen-section";
import { AkteSocketBridge } from "@/components/akten/akte-socket-bridge";
import { AkteTimerBridge } from "@/components/akten/akte-timer-bridge";
import { AdminOverrideButton } from "@/components/admin/admin-override-button";
import { NaechsteSchritteEditor } from "@/components/akten/naechste-schritte-editor";
import { AkteDetailClient } from "./akte-detail-client";

interface AkteDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AkteDetailPage({ params }: AkteDetailPageProps) {
  const { id } = await params;

  // Access check first; unknown and forbidden Akten both look like 404 so the
  // page does not reveal whether an Akte exists.
  const session = await auth();
  if (!session?.user) notFound();
  const sessionUser = { id: session.user.id!, role: (session.user as any).role };
  if (!(await canAccessAkte(sessionUser, id))) notFound();

  const akte = await prisma.akte.findUnique({
    where: { id },
    include: {
      anwalt: { select: { id: true, name: true, email: true } },
      sachbearbeiter: { select: { id: true, name: true, email: true } },
      kanzlei: { select: { name: true } },
      beteiligte: {
        include: { kontakt: { include: KONTAKT_ADRESSEN_INCLUDE } },
        orderBy: { createdAt: "asc" },
      },
      dokumente: {
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { name: true } },
          freigegebenDurch: { select: { id: true, name: true } },
        },
      },
      kalenderEintraege: {
        orderBy: { datum: "asc" },
        include: { verantwortlich: { select: { name: true } } },
      },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { name: true } } },
      },
      normen: {
        include: { addedBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: {
          dokumente: true,
          kalenderEintraege: true,
          zeiterfassungen: true,
          chatNachrichten: true,
          emailMessages: true,
        },
      },
    },
  });

  if (!akte) notFound();

  // Role-based rendering (NaechsteSchritteEditor)
  const userRole = (session?.user as any)?.role as string | undefined;
  const canEditNaechsteSchritte =
    userRole === "ADMIN" || userRole === "ANWALT" || userRole === "SACHBEARBEITER";

  const serializedAkte = JSON.parse(JSON.stringify(akte));

  return (
    <div className="space-y-6">
      {/* Socket.IO bridge for real-time OCR notifications */}
      <AkteSocketBridge akteId={id} />

      {/* Auto-start time tracking timer when opening any Akte */}
      <AkteTimerBridge akteId={id} />

      {/* Header with edit + status controls */}
      <AkteDetailHeader akte={serializedAkte} />

      {/* Helena quick action + Admin override */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href={`/ki-chat?akteId=${id}&q=${encodeURIComponent("Erstelle eine Fallzusammenfassung fuer diese Akte")}`}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 hover:bg-brand-200 dark:hover:bg-brand-900 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Fallzusammenfassung
        </Link>
        <AdminOverrideButton akteId={id} aktenzeichen={akte.aktenzeichen} />
      </div>

      {/* Verknuepfte Normen -- pinned for Helena context */}
      <NormenSection
        akteId={id}
        initialNormen={serializedAkte.normen ?? []}
      />

      {/* Naechste Schritte for Mandant -- only visible to Anwalt/Sachbearbeiter/Admin */}
      {canEditNaechsteSchritte && (
        <NaechsteSchritteEditor
          akteId={id}
          initialText={akte.naechsteSchritte ?? null}
        />
      )}

      {/* KPI stats row + tabbed content (client component for interactivity) */}
      <Suspense fallback={null}>
        <AkteDetailClient akte={serializedAkte} />
      </Suspense>
    </div>
  );
}

