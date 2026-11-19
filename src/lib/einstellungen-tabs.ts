/**
 * Deep links into /einstellungen (e.g. from /2fa-setup-required). The page
 * reads ?tab= with resolveEinstellungenTab, links build the URL with
 * einstellungenUrl, so both use the same tab ids.
 */
export const EINSTELLUNGEN_TABS = [
  "allgemein",
  "vertretung",
  "fristen",
  "vorlagen-settings",
  "briefkoepfe",
  "ordner-schemata",
  "benachrichtigungen",
  "kalender",
  "gamification",
  "import-export",
  "sicherheit",
] as const;

export type EinstellungenTab = (typeof EINSTELLUNGEN_TABS)[number];

export function einstellungenUrl(tab: EinstellungenTab): string {
  return `/einstellungen?tab=${tab}`;
}

/** Tab to open: the requested one if it exists and is visible, else "allgemein". */
export function resolveEinstellungenTab(
  requested: string | null | undefined,
  visible: readonly string[] = EINSTELLUNGEN_TABS
): EinstellungenTab {
  return requested && (EINSTELLUNGEN_TABS as readonly string[]).includes(requested) && visible.includes(requested)
    ? (requested as EinstellungenTab)
    : "allgemein";
}
