"use client";

import { useState, useCallback } from "react";
import {
  Users,
  FileText,
  Calendar,
  Clock,
  MessageSquare,
  Mail,
} from "lucide-react";
import { AkteDetailTabs, type AkteData } from "@/components/akten/akte-detail-tabs";

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
  "E-Mails": "email",
  "Zeiterfassung": "finanzen",
  "Chat": "nachrichten",
};

interface AkteDetailClientProps {
  akte: AkteData;
}

export function AkteDetailClient({ akte }: AkteDetailClientProps) {
  const [activeTab, setActiveTab] = useState("feed");

  const handleKpiClick = useCallback((label: string) => {
    const tab = TAB_MAP[label];
    if (!tab) return;
    // E-Mails has no tab in AkteDetailTabs -- ignore click
    if (label === "E-Mails") return;
    setActiveTab(tab);
    // For Zeiterfassung, scroll after tab switch
    if (label === "Zeiterfassung") {
      setTimeout(() => {
        document.getElementById("zeiterfassung-section")
          ?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    }
  }, []);

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
        />
        <StatMini
          icon={Clock}
          label="Zeiterfassung"
          value={akte._count?.zeiterfassungen ?? 0}
          onClick={() => handleKpiClick("Zeiterfassung")}
        />
        <StatMini
          icon={MessageSquare}
          label="Chat"
          value={akte._count?.chatNachrichten ?? 0}
          onClick={() => handleKpiClick("Chat")}
        />
      </div>

      {/* Tabbed content */}
      <AkteDetailTabs
        akte={akte}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </>
  );
}
