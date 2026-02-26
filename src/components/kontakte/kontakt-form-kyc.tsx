"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Shield, FileCheck, Check } from "lucide-react";
import { toast } from "sonner";

interface KycPruefung {
  id: string;
  dokumentart: string;
  ausweisnummer?: string | null;
  behoerde?: string | null;
  datum?: string | null;
  gueltigBis?: string | null;
  pruefmethode?: string | null;
  status: string;
  risikoEinstufung?: string | null;
  notizen?: string | null;
}

interface VollmachtData {
  id: string;
  typ: string;
  umfang?: string | null;
  erteilungsdatum?: string | null;
  beginn?: string | null;
  ende?: string | null;
  beschraenkungen?: string | null;
  nehmerId: string;
  nehmer?: { id: string; vorname?: string | null; nachname?: string | null; firma?: string | null; typ: string };
}

interface Props {
  kontaktId?: string;
  kycPruefungen: KycPruefung[];
  onKycChange: (items: KycPruefung[]) => void;
  vollmachten: VollmachtData[];
  onVollmachtenChange: (items: VollmachtData[]) => void;
}

const KYC_DOC_OPTIONS = [
  { value: "PERSONALAUSWEIS", label: "Personalausweis" },
  { value: "REISEPASS", label: "Reisepass" },
  { value: "FUEHRERSCHEIN", label: "Führerschein" },
  { value: "AUFENTHALTSTITEL", label: "Aufenthaltstitel" },
  { value: "SONSTIGE", label: "Sonstige" },
];

const KYC_STATUS_OPTIONS = [
  { value: "NICHT_GEPRUEFT", label: "Nicht geprüft" },
  { value: "IN_PRUEFUNG", label: "In Prüfung" },
  { value: "VERIFIZIERT", label: "Verifiziert" },
  { value: "ABGELEHNT", label: "Abgelehnt" },
  { value: "ABGELAUFEN", label: "Abgelaufen" },
];

const RISIKO_OPTIONS = [
  { value: "NIEDRIG", label: "Niedrig" },
  { value: "MITTEL", label: "Mittel" },
  { value: "HOCH", label: "Hoch" },
];

const VOLLMACHT_TYP_OPTIONS = [
  { value: "EINZELVOLLMACHT", label: "Einzelvollmacht" },
  { value: "GENERALVOLLMACHT", label: "Generalvollmacht" },
  { value: "PROZESSVOLLMACHT", label: "Prozessvollmacht" },
  { value: "VORSORGEVOLLMACHT", label: "Vorsorgevollmacht" },
  { value: "SONSTIGE", label: "Sonstige" },
];

function risikoVariant(r?: string | null): "success" | "warning" | "danger" | "muted" {
  if (r === "NIEDRIG") return "success";
  if (r === "MITTEL") return "warning";
  if (r === "HOCH") return "danger";
  return "muted";
}

function kycStatusVariant(s: string): "success" | "warning" | "danger" | "muted" {
  if (s === "VERIFIZIERT") return "success";
  if (s === "IN_PRUEFUNG") return "warning";
  if (s === "ABGELEHNT" || s === "ABGELAUFEN") return "danger";
  return "muted";
}

function formatDate(d?: string | null) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("de-DE"); } catch { return d; }
}

export function KontaktFormKyc({ kontaktId, kycPruefungen, onKycChange, vollmachten, onVollmachtenChange }: Props) {
  return (
    <div className="space-y-6">
      <KycSection kontaktId={kontaktId} items={kycPruefungen} onChange={onKycChange} />
      <VollmachtenSection kontaktId={kontaktId} items={vollmachten} onChange={onVollmachtenChange} />
    </div>
  );
}

// ─── KYC Section ──────────────────────────────────────────────────────────────

function KycSection({ kontaktId, items, onChange }: { kontaktId?: string; items: KycPruefung[]; onChange: (i: KycPruefung[]) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editData, setEditData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  function startAdd() {
    setAdding(true); setEditing(null);
    setEditData({ dokumentart: "PERSONALAUSWEIS", status: "NICHT_GEPRUEFT", ausweisnummer: "", behoerde: "", datum: "", gueltigBis: "", pruefmethode: "", risikoEinstufung: "", notizen: "" });
  }

  function startEdit(item: KycPruefung) {
    setEditing(item.id); setAdding(false);
    setEditData({
      ...item,
      datum: item.datum ? new Date(item.datum).toISOString().split("T")[0] : "",
      gueltigBis: item.gueltigBis ? new Date(item.gueltigBis).toISOString().split("T")[0] : "",
    });
  }

  async function save() {
    if (!kontaktId) { toast.error("Bitte speichern Sie den Kontakt zuerst."); return; }
    setSaving(true);
    try {
      const isEdit = editing !== null;
      const url = isEdit ? `/api/kontakte/${kontaktId}/kyc/${editing}` : `/api/kontakte/${kontaktId}/kyc`;
      const res = await fetch(url, { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editData) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Fehler"); }
      const result = await res.json();
      if (isEdit) { onChange(items.map((i) => i.id === editing ? result : i)); }
      else { onChange([...items, result]); }
      setEditing(null); setAdding(false);
      toast.success(isEdit ? "KYC-Prüfung aktualisiert" : "KYC-Prüfung hinzugefügt");
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!kontaktId) return;
    try {
      const res = await fetch(`/api/kontakte/${kontaktId}/kyc/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Fehler beim Löschen");
      onChange(items.filter((i) => i.id !== id));
      toast.success("KYC-Prüfung gelöscht");
    } catch (err: any) { toast.error(err.message); }
  }

  const showForm = adding || editing !== null;

  return (
    <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground/80 flex items-center gap-2">
          <Shield className="w-4 h-4 text-slate-400" /> Identitätsprüfungen (KYC)
        </h3>
        {kontaktId && !showForm && (
          <Button type="button" variant="outline" size="sm" onClick={startAdd}>
            <Plus className="w-4 h-4 mr-1" /> Prüfung hinzufügen
          </Button>
        )}
      </div>

      {!kontaktId && <p className="text-xs text-slate-400">KYC-Prüfungen können nach dem Speichern des Kontakts hinzugefügt werden.</p>}

      {items.map((item) => (
        <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/15 dark:bg-white/[0.04]">
          <FileCheck className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-sm font-medium text-foreground/80">
                {KYC_DOC_OPTIONS.find((o) => o.value === item.dokumentart)?.label ?? item.dokumentart}
              </span>
              <Badge variant={kycStatusVariant(item.status)} className="text-[10px]">
                {KYC_STATUS_OPTIONS.find((o) => o.value === item.status)?.label ?? item.status}
              </Badge>
              {item.risikoEinstufung && (
                <Badge variant={risikoVariant(item.risikoEinstufung)} className="text-[10px]">
                  {RISIKO_OPTIONS.find((o) => o.value === item.risikoEinstufung)?.label}
                </Badge>
              )}
            </div>
            {item.ausweisnummer && <p className="text-xs text-slate-500">Nr: {item.ausweisnummer}</p>}
            {(item.datum || item.gueltigBis) && (
              <p className="text-xs text-slate-500">
                {item.datum && `Ausgestellt: ${formatDate(item.datum)}`}
                {item.gueltigBis && ` — Gültig bis: ${formatDate(item.gueltigBis)}`}
              </p>
            )}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(item)}><Pencil className="w-3.5 h-3.5" /></Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(item.id)} className="text-rose-500 hover:text-rose-700"><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      ))}

      {showForm && (
        <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SelectField label="Dokumentart" value={editData.dokumentart} onChange={(v) => setEditData({ ...editData, dokumentart: v })} options={KYC_DOC_OPTIONS} />
            <SelectField label="Status" value={editData.status} onChange={(v) => setEditData({ ...editData, status: v })} options={KYC_STATUS_OPTIONS} />
            <InputField label="Ausweisnummer" value={editData.ausweisnummer ?? ""} onChange={(v) => setEditData({ ...editData, ausweisnummer: v })} />
            <InputField label="Ausstellende Behörde" value={editData.behoerde ?? ""} onChange={(v) => setEditData({ ...editData, behoerde: v })} />
            <InputField label="Ausstellungsdatum" value={editData.datum ?? ""} onChange={(v) => setEditData({ ...editData, datum: v })} type="date" />
            <InputField label="Gültig bis" value={editData.gueltigBis ?? ""} onChange={(v) => setEditData({ ...editData, gueltigBis: v })} type="date" />
            <InputField label="Prüfmethode" value={editData.pruefmethode ?? ""} onChange={(v) => setEditData({ ...editData, pruefmethode: v })} placeholder="z.B. Persönlich, Video-Ident" />
            <SelectField label="Risikoeinstufung" value={editData.risikoEinstufung ?? ""} onChange={(v) => setEditData({ ...editData, risikoEinstufung: v })} options={RISIKO_OPTIONS} allowEmpty />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Notizen</Label>
            <Textarea value={editData.notizen ?? ""} onChange={(e) => setEditData({ ...editData, notizen: e.target.value })} rows={2} className="text-sm" />
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={save} disabled={saving}><Check className="w-4 h-4 mr-1" /> {editing ? "Speichern" : "Hinzufügen"}</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setAdding(false); setEditing(null); }}>Abbrechen</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Vollmachten Section ──────────────────────────────────────────────────────

function VollmachtenSection({ kontaktId, items, onChange }: { kontaktId?: string; items: VollmachtData[]; onChange: (i: VollmachtData[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [editData, setEditData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  function startAdd() {
    setAdding(true);
    setEditData({ typ: "PROZESSVOLLMACHT", nehmerId: "", umfang: "", erteilungsdatum: "", beginn: "", ende: "", beschraenkungen: "" });
  }

  async function save() {
    if (!kontaktId) { toast.error("Bitte speichern Sie den Kontakt zuerst."); return; }
    if (!editData.nehmerId) { toast.error("Bitte Vollmachtnehmer-ID angeben."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/kontakte/${kontaktId}/vollmachten`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editData),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Fehler"); }
      const result = await res.json();
      onChange([...items, result]);
      setAdding(false);
      toast.success("Vollmacht hinzugefügt");
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!kontaktId) return;
    try {
      const res = await fetch(`/api/kontakte/${kontaktId}/vollmachten/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Fehler beim Löschen");
      onChange(items.filter((i) => i.id !== id));
      toast.success("Vollmacht gelöscht");
    } catch (err: any) { toast.error(err.message); }
  }

  function kontaktName(k?: { vorname?: string | null; nachname?: string | null; firma?: string | null; typ: string }) {
    if (!k) return "Unbekannt";
    return k.typ === "NATUERLICH" ? [k.vorname, k.nachname].filter(Boolean).join(" ") : k.firma ?? "";
  }

  return (
    <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground/80">Vollmachten</h3>
        {kontaktId && !adding && (
          <Button type="button" variant="outline" size="sm" onClick={startAdd}>
            <Plus className="w-4 h-4 mr-1" /> Vollmacht hinzufügen
          </Button>
        )}
      </div>

      {!kontaktId && <p className="text-xs text-slate-400">Vollmachten können nach dem Speichern des Kontakts hinzugefügt werden.</p>}

      {items.map((item) => (
        <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/15 dark:bg-white/[0.04]">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="muted" className="text-[10px]">
                {VOLLMACHT_TYP_OPTIONS.find((o) => o.value === item.typ)?.label ?? item.typ}
              </Badge>
            </div>
            <p className="text-sm text-foreground/80">Nehmer: {kontaktName(item.nehmer)}</p>
            {(item.beginn || item.ende) && (
              <p className="text-xs text-slate-500">
                {item.beginn && `Von: ${formatDate(item.beginn)}`}
                {item.ende && ` Bis: ${formatDate(item.ende)}`}
              </p>
            )}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => remove(item.id)} className="text-rose-500 hover:text-rose-700">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}

      {adding && (
        <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SelectField label="Typ" value={editData.typ} onChange={(v) => setEditData({ ...editData, typ: v })} options={VOLLMACHT_TYP_OPTIONS} />
            <InputField label="Vollmachtnehmer-ID" value={editData.nehmerId} onChange={(v) => setEditData({ ...editData, nehmerId: v })} placeholder="Kontakt-ID des Nehmers" />
            <InputField label="Erteilungsdatum" value={editData.erteilungsdatum ?? ""} onChange={(v) => setEditData({ ...editData, erteilungsdatum: v })} type="date" />
            <InputField label="Beginn" value={editData.beginn ?? ""} onChange={(v) => setEditData({ ...editData, beginn: v })} type="date" />
            <InputField label="Ende" value={editData.ende ?? ""} onChange={(v) => setEditData({ ...editData, ende: v })} type="date" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Umfang</Label>
            <Textarea value={editData.umfang ?? ""} onChange={(e) => setEditData({ ...editData, umfang: e.target.value })} rows={2} className="text-sm" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Beschränkungen</Label>
            <Textarea value={editData.beschraenkungen ?? ""} onChange={(e) => setEditData({ ...editData, beschraenkungen: e.target.value })} rows={2} className="text-sm" />
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={save} disabled={saving}><Check className="w-4 h-4 mr-1" /> Hinzufügen</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>Abbrechen</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function InputField({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 text-sm" />
    </div>
  );
}

function SelectField({ label, value, onChange, options, allowEmpty }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; allowEmpty?: boolean }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
      <Select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 text-sm">
        {allowEmpty && <option value="">— Auswählen —</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
    </div>
  );
}
