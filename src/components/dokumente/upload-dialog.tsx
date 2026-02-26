"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Upload,
  X,
  FileText,
  Image,
  File,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface UploadDialogProps {
  akteId: string;
  ordnerList: string[];
  defaultOrdner?: string | null;
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
}

interface QueuedFile {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType === "application/pdf" || mimeType.startsWith("text/")) return FileText;
  return File;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadDialog({
  akteId,
  ordnerList,
  defaultOrdner,
  open,
  onClose,
  onUploaded,
}: UploadDialogProps) {
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [ordner, setOrdner] = useState(defaultOrdner ?? "");
  const [newOrdner, setNewOrdner] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles).map((file) => ({
      file,
      status: "pending" as const,
    }));
    setFiles((prev) => [...prev, ...arr]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);

    const targetOrdner = newOrdner.trim() || ordner || null;
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      setFiles((prev) =>
        prev.map((f, idx) =>
          idx === i ? { ...f, status: "uploading" } : f
        )
      );

      try {
        const formData = new FormData();
        formData.append("file", files[i].file);
        if (targetOrdner) formData.append("ordner", targetOrdner);
        if (tags.length > 0) formData.append("tags", tags.join(","));

        const res = await fetch(`/api/akten/${akteId}/dokumente`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Upload fehlgeschlagen");
        }

        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "done" } : f
          )
        );
        successCount++;
      } catch (err: any) {
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: "error", error: err.message } : f
          )
        );
        errorCount++;
      }
    }

    setUploading(false);

    if (successCount > 0) {
      toast.success(
        `${successCount} Dokument${successCount !== 1 ? "e" : ""} hochgeladen`
      );
      onUploaded();
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} Upload${errorCount !== 1 ? "s" : ""} fehlgeschlagen`);
    }

    // Close if all successful
    if (errorCount === 0) {
      handleClose();
    }
  };

  const handleClose = () => {
    setFiles([]);
    setOrdner(defaultOrdner ?? "");
    setNewOrdner("");
    setTagsInput("");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={uploading ? undefined : handleClose}
      />

      {/* Dialog */}
      <div className="relative bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl shadow-xl border border-white/20 dark:border-white/[0.08] w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/20 dark:border-white/[0.08]">
          <h2 className="text-lg font-heading text-foreground">
            Dokumente hochladen
          </h2>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="p-1.5 rounded-md hover:bg-white/20 dark:hover:bg-white/[0.06] text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragOver
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600"
            }`}
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <p className="text-sm text-foreground/80">
              Dateien hierher ziehen oder{" "}
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                durchsuchen
              </span>
            </p>
            <p className="text-xs text-slate-400 mt-1">
              PDF, Word, Bilder, Textdateien und mehr
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-slate-500">
                {files.length} Datei{files.length !== 1 ? "en" : ""} ausgewählt
              </Label>
              <div className="max-h-40 overflow-y-auto space-y-1.5">
                {files.map((qf, i) => {
                  const Icon = getFileIcon(qf.file.type);
                  return (
                    <div
                      key={`${qf.file.name}-${i}`}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/15 dark:bg-white/[0.04]"
                    >
                      <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 dark:text-slate-200 truncate">
                          {qf.file.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatFileSize(qf.file.size)}
                        </p>
                      </div>
                      {qf.status === "uploading" && (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                      )}
                      {qf.status === "done" && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      )}
                      {qf.status === "error" && (
                        <span title={qf.error}>
                          <AlertCircle className="w-4 h-4 text-rose-500" />
                        </span>
                      )}
                      {qf.status === "pending" && !uploading && (
                        <button
                          onClick={() => removeFile(i)}
                          className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Folder selection */}
          <div className="space-y-2">
            <Label htmlFor="ordner" className="text-xs text-slate-500">
              Ordner (optional)
            </Label>
            {ordnerList.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {ordnerList.map((o) => (
                  <button
                    key={o}
                    onClick={() => {
                      setOrdner(o === ordner ? "" : o);
                      setNewOrdner("");
                    }}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                      ordner === o
                        ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                    }`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            )}
            <Input
              id="ordner"
              placeholder="Neuen Ordner erstellen..."
              value={newOrdner}
              onChange={(e) => {
                setNewOrdner(e.target.value);
                setOrdner("");
              }}
              className="h-9"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags" className="text-xs text-slate-500">
              Tags (kommagetrennt, optional)
            </Label>
            <Input
              id="tags"
              placeholder="z.B. Vertrag, Entwurf, Klage"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="h-9"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/20 dark:border-white/[0.08]">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={uploading}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Wird hochgeladen...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                {files.length} Datei{files.length !== 1 ? "en" : ""} hochladen
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
