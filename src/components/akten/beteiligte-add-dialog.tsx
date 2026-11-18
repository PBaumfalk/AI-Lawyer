"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { X, Search, Loader2, User, Building2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  kontakteListUrl,
  anschriftOrt,
  kontaktAnzeigename,
  type KontakteListItem,
  type KontakteListResponse,
} from "@/lib/kontakte/liste";
import {
  BETEILIGTEN_ROLLEN as ROLLEN,
  beteiligteUrl,
  conflictCheckUrl,
  type AddBeteiligterBody,
  type BeteiligtenRolle,
} from "@/lib/kontakte/beteiligte";
import type { ConflictResult } from "@/lib/conflict-check";

type KontaktOption = KontakteListItem;

interface BeteiligteAddDialogProps {
  akteId: string;
  open: boolean;
  onClose: () => void;
}

export function BeteiligteAddDialog({
  akteId,
  open,
  onClose,
}: BeteiligteAddDialogProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [kontakte, setKontakte] = useState<KontaktOption[]>([]);
  const [selectedKontakt, setSelectedKontakt] = useState<KontaktOption | null>(
    null
  );
  const [rolle, setRolle] = useState<BeteiligtenRolle>("MANDANT");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setKontakte([]);
      setSelectedKontakt(null);
      setRolle("MANDANT");
      setConflictWarning(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      // Without at least two characters: first contacts alphabetically.
      fetch(kontakteListUrl({ q: search.trim().length >= 2 ? search.trim() : undefined, take: 30 }))
        .then(async (r) => {
          if (!r.ok) throw new Error("Kontakte konnten nicht geladen werden");
          return (await r.json()) as KontakteListResponse;
        })
        .then((data) => {
          if (!cancelled) setKontakte(data.kontakte);
        })
        .catch((err: Error) => {
          if (!cancelled) {
            setKontakte([]);
            toast.error(err.message);
          }
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, open]);

  const kontaktLabel = (k: KontaktOption) => kontaktAnzeigename(k);

  async function handleSubmit(forceAdd = false) {
    if (!selectedKontakt) return;
    setLoading(true);
    setConflictWarning(null);

    try {
      // Check for conflicts first (unless user already confirmed)
      if (!forceAdd) {
        const checkRes = await fetch(conflictCheckUrl(akteId, selectedKontakt.id, rolle));
        if (!checkRes.ok) {
          // Never add silently without the conflict check having run.
          throw new Error("Kollisionspruefung fehlgeschlagen");
        }
        {
          const result = (await checkRes.json()) as ConflictResult;
          if (result.hasConflict) {
            const conflictDetails = result.conflicts
              .map(
                (c) =>
                  `${c.kontaktName} ist ${c.existingRolle} in Akte ${c.aktenzeichen} (${c.kurzrubrum})`
              )
              .join("; ");
            setConflictWarning(
              `Interessenkonflikt: ${conflictDetails}. Trotzdem hinzufügen?`
            );
            setLoading(false);
            return;
          }
        }
      }

      const body: AddBeteiligterBody = { kontaktId: selectedKontakt.id, rolle };
      const res = await fetch(beteiligteUrl(akteId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fehler beim Hinzufügen");
      }

      toast.success(
        `${kontaktLabel(selectedKontakt)} als ${ROLLEN.find((r) => r.value === rolle)?.label} hinzugefügt`
      );
      onClose();
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-full max-w-lg bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl shadow-2xl border border-white/20 dark:border-white/[0.08] overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/20 dark:border-white/[0.08]">
          <h2 className="text-lg font-heading text-foreground">
            Beteiligten hinzufügen
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-white/20 dark:hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Rolle */}
          <div className="space-y-2">
            <Label>Rolle</Label>
            <Select
              value={rolle}
              onChange={(e) => {
                setRolle(e.target.value as BeteiligtenRolle);
                setConflictWarning(null);
              }}
            >
              {ROLLEN.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Kontakt-Suche */}
          <div className="space-y-2">
            <Label>Kontakt suchen</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedKontakt(null);
                }}
                placeholder="Name oder Firma eingeben..."
                className="pl-10"
                autoFocus
              />
            </div>
          </div>

          {/* Selected kontakt */}
          {selectedKontakt && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-brand-50 dark:bg-brand-950 border border-brand-200 dark:border-brand-800">
              <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
                {selectedKontakt.typ === "NATUERLICH" ? (
                  <User className="w-4 h-4 text-brand-600" />
                ) : (
                  <Building2 className="w-4 h-4 text-brand-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-brand-700 dark:text-brand-300">
                  {kontaktLabel(selectedKontakt)}
                </p>
                {anschriftOrt(selectedKontakt.anschrift) && (
                  <p className="text-xs text-brand-500">
                    {anschriftOrt(selectedKontakt.anschrift)}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedKontakt(null);
                  setConflictWarning(null);
                }}
                className="text-brand-400 hover:text-brand-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Kontakt-Liste */}
          {!selectedKontakt && (
            <div className="max-h-48 overflow-y-auto border border-white/20 dark:border-white/[0.08] rounded-lg">
              {searching ? (
                <div className="p-4 text-center text-sm text-slate-400">
                  Suche...
                </div>
              ) : kontakte.length === 0 ? (
                <div className="p-4 text-center text-sm text-slate-400">
                  Keine Kontakte gefunden.
                </div>
              ) : (
                kontakte.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => setSelectedKontakt(k)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-white/10 dark:border-white/[0.06] last:border-b-0"
                  >
                    <div className="w-8 h-8 rounded-full bg-white/20 dark:bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                      {k.typ === "NATUERLICH" ? (
                        <User className="w-4 h-4 text-slate-500" />
                      ) : (
                        <Building2 className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {kontaktLabel(k)}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {[anschriftOrt(k.anschrift), k.email].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Conflict Warning */}
        {conflictWarning && (
          <div className="mx-5 mb-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Interessenkonflikt erkannt
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  {conflictWarning}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 p-5 border-t border-white/20 dark:border-white/[0.08]">
          <Button variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
          {conflictWarning ? (
            <Button
              variant="destructive"
              onClick={() => handleSubmit(true)}
              disabled={loading}
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Trotzdem hinzufügen
            </Button>
          ) : (
            <Button
              onClick={() => handleSubmit(false)}
              disabled={!selectedKontakt || loading}
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Hinzufügen
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
