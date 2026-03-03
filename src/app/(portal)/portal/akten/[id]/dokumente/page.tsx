"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  FileText,
  Image as ImageIcon,
  File,
  Download,
  Loader2,
  Upload,
  FolderOpen,
} from "lucide-react";

interface PortalDokument {
  id: string;
  name: string;
  mimeType: string;
  groesse: number;
  createdAt: string;
  ordner: string | null;
}

// --- Utility functions ---

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    mimeType.includes("word") ||
    mimeType.includes("document")
  )
    return FileText;
  return File;
}

function getFileIconColor(mimeType: string) {
  if (mimeType.startsWith("image/")) return "text-purple-500";
  if (mimeType === "application/pdf") return "text-rose-500";
  if (mimeType.startsWith("text/") || mimeType.includes("word"))
    return "text-blue-500";
  return "text-muted-foreground";
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dateStr));
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50 MB

// --- Main component ---

export default function PortalDokumentePage() {
  const params = useParams<{ id: string }>();
  const akteId = params.id;

  const [dokumente, setDokumente] = useState<PortalDokument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDokumente = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/akten/${akteId}/dokumente`);
      if (!res.ok) {
        throw new Error("Fehler beim Laden der Dokumente");
      }
      const data = await res.json();
      setDokumente(data.dokumente ?? []);
    } catch (err: any) {
      setError(err.message ?? "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [akteId]);

  useEffect(() => {
    fetchDokumente();
  }, [fetchDokumente]);

  // --- Download handler ---
  const handleDownload = async (doc: PortalDokument) => {
    setDownloadingId(doc.id);
    try {
      const res = await fetch(
        `/api/portal/akten/${akteId}/dokumente/${doc.id}/download`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Download fehlgeschlagen");
      }
      const data = await res.json();
      // Open presigned URL -- triggers browser download
      window.open(data.url, "_blank");
    } catch (err: any) {
      toast.error(err.message ?? "Download fehlgeschlagen");
    } finally {
      setDownloadingId(null);
    }
  };

  // --- Upload handler ---
  const handleUpload = async (file: globalThis.File) => {
    if (file.size > MAX_UPLOAD_SIZE) {
      toast.error("Maximale Dateigroesse: 50 MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `/api/portal/akten/${akteId}/dokumente/upload`,
        { method: "POST", body: formData }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Upload fehlgeschlagen");
      }

      toast.success("Dokument hochgeladen");
      // Refetch document list to show the new upload
      await fetchDokumente();
    } catch (err: any) {
      toast.error(err.message ?? "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  };

  // --- Drag & drop handlers ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleUpload(files[0]);
    }
    // Reset input so the same file can be selected again
    e.target.value = "";
  };

  // --- Group documents by ordner ---
  const grouped = groupByOrdner(dokumente);

  return (
    <div className="space-y-6">
      {/* Page title */}
      <h1 className="text-2xl font-semibold text-foreground">Dokumente</h1>

      {/* Upload area */}
      <div
        className={`bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
          dragOver
            ? "border-emerald-500/60 bg-emerald-500/5"
            : "border-white/20 dark:border-white/[0.12] hover:border-white/40 dark:hover:border-white/[0.2]"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !uploading) fileInputRef.current?.click();
        }}
      >
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          {uploading ? (
            <>
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Wird hochgeladen...
              </p>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Datei hierher ziehen oder klicken
              </p>
              <p className="text-xs text-muted-foreground/60">
                Maximale Dateigroesse: 50 MB
              </p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          disabled={uploading}
        />
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-8 text-center">
          <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && dokumente.length === 0 && (
        <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-12 text-center space-y-3">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm">
            Keine freigegebenen Dokumente
          </p>
        </div>
      )}

      {/* Document list grouped by ordner */}
      {!loading && !error && dokumente.length > 0 && (
        <div className="space-y-4">
          {grouped.map(({ ordner, docs }) => (
            <div key={ordner ?? "__ungrouped__"}>
              {/* Ordner header (only if multiple groups exist) */}
              {grouped.length > 1 && (
                <div className="flex items-center gap-2 mb-2">
                  <FolderOpen className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    {ordner ?? "Allgemein"}
                  </span>
                </div>
              )}
              <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] divide-y divide-white/10 dark:divide-white/[0.04]">
                {docs.map((dok) => (
                  <DocumentRow
                    key={dok.id}
                    dok={dok}
                    downloading={downloadingId === dok.id}
                    onDownload={() => handleDownload(dok)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Document row component ---

function DocumentRow({
  dok,
  downloading,
  onDownload,
}: {
  dok: PortalDokument;
  downloading: boolean;
  onDownload: () => void;
}) {
  const Icon = getFileIcon(dok.mimeType);
  const iconColor = getFileIconColor(dok.mimeType);
  const isMandantUpload = dok.ordner === "Mandant";

  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-white/20 dark:hover:bg-white/[0.05] transition-colors">
      {/* File type icon */}
      <div className="flex-shrink-0">
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">
            {dok.name}
          </p>
          {isMandantUpload && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
              Von mir hochgeladen
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground">
            {formatFileSize(dok.groesse)}
          </span>
          <span className="text-xs text-muted-foreground/50">&middot;</span>
          <span className="text-xs text-muted-foreground">
            {formatDate(dok.createdAt)}
          </span>
        </div>
      </div>

      {/* Download button */}
      <button
        onClick={onDownload}
        disabled={downloading}
        className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/20 dark:hover:bg-white/[0.08] transition-colors disabled:opacity-50"
        title={`${dok.name} herunterladen`}
      >
        {downloading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}

// --- Grouping helper ---

function groupByOrdner(
  docs: PortalDokument[]
): { ordner: string | null; docs: PortalDokument[] }[] {
  const map = new Map<string | null, PortalDokument[]>();
  for (const doc of docs) {
    const key = doc.ordner;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(doc);
  }

  // Sort: "Mandant" folder first, then others alphabetically, then null (Allgemein) last
  const entries = Array.from(map.entries());
  entries.sort(([a], [b]) => {
    if (a === "Mandant") return -1;
    if (b === "Mandant") return 1;
    if (a === null) return 1;
    if (b === null) return -1;
    return a.localeCompare(b, "de");
  });

  return entries.map(([ordner, docs]) => ({ ordner, docs }));
}
