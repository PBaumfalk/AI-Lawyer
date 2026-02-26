"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload,
  X,
  FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const KATEGORIE_OPTIONS = [
  { value: "SCHRIFTSATZ", label: "Schriftsatz" },
  { value: "KLAGE", label: "Klage" },
  { value: "MANDATSVOLLMACHT", label: "Mandatsvollmacht" },
  { value: "MAHNUNG", label: "Mahnung" },
  { value: "VERTRAG", label: "Vertrag" },
  { value: "BRIEF", label: "Brief" },
  { value: "BESCHEID", label: "Bescheid" },
  { value: "SONSTIGES", label: "Sonstiges" },
];

interface VorlageUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
}

export function VorlageUploadDialog({
  open,
  onClose,
  onUploaded,
}: VorlageUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [kategorie, setKategorie] = useState("SONSTIGES");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleClose = () => {
    if (uploading) return;
    setFile(null);
    setName("");
    setBeschreibung("");
    setKategorie("SONSTIGES");
    onClose();
  };

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".docx")) {
      toast.error("Nur DOCX-Dateien werden unterstützt");
      return;
    }
    setFile(f);
    // Pre-fill name from filename if empty
    if (!name) {
      setName(f.name.replace(/\.docx$/i, ""));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name.trim()) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name.trim());
      formData.append("beschreibung", beschreibung);
      formData.append("kategorie", kategorie);

      const res = await fetch("/api/vorlagen", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload fehlgeschlagen");
      }

      toast.success("Vorlage hochgeladen");
      onUploaded();
      handleClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="relative bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl shadow-xl border border-white/20 dark:border-white/[0.08] w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/20 dark:border-white/[0.08]">
          <h2 className="text-lg font-heading text-foreground">
            Vorlage hochladen
          </h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* File drop zone */}
          {!file ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-blue-400 bg-blue-50 dark:bg-blue-950/20"
                  : "border-white/20 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-slate-600"
              }`}
            >
              <Upload className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm text-muted-foreground">
                DOCX-Datei hier ablegen oder{" "}
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  durchsuchen
                </span>
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Nur .docx-Dateien mit {"{{platzhalter}}"} werden unterstützt
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-white/15 dark:bg-white/[0.04] rounded-lg p-3">
              <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {file.name}
                </p>
                <p className="text-xs text-slate-500">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-slate-400 hover:text-slate-600 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="vorlage-name">Name *</Label>
            <Input
              id="vorlage-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Mandatsvollmacht"
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="vorlage-kategorie">Kategorie</Label>
            <select
              id="vorlage-kategorie"
              value={kategorie}
              onChange={(e) => setKategorie(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-white/20 dark:border-white/[0.08] bg-white/50 dark:bg-white/[0.05] backdrop-blur-md text-sm text-foreground"
            >
              {KATEGORIE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="vorlage-beschreibung">Beschreibung</Label>
            <Textarea
              id="vorlage-beschreibung"
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              placeholder="Kurze Beschreibung der Vorlage..."
              rows={2}
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={!file || !name.trim() || uploading}>
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Hochladen...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-1.5" />
                  Hochladen
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
