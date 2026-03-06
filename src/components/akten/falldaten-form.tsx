"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { FalldatenFeldTypDB } from "@/lib/falldaten/validation";

// ─── Template Schema Types (DB shape, replaces legacy FalldatenSchema) ──────

interface TemplateField {
  key: string;
  label: string;
  typ: FalldatenFeldTypDB;
  placeholder?: string | null;
  optionen?: { value: string; label: string }[] | null;
  required?: boolean;
  gruppe?: string | null;
}

interface TemplateSchema {
  label?: string;
  beschreibung?: string;
  felder: TemplateField[];
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface FalldatenFormProps {
  akteId: string;
  schema: TemplateSchema;
  initialData: Record<string, any> | null;
  overrides?: Record<string, any> | null;
  onCompletenessChange?: (completeness: { percent: number; filled: number; total: number }) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function FalldatenForm({
  akteId,
  schema,
  initialData,
  overrides,
  onCompletenessChange,
  onDirtyChange,
}: FalldatenFormProps) {
  const router = useRouter();
  const [data, setData] = useState<Record<string, any>>(initialData ?? {});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // ─── Merge Overrides from Auto-Fill ─────────────────────────────────────

  useEffect(() => {
    if (overrides && Object.keys(overrides).length > 0) {
      setData((prev) => ({ ...prev, ...overrides }));
      setDirty(true);
    }
  }, [overrides]);

  const updateField = useCallback((key: string, value: any) => {
    setData((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  // ─── Completeness Calculation ───────────────────────────────────────────

  const completeness = useMemo(() => {
    if (!schema?.felder) return { percent: 0, filled: 0, total: 0 };
    const requiredFields = schema.felder.filter((f) => f.required);
    const total = requiredFields.length;
    if (total === 0) return { percent: 100, filled: 0, total: 0 };
    const filled = requiredFields.filter((f) => {
      const val = data[f.key];
      if (val === null || val === undefined || val === "") return false;
      if (Array.isArray(val) && val.length === 0) return false;
      return true;
    }).length;
    return { percent: Math.round((filled / total) * 100), filled, total };
  }, [data, schema]);

  useEffect(() => {
    onCompletenessChange?.(completeness);
  }, [completeness, onCompletenessChange]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  // ─── Save Handler ─────────────────────────────────────────────────────────

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
      if (completeness.filled < completeness.total) {
        toast.info(`${completeness.total - completeness.filled} Pflichtfelder noch nicht ausgefuellt`);
      }
      setDirty(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Group fields by their group label
  const groups = new Map<string, TemplateField[]>();
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
            {schema.beschreibung && (
              <p className="text-xs text-slate-500">{schema.beschreibung}</p>
            )}
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

      {/* Progress bar for required fields */}
      {completeness.total > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{completeness.percent}% ({completeness.filled}/{completeness.total} Pflichtfelder)</span>
          </div>
          <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-300"
              style={{ width: `${completeness.percent}%` }}
            />
          </div>
        </div>
      )}

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
                value={data[feld.key] ?? (feld.typ === "multiselect" ? [] : "")}
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
  feld: TemplateField;
  value: any;
  onChange: (v: any) => void;
}) {
  const isFullWidth = feld.typ === "textarea" || feld.typ === "multiselect";

  const isRequiredEmpty = feld.required && (
    value === null || value === undefined || value === "" ||
    (Array.isArray(value) && value.length === 0)
  );

  const amberBorder = isRequiredEmpty ? "border-amber-300 dark:border-amber-700" : "";

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
          placeholder={feld.placeholder ?? undefined}
          className={cn("h-9 text-sm", amberBorder)}
        />
      )}

      {feld.typ === "textarea" && (
        <Textarea
          id={feld.key}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={feld.placeholder ?? undefined}
          rows={3}
          className={cn("text-sm", amberBorder)}
        />
      )}

      {feld.typ === "number" && (
        <Input
          id={feld.key}
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          placeholder={feld.placeholder ?? undefined}
          className={cn("h-9 text-sm", amberBorder)}
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
            className={cn("h-9 text-sm pr-8", amberBorder)}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            EUR
          </span>
        </div>
      )}

      {feld.typ === "date" && (
        <Input
          id={feld.key}
          type="date"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={cn("h-9 text-sm", amberBorder)}
        />
      )}

      {feld.typ === "select" && feld.optionen && (
        <Select
          id={feld.key}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={cn("h-9 text-sm", amberBorder)}
        >
          <option value="">Bitte waehlen...</option>
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
          className={cn(
            "flex items-center gap-2 h-9 cursor-pointer rounded-md px-2",
            isRequiredEmpty && "border border-amber-300 dark:border-amber-700"
          )}
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

      {feld.typ === "multiselect" && feld.optionen && (
        <div
          className={cn(
            "space-y-2 rounded-md p-2",
            isRequiredEmpty && "border border-amber-300 dark:border-amber-700"
          )}
        >
          {feld.optionen.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={Array.isArray(value) && value.includes(opt.value)}
                onChange={(e) => {
                  const current = Array.isArray(value) ? value : [];
                  onChange(
                    e.target.checked
                      ? [...current, opt.value]
                      : current.filter((v: string) => v !== opt.value)
                  );
                }}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-600"
              />
              <span className="text-sm text-muted-foreground">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
