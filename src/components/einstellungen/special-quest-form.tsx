"use client";

import { useState } from "react";
import { toast } from "sonner";

import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ConditionTemplate {
  id: string;
  label: string;
  description: string;
}

interface ExistingQuest {
  id: string;
  name: string;
  beschreibung: string | null;
  xpBelohnung: number;
  runenBelohnung: number;
  startDatum: string;
  endDatum: string;
  klasse: string | null;
  bedingung: { model?: string; count?: number };
}

interface SpecialQuestFormProps {
  quest?: ExistingQuest | null;
  templates: ConditionTemplate[];
  onSave: () => void;
  onCancel: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Format ISO date string to YYYY-MM-DD for input[type=date] */
function toDateInput(dateStr: string | undefined | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toISOString().split("T")[0];
}

/** Guess template ID from existing quest condition model */
function guessTemplateId(
  bedingung: { model?: string } | undefined,
  templates: ConditionTemplate[],
): string {
  if (!bedingung?.model) return templates[0]?.id ?? "";
  const modelMap: Record<string, string> = {
    KalenderEintrag: "fristen-erledigen",
    Ticket: "tickets-bearbeiten",
    Rechnung: "rechnungen-erstellen",
    AktenActivity: "akten-aktualisieren",
  };
  return modelMap[bedingung.model] ?? templates[0]?.id ?? "";
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * SpecialQuestForm -- Create or edit a Special Quest.
 *
 * Uses preset condition templates so the admin never needs to write raw JSON.
 * In edit mode, pre-fills fields from the existing quest.
 */
export function SpecialQuestForm({
  quest,
  templates,
  onSave,
  onCancel,
}: SpecialQuestFormProps) {
  const isEdit = !!quest;

  const [name, setName] = useState(quest?.name ?? "");
  const [beschreibung, setBeschreibung] = useState(
    quest?.beschreibung ?? "",
  );
  const [templateId, setTemplateId] = useState(
    isEdit ? guessTemplateId(quest?.bedingung, templates) : templates[0]?.id ?? "",
  );
  const [count, setCount] = useState(quest?.bedingung?.count ?? 10);
  const [xpBelohnung, setXpBelohnung] = useState(quest?.xpBelohnung ?? 50);
  const [runenBelohnung, setRunenBelohnung] = useState(
    quest?.runenBelohnung ?? 10,
  );
  const [startDatum, setStartDatum] = useState(
    toDateInput(quest?.startDatum),
  );
  const [endDatum, setEndDatum] = useState(toDateInput(quest?.endDatum));
  const [targetKlasse, setTargetKlasse] = useState(
    quest?.klasse ?? "ALL",
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim() || !templateId || !count || !startDatum || !endDatum) {
      toast.error("Bitte alle Pflichtfelder ausfuellen");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: name.trim(),
        beschreibung: beschreibung.trim() || null,
        templateId,
        count: Number(count),
        xpBelohnung: Number(xpBelohnung),
        runenBelohnung: Number(runenBelohnung),
        startDatum,
        endDatum,
        targetKlasse,
      };

      const url = isEdit
        ? `/api/gamification/special-quests/${quest.id}`
        : "/api/gamification/special-quests";

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Speichern fehlgeschlagen");
      }

      toast.success(
        isEdit
          ? "Special Quest aktualisiert"
          : "Special Quest erstellt",
      );
      onSave();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Speichern fehlgeschlagen",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <GlassCard className="p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">
        {isEdit ? "Special Quest bearbeiten" : "Neue Special Quest erstellen"}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="sq-name">Name *</Label>
          <Input
            id="sq-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Fruehlings-Sprint"
            required
          />
        </div>

        {/* Beschreibung */}
        <div className="space-y-1.5">
          <Label htmlFor="sq-desc">Beschreibung</Label>
          <Input
            id="sq-desc"
            value={beschreibung}
            onChange={(e) => setBeschreibung(e.target.value)}
            placeholder="Optionale Beschreibung der Kampagne"
          />
        </div>

        {/* Vorlage (template selection) */}
        <div className="space-y-1.5">
          <Label htmlFor="sq-template">Vorlage *</Label>
          <Select
            id="sq-template"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            required
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label} -- {t.description}
              </option>
            ))}
          </Select>
        </div>

        {/* Zielanzahl (target count) */}
        <div className="space-y-1.5">
          <Label htmlFor="sq-count">Zielanzahl *</Label>
          <Input
            id="sq-count"
            type="number"
            min={1}
            max={1000}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            required
          />
          <p className="text-xs text-muted-foreground">
            Wie viele Aktionen muessen im Zeitraum abgeschlossen werden?
          </p>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="sq-start">Startdatum *</Label>
            <Input
              id="sq-start"
              type="date"
              value={startDatum}
              onChange={(e) => setStartDatum(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sq-end">Enddatum *</Label>
            <Input
              id="sq-end"
              type="date"
              value={endDatum}
              onChange={(e) => setEndDatum(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Rewards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="sq-xp">XP-Belohnung</Label>
            <Input
              id="sq-xp"
              type="number"
              min={0}
              max={5000}
              value={xpBelohnung}
              onChange={(e) => setXpBelohnung(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sq-runen">Runen-Belohnung</Label>
            <Input
              id="sq-runen"
              type="number"
              min={0}
              max={500}
              value={runenBelohnung}
              onChange={(e) => setRunenBelohnung(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Target class */}
        <div className="space-y-1.5">
          <Label htmlFor="sq-klasse">Zielklasse</Label>
          <Select
            id="sq-klasse"
            value={targetKlasse}
            onChange={(e) => setTargetKlasse(e.target.value)}
          >
            <option value="ALL">Alle Klassen</option>
            <option value="JURIST">Jurist</option>
            <option value="SCHREIBER">Schreiber</option>
            <option value="WAECHTER">Waechter</option>
            <option value="QUARTIERMEISTER">Quartiermeister</option>
          </Select>
          <p className="text-xs text-muted-foreground">
            Nur Spieler dieser Klasse sehen die Quest. &quot;Alle Klassen&quot; gilt fuer
            alle.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={saving}>
            {saving
              ? "Speichern..."
              : isEdit
                ? "Aktualisieren"
                : "Erstellen"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
        </div>
      </form>
    </GlassCard>
  );
}
