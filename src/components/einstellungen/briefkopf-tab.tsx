"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Star,
  Pencil,
  Trash2,
  Plus,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { BriefkopfEditor } from "@/components/briefkopf/briefkopf-editor";

// ─── Types ──────────────────────────────────────────────────────────────────

interface BriefkopfItem {
  id: string;
  name: string;
  kanzleiName: string | null;
  istStandard: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Briefkopf settings tab: list, create, edit, delete Briefkoepfe.
 * Actions logged in Audit-Trail. Reset to default available.
 */
export function BriefkopfTab() {
  const [briefkoepfe, setBriefkoepfe] = useState<BriefkopfItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const fetchBriefkoepfe = useCallback(async () => {
    try {
      const res = await fetch("/api/briefkopf");
      if (!res.ok) throw new Error("Fehler");
      const data = await res.json();
      setBriefkoepfe(data.briefkoepfe ?? []);
    } catch {
      toast.error("Briefkoepfe konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBriefkoepfe();
  }, [fetchBriefkoepfe]);

  // Set as default
  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch(`/api/briefkopf/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ istStandard: true }),
      });
      if (!res.ok) throw new Error("Fehler");
      toast.success("Als Standard gesetzt");
      fetchBriefkoepfe();
    } catch {
      toast.error("Fehler beim Setzen als Standard");
    }
  };

  // Delete
  const handleDelete = async (bk: BriefkopfItem) => {
    if (!confirm(`Briefkopf "${bk.name}" wirklich loeschen?`)) return;
    try {
      const res = await fetch(`/api/briefkopf/${bk.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Fehler");
      toast.success("Briefkopf geloescht");
      fetchBriefkoepfe();
    } catch {
      toast.error("Fehler beim Loeschen");
    }
  };

  // Reset
  const handleReset = async () => {
    setShowResetConfirm(false);
    // Remove all briefkoepfe except the first default
    try {
      for (const bk of briefkoepfe.slice(1)) {
        await fetch(`/api/briefkopf/${bk.id}`, { method: "DELETE" });
      }
      toast.success("Briefkopf-Einstellungen zurueckgesetzt");
      fetchBriefkoepfe();
    } catch {
      toast.error("Fehler beim Zuruecksetzen");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Show editor if creating or editing
  if (creating || editingId) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setCreating(false);
            setEditingId(null);
          }}
        >
          Zurueck zur Uebersicht
        </Button>
        <BriefkopfEditor
          briefkopfId={editingId ?? undefined}
          onSaved={() => {
            setCreating(false);
            setEditingId(null);
            fetchBriefkoepfe();
          }}
          onCancel={() => {
            setCreating(false);
            setEditingId(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-heading text-foreground">
              Briefkoepfe
            </h3>
            <Badge variant="outline" className="text-xs">
              {briefkoepfe.length}
            </Badge>
          </div>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Neuer Briefkopf
          </Button>
        </div>

        {briefkoepfe.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">
              Noch keine Briefkoepfe vorhanden.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setCreating(true)}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Ersten Briefkopf erstellen
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-white/10 dark:divide-white/[0.06]">
            {briefkoepfe.map((bk) => (
              <div
                key={bk.id}
                className="flex items-center justify-between py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{bk.name}</p>
                      {bk.istStandard && (
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px]">
                          <Star className="w-2.5 h-2.5 mr-0.5" />
                          Standard
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {bk.kanzleiName ?? "Kein Kanzleiname"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!bk.istStandard && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetDefault(bk.id)}
                      className="text-xs"
                    >
                      <Star className="w-3.5 h-3.5 mr-1" />
                      Standard
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingId(bk.id)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(bk)}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
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
