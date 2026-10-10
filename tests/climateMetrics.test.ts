import { describe, expect, it } from "vitest";
import { computeClimateMetrics, daysInWindow, HOT_DAY_C } from "../lib/climateMetrics";
import { makeSeries } from "./helpers";

describe("window and calendar", () => {
  it("covers 2016–2025 inclusive with three leap days", () => {
    expect(daysInWindow()).toBe(3653);
    const s = makeSeries();
    expect(s.time.length).toBe(3653);
    expect(s.time.filter((t) => t.endsWith("-02-29"))).toEqual(["2016-02-29", "2020-02-29", "2024-02-29"]);
  });
});

describe("annualized totals and units", () => {
  it("turns 1 mm/day into 365.25 mm/yr and 18 MJ/m² into 5 kWh/m²/day", () => {
    const m = computeClimateMetrics(makeSeries(() => ({ precipitation_sum: 1, shortwave_radiation_sum: 18 }))).metrics;
    expect(m.annualPrecipMm.value).toBeCloseTo(365.25, 6);
    expect(m.solarKwhM2Day.value).toBeCloseTo(5, 6);
    expect(m.annualPrecipMm.unit).toBe("mm/yr");
    expect(m.annualPrecipMm.quality).toBe("ok");
  });

  it("computes the water deficit as ET₀ minus precipitation", () => {
    const m = computeClimateMetrics(makeSeries(() => ({ precipitation_sum: 1, et0_fao_evapotranspiration: 4 }))).metrics;
    expect(m.waterDeficitMm.value).toBeCloseTo(3 * 365.25, 6);
  });

  it("computes degree days in °F with a 65 °F base", () => {
    // 25 °C = 77 °F → 12 cooling degree-days per day, no heating degree-days.
    const m = computeClimateMetrics(makeSeries(() => ({ temperature_2m_mean: 25 }))).metrics;
    expect(m.coolingDegreeDaysF.value).toBeCloseTo(12 * 365.25, 4);
    expect(m.heatingDegreeDaysF.value).toBe(0);
  });
});

describe("thresholds", () => {
  it("counts a hot day at ≥ 90 °F but not just below it", () => {
    const below = computeClimateMetrics(makeSeries(() => ({ temperature_2m_max: HOT_DAY_C - 0.01 }))).metrics;
    const at = computeClimateMetrics(makeSeries(() => ({ temperature_2m_max: HOT_DAY_C }))).metrics;
    expect(below.hotDays.value).toBe(0);
    expect(at.hotDays.value).toBeCloseTo(365.25, 6);
  });

  it("counts heavy-rain days at ≥ 25.4 mm", () => {
    // One 30 mm day per 100 days, otherwise 0 mm.
    const m = computeClimateMetrics(makeSeries((_, i) => ({ precipitation_sum: i % 100 === 0 ? 30 : 0 }))).metrics;
    expect(m.heavyRainDays.value).toBeCloseTo((37 / 3653) * 365.25, 6);
  });

  it("counts freezing nights at ≤ 0 °C", () => {
    const m = computeClimateMetrics(makeSeries((d) => ({ temperature_2m_min: d.getUTCMonth() === 0 ? -2 : 5 }))).metrics;
    expect(m.freezeDays.value).toBeCloseTo((310 / 3653) * 365.25, 6);
  });
});

describe("missing data is flagged, never imputed", () => {
  it("marks 80% coverage as partial and keeps the value from valid days only", () => {
    const m = computeClimateMetrics(makeSeries((_, i) => ({ precipitation_sum: i % 5 === 0 ? null : 2 }))).metrics;
    expect(m.annualPrecipMm.coverage).toBeCloseTo(0.8, 2);
    expect(m.annualPrecipMm.quality).toBe("partial");
    expect(m.annualPrecipMm.value).toBeCloseTo(2 * 365.25, 6);
  });

  it("marks under 50% coverage unavailable with a null value", () => {
    const m = computeClimateMetrics(makeSeries((_, i) => ({ shortwave_radiation_sum: i % 5 === 0 ? 18 : null }))).metrics;
    expect(m.solarKwhM2Day.quality).toBe("unavailable");
    expect(m.solarKwhM2Day.value).toBeNull();
  });

  it("propagates missing inputs into derived metrics", () => {
    const m = computeClimateMetrics(makeSeries(() => ({ et0_fao_evapotranspiration: null }))).metrics;
    expect(m.waterDeficitMm.value).toBeNull();
    expect(m.dryMonths.value).toBeNull();
  });
});

describe("seasonal metrics", () => {
  it("averages each year's coldest night", () => {
    const m = computeClimateMetrics(makeSeries((d) => ({ temperature_2m_min: d.getUTCMonth() === 0 && d.getUTCDate() === 15 ? -5 : 5 }))).metrics;
    expect(m.meanAnnualMinTempC.value).toBeCloseTo(-5, 6);
  });

  it("counts dry months where rain is below half of ET₀", () => {
    // Dry May–October (no rain), wet otherwise.
    const s = makeSeries((d) => {
      const month = d.getUTCMonth();
      return { precipitation_sum: month >= 4 && month <= 9 ? 0 : 5, et0_fao_evapotranspiration: 3 };
    });
    const { metrics, monthly } = computeClimateMetrics(s);
    expect(metrics.dryMonths.value).toBe(6);
    expect(monthly.precipMm[0]).toBeCloseTo(5 * 31, 6);
    expect(monthly.precipMm[1]).toBeCloseTo(5 * 28.3, 6);
  });
});
