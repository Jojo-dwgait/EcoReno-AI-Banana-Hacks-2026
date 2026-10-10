/**
 * Small key-value cache. In-memory for local dev; a Redis-backed store is swapped in when
 * UPSTASH_REDIS_REST_URL / _TOKEN are configured (added with deployment, see PLAN.md M4).
 */
export interface KeyValueCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}

class MemoryCache implements KeyValueCache {
  private store = new Map<string, { value: unknown; expires: number }>();
  constructor(private readonly maxEntries = 200) {}

  async get<T>(key: string): Promise<T | null> {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (hit.expires < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return hit.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
  }
}

const globalForCache = globalThis as unknown as { __ecorenoCache?: KeyValueCache };

export function getCache(): KeyValueCache {
  globalForCache.__ecorenoCache ??= new MemoryCache();
  return globalForCache.__ecorenoCache;
}
