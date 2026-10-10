import { beforeEach, describe, expect, it } from "vitest";
import { _resetRateLimits, enforceLimit, LIMITS } from "../lib/rateLimit";

const req = (ip: string) => new Request("http://x.test/api/generate", { headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });

beforeEach(() => _resetRateLimits());

describe("enforceLimit", () => {
  it("allows the per-visitor budget, then blocks with RATE_LIMITED", async () => {
    const now = Date.UTC(2026, 9, 10, 12);
    for (let i = 0; i < LIMITS.generate.perVisitor.max; i++) await enforceLimit("generate", req("1.1.1.1"), now);
    await expect(enforceLimit("generate", req("1.1.1.1"), now)).rejects.toThrowError(/hourly limit/);
    // Another visitor is unaffected.
    await expect(enforceLimit("generate", req("2.2.2.2"), now)).resolves.toBeUndefined();
  });

  it("resets after the window", async () => {
    const now = Date.UTC(2026, 9, 10, 12);
    for (let i = 0; i < LIMITS.generate.perVisitor.max; i++) await enforceLimit("generate", req("1.1.1.1"), now);
    await expect(enforceLimit("generate", req("1.1.1.1"), now + 3601_000)).resolves.toBeUndefined();
  });

  it("enforces the global daily cap across visitors", async () => {
    const now = Date.UTC(2026, 9, 10, 12);
    for (let i = 0; i < LIMITS.generate.globalDaily; i++) await enforceLimit("generate", req(`10.0.${Math.floor(i / 5)}.${i % 5}`), now);
    await expect(enforceLimit("generate", req("9.9.9.9"), now)).rejects.toThrowError(/today's image-generation limit/);
  });
});
