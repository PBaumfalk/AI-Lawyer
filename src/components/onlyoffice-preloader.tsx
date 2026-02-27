"use client";

import { useEffect } from "react";

/**
 * Preloads OnlyOffice resources client-side to avoid hydration mismatches.
 *
 * Previous approach used a hidden iframe loading preload.html which:
 * - Caused React hydration errors (#418/#425/#423) because <link> elements
 *   in the body get hoisted to <head> by the browser, breaking React's DOM diff
 * - Triggered "preloaded but not used" browser warnings for ALL editor types
 *   (word, cell, slide, visio) because preload.html preloads everything
 *
 * New approach: client-side <link rel="prefetch"> added via useEffect.
 * - No SSR output → no hydration issues
 * - "prefetch" = "cache for future navigation" → no browser warnings
 * - Only prefetches the critical api.js bootstrap script
 * - Versioned resources (9.x.x-hash/...) loaded by api.js on editor open
 *   are cached by the browser with long TTL due to content-hashed URLs
 */
export function OnlyOfficePreloader({ url }: { url: string }) {
  useEffect(() => {
    const links: HTMLLinkElement[] = [];

    const addLink = (attrs: Record<string, string>) => {
      const link = document.createElement("link");
      for (const [k, v] of Object.entries(attrs)) {
        link.setAttribute(k, v);
      }
      document.head.appendChild(link);
      links.push(link);
    };

    // 1. Early connection setup — TCP/TLS handshake ready before editor opens
    addLink({ rel: "dns-prefetch", href: url });
    addLink({ rel: "preconnect", href: url, crossorigin: "anonymous" });

    // 2. Prefetch the editor bootstrap script.
    //    This is the first resource DocumentEditor loads —
    //    serving from cache saves ~200-500ms on editor startup.
    addLink({
      rel: "prefetch",
      href: `${url}/web-apps/apps/api/documents/api.js`,
      as: "script",
    });

    return () => links.forEach((l) => l.remove());
  }, [url]);

  // No SSR output — everything happens client-side
  return null;
}
