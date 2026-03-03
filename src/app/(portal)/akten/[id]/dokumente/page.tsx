"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  FileText,
  Image as ImageIcon,
  File,
  Download,
  Loader2,
} from "lucide-react";

interface PortalDokument {
  id: string;
  name: string;
  mimeType: string;
  groesse: number;
  createdAt: string;
  ordner: string | null;
}

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
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PortalDokumentePage() {
  const params = useParams<{ id: string }>();
  const akteId = params.id;

  const [dokumente, setDokumente] = useState<PortalDokument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      {/* Page title */}
      <h1 className="text-2xl font-semibold text-foreground">Dokumente</h1>

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

      {/* Document list */}
      {!loading && !error && dokumente.length > 0 && (
        <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] divide-y divide-white/10 dark:divide-white/[0.04]">
          {dokumente.map((dok) => {
            const Icon = getFileIcon(dok.mimeType);
            const iconColor = getFileIconColor(dok.mimeType);

            return (
              <div
                key={dok.id}
                className="flex items-center gap-4 px-4 py-3 hover:bg-white/20 dark:hover:bg-white/[0.05] transition-colors"
              >
                {/* File type icon */}
                <div className="flex-shrink-0">
                  <Icon className={`w-5 h-5 ${iconColor}`} />
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {dok.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(dok.groesse)}
                    </span>
                    <span className="text-xs text-muted-foreground/50">
                      ·
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(dok.createdAt)}
                    </span>
                    {dok.ordner && (
                      <>
                        <span className="text-xs text-muted-foreground/50">
                          ·
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {dok.ordner}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Download button (disabled placeholder, wired in Plan 46-02) */}
                <button
                  disabled
                  className="p-2 rounded-md text-muted-foreground/40 cursor-not-allowed"
                  title="Download (wird bald verfuegbar)"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
