"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { GlassKpiCard } from "@/components/ui/glass-kpi-card";
import { Select } from "@/components/ui/select";
import {
  TrendingUp,
  Banknote,
  Clock,
  XCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Check,
  Download,
  Send,
  FileText,
} from "lucide-react";

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

interface Invoice {
  id: string;
  rechnungsnummer: string;
  rechnungsdatum: string;
  faelligAm: string | null;
  status: string;
  betragNetto: number;
  betragBrutto: number;
  mandantName: string | null;
  aktenzeichen: string | null;
  akteId: string | null;
}

interface InvoiceStats {
  gesamtUmsatz: number;
  offeneForderungen: number;
  ueberfaellig: number;
  stornoquote: number;
}

type SortField =
  | "rechnungsnummer"
  | "rechnungsdatum"
  | "mandantName"
  | "betragBrutto"
  | "status"
  | "faelligAm";
type SortDir = "asc" | "desc";

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function formatEuro(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("de-DE");
}

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "muted" | "default" | "success" | "destructive" | "warning" }
> = {
  ENTWURF: { label: "Entwurf", variant: "muted" },
  GESTELLT: { label: "Gestellt", variant: "default" },
  BEZAHLT: { label: "Bezahlt", variant: "success" },
  STORNIERT: { label: "Storniert", variant: "destructive" },
};

function getDaysOverdue(faelligAm: string | null, status: string): number | null {
  if (!faelligAm || status !== "GESTELLT") return null;
  const due = new Date(faelligAm);
  const now = new Date();
  const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : null;
}

function getOverdueColor(days: number): string {
  if (days > 30) return "text-red-600 dark:text-red-400";
  if (days > 14) return "text-orange-600 dark:text-orange-400";
  return "text-amber-600 dark:text-amber-400";
}

// ---------------------------------------------------------------
// Component
// ---------------------------------------------------------------

export function InvoiceList() {
  const router = useRouter();

  // Data
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState("ALLE");
  const [searchQuery, setSearchQuery] = useState("");
  const [ueberfaelligOnly, setUeberfaelligOnly] = useState(false);

  // Sort
  const [sortField, setSortField] = useState<SortField>("rechnungsdatum");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Fetch
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      params.set("sortBy", sortField);
      params.set("sortDir", sortDir);
      if (statusFilter !== "ALLE") params.set("status", statusFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      if (ueberfaelligOnly) params.set("ueberfaellig", "true");

      const res = await fetch(`/api/finanzen/rechnungen?${params}`);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();

      setInvoices(data.rechnungen ?? []);
      setTotal(data.total ?? 0);
      setStats(data.stats ?? null);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, searchQuery, ueberfaelligOnly, sortField, sortDir]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Sort handler
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(1);
  };

  // Selection
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === invoices.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(invoices.map((i) => i.id)));
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassKpiCard
            title="Gesamtumsatz"
            value={formatEuro(stats.gesamtUmsatz)}
            icon={TrendingUp}
            color="emerald"
          />
          <GlassKpiCard
            title="Offene Forderungen"
            value={formatEuro(stats.offeneForderungen)}
            icon={Banknote}
            color="blue"
          />
          <GlassKpiCard
            title="Ueberfaellig"
            value={String(stats.ueberfaellig)}
            icon={Clock}
            color={stats.ueberfaellig > 0 ? "amber" : "emerald"}
          />
          <GlassKpiCard
            title="Stornoquote"
            value={`${stats.stornoquote.toFixed(1)}%`}
            icon={XCircle}
            color={stats.stornoquote > 5 ? "rose" : "emerald"}
          />
        </div>
      )}

      {/* Filters */}
      <div className="glass rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Rechnungsnr., Mandant, Aktenzeichen..."
              className="w-full h-10 pl-10 pr-4 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Status filter */}
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-40"
          >
            <option value="ALLE">Alle Status</option>
            <option value="ENTWURF">Entwurf</option>
            <option value="GESTELLT">Gestellt</option>
            <option value="BEZAHLT">Bezahlt</option>
            <option value="STORNIERT">Storniert</option>
          </Select>

          {/* Ueberfaellig toggle */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={ueberfaelligOnly}
              onChange={(e) => {
                setUeberfaelligOnly(e.target.checked);
                setPage(1);
              }}
              className="rounded accent-amber-600"
            />
            <span className="text-muted-foreground">Nur ueberfaellige</span>
          </label>
        </div>
      </div>

      {/* Batch actions */}
      {selected.size > 0 && (
        <div className="glass rounded-xl p-3 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {selected.size} ausgewaehlt
          </span>
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-border hover:bg-muted/50 transition-colors"
            >
              <Check className="w-4 h-4" />
              Alle stellen
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-border hover:bg-muted/50 transition-colors"
            >
              <Download className="w-4 h-4" />
              PDFs herunterladen
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-border hover:bg-muted/50 transition-colors"
            >
              <Send className="w-4 h-4" />
              Mahnungen senden
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="w-10 p-3">
                  <input
                    type="checkbox"
                    checked={selected.size === invoices.length && invoices.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded accent-blue-600"
                  />
                </th>
                {[
                  { field: "rechnungsnummer" as SortField, label: "Rechnungsnr." },
                  { field: "rechnungsdatum" as SortField, label: "Datum" },
                  { field: "mandantName" as SortField, label: "Mandant" },
                  { field: "betragBrutto" as SortField, label: "Betrag" },
                  { field: "status" as SortField, label: "Status" },
                  { field: "faelligAm" as SortField, label: "Faelligkeit" },
                ].map((col) => (
                  <th
                    key={col.field}
                    className="text-left p-3 font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => toggleSort(col.field)}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sortField === col.field && (
                        <ArrowUpDown className="w-3 h-3" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Laden...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Keine Rechnungen gefunden.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => {
                  const daysOverdue = getDaysOverdue(inv.faelligAm, inv.status);
                  const statusCfg = STATUS_CONFIG[inv.status] ?? {
                    label: inv.status,
                    variant: "muted" as const,
                  };

                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors"
                      onClick={() => router.push(`/finanzen/rechnungen/${inv.id}`)}
                    >
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(inv.id)}
                          onChange={() => toggleSelect(inv.id)}
                          className="rounded accent-blue-600"
                        />
                      </td>
                      <td className="p-3">
                        <span className="font-mono text-foreground">
                          {inv.rechnungsnummer}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {formatDate(inv.rechnungsdatum)}
                      </td>
                      <td className="p-3">
                        <div>
                          <p className="text-foreground">{inv.mandantName ?? "-"}</p>
                          {inv.aktenzeichen && (
                            <p className="text-xs text-muted-foreground">
                              {inv.aktenzeichen}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <div>
                          <p className="font-semibold text-foreground">
                            {formatEuro(inv.betragBrutto)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            netto {formatEuro(inv.betragNetto)}
                          </p>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant={statusCfg.variant}>
                          {statusCfg.label}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <span
                          className={cn(
                            "text-sm",
                            daysOverdue
                              ? getOverdueColor(daysOverdue)
                              : "text-muted-foreground"
                          )}
                        >
                          {formatDate(inv.faelligAm)}
                          {daysOverdue && (
                            <span className="block text-xs">
                              {daysOverdue} Tage ueberfaellig
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                Seite {page} von {totalPages}
              </span>
              <Select
                value={String(pageSize)}
                onChange={(e) => {
                  setPageSize(parseInt(e.target.value));
                  setPage(1);
                }}
                className="w-20 h-8 text-xs"
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </Select>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-md hover:bg-muted/50 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-2 rounded-md hover:bg-muted/50 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
