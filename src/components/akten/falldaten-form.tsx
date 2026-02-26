"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import type { FalldatenSchema, FalldatenFeld } from "@/lib/falldaten-schemas";

interface FalldatenFormProps {
  akteId: string;
  schema: FalldatenSchema;
  initialData: Record<string, any> | null;
}

export function FalldatenForm({
  akteId,
  schema,
  initialData,
}: FalldatenFormProps) {
  const router = useRouter();
  const [data, setData] = useState<Record<string, any>>(initialData ?? {});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const updateField = useCallback((key: string, value: any) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/akten/${akteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ falldaten: data }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fehler beim Speichern");
      }
      toast.success("Falldaten gespeichert");
      setDirty(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Group fields by their group label
  const groups = new Map<string, FalldatenFeld[]>();
  for (const feld of schema.felder) {
    const group = feld.gruppe ?? "Allgemein";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(feld);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-5 h-5 text-slate-400" />
          <div>
            <h3 className="text-sm font-medium text-foreground">
              {schema.label}
            </h3>
            <p className="text-xs text-slate-500">{schema.beschreibung}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <Badge variant="warning" className="text-[10px]">
              Ungespeichert
            </Badge>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1" />
            )}
            Speichern
          </Button>
        </div>
      </div>

      {/* Grouped fields */}
      {Array.from(groups.entries()).map(([groupLabel, felder]) => (
        <div
          key={groupLabel}
          className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-5"
        >
          <h4 className="text-sm font-medium text-foreground/80 mb-4">
            {groupLabel}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {felder.map((feld) => (
              <FalldatenFeldInput
                key={feld.key}
                feld={feld}
                value={data[feld.key] ?? ""}
                onChange={(v) => updateField(feld.key, v)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Individual Field Renderers ─────────────────────────────────────────────

function FalldatenFeldInput({
  feld,
  value,
  onChange,
}: {
  feld: FalldatenFeld;
  value: any;
  onChange: (v: any) => void;
}) {
  const isFullWidth = feld.typ === "textarea";

  return (
    <div className={isFullWidth ? "md:col-span-2" : ""}>
      <Label
        htmlFor={feld.key}
        className="text-xs text-muted-foreground mb-1.5 block"
      >
        {feld.label}
        {feld.required && <span className="text-rose-500 ml-0.5">*</span>}
      </Label>

      {feld.typ === "text" && (
        <Input
          id={feld.key}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={feld.placeholder}
          className="h-9 text-sm"
        />
      )}

      {feld.typ === "textarea" && (
        <Textarea
          id={feld.key}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={feld.placeholder}
          rows={3}
          className="text-sm"
        />
      )}

      {feld.typ === "number" && (
        <Input
          id={feld.key}
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          placeholder={feld.placeholder}
          className="h-9 text-sm"
        />
      )}

      {feld.typ === "currency" && (
        <div className="relative">
          <Input
            id={feld.key}
            type="number"
            step="0.01"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            placeholder={feld.placeholder ?? "0,00"}
            className="h-9 text-sm pr-8"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            €
          </span>
        </div>
      )}

      {feld.typ === "date" && (
        <Input
          id={feld.key}
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 text-sm"
        />
      )}

      {feld.typ === "select" && feld.optionen && (
        <Select
          id={feld.key}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 text-sm"
        >
          <option value="">Bitte wählen...</option>
          {feld.optionen.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      )}

      {feld.typ === "boolean" && (
        <label
          htmlFor={feld.key}
          className="flex items-center gap-2 h-9 cursor-pointer"
        >
          <input
            id={feld.key}
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-600"
          />
          <span className="text-sm text-muted-foreground">Ja</span>
        </label>
      )}
    </div>
  );
}
