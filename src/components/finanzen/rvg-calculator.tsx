"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Calculator,
  Plus,
  Trash2,
  Copy,
  FileText,
  ArrowRightLeft,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search,
  Zap,
  AlertTriangle,
  Info,
} from "lucide-react";
import {
  RvgCalculator as RvgCalc,
  buildCalculation,
} from "@/lib/finance/rvg/calculator";
import { VV_CATALOG, searchVvPositions } from "@/lib/finance/rvg/vv-catalog";
import {
  CALCULATOR_PRESETS,
  STREITWERT_VORSCHLAEGE,
} from "@/lib/finance/rvg/presets";
import type {
  CalculationResult,
  CalculationItem,
  PositionOptions,
  VVPosition,
} from "@/lib/finance/rvg/types";

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function formatEuro(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function parseGermanNumber(raw: string): number {
  // Remove thousand separators (.), replace comma with dot
  const cleaned = raw.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function formatGermanNumber(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// ---------------------------------------------------------------
// Types for local state
// ---------------------------------------------------------------

interface AddedPosition {
  id: string; // unique key
  vvNr: string;
  name: string;
  options: PositionOptions;
}

// ---------------------------------------------------------------
// Component
// ---------------------------------------------------------------

interface RvgCalculatorProps {
  initialStreitwert?: number;
  akteId?: string;
  aktenzeichen?: string;
}

export function RvgCalculator({
  initialStreitwert,
  akteId,
  aktenzeichen,
}: RvgCalculatorProps) {
  // Core state
  const [streitwertRaw, setStreitwertRaw] = useState(
    initialStreitwert ? formatGermanNumber(initialStreitwert) : ""
  );
  const [positions, setPositions] = useState<AddedPosition[]>([]);
  const [autoAuslagen, setAutoAuslagen] = useState(true);
  const [autoUst, setAutoUst] = useState(true);

  // UI state
  const [showVvSearch, setShowVvSearch] = useState(false);
  const [vvQuery, setVvQuery] = useState("");
  const [showStreitwertHinweise, setShowStreitwertHinweise] = useState(false);
  const [showPresets, setShowPresets] = useState(true);
  const [saving, setSaving] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const streitwert = useMemo(
    () => parseGermanNumber(streitwertRaw),
    [streitwertRaw]
  );

  // VV search results
  const searchResults = useMemo(() => {
    if (!vvQuery.trim()) return VV_CATALOG.filter((p) => !p.isAutoAddable);
    return searchVvPositions(vvQuery).filter((p) => !p.isAutoAddable);
  }, [vvQuery]);

  // Calculation result
  const result: CalculationResult | null = useMemo(() => {
    if (streitwert <= 0 || positions.length === 0) return null;
    try {
      const positionInput = positions.map((p) => ({
        nr: p.vvNr,
        options: p.options,
      }));
      return buildCalculation(streitwert, positionInput, {
        disableAutoAuslagen: !autoAuslagen,
        disableAutoUst: !autoUst,
      });
    } catch {
      return null;
    }
  }, [streitwert, positions, autoAuslagen, autoUst]);

  // ---------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------

  const addPosition = useCallback(
    (vv: VVPosition, opts: PositionOptions = {}) => {
      const newPos: AddedPosition = {
        id: `${vv.nr}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        vvNr: vv.nr,
        name: vv.name,
        options: opts,
      };
      setPositions((prev) => [...prev, newPos]);
      setShowVvSearch(false);
      setVvQuery("");
    },
    []
  );

  const removePosition = useCallback((id: string) => {
    setPositions((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const applyPreset = useCallback(
    (presetId: string) => {
      const preset = CALCULATOR_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      const newPositions: AddedPosition[] = preset.vvPositions
        .filter((vp) => {
          // Skip auto-addable positions (7002, 7008) - they are handled by the calculator
          const vv = VV_CATALOG.find((v) => v.nr === vp.nr);
          return vv && !vv.isAutoAddable;
        })
        .map((vp) => ({
          id: `${vp.nr}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          vvNr: vp.nr,
          name: VV_CATALOG.find((v) => v.nr === vp.nr)?.name ?? vp.nr,
          options: vp.options ?? {},
        }));
      setPositions(newPositions);
      setShowPresets(false);
    },
    []
  );

  const applyStreitwertVorschlag = useCallback(
    (vorschlag: (typeof STREITWERT_VORSCHLAEGE)[number]) => {
      setStreitwertRaw(formatGermanNumber(vorschlag.beispiel));
      setShowStreitwertHinweise(false);
    },
    []
  );

  const updatePositionRate = useCallback((id: string, rate: number) => {
    setPositions((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, options: { ...p.options, rate } } : p
      )
    );
  }, []);

  const updatePositionAuftraggeber = useCallback(
    (id: string, anzahl: number) => {
      setPositions((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, options: { ...p.options, anzahlAuftraggeber: anzahl } }
            : p
        )
      );
    },
    []
  );

  const copyAsText = useCallback(async () => {
    if (!result) return;
    const lines = [
      `RVG-Berechnung | Streitwert: ${formatEuro(streitwert)}`,
      "=".repeat(50),
      "",
      ...result.items.map(
        (item) =>
          `VV ${item.vvNr} ${item.name}${item.rate ? ` (${item.rate.toFixed(1)})` : ""}: ${formatEuro(item.finalAmount)}`
      ),
      "",
      "-".repeat(50),
      `Netto: ${formatEuro(result.nettoGesamt)}`,
      `USt (19%): ${formatEuro(result.ustBetrag)}`,
      `Gesamt: ${formatEuro(result.bruttoGesamt)}`,
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  }, [result, streitwert]);

  const transferToInvoice = useCallback(async () => {
    if (!result || !akteId) return;
    setTransferring(true);
    try {
      // First save the calculation
      const saveRes = await fetch(`/api/finanzen/rvg/${akteId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streitwert,
          positionen: positions.map((p) => ({
            nr: p.vvNr,
            options: p.options,
          })),
        }),
      });
      if (!saveRes.ok) throw new Error("Save failed");
      const saveData = await saveRes.json();

      // Now create the invoice from the calculation
      if (saveData.uebernehmenAlsRechnung) {
        const invoiceRes = await fetch("/api/finanzen/rechnungen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(saveData.uebernehmenAlsRechnung),
        });
        if (invoiceRes.ok) {
          const invoice = await invoiceRes.json();
          window.location.href = `/finanzen/rechnungen/${invoice.id}`;
          return;
        }
      }
    } catch {
      // Error handling — show inline
    } finally {
      setTransferring(false);
    }
  }, [result, akteId, streitwert, positions]);

  const saveCalculation = useCallback(async () => {
    if (!result || !akteId) return;
    setSaving(true);
    try {
      await fetch(`/api/finanzen/rvg/${akteId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          streitwert,
          positionen: positions.map((p) => ({
            nr: p.vvNr,
            options: p.options,
          })),
        }),
      });
    } catch {
      // Silently handle
    } finally {
      setSaving(false);
    }
  }, [result, akteId, streitwert, positions]);

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Input area */}
      <div className="lg:col-span-2 space-y-6">
        {/* Streitwert Input */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Streitwert / Gegenstandswert
            </h2>
            <button
              type="button"
              onClick={() =>
                setShowStreitwertHinweise(!showStreitwertHinweise)
              }
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <Info className="w-4 h-4" />
              Vorschlaege
              {showStreitwertHinweise ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              value={streitwertRaw}
              onChange={(e) => setStreitwertRaw(e.target.value)}
              placeholder="z.B. 5.000,00"
              className="w-full h-14 text-2xl font-semibold text-foreground bg-background border border-input rounded-lg px-4 pr-12 focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">
              EUR
            </span>
          </div>

          {/* Streitwert suggestions */}
          {showStreitwertHinweise && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STREITWERT_VORSCHLAEGE.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => applyStreitwertVorschlag(v)}
                  className="text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <p className="text-sm font-medium text-foreground">
                    {v.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {v.formel}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    Bsp: {formatEuro(v.beispiel)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Presets */}
        {showPresets && positions.length === 0 && (
          <div className="glass rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5" />
              Schnellauswahl (Presets)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CALCULATOR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className="text-left p-4 rounded-lg border border-border hover:bg-muted/50 hover:border-blue-300 transition-colors"
                >
                  <p className="font-medium text-foreground">{preset.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {preset.description}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {preset.vvPositions
                      .filter((vp) => {
                        const cat = VV_CATALOG.find((v) => v.nr === vp.nr);
                        return cat && !cat.isAutoAddable;
                      })
                      .map((vp) => (
                        <Badge key={vp.nr} variant="secondary">
                          VV {vp.nr}
                        </Badge>
                      ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Positions table */}
        {positions.length > 0 && (
          <div className="glass rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                VV-Positionen ({positions.length})
              </h2>
              <button
                type="button"
                onClick={() => setShowVvSearch(true)}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <Plus className="w-4 h-4" />
                Position hinzufuegen
              </button>
            </div>

            <div className="space-y-3">
              {positions.map((pos) => {
                const vvDef = VV_CATALOG.find((v) => v.nr === pos.vvNr);
                const resultItem = result?.items.find(
                  (i) => i.vvNr === pos.vvNr
                );
                const hasAnrechnung =
                  resultItem && resultItem.anrechnungDeduction !== 0;

                return (
                  <div
                    key={pos.id}
                    className={cn(
                      "flex items-start gap-4 p-4 rounded-lg border transition-colors",
                      hasAnrechnung
                        ? "border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/30"
                        : "border-border"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">VV {pos.vvNr}</Badge>
                        <span className="font-medium text-foreground text-sm">
                          {pos.name}
                        </span>
                      </div>

                      {/* Rate adjustment for Wertgebuehr */}
                      {vvDef?.feeType === "wertgebuehr" &&
                        pos.vvNr !== "1008" && (
                          <div className="mt-2 flex items-center gap-3">
                            <label className="text-xs text-muted-foreground">
                              Gebuehrensatz:
                            </label>
                            <input
                              type="range"
                              min={vvDef.minRate ?? 0}
                              max={vvDef.maxRate ?? 3}
                              step={0.1}
                              value={pos.options.rate ?? vvDef.defaultRate}
                              onChange={(e) =>
                                updatePositionRate(
                                  pos.id,
                                  parseFloat(e.target.value)
                                )
                              }
                              className="w-32 accent-blue-600"
                            />
                            <span className="text-sm font-mono text-foreground w-8">
                              {(
                                pos.options.rate ?? vvDef.defaultRate
                              ).toFixed(1)}
                            </span>
                          </div>
                        )}

                      {/* Auftraggeber count for 1008 */}
                      {pos.vvNr === "1008" && (
                        <div className="mt-2 flex items-center gap-3">
                          <label className="text-xs text-muted-foreground">
                            Auftraggeber:
                          </label>
                          <input
                            type="number"
                            min={2}
                            max={10}
                            value={pos.options.anzahlAuftraggeber ?? 2}
                            onChange={(e) =>
                              updatePositionAuftraggeber(
                                pos.id,
                                parseInt(e.target.value) || 2
                              )
                            }
                            className="w-20 h-8 text-sm border border-input rounded px-2 bg-background"
                          />
                        </div>
                      )}

                      {/* Anrechnung notice */}
                      {hasAnrechnung && (
                        <div className="mt-2 flex items-center gap-2 text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-xs">
                            Anrechnung gem. Vorbem. 3 Abs. 4 VV RVG:{" "}
                            {formatEuro(
                              Math.abs(resultItem!.anrechnungDeduction)
                            )}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Amount */}
                    <div className="text-right shrink-0">
                      {resultItem && (
                        <>
                          {hasAnrechnung && (
                            <p className="text-xs text-muted-foreground line-through">
                              {formatEuro(resultItem.amount)}
                            </p>
                          )}
                          <p className="text-sm font-semibold text-foreground">
                            {formatEuro(resultItem.finalAmount)}
                          </p>
                        </>
                      )}
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => removePosition(pos.id)}
                      className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-600 transition-colors shrink-0"
                      aria-label="Position entfernen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Add position inline */}
            {!showVvSearch && (
              <button
                type="button"
                onClick={() => setShowVvSearch(true)}
                className="mt-3 w-full flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-border hover:bg-muted/50 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="w-4 h-4" />
                Weitere Position hinzufuegen
              </button>
            )}
          </div>
        )}

        {/* VV Position Search Dialog */}
        {showVvSearch && (
          <div className="glass rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                VV-Position hinzufuegen
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowVvSearch(false);
                  setVvQuery("");
                }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Abbrechen
              </button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={vvQuery}
                onChange={(e) => setVvQuery(e.target.value)}
                placeholder="VV-Nummer oder Bezeichnung suchen..."
                className="w-full h-10 pl-10 pr-4 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1">
              {searchResults.map((vv) => (
                <button
                  key={vv.nr}
                  type="button"
                  onClick={() => addPosition(vv)}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Badge variant="secondary" className="shrink-0">
                    VV {vv.nr}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {vv.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {vv.description}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {vv.feeType === "wertgebuehr"
                      ? `${vv.defaultRate.toFixed(1)}`
                      : vv.feeType}
                  </span>
                </button>
              ))}
              {searchResults.length === 0 && vvQuery.trim() && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Keine VV-Positionen gefunden.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {positions.length === 0 && !showPresets && (
          <div className="glass rounded-xl p-8 text-center">
            <p className="text-muted-foreground mb-3">
              Keine Positionen ausgewaehlt.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => setShowPresets(true)}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Preset waehlen
              </button>
              <span className="text-muted-foreground">oder</span>
              <button
                type="button"
                onClick={() => setShowVvSearch(true)}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                manuell hinzufuegen
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right: Running totals & result */}
      <div className="space-y-6">
        {/* Running totals */}
        <div className="glass rounded-xl p-6 sticky top-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Berechnung
          </h2>

          {result ? (
            <div className="space-y-3">
              {/* Auto-add toggles */}
              <div className="space-y-2 pb-3 border-b border-border">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoAuslagen}
                    onChange={(e) => setAutoAuslagen(e.target.checked)}
                    className="rounded accent-blue-600"
                  />
                  <span className="text-muted-foreground">
                    VV 7002 Auslagenpauschale
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoUst}
                    onChange={(e) => setAutoUst(e.target.checked)}
                    className="rounded accent-blue-600"
                  />
                  <span className="text-muted-foreground">
                    VV 7008 USt (19%)
                  </span>
                </label>
              </div>

              {/* Item breakdown */}
              <div className="space-y-2">
                {result.items.map((item, idx) => (
                  <div
                    key={`${item.vvNr}-${idx}`}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground truncate mr-2">
                      VV {item.vvNr} {item.name}
                      {item.rate ? ` (${item.rate.toFixed(1)})` : ""}
                    </span>
                    <span className="font-mono text-foreground whitespace-nowrap">
                      {formatEuro(item.finalAmount)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Anrechnung notice */}
              {result.anrechnung && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {result.anrechnung.description}
                  </p>
                </div>
              )}

              {/* Totals */}
              <div className="pt-3 border-t border-border space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Zwischensumme (netto)
                  </span>
                  <span className="font-mono text-foreground">
                    {formatEuro(result.nettoGesamt)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">USt (19%)</span>
                  <span className="font-mono text-foreground">
                    {formatEuro(result.ustBetrag)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <span className="font-semibold text-foreground">
                    Gesamtbetrag
                  </span>
                  <span className="text-xl font-bold text-foreground">
                    {formatEuro(result.bruttoGesamt)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 space-y-2">
                <button
                  type="button"
                  onClick={copyAsText}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border hover:bg-muted/50 text-sm font-medium transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  {copySuccess ? "Kopiert!" : "Kopieren als Text"}
                </button>

                <a
                  href={`https://www.dav-prozesskostenrechner.de/?streitwert=${streitwert}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border hover:bg-muted/50 text-sm font-medium transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  DAV Vergleich
                </a>

                {akteId && (
                  <>
                    <button
                      type="button"
                      onClick={saveCalculation}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border hover:bg-muted/50 text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <FileText className="w-4 h-4" />
                      {saving ? "Speichern..." : "Berechnung speichern"}
                    </button>

                    <button
                      type="button"
                      onClick={transferToInvoice}
                      disabled={transferring}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      {transferring
                        ? "Wird uebernommen..."
                        : "Uebernehmen als Rechnung"}
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                {streitwert <= 0
                  ? "Bitte Streitwert eingeben."
                  : "Bitte VV-Positionen hinzufuegen."}
              </p>
            </div>
          )}
        </div>

        {/* Akte context */}
        {akteId && aktenzeichen && (
          <div className="glass rounded-xl p-4">
            <p className="text-xs text-muted-foreground">Akte</p>
            <p className="text-sm font-medium text-foreground">
              {aktenzeichen}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
