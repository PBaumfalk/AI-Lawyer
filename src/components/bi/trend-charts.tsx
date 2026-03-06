"use client";

import {
  ResponsiveContainer,
  LineChart,
  AreaChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { GlassCard } from "@/components/ui/glass-card";
import type { TrendSeries } from "@/lib/bi/types";

const COLORS = [
  "rgb(59, 130, 246)",   // blue-500
  "rgb(16, 185, 129)",   // emerald-500
  "rgb(245, 158, 11)",   // amber-500
  "rgb(244, 63, 94)",    // rose-500
  "rgb(139, 92, 246)",   // violet-500
];

function formatTooltipValue(value: number, seriesId: string): string {
  if (seriesId.includes("umsatz")) {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (seriesId.includes("compliance")) {
    return `${value.toFixed(1)}%`;
  }
  return new Intl.NumberFormat("de-DE").format(value);
}

interface TrendChartsProps {
  series: TrendSeries[];
  loading: boolean;
}

export function TrendCharts({ series, loading }: TrendChartsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6">
        {[1, 2, 3].map((i) => (
          <GlassCard key={i} className="p-6">
            <div className="h-[300px] glass-shimmer rounded-lg" />
          </GlassCard>
        ))}
      </div>
    );
  }

  if (series.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      {series.map((s, idx) => {
        const color = COLORS[idx % COLORS.length];
        const chartData = s.data.map((point) => ({
          label: point.label,
          value: point.value,
        }));

        return (
          <GlassCard key={s.id} className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              {s.label}
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              {s.type === "area" ? (
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient
                      id={`gradient-${s.id}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(128,128,128,0.15)"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12 }}
                    stroke="rgba(128,128,128,0.5)"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="rgba(128,128,128,0.5)"
                    width={60}
                  />
                  <Tooltip
                    formatter={(value) => [
                      formatTooltipValue(Number(value), s.id),
                      s.label,
                    ]}
                    contentStyle={{
                      backgroundColor: "rgba(255,255,255,0.9)",
                      border: "1px solid rgba(128,128,128,0.2)",
                      borderRadius: "8px",
                      backdropFilter: "blur(8px)",
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="value"
                    name={s.label}
                    stroke={color}
                    fill={`url(#gradient-${s.id})`}
                    strokeWidth={2}
                  />
                </AreaChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(128,128,128,0.15)"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12 }}
                    stroke="rgba(128,128,128,0.5)"
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    stroke="rgba(128,128,128,0.5)"
                    width={60}
                  />
                  <Tooltip
                    formatter={(value) => [
                      formatTooltipValue(Number(value), s.id),
                      s.label,
                    ]}
                    contentStyle={{
                      backgroundColor: "rgba(255,255,255,0.9)",
                      border: "1px solid rgba(128,128,128,0.2)",
                      borderRadius: "8px",
                      backdropFilter: "blur(8px)",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name={s.label}
                    stroke={color}
                    strokeWidth={2}
                    dot={{ fill: color, r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </GlassCard>
        );
      })}
    </div>
  );
}
