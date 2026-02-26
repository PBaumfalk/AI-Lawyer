"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { GlassKpiCard } from "@/components/ui/glass-kpi-card";
import { Select } from "@/components/ui/select";
import {
  Banknote,
  Landmark,
  FileText,
  AlertTriangle,
  Plus,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Shield,
  ExternalLink,
} from "lucide-react";

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

interface Buchung {
  id: string;
  buchungstyp: string;
  betrag: number;
  verwendungszweck: string;
  buchungsdatum: string;
  kostenstelle: string | null;
  konto: string | null;
  dokumentId: string | null;
  rechnungId: string | null;
  storniertVonId: string | null;
  stornoBuchungId: string | null;
  laufenderSaldo?: number;
}

interface SaldoResult {
  gesamtSaldo: number;
  einnahmen: number;
  ausgaben: number;
  fremdgeld: number;
  auslagen: number;
  offeneForderungen: number;
}

interface FremdgeldAlert {
  buchungId: string;
  akteId: string;
  betrag: number;
  eingangsDatum: string;
  frist: string;
  verbleibendeTage: number;
  dringlichkeit: "normal" | "warnung" | "kritisch" | "ueberfaellig";
}

interface AnderkontoAlert {
  akteId: string;
  totalFremdgeld: number;
  schwelle: number;
  ueberschritten: boolean;
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function formatEuro(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatEuroFromRaw(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE");
}

const BUCHUNGSTYP_CONFIG: Record<
  string,
  { label: string; variant: "success" | "destructive" | "default" | "warning"; icon: typeof ArrowDownLeft }
> = {
  EINNAHME: { label: "Einnahme", variant: "success", icon: ArrowDownLeft },
  AUSGABE: { label: "Ausgabe", variant: "destructive", icon: ArrowUpRight },
  FREMDGELD: { label: "Fremdgeld", variant: "default", icon: Landmark },
  AUSLAGE: { label: "Auslage", variant: "warning", icon: Wallet },
};

const DRINGLICHKEIT_COLORS: Record<string, string> = {
  normal: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
  warnung: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  kritisch: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800",
  ueberfaellig: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800",
};

// ---------------------------------------------------------------
// Component
// ---------------------------------------------------------------

interface AktenkontoLedgerProps {
  akteId: string;
  aktenzeichen: string;
}

export function AktenkontoLedger({ akteId, aktenzeichen }: AktenkontoLedgerProps) {
  // Data
  const [buchungen, setBuchungen] = useState<Buchung[]>([]);
  const [saldo, setSaldo] = useState<SaldoResult | null>(null);
  const [fremdgeldAlerts, setFremdgeldAlerts] = useState<FremdgeldAlert[]>([]);
  const [anderkontoAlert, setAnderkontoAlert] = useState<AnderkontoAlert | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [buchungstypFilter, setBuchungstypFilter] = useState("ALLE");
  const [activeTab, setActiveTab] = useState<"ledger" | "fremdgeld">("ledger");

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // New booking dialog
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [newBuchungstyp, setNewBuchungstyp] = useState("EINNAHME");
  const [newBetrag, setNewBetrag] = useState("");
  const [newVerwendungszweck, setNewVerwendungszweck] = useState("");
  const [newKonto, setNewKonto] = useState("GESCHAEFT");
  const [bookingSaving, setBookingSaving] = useState(false);

  // Storno dialog
  const [stornoId, setStornoId] = useState<string | null>(null);
  const [stornoGrund, setStornoGrund] = useState("");
  const [stornoSaving, setStornoSaving] = useState(false);

  // Fetch
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      if (buchungstypFilter !== "ALLE") params.set("buchungstyp", buchungstypFilter);

      const res = await fetch(`/api/finanzen/aktenkonto/${akteId}?${params}`);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();

      setBuchungen(data.buchungen ?? []);
      setSaldo(data.saldo ?? null);
      setTotal(data.total ?? 0);
      setFremdgeldAlerts(data.fremdgeldAlerts ?? []);
      setAnderkontoAlert(data.anderkontoAlert ?? null);
    } catch {
      setBuchungen([]);
    } finally {
      setLoading(false);
    }
  }, [akteId, page, buchungstypFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Create booking
  const handleCreateBooking = useCallback(async () => {
    if (!newBetrag || !newVerwendungszweck.trim()) return;
    setBookingSaving(true);
    try {
      const res = await fetch(`/api/finanzen/aktenkonto/${akteId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buchungstyp: newBuchungstyp,
          betrag: parseFloat(newBetrag.replace(",", ".")),
          verwendungszweck: newVerwendungszweck.trim(),
          konto: newKonto,
        }),
      });
      if (res.ok) {
        setShowNewBooking(false);
        setNewBetrag("");
        setNewVerwendungszweck("");
        await fetchData();
      }
    } catch {
      // Error
    } finally {
      setBookingSaving(false);
    }
  }, [akteId, newBuchungstyp, newBetrag, newVerwendungszweck, newKonto, fetchData]);

  // Storno
  const handleStorno = useCallback(async () => {
    if (!stornoId || !stornoGrund.trim()) return;
    setStornoSaving(true);
    try {
      const res = await fetch(`/api/finanzen/aktenkonto/${akteId}/storno`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalId: stornoId,
          grund: stornoGrund.trim(),
        }),
      });
      if (res.ok) {
        setStornoId(null);
        setStornoGrund("");
        await fetchData();
      }
    } catch {
      // Error
    } finally {
      setStornoSaving(false);
    }
  }, [akteId, stornoId, stornoGrund, fetchData]);

  const totalPages = Math.ceil(total / pageSize);

  // Calculate running balance for display
  const buchungenWithBalance = buchungen.map((b, idx) => {
    // If the API provides laufenderSaldo, use it; otherwise compute locally
    return { ...b };
  });

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {saldo && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassKpiCard
            title="Saldo"
            value={formatEuroFromRaw(saldo.gesamtSaldo)}
            icon={<Banknote className="w-5 h-5" />}
            color={saldo.gesamtSaldo >= 0 ? "emerald" : "rose"}
          />
          <GlassKpiCard
            title="Fremdgeld"
            value={formatEuroFromRaw(saldo.fremdgeld)}
            icon={<Landmark className="w-5 h-5" />}
            color="blue"
          />
          <GlassKpiCard
            title="Offene Forderungen"
            value={formatEuroFromRaw(saldo.offeneForderungen)}
            icon={<FileText className="w-5 h-5" />}
            color="amber"
          />
          <GlassKpiCard
            title="Auslagen"
            value={formatEuroFromRaw(Math.abs(saldo.auslagen))}
            icon={<Wallet className="w-5 h-5" />}
            color="rose"
          />
        </div>
      )}

      {/* Fremdgeld compliance alerts */}
      {fremdgeldAlerts.length > 0 && (
        <div className="space-y-2">
          {fremdgeldAlerts.map((alert) => (
            <div
              key={alert.buchungId}
              className={cn(
                "flex items-center gap-3 p-4 rounded-xl border",
                DRINGLICHKEIT_COLORS[alert.dringlichkeit]
              )}
            >
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-sm">
                  Fremdgeld-Weiterleitung faellig:{" "}
                  {formatEuroFromRaw(alert.betrag)}
                </p>
                <p className="text-xs mt-0.5">
                  Eingang: {formatDate(alert.eingangsDatum)} | Frist:{" "}
                  {formatDate(alert.frist)} |{" "}
                  {alert.verbleibendeTage > 0
                    ? `${alert.verbleibendeTage} Werktag(e) verbleibend`
                    : "UEBERFAELLIG"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Anderkonto threshold warning */}
      {anderkontoAlert?.ueberschritten && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800">
          <Shield className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-sm text-red-700 dark:text-red-400">
              15.000 EUR Anderkonto-Schwelle ueberschritten!
            </p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">
              Aktuelles Fremdgeld:{" "}
              {formatEuroFromRaw(anderkontoAlert.totalFremdgeld)} |
              Schwelle: {formatEuroFromRaw(anderkontoAlert.schwelle)} |
              Pflicht zur Anlage auf Anderkonto gem. SS 43a BRAO
            </p>
          </div>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex items-center gap-4 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("ledger")}
          className={cn(
            "text-sm font-medium pb-2 border-b-2 transition-colors",
            activeTab === "ledger"
              ? "border-blue-600 text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Kontobuch
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("fremdgeld")}
          className={cn(
            "text-sm font-medium pb-2 border-b-2 transition-colors",
            activeTab === "fremdgeld"
              ? "border-purple-600 text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Fremdgeld
          {fremdgeldAlerts.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">
              {fremdgeldAlerts.length}
            </span>
          )}
        </button>
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between">
        {activeTab === "ledger" && (
          <Select
            value={buchungstypFilter}
            onChange={(e) => {
              setBuchungstypFilter(e.target.value);
              setPage(1);
            }}
            className="w-48"
          >
            <option value="ALLE">Alle Buchungstypen</option>
            <option value="EINNAHME">Einnahmen</option>
            <option value="AUSGABE">Ausgaben</option>
            <option value="FREMDGELD">Fremdgeld</option>
            <option value="AUSLAGE">Auslagen</option>
          </Select>
        )}
        {activeTab === "fremdgeld" && <div />}

        <button
          type="button"
          onClick={() => setShowNewBooking(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors"
        >
          <Plus className="w-4 h-4" />
          Neue Buchung
        </button>
      </div>

      {/* New booking form */}
      {showNewBooking && (
        <div className="glass rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-foreground">Neue Buchung</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                Buchungstyp
              </label>
              <Select
                value={newBuchungstyp}
                onChange={(e) => setNewBuchungstyp(e.target.value)}
              >
                <option value="EINNAHME">Einnahme</option>
                <option value="AUSGABE">Ausgabe</option>
                <option value="FREMDGELD">Fremdgeld</option>
                <option value="AUSLAGE">Auslage</option>
              </Select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                Betrag (EUR)
              </label>
              <input
                type="text"
                value={newBetrag}
                onChange={(e) => setNewBetrag(e.target.value)}
                placeholder="z.B. 1.500,00"
                className="w-full h-10 px-3 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm text-muted-foreground mb-1">
                Verwendungszweck
              </label>
              <input
                type="text"
                value={newVerwendungszweck}
                onChange={(e) => setNewVerwendungszweck(e.target.value)}
                placeholder="Beschreibung der Buchung"
                className="w-full h-10 px-3 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                Konto
              </label>
              <Select
                value={newKonto}
                onChange={(e) => setNewKonto(e.target.value)}
              >
                <option value="GESCHAEFT">Geschaeftskonto</option>
                <option value="ANDERKONTO">Anderkonto</option>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreateBooking}
              disabled={bookingSaving || !newBetrag || !newVerwendungszweck.trim()}
              className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
            >
              {bookingSaving ? "Buchen..." : "Buchen"}
            </button>
            <button
              type="button"
              onClick={() => setShowNewBooking(false)}
              className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-muted/50 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Storno dialog */}
      {stornoId && (
        <div className="glass rounded-xl p-6 border-2 border-red-300 dark:border-red-800 space-y-4">
          <h3 className="font-semibold text-foreground">
            Buchung stornieren
          </h3>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              Stornogrund (Pflichtangabe)
            </label>
            <input
              type="text"
              value={stornoGrund}
              onChange={(e) => setStornoGrund(e.target.value)}
              placeholder="Grund fuer die Stornierung"
              className="w-full h-10 px-3 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleStorno}
              disabled={stornoSaving || !stornoGrund.trim()}
              className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
            >
              {stornoSaving ? "Stornieren..." : "Stornieren"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStornoId(null);
                setStornoGrund("");
              }}
              className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-muted/50 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Ledger table */}
      {activeTab === "ledger" && (
        <div className="glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground">
                    Datum
                  </th>
                  <th className="text-left p-3 font-medium text-muted-foreground">
                    Typ
                  </th>
                  <th className="text-left p-3 font-medium text-muted-foreground">
                    Verwendungszweck
                  </th>
                  <th className="text-right p-3 font-medium text-muted-foreground">
                    Betrag
                  </th>
                  <th className="text-right p-3 font-medium text-muted-foreground">
                    Saldo
                  </th>
                  <th className="text-left p-3 font-medium text-muted-foreground w-20">
                    Beleg
                  </th>
                  <th className="w-10 p-3"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Laden...
                    </td>
                  </tr>
                ) : buchungenWithBalance.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Keine Buchungen vorhanden.
                    </td>
                  </tr>
                ) : (
                  buchungenWithBalance.map((b) => {
                    const typeCfg = BUCHUNGSTYP_CONFIG[b.buchungstyp];
                    const isStorno = !!b.storniertVonId;
                    const hasStorno = !!b.stornoBuchungId;

                    return (
                      <tr
                        key={b.id}
                        className={cn(
                          "border-b border-border/50 transition-colors",
                          isStorno && "opacity-60 line-through",
                          hasStorno && "bg-red-50/30 dark:bg-red-950/10"
                        )}
                      >
                        <td className="p-3 text-muted-foreground">
                          {formatDate(b.buchungsdatum)}
                        </td>
                        <td className="p-3">
                          {typeCfg ? (
                            <Badge
                              variant={typeCfg.variant}
                              className={cn(
                                b.buchungstyp === "FREMDGELD" &&
                                  "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400"
                              )}
                            >
                              {typeCfg.label}
                            </Badge>
                          ) : (
                            <Badge variant="muted">{b.buchungstyp}</Badge>
                          )}
                        </td>
                        <td className="p-3 text-foreground">
                          {b.verwendungszweck}
                          {b.kostenstelle && (
                            <span className="block text-xs text-muted-foreground">
                              KSt: {b.kostenstelle}
                            </span>
                          )}
                        </td>
                        <td
                          className={cn(
                            "p-3 text-right font-mono font-semibold",
                            b.betrag >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          )}
                        >
                          {b.betrag >= 0 ? "+" : ""}
                          {formatEuroFromRaw(b.betrag)}
                        </td>
                        <td className="p-3 text-right font-mono text-foreground">
                          {b.laufenderSaldo !== undefined
                            ? formatEuroFromRaw(b.laufenderSaldo)
                            : "-"}
                        </td>
                        <td className="p-3">
                          {b.dokumentId && (
                            <a
                              href={`/dokumente/${b.dokumentId}`}
                              className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </td>
                        <td className="p-3">
                          {!isStorno && !hasStorno && (
                            <button
                              type="button"
                              onClick={() => setStornoId(b.id)}
                              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600 transition-colors"
                              title="Stornieren"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
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
              <span className="text-sm text-muted-foreground">
                Seite {page} von {totalPages}
              </span>
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
      )}

      {/* Fremdgeld tab */}
      {activeTab === "fremdgeld" && (
        <div className="glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-purple-50/50 dark:bg-purple-950/20">
                  <th className="text-left p-3 font-medium text-muted-foreground">
                    Datum
                  </th>
                  <th className="text-left p-3 font-medium text-muted-foreground">
                    Verwendungszweck
                  </th>
                  <th className="text-right p-3 font-medium text-muted-foreground">
                    Betrag
                  </th>
                  <th className="text-left p-3 font-medium text-muted-foreground">
                    Weiterleitungsfrist
                  </th>
                  <th className="text-left p-3 font-medium text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">
                      Laden...
                    </td>
                  </tr>
                ) : (
                  <>
                    {buchungenWithBalance
                      .filter((b) => b.buchungstyp === "FREMDGELD")
                      .map((b) => {
                        const alert = fremdgeldAlerts.find(
                          (a) => a.buchungId === b.id
                        );
                        return (
                          <tr
                            key={b.id}
                            className="border-b border-border/50"
                          >
                            <td className="p-3 text-muted-foreground">
                              {formatDate(b.buchungsdatum)}
                            </td>
                            <td className="p-3 text-foreground">
                              {b.verwendungszweck}
                            </td>
                            <td
                              className={cn(
                                "p-3 text-right font-mono font-semibold",
                                "text-purple-600 dark:text-purple-400"
                              )}
                            >
                              {formatEuroFromRaw(b.betrag)}
                            </td>
                            <td className="p-3">
                              {alert ? (
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3 h-3" />
                                  <span className="text-sm">
                                    {alert.verbleibendeTage > 0
                                      ? `${alert.verbleibendeTage} Werktag(e)`
                                      : "UEBERFAELLIG"}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">
                                  Erledigt
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              {alert && (
                                <Badge
                                  className={cn(
                                    "text-xs",
                                    DRINGLICHKEIT_COLORS[alert.dringlichkeit]
                                  )}
                                >
                                  {alert.dringlichkeit}
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    {buchungenWithBalance.filter(
                      (b) => b.buchungstyp === "FREMDGELD"
                    ).length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="p-8 text-center text-muted-foreground"
                        >
                          Keine Fremdgeld-Buchungen vorhanden.
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
