import { ClipboardList } from "lucide-react";

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

interface AkteUebersichtProps {
  sachgebiet: string;
  status: string;
  gegnerName: string | null;
  gerichtName: string | null;
}

export function AkteUebersicht({
  sachgebiet,
  status,
  gegnerName,
  gerichtName,
}: AkteUebersichtProps) {
  const rows = [
    {
      label: "Sachgebiet",
      value: SACHGEBIET_LABELS[sachgebiet] ?? sachgebiet,
    },
    {
      label: "Status",
      value: (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
            STATUS_COLORS[status] ?? STATUS_COLORS.OFFEN
          }`}
        >
          {STATUS_LABELS[status] ?? status}
        </span>
      ),
    },
    {
      label: "Gegner",
      value: gegnerName ?? (
        <span className="text-muted-foreground italic">Nicht angegeben</span>
      ),
    },
    {
      label: "Gericht",
      value: gerichtName ?? (
        <span className="text-muted-foreground italic">Nicht angegeben</span>
      ),
    },
  ];

  return (
    <div className="glass-card rounded-xl p-5 border border-[var(--glass-border-color)]">
      {/* Card header */}
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Uebersicht
        </h2>
      </div>

      {/* Info grid */}
      <div className="space-y-0 divide-y divide-[var(--glass-border-color)]">
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
          >
            <span className="text-sm text-muted-foreground">{row.label}</span>
            <span className="text-sm font-medium text-foreground text-right max-w-[60%] truncate">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
