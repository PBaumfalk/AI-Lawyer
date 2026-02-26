"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, FileText, Link2, Check } from "lucide-react";
import { toast } from "sonner";

interface KontaktDokumentData {
  id: string;
  kategorie: string;
  name: string;
  dateipfad: string;
  mimeType: string;
  groesse: number;
}

interface BeziehungData {
  id: string;
  typ: string;
  beschreibung?: string | null;
  zuKontakt?: { id: string; vorname?: string | null; nachname?: string | null; firma?: string | null; typ: string };
  vonKontakt?: { id: string; vorname?: string | null; nachname?: string | null; firma?: string | null; typ: string };
}

interface Props {
  kontaktId?: string;
  dokumente: KontaktDokumentData[];
  onDokumenteChange: (items: KontaktDokumentData[]) => void;
  beziehungen: BeziehungData[];
  onBeziehungenChange: (items: BeziehungData[]) => void;
}

const DOK_KATEGORIE_OPTIONS = [
  { value: "IDENTITAET", label: "Identität" },
  { value: "VERTRAG", label: "Vertrag" },
  { value: "VOLLMACHT", label: "Vollmacht" },
  { value: "KYC", label: "KYC" },
  { value: "HR_AUSZUG", label: "HR-Auszug" },
  { value: "SONSTIGE", label: "Sonstige" },
];

const BEZIEHUNG_TYP_OPTIONS = [
  { value: "EHEPARTNER", label: "Ehepartner" },
  { value: "KIND", label: "Kind" },
  { value: "ELTERNTEIL", label: "Elternteil" },
  { value: "GESETZLICHER_VERTRETER", label: "Gesetzlicher Vertreter" },
  { value: "BETREUER", label: "Betreuer" },
  { value: "ARBEITGEBER", label: "Arbeitgeber" },
  { value: "ARBEITNEHMER", label: "Arbeitnehmer" },
  { value: "GESCHAEFTSFUEHRER", label: "Geschäftsführer" },
  { value: "GESELLSCHAFTER", label: "Gesellschafter" },
  { value: "SONSTIGE", label: "Sonstige" },
];

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function kontaktName(k?: { vorname?: string | null; nachname?: string | null; firma?: string | null; typ: string }) {
  if (!k) return "Unbekannt";
  return k.typ === "NATUERLICH" ? [k.vorname, k.nachname].filter(Boolean).join(" ") : k.firma ?? "";
}

export function KontaktFormDokumente({ kontaktId, dokumente, onDokumenteChange, beziehungen, onBeziehungenChange }: Props) {
  return (
    <div className="space-y-6">
      <DokumenteSection kontaktId={kontaktId} items={dokumente} onChange={onDokumenteChange} />
      <BeziehungenSection kontaktId={kontaktId} items={beziehungen} onChange={onBeziehungenChange} />
    </div>
  );
}

// ─── Dokumente ──────────────────────────────────────────────────────────────

function DokumenteSection({ kontaktId, items, onChange }: { kontaktId?: string; items: KontaktDokumentData[]; onChange: (i: KontaktDokumentData[]) => void }) {
  async function remove(id: string) {
    if (!kontaktId) return;
    try {
      const res = await fetch(`/api/kontakte/${kontaktId}/dokumente/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Fehler beim Löschen");
      onChange(items.filter((d) => d.id !== id));
      toast.success("Dokument gelöscht");
    } catch (err: any) { toast.error(err.message); }
  }

  return (
    <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground/80 flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-400" /> Kontakt-Dokumente
        </h3>
      </div>

      {!kontaktId && <p className="text-xs text-slate-400">Dokumente können nach dem Speichern des Kontakts hochgeladen werden.</p>}

      {items.length === 0 && kontaktId && (
        <p className="text-xs text-slate-400">Noch keine Dokumente vorhanden. Dokument-Upload wird über die Aktenansicht unterstützt.</p>
      )}

      {items.map((doc) => (
        <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/15 dark:bg-white/[0.04]">
          <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground/80 truncate">{doc.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="muted" className="text-[10px]">
                {DOK_KATEGORIE_OPTIONS.find((o) => o.value === doc.kategorie)?.label ?? doc.kategorie}
              </Badge>
              <span className="text-xs text-slate-400">{formatFileSize(doc.groesse)}</span>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => remove(doc.id)} className="text-rose-500 hover:text-rose-700">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}

// ─── Beziehungen ──────────────────────────────────────────────────────────────

function BeziehungenSection({ kontaktId, items, onChange }: { kontaktId?: string; items: BeziehungData[]; onChange: (i: BeziehungData[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [editData, setEditData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  function startAdd() {
    setAdding(true);
    setEditData({ zuKontaktId: "", typ: "EHEPARTNER", beschreibung: "" });
  }

  async function save() {
    if (!kontaktId) { toast.error("Bitte speichern Sie den Kontakt zuerst."); return; }
    if (!editData.zuKontaktId) { toast.error("Bitte Ziel-Kontakt-ID angeben."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/kontakte/${kontaktId}/beziehungen`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editData),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Fehler"); }
      const result = await res.json();
      onChange([...items, result]);
      setAdding(false);
      toast.success("Beziehung hinzugefügt");
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!kontaktId) return;
    try {
      const res = await fetch(`/api/kontakte/${kontaktId}/beziehungen/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Fehler beim Löschen");
      onChange(items.filter((b) => b.id !== id));
      toast.success("Beziehung gelöscht");
    } catch (err: any) { toast.error(err.message); }
  }

  return (
    <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground/80 flex items-center gap-2">
          <Link2 className="w-4 h-4 text-slate-400" /> Beziehungen
        </h3>
        {kontaktId && !adding && (
          <Button type="button" variant="outline" size="sm" onClick={startAdd}>
            <Plus className="w-4 h-4 mr-1" /> Beziehung hinzufügen
          </Button>
        )}
      </div>

      {!kontaktId && <p className="text-xs text-slate-400">Beziehungen können nach dem Speichern des Kontakts hinzugefügt werden.</p>}

      {items.map((b) => {
        const other = b.zuKontakt || b.vonKontakt;
        return (
          <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/15 dark:bg-white/[0.04]">
            <Link2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="muted" className="text-[10px]">
                  {BEZIEHUNG_TYP_OPTIONS.find((o) => o.value === b.typ)?.label ?? b.typ}
                </Badge>
                <span className="text-sm text-foreground/80">{kontaktName(other)}</span>
              </div>
              {b.beschreibung && <p className="text-xs text-slate-500 mt-0.5">{b.beschreibung}</p>}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(b.id)} className="text-rose-500 hover:text-rose-700">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        );
      })}

      {adding && (
        <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Beziehungstyp</Label>
              <Select value={editData.typ} onChange={(e) => setEditData({ ...editData, typ: e.target.value })} className="h-9 text-sm">
                {BEZIEHUNG_TYP_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Ziel-Kontakt-ID</Label>
              <Input value={editData.zuKontaktId} onChange={(e) => setEditData({ ...editData, zuKontaktId: e.target.value })} className="h-9 text-sm" placeholder="ID des verknüpften Kontakts" />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Beschreibung</Label>
              <Input value={editData.beschreibung ?? ""} onChange={(e) => setEditData({ ...editData, beschreibung: e.target.value })} className="h-9 text-sm" placeholder="Optionale Beschreibung" />
            </div>
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
