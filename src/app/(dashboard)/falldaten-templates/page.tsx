"use client";

/**
 * User Falldaten-Templates list page
 *
 * Shows the user their own templates and all public (GENEHMIGT/STANDARD) templates.
 * Actions per template depend on status and ownership.
 */

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  FileSpreadsheet,
  Pencil,
  Trash2,
  Send,
  AlertCircle,
  Loader2,
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

interface Template {
  id: string;
  name: string;
  beschreibung: string | null;
  sachgebiet: string | null;
  schema: { felder: TemplateField[] };
  version: number;
  status: "ENTWURF" | "EINGEREICHT" | "GENEHMIGT" | "ABGELEHNT" | "STANDARD";
  erstelltVonId: string;
  erstelltVon: { id: string; name: string };
  geprueftVonId: string | null;
  geprueftVon: { name: string } | null;
  geprueftAt: string | null;
  ablehnungsgrund: string | null;
  feldCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Status badge component ──────────────────────────────────────────────────

const STATUS_STYLES: Record<Template["status"], string> = {
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

const STATUS_LABELS: Record<Template["status"], string> = {
  ENTWURF: "Entwurf",
  EINGEREICHT: "Eingereicht",
  GENEHMIGT: "Genehmigt",
  ABGELEHNT: "Abgelehnt",
  STANDARD: "System-Standard",
};

function TemplateStatusBadge({ status }: { status: Template["status"] }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Page component ──────────────────────────────────────────────────────────

export default function FalldatenTemplatesPage() {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id as string | undefined;

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/falldaten-templates");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setTemplates(data.templates ?? []);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Templates konnten nicht geladen werden"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  async function handleEinreichen(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/falldaten-templates/${id}/einreichen`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      toast.success("Template wurde zur Pruefung eingereicht");
      await loadTemplates();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Einreichen fehlgeschlagen"
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (
      !confirm(
        `Template "${name}" wirklich loeschen? Diese Aktion kann nicht rueckgaengig gemacht werden.`
      )
    ) {
      return;
    }
    setActionLoading(id);
    try {
      const res = await fetch(`/api/falldaten-templates/${id}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      toast.success("Template wurde geloescht");
      await loadTemplates();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Loeschen fehlgeschlagen"
      );
    } finally {
      setActionLoading(null);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const isOwn = (t: Template) => t.erstelltVonId === userId;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Falldaten-Templates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vorlagen fuer strukturierte Falldatenerfassung
          </p>
        </div>
        <Link href="/dashboard/falldaten-templates/neu">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Neues Template erstellen
          </Button>
        </Link>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            Templates werden geladen...
          </span>
        </div>
      ) : templates.length === 0 ? (
        /* Empty state */
        <GlassCard className="p-12 text-center">
          <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">
            Noch keine Templates vorhanden
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Erstellen Sie Ihr erstes Template fuer die strukturierte
            Falldatenerfassung.
          </p>
          <Link href="/dashboard/falldaten-templates/neu">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Erstes Template erstellen
            </Button>
          </Link>
        </GlassCard>
      ) : (
        /* Template grid */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((t) => (
            <GlassCard key={t.id} className="p-6 flex flex-col gap-3">
              {/* Header row: Name + Status */}
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-sm leading-tight line-clamp-1">
                  {t.name}
                </h3>
                <TemplateStatusBadge status={t.status} />
              </div>

              {/* Beschreibung */}
              {t.beschreibung && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {t.beschreibung}
                </p>
              )}

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {t.sachgebiet && (
                  <Badge variant="outline" className="text-[10px]">
                    {t.sachgebiet}
                  </Badge>
                )}
                <span>{t.feldCount} Felder</span>
                <span className="text-muted-foreground/50">|</span>
                <span>{t.erstelltVon.name}</span>
                <span className="text-muted-foreground/50">|</span>
                <span>
                  {new Date(t.createdAt).toLocaleDateString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </span>
              </div>

              {/* Ablehnungsgrund */}
              {t.status === "ABGELEHNT" && t.ablehnungsgrund && isOwn(t) && (
                <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg p-3 text-xs text-rose-700 dark:text-rose-300 flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium mb-0.5">Ablehnungsgrund:</p>
                    <p>{t.ablehnungsgrund}</p>
                  </div>
                </div>
              )}

              {/* Actions (only for own templates) */}
              {isOwn(t) && (
                <div className="flex items-center gap-2 mt-auto pt-2 border-t border-border/30">
                  {/* ENTWURF: Edit, Einreichen, Delete */}
                  {t.status === "ENTWURF" && (
                    <>
                      <Link
                        href={`/dashboard/falldaten-templates/${t.id}/bearbeiten`}
                      >
                        <Button variant="outline" size="sm">
                          <Pencil className="w-3.5 h-3.5 mr-1" />
                          Bearbeiten
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEinreichen(t.id)}
                        disabled={actionLoading === t.id}
                      >
                        {actionLoading === t.id ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5 mr-1" />
                        )}
                        Einreichen
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(t.id, t.name)}
                        disabled={actionLoading === t.id}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}

                  {/* ABGELEHNT: Edit, Re-submit */}
                  {t.status === "ABGELEHNT" && (
                    <>
                      <Link
                        href={`/dashboard/falldaten-templates/${t.id}/bearbeiten`}
                      >
                        <Button variant="outline" size="sm">
                          <Pencil className="w-3.5 h-3.5 mr-1" />
                          Bearbeiten
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEinreichen(t.id)}
                        disabled={actionLoading === t.id}
                      >
                        {actionLoading === t.id ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5 mr-1" />
                        )}
                        Erneut einreichen
                      </Button>
                    </>
                  )}

                  {/* EINGEREICHT: Read-only notice */}
                  {t.status === "EINGEREICHT" && (
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                      Wartet auf Pruefung
                    </span>
                  )}

                  {/* GENEHMIGT: Read-only */}
                  {t.status === "GENEHMIGT" && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">
                      Genehmigt
                    </span>
                  )}
                </div>
              )}

              {/* Non-own STANDARD label */}
              {!isOwn(t) && t.status === "STANDARD" && (
                <div className="mt-auto pt-2 border-t border-border/30">
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    System-Standard
                  </span>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
