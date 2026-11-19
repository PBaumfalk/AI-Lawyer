/**
 * Strg+Shift+F (Windows/Linux) bzw. Cmd+Shift+F (macOS) öffnet den Fristenrechner.
 *
 * Mit gedrückter Umschalttaste liefert der Browser e.key === "F" (Großbuchstabe);
 * daher wird die physische Taste (e.code) bzw. der Buchstabe ohne Groß/Klein geprüft.
 */
export function istFristenrechnerKuerzel(
  e: Pick<KeyboardEvent, "key" | "code" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">,
): boolean {
  if (!(e.metaKey || e.ctrlKey) || !e.shiftKey || e.altKey) return false;
  return e.code === "KeyF" || e.key?.toLowerCase() === "f";
}
