import { AppError } from "./errors";

/**
 * Fixed-window limits for the expensive image routes: per visitor and a global daily cap.
 * In-memory for now (per serverless instance); swapped for Upstash Redis at deployment (PLAN.md M4).
 */
export const LIMITS = {
  generate: { perVisitor: { max: 5, windowSec: 3600 }, globalDaily: 150 },
  analyze: { perVisitor: { max: 20, windowSec: 3600 }, globalDaily: 600 },
} as const;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function hit(key: string, max: number, windowSec: number, now: number): boolean {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return true;
  }
  if (b.count >= max) return false;
  b.count++;
  return true;
}

export function visitorId(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || request.headers.get("x-real-ip") || "local";
}

export function enforceLimit(route: keyof typeof LIMITS, request: Request, now = Date.now()): void {
  const cfg = LIMITS[route];
  const day = new Date(now).toISOString().slice(0, 10);
  if (!hit(`${route}:visitor:${visitorId(request)}`, cfg.perVisitor.max, cfg.perVisitor.windowSec, now)) {
    throw new AppError("RATE_LIMITED", "You've reached the hourly limit for this demo. Please try again later, or explore the sample house.", 429);
  }
  if (!hit(`${route}:global:${day}`, cfg.globalDaily, 86_400, now)) {
    throw new AppError("RATE_LIMITED", "The demo has reached today's image-generation limit. The sample house still works, and live generation resets tomorrow.", 429);
  }
}

export function _resetRateLimits() {
  buckets.clear();
}
