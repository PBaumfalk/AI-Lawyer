"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Search,
  Filter,
  MoreVertical,
  Check,
  RotateCcw,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  KalenderEintragDialog,
  type KalenderEintragItem,
} from "./kalender-eintrag-dialog";

// ── Type config for visual styling ─────────────────────────────────────────────

const TYP_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ElementType;
    badgeVariant: "default" | "danger" | "warning";
    bgColor: string;
  }
> = {
  TERMIN: {
    label: "Termin",
    icon: CalendarIcon,
    badgeVariant: "default",
    bgColor: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  },
  FRIST: {
    label: "Frist",
    icon: Clock,
    badgeVariant: "danger",
    bgColor: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
  },
  WIEDERVORLAGE: {
    label: "Wiedervorlage",
    icon: AlertCircle,
    badgeVariant: "warning",
    bgColor:
      "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  },
};

const FILTER_OPTIONS = [
  { value: "", label: "Alle" },
  { value: "TERMIN", label: "Termine" },
  { value: "FRIST", label: "Fristen" },
  { value: "WIEDERVORLAGE", label: "Wiedervorlagen" },
];

function formatDatumKurz(dateStr: string): string {
  return format(new Date(dateStr), "dd.MM.yyyy", { locale: de });
}

function formatDatumZeit(dateStr: string): string {
  return format(new Date(dateStr), "dd.MM.yyyy HH:mm", { locale: de });
}

// ── Main component ──────────────────────────────────────────────────────────────

export function KalenderListe() {
  const router = useRouter();

  // Data state
  const [eintraege, setEintraege] = useState<KalenderEintragItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [typFilter, setTypFilter] = useState("");
  const [showErledigt, setShowErledigt] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEintrag, setEditEintrag] = useState<KalenderEintragItem | null>(
    null
  );

  // Context menu state
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);

  // Fetch entries
  const fetchEintraege = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typFilter) params.set("typ", typFilter);
      if (!showErledigt) params.set("erledigt", "false");

      const res = await fetch(`/api/kalender?${params}`);
      if (!res.ok) throw new Error("Fehler beim Laden");
      const data = await res.json();
      setEintraege(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Kalendereinträge konnten nicht geladen werden");
      setEintraege([]);
    } finally {
      setLoading(false);
    }
  }, [typFilter, showErledigt]);

  useEffect(() => {
    fetchEintraege();
  }, [fetchEintraege]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenuId) return;
    const handler = () => setContextMenuId(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [contextMenuId]);

  // Toggle erledigt status
  async function handleToggleErledigt(
    eintrag: KalenderEintragItem,
    newValue: boolean
  ) {
    try {
      const res = await fetch(`/api/kalender/${eintrag.id}/erledigt`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ erledigt: newValue }),
      });
      if (!res.ok) throw new Error("Fehler beim Aktualisieren");
      toast.success(
        newValue ? "Als erledigt markiert" : "Als offen markiert"
      );
      fetchEintraege();
    } catch {
      toast.error("Status konnte nicht geändert werden");
    }
  }

  // Delete entry
  async function handleDelete(eintrag: KalenderEintragItem) {
    if (!confirm(`"${eintrag.titel}" wirklich löschen?`)) return;
    try {
      const res = await fetch(`/api/kalender/${eintrag.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Fehler beim Löschen");
      toast.success("Kalendereintrag gelöscht");
      fetchEintraege();
    } catch {
      toast.error("Eintrag konnte nicht gelöscht werden");
    }
  }

  // Open edit dialog
  function handleEdit(eintrag: KalenderEintragItem) {
    setEditEintrag(eintrag);
    setDialogOpen(true);
    setContextMenuId(null);
  }

  // Open create dialog
  function handleCreate() {
    setEditEintrag(null);
    setDialogOpen(true);
  }

  // Filter entries by search query (client-side on title/akte)
  const filteredEintraege = searchQuery
    ? eintraege.filter(
        (e) =>
          e.titel.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.akte?.aktenzeichen
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          e.akte?.kurzrubrum
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          e.verantwortlich.name
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
      )
    : eintraege;

  // Separate overdue from upcoming
  const now = new Date();
  const overdueEntries = filteredEintraege.filter(
    (e) => !e.erledigt && new Date(e.datum) < now
  );
  const upcomingEntries = filteredEintraege.filter(
    (e) => !e.erledigt && new Date(e.datum) >= now
  );
  const completedEntries = filteredEintraege.filter((e) => e.erledigt);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Kalender
          </h1>
          <p className="text-muted-foreground mt-1">
            Termine, Fristen & Wiedervorlagen
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Neuer Eintrag
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Type filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTypFilter(opt.value)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                typFilter === opt.value
                  ? "bg-foreground text-background border-foreground"
                  : "bg-white/30 text-muted-foreground border-white/20 hover:border-white/40 dark:bg-white/[0.06] dark:border-white/10 dark:hover:border-white/20"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Show completed toggle */}
        <label className="flex items-center gap-2 cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={showErledigt}
            onChange={(e) => setShowErledigt(e.target.checked)}
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary dark:border-slate-600"
          />
          <span className="text-sm text-muted-foreground">
            Erledigte anzeigen
          </span>
        </label>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Suche nach Titel, Akte, Verantwortlich..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredEintraege.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <p className="text-muted-foreground">Keine Kalendereinträge gefunden.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overdue section */}
          {overdueEntries.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Überfällig ({overdueEntries.length})
              </h2>
              <div className="space-y-2">
                {overdueEntries.map((eintrag) => (
                  <KalenderEintragRow
                    key={eintrag.id}
                    eintrag={eintrag}
                    isOverdue
                    onEdit={handleEdit}
                    onToggleErledigt={handleToggleErledigt}
                    onDelete={handleDelete}
                    contextMenuOpen={contextMenuId === eintrag.id}
                    onContextMenu={(id) =>
                      setContextMenuId(contextMenuId === id ? null : id)
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming section */}
          {upcomingEntries.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-foreground/80 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                Anstehend ({upcomingEntries.length})
              </h2>
              <div className="space-y-2">
                {upcomingEntries.map((eintrag) => (
                  <KalenderEintragRow
                    key={eintrag.id}
                    eintrag={eintrag}
                    onEdit={handleEdit}
                    onToggleErledigt={handleToggleErledigt}
                    onDelete={handleDelete}
                    contextMenuOpen={contextMenuId === eintrag.id}
                    onContextMenu={(id) =>
                      setContextMenuId(contextMenuId === id ? null : id)
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed section */}
          {showErledigt && completedEntries.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Erledigt ({completedEntries.length})
              </h2>
              <div className="space-y-2">
                {completedEntries.map((eintrag) => (
                  <KalenderEintragRow
                    key={eintrag.id}
                    eintrag={eintrag}
                    isCompleted
                    onEdit={handleEdit}
                    onToggleErledigt={handleToggleErledigt}
                    onDelete={handleDelete}
                    contextMenuOpen={contextMenuId === eintrag.id}
                    onContextMenu={(id) =>
                      setContextMenuId(contextMenuId === id ? null : id)
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <KalenderEintragDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditEintrag(null);
        }}
        onSaved={fetchEintraege}
        eintrag={editEintrag}
      />
    </div>
  );
}

// ── Single entry row ─────────────────────────────────────────────────────────────

interface KalenderEintragRowProps {
  eintrag: KalenderEintragItem;
  isOverdue?: boolean;
  isCompleted?: boolean;
  onEdit: (eintrag: KalenderEintragItem) => void;
  onToggleErledigt: (eintrag: KalenderEintragItem, value: boolean) => void;
  onDelete: (eintrag: KalenderEintragItem) => void;
  contextMenuOpen: boolean;
  onContextMenu: (id: string) => void;
}

function KalenderEintragRow({
  eintrag,
  isOverdue,
  isCompleted,
  onEdit,
  onToggleErledigt,
  onDelete,
  contextMenuOpen,
  onContextMenu,
}: KalenderEintragRowProps) {
  const config = TYP_CONFIG[eintrag.typ] ?? TYP_CONFIG.TERMIN;
  const Icon = config.icon;

  return (
    <div
      className={`glass-card rounded-xl p-4 flex items-center gap-4 group transition-colors hover:bg-white/30 dark:hover:bg-white/[0.05] ${
        isOverdue
          ? "border-rose-300 dark:border-rose-800"
          : isCompleted
            ? "border-white/20 dark:border-white/[0.08] opacity-75"
            : "border-white/20 dark:border-white/[0.08]"
      }`}
    >
      {/* Checkbox for erledigt */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleErledigt(eintrag, !eintrag.erledigt);
        }}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          eintrag.erledigt
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-muted-foreground/40 hover:border-muted-foreground/60"
        }`}
        title={eintrag.erledigt ? "Als offen markieren" : "Als erledigt markieren"}
      >
        {eintrag.erledigt && <Check className="w-3 h-3" />}
      </button>

      {/* Type icon */}
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${config.bgColor}`}
      >
        <Icon className="w-5 h-5" />
      </div>

      {/* Content — clickable to edit */}
      <div
        className="min-w-0 flex-1 cursor-pointer"
        onClick={() => onEdit(eintrag)}
      >
        <p
          className={`text-sm font-medium ${
            isCompleted
              ? "text-muted-foreground line-through"
              : isOverdue
                ? "text-rose-600 dark:text-rose-400"
                : "text-foreground"
          }`}
        >
          {eintrag.titel}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
          {eintrag.akte && (
            <span>
              {eintrag.akte.aktenzeichen} – {eintrag.akte.kurzrubrum}
            </span>
          )}
          {eintrag.akte && <span>·</span>}
          <span>{eintrag.verantwortlich.name}</span>
          {eintrag.beschreibung && (
            <>
              <span>·</span>
              <span className="truncate max-w-[200px]">
                {eintrag.beschreibung}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Date + type badge */}
      <div className="text-right flex-shrink-0">
        <p
          className={`text-sm font-medium ${
            isOverdue
              ? "text-rose-600"
              : isCompleted
                ? "text-muted-foreground"
                : "text-foreground/80"
          }`}
        >
          {formatDatumKurz(eintrag.datum)}
          {eintrag.datumBis && (
            <span className="text-muted-foreground">
              {" "}
              – {formatDatumKurz(eintrag.datumBis)}
            </span>
          )}
        </p>
        <Badge variant={config.badgeVariant} className="mt-1">
          {config.label}
        </Badge>
      </div>

      {/* Context menu */}
      <div className="relative flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(eintrag.id);
          }}
          className="p-1.5 rounded-md hover:bg-white/20 dark:hover:bg-white/[0.06] transition-colors opacity-0 group-hover:opacity-100"
        >
          <MoreVertical className="w-4 h-4 text-muted-foreground" />
        </button>

        {contextMenuOpen && (
          <div
            className="absolute right-0 top-full mt-1 z-20 w-48 glass-card rounded-lg shadow-lg py-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-white/20 dark:hover:bg-white/[0.06] flex items-center gap-2"
              onClick={() => onEdit(eintrag)}
            >
              <Pencil className="w-4 h-4 text-muted-foreground" />
              Bearbeiten
            </button>
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-white/20 dark:hover:bg-white/[0.06] flex items-center gap-2"
              onClick={() => {
                onToggleErledigt(eintrag, !eintrag.erledigt);
                onContextMenu("");
              }}
            >
              {eintrag.erledigt ? (
                <>
                  <RotateCcw className="w-4 h-4 text-muted-foreground" />
                  Wieder öffnen
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Als erledigt markieren
                </>
              )}
            </button>
            <div className="border-t border-white/10 dark:border-white/[0.06] my-1" />
            <button
              className="w-full text-left px-3 py-2 text-sm hover:bg-rose-50 dark:hover:bg-rose-950 text-rose-600 flex items-center gap-2"
              onClick={() => {
                onDelete(eintrag);
                onContextMenu("");
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
}
