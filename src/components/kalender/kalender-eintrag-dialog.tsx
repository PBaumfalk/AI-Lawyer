"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Loader2, X, Search, Calendar, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface KalenderEintragItem {
  id: string;
  typ: "TERMIN" | "FRIST" | "WIEDERVORLAGE";
  titel: string;
  beschreibung: string | null;
  datum: string;
  datumBis: string | null;
  ganztaegig: boolean;
  erledigt: boolean;
  erledigtAm: string | null;
  akteId: string | null;
  verantwortlichId: string;
  fristablauf: string | null;
  vorfrist: string | null;
  akte: { aktenzeichen: string; kurzrubrum: string } | null;
  verantwortlich: { name: string };
}

interface KalenderEintragDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  eintrag?: KalenderEintragItem | null;
  defaultDate?: Date;
  akteId?: string;
}

interface FormValues {
  typ: "TERMIN" | "FRIST" | "WIEDERVORLAGE";
  titel: string;
  beschreibung: string;
  datum: string;
  datumBis: string;
  ganztaegig: boolean;
  akteId: string;
  verantwortlichId: string;
  fristablauf: string;
  vorfrist: string;
}

interface UserOption {
  id: string;
  name: string;
  role: string;
}

interface AkteSearchResult {
  id: string;
  aktenzeichen: string;
  kurzrubrum: string;
}

// ── Helper: format a Date or ISO string to yyyy-MM-dd for <input type="date"> ──

function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "";
  return format(d, "yyyy-MM-dd");
}

// ── Helper: format a Date or ISO string to yyyy-MM-dd'T'HH:mm for datetime-local ──

function toDateTimeInputValue(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "";
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

// ── Type config for visual styling ─────────────────────────────────────────────

const TYP_CONFIG = {
  TERMIN: {
    label: "Termin",
    icon: Calendar,
    color: "text-blue-600",
  },
  FRIST: {
    label: "Frist",
    icon: Clock,
    color: "text-rose-600",
  },
  WIEDERVORLAGE: {
    label: "Wiedervorlage",
    icon: AlertCircle,
    color: "text-amber-600",
  },
} as const;

// ── Component ──────────────────────────────────────────────────────────────────

export function KalenderEintragDialog({
  open,
  onClose,
  onSaved,
  eintrag,
  defaultDate,
  akteId,
}: KalenderEintragDialogProps) {
  const isEdit = !!eintrag;

  // Users for the responsible person select
  const [users, setUsers] = useState<UserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Akte search
  const [akteQuery, setAkteQuery] = useState("");
  const [akteResults, setAkteResults] = useState<AkteSearchResult[]>([]);
  const [akteSearching, setAkteSearching] = useState(false);
  const [showAkteDropdown, setShowAkteDropdown] = useState(false);
  const [selectedAkte, setSelectedAkte] = useState<AkteSearchResult | null>(
    eintrag?.akte
      ? { id: eintrag.akteId!, aktenzeichen: eintrag.akte.aktenzeichen, kurzrubrum: eintrag.akte.kurzrubrum }
      : null
  );

  // Submission state
  const [saving, setSaving] = useState(false);

  // Form setup with react-hook-form
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      typ: eintrag?.typ ?? "TERMIN",
      titel: eintrag?.titel ?? "",
      beschreibung: eintrag?.beschreibung ?? "",
      datum: eintrag
        ? eintrag.ganztaegig
          ? toDateInputValue(eintrag.datum)
          : toDateTimeInputValue(eintrag.datum)
        : defaultDate
          ? toDateInputValue(defaultDate)
          : "",
      datumBis: eintrag
        ? eintrag.ganztaegig
          ? toDateInputValue(eintrag.datumBis)
          : toDateTimeInputValue(eintrag.datumBis)
        : "",
      ganztaegig: eintrag?.ganztaegig ?? true,
      akteId: eintrag?.akteId ?? akteId ?? "",
      verantwortlichId: eintrag?.verantwortlichId ?? "",
      fristablauf: toDateInputValue(eintrag?.fristablauf),
      vorfrist: toDateInputValue(eintrag?.vorfrist),
    },
  });

  const watchTyp = watch("typ");
  const watchGanztaegig = watch("ganztaegig");

  // Reset form when dialog opens/closes or eintrag changes
  useEffect(() => {
    if (open) {
      reset({
        typ: eintrag?.typ ?? "TERMIN",
        titel: eintrag?.titel ?? "",
        beschreibung: eintrag?.beschreibung ?? "",
        datum: eintrag
          ? eintrag.ganztaegig
            ? toDateInputValue(eintrag.datum)
            : toDateTimeInputValue(eintrag.datum)
          : defaultDate
            ? toDateInputValue(defaultDate)
            : "",
        datumBis: eintrag
          ? eintrag.ganztaegig
            ? toDateInputValue(eintrag.datumBis)
            : toDateTimeInputValue(eintrag.datumBis)
          : "",
        ganztaegig: eintrag?.ganztaegig ?? true,
        akteId: eintrag?.akteId ?? akteId ?? "",
        verantwortlichId: eintrag?.verantwortlichId ?? "",
        fristablauf: toDateInputValue(eintrag?.fristablauf),
        vorfrist: toDateInputValue(eintrag?.vorfrist),
      });
      setSelectedAkte(
        eintrag?.akte
          ? { id: eintrag.akteId!, aktenzeichen: eintrag.akte.aktenzeichen, kurzrubrum: eintrag.akte.kurzrubrum }
          : null
      );
      setAkteQuery("");
    }
  }, [open, eintrag, defaultDate, akteId, reset]);

  // Fetch users on open
  useEffect(() => {
    if (!open) return;
    setUsersLoading(true);
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]))
      .finally(() => setUsersLoading(false));
  }, [open]);

  // Debounced Akte search
  useEffect(() => {
    if (akteQuery.length < 2) {
      setAkteResults([]);
      return;
    }

    setAkteSearching(true);
    const timer = setTimeout(() => {
      fetch(`/api/akten?q=${encodeURIComponent(akteQuery)}&take=8`)
        .then((r) => r.json())
        .then((data) => {
          const akten = data.akten ?? data;
          setAkteResults(
            Array.isArray(akten)
              ? akten.map((a: any) => ({
                  id: a.id,
                  aktenzeichen: a.aktenzeichen,
                  kurzrubrum: a.kurzrubrum,
                }))
              : []
          );
        })
        .catch(() => setAkteResults([]))
        .finally(() => setAkteSearching(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [akteQuery]);

  // Handle Akte selection
  const handleAkteSelect = useCallback(
    (akte: AkteSearchResult) => {
      setSelectedAkte(akte);
      setValue("akteId", akte.id);
      setAkteQuery("");
      setShowAkteDropdown(false);
    },
    [setValue]
  );

  const handleAkteClear = useCallback(() => {
    setSelectedAkte(null);
    setValue("akteId", "");
  }, [setValue]);

  // Submit handler
  const onSubmit = async (data: FormValues) => {
    setSaving(true);

    try {
      // Build payload
      const payload: Record<string, unknown> = {
        typ: data.typ,
        titel: data.titel.trim(),
        beschreibung: data.beschreibung.trim() || null,
        datum: data.datum ? new Date(data.datum).toISOString() : null,
        datumBis:
          data.typ === "TERMIN" && data.datumBis
            ? new Date(data.datumBis).toISOString()
            : null,
        ganztaegig: data.ganztaegig,
        akteId: data.akteId || null,
        verantwortlichId: data.verantwortlichId || null,
        fristablauf:
          data.typ === "FRIST" && data.fristablauf
            ? new Date(data.fristablauf).toISOString()
            : null,
        vorfrist:
          data.typ === "FRIST" && data.vorfrist
            ? new Date(data.vorfrist).toISOString()
            : null,
      };

      const url = isEdit ? `/api/kalender/${eintrag!.id}` : "/api/kalender";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.error || `Fehler beim ${isEdit ? "Speichern" : "Erstellen"}`
        );
      }

      toast.success(
        isEdit
          ? "Kalendereintrag gespeichert"
          : "Kalendereintrag erstellt"
      );
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Ein unbekannter Fehler ist aufgetreten");
    } finally {
      setSaving(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const datumInputType = watchGanztaegig ? "date" : "datetime-local";

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel (slide-in from right, like existing dialogs) */}
      <div className="absolute inset-y-0 right-0 w-full max-w-lg bg-white/50 dark:bg-white/[0.05] backdrop-blur-md border-l border-white/20 dark:border-white/[0.08] shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/20 dark:border-white/[0.08]">
          <h2 className="text-lg font-heading text-foreground">
            {isEdit ? "Eintrag bearbeiten" : "Neuer Kalendereintrag"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-white/20 dark:hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          {/* Typ */}
          <div className="space-y-2">
            <Label>Typ</Label>
            <div className="flex gap-2">
              {(["TERMIN", "FRIST", "WIEDERVORLAGE"] as const).map((typ) => {
                const config = TYP_CONFIG[typ];
                const Icon = config.icon;
                const isSelected = watchTyp === typ;
                return (
                  <button
                    key={typ}
                    type="button"
                    onClick={() => setValue("typ", typ)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      isSelected
                        ? typ === "TERMIN"
                          ? "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-700"
                          : typ === "FRIST"
                            ? "border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400 dark:border-rose-700"
                            : "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-700"
                        : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Titel */}
          <div className="space-y-2">
            <Label htmlFor="eintrag-titel">
              Titel <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="eintrag-titel"
              placeholder="z.B. Termin beim Amtsgericht"
              {...register("titel", { required: "Titel ist erforderlich" })}
            />
            {errors.titel && (
              <p className="text-xs text-rose-600">{errors.titel.message}</p>
            )}
          </div>

          {/* Beschreibung */}
          <div className="space-y-2">
            <Label htmlFor="eintrag-beschreibung">Beschreibung</Label>
            <Textarea
              id="eintrag-beschreibung"
              placeholder="Optionale Beschreibung..."
              rows={3}
              {...register("beschreibung")}
            />
          </div>

          {/* Ganztaegig + Datum row */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...register("ganztaegig")}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-600"
              />
              <span className="text-sm text-foreground/80">
                Ganztaegig
              </span>
            </label>

            <div className="grid grid-cols-2 gap-4">
              {/* Datum */}
              <div className="space-y-2">
                <Label htmlFor="eintrag-datum">
                  {watchTyp === "TERMIN" ? "Beginn" : "Datum"}{" "}
                  <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="eintrag-datum"
                  type={datumInputType}
                  {...register("datum", { required: "Datum ist erforderlich" })}
                />
                {errors.datum && (
                  <p className="text-xs text-rose-600">{errors.datum.message}</p>
                )}
              </div>

              {/* DatumBis — only for TERMIN */}
              {watchTyp === "TERMIN" && (
                <div className="space-y-2">
                  <Label htmlFor="eintrag-datumBis">Ende</Label>
                  <Input
                    id="eintrag-datumBis"
                    type={datumInputType}
                    {...register("datumBis")}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Frist-specific fields */}
          {watchTyp === "FRIST" && (
            <div className="space-y-3 p-4 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="eintrag-fristablauf" className="text-rose-700 dark:text-rose-400">
                    Fristablauf
                  </Label>
                  <Input
                    id="eintrag-fristablauf"
                    type="date"
                    {...register("fristablauf")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eintrag-vorfrist" className="text-rose-700 dark:text-rose-400">
                    Vorfrist
                  </Label>
                  <Input
                    id="eintrag-vorfrist"
                    type="date"
                    {...register("vorfrist")}
                  />
                </div>
              </div>
              <p className="text-[10px] text-rose-600/70 dark:text-rose-400/70">
                Tipp: Nutzen Sie den Fristenrechner (Cmd+Shift+F) fuer praezise Berechnung mit Feiertagen.
              </p>
            </div>
          )}

          {/* Akte search-select */}
          <div className="space-y-2">
            <Label>Akte (optional)</Label>
            {selectedAkte ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/20 dark:border-white/[0.08] bg-slate-50 dark:bg-slate-800">
                <span className="text-sm text-foreground flex-1 truncate">
                  {selectedAkte.aktenzeichen} &mdash; {selectedAkte.kurzrubrum}
                </span>
                <button
                  type="button"
                  onClick={handleAkteClear}
                  className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    className="pl-9"
                    placeholder="Akte suchen (Aktenzeichen oder Kurzrubrum)..."
                    value={akteQuery}
                    onChange={(e) => {
                      setAkteQuery(e.target.value);
                      setShowAkteDropdown(true);
                    }}
                    onFocus={() => setShowAkteDropdown(true)}
                    onBlur={() => {
                      // Delay to allow click on dropdown items
                      setTimeout(() => setShowAkteDropdown(false), 200);
                    }}
                  />
                </div>
                {showAkteDropdown && akteQuery.length >= 2 && (
                  <div className="absolute z-10 mt-1 w-full bg-white/50 dark:bg-white/[0.05] backdrop-blur-md border border-white/20 dark:border-white/[0.08] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {akteSearching ? (
                      <div className="px-3 py-2 text-sm text-slate-400 flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Suche...
                      </div>
                    ) : akteResults.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-slate-400">
                        Keine Akten gefunden
                      </div>
                    ) : (
                      akteResults.map((akte) => (
                        <button
                          key={akte.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-white/20 dark:hover:bg-white/[0.06] transition-colors"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleAkteSelect(akte);
                          }}
                        >
                          <span className="font-medium text-foreground">
                            {akte.aktenzeichen}
                          </span>
                          <span className="text-slate-500 ml-2">
                            {akte.kurzrubrum}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            <input type="hidden" {...register("akteId")} />
          </div>

          {/* Verantwortlich */}
          <div className="space-y-2">
            <Label htmlFor="eintrag-verantwortlich">Verantwortlich</Label>
            <Select
              id="eintrag-verantwortlich"
              {...register("verantwortlichId")}
              disabled={usersLoading}
            >
              <option value="">
                {usersLoading ? "Lade Benutzer..." : "-- Auswahlen --"}
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/20 dark:border-white/[0.08]">
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? "Speichern" : "Erstellen"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
