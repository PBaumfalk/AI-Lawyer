"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileText,
  FolderOpen,
  Edit3,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  Check,
  Search,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface VorlageItem {
  id: string;
  name: string;
  beschreibung: string | null;
  kategorie: string;
  platzhalter: string[];
  customFelder: CustomFeld[] | null;
  freigegeben: boolean;
}

interface CustomFeld {
  key: string;
  label: string;
  typ: "TEXT" | "NUMBER" | "DATE" | "DROPDOWN";
  optionen?: string[];
}

interface AkteOption {
  id: string;
  aktenzeichen: string;
  kurzrubrum: string;
  mandant?: string;
}

interface BriefkopfOption {
  id: string;
  name: string;
  istStandard: boolean;
}

interface VorlagenWizardProps {
  vorlageId: string | null;
  vorlagen: VorlageItem[];
  onClose: () => void;
  onGenerated: () => void;
}

const STEPS = [
  { label: "Vorlage", icon: FileText },
  { label: "Akte / Mandant", icon: FolderOpen },
  { label: "Felder", icon: Edit3 },
  { label: "Vorschau", icon: Eye },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function VorlagenWizard({
  vorlageId: initialVorlageId,
  vorlagen,
  onClose,
  onGenerated,
}: VorlagenWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(initialVorlageId ? 1 : 0);
  const [selectedVorlageId, setSelectedVorlageId] = useState<string | null>(initialVorlageId);
  const [searchAkte, setSearchAkte] = useState("");
  const [akten, setAkten] = useState<AkteOption[]>([]);
  const [selectedAkteId, setSelectedAkteId] = useState<string | null>(null);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState("");
  const [openInEditor, setOpenInEditor] = useState(true);
  const [briefkoepfe, setBriefkoepfe] = useState<BriefkopfOption[]>([]);
  const [selectedBriefkopfId, setSelectedBriefkopfId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loadingAkten, setLoadingAkten] = useState(false);

  const selectedVorlage = vorlagen.find((v) => v.id === selectedVorlageId);
  const customFelder: CustomFeld[] = selectedVorlage?.customFelder
    ? (Array.isArray(selectedVorlage.customFelder) ? selectedVorlage.customFelder : [])
    : [];

  // Fetch Akten for step 2
  const fetchAkten = useCallback(async () => {
    setLoadingAkten(true);
    try {
      const params = new URLSearchParams();
      if (searchAkte) params.set("q", searchAkte);
      params.set("limit", "20");
      const res = await fetch(`/api/akten?${params}`);
      if (!res.ok) throw new Error("Fehler");
      const data = await res.json();
      const items = (data.akten ?? data).map((a: any) => ({
        id: a.id,
        aktenzeichen: a.aktenzeichen,
        kurzrubrum: a.kurzrubrum,
        mandant: a.beteiligte?.find((b: any) => b.rolle === "MANDANT")?.kontakt?.nachname,
      }));
      setAkten(items);
    } catch {
      toast.error("Akten konnten nicht geladen werden");
    } finally {
      setLoadingAkten(false);
    }
  }, [searchAkte]);

  // Fetch Briefkoepfe for step 4
  const fetchBriefkoepfe = useCallback(async () => {
    try {
      const res = await fetch("/api/briefkopf");
      if (!res.ok) return;
      const data = await res.json();
      const items = data.briefkoepfe ?? [];
      setBriefkoepfe(items);
      // Select default
      const def = items.find((b: BriefkopfOption) => b.istStandard);
      if (def) setSelectedBriefkopfId(def.id);
      else if (items.length > 0) setSelectedBriefkopfId(items[0].id);
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    if (step === 1) fetchAkten();
    if (step === 3) {
      fetchBriefkoepfe();
      // Generate default filename
      if (selectedVorlage && selectedAkteId) {
        const akte = akten.find((a) => a.id === selectedAkteId);
        const date = new Date().toISOString().split("T")[0];
        setFileName(
          `${akte?.aktenzeichen ?? "Akte"}_${selectedVorlage.kategorie}_${akte?.mandant ?? "Mandant"}_${date}.docx`
        );
      }
    }
  }, [step, fetchAkten, fetchBriefkoepfe, selectedVorlage, selectedAkteId, akten]);

  // Generate document
  const handleGenerate = async () => {
    if (!selectedVorlageId || !selectedAkteId) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/vorlagen/${selectedVorlageId}/generieren`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          akteId: selectedAkteId,
          customFelder: customValues,
          dateiname: fileName || undefined,
          briefkopfId: selectedBriefkopfId || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Generierung fehlgeschlagen");
      }
      const data = await res.json();
      onGenerated();
      if (openInEditor && data.dokumentId) {
        router.push(`/akten/${selectedAkteId}/dokumente/${data.dokumentId}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Fehler bei der Dokumentgenerierung");
    } finally {
      setGenerating(false);
    }
  };

  // Navigation
  const canNext = () => {
    if (step === 0) return !!selectedVorlageId;
    if (step === 1) return !!selectedAkteId;
    if (step === 2) return true; // Custom fields are optional
    if (step === 3) return true;
    return false;
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else handleGenerate();
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 w-full max-w-2xl bg-background border-l shadow-2xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-heading text-foreground">
            Dokument aus Vorlage erstellen
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-4 py-3 border-b bg-muted/30">
          {STEPS.map((s, i) => {
            const StepIcon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <div key={i} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 mx-1" />
                )}
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isDone
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "text-muted-foreground"
                  }`}
                >
                  {isDone ? <Check className="w-3 h-3" /> : <StepIcon className="w-3 h-3" />}
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Step 0: Select template */}
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Waehlen Sie eine Vorlage als Grundlage fuer das neue Dokument.
              </p>
              <div className="space-y-2">
                {vorlagen.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVorlageId(v.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedVorlageId === v.id
                        ? "border-primary bg-primary/5"
                        : "border-transparent hover:bg-muted/50"
                    }`}
                  >
                    <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{v.name}</p>
                      {v.beschreibung && (
                        <p className="text-xs text-muted-foreground truncate">{v.beschreibung}</p>
                      )}
                    </div>
                    {selectedVorlageId === v.id && (
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Select Akte/Mandant */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Waehlen Sie die Akte, fuer die das Dokument generiert werden soll.
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Akte suchen (Aktenzeichen, Kurzrubrum)..."
                  value={searchAkte}
                  onChange={(e) => setSearchAkte(e.target.value)}
                  className="pl-9"
                />
              </div>
              {loadingAkten ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {akten.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => setSelectedAkteId(a.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedAkteId === a.id
                          ? "border-primary bg-primary/5"
                          : "border-transparent hover:bg-muted/50"
                      }`}
                    >
                      <FolderOpen className="w-5 h-5 text-amber-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{a.aktenzeichen}</p>
                        <p className="text-xs text-muted-foreground truncate">{a.kurzrubrum}</p>
                      </div>
                      {a.mandant && (
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {a.mandant}
                        </span>
                      )}
                      {selectedAkteId === a.id && (
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      )}
                    </div>
                  ))}
                  {akten.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Keine Akten gefunden.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Custom fields */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {customFelder.length > 0
                  ? "Fueleln Sie die zusaetzlichen Felder fuer diese Vorlage aus."
                  : "Diese Vorlage hat keine zusaetzlichen Felder. Sie koennen direkt fortfahren."}
              </p>
              {customFelder.map((feld) => (
                <div key={feld.key} className="space-y-1.5">
                  <Label htmlFor={`field-${feld.key}`}>{feld.label}</Label>
                  {feld.typ === "TEXT" && (
                    <Input
                      id={`field-${feld.key}`}
                      value={customValues[feld.key] ?? ""}
                      onChange={(e) =>
                        setCustomValues((prev) => ({ ...prev, [feld.key]: e.target.value }))
                      }
                      placeholder={`${feld.label} eingeben...`}
                    />
                  )}
                  {feld.typ === "NUMBER" && (
                    <Input
                      id={`field-${feld.key}`}
                      type="number"
                      value={customValues[feld.key] ?? ""}
                      onChange={(e) =>
                        setCustomValues((prev) => ({ ...prev, [feld.key]: e.target.value }))
                      }
                      placeholder="0"
                    />
                  )}
                  {feld.typ === "DATE" && (
                    <Input
                      id={`field-${feld.key}`}
                      type="date"
                      value={customValues[feld.key] ?? ""}
                      onChange={(e) =>
                        setCustomValues((prev) => ({ ...prev, [feld.key]: e.target.value }))
                      }
                    />
                  )}
                  {feld.typ === "DROPDOWN" && (
                    <select
                      id={`field-${feld.key}`}
                      value={customValues[feld.key] ?? ""}
                      onChange={(e) =>
                        setCustomValues((prev) => ({ ...prev, [feld.key]: e.target.value }))
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Bitte auswaehlen...</option>
                      {feld.optionen?.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Step 3: Preview + Confirm */}
          {step === 3 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Pruefen Sie die Details und generieren Sie das Dokument.
              </p>

              {/* Summary */}
              <div className="glass rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Vorlage</span>
                  <span className="font-medium">{selectedVorlage?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Akte</span>
                  <span className="font-medium">
                    {akten.find((a) => a.id === selectedAkteId)?.aktenzeichen ?? "-"}
                  </span>
                </div>
                {Object.keys(customValues).length > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Zusatzfelder:</span>
                    <div className="mt-1 space-y-1">
                      {Object.entries(customValues).map(([key, val]) => {
                        const feld = customFelder.find((f) => f.key === key);
                        return val ? (
                          <div key={key} className="flex justify-between pl-2">
                            <span className="text-muted-foreground text-xs">{feld?.label ?? key}</span>
                            <span className="text-xs font-medium">{val}</span>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Filename */}
              <div className="space-y-1.5">
                <Label htmlFor="dateiname">Dateiname</Label>
                <Input
                  id="dateiname"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="dokument.docx"
                />
              </div>

              {/* Briefkopf selection */}
              {briefkoepfe.length > 1 && (
                <div className="space-y-1.5">
                  <Label htmlFor="briefkopf">Briefkopf</Label>
                  <select
                    id="briefkopf"
                    value={selectedBriefkopfId ?? ""}
                    onChange={(e) => setSelectedBriefkopfId(e.target.value || null)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Kein Briefkopf</option>
                    {briefkoepfe.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.istStandard ? "(Standard)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {briefkoepfe.length === 1 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Briefkopf</span>
                  <span className="font-medium">{briefkoepfe[0].name}</span>
                </div>
              )}

              {/* Open in editor checkbox */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={openInEditor}
                  onChange={(e) => setOpenInEditor(e.target.checked)}
                  className="rounded border-input"
                />
                <span className="text-sm text-foreground">In OnlyOffice oeffnen</span>
              </label>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between p-4 border-t">
          <Button
            variant="outline"
            onClick={() => (step > 0 ? setStep(step - 1) : onClose())}
            disabled={generating}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            {step > 0 ? "Zurueck" : "Abbrechen"}
          </Button>
          <Button onClick={handleNext} disabled={!canNext() || generating}>
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Generiere...
              </>
            ) : step === 3 ? (
              <>
                <Check className="w-4 h-4 mr-1.5" />
                Dokument erstellen
              </>
            ) : (
              <>
                Weiter
                <ChevronRight className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
