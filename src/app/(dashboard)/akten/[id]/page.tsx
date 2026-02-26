import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  Users,
  FileText,
  Calendar,
  Clock,
  MessageSquare,
  Mail,
  Sparkles,
} from "lucide-react";
import { AkteDetailTabs } from "@/components/akten/akte-detail-tabs";
import { AkteDetailHeader } from "@/components/akten/akte-detail-header";
import { AkteSocketBridge } from "@/components/akten/akte-socket-bridge";
import { AkteTimerBridge } from "@/components/akten/akte-timer-bridge";
import { AdminOverrideButton } from "@/components/admin/admin-override-button";

interface AkteDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AkteDetailPage({ params }: AkteDetailPageProps) {
  const { id } = await params;

  const akte = await prisma.akte.findUnique({
    where: { id },
    include: {
      anwalt: { select: { id: true, name: true, email: true } },
      sachbearbeiter: { select: { id: true, name: true, email: true } },
      kanzlei: { select: { name: true } },
      beteiligte: {
        include: { kontakt: true },
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
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Fallzusammenfassung
        </Link>
        <AdminOverrideButton akteId={id} aktenzeichen={akte.aktenzeichen} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <StatMini
          icon={Users}
          label="Beteiligte"
          value={akte.beteiligte.length}
        />
        <StatMini
          icon={FileText}
          label="Dokumente"
          value={akte._count.dokumente}
        />
        <StatMini
          icon={Calendar}
          label="Termine/Fristen"
          value={akte._count.kalenderEintraege}
        />
        <StatMini
          icon={Mail}
          label="E-Mails"
          value={akte._count.emailMessages}
        />
        <StatMini
          icon={Clock}
          label="Zeiterfassung"
          value={akte._count.zeiterfassungen}
        />
        <StatMini
          icon={MessageSquare}
          label="Nachrichten"
          value={akte._count.chatNachrichten}
        />
      </div>

      {/* Tabbed content */}
      <AkteDetailTabs akte={serializedAkte} />
    </div>
  );
}

function StatMini({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="glass-card rounded-xl px-4 py-3 flex items-center gap-3">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <div>
        <p className="text-lg font-semibold text-foreground">
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
