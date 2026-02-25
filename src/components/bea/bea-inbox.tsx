"use client";

import { useEffect, useState, useCallback } from "react";
import { useBeaSession } from "@/lib/bea/session";
import {
  beaGetMessages,
  beaGetFolders,
  type BeaMessageSummary,
} from "@/lib/bea/client";
import {
  Inbox,
  Send,
  RefreshCw,
  Loader2,
  AlertCircle,
  FolderOpen,
  Search,
  Link2,
} from "lucide-react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StoredMessage {
  id: string;
  nachrichtenId: string | null;
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

const statusConfig: Record<string, { label: string; color: string; dotColor: string }> = {
  EINGANG: { label: "Eingang", color: "text-blue-600 dark:text-blue-400", dotColor: "bg-blue-500" },
  GELESEN: { label: "Gelesen", color: "text-slate-500", dotColor: "bg-slate-400" },
  ZUGEORDNET: { label: "Zugeordnet", color: "text-emerald-600 dark:text-emerald-400", dotColor: "bg-emerald-500" },
  GESENDET: { label: "Gesendet", color: "text-violet-600 dark:text-violet-400", dotColor: "bg-violet-500" },
  FEHLER: { label: "Fehler", color: "text-rose-600 dark:text-rose-400", dotColor: "bg-rose-500" },
};

// ─── Component ───────────────────────────────────────────────────────────────

export function BeaInbox() {
  const { session, isAuthenticated } = useBeaSession();
  const [tab, setTab] = useState<"eingang" | "ausgang">("eingang");
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAssignDialog, setShowAssignDialog] = useState<string | null>(null);

  // Fetch stored messages from database
  const fetchStored = useCallback(async () => {
    try {
      const statusFilter = tab === "eingang" ? "EINGANG" : "GESENDET";
      const params = new URLSearchParams();
      // For inbox, show EINGANG, GELESEN, ZUGEORDNET
      // For outbox, show GESENDET
      if (tab === "ausgang") {
        params.set("status", "GESENDET");
      }
      if (search) {
        params.set("q", search);
      }
      params.set("take", "100");

      const res = await fetch(`/api/bea/messages?${params.toString()}`);
      if (!res.ok) throw new Error("Fehler beim Laden der Nachrichten");
      const data = await res.json();

      // For inbox, filter out GESENDET messages
      let filtered = data.nachrichten;
      if (tab === "eingang") {
        filtered = filtered.filter((m: StoredMessage) => m.status !== "GESENDET");
      }

      setMessages(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  }, [tab, search]);

  // Sync from bea.expert API (browser-side) to database
  const syncFromBeaExpert = useCallback(async () => {
    if (!isAuthenticated || !session) return;

    setSyncing(true);
    setError(null);

    try {
      // Get folders to find inbox/sent
      const foldersResult = await beaGetFolders(session, session.safeId);
      if (!foldersResult.ok || !foldersResult.data) {
        // If bea.expert library not loaded, just load from DB
        await fetchStored();
        setSyncing(false);
        return;
      }

      // Find Posteingang folder
      const inboxFolder = foldersResult.data.find(
        (f) =>
          f.name.toLowerCase().includes("posteingang") ||
          f.name.toLowerCase().includes("inbox")
      );

      if (inboxFolder) {
        const messagesResult = await beaGetMessages(
          session,
          session.safeId,
          inboxFolder.id,
          { limit: 50 }
        );

        if (messagesResult.ok && messagesResult.data) {
          // Sync each new message to database
          for (const msg of messagesResult.data) {
            try {
              await fetch("/api/bea/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  nachrichtenId: msg.nachrichtenId,
                  betreff: msg.betreff,
                  absender: msg.absender,
                  empfaenger: msg.empfaenger,
                  safeIdAbsender: msg.absenderSafeId,
                  safeIdEmpfaenger: msg.empfaengerSafeId,
                  status: "EINGANG",
                  empfangenAm: msg.datum,
                  eebErforderlich: msg.eebErforderlich,
                }),
              });
            } catch {
              // 409 = already exists, that's fine
            }
          }
        }
      }
    } catch (err) {
      // Non-fatal: we can still show stored messages
      console.warn("beA sync error:", err);
    }

    // Reload from database
    await fetchStored();
    setSyncing(false);
  }, [isAuthenticated, session, fetchStored]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    syncFromBeaExpert().finally(() => setLoading(false));
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStored();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchStored]);

  const handleAssign = async (messageId: string, akteId: string) => {
    try {
      await fetch(`/api/bea/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ akteId }),
      });
      setShowAssignDialog(null);
      await fetchStored();
    } catch {
      setError("Zuordnung fehlgeschlagen");
    }
  };

  return (
    <div className="space-y-4">
      {/* Tabs + Actions */}
      <div className="flex items-center justify-between">
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

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Suchen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/50"
            />
          </div>
          <button
            onClick={() => syncFromBeaExpert()}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            Synchronisieren
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 p-3">
          <AlertCircle className="h-4 w-4 text-rose-500 flex-shrink-0" />
          <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
        </div>
      )}

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
                  {tab === "eingang" ? "Absender" : "Empfaenger"}
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
                        className="font-medium text-foreground hover:text-brand transition-colors"
                      >
                        {msg.betreff}
                      </Link>
                      {msg.eebStatus === "AUSSTEHEND" && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-950 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                          eEB ausstehend
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground">
                      {tab === "eingang" ? msg.absender : msg.empfaenger}
                    </td>
                    <td className="py-2.5 px-4">
                      {msg.akte ? (
                        <Link
                          href={`/akten/${msg.akte.id}`}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                        >
                          {msg.akte.aktenzeichen}
                        </Link>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            setShowAssignDialog(msg.id);
                          }}
                          className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900 transition-colors"
                        >
                          <Link2 className="h-3 w-3" />
                          Zuordnen
                        </button>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">
                      {formatDate(msg.empfangenAm || msg.gesendetAm || msg.createdAt)}
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
  onAssign: (messageId: string, akteId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [akten, setAkten] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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
    try {
      const res = await fetch("/api/bea/auto-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nachrichtId: messageId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.akteId) {
          onClose();
          window.location.reload();
          return;
        }
      }
    } catch {
      // Ignore
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="glass rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl">
        <h3 className="text-lg font-heading text-foreground">
          Nachricht einer Akte zuordnen
        </h3>

        <button
          onClick={handleAutoAssign}
          disabled={loading}
          className="w-full rounded-lg border border-brand/30 bg-brand/5 px-4 py-2 text-sm font-medium text-brand hover:bg-brand/10 transition-colors disabled:opacity-50"
        >
          Automatische Zuordnung versuchen
        </button>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Aktenzeichen oder Rubrum suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/50"
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
                onClick={() => onAssign(messageId, akte.id)}
                className="w-full text-left rounded-lg px-3 py-2 hover:bg-muted transition-colors"
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}
