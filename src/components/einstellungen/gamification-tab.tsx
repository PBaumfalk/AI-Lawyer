"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/**
 * Admin-only Gamification settings tab for the Einstellungen page.
 *
 * Allows configuring:
 * - Boss spawn threshold (number of open WV before boss appears)
 * - Cooldown after victory (hours before next boss can spawn)
 */
export function GamificationTab() {
  const [threshold, setThreshold] = useState(30);
  const [cooldownHours, setCooldownHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch current config on mount
  useEffect(() => {
    async function fetchConfig() {
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
    fetchConfig();
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

  if (loading) {
    return (
      <GlassCard className="p-6">
        <p className="text-sm text-muted-foreground">Lade Konfiguration...</p>
      </GlassCard>
    );
  }

  return (
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
  );
}
