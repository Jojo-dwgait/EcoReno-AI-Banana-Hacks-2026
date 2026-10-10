/**
 * Builds the "Try a sample house" bundle by running the REAL pipeline once per featured city:
 * photo analysis → site profile → Balanced recommendations → edit plan → edit + review.
 * Run: npx tsx --conditions=react-server scripts/pregenerate-samples.mts photos/<file>.jpg "Credit Name" <credit-url> "Irvine, CA" "Minneapolis, MN" ["Phoenix, AZ"]
 * Writes public/samples/<id>/… and public/samples/manifest.json (results are labeled pre-generated in the UI).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

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
const { GeminiImageEditor } = await import("../lib/imageEditClient");
const { resultKey } = await import("../lib/samples");

const [photoPath, creditName, creditUrl, ...cities] = process.argv.slice(2);
if (!photoPath || !creditName || !creditUrl || cities.length === 0) {
  console.log('Usage: … pregenerate-samples.mts photos/house.jpg "Name" https://unsplash.com/photos/… "Irvine, CA" "Minneapolis, MN"');
  process.exit(1);
}

const id = "sample-1";
const dir = path.join("public", "samples", id);
await mkdir(path.join(dir, "results"), { recursive: true });

// Same preprocessing as the browser: ≤1536 px JPEG, metadata stripped by re-encoding.
const resized = await sharp(await readFile(photoPath)).rotate().resize(1536, 1536, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer({ resolveWithObject: true });
await writeFile(path.join(dir, "photo.jpg"), resized.data);
const input = { mimeType: "image/jpeg" as const, base64: resized.data.toString("base64"), width: resized.info.width, height: resized.info.height };

const { inventory } = await analyzePhoto(input);
await writeFile(path.join(dir, "inventory.json"), JSON.stringify(inventory, null, 2));
console.log("analysis:", Object.entries(inventory.features).map(([k, f]) => `${k}=${f.visible ? f.confidence.toFixed(2) : "no"}`).join(" "));

const featuredPlaces = [];
const results: Record<string, { path: string; generatedAt: string }> = {};
for (const city of cities) {
  const [place] = await searchUsPlaces(city);
  if (!place) throw new Error(`No match for ${city}`);
  featuredPlaces.push(place);
  const { profile } = await getSiteProfile(place);
  const selected = recommend({ profile, inventory, priority: "balanced" }).filter((r) => r.preselected).map((r) => r.id);
  if (selected.length === 0) {
    console.log(`${city}: no preselected changes; skipping`);
    continue;
  }
  const plan = buildEditPlan(selected, profile, inventory);
  const result = await runGeneration(new GeminiImageEditor(), input, plan, (e) => console.log(`  ${city}:`, JSON.stringify(e)));
  const slug = `${place.id}-${selected.join("_")}`;
  await writeFile(path.join(dir, "results", `${slug}.jpg`), Buffer.from(result.image.base64, "base64"));
  const payload = {
    type: "result",
    image: `/samples/${id}/results/${slug}.jpg`,
    width: result.image.width,
    height: result.image.height,
    review: result.review,
    verdict: result.verdict,
    attempts: result.attempts,
    plan: { changes: plan.changes, preserve: plan.preserve, forbidden: plan.forbidden, climateBasis: plan.climateBasis },
    prompt: result.prompt,
    models: { edit: result.editModel, review: result.reviewModel },
  };
  await writeFile(path.join(dir, "results", `${slug}.json`), JSON.stringify(payload, null, 2));
  results[resultKey(place.id, selected)] = { path: `/samples/${id}/results/${slug}.json`, generatedAt: new Date().toISOString() };
  console.log(`${city}: ${selected.join(", ")} → verdict ${result.verdict} (${result.attempts.length} attempt(s))`);
}

const manifest = {
  samples: [
    {
      id,
      title: "Sample house",
      photo: `/samples/${id}/photo.jpg`,
      width: input.width,
      height: input.height,
      credit: { name: creditName, url: creditUrl, license: "Unsplash License" },
      inventory: `/samples/${id}/inventory.json`,
      featuredPlaces,
      results,
    },
  ],
};
await writeFile(path.join("public", "samples", "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("wrote public/samples/manifest.json");
