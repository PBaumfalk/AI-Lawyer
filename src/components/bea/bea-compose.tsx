"use client";

import { useState, useEffect, useCallback } from "react";
import { useBeaSession } from "@/lib/bea/session";
import { beaSendMessage, type BeaSendPayload } from "@/lib/bea/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  Loader2,
  AlertCircle,
  Search,
  Paperclip,
  X,
  FileText,
  User,
  Shield,
  CheckCircle2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface KontaktSuggestion {
  id: string;
  name: string;
  beaSafeId: string;
}

interface DokumentAttachment {
  id: string;
  name: string;
  mimeType: string;
  dateipfad: string;
  status?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BeaCompose() {
  const router = useRouter();
  const { session, isAuthenticated } = useBeaSession();

  // Form state
  const [recipientSafeId, setRecipientSafeId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [akteId, setAkteId] = useState<string | null>(null);
  const [akteName, setAkteName] = useState("");

  // Attachments
  const [attachments, setAttachments] = useState<DokumentAttachment[]>([]);
  const [showDocPicker, setShowDocPicker] = useState(false);

  // SAFE-ID autocomplete
  const [safeIdSearch, setSafeIdSearch] = useState("");
  const [safeIdSuggestions, setSafeIdSuggestions] = useState<KontaktSuggestion[]>([]);
  const [showSafeIdDropdown, setShowSafeIdDropdown] = useState(false);

  // Status
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch Kontakte with beaSafeId for autocomplete
  useEffect(() => {
    if (!safeIdSearch || safeIdSearch.length < 2) {
      setSafeIdSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/kontakte?q=${encodeURIComponent(safeIdSearch)}&take=10`);
        if (!res.ok) return;
        const data = await res.json();
        const withSafeId = (data.kontakte || [])
          .filter((k: any) => k.beaSafeId)
          .map((k: any) => ({
            id: k.id,
            name: k.nachname
              ? `${k.vorname || ""} ${k.nachname}`.trim()
              : k.firma || "Unbekannt",
            beaSafeId: k.beaSafeId,
          }));
        setSafeIdSuggestions(withSafeId);
        setShowSafeIdDropdown(withSafeId.length > 0);
      } catch {
        // Ignore
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [safeIdSearch]);

  const selectKontakt = (kontakt: KontaktSuggestion) => {
    setRecipientSafeId(kontakt.beaSafeId);
    setRecipientName(kontakt.name);
    setSafeIdSearch("");
    setShowSafeIdDropdown(false);
  };

  // Handle send
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recipientSafeId || !subject) {
      setError("Empfaenger-SAFE-ID und Betreff sind erforderlich");
      return;
    }

    if (!isAuthenticated || !session) {
      setError("beA-Sitzung ist nicht aktiv. Bitte melden Sie sich zuerst an.");
      return;
    }

    setSending(true);
    setError(null);

    try {
      // Build payload for bea.expert
      const payload: BeaSendPayload = {
        recipientSafeId,
        subject,
        body,
        attachments: [], // Attachments are fetched from DMS in the backend
      };

      // Step 1: Send via bea.expert (browser-side)
      const sendResult = await beaSendMessage(session, payload);

      if (!sendResult.ok) {
        // Log warning but continue -- we still want to record the message
        console.warn("beA send result:", sendResult.error);
      }

      // Step 2: Store sent message in database
      const storeRes = await fetch("/api/bea/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nachrichtenId: sendResult.data?.nachrichtenId || null,
          betreff: subject,
          absender: session.displayName || session.safeId,
          empfaenger: recipientName || recipientSafeId,
          inhalt: body,
          status: "GESENDET",
          safeIdAbsender: session.safeId,
          safeIdEmpfaenger: recipientSafeId,
          gesendetAm: new Date().toISOString(),
          dokumentIds: attachments.map((a) => a.id), // Versand-Gate check on server
        }),
      });

      if (!storeRes.ok) {
        const data = await storeRes.json();
        // 409 is ok (duplicate), everything else is an error
        if (storeRes.status !== 409) {
          throw new Error(data.error || "Fehler beim Speichern der Nachricht");
        }
      }

      setSuccess(true);
      // Redirect after short delay
      setTimeout(() => router.push("/bea"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSending(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/bea"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurueck
          </Link>
        </div>
        <div className="glass rounded-xl p-12 text-center">
          <Shield className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-muted-foreground">
            Bitte melden Sie sich zuerst bei beA an, um Nachrichten zu senden.
          </p>
          <Link
            href="/bea"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 transition-colors"
          >
            Zur beA-Anmeldung
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-xl p-12 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-lg font-heading text-foreground mb-1">
            Nachricht gesendet
          </h2>
          <p className="text-sm text-muted-foreground">
            Die Nachricht wurde erfolgreich versendet und gespeichert.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/bea"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurueck
        </Link>
        <h1 className="text-2xl font-heading text-foreground">Neue beA-Nachricht</h1>
      </div>

      {/* Compose Form */}
      <form onSubmit={handleSend} className="space-y-4">
        {/* Recipient with SAFE-ID autocomplete */}
        <div className="glass rounded-xl p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Empfaenger (SAFE-ID)
            </label>
            <div className="relative">
              {recipientSafeId ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">
                    {recipientName || recipientSafeId}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({recipientSafeId})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRecipientSafeId("");
                      setRecipientName("");
                    }}
                    className="ml-auto text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={safeIdSearch}
                    onChange={(e) => setSafeIdSearch(e.target.value)}
                    onFocus={() => {
                      if (safeIdSuggestions.length > 0) setShowSafeIdDropdown(true);
                    }}
                    placeholder="Name oder SAFE-ID eingeben..."
                    className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/50"
                  />
                  {/* Autocomplete dropdown */}
                  {showSafeIdDropdown && safeIdSuggestions.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-lg border border-border bg-background shadow-lg max-h-48 overflow-y-auto">
                      {safeIdSuggestions.map((k) => (
                        <button
                          key={k.id}
                          type="button"
                          onClick={() => selectKontakt(k)}
                          className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b border-border/50 last:border-b-0"
                        >
                          <span className="text-sm font-medium text-foreground">{k.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            SAFE-ID: {k.beaSafeId}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!recipientSafeId && (
                <p className="text-xs text-muted-foreground mt-1">
                  Oder SAFE-ID direkt eingeben:
                  <input
                    type="text"
                    value={recipientSafeId}
                    onChange={(e) => setRecipientSafeId(e.target.value)}
                    placeholder="DE.BRAK...."
                    className="ml-2 inline-block w-48 rounded border border-border bg-background px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand/50"
                  />
                </p>
              )}
            </div>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Betreff
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Betreff eingeben..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/50"
              required
            />
          </div>

          {/* Akte selector (optional) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Akte (optional)
            </label>
            <AkteSelector
              value={akteId}
              displayName={akteName}
              onChange={(id, name) => {
                setAkteId(id);
                setAkteName(name);
              }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="glass rounded-xl p-6 space-y-2">
          <label className="text-sm font-medium text-foreground">Inhalt</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Nachrichteninhalt eingeben..."
            rows={10}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/50 resize-y"
          />
        </div>

        {/* Document Attachments */}
        <div className="glass rounded-xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Paperclip className="h-4 w-4" />
              Dokumente anhaengen
            </h3>
            <button
              type="button"
              onClick={() => setShowDocPicker(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Dokument hinzufuegen
            </button>
          </div>

          {attachments.length > 0 ? (
            <div className="space-y-2">
              {attachments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-foreground flex-1">{doc.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== doc.id))}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Noch keine Dokumente angehaengt. Nur freigegebene Dokumente koennen versendet werden.
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 p-3">
            <AlertCircle className="h-4 w-4 text-rose-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-rose-700 dark:text-rose-400">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Link
            href="/bea"
            className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Abbrechen
          </Link>
          <button
            type="submit"
            disabled={sending || !recipientSafeId || !subject}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-2.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Wird gesendet...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Senden
              </>
            )}
          </button>
        </div>
      </form>

      {/* Document Picker Dialog */}
      {showDocPicker && (
        <DocumentPicker
          onSelect={(doc) => {
            if (!attachments.find((a) => a.id === doc.id)) {
              setAttachments((prev) => [...prev, doc]);
            }
            setShowDocPicker(false);
          }}
          onClose={() => setShowDocPicker(false)}
          akteId={akteId}
          existingIds={attachments.map((a) => a.id)}
        />
      )}
    </div>
  );
}

// ─── Akte Selector ───────────────────────────────────────────────────────────

function AkteSelector({
  value,
  displayName,
  onChange,
}: {
  value: string | null;
  displayName: string;
  onChange: (id: string | null, name: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!search || search.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/akten?q=${encodeURIComponent(search)}&take=10`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.akten || []);
          setShowDropdown(true);
        }
      } catch {
        // Ignore
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
        <span className="text-sm text-foreground flex-1">{displayName}</span>
        <button
          type="button"
          onClick={() => onChange(null, "")}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Aktenzeichen oder Rubrum suchen..."
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/50"
      />
      {showDropdown && results.length > 0 && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-lg border border-border bg-background shadow-lg max-h-48 overflow-y-auto">
          {results.map((akte: any) => (
            <button
              key={akte.id}
              type="button"
              onClick={() => {
                onChange(akte.id, `${akte.aktenzeichen} - ${akte.kurzrubrum}`);
                setSearch("");
                setShowDropdown(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-muted transition-colors border-b border-border/50 last:border-b-0"
            >
              <span className="text-sm font-medium text-foreground">{akte.aktenzeichen}</span>
              <span className="ml-2 text-sm text-muted-foreground">{akte.kurzrubrum}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Document Picker ─────────────────────────────────────────────────────────
// Shows ALL documents; ENTWURF/ZUR_PRUEFUNG greyed out with Quick-Release button

function DocumentPicker({
  onSelect,
  onClose,
  akteId,
  existingIds,
}: {
  onSelect: (doc: DokumentAttachment) => void;
  onClose: () => void;
  akteId: string | null;
  existingIds: string[];
}) {
  const [search, setSearch] = useState("");
  const [docs, setDocs] = useState<(DokumentAttachment & { status: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [releasing, setReleasing] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        // Fetch ALL documents (not just FREIGEGEBEN) to show ENTWURF greyed out
        const params = new URLSearchParams({ take: "30" });
        if (akteId) params.set("akteId", akteId);
        if (search) params.set("q", search);

        const res = await fetch(`/api/dokumente?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setDocs(
            (data.dokumente || []).map((d: any) => ({
              id: d.id,
              name: d.name,
              mimeType: d.mimeType,
              dateipfad: d.dateipfad,
              status: d.status,
            }))
          );
        }
      } catch {
        // Ignore
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, akteId]);

  async function handleQuickRelease(docId: string) {
    setReleasing(docId);
    try {
      const res = await fetch(`/api/dokumente/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "FREIGEGEBEN" }),
      });
      if (res.ok) {
        setDocs((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, status: "FREIGEGEBEN" } : d))
        );
      }
    } catch {
      // Ignore
    }
    setReleasing(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="glass rounded-xl p-6 w-full max-w-lg space-y-4 shadow-xl">
        <h3 className="text-lg font-heading text-foreground">
          Dokument anhaengen
        </h3>
        <p className="text-sm text-muted-foreground">
          Nur freigegebene Dokumente koennen angehaengt werden. Nicht freigegebene Dokumente koennen hier direkt freigegeben werden.
        </p>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Dokument suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/50"
            autoFocus
          />
        </div>

        <div className="max-h-64 overflow-y-auto space-y-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : docs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Keine Dokumente gefunden.
            </p>
          ) : (
            docs.map((doc) => {
              const isFreigegeben = doc.status === "FREIGEGEBEN" || doc.status === "VERSENDET";
              const isEntwurf = doc.status === "ENTWURF" || doc.status === "ZUR_PRUEFUNG";
              const isAlreadyAdded = existingIds.includes(doc.id);

              return (
                <div
                  key={doc.id}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                    isEntwurf
                      ? "opacity-50 cursor-not-allowed"
                      : isAlreadyAdded
                      ? "opacity-40"
                      : "hover:bg-muted cursor-pointer"
                  } transition-colors`}
                  onClick={() => {
                    if (isFreigegeben && !isAlreadyAdded) {
                      onSelect({
                        id: doc.id,
                        name: doc.name,
                        mimeType: doc.mimeType,
                        dateipfad: doc.dateipfad,
                      });
                    }
                  }}
                >
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-foreground truncate flex-1">{doc.name}</span>
                  {isEntwurf && (
                    <>
                      <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 flex-shrink-0">
                        Noch nicht freigegeben
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickRelease(doc.id);
                        }}
                        disabled={releasing === doc.id}
                        className="text-xs text-brand hover:underline flex items-center gap-1 flex-shrink-0 disabled:opacity-50"
                      >
                        {releasing === doc.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        Freigeben
                      </button>
                    </>
                  )}
                  {isAlreadyAdded && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      Angehaengt
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

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
