import { z } from "zod";
import { AppError } from "./errors";
import { fetchJsonWithRetry, UpstreamError } from "./http";

export const CLIMATE_WINDOW = { start: "2016-01-01", end: "2025-12-31" } as const;
export const ARCHIVE_SOURCE = {
  name: "Open-Meteo Historical Weather API (ERA5 / ERA5-Land reanalysis, best-match)",
  url: "https://open-meteo.com/en/docs/historical-weather-api",
  license: "CC BY 4.0",
} as const;

export const DAILY_VARS = [
  "temperature_2m_max",
  "temperature_2m_min",
  "temperature_2m_mean",
  "precipitation_sum",
  "snowfall_sum",
  "shortwave_radiation_sum",
  "et0_fao_evapotranspiration",
  "wind_speed_10m_max",
] as const;
export type DailyVar = (typeof DAILY_VARS)[number];

/** Units the metric code assumes; a response in other units is rejected rather than silently mis-read. */
export const EXPECTED_UNITS: Record<DailyVar, string> = {
  temperature_2m_max: "°C",
  temperature_2m_min: "°C",
  temperature_2m_mean: "°C",
  precipitation_sum: "mm",
  snowfall_sum: "cm",
  shortwave_radiation_sum: "MJ/m²",
  et0_fao_evapotranspiration: "mm",
  wind_speed_10m_max: "km/h",
};

const nullableNumbers = z.array(z.number().nullable());
const ArchiveSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  elevation: z.number().nullish(),
  timezone: z.string(),
  daily_units: z.record(z.string(), z.string()),
  daily: z.object({ time: z.array(z.string()) }).and(z.record(z.string(), z.unknown())),
});

export type DailySeries = { time: string[] } & Record<DailyVar, (number | null)[]>;

export type ArchiveData = {
  gridLat: number;
  gridLon: number;
  elevationM: number | null;
  timezone: string;
  daily: DailySeries;
};

export function archiveUrl(lat: number, lon: number, timezone: string): string {
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", lat.toFixed(4));
  url.searchParams.set("longitude", lon.toFixed(4));
  url.searchParams.set("start_date", CLIMATE_WINDOW.start);
  url.searchParams.set("end_date", CLIMATE_WINDOW.end);
  url.searchParams.set("daily", DAILY_VARS.join(","));
  url.searchParams.set("timezone", timezone);
  url.searchParams.set("cell_selection", "land");
  return url.toString();
}

/** Cache key covers coordinates, window, variables and provider settings — never the city name alone. */
export function climateCacheKey(lat: number, lon: number): string {
  return `climate:v1:${lat.toFixed(2)},${lon.toFixed(2)}:${CLIMATE_WINDOW.start}:${CLIMATE_WINDOW.end}:${DAILY_VARS.join("+")}:best_match:land`;
}

export function parseArchive(json: unknown): ArchiveData {
  const parsed = ArchiveSchema.safeParse(json);
  if (!parsed.success) {
    throw new AppError("CLIMATE_UNAVAILABLE", "The climate service returned an unexpected response.", 502);
  }
  const d = parsed.data;
  for (const v of DAILY_VARS) {
    if (d.daily_units[v] !== EXPECTED_UNITS[v]) {
      throw new AppError("CLIMATE_UNAVAILABLE", `Unexpected unit for ${v}: ${d.daily_units[v] ?? "missing"}.`, 502);
    }
  }
  const daily = { time: d.daily.time } as DailySeries;
  for (const v of DAILY_VARS) {
    const series = nullableNumbers.safeParse(d.daily[v]);
    if (!series.success || series.data.length !== d.daily.time.length) {
      throw new AppError("CLIMATE_UNAVAILABLE", `Climate series ${v} is malformed.`, 502);
    }
    daily[v] = series.data;
  }
  return { gridLat: d.latitude, gridLon: d.longitude, elevationM: d.elevation ?? null, timezone: d.timezone, daily };
}

export async function fetchArchive(lat: number, lon: number, timezone: string, fetchImpl?: typeof fetch): Promise<ArchiveData> {
  try {
    const json = await fetchJsonWithRetry(archiveUrl(lat, lon, timezone), { timeoutMs: 25_000, retries: 2, fetchImpl });
    return parseArchive(json);
  } catch (err) {
    if (err instanceof UpstreamError) {
      const msg =
        err.kind === "rate_limited"
          ? "The climate data service is busy right now. Please try again in a minute."
          : "Historical climate data is temporarily unavailable for this location. Please try again.";
      throw new AppError("CLIMATE_UNAVAILABLE", msg, 503);
    }
    throw err;
  }
}
