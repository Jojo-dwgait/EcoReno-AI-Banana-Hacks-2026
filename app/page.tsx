"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CityPicker } from "@/components/CityPicker";
import { CompareView } from "@/components/CompareView";
import { ClimateEvidence } from "@/components/ClimateEvidence";
import { FeatureChips } from "@/components/FeatureChips";
import { PhotoInput } from "@/components/PhotoInput";
import { PipelineStepper } from "@/components/PipelineStepper";
import { RecommendationList } from "@/components/RecommendationList";
import { ResultView } from "@/components/ResultView";
import { ValuePanel } from "@/components/ValuePanel";
import type { PreparedPhoto } from "@/lib/clientImage";
import { MAX_CHANGES } from "@/lib/editPlan";
import { manualInventory, type FeatureInventory, type FeatureKey } from "@/lib/featureInventory";
import type { UnitSystem } from "@/lib/format";
import { readGenerateStream, type GenerateResult, type GenerateStage } from "@/lib/generateTypes";
import type { Place } from "@/lib/geocode";
import type { InterventionId } from "@/lib/interventions";
import { recommend, type Priority } from "@/lib/recommendationEngine";
import { loadSample, loadSampleResult, type LoadedSample } from "@/lib/samples";
import type { SiteProfile } from "@/lib/siteProfile";

type Async<T> = { kind: "idle" } | { kind: "loading" } | { kind: "ready"; value: T } | { kind: "error"; message: string };
type GenState =
  | { kind: "idle" }
  | { kind: "running"; stages: GenerateStage[]; startedAt: number }
  | { kind: "done"; result: GenerateResult }
  | { kind: "error"; message: string };

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t border-line pt-6">
      <h2 className="flex items-baseline gap-3 text-xl font-semibold">
        <span className="font-mono text-sm text-accent">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  const data = await res.json().catch(() => ({ ok: false, message: "Unexpected response from the server." }));
  if (!data.ok) throw new Error(data.message ?? "Request failed.");
  return data as T;
}

export default function Home() {
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [climate, setClimate] = useState<Async<SiteProfile>>({ kind: "idle" });
  const [analysis, setAnalysis] = useState<Async<FeatureInventory>>({ kind: "idle" });
  const [units, setUnits] = useState<UnitSystem>("us");
  const [confirmed, setConfirmed] = useState<Partial<Record<FeatureKey, boolean>>>({});
  const [priority, setPriority] = useState<Priority>("balanced");
  const [renterMode, setRenterMode] = useState(false);
  const [selectedOverride, setSelectedOverride] = useState<InterventionId[] | null>(null);
  const [gen, setGen] = useState<GenState>({ kind: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const [sample, setSample] = useState<LoadedSample | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [resultNote, setResultNote] = useState<string | null>(null);
  const climateReq = useRef<AbortController | null>(null);
  const analysisReq = useRef<AbortController | null>(null);

  const [manualFeatures, setManualFeatures] = useState(false);
  const profile = climate.kind === "ready" ? climate.value : null;
  const hasPhoto = photo !== null;
  const markedRoof = !!confirmed.roof;
  const inventory = useMemo<FeatureInventory | null>(() => {
    if (analysis.kind === "ready") return analysis.value;
    // Manual mode: a roof the user marks is assumed to face the camera (they can see it in their own photo).
    if (manualFeatures && hasPhoto) return { ...manualInventory(), roofFacesCamera: markedRoof };
    return null;
  }, [analysis, manualFeatures, hasPhoto, markedRoof]);

  const recs = useMemo(
    () => (profile && inventory ? recommend({ profile, inventory, priority, confirmed, renterMode }) : null),
    [profile, inventory, priority, confirmed, renterMode],
  );
  const selected = selectedOverride ?? recs?.filter((r) => r.preselected).map((r) => r.id) ?? [];

  useEffect(() => {
    if (gen.kind !== "running") return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - gen.startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [gen]);

  function resetDownstream() {
    setSelectedOverride(null);
    setGen({ kind: "idle" });
    setResultNote(null);
  }

  async function trySample() {
    setSampleError(null);
    try {
      const s = await loadSample();
      if (!s) {
        setSampleError("The sample house isn't available yet.");
        return;
      }
      analysisReq.current?.abort();
      setSample(s);
      setPhoto(s.photoData);
      setAnalysis({ kind: "ready", value: s.inventoryData });
      setConfirmed({});
      resetDownstream();
      if (s.featuredPlaces[0]) await selectPlace(s.featuredPlaces[0]);
    } catch {
      setSampleError("Couldn't load the sample house. Please try again.");
    }
  }

  async function choosePhoto(next: PreparedPhoto | null) {
    analysisReq.current?.abort();
    setSample(null);
    setPhoto(next);
    setConfirmed({});
    setManualFeatures(false);
    resetDownstream();
    if (!next) {
      setAnalysis({ kind: "idle" });
      return;
    }
    const controller = new AbortController();
    analysisReq.current = controller;
    setAnalysis({ kind: "loading" });
    try {
      const data = await postJson<{ inventory: FeatureInventory }>("/api/analyze-photo", { image: next.dataUrl }, controller.signal);
      setAnalysis({ kind: "ready", value: data.inventory });
    } catch (err) {
      if ((err as Error).name !== "AbortError") setAnalysis({ kind: "error", message: (err as Error).message });
    }
  }

  async function selectPlace(next: Place | null) {
    climateReq.current?.abort();
    setPlace(next);
    resetDownstream();
    if (!next) {
      setClimate({ kind: "idle" });
      return;
    }
    const controller = new AbortController();
    climateReq.current = controller;
    setClimate({ kind: "loading" });
    try {
      const data = await postJson<{ profile: SiteProfile }>("/api/climate", { place: next }, controller.signal);
      setClimate({ kind: "ready", value: data.profile });
    } catch (err) {
      if ((err as Error).name !== "AbortError") setClimate({ kind: "error", message: (err as Error).message });
    }
  }

  function toggle(id: InterventionId) {
    setSelectedOverride(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id].slice(0, MAX_CHANGES));
  }

  async function generate() {
    if (!photo || !place || !inventory || selected.length === 0) return;
    setResultNote(null);
    if (sample) {
      const saved = await loadSampleResult(sample, place.id, selected).catch(() => null);
      if (saved) {
        setGen({ kind: "done", result: saved });
        setResultNote(
          `Pre-generated with this same pipeline on ${new Date(saved.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} so it loads instantly. Change the city or the picks to run it live.`,
        );
        return;
      }
    }
    setElapsed(0);
    setGen({ kind: "running", stages: [], startedAt: Date.now() });
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: photo.dataUrl, place, selected, inventory, renterMode }),
      });
      const result = await readGenerateStream(res, (s) =>
        setGen((g) => (g.kind === "running" ? { ...g, stages: [...g.stages, s] } : g)),
      );
      setGen({ kind: "done", result });
    } catch (err) {
      setGen({ kind: "error", message: (err as Error).message });
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="font-mono text-xs tracking-widest text-muted uppercase">EcoReno AI · concept tool</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">See your house, redesigned for your climate.</h1>
        <p className="max-w-2xl text-muted">
          Upload a photo of a house, pick any U.S. city, and get climate-appropriate exterior upgrades edited into the same photo, with ten years of local
          climate evidence behind every change.
        </p>
      </header>

      <Step n="01" title="Your house">
        <PhotoInput
          photo={photo}
          onPhoto={choosePhoto}
          extraAction={
            <button type="button" onClick={trySample} className="min-h-11 rounded-control border border-line bg-surface px-4 text-sm font-medium">
              Try a sample house
            </button>
          }
          caption={
            <>
              {sample && (
                <p className="text-xs text-muted">
                  Sample photo by{" "}
                  <a href={sample.credit.url} className="underline" target="_blank" rel="noreferrer">
                    {sample.credit.name}
                  </a>{" "}
                  ({sample.credit.license}).
                </p>
              )}
              {sampleError && <p className="text-sm text-danger">{sampleError}</p>}
            </>
          }
        />
        {analysis.kind === "loading" && (
          <p aria-live="polite" className="text-sm text-muted">
            Checking what&apos;s visible in the photo…
          </p>
        )}
        {analysis.kind === "error" && (
          <div role="alert" className="space-y-2 text-sm">
            <p className="text-danger">Automatic photo analysis isn&apos;t available right now: {analysis.message}</p>
            {!manualFeatures && (
              <button type="button" onClick={() => setManualFeatures(true)} className="min-h-11 rounded-control border border-line bg-surface px-4 font-medium">
                Mark what&apos;s in my photo instead
              </button>
            )}
          </div>
        )}
        {inventory && <FeatureChips inventory={inventory} confirmed={confirmed} onConfirm={(k, v) => { setConfirmed((c) => ({ ...c, [k]: v })); setSelectedOverride(null); }} />}
      </Step>

      <Step n="02" title="Location">
        <CityPicker selected={place} onSelect={selectPlace} />
      </Step>

      {place && (
        <Step n="03" title="Climate evidence">
          {climate.kind === "loading" && (
            <p aria-live="polite" className="text-muted">
              Fetching 10 years of daily climate data for {place.name}…
            </p>
          )}
          {climate.kind === "error" && (
            <p role="alert" className="text-danger">
              {climate.message}
            </p>
          )}
          {profile && <ClimateEvidence profile={profile} units={units} onUnits={setUnits} />}
        </Step>
      )}

      {recs && profile && (
        <Step n="04" title="Recommended upgrades">
          <RecommendationList
            recs={recs}
            profile={profile}
            units={units}
            priority={priority}
            onPriority={(p) => {
              setPriority(p);
              setSelectedOverride(null);
            }}
            selected={selected}
            onToggle={toggle}
            max={MAX_CHANGES}
            renterMode={renterMode}
            onRenterMode={(v) => {
              setRenterMode(v);
              setSelectedOverride(null);
            }}
          />
        </Step>
      )}

      <Step n={recs ? "05" : "04"} title="Concept">
        {!recs && <p className="text-muted">Add a photo and choose a city to see recommendations.</p>}
        {recs && gen.kind !== "running" && (
          <button
            type="button"
            onClick={generate}
            disabled={selected.length === 0}
            className="min-h-12 rounded-control bg-accent px-6 font-semibold text-accent-ink disabled:opacity-50"
          >
            {gen.kind === "done" ? "Generate again" : `Edit my photo with ${selected.length} change${selected.length === 1 ? "" : "s"}`}
          </button>
        )}
        {gen.kind === "running" && <PipelineStepper stages={gen.stages} elapsedSec={elapsed} />}
        {gen.kind === "error" && (
          <p role="alert" className="text-danger">
            {gen.message}
          </p>
        )}
        {gen.kind === "done" && photo && profile && inventory && (
          <ResultView original={photo.dataUrl} result={gen.result} profile={profile} inventory={inventory} units={units} note={resultNote} />
        )}
      </Step>

      {gen.kind === "done" && place && inventory && (
        <Step n="06" title="What these upgrades may mean for value">
          <ValuePanel place={place} propertyType={inventory.propertyType} upgrades={gen.result.plan.changes.map((c) => c.id)} />
        </Step>
      )}

      {gen.kind === "done" && photo && profile && inventory && (
        <Step n="07" title="Compare another city">
          <CompareView photo={photo} inventory={inventory} confirmed={confirmed} priority={priority} units={units} a={{ profile, result: gen.result }} sample={sample} renterMode={renterMode} />
        </Step>
      )}
    </main>
  );
}
