"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Bell,
  AlertTriangle,
  Mail,
  Info,
  RotateCcw,
  Clock,
  ExternalLink,
} from "lucide-react";

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Benachrichtigungen settings tab (stub per locked decision: admin-managed only).
 * Contains toggle stubs for frist notifications, escalation link, and email notice.
 * Actions logged in Audit-Trail on any toggle.
 */
export function BenachrichtigungenTab() {
  const [fristBenachrichtigungenAktiv, setFristBenachrichtigungenAktiv] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Toggle with audit logging via settings API
  const handleToggleFristBenachrichtigungen = async () => {
    const newValue = !fristBenachrichtigungenAktiv;
    setFristBenachrichtigungenAktiv(newValue);
    try {
      await fetch("/api/einstellungen/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemSettings: [
            {
              key: "benachrichtigungen_frist_aktiv",
              value: String(newValue),
              type: "boolean",
              category: "benachrichtigungen",
              label: "Frist-Benachrichtigungen",
            },
          ],
        }),
      });
      toast.success("Gespeichert", { duration: 1500 });
    } catch {
      toast.error("Fehler beim Speichern");
      setFristBenachrichtigungenAktiv(!newValue);
    }
  };

  // Reset
  const handleReset = async () => {
    setShowResetConfirm(false);
    setFristBenachrichtigungenAktiv(true);
    try {
      await fetch("/api/einstellungen/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemSettings: [
            {
              key: "benachrichtigungen_frist_aktiv",
              value: "true",
              type: "boolean",
              category: "benachrichtigungen",
              label: "Frist-Benachrichtigungen",
            },
          ],
        }),
      });
      toast.success("Benachrichtigungs-Einstellungen zurueckgesetzt");
    } catch {
      toast.error("Fehler beim Zuruecksetzen");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header info */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-heading text-foreground">
            Benachrichtigungseinstellungen (Admin)
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Hier koennen Benachrichtigungseinstellungen fuer Fristen und
          Wiedervorlagen konfiguriert werden.
        </p>
      </div>

      {/* Admin-only notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800 dark:text-blue-200">
          Benutzer koennen ihre eigenen Benachrichtigungseinstellungen nicht
          aendern, um sicherzustellen, dass keine kritischen
          Fristbenachrichtigungen deaktiviert werden.
        </p>
      </div>

      {/* Frist notifications toggle */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-500" />
            <div>
              <h4 className="text-sm font-medium text-foreground">
                Frist-Vorfristen Benachrichtigungen
              </h4>
              <p className="text-xs text-muted-foreground">
                Automatische Erinnerungen vor Fristablauf
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleFristBenachrichtigungen}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              fristBenachrichtigungenAktiv
                ? "bg-primary"
                : "bg-slate-200 dark:bg-slate-700"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                fristBenachrichtigungenAktiv ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Escalation link */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <div>
              <h4 className="text-sm font-medium text-foreground">Eskalation</h4>
              <p className="text-xs text-muted-foreground">
                Eskalationseinstellungen befinden sich im Fristen-Tab
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1 text-xs text-primary cursor-default">
            <ExternalLink className="w-3 h-3" />
            Fristen-Tab
          </span>
        </div>
      </div>

      {/* Email notifications (Phase 3 stub) */}
      <div className="glass rounded-xl p-6 opacity-60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-slate-400" />
            <div>
              <h4 className="text-sm font-medium text-foreground">
                E-Mail-Benachrichtigungen
              </h4>
              <p className="text-xs text-muted-foreground">
                Verfuegbar nach Einrichtung des E-Mail-Systems (Phase 3)
              </p>
            </div>
          </div>
          <button
            disabled
            className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-200 dark:bg-slate-700 cursor-not-allowed"
          >
            <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
          </button>
        </div>
      </div>

      {/* Reset button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => setShowResetConfirm(true)}
          className="text-muted-foreground"
        >
          <RotateCcw className="w-4 h-4 mr-1.5" />
          Auf Standard zuruecksetzen
        </Button>
      </div>

      {/* Reset confirmation dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="glass rounded-xl p-6 w-full max-w-md mx-4 space-y-4">
            <h3 className="text-lg font-heading text-foreground">
              Einstellungen zuruecksetzen?
            </h3>
            <p className="text-sm text-muted-foreground">
              Moechten Sie die Einstellungen in diesem Bereich auf die Standardwerte
              zuruecksetzen? Diese Aktion kann nicht rueckgaengig gemacht werden.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowResetConfirm(false)}
              >
                Abbrechen
              </Button>
              <Button variant="destructive" onClick={handleReset}>
                Zuruecksetzen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
