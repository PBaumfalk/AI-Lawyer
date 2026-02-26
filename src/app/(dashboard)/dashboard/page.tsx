import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildAkteAccessFilter } from "@/lib/rbac";
import type { UserRole } from "@prisma/client";
import {
  FolderOpen,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { GlassKpiCard } from "@/components/ui/glass-kpi-card";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Tagesuebersicht } from "@/components/fristen/tagesuebersicht";

export default async function DashboardPage() {
  const session = await auth();

  // Build user-scoped access filter for all dashboard queries
  const userId = session?.user?.id ?? "";
  const userRole = ((session?.user as any)?.role ?? "SACHBEARBEITER") as UserRole;
  const accessFilter = buildAkteAccessFilter(userId, userRole);

  // Fetch dashboard stats in parallel
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [offeneAkten, fristenHeute, ueberfaelligeFristen, erledigteAufgaben, letzteAkten, anstehendeFristen] =
    await Promise.all([
      // Open cases count -- user-scoped
      prisma.akte.count({ where: { status: "OFFEN", ...accessFilter } }),
      // Deadlines today -- user-scoped via akte relation
      prisma.kalenderEintrag.count({
        where: {
          erledigt: false,
          typ: "FRIST",
          datum: { gte: today, lt: tomorrow },
          akte: accessFilter,
        },
      }),
      // Overdue deadlines -- user-scoped via akte relation
      prisma.kalenderEintrag.count({
        where: {
          erledigt: false,
          typ: { in: ["FRIST", "WIEDERVORLAGE"] },
          datum: { lt: today },
          akte: accessFilter,
        },
      }),
      // Completed tasks (last 30 days) -- user-scoped via akte relation
      prisma.kalenderEintrag.count({
        where: {
          erledigt: true,
          erledigtAm: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          akte: accessFilter,
        },
      }),
      // Recently modified cases -- user-scoped
      prisma.akte.findMany({
        where: { status: { in: ["OFFEN", "RUHEND"] }, ...accessFilter },
        include: {
          anwalt: { select: { name: true } },
          _count: { select: { dokumente: true, kalenderEintraege: true } },
        },
        orderBy: { geaendert: "desc" },
        take: 5,
      }),
      // Upcoming deadlines/appointments -- user-scoped via akte relation
      prisma.kalenderEintrag.findMany({
        where: {
          erledigt: false,
          datum: { gte: today },
          akte: accessFilter,
        },
        include: {
          akte: { select: { aktenzeichen: true, kurzrubrum: true } },
          verantwortlich: { select: { name: true } },
        },
        orderBy: { datum: "asc" },
        take: 5,
      }),
    ]);

  const statusColor: Record<string, string> = {
    OFFEN: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    RUHEND: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  };

  const typColor: Record<string, string> = {
    FRIST: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
    TERMIN: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
    WIEDERVORLAGE: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  };

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Willkommen, {session?.user?.name?.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground mt-1">
          Hier ist Ihre Tagesübersicht.
        </p>
      </div>

      {/* Stats Grid */}
      <section className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassKpiCard
            title="Offene Akten"
            value={offeneAkten}
            icon={FolderOpen}
            color="blue"
          />
          <GlassKpiCard
            title="Fristen heute"
            value={fristenHeute}
            icon={Clock}
            color="amber"
          />
          <GlassKpiCard
            title="Überfällige Fristen"
            value={ueberfaelligeFristen}
            icon={AlertTriangle}
            color="rose"
          />
          <GlassKpiCard
            title="Erledigt (30 Tage)"
            value={erledigteAufgaben}
            icon={CheckCircle2}
            color="emerald"
          />
        </div>
      </section>

      {/* Tagesuebersicht -- wrapped in GlassPanel */}
      <GlassPanel elevation="panel">
        <Tagesuebersicht />
      </GlassPanel>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Cases */}
        <GlassCard className="p-0">
          <div className="px-6 py-4 border-b border-[var(--glass-border-color)]">
            <h2 className="text-lg font-semibold text-foreground">
              Zuletzt bearbeitete Akten
            </h2>
          </div>
          <div className="p-6">
            {letzteAkten.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                Noch keine Akten vorhanden.
                <br />
                <Link
                  href="/akten/neu"
                  className="text-brand-600 hover:underline mt-1 inline-block"
                >
                  Erste Akte anlegen
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {letzteAkten.map((akte, i) => (
                  <Link
                    key={akte.id}
                    href={`/akten/${akte.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-white/30 dark:hover:bg-white/[0.05] transition-colors -mx-1 list-item-in"
                    style={i < 10 ? { animationDelay: `${i * 50}ms` } : undefined}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-brand-600">
                          {akte.aktenzeichen}
                        </span>
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusColor[akte.status] ?? ""}`}
                        >
                          {akte.status}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground truncate mt-0.5">
                        {akte.kurzrubrum}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {akte.anwalt?.name ?? "Kein Anwalt"} &middot;{" "}
                        {akte._count.dokumente} Dok. &middot;{" "}
                        {akte._count.kalenderEintraege} Termine
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </GlassCard>

        {/* Upcoming Deadlines */}
        <GlassCard className="p-0">
          <div className="px-6 py-4 border-b border-[var(--glass-border-color)]">
            <h2 className="text-lg font-semibold text-foreground">
              Anstehende Fristen &amp; Termine
            </h2>
          </div>
          <div className="p-6">
            {anstehendeFristen.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                Keine anstehenden Fristen oder Termine.
              </div>
            ) : (
              <div className="space-y-3">
                {anstehendeFristen.map((eintrag, i) => (
                  <div
                    key={eintrag.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/30 dark:hover:bg-white/[0.05] transition-colors -mx-1 list-item-in"
                    style={i < 10 ? { animationDelay: `${i * 50}ms` } : undefined}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${typColor[eintrag.typ] ?? ""}`}
                        >
                          {eintrag.typ}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(eintrag.datum).toLocaleDateString("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-foreground mt-0.5">
                        {eintrag.titel}
                      </p>
                      {eintrag.akte && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {eintrag.akte.aktenzeichen} – {eintrag.akte.kurzrubrum}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
