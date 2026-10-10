/** Prints the key metrics and classes for every recorded fixture city. Run: npx tsx scripts/profile-report.ts */
import { fixtureSlugs, loadFixtureProfile } from "../tests/fixtures";

const rows = fixtureSlugs().map((slug) => {
  const p = loadFixtureProfile(slug);
  const m = p.climate.metrics;
  const r = (v: number | null, d = 0) => (v === null ? "—" : v.toFixed(d));
  return {
    city: p.place.label,
    koppen: p.classes.koppen?.code ?? "—",
    aridity: `${p.classes.aridityClass} ${r(p.classes.aridityIndex, 2)}`,
    zone: p.classes.hardinessZone?.label ?? "—",
    thermal: p.classes.thermalDominance ?? "—",
    "P mm": r(m.annualPrecipMm.value),
    "deficit mm": r(m.waterDeficitMm.value),
    dryMo: r(m.dryMonths.value),
    hot: r(m.hotDays.value),
    "100F": r(m.extremeHeatDays.value),
    freeze: r(m.freezeDays.value),
    heavyRain: r(m.heavyRainDays.value, 1),
    CDD: r(m.coolingDegreeDaysF.value),
    HDD: r(m.heatingDegreeDaysF.value),
    solar: r(m.solarKwhM2Day.value, 2),
    "snow cm": r(m.annualSnowfallCm.value),
  };
});
console.table(rows);
