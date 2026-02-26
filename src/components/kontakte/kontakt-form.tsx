"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Save, Loader2, User, MapPin, Scale, Shield, FileText, Settings } from "lucide-react";
import { toast } from "sonner";
import { KontaktFormStammdaten } from "./kontakt-form-stammdaten";
import { KontaktFormAdressen } from "./kontakt-form-adressen";
import { KontaktFormRechtliches } from "./kontakt-form-rechtliches";
import { KontaktFormKyc } from "./kontakt-form-kyc";
import { KontaktFormDokumente } from "./kontakt-form-dokumente";
import { KontaktFormIntern, type CustomFieldDef } from "./kontakt-form-intern";

interface KontaktData {
  id?: string;
  typ: string;
  // Natural person
  anrede?: string | null;
  titel?: string | null;
  vorname?: string | null;
  nachname?: string | null;
  geburtsdatum?: string | null;
  geburtsname?: string | null;
  geburtsort?: string | null;
  geburtsland?: string | null;
  staatsangehoerigkeiten?: string[];
  familienstand?: string | null;
  beruf?: string | null;
  branche?: string | null;
  // Legal entity
  firma?: string | null;
  rechtsform?: string | null;
  kurzname?: string | null;
  registerart?: string | null;
  registernummer?: string | null;
  registergericht?: string | null;
  gruendungsdatum?: string | null;
  geschaeftszweck?: string | null;
  wirtschaftlichBerechtigte?: any;
  // Address (legacy)
  strasse?: string | null;
  plz?: string | null;
  ort?: string | null;
  land?: string | null;
  // Communication
  telefon?: string | null;
  telefon2?: string | null;
  mobil?: string | null;
  fax?: string | null;
  email?: string | null;
  email2?: string | null;
  website?: string | null;
  bevorzugteKontaktart?: string | null;
  kontaktzeiten?: string | null;
  korrespondenzSprachen?: string[];
  // Legal identifiers
  beaSafeId?: string | null;
  aktenzeichen?: string | null;
  steuernr?: string | null;
  // Tax & Bank
  finanzamt?: string | null;
  ustIdNr?: string | null;
  iban?: string | null;
  bic?: string | null;
  kontoinhaber?: string | null;
  zahlungsmodalitaeten?: string | null;
  bonitaetseinschaetzung?: string | null;
  // Legal status
  minderjaehrig?: boolean;
  unterBetreuung?: boolean;
  geschaeftsunfaehig?: boolean;
  // Internal
  mandantennummer?: string | null;
  mandatsKategorie?: string | null;
  akquisekanal?: string | null;
  einwilligungEmail?: boolean;
  einwilligungNewsletter?: boolean;
  einwilligungAi?: boolean;
  // Notes & custom data
  notizen?: string | null;
  tags?: string[];
  customFields?: Record<string, any> | null;
  // Sub-entities (loaded for edit mode)
  adressen?: any[];
  identitaetsPruefungen?: any[];
  vollmachtenAlsGeber?: any[];
  kontaktDokumente?: any[];
  beziehungenVon?: any[];
  beziehungenZu?: any[];
}

interface KontaktFormProps {
  kontakt?: KontaktData;
  mode: "create" | "edit";
  customFieldDefs?: CustomFieldDef[];
}

export { type CustomFieldDef };

export function KontaktForm({ kontakt, mode, customFieldDefs = [] }: KontaktFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [typ, setTyp] = useState(kontakt?.typ ?? "NATUERLICH");

  const [form, setForm] = useState<Record<string, any>>({
    // Natural person
    anrede: kontakt?.anrede ?? "",
    titel: kontakt?.titel ?? "",
    vorname: kontakt?.vorname ?? "",
    nachname: kontakt?.nachname ?? "",
    geburtsdatum: kontakt?.geburtsdatum ? new Date(kontakt.geburtsdatum).toISOString().split("T")[0] : "",
    geburtsname: kontakt?.geburtsname ?? "",
    geburtsort: kontakt?.geburtsort ?? "",
    geburtsland: kontakt?.geburtsland ?? "",
    staatsangehoerigkeiten: kontakt?.staatsangehoerigkeiten ?? [],
    familienstand: kontakt?.familienstand ?? "",
    beruf: kontakt?.beruf ?? "",
    branche: kontakt?.branche ?? "",
    // Legal entity
    firma: kontakt?.firma ?? "",
    rechtsform: kontakt?.rechtsform ?? "",
    kurzname: kontakt?.kurzname ?? "",
    registerart: kontakt?.registerart ?? "",
    registernummer: kontakt?.registernummer ?? "",
    registergericht: kontakt?.registergericht ?? "",
    gruendungsdatum: kontakt?.gruendungsdatum ? new Date(kontakt.gruendungsdatum).toISOString().split("T")[0] : "",
    geschaeftszweck: kontakt?.geschaeftszweck ?? "",
    // Address (legacy)
    strasse: kontakt?.strasse ?? "",
    plz: kontakt?.plz ?? "",
    ort: kontakt?.ort ?? "",
    land: kontakt?.land ?? "Deutschland",
    // Communication
    telefon: kontakt?.telefon ?? "",
    telefon2: kontakt?.telefon2 ?? "",
    mobil: kontakt?.mobil ?? "",
    fax: kontakt?.fax ?? "",
    email: kontakt?.email ?? "",
    email2: kontakt?.email2 ?? "",
    website: kontakt?.website ?? "",
    bevorzugteKontaktart: kontakt?.bevorzugteKontaktart ?? "",
    kontaktzeiten: kontakt?.kontaktzeiten ?? "",
    korrespondenzSprachen: kontakt?.korrespondenzSprachen ?? [],
    // Legal identifiers
    beaSafeId: kontakt?.beaSafeId ?? "",
    aktenzeichen: kontakt?.aktenzeichen ?? "",
    steuernr: kontakt?.steuernr ?? "",
    // Tax & Bank
    finanzamt: kontakt?.finanzamt ?? "",
    ustIdNr: kontakt?.ustIdNr ?? "",
    iban: kontakt?.iban ?? "",
    bic: kontakt?.bic ?? "",
    kontoinhaber: kontakt?.kontoinhaber ?? "",
    zahlungsmodalitaeten: kontakt?.zahlungsmodalitaeten ?? "",
    bonitaetseinschaetzung: kontakt?.bonitaetseinschaetzung ?? "",
    // Legal status
    minderjaehrig: kontakt?.minderjaehrig ?? false,
    unterBetreuung: kontakt?.unterBetreuung ?? false,
    geschaeftsunfaehig: kontakt?.geschaeftsunfaehig ?? false,
    // Internal
    mandantennummer: kontakt?.mandantennummer ?? "",
    mandatsKategorie: kontakt?.mandatsKategorie ?? "",
    akquisekanal: kontakt?.akquisekanal ?? "",
    einwilligungEmail: kontakt?.einwilligungEmail ?? false,
    einwilligungNewsletter: kontakt?.einwilligungNewsletter ?? false,
    einwilligungAi: kontakt?.einwilligungAi ?? false,
    // Notes
    notizen: kontakt?.notizen ?? "",
  });

  const [tags, setTags] = useState<string[]>(kontakt?.tags ?? []);
  const [customFields, setCustomFields] = useState<Record<string, any>>(
    (kontakt?.customFields as Record<string, any>) ?? {}
  );

  // Sub-entity state (for edit mode)
  const [adressen, setAdressen] = useState<any[]>(kontakt?.adressen ?? []);
  const [kycPruefungen, setKycPruefungen] = useState<any[]>(kontakt?.identitaetsPruefungen ?? []);
  const [vollmachten, setVollmachten] = useState<any[]>(kontakt?.vollmachtenAlsGeber ?? []);
  const [kontaktDokumente, setKontaktDokumente] = useState<any[]>(kontakt?.kontaktDokumente ?? []);
  const [beziehungen, setBeziehungen] = useState<any[]>(kontakt?.beziehungenVon ?? []);

  function updateField(key: string, value: string) {
    // Handle special array/boolean fields encoded as strings
    if (key === "staatsangehoerigkeiten" || key === "korrespondenzSprachen") {
      try {
        setForm((prev) => ({ ...prev, [key]: JSON.parse(value) }));
      } catch {
        setForm((prev) => ({ ...prev, [key]: value }));
      }
      return;
    }
    if (key === "minderjaehrig" || key === "unterBetreuung" || key === "geschaeftsunfaehig" ||
        key === "einwilligungEmail" || key === "einwilligungNewsletter" || key === "einwilligungAi") {
      setForm((prev) => ({ ...prev, [key]: value === "true" }));
      return;
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const payload: Record<string, any> = { ...form, typ, tags };
      if (customFieldDefs.length > 0) {
        payload.customFields = customFields;
      }

      // Convert empty strings to null for submission
      for (const key of Object.keys(payload)) {
        if (payload[key] === "") payload[key] = null;
      }

      const url = mode === "create" ? "/api/kontakte" : `/api/kontakte/${kontakt?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || err.details?.formErrors?.[0] || "Fehler beim Speichern");
      }

      const result = await res.json();
      toast.success(mode === "create" ? "Kontakt erstellt" : "Kontakt gespeichert");
      router.push(`/kontakte/${result.id}`);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl">
      <Tabs defaultValue="stammdaten">
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="stammdaten" className="gap-1.5">
            <User className="w-3.5 h-3.5" /> Stammdaten
          </TabsTrigger>
          <TabsTrigger value="adressen" className="gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> Adressen & Komm.
          </TabsTrigger>
          <TabsTrigger value="rechtliches" className="gap-1.5">
            <Scale className="w-3.5 h-3.5" /> Rechtliches
          </TabsTrigger>
          <TabsTrigger value="kyc" className="gap-1.5">
            <Shield className="w-3.5 h-3.5" /> KYC & Vollmachten
          </TabsTrigger>
          <TabsTrigger value="dokumente" className="gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Dokumente
          </TabsTrigger>
          <TabsTrigger value="intern" className="gap-1.5">
            <Settings className="w-3.5 h-3.5" /> Intern
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stammdaten">
          <div className="glass-card rounded-xl p-5 space-y-4">
            <KontaktFormStammdaten typ={typ} setTyp={setTyp} form={form} updateField={updateField} />
          </div>
        </TabsContent>

        <TabsContent value="adressen">
          <div className="glass-card rounded-xl p-5 space-y-4">
            <KontaktFormAdressen
              kontaktId={kontakt?.id}
              form={form}
              updateField={updateField}
              adressen={adressen}
              onAdressenChange={setAdressen}
            />
          </div>
        </TabsContent>

        <TabsContent value="rechtliches">
          <div className="glass-card rounded-xl p-5 space-y-4">
            <KontaktFormRechtliches form={form} updateField={updateField} />
          </div>
        </TabsContent>

        <TabsContent value="kyc">
          <div className="glass-card rounded-xl p-5 space-y-4">
            <KontaktFormKyc
              kontaktId={kontakt?.id}
              kycPruefungen={kycPruefungen}
              onKycChange={setKycPruefungen}
              vollmachten={vollmachten}
              onVollmachtenChange={setVollmachten}
            />
          </div>
        </TabsContent>

        <TabsContent value="dokumente">
          <div className="glass-card rounded-xl p-5 space-y-4">
            <KontaktFormDokumente
              kontaktId={kontakt?.id}
              dokumente={kontaktDokumente}
              onDokumenteChange={setKontaktDokumente}
              beziehungen={beziehungen}
              onBeziehungenChange={setBeziehungen}
            />
          </div>
        </TabsContent>

        <TabsContent value="intern">
          <div className="glass-card rounded-xl p-5 space-y-4">
            <KontaktFormIntern
              form={form}
              updateField={updateField}
              tags={tags}
              setTags={setTags}
              customFieldDefs={customFieldDefs}
              customFields={customFields}
              setCustomFields={setCustomFields}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Actions — always visible */}
      <div className="flex items-center gap-3 mt-6 pt-6 border-t border-white/20 dark:border-white/[0.08]">
        <Button type="submit" disabled={saving}>
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {mode === "create" ? "Kontakt anlegen" : "Änderungen speichern"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
