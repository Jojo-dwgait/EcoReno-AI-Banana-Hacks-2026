"use client";

import { useEffect, useState } from "react";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import { browserChangeMap } from "@/lib/clientChangeMap";
import type { FeatureInventory } from "@/lib/featureInventory";
import { formatMetric, type UnitSystem } from "@/lib/format";
import type { GenerateResult } from "@/lib/generateTypes";
import { INTERVENTION_BY_ID } from "@/lib/interventions";
import type { SiteProfile } from "@/lib/siteProfile";

type Props = {
  original: string;
  result: GenerateResult;
  profile: SiteProfile;
  inventory: FeatureInventory;
  units: UnitSystem;
};

type MapState = { overlay: string; changedFraction: number; protectedDrift: number | null } | null;

const STATUS = {
  visible: { mark: "✓", text: "Visible in the concept", cls: "text-ok" },
  partial: { mark: "◐", text: "Partly visible", cls: "text-warn" },
  missing: { mark: "✗", text: "Not visible", cls: "text-danger" },
} as const;

const pct = (x: number) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;

async function downloadWatermarked(src: string, filename: string) {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const label = "AI concept · not the actual property · EcoReno AI";
  const size = Math.max(14, Math.round(c.width / 60));
  ctx.font = `600 ${size}px ui-monospace, monospace`;
  const pad = size * 0.6;
  const w = ctx.measureText(label).width + pad * 2;
  ctx.fillStyle = "rgba(27,29,26,0.75)";
  ctx.fillRect(c.width - w - pad, c.height - size * 2 - pad, w, size * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(label, c.width - w, c.height - size * 0.75 - pad);
  const a = document.createElement("a");
  a.href = c.toDataURL("image/jpeg", 0.9);
  a.download = filename;
  a.click();
}

export function ResultView({ original, result, profile, inventory, units }: Props) {
  const [showMap, setShowMap] = useState(false);
  const [map, setMap] = useState<MapState>(null);
  const [active, setActive] = useState<string | null>(null);
  const changes = result.plan.changes;
  const targets = changes
    .map((c) => inventory.features[INTERVENTION_BY_ID[c.id].target].box)
    .filter((b): b is NonNullable<typeof b> => b !== null);

  useEffect(() => {
    let cancelled = false;
    browserChangeMap(original, result.image, targets)
      .then((m) => !cancelled && setMap({ overlay: m.overlay, changedFraction: m.changedFraction, protectedDrift: m.protectedDrift }))
      .catch(() => !cancelled && setMap(null));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute only when the images change
  }, [original, result.image]);

  const review = result.review;
  const statusFor = (id: string) => review?.perChange.find((c) => c.id === id);
  const verdictText =
    result.verdict === "pass"
      ? "Independent review passed: every requested change is visible and the house's structure was preserved."
      : review
        ? `Independent review found issues (listed below). This is the better of ${result.attempts.length} attempt${result.attempts.length > 1 ? "s" : ""}.`
        : "The automatic review was unavailable for this edit, so check the comparison yourself.";

  const pins = changes.map((c, i) => {
    const box = inventory.features[INTERVENTION_BY_ID[c.id].target].box;
    if (!box) return null;
    return (
      <a
        key={c.id}
        href={`#change-${c.id}`}
        onMouseEnter={() => setActive(c.id)}
        onMouseLeave={() => setActive(null)}
        onFocus={() => setActive(c.id)}
        onBlur={() => setActive(null)}
        aria-label={`Change ${i + 1}: ${INTERVENTION_BY_ID[c.id].title}`}
        className={`pointer-events-auto absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 font-mono text-sm font-semibold shadow ${
          active === c.id ? "border-paper bg-ink text-paper" : "border-surface bg-accent text-accent-ink"
        }`}
        style={{ left: `${(box.x + box.w / 2) * 100}%`, top: `${(box.y + box.h / 2) * 100}%` }}
      >
        {i + 1}
      </a>
    );
  });

  return (
    <div className="space-y-6">
      <BeforeAfterSlider
        before={original}
        after={result.image}
        width={result.width}
        height={result.height}
        afterAlt={review?.altText ?? `Concept edit of the photo with ${changes.map((c) => INTERVENTION_BY_ID[c.id].title.toLowerCase()).join(", ")}`}
        underlay={showMap && map ? (
          // eslint-disable-next-line @next/next/no-img-element -- generated overlay
          <img src={map.overlay} alt="" className="h-full w-full object-cover" />
        ) : null}
        pins={<>{pins}</>}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" aria-pressed={showMap} onClick={() => setShowMap((v) => !v)} className="min-h-11 rounded-md border border-line bg-surface px-4 text-sm font-medium" disabled={!map}>
          {showMap ? "Hide change map" : "Show change map"}
        </button>
        <button
          type="button"
          onClick={() => downloadWatermarked(result.image, `ecoreno-concept-${profile.place.name.toLowerCase().replace(/\W+/g, "-")}.jpg`)}
          className="min-h-11 rounded-md border border-line bg-surface px-4 text-sm font-medium"
        >
          Download concept (watermarked)
        </button>
        {map && (
          <span className="font-mono text-xs text-muted">
            Pixel check (no AI): {pct(map.changedFraction)} of the photo changed
            {map.protectedDrift !== null ? ` · ${pct(map.protectedDrift)} of areas outside the targets` : ""}
          </span>
        )}
      </div>

      <p className={`rounded-md border p-3 text-sm ${result.verdict === "pass" ? "border-ok text-ok" : "border-warn text-warn"}`}>{verdictText}</p>

      <ol className="space-y-3">
        {changes.map((c, i) => {
          const iv = INTERVENTION_BY_ID[c.id];
          const st = statusFor(c.id);
          return (
            <li
              key={c.id}
              id={`change-${c.id}`}
              onMouseEnter={() => setActive(c.id)}
              onMouseLeave={() => setActive(null)}
              className={`scroll-mt-4 rounded-md border bg-surface p-4 ${active === c.id ? "border-accent" : "border-line"}`}
            >
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-mono text-sm text-accent">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="font-semibold">{iv.title}</h3>
                {st && (
                  <span className={`text-sm ${STATUS[st.status].cls}`}>
                    {STATUS[st.status].mark} {STATUS[st.status].text}
                  </span>
                )}
              </div>
              <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[8rem_1fr]">
                <dt className="text-muted">What changed</dt>
                <dd>
                  {c.instruction} {c.styleDescriptors.length > 0 && <span className="text-muted">({c.styleDescriptors.join("; ")})</span>}
                </dd>
                <dt className="text-muted">Where</dt>
                <dd>{c.targetArea.replace(/^"|"$/g, "")}</dd>
                <dt className="text-muted">Why here</dt>
                <dd>{iv.explain(profile, units)}</dd>
                <dt className="text-muted">Evidence</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {iv.evidence.map((k) => {
                    const f = formatMetric(profile.climate.metrics[k], units);
                    return (
                      <span key={k} className="rounded border border-line px-1.5 py-0.5 font-mono text-xs">
                        {profile.climate.metrics[k].label}: {f.value} {f.unit}
                      </span>
                    );
                  })}
                  <span className="text-xs text-muted">2016–2025 · Open-Meteo reanalysis</span>
                </dd>
                <dt className="text-muted">Keep in mind</dt>
                <dd className="text-muted">{iv.caveat}</dd>
                {st?.note && (
                  <>
                    <dt className="text-muted">Reviewer note</dt>
                    <dd className="text-muted">{st.note}</dd>
                  </>
                )}
              </dl>
            </li>
          );
        })}
      </ol>

      {review && (
        <details className="rounded-md border border-line bg-surface p-4 text-sm">
          <summary className="cursor-pointer font-medium">
            Preservation check: {review.perPreserve.filter((p) => p.kept).length}/{review.perPreserve.length} kept
            {review.unrequestedChanges.length > 0 ? ` · ${review.unrequestedChanges.length} unrequested change(s)` : ""}
          </summary>
          <ul className="mt-3 space-y-1">
            {review.perPreserve.map((p) => (
              <li key={p.item} className={p.kept ? "" : "text-danger"}>
                {p.kept ? "✓" : "✗"} {p.item}
                {!p.kept && p.note ? `: ${p.note}` : ""}
              </li>
            ))}
          </ul>
          {review.unrequestedChanges.length > 0 && (
            <>
              <p className="mt-3 font-medium text-warn">Unrequested changes the reviewer spotted</p>
              <ul className="list-disc pl-5 text-warn">
                {review.unrequestedChanges.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </>
          )}
        </details>
      )}

      <details className="rounded-md border border-line bg-surface p-4 text-sm">
        <summary className="cursor-pointer font-medium">How this image was made</summary>
        <ul className="mt-3 space-y-1 font-mono text-xs">
          <li>Image model: {result.models.edit}</li>
          <li>Review model: {result.models.review ?? "unavailable"}</li>
          {result.attempts.map((a) => (
            <li key={a.attempt}>
              Attempt {a.attempt}: edit {(a.editMs / 1000).toFixed(1)}s{a.reviewMs !== null ? `, review ${(a.reviewMs / 1000).toFixed(1)}s` : ""} → {a.verdict}
              {a.aspectMismatch > 0.02 ? ` (output reframed ${pct(a.aspectMismatch)} to match the original)` : ""}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-muted">The exact instructions sent to the image model (no climate numbers or city names, so the model can&apos;t fall back on stereotypes):</p>
        <pre className="mt-2 max-h-72 overflow-auto rounded bg-paper p-3 text-xs whitespace-pre-wrap">{result.prompt}</pre>
      </details>

      <p className="text-xs text-muted">
        A concept visualization from AI models, not a site survey, construction plan, permit check, or appraisal. Climate values are modeled estimates for the
        city&apos;s grid cell, not measurements at this house.
      </p>
    </div>
  );
}
