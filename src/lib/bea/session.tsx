"use client";

/**
 * beA Session Context (browser-only)
 *
 * Manages beA authentication state in React context. Session keys are stored
 * exclusively in memory -- never persisted to localStorage, cookies, or server.
 * Refreshing the page requires re-authentication with the software token.
 *
 * Security: The software token and derived session keys never leave the browser.
 * Auto-logout after 30 minutes of inactivity.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { beaLogin, type BeaSession, type BeaResult } from "./client";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BeaSessionState {
  /** Whether the user is authenticated with beA */
  isAuthenticated: boolean;
  /** The current session (null if not authenticated) */
  session: BeaSession | null;
  /** Whether a login is in progress */
  isLoading: boolean;
  /** Last error message */
  error: string | null;
  /** Login with software token and PIN */
  login: (softwareToken: File, pin: string) => Promise<BeaResult<BeaSession>>;
  /** Logout and clear session from memory */
  logout: () => void;
  /** Remaining session time in seconds */
  remainingTime: number;
}

const BeaSessionContext = createContext<BeaSessionState | null>(null);

// ─── Constants ───────────────────────────────────────────────────────────────

/** Session timeout: 30 minutes of inactivity */
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
/** How often to check for session expiry */
const CHECK_INTERVAL_MS = 10_000;

// ─── Provider ────────────────────────────────────────────────────────────────

export function BeaSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<BeaSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Auto-logout function
  const performLogout = useCallback(() => {
    clearTimers();
    setSession(null);
    setRemainingTime(0);
    setError(null);
  }, [clearTimers]);

  // Start inactivity timer
  const startTimer = useCallback(
    (sess: BeaSession) => {
      clearTimers();

      // Set absolute timeout for auto-logout
      timeoutRef.current = setTimeout(() => {
        performLogout();
        setError("Sitzung abgelaufen. Bitte erneut anmelden.");
      }, SESSION_TIMEOUT_MS);

      // Update remaining time every 10 seconds
      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - sess.lastActivity;
        const remaining = Math.max(0, Math.floor((SESSION_TIMEOUT_MS - elapsed) / 1000));
        setRemainingTime(remaining);

        if (remaining <= 0) {
          performLogout();
          setError("Sitzung abgelaufen. Bitte erneut anmelden.");
        }
      }, CHECK_INTERVAL_MS);
    },
    [clearTimers, performLogout]
  );

  // Reset inactivity timer on user activity
  useEffect(() => {
    if (!session) return;

    const resetActivity = () => {
      session.lastActivity = Date.now();
      startTimer(session);
    };

    // Track user activity
    window.addEventListener("click", resetActivity);
    window.addEventListener("keydown", resetActivity);
    window.addEventListener("scroll", resetActivity);

    return () => {
      window.removeEventListener("click", resetActivity);
      window.removeEventListener("keydown", resetActivity);
      window.removeEventListener("scroll", resetActivity);
    };
  }, [session, startTimer]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const login = useCallback(
    async (softwareToken: File, pin: string): Promise<BeaResult<BeaSession>> => {
      setIsLoading(true);
      setError(null);

      const result = await beaLogin(softwareToken, pin);

      if (result.ok && result.data) {
        setSession(result.data);
        setRemainingTime(SESSION_TIMEOUT_MS / 1000);
        startTimer(result.data);
      } else {
        setError(result.error || "Anmeldung fehlgeschlagen");
      }

      setIsLoading(false);
      return result;
    },
    [startTimer]
  );

  const logout = useCallback(() => {
    performLogout();
  }, [performLogout]);

  const value: BeaSessionState = {
    isAuthenticated: session !== null,
    session,
    isLoading,
    error,
    login,
    logout,
    remainingTime,
  };

  return (
    <BeaSessionContext.Provider value={value}>
      {children}
    </BeaSessionContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Hook to access beA session state.
 * Must be used within a BeaSessionProvider.
 */
export function useBeaSession(): BeaSessionState {
  const context = useContext(BeaSessionContext);
  if (!context) {
    throw new Error("useBeaSession must be used within a BeaSessionProvider");
  }
  return context;
}
