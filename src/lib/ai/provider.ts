/**
 * Multi-provider AI factory driven by SystemSetting.
 *
 * Supports Ollama (local), OpenAI, and Anthropic as interchangeable providers.
 * Provider selection and credentials are read from SystemSetting at runtime.
 *
 * === Helena HARD LIMITS ===
 * The AI assistant "Helena" may NEVER:
 * - Send emails, beA messages, or any external communications
 * - Set document status to FREIGEGEBEN or VERSENDET
 * - Activate or deactivate deadlines (Fristen)
 * - Delete any data (Akten, Dokumente, Kontakte, etc.)
 * - Modify financial records (Rechnungen, Buchungen)
 * - Change user roles or permissions
 * All AI output is ENTWURF by default and requires human Freigabe.
 * ===========================
 */

import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOllama } from "ollama-ai-provider";
import { generateText, type LanguageModel } from "ai";
import { getSettingTyped } from "@/lib/settings/service";
import { prisma } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { schuetzeModell } from "./datenschutz-schleuse";
import { AnymizeClient } from "@/lib/helena/datei-pipeline/anymize-client";
import { modellEintrag, DENKAUFWAND } from "@/lib/helena/datei-pipeline/modelle";
import { einwilligungDerAkte, bekannteWerteDerAkte } from "@/lib/helena/datei-pipeline/akte-daten";
import { nerPruefer } from "@/lib/helena/datei-pipeline/ner-pruefer";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PROVIDER_OPTIONS = [
  { value: "ollama", label: "Ollama (Lokal)" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "anymize", label: "anymize (Pseudonymisierung, Modelle in Deutschland oder Foundation-Modelle)" },
] as const;

export type AiProvider = (typeof PROVIDER_OPTIONS)[number]["value"];

/** Default models per provider */
export const DEFAULT_MODELS: Record<AiProvider, string> = {
  ollama: "qwen3.5:35b",
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-20250514",
  anymize: "waterfall-2.0",
};

// ---------------------------------------------------------------------------
// Provider instance cache (avoids re-creation per request)
// ---------------------------------------------------------------------------

let cachedOllama: ReturnType<typeof createOllama> | null = null;
let cachedOllamaUrl = "";

// ---------------------------------------------------------------------------
// Datenschutz-Schleuse for every external model
// ---------------------------------------------------------------------------

const schleusenLog = createLogger("datenschutz-schleuse");

function anymizeChatModell(apiKey: string, baseUrl: string, modellId: string): LanguageModel {
  if (!modellEintrag(modellId)) {
    throw new Error(`Modell "${modellId}" steht nicht auf der Positivliste der Datei-Pipeline (modelle.ts)`);
  }
  const provider = createOpenAI({
    apiKey,
    baseURL: `${baseUrl.replace(/\/+$/, "")}/api/v1/llm`,
    compatibility: "compatible",
    // anymize's own reasoning models answer only with a limited reasoning budget (live 2026-11-19).
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof init?.body === "string" && modellEintrag(modellId)?.denkaufwand) {
        const body = JSON.parse(init.body);
        body.reasoning_effort ??= DENKAUFWAND.allgemein;
        init = { ...init, body: JSON.stringify(body) };
      }
      return fetch(input, init);
    }) as typeof fetch,
  });
  return provider.chat(modellId);
}

/**
 * External model wrapped in the Datenschutz-Schleuse: content is pseudonymised
 * by anymize before it leaves, checked by the egress guard, and re-identified
 * locally. Without an anymize key external providers are refused.
 */
export async function schleusenModell(provider: string, modellName: string): Promise<LanguageModel> {
  const anymizeKey = await getSettingTyped<string>("anymize.apiKey", process.env.ANYMIZE_API_KEY ?? "");
  const anymizeUrl = await getSettingTyped<string>("anymize.baseUrl", "https://app.anymize.ai");
  if (!anymizeKey) {
    throw new Error(
      "Externe KI-Anbieter sind nur über die Datenschutz-Schleuse erlaubt. Bitte anymize unter Einstellungen → KI einrichten oder Ollama (lokal) verwenden.",
    );
  }
  const providerKey = await getSettingTyped<string>("ai.provider.apiKey", "");
  let basis: LanguageModel;
  let standort: "anymize-de" | "fremdanbieter";
  if (provider === "anymize") {
    basis = anymizeChatModell(anymizeKey, anymizeUrl, modellName);
    standort = modellEintrag(modellName)!.standort;
  } else if (provider === "openai") {
    basis = createOpenAI({ apiKey: providerKey })(modellName);
    standort = "fremdanbieter";
  } else if (provider === "anthropic") {
    basis = createAnthropic({ apiKey: providerKey })(modellName);
    standort = "fremdanbieter";
  } else {
    throw new Error(`Unbekannter KI-Anbieter: ${provider}`);
  }
  const nerAn = await getSettingTyped<boolean>("helena.datei.nerPruefung", true);
  const pflicht = await getSettingTyped<boolean>("helena.datei.einwilligungErforderlich", true);
  const kanzlei = await prisma.kanzlei.findFirst({ select: { name: true } }).catch(() => null);
  const zusatzBegriffe = await getSettingTyped<unknown>("ai.schleuse.erlaubteBegriffe", []);
  return schuetzeModell(basis, {
    anymize: () => new AnymizeClient({ apiKey: anymizeKey, baseUrl: anymizeUrl }),
    standort,
    ersatzModell: () => anymizeChatModell(anymizeKey, anymizeUrl, "waterfall-2.0"),
    einwilligungLaden: (akteId) => einwilligungDerAkte(akteId),
    einwilligungErforderlich: pflicht,
    bekannteWerteLaden: (akteId) => bekannteWerteDerAkte(akteId),
    // Own firm name and admin-configured terms are not client data.
    erlaubteBegriffe: [
      ...(kanzlei?.name ? [kanzlei.name] : []),
      ...(Array.isArray(zusatzBegriffe) ? zusatzBegriffe.filter((x): x is string => typeof x === "string") : []),
    ],
    zusatzPruefer: nerAn ? nerPruefer : undefined,
    log: schleusenLog,
  });
}

// ---------------------------------------------------------------------------
// getModel — Main factory function
// ---------------------------------------------------------------------------

/**
 * Get the AI language model configured in SystemSettings.
 * Reads provider, API key, model name, and Ollama URL from the database.
 * Caches provider instances (invalidated when config changes).
 */
export async function getModel(): Promise<LanguageModel> {
  const provider = await getSettingTyped<string>("ai.provider", "ollama");
  const model = await getSettingTyped<string>(
    "ai.provider.model",
    DEFAULT_MODELS[provider as AiProvider] ?? "qwen3.5:35b"
  );
  const ollamaUrl = await getSettingTyped<string>(
    "ai.ollama.url",
    process.env.OLLAMA_URL || "http://localhost:11434"
  );

  switch (provider) {
    case "openai":
    case "anthropic":
    case "anymize":
      // External providers only ever behind the Datenschutz-Schleuse.
      return schleusenModell(provider, model);
    case "ollama":
    default: {
      if (!cachedOllama || cachedOllamaUrl !== ollamaUrl) {
        cachedOllama = createOllama({ baseURL: `${ollamaUrl}/api` });
        cachedOllamaUrl = ollamaUrl;
      }
      // LFM2 models need specific sampling settings per docs.liquid.ai
      const isLfm = model.toLowerCase().startsWith("lfm");
      const ollamaSettings = isLfm
        ? { minP: 0.15, repeatPenalty: 1.05 }
        : {};
      return cachedOllama(model, ollamaSettings);
    }
  }
}

/**
 * Get the configured provider name (for tracking purposes).
 */
export async function getProviderName(): Promise<string> {
  return getSettingTyped<string>("ai.provider", "ollama");
}

/**
 * Get the configured model name (for tracking purposes).
 */
export async function getModelName(): Promise<string> {
  const provider = await getSettingTyped<string>("ai.provider", "ollama");
  return getSettingTyped<string>(
    "ai.provider.model",
    DEFAULT_MODELS[provider as AiProvider] ?? "qwen3.5:35b"
  );
}

// ---------------------------------------------------------------------------
// testProviderConnection — Test if the provider is reachable
// ---------------------------------------------------------------------------

interface ConnectionTestResult {
  success: boolean;
  latency: number;
  error?: string;
}

/**
 * Test provider connection with a minimal AI call.
 * Optionally accepts explicit config (for testing before saving settings).
 */
export async function testProviderConnection(config?: {
  provider: string;
  apiKey?: string;
  model?: string;
  ollamaUrl?: string;
}): Promise<ConnectionTestResult> {
  const start = Date.now();

  try {
    let model: LanguageModel;

    if (config) {
      // Use explicit config (test before save)
      const modelName =
        config.model ||
        DEFAULT_MODELS[config.provider as AiProvider] ||
        "qwen3.5:35b";

      switch (config.provider) {
        case "openai":
          model = createOpenAI({ apiKey: config.apiKey || "" })(modelName);
          break;
        case "anthropic":
          model = createAnthropic({ apiKey: config.apiKey || "" })(modelName);
          break;
        case "anymize":
          // Connection test with a fixed text, no case data: no Schleuse needed.
          model = anymizeChatModell(config.apiKey || "", "https://app.anymize.ai", modelName);
          break;
        case "ollama":
        default: {
          const url =
            config.ollamaUrl ||
            process.env.OLLAMA_URL ||
            "http://localhost:11434";
          model = createOllama({ baseURL: `${url}/api` })(modelName);
          break;
        }
      }
    } else {
      model = await getModel();
    }

    await generateText({
      model,
      prompt: "Antworte nur mit OK",
      maxTokens: 50,
    });

    return { success: true, latency: Date.now() - start };
  } catch (error: any) {
    return {
      success: false,
      latency: Date.now() - start,
      error: error.message || "Unknown error",
    };
  }
}

// ---------------------------------------------------------------------------
// isProviderAvailable — Quick health check
// ---------------------------------------------------------------------------

/**
 * Quick health check without making an AI call.
 * Ollama: GET /api/version. Cloud providers: validates API key format.
 */
export async function isProviderAvailable(): Promise<boolean> {
  try {
    const provider = await getSettingTyped<string>("ai.provider", "ollama");

    if (provider === "ollama") {
      const ollamaUrl = await getSettingTyped<string>(
        "ai.ollama.url",
        process.env.OLLAMA_URL || "http://localhost:11434"
      );
      const res = await fetch(`${ollamaUrl}/api/version`, {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    }

    // Cloud providers: check that API key is configured
    const apiKey = await getSettingTyped<string>("ai.provider.apiKey", "");
    return apiKey.length > 10;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helena user helper
// ---------------------------------------------------------------------------

let cachedHelenaId: string | null = null;

/**
 * Get Helena's user ID (the system AI bot user).
 * Caches the result for the process lifetime.
 * Returns null if Helena user does not exist.
 */
export async function getHelenaUserId(): Promise<string | null> {
  if (cachedHelenaId) return cachedHelenaId;

  const helena = await prisma.user.findFirst({
    where: { isSystem: true, name: "Helena" },
    select: { id: true },
  });

  if (helena) {
    cachedHelenaId = helena.id;
  }

  return cachedHelenaId;
}
