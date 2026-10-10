import { describe, expect, it } from "vitest";
import { upgradeValues } from "../lib/premiums";
import {
  areaDefaults,
  builtYearFromCode,
  comparables,
  fitValueModel,
  predictValue,
  prepareRecords,
  weightedQuantile,
  type PumsRecord,
} from "../lib/valueModel";

/** Deterministic PRNG + normal noise so the test is reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  const u = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const normal = () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(2 * Math.PI * u());
  return { u, normal };
}

const TRUE = { b0: 13, beds: 0.12, age: -0.05, age2: 0.002, attached: -0.15, lot: 0.25, sd: 0.2 };
const YRBLT = [1939, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020, 2022];

function synthetic(n: number, seed = 7): PumsRecord[] {
  const { u, normal } = rng(seed);
  return Array.from({ length: n }, () => {
    const bedrooms = 1 + Math.floor(u() * 5);
    const code = YRBLT[Math.floor(u() * YRBLT.length)];
    const built = builtYearFromCode(code)!;
    const attached = u() < 0.25;
    const largeLot = u() < 0.15;
    const ageDec = (2024 - built) / 10;
    const log = TRUE.b0 + TRUE.beds * bedrooms + TRUE.age * ageDec + TRUE.age2 * ageDec ** 2 + (attached ? TRUE.attached : 0) + (largeLot ? TRUE.lot : 0) + TRUE.sd * normal();
    return { value: Math.round(Math.exp(log)), bedrooms, rooms: bedrooms + 3, yearBuiltCode: code, building: attached ? "03" : "02", lot: largeLot ? 2 : 1, tenure: u() < 0.6 ? 1 : 2, weight: 5 + Math.floor(u() * 40), adjustment: 1_000_000 };
  });
}

describe("PUMS preparation", () => {
  it("maps YRBLT codes to build years", () => {
    expect(builtYearFromCode(1939)).toBe(1930);
    expect(builtYearFromCode(1970)).toBe(1975);
    expect(builtYearFromCode(2022)).toBe(2022);
    expect(builtYearFromCode(1938)).toBeNull();
  });

  it("keeps only owner-occupied one-family homes with a value, adjusted to 2024 dollars", () => {
    const base: PumsRecord = { value: 500_000, bedrooms: 3, rooms: 6, yearBuiltCode: 1980, building: "02", lot: 1, tenure: 1, weight: 10, adjustment: 1_029_379 };
    const rows = prepareRecords([
      base,
      { ...base, tenure: 3 }, // renter
      { ...base, building: "09" }, // apartment building
      { ...base, value: 0 }, // no value
      { ...base, building: "03", tenure: 2 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].value2024).toBeCloseTo(500_000 * 1.029379, 2);
    expect(rows[1].attached).toBe(1);
  });
});

describe("weighted regression on log(value)", () => {
  const rows = prepareRecords(synthetic(1500));
  const model = fitValueModel(rows)!;

  it("recovers the generating coefficients", () => {
    const c = Object.fromEntries(model.coefficients.map((x) => [x.name, x.value]));
    expect(c.bedrooms).toBeCloseTo(TRUE.beds, 1);
    expect(c["age (decades)"]).toBeCloseTo(TRUE.age, 1);
    expect(c.attached).toBeCloseTo(TRUE.attached, 1);
    expect(c["lot ≥ 1 acre"]).toBeCloseTo(TRUE.lot, 1);
    expect(model.residualSd).toBeGreaterThan(0.15);
    expect(model.residualSd).toBeLessThan(0.25);
    expect(model.r2).toBeGreaterThan(0.3);
    expect(model.n).toBe(1500);
  });

  it("predicts a median value with an 80% range that brackets it", () => {
    const p = predictValue(model, { bedrooms: 3, builtYear: 1975, kind: "detached" });
    const ageDec = (2024 - 1975) / 10;
    const truth = Math.exp(TRUE.b0 + TRUE.beds * 3 + TRUE.age * ageDec + TRUE.age2 * ageDec ** 2);
    expect(p.mid / truth).toBeGreaterThan(0.93);
    expect(p.mid / truth).toBeLessThan(1.07);
    expect(p.low).toBeLessThan(p.mid);
    expect(p.high).toBeGreaterThan(p.mid);
  });

  it("refuses to fit on too few records instead of overfitting", () => {
    expect(fitValueModel(rows.slice(0, 20))).toBeNull();
  });

  it("handles areas with no attached homes by dropping that column", () => {
    const detachedOnly = rows.filter((r) => r.attached === 0);
    const m = fitValueModel(detachedOnly)!;
    expect(m.activeFeatures[4]).toBe(false);
    expect(m.coefficients.find((c) => c.name === "attached")!.value).toBe(0);
  });
});

describe("comparables and defaults", () => {
  const rows = prepareRecords(synthetic(1500));

  it("finds same-kind, same-bedroom homes from the same era", () => {
    const comps = comparables(rows, { bedrooms: 3, builtYear: 1975, kind: "detached" })!;
    expect(comps.count).toBeGreaterThanOrEqual(15);
    expect(comps.p25).toBeLessThanOrEqual(comps.median);
    expect(comps.p75).toBeGreaterThanOrEqual(comps.median);
    expect(comps.definition).toContain("3-bedroom detached");
  });

  it("widens the definition when there are too few matches", () => {
    const sparse = rows.filter((r) => !(r.bedrooms === 5 && r.attached === 1)).concat(rows.filter((r) => r.bedrooms === 5 && r.attached === 1).slice(0, 3));
    const comps = comparables(sparse, { bedrooms: 5, builtYear: 2022, kind: "attached" });
    expect(comps === null || !comps.definition.startsWith("5-bedroom")).toBe(true);
  });

  it("uses area medians when the user skips questions", () => {
    const d = areaDefaults(rows);
    expect(d.bedrooms).toBeGreaterThanOrEqual(1);
    expect(d.bedrooms).toBeLessThanOrEqual(6);
    expect(d.builtYear).toBeGreaterThan(1900);
  });

  it("computes weighted quantiles", () => {
    expect(weightedQuantile([1, 2, 3], [1, 1, 98], 0.5)).toBe(3);
    expect(weightedQuantile([1, 2, 3], [98, 1, 1], 0.5)).toBe(1);
  });
});

describe("upgrade premiums", () => {
  it("adds only direct evidence, as a range", () => {
    const [solar, tree, roof] = upgradeValues(["rooftop-solar", "shade-tree", "cool-roof"]);
    expect(solar.low).toBeCloseTo(2.6 * 3750);
    expect(solar.mid).toBeCloseTo(15_000);
    expect(solar.high).toBeCloseTo(5.9 * 3750);
    expect(tree.mid).toBeNull();
    expect(tree.evidence.tier).toBe("related");
    expect(roof.evidence.tier).toBe("none");
  });
});
