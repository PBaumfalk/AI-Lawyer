"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Clock, Square, Loader2 } from "lucide-react";

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

interface TimerState {
  zeiterfassungId: string;
  akteId: string;
  aktenzeichen: string;
  startzeit: string;
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function formatElapsed(startzeit: string): string {
  const start = new Date(startzeit).getTime();
  const now = Date.now();
  const diff = Math.max(0, Math.floor((now - start) / 1000));

  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// ---------------------------------------------------------------
// Component
// ---------------------------------------------------------------

export function TimerSidebarWidget() {
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [elapsed, setElapsed] = useState("00:00:00");
  const [stopping, setStopping] = useState(false);
  const [showStopForm, setShowStopForm] = useState(false);
  const [beschreibung, setBeschreibung] = useState("");
  const [isStundenhonorar, setIsStundenhonorar] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch active timer
  const fetchTimer = useCallback(async () => {
    try {
      const res = await fetch("/api/finanzen/zeiterfassung/timer");
      if (res.ok) {
        const data = await res.json();
        if (data.timer) {
          setTimer(data.timer);
          setIsStundenhonorar(data.isStundenhonorar ?? false);
        } else {
          setTimer(null);
          setIsStundenhonorar(false);
        }
      }
    } catch {
      // Silently fail — timer is non-critical
    }
  }, []);

  // Initial fetch + 30s polling
  useEffect(() => {
    fetchTimer();
    const poll = setInterval(fetchTimer, 30000);
    return () => clearInterval(poll);
  }, [fetchTimer]);

  // Tick every second when timer is active
  useEffect(() => {
    if (timer) {
      const tick = () => setElapsed(formatElapsed(timer.startzeit));
      tick(); // immediate
      intervalRef.current = setInterval(tick, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      setElapsed("00:00:00");
    }
  }, [timer]);

  // Stop handler
  const handleStop = useCallback(async () => {
    if (isStundenhonorar && !beschreibung.trim()) {
      // For Stundenhonorar, description is mandatory
      setShowStopForm(true);
      return;
    }

    setStopping(true);
    try {
      const body: Record<string, string> = {};
      if (beschreibung.trim()) {
        body.beschreibung = beschreibung.trim();
      }
      const res = await fetch("/api/finanzen/zeiterfassung/timer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setTimer(null);
        setShowStopForm(false);
        setBeschreibung("");
      }
    } catch {
      // Error
    } finally {
      setStopping(false);
    }
  }, [beschreibung, isStundenhonorar]);

  // No timer = minimal display
  if (!timer) {
    return (
      <div className="px-3 py-2">
        <p className="text-xs text-slate-500">Kein Timer aktiv</p>
      </div>
    );
  }

  return (
    <div className="mx-2 mb-2">
      <div className="rounded-lg bg-black/[0.04] dark:bg-white/[0.06] p-3 space-y-2">
        {/* Header */}
        <div className="flex items-center gap-2">
          {/* Pulsing green dot */}
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-xs text-muted-foreground truncate flex-1">
            {timer.aktenzeichen}
          </span>
        </div>

        {/* Elapsed time */}
        <div className="flex items-center justify-between">
          <span className="text-lg font-mono font-semibold text-foreground tabular-nums">
            {elapsed}
          </span>
          <button
            type="button"
            onClick={() => {
              if (isStundenhonorar) {
                setShowStopForm(true);
              } else {
                handleStop();
              }
            }}
            disabled={stopping}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors disabled:opacity-50"
            title="Timer stoppen"
          >
            {stopping ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Square className="w-3 h-3" />
            )}
            Stop
          </button>
        </div>

        {/* Stop form for Stundenhonorar */}
        {showStopForm && (
          <div className="space-y-2 pt-2 border-t border-border/50">
            <label className="block text-xs text-muted-foreground">
              {isStundenhonorar
                ? "Taetigkeit (Pflichtangabe)"
                : "Taetigkeit (optional)"}
            </label>
            <input
              type="text"
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              placeholder="Was wurde gemacht?"
              className="w-full h-8 px-2 text-xs rounded bg-black/[0.04] dark:bg-white/[0.08] border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={handleStop}
                disabled={stopping || (isStundenhonorar && !beschreibung.trim())}
                className="flex-1 px-2 py-1 rounded text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors disabled:opacity-50"
              >
                {stopping ? "..." : "Stoppen"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowStopForm(false);
                  setBeschreibung("");
                }}
                className="px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
