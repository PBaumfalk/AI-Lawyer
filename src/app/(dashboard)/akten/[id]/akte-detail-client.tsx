"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users,
  FileText,
  Calendar,
  Clock,
  MessageSquare,
  Mail,
  AlertTriangle,
  Scale,
  Building2,
} from "lucide-react";
import { AkteDetailTabs, type AkteData } from "@/components/akten/akte-detail-tabs";
import { cn } from "@/lib/utils";

interface StatMiniProps {
  icon: React.ElementType;
  label: string;
  value: number;
  onClick?: () => void;
}

function StatMini({ icon: Icon, label, value, onClick }: StatMiniProps) {
  return (
    <div
      className={`glass-card rounded-xl px-4 py-3 flex items-center gap-3 ${
        onClick
          ? "cursor-pointer hover:bg-white/70 dark:hover:bg-white/[0.08] transition-colors"
          : ""
      }`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <Icon className="w-4 h-4 text-muted-foreground" />
      <div>
        <p className="text-lg font-semibold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// Map KPI labels to tab values
const TAB_MAP: Record<string, string> = {
  "Beteiligte": "feed",
  "Dokumente": "dokumente",
  "Termine/Fristen": "kalender",
  "Zeiterfassung": "finanzen",
  "Chat": "nachrichten",
};

// Format Gegenstandswert as Euro
function formatGegenstandswert(value: string | null): string {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(num);
}

// Human-readable German labels for AkteStatus values
const STATUS_LABELS: Record<string, string> = {
  OFFEN: "Offen",
  RUHEND: "Ruhend",
  ARCHIVIERT: "Archiviert",
};

// Key Facts Panel: compact strip shown above tabs
function KeyFactsPanel({ akte }: { akte: AkteData }) {
  // Find mandant and gegner from beteiligte
  const mandant = akte.beteiligte?.find((b) => b.rolle === "MANDANT");
  const gegner = akte.beteiligte?.find((b) => b.rolle === "GEGNER" || b.rolle === "GEGNERVERTRETER");
  const gerichtBeteiligter = akte.beteiligte?.find((b) => b.rolle === "GERICHT");

  const mandantName = mandant
    ? (mandant.kontakt.firma ?? [mandant.kontakt.vorname, mandant.kontakt.nachname].filter(Boolean).join(" "))
    : null;
  const gegnerName = gegner
    ? (gegner.kontakt.firma ?? [gegner.kontakt.vorname, gegner.kontakt.nachname].filter(Boolean).join(" "))
    : null;
  const gerichtName = gerichtBeteiligter
    ? (gerichtBeteiligter.kontakt.firma ??
       [gerichtBeteiligter.kontakt.vorname, gerichtBeteiligter.kontakt.nachname]
         .filter(Boolean).join(" "))
    : null;

  // Human-readable status label
  const statusLabel = STATUS_LABELS[akte.status] ?? akte.status;

  // Find next upcoming (not erledigt) Termin/Frist — compare at day
  // granularity so a Frist due today is not filtered out after midnight.
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const openEintraege = (akte.kalenderEintraege ?? []).filter((k) => !k.erledigt);
  const nextFrist = openEintraege
    .filter((k) => new Date(k.datum) >= startOfToday)
    .sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime())[0] ?? null;
  // Most recent overdue Frist — surfaced when nothing is upcoming, so an
  // expired deadline never silently disappears from the Key-Facts strip.
  const overdueFrist = nextFrist
    ? null
    : openEintraege
        .filter((k) => new Date(k.datum) < startOfToday)
        .sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime())[0] ?? null;

  const nextFristDate = nextFrist ? new Date(nextFrist.datum) : null;
  const daysUntilFrist = nextFristDate
    ? Math.max(0, Math.ceil((nextFristDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;
  const fristWarning = daysUntilFrist !== null && daysUntilFrist <= 7;
  // Overdue duration at day granularity: all-day KalenderEintraege are
  // serialized at UTC midnight (01:00/02:00 local in Europe/Berlin), so a
  // raw ms diff + Math.floor undercounts by one day. Normalize the Frist
  // date to its local day before diffing, matching startOfToday.
  const overdueFristDate = overdueFrist ? new Date(overdueFrist.datum) : null;
  const overdueDays = overdueFristDate
    ? Math.round(
        (startOfToday.getTime() -
          new Date(overdueFristDate.getFullYear(), overdueFristDate.getMonth(), overdueFristDate.getDate()).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  const hasAnyInfo = akte.gegenstandswert || nextFrist || overdueFrist || mandantName || gegnerName || akte.sachgebiet || gerichtName || akte.status;

  if (!hasAnyInfo) return null;

  return (
    <div className="glass-card rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm sticky top-2 z-10">
      {/* Gegenstandswert */}
      {akte.gegenstandswert && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Scale className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-xs">Gegenstandswert:</span>
          <span className="font-medium text-foreground">{formatGegenstandswert(akte.gegenstandswert)}</span>
        </div>
      )}

      {/* Phase / Status */}
      {akte.status && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="text-xs">Phase:</span>
          <span className="font-medium text-foreground text-xs">{statusLabel}</span>
        </div>
      )}

      {/* Sachgebiet */}
      {akte.sachgebiet && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="text-xs">Sachgebiet:</span>
          <span className="font-medium text-foreground text-xs">{akte.sachgebiet}</span>
        </div>
      )}

      {/* Gericht */}
      {gerichtName && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-xs">Gericht:</span>
          <span className="font-medium text-foreground text-xs">{gerichtName}</span>
        </div>
      )}

      {/* Naechste Frist */}
      {nextFrist && nextFristDate && (
        <div className={cn("flex items-center gap-1.5", fristWarning ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
          {fristWarning && <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />}
          {!fristWarning && <Calendar className="w-3.5 h-3.5 flex-shrink-0" />}
          <span className="text-xs">Naechste Frist:</span>
          <span className={cn("font-medium text-xs", fristWarning ? "text-amber-700 dark:text-amber-300" : "text-foreground")}>
            {nextFrist.titel} &middot; {nextFristDate.toLocaleDateString("de-DE")}
            {daysUntilFrist !== null && daysUntilFrist <= 14 && (
              <span className="ml-1 text-xs">({daysUntilFrist === 0 ? "heute" : daysUntilFrist === 1 ? "morgen" : `${daysUntilFrist} Tage`})</span>
            )}
          </span>
        </div>
      )}

      {/* Ueberfaellige Frist (only when nothing upcoming) */}
      {overdueFrist && overdueDays !== null && (
        <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-xs">Ueberfaellig:</span>
          <span className="font-medium text-xs text-rose-700 dark:text-rose-300">
            {overdueFrist.titel} &middot; {new Date(overdueFrist.datum).toLocaleDateString("de-DE")}
            <span className="ml-1 text-xs">
              (seit {overdueDays} {overdueDays === 1 ? "Tag" : "Tagen"})
            </span>
          </span>
        </div>
      )}

      {/* Mandant */}
      {mandantName && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="text-xs">Mandant:</span>
          <span className="font-medium text-foreground text-xs">{mandantName}</span>
        </div>
      )}

      {/* Gegner */}
      {gegnerName && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="text-xs">Gegner:</span>
          <span className="font-medium text-foreground text-xs">{gegnerName}</span>
        </div>
      )}
    </div>
  );
}

const VALID_TABS = new Set([
  "feed", "dokumente", "kalender", "finanzen",
  "falldaten", "zusammenfassung", "nachrichten", "portal-nachrichten",
]);

interface AkteDetailClientProps {
  akte: AkteData;
}

export function AkteDetailClient({ akte }: AkteDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (() => {
    const t = searchParams.get("tab");
    return t && VALID_TABS.has(t) ? t : "feed";
  })();
  const [activeTab, setActiveTab] = useState(initialTab);

  // Guarded tab-change handler registered by AkteDetailTabs — routes KPI
  // clicks through the Falldaten unsaved-changes guard (CR-01).
  const tabChangeRef = useRef<(tab: string) => void>(() => {});
  // Guarded generic-navigation handler registered by AkteDetailTabs —
  // routes soft navigations (router.push) through the same dirty guard,
  // because beforeunload does not fire on App Router client-side
  // navigation (WR-01).
  const guardedNavRef = useRef<(action: () => void) => void>(
    (action) => action()
  );

  const handleKpiClick = useCallback((label: string) => {
    if (label === "E-Mails") {
      guardedNavRef.current(() => router.push(`/email?akteId=${akte.id}`));
      return;
    }
    const tab = TAB_MAP[label];
    if (!tab) return;
    tabChangeRef.current(tab);
    // For Zeiterfassung, scroll after tab switch
    if (label === "Zeiterfassung") {
      setTimeout(() => {
        document.getElementById("zeiterfassung-section")
          ?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    }
  }, [router, akte.id]);

  // Sync ?tab= search param on client-side navigations to the same route
  // (the useState initializer only honors it on the first mount). Routed
  // through the guarded handler so the Falldaten dirty guard still applies.
  const paramTab = searchParams.get("tab");
  useEffect(() => {
    if (paramTab && VALID_TABS.has(paramTab)) {
      tabChangeRef.current(paramTab);
    }
  }, [paramTab]);

  const chatCount = akte._count?.chatNachrichten ?? 0;

  return (
    <>
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <StatMini
          icon={Users}
          label="Beteiligte"
          value={akte.beteiligte?.length ?? 0}
          onClick={() => handleKpiClick("Beteiligte")}
        />
        <StatMini
          icon={FileText}
          label="Dokumente"
          value={akte._count?.dokumente ?? 0}
          onClick={() => handleKpiClick("Dokumente")}
        />
        <StatMini
          icon={Calendar}
          label="Termine/Fristen"
          value={akte._count?.kalenderEintraege ?? 0}
          onClick={() => handleKpiClick("Termine/Fristen")}
        />
        <StatMini
          icon={Mail}
          label="E-Mails"
          value={akte._count?.emailMessages ?? 0}
          onClick={() => handleKpiClick("E-Mails")}
        />
        <StatMini
          icon={Clock}
          label="Zeiterfassung"
          value={akte._count?.zeiterfassungen ?? 0}
          onClick={() => handleKpiClick("Zeiterfassung")}
        />
        {/* Chat KPI only shown when there are actual messages */}
        {chatCount > 0 && (
          <StatMini
            icon={MessageSquare}
            label="Chat"
            value={chatCount}
            onClick={() => handleKpiClick("Chat")}
          />
        )}
      </div>

      {/* Key-Facts Panel: compact context strip above tabs */}
      <KeyFactsPanel akte={akte} />

      {/* Tabbed content */}
      <AkteDetailTabs
        akte={akte}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        registerTabChange={(fn) => {
          tabChangeRef.current = fn;
        }}
        registerGuardedNavigation={(fn) => {
          guardedNavRef.current = fn;
        }}
      />
    </>
  );
}
