export type UpstreamFailure = "timeout" | "rate_limited" | "server_error" | "network" | "bad_status";

export class UpstreamError extends Error {
  constructor(
    public readonly kind: UpstreamFailure,
    public readonly status?: number,
  ) {
    super(`Upstream request failed: ${kind}${status ? ` (${status})` : ""}`);
    this.name = "UpstreamError";
  }
}

type RetryOptions = {
  timeoutMs?: number;
  retries?: number;
  baseDelayMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function isRetryable(err: UpstreamError) {
  return err.kind !== "bad_status";
}

/** GET a JSON document with a per-attempt timeout and exponential backoff on 429/5xx/network errors. */
export async function fetchJsonWithRetry(url: string, opts: RetryOptions = {}): Promise<unknown> {
  const { timeoutMs = 15_000, retries = 2, baseDelayMs = 500, fetchImpl = fetch, sleep = defaultSleep } = opts;
  let lastError: UpstreamError = new UpstreamError("network");

  for (let attempt = 0; attempt <= retries; attempt++) {
    let retryAfterMs: number | null = null;
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return await res.json();
      if (res.status === 429) {
        lastError = new UpstreamError("rate_limited", 429);
        const header = Number(res.headers.get("retry-after"));
        if (Number.isFinite(header) && header > 0) retryAfterMs = Math.min(header * 1000, 10_000);
      } else if (res.status >= 500) {
        lastError = new UpstreamError("server_error", res.status);
      } else {
        throw new UpstreamError("bad_status", res.status);
      }
    } catch (err) {
      if (err instanceof UpstreamError) {
        if (!isRetryable(err)) throw err;
        lastError = err;
      } else if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
        lastError = new UpstreamError("timeout");
      } else {
        lastError = new UpstreamError("network");
      }
    }
    if (attempt < retries) {
      const backoff = baseDelayMs * 2 ** attempt + Math.floor(Math.random() * 200);
      await sleep(retryAfterMs ?? backoff);
    }
  }
  throw lastError;
}
