import { redirect } from "next/navigation";
import { Target, TrendingUp, TrendingDown, Minus, Swords } from "lucide-react";
import { format, subMonths } from "date-fns";
import { de } from "date-fns/locale";

import { auth } from "@/lib/auth";
import { getTeamMetrics } from "@/lib/gamification/team-metrics";
import { GlassKpiCard } from "@/components/ui/glass-kpi-card";
import { GlassPanel } from "@/components/ui/glass-panel";
import { BacklogTrendChart } from "@/components/admin/team-dashboard/backlog-trend-chart";
import { BossfightHistory } from "@/components/admin/team-dashboard/bossfight-history";
import { ExportDropdown } from "@/components/admin/team-dashboard/export-dropdown";

export const dynamic = "force-dynamic";

export default async function TeamDashboardPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const kanzleiId = session.user.kanzleiId;
  if (!kanzleiId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Keine Kanzlei zugeordnet.
      </div>
    );
  }

  const { questRate, backlog, bossfight } = await getTeamMetrics(kanzleiId);

  // Month label for export button (last calendar month)
  const lastMonth = subMonths(new Date(), 1);
  const monthLabel = format(lastMonth, "MMMM yyyy", { locale: de });

  // Total damage across all bossfights
  const totalBossfightDamage = bossfight.history.reduce(
    (sum, bf) => sum + bf.totalDamage,
    0,
  );

  // Trend display config
  const trendConfig = {
    steigend: {
      icon: <TrendingUp className="h-4 w-4 inline" />,
      label: "Steigend",
      colorClass: "text-rose-500",
    },
    fallend: {
      icon: <TrendingDown className="h-4 w-4 inline" />,
      label: "Fallend",
      colorClass: "text-emerald-500",
    },
    stabil: {
      icon: <Minus className="h-4 w-4 inline" />,
      label: "Stabil",
      colorClass: "text-amber-500",
    },
  } as const;

  const trend = trendConfig[backlog.trend];

  // Icon for backlog KPI card (matches trend direction)
  const BacklogIcon =
    backlog.trend === "fallend"
      ? TrendingDown
      : backlog.trend === "steigend"
        ? TrendingUp
        : Minus;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Team-Dashboard</h1>
        <ExportDropdown monthLabel={monthLabel} />
      </div>

      {/* KPI Row: 3 GlassKpiCards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassKpiCard
          title="Quest-Erfuellungsquote"
          value={`${questRate}%`}
          icon={<Target className="h-5 w-5" />}
          color="emerald"
        />
        <GlassKpiCard
          title="Offene Wiedervorlagen"
          value={backlog.currentCount}
          icon={<BacklogIcon className="h-5 w-5" />}
          color={
            backlog.trend === "fallend"
              ? "emerald"
              : backlog.trend === "steigend"
                ? "rose"
                : "amber"
          }
        />
        <GlassKpiCard
          title="Bossfight-Teamschaden"
          value={totalBossfightDamage}
          icon={<Swords className="h-5 w-5" />}
          color="blue"
        />
      </div>

      {/* Backlog Trend Section */}
      <GlassPanel>
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-1">Backlog-Verlauf</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Offene Wiedervorlagen der letzten 8 Wochen
            <span className={`ml-2 ${trend.colorClass}`}>
              {trend.icon} {trend.label}
            </span>
          </p>
          <BacklogTrendChart data={backlog.dataPoints} />
        </div>
      </GlassPanel>

      {/* Bossfight History Section */}
      <GlassPanel>
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Bossfight-Historie</h2>
          <BossfightHistory history={bossfight.history} />
        </div>
      </GlassPanel>
    </div>
  );
}
