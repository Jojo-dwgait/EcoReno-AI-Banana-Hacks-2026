"use client";

import type { MetricKey } from "@/lib/climateMetrics";
import { formatMetric, type UnitSystem } from "@/lib/format";
import type { SiteProfile } from "@/lib/siteProfile";

const SHOWN: MetricKey[] = [
  "annualPrecipMm",
  "annualEt0Mm",
  "waterDeficitMm",
  "dryMonths",
  "hotDays",
  "extremeHeatDays",
  "freezeDays",
  "heavyRainDays",
  "coolingDegreeDaysF",
  "heatingDegreeDaysF",
  "solarKwhM2Day",
  "annualSnowfallCm",
];

type Props = { profile: SiteProfile; units: UnitSystem; onUnits: (u: UnitSystem) => void };

export function ClimateEvidence({ profile, units, onUnits }: Props) {
  const { classes, climate, grid, source } = profile;
  const badges = [
    classes.koppen && { label: "Climate type", value: `${classes.koppen.code} · ${classes.koppen.description}` },
    classes.aridityClass && { label: "Aridity", value: `${classes.aridityClass} (P/ET₀ ${classes.aridityIndex?.toFixed(2)})` },
    classes.hardinessZone && { label: "Plant zone", value: `≈ ${classes.hardinessZone.label} (approximate; may be colder at your site)` },
    classes.thermalDominance && { label: "Energy demand", value: classes.thermalDominance === "mixed" ? "mixed heating and cooling" : `${classes.thermalDominance}-dominated` },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <section aria-labelledby="climate-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 id="climate-heading" className="text-lg font-semibold">
          Climate evidence for {profile.place.label}
        </h3>
        <div role="group" aria-label="Units" className="inline-flex overflow-hidden rounded-md border border-line text-sm">
          {(["us", "metric"] as const).map((u) => (
            <button
              key={u}
              type="button"
              aria-pressed={units === u}
              onClick={() => onUnits(u)}
              className={`min-h-9 px-3 ${units === u ? "bg-ink text-paper" : "bg-surface"}`}
            >
              {u === "us" ? "°F · in" : "°C · mm"}
            </button>
          ))}
        </div>
      </div>

      <ul className="flex flex-wrap gap-2">
        {badges.map((b) => (
          <li key={b.label} className="rounded-md border border-line bg-surface px-3 py-1.5 text-sm">
            <span className="text-muted">{b.label}: </span>
            <span className="font-medium">{b.value}</span>
          </li>
        ))}
      </ul>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3 lg:grid-cols-4">
        {SHOWN.map((key) => {
          const m = climate.metrics[key];
          const f = formatMetric(m, units);
          return (
            <div key={key} className="bg-surface p-3" title={m.definition}>
              <dt className="text-xs text-muted">{m.label}</dt>
              <dd className="mt-1">
                <span className="font-mono text-lg">{f.value}</span> <span className="text-xs text-muted">{f.unit}</span>
                {m.quality === "partial" && (
                  <span className="ml-1 text-xs text-warn">({Math.round(m.coverage * 100)}% of days)</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      <p className="text-xs leading-relaxed text-muted">
        Modeled historical estimates (reanalysis), not on-site measurements. {climate.period}, from the{" "}
        <a href={source.url} className="underline" target="_blank" rel="noreferrer">
          {source.name}
        </a>{" "}
        ({source.license}). Grid cell {grid.lat.toFixed(2)}, {grid.lon.toFixed(2)}
        {grid.elevationM !== null ? `, ${Math.round(grid.elevationM)} m elevation` : ""}. {grid.note}
      </p>
    </section>
  );
}
