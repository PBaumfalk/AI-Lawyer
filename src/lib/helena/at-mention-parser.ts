/**
 * @Helena mention parser -- pure functions for detecting and extracting
 * @Helena mentions from text (including rich text editor HTML).
 *
 * No external dependencies. Used by task-service and API routes.
 */

/**
 * Parse an @Helena mention and extract the instruction text.
 *
 * - Case-insensitive match on "@Helena"
 * - Strips HTML tags before matching (handles rich text editors)
 * - Uses [\s\S] for dotall behavior so multiline instructions work
 * - Returns null if no match or empty instruction after @Helena
 *
 * @example
 * parseHelenaMention("@Helena bitte Klage pruefen")
 * // => "bitte Klage pruefen"
 *
 * parseHelenaMention("<p>@Helena</p> <p>Schriftsatz erstellen</p>")
 * // => "Schriftsatz erstellen"
 *
 * parseHelenaMention("@Helena")
 * // => null (no instruction text)
 */
export function parseHelenaMention(text: string): string | null {
  // Strip HTML tags to handle rich text editor output
  const stripped = text.replace(/<[^>]*>/g, " ");

  // Use [\s\S] instead of dotall /s flag for ES5+ compatibility
  const match = stripped.match(/@helena\s+([\s\S]+)/i);
  if (!match) return null;

  const instruction = match[1].trim();
  return instruction.length > 0 ? instruction : null;
}

/**
 * Quick check whether text contains an @Helena mention.
 *
 * Does NOT strip HTML -- caller decides whether to strip first.
 * Useful for early-exit checks before doing heavier parsing.
 */
export function hasHelenaMention(text: string): boolean {
  return /@helena\b/i.test(text);
}
