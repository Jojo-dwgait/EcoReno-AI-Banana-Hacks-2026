import "server-only";
import { getCache } from "./cache";
import { AppError } from "./errors";
import { fetchJsonWithRetry, UpstreamError } from "./http";
import { PUMS_YEAR, type PumsRecord } from "./valueModel";

export type CensusArea = {
  stateFips: string;
  puma: string;
  pumaName: string;
  place: { fips: string; name: string } | null;
  county: { fips: string; name: string };
};

export const PUMS_DATASET = {
  name: `American Community Survey ${PUMS_YEAR - 4}–${PUMS_YEAR} 5-year Public Use Microdata Sample`,
  org: "U.S. Census Bureau",
  url: "https://www.census.gov/programs-surveys/acs/microdata.html",
};

const DAY = 86_400;

function censusKey(): string {
  const key = process.env.CENSUS_API_KEY;
  if (!key) throw new AppError("VALUE_UNAVAILABLE", "The home-value data source isn't configured on this server yet.", 503);
  return key;
}

async function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const cache = getCache();
  const hit = await cache.get<T>(key);
  if (hit !== null) return hit;
  const value = await load();
  await cache.set(key, value, ttl);
  return value;
}

async function getJson(url: string): Promise<unknown> {
  try {
    return await fetchJsonWithRetry(url, { timeoutMs: 30_000, retries: 2 });
  } catch (err) {
    if (err instanceof UpstreamError) throw new AppError("VALUE_UNAVAILABLE", "U.S. Census data is temporarily unavailable. Please try again shortly.", 503);
    throw err;
  }
}

type GeoLayer = Record<string, string | undefined>;

/** Census Geocoder (no key needed): which microdata area, place, and county contain the city's center point. */
export async function censusArea(lat: number, lon: number): Promise<CensusArea> {
  return cached(`census:area:${lat.toFixed(3)},${lon.toFixed(3)}`, 30 * DAY, async () => {
    const url = new URL("https://geocoding.geo.census.gov/geocoder/geographies/coordinates");
    url.searchParams.set("x", String(lon));
    url.searchParams.set("y", String(lat));
    url.searchParams.set("benchmark", "Public_AR_Current");
    url.searchParams.set("vintage", "Current_Current");
    url.searchParams.set("layers", "all");
    url.searchParams.set("format", "json");
    const json = (await getJson(url.toString())) as { result?: { geographies?: Record<string, GeoLayer[]> } };
    const g = json.result?.geographies ?? {};
    const layer = (needle: string) => Object.entries(g).find(([k]) => k.includes(needle))?.[1]?.[0];
    const puma = layer("Public Use Microdata Areas");
    const county = layer("Counties");
    const place = layer("Incorporated Places") ?? layer("Census Designated Places");
    if (!puma?.PUMA || !puma.STATE || !county?.COUNTY) {
      throw new AppError("VALUE_UNAVAILABLE", "Couldn't match this city to U.S. Census areas.", 502);
    }
    return {
      stateFips: puma.STATE,
      puma: puma.PUMA,
      pumaName: (puma.NAME ?? "").replace(/ PUMA$/, ""),
      place: place?.PLACE ? { fips: place.PLACE, name: place.NAME ?? place.BASENAME ?? "" } : null,
      county: { fips: county.COUNTY, name: county.NAME ?? "" },
    };
  });
}

const PUMS_VARS = ["SERIALNO", "VALP", "BDSP", "RMSP", "YRBLT", "BLD", "ACR", "TEN", "WGTP", "ADJHSG"] as const;

/** Individual owner-reported home records for one microdata area (one row per household). */
export async function pumsRecords(area: CensusArea): Promise<PumsRecord[]> {
  const key = censusKey();
  return cached(`census:pums:${PUMS_YEAR}:${area.stateFips}:${area.puma}`, 30 * DAY, async () => {
    const url = (ownersOnly: boolean) =>
      `https://api.census.gov/data/${PUMS_YEAR}/acs/acs5/pums?get=${PUMS_VARS.join(",")}` +
      `&for=public%20use%20microdata%20area:${area.puma}&in=state:${area.stateFips}${ownersOnly ? "&TEN=1,2" : ""}&key=${encodeURIComponent(key)}`;
    // The owner-only filter shrinks the download; if the API rejects it, fetch everything (tenure is filtered locally anyway).
    const json = await getJson(url(true)).catch(() => getJson(url(false)));
    if (!Array.isArray(json) || json.length < 2 || !Array.isArray(json[0])) {
      throw new AppError("VALUE_UNAVAILABLE", "U.S. Census microdata returned an unexpected response.", 502);
    }
    const [header, ...rows] = json as string[][];
    const col = (name: string) => header.indexOf(name);
    const seen = new Set<string>();
    const records: PumsRecord[] = [];
    for (const r of rows) {
      const serial = r[col("SERIALNO")];
      if (seen.has(serial)) continue; // person-level rows repeat household fields
      seen.add(serial);
      records.push({
        value: Number(r[col("VALP")]),
        bedrooms: Number(r[col("BDSP")]),
        rooms: Number(r[col("RMSP")]),
        yearBuiltCode: Number(r[col("YRBLT")]),
        building: String(r[col("BLD")]).padStart(2, "0"),
        lot: Number(r[col("ACR")]),
        tenure: Number(r[col("TEN")]),
        weight: Number(r[col("WGTP")]),
        adjustment: Number(r[col("ADJHSG")]),
      });
    }
    return records;
  });
}

export type OfficialMedian = { value: number; marginOfError: number | null; geography: string; table: string; url: string };

/** The Census Bureau's own published median home value (ACS table B25077) for the place, or the county as a fallback. */
export async function officialMedianValue(area: CensusArea): Promise<OfficialMedian | null> {
  const key = censusKey();
  return cached(`census:b25077:${PUMS_YEAR}:${area.stateFips}:${area.place?.fips ?? "none"}:${area.county.fips}`, 30 * DAY, async () => {
    const attempts = [
      area.place && { forClause: `place:${area.place.fips}`, label: area.place.name },
      { forClause: `county:${area.county.fips}`, label: area.county.name },
    ].filter(Boolean) as { forClause: string; label: string }[];
    for (const a of attempts) {
      const url = `https://api.census.gov/data/${PUMS_YEAR}/acs/acs5?get=NAME,B25077_001E,B25077_001M&for=${a.forClause}&in=state:${area.stateFips}&key=${encodeURIComponent(key)}`;
      const json = (await getJson(url).catch(() => null)) as string[][] | null;
      const row = json?.[1];
      const value = Number(row?.[1]);
      if (Number.isFinite(value) && value > 0) {
        const moe = Number(row?.[2]);
        return {
          value,
          marginOfError: Number.isFinite(moe) && moe > 0 ? moe : null,
          geography: row?.[0] ?? a.label,
          table: `ACS ${PUMS_YEAR - 4}–${PUMS_YEAR} 5-year, table B25077 (median value, owner-occupied homes)`,
          url: "https://data.census.gov/table/ACSDT5Y2024.B25077",
        };
      }
    }
    return null;
  });
}
