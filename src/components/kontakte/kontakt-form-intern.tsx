"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useState } from "react";

interface Props {
  form: Record<string, any>;
  updateField: (key: string, value: string) => void;
  tags: string[];
  setTags: (tags: string[]) => void;
  customFieldDefs?: CustomFieldDef[];
  customFields: Record<string, any>;
  setCustomFields: (fields: Record<string, any>) => void;
}

export interface CustomFieldDef {
  id: string;
  key: string;
  label: string;
  typ: string;
  optionen?: { value: string; label: string }[] | null;
  pflicht: boolean;
}

const MANDATS_KATEGORIE_OPTIONS = [
  { value: "A_KUNDE", label: "A-Kunde" },
  { value: "DAUERAUFTRAGGEBER", label: "Dauerauftraggeber" },
  { value: "GELEGENHEITSMANDANT", label: "Gelegenheitsmandant" },
  { value: "PRO_BONO", label: "Pro Bono" },
  { value: "SONSTIGE", label: "Sonstige" },
];

export function KontaktFormIntern({ form, updateField, tags, setTags, customFieldDefs = [], customFields, setCustomFields }: Props) {
  const [tagInput, setTagInput] = useState("");

  function addTag() {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  return (
    <div className="space-y-6">
      {/* Kanzleiinterne Daten */}
      <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-5 space-y-4">
        <h3 className="text-sm font-medium text-foreground/80">
          Kanzleiinterne Daten
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Mandantennummer" value={form.mandantennummer} onChange={(v) => updateField("mandantennummer", v)} />
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Mandatskategorie</Label>
            <Select
              value={form.mandatsKategorie ?? ""}
              onChange={(e) => updateField("mandatsKategorie", e.target.value)}
              className="h-9 text-sm"
            >
              <option value="">— Auswählen —</option>
              {MANDATS_KATEGORIE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <Field label="Akquisekanal" value={form.akquisekanal} onChange={(v) => updateField("akquisekanal", v)} placeholder="z.B. Empfehlung, Website, Anwalt.de" />
        </div>
      </div>

      {/* Einwilligungen */}
      <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-5 space-y-4">
        <h3 className="text-sm font-medium text-foreground/80">
          Einwilligungen
        </h3>
        <div className="space-y-3">
          <CheckboxField
            label="E-Mail-Kommunikation erlaubt"
            checked={form.einwilligungEmail === true}
            onChange={(v) => updateField("einwilligungEmail", String(v))}
          />
          <CheckboxField
            label="Newsletter-Versand erlaubt"
            checked={form.einwilligungNewsletter === true}
            onChange={(v) => updateField("einwilligungNewsletter", String(v))}
          />
          <CheckboxField
            label="KI-Verarbeitung erlaubt"
            checked={form.einwilligungAi === true}
            onChange={(v) => updateField("einwilligungAi", String(v))}
          />
        </div>
      </div>

      {/* Tags */}
      <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-5 space-y-4">
        <h3 className="text-sm font-medium text-foreground/80">Tags</h3>
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="muted" className="gap-1">
              {tag}
              <button type="button" onClick={() => removeTag(tag)} className="hover:text-rose-600">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="Neuen Tag eingeben..."
            className="h-9 text-sm max-w-xs"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
          />
          <Button type="button" variant="outline" size="sm" onClick={addTag}>Hinzufügen</Button>
        </div>
      </div>

      {/* Custom Fields */}
      {customFieldDefs.length > 0 && (
        <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-5 space-y-4">
          <h3 className="text-sm font-medium text-foreground/80">Zusatzfelder</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customFieldDefs.map((def) => {
              if (def.typ === "boolean") {
                return (
                  <label key={def.key} className="flex items-center gap-2 h-9 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customFields[def.key] === true}
                      onChange={(e) => setCustomFields({ ...customFields, [def.key]: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-600"
                    />
                    <span className="text-sm text-muted-foreground">
                      {def.label}
                      {def.pflicht && <span className="text-rose-500 ml-0.5">*</span>}
                    </span>
                  </label>
                );
              }
              if (def.typ === "select" && def.optionen) {
                return (
                  <div key={def.key}>
                    <Label className="text-xs text-muted-foreground mb-1.5 block">
                      {def.label}
                      {def.pflicht && <span className="text-rose-500 ml-0.5">*</span>}
                    </Label>
                    <Select
                      value={customFields[def.key] ?? ""}
                      onChange={(e) => setCustomFields({ ...customFields, [def.key]: e.target.value })}
                      className="h-9 text-sm"
                    >
                      <option value="">— Auswählen —</option>
                      {def.optionen.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </Select>
                  </div>
                );
              }
              return (
                <Field
                  key={def.key}
                  label={def.label}
                  value={customFields[def.key] ?? ""}
                  onChange={(v) => setCustomFields({ ...customFields, [def.key]: v })}
                  type={def.typ === "number" ? "number" : def.typ === "date" ? "date" : "text"}
                  required={def.pflicht}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Notizen */}
      <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-5 space-y-4">
        <h3 className="text-sm font-medium text-foreground/80">Notizen</h3>
        <Textarea
          value={form.notizen ?? ""}
          onChange={(e) => updateField("notizen", e.target.value)}
          rows={4}
          className="text-sm"
          placeholder="Freitextnotizen..."
        />
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1.5 block">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </Label>
      <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} className="h-9 text-sm" />
    </div>
  );
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-600"
      />
      <span className="text-sm text-muted-foreground">{label}</span>
    </label>
  );
}
