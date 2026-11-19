// Erweiterungsicons im Persimmon-Stil.
//
// Für Lucide-Namen, die die Anwendung verwendet und für die das Designpaket
// (82 Icons) keine fachliche Entsprechung hat. Regeln wie im CI-Contract §5:
// 24er-Raster, viewBox 0 0 24 24, Strich 1.75, runde Enden und Ecken,
// keine Füllflächen, currentColor; Abstand rund 2 px zum Rand; Akzent-
// elemente mit data-accent (Ton "duotone"). Eigene, einfache Geometrie –
// keine Pfade aus Lucide oder anderen Bibliotheken.
//
// Gemeinsame Grundformen (Blatt, Ordner, Schild, Person) stammen aus den
// Paketformen in persimmon-shapes.tsx, damit Ableitungen dazu passen.
// Sobald das Designpaket eigene Formen liefert, ersetzen diese hier.
import * as React from "react";

/** Blatt mit Eselsohr (Form aus "documents"). */
const BLATT = "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6";
/** Einfacher Ordner. */
const ORDNER = "M3 6a2 2 0 0 1 2-2h4.5l2 3H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z";
/** Schild (Form aus "shield"). */
const SCHILD = "M12 2 3 6v6c0 5 5 9 9 10 4-1 9-5 9-10V6Z";
/** Person links, Platz für ein Zeichen rechts (Form aus "contacts"). */
const PERSON = <><circle cx="9" cy="7" r="3.5"/><path d="M2.5 21v-2a6.5 6.5 0 0 1 13 0v2"/></>;
/** Klemmbrett. */
const BRETT = <><rect x="4" y="4" width="16" height="18" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/></>;

export const erweiterungsNamen = [
  "activity", "swap", "calculator", "camera", "check-double", "check-square",
  "chevrons-left", "clipboard", "clipboard-check", "merge", "columns", "cpu",
  "card", "crown", "database", "file-check", "file-plus", "file-search",
  "file-x", "file-table", "file-code", "file-question", "file-chart",
  "folder-plus", "folder-in", "folder-tree", "reply", "reply-all", "forward",
  "court", "gem", "globe", "grip", "hash", "heart", "id-card", "image",
  "inbox", "key", "mail-open", "minus-circle", "x-circle", "panel-left",
  "panel-left-close", "palette", "plug", "printer", "undo", "scissors",
  "server", "shield-alert", "shield-off", "note", "swords", "table", "tag",
  "target", "thumbs-up", "trend-up", "trend-down", "trophy", "frame", "flame",
  "skull", "shop", "sliders", "stamp", "idea", "bug", "user-check",
  "user-minus", "user-plus", "user-cog", "wifi", "wifi-off", "zap",
  "zoom-in", "zoom-out",
  // Editor-Werkzeugleiste
  "bold", "italic", "underline", "strikethrough", "heading-1", "heading-2",
  "heading-3", "list", "list-ordered", "quote", "code", "text",
] as const;
export type ErweiterungsName = (typeof erweiterungsNamen)[number];

export const erweiterungsFormen: Record<ErweiterungsName, React.ReactNode> = {
  "activity": <><path d="M2 12h4l3-7 6 14 3-7h4"/></>,
  "swap": <><path d="M4 8h16m-4-4 4 4-4 4"/><path d="M20 16H4m4-4-4 4 4 4" data-accent="true"/></>,
  "calculator": <><rect x="5" y="2" width="14" height="20" rx="2"/><rect x="8" y="5" width="8" height="4" rx="1" data-accent="true"/><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 17h.01M12 17h.01M15.5 17h.01"/></>,
  "camera": <><path d="M3 8a2 2 0 0 1 2-2h2.5L9 4h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><circle cx="12" cy="13" r="3.5" data-accent="true"/></>,
  "check-double": <><path d="m2 12.5 4.5 4.5L17 6.5"/><path d="m11.5 16 1 1L22 7.5" data-accent="true"/></>,
  "check-square": <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m7.5 12 3 3 6-6" data-accent="true"/></>,
  "chevrons-left": <><path d="m11 6-6 6 6 6"/><path d="m19 6-6 6 6 6" data-accent="true"/></>,
  "clipboard": <>{BRETT}<path d="M8 11h8M8 15h8M8 19h4" data-accent="true"/></>,
  "clipboard-check": <>{BRETT}<path d="m8.5 14 2.5 2.5 4.5-5" data-accent="true"/></>,
  "merge": <><rect x="3" y="2" width="7" height="7" rx="1.5"/><rect x="14" y="2" width="7" height="7" rx="1.5"/><path d="M6.5 9v1a3 3 0 0 0 3 3h5a3 3 0 0 0 3-3V9"/><path d="M12 13v8m-3-3 3 3 3-3" data-accent="true"/></>,
  "columns": <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18" data-accent="true"/></>,
  "cpu": <><rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1" data-accent="true"/><path d="M9.5 2.5V6M14.5 2.5V6M9.5 18v3.5M14.5 18v3.5M2.5 9.5H6M2.5 14.5H6M18 9.5h3.5M18 14.5h3.5"/></>,
  "card": <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4" data-accent="true"/></>,
  "crown": <><path d="m3 7 4.5 4L12 4l4.5 7L21 7l-1.5 11h-15Z"/><path d="M5 21h14" data-accent="true"/></>,
  "database": <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" data-accent="true"/></>,
  "file-check": <><path d={BLATT}/><path d="m8.5 15 2.5 2.5 4.5-5" data-accent="true"/></>,
  "file-plus": <><path d={BLATT}/><path d="M12 12v6M9 15h6" data-accent="true"/></>,
  "file-search": <><path d={BLATT}/><circle cx="11" cy="14.5" r="2.5" data-accent="true"/><path d="m13 16.5 2.5 2.5" data-accent="true"/></>,
  "file-x": <><path d={BLATT}/><path d="m9.5 12.5 5 5m0-5-5 5" data-accent="true"/></>,
  "file-table": <><path d={BLATT}/><path d="M8 12h8v6H8ZM8 15h8M12 12v6" data-accent="true"/></>,
  "file-code": <><path d={BLATT}/><path d="m10 12-2 2.5 2 2.5m4-5 2 2.5-2 2.5" data-accent="true"/></>,
  "file-question": <><path d={BLATT}/><path d="M10 12.5a2 2 0 1 1 3 1.7c-.6.4-1 .8-1 1.6M12 18.5h.01" data-accent="true"/></>,
  "file-chart": <><path d={BLATT}/><path d="M8.5 18v-3M12 18v-6M15.5 18v-4" data-accent="true"/></>,
  "folder-plus": <><path d={ORDNER}/><path d="M12 10.5v6m-3-3h6" data-accent="true"/></>,
  "folder-in": <><path d={ORDNER}/><path d="M8 13.5h7m-3-3 3 3-3 3" data-accent="true"/></>,
  "folder-tree": <><rect x="3" y="3" width="7" height="5" rx="1"/><rect x="14" y="10" width="7" height="5" rx="1"/><rect x="14" y="17" width="7" height="5" rx="1"/><path d="M6.5 8v11.5H14M6.5 12.5H14" data-accent="true"/></>,
  "reply": <><path d="M9 5 3 11l6 6"/><path d="M3 11h11a7 7 0 0 1 7 7v1" data-accent="true"/></>,
  "reply-all": <><path d="M7 5 2 10l5 5M12 5l-5 5 5 5"/><path d="M7 10h7a7 7 0 0 1 7 7v2" data-accent="true"/></>,
  "forward": <><path d="m15 5 6 6-6 6"/><path d="M21 11H10a7 7 0 0 0-7 7v1" data-accent="true"/></>,
  "court": <><path d="m3 9 9-6 9 6ZM2 21h20M4 18h16"/><path d="M6.5 9v9M12 9v9M17.5 9v9" data-accent="true"/></>,
  "gem": <><path d="M6 3h12l4 6-10 12L2 9ZM2 9h20"/><path d="M8.5 9 12 21l3.5-12" data-accent="true"/></>,
  "globe": <><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><ellipse cx="12" cy="12" rx="4" ry="9" data-accent="true"/></>,
  "grip": <><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></>,
  "hash": <><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/></>,
  "heart": <><path d="M12 20S3 14.5 3 8.5a4.5 4.5 0 0 1 9-1.5 4.5 4.5 0 0 1 9 1.5C21 14.5 12 20 12 20Z"/></>,
  "id-card": <><rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="10.5" r="2"/><path d="M5 16.5a3 3 0 0 1 6 0"/><path d="M14 9h4M14 13h4" data-accent="true"/></>,
  "image": <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="m21 15-5-5L5 21"/><circle cx="8.5" cy="8.5" r="1.5" data-accent="true"/></>,
  "inbox": <><path d="M5.5 5h13L21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6Z"/><path d="M3 13h5l1.5 3h5l1.5-3h5" data-accent="true"/></>,
  "key": <><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 20 3"/><path d="m17 6 3 3m-5.5-.5 2 2" data-accent="true"/></>,
  "mail-open": <><path d="M3 10 12 4l9 6v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="m3 10 9 6 9-6" data-accent="true"/></>,
  "minus-circle": <><circle cx="12" cy="12" r="9"/><path d="M8 12h8" data-accent="true"/></>,
  "x-circle": <><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6" data-accent="true"/></>,
  "panel-left": <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18" data-accent="true"/></>,
  "panel-left-close": <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="m16 9-3 3 3 3" data-accent="true"/></>,
  "palette": <><path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2.5a3.5 3.5 0 0 0 3.5-3.5C21 6.8 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1" data-accent="true"/><circle cx="9.5" cy="7" r="1" data-accent="true"/><circle cx="14.5" cy="7" r="1" data-accent="true"/></>,
  "plug": <><path d="M6 8h12v3a6 6 0 0 1-12 0ZM12 17v5"/><path d="M9 3v5M15 3v5" data-accent="true"/></>,
  "printer": <><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1" data-accent="true"/></>,
  "undo": <><path d="M3.5 8.9A9 9 0 1 1 5.6 18.4"/><path d="M3 3.5V9h5.5" data-accent="true"/></>,
  "scissors": <><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.5 7.8 20 18M8.5 16.2 20 6" data-accent="true"/></>,
  "server": <><rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01M11 6.5h6M11 17.5h6" data-accent="true"/></>,
  "shield-alert": <><path d={SCHILD}/><path d="M12 7.5v5M12 16.5h.01" data-accent="true"/></>,
  "shield-off": <><path d={SCHILD}/><path d="m4 4 16 16" data-accent="true"/></>,
  "note": <><path d="M4 3h16v11l-7 7H4ZM13 21v-7h7"/><path d="M8 8h8M8 12h3" data-accent="true"/></>,
  "swords": <><path d="M4 4l11 11M20 4 9 15"/><path d="m13 17 4-4M11 17l-4-4M16 16l4 4M8 16l-4 4" data-accent="true"/></>,
  "table": <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M10 9v12" data-accent="true"/></>,
  "tag": <><path d="M3 4a1 1 0 0 1 1-1h7l10 10-8 8L3 11Z"/><circle cx="7.5" cy="7.5" r="1.5" data-accent="true"/></>,
  "target": <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" data-accent="true"/></>,
  "thumbs-up": <><path d="M7 10v11H3V10ZM7 10l4-8a2.5 2.5 0 0 1 3 3l-1 4h6a2 2 0 0 1 2 2.3l-1.4 7a2 2 0 0 1-2 1.7H7"/></>,
  "trend-up": <><path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6" data-accent="true"/></>,
  "trend-down": <><path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6" data-accent="true"/></>,
  "trophy": <><path d="M7 3h10v6a5 5 0 0 1-10 0ZM7 5H4v1a4 4 0 0 0 3.5 4M17 5h3v1a4 4 0 0 1-3.5 4M12 14v4"/><path d="M8 21h8M10 18h4" data-accent="true"/></>,
  "frame": <><rect x="3" y="3" width="18" height="18" rx="3"/><rect x="7.5" y="7.5" width="9" height="9" rx="1.5" data-accent="true"/></>,
  "flame": <><path d="M12 22a7 7 0 0 1-7-7c0-3 3-6 5-8 0 2 1 3 2 4 0-3 1-5 3-8 1 4 4 6 4 12a7 7 0 0 1-7 7Z"/><path d="M12 22a2.5 2.5 0 0 1-2.5-2.5c0-1.5 1.5-3 2.5-4 1 1 2.5 2.5 2.5 4A2.5 2.5 0 0 1 12 22Z" data-accent="true"/></>,
  "skull": <><path d="M12 3a8 8 0 0 0-8 8c0 3 1.5 5 4 6v4h8v-4c2.5-1 4-3 4-6a8 8 0 0 0-8-8ZM10.5 21v-2.5M13.5 21v-2.5"/><circle cx="9" cy="11" r="1.5" data-accent="true"/><circle cx="15" cy="11" r="1.5" data-accent="true"/></>,
  "shop": <><path d="M5 7h14l1 14H4Z"/><path d="M9 10V6a3 3 0 0 1 6 0v4" data-accent="true"/></>,
  "sliders": <><path d="M3 6h10M17 6h4M3 12h4M11 12h10M3 18h12M19 18h2"/><circle cx="15" cy="6" r="2" data-accent="true"/><circle cx="9" cy="12" r="2" data-accent="true"/><circle cx="17" cy="18" r="2" data-accent="true"/></>,
  "stamp": <><path d="M8.5 6a3.5 3.5 0 0 1 7 0c0 2.5-1.5 3.5-1.5 7.5h-4c0-4-1.5-5-1.5-7.5ZM4 13.5h16v4H4Z"/><path d="M6 21h12" data-accent="true"/></>,
  "idea": <><path d="M9 16c0-2.5-3-4-3-7a6 6 0 0 1 12 0c0 3-3 4.5-3 7Z"/><path d="M9.5 19h5M10.5 22h3" data-accent="true"/></>,
  "bug": <><rect x="7" y="7" width="10" height="14" rx="5"/><path d="M9 7.5a3 3 0 0 1 6 0M3 14h4M17 14h4M4 8l3 2.5M20 8l-3 2.5M4 20l3-2.5M20 20l-3-2.5"/><path d="M12 11v10" data-accent="true"/></>,
  "user-check": <>{PERSON}<path d="m16 11 2 2 4-4" data-accent="true"/></>,
  "user-minus": <>{PERSON}<path d="M16 11h6" data-accent="true"/></>,
  "user-plus": <>{PERSON}<path d="M19 8v6m-3-3h6" data-accent="true"/></>,
  "user-cog": <>{PERSON}<circle cx="19" cy="15" r="2" data-accent="true"/><path d="M19 11.5v1.5M19 17v1.5M15.5 15H17M21 15h1" data-accent="true"/></>,
  "wifi": <><path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><path d="M12 19.5h.01" data-accent="true"/></>,
  "wifi-off": <><path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01"/><path d="m3 3 18 18" data-accent="true"/></>,
  "zap": <><path d="M13 2 4 14h7l-1 8 9-12h-7Z"/></>,
  "zoom-in": <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/><path d="M10.5 8v5M8 10.5h5" data-accent="true"/></>,
  "zoom-out": <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/><path d="M8 10.5h5" data-accent="true"/></>,
  // Editor-Werkzeugleiste: Buchstaben als Strichformen
  "bold": <><path d="M7 4h6a4 4 0 0 1 0 8H7ZM7 12h7a4 4 0 0 1 0 8H7Z"/></>,
  "italic": <><path d="M10 4h8M6 20h8M15 4 9 20"/></>,
  "underline": <><path d="M7 4v7a5 5 0 0 0 10 0V4"/><path d="M5 21h14" data-accent="true"/></>,
  "strikethrough": <><path d="M16.5 6.5C15.5 4.8 14 4 12 4 9.5 4 7.5 5.5 7.5 8c0 2 1.5 3 4.5 4M7.5 17.5c1 1.7 2.5 2.5 4.5 2.5 2.5 0 4.5-1.5 4.5-4 0-1.5-.7-2.5-2-3.2"/><path d="M4 12h16" data-accent="true"/></>,
  "heading-1": <><path d="M4 5v14M12 5v14M4 12h8"/><path d="M16.5 11.5 19 10v9" data-accent="true"/></>,
  "heading-2": <><path d="M4 5v14M12 5v14M4 12h8"/><path d="M16 11.5a2.3 2.3 0 0 1 4.5.6c0 2.4-4.5 3.9-4.5 6.9h4.5" data-accent="true"/></>,
  "heading-3": <><path d="M4 5v14M12 5v14M4 12h8"/><path d="M16 10h4.5L18 13.5a2.8 2.8 0 1 1-2 4.8" data-accent="true"/></>,
  "list": <><path d="M9 6h12M9 12h12M9 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01" data-accent="true"/></>,
  "list-ordered": <><path d="M10 6h11M10 12h11M10 18h11"/><path d="M4 5l1.5-1v4M3.5 11a1.3 1.3 0 0 1 2.5.4c0 1-2.5 1.6-2.5 2.6H6M3.5 16H6l-1.5 1.7a1.2 1.2 0 1 1-1 2.1" data-accent="true"/></>,
  "quote": <><path d="M4 18v-5a7 7 0 0 1 5-7M4 13h5v5H4ZM14 18v-5a7 7 0 0 1 5-7M14 13h5v5h-5Z"/></>,
  "code": <><path d="m8 7-5 5 5 5M16 7l5 5-5 5"/><path d="m14 4-4 16" data-accent="true"/></>,
  "text": <><path d="M5 7V4h14v3M12 4v16M9 20h6"/></>,
};
