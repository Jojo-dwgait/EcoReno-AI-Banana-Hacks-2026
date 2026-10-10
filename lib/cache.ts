import { getRedis } from "./redis";

/** Small key-value cache: Upstash Redis when configured, otherwise in-memory (local dev, tests). */
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

class RedisCache implements KeyValueCache {
  constructor(private readonly memory: MemoryCache) {}

  async get<T>(key: string): Promise<T | null> {
    const local = await this.memory.get<T>(key);
    if (local !== null) return local;
    try {
      const value = await getRedis()!.get<T>(key);
      if (value !== null) await this.memory.set(key, value, 600);
      return value;
    } catch {
      return null; // A cache outage must never break the request; the source is fetched instead.
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.memory.set(key, value, Math.min(ttlSeconds, 600));
    try {
      await getRedis()!.set(key, value, { ex: ttlSeconds });
    } catch {
      /* best effort */
    }
  }
}

const globalForCache = globalThis as unknown as { __ecorenoCache?: KeyValueCache };

export function getCache(): KeyValueCache {
  globalForCache.__ecorenoCache ??= getRedis() ? new RedisCache(new MemoryCache()) : new MemoryCache();
  return globalForCache.__ecorenoCache;
}
