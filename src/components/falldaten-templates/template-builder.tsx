"use client";

/**
 * Shared Gruppen-first template builder component.
 *
 * Used by both the "Neues Template" and "Template bearbeiten" pages.
 * Manages groups and fields state, transforms to API payload on save.
 */

import { useState, useCallback } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Pencil,
  X,
  Check,
  GripVertical,
  Loader2,
} from "lucide-react";
import type { FalldatenFeldTypDB } from "@/lib/falldaten/validation";

// ─── Sachgebiet values (11 from Prisma enum) ────────────────────────────────

const SACHGEBIET_OPTIONS = [
  { value: "", label: "Kein Sachgebiet" },
  { value: "ARBEITSRECHT", label: "Arbeitsrecht" },
  { value: "FAMILIENRECHT", label: "Familienrecht" },
  { value: "VERKEHRSRECHT", label: "Verkehrsrecht" },
  { value: "MIETRECHT", label: "Mietrecht" },
  { value: "STRAFRECHT", label: "Strafrecht" },
  { value: "ERBRECHT", label: "Erbrecht" },
  { value: "SOZIALRECHT", label: "Sozialrecht" },
  { value: "INKASSO", label: "Inkasso" },
  { value: "HANDELSRECHT", label: "Handelsrecht" },
  { value: "VERWALTUNGSRECHT", label: "Verwaltungsrecht" },
  { value: "SONSTIGES", label: "Sonstiges" },
] as const;

// ─── Field type labels (German) ─────────────────────────────────────────────

const FIELD_TYPE_OPTIONS: { value: FalldatenFeldTypDB; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Textbereich" },
  { value: "number", label: "Zahl" },
  { value: "currency", label: "Waehrung" },
  { value: "date", label: "Datum" },
  { value: "select", label: "Dropdown" },
  { value: "boolean", label: "Checkbox" },
  { value: "multiselect", label: "Mehrfachauswahl" },
];

const FIELD_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  FIELD_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

// Types with placeholder support
const PLACEHOLDER_TYPES: FalldatenFeldTypDB[] = [
  "text",
  "textarea",
  "number",
  "currency",
];

// Types with options support
const OPTION_TYPES: FalldatenFeldTypDB[] = ["select", "multiselect"];

// ─── State types ────────────────────────────────────────────────────────────

export interface BuilderField {
  key: string;
  label: string;
  typ: FalldatenFeldTypDB;
  placeholder: string;
  required: boolean;
  optionen: { value: string; label: string }[];
}

export interface BuilderGroup {
  name: string;
  fields: BuilderField[];
  collapsed: boolean;
}

export interface TemplateMetadata {
  name: string;
  beschreibung: string;
  sachgebiet: string;
}

export interface TemplateBuilderProps {
  /** Initial metadata (for edit mode) */
  initialMetadata?: TemplateMetadata;
  /** Initial groups (for edit mode) */
  initialGroups?: BuilderGroup[];
  /** Template status (for edit mode) */
  status?: string;
  /** Rejection reason (for edit mode with ABGELEHNT status) */
  ablehnungsgrund?: string | null;
  /** Primary save action */
  onSave: (payload: {
    name: string;
    beschreibung?: string;
    sachgebiet?: string;
    schema: { felder: any[] };
  }) => Promise<void>;
  /** Secondary save + submit action */
  onSaveAndSubmit?: (payload: {
    name: string;
    beschreibung?: string;
    sachgebiet?: string;
    schema: { felder: any[] };
  }) => Promise<void>;
  /** Save button label */
  saveLabel?: string;
  /** Save + Submit button label */
  submitLabel?: string;
  /** Loading state */
  saving?: boolean;
  /** Validation errors from server */
  serverErrors?: string[];
}

// ─── Helper: Auto-generate key from label ───────────────────────────────────

function slugifyKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[äÄ]/g, "ae")
    .replace(/[öÖ]/g, "oe")
    .replace(/[üÜ]/g, "ue")
    .replace(/[ß]/g, "ss")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(\d)/, "_$1") // key must start with letter
    .slice(0, 64);
}

// ─── Template Builder Component ─────────────────────────────────────────────

export function TemplateBuilder({
  initialMetadata,
  initialGroups,
  status,
  ablehnungsgrund,
  onSave,
  onSaveAndSubmit,
  saveLabel = "Als Entwurf speichern",
  submitLabel = "Speichern und einreichen",
  saving = false,
  serverErrors = [],
}: TemplateBuilderProps) {
  // ─── Metadata state ─────────────────────────────────────────────────────
  const [meta, setMeta] = useState<TemplateMetadata>(
    initialMetadata ?? { name: "", beschreibung: "", sachgebiet: "" }
  );

  // ─── Groups + fields state ──────────────────────────────────────────────
  const [groups, setGroups] = useState<BuilderGroup[]>(initialGroups ?? []);
  const [newGroupName, setNewGroupName] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);

  // ─── Inline field editor state ──────────────────────────────────────────
  const [editingField, setEditingField] = useState<{
    groupIdx: number;
    fieldIdx: number | null; // null = new field
    field: BuilderField;
  } | null>(null);

  // ─── Validation ─────────────────────────────────────────────────────────
  const [errors, setErrors] = useState<string[]>([]);

  // ─── Group management ─────────────────────────────────────────────────

  function addGroup() {
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    if (groups.some((g) => g.name === trimmed)) {
      setErrors(["Gruppenname existiert bereits"]);
      return;
    }
    setGroups([...groups, { name: trimmed, fields: [], collapsed: false }]);
    setNewGroupName("");
    setShowNewGroup(false);
    setErrors([]);
  }

  function deleteGroup(idx: number) {
    const group = groups[idx];
    if (
      group.fields.length > 0 &&
      !confirm(
        `Gruppe "${group.name}" hat ${group.fields.length} Felder. Wirklich loeschen?`
      )
    ) {
      return;
    }
    setGroups(groups.filter((_, i) => i !== idx));
  }

  function toggleCollapse(idx: number) {
    setGroups(
      groups.map((g, i) =>
        i === idx ? { ...g, collapsed: !g.collapsed } : g
      )
    );
  }

  // ─── Field management ─────────────────────────────────────────────────

  function startNewField(groupIdx: number) {
    setEditingField({
      groupIdx,
      fieldIdx: null,
      field: {
        key: "",
        label: "",
        typ: "text",
        placeholder: "",
        required: false,
        optionen: [],
      },
    });
  }

  function startEditField(groupIdx: number, fieldIdx: number) {
    const field = groups[groupIdx].fields[fieldIdx];
    setEditingField({
      groupIdx,
      fieldIdx,
      field: { ...field, optionen: [...field.optionen] },
    });
  }

  function cancelFieldEdit() {
    setEditingField(null);
  }

  function saveField() {
    if (!editingField) return;
    const { groupIdx, fieldIdx, field } = editingField;

    // Validate
    if (!field.label.trim()) {
      setErrors(["Feld-Label ist erforderlich"]);
      return;
    }
    if (!field.key.trim()) {
      setErrors(["Feld-Key ist erforderlich"]);
      return;
    }

    // Check key uniqueness across ALL groups
    const allKeys = groups.flatMap((g, gi) =>
      g.fields
        .filter((_, fi) => !(gi === groupIdx && fi === fieldIdx))
        .map((f) => f.key)
    );
    if (allKeys.includes(field.key)) {
      setErrors(["Feld-Key existiert bereits in einem anderen Feld"]);
      return;
    }

    // Validate options for select/multiselect
    if (OPTION_TYPES.includes(field.typ)) {
      const validOpts = field.optionen.filter(
        (o) => o.value.trim() && o.label.trim()
      );
      if (validOpts.length === 0) {
        setErrors([
          "Mindestens eine Option ist erforderlich fuer Dropdown/Mehrfachauswahl",
        ]);
        return;
      }
      field.optionen = validOpts;
    }

    setErrors([]);

    const newGroups = [...groups];
    if (fieldIdx === null) {
      // New field
      newGroups[groupIdx] = {
        ...newGroups[groupIdx],
        fields: [...newGroups[groupIdx].fields, field],
      };
    } else {
      // Edit existing field
      newGroups[groupIdx] = {
        ...newGroups[groupIdx],
        fields: newGroups[groupIdx].fields.map((f, i) =>
          i === fieldIdx ? field : f
        ),
      };
    }
    setGroups(newGroups);
    setEditingField(null);
  }

  function deleteField(groupIdx: number, fieldIdx: number) {
    const newGroups = [...groups];
    newGroups[groupIdx] = {
      ...newGroups[groupIdx],
      fields: newGroups[groupIdx].fields.filter((_, i) => i !== fieldIdx),
    };
    setGroups(newGroups);
    // Close editor if editing the deleted field
    if (
      editingField?.groupIdx === groupIdx &&
      editingField?.fieldIdx === fieldIdx
    ) {
      setEditingField(null);
    }
  }

  function updateEditingField(partial: Partial<BuilderField>) {
    if (!editingField) return;
    const updated = { ...editingField.field, ...partial };
    // Auto-generate key from label when adding new field
    if (partial.label !== undefined && editingField.fieldIdx === null) {
      updated.key = slugifyKey(partial.label);
    }
    setEditingField({ ...editingField, field: updated });
  }

  // ─── Options management in field editor ───────────────────────────────

  function addOption() {
    if (!editingField) return;
    updateEditingField({
      optionen: [...editingField.field.optionen, { value: "", label: "" }],
    });
  }

  function removeOption(optIdx: number) {
    if (!editingField) return;
    updateEditingField({
      optionen: editingField.field.optionen.filter((_, i) => i !== optIdx),
    });
  }

  function updateOption(
    optIdx: number,
    patch: Partial<{ value: string; label: string }>
  ) {
    if (!editingField) return;
    updateEditingField({
      optionen: editingField.field.optionen.map((o, i) =>
        i === optIdx ? { ...o, ...patch } : o
      ),
    });
  }

  // ─── Build API payload ────────────────────────────────────────────────

  const buildPayload = useCallback(() => {
    const felder = groups.flatMap((group) =>
      group.fields.map((field) => ({
        key: field.key,
        label: field.label,
        typ: field.typ,
        placeholder: field.placeholder || undefined,
        required: field.required || undefined,
        gruppe: group.name,
        optionen:
          field.optionen.length > 0 ? field.optionen : undefined,
      }))
    );

    return {
      name: meta.name.trim(),
      beschreibung: meta.beschreibung.trim() || undefined,
      sachgebiet: meta.sachgebiet || undefined,
      schema: { felder },
    };
  }, [groups, meta]);

  // ─── Save handlers ────────────────────────────────────────────────────

  async function handleSave() {
    // Client-side validation
    if (!meta.name.trim()) {
      setErrors(["Template-Name ist erforderlich"]);
      return;
    }
    const totalFields = groups.reduce((sum, g) => sum + g.fields.length, 0);
    if (totalFields === 0) {
      setErrors(["Mindestens ein Feld ist erforderlich"]);
      return;
    }
    setErrors([]);
    await onSave(buildPayload());
  }

  async function handleSaveAndSubmit() {
    if (!onSaveAndSubmit) return;
    if (!meta.name.trim()) {
      setErrors(["Template-Name ist erforderlich"]);
      return;
    }
    const totalFields = groups.reduce((sum, g) => sum + g.fields.length, 0);
    if (totalFields === 0) {
      setErrors(["Mindestens ein Feld ist erforderlich"]);
      return;
    }
    setErrors([]);
    await onSaveAndSubmit(buildPayload());
  }

  // ─── Render ───────────────────────────────────────────────────────────

  const allErrors = [...errors, ...serverErrors];

  return (
    <div className="space-y-6">
      {/* Ablehnungsgrund banner */}
      {status === "ABGELEHNT" && ablehnungsgrund && (
        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-4 text-sm text-rose-700 dark:text-rose-300">
          <p className="font-semibold mb-1">Ablehnungsgrund:</p>
          <p>{ablehnungsgrund}</p>
        </div>
      )}

      {/* Section 1: Template Metadata */}
      <GlassCard className="p-6">
        <h2 className="text-base font-semibold mb-4">Template-Informationen</h2>
        <div className="space-y-4">
          <div>
            <Label htmlFor="template-name" className="text-sm">
              Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="template-name"
              value={meta.name}
              onChange={(e) =>
                setMeta({ ...meta, name: e.target.value })
              }
              placeholder="z.B. Verkehrsunfall Personenschaden"
              maxLength={200}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="template-beschreibung" className="text-sm">
              Beschreibung
            </Label>
            <Textarea
              id="template-beschreibung"
              value={meta.beschreibung}
              onChange={(e) =>
                setMeta({ ...meta, beschreibung: e.target.value })
              }
              placeholder="Kurze Beschreibung des Templates..."
              maxLength={2000}
              rows={3}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="template-sachgebiet" className="text-sm">
              Sachgebiet
            </Label>
            <select
              id="template-sachgebiet"
              value={meta.sachgebiet}
              onChange={(e) =>
                setMeta({ ...meta, sachgebiet: e.target.value })
              }
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {SACHGEBIET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Section 2: Gruppen & Felder Builder */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Gruppen & Felder</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNewGroup(true)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Gruppe hinzufuegen
          </Button>
        </div>

        {/* Add group form */}
        {showNewGroup && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-muted/30 rounded-lg border border-border/50">
            <Input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Gruppenname, z.B. Unfallhergang"
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") addGroup();
                if (e.key === "Escape") {
                  setShowNewGroup(false);
                  setNewGroupName("");
                }
              }}
              autoFocus
            />
            <Button size="sm" onClick={addGroup}>
              <Check className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowNewGroup(false);
                setNewGroupName("");
              }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Groups list */}
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Noch keine Gruppen. Erstellen Sie eine Gruppe, um Felder
            hinzuzufuegen.
          </p>
        ) : (
          <div className="space-y-3">
            {groups.map((group, groupIdx) => (
              <div
                key={groupIdx}
                className="border border-border/50 rounded-lg overflow-hidden"
              >
                {/* Group header */}
                <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
                  <button
                    type="button"
                    onClick={() => toggleCollapse(groupIdx)}
                    className="flex items-center gap-2 text-sm font-medium hover:text-foreground transition-colors"
                  >
                    {group.collapsed ? (
                      <ChevronRight className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    {group.name}
                    <Badge variant="secondary" className="text-[10px] ml-1">
                      {group.fields.length} Felder
                    </Badge>
                  </button>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startNewField(groupIdx)}
                      className="h-7 text-xs"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Feld
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteGroup(groupIdx)}
                      className="h-7 text-xs text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Fields list (when not collapsed) */}
                {!group.collapsed && (
                  <div className="px-4 py-2">
                    {group.fields.length === 0 &&
                      !(
                        editingField?.groupIdx === groupIdx &&
                        editingField?.fieldIdx === null
                      ) && (
                        <p className="text-xs text-muted-foreground py-3 text-center">
                          Noch keine Felder in dieser Gruppe.
                        </p>
                      )}

                    {group.fields.map((field, fieldIdx) => (
                      <div key={fieldIdx}>
                        {/* Compact field row */}
                        {!(
                          editingField?.groupIdx === groupIdx &&
                          editingField?.fieldIdx === fieldIdx
                        ) && (
                          <div className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                              <span className="text-sm truncate">
                                {field.label}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[10px] shrink-0"
                              >
                                {FIELD_TYPE_LABELS[field.typ] ?? field.typ}
                              </Badge>
                              {field.required && (
                                <span className="text-[10px] text-rose-500 font-medium shrink-0">
                                  Pflicht
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() =>
                                  startEditField(groupIdx, fieldIdx)
                                }
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() =>
                                  deleteField(groupIdx, fieldIdx)
                                }
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Inline edit form for existing field */}
                        {editingField?.groupIdx === groupIdx &&
                          editingField?.fieldIdx === fieldIdx && (
                            <FieldEditor
                              field={editingField.field}
                              onChange={updateEditingField}
                              onSave={saveField}
                              onCancel={cancelFieldEdit}
                              addOption={addOption}
                              removeOption={removeOption}
                              updateOption={updateOption}
                            />
                          )}
                      </div>
                    ))}

                    {/* Inline form for NEW field */}
                    {editingField?.groupIdx === groupIdx &&
                      editingField?.fieldIdx === null && (
                        <FieldEditor
                          field={editingField.field}
                          onChange={updateEditingField}
                          onSave={saveField}
                          onCancel={cancelFieldEdit}
                          addOption={addOption}
                          removeOption={removeOption}
                          updateOption={updateOption}
                        />
                      )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Errors */}
      {allErrors.length > 0 && (
        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-4">
          {allErrors.map((err, i) => (
            <p key={i} className="text-sm text-rose-700 dark:text-rose-300">
              {err}
            </p>
          ))}
        </div>
      )}

      {/* Section 3: Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {saveLabel}
        </Button>
        {onSaveAndSubmit && (
          <Button
            variant="outline"
            onClick={handleSaveAndSubmit}
            disabled={saving}
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {submitLabel}
          </Button>
        )}
        <a
          href="/dashboard/falldaten-templates"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors ml-2"
        >
          Abbrechen
        </a>
      </div>
    </div>
  );
}

// ─── Field Editor sub-component ─────────────────────────────────────────────

function FieldEditor({
  field,
  onChange,
  onSave,
  onCancel,
  addOption,
  removeOption,
  updateOption,
}: {
  field: BuilderField;
  onChange: (partial: Partial<BuilderField>) => void;
  onSave: () => void;
  onCancel: () => void;
  addOption: () => void;
  removeOption: (idx: number) => void;
  updateOption: (
    idx: number,
    patch: Partial<{ value: string; label: string }>
  ) => void;
}) {
  const showPlaceholder = PLACEHOLDER_TYPES.includes(field.typ);
  const showOptions = OPTION_TYPES.includes(field.typ);

  return (
    <div className="py-3 px-3 my-2 bg-muted/20 rounded-lg border border-border/50 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Label */}
        <div>
          <Label className="text-xs">
            Label <span className="text-rose-500">*</span>
          </Label>
          <Input
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="z.B. Unfallort"
            className="mt-1 h-8 text-sm"
            autoFocus
          />
        </div>

        {/* Key */}
        <div>
          <Label className="text-xs">Key (intern)</Label>
          <Input
            value={field.key}
            onChange={(e) => onChange({ key: e.target.value })}
            placeholder="z.B. unfallort"
            className="mt-1 h-8 text-sm font-mono"
            maxLength={64}
          />
        </div>

        {/* Typ */}
        <div>
          <Label className="text-xs">Typ</Label>
          <select
            value={field.typ}
            onChange={(e) =>
              onChange({ typ: e.target.value as FalldatenFeldTypDB })
            }
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm h-8 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {FIELD_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Pflichtfeld */}
        <div className="flex items-end">
          <label className="flex items-center gap-2 h-8 cursor-pointer">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => onChange({ required: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary dark:border-slate-600"
            />
            <span className="text-sm">Pflichtfeld</span>
          </label>
        </div>
      </div>

      {/* Placeholder (conditional) */}
      {showPlaceholder && (
        <div>
          <Label className="text-xs">Placeholder</Label>
          <Input
            value={field.placeholder}
            onChange={(e) => onChange({ placeholder: e.target.value })}
            placeholder="z.B. Eingabe..."
            className="mt-1 h-8 text-sm"
          />
        </div>
      )}

      {/* Options editor (conditional) */}
      {showOptions && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs">Optionen</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={addOption}
            >
              <Plus className="w-3 h-3 mr-1" />
              Option hinzufuegen
            </Button>
          </div>
          {field.optionen.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Noch keine Optionen. Fuegen Sie mindestens eine hinzu.
            </p>
          )}
          <div className="space-y-1.5">
            {field.optionen.map((opt, optIdx) => (
              <div key={optIdx} className="flex items-center gap-2">
                <Input
                  value={opt.value}
                  onChange={(e) =>
                    updateOption(optIdx, { value: e.target.value })
                  }
                  placeholder="Wert"
                  className="h-7 text-xs flex-1"
                />
                <Input
                  value={opt.label}
                  onChange={(e) =>
                    updateOption(optIdx, { label: e.target.value })
                  }
                  placeholder="Anzeigename"
                  className="h-7 text-xs flex-1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => removeOption(optIdx)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save / Cancel buttons */}
      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" className="h-7 text-xs" onClick={onSave}>
          <Check className="w-3.5 h-3.5 mr-1" />
          Feld speichern
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={onCancel}
        >
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
