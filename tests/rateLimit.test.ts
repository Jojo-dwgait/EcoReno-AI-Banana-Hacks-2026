import { beforeEach, describe, expect, it } from "vitest";
import { _resetRateLimits, enforceLimit, LIMITS } from "../lib/rateLimit";

const req = (ip: string) => new Request("http://x.test/api/generate", { headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });

beforeEach(() => _resetRateLimits());

describe("enforceLimit", () => {
  it("allows the per-visitor budget, then blocks with RATE_LIMITED", () => {
    const now = Date.UTC(2026, 9, 10, 12);
    for (let i = 0; i < LIMITS.generate.perVisitor.max; i++) enforceLimit("generate", req("1.1.1.1"), now);
    expect(() => enforceLimit("generate", req("1.1.1.1"), now)).toThrowError(/hourly limit/);
    // Another visitor is unaffected.
    expect(() => enforceLimit("generate", req("2.2.2.2"), now)).not.toThrow();
  });

  it("resets after the window", () => {
    const now = Date.UTC(2026, 9, 10, 12);
    for (let i = 0; i < LIMITS.generate.perVisitor.max; i++) enforceLimit("generate", req("1.1.1.1"), now);
    expect(() => enforceLimit("generate", req("1.1.1.1"), now + 3601_000)).not.toThrow();
  });

  it("enforces the global daily cap across visitors", () => {
    const now = Date.UTC(2026, 9, 10, 12);
    for (let i = 0; i < LIMITS.generate.globalDaily; i++) enforceLimit("generate", req(`10.0.${Math.floor(i / 5)}.${i % 5}`), now);
    expect(() => enforceLimit("generate", req("9.9.9.9"), now)).toThrowError(/today's image-generation limit/);
  });
});
