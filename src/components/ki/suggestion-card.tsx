"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Users,
  Mail,
  FileText,
  Lightbulb,
  Sun,
  ThumbsUp,
  ThumbsDown,
  Check,
  X,
  Edit3,
  ChevronDown,
  ChevronUp,
  FolderOpen,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SuggestionAkte {
  id: string;
  aktenzeichen: string;
  kurzrubrum: string;
}

export interface SuggestionData {
  id: string;
  typ: string;
  titel: string;
  inhalt: string;
  status: string;
  feedback: string | null;
  linkedId: string | null;
  akteId: string | null;
  akte: SuggestionAkte | null;
  createdAt: string;
  readAt: string | null;
}

interface SuggestionCardProps {
  suggestion: SuggestionData;
  onStatusChange?: (id: string, status: string, linkedId?: string) => void;
}

// ---------------------------------------------------------------------------
// Icon map per suggestion type
// ---------------------------------------------------------------------------

const typIcons: Record<string, React.ElementType> = {
  FRIST_ERKANNT: Calendar,
  BETEILIGTE_ERKANNT: Users,
  ANTWORT_ENTWURF: Mail,
  DOKUMENT_KLASSIFIZIERT: FileText,
  HINWEIS: Lightbulb,
  BRIEFING: Sun,
  TERMIN_VORSCHLAG: Calendar,
};

const typColors: Record<string, string> = {
  FRIST_ERKANNT: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
  BETEILIGTE_ERKANNT: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  ANTWORT_ENTWURF: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  DOKUMENT_KLASSIFIZIERT: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400",
  HINWEIS: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  BRIEFING: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
  TERMIN_VORSCHLAG: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
};

const typLabels: Record<string, string> = {
  FRIST_ERKANNT: "Frist",
  BETEILIGTE_ERKANNT: "Beteiligte",
  ANTWORT_ENTWURF: "Antwort-Entwurf",
  DOKUMENT_KLASSIFIZIERT: "Klassifizierung",
  HINWEIS: "Hinweis",
  BRIEFING: "Briefing",
  TERMIN_VORSCHLAG: "Termin",
};

const statusBadges: Record<string, { label: string; className: string }> = {
  NEU: {
    label: "Neu",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 animate-pulse",
  },
  UEBERNOMMEN: {
    label: "Uebernommen",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  },
  ABGELEHNT: {
    label: "Abgelehnt",
    className: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 line-through",
  },
  BEARBEITET: {
    label: "Bearbeitet",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SuggestionCard({ suggestion, onStatusChange }: SuggestionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState(suggestion.feedback);

  const Icon = typIcons[suggestion.typ] || Lightbulb;
  const iconColor = typColors[suggestion.typ] || typColors.HINWEIS;
  const statusBadge = statusBadges[suggestion.status] || statusBadges.NEU;
  const typLabel = typLabels[suggestion.typ] || suggestion.typ;

  const timeAgo = formatDistanceToNow(new Date(suggestion.createdAt), {
    addSuffix: true,
    locale: de,
  });

  // Try to parse and pretty-print JSON inhalt, fall back to plain text
  let displayContent = suggestion.inhalt;
  try {
    const parsed = JSON.parse(suggestion.inhalt);
    if (Array.isArray(parsed)) {
      // Party array
      displayContent = parsed
        .map(
          (p: any) =>
            `${p.name} (${p.rolle}, ${p.typ === "JURISTISCH" ? "jur. Person" : "nat. Person"})${p.adresse ? ` - ${p.adresse}` : ""}`
        )
        .join("\n");
    } else if (parsed.beschreibung) {
      // Deadline object
      displayContent = [
        parsed.beschreibung,
        parsed.datum ? `Datum: ${parsed.datum}` : null,
        parsed.dauer ? `Dauer: ${parsed.dauer}` : null,
        parsed.gesetzlicheGrundlage ? `Grundlage: ${parsed.gesetzlicheGrundlage}` : null,
        parsed.quellenStelle ? `\nFundstelle: "${parsed.quellenStelle}"` : null,
      ]
        .filter(Boolean)
        .join("\n");
    }
  } catch {
    // Use raw text
  }

  // Truncate for preview
  const previewLength = 150;
  const needsExpand = displayContent.length > previewLength;
  const preview = needsExpand && !expanded
    ? displayContent.slice(0, previewLength) + "..."
    : displayContent;

  async function handleAction(status: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/helena/suggestions/${suggestion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Aktion fehlgeschlagen");
        return;
      }

      const data = await res.json();

      if (status === "UEBERNOMMEN") {
        const linkedType = data.linkedType;
        const messages: Record<string, string> = {
          KalenderEintrag: "Frist wurde in den Kalender uebernommen",
          Beteiligter: "Beteiligter wurde zur Akte hinzugefuegt",
          ChatNachricht: "Entwurf wurde gespeichert",
        };
        toast.success(messages[linkedType] || "Vorschlag uebernommen");
      } else if (status === "ABGELEHNT") {
        toast.info("Vorschlag abgelehnt");
      }

      onStatusChange?.(suggestion.id, status, data.linkedId);
    } catch {
      toast.error("Aktion fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  async function handleFeedback(feedback: string) {
    try {
      const res = await fetch(`/api/helena/suggestions/${suggestion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });

      if (res.ok) {
        setCurrentFeedback(feedback);
      }
    } catch {
      // Silent fail for feedback
    }
  }

  return (
    <div className="bg-white/50 dark:bg-white/[0.05] backdrop-blur-md rounded-xl border border-white/20 dark:border-white/[0.08] overflow-hidden transition-shadow hover:shadow-md">
      <div className="px-5 py-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          {/* Type icon */}
          <div
            className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${iconColor}`}
          >
            <Icon className="w-4.5 h-4.5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge className={`text-[10px] ${statusBadge.className}`}>
                {statusBadge.label}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {typLabel}
              </Badge>
              {suggestion.akte && (
                <Link href={`/akten/${suggestion.akte.id}`}>
                  <Badge
                    variant="outline"
                    className="text-[10px] gap-1 cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-950/30"
                  >
                    <FolderOpen className="w-2.5 h-2.5" />
                    {suggestion.akte.aktenzeichen}
                  </Badge>
                </Link>
              )}
              <span className="text-[11px] text-muted-foreground ml-auto flex-shrink-0">
                {timeAgo}
              </span>
            </div>

            {/* Title */}
            <p className="text-sm font-medium text-foreground mb-1">
              {suggestion.titel}
            </p>

            {/* Content preview */}
            <div className="text-sm text-foreground/70 whitespace-pre-wrap">
              {preview}
            </div>

            {needsExpand && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 mt-1 hover:underline"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" /> Weniger anzeigen
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" /> Mehr anzeigen
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Actions row */}
        {suggestion.status === "NEU" && (
          <div className="flex items-center gap-2 mt-3 ml-12">
            <Button
              size="sm"
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => handleAction("UEBERNOMMEN")}
              disabled={loading}
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              Uebernehmen
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/30"
              onClick={() => handleAction("ABGELEHNT")}
              disabled={loading}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Ablehnen
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-brand-600 border-brand-200 hover:bg-brand-50 dark:border-brand-800 dark:hover:bg-brand-950/30"
              onClick={() => handleAction("BEARBEITET")}
              disabled={loading}
            >
              <Edit3 className="w-3.5 h-3.5 mr-1" />
              Bearbeiten
            </Button>

            {/* Feedback */}
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => handleFeedback("POSITIV")}
                className={`p-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors ${
                  currentFeedback === "POSITIV" ? "text-emerald-600" : "text-slate-400"
                }`}
                title="Guter Vorschlag"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleFeedback("NEGATIV")}
                className={`p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors ${
                  currentFeedback === "NEGATIV" ? "text-rose-600" : "text-slate-400"
                }`}
                title="Schlechter Vorschlag"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Show feedback for already-processed suggestions */}
        {suggestion.status !== "NEU" && (
          <div className="flex items-center gap-1 mt-2 ml-12">
            <button
              onClick={() => handleFeedback("POSITIV")}
              className={`p-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors ${
                currentFeedback === "POSITIV" ? "text-emerald-600" : "text-slate-400"
              }`}
              title="Guter Vorschlag"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleFeedback("NEGATIV")}
              className={`p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors ${
                currentFeedback === "NEGATIV" ? "text-rose-600" : "text-slate-400"
              }`}
              title="Schlechter Vorschlag"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
