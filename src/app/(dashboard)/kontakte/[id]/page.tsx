import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GlassPanel } from "@/components/ui/glass-panel";
import {
  ChevronLeft,
  User,
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  FileText,
  Tag,
  Shield,
  Scale,
  Link2,
  Settings,
} from "lucide-react";
import { KontaktActions } from "@/components/kontakte/kontakt-actions";

interface KontaktDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function KontaktDetailPage({
  params,
}: KontaktDetailPageProps) {
  const { id } = await params;

  const [kontakt, feldDefs] = await Promise.all([
    prisma.kontakt.findUnique({
      where: { id },
      include: {
        beteiligte: {
          include: {
            akte: {
              select: {
                id: true,
                aktenzeichen: true,
                kurzrubrum: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        adressen: { orderBy: [{ istHaupt: "desc" }, { createdAt: "asc" }] },
        identitaetsPruefungen: { orderBy: { createdAt: "desc" } },
        vollmachtenAlsGeber: {
          include: { nehmer: { select: { id: true, vorname: true, nachname: true, firma: true, typ: true } } },
          orderBy: { createdAt: "desc" },
        },
        kontaktDokumente: { orderBy: { createdAt: "desc" } },
        beziehungenVon: {
          include: { zuKontakt: { select: { id: true, vorname: true, nachname: true, firma: true, typ: true } } },
          orderBy: { createdAt: "desc" },
        },
        beziehungenZu: {
          include: { vonKontakt: { select: { id: true, vorname: true, nachname: true, firma: true, typ: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.kontaktFeldDefinition.findMany({
      where: { aktiv: true },
      orderBy: { sortierung: "asc" },
    }),
  ]);

  if (!kontakt) notFound();

  const customFields = (kontakt.customFields as Record<string, any>) ?? {};
  const hasCustomFields = feldDefs.length > 0 && Object.keys(customFields).some((k) => customFields[k] != null && customFields[k] !== "");

  const displayName =
    kontakt.typ === "NATUERLICH"
      ? `${kontakt.anrede ? kontakt.anrede + " " : ""}${kontakt.titel ? kontakt.titel + " " : ""}${kontakt.vorname ?? ""} ${kontakt.nachname ?? ""}`.trim()
      : kontakt.firma ?? "";

  const serialized = JSON.parse(JSON.stringify(kontakt));

  const allBeziehungen = [
    ...kontakt.beziehungenVon.map((b) => ({ ...b, richtung: "von" as const, other: b.zuKontakt })),
    ...kontakt.beziehungenZu.map((b) => ({ ...b, richtung: "zu" as const, other: b.vonKontakt })),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/kontakte"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Zurück zur Übersicht
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 dark:bg-white/[0.06] flex items-center justify-center">
              {kontakt.typ === "NATUERLICH" ? (
                <User className="w-6 h-6 text-muted-foreground" />
              ) : (
                <Building2 className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                {displayName}
              </h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="muted">
                  {kontakt.typ === "NATUERLICH" ? "Natürliche Person" : "Juristische Person"}
                </Badge>
                {kontakt.rechtsform && <Badge variant="muted">{kontakt.rechtsform}</Badge>}
                {kontakt.mandatsKategorie && (
                  <Badge variant="default">{mandatsKategorieLabels[kontakt.mandatsKategorie] ?? kontakt.mandatsKategorie}</Badge>
                )}
                {kontakt.mandantennummer && (
                  <Badge variant="muted" className="font-mono text-xs">#{kontakt.mandantennummer}</Badge>
                )}
              </div>
            </div>
          </div>
          <KontaktActions kontakt={serialized} />
        </div>
      </div>

      {/* Content with Tabs */}
      <Tabs defaultValue="uebersicht">
        <TabsList className="flex-wrap">
          <TabsTrigger value="uebersicht" className="gap-1.5"><User className="w-3.5 h-3.5" /> Übersicht</TabsTrigger>
          <TabsTrigger value="adressen" className="gap-1.5"><MapPin className="w-3.5 h-3.5" /> Adressen</TabsTrigger>
          <TabsTrigger value="rechtliches" className="gap-1.5"><Scale className="w-3.5 h-3.5" /> Rechtliches</TabsTrigger>
          <TabsTrigger value="kyc" className="gap-1.5"><Shield className="w-3.5 h-3.5" /> KYC & Vollmachten</TabsTrigger>
          <TabsTrigger value="dokumente" className="gap-1.5"><FileText className="w-3.5 h-3.5" /> Dokumente</TabsTrigger>
          <TabsTrigger value="akten" className="gap-1.5"><FileText className="w-3.5 h-3.5" /> Akten ({kontakt.beteiligte.length})</TabsTrigger>
        </TabsList>

        {/* Tab: Übersicht */}
        <TabsContent value="uebersicht">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
            <div className="lg:col-span-2 space-y-6">
              {/* Contact info */}
              <GlassPanel elevation="panel" className="p-6 space-y-4">
                <h3 className="font-semibold text-lg text-foreground">Kontaktdaten</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {kontakt.email && <InfoItem icon={Mail} label="E-Mail" value={kontakt.email} href={`mailto:${kontakt.email}`} />}
                  {kontakt.email2 && <InfoItem icon={Mail} label="E-Mail 2" value={kontakt.email2} href={`mailto:${kontakt.email2}`} />}
                  {kontakt.telefon && <InfoItem icon={Phone} label="Telefon" value={kontakt.telefon} href={`tel:${kontakt.telefon}`} />}
                  {kontakt.telefon2 && <InfoItem icon={Phone} label="Telefon 2" value={kontakt.telefon2} href={`tel:${kontakt.telefon2}`} />}
                  {kontakt.mobil && <InfoItem icon={Phone} label="Mobil" value={kontakt.mobil} href={`tel:${kontakt.mobil}`} />}
                  {kontakt.fax && <InfoItem icon={Phone} label="Fax" value={kontakt.fax} />}
                  {kontakt.website && <InfoItem icon={Globe} label="Website" value={kontakt.website} href={kontakt.website.startsWith("http") ? kontakt.website : `https://${kontakt.website}`} />}
                </div>
                {kontakt.bevorzugteKontaktart && (
                  <p className="text-xs text-muted-foreground">Bevorzugte Kontaktart: {kontaktartLabels[kontakt.bevorzugteKontaktart] ?? kontakt.bevorzugteKontaktart}</p>
                )}
              </GlassPanel>

              {/* Extended identity (natural person) */}
              {kontakt.typ === "NATUERLICH" && (kontakt.geburtsname || kontakt.geburtsort || kontakt.beruf || kontakt.familienstand) && (
                <GlassPanel elevation="panel" className="p-6 space-y-3">
                  <h3 className="font-semibold text-lg text-foreground">Erweiterte Personendaten</h3>
                  <dl className="space-y-3">
                    {kontakt.geburtsname && <DetailRow label="Geburtsname" value={kontakt.geburtsname} />}
                    {kontakt.geburtsort && <DetailRow label="Geburtsort" value={kontakt.geburtsort} />}
                    {kontakt.geburtsland && <DetailRow label="Geburtsland" value={kontakt.geburtsland} />}
                    {kontakt.staatsangehoerigkeiten.length > 0 && <DetailRow label="Staatsangehörigkeiten" value={kontakt.staatsangehoerigkeiten.join(", ")} />}
                    {kontakt.familienstand && <DetailRow label="Familienstand" value={familienstandLabels[kontakt.familienstand] ?? kontakt.familienstand} />}
                    {kontakt.beruf && <DetailRow label="Beruf" value={kontakt.beruf} />}
                    {kontakt.branche && <DetailRow label="Branche" value={kontakt.branche} />}
                  </dl>
                </GlassPanel>
              )}

              {/* Extended identity (legal entity) */}
              {kontakt.typ === "JURISTISCH" && (kontakt.kurzname || kontakt.registerart || kontakt.registernummer) && (
                <GlassPanel elevation="panel" className="p-6 space-y-3">
                  <h3 className="font-semibold text-lg text-foreground">Registerdaten</h3>
                  <dl className="space-y-3">
                    {kontakt.kurzname && <DetailRow label="Kurzname" value={kontakt.kurzname} />}
                    {kontakt.registerart && <DetailRow label="Registerart" value={kontakt.registerart} />}
                    {kontakt.registernummer && <DetailRow label="Registernummer" value={kontakt.registernummer} mono />}
                    {kontakt.registergericht && <DetailRow label="Registergericht" value={kontakt.registergericht} />}
                    {kontakt.gruendungsdatum && <DetailRow label="Gründungsdatum" value={new Date(kontakt.gruendungsdatum).toLocaleDateString("de-DE")} />}
                  </dl>
                </GlassPanel>
              )}

              {/* Notes */}
              {kontakt.notizen && (
                <GlassPanel elevation="panel" className="p-6 space-y-3">
                  <h3 className="font-semibold text-lg text-foreground">Notizen</h3>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{kontakt.notizen}</p>
                </GlassPanel>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Tags */}
              {kontakt.tags.length > 0 && (
                <GlassPanel elevation="panel" className="p-6 space-y-3">
                  <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                    <Tag className="w-4 h-4 text-muted-foreground" /> Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {kontakt.tags.map((tag) => <Badge key={tag} variant="muted">{tag}</Badge>)}
                  </div>
                </GlassPanel>
              )}

              {/* Metadata */}
              <GlassPanel elevation="panel" className="p-6 space-y-3">
                <h3 className="font-semibold text-sm text-foreground">Metadaten</h3>
                <dl className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Erstellt</dt>
                    <dd className="text-foreground/80">{new Date(kontakt.createdAt).toLocaleDateString("de-DE")}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Aktualisiert</dt>
                    <dd className="text-foreground/80">{new Date(kontakt.updatedAt).toLocaleDateString("de-DE")}</dd>
                  </div>
                  {kontakt.geburtsdatum && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Geburtsdatum</dt>
                      <dd className="text-foreground/80">{new Date(kontakt.geburtsdatum).toLocaleDateString("de-DE")}</dd>
                    </div>
                  )}
                  {kontakt.mandantennummer && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Mandantennr.</dt>
                      <dd className="text-foreground/80 font-mono">{kontakt.mandantennummer}</dd>
                    </div>
                  )}
                  {kontakt.mandatsKategorie && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Kategorie</dt>
                      <dd className="text-foreground/80">{mandatsKategorieLabels[kontakt.mandatsKategorie] ?? kontakt.mandatsKategorie}</dd>
                    </div>
                  )}
                </dl>
              </GlassPanel>

              {/* Einwilligungen */}
              {(kontakt.einwilligungEmail || kontakt.einwilligungNewsletter || kontakt.einwilligungAi) && (
                <GlassPanel elevation="panel" className="p-6 space-y-3">
                  <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                    <Settings className="w-4 h-4 text-muted-foreground" /> Einwilligungen
                  </h3>
                  <div className="space-y-1 text-xs">
                    {kontakt.einwilligungEmail && <p className="text-emerald-600">E-Mail-Kommunikation</p>}
                    {kontakt.einwilligungNewsletter && <p className="text-emerald-600">Newsletter</p>}
                    {kontakt.einwilligungAi && <p className="text-emerald-600">KI-Verarbeitung</p>}
                  </div>
                </GlassPanel>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab: Adressen */}
        <TabsContent value="adressen">
          <div className="mt-4 space-y-4">
            {kontakt.adressen.length === 0 ? (
              <EmptyState text="Noch keine Adressen hinterlegt." />
            ) : (
              kontakt.adressen.map((a) => (
                <GlassPanel key={a.id} elevation="panel" className="p-5 flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="muted" className="text-[10px]">{adressenTypLabels[a.typ] ?? a.typ}</Badge>
                      {a.istHaupt && <Badge variant="success" className="text-[10px]">Haupt</Badge>}
                      {a.bezeichnung && <span className="text-xs text-muted-foreground">{a.bezeichnung}</span>}
                    </div>
                    <p className="text-sm text-foreground/80">{[a.strasse, a.hausnummer].filter(Boolean).join(" ")}</p>
                    <p className="text-sm text-foreground/80">{[a.plz, a.ort].filter(Boolean).join(" ")}</p>
                    {a.land && a.land !== "Deutschland" && <p className="text-xs text-muted-foreground">{a.land}</p>}
                  </div>
                </GlassPanel>
              ))
            )}
            {/* Legacy address */}
            {(kontakt.strasse || kontakt.ort) && kontakt.adressen.length === 0 && (
              <GlassPanel elevation="panel" className="p-5">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <Badge variant="muted" className="text-[10px] mb-1">Legacy</Badge>
                    {kontakt.strasse && <p className="text-sm text-foreground/80">{kontakt.strasse}</p>}
                    <p className="text-sm text-foreground/80">{kontakt.plz && `${kontakt.plz} `}{kontakt.ort}</p>
                    {kontakt.land && kontakt.land !== "Deutschland" && <p className="text-xs text-muted-foreground">{kontakt.land}</p>}
                  </div>
                </div>
              </GlassPanel>
            )}
          </div>
        </TabsContent>

        {/* Tab: Rechtliches */}
        <TabsContent value="rechtliches">
          <div className="mt-4 space-y-6">
            {(kontakt.beaSafeId || kontakt.aktenzeichen || kontakt.steuernr || kontakt.ustIdNr || kontakt.finanzamt) && (
              <GlassPanel elevation="panel" className="p-6 space-y-3">
                <h3 className="font-semibold text-lg text-foreground">Kennungen & Steuer</h3>
                <dl className="space-y-3">
                  {kontakt.beaSafeId && <DetailRow label="beA Safe-ID" value={kontakt.beaSafeId} mono />}
                  {kontakt.aktenzeichen && <DetailRow label="Aktenzeichen (fremd)" value={kontakt.aktenzeichen} mono />}
                  {kontakt.steuernr && <DetailRow label="Steuernummer" value={kontakt.steuernr} />}
                  {kontakt.ustIdNr && <DetailRow label="USt-IdNr." value={kontakt.ustIdNr} mono />}
                  {kontakt.finanzamt && <DetailRow label="Finanzamt" value={kontakt.finanzamt} />}
                </dl>
              </GlassPanel>
            )}
            {(kontakt.iban || kontakt.bic || kontakt.kontoinhaber) && (
              <GlassPanel elevation="panel" className="p-6 space-y-3">
                <h3 className="font-semibold text-lg text-foreground">Bankverbindung</h3>
                <dl className="space-y-3">
                  {kontakt.iban && <DetailRow label="IBAN" value={kontakt.iban} mono />}
                  {kontakt.bic && <DetailRow label="BIC" value={kontakt.bic} mono />}
                  {kontakt.kontoinhaber && <DetailRow label="Kontoinhaber" value={kontakt.kontoinhaber} />}
                  {kontakt.bonitaetseinschaetzung && <DetailRow label="Bonität" value={kontakt.bonitaetseinschaetzung} />}
                </dl>
              </GlassPanel>
            )}
            {(kontakt.minderjaehrig || kontakt.unterBetreuung || kontakt.geschaeftsunfaehig) && (
              <GlassPanel elevation="panel" className="p-6 space-y-3">
                <h3 className="font-semibold text-lg text-foreground">Rechtlicher Status</h3>
                <div className="space-y-1">
                  {kontakt.minderjaehrig && <Badge variant="warning">Minderjährig</Badge>}
                  {kontakt.unterBetreuung && <Badge variant="warning">Unter Betreuung</Badge>}
                  {kontakt.geschaeftsunfaehig && <Badge variant="danger">Geschäftsunfähig</Badge>}
                </div>
              </GlassPanel>
            )}
          </div>
        </TabsContent>

        {/* Tab: KYC & Vollmachten */}
        <TabsContent value="kyc">
          <div className="mt-4 space-y-6">
            <GlassPanel elevation="panel" className="p-6 space-y-4">
              <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                <Shield className="w-5 h-5 text-muted-foreground" /> Identitätsprüfungen
              </h3>
              {kontakt.identitaetsPruefungen.length === 0 ? (
                <p className="text-xs text-muted-foreground">Keine KYC-Prüfungen vorhanden.</p>
              ) : (
                kontakt.identitaetsPruefungen.map((p) => (
                  <div key={p.id} className="p-3 rounded-lg bg-white/15 dark:bg-white/[0.04] space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground/80">{kycDokumentartLabels[p.dokumentart] ?? p.dokumentart}</span>
                      <Badge variant={kycStatusVariant(p.status)} className="text-[10px]">{kycStatusLabels[p.status] ?? p.status}</Badge>
                      {p.risikoEinstufung && <Badge variant={risikoVariant(p.risikoEinstufung)} className="text-[10px]">{risikoLabels[p.risikoEinstufung]}</Badge>}
                    </div>
                    {p.ausweisnummer && <p className="text-xs text-muted-foreground">Nr: {p.ausweisnummer}</p>}
                    {p.datum && <p className="text-xs text-muted-foreground">Ausgestellt: {new Date(p.datum).toLocaleDateString("de-DE")}</p>}
                    {p.gueltigBis && <p className="text-xs text-muted-foreground">Gültig bis: {new Date(p.gueltigBis).toLocaleDateString("de-DE")}</p>}
                  </div>
                ))
              )}
            </GlassPanel>

            <GlassPanel elevation="panel" className="p-6 space-y-4">
              <h3 className="font-semibold text-lg text-foreground">Vollmachten</h3>
              {kontakt.vollmachtenAlsGeber.length === 0 ? (
                <p className="text-xs text-muted-foreground">Keine Vollmachten vorhanden.</p>
              ) : (
                kontakt.vollmachtenAlsGeber.map((v) => (
                  <div key={v.id} className="p-3 rounded-lg bg-white/15 dark:bg-white/[0.04] space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="muted" className="text-[10px]">{vollmachtTypLabels[v.typ] ?? v.typ}</Badge>
                      <span className="text-sm text-foreground/80">
                        Nehmer: {v.nehmer.typ === "NATUERLICH" ? [v.nehmer.vorname, v.nehmer.nachname].filter(Boolean).join(" ") : v.nehmer.firma}
                      </span>
                    </div>
                    {v.beginn && <p className="text-xs text-muted-foreground">Von: {new Date(v.beginn).toLocaleDateString("de-DE")}</p>}
                    {v.ende && <p className="text-xs text-muted-foreground">Bis: {new Date(v.ende).toLocaleDateString("de-DE")}</p>}
                  </div>
                ))
              )}
            </GlassPanel>
          </div>
        </TabsContent>

        {/* Tab: Dokumente */}
        <TabsContent value="dokumente">
          <div className="mt-4 space-y-6">
            <GlassPanel elevation="panel" className="p-6 space-y-4">
              <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-muted-foreground" /> Kontakt-Dokumente
              </h3>
              {kontakt.kontaktDokumente.length === 0 ? (
                <p className="text-xs text-muted-foreground">Keine Dokumente vorhanden.</p>
              ) : (
                kontakt.kontaktDokumente.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/15 dark:bg-white/[0.04]">
                    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground/80 truncate">{d.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="muted" className="text-[10px]">{dokumentKategorieLabels[d.kategorie] ?? d.kategorie}</Badge>
                        <span className="text-xs text-muted-foreground">{formatFileSize(d.groesse)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </GlassPanel>

            {allBeziehungen.length > 0 && (
              <GlassPanel elevation="panel" className="p-6 space-y-4">
                <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-muted-foreground" /> Beziehungen
                </h3>
                {allBeziehungen.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/15 dark:bg-white/[0.04]">
                    <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="muted" className="text-[10px]">{beziehungTypLabels[b.typ] ?? b.typ}</Badge>
                        <Link href={`/kontakte/${b.other.id}`} className="text-sm text-brand-600 hover:underline">
                          {b.other.typ === "NATUERLICH" ? [b.other.vorname, b.other.nachname].filter(Boolean).join(" ") : b.other.firma}
                        </Link>
                      </div>
                      {b.beschreibung && <p className="text-xs text-muted-foreground mt-0.5">{b.beschreibung}</p>}
                    </div>
                  </div>
                ))}
              </GlassPanel>
            )}
          </div>
        </TabsContent>

        {/* Tab: Akten */}
        <TabsContent value="akten">
          <div className="mt-4">
            <GlassPanel elevation="panel" className="p-6 space-y-3">
              <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-muted-foreground" /> Akten ({kontakt.beteiligte.length})
              </h3>
              {kontakt.beteiligte.length === 0 ? (
                <p className="text-xs text-muted-foreground">Noch keiner Akte zugewiesen.</p>
              ) : (
                <div className="space-y-2">
                  {kontakt.beteiligte.map((b) => (
                    <Link
                      key={b.id}
                      href={`/akten/${b.akte.id}`}
                      className="block p-3 rounded-lg bg-white/15 dark:bg-white/[0.04] hover:bg-white/25 dark:hover:bg-white/[0.06] transition-colors"
                    >
                      <p className="text-xs font-mono text-muted-foreground">{b.akte.aktenzeichen}</p>
                      <p className="text-sm text-foreground truncate">{b.akte.kurzrubrum}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={rolleVariant[b.rolle] ?? "muted"} className="text-[10px]">
                          {rolleLabels[b.rolle] ?? b.rolle}
                        </Badge>
                        <Badge variant={statusVariant[b.akte.status] ?? "muted"} className="text-[10px]">
                          {b.akte.status}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </GlassPanel>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Labels ────────────────────────────────────────────────────────────────

const rolleLabels: Record<string, string> = {
  MANDANT: "Mandant", GEGNER: "Gegner", GEGNERVERTRETER: "Gegnervertreter",
  GERICHT: "Gericht", ZEUGE: "Zeuge", SACHVERSTAENDIGER: "Sachverständiger", SONSTIGER: "Sonstiger",
};

const rolleVariant: Record<string, "success" | "danger" | "warning" | "default" | "muted"> = {
  MANDANT: "success", GEGNER: "danger", GEGNERVERTRETER: "warning", GERICHT: "default",
};

const statusVariant: Record<string, "success" | "danger" | "warning" | "muted"> = {
  OFFEN: "success", RUHEND: "warning", ARCHIVIERT: "muted", GESCHLOSSEN: "muted",
};

const adressenTypLabels: Record<string, string> = {
  HAUPTANSCHRIFT: "Hauptanschrift", ZUSTELLANSCHRIFT: "Zustellanschrift",
  RECHNUNGSANSCHRIFT: "Rechnungsanschrift", SONSTIGE: "Sonstige",
};

const familienstandLabels: Record<string, string> = {
  LEDIG: "Ledig", VERHEIRATET: "Verheiratet", GESCHIEDEN: "Geschieden",
  VERWITWET: "Verwitwet", LEBENSPARTNERSCHAFT: "Lebenspartnerschaft",
};

const kontaktartLabels: Record<string, string> = {
  EMAIL: "E-Mail", TELEFON: "Telefon", BRIEF: "Brief", FAX: "Fax", BEA: "beA",
};

const mandatsKategorieLabels: Record<string, string> = {
  A_KUNDE: "A-Kunde", DAUERAUFTRAGGEBER: "Dauerauftraggeber",
  GELEGENHEITSMANDANT: "Gelegenheitsmandant", PRO_BONO: "Pro Bono", SONSTIGE: "Sonstige",
};

const kycDokumentartLabels: Record<string, string> = {
  PERSONALAUSWEIS: "Personalausweis", REISEPASS: "Reisepass", FUEHRERSCHEIN: "Führerschein",
  AUFENTHALTSTITEL: "Aufenthaltstitel", SONSTIGE: "Sonstige",
};

const kycStatusLabels: Record<string, string> = {
  NICHT_GEPRUEFT: "Nicht geprüft", IN_PRUEFUNG: "In Prüfung", VERIFIZIERT: "Verifiziert",
  ABGELEHNT: "Abgelehnt", ABGELAUFEN: "Abgelaufen",
};

const risikoLabels: Record<string, string> = {
  NIEDRIG: "Niedrig", MITTEL: "Mittel", HOCH: "Hoch",
};

const vollmachtTypLabels: Record<string, string> = {
  EINZELVOLLMACHT: "Einzelvollmacht", GENERALVOLLMACHT: "Generalvollmacht",
  PROZESSVOLLMACHT: "Prozessvollmacht", VORSORGEVOLLMACHT: "Vorsorgevollmacht", SONSTIGE: "Sonstige",
};

const dokumentKategorieLabels: Record<string, string> = {
  IDENTITAET: "Identität", VERTRAG: "Vertrag", VOLLMACHT: "Vollmacht",
  KYC: "KYC", HR_AUSZUG: "HR-Auszug", SONSTIGE: "Sonstige",
};

const beziehungTypLabels: Record<string, string> = {
  EHEPARTNER: "Ehepartner", KIND: "Kind", ELTERNTEIL: "Elternteil",
  GESETZLICHER_VERTRETER: "Gesetzl. Vertreter", BETREUER: "Betreuer",
  ARBEITGEBER: "Arbeitgeber", ARBEITNEHMER: "Arbeitnehmer",
  GESCHAEFTSFUEHRER: "Geschäftsführer", GESELLSCHAFTER: "Gesellschafter", SONSTIGE: "Sonstige",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function kycStatusVariant(s: string): "success" | "warning" | "danger" | "muted" {
  if (s === "VERIFIZIERT") return "success";
  if (s === "IN_PRUEFUNG") return "warning";
  if (s === "ABGELEHNT" || s === "ABGELAUFEN") return "danger";
  return "muted";
}

function risikoVariant(r: string): "success" | "warning" | "danger" {
  if (r === "NIEDRIG") return "success";
  if (r === "MITTEL") return "warning";
  return "danger";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function EmptyState({ text }: { text: string }) {
  return (
    <GlassPanel elevation="panel" className="p-8 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </GlassPanel>
  );
}

function InfoItem({ icon: Icon, label, value, href }: { icon: React.ElementType; label: string; value: string; href?: string }) {
  const content = (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
  if (href) {
    return (
      <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
        className="hover:bg-white/20 dark:hover:bg-white/[0.05] rounded-lg p-2 -m-2 transition-colors">
        {content}
      </a>
    );
  }
  return content;
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-muted-foreground flex-shrink-0">{label}</dt>
      <dd className={`text-sm text-foreground text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}
