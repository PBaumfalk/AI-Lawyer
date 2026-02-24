"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  X,
  Check,
  AlertCircle,
  Loader2,
  Upload,
  Clock,
} from "lucide-react";
import { useUpload, type UploadStatus } from "@/components/providers/upload-provider";

function getStatusIcon(status: UploadStatus) {
  switch (status) {
    case "uploading":
      return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    case "ocr-queued":
      return <Clock className="w-4 h-4 text-amber-500" />;
    case "done":
      return <Check className="w-4 h-4 text-emerald-500" />;
    case "error":
      return <AlertCircle className="w-4 h-4 text-rose-500" />;
  }
}

function getStatusLabel(status: UploadStatus): string {
  switch (status) {
    case "uploading":
      return "Wird hochgeladen...";
    case "ocr-queued":
      return "OCR wird verarbeitet";
    case "done":
      return "Fertig";
    case "error":
      return "Fehler";
  }
}

/**
 * Floating upload panel in the bottom-right corner (Google Drive style).
 * Shows per-file upload progress and OCR status.
 * Persists across page navigation via UploadProvider.
 */
export function UploadPanel() {
  const { uploads, clearCompleted, isUploading } = useUpload();
  const [collapsed, setCollapsed] = useState(false);

  // Don't render if no uploads
  if (uploads.length === 0) return null;

  const activeCount = uploads.filter(
    (u) => u.status === "uploading" || u.status === "ocr-queued"
  ).length;
  const hasCompleted = uploads.some(
    (u) => u.status === "done" || u.status === "error"
  );

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 shadow-lg rounded-lg border border-white/20 dark:border-white/[0.08] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-slate-50/80 dark:bg-slate-800/80 border-b border-white/10 dark:border-white/[0.04] cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-foreground">
            {isUploading
              ? `${activeCount} Upload${activeCount !== 1 ? "s" : ""} aktiv`
              : `${uploads.length} Upload${uploads.length !== 1 ? "s" : ""}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {hasCompleted && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearCompleted();
              }}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title="Alle entfernen"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {collapsed ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>

      {/* File list */}
      {!collapsed && (
        <div className="max-h-60 overflow-y-auto">
          {uploads.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 px-3 py-2 border-b border-slate-100/50 dark:border-slate-800/50 last:border-0"
            >
              {/* Status icon */}
              <div className="flex-shrink-0">{getStatusIcon(item.status)}</div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {item.file.name}
                </p>
                {item.status === "uploading" ? (
                  <div className="mt-1">
                    <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {item.progress}%
                    </p>
                  </div>
                ) : (
                  <p
                    className={`text-[10px] mt-0.5 ${
                      item.status === "error"
                        ? "text-rose-500"
                        : item.status === "done"
                          ? "text-emerald-500"
                          : "text-slate-400"
                    }`}
                  >
                    {item.error ?? getStatusLabel(item.status)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
