/**
 * Builds the sample-home gallery from approved originals in photos/gallery/<slug>.jpg (gitignored)
 * into public/samples/<slug>/photo.jpg (≤1536 px, metadata stripped by re-encoding) and public/samples/manifest.json.
 * Keeps any inventory/results that scripts/pregenerate-samples.mts already wrote.
 * Run: npx tsx scripts/build-gallery.mts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

type GalleryEntry = { slug: string; title: string; unsplashId: string; photographer: string; photographerUrl: string; pageUrl: string; featured: boolean };
type ManifestEntry = Record<string, unknown> & { id: string };

const UTM = "utm_source=ecoreno_ai&utm_medium=referral";
const withUtm = (url: string) => `${url}${url.includes("?") ? "&" : "?"}${UTM}`;

const gallery = JSON.parse(await readFile("data/gallery.json", "utf8")) as GalleryEntry[];
const manifestPath = path.join("public", "samples", "manifest.json");
const existing = await readFile(manifestPath, "utf8")
  .then((s) => (JSON.parse(s) as { samples: ManifestEntry[] }).samples)
  .catch(() => [] as ManifestEntry[]);

const samples = [];
for (const g of gallery) {
  const out = path.join("public", "samples", g.slug);
  await mkdir(out, { recursive: true });
  const img = await sharp(await readFile(path.join("photos", "gallery", `${g.slug}.jpg`)))
    .rotate()
    .resize(1536, 1536, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  await writeFile(path.join(out, "photo.jpg"), img.data);
  const thumb = await sharp(img.data).resize(640, 480, { fit: "cover" }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
  await writeFile(path.join(out, "thumb.jpg"), thumb);
  const prior = existing.find((e) => e.id === g.slug) ?? {};
  samples.push({
    featuredPlaces: [],
    results: {},
    ...prior,
    id: g.slug,
    title: g.title,
    photo: `/samples/${g.slug}/photo.jpg`,
    thumb: `/samples/${g.slug}/thumb.jpg`,
    width: img.info.width,
    height: img.info.height,
    featured: g.featured,
    credit: { name: g.photographer, url: withUtm(g.photographerUrl), sourceUrl: withUtm(g.pageUrl), source: "Unsplash", license: "Unsplash License" },
  });
  console.log(`${g.slug}: ${img.info.width}×${img.info.height}, ${(img.data.length / 1024).toFixed(0)} KB`);
}
await writeFile(manifestPath, JSON.stringify({ samples }, null, 2));
console.log(`wrote ${manifestPath} (${samples.length} samples)`);
