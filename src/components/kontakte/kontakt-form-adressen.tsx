"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, MapPin, X, Check } from "lucide-react";
import { toast } from "sonner";

interface Adresse {
  id: string;
  typ: string;
  bezeichnung?: string | null;
  strasse?: string | null;
  hausnummer?: string | null;
  plz?: string | null;
  ort?: string | null;
  land?: string | null;
  istHaupt: boolean;
}

interface Props {
  kontaktId?: string;
  form: Record<string, any>;
  updateField: (key: string, value: string) => void;
  adressen: Adresse[];
  onAdressenChange: (adressen: Adresse[]) => void;
}

const ADRESSTYP_OPTIONS = [
  { value: "HAUPTANSCHRIFT", label: "Hauptanschrift" },
  { value: "ZUSTELLANSCHRIFT", label: "Zustellanschrift" },
  { value: "RECHNUNGSANSCHRIFT", label: "Rechnungsanschrift" },
  { value: "SONSTIGE", label: "Sonstige" },
];

const KONTAKTART_OPTIONS = [
  { value: "EMAIL", label: "E-Mail" },
  { value: "TELEFON", label: "Telefon" },
  { value: "BRIEF", label: "Brief" },
  { value: "FAX", label: "Fax" },
  { value: "BEA", label: "beA" },
];

const emptyAdresse = {
  typ: "HAUPTANSCHRIFT",
  bezeichnung: "",
  strasse: "",
  hausnummer: "",
  plz: "",
  ort: "",
  land: "Deutschland",
  istHaupt: false,
};

export function KontaktFormAdressen({ kontaktId, form, updateField, adressen, onAdressenChange }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState<Record<string, any>>(emptyAdresse);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const [sprachInput, setSprachInput] = useState("");

  async function saveAdresse() {
    if (!kontaktId) {
      toast.error("Bitte speichern Sie den Kontakt zuerst.");
      return;
    }
    setSaving(true);
    try {
      const isEdit = editing !== null;
      const url = isEdit
        ? `/api/kontakte/${kontaktId}/adressen/${editing}`
        : `/api/kontakte/${kontaktId}/adressen`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fehler");
      }
      const result = await res.json();
      if (isEdit) {
        onAdressenChange(adressen.map((a) => (a.id === editing ? result : a)));
      } else {
        onAdressenChange([...adressen, result]);
      }
      setEditing(null);
      setAdding(false);
      toast.success(isEdit ? "Adresse aktualisiert" : "Adresse hinzugefügt");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteAdresse(id: string) {
    if (!kontaktId) return;
    try {
      const res = await fetch(`/api/kontakte/${kontaktId}/adressen/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Fehler beim Löschen");
      onAdressenChange(adressen.filter((a) => a.id !== id));
      toast.success("Adresse gelöscht");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  function startEdit(a: Adresse) {
    setEditing(a.id);
    setEditData({ ...a });
    setAdding(false);
  }

  function startAdd() {
    setAdding(true);
    setEditing(null);
    setEditData({ ...emptyAdresse });
  }

  function addSprache() {
    const val = sprachInput.trim();
    if (val && !form.korrespondenzSprachen?.includes(val)) {
      updateField("korrespondenzSprachen", JSON.stringify([...(form.korrespondenzSprachen || []), val]));
    }
    setSprachInput("");
  }

  function removeSprache(s: string) {
    updateField("korrespondenzSprachen", JSON.stringify((form.korrespondenzSprachen || []).filter((x: string) => x !== s)));
  }

  const showForm = adding || editing !== null;

  return (
    <div className="space-y-6">
      {/* Adressen-Liste */}
      <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground/80">Adressen</h3>
          {kontaktId && !showForm && (
            <Button type="button" variant="outline" size="sm" onClick={startAdd}>
              <Plus className="w-4 h-4 mr-1" /> Adresse hinzufügen
            </Button>
          )}
        </div>

        {!kontaktId && (
          <p className="text-xs text-slate-400">Adressen können nach dem Speichern des Kontakts hinzugefügt werden.</p>
        )}

        {adressen.length === 0 && kontaktId && !showForm && (
          <p className="text-xs text-slate-400">Noch keine Adressen vorhanden.</p>
        )}

        {/* Existing addresses */}
        {adressen.map((a) => (
          <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/15 dark:bg-white/[0.04]">
            <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="muted" className="text-[10px]">
                  {ADRESSTYP_OPTIONS.find((o) => o.value === a.typ)?.label ?? a.typ}
                </Badge>
                {a.istHaupt && <Badge variant="success" className="text-[10px]">Haupt</Badge>}
                {a.bezeichnung && <span className="text-xs text-slate-500">{a.bezeichnung}</span>}
              </div>
              <p className="text-sm text-foreground/80">
                {[a.strasse, a.hausnummer].filter(Boolean).join(" ")}
              </p>
              <p className="text-sm text-foreground/80">
                {[a.plz, a.ort].filter(Boolean).join(" ")}
              </p>
              {a.land && a.land !== "Deutschland" && (
                <p className="text-xs text-slate-500">{a.land}</p>
              )}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(a)}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => deleteAdresse(a.id)} className="text-rose-500 hover:text-rose-700">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}

        {/* Add/Edit form */}
        {showForm && (
          <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Typ</Label>
                <Select value={editData.typ} onChange={(e) => setEditData({ ...editData, typ: e.target.value })} className="h-9 text-sm">
                  {ADRESSTYP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Bezeichnung</Label>
                <Input value={editData.bezeichnung ?? ""} onChange={(e) => setEditData({ ...editData, bezeichnung: e.target.value })} className="h-9 text-sm" placeholder="z.B. Büro, Privatwohnung" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Straße</Label>
                <Input value={editData.strasse ?? ""} onChange={(e) => setEditData({ ...editData, strasse: e.target.value })} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Hausnummer</Label>
                <Input value={editData.hausnummer ?? ""} onChange={(e) => setEditData({ ...editData, hausnummer: e.target.value })} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">PLZ</Label>
                <Input value={editData.plz ?? ""} onChange={(e) => setEditData({ ...editData, plz: e.target.value })} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Ort</Label>
                <Input value={editData.ort ?? ""} onChange={(e) => setEditData({ ...editData, ort: e.target.value })} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Land</Label>
                <Input value={editData.land ?? "Deutschland"} onChange={(e) => setEditData({ ...editData, land: e.target.value })} className="h-9 text-sm" />
              </div>
              <label className="flex items-center gap-2 h-9 cursor-pointer self-end">
                <input type="checkbox" checked={editData.istHaupt} onChange={(e) => setEditData({ ...editData, istHaupt: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" />
                <span className="text-sm text-muted-foreground">Hauptadresse</span>
              </label>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={saveAdresse} disabled={saving}>
                <Check className="w-4 h-4 mr-1" /> {editing ? "Speichern" : "Hinzufügen"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setAdding(false); setEditing(null); }}>
                Abbrechen
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Kommunikation */}
      <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-5 space-y-4">
        <h3 className="text-sm font-medium text-foreground/80">Kommunikation</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Telefon" value={form.telefon} onChange={(v) => updateField("telefon", v)} type="tel" />
          <Field label="Telefon 2" value={form.telefon2} onChange={(v) => updateField("telefon2", v)} type="tel" />
          <Field label="Mobil" value={form.mobil} onChange={(v) => updateField("mobil", v)} type="tel" />
          <Field label="Fax" value={form.fax} onChange={(v) => updateField("fax", v)} type="tel" />
          <Field label="E-Mail" value={form.email} onChange={(v) => updateField("email", v)} type="email" />
          <Field label="E-Mail 2" value={form.email2} onChange={(v) => updateField("email2", v)} type="email" />
          <Field label="Website" value={form.website} onChange={(v) => updateField("website", v)} className="md:col-span-2" />
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Bevorzugte Kontaktart</Label>
            <Select value={form.bevorzugteKontaktart ?? ""} onChange={(e) => updateField("bevorzugteKontaktart", e.target.value)} className="h-9 text-sm">
              <option value="">— Auswählen —</option>
              {KONTAKTART_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
          <Field label="Kontaktzeiten" value={form.kontaktzeiten} onChange={(v) => updateField("kontaktzeiten", v)} placeholder="z.B. Mo-Fr 9-17 Uhr" />
        </div>

        {/* Korrespondenzsprachen */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Korrespondenzsprachen</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {(form.korrespondenzSprachen || []).map((s: string) => (
              <Badge key={s} variant="muted" className="gap-1">
                {s}
                <button type="button" onClick={() => removeSprache(s)} className="hover:text-rose-600">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={sprachInput}
              onChange={(e) => setSprachInput(e.target.value)}
              placeholder="z.B. Deutsch, Englisch"
              className="h-9 text-sm max-w-xs"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSprache(); } }}
            />
            <Button type="button" variant="outline" size="sm" onClick={addSprache}>Hinzufügen</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, required, className,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground mb-1.5 block">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} className="h-9 text-sm" />
    </div>
  );
}
