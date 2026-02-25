"use client";

import { useEffect, useState, useCallback } from "react";
import { Building2, Plus, Users, FolderOpen, Trash2, Pencil, ShieldAlert, ShieldOff } from "lucide-react";
import { DezernatDialog } from "@/components/admin/dezernat-dialog";

interface Dezernat {
  id: string;
  name: string;
  beschreibung: string | null;
  mitglieder: { id: string; name: string; email: string; role: string }[];
  _count: { akten: number; mitglieder: number };
}

interface AdminOverride {
  id: string;
  grund: string;
  createdAt: string;
  gueltigBis: string | null;
  akte: { id: string; aktenzeichen: string; kurzrubrum: string | null };
}

export default function DezernatePage() {
  const [dezernate, setDezernate] = useState<Dezernat[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDezernat, setEditingDezernat] = useState<Dezernat | null>(null);
  const [overrides, setOverrides] = useState<AdminOverride[]>([]);
  const [overridesLoading, setOverridesLoading] = useState(true);

  const loadDezernate = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dezernate");
      if (res.ok) {
        const data = await res.json();
        setDezernate(data);
      }
    } catch {
      // Error handling
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOverrides = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/override");
      if (res.ok) {
        const data = await res.json();
        setOverrides(data);
      }
    } catch {
      // Silent fail
    } finally {
      setOverridesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDezernate();
    loadOverrides();
  }, [loadDezernate, loadOverrides]);

  const handleRevokeOverride = async (overrideId: string) => {
    try {
      const res = await fetch(`/api/admin/override?id=${overrideId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setOverrides((prev) => prev.filter((o) => o.id !== overrideId));
      }
    } catch {
      // Silent fail
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Dezernat wirklich loeschen?")) return;
    try {
      const res = await fetch(`/api/admin/dezernate/${id}`, { method: "DELETE" });
      if (res.ok) {
        await loadDezernate();
      } else {
        const data = await res.json();
        alert(data.error || "Fehler beim Loeschen");
      }
    } catch {
      alert("Fehler beim Loeschen");
    }
  };

  const handleEdit = (dezernat: Dezernat) => {
    setEditingDezernat(dezernat);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingDezernat(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Dezernate</h1>
          <p className="text-muted-foreground mt-1">
            Dezernate verwalten -- Gruppen von Nutzern mit gemeinsamem Aktenzugriff
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Neues Dezernat
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Lade Dezernate...</div>
      ) : dezernate.length === 0 ? (
        <div className="text-center py-12 border border-dashed rounded-lg">
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="font-medium text-lg">Keine Dezernate vorhanden</h3>
          <p className="text-muted-foreground mt-1">
            Erstellen Sie ein Dezernat, um Nutzern gruppenbasierten Aktenzugriff zu ermoeglichen.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {dezernate.map((dezernat) => (
            <div
              key={dezernat.id}
              className="border rounded-lg p-5 hover:shadow-md transition-shadow bg-card"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-brand-600" />
                  <h3 className="font-semibold text-lg">{dezernat.name}</h3>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(dezernat)}
                    className="p-1.5 rounded-md hover:bg-muted transition-colors"
                    title="Bearbeiten"
                  >
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handleDelete(dezernat.id)}
                    className="p-1.5 rounded-md hover:bg-rose-50 transition-colors"
                    title="Loeschen"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                  </button>
                </div>
              </div>

              {dezernat.beschreibung && (
                <p className="text-sm text-muted-foreground mb-3">
                  {dezernat.beschreibung}
                </p>
              )}

              <div className="flex gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  <span>{dezernat._count.mitglieder} Mitglieder</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4" />
                  <span>{dezernat._count.akten} Akten</span>
                </div>
              </div>

              {dezernat.mitglieder.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {dezernat.mitglieder.slice(0, 5).map((m) => (
                    <span
                      key={m.id}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {m.name}
                    </span>
                  ))}
                  {dezernat.mitglieder.length > 5 && (
                    <span className="text-xs text-muted-foreground">
                      +{dezernat.mitglieder.length - 5} weitere
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <DezernatDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        dezernat={editingDezernat}
        onSuccess={loadDezernate}
      />

      {/* Active Admin Overrides Section */}
      <div className="mt-8 space-y-4">
        <h2 className="text-xl font-heading font-bold">
          Aktive Admin-Zugriffsueberschreibungen
        </h2>
        {overridesLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Lade Ueberschreibungen...
          </div>
        ) : overrides.length === 0 ? (
          <div className="text-center py-8 border border-dashed rounded-lg">
            <ShieldAlert className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              Keine aktiven Zugriffsueberschreibungen vorhanden
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-4 py-3 font-medium">Akte</th>
                  <th className="px-4 py-3 font-medium">Grund</th>
                  <th className="px-4 py-3 font-medium">Erstellt am</th>
                  <th className="px-4 py-3 font-medium">Gueltig bis</th>
                  <th className="px-4 py-3 font-medium text-right">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {overrides.map((override) => (
                  <tr key={override.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{override.akte.aktenzeichen}</div>
                      {override.akte.kurzrubrum && (
                        <div className="text-xs text-muted-foreground">
                          {override.akte.kurzrubrum}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                      {override.grund}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(override.createdAt).toLocaleDateString("de-DE")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {override.gueltigBis
                        ? new Date(override.gueltigBis).toLocaleDateString("de-DE")
                        : "Unbefristet"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRevokeOverride(override.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 dark:text-rose-300 dark:bg-rose-950 dark:hover:bg-rose-900 transition-colors"
                      >
                        <ShieldOff className="w-3.5 h-3.5" />
                        Aufheben
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
