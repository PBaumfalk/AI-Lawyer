/**
 * Extended health check functions for Docker services.
 * Supplements existing checks in /api/health/route.ts.
 */

export interface ServiceStatus {
  name: string;
  status: "healthy" | "unhealthy" | "degraded";
  latency: number;
  error?: string;
}

/**
 * Check Ollama LLM server health.
 * Fetches the root endpoint which returns "Ollama is running" on success.
 */
export async function checkOllama(): Promise<ServiceStatus> {
  const start = Date.now();
  const url = process.env.OLLAMA_URL || "http://localhost:11434";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    return {
      name: "ollama",
      status: res.ok ? "healthy" : "unhealthy",
      latency: Date.now() - start,
    };
  } catch (err) {
    return {
      name: "ollama",
      status: "unhealthy",
      latency: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Check Stirling-PDF service health.
 * Fetches the API status endpoint.
 */
export async function checkStirlingPdf(): Promise<ServiceStatus> {
  const start = Date.now();
  const url = process.env.STIRLING_PDF_URL || "http://localhost:8090";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${url}/api/v1/info/status`, { signal: controller.signal });
    clearTimeout(timeoutId);

    return {
      name: "stirlingPdf",
      status: res.ok ? "healthy" : "unhealthy",
      latency: Date.now() - start,
    };
  } catch (err) {
    return {
      name: "stirlingPdf",
      status: "unhealthy",
      latency: Date.now() - start,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
