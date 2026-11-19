"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** Response of GET /api/bea/status (certificate metadata only, no secrets). */
export interface BeaStatus {
  eingerichtet: boolean;
  zertifikat: {
    seriennummer: string | null;
    inhaber: string | null;
    gueltigBis: string | null;
    status: "AKTIV" | "FEHLER";
    letzterFehler: string | null;
    letzterAbruf: string | null;
    safeId: string | null;
  } | null;
  /** Messages of the certificate's postbox skipped after repeated failures. */
  uebersprungen?: number;
}

const ANMELDUNG_FEHLGESCHLAGEN = "beA-Anmeldung fehlgeschlagen";

/** Banner text when beA cannot be used with the caller's certificate, else null. */
export function beaStatusMeldung(s: BeaStatus): string | null {
  if (!s.eingerichtet) return "beA ist nicht eingerichtet";
  if (!s.zertifikat) return "Kein beA-Zertifikat hinterlegt – bitte an die Administration wenden";
  if (s.zertifikat.status === "FEHLER") {
    // The stored error may already carry the prefix (see sitzung.ts)
    const detail = (s.zertifikat.letzterFehler ?? "Unbekannter Fehler")
      .replace(new RegExp(`^${ANMELDUNG_FEHLGESCHLAGEN}:\\s*`), "");
    return `${ANMELDUNG_FEHLGESCHLAGEN}: ${detail}`;
  }
  return null;
}

/** Loads /api/bea/status; `fehler` is set only when the status call itself failed. */
export function useBeaStatus() {
  const [status, setStatus] = useState<BeaStatus | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [geladen, setGeladen] = useState(false);

  const laden = useCallback(async () => {
    try {
      const res = await fetch("/api/bea/status");
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(data?.error || `beA-Status konnte nicht geladen werden (${res.status})`);
      setStatus(data as BeaStatus);
      setFehler(null);
    } catch (e) {
      setStatus(null);
      setFehler(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "beA-Status konnte nicht geladen werden");
    } finally {
      setGeladen(true);
    }
  }, []);

  useEffect(() => {
    laden();
  }, [laden]);

  return { status, fehler, geladen, neuLaden: laden };
}

const HINWEIS_STIL = {
  fehler: { klasse: "border-destructive/50 bg-destructive/10 text-destructive", Icon: AlertCircle },
  warnung: { klasse: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300", Icon: AlertTriangle },
  info: { klasse: "border-border bg-muted text-muted-foreground", Icon: Info },
} as const;

/** Inline notice box built from design tokens. */
export function Hinweis({
  art,
  children,
  className,
}: {
  art: keyof typeof HINWEIS_STIL;
  children: React.ReactNode;
  className?: string;
}) {
  const { klasse, Icon } = HINWEIS_STIL[art];
  return (
    <div role={art === "fehler" ? "alert" : "status"} className={cn("flex items-start gap-2 rounded-lg border p-3 text-sm", klasse, className)}>
      <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function formatDatumZeit(dateStr: string | null): string {
  if (!dateStr) return "–";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
