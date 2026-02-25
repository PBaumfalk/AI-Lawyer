"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Users,
  Building2,
  Calendar,
  Scale,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface XJustizData {
  version?: string;
  grunddaten?: {
    aktenzeichen?: string;
    verfahrensgegenstand?: string;
    gericht?: string;
    eingangsdatum?: string;
  };
  beteiligte?: Array<{
    name: string;
    rolle: string;
    anschrift?: string;
    safeId?: string;
  }>;
  instanzen?: Array<{
    gericht: string;
    aktenzeichen: string;
    beginn?: string;
    ende?: string;
  }>;
  termine?: Array<{
    art: string;
    datum: string;
    ort?: string;
    bemerkung?: string;
  }>;
}

interface XJustizViewerProps {
  data: XJustizData;
}

// ─── Collapsible Section ─────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  count,
  defaultOpen = false,
  children,
}: {
  icon: React.ElementType;
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-border/50 first:border-t-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left py-3 px-1 hover:bg-muted/30 transition-colors rounded"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{title}</span>
        {count !== undefined && (
          <span className="text-xs text-muted-foreground">({count})</span>
        )}
      </button>
      {open && <div className="pb-3 pl-7">{children}</div>}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function XJustizViewer({ data }: XJustizViewerProps) {
  if (!data) return null;

  const hasGrunddaten = data.grunddaten &&
    (data.grunddaten.aktenzeichen || data.grunddaten.gericht || data.grunddaten.verfahrensgegenstand);
  const hasBeteiligte = data.beteiligte && data.beteiligte.length > 0;
  const hasInstanzen = data.instanzen && data.instanzen.length > 0;
  const hasTermine = data.termine && data.termine.length > 0;

  if (!hasGrunddaten && !hasBeteiligte && !hasInstanzen && !hasTermine) {
    return null;
  }

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-center gap-2 mb-3">
        <Scale className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium text-muted-foreground">
          XJustiz-Daten
        </h2>
        {data.version && data.version !== "unknown" && (
          <span className="text-xs text-muted-foreground/70">
            (v{data.version})
          </span>
        )}
      </div>

      <div className="space-y-0">
        {/* Grunddaten */}
        {hasGrunddaten && (
          <Section icon={FileText} title="Grunddaten" defaultOpen>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {data.grunddaten!.aktenzeichen && (
                <KeyValue label="Aktenzeichen" value={data.grunddaten!.aktenzeichen} />
              )}
              {data.grunddaten!.gericht && (
                <KeyValue label="Gericht" value={data.grunddaten!.gericht} />
              )}
              {data.grunddaten!.verfahrensgegenstand && (
                <KeyValue label="Verfahrensgegenstand" value={data.grunddaten!.verfahrensgegenstand} />
              )}
              {data.grunddaten!.eingangsdatum && (
                <KeyValue label="Eingangsdatum" value={data.grunddaten!.eingangsdatum} />
              )}
            </div>
          </Section>
        )}

        {/* Beteiligte */}
        {hasBeteiligte && (
          <Section icon={Users} title="Beteiligte" count={data.beteiligte!.length}>
            <div className="space-y-3">
              {data.beteiligte!.map((b, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-border/50 p-3 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{b.name}</span>
                    <span className="text-xs text-muted-foreground rounded-full bg-muted px-2 py-0.5">
                      {b.rolle}
                    </span>
                  </div>
                  {b.anschrift && (
                    <p className="text-xs text-muted-foreground mt-1">{b.anschrift}</p>
                  )}
                  {b.safeId && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      SAFE-ID: {b.safeId}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Instanzen */}
        {hasInstanzen && (
          <Section icon={Building2} title="Instanzen" count={data.instanzen!.length}>
            <div className="space-y-2">
              {data.instanzen!.map((inst, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-4 text-sm"
                >
                  <div className="flex-1">
                    <span className="font-medium text-foreground">{inst.gericht}</span>
                    {inst.aktenzeichen && (
                      <span className="ml-2 text-muted-foreground">
                        ({inst.aktenzeichen})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {inst.beginn && <span>{inst.beginn}</span>}
                    {inst.beginn && inst.ende && <span> - </span>}
                    {inst.ende && <span>{inst.ende}</span>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Termine */}
        {hasTermine && (
          <Section icon={Calendar} title="Termine" count={data.termine!.length}>
            <div className="space-y-2">
              {data.termine!.map((t, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 text-sm"
                >
                  <span className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">
                    {t.datum}
                  </span>
                  <div className="flex-1">
                    <span className="font-medium text-foreground">{t.art}</span>
                    {t.ort && (
                      <span className="ml-2 text-muted-foreground">{t.ort}</span>
                    )}
                    {t.bemerkung && (
                      <p className="text-xs text-muted-foreground mt-0.5">{t.bemerkung}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}
