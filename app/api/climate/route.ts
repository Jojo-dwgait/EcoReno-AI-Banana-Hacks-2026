import { z } from "zod";
import { getCache } from "@/lib/cache";
import { computeClimateMetrics, type ClimateMetrics } from "@/lib/climateMetrics";
import { AppError, errorResponse } from "@/lib/errors";
import { climateCacheKey, fetchArchive } from "@/lib/openMeteo";
import { buildSiteProfile, gridCellOf, type GridCell } from "@/lib/siteProfile";

export const maxDuration = 60;

const PlaceSchema = z.object({
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

type CachedClimate = {
  grid: GridCell;
  climate: ClimateMetrics;
  retrievedAt: string;
};

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function POST(request: Request) {
  const started = Date.now();
  try {
    const body = await request.json().catch(() => null);
    const parsed = z.object({ place: PlaceSchema }).safeParse(body);
    if (!parsed.success) throw new AppError("BAD_REQUEST", "Pick a U.S. city from the list first.", 400);
    const { place } = parsed.data;

    const cache = getCache();
    const key = climateCacheKey(place.lat, place.lon);
    let entry = await cache.get<CachedClimate>(key);
    const cacheHit = entry !== null;
    if (!entry) {
      const archive = await fetchArchive(place.lat, place.lon, place.timezone);
      entry = {
        grid: gridCellOf(archive),
        climate: computeClimateMetrics(archive.daily),
        retrievedAt: new Date().toISOString(),
      };
      await cache.set(key, entry, THIRTY_DAYS);
    }

    const profile = buildSiteProfile(place, entry.grid, entry.climate, entry.retrievedAt);
    const unavailable = Object.values(profile.climate.metrics).filter((m) => m.quality === "unavailable").length;
    console.log(JSON.stringify({ stage: "climate", placeId: place.id, cacheHit, ms: Date.now() - started, unavailable }));
    return Response.json({ ok: true, profile });
  } catch (err) {
    return errorResponse(err);
  }
}
