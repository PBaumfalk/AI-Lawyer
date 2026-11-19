"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  form: Record<string, any>;
  updateField: (key: string, value: string) => void;
}

export function KontaktFormRechtliches({ form, updateField }: Props) {
  return (
    <div className="space-y-6">
      {/* Legal identifiers */}
      <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-5 space-y-4">
        <h3 className="text-sm font-medium text-foreground/80">
          Rechtliche Kennungen
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Field label="beA Safe-ID" value={form.beaSafeId} onChange={(v) => updateField("beaSafeId", v)} placeholder="z.B. DE.BRAK.12345678" />
            <BeaVerzeichnisSuche form={form} onUebernehmen={(safeId) => updateField("beaSafeId", safeId)} />
          </div>
          <Field label="Aktenzeichen (fremd)" value={form.aktenzeichen} onChange={(v) => updateField("aktenzeichen", v)} />
          <Field label="Steuernummer" value={form.steuernr} onChange={(v) => updateField("steuernr", v)} />
          <Field label="USt-IdNr." value={form.ustIdNr} onChange={(v) => updateField("ustIdNr", v)} placeholder="z.B. DE123456789" />
          <Field label="Finanzamt" value={form.finanzamt} onChange={(v) => updateField("finanzamt", v)} />
        </div>
      </div>

      {/* Bank data */}
      <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-5 space-y-4">
        <h3 className="text-sm font-medium text-foreground/80">
          Bankverbindung
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="IBAN" value={form.iban} onChange={(v) => updateField("iban", v)} placeholder="z.B. DE89 3704 0044 0532 0130 00" className="md:col-span-2" />
          <Field label="BIC" value={form.bic} onChange={(v) => updateField("bic", v)} />
          <Field label="Kontoinhaber" value={form.kontoinhaber} onChange={(v) => updateField("kontoinhaber", v)} />
          <Field label="Bonitätseinschätzung" value={form.bonitaetseinschaetzung} onChange={(v) => updateField("bonitaetseinschaetzung", v)} />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Zahlungsmodalitäten</Label>
          <Textarea
            value={form.zahlungsmodalitaeten ?? ""}
            onChange={(e) => updateField("zahlungsmodalitaeten", e.target.value)}
            rows={3}
            className="text-sm"
            placeholder="z.B. 14 Tage netto, Ratenzahlung vereinbart..."
          />
        </div>
      </div>

      {/* Legal status */}
      <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] p-5 space-y-4">
        <h3 className="text-sm font-medium text-foreground/80">
          Rechtlicher Status
        </h3>
        <div className="space-y-3">
          <CheckboxField
            label="Minderjährig"
            checked={form.minderjaehrig === true}
            onChange={(v) => updateField("minderjaehrig", String(v))}
          />
          <CheckboxField
            label="Unter Betreuung"
            checked={form.unterBetreuung === true}
            onChange={(v) => updateField("unterBetreuung", String(v))}
          />
          <CheckboxField
            label="Geschäftsunfähig"
            checked={form.geschaeftsunfaehig === true}
            onChange={(v) => updateField("geschaeftsunfaehig", String(v))}
          />
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, className,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground mb-1.5 block">{label}</Label>
      <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 text-sm" />
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

interface BeaIdentitaet {
  safeId: string;
  name: string;
  ort: string | null;
}

/** Searches the beA directory (GET /api/bea/identitaeten) and fills the SAFE-ID. */
function BeaVerzeichnisSuche({
  form,
  onUebernehmen,
}: {
  form: Record<string, any>;
  onUebernehmen: (safeId: string) => void;
}) {
  const [offen, setOffen] = useState(false);
  const [name, setName] = useState("");
  const [plz, setPlz] = useState("");
  const [ort, setOrt] = useState("");
  const [laden, setLaden] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [treffer, setTreffer] = useState<BeaIdentitaet[] | null>(null);

  const oeffnen = () => {
    setName(String(form.nachname || form.firma || ""));
    setPlz(String(form.plz ?? ""));
    setOrt(String(form.ort ?? ""));
    setTreffer(null);
    setFehler(null);
    setOffen(true);
  };

  const suchen = async () => {
    if (laden) return;
    setLaden(true);
    setFehler(null);
    setTreffer(null);
    try {
      const params = new URLSearchParams();
      if (name.trim()) params.set("name", name.trim());
      if (plz.trim()) params.set("plz", plz.trim());
      if (ort.trim()) params.set("ort", ort.trim());
      const res = await fetch(`/api/bea/identitaeten?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Suche fehlgeschlagen (${res.status})`);
      setTreffer(Array.isArray(data.identitaeten) ? data.identitaeten : []);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Suche fehlgeschlagen");
    } finally {
      setLaden(false);
    }
  };

  if (!offen) {
    return (
      <Button type="button" variant="link" size="sm" className="h-auto px-0 mt-1" onClick={oeffnen}>
        <Search className="mr-1 h-3.5 w-3.5" />
        Im beA-Verzeichnis suchen
      </Button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border bg-muted p-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Name" className="h-8 text-sm" />
        <Input value={plz} onChange={(e) => setPlz(e.target.value)} placeholder="PLZ" aria-label="PLZ" className="h-8 text-sm" />
        <Input value={ort} onChange={(e) => setOrt(e.target.value)} placeholder="Ort" aria-label="Ort" className="h-8 text-sm" />
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={suchen} disabled={laden || (!name.trim() && !plz.trim() && !ort.trim())}>
          {laden ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1 h-3.5 w-3.5" />}
          Suchen
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOffen(false)}>
          Schließen
        </Button>
      </div>
      {fehler && <p className="text-xs text-destructive">{fehler}</p>}
      {treffer && treffer.length === 0 && (
        <p className="text-xs text-muted-foreground">Keine Einträge im beA-Verzeichnis gefunden.</p>
      )}
      {treffer && treffer.length > 0 && (
        <ul className="max-h-48 overflow-y-auto divide-y divide-border rounded-md border border-border bg-background">
          {treffer.map((t) => (
            <li key={t.safeId}>
              <button
                type="button"
                onClick={() => {
                  onUebernehmen(t.safeId);
                  setOffen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-muted transition-colors"
              >
                <span className="text-sm font-medium text-foreground">{t.name}</span>
                {t.ort && <span className="ml-2 text-xs text-muted-foreground">{t.ort}</span>}
                <span className="block text-xs text-muted-foreground">{t.safeId}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
