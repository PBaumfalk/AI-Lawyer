"use client";

import { useState } from "react";
import {
  FileText,
  Clock,
  Calendar,
  MessageSquare,
  Gavel,
  MoreHorizontal,
  RefreshCw,
  Sparkles,
  Loader2,
  AlertCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types (re-defined locally to avoid server import boundary issues)
// ---------------------------------------------------------------------------

interface TimelineEvent {
  datum: string;
  titel: string;
  beschreibung: string;
  typ:
    | "DOKUMENT"
    | "FRIST"
    | "TERMIN"
    | "KOMMUNIKATION"
    | "ENTSCHEIDUNG"
    | "SONSTIGES";
  quellDokument?: string;
}

interface KeyFact {
  label: string;
  value: string;
  kategorie: "PARTEI" | "VERFAHREN" | "FINANZEN" | "FRIST" | "SONSTIGES";
}

interface CaseSummary {
  zusammenfassung: string;
  timeline: TimelineEvent[];
  keyFacts: KeyFact[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const typIcons: Record<TimelineEvent["typ"], typeof FileText> = {
  DOKUMENT: FileText,
  FRIST: Clock,
  TERMIN: Calendar,
  KOMMUNIKATION: MessageSquare,
  ENTSCHEIDUNG: Gavel,
  SONSTIGES: MoreHorizontal,
};

const typLabels: Record<TimelineEvent["typ"], string> = {
  DOKUMENT: "Dokument",
  FRIST: "Frist",
  TERMIN: "Termin",
  KOMMUNIKATION: "Kommunikation",
  ENTSCHEIDUNG: "Entscheidung",
  SONSTIGES: "Sonstiges",
};

const kategorieLabels: Record<KeyFact["kategorie"], string> = {
  PARTEI: "Parteien",
  VERFAHREN: "Verfahren",
  FINANZEN: "Finanzen",
  FRIST: "Fristen",
  SONSTIGES: "Sonstiges",
};

function formatDateGerman(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString("de-DE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CaseSummaryPanelProps {
  akteId: string;
}

export function CaseSummaryPanel({ akteId }: CaseSummaryPanelProps) {
  const [summary, setSummary] = useState<CaseSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/akten/${akteId}/zusammenfassung`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error || `Fehler beim Laden (${res.status})`
        );
      }
      const data = await res.json();
      setSummary(data.summary);
    } catch (err: any) {
      setError(err.message || "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  };

  // ── Initial state: show generate button ──────────────────────────────────

  if (!summary && !loading && !error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <Sparkles className="w-12 h-12 text-muted-foreground" />
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            KI-Fallzusammenfassung
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Helena analysiert alle Dokumente, Fristen und Beteiligten dieser
            Akte und erstellt eine strukturierte Zusammenfassung mit Timeline
            und Eckdaten.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchSummary}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Zusammenfassung generieren
        </button>
      </div>
    );
  }

  // ── Loading state: skeleton ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Summary skeleton */}
        <div className="glass rounded-xl p-6 space-y-3">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-5/6" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Timeline skeleton */}
          <div className="lg:col-span-2 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted rounded w-24" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                  <div className="h-3 bg-muted rounded w-full" />
                </div>
              </div>
            ))}
          </div>

          {/* Key facts skeleton */}
          <div className="glass rounded-xl p-6 space-y-4">
            <div className="h-5 bg-muted rounded w-24" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 bg-muted rounded w-20" />
                <div className="h-4 bg-muted rounded w-32" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Helena analysiert die Akte...
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            Fehler bei der Analyse
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">{error}</p>
        </div>
        <button
          type="button"
          onClick={fetchSummary}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Erneut versuchen
        </button>
      </div>
    );
  }

  if (!summary) return null;

  // ── Sort timeline ascending ──────────────────────────────────────────────

  const sortedTimeline = [...summary.timeline].sort(
    (a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime()
  );

  // ── Group key facts by kategorie ─────────────────────────────────────────

  const groupedFacts = summary.keyFacts.reduce(
    (acc, fact) => {
      if (!acc[fact.kategorie]) acc[fact.kategorie] = [];
      acc[fact.kategorie].push(fact);
      return acc;
    },
    {} as Record<string, KeyFact[]>
  );

  const kategorieOrder: KeyFact["kategorie"][] = [
    "PARTEI",
    "VERFAHREN",
    "FINANZEN",
    "FRIST",
    "SONSTIGES",
  ];

  // ── Render summary ──────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Fallzusammenfassung
        </h3>
        <button
          type="button"
          onClick={fetchSummary}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Neu generieren
        </button>
      </div>

      {/* Zusammenfassung text */}
      <div className="glass rounded-xl p-6">
        <p className="text-sm text-foreground leading-relaxed">
          {summary.zusammenfassung}
        </p>
        <p className="text-xs text-muted-foreground mt-3">
          Generiert am {formatDateGerman(summary.generatedAt)}
        </p>
      </div>

      {/* Two-column layout: Timeline + Key Facts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline (left, wider) */}
        <div className="lg:col-span-2">
          <h4 className="text-sm font-semibold text-foreground mb-4">
            Timeline
          </h4>

          {sortedTimeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine Ereignisse gefunden.
            </p>
          ) : (
            <div className="relative">
              {/* Connecting line */}
              <div className="absolute left-5 top-3 bottom-3 w-px bg-border" />

              <div className="space-y-4">
                {sortedTimeline.map((event, idx) => {
                  const Icon = typIcons[event.typ] || MoreHorizontal;

                  return (
                    <div key={idx} className="relative flex gap-4">
                      {/* Icon circle */}
                      <div className="relative z-10 flex items-center justify-center w-10 h-10 rounded-full glass border border-border shrink-0">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 glass rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-primary bg-primary/10 rounded px-2 py-0.5">
                            {formatDateGerman(event.datum)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {typLabels[event.typ]}
                          </span>
                        </div>
                        <h5 className="text-sm font-semibold text-foreground">
                          {event.titel}
                        </h5>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {event.beschreibung}
                        </p>
                        {event.quellDokument && (
                          <p className="text-xs text-primary mt-1.5 flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {event.quellDokument}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Key Facts (right, narrower) */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-4">
            Eckdaten
          </h4>

          <div className="glass rounded-xl p-6 space-y-5">
            {kategorieOrder.map((kat) => {
              const facts = groupedFacts[kat];
              if (!facts || facts.length === 0) return null;

              return (
                <div key={kat}>
                  <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    {kategorieLabels[kat]}
                  </h5>
                  <div className="space-y-2">
                    {facts.map((fact, idx) => (
                      <div key={idx}>
                        <span className="text-xs text-muted-foreground">
                          {fact.label}
                        </span>
                        <p className="text-sm font-medium text-foreground">
                          {fact.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {summary.keyFacts.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Keine Eckdaten extrahiert.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
