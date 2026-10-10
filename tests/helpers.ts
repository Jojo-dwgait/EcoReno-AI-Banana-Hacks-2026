import { DAILY_VARS, type DailySeries, type DailyVar } from "../lib/openMeteo";

export type DayValues = Partial<Record<DailyVar, number | null>>;

/** Builds a complete 2016-01-01 → 2025-12-31 daily series; `fn` sets each day's values (defaults are mild). */
export function makeSeries(fn: (date: Date, index: number) => DayValues = () => ({})): DailySeries {
  const defaults: Record<DailyVar, number> = {
    temperature_2m_max: 20,
    temperature_2m_min: 10,
    temperature_2m_mean: 15,
    precipitation_sum: 1,
    snowfall_sum: 0,
    shortwave_radiation_sum: 15,
    et0_fao_evapotranspiration: 3,
    wind_speed_10m_max: 15,
  };
  const series = { time: [] as string[] } as DailySeries;
  for (const v of DAILY_VARS) series[v] = [];
  const d = new Date(Date.UTC(2016, 0, 1));
  let i = 0;
  while (d.getUTCFullYear() <= 2025) {
    const values = fn(new Date(d), i);
    series.time.push(d.toISOString().slice(0, 10));
    for (const v of DAILY_VARS) series[v].push(v in values ? (values[v] as number | null) : defaults[v]);
    d.setUTCDate(d.getUTCDate() + 1);
    i++;
  }
  return series;
}
