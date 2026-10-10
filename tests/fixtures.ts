import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { computeClimateMetrics } from "../lib/climateMetrics";
import type { Place } from "../lib/geocode";
import { parseArchive } from "../lib/openMeteo";
import { buildSiteProfile, gridCellOf, type SiteProfile } from "../lib/siteProfile";

const DIR = path.join(__dirname, "fixtures", "archive");

export function fixtureSlugs(): string[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

/** Real recorded Open-Meteo response → full SiteProfile, exactly as the API route builds it. */
export function loadFixtureProfile(slug: string): SiteProfile {
  const { place, response } = JSON.parse(readFileSync(path.join(DIR, `${slug}.json`), "utf8")) as { place: Place; response: unknown };
  const archive = parseArchive(response);
  return buildSiteProfile(place, gridCellOf(archive), computeClimateMetrics(archive.daily), "fixture");
}
