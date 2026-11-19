"use client";

import { beaAutoZuordnen } from "@/lib/bea/zuordnung";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Inbox,
  Send,
  RefreshCw,
  Loader2,
  FolderOpen,
  Search,
  Link2,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBeaStatus, beaStatusMeldung, Hinweis, formatDatumZeit } from "./bea-status";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StoredMessage {
  id: string;
  nachrichtenId: string | null;
  richtung: "EINGANG" | "AUSGANG";
  betreff: string;
  absender: string;
  empfaenger: string;
  status: string;
  eebStatus: string | null;
  createdAt: string;
  empfangenAm: string | null;
  gesendetAm: string | null;
  akte: { id: string; aktenzeichen: string; kurzrubrum: string } | null;
}

// ─── Status Config ───────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; dotColor: string }> = {
  EINGANG: { label: "Eingang", dotColor: "bg-primary" },
  GELESEN: { label: "Gelesen", dotColor: "bg-muted-foreground/50" },
  ZUGEORDNET: { label: "Zugeordnet", dotColor: "bg-success" },
  GESENDET: { label: "Gesendet", dotColor: "bg-muted-foreground" },
  FEHLER: { label: "Fehler", dotColor: "bg-destructive" },
};

/** Delay before the list is reloaded after a manual retrieval was queued. */
const NEU_LADEN_NACH_MS = 5000;

// ─── Component ───────────────────────────────────────────────────────────────

export function BeaInbox() {
  const { status, fehler: statusFehler, neuLaden: statusNeuLaden } = useBeaStatus();
  const { data: session } = useSession();
  const istAdmin = session?.user?.role === "ADMIN";
  const [zuruecksetzen, setZuruecksetzen] = useState(false);
  const [zuruecksetzenFehler, setZuruecksetzenFehler] = useState<string | null>(null);
  const [tab, setTab] = useState<"eingang" | "ausgang">("eingang");
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncHinweis, setSyncHinweis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAssignDialog, setShowAssignDialog] = useState<string | null>(null);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch stored messages from the database (server filters by Akte access)
  const fetchStored = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("richtung", tab === "eingang" ? "EINGANG" : "AUSGANG");
      if (search) params.set("q", search);
      params.set("take", "100");

      const res = await fetch(`/api/bea/messages?${params.toString()}`);
      if (!res.ok) throw new Error("Fehler beim Laden der Nachrichten");
      const data = await res.json();

      setMessages(data.nachrichten as StoredMessage[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  }, [tab, search]);

  // Initial load and reload on tab change / search (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStored().finally(() => setLoading(false));
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchStored, search]);

  useEffect(() => () => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
  }, []);

  // Queue a server-side retrieval, then reload list and status after 5 s
  const jetztAbrufen = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncHinweis(null);
    setError(null);
    try {
      const res = await fetch("/api/bea/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 409 "Abruf läuft bereits": a retrieval for this user is already queued or running
        if (res.status === 409 && data.error === "Abruf läuft bereits") {
          setSyncHinweis("Abruf läuft bereits");
        } else {
          throw new Error(data.error || `Abruf fehlgeschlagen (${res.status})`);
        }
      } else {
        setSyncHinweis("Abruf gestartet – die Liste wird in wenigen Sekunden aktualisiert.");
      }
      await new Promise<void>((resolve) => {
        reloadTimer.current = setTimeout(resolve, NEU_LADEN_NACH_MS);
      });
      await Promise.all([fetchStored(), statusNeuLaden()]);
      setSyncHinweis(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Abruf fehlgeschlagen");
      statusNeuLaden();
    } finally {
      setSyncing(false);
    }
  };

  const statusMeldung = status ? beaStatusMeldung(status) : null;
  const uebersprungen = status?.uebersprungen ?? 0;

  // Admin: release skipped messages of the postbox for the next retrieval
  const fehlversucheZuruecksetzen = async () => {
    const postfachSafeId = status?.zertifikat?.safeId;
    if (!postfachSafeId) return;
    setZuruecksetzen(true);
    setZuruecksetzenFehler(null);
    try {
      const res = await fetch("/api/bea/fehlversuche/zuruecksetzen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postfachSafeId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Zurücksetzen fehlgeschlagen (${res.status})`);
      }
      await statusNeuLaden();
    } catch (e) {
      setZuruecksetzenFehler(e instanceof Error ? e.message : "Zurücksetzen fehlgeschlagen");
    } finally {
      setZuruecksetzen(false);
    }
  };
  const abrufMoeglich = !!status && !statusMeldung;

  // Returns an error message (e.g. 409: documents already in another Akte) or null
  const handleAssign = async (messageId: string, akteId: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/bea/messages/${encodeURIComponent(messageId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ akteId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return data.error || `Zuordnung fehlgeschlagen (${res.status})`;
      }
      setShowAssignDialog(null);
      await fetchStored();
      return null;
    } catch {
      return "Zuordnung fehlgeschlagen";
    }
  };

  return (
    <div className="space-y-4">
      {/* beA status banner */}
      {statusFehler && <Hinweis art="fehler">{statusFehler}</Hinweis>}
      {statusMeldung && <Hinweis art="warnung">{statusMeldung}</Hinweis>}
      {uebersprungen > 0 && (
        <Hinweis art="warnung">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {uebersprungen === 1
                ? "1 beA-Nachricht konnte nicht übernommen werden – bitte im beA-Webclient prüfen."
                : `${uebersprungen} beA-Nachrichten konnten nicht übernommen werden – bitte im beA-Webclient prüfen.`}
            </span>
            {istAdmin && (
              <Button variant="outline" size="sm" onClick={fehlversucheZuruecksetzen} disabled={zuruecksetzen}>
                {zuruecksetzen ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                )}
                Erneut versuchen
              </Button>
            )}
          </div>
          {zuruecksetzenFehler && <p className="mt-1 text-destructive">{zuruecksetzenFehler}</p>}
        </Hinweis>
      )}

      {/* Tabs + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
          <button
            onClick={() => setTab("eingang")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "eingang"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Inbox className="h-4 w-4" />
            Posteingang
          </button>
          <button
            onClick={() => setTab("ausgang")}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "ausgang"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Send className="h-4 w-4" />
            Postausgang
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {status?.zertifikat && (
            <span className="text-xs text-muted-foreground">
              Zuletzt abgerufen: {formatDatumZeit(status.zertifikat.letzterAbruf)}
            </span>
          )}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Suchen…"
              aria-label="Nachrichten durchsuchen"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Button variant="outline" size="sm" onClick={jetztAbrufen} disabled={syncing || !abrufMoeglich}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            Jetzt abrufen
          </Button>
        </div>
      </div>

      {syncHinweis && <Hinweis art="info">{syncHinweis}</Hinweis>}
      {error && <Hinweis art="fehler">{error}</Hinweis>}

      {/* Message List */}
      <div className="glass rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              {tab === "eingang"
                ? "Keine Nachrichten im Posteingang"
                : "Keine gesendeten Nachrichten"}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground w-8">
                  Status
                </th>
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">
                  Betreff
                </th>
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">
                  {tab === "eingang" ? "Absender" : "Empfänger"}
                </th>
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">
                  Akte
                </th>
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">
                  Datum
                </th>
              </tr>
            </thead>
            <tbody>
              {messages.map((msg) => {
                const cfg = statusConfig[msg.status] || statusConfig.EINGANG;
                return (
                  <tr
                    key={msg.id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-2.5 px-4">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${cfg.dotColor}`}
                        title={cfg.label}
                      />
                    </td>
                    <td className="py-2.5 px-4">
                      <Link
                        href={`/bea/${msg.id}`}
                        className="font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {msg.betreff}
                      </Link>
                      {msg.eebStatus === "AUSSTEHEND" && (
                        <Badge variant="warning" className="ml-2">eEB ausstehend</Badge>
                      )}
                      {msg.eebStatus === "WIRD_ABGEGEBEN" && (
                        <Badge variant="danger" className="ml-2">eEB-Abgabe unklar</Badge>
                      )}
                      {msg.status === "FEHLER" && (
                        <Badge variant="danger" className="ml-2">Fehler</Badge>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground">
                      {tab === "eingang" ? msg.absender : msg.empfaenger}
                    </td>
                    <td className="py-2.5 px-4">
                      {msg.akte ? (
                        <Link
                          href={`/akten/${msg.akte.id}`}
                          className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success"
                        >
                          {msg.akte.aktenzeichen}
                        </Link>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            setShowAssignDialog(msg.id);
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-transparent bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning hover:border-warning transition-colors"
                        >
                          <Link2 className="h-3 w-3" />
                          Zuordnen
                        </button>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">
                      {formatDatumZeit(msg.empfangenAm || msg.gesendetAm || msg.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Assign Dialog */}
      {showAssignDialog && (
        <AkteAssignDialog
          messageId={showAssignDialog}
          onAssign={handleAssign}
          onClose={() => setShowAssignDialog(null)}
        />
      )}
    </div>
  );
}

// ─── Assign Dialog ───────────────────────────────────────────────────────────

function AkteAssignDialog({
  messageId,
  onAssign,
  onClose,
}: {
  messageId: string;
  onAssign: (messageId: string, akteId: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [akten, setAkten] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (!search || search.length < 2) {
      setAkten([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/akten?q=${encodeURIComponent(search)}&take=10`);
        if (res.ok) {
          const data = await res.json();
          setAkten(data.akten || []);
        }
      } catch {
        // Ignore
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Also try auto-assign
  const handleAutoAssign = async () => {
    setLoading(true);
    setFehler(null);
    try {
      const r = await beaAutoZuordnen(messageId);
      if (r.zugeordnet) {
        onClose();
        window.location.reload();
        return;
      }
      if (r.meldung) setFehler(r.meldung);
    } catch {
      setFehler("Zuordnung fehlgeschlagen");
    }
    setLoading(false);
  };

  const zuordnen = async (akteId: string) => {
    setLoading(true);
    setFehler(null);
    const meldung = await onAssign(messageId, akteId);
    if (meldung) setFehler(meldung);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="glass rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl">
        <h3 className="text-lg font-heading text-foreground">
          Nachricht einer Akte zuordnen
        </h3>

        <Button variant="outline" className="w-full" onClick={handleAutoAssign} disabled={loading}>
          Automatische Zuordnung versuchen
        </Button>

        {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Aktenzeichen oder Rubrum suchen…"
            aria-label="Akte suchen"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
        </div>

        {loading && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {akten.length > 0 && (
          <div className="max-h-48 overflow-y-auto space-y-1">
            {akten.map((akte: any) => (
              <button
                key={akte.id}
                onClick={() => zuordnen(akte.id)}
                disabled={loading}
                className="w-full disabled:opacity-50 text-left rounded-lg px-3 py-2 hover:bg-muted transition-colors"
              >
                <span className="font-medium text-sm text-foreground">
                  {akte.aktenzeichen}
                </span>
                <span className="ml-2 text-sm text-muted-foreground">
                  {akte.kurzrubrum}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
