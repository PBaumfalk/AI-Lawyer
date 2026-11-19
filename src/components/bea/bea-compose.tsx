"use client";

import { useState, useEffect, useRef } from "react";
import {
  BEA_NACHRICHTEN_TYPEN,
  VERSANDSTATUS_UNKLAR,
  type BeaVersandRequest,
  type BeaVersandPruefungRequest,
  type BeaDokumentFehler,
} from "@/lib/bea/versand";
import { ersetzeTypografie, type ZeichenVerstoss } from "@/lib/bea/regeln";
import { ladeAktenDokumente } from "@/lib/email/dokument-auswahl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  Loader2,
  Search,
  Paperclip,
  X,
  FileText,
  User,
  CheckCircle2,
  Save,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useBeaStatus, beaStatusMeldung, Hinweis } from "./bea-status";

// ─── Types ───────────────────────────────────────────────────────────────────

interface KontaktSuggestion {
  id: string;
  name: string;
  beaSafeId: string;
}

type AnhangArt = "SCHRIFTSATZ" | "ATTACHMENT";

interface DokumentAttachment {
  id: string;
  name: string;
  mimeType: string;
  groesse: number;
  art: AnhangArt;
}

type NachrichtenTyp = (typeof BEA_NACHRICHTEN_TYPEN)[number];

const NACHRICHTEN_TYP_LABEL: Record<NachrichtenTyp, string> = {
  ALLGEMEINE_NACHRICHT: "Allgemeine Nachricht",
  MAHN_ANTRAG: "Mahnantrag",
  TESTNACHRICHT: "Testnachricht",
};

/** Result of the pre-flight or a 422 from the send route. */
interface Pruefergebnis {
  fehler: string[];
  warnungen: string[];
  verstoesse: ZeichenVerstoss[];
  errors: BeaDokumentFehler[];
}

const MB = 1_048_576;
// Same thresholds as the server warnings in regeln.ts
const WARN_ANHAENGE = 50;
const WARN_BYTES = 60 * MB;

const FELD_LABEL: Record<string, string> = {
  betreff: "Betreff",
  text: "Inhalt",
  aktenzeichenAbsender: "Absender-Aktenzeichen",
  aktenzeichenEmpfaenger: "Empfänger-Aktenzeichen",
};

// ─── Component ───────────────────────────────────────────────────────────────

export function BeaCompose() {
  const router = useRouter();
  const { status, fehler: statusFehler, geladen: statusGeladen } = useBeaStatus();
  // Own postbox: SAFE-ID stored with the user's certificate after the first beA login
  const postfachSafeId = status && !beaStatusMeldung(status) ? status.zertifikat?.safeId ?? null : null;

  // Form state
  const [recipientSafeId, setRecipientSafeId] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [akteId, setAkteId] = useState<string | null>(null);
  const [akteName, setAkteName] = useState("");
  const [nachrichtenTyp, setNachrichtenTyp] = useState<NachrichtenTyp>("ALLGEMEINE_NACHRICHT");
  const [eebAnfordern, setEebAnfordern] = useState(false);
  const [dringend, setDringend] = useState(false);
  const [azAbsender, setAzAbsender] = useState("");
  const [azEmpfaenger, setAzEmpfaenger] = useState("");

  // Attachments
  const [attachments, setAttachments] = useState<DokumentAttachment[]>([]);
  const [showDocPicker, setShowDocPicker] = useState(false);

  // SAFE-ID autocomplete
  const [safeIdSearch, setSafeIdSearch] = useState("");
  const [safeIdSuggestions, setSafeIdSuggestions] = useState<KontaktSuggestion[]>([]);
  const [showSafeIdDropdown, setShowSafeIdDropdown] = useState(false);

  // Status
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false); // guards against double submit before the state re-renders
  const [error, setError] = useState<string | null>(null);
  const [pruefung, setPruefung] = useState<Pruefergebnis | null>(null);
  // Payload the user already saw the warnings for; a second click sends anyway
  const [bestaetigteWarnungen, setBestaetigteWarnungen] = useState<string | null>(null);
  // After an unclear send the form stays locked: a retry could send twice
  const [gesperrt, setGesperrt] = useState(false);
  const [erfolg, setErfolg] = useState<{ entwurf: boolean; warnungen: string[] } | null>(null);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (redirectTimer.current) clearTimeout(redirectTimer.current);
  }, []);

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
            name: k.nachname ? `${k.vorname || ""} ${k.nachname}`.trim() : k.firma || "Unbekannt",
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

  const anzahl = attachments.length;
  const summeBytes = attachments.reduce((s, a) => s + a.groesse, 0);
  const zuGross = anzahl > WARN_ANHAENGE || summeBytes > WARN_BYTES;

  const anhaenge = attachments.map((a) => ({ dokumentId: a.id, art: a.art }));
  const nachricht = {
    akteId: akteId ?? undefined,
    empfaengerSafeIds: [recipientSafeId.trim()],
    betreff: subject,
    text: body,
    aktenzeichenAbsender: azAbsender || undefined,
    aktenzeichenEmpfaenger: azEmpfaenger || undefined,
    nachrichtenTyp,
    eebAnfordern,
    dringend,
    anhaenge,
  };

  const typografieErsetzen = () => {
    setSubject((v) => ersetzeTypografie(v));
    setBody((v) => ersetzeTypografie(v));
    setAzAbsender((v) => ersetzeTypografie(v));
    setAzEmpfaenger((v) => ersetzeTypografie(v));
    setPruefung(null);
  };

  const versenden = async (alsEntwurf: boolean) => {
    if (sendingRef.current || gesperrt) return;
    if (!postfachSafeId) return;
    if (!recipientSafeId.trim() || !subject.trim()) {
      setError("Empfänger-SAFE-ID und Betreff sind erforderlich");
      return;
    }

    sendingRef.current = true;
    setSending(true);
    setError(null);

    try {
      // Step 1: pre-flight (access, Versand-Gate, beA rules); sends nothing
      const pr = await fetch("/api/bea/messages/versand-pruefung", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...nachricht, postfachSafeId, alsEntwurf } satisfies BeaVersandPruefungRequest),
      });
      const prData = await pr.json().catch(() => null);
      if (!prData || !Array.isArray(prData.fehler)) {
        throw new Error(prData?.error || `Prüfung fehlgeschlagen (${pr.status})`);
      }
      const ergebnis: Pruefergebnis = {
        fehler: prData.fehler,
        warnungen: prData.warnungen ?? [],
        verstoesse: prData.verstoesse ?? [],
        errors: prData.errors ?? [],
      };
      setPruefung(ergebnis);
      if (!pr.ok || ergebnis.fehler.length > 0 || ergebnis.verstoesse.length > 0 || ergebnis.errors.length > 0) {
        return;
      }

      // Warnings are shown first; the next click with the same content proceeds
      const schluessel = JSON.stringify({ ...nachricht, alsEntwurf });
      if (ergebnis.warnungen.length > 0 && bestaetigteWarnungen !== schluessel) {
        setBestaetigteWarnungen(schluessel);
        return;
      }

      // Step 2: server-side send or draft (never retried by the server)
      const res = await fetch("/api/bea/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...nachricht, postfachSafeId, alsEntwurf } satisfies BeaVersandRequest),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setErfolg({ entwurf: alsEntwurf, warnungen: data.warnungen ?? [] });
        redirectTimer.current = setTimeout(() => router.push("/bea"), 2500);
        return;
      }
      if (res.status === 422 && Array.isArray(data.fehler)) {
        setPruefung({ fehler: data.fehler, warnungen: data.warnungen ?? [], verstoesse: data.verstoesse ?? [], errors: [] });
        return;
      }
      if (res.status === 502 && data.error === VERSANDSTATUS_UNKLAR) {
        setGesperrt(true);
      }
      const details = Array.isArray(data.details)
        ? data.details.map((d: BeaDokumentFehler) => `${d.name || d.dokumentId}: ${d.reason}`).join("; ")
        : typeof data.details === "string"
          ? data.details
          : "";
      throw new Error([data.error || `Versand fehlgeschlagen (${res.status})`, details].filter(Boolean).join(" – "));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    versenden(false);
  };

  if (erfolg) {
    return (
      <div className="space-y-6">
        <div className="glass rounded-xl p-12 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
          <h2 className="text-lg font-heading text-foreground">
            {erfolg.entwurf ? "Entwurf im beA gespeichert" : "Nachricht gesendet"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {erfolg.entwurf
              ? "Der Entwurf liegt im beA-Postfach und kann dort weiterbearbeitet werden."
              : "Die Nachricht wurde über beA versendet und gespeichert."}
          </p>
          {erfolg.warnungen.length > 0 && (
            <Hinweis art="warnung" className="text-left">
              {erfolg.warnungen.join(" · ")}
            </Hinweis>
          )}
        </div>
      </div>
    );
  }

  const statusMeldung = status ? beaStatusMeldung(status) : null;
  const ohneSafeId = !!status && !statusMeldung && !postfachSafeId;
  const sendenGesperrt = sending || gesperrt || !postfachSafeId || !recipientSafeId.trim() || !subject.trim();
  const warnungenOffen =
    !!pruefung &&
    pruefung.warnungen.length > 0 &&
    [false, true].some((alsEntwurf) => bestaetigteWarnungen === JSON.stringify({ ...nachricht, alsEntwurf }));
  const ersetzbar = pruefung?.verstoesse.some((v) => v.ersatz !== null && !v.feld.startsWith("anhaenge.")) ?? false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/bea"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück
        </Link>
        <h1 className="text-2xl font-heading text-foreground">Neue beA-Nachricht</h1>
      </div>

      {/* beA status: a failed status call is an error, a missing certificate a banner */}
      {statusFehler && <Hinweis art="fehler">{statusFehler}</Hinweis>}
      {statusMeldung && <Hinweis art="warnung">{statusMeldung}</Hinweis>}
      {ohneSafeId && (
        <Hinweis art="warnung">
          Die SAFE-ID Ihres beA-Postfachs ist noch nicht bekannt. Bitte zuerst im Posteingang „Jetzt abrufen“
          ausführen.
        </Hinweis>
      )}
      {statusGeladen && postfachSafeId && (
        <p className="text-sm text-muted-foreground">Absender-Postfach: {postfachSafeId}</p>
      )}

      {/* Compose Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset disabled={sending || gesperrt} className="space-y-4">
          {/* Recipient with SAFE-ID autocomplete */}
          <div className="glass rounded-xl p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bea-empfaenger-suche">Empfänger (SAFE-ID)</Label>
              <div className="relative">
                {recipientSafeId && !safeIdSearch && recipientName ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">{recipientName}</span>
                    <span className="text-xs text-muted-foreground">({recipientSafeId})</span>
                    <button
                      type="button"
                      aria-label="Empfänger entfernen"
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
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="bea-empfaenger-suche"
                        value={safeIdSearch}
                        onChange={(e) => setSafeIdSearch(e.target.value)}
                        onFocus={() => {
                          if (safeIdSuggestions.length > 0) setShowSafeIdDropdown(true);
                        }}
                        placeholder="Kontakt mit SAFE-ID suchen…"
                        className="pl-8"
                      />
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
                              <span className="ml-2 text-xs text-muted-foreground">SAFE-ID: {k.beaSafeId}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <label htmlFor="bea-empfaenger-safeid">Oder SAFE-ID direkt eingeben:</label>
                      <Input
                        id="bea-empfaenger-safeid"
                        value={recipientSafeId}
                        onChange={(e) => {
                          setRecipientSafeId(e.target.value);
                          setRecipientName("");
                        }}
                        placeholder="DE.BRAK…"
                        className="h-8 w-64 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="bea-betreff">Betreff</Label>
              <Input
                id="bea-betreff"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Betreff eingeben…"
                required
              />
            </div>

            {/* Akte selector (optional) */}
            <div className="space-y-2">
              <Label htmlFor="bea-akte-suche">Akte (optional)</Label>
              <AkteSelector
                value={akteId}
                displayName={akteName}
                onChange={(id, name, aktenzeichen) => {
                  // Attachments are bound to the Akte: drop those of the previous one
                  if (id !== akteId) setAttachments([]);
                  setAkteId(id);
                  setAkteName(name);
                  setAzAbsender(aktenzeichen);
                }}
              />
            </div>

            {/* Message options */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bea-typ">Nachrichtentyp</Label>
                <Select
                  id="bea-typ"
                  value={nachrichtenTyp}
                  onChange={(e) => setNachrichtenTyp(e.target.value as NachrichtenTyp)}
                >
                  {BEA_NACHRICHTEN_TYPEN.map((t) => (
                    <option key={t} value={t}>
                      {NACHRICHTEN_TYP_LABEL[t]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bea-az-absender">Absender-Aktenzeichen</Label>
                <Input id="bea-az-absender" value={azAbsender} onChange={(e) => setAzAbsender(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bea-az-empfaenger">Empfänger-Aktenzeichen</Label>
                <Input id="bea-az-empfaenger" value={azEmpfaenger} onChange={(e) => setAzEmpfaenger(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={eebAnfordern}
                  onChange={(e) => setEebAnfordern(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                eEB anfordern
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={dringend}
                  onChange={(e) => setDringend(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                dringend
              </label>
            </div>
          </div>

          {/* Content */}
          <div className="glass rounded-xl p-6 space-y-2">
            <Label htmlFor="bea-text">Inhalt</Label>
            <Textarea
              id="bea-text"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Nachrichteninhalt eingeben…"
              rows={10}
              className="resize-y"
            />
          </div>

          {/* Document Attachments */}
          <div className="glass rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Paperclip className="h-4 w-4" />
                Anhänge
                <span className={cn("ml-2 text-xs font-normal", zuGross ? "text-destructive" : "text-muted-foreground")}>
                  {anzahl} {anzahl === 1 ? "Anhang" : "Anhänge"} · {formatMb(summeBytes)} MB
                </span>
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowDocPicker(true)} disabled={!akteId}>
                Dokument hinzufügen
              </Button>
            </div>

            {attachments.length > 0 ? (
              <div className="space-y-2">
                {attachments.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm text-foreground flex-1 truncate">{doc.name}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{formatMb(doc.groesse)} MB</span>
                    <div className="w-36">
                      <Select
                        aria-label={`Art von ${doc.name}`}
                        value={doc.art}
                        onChange={(e) =>
                          setAttachments((prev) =>
                            prev.map((a) => (a.id === doc.id ? { ...a, art: e.target.value as AnhangArt } : a)),
                          )
                        }
                        className="h-8 text-xs"
                      >
                        <option value="SCHRIFTSATZ">Schriftsatz</option>
                        <option value="ATTACHMENT">Anlage</option>
                      </Select>
                    </div>
                    <button
                      type="button"
                      aria-label={`${doc.name} entfernen`}
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
                {akteId
                  ? "Noch keine Dokumente angehängt. Nur freigegebene Dokumente der Akte können versendet werden."
                  : "Für Anhänge bitte zuerst eine Akte auswählen."}
              </p>
            )}
          </div>
        </fieldset>

        {/* Pre-flight result */}
        {pruefung && <PruefungAnzeige pruefung={pruefung} attachments={attachments} />}
        {ersetzbar && (
          <Button type="button" variant="outline" onClick={typografieErsetzen} disabled={sending || gesperrt}>
            <Wand2 className="mr-2 h-4 w-4" />
            Typografische Zeichen ersetzen
          </Button>
        )}
        {warnungenOffen && (
          <Hinweis art="info">Mit einem erneuten Klick wird die Nachricht trotz der Warnungen gesendet bzw. gespeichert.</Hinweis>
        )}

        {error && <Hinweis art="fehler">{error}</Hinweis>}

        {/* Submit */}
        <div className="flex flex-wrap justify-end gap-3">
          <Link
            href="/bea"
            className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Abbrechen
          </Link>
          <Button type="button" variant="outline" onClick={() => versenden(true)} disabled={sendenGesperrt}>
            <Save className="mr-2 h-4 w-4" />
            Als Entwurf im beA speichern
          </Button>
          <Button type="submit" disabled={sendenGesperrt}>
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird gesendet…
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Senden
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Document Picker Dialog */}
      {showDocPicker && akteId && (
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

// ─── Pre-flight result ───────────────────────────────────────────────────────

function PruefungAnzeige({ pruefung, attachments }: { pruefung: Pruefergebnis; attachments: DokumentAttachment[] }) {
  const feldName = (feld: string) => {
    const m = /^anhaenge\.(\d+)$/.exec(feld);
    if (m) return `Dateiname „${attachments[Number(m[1])]?.name ?? `Anhang ${Number(m[1]) + 1}`}“`;
    return FELD_LABEL[feld] ?? feld;
  };
  const fehler = [
    ...pruefung.errors.map((e) => `${e.name || e.dokumentId}: ${e.reason}`),
    ...pruefung.fehler,
  ];
  if (fehler.length === 0 && pruefung.warnungen.length === 0 && pruefung.verstoesse.length === 0) return null;

  return (
    <div className="space-y-2">
      {fehler.length > 0 && (
        <Hinweis art="fehler">
          <ul className="list-disc pl-4 space-y-0.5">
            {fehler.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </Hinweis>
      )}
      {pruefung.verstoesse.length > 0 && (
        <Hinweis art="fehler">
          <p className="font-medium">Zeichen, die beA nicht zulässt:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {pruefung.verstoesse.map((v, i) => (
              <li key={i}>
                {feldName(v.feld)}, Position {v.position + 1}: „{v.zeichen}“ ({v.codePoint})
                {v.ersatz !== null ? ` → „${v.ersatz}“` : " – bitte entfernen"}
              </li>
            ))}
          </ul>
        </Hinweis>
      )}
      {pruefung.warnungen.length > 0 && (
        <Hinweis art="warnung">
          <ul className="list-disc pl-4 space-y-0.5">
            {pruefung.warnungen.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Hinweis>
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
  onChange: (id: string | null, name: string, aktenzeichen: string) => void;
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
          aria-label="Akte entfernen"
          onClick={() => onChange(null, "", "")}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        id="bea-akte-suche"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Aktenzeichen oder Rubrum suchen…"
      />
      {showDropdown && results.length > 0 && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-lg border border-border bg-background shadow-lg max-h-48 overflow-y-auto">
          {results.map((akte: any) => (
            <button
              key={akte.id}
              type="button"
              onClick={() => {
                onChange(akte.id, `${akte.aktenzeichen} – ${akte.kurzrubrum}`, akte.aktenzeichen ?? "");
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
// Shows all documents of the Akte; ENTWURF/ZUR_PRUEFUNG greyed out with Quick-Release button

function DocumentPicker({
  onSelect,
  onClose,
  akteId,
  existingIds,
}: {
  onSelect: (doc: DokumentAttachment) => void;
  onClose: () => void;
  akteId: string;
  existingIds: string[];
}) {
  const [search, setSearch] = useState("");
  const [docs, setDocs] = useState<{ id: string; name: string; mimeType: string; groesse: number; status: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [releasing, setReleasing] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        setDocs(await ladeAktenDokumente(akteId, search || undefined));
        setFehler(null);
      } catch (e) {
        setDocs([]);
        setFehler(e instanceof Error ? e.message : "Dokumente konnten nicht geladen werden");
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
        setDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, status: "FREIGEGEBEN" } : d)));
      }
    } catch {
      // Ignore
    }
    setReleasing(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="glass rounded-xl p-6 w-full max-w-lg space-y-4 shadow-xl">
        <h3 className="text-lg font-heading text-foreground">Dokument anhängen</h3>
        <p className="text-sm text-muted-foreground">
          Nur freigegebene Dokumente können angehängt werden. Nicht freigegebene Dokumente können hier direkt
          freigegeben werden.
        </p>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Dokument suchen…"
            aria-label="Dokument suchen"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
            autoFocus
          />
        </div>

        {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}

        <div className="max-h-64 overflow-y-auto space-y-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : docs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Keine Dokumente gefunden.</p>
          ) : (
            docs.map((doc) => {
              // Versand-Gate: only FREIGEGEBEN can be sent (VERSENDET was already sent)
              const isFreigegeben = doc.status === "FREIGEGEBEN";
              const isEntwurf = doc.status === "ENTWURF" || doc.status === "ZUR_PRUEFUNG";
              const isAlreadyAdded = existingIds.includes(doc.id);

              return (
                <div
                  key={doc.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 transition-colors",
                    isEntwurf
                      ? "opacity-50 cursor-not-allowed"
                      : isAlreadyAdded || !isFreigegeben
                        ? "opacity-40"
                        : "hover:bg-muted cursor-pointer",
                  )}
                  onClick={() => {
                    if (isFreigegeben && !isAlreadyAdded) {
                      onSelect({
                        id: doc.id,
                        name: doc.name,
                        mimeType: doc.mimeType,
                        groesse: doc.groesse,
                        // The first attachment is usually the pleading itself
                        art: existingIds.length === 0 ? "SCHRIFTSATZ" : "ATTACHMENT",
                      });
                    }
                  }}
                >
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm text-foreground truncate flex-1">{doc.name}</span>
                  {isEntwurf && (
                    <>
                      <span className="text-xs text-amber-600 dark:text-amber-400 flex-shrink-0">
                        Noch nicht freigegeben
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickRelease(doc.id);
                        }}
                        disabled={releasing === doc.id}
                        className="text-xs text-primary hover:underline flex items-center gap-1 flex-shrink-0 disabled:opacity-50"
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
                  {isAlreadyAdded && <span className="text-xs text-muted-foreground flex-shrink-0">Angehängt</span>}
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Abbrechen
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMb(bytes: number): string {
  return (bytes / MB).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
