"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribes to a CSS media query. On the server (and during hydration) the
 * query is reported as not matching, so the desktop layout renders first and
 * switches after mount when the query matches.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}

/** True below the Tailwind `md` breakpoint (768 px). */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767.98px)");
}
