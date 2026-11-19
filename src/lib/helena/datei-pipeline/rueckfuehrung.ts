/**
 * Local re-identification: placeholders -> original values.
 *
 * Runs entirely inside the Kanzlei using the hash pairs fetched from anymize,
 * so original values never have to be sent anywhere again. Tolerates the
 * typical ways an LLM mangles placeholders (single brackets, missing brackets,
 * changed case).
 */

import type { HashPaar } from "./types";
import { PLATZHALTER_REGEX } from "./pii-guard";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Values wrapped across lines in the source come back from anymize with an
 * escaped line break ("Logistik\\nHoffmann", observed live 2026-11-19).
 * Inside running text a value is one phrase: collapse to a single space.
 */
export function bereinigeOriginal(original: string): string {
  return original.replace(/(?:\\r)?\\n|\s*[\r\n]+\s*/g, " ").replace(/ {2,}/g, " ").trim();
}

/**
 * @param json  text is JSON (structured output, tool-call arguments): originals
 *              are inserted JSON-escaped so the JSON stays valid.
 */
export function lokaleRueckfuehrung(text: string, paare: HashPaar[], json = false): { text: string; ersetzt: number; offen: number } {
  let ersetzt = 0;
  let out = text;
  const sortiert = [...paare]
    .map((p) => {
      const o = bereinigeOriginal(p.original);
      return { ...p, original: json ? JSON.stringify(o).slice(1, -1) : o };
    })
    .sort((a, b) => b.placeholder.length - a.placeholder.length);

  for (const p of sortiert) {
    const exakt = new RegExp(escapeRegex(p.placeholder), "g");
    out = out.replace(exakt, () => {
      ersetzt++;
      return p.original;
    });
  }
  // Lenient pass for mangled placeholders: [Person-A1B2C3], Person-A1B2C3, [[person-a1b2c3]].
  for (const p of sortiert) {
    const kern = p.placeholder.replace(/^\[+|\]+$/g, "");
    if (kern.length < 6 || !/[-_]/.test(kern)) continue;
    const locker = new RegExp(`\\[{0,2}(?<![\\p{L}\\p{N}-])${escapeRegex(kern)}(?![\\p{L}\\p{N}])\\]{0,2}`, "giu");
    out = out.replace(locker, () => {
      ersetzt++;
      return p.original;
    });
  }
  const offen = (out.match(PLATZHALTER_REGEX) ?? []).length;
  return { text: out, ersetzt, offen };
}
