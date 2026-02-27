"use client";

import { useEffect } from "react";

/**
 * Preloads OnlyOffice resources client-side to avoid React hydration mismatches.
 *
 * Strategy:
 * 1. dns-prefetch + preconnect: TCP/TLS ready before editor opens
 * 2. prefetch api.js: critical bootstrap script cached for instant load
 * 3. Hidden iframe (preload.html): caches ALL editor resources (JS/CSS/fonts)
 *    via the official OnlyOffice preload mechanism (v9.0+)
 *
 * All elements are created in useEffect (client-only) to prevent
 * React hydration errors (#418/#425/#423) that occurred when <link> and
 * <iframe> elements were rendered server-side inside the client component tree.
 *
 * The iframe's "preloaded but not used" browser warnings are cosmetic —
 * resources ARE cached in the HTTP cache and served instantly when the
 * editor opens on a later navigation.
 */
export function OnlyOfficePreloader({ url }: { url: string }) {
  useEffect(() => {
    const cleanup: (() => void)[] = [];

    const addLink = (attrs: Record<string, string>) => {
      const link = document.createElement("link");
      for (const [k, v] of Object.entries(attrs)) {
        link.setAttribute(k, v);
      }
      document.head.appendChild(link);
      cleanup.push(() => link.remove());
    };

    // 1. Early connection setup
    addLink({ rel: "dns-prefetch", href: url });
    addLink({ rel: "preconnect", href: url, crossorigin: "anonymous" });

    // 2. Prefetch the critical bootstrap script
    addLink({
      rel: "prefetch",
      href: `${url}/web-apps/apps/api/documents/api.js`,
      as: "script",
    });

    // 3. Hidden iframe loads preload.html — caches ALL editor resources
    //    (JS bundles, CSS, fonts for document/spreadsheet/presentation editors).
    //    Deferred via requestIdleCallback so it doesn't compete with page load.
    const loadIframe = () => {
      const iframe = document.createElement("iframe");
      iframe.src = `${url}/web-apps/apps/api/documents/preload.html`;
      iframe.style.cssText = "display:none;width:0;height:0;border:0";
      iframe.setAttribute("aria-hidden", "true");
      iframe.tabIndex = -1;
      document.body.appendChild(iframe);
      cleanup.push(() => iframe.remove());
    };

    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(loadIframe);
      cleanup.push(() => cancelIdleCallback(id));
    } else {
      const id = setTimeout(loadIframe, 2000);
      cleanup.push(() => clearTimeout(id));
    }

    return () => cleanup.forEach((fn) => fn());
  }, [url]);

  return null;
}
