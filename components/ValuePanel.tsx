"use client";

import { useEffect, useState } from "react";
import type { FeatureInventory } from "@/lib/featureInventory";
import type { Place } from "@/lib/geocode";
import { INTERVENTION_BY_ID, type InterventionId } from "@/lib/interventions";
import type { ValueEstimate } from "@/lib/valueTypes";

type Props = { place: Place; propertyType: FeatureInventory["propertyType"]; upgrades: InterventionId[] };
type State = { kind: "loading" } | { kind: "ready"; estimate: ValueEstimate } | { kind: "error"; message: string };

const DECADES = [1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];

export const usd = (v: number) =>
  v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(2)}M` : v >= 10_000 ? `$${Math.round(v / 1000).toLocaleString("en-US")}k` : `$${Math.round(v).toLocaleString("en-US")}`;

async function fetchEstimate(body: object): Promise<ValueEstimate> {
  const res = await fetch("/api/home-value", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!data?.ok) throw new Error(data?.message ?? "The value estimate isn't available right now.");
  return data.estimate as ValueEstimate;
}

function Figure({ label, p, sub }: { label: string; p: { low: number; mid: number; high: number } | null; sub: string }) {
  return (
    <div className="rounded-sheet border border-line bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-mono text-3xl">{p ? usd(p.mid) : "—"}</p>
      <p className="mt-1 font-mono text-xs text-muted">{p ? `80% range ${usd(p.low)}–${usd(p.high)}` : sub}</p>
    </div>
  );
}

export function ValuePanel({ place, propertyType, upgrades }: Props) {
  const [bedrooms, setBedrooms] = useState<number | null>(null);
  const [decade, setDecade] = useState<number | null>(null);
  const [state, setState] = useState<State>({ kind: "loading" });

  async function run(beds: number | null, dec: number | null) {
    setState({ kind: "loading" });
    try {
      setState({ kind: "ready", estimate: await fetchEstimate({ place, propertyType, bedrooms: beds, builtDecade: dec, upgrades }) });
    } catch (err) {
      setState({ kind: "error", message: (err as Error).message });
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchEstimate({ place, propertyType, bedrooms: null, builtDecade: null, upgrades })
      .then((estimate) => !cancelled && setState({ kind: "ready", estimate }))
      .catch((err: Error) => !cancelled && setState({ kind: "error", message: err.message }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when the place or upgrade set changes
  }, [place.id, upgrades.join(",")]);

  const e = state.kind === "ready" ? state.estimate : null;
  const directCount = e?.upgrades.filter((u) => u.mid !== null).length ?? 0;

  return (
    <div className="space-y-5">
      <form
        className="flex flex-wrap items-end gap-3 text-sm"
        onSubmit={(ev) => {
          ev.preventDefault();
          run(bedrooms, decade);
        }}
      >
        <label className="space-y-1">
          <span className="block text-muted">Bedrooms</span>
          <select className="min-h-11 rounded-control border border-line bg-surface px-3" value={bedrooms ?? ""} onChange={(ev) => setBedrooms(ev.target.value ? Number(ev.target.value) : null)}>
            <option value="">Typical for the area{e ? ` (${e.home.assumed.bedrooms ? e.home.bedrooms : "…"})` : ""}</option>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
                {n === 6 ? "+" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-muted">Built in</span>
          <select className="min-h-11 rounded-control border border-line bg-surface px-3" value={decade ?? ""} onChange={(ev) => setDecade(ev.target.value ? Number(ev.target.value) : null)}>
            <option value="">Typical for the area</option>
            {DECADES.map((d) => (
              <option key={d} value={d}>
                {d === 1930 ? "1930s or earlier" : `${d}s`}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="min-h-11 rounded-control border border-line bg-surface px-4 font-medium">
          Update estimate
        </button>
        <span className="text-xs text-muted">
          Home type from your photo: {propertyType === "townhouse" ? "attached (townhouse)" : "detached house"}
          {e?.home.assumed.kind ? " (assumed)" : ""}
        </span>
      </form>

      {state.kind === "loading" && (
        <p aria-live="polite" className="text-muted">
          Training the value model on U.S. Census records for this area…
        </p>
      )}
      {state.kind === "error" && (
        <p role="alert" className="text-danger">
          {state.message}
        </p>
      )}

      {e && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <Figure label={`Estimated value now (${e.dataset.dollars} dollars)`} p={e.prediction} sub="Not enough records to fit the model here" />
            <Figure
              label="With these upgrades"
              p={e.withUpgrades}
              sub={directCount === 0 ? "No selected upgrade has direct sale-price evidence, so no change is estimated" : "—"}
            />
          </div>

          <dl className="grid gap-x-4 gap-y-2 text-sm md:grid-cols-[12rem_1fr]">
            {e.comparables && (
              <>
                <dt className="text-muted">Homes like this</dt>
                <dd>
                  {e.comparables.count} {e.comparables.definition} in the Census sample for {e.area.pumaName}: median{" "}
                  <span className="font-mono">{usd(e.comparables.median)}</span>, middle half{" "}
                  <span className="font-mono">
                    {usd(e.comparables.p25)}–{usd(e.comparables.p75)}
                  </span>
                  .
                </dd>
              </>
            )}
            {e.official && (
              <>
                <dt className="text-muted">Official median</dt>
                <dd>
                  {e.official.geography}: <span className="font-mono">{usd(e.official.value)}</span>
                  {e.official.marginOfError ? <span className="font-mono text-muted"> ±{usd(e.official.marginOfError)}</span> : null} ·{" "}
                  <a href={e.official.url} target="_blank" rel="noreferrer" className="underline">
                    {e.official.table}
                  </a>
                </dd>
              </>
            )}
          </dl>

          <ul className="space-y-2">
            {e.upgrades.map((u) => {
              const title = INTERVENTION_BY_ID[u.id].title;
              const ev = u.evidence;
              return (
                <li key={u.id} className="rounded-sheet border border-line bg-surface p-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{title}</span>
                    <span className={`font-mono text-xs ${ev.tier === "direct" ? "text-ok" : "text-muted"}`}>
                      {ev.tier === "direct" && u.low !== null && u.high !== null
                        ? `included: +${usd(u.low)}–${usd(u.high)}`
                        : ev.tier === "related"
                          ? "related evidence, not added"
                          : "no published estimate"}
                    </span>
                  </div>
                  <p className="mt-1 text-muted">{ev.note}</p>
                  {ev.tier !== "none" && (
                    <p className="mt-1 text-xs">
                      Source:{" "}
                      <a href={ev.source.url} target="_blank" rel="noreferrer" className="underline">
                        {ev.source.label}
                      </a>
                      , {ev.source.org}, {ev.source.year}. {ev.source.sample}.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          {e.model && (
            <details className="rounded-sheet border border-line bg-surface p-4 text-sm">
              <summary className="cursor-pointer font-medium">How the value model works</summary>
              <p className="mt-2 text-muted">
                A weighted regression of ln(home value) trained on {e.model.n.toLocaleString("en-US")} owner-occupied one-family homes in the{" "}
                <a href={e.dataset.url} target="_blank" rel="noreferrer" className="underline">
                  {e.dataset.name}
                </a>{" "}
                ({e.dataset.org}) for {e.area.pumaName}, using the Census survey weights. It explains {(e.model.r2 * 100).toFixed(0)}% of the variation in value (R²);
                a typical home differs from its prediction by about ±{((Math.exp(e.model.residualSd) - 1) * 100).toFixed(0)}%.
              </p>
              <table className="mt-3 w-full max-w-md text-xs">
                <thead>
                  <tr className="border-b border-line text-left text-muted">
                    <th className="py-1 font-normal">Term</th>
                    <th className="py-1 font-normal">Coefficient</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {e.model.coefficients.map((c) => (
                    <tr key={c.name} className="border-b border-line">
                      <td className="py-1">{c.name}</td>
                      <td className="py-1">{c.value.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}

          <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
            {e.caveats.map((c) => (
              <li key={c}>{c}</li>
            ))}
            {(e.home.assumed.bedrooms || e.home.assumed.builtYear) && <li>Bedrooms and build year default to this area&apos;s typical home until you set them.</li>}
          </ul>
        </>
      )}
    </div>
  );
}
