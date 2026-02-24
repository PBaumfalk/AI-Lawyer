"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2,
  FileText,
  MapPin,
  Clock,
  FolderTree,
  Users,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
} from "lucide-react";

interface OnboardingWizardProps {
  /** Called when the wizard is completed or dismissed */
  onComplete: () => void;
}

const STEPS = [
  { id: 1, label: "Kanzleidaten", icon: Building2 },
  { id: 2, label: "Briefkopf", icon: FileText },
  { id: 3, label: "Bundesland", icon: MapPin },
  { id: 4, label: "Vorfristen", icon: Clock },
  { id: 5, label: "Ordner-Schema", icon: FolderTree },
  { id: 6, label: "Benutzer", icon: Users },
];

const BUNDESLAENDER = [
  { code: "BW", name: "Baden-Wuerttemberg" },
  { code: "BY", name: "Bayern" },
  { code: "BE", name: "Berlin" },
  { code: "BB", name: "Brandenburg" },
  { code: "HB", name: "Bremen" },
  { code: "HH", name: "Hamburg" },
  { code: "HE", name: "Hessen" },
  { code: "MV", name: "Mecklenburg-Vorpommern" },
  { code: "NI", name: "Niedersachsen" },
  { code: "NW", name: "Nordrhein-Westfalen" },
  { code: "RP", name: "Rheinland-Pfalz" },
  { code: "SL", name: "Saarland" },
  { code: "SN", name: "Sachsen" },
  { code: "ST", name: "Sachsen-Anhalt" },
  { code: "SH", name: "Schleswig-Holstein" },
  { code: "TH", name: "Thueringen" },
];

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1: Kanzleidaten
  const [kanzleiName, setKanzleiName] = useState("");
  const [kanzleiAdresse, setKanzleiAdresse] = useState("");
  const [kanzleiTelefon, setKanzleiTelefon] = useState("");
  const [kanzleiEmail, setKanzleiEmail] = useState("");

  // Step 2: Briefkopf (simplified)
  const [briefkopfName, setBriefkopfName] = useState("");

  // Step 3: Bundesland
  const [bundesland, setBundesland] = useState("NW");

  // Step 4: Vorfristen
  const [vorfrist1, setVorfrist1] = useState("7");
  const [vorfrist2, setVorfrist2] = useState("3");
  const [vorfrist3, setVorfrist3] = useState("1");

  // Step 5: Ordner-Schema
  const [ordnerSchema, setOrdnerSchema] = useState("standard");

  // Step 6: Users are just displayed
  const [users, setUsers] = useState<{ id: string; name: string; role: string }[]>([]);

  useEffect(() => {
    // Load existing users for step 6
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => setUsers(data))
      .catch(() => {});
  }, []);

  const saveSetting = async (key: string, value: string, type = "string", category = "general", label = "") => {
    try {
      // Use generic settings endpoint or direct API
      await fetch("/api/einstellungen/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: "1.0",
          systemSettings: [{ key, value, type, category, label }],
        }),
      });
    } catch {
      // Non-critical: settings can be configured later
    }
  };

  const completeWizard = async () => {
    setSaving(true);
    try {
      // Save all settings
      await saveSetting("kanzlei.name", kanzleiName, "string", "kanzlei", "Kanzleiname");
      await saveSetting("kanzlei.adresse", kanzleiAdresse, "string", "kanzlei", "Adresse");
      await saveSetting("kanzlei.telefon", kanzleiTelefon, "string", "kanzlei", "Telefon");
      await saveSetting("kanzlei.email", kanzleiEmail, "string", "kanzlei", "E-Mail");
      await saveSetting("fristen.bundesland", bundesland, "string", "fristen", "Standard-Bundesland");
      await saveSetting(
        "fristen.default_vorfristen",
        JSON.stringify([parseInt(vorfrist1), parseInt(vorfrist2), parseInt(vorfrist3)]),
        "json",
        "fristen",
        "Standard-Vorfristen (Tage)"
      );
      await saveSetting("onboarding_completed", "true", "boolean", "system", "Onboarding abgeschlossen");

      toast.success("Einrichtung abgeschlossen");
      onComplete();
    } catch {
      toast.error("Fehler beim Speichern der Einstellungen");
    } finally {
      setSaving(false);
    }
  };

  const dismissWizard = async () => {
    await saveSetting("onboarding_completed", "true", "boolean", "system", "Onboarding abgeschlossen");
    onComplete();
  };

  const skipStep = () => {
    if (step < 6) setStep(step + 1);
    else completeWizard();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass rounded-2xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 dark:border-white/[0.06]">
          <div>
            <h2 className="text-xl font-heading text-foreground">
              Kanzlei einrichten
            </h2>
            <p className="text-sm text-muted-foreground">
              Schritt {step} von {STEPS.length}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={dismissWizard}>
            <X className="w-4 h-4 mr-1" />
            Spaeter einrichten
          </Button>
        </div>

        {/* Progress */}
        <div className="px-6 py-3 flex gap-1">
          {STEPS.map((s) => (
            <div
              key={s.id}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s.id <= step
                  ? "bg-blue-500"
                  : "bg-muted/30"
              }`}
            />
          ))}
        </div>

        {/* Step labels */}
        <div className="px-6 py-2 flex gap-4 overflow-x-auto">
          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => s.id <= step && setStep(s.id)}
                className={`flex items-center gap-1.5 text-xs whitespace-nowrap transition-colors ${
                  s.id === step
                    ? "text-blue-500 font-medium"
                    : s.id < step
                      ? "text-foreground/70 cursor-pointer"
                      : "text-muted-foreground/40"
                }`}
              >
                {s.id < step ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="px-6 py-6 min-h-[280px]">
          {/* Step 1: Kanzleidaten */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Geben Sie die grundlegenden Kanzleidaten ein. Diese werden fuer
                Briefkoepfe und Dokumente verwendet.
              </p>
              <div>
                <label className="text-sm font-medium block mb-1">
                  Kanzleiname *
                </label>
                <Input
                  value={kanzleiName}
                  onChange={(e) => setKanzleiName(e.target.value)}
                  placeholder="Rechtsanwaelte Muster & Partner"
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">
                  Adresse
                </label>
                <Input
                  value={kanzleiAdresse}
                  onChange={(e) => setKanzleiAdresse(e.target.value)}
                  placeholder="Musterstrasse 1, 50667 Koeln"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1">
                    Telefon
                  </label>
                  <Input
                    value={kanzleiTelefon}
                    onChange={(e) => setKanzleiTelefon(e.target.value)}
                    placeholder="+49 221 12345"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">
                    E-Mail
                  </label>
                  <Input
                    value={kanzleiEmail}
                    onChange={(e) => setKanzleiEmail(e.target.value)}
                    placeholder="info@kanzlei.de"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Briefkopf */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Richten Sie einen Standard-Briefkopf ein. Logo und Dateien
                koennen spaeter in den Einstellungen hochgeladen werden.
              </p>
              <div>
                <label className="text-sm font-medium block mb-1">
                  Briefkopf-Name
                </label>
                <Input
                  value={briefkopfName}
                  onChange={(e) => setBriefkopfName(e.target.value)}
                  placeholder="Standard-Briefkopf"
                />
              </div>
              <div className="p-4 rounded-lg bg-muted/20 text-sm text-muted-foreground">
                <FileText className="w-5 h-5 mb-2 text-muted-foreground/60" />
                Logo-Upload und detaillierte Briefkopf-Konfiguration sind
                spaeter unter Einstellungen verfuegbar.
              </div>
            </div>
          )}

          {/* Step 3: Bundesland */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Waehlen Sie das Standard-Bundesland fuer die Fristenberechnung.
                Feiertage werden automatisch beruecksichtigt.
              </p>
              <div>
                <label className="text-sm font-medium block mb-1">
                  Standard-Bundesland
                </label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={bundesland}
                  onChange={(e) => setBundesland(e.target.value)}
                >
                  {BUNDESLAENDER.map((bl) => (
                    <option key={bl.code} value={bl.code}>
                      {bl.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Step 4: Vorfristen */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Legen Sie die Standard-Vorfristen fest. Bei jeder neuen Frist
                werden automatisch Erinnerungen zu diesen Zeitpunkten erstellt.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1">
                    Vorfrist 1 (Tage)
                  </label>
                  <Input
                    type="number"
                    value={vorfrist1}
                    onChange={(e) => setVorfrist1(e.target.value)}
                    min={1}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">
                    Vorfrist 2 (Tage)
                  </label>
                  <Input
                    type="number"
                    value={vorfrist2}
                    onChange={(e) => setVorfrist2(e.target.value)}
                    min={1}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">
                    Vorfrist 3 (Tage)
                  </label>
                  <Input
                    type="number"
                    value={vorfrist3}
                    onChange={(e) => setVorfrist3(e.target.value)}
                    min={1}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Empfehlung: 7, 3 und 1 Tag vor Fristablauf
              </p>
            </div>
          )}

          {/* Step 5: Ordner-Schema */}
          {step === 5 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Waehlen Sie ein Standard-Ordnerschema fuer neue Akten. Dieses
                legt die automatisch erstellte Ordnerstruktur fest.
              </p>
              <div className="space-y-2">
                {[
                  {
                    id: "standard",
                    name: "Standard",
                    desc: "Schriftverkehr, Mandant, Gegner, Gericht, Rechnungen",
                  },
                  {
                    id: "erweitert",
                    name: "Erweitert",
                    desc: "Wie Standard + Beweismittel, Gutachten, Notizen",
                  },
                  {
                    id: "minimal",
                    name: "Minimal",
                    desc: "Schriftverkehr, Rechnungen",
                  },
                ].map((schema) => (
                  <label
                    key={schema.id}
                    className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      ordnerSchema === schema.id
                        ? "bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30"
                        : "bg-muted/10 border border-transparent hover:bg-muted/20"
                    }`}
                  >
                    <input
                      type="radio"
                      name="ordnerSchema"
                      value={schema.id}
                      checked={ordnerSchema === schema.id}
                      onChange={(e) => setOrdnerSchema(e.target.value)}
                      className="mt-1"
                    />
                    <div>
                      <span className="text-sm font-medium">{schema.name}</span>
                      <p className="text-xs text-muted-foreground">
                        {schema.desc}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 6: Benutzer */}
          {step === 6 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Uebersicht der vorhandenen Benutzer. Weitere Benutzer koennen
                spaeter in der Benutzerverwaltung hinzugefuegt werden.
              </p>
              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Noch keine Benutzer vorhanden.
                </p>
              ) : (
                <div className="space-y-2">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/10"
                    >
                      <span className="text-sm font-medium">{u.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {u.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 text-sm text-muted-foreground">
                Weitere Benutzer koennen spaeter unter Einstellungen &gt;
                Benutzerverwaltung hinzugefuegt werden.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 dark:border-white/[0.06]">
          <div>
            {step > 1 && (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Zurueck
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={skipStep}>
              Ueberspringen
            </Button>
            {step < 6 ? (
              <Button onClick={() => setStep(step + 1)}>
                Weiter
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={completeWizard} disabled={saving}>
                {saving ? "Speichere..." : "Einrichtung abschliessen"}
                <Check className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
