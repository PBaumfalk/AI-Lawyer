/**
 * Ollama-specific utilities and backward-compatible generate wrapper.
 *
 * ollamaGenerate() now delegates to the AI SDK provider factory
 * via getModel() instead of making direct fetch calls.
 * The function signature is preserved for backward compatibility.
 */

import { generateText } from "ai";
import { getModel, getProviderName, getModelName } from "./provider";

// ---------------------------------------------------------------------------
// Hard Defaults — kept for backward compatibility references
// ---------------------------------------------------------------------------

export const AI_DEFAULTS = {
  model: "qwen3.5:35b",
  numCtx: 32_768,
  temperature: 0.3,
  topP: 0.9,
} as const;

const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";

// ---------------------------------------------------------------------------
// Types (preserved for backward compatibility)
// ---------------------------------------------------------------------------

interface OllamaGenerateOptions {
  model?: string;
  prompt: string;
  system?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  numCtx?: number;
}

interface OllamaGenerateResponse {
  response: string;
  model: string;
  total_duration?: number;
  eval_count?: number;
  // AI SDK usage info
  promptTokens?: number;
  completionTokens?: number;
}

// ---------------------------------------------------------------------------
// Generate — now via AI SDK
// ---------------------------------------------------------------------------

/**
 * Generate a completion using the configured AI provider (via AI SDK).
 * Maintains the same function signature as the original Ollama-direct version.
 * Falls back gracefully with provider info on error.
 */
export async function ollamaGenerate(
  opts: OllamaGenerateOptions
): Promise<OllamaGenerateResponse> {
  try {
    const model = await getModel();
    const providerName = await getProviderName();
    const modelName = await getModelName();

    const result = await generateText({
      model,
      prompt: opts.prompt,
      system: opts.system,
      maxTokens: opts.maxTokens ?? 2000,
      temperature: opts.temperature ?? AI_DEFAULTS.temperature,
      topP: opts.topP ?? AI_DEFAULTS.topP,
    });

    return {
      response: result.text,
      model: modelName,
      eval_count: result.usage?.completionTokens,
      promptTokens: result.usage?.promptTokens,
      completionTokens: result.usage?.completionTokens,
    };
  } catch (error: any) {
    const providerName = await getProviderName().catch(() => "unknown");
    const modelName = await getModelName().catch(() => "unknown");
    throw new Error(
      `AI provider error (${providerName}/${modelName}): ${error.message}`
    );
  }
}

// ---------------------------------------------------------------------------
// Health Check — kept for Ollama-specific checks
// ---------------------------------------------------------------------------

/**
 * Check if Ollama is reachable and a model is available.
 * This remains a direct fetch to the Ollama API for quick health checks.
 */
export async function ollamaHealthCheck(): Promise<{
  ok: boolean;
  models?: string[];
  error?: string;
}> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return {
      ok: true,
      models: data.models?.map((m: any) => m.name) ?? [],
    };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
