"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

interface AkteTimerBridgeProps {
  akteId: string;
}

/**
 * Client component that auto-starts the time tracking timer
 * when a user opens any Akte detail page, and auto-stops when leaving.
 *
 * Per CONTEXT decision: "Timer starts automatically when opening ANY Akte -- always."
 * - Fire-and-forget: does NOT block page rendering on timer response
 * - Only triggers if user is authenticated (session check)
 * - The timer API handles stopping any previous timer (one active at a time)
 * - On unmount (leaving the Akte): stops the running timer
 */
export function AkteTimerBridge({ akteId }: AkteTimerBridgeProps) {
  const { data: session } = useSession();
  // Stable dependency: the session object changes identity on every refetch,
  // which used to run the cleanup (stopping the timer) while still in the Akte.
  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) return;

    // Fire-and-forget start; remember whether this bridge actually started a
    // timer, so leaving the Akte never tries to stop a timer that does not
    // exist (that ended in a 404 in the browser console).
    const gestartet = fetch("/api/finanzen/zeiterfassung/timer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ akteId }),
    })
      .then((r) => r.ok)
      .catch(() => false);

    // Stop timer when leaving the Akte (unmount)
    return () => {
      void gestartet.then((ok) => {
        if (!ok) return;
        fetch("/api/finanzen/zeiterfassung/timer", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
          // keepalive ensures the request completes even during page navigation
          keepalive: true,
        }).catch(() => {
          // Best-effort stop
        });
      });
    };
  }, [akteId, userId]);

  // This component renders nothing
  return null;
}
