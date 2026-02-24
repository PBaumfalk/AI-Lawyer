"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Pencil,
  FolderPlus,
  Download,
  Trash2,
  RotateCcw,
  ExternalLink,
  FileSearch,
  FileCheck2,
  ShieldCheck,
  Undo2,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";

// MIME types that can be edited in OnlyOffice
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

type DokumentStatus = "ENTWURF" | "ZUR_PRUEFUNG" | "FREIGEGEBEN" | "VERSENDET";

const FREIGABE_ROLES = ["ADMIN", "ANWALT", "SACHBEARBEITER"];

// Default folder suggestions
const DEFAULT_ORDNER = [
  "Korrespondenz",
  "Schriftsaetze",
  "Vertraege",
  "Gerichtliche Dokumente",
  "Rechnungen",
  "Gutachten",
  "Sonstiges",
];

interface DokumentData {
  id: string;
  name: string;
  akteId: string;
  mimeType: string;
  status: DokumentStatus;
  ocrStatus: string;
  ordner: string | null;
  downloadUrl: string | null;
}

interface DocumentActionsBarProps {
  dokument: DokumentData;
  onUpdate: () => void;
}

/**
 * Vertical actions bar for document operations.
 * Provides rename, move, status change, download, delete, re-OCR, and OnlyOffice.
 */
export function DocumentActionsBar({
  dokument,
  onUpdate,
}: DocumentActionsBarProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role ?? "";

  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState(dokument.name);
  const [showMove, setShowMove] = useState(false);
  const [moveValue, setMoveValue] = useState(dokument.ordner ?? "");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isEditable = ONLYOFFICE_EDITABLE.has(dokument.mimeType);
  const canFreigeben = FREIGABE_ROLES.includes(userRole);

  // Rename handler
  const handleRename = async () => {
    if (!renameValue.trim()) return;
    setActionLoading("rename");
    try {
      const res = await fetch(`/api/dokumente/${dokument.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      if (!res.ok) throw new Error("Fehler");
      toast.success("Dokument umbenannt");
      setShowRename(false);
      onUpdate();
    } catch {
      toast.error("Umbenennen fehlgeschlagen");
    } finally {
      setActionLoading(null);
    }
  };

  // Move handler
  const handleMove = async (ordner: string | null) => {
    setActionLoading("move");
    try {
      const res = await fetch(`/api/dokumente/${dokument.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordner: ordner ?? "" }),
      });
      if (!res.ok) throw new Error("Fehler");
      toast.success(ordner ? `Verschoben nach "${ordner}"` : "Aus Ordner entfernt");
      setShowMove(false);
      onUpdate();
    } catch {
      toast.error("Verschieben fehlgeschlagen");
    } finally {
      setActionLoading(null);
    }
  };

  // Status change handler
  const handleStatusChange = async (status: DokumentStatus) => {
    setActionLoading("status");
    try {
      const res = await fetch(`/api/dokumente/${dokument.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Fehler");
      }
      const labels: Record<string, string> = {
        ENTWURF: "als Entwurf markiert",
        ZUR_PRUEFUNG: "zur Pruefung vorgelegt",
        FREIGEGEBEN: "freigegeben",
      };
      toast.success(`Dokument ${labels[status] ?? "aktualisiert"}`);
      onUpdate();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Statusaenderung fehlgeschlagen";
      toast.error(message);
    } finally {
      setActionLoading(null);
    }
  };

  // Download handler
  const handleDownload = () => {
    if (dokument.downloadUrl) {
      window.open(dokument.downloadUrl, "_blank");
    } else {
      // Fallback to streaming download
      const link = document.createElement("a");
      link.href = `/api/dokumente/${dokument.id}?download=true`;
      link.download = dokument.name;
      link.click();
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!confirm(`"${dokument.name}" wirklich loeschen? Diese Aktion kann nicht rueckgaengig gemacht werden.`)) {
      return;
    }
    setActionLoading("delete");
    try {
      const res = await fetch(`/api/dokumente/${dokument.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Fehler");
      toast.success("Dokument geloescht");
      router.push(`/akten/${dokument.akteId}`);
      router.refresh();
    } catch {
      toast.error("Loeschen fehlgeschlagen");
    } finally {
      setActionLoading(null);
    }
  };

  // Re-OCR handler
  const handleReOcr = async () => {
    setActionLoading("ocr");
    try {
      const res = await fetch(`/api/dokumente/${dokument.id}/ocr`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Fehler");
      }
      toast.success("OCR wird erneut gestartet");
      onUpdate();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "OCR-Neustart fehlgeschlagen";
      toast.error(message);
    } finally {
      setActionLoading(null);
    }
  };

  // Compute available status transitions
  const statusActions: {
    status: DokumentStatus;
    label: string;
    icon: React.ElementType;
    color: string;
  }[] = [];

  switch (dokument.status) {
    case "ENTWURF":
      statusActions.push({
        status: "ZUR_PRUEFUNG",
        label: "Zur Pruefung vorlegen",
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
        label: "Zurueck zu Entwurf",
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
  }

  return (
    <div className="space-y-1">
      {/* Status actions */}
      {statusActions.map((action) => (
        <Button
          key={action.status}
          size="sm"
          variant="ghost"
          onClick={() => handleStatusChange(action.status)}
          disabled={actionLoading === "status"}
          className={`w-full justify-start h-8 px-2 text-xs ${action.color}`}
        >
          {actionLoading === "status" ? (
            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
          ) : (
            <action.icon className="w-3.5 h-3.5 mr-2" />
          )}
          {action.label}
        </Button>
      ))}

      {statusActions.length > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
      )}

      {/* Rename */}
      {showRename ? (
        <div className="flex items-center gap-1 px-1">
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="h-7 text-xs flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") setShowRename(false);
            }}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRename}
            disabled={actionLoading === "rename"}
            className="h-7 px-1.5"
          >
            {actionLoading === "rename" ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <FileCheck2 className="w-3 h-3" />
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowRename(false)}
            className="h-7 px-1.5"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setRenameValue(dokument.name);
            setShowRename(true);
          }}
          className="w-full justify-start h-8 px-2 text-xs"
        >
          <Pencil className="w-3.5 h-3.5 mr-2" />
          Umbenennen
        </Button>
      )}

      {/* Move to folder */}
      {showMove ? (
        <div className="px-1 py-1 bg-slate-50 dark:bg-slate-800/50 rounded-md space-y-1">
          <div className="flex items-center gap-1">
            <Input
              value={moveValue}
              onChange={(e) => setMoveValue(e.target.value)}
              placeholder="Ordnername..."
              className="h-7 text-xs flex-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && moveValue.trim()) handleMove(moveValue.trim());
                if (e.key === "Escape") setShowMove(false);
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (moveValue.trim()) handleMove(moveValue.trim());
              }}
              disabled={actionLoading === "move"}
              className="h-7 px-1.5"
            >
              {actionLoading === "move" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <FileCheck2 className="w-3 h-3" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowMove(false)}
              className="h-7 px-1.5"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
          {/* Quick folder options */}
          <div className="flex flex-wrap gap-1">
            {DEFAULT_ORDNER.slice(0, 4).map((folder) => (
              <button
                key={folder}
                onClick={() => handleMove(folder)}
                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                {folder}
              </button>
            ))}
          </div>
          {dokument.ordner && (
            <button
              onClick={() => handleMove(null)}
              className="text-[10px] text-rose-500 hover:text-rose-700 px-1"
            >
              Aus Ordner entfernen
            </button>
          )}
        </div>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setMoveValue(dokument.ordner ?? "");
            setShowMove(true);
          }}
          className="w-full justify-start h-8 px-2 text-xs"
        >
          <FolderPlus className="w-3.5 h-3.5 mr-2" />
          Verschieben
        </Button>
      )}

      {/* Download */}
      <Button
        size="sm"
        variant="ghost"
        onClick={handleDownload}
        className="w-full justify-start h-8 px-2 text-xs"
      >
        <Download className="w-3.5 h-3.5 mr-2" />
        Herunterladen
      </Button>

      {/* OnlyOffice */}
      {isEditable && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            router.push(`/dokumente/${dokument.id}/bearbeiten`)
          }
          className="w-full justify-start h-8 px-2 text-xs text-blue-600 dark:text-blue-400"
        >
          <ExternalLink className="w-3.5 h-3.5 mr-2" />
          In OnlyOffice oeffnen
        </Button>
      )}

      {/* Re-OCR */}
      {dokument.ocrStatus === "FEHLGESCHLAGEN" && (
        <Button
          size="sm"
          variant="ghost"
          onClick={handleReOcr}
          disabled={actionLoading === "ocr"}
          className="w-full justify-start h-8 px-2 text-xs text-amber-600 dark:text-amber-400"
        >
          {actionLoading === "ocr" ? (
            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
          ) : (
            <RotateCcw className="w-3.5 h-3.5 mr-2" />
          )}
          Erneut OCR starten
        </Button>
      )}

      <div className="border-t border-slate-100 dark:border-slate-700 my-1" />

      {/* Delete */}
      <Button
        size="sm"
        variant="ghost"
        onClick={handleDelete}
        disabled={actionLoading === "delete"}
        className="w-full justify-start h-8 px-2 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950"
      >
        {actionLoading === "delete" ? (
          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
        ) : (
          <Trash2 className="w-3.5 h-3.5 mr-2" />
        )}
        Loeschen
      </Button>
    </div>
  );
}
