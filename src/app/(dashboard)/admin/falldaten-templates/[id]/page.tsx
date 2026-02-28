"use client";

/**
 * Admin Falldaten-Template detail + review page
 *
 * Shows full template preview (grouped fields, read-only) and
 * approve/reject actions for EINGEREICHT templates.
 */

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TemplateField {
  key: string;
  label: string;
  typ: string;
  placeholder?: string;
  optionen?: { value: string; label: string }[];
  required?: boolean;
  gruppe?: string;
}

interface TemplateDetail {
  id: string;
  name: string;
  beschreibung: string | null;
  sachgebiet: string | null;
  schema: { felder: TemplateField[] };
  version: number;
  status: "ENTWURF" | "EINGEREICHT" | "GENEHMIGT" | "ABGELEHNT" | "STANDARD";
  erstelltVon: { id: string; name: string };
  geprueftVon: { id: string; name: string } | null;
  geprueftAt: string | null;
  ablehnungsgrund: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Field type labels ──────────────────────────────────────────────────────

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Text",
  textarea: "Textbereich",
  number: "Zahl",
  currency: "Waehrung",
  date: "Datum",
  select: "Dropdown",
  boolean: "Checkbox",
  multiselect: "Mehrfachauswahl",
};

// ─── Page component ──────────────────────────────────────────────────────────

export default function AdminFalldatenTemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // ─── Load template ──────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/falldaten-templates/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("Template nicht gefunden");
            return;
          }
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        const data = await res.json();
        setTemplate(data.template);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Fehler beim Laden"
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // ─── Approve handler ──────────────────────────────────────────────────

  async function handleApprove() {
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/falldaten-templates/${id}/genehmigen`,
        { method: "POST" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Genehmigung fehlgeschlagen");
      }
      toast.success("Template genehmigt");
      setActionSuccess("genehmigt");
      // Redirect after short delay
      setTimeout(() => router.push("/admin/falldaten-templates"), 2000);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Genehmigung fehlgeschlagen"
      );
    } finally {
      setActionLoading(false);
    }
  }

  // ─── Reject handler ──────────────────────────────────────────────────

  async function handleReject() {
    if (!rejectReason.trim()) {
      toast.error("Bitte geben Sie einen Ablehnungsgrund an");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/falldaten-templates/${id}/ablehnen`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ablehnungsgrund: rejectReason.trim() }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Ablehnung fehlgeschlagen");
      }
      toast.success("Template abgelehnt");
      setActionSuccess("abgelehnt");
      setTimeout(() => router.push("/admin/falldaten-templates"), 2000);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Ablehnung fehlgeschlagen"
      );
    } finally {
      setActionLoading(false);
    }
  }

  // ─── Loading / Error states ───────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Template wird geladen...
        </span>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-muted-foreground">
          {error ?? "Template nicht gefunden"}
        </p>
        <Link
          href="/admin/falldaten-templates"
          className="text-sm text-primary hover:underline mt-4 inline-block"
        >
          Zurueck zur Uebersicht
        </Link>
      </div>
    );
  }

  // Group fields for preview
  const groups = new Map<string, TemplateField[]>();
  for (const feld of template.schema.felder) {
    const group = feld.gruppe ?? "Allgemein";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(feld);
  }

  return (
    <div className="space-y-6">
      {/* Back link + Header */}
      <div>
        <Link
          href="/admin/falldaten-templates"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Zurueck zur Uebersicht
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {template.name}
            </h1>
            {template.beschreibung && (
              <p className="text-sm text-muted-foreground mt-1">
                {template.beschreibung}
              </p>
            )}
          </div>
          <StatusBadgeLarge status={template.status} />
        </div>
      </div>

      {/* Template info */}
      <GlassCard className="p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Ersteller</p>
            <p className="font-medium">{template.erstelltVon.name}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Sachgebiet</p>
            <p className="font-medium">{template.sachgebiet ?? "--"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Felder</p>
            <p className="font-medium">{template.schema.felder.length}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Erstellt am</p>
            <p className="font-medium">
              {new Date(template.createdAt).toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Schema preview: grouped fields */}
      <GlassPanel className="p-6">
        <h2 className="text-base font-semibold mb-4">Template-Vorschau</h2>
        <div className="space-y-4">
          {Array.from(groups.entries()).map(([groupLabel, felder]) => (
            <div
              key={groupLabel}
              className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-sm rounded-lg border border-white/20 dark:border-white/[0.08] p-4"
            >
              <h3 className="text-sm font-medium text-foreground/80 mb-3">
                {groupLabel}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {felder.map((feld) => (
                  <div
                    key={feld.key}
                    className={`${
                      feld.typ === "textarea" ? "sm:col-span-2" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-muted-foreground">
                        {feld.label}
                      </span>
                      {feld.required && (
                        <span className="text-rose-500 text-[10px]">*</span>
                      )}
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1.5 py-0"
                      >
                        {FIELD_TYPE_LABELS[feld.typ] ?? feld.typ}
                      </Badge>
                    </div>
                    {/* Options preview for select/multiselect */}
                    {(feld.typ === "select" || feld.typ === "multiselect") &&
                      feld.optionen &&
                      feld.optionen.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {feld.optionen.map((opt) => (
                            <span
                              key={opt.value}
                              className="inline-block px-1.5 py-0.5 text-[10px] bg-muted/50 rounded"
                            >
                              {opt.label}
                            </span>
                          ))}
                        </div>
                      )}
                    {/* Placeholder preview */}
                    {feld.placeholder && (
                      <p className="text-[10px] text-muted-foreground/60 italic">
                        Placeholder: {feld.placeholder}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* Action section */}
      {actionSuccess ? (
        <GlassCard className="p-6 text-center">
          {actionSuccess === "genehmigt" ? (
            <div className="text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
              <p className="font-medium">Template wurde genehmigt</p>
              <p className="text-sm text-muted-foreground mt-1">
                Weiterleitung zur Uebersicht...
              </p>
            </div>
          ) : (
            <div className="text-rose-600 dark:text-rose-400">
              <XCircle className="w-8 h-8 mx-auto mb-2" />
              <p className="font-medium">Template wurde abgelehnt</p>
              <p className="text-sm text-muted-foreground mt-1">
                Weiterleitung zur Uebersicht...
              </p>
            </div>
          )}
        </GlassCard>
      ) : template.status === "EINGEREICHT" ? (
        <GlassCard className="p-6">
          <h2 className="text-base font-semibold mb-4">Entscheidung</h2>

          {/* Reject form (shown when reject button is clicked) */}
          {showRejectForm && (
            <div className="mb-4 p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span className="text-sm font-medium text-rose-700 dark:text-rose-300">
                  Ablehnungsgrund
                </span>
              </div>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Bitte geben Sie einen Grund fuer die Ablehnung an..."
                rows={3}
                maxLength={2000}
                className="w-full rounded-md border border-rose-200 dark:border-rose-700 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                autoFocus
              />
              <div className="flex items-center gap-2 mt-3">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleReject}
                  disabled={actionLoading || !rejectReason.trim()}
                >
                  {actionLoading && (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  )}
                  Ablehnen
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowRejectForm(false);
                    setRejectReason("");
                  }}
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!showRejectForm && (
            <div className="flex items-center gap-3">
              <Button
                onClick={handleApprove}
                disabled={actionLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Genehmigen
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowRejectForm(true)}
                disabled={actionLoading}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Ablehnen
              </Button>
            </div>
          )}
        </GlassCard>
      ) : template.status === "GENEHMIGT" ? (
        <GlassCard className="p-6">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-sm font-medium">
              Genehmigt von {template.geprueftVon?.name ?? "Unbekannt"} am{" "}
              {template.geprueftAt
                ? new Date(template.geprueftAt).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })
                : "--"}
            </span>
          </div>
        </GlassCard>
      ) : template.status === "ABGELEHNT" ? (
        <GlassCard className="p-6">
          <div className="text-rose-600 dark:text-rose-400">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-5 h-5" />
              <span className="text-sm font-medium">
                Abgelehnt von {template.geprueftVon?.name ?? "Unbekannt"} am{" "}
                {template.geprueftAt
                  ? new Date(template.geprueftAt).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                  : "--"}
              </span>
            </div>
            {template.ablehnungsgrund && (
              <p className="text-sm mt-2 ml-7">{template.ablehnungsgrund}</p>
            )}
          </div>
        </GlassCard>
      ) : null}

      {/* Back link at bottom */}
      <div>
        <Link
          href="/admin/falldaten-templates"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Zurueck zur Uebersicht
        </Link>
      </div>
    </div>
  );
}

// ─── Large status badge ─────────────────────────────────────────────────────

function StatusBadgeLarge({
  status,
}: {
  status: TemplateDetail["status"];
}) {
  const styles: Record<string, string> = {
    ENTWURF: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    EINGEREICHT:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    GENEHMIGT:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    ABGELEHNT:
      "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
    STANDARD:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  };

  const labels: Record<string, string> = {
    ENTWURF: "Entwurf",
    EINGEREICHT: "Eingereicht",
    GENEHMIGT: "Genehmigt",
    ABGELEHNT: "Abgelehnt",
    STANDARD: "System-Standard",
  };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${styles[status] ?? ""}`}
    >
      {labels[status] ?? status}
    </span>
  );
}
