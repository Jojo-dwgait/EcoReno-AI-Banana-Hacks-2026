"use client";

import { useEffect, useRef, useState } from "react";
import { CityPicker } from "@/components/CityPicker";
import { PipelineStepper } from "@/components/PipelineStepper";
import type { PreparedPhoto } from "@/lib/clientImage";
import type { MetricKey } from "@/lib/climateMetrics";
import type { FeatureInventory, FeatureKey } from "@/lib/featureInventory";
import { formatMetric, type UnitSystem } from "@/lib/format";
import { readGenerateStream, type GenerateResult, type GenerateStage } from "@/lib/generateTypes";
import type { Place } from "@/lib/geocode";
import { INTERVENTION_BY_ID, type InterventionId } from "@/lib/interventions";
import { recommend, type Priority } from "@/lib/recommendationEngine";
import { loadSampleResult, type LoadedSample } from "@/lib/samples";
import type { SiteProfile } from "@/lib/siteProfile";

type Props = {
  photo: PreparedPhoto;
  inventory: FeatureInventory;
  confirmed: Partial<Record<FeatureKey, boolean>>;
  priority: Priority;
  units: UnitSystem;
  a: { profile: SiteProfile; result: GenerateResult };
  sample?: LoadedSample | null;
};

type GenState = { kind: "idle" } | { kind: "running"; stages: GenerateStage[]; startedAt: number } | { kind: "done"; result: GenerateResult } | { kind: "error"; message: string };

/** Event-time clock read (kept out of render so the component stays pure). */
const now = () => Date.now();

const COMPARE_METRICS: MetricKey[] = ["waterDeficitMm", "dryMonths", "hotDays", "freezeDays", "heavyRainDays", "solarKwhM2Day", "coolingDegreeDaysF", "heatingDegreeDaysF"];

function Panel({ src, label, items }: { src: string; label: string; items: string[] }) {
  return (
    <figure className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
      <img src={src} alt={`${label}: ${items.join(", ") || "original photo"}`} className="w-full rounded-sheet border border-line" />
      <figcaption className="text-sm">
        <span className="font-medium">{label}</span>
        {items.length > 0 && <span className="block text-xs text-muted">{items.join(" · ")}</span>}
      </figcaption>
    </figure>
  );
}

export function CompareView({ photo, inventory, confirmed, priority, units, a, sample }: Props) {
  const [placeB, setPlaceB] = useState<Place | null>(null);
  const [profileB, setProfileB] = useState<SiteProfile | null>(null);
  const [climateError, setClimateError] = useState<string | null>(null);
  const [gen, setGen] = useState<GenState>({ kind: "idle" });
  const req = useRef<AbortController | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (gen.kind !== "running") return;
    const t = setInterval(() => setElapsed(Math.round((now() - gen.startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [gen]);

  const recsB = profileB ? recommend({ profile: profileB, inventory, priority, confirmed }) : null;
  const picksB: InterventionId[] = recsB?.filter((r) => r.preselected).map((r) => r.id) ?? [];
  const picksA = a.result.plan.changes.map((c) => c.id);
  const sameSet = picksB.length > 0 && picksB.length === picksA.length && picksB.every((id) => picksA.includes(id));

  async function choose(next: Place | null) {
    req.current?.abort();
    setPlaceB(next);
    setProfileB(null);
    setClimateError(null);
    setGen({ kind: "idle" });
    if (!next) return;
    const controller = new AbortController();
    req.current = controller;
    try {
      const res = await fetch("/api/climate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ place: next }), signal: controller.signal });
      const data = await res.json();
      if (data.ok) setProfileB(data.profile);
      else setClimateError(data.message);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setClimateError("Couldn't load climate data. Please try again.");
    }
  }

  async function generateB() {
    if (!placeB || picksB.length === 0) return;
    if (sample) {
      const saved = await loadSampleResult(sample, placeB.id, picksB).catch(() => null);
      if (saved) {
        setGen({ kind: "done", result: saved });
        return;
      }
    }
    setElapsed(0);
    setGen({ kind: "running", stages: [], startedAt: now() });
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: photo.dataUrl, place: placeB, selected: picksB, inventory }),
      });
      const result = await readGenerateStream(res, (s) => setGen((g) => (g.kind === "running" ? { ...g, stages: [...g.stages, s] } : g)));
      setGen({ kind: "done", result });
    } catch (err) {
      setGen({ kind: "error", message: (err as Error).message });
    }
  }

  const titles = (ids: InterventionId[]) => ids.map((id) => INTERVENTION_BY_ID[id].title);

  return (
    <div className="space-y-5">
      <p className="text-muted">Same photo, same house, different climate. Pick a second U.S. city to see what its data recommends instead.</p>
      <CityPicker selected={placeB} onSelect={choose} />
      {climateError && (
        <p role="alert" className="text-danger">
          {climateError}
        </p>
      )}

      {profileB && recsB && (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-sm">
              <caption className="pb-2 text-left text-muted">What the data says differs (2016–2025, modeled estimates)</caption>
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="py-1.5 pr-3 font-medium">Metric</th>
                  <th className="py-1.5 pr-3 font-medium">{a.profile.place.label}</th>
                  <th className="py-1.5 font-medium">{profileB.place.label}</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_METRICS.map((k) => {
                  const fa = formatMetric(a.profile.climate.metrics[k], units);
                  const fb = formatMetric(profileB.climate.metrics[k], units);
                  return (
                    <tr key={k} className="border-b border-line">
                      <td className="py-1.5 pr-3 text-muted">{a.profile.climate.metrics[k].label}</td>
                      <td className="py-1.5 pr-3 font-mono">
                        {fa.value} <span className="text-xs text-muted">{fa.unit}</span>
                      </td>
                      <td className="py-1.5 font-mono">
                        {fb.value} <span className="text-xs text-muted">{fb.unit}</span>
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td className="py-1.5 pr-3 text-muted">Climate type · plant zone</td>
                  <td className="py-1.5 pr-3 font-mono">
                    {a.profile.classes.koppen?.code} · ≈{a.profile.classes.hardinessZone?.label}
                  </td>
                  <td className="py-1.5 font-mono">
                    {profileB.classes.koppen?.code} · ≈{profileB.classes.hardinessZone?.label}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-sm">
            <span className="font-medium">{profileB.place.label} recommends:</span> {titles(picksB).join(", ") || "nothing with strong enough evidence for this photo"}.
            {sameSet && " The data supports the same changes here, so the app doesn't invent a difference."}
          </p>

          {gen.kind !== "running" && gen.kind !== "done" && picksB.length > 0 && (
            <button type="button" onClick={generateB} className="min-h-12 rounded-control bg-accent px-6 font-semibold text-accent-ink">
              Edit the same photo for {profileB.place.label}
            </button>
          )}
          {gen.kind === "running" && <PipelineStepper stages={gen.stages} elapsedSec={elapsed} />}
          {gen.kind === "error" && (
            <p role="alert" className="text-danger">
              {gen.message}
            </p>
          )}
        </div>
      )}

      {gen.kind === "done" && profileB && (
        <div className="grid gap-4 md:grid-cols-3">
          <Panel src={photo.dataUrl} label="Original photo" items={[]} />
          <Panel src={a.result.image} label={`Concept for ${a.profile.place.label}`} items={titles(picksA)} />
          <Panel src={gen.result.image} label={`Concept for ${profileB.place.label}`} items={titles(gen.result.plan.changes.map((c) => c.id))} />
        </div>
      )}
    </div>
  );
}
