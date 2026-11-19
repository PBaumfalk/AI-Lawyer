import { getSetting } from "@/lib/settings/service";

const DEFAULT_API_URL = "https://api.bea.expert";
const DEFAULT_TIMEOUT_MS = 60_000;

/** Error raised for any failed bea.expert call. Never carries credentials. */
export class BeaExpertError extends Error {
  funktion: string;
  status: number | null;
  antwort: unknown;

  constructor(
    message: string,
    funktion: string,
    status: number | null = null,
    antwort: unknown = null,
  ) {
    super(message);
    this.name = "BeaExpertError";
    this.funktion = funktion;
    this.status = status;
    this.antwort = antwort;
  }
}

export async function getBeaExpertKonfig(): Promise<{ apiUrl: string; ident: string }> {
  const ident = process.env.BEA_EXPERT_IDENT?.trim();
  if (!ident) {
    throw new BeaExpertError(
      "beA ist nicht eingerichtet: BEA_EXPERT_IDENT fehlt.",
      "konfig",
    );
  }
  const configured = (await getSetting("bea.api_url"))?.trim();
  const apiUrl = (configured || DEFAULT_API_URL).replace(/\/+$/, "");
  return { apiUrl, ident };
}

/**
 * Calls a bea.expert REST function. Payload is sent as UTF-8 JSON, base64 encoded
 * in the form field `j`. No automatic retry here: callers decide (sending must never retry).
 */
export async function bexAufruf<T = unknown>(
  funktion: string,
  nutzlast: Record<string, unknown>,
  opts: { timeoutMs?: number } = {},
): Promise<T> {
  const { apiUrl, ident } = await getBeaExpertKonfig();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const j = Buffer.from(JSON.stringify(nutzlast), "utf8").toString("base64");

  let res: Response;
  try {
    res = await fetch(`${apiUrl}/${funktion}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "bex-ident": ident,
      },
      body: new URLSearchParams({ j }).toString(),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new BeaExpertError(
      timedOut
        ? `Zeitüberschreitung bei beA-Aufruf ${funktion} nach ${timeoutMs} ms.`
        : `beA-Dienst nicht erreichbar (${funktion}).`,
      funktion,
    );
  }

  const text = await res.text();
  let antwort: unknown = null;
  try {
    antwort = text ? JSON.parse(text) : null;
  } catch {
    antwort = text;
  }

  if (!res.ok) {
    throw new BeaExpertError(
      `beA-Dienst antwortete mit HTTP ${res.status} (${funktion}).`,
      funktion,
      res.status,
      antwort,
    );
  }

  const fehler =
    antwort && typeof antwort === "object" ? (antwort as { error?: unknown }).error : undefined;
  if (fehler !== undefined && fehler !== null && fehler !== "") {
    throw new BeaExpertError(
      `beA-Fehler (${funktion}): ${typeof fehler === "string" ? fehler : JSON.stringify(fehler)}`,
      funktion,
      res.status,
      antwort,
    );
  }

  return antwort as T;
}
