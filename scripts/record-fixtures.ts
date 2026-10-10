/**
 * Records real Open-Meteo responses for the acceptance cities into tests/fixtures/.
 * Run: npx tsx scripts/record-fixtures.ts [slug ...]
 * A 10-year daily request counts as ~261 API calls against the 600/min free limit, so requests are spaced out.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { searchUsPlaces } from "../lib/geocode";
import { archiveUrl } from "../lib/openMeteo";

const CITIES: Record<string, string> = {
  irvine: "Irvine, CA",
  seattle: "Seattle, WA",
  phoenix: "Phoenix, AZ",
  minneapolis: "Minneapolis, MN",
  miami: "Miami, FL",
  "portland-or": "Portland, OR",
  "portland-me": "Portland, ME",
  anchorage: "Anchorage, AK",
  honolulu: "Honolulu, HI",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const only = process.argv.slice(2);
  const dir = path.join(process.cwd(), "tests", "fixtures", "archive");
  await mkdir(dir, { recursive: true });
  const slugs = Object.keys(CITIES).filter((s) => only.length === 0 || only.includes(s));

  for (const [i, slug] of slugs.entries()) {
    const [place] = await searchUsPlaces(CITIES[slug]);
    if (!place) throw new Error(`No geocoding result for ${CITIES[slug]}`);
    const res = await fetch(archiveUrl(place.lat, place.lon, place.timezone), { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`${slug}: HTTP ${res.status} ${await res.text()}`);
    const json = await res.json();
    await writeFile(path.join(dir, `${slug}.json`), JSON.stringify({ place, response: json }));
    console.log(`recorded ${slug} (${place.label}, ${place.county}) grid ${json.latitude},${json.longitude}`);
    if (i < slugs.length - 1) await sleep(30_000);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
