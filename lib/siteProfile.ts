import type { ClimateMetrics, MonthlyClimate } from "./climateMetrics";
import type { Place } from "./geocode";
import { ARCHIVE_SOURCE, type ArchiveData } from "./openMeteo";

export type AridityClass = "hyper-arid" | "arid" | "semi-arid" | "dry sub-humid" | "humid";
export type ThermalDominance = "cooling" | "heating" | "mixed";
export type Band = "low" | "moderate" | "high";

export type Koppen = { code: string; description: string };
export type HardinessZone = { zone: number; half: "a" | "b"; label: string; minF: number };

export type ProfileClasses = {
  koppen: Koppen | null;
  aridityIndex: number | null;
  aridityClass: AridityClass | null;
  hardinessZone: HardinessZone | null;
  thermalDominance: ThermalDominance | null;
  solarBand: Band | null;
  heavyRainBand: Band | null;
  snowBand: "none" | "light" | "heavy" | null;
};

export type SiteProfile = {
  place: Pick<Place, "id" | "name" | "state" | "stateCode" | "county" | "lat" | "lon" | "timezone" | "label">;
  grid: { lat: number; lon: number; elevationM: number | null; note: string };
  climate: ClimateMetrics;
  classes: ProfileClasses;
  source: typeof ARCHIVE_SOURCE & { retrievedAt: string };
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/**
 * Köppen–Geiger class from monthly means, following Peel et al. (2007): B is checked before A/C/D,
 * C/D split at 0 °C, Northern Hemisphere summer = Apr–Sep (every supported U.S. location is northern).
 */
export function koppenClass(monthly: MonthlyClimate): Koppen | null {
  const T = monthly.meanTempC;
  const P = monthly.precipMm;
  if (T.some((t) => t === null) || P.some((p) => p === null)) return null;
  const t = T as number[];
  const p = P as number[];

  const MAT = sum(t) / 12;
  const MAP = sum(p);
  const Thot = Math.max(...t);
  const Tcold = Math.min(...t);
  const Tmon10 = t.filter((x) => x > 10).length;
  const summer = [3, 4, 5, 6, 7, 8];
  const winter = [0, 1, 2, 9, 10, 11];
  const Psum = sum(summer.map((m) => p[m]));
  const Pwin = sum(winter.map((m) => p[m]));
  const Pdry = Math.min(...p);
  const Psdry = Math.min(...summer.map((m) => p[m]));
  const Pwdry = Math.min(...winter.map((m) => p[m]));
  const Pswet = Math.max(...summer.map((m) => p[m]));
  const Pwwet = Math.max(...winter.map((m) => p[m]));

  const Pth = Pwin >= 0.7 * MAP ? 2 * MAT : Psum >= 0.7 * MAP ? 2 * MAT + 28 : 2 * MAT + 14;

  if (Thot < 10) {
    return Thot > 0 ? { code: "ET", description: "Tundra" } : { code: "EF", description: "Ice cap" };
  }
  if (MAP < 10 * Pth) {
    const desert = MAP < 5 * Pth;
    const hot = MAT >= 18;
    const code = `B${desert ? "W" : "S"}${hot ? "h" : "k"}`;
    return { code, description: `${hot ? "Hot" : "Cold"} ${desert ? "desert" : "semi-arid steppe"}` };
  }
  if (Tcold >= 18) {
    if (Pdry >= 60) return { code: "Af", description: "Tropical rainforest" };
    if (Pdry >= 100 - MAP / 25) return { code: "Am", description: "Tropical monsoon" };
    return { code: "Aw", description: "Tropical savanna (dry winter)" };
  }

  const seasonal = Psdry < 40 && Psdry < Pwwet / 3 ? "s" : Pwdry < Pswet / 10 ? "w" : "f";
  const group = Tcold > 0 ? "C" : "D";
  let heat: string;
  if (Thot >= 22) heat = "a";
  else if (Tmon10 >= 4) heat = "b";
  else if (group === "D" && Tcold <= -38) heat = "d";
  else heat = "c";

  const seasonText = { s: "dry-summer", w: "dry-winter", f: "no dry season" }[seasonal];
  const heatText = { a: "hot summer", b: "warm summer", c: "cool summer", d: "very cold winter" }[heat];
  const base =
    group === "C"
      ? seasonal === "s"
        ? "Mediterranean"
        : seasonal === "w"
          ? "Subtropical highland / dry-winter temperate"
          : heat === "a"
            ? "Humid subtropical"
            : "Oceanic"
      : seasonal === "w"
        ? "Continental, dry winter"
        : heat === "c" || heat === "d"
          ? "Subarctic"
          : "Humid continental";
  return { code: `${group}${seasonal}${heat}`, description: `${base} (${seasonText}, ${heatText})` };
}

/** UNEP aridity index P / PET, with FAO-56 ET₀ as PET. */
export function aridity(precipMm: number | null, et0Mm: number | null): { index: number | null; cls: AridityClass | null } {
  if (precipMm === null || et0Mm === null || et0Mm <= 0) return { index: null, cls: null };
  const index = precipMm / et0Mm;
  const cls: AridityClass =
    index < 0.05 ? "hyper-arid" : index < 0.2 ? "arid" : index < 0.5 ? "semi-arid" : index < 0.65 ? "dry sub-humid" : "humid";
  return { index, cls };
}

/** Approximate USDA zone: 10 °F bands from −60 °F, "a" = colder half, "b" = warmer half. */
export function hardinessZone(meanAnnualMinC: number | null): HardinessZone | null {
  if (meanAnnualMinC === null) return null;
  const minF = meanAnnualMinC * 1.8 + 32;
  const x = minF + 60;
  const zone = Math.max(1, Math.min(13, Math.floor(x / 10) + 1));
  const within = x - 10 * Math.floor(x / 10);
  const half = within < 5 ? "a" : "b";
  return { zone, half, label: `${zone}${half}`, minF };
}

export function thermalDominance(cddF: number | null, hddF: number | null): ThermalDominance | null {
  if (cddF === null || hddF === null) return null;
  if (cddF >= hddF) return "cooling";
  if (hddF >= 2 * cddF) return "heating";
  return "mixed";
}

const band = (v: number | null, lowBelow: number, highAtLeast: number): Band | null =>
  v === null ? null : v < lowBelow ? "low" : v >= highAtLeast ? "high" : "moderate";

export function classify(climate: ClimateMetrics): ProfileClasses {
  const m = climate.metrics;
  const ar = aridity(m.annualPrecipMm.value, m.annualEt0Mm.value);
  const snow = m.annualSnowfallCm.value;
  return {
    koppen: koppenClass(climate.monthly),
    aridityIndex: ar.index,
    aridityClass: ar.cls,
    hardinessZone: hardinessZone(m.meanAnnualMinTempC.value),
    thermalDominance: thermalDominance(m.coolingDegreeDaysF.value, m.heatingDegreeDaysF.value),
    solarBand: band(m.solarKwhM2Day.value, 3.5, 4.5),
    heavyRainBand: band(m.heavyRainDays.value, 3, 8),
    snowBand: snow === null ? null : snow < 5 ? "none" : snow < 50 ? "light" : "heavy",
  };
}

export type GridCell = { lat: number; lon: number; elevationM: number | null };

export function gridCellOf(archive: ArchiveData): GridCell {
  return { lat: archive.gridLat, lon: archive.gridLon, elevationM: archive.elevationM };
}

export function buildSiteProfile(place: SiteProfile["place"], grid: GridCell, climate: ClimateMetrics, retrievedAt: string): SiteProfile {
  return {
    place,
    grid: {
      ...grid,
      note: "Values describe the reanalysis grid cell nearest the city center (land cells preferred), not a specific lot.",
    },
    climate,
    classes: classify(climate),
    source: { ...ARCHIVE_SOURCE, retrievedAt },
  };
}
