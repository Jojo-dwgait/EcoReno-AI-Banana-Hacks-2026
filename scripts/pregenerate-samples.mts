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
const { reviewEdit } = await import("../lib/visionClient");
const { verdictFor } = await import("../lib/reviewSchema");
const { existsSync } = await import("node:fs");
type Entry = import("../lib/samples").SampleManifestEntry;

const argv = process.argv.slice(2);
const reuse = argv.includes("--reuse");
const [slug, ...cities] = argv.filter((a) => !a.startsWith("--"));
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

const savedInventory = path.join(dir, "inventory.json");
const inventory = reuse && existsSync(savedInventory) ? JSON.parse(await readFile(savedInventory, "utf8")) : (await analyzePhoto(input)).inventory;
await writeFile(savedInventory, JSON.stringify(inventory, null, 2));
entry.inventory = `/samples/${slug}/inventory.json`;
console.log("analysis:", Object.entries(inventory.features as Record<string, { visible: boolean; confidence: number }>).map(([k, f]) => `${k}=${f.visible ? f.confidence.toFixed(2) : "no"}`).join(" "));

const editor = getImageEditor();
const saveManifest = () => writeFile(manifestPath, JSON.stringify(manifest, null, 2));
for (const city of cities) {
  try {
    const [place] = await searchUsPlaces(city);
    if (!place) throw new Error(`No match for ${city}`);
    if (!entry.featuredPlaces.some((p) => p.id === place.id)) entry.featuredPlaces.push(place);
    const { profile } = await getSiteProfile(place);
    const selected = recommend({ profile, inventory, priority: "balanced" }).filter((r) => r.preselected).map((r) => r.id);
    if (selected.length === 0) {
      console.log(`${city}: no preselected changes; skipping`);
      continue;
    }
    const plan = buildEditPlan(selected, profile, inventory);
    const name = `${place.id}-${selected.join("_")}`;
    const jpg = path.join(dir, "results", `${name}.jpg`);
    let out;
    if (reuse && existsSync(jpg)) {
      // Review an image this pipeline already produced instead of spending GPU quota again.
      const edited = { mimeType: "image/jpeg" as const, base64: (await readFile(jpg)).toString("base64"), width: entry.width, height: entry.height };
      const r = await reviewEdit(input, edited, plan).catch((e) => {
        console.log(`  review failed: ${(e as Error).message}`);
        return null;
      });
      const verdict = r ? verdictFor(r.review, 2) : "flag";
      out = {
        image: edited,
        review: r?.review ?? null,
        verdict,
        attempts: [{ attempt: 1, editMs: 0, reviewMs: r?.ms ?? null, model: editor.model, verdict, aspectMismatch: 0 }],
        prompt: editor.formatPrompt ? editor.formatPrompt(plan) : "",
        editModel: editor.model,
        reviewModel: r?.model ?? null,
      };
    } else {
      out = await runGeneration(editor, input, plan, (e) => console.log(`  ${city}:`, JSON.stringify(e)));
      await writeFile(jpg, Buffer.from(out.image.base64, "base64"));
    }
    await writeFile(
      path.join(dir, "results", `${name}.json`),
      JSON.stringify(
        {
          type: "result",
          image: `/samples/${slug}/results/${name}.jpg`,
          width: out.image.width,
          height: out.image.height,
          review: out.review,
          verdict: out.verdict,
          attempts: out.attempts,
          plan: { changes: plan.changes, preserve: plan.preserve, forbidden: plan.forbidden, climateBasis: plan.climateBasis },
          prompt: out.prompt,
          models: { edit: out.editModel, review: out.reviewModel },
        },
        null,
        2,
      ),
    );
    entry.results[resultKey(place.id, selected)] = { path: `/samples/${slug}/results/${name}.json`, generatedAt: new Date().toISOString() };
    await saveManifest();
    console.log(`${city}: ${selected.join(", ")} → ${out.verdict}${out.review ? ` (changes: ${out.review.perChange.map((c) => c.status).join("/")}; kept ${out.review.perPreserve.filter((x) => x.kept).length}/${out.review.perPreserve.length})` : " (unreviewed)"}`);
  } catch (err) {
    console.log(`${city}: FAILED ${(err as Error).message}`);
  }
}

await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`updated ${manifestPath}`);
