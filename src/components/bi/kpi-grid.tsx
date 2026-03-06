"use client";

import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import {
  FolderOpen,
  Wallet,
  Calendar,
  Sparkles,
} from "lucide-react";
import { GlassKpiCard } from "@/components/ui/glass-kpi-card";
import type { KpiTile } from "@/lib/bi/types";
import { cn } from "@/lib/utils";

const DOMAIN_CONFIG: Record<
  KpiTile["domain"],
  {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    color: "blue" | "amber" | "rose" | "emerald";
  }
> = {
  akten: { title: "Akten", icon: FolderOpen, color: "blue" },
  finanzen: { title: "Finanzen", icon: Wallet, color: "amber" },
  fristen: { title: "Fristen", icon: Calendar, color: "rose" },
  helena: { title: "Helena", icon: Sparkles, color: "emerald" },
};

function formatValue(value: number, unit?: string): string {
  if (unit === "EUR") {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (unit === "%") {
    return `${value.toFixed(1)}%`;
  }
  return new Intl.NumberFormat("de-DE").format(value);
}

function DeltaIndicator({ delta }: { delta: number }) {
  const isPositive = delta > 0;
  const isNegative = delta < 0;
  const isZero = delta === 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        isPositive && "text-emerald-600 dark:text-emerald-400",
        isNegative && "text-red-600 dark:text-red-400",
        isZero && "text-muted-foreground"
      )}
    >
      {isPositive && <ArrowUpRight className="w-3.5 h-3.5" />}
      {isNegative && <ArrowDownRight className="w-3.5 h-3.5" />}
      {isZero && <Minus className="w-3.5 h-3.5" />}
      {isPositive ? "+" : ""}
      {delta.toFixed(1)}%
    </span>
  );
}

interface KpiGridProps {
  tiles: KpiTile[];
  loading: boolean;
}

export function KpiGrid({ tiles, loading }: KpiGridProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        {(["akten", "finanzen", "fristen", "helena"] as const).map((domain) => (
          <div key={domain}>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {DOMAIN_CONFIG[domain].title}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2].map((i) => (
                <GlassKpiCard
                  key={i}
                  skeleton
                  title=""
                  value={0}
                  icon={null}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Group tiles by domain
  const grouped = (["akten", "finanzen", "fristen", "helena"] as const).map(
    (domain) => ({
      domain,
      config: DOMAIN_CONFIG[domain],
      tiles: tiles.filter((t) => t.domain === domain),
    })
  );

  return (
    <div className="space-y-6">
      {grouped.map(
        ({ domain, config, tiles: domainTiles }) =>
          domainTiles.length > 0 && (
            <div key={domain}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {config.title}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {domainTiles.map((tile) => {
                  const Icon = config.icon;
                  return (
                    <div key={tile.id} className="flex flex-col">
                      <GlassKpiCard
                        title={tile.label}
                        value={formatValue(tile.value, tile.unit)}
                        icon={<Icon className="w-5 h-5" />}
                        color={config.color}
                      />
                      <div className="mt-1 px-5">
                        <DeltaIndicator delta={tile.delta} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
      )}
    </div>
  );
}
