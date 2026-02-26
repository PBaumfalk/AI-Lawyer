"use client";

import { Badge } from "@/components/ui/badge";
import {
  FileEdit,
  FileSearch,
  FileCheck2,
  Send,
  Bot,
} from "lucide-react";

type DokumentStatus = "ENTWURF" | "ZUR_PRUEFUNG" | "FREIGEGEBEN" | "VERSENDET";

const STATUS_CONFIG: Record<
  DokumentStatus,
  {
    label: string;
    variant: "muted" | "warning" | "success" | "secondary";
    icon: React.ElementType;
  }
> = {
  ENTWURF: {
    label: "Entwurf",
    variant: "muted",
    icon: FileEdit,
  },
  ZUR_PRUEFUNG: {
    label: "Zur Prüfung",
    variant: "warning",
    icon: FileSearch,
  },
  FREIGEGEBEN: {
    label: "Freigegeben",
    variant: "success",
    icon: FileCheck2,
  },
  VERSENDET: {
    label: "Versendet",
    variant: "secondary",
    icon: Send,
  },
};

interface DokumentStatusBadgeProps {
  status: DokumentStatus;
  erstelltDurch?: string | null;
  className?: string;
}

export function DokumentStatusBadge({
  status,
  erstelltDurch,
  className,
}: DokumentStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.ENTWURF;
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <Badge variant={config.variant} className="gap-1 text-[10px]">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
      {erstelltDurch === "ai" && (
        <>
          <Badge variant="outline" className="gap-0.5 text-[10px] border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400">
            <Bot className="w-2.5 h-2.5" />
            KI
          </Badge>
          {status !== "FREIGEGEBEN" && status !== "VERSENDET" && (
            <Badge className="gap-0.5 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
              nicht freigegeben
            </Badge>
          )}
        </>
      )}
    </div>
  );
}
