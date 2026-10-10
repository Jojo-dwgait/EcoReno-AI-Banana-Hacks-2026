import { describe, expect, it } from "vitest";
import { fixtureSlugs, loadFixtureProfile } from "./fixtures";

const slugs = fixtureSlugs();

describe("recorded acceptance cities (real Open-Meteo data, 2016–2025)", () => {
  it("has the acceptance cities recorded", () => {
    expect(slugs).toEqual(expect.arrayContaining(["irvine", "seattle", "phoenix", "minneapolis", "miami", "portland-or", "portland-me", "anchorage"]));
  });

  it.each(slugs)("%s: full coverage, sane ranges, no missing core metrics", (slug) => {
    const { climate } = loadFixtureProfile(slug);
    const m = climate.metrics;
    for (const metric of Object.values(m)) expect(metric.quality, `${slug} ${metric.key}`).toBe("ok");
    expect(m.annualPrecipMm.value!).toBeGreaterThan(50);
    expect(m.annualPrecipMm.value!).toBeLessThan(4000);
    expect(m.solarKwhM2Day.value!).toBeGreaterThan(1.5);
    expect(m.solarKwhM2Day.value!).toBeLessThan(8);
    expect(m.hotDays.value!).toBeGreaterThanOrEqual(0);
    expect(m.hotDays.value!).toBeLessThanOrEqual(365.25);
  });

  // Major Köppen groups are well established for these cities; borderline ones are checked loosely.
  it.each([
    ["phoenix", ["B"]],
    ["miami", ["A"]],
    ["minneapolis", ["D"]],
    ["anchorage", ["D"]],
    ["seattle", ["C"]],
    ["portland-or", ["C"]],
    ["portland-me", ["D"]],
    ["irvine", ["B", "C"]],
  ])("%s → Köppen group %j", (slug, groups) => {
    const code = loadFixtureProfile(slug).classes.koppen?.code ?? "";
    expect(groups).toContain(code[0]);
  });

  it("Seattle and both Portlands differ, and Phoenix is drier and hotter than Seattle", () => {
    const phx = loadFixtureProfile("phoenix").climate.metrics;
    const sea = loadFixtureProfile("seattle").climate.metrics;
    expect(phx.waterDeficitMm.value!).toBeGreaterThan(sea.waterDeficitMm.value! + 500);
    expect(phx.hotDays.value!).toBeGreaterThan(sea.hotDays.value! + 50);
    expect(loadFixtureProfile("portland-or").place.state).toBe("Oregon");
    expect(loadFixtureProfile("portland-me").place.state).toBe("Maine");
  });
});
