"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  File,
  Loader2,
  Pencil,
  Bot,
} from "lucide-react";

interface PreviewDialogProps {
  dokument: {
    id: string;
    name: string;
    mimeType: string;
    groesse: number;
    createdAt: string;
    createdBy: { name: string };
    ordner?: string | null;
    tags?: string[];
    status?: string;
    erstelltDurch?: string | null;
  } | null;
  open: boolean;
  onClose: () => void;
  onEdit?: (dokument: PreviewDialogProps["dokument"]) => void;
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
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isPreviewable(mimeType: string): boolean {
  return (
    mimeType === "application/pdf" ||
    mimeType.startsWith("image/") ||
    mimeType.startsWith("text/") ||
    mimeType === "application/json"
  );
}

// MIME types that can be edited in ONLYOFFICE
const ONLYOFFICE_EDITABLE = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.oasis.opendocument.text",
  "application/rtf",
  "text/plain",
  "text/html",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.oasis.opendocument.spreadsheet",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/vnd.oasis.opendocument.presentation",
]);

export function PreviewDialog({ dokument, open, onClose, onEdit }: PreviewDialogProps) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !dokument) {
      setDownloadUrl(null);
      setTextContent(null);
      return;
    }

    setLoading(true);
    fetch(`/api/dokumente/${dokument.id}`)
      .then((res) => res.json())
      .then((data) => {
        setDownloadUrl(data.downloadUrl ?? null);

        // For text files, fetch content for preview
        if (
          dokument.mimeType.startsWith("text/") ||
          dokument.mimeType === "application/json"
        ) {
          return fetch(`/api/dokumente/${dokument.id}?download=true`)
            .then((r) => r.text())
            .then((text) => setTextContent(text));
        }
      })
      .catch(() => {
        setDownloadUrl(null);
      })
      .finally(() => setLoading(false));
  }, [open, dokument]);

  if (!open || !dokument) return null;

  const canPreview = isPreviewable(dokument.mimeType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl shadow-xl border border-white/20 dark:border-white/[0.08] w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/20 dark:border-white/[0.08]">
          <div className="flex items-center gap-3 min-w-0">
            <FileTypeIcon mimeType={dokument.mimeType} />
            <div className="min-w-0">
              <h2 className="text-base font-heading text-foreground truncate">
                {dokument.name}
              </h2>
              <p className="text-xs text-slate-500">
                {formatFileSize(dokument.groesse)} · {dokument.createdBy.name} ·{" "}
                {formatDate(dokument.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onEdit && dokument && ONLYOFFICE_EDITABLE.has(dokument.mimeType) && (
              <Button
                size="sm"
                onClick={() => {
                  onEdit(dokument);
                  onClose();
                }}
              >
                <Pencil className="w-4 h-4 mr-1.5" />
                Bearbeiten
              </Button>
            )}
            {downloadUrl && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(downloadUrl, "_blank")}
                >
                  <ExternalLink className="w-4 h-4 mr-1.5" />
                  Öffnen
                </Button>
                <a href={`/api/dokumente/${dokument.id}?download=true`} download={dokument.name}>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-1.5" />
                    Download
                  </Button>
                </a>
              </>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-white/20 dark:hover:bg-white/[0.06] text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Metadata bar */}
        <div className="flex items-center gap-3 px-6 py-2 border-b border-white/10 dark:border-white/[0.06] bg-slate-50 dark:bg-slate-800/30">
          <Badge variant="muted" className="text-[10px]">
            {dokument.mimeType.split("/")[1]?.toUpperCase() ?? dokument.mimeType}
          </Badge>
          {dokument.ordner && (
            <Badge variant="muted" className="text-[10px]">
              📁 {dokument.ordner}
            </Badge>
          )}
          {dokument.tags?.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px]">
              {tag}
            </Badge>
          ))}
          {dokument.erstelltDurch === "ai" && (
            <>
              <Badge variant="outline" className="gap-0.5 text-[10px] border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400">
                <Bot className="w-2.5 h-2.5" />
                KI
              </Badge>
              {dokument.status !== "FREIGEGEBEN" && dokument.status !== "VERSENDET" && (
                <Badge className="gap-0.5 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                  nicht freigegeben
                </Badge>
              )}
            </>
          )}
        </div>

        {/* Preview content */}
        <div className="flex-1 overflow-hidden bg-slate-100 dark:bg-slate-950">
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : canPreview && downloadUrl ? (
            <PreviewContent
              mimeType={dokument.mimeType}
              downloadUrl={downloadUrl}
              textContent={textContent}
              name={dokument.name}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
              <File className="w-16 h-16 text-slate-300 dark:text-slate-600" />
              <div className="text-center">
                <p className="text-sm text-slate-500">
                  Vorschau für diesen Dateityp nicht verfügbar
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {dokument.mimeType}
                </p>
              </div>
              {downloadUrl && (
                <a href={`/api/dokumente/${dokument.id}?download=true`} download={dokument.name}>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-1.5" />
                    Datei herunterladen
                  </Button>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewContent({
  mimeType,
  downloadUrl,
  textContent,
  name,
}: {
  mimeType: string;
  downloadUrl: string;
  textContent: string | null;
  name: string;
}) {
  if (mimeType === "application/pdf") {
    return (
      <iframe
        src={downloadUrl}
        className="w-full h-[70vh]"
        title={`Vorschau: ${name}`}
      />
    );
  }

  if (mimeType.startsWith("image/")) {
    return (
      <div className="flex items-center justify-center p-4 h-[70vh]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={downloadUrl}
          alt={name}
          className="max-w-full max-h-full object-contain rounded"
        />
      </div>
    );
  }

  if (mimeType.startsWith("text/") || mimeType === "application/json") {
    return (
      <div className="p-6 h-[70vh] overflow-auto">
        <pre className="text-sm font-mono text-foreground/80 whitespace-pre-wrap break-words">
          {textContent ?? "Inhalt wird geladen..."}
        </pre>
      </div>
    );
  }

  return null;
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) {
    return (
      <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-950 flex items-center justify-center flex-shrink-0">
        <ImageIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
      </div>
    );
  }
  if (mimeType === "application/pdf") {
    return (
      <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-950 flex items-center justify-center flex-shrink-0">
        <FileText className="w-5 h-5 text-rose-600 dark:text-rose-400" />
      </div>
    );
  }
  if (mimeType.startsWith("text/") || mimeType === "application/json") {
    return (
      <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center flex-shrink-0">
        <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
      </div>
    );
  }
  return (
    <div className="w-10 h-10 rounded-lg bg-white/20 dark:bg-white/[0.06] flex items-center justify-center flex-shrink-0">
      <File className="w-5 h-5 text-slate-500" />
    </div>
  );
}
