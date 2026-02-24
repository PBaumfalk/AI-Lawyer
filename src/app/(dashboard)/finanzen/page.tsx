"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlassKpiCard } from "@/components/ui/glass-kpi-card";
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  Banknote,
  Calculator,
  Receipt,
  Building2,
} from "lucide-react";

interface FinanzenSummary {
  umsatzMtd: number;
  umsatzYtd: number;
  offeneForderungen: number;
  ueberfaelligeRechnungen: number;
  fremdgeldWarnungen: number;
}

function formatEuro(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export default function FinanzenPage() {
  const [summary, setSummary] = useState<FinanzenSummary>({
    umsatzMtd: 0,
    umsatzYtd: 0,
    offeneForderungen: 0,
    ueberfaelligeRechnungen: 0,
    fremdgeldWarnungen: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSummary() {
      try {
        // Fetch invoice summary stats
        const invoiceRes = await fetch("/api/finanzen/rechnungen?limit=0");
        if (invoiceRes.ok) {
          const invoiceData = await invoiceRes.json();
          const stats = invoiceData.stats;
          if (stats) {
            setSummary((prev) => ({
              ...prev,
              umsatzMtd: stats.gesamtUmsatz ?? 0,
              umsatzYtd: stats.gesamtUmsatz ?? 0,
              offeneForderungen: stats.offeneForderungen ?? 0,
              ueberfaelligeRechnungen: stats.ueberfaellig ?? 0,
            }));
          }
        }

        // Fetch Fremdgeld alerts count
        const aktenkontoRes = await fetch("/api/finanzen/aktenkonto");
        if (aktenkontoRes.ok) {
          const aktenkontoData = await aktenkontoRes.json();
          if (aktenkontoData.fremdgeldAlerts) {
            setSummary((prev) => ({
              ...prev,
              fremdgeldWarnungen: aktenkontoData.fremdgeldAlerts.length ?? 0,
            }));
          }
        }
      } catch {
        // Silently handle fetch errors (APIs may not be fully connected yet)
      } finally {
        setLoading(false);
      }
    }

    fetchSummary();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading text-foreground">
          Finanzen
        </h1>
        <p className="text-muted-foreground mt-1">
          RVG-Berechnung, Rechnungen, Aktenkonto &amp; Zeiterfassung
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassKpiCard
          title="Umsatz (Monat)"
          value={loading ? "..." : formatEuro(summary.umsatzMtd)}
          icon={TrendingUp}
          color="emerald"
        />
        <GlassKpiCard
          title="Offene Forderungen"
          value={loading ? "..." : formatEuro(summary.offeneForderungen)}
          icon={Banknote}
          color="blue"
        />
        <GlassKpiCard
          title="Ueberfaellige Rechnungen"
          value={loading ? "..." : String(summary.ueberfaelligeRechnungen)}
          icon={Clock}
          color={summary.ueberfaelligeRechnungen > 0 ? "amber" : "emerald"}
        />
        <GlassKpiCard
          title="Fremdgeld-Warnungen"
          value={loading ? "..." : String(summary.fremdgeldWarnungen)}
          icon={AlertTriangle}
          color={summary.fremdgeldWarnungen > 0 ? "rose" : "emerald"}
        />
      </div>

      {/* Quick Actions */}
      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Schnellaktionen
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/finanzen/rechner"
            className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-medium text-foreground">Neue Berechnung</p>
              <p className="text-sm text-muted-foreground">
                RVG-Gebuehren berechnen
              </p>
            </div>
          </Link>

          <Link
            href="/finanzen/rechnungen"
            className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-medium text-foreground">Neue Rechnung</p>
              <p className="text-sm text-muted-foreground">
                Rechnung erstellen
              </p>
            </div>
          </Link>

          <Link
            href="/finanzen/aktenkonto"
            className="flex items-center gap-3 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-medium text-foreground">Banking-Import</p>
              <p className="text-sm text-muted-foreground">
                Kontoauszuege importieren
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
