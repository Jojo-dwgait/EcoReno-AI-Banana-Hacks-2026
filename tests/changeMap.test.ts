import { describe, expect, it } from "vitest";
import { computeChangeMap } from "../lib/changeMap";

function image(w: number, h: number, paint: (x: number, y: number) => [number, number, number]) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = paint(x, y);
      px.set([r, g, b, 255], (y * w + x) * 4);
    }
  }
  return px;
}

const W = 100;
const H = 80;
const base = image(W, H, () => [120, 130, 110]);

describe("computeChangeMap", () => {
  it("reports zero change for identical images", () => {
    const m = computeChangeMap(base, base, W, H);
    expect(m.changedFraction).toBe(0);
  });

  it("ignores small noise like JPEG artifacts", () => {
    const noisy = image(W, H, (x, y) => [120 + ((x * 7 + y * 3) % 9) - 4, 130, 110]);
    expect(computeChangeMap(base, noisy, W, H).changedFraction).toBe(0);
  });

  it("measures an edited region and attributes it to the target box", () => {
    // Bottom-left quarter recolored (e.g. lawn → gravel planting).
    const edited = image(W, H, (x, y) => (x < 50 && y >= 40 ? [190, 170, 140] : [120, 130, 110]));
    const target = { x: 0, y: 0.5, w: 0.5, h: 0.5 };
    const m = computeChangeMap(base, edited, W, H, [target]);
    expect(m.changedFraction).toBeGreaterThan(0.2);
    expect(m.changedFraction).toBeLessThan(0.3);
    expect(m.protectedDrift).not.toBeNull();
    expect(m.protectedDrift!).toBeLessThan(0.01);
  });

  it("flags drift when the edit spills outside the targets", () => {
    const sky = image(W, H, (x, y) => (y < 20 ? [60, 60, 70] : [120, 130, 110]));
    const m = computeChangeMap(base, sky, W, H, [{ x: 0, y: 0.5, w: 0.5, h: 0.5 }]);
    expect(m.protectedDrift!).toBeGreaterThan(0.2);
  });

  it("rejects mismatched sizes", () => {
    expect(() => computeChangeMap(base, image(10, 10, () => [0, 0, 0]), W, H)).toThrow();
  });
});
