"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Maps Prisma Sachgebiet enum to German display labels
const SACHGEBIET_LABELS: Record<string, string> = {
  ARBEITSRECHT: "Arbeitsrecht",
  FAMILIENRECHT: "Familienrecht",
  VERKEHRSRECHT: "Verkehrsrecht",
  MIETRECHT: "Mietrecht",
  STRAFRECHT: "Strafrecht",
  ERBRECHT: "Erbrecht",
  SOZIALRECHT: "Sozialrecht",
  INKASSO: "Inkasso",
  HANDELSRECHT: "Handelsrecht",
  VERWALTUNGSRECHT: "Verwaltungsrecht",
  SONSTIGES: "Sonstiges",
};

// Maps AkteStatus to color classes (oklch-friendly Tailwind tokens)
const STATUS_COLORS: Record<string, string> = {
  OFFEN: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  RUHEND: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  ARCHIVIERT: "bg-gray-500/15 text-gray-600 dark:text-gray-400",
  GESCHLOSSEN: "bg-gray-500/15 text-gray-600 dark:text-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  OFFEN: "Offen",
  RUHEND: "Ruhend",
  ARCHIVIERT: "Archiviert",
  GESCHLOSSEN: "Geschlossen",
};

interface AkteSummary {
  id: string;
  aktenzeichen: string;
  kurzrubrum: string;
  sachgebiet: string;
  status: string;
  naechsteSchritte: string | null;
}

export function AkteAuswahl({ akten }: { akten: AkteSummary[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {akten.map((akte) => (
        <Link
          key={akte.id}
          href={`/portal/akten/${akte.id}`}
          className="group glass-card rounded-xl p-5 border border-[var(--glass-border-color)] hover:border-primary/40 hover:shadow-lg transition-all duration-200"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* Aktenzeichen as title */}
              <h3 className="font-semibold text-foreground truncate">
                {akte.aktenzeichen}
              </h3>

              {/* Kurzrubrum as subtitle */}
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                {akte.kurzrubrum}
              </p>
            </div>

            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
          </div>

          {/* Badges row */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {/* Sachgebiet badge */}
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary">
              {SACHGEBIET_LABELS[akte.sachgebiet] ?? akte.sachgebiet}
            </span>

            {/* Status badge */}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                STATUS_COLORS[akte.status] ?? STATUS_COLORS.OFFEN
              }`}
            >
              {STATUS_LABELS[akte.status] ?? akte.status}
            </span>
          </div>

          {/* Naechste Schritte preview */}
          <p className="text-xs mt-3 line-clamp-2 leading-relaxed">
            {akte.naechsteSchritte ? (
              <span className="text-foreground/80">
                {akte.naechsteSchritte.length > 80
                  ? akte.naechsteSchritte.slice(0, 80) + "..."
                  : akte.naechsteSchritte}
              </span>
            ) : (
              <span className="text-muted-foreground italic">
                Keine Informationen
              </span>
            )}
          </p>
        </Link>
      ))}
    </div>
  );
}
