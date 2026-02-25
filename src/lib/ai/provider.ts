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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PROVIDER_OPTIONS = [
  { value: "ollama", label: "Ollama (Lokal)" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
] as const;

export type AiProvider = (typeof PROVIDER_OPTIONS)[number]["value"];

/** Default models per provider */
export const DEFAULT_MODELS: Record<AiProvider, string> = {
  ollama: "mistral:7b",
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-20250514",
};

// ---------------------------------------------------------------------------
// Provider instance cache (avoids re-creation per request)
// ---------------------------------------------------------------------------

let cachedOllama: ReturnType<typeof createOllama> | null = null;
let cachedOpenAI: ReturnType<typeof createOpenAI> | null = null;
let cachedAnthropic: ReturnType<typeof createAnthropic> | null = null;
let cachedOllamaUrl = "";
let cachedOpenAIKey = "";
let cachedAnthropicKey = "";

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
  const apiKey = await getSettingTyped<string>("ai.provider.apiKey", "");
  const model = await getSettingTyped<string>(
    "ai.provider.model",
    DEFAULT_MODELS[provider as AiProvider] ?? "mistral:7b"
  );
  const ollamaUrl = await getSettingTyped<string>(
    "ai.ollama.url",
    process.env.OLLAMA_BASE_URL || "http://ollama:11434"
  );

  switch (provider) {
    case "openai": {
      if (!cachedOpenAI || cachedOpenAIKey !== apiKey) {
        cachedOpenAI = createOpenAI({ apiKey });
        cachedOpenAIKey = apiKey;
      }
      return cachedOpenAI(model);
    }
    case "anthropic": {
      if (!cachedAnthropic || cachedAnthropicKey !== apiKey) {
        cachedAnthropic = createAnthropic({ apiKey });
        cachedAnthropicKey = apiKey;
      }
      return cachedAnthropic(model);
    }
    case "ollama":
    default: {
      if (!cachedOllama || cachedOllamaUrl !== ollamaUrl) {
        cachedOllama = createOllama({ baseURL: `${ollamaUrl}/api` });
        cachedOllamaUrl = ollamaUrl;
      }
      return cachedOllama(model);
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
    DEFAULT_MODELS[provider as AiProvider] ?? "mistral:7b"
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
        "mistral:7b";

      switch (config.provider) {
        case "openai":
          model = createOpenAI({ apiKey: config.apiKey || "" })(modelName);
          break;
        case "anthropic":
          model = createAnthropic({ apiKey: config.apiKey || "" })(modelName);
          break;
        case "ollama":
        default: {
          const url =
            config.ollamaUrl ||
            process.env.OLLAMA_BASE_URL ||
            "http://ollama:11434";
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
        process.env.OLLAMA_BASE_URL || "http://ollama:11434"
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
