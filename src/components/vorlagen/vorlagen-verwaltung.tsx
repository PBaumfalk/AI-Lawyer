"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  FileText,
  Trash2,
  Download,
  X,
  Loader2,
  Info,
  Pencil,
  FilePlus2,
} from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { VorlageUploadDialog } from "./vorlage-upload-dialog";
import { PLATZHALTER_GRUPPEN } from "@/lib/vorlagen";

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

const KATEGORIE_COLORS: Record<string, string> = {
  SCHRIFTSATZ: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  KLAGE: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  MANDATSVOLLMACHT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  MAHNUNG: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  VERTRAG: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  BRIEF: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
  BESCHEID: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  SONSTIGES: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

interface VorlageItem {
  id: string;
  name: string;
  beschreibung: string | null;
  kategorie: string;
  dateiname: string;
  groesse: number;
  platzhalter: string[];
  createdAt: string;
  createdBy: { name: string };
}

interface VorlagenVerwaltungProps {
  initialVorlagen: VorlageItem[];
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function VorlagenVerwaltung({ initialVorlagen }: VorlagenVerwaltungProps) {
  const router = useRouter();
  const [vorlagen, setVorlagen] = useState<VorlageItem[]>(initialVorlagen);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKategorie, setFilterKategorie] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [newVorlageOpen, setNewVorlageOpen] = useState(false);
  const [selectedVorlage, setSelectedVorlage] = useState<string | null>(null);
  const [showPlatzhalter, setShowPlatzhalter] = useState(false);

  const fetchVorlagen = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterKategorie) params.set("kategorie", filterKategorie);
      if (searchQuery) params.set("q", searchQuery);

      const res = await fetch(`/api/vorlagen?${params}`);
      if (!res.ok) throw new Error("Fehler beim Laden");
      const data = await res.json();
      setVorlagen(data.vorlagen);
    } catch {
      toast.error("Vorlagen konnten nicht geladen werden");
    }
  }, [filterKategorie, searchQuery]);

  const handleDelete = async (vorlage: VorlageItem) => {
    if (!confirm(`Vorlage "${vorlage.name}" wirklich löschen?`)) return;
    try {
      const res = await fetch(`/api/vorlagen/${vorlage.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Fehler beim Löschen");
      toast.success("Vorlage gelöscht");
      setVorlagen((prev) => prev.filter((v) => v.id !== vorlage.id));
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDownload = (vorlage: VorlageItem) => {
    const link = document.createElement("a");
    link.href = `/api/vorlagen/${vorlage.id}?download=true`;
    link.download = vorlage.dateiname;
    link.click();
  };

  // Filter
  const filtered = vorlagen.filter((v) => {
    if (filterKategorie && v.kategorie !== filterKategorie) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        v.name.toLowerCase().includes(q) ||
        (v.beschreibung?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  // Get unique categories from vorlagen for filter chips
  const kategorien = Array.from(new Set(vorlagen.map((v) => v.kategorie))).sort();

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Vorlagen durchsuchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPlatzhalter(!showPlatzhalter)}
        >
          <Info className="w-4 h-4 mr-1.5" />
          Platzhalter
        </Button>

        <Button size="sm" variant="outline" onClick={() => setNewVorlageOpen(true)}>
          <FilePlus2 className="w-4 h-4 mr-1.5" />
          Neue Vorlage
        </Button>

        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Vorlage hochladen
        </Button>
      </div>

      {/* Category filter chips */}
      {kategorien.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterKategorie(null)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              !filterKategorie
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            Alle ({vorlagen.length})
          </button>
          {kategorien.map((kat) => (
            <button
              key={kat}
              onClick={() =>
                setFilterKategorie(filterKategorie === kat ? null : kat)
              }
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                filterKategorie === kat
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {KATEGORIE_LABELS[kat] ?? kat} (
              {vorlagen.filter((v) => v.kategorie === kat).length})
            </button>
          ))}
        </div>
      )}

      {/* Placeholder reference panel */}
      {showPlatzhalter && (
        <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-foreground">
              Verfügbare Platzhalter
            </h3>
            <button
              onClick={() => setShowPlatzhalter(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Verwenden Sie diese Platzhalter in Ihren DOCX-Vorlagen. Format:{" "}
            <code className="bg-white/20 dark:bg-white/[0.06] px-1 py-0.5 rounded text-[11px]">
              {"{{platzhalter}}"}
            </code>
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {PLATZHALTER_GRUPPEN.map((gruppe) => (
              <div key={gruppe.prefix}>
                <div className="text-xs font-medium text-foreground/80 mb-1.5">
                  {gruppe.label}
                </div>
                <div className="space-y-0.5">
                  {gruppe.felder.map((feld) => (
                    <div
                      key={feld.key}
                      className="flex items-center gap-2 text-[11px]"
                    >
                      <code className="bg-white/20 dark:bg-white/[0.06] px-1 py-0.5 rounded text-muted-foreground flex-shrink-0">
                        {`{{${feld.key}}}`}
                      </code>
                      <span className="text-slate-400 truncate">
                        {feld.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Template list */}
      <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08]">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400 space-y-3">
            <FileText className="w-12 h-12 mx-auto text-slate-200 dark:text-slate-700" />
            <p>
              {searchQuery || filterKategorie
                ? "Keine Vorlagen gefunden."
                : "Noch keine Vorlagen vorhanden."}
            </p>
            {!searchQuery && !filterKategorie && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setUploadOpen(true)}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Erste Vorlage hochladen
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/10 dark:divide-white/[0.04]">
            {filtered.map((vorlage) => (
              <div
                key={vorlage.id}
                className="flex items-center gap-4 px-4 py-3 hover:bg-white/20 dark:hover:bg-white/[0.05] transition-colors group"
              >
                {/* Icon */}
                <div className="flex-shrink-0">
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">
                      {vorlage.name}
                    </p>
                    <span
                      className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        KATEGORIE_COLORS[vorlage.kategorie] ?? KATEGORIE_COLORS.SONSTIGES
                      }`}
                    >
                      {KATEGORIE_LABELS[vorlage.kategorie] ?? vorlage.kategorie}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {vorlage.beschreibung && (
                      <>
                        <span className="text-xs text-slate-500 truncate max-w-[300px]">
                          {vorlage.beschreibung}
                        </span>
                        <span className="text-xs text-slate-300 dark:text-slate-600">
                          ·
                        </span>
                      </>
                    )}
                    <span className="text-xs text-slate-500">
                      {formatFileSize(vorlage.groesse)}
                    </span>
                    <span className="text-xs text-slate-300 dark:text-slate-600">
                      ·
                    </span>
                    <span className="text-xs text-slate-500">
                      {vorlage.createdBy.name}
                    </span>
                    <span className="text-xs text-slate-300 dark:text-slate-600">
                      ·
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatDate(vorlage.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Placeholders count */}
                <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0">
                  {vorlage.platzhalter.length > 0 && (
                    <button
                      onClick={() =>
                        setSelectedVorlage(
                          selectedVorlage === vorlage.id ? null : vorlage.id
                        )
                      }
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      {vorlage.platzhalter.length} Platzhalter
                    </button>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => handleDownload(vorlage)}
                    className="p-1.5 rounded-md hover:bg-white/20 dark:hover:bg-white/[0.06] text-slate-400 hover:text-slate-600"
                    title="Herunterladen"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(vorlage)}
                    className="p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950 text-slate-400 hover:text-rose-600"
                    title="Löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Placeholder detail for selected template */}
      {selectedVorlage && (
        <PlatzhalterDetail
          vorlage={filtered.find((v) => v.id === selectedVorlage)!}
          onClose={() => setSelectedVorlage(null)}
        />
      )}

      {/* Upload dialog */}
      <VorlageUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          fetchVorlagen();
          router.refresh();
        }}
      />

      {/* New blank template dialog */}
      <NeueVorlageDialog
        open={newVorlageOpen}
        onClose={() => setNewVorlageOpen(false)}
        onCreated={() => {
          fetchVorlagen();
          router.refresh();
        }}
      />
    </div>
  );
}

function PlatzhalterDetail({
  vorlage,
  onClose,
}: {
  vorlage: VorlageItem;
  onClose: () => void;
}) {
  if (!vorlage) return null;

  return (
    <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-foreground">
          Platzhalter in &quot;{vorlage.name}&quot;
        </h3>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {vorlage.platzhalter.map((ph) => (
          <code
            key={ph}
            className="bg-white/20 dark:bg-white/[0.06] px-2 py-0.5 rounded text-xs text-muted-foreground"
          >
            {`{{${ph}}}`}
          </code>
        ))}
        {vorlage.platzhalter.length === 0 && (
          <span className="text-xs text-slate-400">
            Keine Platzhalter erkannt
          </span>
        )}
      </div>
    </div>
  );
}

// ── New blank template dialog ─────────────────────────────────────────────────

const KATEGORIE_OPTIONS = [
  "SCHRIFTSATZ",
  "KLAGE",
  "MANDATSVOLLMACHT",
  "MAHNUNG",
  "VERTRAG",
  "BRIEF",
  "BESCHEID",
  "SONSTIGES",
] as const;

function NeueVorlageDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [kategorie, setKategorie] = useState("SONSTIGES");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name ist erforderlich");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/vorlagen/neu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          beschreibung: beschreibung.trim() || null,
          kategorie,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Fehler beim Erstellen");
      }
      toast.success("Vorlage erstellt");
      setName("");
      setBeschreibung("");
      setKategorie("SONSTIGES");
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full max-w-md bg-white/50 dark:bg-white/[0.05] backdrop-blur-md border-l border-white/20 dark:border-white/[0.08] shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-white/20 dark:border-white/[0.08]">
          <h2 className="text-lg font-heading text-foreground">
            Neue Vorlage erstellen
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-white/20 dark:hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <p className="text-sm text-slate-500">
            Erstellt eine neue leere DOCX-Vorlage. Sie können diese anschließend herunterladen,
            mit Platzhaltern versehen und erneut hochladen.
          </p>

          <div className="space-y-2">
            <Label htmlFor="neue-vorlage-name">
              Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="neue-vorlage-name"
              placeholder="z.B. Mandatsvollmacht"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="neue-vorlage-beschreibung">Beschreibung</Label>
            <Input
              id="neue-vorlage-beschreibung"
              placeholder="Optionale Beschreibung..."
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="neue-vorlage-kategorie">Kategorie</Label>
            <Select
              id="neue-vorlage-kategorie"
              value={kategorie}
              onChange={(e) => setKategorie(e.target.value)}
            >
              {KATEGORIE_OPTIONS.map((kat) => (
                <option key={kat} value={kat}>
                  {KATEGORIE_LABELS[kat] ?? kat}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/20 dark:border-white/[0.08]">
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Vorlage erstellen
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
