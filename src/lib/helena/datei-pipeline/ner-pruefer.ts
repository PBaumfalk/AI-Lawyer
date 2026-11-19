/**
 * Local NER (Ollama) as additional egress check, with a chunk cache: agent runs
 * send the same system prompt and history again in every step.
 */

import { createHash } from "node:crypto";
import { runNerFilter } from "@/lib/pii/ner-filter";
import type { ZusatzPruefer } from "./types";

const FENSTER = 6000;
const cache = new Map<string, string[]>();
const MAX_CACHE = 2000;

export const nerPruefer: ZusatzPruefer = async (text) => {
  const funde = new Set<string>();
  for (let i = 0; i < text.length; i += FENSTER - 200) {
    const stueck = text.slice(i, i + FENSTER);
    const k = createHash("sha256").update(stueck).digest("hex");
    let personen = cache.get(k);
    if (!personen) {
      personen = (await runNerFilter(stueck)).persons;
      if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
      cache.set(k, personen);
    }
    personen.forEach((p) => funde.add(p));
  }
  return { funde: [...funde] };
};
