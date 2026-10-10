import { computeChangeMap, type ChangeMap } from "./changeMap";
import type { Box } from "./featureInventory";

const MAP_EDGE = 512;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

function pixels(img: HTMLImageElement, w: number, h: number): Uint8ClampedArray {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

/** Runs the pixel comparison in the browser and returns stats plus a transparent heatmap overlay. */
export async function browserChangeMap(beforeSrc: string, afterSrc: string, targets: Box[]): Promise<ChangeMap & { overlay: string }> {
  const [a, b] = await Promise.all([loadImage(beforeSrc), loadImage(afterSrc)]);
  const scale = Math.min(1, MAP_EDGE / Math.max(a.naturalWidth, a.naturalHeight));
  const w = Math.round(a.naturalWidth * scale);
  const h = Math.round(a.naturalHeight * scale);
  const map = computeChangeMap(pixels(a, w, h), pixels(b, w, h), w, h, targets);

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < map.mask.length; i++) {
    if (!map.mask[i]) continue;
    img.data.set([255, 98, 26, 150], i * 4);
  }
  ctx.putImageData(img, 0, 0);
  return { ...map, overlay: c.toDataURL("image/png") };
}
