import { describe, expect, it, vi } from "vitest";
import { AppError } from "../lib/errors";
import { parseQuery, searchUsPlaces, toUsPlaces } from "../lib/geocode";

const r = (over: Record<string, unknown>) => ({
  id: 1,
  name: "Portland",
  latitude: 45.5,
  longitude: -122.7,
  country_code: "US",
  admin1: "Oregon",
  admin2: "Multnomah",
  timezone: "America/Los_Angeles",
  population: 650000,
  ...over,
});

describe("parseQuery", () => {
  it.each([
    ["Portland, OR", "Portland", "OR"],
    ["Springfield, Massachusetts", "Springfield", "MA"],
    ["St. Louis, MO", "St. Louis", "MO"],
    ["Washington, DC", "Washington", "DC"],
    ["Fort Worth", "Fort Worth", null],
    ["Paris, Texas ", "Paris", "TX"],
  ])("%s → %s / %s", (raw, name, hint) => {
    expect(parseQuery(raw)).toEqual({ name, stateHint: hint });
  });
});

describe("toUsPlaces", () => {
  const results = [
    r({ id: 1 }),
    r({ id: 2, admin1: "Maine", admin2: "Cumberland", latitude: 43.66, longitude: -70.26, timezone: "America/New_York", population: 66000 }),
    r({ id: 3, name: "Blue Island", admin1: "Illinois", admin2: "Cook", population: 900000 }),
    r({ id: 4, country_code: "CA", admin1: "Ontario", admin2: null }),
    r({ id: 5, admin1: "Puerto Rico", country_code: "US" }),
    r({ id: 6 }), // duplicate of id 1
  ];

  it("keeps only the 50 states + DC, dedupes, and ranks exact names before fuzzy matches", () => {
    const places = toUsPlaces(results as never, "Portland", null);
    expect(places.map((p) => p.id)).toEqual([1, 2, 3]);
    expect(places[0].label).toBe("Portland, OR");
    expect(places[1].label).toBe("Portland, ME");
  });

  it("distinguishes duplicate city names by state", () => {
    const places = toUsPlaces(results as never, "Portland", "ME");
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ state: "Maine", county: "Cumberland", timezone: "America/New_York" });
  });

  it("drops results without a timezone", () => {
    expect(toUsPlaces([r({ timezone: null })] as never, "Portland", null)).toHaveLength(0);
  });
});

describe("searchUsPlaces", () => {
  it("returns an empty list (not invented places) when nothing matches", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ generationtime_ms: 1 }));
    await expect(searchUsPlaces("Xqzzyville", fetchImpl as never)).resolves.toEqual([]);
  });

  it("rejects too-short input", async () => {
    await expect(searchUsPlaces("a")).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("maps a provider outage to GEOCODE_UNAVAILABLE after retrying", async () => {
    const fetchImpl = vi.fn(async () => new Response("down", { status: 503 }));
    const err = await searchUsPlaces("Portland", fetchImpl as never).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe("GEOCODE_UNAVAILABLE");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
