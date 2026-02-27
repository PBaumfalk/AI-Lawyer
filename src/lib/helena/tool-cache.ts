/**
 * In-run tool result cache.
 *
 * Map-based cache that deduplicates identical tool calls within
 * a single agent run. No TTL needed since the cache lives only
 * for the duration of one run.
 */

export interface ToolCache {
  get(key: string): unknown | undefined;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
}

/**
 * Create a deterministic cache key from tool name and parameters.
 * Sorts parameter keys for deterministic hashing.
 */
export function createCacheKey(
  toolName: string,
  params: Record<string, unknown>,
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {});
  return `${toolName}:${JSON.stringify(sortedParams)}`;
}

/**
 * Create a new in-run tool cache instance.
 */
export function createToolCache(): ToolCache {
  const store = new Map<string, unknown>();

  return {
    get(key: string): unknown | undefined {
      return store.get(key);
    },
    set(key: string, value: unknown): void {
      store.set(key, value);
    },
    has(key: string): boolean {
      return store.has(key);
    },
  };
}
