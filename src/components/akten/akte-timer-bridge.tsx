"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

interface AkteTimerBridgeProps {
  akteId: string;
}

/**
 * Client component that auto-starts the time tracking timer
 * when a user opens any Akte detail page.
 *
 * Per CONTEXT decision: "Timer starts automatically when opening ANY Akte -- always."
 * - Fire-and-forget: does NOT block page rendering on timer response
 * - Only triggers if user is authenticated (session check)
 * - The timer API handles stopping any previous timer (one active at a time)
 */
export function AkteTimerBridge({ akteId }: AkteTimerBridgeProps) {
  const { data: session } = useSession();
  const startedRef = useRef(false);

  useEffect(() => {
    // Only fire once per mount, and only if authenticated
    if (!session?.user || startedRef.current) return;
    startedRef.current = true;

    // Fire-and-forget: start timer without awaiting
    fetch("/api/finanzen/zeiterfassung/timer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ akteId }),
    }).catch(() => {
      // Silently ignore errors -- timer start is best-effort
    });
  }, [akteId, session]);

  // This component renders nothing
  return null;
}
