"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DokumenteTab } from "@/components/dokumente/dokumente-tab";
import { KalenderTab } from "@/components/kalender/kalender-tab";
import { AktenkontoLedger } from "@/components/finanzen/aktenkonto-ledger";
import { InvoiceList } from "@/components/finanzen/invoice-list";
import { AkteZeiterfassungTab } from "@/components/finanzen/akte-zeiterfassung-tab";
import { ActivityFeed } from "./activity-feed";

// Serialized version of the Prisma akte with includes
interface AkteData {
  id: string;
  aktenzeichen: string;
  kurzrubrum: string;
  wegen: string | null;
  sachgebiet: string;
  status: string;
  gegenstandswert: string | null;
  falldaten: Record<string, any> | null;
  falldatenTemplateId: string | null;
  notizen: string | null;
  anwalt: { id: string; name: string; email: string } | null;
  sachbearbeiter: { id: string; name: string; email: string } | null;
  kanzlei: { name: string } | null;
  angelegt: string;
  geaendert: string;
  beteiligte: Array<{
    id: string;
    rolle: string;
    kontakt: {
      id: string;
      typ: string;
      vorname: string | null;
      nachname: string | null;
      firma: string | null;
      email: string | null;
      telefon: string | null;
      ort: string | null;
    };
  }>;
  dokumente: Array<{
    id: string;
    name: string;
    mimeType: string;
    groesse: number;
    ordner: string | null;
    tags: string[];
    status: "ENTWURF" | "ZUR_PRUEFUNG" | "FREIGEGEBEN" | "VERSENDET";
    erstelltDurch: string | null;
    freigegebenDurch: { id: string; name: string } | null;
    freigegebenAm: string | null;
    createdAt: string;
    createdBy: { name: string };
  }>;
  kalenderEintraege: Array<{
    id: string;
    typ: string;
    titel: string;
    datum: string;
    erledigt: boolean;
    verantwortlich: { name: string };
  }>;
  auditLogs: Array<{
    id: string;
    aktion: string;
    details: any;
    createdAt: string;
    user: { name: string } | null;
  }>;
}

export const rolleLabels: Record<string, string> = {
  MANDANT: "Mandant",
  GEGNER: "Gegner",
  GEGNERVERTRETER: "Gegnervertreter",
  GERICHT: "Gericht",
  ZEUGE: "Zeuge",
  SACHVERSTAENDIGER: "Sachverstaendiger",
  SONSTIGER: "Sonstiger",
};

export const rolleBadgeVariant: Record<string, "default" | "danger" | "warning" | "muted" | "success"> = {
  MANDANT: "success",
  GEGNER: "danger",
  GEGNERVERTRETER: "warning",
  GERICHT: "default",
  ZEUGE: "muted",
  SACHVERSTAENDIGER: "muted",
  SONSTIGER: "muted",
};

export function AkteDetailTabs({ akte }: { akte: AkteData }) {
  return (
    <Tabs defaultValue="feed">
      <TabsList className="w-full justify-start">
        <TabsTrigger value="feed">Aktivitaeten</TabsTrigger>
        <TabsTrigger value="dokumente">
          Dokumente ({akte.dokumente.length})
        </TabsTrigger>
        <TabsTrigger value="kalender">
          Termine & Fristen ({akte.kalenderEintraege.length})
        </TabsTrigger>
        <TabsTrigger value="finanzen">Finanzen</TabsTrigger>
      </TabsList>

      {/* --- Feed (default) ------------------------------------------------ */}
      <TabsContent value="feed">
        <ActivityFeed akteId={akte.id} />
      </TabsContent>

      {/* --- Dokumente ----------------------------------------------------- */}
      <TabsContent value="dokumente">
        <DokumenteTab akteId={akte.id} initialDokumente={akte.dokumente} />
      </TabsContent>

      {/* --- Kalender ------------------------------------------------------ */}
      <TabsContent value="kalender">
        <KalenderTab
          akteId={akte.id}
          initialEintraege={akte.kalenderEintraege}
        />
      </TabsContent>

      {/* --- Finanzen (combined Aktenkonto + Rechnungen + Zeiterfassung) ---- */}
      <TabsContent value="finanzen">
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Aktenkonto
            </h3>
            <AktenkontoLedger
              akteId={akte.id}
              aktenzeichen={akte.aktenzeichen}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Rechnungen
            </h3>
            <InvoiceList akteId={akte.id} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Zeiterfassung
            </h3>
            <AkteZeiterfassungTab akteId={akte.id} />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
