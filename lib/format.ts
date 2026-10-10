import type { Metric } from "./climateMetrics";

export type UnitSystem = "us" | "metric";

const num = (v: number, digits: number) =>
  v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Formats a metric stored in canonical units (mm, cm, °C, km/h, °F·day) for display. */
export function formatMetric(m: Pick<Metric, "value" | "unit">, sys: UnitSystem): { value: string; unit: string } {
  const v = m.value;
  if (v === null) return { value: "—", unit: "unavailable" };
  switch (m.unit) {
    case "mm/yr":
      return sys === "us" ? { value: num(v / 25.4, 1), unit: "in/yr" } : { value: num(v, 0), unit: "mm/yr" };
    case "cm/yr":
      return sys === "us" ? { value: num(v / 2.54, 1), unit: "in/yr" } : { value: num(v, 0), unit: "cm/yr" };
    case "°F·day/yr":
      return sys === "us" ? { value: num(v, 0), unit: "°F·days/yr" } : { value: num(v / 1.8, 0), unit: "°C·days/yr" };
    case "km/h":
      return sys === "us" ? { value: num(v / 1.609344, 0), unit: "mph" } : { value: num(v, 0), unit: "km/h" };
    case "°C":
      return sys === "us" ? { value: num(v * 1.8 + 32, 0), unit: "°F" } : { value: num(v, 1), unit: "°C" };
    case "kWh/m²/day":
      return { value: num(v, 2), unit: "kWh/m²/day" };
    case "days/yr":
      return { value: num(v, v < 10 ? 1 : 0), unit: "days/yr" };
    case "months/yr":
      return { value: num(v, 0), unit: "months/yr" };
    default:
      return { value: num(v, 1), unit: m.unit };
  }
}
