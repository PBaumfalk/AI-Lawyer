/**
 * Embedding generator via Ollama.
 * Uses multilingual-e5-large-instruct with E5 instruction prefixes
 * for passage (document) and query embedding generation.
 *
 * Gracefully checks Ollama availability so the embedding pipeline
 * can skip without blocking the OCR flow.
 */

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ?? "blaifa/multilingual-e5-large-instruct";

/** Timeout for embedding API calls in milliseconds (10 seconds) */
const EMBEDDING_TIMEOUT = 10_000;

/** Vector dimensionality for multilingual-e5-large-instruct */
export const EMBEDDING_DIMENSIONS = 1024;

/** Tracked model version string for safe model upgrades */
export const MODEL_VERSION = `${EMBEDDING_MODEL}@1.0`;

/**
 * Check if Ollama is reachable by hitting the /api/tags endpoint.
 * Returns true when Ollama responds, false otherwise (graceful).
 */
export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Generate an embedding for a document passage.
 * Prefixes text with "passage: " per E5 instruction format.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const prefixedText = `passage: ${text}`;

  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: prefixedText }),
    signal: AbortSignal.timeout(EMBEDDING_TIMEOUT),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Ollama embedding failed (${res.status}): ${body.slice(0, 200)}`
    );
  }

  const data = (await res.json()) as { embeddings: number[][] };
  if (!data.embeddings?.[0]) {
    throw new Error("Ollama returned empty embeddings array");
  }
  return data.embeddings[0];
}

/**
 * Generate an embedding for a search query.
 * Prefixes text with "query: " per E5 instruction format.
 */
export async function generateQueryEmbedding(
  query: string
): Promise<number[]> {
  const t0 = Date.now();
  const prefixedText = `query: ${query}`;

  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: prefixedText }),
    signal: AbortSignal.timeout(EMBEDDING_TIMEOUT),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Ollama query embedding failed (${res.status}): ${body.slice(0, 200)}`
    );
  }

  const data = (await res.json()) as { embeddings: number[][] };
  if (!data.embeddings?.[0]) {
    throw new Error("Ollama returned empty embeddings array");
  }

  console.log(`[embedder] Query embedding generated in ${Date.now() - t0}ms`);
  return data.embeddings[0];
}

/**
 * Generate embeddings for multiple texts in sequential batches.
 * Ollama handles one request at a time efficiently, so we process
 * sequentially within each batch.
 *
 * @param texts - Array of texts to embed
 * @param batchSize - Number of texts per batch (default 5)
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  batchSize = 5
): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    for (const text of batch) {
      results.push(await generateEmbedding(text));
    }
  }

  return results;
}
