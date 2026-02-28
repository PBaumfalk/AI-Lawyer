"use client";

/**
 * Admin Falldaten-Templates review queue
 *
 * Shows EINGEREICHT templates for admin review + recent decisions history.
 * Admin auth is enforced by the admin layout wrapper.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardCheck,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TemplateRow {
  id: string;
  name: string;
  beschreibung: string | null;
  sachgebiet: string | null;
  status: "ENTWURF" | "EINGEREICHT" | "GENEHMIGT" | "ABGELEHNT" | "STANDARD";
  erstelltVon: { id: string; name: string };
  geprueftVon: { name: string } | null;
  geprueftAt: string | null;
  ablehnungsgrund: string | null;
  feldCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Page component ──────────────────────────────────────────────────────────

export default function AdminFalldatenTemplatesPage() {
  const [pending, setPending] = useState<TemplateRow[]>([]);
  const [history, setHistory] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all templates visible to admin, then filter client-side
      const res = await fetch("/api/falldaten-templates");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      const all: TemplateRow[] = data.templates ?? [];

      // Pending review queue
      const pendingItems = all.filter((t) => t.status === "EINGEREICHT");
      setPending(pendingItems);

      // Recent decisions (GENEHMIGT + ABGELEHNT, sorted by geprueftAt desc, last 10)
      const decided = all
        .filter(
          (t) => t.status === "GENEHMIGT" || t.status === "ABGELEHNT"
        )
        .sort((a, b) => {
          const dateA = a.geprueftAt
            ? new Date(a.geprueftAt).getTime()
            : 0;
          const dateB = b.geprueftAt
            ? new Date(b.geprueftAt).getTime()
            : 0;
          return dateB - dateA;
        })
        .slice(0, 10);
      setHistory(decided);
    } catch {
      // Errors are non-critical here, just show empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Falldaten-Templates -- Pruefung
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Templates pruefen, genehmigen oder ablehnen
        </p>
      </div>

      {/* Pending review queue */}
      <GlassPanel className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold">Zur Pruefung</h2>
            {pending.length > 0 && (
              <Badge
                variant="default"
                className="bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-300"
              >
                {pending.length}
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
          >
            {loading ? "Laedt..." : "Aktualisieren"}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-8 justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Wird geladen...
            </span>
          </div>
        ) : pending.length === 0 ? (
          <div className="py-8 text-center">
            <ClipboardCheck className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Keine Templates zur Pruefung vorhanden.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                    Ersteller
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                    Sachgebiet
                  </th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">
                    Felder
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                    Eingereicht am
                  </th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                    Aktion
                  </th>
                </tr>
              </thead>
              <tbody>
                {pending.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                  >
                    <td
                      className="py-3 px-3 font-medium max-w-[200px] truncate"
                      title={t.name}
                    >
                      {t.name}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">
                      {t.erstelltVon.name}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">
                      {t.sachgebiet ?? "--"}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      {t.feldCount}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                      {new Date(t.updatedAt).toLocaleDateString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3 px-3">
                      <Link href={`/admin/falldaten-templates/${t.id}`}>
                        <Button variant="outline" size="sm">
                          Pruefen
                          <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>

      {/* Recent decisions history */}
      {history.length > 0 && (
        <GlassCard className="p-6">
          <h2 className="text-base font-semibold mb-4">
            Letzte Entscheidungen
          </h2>
          <div className="space-y-3">
            {history.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between py-2 border-b border-border/20 last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {t.status === "GENEHMIGT" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.erstelltVon.name}
                      {t.geprueftAt &&
                        ` -- ${new Date(t.geprueftAt).toLocaleDateString(
                          "de-DE",
                          {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          }
                        )}`}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs font-medium shrink-0 ${
                    t.status === "GENEHMIGT"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {t.status === "GENEHMIGT" ? "Genehmigt" : "Abgelehnt"}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
