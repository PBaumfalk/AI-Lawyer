"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DocumentEditor } from "@onlyoffice/document-editor-react";
import { Badge } from "@/components/ui/badge";
import {
  FileEdit,
  FileSearch,
  FileCheck2,
  Send,
  Download,
  History,
  Camera,
  RotateCcw,
  Wifi,
  WifiOff,
  ShieldAlert,
  ChevronRight,
  X,
  Loader2,
} from "lucide-react";

// --- Types ---

interface DokumentVersion {
  id: string;
  version: number;
  name: string | null;
  groesse: number;
  createdBy: string;
  createdAt: string;
}

type DokumentStatus = "ENTWURF" | "ZUR_PRUEFUNG" | "FREIGEGEBEN" | "VERSENDET";

interface OnlyOfficeEditorProps {
  dokumentId: string;
  mode?: "edit" | "view";
  userRole?: string;
  className?: string;
}

// --- Status Metadata ---

const STATUS_CONFIG: Record<
  DokumentStatus,
  { label: string; color: string; icon: React.ElementType; transitions: { target: DokumentStatus; label: string }[] }
> = {
  ENTWURF: {
    label: "Entwurf",
    color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    icon: FileEdit,
    transitions: [{ target: "ZUR_PRUEFUNG", label: "Zur Pruefung senden" }],
  },
  ZUR_PRUEFUNG: {
    label: "Zur Pruefung",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
    icon: FileSearch,
    transitions: [{ target: "FREIGEGEBEN", label: "Freigeben" }],
  },
  FREIGEGEBEN: {
    label: "Freigegeben",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    icon: FileCheck2,
    transitions: [
      { target: "VERSENDET", label: "Als versendet markieren" },
      { target: "ENTWURF", label: "Zurueck zum Entwurf" },
    ],
  },
  VERSENDET: {
    label: "Versendet",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    icon: Send,
    transitions: [],
  },
};

/**
 * Enhanced OnlyOffice editor component with:
 * - Stable document key for co-editing
 * - Track Changes and Comments support
 * - Version history panel with restore
 * - Named snapshot creation
 * - PDF export
 * - Document status indicator with transition buttons
 * - Connection status monitoring
 * - Schreibschutz banner for approved/sent documents
 *
 * Uses @onlyoffice/document-editor-react per project memory.
 * Events via props, NOT in config.events.
 */
export function OnlyOfficeEditor({
  dokumentId,
  mode = "edit",
  userRole = "SACHBEARBEITER",
  className,
}: OnlyOfficeEditorProps) {
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [onlyofficeUrl, setOnlyofficeUrl] = useState<string>("");
  const [dokumentStatus, setDokumentStatus] = useState<DokumentStatus>("ENTWURF");
  const [isConnected, setIsConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Version panel state
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<DokumentVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [snapshotName, setSnapshotName] = useState("");
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);

  // PDF export state
  const [exporting, setExporting] = useState(false);

  // Status transition state
  const [transitioning, setTransitioning] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);

  // --- Load editor config ---
  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/onlyoffice/config/${dokumentId}?mode=${mode}`
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Konfiguration konnte nicht geladen werden");
      }
      const data = await response.json();
      setConfig(data.config);
      setOnlyofficeUrl(data.onlyofficeUrl);
      setDokumentStatus(data.dokumentStatus ?? "ENTWURF");
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unbekannter Fehler"
      );
    } finally {
      setLoading(false);
    }
  }, [dokumentId, mode]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // --- Version history ---
  const loadVersions = useCallback(async () => {
    setLoadingVersions(true);
    try {
      const response = await fetch(`/api/dokumente/${dokumentId}/versionen`);
      if (response.ok) {
        const data = await response.json();
        setVersions(data.versionen ?? []);
      }
    } catch {
      // Silently handle errors
    } finally {
      setLoadingVersions(false);
    }
  }, [dokumentId]);

  const handleToggleVersions = useCallback(() => {
    if (!showVersions) {
      loadVersions();
    }
    setShowVersions((prev) => !prev);
  }, [showVersions, loadVersions]);

  const handleCreateSnapshot = useCallback(async () => {
    if (!snapshotName.trim()) return;
    setCreatingSnapshot(true);
    try {
      const response = await fetch(`/api/dokumente/${dokumentId}/versionen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: snapshotName.trim() }),
      });
      if (response.ok) {
        setSnapshotName("");
        loadVersions();
      }
    } catch {
      // Silently handle errors
    } finally {
      setCreatingSnapshot(false);
    }
  }, [dokumentId, snapshotName, loadVersions]);

  const handleRestore = useCallback(
    async (versionId: string) => {
      if (!confirm("Version wiederherstellen? Die aktuelle Version wird als Snapshot gesichert.")) {
        return;
      }
      try {
        const response = await fetch(
          `/api/dokumente/${dokumentId}/versionen/${versionId}/restore`,
          { method: "POST" }
        );
        if (response.ok) {
          // Reload editor with new version
          loadConfig();
          loadVersions();
        } else {
          const data = await response.json();
          alert(data.error ?? "Wiederherstellung fehlgeschlagen");
        }
      } catch {
        alert("Wiederherstellung fehlgeschlagen");
      }
    },
    [dokumentId, loadConfig, loadVersions]
  );

  // --- PDF export ---
  const handleExportPdf = useCallback(async () => {
    setExporting(true);
    try {
      const response = await fetch("/api/onlyoffice/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dokumentId, outputType: "pdf" }),
      });
      if (!response.ok) {
        const data = await response.json();
        alert(data.error ?? "PDF-Export fehlgeschlagen");
        return;
      }
      // Trigger download
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        response.headers.get("Content-Disposition")?.match(/filename="(.+?)"/)?.[1] ??
        "dokument.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("PDF-Export fehlgeschlagen");
    } finally {
      setExporting(false);
    }
  }, [dokumentId]);

  // --- Status transitions ---
  const handleStatusTransition = useCallback(
    async (targetStatus: DokumentStatus) => {
      setTransitioning(true);
      try {
        const response = await fetch(`/api/dokumente/${dokumentId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: targetStatus }),
        });
        if (response.ok) {
          const data = await response.json();
          setDokumentStatus(data.status);
          // Reload config if transitioning to/from read-only state
          if (
            targetStatus === "FREIGEGEBEN" ||
            targetStatus === "VERSENDET" ||
            dokumentStatus === "FREIGEGEBEN"
          ) {
            loadConfig();
          }
        } else {
          const data = await response.json();
          alert(data.error ?? "Statusaenderung fehlgeschlagen");
        }
      } catch {
        alert("Statusaenderung fehlgeschlagen");
      } finally {
        setTransitioning(false);
      }
    },
    [dokumentId, dokumentStatus, loadConfig]
  );

  // --- OnlyOffice event handlers (as props, NOT config.events) ---
  const handleDocumentReady = useCallback(() => {
    setIsConnected(true);
    console.log("[OnlyOffice] Document ready");
  }, []);

  const handleError = useCallback((event: object) => {
    console.error("[OnlyOffice] Error:", event);
    setIsConnected(false);
  }, []);

  const handleWarning = useCallback((event: object) => {
    console.warn("[OnlyOffice] Warning:", event);
  }, []);

  // --- Derived state ---
  const isReadOnly =
    dokumentStatus === "FREIGEGEBEN" || dokumentStatus === "VERSENDET";
  const statusConfig = STATUS_CONFIG[dokumentStatus] ?? STATUS_CONFIG.ENTWURF;
  const StatusIcon = statusConfig.icon;

  // Filter transitions based on user role
  const availableTransitions = statusConfig.transitions.filter((t) => {
    if (t.target === "FREIGEGEBEN" || (dokumentStatus === "FREIGEGEBEN" && t.target === "ENTWURF")) {
      return userRole === "ANWALT" || userRole === "ADMIN";
    }
    return true;
  });

  // --- Render ---

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${className ?? ""}`}>
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Editor wird geladen...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className ?? ""}`}>
        <div className="text-center">
          <p className="text-destructive font-medium">Fehler</p>
          <p className="text-muted-foreground text-sm mt-1">{error}</p>
          <button
            onClick={loadConfig}
            className="mt-3 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  if (!config || !onlyofficeUrl) {
    return null;
  }

  return (
    <div className={`flex flex-col h-full ${className ?? ""}`} ref={editorRef}>
      {/* Editor toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-background border-b gap-2 flex-wrap">
        {/* Left: Status badge + connection */}
        <div className="flex items-center gap-2">
          {/* Document status badge */}
          <Badge className={`gap-1 text-xs ${statusConfig.color}`}>
            <StatusIcon className="w-3 h-3" />
            {statusConfig.label}
          </Badge>

          {/* Connection status */}
          {isConnected ? (
            <Badge variant="outline" className="gap-1 text-[10px] text-emerald-600 border-emerald-300">
              <Wifi className="w-2.5 h-2.5" />
              Verbunden
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-[10px] text-amber-600 border-amber-300">
              <WifiOff className="w-2.5 h-2.5" />
              Offline
            </Badge>
          )}
        </div>

        {/* Right: Action buttons */}
        <div className="flex items-center gap-1.5">
          {/* Status transition buttons */}
          {availableTransitions.map((t) => (
            <button
              key={t.target}
              onClick={() => handleStatusTransition(t.target)}
              disabled={transitioning}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="w-3 h-3" />
              {t.label}
            </button>
          ))}

          {/* PDF export */}
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 transition-colors"
            title="Als PDF exportieren"
          >
            {exporting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Download className="w-3 h-3" />
            )}
            PDF
          </button>

          {/* Version history toggle */}
          <button
            onClick={handleToggleVersions}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              showVersions
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
            title="Versionen"
          >
            <History className="w-3 h-3" />
            Versionen
          </button>
        </div>
      </div>

      {/* Schreibschutz banner */}
      {isReadOnly && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span className="font-medium">Schreibgeschuetzt</span>
          <span className="text-amber-600 dark:text-amber-400">
            -- Dokument ist {dokumentStatus === "FREIGEGEBEN" ? "freigegeben" : "versendet"} und kann nicht bearbeitet werden.
          </span>
        </div>
      )}

      {/* Offline warning */}
      {!isConnected && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          Offline -- Aenderungen werden gespeichert wenn Verbindung wiederhergestellt
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 min-h-0">
        {/* Editor */}
        <div className="flex-1">
          <DocumentEditor
            id={`oo-editor-${dokumentId}`}
            documentServerUrl={onlyofficeUrl}
            config={config}
            events_onDocumentReady={handleDocumentReady}
            events_onError={handleError}
            events_onWarning={handleWarning}
          />
        </div>

        {/* Version history panel */}
        {showVersions && (
          <div className="w-72 border-l bg-background overflow-y-auto flex-shrink-0">
            <div className="p-3 border-b">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-sm">Versionshistorie</h3>
                <button
                  onClick={() => setShowVersions(false)}
                  className="p-1 rounded-md hover:bg-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Create named snapshot */}
              {!isReadOnly && (
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={snapshotName}
                    onChange={(e) => setSnapshotName(e.target.value)}
                    placeholder="Snapshot-Name..."
                    className="flex-1 px-2 py-1 text-xs border rounded-md bg-background"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateSnapshot();
                    }}
                  />
                  <button
                    onClick={handleCreateSnapshot}
                    disabled={!snapshotName.trim() || creatingSnapshot}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    title="Snapshot erstellen"
                  >
                    {creatingSnapshot ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Camera className="w-3 h-3" />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Version list */}
            <div className="divide-y">
              {loadingVersions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : versions.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  Noch keine Versionen vorhanden
                </div>
              ) : (
                versions.map((v) => (
                  <div key={v.id} className="p-3 hover:bg-muted/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          Version {v.version}
                          {v.name && (
                            <span className="text-muted-foreground font-normal">
                              {" "}
                              -- {v.name}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {v.createdBy}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(v.createdAt).toLocaleDateString("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(v.groesse / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      {!isReadOnly && (
                        <button
                          onClick={() => handleRestore(v.id)}
                          className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
                          title="Wiederherstellen"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
