/**
 * Pre-generates instant results for a gallery sample by running the REAL pipeline:
 * photo analysis → site profile → Balanced recommendations → edit plan → edit + review.
 * Run: npx tsx --conditions=react-server scripts/pregenerate-samples.mts <slug> "Irvine, CA" "Minneapolis, MN" [...]
 * Updates public/samples/<slug>/ and public/samples/manifest.json (results are labeled pre-generated in the UI).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* shell env */
}

const { analyzePhoto } = await import("../lib/visionClient");
const { getSiteProfile } = await import("../lib/climateService");
const { searchUsPlaces } = await import("../lib/geocode");
const { recommend } = await import("../lib/recommendationEngine");
const { buildEditPlan } = await import("../lib/editPlan");
const { runGeneration } = await import("../lib/generatePipeline");
const { getImageEditor } = await import("../lib/editorFactory");
const { resultKey } = await import("../lib/samples");
type Entry = import("../lib/samples").SampleManifestEntry;

const [slug, ...cities] = process.argv.slice(2);
if (!slug || cities.length === 0) {
  console.log('Usage: … pregenerate-samples.mts <slug> "Irvine, CA" "Minneapolis, MN"');
  process.exit(1);
}

const manifestPath = path.join("public", "samples", "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { samples: Entry[] };
const entry = manifest.samples.find((s) => s.id === slug);
if (!entry) throw new Error(`No sample "${slug}" in ${manifestPath}. Run scripts/build-gallery.mts first.`);

const dir = path.join("public", "samples", slug);
await mkdir(path.join(dir, "results"), { recursive: true });
const photo = await readFile(path.join(dir, "photo.jpg"));
const input = { mimeType: "image/jpeg" as const, base64: photo.toString("base64"), width: entry.width, height: entry.height };

const { inventory } = await analyzePhoto(input);
await writeFile(path.join(dir, "inventory.json"), JSON.stringify(inventory, null, 2));
entry.inventory = `/samples/${slug}/inventory.json`;
console.log("analysis:", Object.entries(inventory.features).map(([k, f]) => `${k}=${f.visible ? f.confidence.toFixed(2) : "no"}`).join(" "));

entry.featuredPlaces = [];
for (const city of cities) {
  const [place] = await searchUsPlaces(city);
  if (!place) throw new Error(`No match for ${city}`);
  entry.featuredPlaces.push(place);
  const { profile } = await getSiteProfile(place);
  const selected = recommend({ profile, inventory, priority: "balanced" }).filter((r) => r.preselected).map((r) => r.id);
  if (selected.length === 0) {
    console.log(`${city}: no preselected changes; skipping`);
    continue;
  }
  const plan = buildEditPlan(selected, profile, inventory);
  const result = await runGeneration(getImageEditor(), input, plan, (e) => console.log(`  ${city}:`, JSON.stringify(e)));
  const name = `${place.id}-${selected.join("_")}`;
  await writeFile(path.join(dir, "results", `${name}.jpg`), Buffer.from(result.image.base64, "base64"));
  await writeFile(
    path.join(dir, "results", `${name}.json`),
    JSON.stringify(
      {
        type: "result",
        image: `/samples/${slug}/results/${name}.jpg`,
        width: result.image.width,
        height: result.image.height,
        review: result.review,
        verdict: result.verdict,
        attempts: result.attempts,
        plan: { changes: plan.changes, preserve: plan.preserve, forbidden: plan.forbidden, climateBasis: plan.climateBasis },
        prompt: result.prompt,
        models: { edit: result.editModel, review: result.reviewModel },
      },
      null,
      2,
    ),
  );
  entry.results[resultKey(place.id, selected)] = { path: `/samples/${slug}/results/${name}.json`, generatedAt: new Date().toISOString() };
  console.log(`${city}: ${selected.join(", ")} → ${result.verdict} (${result.attempts.length} attempt(s))`);
}

await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`updated ${manifestPath}`);
