"use client";

import { useState, useRef, useCallback } from "react";
import { Bot, Send, Loader2, Phone, CheckSquare, StickyNote } from "lucide-react";
import { toast } from "sonner";
import type { FeedEntryData } from "./activity-feed-entry";

type ComposerMode = "NOTIZ" | "TELEFONNOTIZ" | "AUFGABE";

const ERGEBNIS_OPTIONS = [
  "Erreicht",
  "Nicht erreicht",
  "Rueckruf erbeten",
  "Nachricht hinterlassen",
  "Besetzt",
] as const;

interface ActivityFeedComposerProps {
  akteId: string;
  onNoteCreated: (entry: FeedEntryData) => void;
  onHelenaTaskStarted?: (taskId: string) => void;
}

export function ActivityFeedComposer({
  akteId,
  onNoteCreated,
  onHelenaTaskStarted,
}: ActivityFeedComposerProps) {
  const [mode, setMode] = useState<ComposerMode>("NOTIZ");
  const [submitting, setSubmitting] = useState(false);

  // Notiz state
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Telefonnotiz state
  const [beteiligter, setBeteiligter] = useState("");
  const [ergebnis, setErgebnis] = useState("");
  const [stichworte, setStichworte] = useState("");
  const [naechsterSchritt, setNaechsterSchritt] = useState("");
  const [telefonValidation, setTelefonValidation] = useState<{
    beteiligter?: boolean;
    ergebnis?: boolean;
  }>({});

  // Aufgabe state
  const [aufgabeTitel, setAufgabeTitel] = useState("");
  const [aufgabeFaelligAm, setAufgabeFaelligAm] = useState("");
  const [aufgabeBeschreibung, setAufgabeBeschreibung] = useState("");
  const [aufgabeValidation, setAufgabeValidation] = useState<{
    titel?: boolean;
  }>({});

  // Auto-resize textarea as user types
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      const ta = e.target;
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    },
    []
  );

  // Insert @Helena at cursor position
  const insertHelenaMention = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = text.slice(0, start);
    const after = text.slice(end);

    // Only insert if not already present
    if (text.includes("@Helena")) {
      ta.focus();
      return;
    }

    const mention = "@Helena ";
    const newText = before + mention + after;
    setText(newText);

    // Set cursor after the mention
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = start + mention.length;
      ta.selectionEnd = start + mention.length;
    });
  }, [text]);

  // Reset form state for current mode
  const resetForm = useCallback(() => {
    setText("");
    setBeteiligter("");
    setErgebnis("");
    setStichworte("");
    setNaechsterSchritt("");
    setTelefonValidation({});
    setAufgabeTitel("");
    setAufgabeFaelligAm("");
    setAufgabeBeschreibung("");
    setAufgabeValidation({});
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, []);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (submitting) return;

    let payload: Record<string, unknown>;

    if (mode === "NOTIZ") {
      const trimmed = text.trim();
      if (!trimmed) return;
      payload = { text: trimmed };
    } else if (mode === "TELEFONNOTIZ") {
      const trimmedBeteiligter = beteiligter.trim();
      const trimmedErgebnis = ergebnis.trim();
      const errors: { beteiligter?: boolean; ergebnis?: boolean } = {};
      if (!trimmedBeteiligter) errors.beteiligter = true;
      if (!trimmedErgebnis) errors.ergebnis = true;
      if (Object.keys(errors).length > 0) {
        setTelefonValidation(errors);
        return;
      }
      setTelefonValidation({});
      payload = {
        text: stichworte.trim() || trimmedBeteiligter,
        typ: "TELEFONNOTIZ",
        meta: {
          beteiligter: trimmedBeteiligter,
          ergebnis: trimmedErgebnis,
          stichworte: stichworte.trim() || undefined,
          naechsterSchritt: naechsterSchritt.trim() || undefined,
        },
      };
    } else {
      // AUFGABE
      const trimmedTitel = aufgabeTitel.trim();
      if (!trimmedTitel) {
        setAufgabeValidation({ titel: true });
        return;
      }
      setAufgabeValidation({});
      payload = {
        text: trimmedTitel,
        typ: "AUFGABE",
        meta: {
          titel: trimmedTitel,
          faelligAm: aufgabeFaelligAm || undefined,
          beschreibung: aufgabeBeschreibung.trim() || undefined,
        },
      };
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/akten/${akteId}/feed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Fehler beim Senden");
      }

      const data = await res.json();

      // Optimistic prepend of new entry
      onNoteCreated(data.activity);

      // Notify about Helena task if created (only for NOTIZ)
      if (data.taskId && onHelenaTaskStarted) {
        onHelenaTaskStarted(data.taskId);
      }

      resetForm();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Fehler beim Senden"
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    mode,
    text,
    beteiligter,
    ergebnis,
    stichworte,
    naechsterSchritt,
    aufgabeTitel,
    aufgabeFaelligAm,
    aufgabeBeschreibung,
    submitting,
    akteId,
    onNoteCreated,
    onHelenaTaskStarted,
    resetForm,
  ]);

  // Enter to submit, Shift+Enter for newline (Notiz mode only)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const modeButtons: { key: ComposerMode; label: string; icon: React.ElementType }[] = [
    { key: "NOTIZ", label: "Notiz", icon: StickyNote },
    { key: "TELEFONNOTIZ", label: "Telefonnotiz", icon: Phone },
    { key: "AUFGABE", label: "Aufgabe", icon: CheckSquare },
  ];

  return (
    <div className="glass-card rounded-xl p-3 flex-shrink-0 border-t border-slate-200 dark:border-slate-700">
      {/* Type selector pills */}
      <div className="flex items-center gap-1.5 mb-2">
        {modeButtons.map(({ key, label, icon: ModeIcon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={
              "inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border transition-colors " +
              (mode === key
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-700 dark:hover:border-slate-500")
            }
          >
            <ModeIcon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Notiz mode */}
      {mode === "NOTIZ" && (
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={insertHelenaMention}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-brand-600 transition-colors"
            title="@Helena erwaehnen"
          >
            <Bot className="w-5 h-5" />
          </button>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Notiz schreiben oder @Helena erwaehnen..."
            className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-slate-400 focus:outline-none min-h-[40px] max-h-[120px]"
            rows={1}
            disabled={submitting}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !text.trim()}
            className="p-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      )}

      {/* Telefonnotiz mode */}
      {mode === "TELEFONNOTIZ" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={beteiligter}
              onChange={(e) => {
                setBeteiligter(e.target.value);
                if (telefonValidation.beteiligter) setTelefonValidation((v) => ({ ...v, beteiligter: false }));
              }}
              placeholder="Name des Gespraechspartners"
              className={
                "w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-slate-900 text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500 " +
                (telefonValidation.beteiligter ? "border-red-500" : "border-slate-200 dark:border-slate-700")
              }
              disabled={submitting}
            />
            <select
              value={ergebnis}
              onChange={(e) => {
                setErgebnis(e.target.value);
                if (telefonValidation.ergebnis) setTelefonValidation((v) => ({ ...v, ergebnis: false }));
              }}
              className={
                "w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-slate-900 text-foreground focus:outline-none focus:ring-1 focus:ring-brand-500 " +
                (telefonValidation.ergebnis ? "border-red-500" : "border-slate-200 dark:border-slate-700")
              }
              disabled={submitting}
            >
              <option value="">Ergebnis waehlen...</option>
              {ERGEBNIS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={stichworte}
            onChange={(e) => setStichworte(e.target.value)}
            placeholder="Stichworte zum Gespraech..."
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
            rows={2}
            disabled={submitting}
          />
          <div className="flex items-end gap-2">
            <input
              type="text"
              value={naechsterSchritt}
              onChange={(e) => setNaechsterSchritt(e.target.value)}
              placeholder="Naechster Schritt / Follow-up"
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
              disabled={submitting}
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="p-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Aufgabe mode */}
      {mode === "AUFGABE" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={aufgabeTitel}
              onChange={(e) => {
                setAufgabeTitel(e.target.value);
                if (aufgabeValidation.titel) setAufgabeValidation({});
              }}
              placeholder="Aufgabe beschreiben..."
              className={
                "flex-1 px-3 py-2 text-sm rounded-lg border bg-white dark:bg-slate-900 text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500 " +
                (aufgabeValidation.titel ? "border-red-500" : "border-slate-200 dark:border-slate-700")
              }
              disabled={submitting}
            />
            <input
              type="date"
              value={aufgabeFaelligAm}
              onChange={(e) => setAufgabeFaelligAm(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-foreground focus:outline-none focus:ring-1 focus:ring-brand-500"
              disabled={submitting}
            />
          </div>
          <div className="flex items-end gap-2">
            <textarea
              value={aufgabeBeschreibung}
              onChange={(e) => setAufgabeBeschreibung(e.target.value)}
              placeholder="Details..."
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
              rows={2}
              disabled={submitting}
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="p-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
