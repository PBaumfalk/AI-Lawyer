"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Save,
  Upload,
  FileText,
  Eye,
  Edit3,
  Star,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface BriefkopfData {
  id?: string;
  name: string;
  kanzleiName: string;
  adresse: string;
  telefon: string;
  fax: string;
  email: string;
  website: string;
  steuernr: string;
  ustIdNr: string;
  iban: string;
  bic: string;
  bankName: string;
  braoInfo: string;
  logoUrl: string | null;
  istStandard: boolean;
}

interface BriefkopfEditorProps {
  briefkopfId?: string;
  onSaved?: (briefkopf: BriefkopfData) => void;
  onCancel?: () => void;
}

const EMPTY_BRIEFKOPF: BriefkopfData = {
  name: "",
  kanzleiName: "",
  adresse: "",
  telefon: "",
  fax: "",
  email: "",
  website: "",
  steuernr: "",
  ustIdNr: "",
  iban: "",
  bic: "",
  bankName: "",
  braoInfo: "",
  logoUrl: null,
  istStandard: false,
};

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Briefkopf editor with two modes:
 * Mode 1: Structured form with logo upload and live preview
 * Mode 2: Full DOCX editing in OnlyOffice (deferred for later)
 */
export function BriefkopfEditor({
  briefkopfId,
  onSaved,
  onCancel,
}: BriefkopfEditorProps) {
  const [data, setData] = useState<BriefkopfData>(EMPTY_BRIEFKOPF);
  const [mode, setMode] = useState<"form" | "onlyoffice">("form");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!briefkopfId);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Load existing Briefkopf data
  useEffect(() => {
    if (!briefkopfId) return;
    (async () => {
      try {
        const res = await fetch(`/api/briefkopf/${briefkopfId}`);
        if (!res.ok) throw new Error("Fehler beim Laden");
        const result = await res.json();
        const b = result.briefkopf ?? result;
        setData({
          id: b.id,
          name: b.name ?? "",
          kanzleiName: b.kanzleiName ?? "",
          adresse: b.adresse ?? "",
          telefon: b.telefon ?? "",
          fax: b.fax ?? "",
          email: b.email ?? "",
          website: b.website ?? "",
          steuernr: b.steuernr ?? "",
          ustIdNr: b.ustIdNr ?? "",
          iban: b.iban ?? "",
          bic: b.bic ?? "",
          bankName: b.bankName ?? "",
          braoInfo: b.braoInfo ?? "",
          logoUrl: b.logoUrl ?? null,
          istStandard: b.istStandard ?? false,
        });
        if (b.logoUrl) setLogoPreview(b.logoUrl);
      } catch {
        toast.error("Briefkopf konnte nicht geladen werden");
      } finally {
        setLoading(false);
      }
    })();
  }, [briefkopfId]);

  // Update field helper
  const updateField = useCallback(
    (field: keyof BriefkopfData, value: string | boolean) => {
      setData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // Handle logo upload
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Save
  const handleSave = async () => {
    if (!data.name.trim()) {
      toast.error("Name ist erforderlich");
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("name", data.name);
      formData.set("kanzleiName", data.kanzleiName);
      formData.set("adresse", data.adresse);
      formData.set("telefon", data.telefon);
      formData.set("fax", data.fax);
      formData.set("email", data.email);
      formData.set("website", data.website);
      formData.set("steuernr", data.steuernr);
      formData.set("ustIdNr", data.ustIdNr);
      formData.set("iban", data.iban);
      formData.set("bic", data.bic);
      formData.set("bankName", data.bankName);
      formData.set("braoInfo", data.braoInfo);
      formData.set("istStandard", String(data.istStandard));
      if (logoFile) formData.set("logo", logoFile);

      const url = briefkopfId ? `/api/briefkopf/${briefkopfId}` : "/api/briefkopf";
      const method = briefkopfId ? "PUT" : "POST";

      const res = await fetch(url, { method, body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Fehler beim Speichern");
      }

      const result = await res.json();
      toast.success("Briefkopf gespeichert");
      onSaved?.(result.briefkopf ?? result);
    } catch (err: any) {
      toast.error(err.message || "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant={mode === "form" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("form")}
        >
          <Edit3 className="w-4 h-4 mr-1.5" />
          Formular
        </Button>
        <Button
          variant={mode === "onlyoffice" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("onlyoffice")}
        >
          <FileText className="w-4 h-4 mr-1.5" />
          DOCX in OnlyOffice
        </Button>
      </div>

      {mode === "form" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form fields */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bk-name">
                Briefkopf-Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="bk-name"
                value={data.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="z.B. Standard-Briefkopf"
              />
            </div>

            {/* Logo upload */}
            <div className="space-y-1.5">
              <Label>Logo</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                {logoPreview ? (
                  <div className="space-y-2">
                    <img
                      src={logoPreview}
                      alt="Logo"
                      className="max-h-16 mx-auto object-contain"
                    />
                    <label className="cursor-pointer text-xs text-primary hover:underline">
                      Logo aendern
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoChange}
                      />
                    </label>
                  </div>
                ) : (
                  <label className="cursor-pointer space-y-1">
                    <ImageIcon className="w-8 h-8 mx-auto text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground">
                      Logo hochladen (Drag & Drop oder Klick)
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoChange}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bk-kanzleiname">Kanzleiname</Label>
              <Input
                id="bk-kanzleiname"
                value={data.kanzleiName}
                onChange={(e) => updateField("kanzleiName", e.target.value)}
                placeholder="Kanzlei Mustermann"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bk-adresse">Adresse</Label>
              <Input
                id="bk-adresse"
                value={data.adresse}
                onChange={(e) => updateField("adresse", e.target.value)}
                placeholder="Musterstr. 1, 44135 Dortmund"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bk-telefon">Telefon</Label>
                <Input
                  id="bk-telefon"
                  value={data.telefon}
                  onChange={(e) => updateField("telefon", e.target.value)}
                  placeholder="0231 1234567"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bk-fax">Fax</Label>
                <Input
                  id="bk-fax"
                  value={data.fax}
                  onChange={(e) => updateField("fax", e.target.value)}
                  placeholder="0231 1234568"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bk-email">E-Mail</Label>
                <Input
                  id="bk-email"
                  type="email"
                  value={data.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="info@kanzlei.de"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bk-website">Website</Label>
                <Input
                  id="bk-website"
                  value={data.website}
                  onChange={(e) => updateField("website", e.target.value)}
                  placeholder="www.kanzlei.de"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bk-steuernr">Steuernummer</Label>
                <Input
                  id="bk-steuernr"
                  value={data.steuernr}
                  onChange={(e) => updateField("steuernr", e.target.value)}
                  placeholder="123/456/78901"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bk-ustidnr">USt-IdNr.</Label>
                <Input
                  id="bk-ustidnr"
                  value={data.ustIdNr}
                  onChange={(e) => updateField("ustIdNr", e.target.value)}
                  placeholder="DE123456789"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bk-iban">IBAN</Label>
                <Input
                  id="bk-iban"
                  value={data.iban}
                  onChange={(e) => updateField("iban", e.target.value)}
                  placeholder="DE89 3704..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bk-bic">BIC</Label>
                <Input
                  id="bk-bic"
                  value={data.bic}
                  onChange={(e) => updateField("bic", e.target.value)}
                  placeholder="COBADEFFXXX"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bk-bank">Bank</Label>
                <Input
                  id="bk-bank"
                  value={data.bankName}
                  onChange={(e) => updateField("bankName", e.target.value)}
                  placeholder="Commerzbank"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bk-brao">BRAO-Info</Label>
              <textarea
                id="bk-brao"
                value={data.braoInfo}
                onChange={(e) => updateField("braoInfo", e.target.value)}
                placeholder="Berufsrechtliche Angaben gem. BRAO..."
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={data.istStandard}
                onChange={(e) => updateField("istStandard", e.target.checked)}
                className="rounded border-input"
              />
              <span className="text-sm">Als Standard-Briefkopf setzen</span>
            </label>
          </div>

          {/* Live preview */}
          <div className="lg:sticky lg:top-4">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Vorschau</span>
            </div>
            <div className="border rounded-xl p-6 bg-white dark:bg-slate-950 min-h-[400px] text-sm">
              {/* Header area */}
              <div className="flex items-start justify-between mb-6 pb-4 border-b">
                <div className="flex items-center gap-3">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="h-12 object-contain" />
                  ) : (
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-slate-300" />
                    </div>
                  )}
                  <div>
                    <p className="font-heading text-lg text-foreground">
                      {data.kanzleiName || "Kanzleiname"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data.adresse || "Adresse"}
                    </p>
                  </div>
                </div>

                {/* Right sidebar info */}
                <div className="text-right text-[10px] text-muted-foreground space-y-0.5">
                  {data.telefon && <p>Tel: {data.telefon}</p>}
                  {data.fax && <p>Fax: {data.fax}</p>}
                  {data.email && <p>{data.email}</p>}
                  {data.website && <p>{data.website}</p>}
                </div>
              </div>

              {/* Body area (placeholder lines) */}
              <div className="space-y-2 mb-8">
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-2/3" />
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-full" />
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-5/6" />
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-3/4" />
              </div>

              {/* Footer area */}
              <div className="pt-4 border-t text-[9px] text-muted-foreground space-y-0.5">
                {data.bankName && (
                  <p>
                    {data.bankName}
                    {data.iban && ` | IBAN: ${data.iban}`}
                    {data.bic && ` | BIC: ${data.bic}`}
                  </p>
                )}
                {(data.steuernr || data.ustIdNr) && (
                  <p>
                    {data.steuernr && `Steuernr.: ${data.steuernr}`}
                    {data.steuernr && data.ustIdNr && " | "}
                    {data.ustIdNr && `USt-IdNr.: ${data.ustIdNr}`}
                  </p>
                )}
                {data.braoInfo && (
                  <p className="text-[8px] italic mt-1">{data.braoInfo}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* OnlyOffice mode placeholder */
        <div className="glass rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            OnlyOffice-Modus: Oeffnet den Briefkopf als DOCX in OnlyOffice
            fuer vollstaendige Bearbeitungsmoeglichkeiten.
          </p>
          <p className="text-xs text-muted-foreground/60 mt-2">
            Speichern Sie zuerst im Formular-Modus, dann oeffnen Sie die DOCX-Datei in OnlyOffice.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center gap-2">
          {data.istStandard && (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <Star className="w-3 h-3" />
              Standard-Briefkopf
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Abbrechen
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1.5" />
            )}
            Speichern
          </Button>
        </div>
      </div>
    </div>
  );
}
