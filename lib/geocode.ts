import { z } from "zod";
import { AppError } from "./errors";
import { fetchJsonWithRetry, UpstreamError } from "./http";
import { stateCodeFor } from "./usStates";

export type Place = {
  id: number;
  name: string;
  state: string;
  stateCode: string;
  county: string | null;
  lat: number;
  lon: number;
  timezone: string;
  population: number | null;
  elevationM: number | null;
  label: string;
};

const ResultSchema = z.object({
  id: z.number(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  elevation: z.number().nullish(),
  feature_code: z.string().nullish(),
  country_code: z.string().nullish(),
  admin1: z.string().nullish(),
  admin2: z.string().nullish(),
  timezone: z.string().nullish(),
  population: z.number().nullish(),
});
const ResponseSchema = z.object({ results: z.array(ResultSchema).optional() });
type GeoResult = z.infer<typeof ResultSchema>;

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** "Portland, OR" → { name: "Portland", stateHint: "OR" }. An unrecognized suffix is kept in the name. */
export function parseQuery(raw: string): { name: string; stateHint: string | null } {
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const hint = stateCodeFor(parts[parts.length - 1]);
    if (hint) return { name: parts.slice(0, -1).join(", "), stateHint: hint };
  }
  return { name: raw.trim(), stateHint: null };
}

/** Keep only U.S. results in the 50 states + DC, dedupe, and rank exact name matches first. */
export function toUsPlaces(results: GeoResult[], query: string, stateHint: string | null): Place[] {
  const seen = new Set<string>();
  const places: Place[] = [];
  for (const r of results) {
    if (r.country_code !== "US" || !r.timezone) continue;
    const stateCode = stateCodeFor(r.admin1);
    if (!stateCode || !r.admin1) continue;
    if (stateHint && stateCode !== stateHint) continue;
    const key = `${normalize(r.name)}|${stateCode}|${normalize(r.admin2 ?? "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    places.push({
      id: r.id,
      name: r.name,
      state: r.admin1,
      stateCode,
      county: r.admin2 ?? null,
      lat: r.latitude,
      lon: r.longitude,
      timezone: r.timezone,
      population: r.population ?? null,
      elevationM: r.elevation ?? null,
      label: `${r.name}, ${stateCode}`,
    });
  }
  const q = normalize(query);
  const rank = (p: Place) => (normalize(p.name) === q ? 0 : normalize(p.name).startsWith(q) ? 1 : 2);
  return places.sort((a, b) => rank(a) - rank(b) || (b.population ?? 0) - (a.population ?? 0)).slice(0, 10);
}

export async function searchUsPlaces(raw: string, fetchImpl?: typeof fetch): Promise<Place[]> {
  const { name, stateHint } = parseQuery(raw);
  if (name.length < 2 || name.length > 80) {
    throw new AppError("BAD_REQUEST", "Type at least two letters of a U.S. city name.", 400);
  }
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", name);
  url.searchParams.set("count", "20");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  url.searchParams.set("countryCode", "US");

  let json: unknown;
  try {
    json = await fetchJsonWithRetry(url.toString(), { timeoutMs: 8_000, retries: 2, fetchImpl });
  } catch (err) {
    if (err instanceof UpstreamError) {
      throw new AppError("GEOCODE_UNAVAILABLE", "City search is temporarily unavailable. Please try again in a moment.", 503);
    }
    throw err;
  }
  const parsed = ResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new AppError("GEOCODE_UNAVAILABLE", "City search returned an unexpected response.", 502);
  }
  return toUsPlaces(parsed.data.results ?? [], name, stateHint);
}
