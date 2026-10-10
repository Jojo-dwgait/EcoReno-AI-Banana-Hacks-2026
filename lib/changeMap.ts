import type { Box } from "./featureInventory";

export type ChangeMap = {
  width: number;
  height: number;
  /** 1 where the edit visibly changed the pixel. */
  mask: Uint8Array;
  /** Share of the whole image that changed. */
  changedFraction: number;
  /** Share of the area OUTSIDE the target boxes that changed: the "drift" in parts that should be untouched. */
  protectedDrift: number | null;
};

export const CHANGE_THRESHOLD = 30;
const BLUR_RADIUS = 2;

/** Perceptually weighted RGB distance per pixel, scaled to roughly 0–255. */
function diffMap(a: Uint8ClampedArray, b: Uint8ClampedArray, n: number): Float32Array {
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const j = i * 4;
    const dr = a[j] - b[j];
    const dg = a[j + 1] - b[j + 1];
    const db = a[j + 2] - b[j + 2];
    d[i] = Math.sqrt((2 * dr * dr + 4 * dg * dg + 3 * db * db) / 9);
  }
  return d;
}

/** Separable box blur so JPEG noise and tiny misalignments don't register as edits. */
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let c = 0;
      for (let k = -r; k <= r; k++) {
        const xx = x + k;
        if (xx >= 0 && xx < w) {
          s += src[y * w + xx];
          c++;
        }
      }
      tmp[y * w + x] = s / c;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      let c = 0;
      for (let k = -r; k <= r; k++) {
        const yy = y + k;
        if (yy >= 0 && yy < h) {
          s += tmp[yy * w + x];
          c++;
        }
      }
      out[y * w + x] = s / c;
    }
  }
  return out;
}

function insideAny(x: number, y: number, boxes: Box[], margin: number): boolean {
  return boxes.some((b) => x >= b.x - margin && x <= b.x + b.w + margin && y >= b.y - margin && y <= b.y + b.h + margin);
}

/** Compares two same-size RGBA buffers (already downscaled, e.g. to 512 px) — no AI model involved. */
export function computeChangeMap(
  before: Uint8ClampedArray,
  after: Uint8ClampedArray,
  width: number,
  height: number,
  targets: Box[] = [],
  threshold = CHANGE_THRESHOLD,
): ChangeMap {
  const n = width * height;
  if (before.length !== n * 4 || after.length !== n * 4) throw new Error("Images must be the same size.");
  const blurred = boxBlur(diffMap(before, after, n), width, height, BLUR_RADIUS);
  const mask = new Uint8Array(n);
  let changed = 0;
  let protectedPixels = 0;
  let protectedChanged = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const isChanged = blurred[i] >= threshold;
      if (isChanged) {
        mask[i] = 1;
        changed++;
      }
      if (targets.length > 0 && !insideAny(x / width, y / height, targets, 0.04)) {
        protectedPixels++;
        if (isChanged) protectedChanged++;
      }
    }
  }
  return {
    width,
    height,
    mask,
    changedFraction: changed / n,
    protectedDrift: targets.length > 0 && protectedPixels > 0 ? protectedChanged / protectedPixels : null,
  };
}
