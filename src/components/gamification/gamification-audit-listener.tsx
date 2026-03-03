"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useSocket } from "@/components/socket-provider";

interface AuditEvent {
  completionId: string;
  questName: string;
}

/**
 * Global listener for gamification audit events.
 * Mounts once in the dashboard layout to catch audit prompts
 * regardless of which page the user is viewing.
 *
 * Shows a Sonner action toast with Bestaetigen / Zuruecknehmen buttons.
 * duration: Infinity -- toast stays until user acts.
 * Server-side 24h auto-confirm handles the true timeout.
 */
export function GamificationAuditListener() {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    function handleAuditNeeded(event: AuditEvent) {
      toast("Stichproben-Pruefung", {
        description: `Erledigung "${event.questName}" bestaetigen?`,
        duration: Infinity,
        action: {
          label: "Bestaetigen",
          onClick: () => {
            fetch("/api/gamification/audit/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                completionId: event.completionId,
                decision: "CONFIRMED",
              }),
            }).catch(() => {});
          },
        },
        cancel: {
          label: "Zuruecknehmen",
          onClick: () => {
            fetch("/api/gamification/audit/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                completionId: event.completionId,
                decision: "DECLINED",
              }),
            }).catch(() => {});
          },
        },
      });
    }

    function handleStreakSchutzUsed() {
      toast.success("Streak-Schutz hat deinen Streak gerettet!");
    }

    socket.on("gamification:audit-needed", handleAuditNeeded);
    socket.on("gamification:streak-schutz-used", handleStreakSchutzUsed);
    return () => {
      socket.off("gamification:audit-needed", handleAuditNeeded);
      socket.off("gamification:streak-schutz-used", handleStreakSchutzUsed);
    };
  }, [socket]);

  // Render nothing -- pure side-effect component
  return null;
}
