/**
 * Rule-based complexity classification for Helena queries.
 *
 * Determines execution mode (inline vs background) and model tier (1/2/3)
 * based on query content heuristics. No LLM call -- pure pattern matching.
 *
 * Tier 1: Small local model (fast, simple lookups)
 * Tier 2: Big local model (default, medium complexity)
 * Tier 3: Cloud model (complex legal filings, highest quality)
 *
 * Mode: inline (5-step cap, HTTP response) vs background (20-step, BullMQ)
 */

import type { LanguageModel } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOllama } from "ollama-ai-provider";
import { createLogger } from "@/lib/logger";
import { getSettingTyped } from "@/lib/settings/service";
import { getModel, getProviderName, DEFAULT_MODELS, type AiProvider } from "@/lib/ai/provider";

const log = createLogger("helena-classifier");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComplexityResult {
  mode: "inline" | "background";
  tier: 1 | 2 | 3;
  reason: string;
}

// ---------------------------------------------------------------------------
// Pattern sets for classification
// ---------------------------------------------------------------------------

/** Drafting-related terms (background + tier 2) */
const DRAFTING_TERMS = [
  "schriftsatz",
  "entwurf",
  "erstelle",
  "verfasse",
  "formuliere",
];

/** Legal research combined with legal terms (background + tier 2) */
const RESEARCH_TERM = "recherchiere";
const LEGAL_TERMS = ["gesetz", "urteil", "paragraph", "bgh", "bverfg", "zpo", "bgb", "stgb"];

/** Multi-entity analysis (background + tier 2) */
const COMPARE_TERMS = ["vergleiche", "gegenueberstelle"];

/** Exhaustive analysis terms (background + tier 2) */
const EXHAUSTIVE_TERMS = ["analysiere", "pruefe"];
const EXHAUSTIVE_SCOPE = ["alle", "vollstaendig", "komplett", "saemtliche"];

/** Legal filing types that warrant tier 3 */
const FILING_TERMS = ["klage", "antrag", "berufung", "revision", "widerspruch"];

/** Simple question indicators (inline + tier 1) */
const SIMPLE_QUESTION_STARTS = ["was ist", "zeige", "welche", "wie viele", "wann", "wer ist", "wo ist"];

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Classify a user query to determine execution mode and model tier.
 *
 * Rules are evaluated in priority order (first match wins):
 * 1. Background + Tier 3: Legal filing drafts (Schriftsatz + Klage/Antrag/etc.)
 * 2. Background + Tier 2: Drafting, research, comparison, exhaustive analysis, long queries
 * 3. Inline + Tier 1: Simple questions, short queries
 * 4. Default: Inline + Tier 2
 */
export function classifyComplexity(query: string): ComplexityResult {
  const lower = query.toLowerCase().trim();

  // --- Background + Tier 3: Legal filing drafts ---
  if (
    lower.includes("schriftsatz") &&
    FILING_TERMS.some((term) => lower.includes(term))
  ) {
    return {
      mode: "background",
      tier: 3,
      reason: `Schriftsatz mit ${FILING_TERMS.find((t) => lower.includes(t))} erkannt -- hoechste Qualitaetsstufe`,
    };
  }

  // --- Background + Tier 2: Drafting tasks ---
  if (DRAFTING_TERMS.some((term) => lower.includes(term))) {
    return {
      mode: "background",
      tier: 2,
      reason: `Entwurfsaufgabe erkannt: ${DRAFTING_TERMS.find((t) => lower.includes(t))}`,
    };
  }

  // --- Background + Tier 2: Legal research ---
  if (
    lower.includes(RESEARCH_TERM) &&
    LEGAL_TERMS.some((term) => lower.includes(term))
  ) {
    return {
      mode: "background",
      tier: 2,
      reason: `Rechtliche Recherche erkannt: ${RESEARCH_TERM} + ${LEGAL_TERMS.find((t) => lower.includes(t))}`,
    };
  }

  // --- Background + Tier 2: Multi-entity comparison ---
  if (COMPARE_TERMS.some((term) => lower.includes(term))) {
    return {
      mode: "background",
      tier: 2,
      reason: `Vergleichsanalyse erkannt: ${COMPARE_TERMS.find((t) => lower.includes(t))}`,
    };
  }

  // --- Background + Tier 2: Exhaustive analysis ---
  if (
    EXHAUSTIVE_TERMS.some((term) => lower.includes(term)) &&
    EXHAUSTIVE_SCOPE.some((scope) => lower.includes(scope))
  ) {
    return {
      mode: "background",
      tier: 2,
      reason: `Vollstaendige Analyse erkannt: ${EXHAUSTIVE_TERMS.find((t) => lower.includes(t))} + ${EXHAUSTIVE_SCOPE.find((s) => lower.includes(s))}`,
    };
  }

  // --- Background + Tier 2: Long complex instructions ---
  if (query.length > 300) {
    return {
      mode: "background",
      tier: 2,
      reason: `Lange Anfrage (${query.length} Zeichen) -- vermutlich komplex`,
    };
  }

  // --- Inline + Tier 1: Simple questions ---
  if (
    query.length < 80 &&
    SIMPLE_QUESTION_STARTS.some((start) => lower.startsWith(start))
  ) {
    return {
      mode: "inline",
      tier: 1,
      reason: `Einfache Frage erkannt: ${SIMPLE_QUESTION_STARTS.find((s) => lower.startsWith(s))}`,
    };
  }

  // --- Default: Inline + Tier 2 ---
  return {
    mode: "inline",
    tier: 2,
    reason: "Standard-Komplexitaet -- Inline mit mittlerem Modell",
  };
}

// ---------------------------------------------------------------------------
// Model selection by tier
// ---------------------------------------------------------------------------

/**
 * Get the LanguageModel instance for a given tier.
 *
 * Reads tier-specific model names from SystemSettings:
 * - ai.helena.tier1_model (default: default Ollama model)
 * - ai.helena.tier2_model (default: default Ollama model)
 * - ai.helena.tier3_model (default: cloud model from provider settings)
 *
 * Fallback chain: if a tier's model is unconfigured, falls back to next lower tier.
 */
export async function getModelForTier(
  tier: 1 | 2 | 3,
): Promise<{ model: LanguageModel; modelName: string }> {
  const provider = await getProviderName();

  // Read tier-specific model overrides from SystemSettings
  const tier3Model = await getSettingTyped<string>("ai.helena.tier3_model", "");
  const tier2Model = await getSettingTyped<string>("ai.helena.tier2_model", "");
  const tier1Model = await getSettingTyped<string>("ai.helena.tier1_model", "");

  // Resolve model name based on tier with fallback chain
  let modelName: string | null = null;

  if (tier === 3 && tier3Model) {
    modelName = tier3Model;
  } else if (tier >= 2 && tier2Model) {
    modelName = tier2Model;
  } else if (tier1Model) {
    modelName = tier1Model;
  }

  // If no tier-specific model configured, use the global default
  if (!modelName) {
    const model = await getModel();
    const defaultName = await getSettingTyped<string>(
      "ai.provider.model",
      DEFAULT_MODELS[provider as AiProvider] ?? "qwen3.5:35b",
    );
    return { model, modelName: defaultName };
  }

  // Create model instance for the tier-specific model name
  const model = await createModelForName(modelName, provider);
  return { model, modelName };
}

/**
 * Create a LanguageModel instance for a specific model name.
 *
 * Uses the same provider infrastructure as getModel() in provider.ts
 * but allows overriding the model name for tier-specific selection.
 *
 * Model name format determines provider:
 * - "openai/gpt-4o" or starts with "gpt" -> OpenAI
 * - "anthropic/claude..." or starts with "claude" -> Anthropic
 * - Everything else -> Ollama (local)
 */
async function createModelForName(
  modelName: string,
  currentProvider: string,
): Promise<LanguageModel> {
  // Detect provider from model name prefix
  let resolvedProvider = currentProvider;
  let resolvedModel = modelName;

  if (modelName.includes("/")) {
    const [prefix, name] = modelName.split("/", 2);
    if (["openai", "anthropic", "ollama"].includes(prefix)) {
      resolvedProvider = prefix;
      resolvedModel = name;
    }
  } else if (modelName.startsWith("gpt") || modelName.startsWith("o1") || modelName.startsWith("o3")) {
    resolvedProvider = "openai";
  } else if (modelName.startsWith("claude")) {
    resolvedProvider = "anthropic";
  }

  switch (resolvedProvider) {
    case "openai": {
      const apiKey = await getSettingTyped<string>("ai.provider.apiKey", "");
      const openai = createOpenAI({ apiKey });
      return openai(resolvedModel);
    }
    case "anthropic": {
      const apiKey = await getSettingTyped<string>("ai.provider.apiKey", "");
      const anthropic = createAnthropic({ apiKey });
      return anthropic(resolvedModel);
    }
    case "ollama":
    default: {
      const ollamaUrl = await getSettingTyped<string>(
        "ai.ollama.url",
        process.env.OLLAMA_BASE_URL || "http://ollama:11434",
      );
      const ollama = createOllama({ baseURL: `${ollamaUrl}/api` });
      return ollama(resolvedModel);
    }
  }
}

/**
 * Escalate to the next higher tier. Caps at tier 3.
 * Used by the orchestrator when a stall is detected to retry
 * with a more capable model.
 */
export function escalateTier(currentTier: 1 | 2 | 3): 1 | 2 | 3 {
  if (currentTier >= 3) return 3;
  return (currentTier + 1) as 1 | 2 | 3;
}
