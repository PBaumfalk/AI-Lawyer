"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  FileText,
  Heart,
  Clock,
  Plus,
  Star,
  X,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { VorlagenWizard } from "./vorlagen-wizard";

// ─── Constants ──────────────────────────────────────────────────────────────

const KATEGORIE_LABELS: Record<string, string> = {
  SCHRIFTSATZ: "Schriftsatz",
  KLAGE: "Klage",
  MANDATSVOLLMACHT: "Mandatsvollmacht",
  MAHNUNG: "Mahnung",
  VERTRAG: "Vertrag",
  BRIEF: "Brief",
  BESCHEID: "Bescheid",
  SONSTIGES: "Sonstiges",
};

const KATEGORIE_COLORS: Record<string, string> = {
  SCHRIFTSATZ: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  KLAGE: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  MANDATSVOLLMACHT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  MAHNUNG: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  VERTRAG: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  BRIEF: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
  BESCHEID: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  SONSTIGES: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface VorlageItem {
  id: string;
  name: string;
  beschreibung: string | null;
  kategorie: string;
  dateiname: string;
  groesse: number;
  platzhalter: string[];
  tags: string[];
  freigegeben: boolean;
  isFavorit: boolean;
  customFelder: any;
  createdAt: string;
  createdBy: { name: string } | null;
}

// ─── LocalStorage helpers for "Zuletzt verwendet" ──────────────────────────

const RECENT_KEY = "vorlagen_zuletzt_verwendet";
const MAX_RECENT = 5;

function getRecentVorlagen(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function addRecentVorlage(id: string) {
  const recent = getRecentVorlagen().filter((r) => r !== id);
  recent.unshift(id);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

// ─── Component ──────────────────────────────────────────────────────────────

export function VorlagenUebersicht() {
  const [vorlagen, setVorlagen] = useState<VorlageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterKategorie, setFilterKategorie] = useState<string | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedVorlageId, setSelectedVorlageId] = useState<string | null>(null);

  // Fetch templates from API
  const fetchVorlagen = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterKategorie) params.set("kategorie", filterKategorie);
      if (searchQuery) params.set("q", searchQuery);
      const res = await fetch(`/api/vorlagen?${params}`);
      if (!res.ok) throw new Error("Fehler beim Laden");
      const data = await res.json();
      setVorlagen(data.vorlagen ?? []);
    } catch {
      toast.error("Vorlagen konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, [filterKategorie, searchQuery]);

  useEffect(() => {
    fetchVorlagen();
  }, [fetchVorlagen]);

  useEffect(() => {
    setRecentIds(getRecentVorlagen());
  }, []);

  // Toggle favorite
  const handleToggleFavorite = async (vorlageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/vorlagen/${vorlageId}/favorit`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Fehler");
      const data = await res.json();
      setVorlagen((prev) =>
        prev.map((v) =>
          v.id === vorlageId ? { ...v, isFavorit: data.isFavorit } : v
        )
      );
    } catch {
      toast.error("Fehler beim Aendern des Favoriten-Status");
    }
  };

  // Open wizard for a template
  const handleOpenWizard = (vorlageId: string) => {
    addRecentVorlage(vorlageId);
    setRecentIds(getRecentVorlagen());
    setSelectedVorlageId(vorlageId);
    setWizardOpen(true);
  };

  // Derived data
  const favoriten = vorlagen.filter((v) => v.isFavorit);
  const recentVorlagen = recentIds
    .map((id) => vorlagen.find((v) => v.id === id))
    .filter(Boolean) as VorlageItem[];
  const kategorien = Array.from(new Set(vorlagen.map((v) => v.kategorie))).sort();

  // Filter
  const filtered = vorlagen.filter((v) => {
    if (filterKategorie && v.kategorie !== filterKategorie) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        v.name.toLowerCase().includes(q) ||
        (v.beschreibung?.toLowerCase().includes(q) ?? false) ||
        v.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Lade Vorlagen...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search + actions toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Vorlagen durchsuchen (Name, Beschreibung, Tags)..."
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
        <Button size="sm" onClick={() => { setSelectedVorlageId(null); setWizardOpen(true); }}>
          <Plus className="w-4 h-4 mr-1.5" />
          Dokument erstellen
        </Button>
      </div>

      {/* Category filter pills */}
      {kategorien.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterKategorie(null)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              !filterKategorie
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            Alle ({vorlagen.length})
          </button>
          {kategorien.map((kat) => (
            <button
              key={kat}
              onClick={() => setFilterKategorie(filterKategorie === kat ? null : kat)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                filterKategorie === kat
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {KATEGORIE_LABELS[kat] ?? kat} ({vorlagen.filter((v) => v.kategorie === kat).length})
            </button>
          ))}
        </div>
      )}

      {/* Favoriten section */}
      {!searchQuery && !filterKategorie && favoriten.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-heading text-foreground">Favoriten</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {favoriten.map((v) => (
              <VorlageCard
                key={`fav-${v.id}`}
                vorlage={v}
                onOpen={() => handleOpenWizard(v.id)}
                onToggleFavorite={(e) => handleToggleFavorite(v.id, e)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Zuletzt verwendet section */}
      {!searchQuery && !filterKategorie && recentVorlagen.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-heading text-foreground">Zuletzt verwendet</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentVorlagen.map((v) => (
              <VorlageCard
                key={`recent-${v.id}`}
                vorlage={v}
                onOpen={() => handleOpenWizard(v.id)}
                onToggleFavorite={(e) => handleToggleFavorite(v.id, e)}
              />
            ))}
          </div>
        </div>
      )}

      {/* All templates grid */}
      <div>
        {(searchQuery || filterKategorie) && (
          <h2 className="text-sm font-heading text-foreground mb-3">
            {filtered.length} {filtered.length === 1 ? "Vorlage" : "Vorlagen"} gefunden
          </h2>
        )}
        {!searchQuery && !filterKategorie && (
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-heading text-foreground">Alle Vorlagen</h2>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-slate-200 dark:text-slate-700 mb-3" />
            <p className="text-sm text-muted-foreground">
              {searchQuery || filterKategorie
                ? "Keine Vorlagen gefunden."
                : "Noch keine Vorlagen vorhanden."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((v) => (
              <VorlageCard
                key={v.id}
                vorlage={v}
                onOpen={() => handleOpenWizard(v.id)}
                onToggleFavorite={(e) => handleToggleFavorite(v.id, e)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Wizard dialog */}
      {wizardOpen && (
        <VorlagenWizard
          vorlageId={selectedVorlageId}
          vorlagen={vorlagen}
          onClose={() => setWizardOpen(false)}
          onGenerated={() => {
            setWizardOpen(false);
            toast.success("Dokument erfolgreich generiert");
          }}
        />
      )}
    </div>
  );
}

// ─── Card Component ─────────────────────────────────────────────────────────

function VorlageCard({
  vorlage,
  onOpen,
  onToggleFavorite,
}: {
  vorlage: VorlageItem;
  onOpen: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onOpen}
      className="glass rounded-xl p-4 cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
          <h3 className="text-sm font-medium text-foreground truncate">
            {vorlage.name}
          </h3>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {vorlage.freigegeben && (
            <span title="Freigegeben"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /></span>
          )}
          <button
            onClick={onToggleFavorite}
            className="p-1 rounded-md hover:bg-white/20 dark:hover:bg-white/[0.06] transition-colors"
          >
            <Heart
              className={`w-4 h-4 transition-colors ${
                vorlage.isFavorit
                  ? "fill-rose-500 text-rose-500"
                  : "text-slate-300 dark:text-slate-600 group-hover:text-slate-400"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Category badge */}
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
            KATEGORIE_COLORS[vorlage.kategorie] ?? KATEGORIE_COLORS.SONSTIGES
          }`}
        >
          {KATEGORIE_LABELS[vorlage.kategorie] ?? vorlage.kategorie}
        </span>
        {!vorlage.freigegeben && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            Entwurf
          </Badge>
        )}
      </div>

      {/* Description */}
      {vorlage.beschreibung && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
          {vorlage.beschreibung}
        </p>
      )}

      {/* Tags */}
      {vorlage.tags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap mb-2">
          {vorlage.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            >
              {tag}
            </span>
          ))}
          {vorlage.tags.length > 3 && (
            <span className="text-[10px] text-muted-foreground">
              +{vorlage.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer: placeholder count */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-white/10 dark:border-white/[0.06]">
        <span>{vorlage.platzhalter.length} Platzhalter</span>
        <span>{vorlage.createdBy?.name ?? "System"}</span>
      </div>
    </div>
  );
}
