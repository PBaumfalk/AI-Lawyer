"use client";

import { useState, useEffect, useCallback } from "react";
import { FalldatenForm } from "./falldaten-form";
import { FalldatenAutofillReview } from "./falldaten-autofill-review";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { FalldatenFeldTypDB } from "@/lib/falldaten/validation";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TemplateField {
  key: string;
  label: string;
  typ: FalldatenFeldTypDB;
  placeholder?: string | null;
  optionen?: { value: string; label: string }[] | null;
  required?: boolean;
  gruppe?: string | null;
}

interface TemplateData {
  id: string;
  name: string;
  beschreibung: string | null;
  sachgebiet: string | null;
  status: string;
  schema: { felder: TemplateField[] };
}

interface FalldatenTabProps {
  akteId: string;
  sachgebiet: string;
  initialFalldaten: Record<string, any> | null;
  falldatenTemplateId: string | null;
  onCompletenessChange: (completeness: {
    percent: number;
    filled: number;
    total: number;
  }) => void;
  onDirtyChange: (dirty: boolean) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FalldatenTab({
  akteId,
  sachgebiet,
  initialFalldaten,
  falldatenTemplateId,
  onCompletenessChange,
  onDirtyChange,
}: FalldatenTabProps) {
  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [alternatives, setAlternatives] = useState<TemplateData[]>([]);
  const [showSwitchDialog, setShowSwitchDialog] = useState(false);
  const [pendingSwitchTemplate, setPendingSwitchTemplate] =
    useState<TemplateData | null>(null);
  const [switching, setSwitching] = useState(false);

  // ─── Auto-Fill State ──────────────────────────────────────────────────────

  const [autofillLoading, setAutofillLoading] = useState(false);
  const [autofillSuggestions, setAutofillSuggestions] = useState<any[] | null>(
    null
  );
  const [showAutofillReview, setShowAutofillReview] = useState(false);
  const [pendingOverrides, setPendingOverrides] = useState<Record<
    string,
    any
  > | null>(null);

  // ─── Auto-Fill Handler ────────────────────────────────────────────────────

  const handleAutofill = useCallback(async () => {
    setAutofillLoading(true);
    try {
      const res = await fetch(`/api/akten/${akteId}/falldaten-autofill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fehler bei der KI-Extraktion");
      }
      const data = await res.json();
      if (!data.suggestions || data.suggestions.length === 0) {
        toast.info("Keine Vorschlaege gefunden -- keine OCR-Texte verfuegbar?");
        return;
      }
      setAutofillSuggestions(data.suggestions);
      setShowAutofillReview(true);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAutofillLoading(false);
    }
  }, [akteId]);

  const handleAutofillApply = useCallback(
    (accepted: Record<string, any>) => {
      setPendingOverrides(accepted);
      setShowAutofillReview(false);
      setAutofillSuggestions(null);
      toast.success("Vorschlaege uebernommen -- bitte speichern");
    },
    []
  );

  const handleAutofillClose = useCallback(() => {
    setShowAutofillReview(false);
    setAutofillSuggestions(null);
  }, []);

  // ─── Fetch Alternatives ──────────────────────────────────────────────────

  const fetchAlternatives = useCallback(
    async (excludeId: string | null) => {
      try {
        // Fetch STANDARD and GENEHMIGT templates for this sachgebiet
        const res = await fetch(
          `/api/falldaten-templates?sachgebiet=${sachgebiet}`
        );
        if (!res.ok) return;
        const data = await res.json();
        const all: TemplateData[] = (data.templates ?? []).filter(
          (t: TemplateData) =>
            t.status === "STANDARD" || t.status === "GENEHMIGT"
        );
        setAlternatives(
          excludeId ? all.filter((t) => t.id !== excludeId) : all
        );
      } catch {
        // Silently fail -- alternatives are non-critical
      }
    },
    [sachgebiet]
  );

  // ─── Template Resolution ─────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      setLoading(true);

      try {
        if (falldatenTemplateId) {
          // Case 1: Template already assigned -- fetch it by ID
          const res = await fetch(
            `/api/falldaten-templates/${falldatenTemplateId}`
          );
          if (!res.ok) throw new Error("Template nicht gefunden");
          const data = await res.json();
          if (!cancelled) {
            setTemplate(data.template);
            fetchAlternatives(data.template.id);
          }
        } else {
          // Case 2: No template assigned -- auto-assign STANDARD for sachgebiet
          const standardRes = await fetch(
            `/api/falldaten-templates?sachgebiet=${sachgebiet}&status=STANDARD`
          );
          if (!standardRes.ok)
            throw new Error("Fehler beim Laden der Templates");
          const standardData = await standardRes.json();
          const standardTemplates: TemplateData[] =
            standardData.templates ?? [];

          if (standardTemplates.length > 0) {
            // Auto-assign the STANDARD template
            const chosen = standardTemplates[0];
            const patchRes = await fetch(`/api/akten/${akteId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ falldatenTemplateId: chosen.id }),
            });
            if (!patchRes.ok) {
              toast.error("Template konnte nicht zugewiesen werden");
            }
            if (!cancelled) {
              setTemplate(chosen);
              fetchAlternatives(chosen.id);
            }
          } else {
            // No STANDARD found -- try GENEHMIGT
            const approvedRes = await fetch(
              `/api/falldaten-templates?sachgebiet=${sachgebiet}&status=GENEHMIGT`
            );
            if (approvedRes.ok) {
              const approvedData = await approvedRes.json();
              const approvedTemplates: TemplateData[] =
                approvedData.templates ?? [];
              if (!cancelled) {
                // Show empty state with approved alternatives if any
                setTemplate(null);
                setAlternatives(approvedTemplates);
              }
            } else if (!cancelled) {
              setTemplate(null);
              setAlternatives([]);
            }
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err.message || "Fehler beim Laden des Templates");
          setTemplate(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [falldatenTemplateId, sachgebiet, akteId, fetchAlternatives]);

  // ─── Template Switch Handler ─────────────────────────────────────────────

  const handleSwitchConfirm = useCallback(async () => {
    if (!pendingSwitchTemplate) return;
    setSwitching(true);

    try {
      const res = await fetch(`/api/akten/${akteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ falldatenTemplateId: pendingSwitchTemplate.id }),
      });
      if (!res.ok) throw new Error("Template konnte nicht gewechselt werden");

      setTemplate(pendingSwitchTemplate);
      fetchAlternatives(pendingSwitchTemplate.id);
      toast.success(`Template gewechselt: ${pendingSwitchTemplate.name}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSwitching(false);
      setShowSwitchDialog(false);
      setPendingSwitchTemplate(null);
    }
  }, [pendingSwitchTemplate, akteId, fetchAlternatives]);

  // ─── Select Template from Empty State ────────────────────────────────────

  const handleSelectTemplate = useCallback(
    async (t: TemplateData) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/akten/${akteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ falldatenTemplateId: t.id }),
        });
        if (!res.ok) throw new Error("Template konnte nicht zugewiesen werden");

        setTemplate(t);
        fetchAlternatives(t.id);
        toast.success(`Template zugewiesen: ${t.name}`);
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    },
    [akteId, fetchAlternatives]
  );

  // ─── Loading Skeleton ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] h-32"
          />
        ))}
      </div>
    );
  }

  // ─── Empty State ─────────────────────────────────────────────────────────

  if (!template) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-8 max-w-md w-full text-center space-y-4">
          <FileSpreadsheet className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-sm font-medium text-foreground">
            Kein Standardtemplate verfuegbar
          </h3>
          <p className="text-xs text-muted-foreground">
            Fuer dieses Sachgebiet ist kein Standardtemplate verfuegbar.
            {alternatives.length > 0
              ? " Waehlen Sie ein verfuegbares Template:"
              : " Templates koennen im Verwaltungsbereich erstellt werden."}
          </p>

          {alternatives.length > 0 && (
            <div className="space-y-2 pt-2">
              {alternatives.map((alt) => (
                <button
                  key={alt.id}
                  onClick={() => handleSelectTemplate(alt)}
                  className="w-full text-left bg-white/60 dark:bg-white/[0.08] backdrop-blur-sm rounded-lg border border-white/20 dark:border-white/[0.1] p-3 hover:bg-white/80 dark:hover:bg-white/[0.12] transition-colors"
                >
                  <div className="text-sm font-medium text-foreground">
                    {alt.name}
                  </div>
                  {alt.beschreibung && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {alt.beschreibung}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Template Loaded ─────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header with auto-fill and switch buttons */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleAutofill}
          disabled={autofillLoading}
        >
          {autofillLoading ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
          )}
          Auto-Fill
        </Button>
        {alternatives.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSwitchDialog(true)}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Template wechseln
          </Button>
        )}
      </div>

      {/* Form */}
      <FalldatenForm
        akteId={akteId}
        schema={{
          label: template.name,
          beschreibung: template.beschreibung ?? undefined,
          felder: template.schema.felder,
        }}
        initialData={initialFalldaten}
        overrides={pendingOverrides}
        onCompletenessChange={onCompletenessChange}
        onDirtyChange={onDirtyChange}
      />

      {/* Auto-Fill Review Dialog */}
      {showAutofillReview && autofillSuggestions && (
        <FalldatenAutofillReview
          suggestions={autofillSuggestions}
          felder={template.schema.felder}
          currentData={initialFalldaten ?? {}}
          onApply={handleAutofillApply}
          onClose={handleAutofillClose}
        />
      )}

      {/* Template Switch Dialog */}
      <AlertDialog
        open={showSwitchDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowSwitchDialog(false);
            setPendingSwitchTemplate(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Template wechseln</AlertDialogTitle>
            <AlertDialogDescription>
              Vorhandene Daten bleiben erhalten. Felder, die im neuen Template
              nicht vorhanden sind, werden nicht angezeigt, aber gespeichert.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-2">
            {alternatives.map((alt) => (
              <button
                key={alt.id}
                onClick={() => setPendingSwitchTemplate(alt)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  pendingSwitchTemplate?.id === alt.id
                    ? "border-primary bg-primary/5 dark:bg-primary/10"
                    : "border-white/20 dark:border-white/[0.1] bg-white/60 dark:bg-white/[0.08] hover:bg-white/80 dark:hover:bg-white/[0.12]"
                }`}
              >
                <div className="text-sm font-medium text-foreground">
                  {alt.name}
                </div>
                {alt.beschreibung && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {alt.beschreibung}
                  </div>
                )}
              </button>
            ))}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSwitchConfirm}
              disabled={!pendingSwitchTemplate || switching}
            >
              {switching && (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              )}
              Wechseln
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
