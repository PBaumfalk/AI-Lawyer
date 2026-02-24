"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  FolderTree,
  Plus,
  Trash2,
  Star,
  Pencil,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Loader2,
  X,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface OrdnerSchemaItem {
  id: string;
  name: string;
  sachgebiet: string | null;
  ordner: string[];
  istStandard: boolean;
}

const SACHGEBIET_LABELS: Record<string, string> = {
  ARBEITSRECHT: "Arbeitsrecht",
  FAMILIENRECHT: "Familienrecht",
  VERKEHRSRECHT: "Verkehrsrecht",
  MIETRECHT: "Mietrecht",
  STRAFRECHT: "Strafrecht",
  ERBRECHT: "Erbrecht",
  SOZIALRECHT: "Sozialrecht",
  INKASSO: "Inkasso",
  HANDELSRECHT: "Handelsrecht",
  VERWALTUNGSRECHT: "Verwaltungsrecht",
  SONSTIGES: "Sonstiges",
};

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Ordner-Schemata settings tab: manage folder schemas for case creation.
 * Actions logged in Audit-Trail.
 */
export function OrdnerSchemataTab() {
  const [schemata, setSchemata] = useState<OrdnerSchemaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSchema, setEditingSchema] = useState<OrdnerSchemaItem | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // New schema form state
  const [newName, setNewName] = useState("");
  const [newSachgebiet, setNewSachgebiet] = useState("");
  const [newOrdner, setNewOrdner] = useState<string[]>(["Schriftsaetze", "Korrespondenz", "Rechnungen", "Sonstiges"]);
  const [newOrdnerInput, setNewOrdnerInput] = useState("");

  const fetchSchemata = useCallback(async () => {
    try {
      const res = await fetch("/api/ordner-schemata");
      if (!res.ok) throw new Error("Fehler");
      const data = await res.json();
      setSchemata(data.schemata ?? []);
    } catch {
      toast.error("Ordner-Schemata konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchemata();
  }, [fetchSchemata]);

  // Create new schema
  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error("Name ist erforderlich");
      return;
    }
    try {
      const res = await fetch("/api/ordner-schemata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          sachgebiet: newSachgebiet || null,
          ordner: newOrdner,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Fehler");
      }
      toast.success("Schema erstellt");
      setShowNewDialog(false);
      setNewName("");
      setNewSachgebiet("");
      setNewOrdner(["Schriftsaetze", "Korrespondenz", "Rechnungen", "Sonstiges"]);
      fetchSchemata();
    } catch (err: any) {
      toast.error(err.message || "Fehler beim Erstellen");
    }
  };

  // Delete schema
  const handleDelete = async (schema: OrdnerSchemaItem) => {
    if (!confirm(`Schema "${schema.name}" wirklich loeschen?`)) return;
    try {
      const res = await fetch(`/api/ordner-schemata/${schema.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Fehler");
      toast.success("Schema geloescht");
      fetchSchemata();
    } catch {
      toast.error("Fehler beim Loeschen");
    }
  };

  // Set as default
  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch(`/api/ordner-schemata/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ istStandard: true }),
      });
      if (!res.ok) throw new Error("Fehler");
      toast.success("Als Standard gesetzt");
      fetchSchemata();
    } catch {
      toast.error("Fehler beim Setzen als Standard");
    }
  };

  // Add folder to new schema
  const handleAddOrdner = () => {
    if (!newOrdnerInput.trim()) return;
    setNewOrdner((prev) => [...prev, newOrdnerInput.trim()]);
    setNewOrdnerInput("");
  };

  // Remove folder from new schema
  const handleRemoveOrdner = (index: number) => {
    setNewOrdner((prev) => prev.filter((_, i) => i !== index));
  };

  // Move folder
  const handleMoveOrdner = (index: number, direction: "up" | "down") => {
    setNewOrdner((prev) => {
      const arr = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= arr.length) return arr;
      [arr[index], arr[targetIndex]] = [arr[targetIndex], arr[index]];
      return arr;
    });
  };

  // Reset
  const handleReset = async () => {
    setShowResetConfirm(false);
    try {
      // Delete all non-standard schemata
      for (const s of schemata.filter((s) => !s.istStandard)) {
        await fetch(`/api/ordner-schemata/${s.id}`, { method: "DELETE" });
      }
      toast.success("Ordner-Schemata zurueckgesetzt");
      fetchSchemata();
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

  return (
    <div className="space-y-6">
      <div className="glass rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-heading text-foreground">
              Ordner-Schemata
            </h3>
            <Badge variant="outline" className="text-xs">
              {schemata.length}
            </Badge>
          </div>
          <Button size="sm" onClick={() => setShowNewDialog(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Neues Schema
          </Button>
        </div>

        {schemata.length === 0 ? (
          <div className="text-center py-8">
            <FolderTree className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-sm text-muted-foreground">
              Noch keine Ordner-Schemata vorhanden.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {schemata.map((schema) => (
              <div
                key={schema.id}
                className="border rounded-lg p-4 hover:border-primary/20 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium">{schema.name}</h4>
                    {schema.sachgebiet && (
                      <Badge variant="outline" className="text-[10px]">
                        {SACHGEBIET_LABELS[schema.sachgebiet] ?? schema.sachgebiet}
                      </Badge>
                    )}
                    {schema.istStandard && (
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px]">
                        <Star className="w-2.5 h-2.5 mr-0.5" />
                        Standard
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!schema.istStandard && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(schema.id)}
                        className="text-xs"
                      >
                        <Star className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(schema)}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {schema.ordner.map((ordner, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-muted-foreground"
                    >
                      {ordner}
                    </span>
                  ))}
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

      {/* New schema dialog */}
      {showNewDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass rounded-xl p-6 w-full max-w-lg mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-heading text-foreground">
                Neues Ordner-Schema
              </h3>
              <button
                onClick={() => setShowNewDialog(false)}
                className="p-1 rounded-md hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <Label>Name <span className="text-rose-500">*</span></Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="z.B. Zivilrecht Standard"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Sachgebiet (optional)</Label>
              <select
                value={newSachgebiet}
                onChange={(e) => setNewSachgebiet(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Kein Sachgebiet (global)</option>
                {Object.entries(SACHGEBIET_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Ordner</Label>
              <div className="space-y-1">
                {newOrdner.map((ordner, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="flex-1 text-sm px-2 py-1 rounded bg-muted/50">
                      {ordner}
                    </span>
                    <button
                      onClick={() => handleMoveOrdner(i, "up")}
                      disabled={i === 0}
                      className="p-1 rounded hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveOrdner(i, "down")}
                      disabled={i === newOrdner.length - 1}
                      className="p-1 rounded hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleRemoveOrdner(i)}
                      className="p-1 rounded hover:bg-muted text-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1 mt-2">
                <Input
                  value={newOrdnerInput}
                  onChange={(e) => setNewOrdnerInput(e.target.value)}
                  placeholder="Neuer Ordner..."
                  className="h-8 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddOrdner();
                    }
                  }}
                />
                <Button size="sm" onClick={handleAddOrdner} disabled={!newOrdnerInput.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowNewDialog(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleCreate} disabled={!newName.trim()}>
                Schema erstellen
              </Button>
            </div>
          </div>
        </div>
      )}

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
