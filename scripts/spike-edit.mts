/**
 * Phase 0 fidelity spike: analyze one real photo, run 2–3 edit plans, save outputs for visual review.
 * Run: npx tsx --conditions=react-server scripts/spike-edit.mts photos/house.jpg [--plans=A,B,C] [--skip-analysis] [--list-models]
 * Outputs go to photos/spike/ (gitignored).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* fall back to the shell environment */
}

const { geminiClient, GEMINI_MODELS } = await import("../lib/gemini");
const { GeminiImageEditor } = await import("../lib/imageEditClient");
const { normalizeToOriginal } = await import("../lib/imageNormalize");
const { analyzePhoto } = await import("../lib/visionClient");
const { BASE_FORBIDDEN, BASE_PRESERVE, buildEditPrompt } = await import("../lib/renovationPrompt");

type Plan = Parameters<typeof buildEditPrompt>[0];
const xeriscape = {
  id: "native-planting",
  instruction: "Replace the mowed lawn with drought-tolerant native planting beds, keeping the lawn's exact outline.",
  targetArea: "the front lawn only",
  styleDescriptors: ["drought-tolerant native shrubs and ornamental grasses", "gravel mulch between plants", "a few low boulders", "plants at realistic young-to-mature sizes"],
};
const solar = {
  id: "rooftop-solar",
  instruction: "Add a tidy array of dark rooftop solar panels flush-mounted on the roof plane that faces the camera.",
  targetArea: "the roof plane facing the camera",
  styleDescriptors: ["black-framed panels in neat rows", "setbacks from the roof edges and ridge"],
};
const awnings = {
  id: "window-awnings",
  instruction: "Add simple fabric awnings above the front-facing windows.",
  targetArea: "directly above the front windows",
  styleDescriptors: ["muted neutral fabric that matches the house colors", "modest projection"],
};
const plans: Record<string, Plan> = {
  A: { changes: [xeriscape], preserve: BASE_PRESERVE, forbidden: BASE_FORBIDDEN, climateBasis: [] },
  B: { changes: [solar, awnings], preserve: BASE_PRESERVE, forbidden: BASE_FORBIDDEN, climateBasis: [] },
  C: { changes: [xeriscape, solar, awnings], preserve: BASE_PRESERVE, forbidden: BASE_FORBIDDEN, climateBasis: [] },
};

const args = process.argv.slice(2);
const photoPath = args.find((a) => !a.startsWith("--"));
const chosen = (args.find((a) => a.startsWith("--plans="))?.split("=")[1] ?? "A,B").split(",");

if (args.includes("--list-models")) {
  const pager = await geminiClient().models.list();
  for await (const m of pager) {
    if (/image|flash/i.test(m.name ?? "")) console.log(m.name, "|", m.displayName, "|", m.supportedActions?.join(","));
  }
}
if (!photoPath) {
  console.log("Usage: npx tsx --conditions=react-server scripts/spike-edit.mts photos/house.jpg [--plans=A,B,C]");
  process.exit(0);
}

const resized = await sharp(await readFile(photoPath)).rotate().resize(1536, 1536, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer({ resolveWithObject: true });
const input = { mimeType: "image/jpeg" as const, base64: resized.data.toString("base64"), width: resized.info.width, height: resized.info.height };
console.log(`input ${input.width}×${input.height}, ${(resized.data.length / 1024).toFixed(0)} KB · models: image=${GEMINI_MODELS.image} vision=${GEMINI_MODELS.vision}`);

const outDir = path.join("photos", "spike");
await mkdir(outDir, { recursive: true });
const base = path.basename(photoPath).replace(/\.[^.]+$/, "");
await writeFile(path.join(outDir, `${base}-original.jpg`), resized.data);

if (!args.includes("--skip-analysis")) {
  const { inventory, model, ms } = await analyzePhoto(input);
  console.log(`\nanalysis (${model}, ${ms} ms): house=${inventory.isResidentialExterior} type=${inventory.propertyType} stories=${inventory.stories} roofFacesCamera=${inventory.roofFacesCamera}`);
  for (const [k, f] of Object.entries(inventory.features)) {
    console.log(`  ${k.padEnd(9)} ${f.visible ? "yes" : "no "} ${f.confidence.toFixed(2)} ${f.box ? `box x${f.box.x.toFixed(2)} y${f.box.y.toFixed(2)} w${f.box.w.toFixed(2)} h${f.box.h.toFixed(2)}` : ""} ${f.note}`);
  }
  console.log("  scene:", JSON.stringify(inventory.scene), "\n  uncertainties:", inventory.uncertainties.join(" | "));
  await writeFile(path.join(outDir, `${base}-analysis.json`), JSON.stringify(inventory, null, 2));
}

const editor = new GeminiImageEditor();
for (const id of chosen) {
  const plan = plans[id];
  if (!plan) continue;
  try {
    const result = await editor.edit(input, buildEditPrompt(plan));
    const norm = await normalizeToOriginal(result.base64, input.width, input.height);
    const file = path.join(outDir, `${base}-plan${id}.jpg`);
    await writeFile(file, Buffer.from(norm.base64, "base64"));
    console.log(`\nplan ${id}: ${result.ms} ms · ${result.model} · model output ${norm.source.width}×${norm.source.height} (${result.mimeType}) · aspect mismatch ${(norm.aspectMismatch * 100).toFixed(1)}% → ${file}${result.modelNote ? `\n  note: ${result.modelNote.slice(0, 200)}` : ""}`);
  } catch (err) {
    console.log(`\nplan ${id}: FAILED ${(err as Error).message}`);
  }
}
