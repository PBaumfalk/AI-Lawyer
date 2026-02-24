"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RotateCcw, Clock, FileText } from "lucide-react";
import { toast } from "sonner";

interface DokumentVersion {
  id: string;
  version: number;
  name: string | null;
  groesse: number;
  createdBy: { id: string; name: string };
  createdAt: string;
}

interface VersionTimelineProps {
  versions: DokumentVersion[];
  dokumentId: string;
  currentVersion: number;
  onRestore: (versionId: string) => void;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Gerade eben";
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  if (diffHours < 24) return `vor ${diffHours} Std.`;
  if (diffDays < 7) return `vor ${diffDays} Tag${diffDays > 1 ? "en" : ""}`;

  return date.toLocaleDateString("de-DE", {
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

/**
 * Vertical timeline of document versions.
 * Shows version number, date, author, and restore action.
 * Newest version at the top.
 */
export function VersionTimeline({
  versions,
  dokumentId,
  currentVersion,
  onRestore,
}: VersionTimelineProps) {
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const handleRestore = async (versionId: string) => {
    if (!confirm("Diese Version wiederherstellen? Der aktuelle Stand wird als separate Version gespeichert.")) {
      return;
    }

    setRestoringId(versionId);
    try {
      onRestore(versionId);
      toast.success("Version wird wiederhergestellt...");
    } catch {
      toast.error("Wiederherstellung fehlgeschlagen");
    } finally {
      setRestoringId(null);
    }
  };

  if (versions.length === 0) {
    return (
      <div className="text-center py-4">
        <Clock className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
        <p className="text-xs text-slate-500">
          Noch keine Versionen vorhanden.
        </p>
        <p className="text-[10px] text-slate-400 mt-1">
          Versionen werden automatisch bei Aenderungen erstellt.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-3 top-3 bottom-3 w-px bg-slate-200 dark:bg-slate-700" />

      <div className="space-y-0">
        {/* Current version (not in the versions list, but shown as reference) */}
        <div className="relative flex items-start gap-3 pb-4">
          <div className="relative z-10 flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 dark:bg-blue-600 flex-shrink-0">
            <FileText className="w-3 h-3 text-white" />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">
                v{currentVersion}
              </span>
              <Badge
                variant="secondary"
                className="text-[9px] bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
              >
                Aktuell
              </Badge>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Aktuelle Version
            </p>
          </div>
        </div>

        {/* Previous versions */}
        {versions.map((v, idx) => (
          <div key={v.id} className="relative flex items-start gap-3 pb-4">
            {/* Timeline dot */}
            <div className="relative z-10 flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500" />
            </div>

            {/* Version info */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-foreground">
                  v{v.version}
                </span>
                {v.name && (
                  <Badge variant="muted" className="text-[9px] max-w-[140px] truncate">
                    {v.name}
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {formatRelativeDate(v.createdAt)} &middot; {v.createdBy.name}{" "}
                &middot; {formatFileSize(v.groesse)}
              </p>

              {/* Restore button */}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRestore(v.id)}
                disabled={restoringId === v.id}
                className="h-6 px-2 text-[10px] mt-1 text-slate-500 hover:text-blue-600"
              >
                {restoringId === v.id ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <RotateCcw className="w-3 h-3 mr-1" />
                )}
                Wiederherstellen
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
