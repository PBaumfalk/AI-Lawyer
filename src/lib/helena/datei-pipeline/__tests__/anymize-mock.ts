/**
 * In-process fake of the anymize API, following the documented contract
 * (https://anymize.ai/api-docs, 2026-11-19). It also fakes anymize's
 * OpenAI-compatible LLM endpoint and records EVERY request, so tests can
 * assert on what actually leaves the process.
 */

import { createHash } from "node:crypto";

export interface Aufzeichnung {
  methode: string;
  url: string;
  body: string;
}

export interface MockOptionen {
  /** Values the fake "recognises" and replaces. */
  erkennt: string[];
  /** Status polls before a job completes. */
  pollsBisFertig?: number;
  anonymizeStatus?: number;
  jobFehlschlag?: boolean;
  /** Return 429 for the first N anonymize calls. */
  rateLimitErsteN?: number;
  /** Simulates Zero Data Retention: no hash pairs. */
  zdr?: boolean;
  loeschenFehlschlag?: boolean;
  /** Function computing the fake LLM answer from the user prompt. */
  llmAntwort?: (nutzerPrompt: string) => string;
  llmStatus?: number;
  /** Simulates a reasoning model that only reasons until the token limit (fountain without effort). */
  nurDenken?: boolean;
  /** First N LLM calls fail with HTTP 504 (transient). */
  llm504ErsteN?: number;
}

export const BASIS = "https://app.anymize.ai";

function platzhalter(wert: string): string {
  // Live format observed 2026-11-19: [[person-RG5PJD]], [[iban-8C78C9]], [[tax_id-6D999F]]
  const typ = /@/.test(wert) ? "email" : /^DE\d{2}/.test(wert) ? "iban" : /\d{4,}/.test(wert.replace(/\s/g, "")) ? "tax_id" : "person";
  return `[[${typ}-${createHash("sha1").update(wert).digest("hex").slice(0, 6).toUpperCase()}]]`;
}

export function erstelleAnymizeMock(o: MockOptionen) {
  const aufzeichnungen: Aufzeichnung[] = [];
  const jobs = new Map<string, { text: string; anonym: string; paare: Array<{ original: string; placeholder: string; prefix_name: string; hash: string }>; polls: number; geloescht: boolean }>();
  let anonymizeAufrufe = 0;
  let llmAufrufe = 0;
  let naechsteId = 1;

  const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const methode = (init?.method ?? "GET").toUpperCase();
    const body = typeof init?.body === "string" ? init.body : init?.body ? String(init.body) : "";
    aufzeichnungen.push({ methode, url, body });

    if (!url.startsWith(BASIS)) throw new TypeError(`Mock: unerwartetes Ziel ${url}`);
    const pfad = url.slice(BASIS.length);
    const auth = new Headers(init?.headers).get("authorization");
    if (auth !== "Bearer ANYM_test") {
      return json(401, { error: { message: "Invalid API key", type: "auth_error", code: "invalid_api_key" } });
    }

    if (methode === "POST" && pfad === "/api/anonymize") {
      anonymizeAufrufe++;
      if (o.rateLimitErsteN && anonymizeAufrufe <= o.rateLimitErsteN) {
        return json(429, { error: { message: "Rate limit", type: "rate_limit_error", code: "rate_limit_exceeded" } }, { "Retry-After": "1" });
      }
      if (o.anonymizeStatus) return json(o.anonymizeStatus, { error: { message: `echo: ${body}`, type: "api_error", code: "boom" } });
      const { text } = JSON.parse(body) as { text: string };
      let anonym = text;
      const paare: Array<{ original: string; placeholder: string; prefix_name: string; hash: string }> = [];
      for (const wert of [...o.erkennt].sort((a, b) => b.length - a.length)) {
        // Like a real recogniser: tolerant to line breaks inside a value.
        const re = new RegExp(wert.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"), "g");
        if (!re.test(anonym)) continue;
        const ph = platzhalter(wert);
        anonym = anonym.replace(re, ph);
        paare.push({ original: wert, placeholder: ph, prefix_name: ph.slice(2, ph.indexOf("-")), hash: ph.slice(ph.indexOf("-") + 1, -2) });
      }
      const id = `job_${naechsteId++}`;
      jobs.set(id, { text, anonym, paare, polls: 0, geloescht: false });
      return json(202, { job_id: id, status: "processing", message: "Job created", zdr: !!o.zdr });
    }

    let m = /^\/api\/status\/([^/]+)$/.exec(pfad);
    if (methode === "GET" && m) {
      const job = jobs.get(m[1]);
      if (!job || job.geloescht) return json(404, { error: { message: "not found", type: "invalid_request_error", code: "not_found" } });
      job.polls++;
      if (job.polls <= (o.pollsBisFertig ?? 1)) return json(200, { status: job.polls % 2 ? "processing" : "pass1_extracting" });
      if (o.jobFehlschlag) return json(200, { status: "failed" });
      return json(200, { status: "completed", anonymized_text_raw: job.anonym, original_text: job.text, metadata: { language: "de", words: 1 } });
    }

    m = /^\/api\/status\/([^/]+)\/strings$/.exec(pfad);
    if (methode === "GET" && m) {
      const job = jobs.get(m[1]);
      if (!job || job.geloescht) return json(404, { error: { message: "not found", type: "invalid_request_error", code: "hash_pairs_not_found" } });
      const paare = o.zdr ? [] : job.paare;
      return json(200, { job_id: m[1], count: paare.length, hash_pairs: paare });
    }

    m = /^\/api\/v1\/jobs\/([^/]+)$/.exec(pfad);
    if (methode === "DELETE" && m) {
      if (o.loeschenFehlschlag) return json(500, { error: { message: "fail", type: "api_error", code: "internal" } });
      const job = jobs.get(m[1]);
      if (!job || job.geloescht) return json(404, { error: { message: "not found", type: "invalid_request_error", code: "not_found" } });
      job.geloescht = true;
      return json(200, { success: true });
    }

    if (methode === "POST" && pfad === "/api/deanonymize") {
      let { text } = JSON.parse(body) as { text: string };
      for (const job of jobs.values()) {
        if (job.geloescht || o.zdr) continue;
        for (const p of job.paare) text = text.split(p.placeholder).join(p.original);
      }
      return json(200, { text, replacements: 0 });
    }

    if (methode === "POST" && pfad === "/api/v1/llm/chat/completions") {
      llmAufrufe++;
      if (o.llm504ErsteN && llmAufrufe <= o.llm504ErsteN) return json(504, { error: { message: "gateway timeout", type: "api_error", code: "timeout" } });
      if (o.llmStatus) return json(o.llmStatus, { error: { message: "llm down", type: "api_error", code: "service_unavailable" } });
      const req = JSON.parse(body) as { model: string; messages: Array<{ role: string; content: string }> };
      const nutzer = req.messages.filter((x) => x.role === "user").map((x) => x.content).join("\n");
      const antwort = (o.llmAntwort ?? ((n) => `Zusammenfassung: ${(n.match(/\[\[[^\]]+\]\]/g) ?? []).join(", ")}`))(nutzer);
      if ((req as { stream?: boolean }).stream) {
        const denkenOk = !o.nurDenken || (req as { reasoning_effort?: string }).reasoning_effort === "low";
        const chunks = [
          { id: "c1", object: "chat.completion.chunk", created: 1, model: req.model, choices: [{ index: 0, delta: { role: "assistant", reasoning_content: "Ich denke nach über [[person-XYZ]] ...", reasoning_details: [{ type: "x" }] }, finish_reason: null }] },
          ...(denkenOk
            ? [{ id: "c1", object: "chat.completion.chunk", created: 1, model: req.model, choices: [{ index: 0, delta: { content: antwort.slice(0, 7) }, finish_reason: null }] },
               { id: "c1", object: "chat.completion.chunk", created: 1, model: req.model, choices: [{ index: 0, delta: { content: antwort.slice(7) }, finish_reason: null }] }]
            : []),
          { id: "c1", object: "chat.completion.chunk", created: 1, model: req.model, choices: [{ index: 0, delta: {}, finish_reason: denkenOk ? "stop" : "length" }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } },
        ];
        const sse = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
        return new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      return json(200, {
        id: "chatcmpl-1",
        object: "chat.completion",
        created: 1,
        model: req.model,
        choices: [{ index: 0, message: { role: "assistant", content: antwort }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
    }

    return json(404, { error: { message: "unknown route", type: "invalid_request_error", code: "not_found" } });
  }) as typeof fetch;

  return {
    fetchImpl,
    aufzeichnungen,
    jobs,
    /** All requests except the documented raw-data endpoint. */
    get ausgehendOhneAnonymize() {
      return aufzeichnungen.filter((a) => !(a.methode === "POST" && a.url === `${BASIS}/api/anonymize`));
    },
  };
}

/**
 * The acceptance check: no personal value may appear in any outgoing request
 * other than the anonymisation request itself. JSON bodies are decoded (so
 * "Demirta\u015f" is caught) and whitespace is collapsed on both sides (so a
 * value wrapped across lines in a PDF is caught too).
 */
export function findeLecks(aufzeichnungen: Aufzeichnung[], werte: string[]): Array<{ url: string; wert: string }> {
  const flach = (s: string) => s.normalize("NFC").replace(/\s+/g, " ");
  const strings = (v: unknown): string[] =>
    typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];
  const lecks: Array<{ url: string; wert: string }> = [];
  for (const a of aufzeichnungen) {
    let teile = [a.url, a.body];
    try {
      teile = teile.concat(strings(JSON.parse(a.body)));
    } catch {
      /* not JSON */
    }
    const inhalt = flach(teile.join("\n"));
    for (const w of werte) if (inhalt.includes(flach(w))) lecks.push({ url: a.url, wert: w });
  }
  return lecks;
}
