"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Calendar as CalendarIcon,
  Clock,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Loader2,
  Check,
  RotateCcw,
  Pencil,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  KalenderEintragDialog,
  type KalenderEintragItem,
} from "./kalender-eintrag-dialog";

// ── Config ──────────────────────────────────────────────────────────────────────

const TYP_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ElementType;
    badgeVariant: "default" | "danger" | "warning";
  }
> = {
  TERMIN: { label: "Termin", icon: CalendarIcon, badgeVariant: "default" },
  FRIST: { label: "Frist", icon: Clock, badgeVariant: "danger" },
  WIEDERVORLAGE: {
    label: "Wiedervorlage",
    icon: AlertCircle,
    badgeVariant: "warning",
  },
};

function formatDatum(dateStr: string): string {
  return format(new Date(dateStr), "dd.MM.yyyy", { locale: de });
}

// ── Serialized entry type from SSR ──────────────────────────────────────────────

interface InitialKalenderEintrag {
  id: string;
  typ: string;
  titel: string;
  beschreibung?: string | null;
  datum: string;
  datumBis?: string | null;
  ganztaegig?: boolean;
  erledigt: boolean;
  erledigtAm?: string | null;
  akteId?: string | null;
  verantwortlichId?: string;
  fristablauf?: string | null;
  vorfrist?: string | null;
  verantwortlich: { name: string };
}

interface KalenderTabProps {
  akteId: string;
  initialEintraege: InitialKalenderEintrag[];
}

export function KalenderTab({ akteId, initialEintraege }: KalenderTabProps) {
  const router = useRouter();

  // State
  const [eintraege, setEintraege] =
    useState<InitialKalenderEintrag[]>(initialEintraege);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEintrag, setEditEintrag] = useState<KalenderEintragItem | null>(
    null
  );
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [showErledigt, setShowErledigt] = useState(false);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenuId) return;
    const handler = () => setContextMenuId(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [contextMenuId]);

  // Refresh data from API
  const refreshData = useCallback(async () => {
    try {
      const res = await fetch(`/api/kalender?akteId=${akteId}`);
      if (!res.ok) return;
      const data = await res.json();
      setEintraege(Array.isArray(data) ? data : []);
    } catch {
      // Fallback to router refresh
      router.refresh();
    }
  }, [akteId, router]);

  // Toggle erledigt
  async function handleToggleErledigt(id: string, newValue: boolean) {
    try {
      const res = await fetch(`/api/kalender/${id}/erledigt`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ erledigt: newValue }),
      });
      if (!res.ok) throw new Error();
      toast.success(
        newValue ? "Als erledigt markiert" : "Als offen markiert"
      );
      refreshData();
    } catch {
      toast.error("Status konnte nicht geändert werden");
    }
  }

  // Delete
  async function handleDelete(id: string, titel: string) {
    if (!confirm(`"${titel}" wirklich löschen?`)) return;
    try {
      const res = await fetch(`/api/kalender/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Kalendereintrag gelöscht");
      refreshData();
    } catch {
      toast.error("Eintrag konnte nicht gelöscht werden");
    }
  }

  // Open edit — fetch full entry data from API to get all fields
  async function handleEdit(eintrag: InitialKalenderEintrag) {
    try {
      const res = await fetch(`/api/kalender/${eintrag.id}`);
      if (!res.ok) throw new Error();
      const fullData = await res.json();
      setEditEintrag(fullData);
      setDialogOpen(true);
    } catch {
      toast.error("Eintrag konnte nicht geladen werden");
    }
    setContextMenuId(null);
  }

  // Separate entries
  const now = new Date();
  const openEntries = eintraege.filter((e) => !e.erledigt);
  const completedEntries = eintraege.filter((e) => e.erledigt);
  const displayEntries = showErledigt
    ? [...openEntries, ...completedEntries]
    : openEntries;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showErledigt}
            onChange={(e) => setShowErledigt(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-600"
          />
          <span className="text-sm text-muted-foreground">
            Erledigte anzeigen ({completedEntries.length})
          </span>
        </label>
        <Button
          size="sm"
          onClick={() => {
            setEditEintrag(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-1" />
          Neuer Eintrag
        </Button>
      </div>

      {/* List */}
      <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08]">
        {displayEntries.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">
            Keine Termine oder Fristen vorhanden.
          </div>
        ) : (
          <div className="divide-y divide-white/10 dark:divide-white/[0.04]">
            {displayEntries.map((ke) => {
              const isOverdue =
                !ke.erledigt && new Date(ke.datum) < now;
              const isCompleted = ke.erledigt;
              const config = TYP_CONFIG[ke.typ] ?? TYP_CONFIG.TERMIN;

              return (
                <div
                  key={ke.id}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-white/20 dark:hover:bg-white/[0.05] transition-colors group"
                >
                  {/* Erledigt toggle */}
                  <button
                    onClick={() =>
                      handleToggleErledigt(ke.id, !ke.erledigt)
                    }
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      ke.erledigt
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-slate-300 dark:border-slate-600 hover:border-slate-400"
                    }`}
                    title={
                      ke.erledigt
                        ? "Als offen markieren"
                        : "Als erledigt markieren"
                    }
                  >
                    {ke.erledigt && <Check className="w-3 h-3" />}
                  </button>

                  {/* Status icon */}
                  <div className="flex-shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : isOverdue ? (
                      <AlertTriangle className="w-5 h-5 text-rose-500" />
                    ) : (
                      <CalendarIcon className="w-5 h-5 text-slate-400" />
                    )}
                  </div>

                  {/* Content — clickable to edit */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => handleEdit(ke)}
                  >
                    <p
                      className={`text-sm font-medium ${
                        isCompleted
                          ? "text-slate-400 line-through"
                          : isOverdue
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-foreground"
                      }`}
                    >
                      {ke.titel}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {ke.verantwortlich.name} · {formatDatum(ke.datum)}
                    </p>
                  </div>

                  {/* Type badge */}
                  <Badge variant={config.badgeVariant}>{config.label}</Badge>

                  {/* Actions menu */}
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setContextMenuId(
                          contextMenuId === ke.id ? null : ke.id
                        );
                      }}
                      className="p-1.5 rounded-md hover:bg-white/20 dark:hover:bg-white/[0.06] transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </button>

                    {contextMenuId === ke.id && (
                      <div
                        className="absolute right-0 top-full mt-1 z-20 w-48 bg-white/50 dark:bg-white/[0.05] backdrop-blur-md border border-white/20 dark:border-white/[0.08] rounded-lg shadow-lg py-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-white/20 dark:hover:bg-white/[0.06] flex items-center gap-2"
                          onClick={() => handleEdit(ke)}
                        >
                          <Pencil className="w-4 h-4 text-slate-400" />
                          Bearbeiten
                        </button>
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-white/20 dark:hover:bg-white/[0.06] flex items-center gap-2"
                          onClick={() => {
                            handleToggleErledigt(ke.id, !ke.erledigt);
                            setContextMenuId(null);
                          }}
                        >
                          {ke.erledigt ? (
                            <>
                              <RotateCcw className="w-4 h-4 text-slate-400" />
                              Wieder öffnen
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              Als erledigt markieren
                            </>
                          )}
                        </button>
                        <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-600 flex items-center gap-2"
                          onClick={() => {
                            handleDelete(ke.id, ke.titel);
                            setContextMenuId(null);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                          Löschen
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <KalenderEintragDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditEintrag(null);
        }}
        onSaved={refreshData}
        eintrag={editEintrag}
        akteId={akteId}
      />
    </div>
  );
}
