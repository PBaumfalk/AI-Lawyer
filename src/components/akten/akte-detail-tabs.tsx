"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  User,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  History,
  UserPlus,
  UserMinus,
  FileUp,
  FileX,
  Clock,
  StickyNote,
  ArrowRightLeft,
  Loader2,
  ChevronDown,
  Filter,
  Shield,
} from "lucide-react";
import { BeteiligteAddDialog } from "./beteiligte-add-dialog";
import { FalldatenForm } from "./falldaten-form";
import { getFalldatenSchema } from "@/lib/falldaten-schemas";
import { DokumenteTab } from "@/components/dokumente/dokumente-tab";
import { KalenderTab } from "@/components/kalender/kalender-tab";
import { AkteEmailTab } from "@/components/email/akte-email-tab";
import { AktenkontoLedger } from "@/components/finanzen/aktenkonto-ledger";
import { InvoiceList } from "@/components/finanzen/invoice-list";
import { AkteZeiterfassungTab } from "@/components/finanzen/akte-zeiterfassung-tab";
import { toast } from "sonner";

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

const rolleLabels: Record<string, string> = {
  MANDANT: "Mandant",
  GEGNER: "Gegner",
  GEGNERVERTRETER: "Gegnervertreter",
  GERICHT: "Gericht",
  ZEUGE: "Zeuge",
  SACHVERSTAENDIGER: "Sachverständiger",
  SONSTIGER: "Sonstiger",
};

const rolleBadgeVariant: Record<string, "default" | "danger" | "warning" | "muted" | "success"> = {
  MANDANT: "success",
  GEGNER: "danger",
  GEGNERVERTRETER: "warning",
  GERICHT: "default",
  ZEUGE: "muted",
  SACHVERSTAENDIGER: "muted",
  SONSTIGER: "muted",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AkteDetailTabs({ akte }: { akte: AkteData }) {
  const router = useRouter();
  const [addBeteiligteOpen, setAddBeteiligteOpen] = useState(false);
  const falldatenSchema = getFalldatenSchema(akte.sachgebiet);

  async function handleRemoveBeteiligter(beteiligterIdParam: string) {
    if (!confirm("Beteiligten wirklich entfernen?")) return;

    try {
      const res = await fetch(
        `/api/akten/${akte.id}/beteiligte?beteiligterID=${beteiligterIdParam}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fehler beim Entfernen");
      }
      toast.success("Beteiligter entfernt");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <Tabs defaultValue="uebersicht">
      <TabsList className="w-full justify-start">
        <TabsTrigger value="uebersicht">Übersicht</TabsTrigger>
        <TabsTrigger value="beteiligte">
          Beteiligte ({akte.beteiligte.length})
        </TabsTrigger>
        {falldatenSchema && (
          <TabsTrigger value="falldaten">Falldaten</TabsTrigger>
        )}
        <TabsTrigger value="dokumente">
          Dokumente ({akte.dokumente.length})
        </TabsTrigger>
        <TabsTrigger value="kalender">
          Termine & Fristen ({akte.kalenderEintraege.length})
        </TabsTrigger>
        <TabsTrigger value="aktenkonto">Aktenkonto</TabsTrigger>
        <TabsTrigger value="rechnungen">Rechnungen</TabsTrigger>
        <TabsTrigger value="zeiterfassung">Zeiterfassung</TabsTrigger>
        <TabsTrigger value="emails">E-Mails</TabsTrigger>
        <TabsTrigger value="pruefprotokoll">Pruefprotokoll</TabsTrigger>
        <TabsTrigger value="historie">
          Historie ({akte.auditLogs?.length ?? 0})
        </TabsTrigger>
      </TabsList>

      {/* ─── Übersicht ──────────────────────────────────────────────── */}
      <TabsContent value="uebersicht">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Case details */}
          <div className="glass-card rounded-xl p-6 space-y-4">
            <h3 className="font-semibold text-lg text-foreground">
              Aktendetails
            </h3>
            <dl className="space-y-3">
              <DetailRow label="Aktenzeichen" value={akte.aktenzeichen} mono />
              <DetailRow label="Kurzrubrum" value={akte.kurzrubrum} />
              <DetailRow label="Wegen" value={akte.wegen ?? "—"} />
              <DetailRow
                label="Gegenstandswert"
                value={
                  akte.gegenstandswert
                    ? `${parseFloat(akte.gegenstandswert).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`
                    : "—"
                }
              />
              <DetailRow label="Angelegt am" value={formatDate(akte.angelegt)} />
              <DetailRow label="Letzte Änderung" value={formatDateTime(akte.geaendert)} />
            </dl>
          </div>

          {/* Staff & notes */}
          <div className="space-y-6">
            <div className="glass-card rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-lg text-foreground">
                Zuständigkeit
              </h3>
              <dl className="space-y-3">
                <DetailRow label="Anwalt" value={akte.anwalt?.name ?? "Nicht zugewiesen"} />
                <DetailRow
                  label="Sachbearbeiter/in"
                  value={akte.sachbearbeiter?.name ?? "Nicht zugewiesen"}
                />
                <DetailRow label="Kanzlei" value={akte.kanzlei?.name ?? "—"} />
              </dl>
            </div>

            {akte.notizen && (
              <div className="glass-card rounded-xl p-6 space-y-3">
                <h3 className="font-semibold text-lg text-foreground">
                  Notizen
                </h3>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap">
                  {akte.notizen}
                </p>
              </div>
            )}
          </div>
        </div>
      </TabsContent>

      {/* ─── Beteiligte ─────────────────────────────────────────────── */}
      <TabsContent value="beteiligte">
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => setAddBeteiligteOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Beteiligten hinzufügen
            </Button>
          </div>
          <div className="glass-card rounded-xl">
            {akte.beteiligte.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-400">
                Noch keine Beteiligten zugewiesen.
              </div>
            ) : (
              <div className="divide-y divide-white/10 dark:divide-white/[0.04]">
                {akte.beteiligte.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-white/20 dark:hover:bg-white/[0.05] transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-full bg-white/20 dark:bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                      {b.kontakt.typ === "NATUERLICH" ? (
                        <User className="w-5 h-5 text-slate-500" />
                      ) : (
                        <Building2 className="w-5 h-5 text-slate-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/kontakte/${b.kontakt.id}`}
                        className="text-sm font-medium text-brand-600 hover:underline"
                      >
                        {b.kontakt.typ === "NATUERLICH"
                          ? `${b.kontakt.vorname ?? ""} ${b.kontakt.nachname ?? ""}`.trim()
                          : b.kontakt.firma}
                      </Link>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        {b.kontakt.ort && <span>{b.kontakt.ort}</span>}
                        {b.kontakt.email && (
                          <>
                            <span>·</span>
                            <span>{b.kontakt.email}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Badge variant={rolleBadgeVariant[b.rolle] ?? "muted"}>
                      {rolleLabels[b.rolle] ?? b.rolle}
                    </Badge>
                    <button
                      onClick={() => handleRemoveBeteiligter(b.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950 text-slate-400 hover:text-rose-600 transition-all"
                      title="Entfernen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <BeteiligteAddDialog
          akteId={akte.id}
          open={addBeteiligteOpen}
          onClose={() => setAddBeteiligteOpen(false)}
        />
      </TabsContent>

      {/* ─── Falldaten ─────────────────────────────────────────────── */}
      {falldatenSchema && (
        <TabsContent value="falldaten">
          <FalldatenForm
            akteId={akte.id}
            schema={falldatenSchema}
            initialData={akte.falldaten}
          />
        </TabsContent>
      )}

      {/* ─── Dokumente ──────────────────────────────────────────────── */}
      <TabsContent value="dokumente">
        <DokumenteTab akteId={akte.id} initialDokumente={akte.dokumente} />
      </TabsContent>

      {/* ─── Kalender ───────────────────────────────────────────────── */}
      <TabsContent value="kalender">
        <KalenderTab
          akteId={akte.id}
          initialEintraege={akte.kalenderEintraege}
        />
      </TabsContent>

      {/* ─── Aktenkonto ─────────────────────────────────────────────── */}
      <TabsContent value="aktenkonto">
        <AktenkontoLedger akteId={akte.id} aktenzeichen={akte.aktenzeichen} />
      </TabsContent>

      {/* ─── Rechnungen ──────────────────────────────────────────────── */}
      <TabsContent value="rechnungen">
        <InvoiceList akteId={akte.id} />
      </TabsContent>

      {/* ─── Zeiterfassung ───────────────────────────────────────────── */}
      <TabsContent value="zeiterfassung">
        <AkteZeiterfassungTab akteId={akte.id} />
      </TabsContent>

      {/* ─── E-Mails ───────────────────────────────────────────────── */}
      <TabsContent value="emails">
        <AkteEmailTab akteId={akte.id} />
      </TabsContent>

      {/* ─── Pruefprotokoll ────────────────────────────────────────── */}
      <TabsContent value="pruefprotokoll">
        <BeaPruefprotokoll akteId={akte.id} />
      </TabsContent>

      {/* ─── Historie ──────────────────────────────────────────────── */}
      <TabsContent value="historie">
        <AkteHistorie akteId={akte.id} initialLogs={akte.auditLogs ?? []} />
      </TabsContent>
    </Tabs>
  );
}

// ─── Historie Component ─────────────────────────────────────────────────────

const aktionLabels: Record<string, string> = {
  AKTE_ERSTELLT: "Akte erstellt",
  AKTE_BEARBEITET: "Akte bearbeitet",
  STATUS_GEAENDERT: "Status geändert",
  BETEILIGTER_HINZUGEFUEGT: "Beteiligten hinzugefügt",
  BETEILIGTER_ENTFERNT: "Beteiligten entfernt",
  DOKUMENT_HOCHGELADEN: "Dokument hochgeladen",
  DOKUMENT_GELOESCHT: "Dokument gelöscht",
  FRIST_ERSTELLT: "Frist erstellt",
  FRIST_ERLEDIGT: "Frist als erledigt markiert",
  TERMIN_ERSTELLT: "Termin erstellt",
  WIEDERVORLAGE_ERSTELLT: "Wiedervorlage erstellt",
  NOTIZ_GEAENDERT: "Notizen bearbeitet",
};

const aktionIcons: Record<string, React.ElementType> = {
  AKTE_ERSTELLT: Plus,
  AKTE_BEARBEITET: History,
  STATUS_GEAENDERT: ArrowRightLeft,
  BETEILIGTER_HINZUGEFUEGT: UserPlus,
  BETEILIGTER_ENTFERNT: UserMinus,
  DOKUMENT_HOCHGELADEN: FileUp,
  DOKUMENT_GELOESCHT: FileX,
  FRIST_ERSTELLT: AlertTriangle,
  FRIST_ERLEDIGT: CheckCircle2,
  TERMIN_ERSTELLT: Calendar,
  WIEDERVORLAGE_ERSTELLT: Clock,
  NOTIZ_GEAENDERT: StickyNote,
};

const aktionColors: Record<string, string> = {
  AKTE_ERSTELLT: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  AKTE_BEARBEITET: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  STATUS_GEAENDERT: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  BETEILIGTER_HINZUGEFUEGT: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  BETEILIGTER_ENTFERNT: "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
  DOKUMENT_HOCHGELADEN: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  DOKUMENT_GELOESCHT: "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400",
  FRIST_ERSTELLT: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  FRIST_ERLEDIGT: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  TERMIN_ERSTELLT: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  WIEDERVORLAGE_ERSTELLT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  NOTIZ_GEAENDERT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

const statusLabels: Record<string, string> = {
  OFFEN: "Offen",
  RUHEND: "Ruhend",
  ARCHIVIERT: "Archiviert",
  GESCHLOSSEN: "Geschlossen",
};

// Filter options for the history
const filterOptions = [
  { value: "", label: "Alle" },
  { value: "AKTE_ERSTELLT", label: "Erstellt" },
  { value: "AKTE_BEARBEITET", label: "Bearbeitet" },
  { value: "STATUS_GEAENDERT", label: "Status" },
  { value: "BETEILIGTER_HINZUGEFUEGT", label: "Beteiligte +" },
  { value: "BETEILIGTER_ENTFERNT", label: "Beteiligte −" },
  { value: "NOTIZ_GEAENDERT", label: "Notizen" },
];

interface AuditLogItem {
  id: string;
  aktion: string;
  details: any;
  createdAt: string;
  user: { name: string } | null;
}

function AkteHistorie({
  akteId,
  initialLogs,
}: {
  akteId: string;
  initialLogs: AuditLogItem[];
}) {
  const [logs, setLogs] = useState<AuditLogItem[]>(initialLogs);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialLogs.length >= 50 ? initialLogs[initialLogs.length - 1]?.id ?? null : null
  );
  const [hasMore, setHasMore] = useState(initialLogs.length >= 50);
  const [filter, setFilter] = useState("");

  const fetchLogs = useCallback(
    async (cursor?: string | null, aktionFilter?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ take: "20" });
        if (cursor) params.set("cursor", cursor);
        if (aktionFilter) params.set("aktion", aktionFilter);

        const res = await fetch(`/api/akten/${akteId}/historie?${params}`);
        if (!res.ok) throw new Error("Fehler beim Laden der Historie");
        const data = await res.json();
        return data;
      } catch {
        toast.error("Historie konnte nicht geladen werden");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [akteId]
  );

  // When filter changes, reload from scratch
  useEffect(() => {
    if (filter === "" && initialLogs.length > 0) {
      // Reset to initial data when clearing filter
      setLogs(initialLogs);
      setNextCursor(initialLogs.length >= 50 ? initialLogs[initialLogs.length - 1]?.id ?? null : null);
      setHasMore(initialLogs.length >= 50);
      return;
    }
    let cancelled = false;
    (async () => {
      const data = await fetchLogs(null, filter || undefined);
      if (data && !cancelled) {
        setLogs(data.items);
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      }
    })();
    return () => { cancelled = true; };
  }, [filter, fetchLogs, initialLogs]);

  async function loadMore() {
    if (!nextCursor || loading) return;
    const data = await fetchLogs(nextCursor, filter || undefined);
    if (data) {
      setLogs((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    }
  }

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-slate-400" />
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              filter === opt.value
                ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="glass-card rounded-xl">
        {logs.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
            ) : (
              "Noch keine Einträge in der Historie."
            )}
          </div>
        ) : (
          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[2.15rem] top-4 bottom-4 w-px bg-slate-200 dark:bg-slate-700" />

            <div className="divide-y divide-white/10 dark:divide-white/[0.04]">
              {logs.map((log) => {
                const Icon = aktionIcons[log.aktion] ?? History;
                const colorClasses = aktionColors[log.aktion] ?? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";

                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-4 px-6 py-4 relative"
                  >
                    {/* Timeline dot */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 relative z-10 ${colorClasses}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">
                          {aktionLabels[log.aktion] ?? log.aktion}
                        </p>
                        <span className="text-xs text-slate-400">
                          {formatDateTime(log.createdAt)}
                        </span>
                      </div>

                      {/* Render details based on action type */}
                      <AuditDetails aktion={log.aktion} details={log.details} />

                      <p className="text-xs text-slate-500 mt-1">
                        von {log.user?.name ?? "System"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Load more */}
        {hasMore && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-slate-500"
              onClick={loadMore}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ChevronDown className="w-4 h-4 mr-2" />
              )}
              Mehr laden
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Smart audit detail rendering based on action type
function AuditDetails({ aktion, details }: { aktion: string; details: any }) {
  if (!details || typeof details !== "object") return null;

  // Status change: show old → new with colored badges
  if (aktion === "STATUS_GEAENDERT" && details.alt && details.neu) {
    return (
      <div className="mt-1.5 flex items-center gap-2 text-xs">
        <Badge variant="muted" className="text-[10px] px-2 py-0">
          {statusLabels[details.alt] ?? details.alt}
        </Badge>
        <span className="text-slate-400">→</span>
        <Badge variant="default" className="text-[10px] px-2 py-0">
          {statusLabels[details.neu] ?? details.neu}
        </Badge>
      </div>
    );
  }

  // Field changes with before/after diff
  if (aktion === "AKTE_BEARBEITET" && details.aenderungen && Array.isArray(details.aenderungen)) {
    return (
      <div className="mt-1.5 space-y-1">
        {details.aenderungen.map((change: any, i: number) => (
          <div key={i} className="text-xs flex items-baseline gap-1.5 flex-wrap">
            <span className="font-medium text-foreground/80">
              {change.feld}:
            </span>
            <span className="text-slate-400 line-through">
              {change.alt ?? "—"}
            </span>
            <span className="text-slate-400">→</span>
            <span className="text-slate-700 dark:text-slate-200">
              {change.neu ?? "—"}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Beteiligter add/remove: show name and role
  if (
    (aktion === "BETEILIGTER_HINZUGEFUEGT" || aktion === "BETEILIGTER_ENTFERNT") &&
    details.kontakt
  ) {
    const rolleLabel = rolleLabels[details.rolle] ?? details.rolle;
    return (
      <div className="mt-1 text-xs text-slate-500">
        <span className="text-foreground/80">{details.kontakt}</span>
        {" als "}
        <Badge
          variant={rolleBadgeVariant[details.rolle] ?? "muted"}
          className="text-[10px] px-2 py-0"
        >
          {rolleLabel}
        </Badge>
      </div>
    );
  }

  // Notiz change
  if (aktion === "NOTIZ_GEAENDERT") {
    return (
      <div className="mt-1.5 text-xs space-y-0.5">
        {details.vorher && (
          <p className="text-slate-400 line-through truncate max-w-md">
            {details.vorher}
          </p>
        )}
        {details.nachher && (
          <p className="text-foreground/80 truncate max-w-md">
            {details.nachher}
          </p>
        )}
      </div>
    );
  }

  // Akte created: show aktenzeichen and kurzrubrum
  if (aktion === "AKTE_ERSTELLT") {
    return (
      <div className="mt-1 text-xs text-slate-500">
        {details.aktenzeichen && (
          <span className="font-mono text-foreground/80">
            {details.aktenzeichen}
          </span>
        )}
        {details.kurzrubrum && (
          <span> — {details.kurzrubrum}</span>
        )}
      </div>
    );
  }

  // Generic fallback: key-value pairs
  const entries = Object.entries(details).filter(
    ([, v]) => v !== null && v !== undefined
  );
  if (entries.length === 0) return null;

  return (
    <div className="mt-1 text-xs text-slate-500 space-y-0.5">
      {entries.map(([key, value]) => (
        <div key={key}>
          <span className="text-slate-400">{key}:</span>{" "}
          <span className="text-foreground/80">
            {typeof value === "object" ? JSON.stringify(value) : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── beA Pruefprotokoll Component ────────────────────────────────────────────

const beaAktionLabels: Record<string, string> = {
  BEA_NACHRICHT_GESENDET: "Nachricht gesendet",
  BEA_NACHRICHT_EMPFANGEN: "Nachricht empfangen",
  BEA_EEB_BESTAETIGT: "eEB bestaetigt",
  BEA_NACHRICHT_GELESEN: "Nachricht gelesen",
  BEA_ZUORDNUNG_GEAENDERT: "Zuordnung geaendert",
  BEA_ANHANG_HERUNTERGELADEN: "Anhang heruntergeladen",
};

const beaAktionIcons: Record<string, React.ElementType> = {
  BEA_NACHRICHT_GESENDET: ArrowRightLeft,
  BEA_NACHRICHT_EMPFANGEN: FileUp,
  BEA_EEB_BESTAETIGT: CheckCircle2,
  BEA_NACHRICHT_GELESEN: History,
  BEA_ZUORDNUNG_GEAENDERT: ArrowRightLeft,
  BEA_ANHANG_HERUNTERGELADEN: FileUp,
};

interface BeaAuditEntry {
  id: string;
  aktion: string;
  details: any;
  createdAt: string;
  user: { name: string } | null;
}

function BeaPruefprotokoll({ akteId }: { akteId: string }) {
  const [entries, setEntries] = useState<BeaAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/akten/${akteId}/historie?aktion=BEA_NACHRICHT_GESENDET,BEA_NACHRICHT_EMPFANGEN,BEA_EEB_BESTAETIGT,BEA_NACHRICHT_GELESEN,BEA_ZUORDNUNG_GEAENDERT,BEA_ANHANG_HERUNTERGELADEN&take=100`
        );
        if (res.ok && !cancelled) {
          const data = await res.json();
          setEntries(data.items || []);
        }
      } catch {
        // Ignore
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [akteId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="glass-card rounded-xl p-12 text-center">
        <Shield className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          Keine beA-Aktivitaeten fuer diese Akte.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Chronologisches Pruefprotokoll der beA-Kommunikation fuer diese Akte.
      </p>

      <div className="glass-card rounded-xl">
        <div className="divide-y divide-white/10 dark:divide-white/[0.04]">
          {entries.map((entry) => {
            const Icon = beaAktionIcons[entry.aktion] ?? Shield;
            const details = entry.details || {};
            const isError = details.ergebnis === "FEHLER";

            return (
              <div
                key={entry.id}
                className={`flex items-start gap-4 px-6 py-4 ${
                  isError ? "bg-rose-50/50 dark:bg-rose-950/20" : ""
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isError
                      ? "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400"
                      : "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className={`text-sm font-medium ${isError ? "text-rose-700 dark:text-rose-400" : "text-foreground"}`}>
                      {beaAktionLabels[entry.aktion] ?? entry.aktion}
                    </p>
                    <span className="text-xs text-slate-400">
                      {formatDateTime(entry.createdAt)}
                    </span>
                    {isError && (
                      <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                        FEHLER
                      </span>
                    )}
                  </div>

                  {/* Detail fields */}
                  <div className="mt-1 text-xs text-slate-500 space-y-0.5">
                    {details.betreff && (
                      <div>
                        <span className="text-slate-400">Betreff:</span>{" "}
                        <span className="text-foreground/80">{details.betreff}</span>
                      </div>
                    )}
                    {details.empfaengerSafeId && (
                      <div>
                        <span className="text-slate-400">Empfaenger-SAFE-ID:</span>{" "}
                        <span className="text-foreground/80 font-mono text-[11px]">{details.empfaengerSafeId}</span>
                      </div>
                    )}
                    {details.anhaengeAnzahl !== undefined && details.anhaengeAnzahl > 0 && (
                      <div>
                        <span className="text-slate-400">Anhaenge:</span>{" "}
                        <span className="text-foreground/80">{details.anhaengeAnzahl}</span>
                      </div>
                    )}
                    {details.anhangName && (
                      <div>
                        <span className="text-slate-400">Anhang:</span>{" "}
                        <span className="text-foreground/80">{details.anhangName}</span>
                      </div>
                    )}
                    {details.fehlerMeldung && (
                      <div className="text-rose-600 dark:text-rose-400">
                        <span className="text-rose-500">Fehler:</span> {details.fehlerMeldung}
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 mt-1">
                    von {entry.user?.name ?? "System"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-slate-500 flex-shrink-0">{label}</dt>
      <dd
        className={`text-sm text-foreground text-right ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
