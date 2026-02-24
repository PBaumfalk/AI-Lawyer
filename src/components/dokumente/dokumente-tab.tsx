"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Search,
  FolderOpen,
  Folder,
  FileText,
  Image as ImageIcon,
  File,
  Trash2,
  Download,
  Eye,
  MoreHorizontal,
  Pencil,
  FolderPlus,
  X,
  Loader2,
  ChevronRight,
  FileCheck,
  FileOutput,
  FilePlus2,
  FileCheck2,
  FileSearch,
  ShieldCheck,
  Undo2,
  Filter,
} from "lucide-react";
import { UploadDialog } from "./upload-dialog";
import { PreviewDialog } from "./preview-dialog";
import { VorlageErstellenDialog } from "./vorlage-erstellen-dialog";
import { DokumentStatusBadge } from "./dokument-status-badge";
import { OcrStatusBadge } from "./ocr-status-badge";
import { EditorDialog } from "../editor/editor-dialog";
import { useUpload } from "@/components/providers/upload-provider";
import { toast } from "sonner";

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

type DokumentStatus = "ENTWURF" | "ZUR_PRUEFUNG" | "FREIGEGEBEN" | "VERSENDET";

const STATUS_FILTER_OPTIONS: { value: DokumentStatus | null; label: string }[] = [
  { value: null, label: "Alle Status" },
  { value: "ENTWURF", label: "Entwurf" },
  { value: "ZUR_PRUEFUNG", label: "Zur Prüfung" },
  { value: "FREIGEGEBEN", label: "Freigegeben" },
  { value: "VERSENDET", label: "Versendet" },
];

// Default folder suggestions for a law office
const DEFAULT_ORDNER = [
  "Korrespondenz",
  "Schriftsätze",
  "Verträge",
  "Gerichtliche Dokumente",
  "Rechnungen",
  "Gutachten",
  "Sonstiges",
];

interface DokumentItem {
  id: string;
  name: string;
  mimeType: string;
  groesse: number;
  ordner: string | null;
  tags: string[];
  status: "ENTWURF" | "ZUR_PRUEFUNG" | "FREIGEGEBEN" | "VERSENDET";
  ocrStatus?: "AUSSTEHEND" | "IN_BEARBEITUNG" | "ABGESCHLOSSEN" | "FEHLGESCHLAGEN" | "NICHT_NOETIG";
  erstelltDurch: string | null;
  freigegebenDurch: { id: string; name: string } | null;
  freigegebenAm: string | null;
  createdAt: string;
  createdBy: { name: string };
}

interface DokumenteTabProps {
  akteId: string;
  initialDokumente: DokumentItem[];
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

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType === "application/pdf" || mimeType.startsWith("text/")) return FileText;
  return File;
}

function getFileIconColor(mimeType: string) {
  if (mimeType.startsWith("image/")) return "text-purple-500";
  if (mimeType === "application/pdf") return "text-rose-500";
  if (mimeType.startsWith("text/") || mimeType === "application/json") return "text-blue-500";
  return "text-slate-400";
}

const FREIGABE_ROLES = ["ADMIN", "ANWALT", "SACHBEARBEITER"];

export function DokumenteTab({ akteId, initialDokumente }: DokumenteTabProps) {
  const router = useRouter();
  const { data: sessionData } = useSession();
  const userRole = (sessionData?.user as any)?.role ?? "";
  const { addFiles: uploadAddFiles } = useUpload();
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const [dokumente, setDokumente] = useState<DokumentItem[]>(initialDokumente);
  const [ordnerList, setOrdnerList] = useState<string[]>([]);
  const [selectedOrdner, setSelectedOrdner] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [vorlageOpen, setVorlageOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DokumentItem | null>(null);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [renameDocId, setRenameDocId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editorDoc, setEditorDoc] = useState<DokumentItem | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<DokumentStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  // Extract ordner list from dokumente
  useEffect(() => {
    const folders = new Set<string>();
    dokumente.forEach((d) => {
      if (d.ordner) folders.add(d.ordner);
    });
    setOrdnerList(Array.from(folders).sort());
  }, [dokumente]);

  const fetchDokumente = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedOrdner) params.set("ordner", selectedOrdner);
      if (searchQuery) params.set("q", searchQuery);

      const res = await fetch(`/api/akten/${akteId}/dokumente?${params}`);
      if (!res.ok) throw new Error("Fehler beim Laden");
      const data = await res.json();
      setDokumente(data.dokumente);
      if (data.ordnerList) {
        setOrdnerList(data.ordnerList);
      }
    } catch {
      toast.error("Dokumente konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, [akteId, selectedOrdner, searchQuery]);

  // Refetch on filter changes
  useEffect(() => {
    fetchDokumente();
  }, [fetchDokumente]);

  // Drag-and-drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      dragCounter.current = 0;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        uploadAddFiles(akteId, files);
        toast.success(`${files.length} Datei(en) werden hochgeladen`);
      }
    },
    [akteId, uploadAddFiles]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length > 0) {
        uploadAddFiles(akteId, files);
        toast.success(`${files.length} Datei(en) werden hochgeladen`);
      }
      // Reset input so the same file can be re-selected
      e.target.value = "";
    },
    [akteId, uploadAddFiles]
  );

  const handleDelete = async (doc: DokumentItem) => {
    if (!confirm(`"${doc.name}" wirklich löschen?`)) return;
    try {
      const res = await fetch(`/api/dokumente/${doc.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Fehler beim Löschen");
      toast.success("Dokument gelöscht");
      fetchDokumente();
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRename = async (docId: string) => {
    if (!renameValue.trim()) return;
    try {
      const res = await fetch(`/api/dokumente/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      if (!res.ok) throw new Error("Fehler beim Umbenennen");
      toast.success("Dokument umbenannt");
      setRenameDocId(null);
      fetchDokumente();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleMove = async (docId: string, newOrdner: string | null) => {
    try {
      const res = await fetch(`/api/dokumente/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordner: newOrdner ?? "" }),
      });
      if (!res.ok) throw new Error("Fehler beim Verschieben");
      toast.success(newOrdner ? `Verschoben nach "${newOrdner}"` : "Aus Ordner entfernt");
      fetchDokumente();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDownload = (doc: DokumentItem) => {
    const link = document.createElement("a");
    link.href = `/api/dokumente/${doc.id}?download=true`;
    link.download = doc.name;
    link.click();
  };

  const handleExportPdf = async (doc: DokumentItem) => {
    toast.info("PDF wird erstellt...");
    try {
      const res = await fetch(`/api/dokumente/${doc.id}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saveToAkte: true, download: false }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "PDF-Export fehlgeschlagen");
      }
      const data = await res.json();
      toast.success(`PDF erstellt: ${data.name}`);
      fetchDokumente();
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleStatusChange = async (docId: string, newStatus: DokumentStatus) => {
    setStatusLoading(docId);
    try {
      const res = await fetch(`/api/dokumente/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Fehler beim Statuswechsel");
      }
      const statusLabels: Record<string, string> = {
        ENTWURF: "als Entwurf markiert",
        ZUR_PRUEFUNG: "zur Prüfung vorgelegt",
        FREIGEGEBEN: "freigegeben",
      };
      toast.success(`Dokument ${statusLabels[newStatus] ?? "aktualisiert"}`);
      fetchDokumente();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setStatusLoading(null);
    }
  };

  const [creatingNew, setCreatingNew] = useState(false);

  const handleNeuesDokument = async () => {
    setCreatingNew(true);
    try {
      const res = await fetch(`/api/akten/${akteId}/dokumente/neu`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateiname: "Neues Dokument",
          ordner: selectedOrdner !== "__none__" ? selectedOrdner : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Fehler beim Erstellen");
      }
      const data = await res.json();
      toast.success("Neues Dokument erstellt");
      await fetchDokumente();
      router.refresh();
      // Open in ONLYOFFICE editor immediately
      if (data.dokument) {
        setEditorDoc({
          id: data.dokument.id,
          name: data.dokument.name,
          mimeType: data.dokument.mimeType,
          groesse: data.dokument.groesse,
          ordner: data.dokument.ordner,
          tags: data.dokument.tags ?? [],
          status: data.dokument.status ?? "ENTWURF",
          erstelltDurch: data.dokument.erstelltDurch ?? "user",
          freigegebenDurch: data.dokument.freigegebenDurch ?? null,
          freigegebenAm: data.dokument.freigegebenAm ?? null,
          createdAt: data.dokument.createdAt,
          createdBy: { name: "" },
        });
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreatingNew(false);
    }
  };

  // Filtered + searched documents (server-side for folder/search, client-side for status)
  const filteredDokumente = selectedStatus
    ? dokumente.filter((d) => d.status === selectedStatus)
    : dokumente;

  // Count per folder
  const folderCounts: Record<string, number> = {};
  let noFolderCount = 0;
  initialDokumente.forEach((d) => {
    if (d.ordner) {
      folderCounts[d.ordner] = (folderCounts[d.ordner] ?? 0) + 1;
    } else {
      noFolderCount++;
    }
  });

  return (
    <div
      className="flex gap-4 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Hidden file input for file picker button */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="*/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Drag-and-drop overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-blue-50/80 dark:bg-blue-950/80 backdrop-blur-sm border-2 border-dashed border-blue-400 dark:border-blue-500 rounded-xl pointer-events-none">
          <div className="text-center">
            <Upload className="w-12 h-12 mx-auto text-blue-500 dark:text-blue-400 mb-2" />
            <p className="text-lg font-medium text-blue-700 dark:text-blue-300">
              Dateien hier ablegen
            </p>
            <p className="text-sm text-blue-500 dark:text-blue-400">
              Zum Hochladen loslassen
            </p>
          </div>
        </div>
      )}

      {/* Folder sidebar */}
      <div className="w-56 flex-shrink-0 hidden md:block">
        <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-3 space-y-1">
          <div className="px-2 py-1.5 text-xs font-medium text-slate-400 uppercase tracking-wider">
            Ordner
          </div>

          {/* All documents */}
          <button
            onClick={() => setSelectedOrdner(null)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
              selectedOrdner === null
                ? "bg-white/20 dark:bg-white/[0.06] text-foreground font-medium"
                : "text-muted-foreground hover:bg-white/20 dark:hover:bg-white/[0.05]"
            }`}
          >
            <FolderOpen className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left">Alle Dokumente</span>
            <span className="text-xs text-slate-400">
              {initialDokumente.length}
            </span>
          </button>

          {/* Existing folders */}
          {ordnerList.map((folder) => (
            <button
              key={folder}
              onClick={() =>
                setSelectedOrdner(selectedOrdner === folder ? null : folder)
              }
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                selectedOrdner === folder
                  ? "bg-white/20 dark:bg-white/[0.06] text-foreground font-medium"
                  : "text-muted-foreground hover:bg-white/20 dark:hover:bg-white/[0.05]"
              }`}
            >
              <Folder className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left truncate">{folder}</span>
              <span className="text-xs text-slate-400">
                {folderCounts[folder] ?? 0}
              </span>
            </button>
          ))}

          {/* No folder */}
          {noFolderCount > 0 && (
            <button
              onClick={() =>
                setSelectedOrdner(
                  selectedOrdner === "__none__" ? null : "__none__"
                )
              }
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                selectedOrdner === "__none__"
                  ? "bg-white/20 dark:bg-white/[0.06] text-foreground font-medium"
                  : "text-muted-foreground hover:bg-white/20 dark:hover:bg-white/[0.05]"
              }`}
            >
              <File className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left">Ohne Ordner</span>
              <span className="text-xs text-slate-400">{noFolderCount}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Dokumente durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mobile folder selector */}
          <select
            value={selectedOrdner ?? ""}
            onChange={(e) =>
              setSelectedOrdner(e.target.value || null)
            }
            className="md:hidden h-9 px-3 rounded-md border border-white/20 dark:border-white/[0.08] bg-white/50 dark:bg-white/[0.05] backdrop-blur-md text-sm"
          >
            <option value="">Alle Ordner</option>
            {ordnerList.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={selectedStatus ?? ""}
            onChange={(e) =>
              setSelectedStatus((e.target.value as DokumentStatus) || null)
            }
            className="h-9 px-3 rounded-md border border-white/20 dark:border-white/[0.08] bg-white/50 dark:bg-white/[0.05] backdrop-blur-md text-sm text-foreground"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value ?? ""}>
                {opt.label}
              </option>
            ))}
          </select>

          <Button size="sm" variant="outline" onClick={handleNeuesDokument} disabled={creatingNew}>
            {creatingNew ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <FilePlus2 className="w-4 h-4 mr-1.5" />
            )}
            Neues Dokument
          </Button>
          <Button size="sm" variant="outline" onClick={() => setVorlageOpen(true)}>
            <FileCheck className="w-4 h-4 mr-1.5" />
            Aus Vorlage
          </Button>
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-1.5" />
            Hochladen
          </Button>
        </div>

        {/* Active filters */}
        {(selectedOrdner || searchQuery || selectedStatus) && (
          <div className="flex items-center gap-2 flex-wrap">
            {selectedOrdner && selectedOrdner !== "__none__" && (
              <Badge
                variant="muted"
                className="gap-1 cursor-pointer"
                onClick={() => setSelectedOrdner(null)}
              >
                <Folder className="w-3 h-3" />
                {selectedOrdner}
                <X className="w-3 h-3 ml-0.5" />
              </Badge>
            )}
            {selectedOrdner === "__none__" && (
              <Badge
                variant="muted"
                className="gap-1 cursor-pointer"
                onClick={() => setSelectedOrdner(null)}
              >
                Ohne Ordner
                <X className="w-3 h-3 ml-0.5" />
              </Badge>
            )}
            {selectedStatus && (
              <Badge
                variant="muted"
                className="gap-1 cursor-pointer"
                onClick={() => setSelectedStatus(null)}
              >
                <Filter className="w-3 h-3" />
                {STATUS_FILTER_OPTIONS.find((o) => o.value === selectedStatus)?.label}
                <X className="w-3 h-3 ml-0.5" />
              </Badge>
            )}
            {searchQuery && (
              <Badge
                variant="muted"
                className="gap-1 cursor-pointer"
                onClick={() => setSearchQuery("")}
              >
                <Search className="w-3 h-3" />
                &quot;{searchQuery}&quot;
                <X className="w-3 h-3 ml-0.5" />
              </Badge>
            )}
          </div>
        )}

        {/* Document list */}
        <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08]">
          {loading && filteredDokumente.length === 0 ? (
            <div className="p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
            </div>
          ) : filteredDokumente.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400 space-y-3">
              <FileText className="w-12 h-12 mx-auto text-slate-200 dark:text-slate-700" />
              <p>
                {searchQuery || selectedOrdner
                  ? "Keine Dokumente gefunden."
                  : "Noch keine Dokumente vorhanden."}
              </p>
              {!searchQuery && !selectedOrdner && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setUploadOpen(true)}
                >
                  <Upload className="w-4 h-4 mr-1.5" />
                  Erstes Dokument hochladen
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-white/10 dark:divide-white/[0.04]">
              {filteredDokumente.map((dok) => {
                const Icon = getFileIcon(dok.mimeType);
                const iconColor = getFileIconColor(dok.mimeType);

                return (
                  <div
                    key={dok.id}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-white/20 dark:hover:bg-white/[0.05] transition-colors group"
                  >
                    {/* File icon */}
                    <div
                      className="cursor-pointer flex-shrink-0"
                      onClick={() => setPreviewDoc(dok)}
                    >
                      <Icon className={`w-5 h-5 ${iconColor}`} />
                    </div>

                    {/* File info */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => setPreviewDoc(dok)}
                    >
                      {renameDocId === dok.id ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleRename(dok.id);
                          }}
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="h-7 text-sm"
                            autoFocus
                          />
                          <Button size="sm" type="submit" className="h-7 px-2">
                            OK
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            type="button"
                            onClick={() => setRenameDocId(null)}
                            className="h-7 px-2"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </form>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-foreground truncate">
                            {dok.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-500">
                              {formatFileSize(dok.groesse)}
                            </span>
                            <span className="text-xs text-slate-300 dark:text-slate-600">
                              ·
                            </span>
                            <span className="text-xs text-slate-500">
                              {dok.createdBy.name}
                            </span>
                            <span className="text-xs text-slate-300 dark:text-slate-600">
                              ·
                            </span>
                            <span className="text-xs text-slate-500">
                              {formatDate(dok.createdAt)}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Tags & folder */}
                    <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0">
                      {dok.ordner && (
                        <Badge variant="muted" className="text-[10px] gap-1">
                          <Folder className="w-2.5 h-2.5" />
                          {dok.ordner}
                        </Badge>
                      )}
                      {dok.tags?.slice(0, 2).map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {tag}
                        </Badge>
                      ))}
                      {(dok.tags?.length ?? 0) > 2 && (
                        <span className="text-[10px] text-slate-400">
                          +{dok.tags.length - 2}
                        </span>
                      )}
                    </div>

                    {/* OCR status badge */}
                    {dok.ocrStatus && dok.ocrStatus !== "NICHT_NOETIG" && dok.ocrStatus !== "ABGESCHLOSSEN" && (
                      <div className="flex-shrink-0 hidden sm:flex">
                        <OcrStatusBadge
                          status={dok.ocrStatus}
                          dokumentId={dok.id}
                          onRetry={fetchDokumente}
                        />
                      </div>
                    )}

                    {/* Status badge */}
                    <div className="flex-shrink-0 hidden sm:flex">
                      <DokumentStatusBadge
                        status={dok.status}
                        erstelltDurch={dok.erstelltDurch}
                      />
                    </div>

                    {/* File type badge */}
                    <Badge variant="muted" className="text-[10px] flex-shrink-0 hidden sm:flex">
                      {dok.mimeType.split("/")[1]?.toUpperCase() ?? dok.mimeType}
                    </Badge>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      {ONLYOFFICE_EDITABLE.has(dok.mimeType) && (
                        <button
                          onClick={() => setEditorDoc(dok)}
                          className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950 text-blue-500 hover:text-blue-700"
                          title="In ONLYOFFICE bearbeiten"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setPreviewDoc(dok)}
                        className="p-1.5 rounded-md hover:bg-white/20 dark:hover:bg-white/[0.06] text-slate-400 hover:text-slate-600"
                        title="Vorschau"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownload(dok)}
                        className="p-1.5 rounded-md hover:bg-white/20 dark:hover:bg-white/[0.06] text-slate-400 hover:text-slate-600"
                        title="Herunterladen"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <div className="relative">
                        <button
                          onClick={() =>
                            setActiveMenu(activeMenu === dok.id ? null : dok.id)
                          }
                          className="p-1.5 rounded-md hover:bg-white/20 dark:hover:bg-white/[0.06] text-slate-400 hover:text-slate-600"
                          title="Weitere Aktionen"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                        {activeMenu === dok.id && (
                          <ContextMenu
                            doc={dok}
                            ordnerList={ordnerList}
                            statusLoading={statusLoading === dok.id}
                            canFreigeben={FREIGABE_ROLES.includes(userRole)}
                            onRename={() => {
                              setRenameDocId(dok.id);
                              setRenameValue(dok.name);
                              setActiveMenu(null);
                            }}
                            onMove={(ordner) => {
                              handleMove(dok.id, ordner);
                              setActiveMenu(null);
                            }}
                            onStatusChange={(status) => {
                              handleStatusChange(dok.id, status);
                              setActiveMenu(null);
                            }}
                            onDelete={() => {
                              handleDelete(dok);
                              setActiveMenu(null);
                            }}
                            onExportPdf={
                              ONLYOFFICE_EDITABLE.has(dok.mimeType)
                                ? () => {
                                    handleExportPdf(dok);
                                    setActiveMenu(null);
                                  }
                                : undefined
                            }
                            onClose={() => setActiveMenu(null)}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Upload dialog */}
      <UploadDialog
        akteId={akteId}
        ordnerList={ordnerList}
        defaultOrdner={selectedOrdner !== "__none__" ? selectedOrdner : null}
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {
          fetchDokumente();
          router.refresh();
        }}
      />

      {/* Preview dialog */}
      <PreviewDialog
        dokument={previewDoc}
        open={previewDoc !== null}
        onClose={() => setPreviewDoc(null)}
        onEdit={(dok) => {
          if (dok) setEditorDoc(dok as DokumentItem);
        }}
      />

      {/* Create from template dialog */}
      <VorlageErstellenDialog
        akteId={akteId}
        ordnerList={ordnerList}
        defaultOrdner={selectedOrdner !== "__none__" ? selectedOrdner : null}
        open={vorlageOpen}
        onClose={() => setVorlageOpen(false)}
        onCreated={() => {
          fetchDokumente();
          router.refresh();
        }}
        onOpenInEditor={(dok) => {
          setEditorDoc({
            id: dok.id,
            name: dok.name,
            mimeType: dok.mimeType,
            groesse: 0,
            ordner: null,
            tags: [],
            status: "ENTWURF",
            erstelltDurch: "user",
            freigegebenDurch: null,
            freigegebenAm: null,
            createdAt: new Date().toISOString(),
            createdBy: { name: "" },
          });
        }}
      />

      {/* ONLYOFFICE editor dialog */}
      {editorDoc && (
        <EditorDialog
          dokument={editorDoc}
          mode="edit"
          open={editorDoc !== null}
          onClose={() => {
            setEditorDoc(null);
            // Refresh document list after closing editor (document may have been saved)
            fetchDokumente();
            router.refresh();
          }}
          onSaved={() => {
            fetchDokumente();
          }}
        />
      )}
    </div>
  );
}

// Context menu for document actions
function ContextMenu({
  doc,
  ordnerList,
  statusLoading,
  canFreigeben,
  onRename,
  onMove,
  onStatusChange,
  onDelete,
  onExportPdf,
  onClose,
}: {
  doc: DokumentItem;
  ordnerList: string[];
  statusLoading: boolean;
  canFreigeben: boolean;
  onRename: () => void;
  onMove: (ordner: string | null) => void;
  onStatusChange: (status: DokumentStatus) => void;
  onDelete: () => void;
  onExportPdf?: () => void;
  onClose: () => void;
}) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  // Allowed status transitions (VERSENDET only via send endpoints)
  const statusActions: { status: DokumentStatus; label: string; icon: React.ElementType; color: string }[] = [];
  switch (doc.status) {
    case "ENTWURF":
      statusActions.push({
        status: "ZUR_PRUEFUNG",
        label: "Zur Prüfung vorlegen",
        icon: FileSearch,
        color: "text-amber-600 dark:text-amber-400",
      });
      break;
    case "ZUR_PRUEFUNG":
      if (canFreigeben) {
        statusActions.push({
          status: "FREIGEGEBEN",
          label: "Freigeben",
          icon: ShieldCheck,
          color: "text-emerald-600 dark:text-emerald-400",
        });
      }
      statusActions.push({
        status: "ENTWURF",
        label: "Zurück zu Entwurf",
        icon: Undo2,
        color: "text-foreground/80",
      });
      break;
    case "FREIGEGEBEN":
      if (canFreigeben) {
        statusActions.push({
          status: "ZUR_PRUEFUNG",
          label: "Freigabe widerrufen",
          icon: Undo2,
          color: "text-amber-600 dark:text-amber-400",
        });
      }
      break;
    // VERSENDET: no transitions available via UI
  }

  return (
    <>
      {/* Click-away backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div className="absolute right-0 top-full mt-1 z-50 bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-lg shadow-lg border border-white/20 dark:border-white/[0.08] py-1 w-52">
        {/* Status actions */}
        {statusActions.length > 0 && (
          <>
            {statusActions.map((action) => (
              <button
                key={action.status}
                onClick={() => onStatusChange(action.status)}
                disabled={statusLoading}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 ${action.color}`}
              >
                <action.icon className="w-3.5 h-3.5" />
                {action.label}
              </button>
            ))}
            <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
          </>
        )}

        {/* Freigabe info */}
        {doc.status === "FREIGEGEBEN" && doc.freigegebenDurch && (
          <>
            <div className="px-3 py-1.5 text-[10px] text-muted-foreground">
              Freigegeben von {doc.freigegebenDurch.name}
              {doc.freigegebenAm && (
                <> am {new Date(doc.freigegebenAm).toLocaleDateString("de-DE")}</>
              )}
            </div>
            <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
          </>
        )}

        <button
          onClick={onRename}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground/80 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <Pencil className="w-3.5 h-3.5" />
          Umbenennen
        </button>

        <div className="relative">
          <button
            onClick={() => setShowMoveMenu(!showMoveMenu)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground/80 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Verschieben</span>
            <ChevronRight className="w-3 h-3" />
          </button>

          {showMoveMenu && (
            <div className="absolute left-full top-0 ml-1 bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-lg shadow-lg border border-white/20 dark:border-white/[0.08] py-1 w-44">
              {doc.ordner && (
                <button
                  onClick={() => onMove(null)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground/80 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <X className="w-3.5 h-3.5" />
                  Aus Ordner entfernen
                </button>
              )}
              {ordnerList
                .filter((f) => f !== doc.ordner)
                .map((folder) => (
                  <button
                    key={folder}
                    onClick={() => onMove(folder)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground/80 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Folder className="w-3.5 h-3.5" />
                    {folder}
                  </button>
                ))}
              {DEFAULT_ORDNER.filter(
                (f) => !ordnerList.includes(f) && f !== doc.ordner
              )
                .slice(0, 3)
                .map((folder) => (
                  <button
                    key={folder}
                    onClick={() => onMove(folder)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 italic"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    {folder}
                  </button>
                ))}
            </div>
          )}
        </div>

        {onExportPdf && doc.mimeType !== "application/pdf" && (
          <button
            onClick={onExportPdf}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground/80 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <FileOutput className="w-3.5 h-3.5" />
            Als PDF exportieren
          </button>
        )}

        <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

        <button
          onClick={onDelete}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Löschen
        </button>
      </div>
    </>
  );
}
