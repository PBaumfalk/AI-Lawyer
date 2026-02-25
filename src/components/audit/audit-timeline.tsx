"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  Loader2,
  History,
  Plus,
  ArrowRightLeft,
  UserPlus,
  UserMinus,
  FileUp,
  FileX,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  StickyNote,
  Mail,
  Shield,
  ShieldAlert,
  Eye,
  Bot,
  Settings,
  CreditCard,
  Landmark,
  UserCog,
  Trash2,
  FileCheck,
} from "lucide-react";
import { AKTION_LABELS, SECURITY_ACTIONS } from "@/lib/audit";

// Icon mapping for action types
const aktionIcons: Record<string, React.ElementType> = {
  AKTE_ERSTELLT: Plus,
  AKTE_BEARBEITET: History,
  AKTE_GEOEFFNET: Eye,
  STATUS_GEAENDERT: ArrowRightLeft,
  BETEILIGTER_HINZUGEFUEGT: UserPlus,
  BETEILIGTER_ENTFERNT: UserMinus,
  DOKUMENT_HOCHGELADEN: FileUp,
  DOKUMENT_GELOESCHT: FileX,
  DOKUMENT_STATUS_GEAENDERT: FileCheck,
  DOKUMENT_ANGESEHEN: Eye,
  FRIST_ERSTELLT: AlertTriangle,
  FRIST_ERLEDIGT: CheckCircle2,
  TERMIN_ERSTELLT: Calendar,
  WIEDERVORLAGE_ERSTELLT: Clock,
  KALENDER_BEARBEITET: Calendar,
  KALENDER_GELOESCHT: Trash2,
  NOTIZ_GEAENDERT: StickyNote,
  AI_TASK_AKTUALISIERT: Bot,
  AI_ENTWURF_ERSTELLT: Bot,
  AI_NOTIZ_ERSTELLT: Bot,
  VERTRETUNG_GESETZT: UserCog,
  VERTRETUNG_AKTIVIERT: UserCog,
  VERTRETUNG_DEAKTIVIERT: UserCog,
  URLAUB_ERSTELLT: Calendar,
  URLAUB_GELOESCHT: Calendar,
  EINSTELLUNGEN_IMPORTIERT: Settings,
  EINSTELLUNGEN_EXPORTIERT: Settings,
  EINSTELLUNG_GEAENDERT: Settings,
  EINSTELLUNG_ZURUECKGESETZT: Settings,
  EMAIL_VERAKTET: Mail,
  EMAIL_VERAKTUNG_AUFGEHOBEN: Mail,
  EMAIL_VERANTWORTLICHER_GESETZT: Mail,
  EMAIL_TICKET_ERSTELLT: Mail,
  RECHNUNG_ERSTELLT: CreditCard,
  RECHNUNG_BEARBEITET: CreditCard,
  RECHNUNG_STATUS_GEAENDERT: CreditCard,
  RECHNUNG_GELOESCHT: CreditCard,
  RVG_BERECHNUNG_GESPEICHERT: Landmark,
  AKTENKONTO_BUCHUNG_ERSTELLT: Landmark,
  AKTENKONTO_STORNO: Landmark,
  BUCHUNGSPERIODE_GESPERRT: Landmark,
  BUCHUNGSPERIODE_ENTSPERRT: Landmark,
  KOSTENSTELLE_ERSTELLT: Landmark,
  KOSTENSTELLE_GEAENDERT: Landmark,
  KOSTENSTELLE_DEAKTIVIERT: Landmark,
  LOGIN_FEHLGESCHLAGEN: ShieldAlert,
  ZUGRIFF_VERWEIGERT: ShieldAlert,
  ADMIN_OVERRIDE_ERSTELLT: Shield,
  ADMIN_OVERRIDE_ENTFERNT: Shield,
  DSGVO_ANONYMISIERT: Shield,
  DSGVO_AUSKUNFT_EXPORTIERT: Shield,
};

export interface AuditItem {
  id: string;
  aktion: string;
  details: any;
  createdAt: string;
  user: { id?: string; name: string; avatarUrl?: string | null; role?: string } | null;
  akte?: { id: string; aktenzeichen: string; kurzrubrum: string } | null;
}

interface AuditTimelineProps {
  items: AuditItem[];
  hasMore: boolean;
  loading?: boolean;
  onLoadMore?: () => void;
  /** Compact mode hides diffs and shows shorter entries (for dashboard widget) */
  compact?: boolean;
  /** Whether to show the Akte link column (hide when already on Akte detail) */
  showAkteLink?: boolean;
}

/**
 * Group audit items by date: Heute, Gestern, or formatted date.
 */
function groupByDate(items: AuditItem[]): Map<string, AuditItem[]> {
  const groups = new Map<string, AuditItem[]>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const item of items) {
    const date = new Date(item.createdAt);
    date.setHours(0, 0, 0, 0);

    let label: string;
    if (date.getTime() === today.getTime()) {
      label = "Heute";
    } else if (date.getTime() === yesterday.getTime()) {
      label = "Gestern";
    } else {
      label = date.toLocaleDateString("de-DE", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }

    const existing = groups.get(label);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(label, [item]);
    }
  }

  return groups;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function UserAvatar({ user }: { user: AuditItem["user"] }) {
  const name = user?.name ?? "System";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={name}
        className="w-8 h-8 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-300">
      {initials}
    </div>
  );
}

function DiffDisplay({ details }: { details: any }) {
  if (!details || typeof details !== "object") return null;

  // Field changes (aenderungen array from computeChanges)
  if (details.aenderungen && Array.isArray(details.aenderungen)) {
    return (
      <div className="mt-1.5 space-y-1 ml-10">
        {details.aenderungen.map((change: any, i: number) => (
          <div key={i} className="text-xs flex items-center gap-1.5 flex-wrap rounded-md bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1.5">
            <span className="font-medium text-foreground/80">{change.feld}:</span>
            <span className="text-rose-500 line-through">{change.alt ?? "—"}</span>
            <span className="text-slate-400">→</span>
            <span className="text-emerald-600 dark:text-emerald-400">{change.neu ?? "—"}</span>
          </div>
        ))}
      </div>
    );
  }

  // Status change
  if (details.alt && details.neu) {
    return (
      <div className="mt-1 flex items-center gap-2 text-xs ml-10">
        <Badge variant="muted" className="text-[10px] px-2 py-0">
          {details.alt}
        </Badge>
        <span className="text-slate-400">→</span>
        <Badge variant="default" className="text-[10px] px-2 py-0">
          {details.neu}
        </Badge>
      </div>
    );
  }

  // Generic key-value fallback
  const entries = Object.entries(details).filter(
    ([k, v]) => v !== null && v !== undefined && k !== "aenderungen"
  );
  if (entries.length === 0) return null;

  return (
    <div className="mt-1 text-xs text-slate-500 ml-10 space-y-0.5">
      {entries.slice(0, 4).map(([key, value]) => (
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

export function AuditTimeline({
  items,
  hasMore,
  loading = false,
  onLoadMore,
  compact = false,
  showAkteLink = true,
}: AuditTimelineProps) {
  const dateGroups = groupByDate(items);

  if (items.length === 0 && !loading) {
    return (
      <div className="p-12 text-center text-sm text-slate-400">
        Keine Audit-Eintraege vorhanden.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Array.from(dateGroups.entries()).map(([dateLabel, groupItems]) => (
        <div key={dateLabel}>
          {/* Date group header */}
          {!compact && (
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-2 py-1.5 mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {dateLabel}
              </span>
            </div>
          )}

          <div className="space-y-0.5">
            {groupItems.map((item) => {
              const isSecurity = SECURITY_ACTIONS.has(item.aktion);
              const Icon = aktionIcons[item.aktion] ?? History;
              const label = AKTION_LABELS[item.aktion] ?? item.aktion;

              return (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${
                    isSecurity ? "bg-rose-50/50 dark:bg-rose-950/20" : ""
                  }`}
                >
                  {/* User avatar */}
                  <UserAvatar user={item.user} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-foreground">
                        {item.user?.name ?? "System"}
                      </span>
                      <span className="text-sm text-slate-500">{label}</span>

                      {/* Akte link */}
                      {showAkteLink && item.akte && (
                        <Link
                          href={`/akten/${item.akte.id}`}
                          className="text-xs text-brand-600 hover:underline font-mono"
                        >
                          {item.akte.aktenzeichen}
                        </Link>
                      )}

                      {/* Security badge */}
                      {isSecurity && (
                        <Badge variant="danger" className="text-[10px] px-1.5 py-0">
                          Sicherheit
                        </Badge>
                      )}

                      {/* Timestamp */}
                      <span className="text-xs text-slate-400 ml-auto whitespace-nowrap">
                        {formatTime(item.createdAt)}
                      </span>
                    </div>

                    {/* Diff display (only in non-compact mode) */}
                    {!compact && <DiffDisplay details={item.details} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Loading indicator */}
      {loading && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      )}

      {/* Load more button */}
      {hasMore && onLoadMore && !loading && (
        <div className="px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-slate-500"
            onClick={onLoadMore}
          >
            <ChevronDown className="w-4 h-4 mr-2" />
            Mehr laden
          </Button>
        </div>
      )}
    </div>
  );
}
