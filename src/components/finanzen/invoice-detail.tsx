"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  FileText,
  Download,
  Send,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Edit,
  Trash2,
  Clock,
  Banknote,
} from "lucide-react";

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

interface InvoicePosition {
  id?: string;
  vvNr?: string | null;
  beschreibung: string;
  menge: number;
  einzelpreis: number;
  ustSatz: number;
  betrag: number;
}

interface UstSummary {
  satz: number;
  bemessungsgrundlage: number;
  betrag: number;
}

interface Teilzahlung {
  id: string;
  betrag: number;
  datum: string;
  verwendungszweck: string | null;
}

interface Mahnung {
  id: string;
  stufe: number;
  datum: string;
  gesendet: boolean;
}

interface InvoiceDetail {
  id: string;
  rechnungsnummer: string;
  rechnungsdatum: string;
  faelligAm: string | null;
  status: string;
  betragNetto: number;
  betragBrutto: number;
  mandantName: string | null;
  aktenzeichen: string | null;
  empfaengerName: string | null;
  empfaengerStrasse: string | null;
  empfaengerPlz: string | null;
  empfaengerOrt: string | null;
  positionen: InvoicePosition[];
  ustSummary: UstSummary[];
  teilzahlungen: Teilzahlung[];
  mahnungen: Mahnung[];
  notizen: string | null;
  restbetrag: number;
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

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("de-DE");
}

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "muted" | "default" | "success" | "destructive" | "warning"; color: string }
> = {
  ENTWURF: { label: "Entwurf", variant: "muted", color: "text-slate-600" },
  GESTELLT: { label: "Gestellt", variant: "default", color: "text-blue-600" },
  BEZAHLT: { label: "Bezahlt", variant: "success", color: "text-emerald-600" },
  STORNIERT: { label: "Storniert", variant: "destructive", color: "text-red-600" },
};

// ---------------------------------------------------------------
// Component
// ---------------------------------------------------------------

interface InvoiceDetailViewProps {
  invoiceId: string;
}

export function InvoiceDetailView({ invoiceId }: InvoiceDetailViewProps) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);

  const fetchInvoice = useCallback(async () => {
    try {
      const res = await fetch(`/api/finanzen/rechnungen/${invoiceId}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setInvoice(data);
    } catch {
      setInvoice(null);
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  // Status transition
  const performAction = useCallback(
    async (action: string) => {
      setActionLoading(action);
      try {
        const res = await fetch(`/api/finanzen/rechnungen/${invoiceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (res.ok) {
          await fetchInvoice();
        }
      } catch {
        // Error handling
      } finally {
        setActionLoading(null);
        setShowConfirm(null);
      }
    },
    [invoiceId, fetchInvoice]
  );

  // Delete (ENTWURF only)
  const handleDelete = useCallback(async () => {
    setActionLoading("delete");
    try {
      const res = await fetch(`/api/finanzen/rechnungen/${invoiceId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/finanzen/rechnungen");
      }
    } catch {
      // Error handling
    } finally {
      setActionLoading(null);
      setShowConfirm(null);
    }
  }, [invoiceId, router]);

  // PDF download
  const downloadPdf = useCallback(async () => {
    setActionLoading("pdf");
    try {
      const res = await fetch(`/api/finanzen/rechnungen/${invoiceId}/pdf`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${invoice?.rechnungsnummer ?? "rechnung"}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // Error handling
    } finally {
      setActionLoading(null);
    }
  }, [invoiceId, invoice?.rechnungsnummer]);

  // E-Rechnung download
  const downloadERechnung = useCallback(async () => {
    setActionLoading("erechnung");
    try {
      const res = await fetch(
        `/api/finanzen/rechnungen/${invoiceId}/e-rechnung`
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${invoice?.rechnungsnummer ?? "rechnung"}_xrechnung.xml`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // Error handling
    } finally {
      setActionLoading(null);
    }
  }, [invoiceId, invoice?.rechnungsnummer]);

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------

  if (loading) {
    return (
      <div className="glass rounded-xl p-12 text-center">
        <p className="text-muted-foreground">Rechnung wird geladen...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="glass rounded-xl p-12 text-center">
        <p className="text-muted-foreground">Rechnung nicht gefunden.</p>
        <button
          type="button"
          onClick={() => router.push("/finanzen/rechnungen")}
          className="mt-4 text-sm text-blue-600 hover:text-blue-700"
        >
          Zurueck zur Liste
        </button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[invoice.status] ?? {
    label: invoice.status,
    variant: "muted" as const,
    color: "text-slate-600",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            type="button"
            onClick={() => router.push("/finanzen/rechnungen")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Zurueck
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-heading text-foreground">
              {invoice.rechnungsnummer}
            </h1>
            <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <span>Datum: {formatDate(invoice.rechnungsdatum)}</span>
            {invoice.faelligAm && (
              <span>Faellig: {formatDate(invoice.faelligAm)}</span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {invoice.status === "ENTWURF" && (
            <>
              <button
                type="button"
                onClick={() =>
                  router.push(`/finanzen/rechnungen/${invoiceId}/edit`)
                }
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-border hover:bg-muted/50 transition-colors"
              >
                <Edit className="w-4 h-4" />
                Bearbeiten
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm("stellen")}
                disabled={actionLoading !== null}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {actionLoading === "stellen" ? "..." : "Stellen"}
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm("delete")}
                disabled={actionLoading !== null}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Loeschen
              </button>
            </>
          )}

          {invoice.status === "GESTELLT" && (
            <>
              <button
                type="button"
                onClick={downloadPdf}
                disabled={actionLoading !== null}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-border hover:bg-muted/50 transition-colors"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
              <button
                type="button"
                onClick={downloadERechnung}
                disabled={actionLoading !== null}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-border hover:bg-muted/50 transition-colors"
              >
                <FileText className="w-4 h-4" />
                XRechnung
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm("bezahlt")}
                disabled={actionLoading !== null}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                Bezahlt markieren
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm("stornieren")}
                disabled={actionLoading !== null}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Stornieren
              </button>
              <button
                type="button"
                onClick={() => performAction("mahnung")}
                disabled={actionLoading !== null}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950/30 transition-colors"
              >
                <AlertTriangle className="w-4 h-4" />
                Mahnung
              </button>
            </>
          )}

          {invoice.status === "BEZAHLT" && (
            <button
              type="button"
              onClick={downloadPdf}
              disabled={actionLoading !== null}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-border hover:bg-muted/50 transition-colors"
            >
              <Download className="w-4 h-4" />
              PDF herunterladen
            </button>
          )}
        </div>
      </div>

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="glass rounded-xl p-6 border-2 border-amber-300 dark:border-amber-700">
          <p className="text-foreground font-medium mb-3">
            {showConfirm === "stellen" && "Rechnung jetzt stellen? Das Rechnungsdatum wird festgeschrieben."}
            {showConfirm === "bezahlt" && "Rechnung als bezahlt markieren?"}
            {showConfirm === "stornieren" && "Rechnung stornieren? Eine Stornorechnung wird erstellt."}
            {showConfirm === "delete" && "Entwurf endgueltig loeschen?"}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (showConfirm === "delete") handleDelete();
                else if (showConfirm === "stellen") performAction("stellen");
                else if (showConfirm === "bezahlt") performAction("bezahlt");
                else if (showConfirm === "stornieren") performAction("stornieren");
              }}
              className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              Bestaetigen
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(null)}
              className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-muted/50 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Positions and totals */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recipient block */}
          <div className="glass rounded-xl p-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Empfaenger
            </h2>
            <div className="text-foreground">
              <p className="font-medium">{invoice.empfaengerName ?? invoice.mandantName ?? "-"}</p>
              {invoice.empfaengerStrasse && <p className="text-sm">{invoice.empfaengerStrasse}</p>}
              {(invoice.empfaengerPlz || invoice.empfaengerOrt) && (
                <p className="text-sm">
                  {invoice.empfaengerPlz} {invoice.empfaengerOrt}
                </p>
              )}
            </div>
            {invoice.aktenzeichen && (
              <p className="text-sm text-muted-foreground mt-2">
                Akte: {invoice.aktenzeichen}
              </p>
            )}
          </div>

          {/* Positions table */}
          <div className="glass rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 font-medium text-muted-foreground w-10">
                    Nr.
                  </th>
                  <th className="text-left p-3 font-medium text-muted-foreground">
                    VV-Nr.
                  </th>
                  <th className="text-left p-3 font-medium text-muted-foreground">
                    Beschreibung
                  </th>
                  <th className="text-right p-3 font-medium text-muted-foreground">
                    Menge
                  </th>
                  <th className="text-right p-3 font-medium text-muted-foreground">
                    Einzelpreis
                  </th>
                  <th className="text-right p-3 font-medium text-muted-foreground">
                    USt
                  </th>
                  <th className="text-right p-3 font-medium text-muted-foreground">
                    Betrag
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoice.positionen.map((pos, idx) => (
                  <tr key={idx} className="border-b border-border/50">
                    <td className="p-3 text-muted-foreground">{idx + 1}</td>
                    <td className="p-3">
                      {pos.vvNr ? (
                        <Badge variant="secondary">VV {pos.vvNr}</Badge>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-3 text-foreground">{pos.beschreibung}</td>
                    <td className="p-3 text-right text-foreground">
                      {pos.menge}
                    </td>
                    <td className="p-3 text-right font-mono text-foreground">
                      {formatEuro(pos.einzelpreis)}
                    </td>
                    <td className="p-3 text-right text-muted-foreground">
                      {pos.ustSatz}%
                    </td>
                    <td className="p-3 text-right font-mono font-semibold text-foreground">
                      {formatEuro(pos.betrag)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="p-4 bg-muted/20 border-t border-border space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Netto</span>
                <span className="font-mono text-foreground">
                  {formatEuro(invoice.betragNetto)}
                </span>
              </div>
              {invoice.ustSummary.map((ust, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">
                    USt {ust.satz}% von {formatEuro(ust.bemessungsgrundlage)}
                  </span>
                  <span className="font-mono text-foreground">
                    {formatEuro(ust.betrag)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="font-semibold text-foreground">Brutto</span>
                <span className="text-lg font-bold text-foreground">
                  {formatEuro(invoice.betragBrutto)}
                </span>
              </div>
              {invoice.restbetrag !== invoice.betragBrutto && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    Restbetrag
                  </span>
                  <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                    {formatEuro(invoice.restbetrag)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {invoice.notizen && (
            <div className="glass rounded-xl p-6">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Notizen
              </h2>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {invoice.notizen}
              </p>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Teilzahlungen */}
          {invoice.teilzahlungen.length > 0 && (
            <div className="glass rounded-xl p-6">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Banknote className="w-4 h-4" />
                Teilzahlungen ({invoice.teilzahlungen.length})
              </h2>
              <div className="space-y-3">
                {invoice.teilzahlungen.map((tz) => (
                  <div
                    key={tz.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div>
                      <p className="text-foreground">
                        {formatDate(tz.datum)}
                      </p>
                      {tz.verwendungszweck && (
                        <p className="text-xs text-muted-foreground">
                          {tz.verwendungszweck}
                        </p>
                      )}
                    </div>
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      +{formatEuro(tz.betrag)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mahnungen timeline */}
          {invoice.mahnungen.length > 0 && (
            <div className="glass rounded-xl p-6">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Mahnungen ({invoice.mahnungen.length})
              </h2>
              <div className="space-y-3">
                {invoice.mahnungen.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-amber-500/15 flex items-center justify-center text-xs font-semibold text-amber-600">
                        {m.stufe}
                      </span>
                      <span className="text-foreground">
                        {formatDate(m.datum)}
                      </span>
                    </div>
                    <Badge variant={m.gesendet ? "success" : "muted"}>
                      {m.gesendet ? "Gesendet" : "Offen"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
