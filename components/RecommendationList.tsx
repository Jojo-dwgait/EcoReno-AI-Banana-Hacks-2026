"use client";

import { formatMetric, type UnitSystem } from "@/lib/format";
import { INTERVENTION_BY_ID, type InterventionId } from "@/lib/interventions";
import { PRIORITY_LABELS, WEIGHTS, type Priority, type Recommendation } from "@/lib/recommendationEngine";
import type { SiteProfile } from "@/lib/siteProfile";

type Props = {
  recs: Recommendation[];
  profile: SiteProfile;
  units: UnitSystem;
  priority: Priority;
  onPriority: (p: Priority) => void;
  selected: InterventionId[];
  onToggle: (id: InterventionId) => void;
  max: number;
};

const CATEGORY_LABEL = { water: "Water", heat: "Heat", energy: "Energy", stormwater: "Stormwater" } as const;

function ScoreBar({ r }: { r: Recommendation }) {
  const parts = [
    { key: "climate", label: "climate evidence", w: WEIGHTS.climate, v: r.breakdown.climate },
    { key: "benefit", label: "benefit heuristic", w: WEIGHTS.benefit, v: r.breakdown.benefit },
    { key: "feasibility", label: "visible in photo", w: WEIGHTS.feasibility, v: r.breakdown.feasibility },
    { key: "preference", label: "your priority", w: WEIGHTS.preference, v: r.breakdown.preference },
  ];
  return (
    <details className="text-xs text-muted">
      <summary className="cursor-pointer">
        Score <span className="font-mono text-ink">{r.score.toFixed(0)}</span>/100. How it&apos;s calculated
      </summary>
      <ul className="mt-2 space-y-1">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2">
            <span className="w-32">{p.label}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded bg-line">
              <span className="block h-full bg-ink" style={{ width: `${p.v}%` }} />
            </span>
            <span className="w-24 text-right font-mono">
              {p.v.toFixed(0)} × {p.w.toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2">Weights are disclosed design heuristics, not scientific coefficients.</p>
    </details>
  );
}

export function RecommendationList({ recs, profile, units, priority, onPriority, selected, onToggle, max }: Props) {
  const available = recs.filter((r) => !r.blockedReason && !r.lowRelevance);
  const weak = recs.filter((r) => !r.blockedReason && r.lowRelevance);
  const blocked = recs.filter((r) => r.blockedReason);

  return (
    <div className="space-y-5">
      <div role="radiogroup" aria-label="Priority" className="flex flex-wrap gap-2">
        {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={priority === p}
            onClick={() => onPriority(p)}
            className={`min-h-11 rounded-md border px-4 text-sm ${priority === p ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface"}`}
          >
            {PRIORITY_LABELS[p]}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted">
        Pick up to {max}. Suggestions are ranked by this location&apos;s climate evidence and what&apos;s visible in your photo.
      </p>

      <ul className="space-y-3">
        {available.map((r) => {
          const iv = INTERVENTION_BY_ID[r.id];
          const isSelected = selected.includes(r.id);
          const disabled = !isSelected && selected.length >= max;
          return (
            <li key={r.id} className={`rounded-md border bg-surface p-4 ${isSelected ? "border-accent" : "border-line"}`}>
              <label className={`flex gap-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
                <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--accent)]" checked={isSelected} disabled={disabled} onChange={() => onToggle(r.id)} />
                <span className="flex-1 space-y-2">
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{iv.title}</span>
                    <span className="font-mono text-xs text-muted">
                      {CATEGORY_LABEL[iv.category]} · {r.score.toFixed(0)}
                    </span>
                  </span>
                  <span className="block text-sm">{iv.explain(profile, units)}</span>
                  <span className="flex flex-wrap gap-1.5">
                    {iv.evidence.map((k) => {
                      const f = formatMetric(profile.climate.metrics[k], units);
                      return (
                        <span key={k} className="rounded border border-line px-1.5 py-0.5 font-mono text-xs" title={profile.climate.metrics[k].definition}>
                          {profile.climate.metrics[k].label}: {f.value} {f.unit}
                        </span>
                      );
                    })}
                  </span>
                  <span className="block text-xs text-muted">
                    Where: {r.targetNote || "visible area of the photo"} · {iv.caveat}
                  </span>
                </span>
              </label>
              <div className="mt-2 pl-8">
                <ScoreBar r={r} />
              </div>
            </li>
          );
        })}
      </ul>

      {(weak.length > 0 || blocked.length > 0) && (
        <details className="rounded-md border border-line bg-surface p-4 text-sm">
          <summary className="cursor-pointer font-medium">
            Not suggested here ({weak.length + blocked.length}), and why
          </summary>
          <ul className="mt-3 space-y-2 text-muted">
            {blocked.map((r) => (
              <li key={r.id}>
                <span className="text-ink">{INTERVENTION_BY_ID[r.id].title}:</span> {r.blockedReason}
              </li>
            ))}
            {weak.map((r) => (
              <li key={r.id}>
                <span className="text-ink">{INTERVENTION_BY_ID[r.id].title}:</span> weak climate evidence here (climate score {r.breakdown.climate.toFixed(0)}/100).
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
