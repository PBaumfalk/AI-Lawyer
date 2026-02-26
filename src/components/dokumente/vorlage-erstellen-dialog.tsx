"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  X,
  FileText,
  Loader2,
  Search,
  FileCheck,
  ChevronRight,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

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
  platzhalter: string[];
  createdBy: { name: string };
}

interface CreatedDokument {
  id: string;
  name: string;
  mimeType: string;
}

interface VorlageErstellenDialogProps {
  akteId: string;
  ordnerList: string[];
  defaultOrdner: string | null;
  open: boolean;
  onClose: () => void;
  onCreated: (dokument?: CreatedDokument) => void;
  onOpenInEditor?: (dokument: CreatedDokument) => void;
}

export function VorlageErstellenDialog({
  akteId,
  ordnerList,
  defaultOrdner,
  open,
  onClose,
  onCreated,
  onOpenInEditor,
}: VorlageErstellenDialogProps) {
  const [step, setStep] = useState<"select" | "configure">("select");
  const [vorlagen, setVorlagen] = useState<VorlageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKategorie, setFilterKategorie] = useState<string | null>(null);

  // Configuration step
  const [selectedVorlage, setSelectedVorlage] = useState<VorlageItem | null>(null);
  const [dateiname, setDateiname] = useState("");
  const [ordner, setOrdner] = useState(defaultOrdner ?? "");
  const [tags, setTags] = useState("");

  // Load templates when dialog opens
  useEffect(() => {
    if (!open) return;
    setStep("select");
    setSelectedVorlage(null);
    setSearchQuery("");
    setFilterKategorie(null);
    setDateiname("");
    setOrdner(defaultOrdner ?? "");
    setTags("");

    const loadVorlagen = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/vorlagen");
        if (!res.ok) throw new Error("Fehler");
        const data = await res.json();
        setVorlagen(data.vorlagen);
      } catch {
        toast.error("Vorlagen konnten nicht geladen werden");
      } finally {
        setLoading(false);
      }
    };
    loadVorlagen();
  }, [open, defaultOrdner]);

  if (!open) return null;

  const handleClose = () => {
    if (creating) return;
    onClose();
  };

  const handleSelect = (vorlage: VorlageItem) => {
    setSelectedVorlage(vorlage);
    setDateiname(vorlage.name);
    setStep("configure");
  };

  const handleCreate = async (openInEditor = false) => {
    if (!selectedVorlage) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/akten/${akteId}/dokumente/aus-vorlage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vorlageId: selectedVorlage.id,
          dateiname: dateiname.trim() || selectedVorlage.name,
          ordner: ordner || null,
          tags: tags
            ? tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
            : [],
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erstellen fehlgeschlagen");
      }

      const data = await res.json();
      const createdDoc: CreatedDokument = {
        id: data.dokument.id,
        name: data.dokument.name,
        mimeType: data.dokument.mimeType,
      };

      toast.success("Dokument aus Vorlage erstellt");
      onCreated(createdDoc);
      handleClose();

      if (openInEditor && onOpenInEditor) {
        onOpenInEditor(createdDoc);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  // Filter templates
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

  const kategorien = Array.from(new Set(vorlagen.map((v) => v.kategorie))).sort();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Dialog */}
      <div className="relative bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl shadow-xl border border-white/20 dark:border-white/[0.08] w-full max-w-xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/20 dark:border-white/[0.08]">
          <div className="flex items-center gap-2">
            {step === "configure" && (
              <button
                onClick={() => setStep("select")}
                className="text-slate-400 hover:text-slate-600 mr-1"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
            )}
            <h2 className="text-lg font-heading text-foreground">
              {step === "select"
                ? "Vorlage auswählen"
                : "Dokument erstellen"}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {step === "select" ? (
            <div className="p-4 space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Vorlage suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                  autoFocus
                />
              </div>

              {/* Category filter */}
              {kategorien.length > 1 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setFilterKategorie(null)}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                      !filterKategorie
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    Alle
                  </button>
                  {kategorien.map((kat) => (
                    <button
                      key={kat}
                      onClick={() =>
                        setFilterKategorie(
                          filterKategorie === kat ? null : kat
                        )
                      }
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                        filterKategorie === kat
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {KATEGORIE_LABELS[kat] ?? kat}
                    </button>
                  ))}
                </div>
              )}

              {/* Template list */}
              {loading ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-400">
                  <FileText className="w-10 h-10 mx-auto text-slate-200 dark:text-slate-700 mb-2" />
                  {vorlagen.length === 0
                    ? "Keine Vorlagen vorhanden. Laden Sie unter Einstellungen → Vorlagen eine hoch."
                    : "Keine passenden Vorlagen gefunden."}
                </div>
              ) : (
                <div className="border border-white/20 dark:border-white/[0.08] rounded-lg divide-y divide-white/10 dark:divide-white/[0.04]">
                  {filtered.map((vorlage) => (
                    <button
                      key={vorlage.id}
                      onClick={() => handleSelect(vorlage)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/20 dark:hover:bg-white/[0.05] transition-colors text-left"
                    >
                      <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground truncate">
                            {vorlage.name}
                          </span>
                          <span
                            className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
                              KATEGORIE_COLORS[vorlage.kategorie] ??
                              KATEGORIE_COLORS.SONSTIGES
                            }`}
                          >
                            {KATEGORIE_LABELS[vorlage.kategorie] ??
                              vorlage.kategorie}
                          </span>
                        </div>
                        {vorlage.beschreibung && (
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {vorlage.beschreibung}
                          </p>
                        )}
                      </div>
                      {vorlage.platzhalter.length > 0 && (
                        <span className="text-[10px] text-slate-400 flex-shrink-0">
                          {vorlage.platzhalter.length} Felder
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Configure step */
            <div className="p-5 space-y-4">
              {/* Selected template info */}
              <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                <FileCheck className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                    {selectedVorlage?.name}
                  </p>
                  {selectedVorlage?.platzhalter &&
                    selectedVorlage.platzhalter.length > 0 && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                        {selectedVorlage.platzhalter.length} Platzhalter
                        werden automatisch mit Aktendaten befüllt
                      </p>
                    )}
                </div>
              </div>

              {/* Placeholders preview */}
              {selectedVorlage?.platzhalter &&
                selectedVorlage.platzhalter.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">
                      Platzhalter in dieser Vorlage
                    </Label>
                    <div className="flex flex-wrap gap-1">
                      {selectedVorlage.platzhalter.map((ph) => (
                        <code
                          key={ph}
                          className="bg-white/20 dark:bg-white/[0.06] px-1.5 py-0.5 rounded text-[11px] text-muted-foreground"
                        >
                          {`{{${ph}}}`}
                        </code>
                      ))}
                    </div>
                  </div>
                )}

              {/* Output filename */}
              <div className="space-y-1.5">
                <Label htmlFor="doc-name">Dateiname</Label>
                <Input
                  id="doc-name"
                  value={dateiname}
                  onChange={(e) => setDateiname(e.target.value)}
                  placeholder="Name des Dokuments"
                />
                <p className="text-[11px] text-slate-400">
                  .docx wird automatisch angehängt
                </p>
              </div>

              {/* Folder */}
              <div className="space-y-1.5">
                <Label htmlFor="doc-ordner">Ordner</Label>
                <select
                  id="doc-ordner"
                  value={ordner}
                  onChange={(e) => setOrdner(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-white/20 dark:border-white/[0.08] bg-white/50 dark:bg-white/[0.05] backdrop-blur-md text-sm text-foreground"
                >
                  <option value="">Kein Ordner</option>
                  {ordnerList.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tags */}
              <div className="space-y-1.5">
                <Label htmlFor="doc-tags">Tags (kommagetrennt)</Label>
                <Input
                  id="doc-tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="z.B. Entwurf, Mandatsvollmacht"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer (only in configure step) */}
        {step === "configure" && (
          <div className="flex justify-end gap-3 px-5 py-4 border-t border-white/20 dark:border-white/[0.08]">
            <Button variant="ghost" onClick={() => setStep("select")}>
              Zurück
            </Button>
            <Button
              variant="outline"
              onClick={() => handleCreate(false)}
              disabled={creating}
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Erstellen...
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4 mr-1.5" />
                  Nur erstellen
                </>
              )}
            </Button>
            {onOpenInEditor && (
              <Button onClick={() => handleCreate(true)} disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Erstellen...
                  </>
                ) : (
                  <>
                    <Pencil className="w-4 h-4 mr-1.5" />
                    Erstellen & bearbeiten
                  </>
                )}
              </Button>
            )}
            {!onOpenInEditor && (
              <Button onClick={() => handleCreate(false)} disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Erstellen...
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4 mr-1.5" />
                    Dokument erstellen
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
