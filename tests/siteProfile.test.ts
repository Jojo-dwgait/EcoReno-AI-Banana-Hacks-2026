import { describe, expect, it } from "vitest";
import type { MonthlyClimate } from "../lib/climateMetrics";
import { aridity, hardinessZone, koppenClass, thermalDominance } from "../lib/siteProfile";

const monthly = (t: number[], p: number[]): MonthlyClimate => ({ meanTempC: t, precipMm: p, et0Mm: p.map(() => 100) });
const flat = (v: number) => Array(12).fill(v);

describe("Köppen classification (Peel et al. 2007 rules)", () => {
  it("tropical rainforest: warm all year, wet every month", () => {
    expect(koppenClass(monthly(flat(27), flat(200)))?.code).toBe("Af");
  });
  it("hot desert: warm and nearly rainless", () => {
    const t = [12, 14, 17, 21, 26, 31, 34, 33, 30, 23, 16, 12];
    expect(koppenClass(monthly(t, flat(5)))?.code).toBe("BWh");
  });
  it("hot-summer Mediterranean: wet winter, dry summer", () => {
    const t = [12, 13, 15, 17, 20, 23, 26, 26, 24, 20, 15, 12];
    const p = [110, 100, 80, 40, 10, 3, 1, 2, 8, 40, 90, 110];
    expect(koppenClass(monthly(t, p))?.code).toBe("Csa");
  });
  it("hot-summer humid continental: freezing winter, even precipitation", () => {
    const t = [-10, -7, 0, 8, 15, 21, 23, 22, 17, 9, 1, -7];
    expect(koppenClass(monthly(t, flat(70)))?.code).toBe("Dfa");
  });
  it("tundra: warmest month below 10 °C", () => {
    expect(koppenClass(monthly(flat(5), flat(30)))?.code).toBe("ET");
  });
  it("returns null when any month is missing", () => {
    const t = [...flat(20)];
    t[3] = null as unknown as number;
    expect(koppenClass(monthly(t, flat(50)))).toBeNull();
  });
});

describe("UNEP aridity index", () => {
  it.each([
    [4, 100, "hyper-arid"],
    [19, 100, "arid"],
    [49, 100, "semi-arid"],
    [60, 100, "dry sub-humid"],
    [70, 100, "humid"],
  ])("P=%i, ET₀=%i → %s", (p, e, cls) => {
    expect(aridity(p, e).cls).toBe(cls);
  });
  it("is null without data", () => {
    expect(aridity(null, 1000).cls).toBeNull();
  });
});

describe("approximate hardiness zone", () => {
  // USDA bands: zone 10a = 30–35 °F, 4b = −25 to −20 °F, 11a = 40–45 °F, 6b = −5 to 0 °F.
  it.each([
    [32, "10a"],
    [-25, "4b"],
    [40, "11a"],
    [-1, "6b"],
  ])("%f °F → %s", (f, label) => {
    expect(hardinessZone((f - 32) / 1.8)?.label).toBe(label);
  });
});

describe("thermal dominance", () => {
  it("classifies cooling, heating and mixed climates", () => {
    expect(thermalDominance(4000, 1000)).toBe("cooling");
    expect(thermalDominance(200, 4400)).toBe("heating");
    expect(thermalDominance(1000, 1300)).toBe("mixed");
    expect(thermalDominance(null, 1300)).toBeNull();
  });
});
