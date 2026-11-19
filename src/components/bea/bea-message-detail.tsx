"use client";

import { beaAutoZuordnen } from "@/lib/bea/zuordnung";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  User,
  Calendar,
  FileText,
  FolderOpen,
  Link2,
  Sparkles,
  Paperclip,
  CheckCircle2,
  Download,
} from "lucide-react";
import { EebButton } from "./eeb-button";
import { Hinweis, formatDatumZeit } from "./bea-status";
import { PruefprotokollViewer } from "./pruefprotokoll-viewer";
import { XJustizViewer } from "./xjustiz-viewer";
import { Badge } from "@/components/ui/badge";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BeaMessageProps {
  nachricht: {
    id: string;
    nachrichtenId: string | null;
    betreff: string;
    absender: string;
    empfaenger: string;
    inhalt: string | null;
    status: string;
    richtung: "EINGANG" | "AUSGANG";
    eebAngefordert: boolean;
    safeIdAbsender: string | null;
    safeIdEmpfaenger: string | null;
    pruefprotokoll: any;
    anhaenge: any;
    xjustizData: any;
    eebStatus: string | null;
    eebDatum: string | null;
    empfangenAm: string | null;
    gesendetAm: string | null;
    createdAt: string;
    akte: { id: string; aktenzeichen: string; kurzrubrum: string } | null;
  };
  suggestions: Array<{
    id: string;
    typ: string;
    titel: string;
    inhalt: string;
    status: string;
    createdAt: string;
  }>;
  userRole: string;
}

// ─── Status Config ───────────────────────────────────────────────────────────

type BadgeVariant = "default" | "secondary" | "success" | "danger" | "muted";

const statusBadgeConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  EINGANG: { label: "Eingang", variant: "default" },
  GELESEN: { label: "Gelesen", variant: "muted" },
  ZUGEORDNET: { label: "Zugeordnet", variant: "success" },
  GESENDET: { label: "Gesendet", variant: "secondary" },
  FEHLER: { label: "Fehler", variant: "danger" },
};

/** Attachment entry in BeaNachricht.anhaenge. */
interface Anhang {
  id?: string;
  name: string;
  storageKey?: string;
  mimeType?: string;
  groesse?: number;
  art?: string | null;
  dokumentId?: string;
}

/** Download URL: stored beA file via the message route, else the Akte document. */
function anhangUrl(nachrichtId: string, a: Anhang): string | null {
  if (a.id && a.storageKey) {
    return `/api/bea/messages/${encodeURIComponent(nachrichtId)}?download=${encodeURIComponent(a.id)}`;
  }
  if (a.dokumentId) return `/api/dokumente/${encodeURIComponent(a.dokumentId)}?download=true`;
  return null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BeaMessageDetail({ nachricht, suggestions, userRole }: BeaMessageProps) {
  const [eeb, setEeb] = useState<{ status: string | null; datum: string | null; warnung?: string }>({
    status: nachricht.eebStatus,
    datum: nachricht.eebDatum,
  });
  const statusCfg = statusBadgeConfig[nachricht.status] || statusBadgeConfig.EINGANG;
  const attachments: Anhang[] = Array.isArray(nachricht.anhaenge) ? nachricht.anhaenge : [];
  const isIncoming = nachricht.richtung !== "AUSGANG";
  const isAnwalt = userRole === "ANWALT";
  const zeigeEeb =
    isIncoming &&
    eeb.status !== "NICHT_ERFORDERLICH" &&
    (nachricht.eebAngefordert || (eeb.status !== null && eeb.status !== undefined));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/bea"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </Link>
          <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
        </div>
      </div>

      {/* Message Header Card */}
      <div className="glass rounded-xl p-6 space-y-4">
        <h1 className="text-xl font-heading text-foreground">{nachricht.betreff}</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <User className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-muted-foreground">Absender</p>
              <p className="font-medium text-foreground">{nachricht.absender}</p>
              {nachricht.safeIdAbsender && (
                <p className="text-xs text-muted-foreground">SAFE-ID: {nachricht.safeIdAbsender}</p>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-muted-foreground">Empfänger</p>
              <p className="font-medium text-foreground">{nachricht.empfaenger}</p>
              {nachricht.safeIdEmpfaenger && (
                <p className="text-xs text-muted-foreground">SAFE-ID: {nachricht.safeIdEmpfaenger}</p>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-muted-foreground">Datum</p>
              <p className="font-medium text-foreground">
                {formatDatumZeit(nachricht.empfangenAm || nachricht.gesendetAm || nachricht.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-muted-foreground">Akte</p>
              {nachricht.akte ? (
                <Link
                  href={`/akten/${nachricht.akte.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {nachricht.akte.aktenzeichen} - {nachricht.akte.kurzrubrum}
                </Link>
              ) : (
                <AssignButton messageId={nachricht.id} />
              )}
            </div>
          </div>
        </div>
      </div>

      {isIncoming && (
        <Hinweis art="info">Der Abruf über AI-Lawyer gilt im beA nicht als gelesen.</Hinweis>
      )}

      {/* Content */}
      {nachricht.inhalt && (
        <div className="glass rounded-xl p-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Nachrichteninhalt</h2>
          <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
            {nachricht.inhalt}
          </div>
        </div>
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="glass rounded-xl p-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
            <Paperclip className="h-4 w-4" />
            Anhänge ({attachments.length})
          </h2>
          <div className="space-y-2">
            {attachments.map((att, idx) => {
              const url = anhangUrl(nachricht.id, att);
              return (
                <div
                  key={att.id || att.dokumentId || idx}
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{att.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[att.art === "SCHRIFTSATZ" ? "Schriftsatz" : null, att.mimeType, typeof att.groesse === "number" ? formatSize(att.groesse) : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {url && (
                    <a
                      href={url}
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline flex-shrink-0"
                    >
                      <Download className="h-4 w-4" />
                      Herunterladen
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* eEB Section */}
      {zeigeEeb && (
        <div className="glass rounded-xl p-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Empfangsbekenntnis (eEB)
          </h2>
          {eeb.status === "BESTAETIGT" ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-medium">Abgegeben am {formatDatum(eeb.datum)}</span>
              </div>
              {eeb.warnung && <Hinweis art="warnung">{eeb.warnung}</Hinweis>}
            </div>
          ) : isAnwalt ? (
            <EebButton
              messageId={nachricht.id}
              eebStatus={eeb.status}
              onConfirmed={({ eebDatum, warnung }) => setEeb({ status: "BESTAETIGT", datum: eebDatum, warnung })}
            />
          ) : eeb.status === "WIRD_ABGEGEBEN" ? (
            <Hinweis art="warnung">Abgabe unklar – bitte im beA-Webclient prüfen</Hinweis>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nur Anwältinnen und Anwälte können Empfangsbekenntnisse abgeben.
            </p>
          )}
        </div>
      )}

      {/* Pruefprotokoll */}
      {nachricht.pruefprotokoll && (
        <PruefprotokollViewer data={nachricht.pruefprotokoll} />
      )}

      {/* XJustiz Viewer */}
      {nachricht.xjustizData && (
        <XJustizViewer data={nachricht.xjustizData} />
      )}

      {/* Helena Suggestions */}
      {suggestions.length > 0 && (
        <div className="glass rounded-xl p-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
            Helena-Vorschläge
          </h2>
          <div className="space-y-3">
            {suggestions.map((s) => (
              <div
                key={s.id}
                className="rounded-lg border border-border bg-muted p-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="text-xs">
                    {s.typ.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDatumZeit(s.createdAt)}
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground">{s.titel}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Assign Button ───────────────────────────────────────────────────────────

function AssignButton({ messageId }: { messageId: string }) {
  const [loading, setLoading] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const handleAutoAssign = async () => {
    setLoading(true);
    setFehler(null);
    try {
      const r = await beaAutoZuordnen(messageId);
      if (r.zugeordnet) {
        window.location.reload();
        return;
      }
      if (r.meldung) setFehler(r.meldung);
    } catch {
      setFehler("Zuordnung fehlgeschlagen");
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-amber-600 dark:text-amber-400 font-medium">
        Nicht zugeordnet
      </span>
      <button
        onClick={handleAutoAssign}
        disabled={loading}
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
      >
        <Link2 className="h-3 w-3" />
        {loading ? "…" : "Zuordnen"}
      </button>
      {fehler && <span className="text-xs text-destructive">{fehler}</span>}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDatum(dateStr: string | null): string {
  if (!dateStr) return "–";
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime())
    ? dateStr
    : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
