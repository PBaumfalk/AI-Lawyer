"use client";

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
} from "lucide-react";
import { EebButton } from "./eeb-button";
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

const statusBadgeConfig: Record<string, { label: string; variant: string }> = {
  EINGANG: { label: "Eingang", variant: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" },
  GELESEN: { label: "Gelesen", variant: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-400" },
  ZUGEORDNET: { label: "Zugeordnet", variant: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" },
  GESENDET: { label: "Gesendet", variant: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400" },
  FEHLER: { label: "Fehler", variant: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400" },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function BeaMessageDetail({ nachricht, suggestions, userRole }: BeaMessageProps) {
  const [eebConfirmed, setEebConfirmed] = useState(nachricht.eebStatus === "BESTAETIGT");
  const statusCfg = statusBadgeConfig[nachricht.status] || statusBadgeConfig.EINGANG;
  const attachments = Array.isArray(nachricht.anhaenge) ? nachricht.anhaenge : [];
  const isIncoming = nachricht.status !== "GESENDET";
  const isAnwalt = userRole === "ANWALT";

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
            Zurueck
          </Link>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusCfg.variant}`}>
            {statusCfg.label}
          </span>
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
              <p className="text-muted-foreground">Empfaenger</p>
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
                {formatDate(nachricht.empfangenAm || nachricht.gesendetAm || nachricht.createdAt)}
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
                  className="font-medium text-brand hover:underline"
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
            Anhaenge ({attachments.length})
          </h2>
          <div className="space-y-2">
            {attachments.map((att: any, idx: number) => (
              <div
                key={att.id || idx}
                className="flex items-center gap-3 rounded-lg border border-border p-3"
              >
                <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{att.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {att.mimeType}
                    {att.size ? ` - ${formatSize(att.size)}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* eEB Section */}
      {isIncoming && nachricht.eebStatus !== "NICHT_ERFORDERLICH" && (
        <div className="glass rounded-xl p-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Empfangsbekenntnis (eEB)
          </h2>
          {eebConfirmed || nachricht.eebStatus === "BESTAETIGT" ? (
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">
                Bestaetigt am {formatDate(nachricht.eebDatum || new Date().toISOString())}
              </span>
            </div>
          ) : isAnwalt ? (
            <EebButton
              messageId={nachricht.id}
              nachrichtenId={nachricht.nachrichtenId || ""}
              onConfirmed={() => setEebConfirmed(true)}
            />
          ) : (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Nur Anwaelte koennen Empfangsbekenntnisse bestaetigen.
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
            <Sparkles className="h-4 w-4 text-violet-500" />
            Helena-Vorschlaege
          </h2>
          <div className="space-y-3">
            {suggestions.map((s) => (
              <div
                key={s.id}
                className="rounded-lg border border-violet-200 dark:border-violet-900 bg-violet-50 dark:bg-violet-950/30 p-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300 text-xs">
                    {s.typ.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(s.createdAt)}
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

  const handleAutoAssign = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bea/auto-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nachrichtId: messageId }),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
    } catch {
      // Ignore
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
        className="inline-flex items-center gap-1 text-xs text-brand hover:underline disabled:opacity-50"
      >
        <Link2 className="h-3 w-3" />
        {loading ? "..." : "Zuordnen"}
      </button>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
