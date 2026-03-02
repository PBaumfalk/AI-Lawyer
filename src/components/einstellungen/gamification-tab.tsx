"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format, isPast } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";

import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SpecialQuestForm } from "./special-quest-form";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SpecialQuest {
  id: string;
  name: string;
  beschreibung: string | null;
  xpBelohnung: number;
  runenBelohnung: number;
  startDatum: string;
  endDatum: string;
  klasse: string | null;
  aktiv: boolean;
  bedingung: { model?: string; count?: number };
}

interface ConditionTemplate {
  id: string;
  label: string;
  description: string;
}

/**
 * Admin-only Gamification settings tab for the Einstellungen page.
 *
 * Allows configuring:
 * - Boss spawn threshold (number of open WV before boss appears)
 * - Cooldown after victory (hours before next boss can spawn)
 * - Special Quest management (create, edit, delete time-limited campaigns)
 */
export function GamificationTab() {
  // ─── Bossfight config state ─────────────────────────────────────────────
  const [threshold, setThreshold] = useState(30);
  const [cooldownHours, setCooldownHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ─── Special Quest state ────────────────────────────────────────────────
  const [specialQuests, setSpecialQuests] = useState<SpecialQuest[]>([]);
  const [templates, setTemplates] = useState<ConditionTemplate[]>([]);
  const [specialLoading, setSpecialLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingQuest, setEditingQuest] = useState<SpecialQuest | null>(null);

  // ─── Fetch functions ────────────────────────────────────────────────────

  async function fetchBossConfig() {
    try {
      const res = await fetch("/api/gamification/bossfight/admin");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setThreshold(data.threshold ?? 30);
      setCooldownHours(data.cooldownHours ?? 24);
    } catch {
      toast.error("Bossfight-Konfiguration konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }

  async function fetchSpecialQuests() {
    try {
      const res = await fetch("/api/gamification/special-quests");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setSpecialQuests(data.quests ?? []);
      setTemplates(data.templates ?? []);
    } catch {
      toast.error("Special Quests konnten nicht geladen werden");
    } finally {
      setSpecialLoading(false);
    }
  }

  // Fetch both on mount
  useEffect(() => {
    fetchBossConfig();
    fetchSpecialQuests();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/gamification/bossfight/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threshold, cooldownHours }),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Bossfight-Konfiguration gespeichert");
    } catch {
      toast.error("Konfiguration konnte nicht gespeichert werden");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteQuest(id: string, name: string) {
    if (!window.confirm(`"${name}" wirklich loeschen? Alle Fortschritte gehen verloren.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/gamification/special-quests/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Special Quest geloescht");
      fetchSpecialQuests();
    } catch {
      toast.error("Loeschen fehlgeschlagen");
    }
  }

  if (loading) {
    return (
      <GlassCard className="p-6">
        <p className="text-sm text-muted-foreground">Lade Konfiguration...</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Bossfight Configuration ─────────────────────────────────────── */}
      <GlassCard className="p-6">
        <h2 className="text-base font-semibold text-foreground mb-1">
          Bossfight-Konfiguration
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Der Boss erscheint automatisch, wenn die offenen Wiedervorlagen den
          Schwellenwert ueberschreiten.
        </p>

        <div className="space-y-5 max-w-md">
          {/* Threshold */}
          <div className="space-y-2">
            <Label htmlFor="boss-threshold">
              Schwellenwert (offene WV)
            </Label>
            <Input
              id="boss-threshold"
              type="number"
              min={5}
              max={200}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Ein Boss erscheint, wenn die Anzahl offener Wiedervorlagen diesen
              Wert erreicht (min. 5, max. 200).
            </p>
          </div>

          {/* Cooldown */}
          <div className="space-y-2">
            <Label htmlFor="boss-cooldown">
              Abklingzeit nach Sieg (Stunden)
            </Label>
            <Input
              id="boss-cooldown"
              type="number"
              min={1}
              max={168}
              value={cooldownHours}
              onChange={(e) => setCooldownHours(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Wartezeit nach einem Bosssieg, bevor ein neuer Boss erscheinen kann
              (min. 1h, max. 168h / 1 Woche).
            </p>
          </div>

          {/* Save button */}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Speichern..." : "Speichern"}
          </Button>
        </div>
      </GlassCard>

      {/* ─── Special Quest Management ────────────────────────────────────── */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Special Quests
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Zeitlich begrenzte Kampagnen fuer das gesamte Team
            </p>
          </div>
          {!showForm && (
            <Button
              size="sm"
              onClick={() => {
                setEditingQuest(null);
                setShowForm(true);
              }}
            >
              Neue Special Quest
            </Button>
          )}
        </div>

        {showForm ? (
          <SpecialQuestForm
            quest={editingQuest}
            templates={templates}
            onSave={() => {
              setShowForm(false);
              setEditingQuest(null);
              fetchSpecialQuests();
            }}
            onCancel={() => {
              setShowForm(false);
              setEditingQuest(null);
            }}
          />
        ) : (
          <div className="space-y-2">
            {specialQuests.map((quest) => {
              const expired = quest.endDatum
                ? isPast(new Date(quest.endDatum))
                : false;

              return (
                <div
                  key={quest.id}
                  className={`flex items-center gap-4 px-4 py-3 rounded-lg bg-white/20 dark:bg-white/[0.03] ${
                    expired ? "opacity-60" : ""
                  }`}
                >
                  {/* Quest info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {quest.name}
                      </span>
                      {expired && (
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                          Abgelaufen
                        </span>
                      )}
                      {!expired && quest.aktiv && (
                        <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          Aktiv
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {quest.startDatum
                        ? format(new Date(quest.startDatum), "dd.MM")
                        : "?"}{" "}
                      -{" "}
                      {quest.endDatum
                        ? format(new Date(quest.endDatum), "dd.MM.yyyy")
                        : "?"}
                      <span className="mx-2">|</span>
                      {quest.xpBelohnung} XP
                      {quest.runenBelohnung > 0 &&
                        ` + ${quest.runenBelohnung} Runen`}
                      {quest.klasse && (
                        <>
                          <span className="mx-2">|</span>
                          {quest.klasse}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        setEditingQuest(quest);
                        setShowForm(true);
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteQuest(quest.id, quest.name)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {specialQuests.length === 0 && !specialLoading && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Keine Special Quests vorhanden
              </p>
            )}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
