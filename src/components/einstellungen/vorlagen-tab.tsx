"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Search,
  CheckCircle2,
  XCircle,
  Upload,
  RotateCcw,
  X,
  Loader2,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface VorlageItem {
  id: string;
  name: string;
  beschreibung: string | null;
  kategorie: string;
  dateiname: string;
  freigegeben: boolean;
  createdAt: string;
  createdBy: { name: string } | null;
}

const KATEGORIE_LABELS: Record<string, string> = {
  SCHRIFTSATZ: "Schriftsatz",
  KLAGE: "Klage",
  MANDATSVOLLMACHT: "Mandatsvollmacht",
  MAHNUNG: "Mahnung",
  VERTRAG: "Vertrag",
  BRIEF: "Brief",
  BESCHEID: "Bescheid",
  SONSTIGES: "Sonstiges",
};

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Vorlagen settings tab: list templates with Freigabe status, manage categories.
 * All actions logged in Audit-Trail via API.
 */
export function VorlagenTab() {
  const [vorlagen, setVorlagen] = useState<VorlageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const fetchVorlagen = useCallback(async () => {
    try {
      const res = await fetch("/api/vorlagen");
      if (!res.ok) throw new Error("Fehler");
      const data = await res.json();
      setVorlagen(data.vorlagen ?? []);
    } catch {
      toast.error("Vorlagen konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVorlagen();
  }, [fetchVorlagen]);

  // Toggle Freigabe
  const handleToggleFreigabe = async (vorlage: VorlageItem) => {
    try {
      const res = await fetch(`/api/vorlagen/${vorlage.id}/freigabe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ freigeben: !vorlage.freigegeben }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Fehler");
      }
      toast.success(
        vorlage.freigegeben ? "Vorlage zurueckgezogen" : "Vorlage freigegeben"
      );
      fetchVorlagen();
    } catch (err: any) {
      toast.error(err.message || "Fehler bei Freigabe");
    }
  };

  // Delete vorlage
  const handleDelete = async (vorlage: VorlageItem) => {
    if (!confirm(`Vorlage "${vorlage.name}" wirklich loeschen?`)) return;
    try {
      const res = await fetch(`/api/vorlagen/${vorlage.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Fehler");
      toast.success("Vorlage geloescht");
      fetchVorlagen();
    } catch {
      toast.error("Fehler beim Loeschen");
    }
  };

  // Reset (remove all non-standard templates)
  const handleReset = async () => {
    setShowResetConfirm(false);
    toast.info("Vorlagen-Einstellungen zurueckgesetzt");
    // Reset is conceptual: revoke all Freigaben
    try {
      for (const v of vorlagen.filter((v) => v.freigegeben)) {
        await fetch(`/api/vorlagen/${v.id}/freigabe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ freigeben: false }),
        });
      }
      fetchVorlagen();
    } catch {
      toast.error("Fehler beim Zuruecksetzen");
    }
  };

  const filtered = vorlagen.filter((v) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      (v.beschreibung?.toLowerCase().includes(q) ?? false)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-heading text-foreground">
              Dokumentvorlagen
            </h3>
            <Badge variant="outline" className="text-xs">
              {vorlagen.length} Vorlagen
            </Badge>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Vorlagen durchsuchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8"
          />
        </div>

        {/* Template list */}
        <div className="divide-y divide-white/10 dark:divide-white/[0.06]">
          {filtered.map((v) => (
            <div key={v.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{v.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {KATEGORIE_LABELS[v.kategorie] ?? v.kategorie}
                    {v.createdBy && ` - ${v.createdBy.name}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {v.freigegeben ? (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-[10px]">
                    Freigegeben
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    Entwurf
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleFreigabe(v)}
                  className="text-xs"
                >
                  {v.freigegeben ? (
                    <>
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      Zurueckziehen
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Freigeben
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Keine Vorlagen gefunden.
            </p>
          )}
        </div>
      </div>

      {/* Reset button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => setShowResetConfirm(true)}
          className="text-muted-foreground"
        >
          <RotateCcw className="w-4 h-4 mr-1.5" />
          Auf Standard zuruecksetzen
        </Button>
      </div>

      {/* Reset confirmation dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass rounded-xl p-6 w-full max-w-md mx-4 space-y-4">
            <h3 className="text-lg font-heading text-foreground">
              Einstellungen zuruecksetzen?
            </h3>
            <p className="text-sm text-muted-foreground">
              Moechten Sie die Einstellungen in diesem Bereich auf die Standardwerte
              zuruecksetzen? Diese Aktion kann nicht rueckgaengig gemacht werden.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowResetConfirm(false)}
              >
                Abbrechen
              </Button>
              <Button variant="destructive" onClick={handleReset}>
                Zuruecksetzen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
