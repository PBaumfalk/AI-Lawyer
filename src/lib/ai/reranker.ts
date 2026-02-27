/**
 * LLM-as-reranker using Ollama (qwen3.5:35b).
 * Implements a single-batch pointwise reranking prompt to avoid per-candidate latency.
 * Falls back silently to RRF order on any error (timeout, non-JSON, Ollama down).
 */

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const RERANKER_MODEL = "qwen3.5:35b";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Candidate returned by RRF fusion. Shared between reranker and hybrid-search.
 */
export interface RrfCandidate {
  /** Chunk ID (DocumentChunk.id) */
  id: string;
  dokumentId: string;
  dokumentName: string;
  akteAktenzeichen: string;
  akteBeschreibung: string;
  /** Child chunk content (500 tokens) — the retrieval match */
  content: string;
  /** 'STANDALONE' | 'CHILD' | 'PARENT' */
  chunkType: string;
  parentChunkId: string | null;
  /** RRF score */
  score: number;
  sources: ("bm25" | "vector")[];
}

// ─── Batch reranker ───────────────────────────────────────────────────────────

/**
 * Rerank candidates using a single Ollama batch prompt.
 *
 * Sends one request with all candidates (truncated to 300 chars each).
 * Expects JSON response: { "id": score, ... }
 *
 * On ANY error (timeout, non-JSON, Ollama down):
 *   - Logs a warning
 *   - Returns the first 10 candidates in their original RRF order
 *
 * @param query - The user query (German legal context)
 * @param candidates - Up to 50 RRF candidates to rerank
 * @param timeoutMs - Abort timeout in milliseconds (default 3000)
 * @returns Top-10 candidates sorted by reranker score descending
 */
export async function rerankWithOllama(
  query: string,
  candidates: RrfCandidate[],
  timeoutMs: number = 3000
): Promise<RrfCandidate[]> {
  if (candidates.length === 0) return [];

  // Build numbered passage list for the batch prompt
  const passages = candidates
    .map((c, i) => `[${i}] id="${c.id}"\n${c.content.slice(0, 300)}`)
    .join("\n\n");

  const prompt = `Du bist ein Relevanz-Bewerter fuer einen deutschen Rechtsanwalt.

Aufgabe: Bewerte jeden der folgenden Textausschnitte hinsichtlich ihrer Relevanz fuer die Suchanfrage.
Bewertungsskala: 0 (voellig irrelevant) bis 10 (hochgradig relevant).

Suchanfrage: "${query}"

Textausschnitte:
${passages}

Antworte NUR mit einem JSON-Objekt. Schluessel ist die id des Textausschnitts, Wert ist die ganzzahlige Bewertung 0-10.
Beispiel: {"id-1": 8, "id-2": 3}
Keine Erklaerungen, kein Text ausserhalb des JSON.`;

  const t0 = Date.now();
  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: RERANKER_MODEL,
        prompt,
        stream: false,
        temperature: 0,
        num_predict: 500,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Ollama returned HTTP ${response.status}`);
    }

    const data = (await response.json()) as { response: string };
    const rawText = data.response ?? "";

    // Extract JSON — handles Qwen3 <think>...</think> prefix
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`No JSON object found in Ollama response: ${rawText.slice(0, 200)}`);
    }

    const scores = JSON.parse(jsonMatch[0]) as Record<string, number>;

    // Sort candidates by score descending; missing scores default to 0
    const ranked = [...candidates].sort((a, b) => {
      const scoreA = typeof scores[a.id] === "number" ? scores[a.id] : 0;
      const scoreB = typeof scores[b.id] === "number" ? scores[b.id] : 0;
      return scoreB - scoreA;
    });

    console.log(`[reranker] Reranked ${candidates.length} candidates in ${Date.now() - t0}ms`);
    return ranked.slice(0, 10);
  } catch (err) {
    console.warn(`[reranker] Fallback to RRF order after ${Date.now() - t0}ms:`, err);
    return candidates.slice(0, 10);
  }
}
