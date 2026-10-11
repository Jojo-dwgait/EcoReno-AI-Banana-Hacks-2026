import type { PreparedPhoto } from "./clientImage";
import type { FeatureInventory } from "./featureInventory";
import type { GenerateResult } from "./generateTypes";
import type { Place } from "./geocode";
import type { PhotoCredit } from "./unsplash";

/** A real, free-licensed sample home (data/gallery.json → scripts/build-gallery.mts); featured ones have pre-generated results. */
export type SampleManifestEntry = {
  id: string;
  title: string;
  photo: string;
  thumb: string;
  width: number;
  height: number;
  featured: boolean;
  credit: PhotoCredit;
  /** Present once scripts/pregenerate-samples.mts has analyzed the photo. */
  inventory?: string;
  featuredPlaces: Place[];
  /** Key: `${placeId}|${sorted intervention ids}` → saved GenerateResult JSON produced by the same pipeline. */
  results: Record<string, { path: string; generatedAt: string }>;
};

export type LoadedSample = SampleManifestEntry & { photoData: PreparedPhoto; inventoryData: FeatureInventory | null };

export const resultKey = (placeId: number, selected: string[]) => `${placeId}|${[...selected].sort().join(",")}`;

async function toDataUrl(url: string): Promise<{ dataUrl: string; bytes: number }> {
  const blob = await (await fetch(url)).blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Couldn't read the sample photo."));
    r.readAsDataURL(blob);
  });
  return { dataUrl, bytes: blob.size };
}

export async function listSamples(): Promise<SampleManifestEntry[]> {
  const res = await fetch("/samples/manifest.json", { cache: "no-store" });
  if (!res.ok) return [];
  return ((await res.json()) as { samples: SampleManifestEntry[] }).samples;
}

export async function loadSample(entry: SampleManifestEntry): Promise<LoadedSample> {
  const [{ dataUrl, bytes }, inventoryData] = await Promise.all([
    toDataUrl(entry.photo),
    entry.inventory ? fetch(entry.inventory).then((r) => (r.ok ? (r.json() as Promise<FeatureInventory>) : null)) : Promise.resolve(null),
  ]);
  return { ...entry, photoData: { dataUrl, width: entry.width, height: entry.height, bytes }, inventoryData };
}

export async function loadSampleResult(sample: LoadedSample, placeId: number, selected: string[]): Promise<(GenerateResult & { generatedAt: string }) | null> {
  const hit = sample.results[resultKey(placeId, selected)];
  if (!hit) return null;
  const res = await fetch(hit.path);
  if (!res.ok) return null;
  return { ...((await res.json()) as GenerateResult), generatedAt: hit.generatedAt };
}
