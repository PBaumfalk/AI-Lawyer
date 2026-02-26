"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Building2, X } from "lucide-react";
import { useState } from "react";

interface Props {
  typ: string;
  setTyp: (v: string) => void;
  form: Record<string, any>;
  updateField: (key: string, value: string) => void;
}

const FAMILIENSTAND_OPTIONS = [
  { value: "LEDIG", label: "Ledig" },
  { value: "VERHEIRATET", label: "Verheiratet" },
  { value: "GESCHIEDEN", label: "Geschieden" },
  { value: "VERWITWET", label: "Verwitwet" },
  { value: "LEBENSPARTNERSCHAFT", label: "Lebenspartnerschaft" },
];

const REGISTERART_OPTIONS = [
  { value: "HRB", label: "HRB" },
  { value: "HRA", label: "HRA" },
  { value: "VR", label: "VR" },
  { value: "PR", label: "PR" },
  { value: "GNR", label: "GnR" },
  { value: "SONSTIGE", label: "Sonstige" },
];

export function KontaktFormStammdaten({ typ, setTyp, form, updateField }: Props) {
  const [natInput, setNatInput] = useState("");

  function addNationalitaet() {
    const val = natInput.trim();
    if (val && !form.staatsangehoerigkeiten?.includes(val)) {
      updateField("staatsangehoerigkeiten", JSON.stringify([...(form.staatsangehoerigkeiten || []), val]));
    }
    setNatInput("");
  }

  function removeNationalitaet(n: string) {
    updateField(
      "staatsangehoerigkeiten",
      JSON.stringify((form.staatsangehoerigkeiten || []).filter((s: string) => s !== n))
    );
  }

  return (
    <div className="space-y-6">
      {/* Type selector */}
      <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-5">
        <Label className="text-sm font-medium text-foreground/80 mb-3 block">
          Art des Kontakts
        </Label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setTyp("NATUERLICH")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm transition-colors ${
              typ === "NATUERLICH"
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400 dark:border-brand-700"
                : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400"
            }`}
          >
            <User className="w-4 h-4" />
            Natürliche Person
          </button>
          <button
            type="button"
            onClick={() => setTyp("JURISTISCH")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm transition-colors ${
              typ === "JURISTISCH"
                ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400 dark:border-brand-700"
                : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400"
            }`}
          >
            <Building2 className="w-4 h-4" />
            Juristische Person
          </button>
        </div>
      </div>

      {/* Person/Company fields */}
      <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-5 space-y-4">
        <h3 className="text-sm font-medium text-foreground/80">
          {typ === "NATUERLICH" ? "Personendaten" : "Firmendaten"}
        </h3>

        {typ === "NATUERLICH" ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Anrede" value={form.anrede} onChange={(v) => updateField("anrede", v)} placeholder="z.B. Herr, Frau" />
              <Field label="Titel" value={form.titel} onChange={(v) => updateField("titel", v)} placeholder="z.B. Dr., Prof." />
              <Field label="Vorname" value={form.vorname} onChange={(v) => updateField("vorname", v)} />
              <Field label="Nachname" value={form.nachname} onChange={(v) => updateField("nachname", v)} required />
              <Field label="Geburtsname" value={form.geburtsname} onChange={(v) => updateField("geburtsname", v)} />
              <Field label="Geburtsdatum" value={form.geburtsdatum} onChange={(v) => updateField("geburtsdatum", v)} type="date" />
              <Field label="Geburtsort" value={form.geburtsort} onChange={(v) => updateField("geburtsort", v)} />
              <Field label="Geburtsland" value={form.geburtsland} onChange={(v) => updateField("geburtsland", v)} />
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Familienstand</Label>
                <Select
                  value={form.familienstand ?? ""}
                  onChange={(e) => updateField("familienstand", e.target.value)}
                  className="h-9 text-sm"
                >
                  <option value="">— Auswählen —</option>
                  {FAMILIENSTAND_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>
              <Field label="Beruf" value={form.beruf} onChange={(v) => updateField("beruf", v)} />
              <Field label="Branche" value={form.branche} onChange={(v) => updateField("branche", v)} />
            </div>

            {/* Staatsangehörigkeiten */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Staatsangehörigkeiten</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {(form.staatsangehoerigkeiten || []).map((n: string) => (
                  <Badge key={n} variant="muted" className="gap-1">
                    {n}
                    <button type="button" onClick={() => removeNationalitaet(n)} className="hover:text-rose-600">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={natInput}
                  onChange={(e) => setNatInput(e.target.value)}
                  placeholder="z.B. deutsch"
                  className="h-9 text-sm max-w-xs"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNationalitaet(); } }}
                />
                <Button type="button" variant="outline" size="sm" onClick={addNationalitaet}>
                  Hinzufügen
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Firma / Name" value={form.firma} onChange={(v) => updateField("firma", v)} required className="md:col-span-2" />
            <Field label="Kurzname" value={form.kurzname} onChange={(v) => updateField("kurzname", v)} placeholder="z.B. Müller GmbH" />
            <Field label="Rechtsform" value={form.rechtsform} onChange={(v) => updateField("rechtsform", v)} placeholder="z.B. GmbH, AG, e.V." />
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Registerart</Label>
              <Select
                value={form.registerart ?? ""}
                onChange={(e) => updateField("registerart", e.target.value)}
                className="h-9 text-sm"
              >
                <option value="">— Auswählen —</option>
                {REGISTERART_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
            <Field label="Registernummer" value={form.registernummer} onChange={(v) => updateField("registernummer", v)} />
            <Field label="Registergericht" value={form.registergericht} onChange={(v) => updateField("registergericht", v)} />
            <Field label="Gründungsdatum" value={form.gruendungsdatum} onChange={(v) => updateField("gruendungsdatum", v)} type="date" />
            <Field label="Vorname (Ansprechpartner)" value={form.vorname} onChange={(v) => updateField("vorname", v)} />
            <Field label="Nachname (Ansprechpartner)" value={form.nachname} onChange={(v) => updateField("nachname", v)} />
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, required, disabled, className,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; disabled?: boolean; className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground mb-1.5 block">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </Label>
      <Input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} required={required} disabled={disabled} className="h-9 text-sm"
      />
    </div>
  );
}
