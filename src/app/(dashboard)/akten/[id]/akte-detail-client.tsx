"use client";

import { useState, useCallback } from "react";
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

// Key Facts Panel: compact strip shown above tabs
function KeyFactsPanel({ akte }: { akte: AkteData }) {
  // Find mandant and gegner from beteiligte
  const mandant = akte.beteiligte?.find((b) => b.rolle === "MANDANT");
  const gegner = akte.beteiligte?.find((b) => b.rolle === "GEGNER" || b.rolle === "GEGNERVERTRETER");

  const mandantName = mandant
    ? (mandant.kontakt.firma ?? [mandant.kontakt.vorname, mandant.kontakt.nachname].filter(Boolean).join(" "))
    : null;
  const gegnerName = gegner
    ? (gegner.kontakt.firma ?? [gegner.kontakt.vorname, gegner.kontakt.nachname].filter(Boolean).join(" "))
    : null;

  // Find next upcoming (not erledigt) Termin/Frist
  const now = new Date();
  const nextFrist = akte.kalenderEintraege
    ?.filter((k) => !k.erledigt && new Date(k.datum) >= now)
    .sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime())[0] ?? null;

  const nextFristDate = nextFrist ? new Date(nextFrist.datum) : null;
  const daysUntilFrist = nextFristDate
    ? Math.ceil((nextFristDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const fristWarning = daysUntilFrist !== null && daysUntilFrist <= 7;

  const hasAnyInfo = akte.gegenstandswert || nextFrist || mandantName || gegnerName || akte.sachgebiet;

  if (!hasAnyInfo) return null;

  return (
    <div className="glass-card rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm">
      {/* Gegenstandswert */}
      {akte.gegenstandswert && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Scale className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-xs">Streitwert:</span>
          <span className="font-medium text-foreground">{formatGegenstandswert(akte.gegenstandswert)}</span>
        </div>
      )}

      {/* Sachgebiet */}
      {akte.sachgebiet && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="text-xs">Sachgebiet:</span>
          <span className="font-medium text-foreground text-xs">{akte.sachgebiet}</span>
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

  const handleKpiClick = useCallback((label: string) => {
    if (label === "E-Mails") {
      router.push(`/email?akteId=${akte.id}`);
      return;
    }
    const tab = TAB_MAP[label];
    if (!tab) return;
    setActiveTab(tab);
    // For Zeiterfassung, scroll after tab switch
    if (label === "Zeiterfassung") {
      setTimeout(() => {
        document.getElementById("zeiterfassung-section")
          ?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    }
  }, [router, akte.id]);

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
      />
    </>
  );
}
