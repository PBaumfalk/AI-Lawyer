"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Tag,
  Shield,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { GlassPanel } from "@/components/ui/glass-panel";

interface TagKategorie {
  id: string;
  name: string;
  farbe: string;
  sortierung: number;
  system: boolean;
  createdAt: string;
}

/** Predefined system tags to seed on first load */
const SYSTEM_TAGS: { name: string; farbe: string }[] = [
  { name: "Schriftsatz", farbe: "#3B82F6" },    // blue
  { name: "Vertrag", farbe: "#8B5CF6" },         // purple
  { name: "Rechnung", farbe: "#10B981" },         // green
  { name: "Gutachten", farbe: "#F97316" },        // orange
  { name: "Korrespondenz", farbe: "#64748B" },    // slate
  { name: "Vollmacht", farbe: "#14B8A6" },        // teal
  { name: "Bescheid", farbe: "#F59E0B" },         // amber
  { name: "Sonstiges", farbe: "#9CA3AF" },        // gray
];

export default function DokumentTagsPage() {
  const [tags, setTags] = useState<TagKategorie[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editFarbe, setEditFarbe] = useState("");
  const [newName, setNewName] = useState("");
  const [newFarbe, setNewFarbe] = useState("#3B82F6");
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch("/api/dokumente/tags");
      if (!res.ok) throw new Error("Fehler beim Laden");
      const data = await res.json();
      setTags(data.tags);
    } catch {
      toast.error("Tags konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, []);

  const seedSystemTags = useCallback(async () => {
    // Seed system tags if none exist
    try {
      const res = await fetch("/api/dokumente/tags");
      if (!res.ok) return;
      const data = await res.json();

      if (data.tags.length === 0) {
        // Create all system tags
        for (let i = 0; i < SYSTEM_TAGS.length; i++) {
          const tag = SYSTEM_TAGS[i];
          await fetch("/api/dokumente/tags", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: tag.name,
              farbe: tag.farbe,
              system: true,
            }),
          });
        }
        // Refresh after seeding
        await fetchTags();
      }
    } catch {
      // Non-blocking -- seeding is best-effort
    }
  }, [fetchTags]);

  useEffect(() => {
    fetchTags().then(() => seedSystemTags());
  }, [fetchTags, seedSystemTags]);

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error("Name ist erforderlich");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/dokumente/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), farbe: newFarbe }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Fehler beim Erstellen");
      }
      toast.success("Tag erstellt");
      setNewName("");
      setNewFarbe("#3B82F6");
      setShowAddForm(false);
      fetchTags();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unbekannter Fehler";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/dokumente/tags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editName.trim(), farbe: editFarbe }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Fehler beim Aktualisieren");
      }
      toast.success("Tag aktualisiert");
      setEditingId(null);
      fetchTags();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unbekannter Fehler";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tag "${name}" wirklich loeschen?`)) return;

    try {
      const res = await fetch("/api/dokumente/tags", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Fehler beim Loeschen");
      }
      toast.success("Tag geloescht");
      fetchTags();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unbekannter Fehler";
      toast.error(message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Dokument-Tags
        </h1>
        <p className="text-muted-foreground mt-1">
          Tag-Kategorien fuer die Dokumentenverwaltung
        </p>
      </div>

      {/* Tag list */}
      <GlassPanel elevation="panel" className="overflow-hidden">
        <div className="p-4 border-b border-[var(--glass-border-color)] flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Tag className="w-4 h-4" />
            Tag-Kategorien ({tags.length})
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Neuer Tag
          </Button>
        </div>

        {/* Add form */}
        {showAddForm && (
          <div className="p-4 border-b border-[var(--glass-border-color)] glass-card rounded-none">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={newFarbe}
                onChange={(e) => setNewFarbe(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border-0"
                title="Farbe waehlen"
              />
              <Input
                placeholder="Tag-Name..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 h-8"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={saving || !newName.trim()}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-1" />
                )}
                Erstellen
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowAddForm(false);
                  setNewName("");
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Tag rows */}
        {tags.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Keine Tags vorhanden. Erstellen Sie den ersten Tag.
          </div>
        ) : (
          <div className="divide-y divide-[var(--glass-border-color)]">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center gap-4 px-4 py-3 hover:bg-white/20 dark:hover:bg-white/[0.05] transition-colors"
              >
                {editingId === tag.id ? (
                  // Edit mode
                  <>
                    <input
                      type="color"
                      value={editFarbe}
                      onChange={(e) => setEditFarbe(e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border-0 flex-shrink-0"
                    />
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 h-7 text-sm"
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleUpdate(tag.id)
                      }
                      autoFocus
                    />
                    <Button
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => handleUpdate(tag.id)}
                      disabled={saving}
                    >
                      {saving ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        "OK"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </>
                ) : (
                  // Display mode
                  <>
                    <div
                      className="w-5 h-5 rounded flex-shrink-0 border border-white/20"
                      style={{ backgroundColor: tag.farbe }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground">
                        {tag.name}
                      </span>
                    </div>
                    {tag.system && (
                      <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Shield className="w-3 h-3" />
                        System
                      </span>
                    )}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingId(tag.id);
                          setEditName(tag.name);
                          setEditFarbe(tag.farbe);
                        }}
                        className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
                        title="Bearbeiten"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {!tag.system && (
                        <button
                          onClick={() => handleDelete(tag.id, tag.name)}
                          className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950 text-slate-400 hover:text-rose-600"
                          title="Loeschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
