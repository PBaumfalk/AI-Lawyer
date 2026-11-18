"use client";

import { useState, useRef, useCallback } from "react";
import { Paperclip, FolderOpen, X, Upload, Loader2, AlertCircle } from "lucide-react";
import type { EmailAnhangRef, EmailUploadResponse } from "@/lib/email/send-contract";
import { ladeAktenDokumente, type AuswahlDokument } from "@/lib/email/dokument-auswahl";

export interface AttachmentFile {
  id: string;
  name: string;
  size: number;
  type: string;
  source: "upload" | "dms";
  /** Reference sent to POST /api/email-send; missing while an upload runs. */
  ref?: EmailAnhangRef;
  /** Upload state for local files. */
  uploading?: boolean;
  fehler?: string;
  /** DMS documents: release status (only FREIGEGEBEN can be sent). */
  status?: string;
}

/** Upload a local file; resolves to the reference for /api/email-send. */
async function uploadAnhang(file: File): Promise<EmailAnhangRef> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/email-send/anhang", { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Upload fehlgeschlagen");
  }
  const data: EmailUploadResponse = await res.json();
  return { quelle: "upload", ...data };
}

interface ComposeAttachmentsProps {
  attachments: AttachmentFile[];
  onAdd: (files: AttachmentFile[]) => void;
  onUpdate: (id: string, patch: Partial<AttachmentFile>) => void;
  onRemove: (id: string) => void;
  akteId?: string | null;
}

const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ComposeAttachments({
  attachments,
  onAdd,
  onUpdate,
  onRemove,
  akteId,
}: ComposeAttachmentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showDmsPicker, setShowDmsPicker] = useState(false);
  const [dmsFiles, setDmsFiles] = useState<AuswahlDokument[]>([]);
  const [dmsLoading, setDmsLoading] = useState(false);
  const [dmsFehler, setDmsFehler] = useState<string | null>(null);

  const totalSize = attachments.reduce((sum, a) => sum + a.size, 0);

  const processFiles = useCallback(
    (fileList: FileList | File[]) => {
      const newFiles: { meta: AttachmentFile; file: File }[] = [];
      for (const file of Array.from(fileList)) {
        if (file.size > MAX_ATTACHMENT_SIZE) {
          alert(`"${file.name}" ist groesser als 25 MB und kann nicht angehaengt werden.`);
          continue;
        }
        newFiles.push({
          file,
          meta: {
            id: `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: file.name,
            size: file.size,
            type: file.type,
            source: "upload",
            uploading: true,
          },
        });
      }
      if (newFiles.length === 0) return;
      onAdd(newFiles.map((n) => n.meta));
      for (const { meta, file } of newFiles) {
        uploadAnhang(file)
          .then((ref) => onUpdate(meta.id, { ref, uploading: false }))
          .catch((err) =>
            onUpdate(meta.id, {
              uploading: false,
              fehler: err instanceof Error ? err.message : "Upload fehlgeschlagen",
            })
          );
      }
    },
    [onAdd, onUpdate]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = "";
    }
  };

  // DMS file picker
  const openDmsPicker = async () => {
    if (!akteId) {
      alert("Bitte waehlen Sie zuerst eine Akte aus, um Dateien aus der Akte anzuhaengen.");
      return;
    }

    setShowDmsPicker(true);
    setDmsLoading(true);
    setDmsFehler(null);
    try {
      setDmsFiles(await ladeAktenDokumente(akteId));
    } catch (err) {
      setDmsFiles([]);
      setDmsFehler(err instanceof Error ? err.message : "Dokumente konnten nicht geladen werden");
    } finally {
      setDmsLoading(false);
    }
  };

  const addDmsFile = (doc: AuswahlDokument) => {
    if (attachments.some((a) => a.id === `dms-${doc.id}`)) return;
    const newFile: AttachmentFile = {
      id: `dms-${doc.id}`,
      name: doc.name,
      size: doc.groesse,
      type: doc.mimeType,
      source: "dms",
      status: doc.status,
      ref: { quelle: "dms", dokumentId: doc.id },
    };
    onAdd([newFile]);
  };

  return (
    <div className="space-y-2">
      {/* Drop zone & buttons */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed transition-colors ${
          isDragOver
            ? "border-brand-500 bg-brand-50/50 dark:bg-brand-900/10"
            : "border-white/20 dark:border-white/[0.08]"
        }`}
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-white/20 dark:hover:bg-white/[0.06] rounded transition-colors"
        >
          <Paperclip className="w-3.5 h-3.5" />
          Datei anhaengen
        </button>

        <button
          type="button"
          onClick={openDmsPicker}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-white/20 dark:hover:bg-white/[0.06] rounded transition-colors"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Aus Akte
        </button>

        <span className="flex-1 text-xs text-muted-foreground/60 text-center">
          {isDragOver ? (
            <span className="text-brand-500">Dateien hier ablegen</span>
          ) : (
            "Dateien per Drag & Drop hinzufuegen"
          )}
        </span>

        {totalSize > 0 && (
          <span className="text-xs text-muted-foreground">
            Gesamt: {formatFileSize(totalSize)}
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Attached files list */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attachments.map((att) => (
            <span
              key={att.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/30 dark:bg-white/[0.04] border border-white/20 dark:border-white/[0.08] rounded-full text-xs"
            >
              {att.uploading ? (
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
              ) : att.fehler ? (
                <AlertCircle className="w-3 h-3 text-red-500" />
              ) : (
                <Paperclip className="w-3 h-3 text-muted-foreground" />
              )}
              <span className="max-w-[180px] truncate text-foreground" title={att.fehler}>
                {att.name}
              </span>
              <span className={att.fehler ? "text-red-500" : "text-muted-foreground"}>
                {att.fehler ? "Upload fehlgeschlagen" : `(${formatFileSize(att.size)})`}
              </span>
              <button
                type="button"
                onClick={() => onRemove(att.id)}
                className="text-muted-foreground hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* DMS File Picker Modal */}
      {showDmsPicker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-white/20 dark:border-white/[0.08] w-full max-w-md max-h-[60vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 dark:border-white/[0.06]">
              <h3 className="font-heading text-sm text-foreground">
                Datei aus Akte waehlen
              </h3>
              <button
                type="button"
                onClick={() => setShowDmsPicker(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {dmsLoading ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  Lade Dokumente...
                </div>
              ) : dmsFehler ? (
                <div className="text-center py-6 text-red-500 text-sm">{dmsFehler}</div>
              ) : dmsFiles.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  Keine Dokumente in dieser Akte
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="px-1 pb-1 text-xs text-muted-foreground">
                    Nur freigegebene Dokumente koennen versendet werden.
                  </p>
                  {dmsFiles.map((doc) => {
                    const freigegeben = doc.status === "FREIGEGEBEN";
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        disabled={!freigegeben}
                        title={freigegeben ? undefined : "Dokument ist nicht freigegeben"}
                        onClick={() => {
                          addDmsFile(doc);
                          setShowDmsPicker(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/20 dark:hover:bg-white/[0.04] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Upload className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-foreground truncate">{doc.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatFileSize(doc.groesse)}
                            {!freigegeben && " · nicht freigegeben"}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
