"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { PdfViewer } from "./pdf-viewer";
import { VersionTimeline } from "./version-timeline";
import { DocumentActionsBar } from "./document-actions-bar";
import { TagManager } from "./tag-manager";
import { AuditTimeline, type AuditItem } from "@/components/audit/audit-timeline";
import { DokumentStatusBadge } from "./dokument-status-badge";
import { OcrStatusBadge } from "./ocr-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  FileText,
  File,
  Image as ImageIcon,
  Calendar,
  User,
  FolderOpen,
  HardDrive,
  Hash,
  Brain,
  Loader2,
  Check,
  Pencil,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

// MIME types editable in OnlyOffice
const ONLYOFFICE_EDITABLE = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.oasis.opendocument.text",
  "application/rtf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/vnd.oasis.opendocument.presentation",
]);

interface DokumentVersion {
  id: string;
  version: number;
  name: string | null;
  groesse: number;
  createdBy: { id: string; name: string };
  createdAt: string;
}

interface DokumentData {
  id: string;
  name: string;
  akteId: string;
  dateipfad: string;
  mimeType: string;
  groesse: number;
  version: number;
  tags: string[];
  ordner: string | null;
  status: "ENTWURF" | "ZUR_PRUEFUNG" | "FREIGEGEBEN" | "VERSENDET";
  ocrStatus: "AUSSTEHEND" | "IN_BEARBEITUNG" | "ABGESCHLOSSEN" | "FEHLGESCHLAGEN" | "NICHT_NOETIG";
  ocrFehler: string | null;
  ocrVersuche: number;
  ocrAbgeschlossen: string | null;
  previewPfad: string | null;
  erstelltDurch: string | null;
  createdAt: string;
  updatedAt: string;
  akte: { id: string; aktenzeichen: string; kurzrubrum: string };
  createdBy: { id: string; name: string };
  freigegebenDurch: { id: string; name: string } | null;
  freigegebenAm: string | null;
  versionen: DokumentVersion[];
  downloadUrl: string | null;
  previewUrl: string | null;
  chunkCount: number;
}

interface DocumentDetailProps {
  akteId: string;
  dokumentId: string;
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

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType === "application/pdf") return FileText;
  return File;
}

function getMimeLabel(mimeType: string): string {
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
    "application/msword": "DOC",
    "application/vnd.oasis.opendocument.text": "ODT",
    "application/rtf": "RTF",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
    "application/vnd.ms-excel": "XLS",
    "application/vnd.oasis.opendocument.spreadsheet": "ODS",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
    "application/vnd.ms-powerpoint": "PPT",
    "text/plain": "TXT",
    "text/csv": "CSV",
    "text/html": "HTML",
    "image/png": "PNG",
    "image/jpeg": "JPEG",
    "image/gif": "GIF",
    "image/webp": "WEBP",
  };
  return map[mimeType] ?? mimeType.split("/")[1]?.toUpperCase() ?? mimeType;
}

/**
 * Document detail page with split-view layout:
 * Left panel (~65%): PDF viewer
 * Right panel (~35%): Metadata, tags, actions, version timeline
 */
export function DocumentDetail({ akteId, dokumentId }: DocumentDetailProps) {
  const router = useRouter();
  const [dokument, setDokument] = useState<DokumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const fetchDocument = useCallback(async () => {
    try {
      const res = await fetch(`/api/dokumente/${dokumentId}?detail=true`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Dokument nicht gefunden");
        } else {
          setError("Fehler beim Laden");
        }
        return;
      }
      const data = await res.json();
      setDokument(data);
      setError(null);
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  }, [dokumentId]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  const handleRename = async () => {
    if (!renameValue.trim() || !dokument) return;
    try {
      const res = await fetch(`/api/dokumente/${dokument.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      if (res.ok) {
        setIsRenaming(false);
        fetchDocument();
      }
    } catch {
      // silently fail
    }
  };

  const handleRestore = async (versionId: string) => {
    if (!dokument) return;
    try {
      const res = await fetch(
        `/api/dokumente/${dokument.id}/versionen/${versionId}/restore`,
        { method: "POST" }
      );
      if (res.ok) {
        fetchDocument();
      }
    } catch {
      // silently fail
    }
  };

  const handleTagsChange = useCallback(
    (tags: string[]) => {
      if (!dokument) return;
      setDokument((prev) => (prev ? { ...prev, tags } : null));
    },
    [dokument]
  );

  // Loading state
  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          <p className="text-sm text-slate-500">Dokument wird geladen...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !dokument) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-500">{error ?? "Dokument nicht gefunden"}</p>
          <Link href={`/akten/${akteId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Zurueck zur Akte
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const FileIcon = getFileIcon(dokument.mimeType);
  const isEditable = ONLYOFFICE_EDITABLE.has(dokument.mimeType);
  const hasPdfPreview =
    dokument.mimeType === "application/pdf" || !!dokument.previewUrl;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Top bar with back button and document name */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex-shrink-0">
        <Link href={`/akten/${akteId}`}>
          <Button variant="ghost" size="sm" className="h-8 px-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>

        <FileIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />

        {isRenaming ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRename();
            }}
            className="flex items-center gap-2 flex-1 min-w-0"
          >
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="h-7 text-sm flex-1"
              autoFocus
            />
            <Button size="sm" type="submit" className="h-7 px-2">
              <Check className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => setIsRenaming(false)}
              className="h-7 px-2 text-xs"
            >
              Abbrechen
            </Button>
          </form>
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-sm font-semibold truncate">{dokument.name}</h1>
            <button
              onClick={() => {
                setRenameValue(dokument.name);
                setIsRenaming(true);
              }}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 flex-shrink-0"
              title="Umbenennen"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <DokumentStatusBadge
          status={dokument.status}
          erstelltDurch={dokument.erstelltDurch}
        />

        <Badge variant="muted" className="text-[10px] flex-shrink-0">
          {getMimeLabel(dokument.mimeType)}
        </Badge>
      </div>

      {/* Split view */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup
          orientation="horizontal"
          autoSaveId="document-detail"
        >
          {/* Left panel: PDF viewer */}
          <ResizablePanel id="pdf-panel" defaultSize={65} minSize={30}>
            <div className="h-full flex flex-col">
              {/* OnlyOffice button for editable non-PDF documents */}
              {isEditable && (
                <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-900 flex items-center gap-2">
                  <Link
                    href={`/dokumente/${dokument.id}/bearbeiten`}
                    className="inline-flex items-center gap-1.5"
                  >
                    <Button size="sm" variant="default" className="bg-blue-600 hover:bg-blue-700">
                      <ExternalLink className="w-4 h-4 mr-1.5" />
                      In OnlyOffice bearbeiten
                    </Button>
                  </Link>
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    {getMimeLabel(dokument.mimeType)}-Datei - Vorschau als PDF
                  </span>
                </div>
              )}

              {hasPdfPreview ? (
                <PdfViewer
                  url={dokument.previewUrl ?? dokument.downloadUrl ?? ""}
                  className="flex-1"
                />
              ) : (
                <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                  <div className="text-center space-y-3">
                    <FileText className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600" />
                    <p className="text-sm text-slate-500">
                      {dokument.previewPfad === null
                        ? "Vorschau wird generiert..."
                        : "Keine Vorschau verfuegbar"}
                    </p>
                    {isEditable && (
                      <Link href={`/dokumente/${dokument.id}/bearbeiten`}>
                        <Button size="sm" variant="outline">
                          <ExternalLink className="w-4 h-4 mr-1.5" />
                          In OnlyOffice oeffnen
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right panel: Metadata + actions */}
          <ResizablePanel id="meta-panel" defaultSize={35} minSize={25}>
            <div className="h-full overflow-y-auto bg-white/50 dark:bg-slate-800/50 p-4 space-y-5">
              {/* Metadata card */}
              <section>
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                  Metadaten
                </h3>
                <div className="space-y-2.5">
                  <MetadataRow
                    icon={FileText}
                    label="Dateityp"
                    value={getMimeLabel(dokument.mimeType)}
                  />
                  <MetadataRow
                    icon={HardDrive}
                    label="Groesse"
                    value={formatFileSize(dokument.groesse)}
                  />
                  <MetadataRow
                    icon={Calendar}
                    label="Hochgeladen am"
                    value={formatDate(dokument.createdAt)}
                  />
                  <MetadataRow
                    icon={User}
                    label="Hochgeladen von"
                    value={dokument.createdBy.name}
                  />
                  <div className="flex items-start gap-2.5">
                    <FolderOpen className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] text-slate-400 block">Akte</span>
                      <Link
                        href={`/akten/${dokument.akte.id}`}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate block"
                      >
                        {dokument.akte.aktenzeichen} - {dokument.akte.kurzrubrum}
                      </Link>
                    </div>
                  </div>
                  {dokument.ordner && (
                    <MetadataRow
                      icon={FolderOpen}
                      label="Ordner"
                      value={dokument.ordner}
                    />
                  )}
                  <div className="flex items-start gap-2.5">
                    <FileText className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] text-slate-400 block">OCR Status</span>
                      <OcrStatusBadge
                        status={dokument.ocrStatus}
                        dokumentId={dokument.id}
                        onRetry={fetchDocument}
                      />
                      {dokument.ocrStatus === "ABGESCHLOSSEN" && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-1">
                          OCR abgeschlossen
                        </span>
                      )}
                      {dokument.ocrStatus === "NICHT_NOETIG" && (
                        <span className="text-xs text-slate-500">Nicht noetig</span>
                      )}
                    </div>
                  </div>
                  <MetadataRow
                    icon={Hash}
                    label="Versionen"
                    value={String(dokument.versionen.length + 1)}
                  />
                  {dokument.chunkCount > 0 && (
                    <div className="flex items-center gap-2.5">
                      <Brain className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <div>
                        <span className="text-[11px] text-slate-400 block">AI-indexiert</span>
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400"
                        >
                          {dokument.chunkCount} Chunks
                        </Badge>
                      </div>
                    </div>
                  )}
                  {dokument.freigegebenDurch && (
                    <MetadataRow
                      icon={User}
                      label="Freigegeben von"
                      value={`${dokument.freigegebenDurch.name}${
                        dokument.freigegebenAm
                          ? ` am ${formatDate(dokument.freigegebenAm)}`
                          : ""
                      }`}
                    />
                  )}
                </div>
              </section>

              {/* Tags */}
              <section>
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                  Tags
                </h3>
                <TagManager
                  dokumentId={dokument.id}
                  currentTags={dokument.tags}
                  onTagsChange={handleTagsChange}
                />
              </section>

              {/* Actions */}
              <section>
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                  Aktionen
                </h3>
                <DocumentActionsBar
                  dokument={dokument}
                  onUpdate={fetchDocument}
                />
              </section>

              {/* Version history */}
              <section>
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                  Versionsverlauf
                </h3>
                <VersionTimeline
                  versions={dokument.versionen}
                  dokumentId={dokument.id}
                  currentVersion={dokument.version}
                  onRestore={handleRestore}
                />
              </section>

              {/* Audit history */}
              <section>
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                  Historie
                </h3>
                <DocumentHistorie
                  dokumentId={dokument.id}
                  akteId={dokument.akte.id}
                />
              </section>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

function DocumentHistorie({ dokumentId, akteId }: { dokumentId: string; akteId: string }) {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(
      `/api/akten/${akteId}/historie?dokumentId=${dokumentId}&aktion=DOKUMENT_HOCHGELADEN,DOKUMENT_GELOESCHT,DOKUMENT_STATUS_GEAENDERT,DOKUMENT_ANGESEHEN&take=20`
    )
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items ?? []);
      })
      .catch(() => {
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, [dokumentId, akteId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-slate-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Historie wird geladen...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-xs text-slate-400 py-2">Keine Eintraege vorhanden</p>
    );
  }

  return <AuditTimeline items={items} hasMore={false} compact showAkteLink={false} />;
}

// Reusable metadata row
function MetadataRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-[11px] text-slate-400 block">{label}</span>
        <span className="text-sm text-foreground truncate block">{value}</span>
      </div>
    </div>
  );
}
