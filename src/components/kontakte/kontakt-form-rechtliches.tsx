"use client";

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
          <Field label="beA Safe-ID" value={form.beaSafeId} onChange={(v) => updateField("beaSafeId", v)} placeholder="z.B. DE.BRAK.12345678" />
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
