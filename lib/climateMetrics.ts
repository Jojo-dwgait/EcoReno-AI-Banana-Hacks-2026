import { CLIMATE_WINDOW, type DailySeries, type DailyVar } from "./openMeteo";

export const HOT_DAY_C = (90 - 32) / 1.8; // 90 °F
export const EXTREME_HEAT_C = (100 - 32) / 1.8; // 100 °F
export const FREEZE_C = 0; // 32 °F
export const HEAVY_RAIN_MM = 25.4; // 1 inch
export const DEGREE_DAY_BASE_F = 65;
export const DAYS_PER_YEAR = 365.25;
export const OK_COVERAGE = 0.9;
export const MIN_COVERAGE = 0.5;

export type Quality = "ok" | "partial" | "unavailable";

export type MetricKey =
  | "annualPrecipMm"
  | "annualEt0Mm"
  | "waterDeficitMm"
  | "dryMonths"
  | "hotDays"
  | "extremeHeatDays"
  | "freezeDays"
  | "coolingDegreeDaysF"
  | "heatingDegreeDaysF"
  | "heavyRainDays"
  | "solarKwhM2Day"
  | "annualSnowfallCm"
  | "meanDailyMaxWindKmh"
  | "meanAnnualTempC"
  | "meanAnnualMinTempC";

export type Metric = {
  key: MetricKey;
  label: string;
  value: number | null;
  unit: string;
  coverage: number;
  quality: Quality;
  definition: string;
};

export type MonthlyClimate = {
  meanTempC: (number | null)[];
  precipMm: (number | null)[];
  et0Mm: (number | null)[];
};

export type ClimateMetrics = {
  metrics: Record<MetricKey, Metric>;
  monthly: MonthlyClimate;
  expectedDays: number;
  period: string;
};

const isNum = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

export function daysInWindow(start = CLIMATE_WINDOW.start, end = CLIMATE_WINDOW.end): number {
  const ms = Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

function qualityFor(coverage: number): Quality {
  if (coverage >= OK_COVERAGE) return "ok";
  if (coverage >= MIN_COVERAGE) return "partial";
  return "unavailable";
}

function metric(
  key: MetricKey,
  label: string,
  unit: string,
  definition: string,
  value: number | null,
  coverage: number,
): Metric {
  const quality = value === null ? "unavailable" : qualityFor(coverage);
  return { key, label, unit, definition, coverage, quality, value: quality === "unavailable" ? null : value };
}

/** Days with a valid value for every listed variable. */
function validRows(daily: DailySeries, vars: DailyVar[]): number[] {
  const rows: number[] = [];
  for (let i = 0; i < daily.time.length; i++) {
    if (vars.every((v) => isNum(daily[v][i]))) rows.push(i);
  }
  return rows;
}

/** Annualized mean: average daily value × 365.25, using only valid days (missing days are never imputed). */
function annualized(daily: DailySeries, v: DailyVar, expected: number, f: (x: number) => number = (x) => x) {
  const rows = validRows(daily, [v]);
  if (rows.length === 0) return { value: null, coverage: 0 };
  const sum = rows.reduce((acc, i) => acc + f(daily[v][i] as number), 0);
  return { value: (sum / rows.length) * DAYS_PER_YEAR, coverage: rows.length / expected };
}

function meanOf(daily: DailySeries, v: DailyVar, expected: number) {
  const rows = validRows(daily, [v]);
  if (rows.length === 0) return { value: null, coverage: 0 };
  return { value: rows.reduce((acc, i) => acc + (daily[v][i] as number), 0) / rows.length, coverage: rows.length / expected };
}

const yearOf = (iso: string) => Number(iso.slice(0, 4));
const monthOf = (iso: string) => Number(iso.slice(5, 7)) - 1;
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

function meanAnnualMinimum(daily: DailySeries) {
  const startYear = yearOf(CLIMATE_WINDOW.start);
  const endYear = yearOf(CLIMATE_WINDOW.end);
  const byYear = new Map<number, number[]>();
  daily.time.forEach((t, i) => {
    const v = daily.temperature_2m_min[i];
    if (!isNum(v)) return;
    const y = yearOf(t);
    const list = byYear.get(y);
    if (list) list.push(v);
    else byYear.set(y, [v]);
  });
  const minima: number[] = [];
  for (let y = startYear; y <= endYear; y++) {
    const vals = byYear.get(y) ?? [];
    if (vals.length >= OK_COVERAGE * (isLeap(y) ? 366 : 365)) minima.push(Math.min(...vals));
  }
  const years = endYear - startYear + 1;
  if (minima.length < Math.ceil(years / 2)) return { value: null, coverage: minima.length / years };
  return { value: minima.reduce((a, b) => a + b, 0) / minima.length, coverage: minima.length / years };
}

function monthlyClimate(daily: DailySeries): MonthlyClimate {
  const years = yearOf(CLIMATE_WINDOW.end) - yearOf(CLIMATE_WINDOW.start) + 1;
  const acc = Array.from({ length: 12 }, () => ({ days: 0, t: [] as number[], p: [] as number[], e: [] as number[] }));
  daily.time.forEach((iso, i) => {
    const m = acc[monthOf(iso)];
    m.days++;
    const t = daily.temperature_2m_mean[i];
    const p = daily.precipitation_sum[i];
    const e = daily.et0_fao_evapotranspiration[i];
    if (isNum(t)) m.t.push(t);
    if (isNum(p)) m.p.push(p);
    if (isNum(e)) m.e.push(e);
  });
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  // Monthly totals = mean daily value × average length of that month over the window.
  const total = (xs: number[], days: number) => (xs.length >= OK_COVERAGE * days ? mean(xs) * (days / years) : null);
  return {
    meanTempC: acc.map((m) => (m.t.length >= OK_COVERAGE * m.days ? mean(m.t) : null)),
    precipMm: acc.map((m) => total(m.p, m.days)),
    et0Mm: acc.map((m) => total(m.e, m.days)),
  };
}

export function computeClimateMetrics(daily: DailySeries): ClimateMetrics {
  const expected = daysInWindow();
  const cToF = (c: number) => c * 1.8 + 32;

  const precip = annualized(daily, "precipitation_sum", expected);
  const et0 = annualized(daily, "et0_fao_evapotranspiration", expected);
  const snow = annualized(daily, "snowfall_sum", expected);
  const count = (v: DailyVar, test: (x: number) => boolean) => annualized(daily, v, expected, (x) => (test(x) ? 1 : 0));
  const hot = count("temperature_2m_max", (x) => x >= HOT_DAY_C);
  const extreme = count("temperature_2m_max", (x) => x >= EXTREME_HEAT_C);
  const freeze = count("temperature_2m_min", (x) => x <= FREEZE_C);
  const heavy = count("precipitation_sum", (x) => x >= HEAVY_RAIN_MM);
  const cdd = annualized(daily, "temperature_2m_mean", expected, (c) => Math.max(0, cToF(c) - DEGREE_DAY_BASE_F));
  const hdd = annualized(daily, "temperature_2m_mean", expected, (c) => Math.max(0, DEGREE_DAY_BASE_F - cToF(c)));
  const solar = meanOf(daily, "shortwave_radiation_sum", expected);
  const wind = meanOf(daily, "wind_speed_10m_max", expected);
  const tmean = meanOf(daily, "temperature_2m_mean", expected);
  const annualMin = meanAnnualMinimum(daily);
  const monthly = monthlyClimate(daily);

  const deficit =
    precip.value !== null && et0.value !== null ? { value: et0.value - precip.value, coverage: Math.min(precip.coverage, et0.coverage) } : { value: null, coverage: 0 };
  const monthsKnown = monthly.precipMm.filter((p, m) => p !== null && monthly.et0Mm[m] !== null).length;
  const dry = {
    value: monthsKnown === 12 ? monthly.precipMm.filter((p, m) => (p as number) < 0.5 * (monthly.et0Mm[m] as number)).length : null,
    coverage: Math.min(precip.coverage, et0.coverage),
  };

  const m = {
    annualPrecipMm: metric("annualPrecipMm", "Annual precipitation", "mm/yr", "Mean yearly rain + melted snow, 2016–2025", precip.value, precip.coverage),
    annualEt0Mm: metric("annualEt0Mm", "Reference evapotranspiration (ET₀)", "mm/yr", "FAO-56 water demand of a reference grass surface", et0.value, et0.coverage),
    waterDeficitMm: metric("waterDeficitMm", "Water deficit", "mm/yr", "ET₀ minus precipitation; how much more water plants demand than falls as rain", deficit.value, deficit.coverage),
    dryMonths: metric("dryMonths", "Dry months", "months/yr", "Calendar months where mean precipitation is below half of mean ET₀", dry.value, dry.coverage),
    hotDays: metric("hotDays", "Hot days", "days/yr", "Days with maximum temperature ≥ 90 °F (32.2 °C)", hot.value, hot.coverage),
    extremeHeatDays: metric("extremeHeatDays", "Extreme heat days", "days/yr", "Days with maximum temperature ≥ 100 °F (37.8 °C)", extreme.value, extreme.coverage),
    freezeDays: metric("freezeDays", "Freezing nights", "days/yr", "Days with minimum temperature ≤ 32 °F (0 °C)", freeze.value, freeze.coverage),
    coolingDegreeDaysF: metric("coolingDegreeDaysF", "Cooling degree days", "°F·day/yr", "Sum of (daily mean °F − 65) on warm days; a standard cooling-demand index", cdd.value, cdd.coverage),
    heatingDegreeDaysF: metric("heatingDegreeDaysF", "Heating degree days", "°F·day/yr", "Sum of (65 − daily mean °F) on cool days; a standard heating-demand index", hdd.value, hdd.coverage),
    heavyRainDays: metric("heavyRainDays", "Heavy-rain days", "days/yr", "Days with ≥ 1 inch (25.4 mm) of precipitation; runoff context, not flood risk", heavy.value, heavy.coverage),
    solarKwhM2Day: metric("solarKwhM2Day", "Solar radiation", "kWh/m²/day", "Mean daily shortwave radiation on a horizontal surface (MJ/m² ÷ 3.6)", solar.value === null ? null : solar.value / 3.6, solar.coverage),
    annualSnowfallCm: metric("annualSnowfallCm", "Snowfall", "cm/yr", "Mean yearly snowfall", snow.value, snow.coverage),
    meanDailyMaxWindKmh: metric("meanDailyMaxWindKmh", "Typical daily peak wind", "km/h", "Mean of each day's maximum 10 m wind speed", wind.value, wind.coverage),
    meanAnnualTempC: metric("meanAnnualTempC", "Mean temperature", "°C", "Mean of daily mean temperature", tmean.value, tmean.coverage),
    meanAnnualMinTempC: metric("meanAnnualMinTempC", "Typical coldest night", "°C", "Average of each year's lowest daily minimum; basis of the approximate hardiness zone", annualMin.value, annualMin.coverage),
  } satisfies Record<MetricKey, Metric>;

  return { metrics: m, monthly, expectedDays: expected, period: `${CLIMATE_WINDOW.start} to ${CLIMATE_WINDOW.end}` };
}
