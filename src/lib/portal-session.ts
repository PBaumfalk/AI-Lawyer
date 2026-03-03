"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { signOut } from "next-auth/react";
import React from "react";

// Inactivity timeout: 30 minutes
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
// Warning shown 5 minutes before logout
const WARNING_THRESHOLD_MS = 25 * 60 * 1000;
// Throttle activity events to once per 30 seconds
const ACTIVITY_THROTTLE_MS = 30 * 1000;

interface PortalSessionContextValue {
  /** Minutes remaining before auto-logout */
  minutesRemaining: number;
  /** Whether the warning dialog is visible */
  showWarning: boolean;
  /** Reset the inactivity timer (extend session) */
  extendSession: () => void;
}

const PortalSessionContext = createContext<PortalSessionContextValue>({
  minutesRemaining: 30,
  showWarning: false,
  extendSession: () => {},
});

export function usePortalSession() {
  return useContext(PortalSessionContext);
}

/**
 * PortalSessionProvider
 *
 * Wraps portal layout children. Tracks user activity and auto-logs out
 * after 30 minutes of inactivity. Shows a warning at 25 minutes.
 */
export function PortalSessionProvider({ children }: { children: ReactNode }) {
  const [showWarning, setShowWarning] = useState(false);
  const [minutesRemaining, setMinutesRemaining] = useState(30);
  const lastActivityRef = useRef(Date.now());
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const throttleRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const resetTimers = useCallback(() => {
    clearTimers();
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    setMinutesRemaining(30);

    // Set warning timer at 25 minutes
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      // Start countdown for remaining 5 minutes
      let remaining = 5;
      setMinutesRemaining(remaining);
      countdownRef.current = setInterval(() => {
        remaining -= 1;
        setMinutesRemaining(Math.max(0, remaining));
      }, 60 * 1000);
    }, WARNING_THRESHOLD_MS);

    // Set logout timer at 30 minutes
    logoutTimerRef.current = setTimeout(() => {
      signOut({ callbackUrl: "/portal/login" });
    }, INACTIVITY_TIMEOUT_MS);
  }, [clearTimers]);

  const handleActivity = useCallback(() => {
    const now = Date.now();
    if (now - throttleRef.current < ACTIVITY_THROTTLE_MS) return;
    throttleRef.current = now;
    resetTimers();
  }, [resetTimers]);

  const extendSession = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  useEffect(() => {
    // Start initial timers
    resetTimers();

    // Listen for user activity
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    for (const event of events) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    return () => {
      clearTimers();
      for (const event of events) {
        window.removeEventListener(event, handleActivity);
      }
    };
  }, [resetTimers, handleActivity, clearTimers]);

  return React.createElement(
    PortalSessionContext.Provider,
    { value: { minutesRemaining, showWarning, extendSession } },
    children,
    showWarning
      ? React.createElement(InactivityWarningDialog, {
          minutesRemaining,
          onExtend: extendSession,
        })
      : null
  );
}

/**
 * Inactivity warning dialog shown 5 minutes before auto-logout.
 */
function InactivityWarningDialog({
  minutesRemaining,
  onExtend,
}: {
  minutesRemaining: number;
  onExtend: () => void;
}) {
  return React.createElement(
    "div",
    {
      className:
        "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm",
    },
    React.createElement(
      "div",
      {
        className:
          "glass-lg rounded-2xl p-8 max-w-sm mx-4 text-center shadow-2xl",
      },
      React.createElement(
        "h2",
        { className: "text-lg font-heading text-foreground mb-2" },
        "Sitzung laeuft ab"
      ),
      React.createElement(
        "p",
        { className: "text-sm text-muted-foreground mb-6" },
        `Ihre Sitzung laeuft in ${minutesRemaining} ${minutesRemaining === 1 ? "Minute" : "Minuten"} ab. Klicken Sie um fortzufahren.`
      ),
      React.createElement(
        "button",
        {
          onClick: onExtend,
          className:
            "w-full px-4 py-2.5 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors",
        },
        "Weiter"
      )
    )
  );
}
