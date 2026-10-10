import { describe, expect, it, vi } from "vitest";
import { fetchJsonWithRetry, UpstreamError } from "../lib/http";
import { climateCacheKey, DAILY_VARS, EXPECTED_UNITS, parseArchive } from "../lib/openMeteo";

const noSleep = async () => {};

function archiveJson(overrides: { units?: Record<string, string>; series?: Record<string, unknown> } = {}) {
  const time = ["2025-12-30", "2025-12-31"];
  const daily: Record<string, unknown> = { time };
  for (const v of DAILY_VARS) daily[v] = [1, null];
  return {
    latitude: 33.7,
    longitude: -117.84,
    elevation: 13,
    timezone: "America/Los_Angeles",
    daily_units: { time: "iso8601", ...EXPECTED_UNITS, ...overrides.units },
    daily: { ...daily, ...overrides.series },
  };
}

describe("parseArchive", () => {
  it("accepts the expected units and keeps nulls as missing values", () => {
    const a = parseArchive(archiveJson());
    expect(a.daily.precipitation_sum).toEqual([1, null]);
    expect(a.gridLat).toBe(33.7);
  });

  it("rejects a response in unexpected units instead of misreading it", () => {
    expect(() => parseArchive(archiveJson({ units: { temperature_2m_max: "°F" } }))).toThrowError(/Unexpected unit/);
  });

  it("rejects a series whose length does not match the dates", () => {
    expect(() => parseArchive(archiveJson({ series: { snowfall_sum: [0] } }))).toThrowError(/malformed/);
  });
});

describe("climateCacheKey", () => {
  it("keys on rounded coordinates, window, variables and provider settings", () => {
    const key = climateCacheKey(33.68461, -117.82651);
    expect(key).toContain("33.68,-117.83");
    expect(key).toContain("2016-01-01:2025-12-31");
    expect(key).toContain("best_match:land");
    expect(climateCacheKey(33.6849, -117.8261)).toBe(key);
  });
});

describe("fetchJsonWithRetry", () => {
  it("retries a 429 and returns the next success", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("slow down", { status: 429 }))
      .mockResolvedValueOnce(Response.json({ ok: 1 }));
    await expect(fetchJsonWithRetry("https://x.test", { fetchImpl, sleep: noSleep })).resolves.toEqual({ ok: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 4xx client error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("bad", { status: 400 }));
    const err = (await fetchJsonWithRetry("https://x.test", { fetchImpl, sleep: noSleep }).catch((e: unknown) => e)) as UpstreamError;
    expect(err).toBeInstanceOf(UpstreamError);
    expect(err.kind).toBe("bad_status");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("gives up after the retry budget on persistent 5xx", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("down", { status: 502 }));
    const err = (await fetchJsonWithRetry("https://x.test", { fetchImpl, sleep: noSleep, retries: 2 }).catch((e: unknown) => e)) as UpstreamError;
    expect(err.kind).toBe("server_error");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("treats network failures as retryable", async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(Response.json([1]));
    await expect(fetchJsonWithRetry("https://x.test", { fetchImpl, sleep: noSleep })).resolves.toEqual([1]);
  });
});
