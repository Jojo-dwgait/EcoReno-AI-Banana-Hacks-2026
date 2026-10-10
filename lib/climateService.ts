import "server-only";
import { z } from "zod";
import { getCache } from "./cache";
import { computeClimateMetrics, type ClimateMetrics } from "./climateMetrics";
import { climateCacheKey, fetchArchive } from "./openMeteo";
import { buildSiteProfile, gridCellOf, type GridCell, type SiteProfile } from "./siteProfile";

export const PlaceSchema = z.object({
  id: z.number(),
  name: z.string().min(1).max(120),
  state: z.string().min(1).max(60),
  stateCode: z.string().length(2),
  county: z.string().max(120).nullable(),
  // U.S. bounding box incl. Alaska and Hawaii.
  lat: z.number().min(18).max(72),
  lon: z.number().min(-180).max(-64),
  timezone: z.string().min(3).max(64),
  label: z.string().min(1).max(140),
});
export type PlaceInput = z.infer<typeof PlaceSchema>;

type CachedClimate = { grid: GridCell; climate: ClimateMetrics; retrievedAt: string };
const THIRTY_DAYS = 60 * 60 * 24 * 30;

/** Site profile for a selected place; the climate part is cached by coordinates + window + variables + settings. */
export async function getSiteProfile(place: PlaceInput): Promise<{ profile: SiteProfile; cacheHit: boolean }> {
  const cache = getCache();
  const key = climateCacheKey(place.lat, place.lon);
  let entry = await cache.get<CachedClimate>(key);
  const cacheHit = entry !== null;
  if (!entry) {
    const archive = await fetchArchive(place.lat, place.lon, place.timezone);
    entry = { grid: gridCellOf(archive), climate: computeClimateMetrics(archive.daily), retrievedAt: new Date().toISOString() };
    await cache.set(key, entry, THIRTY_DAYS);
  }
  return { profile: buildSiteProfile(place, entry.grid, entry.climate, entry.retrievedAt), cacheHit };
}
