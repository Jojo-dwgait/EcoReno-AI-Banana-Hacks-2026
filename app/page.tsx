"use client";

import { useRef, useState } from "react";
import { CityPicker } from "@/components/CityPicker";
import { ClimateEvidence } from "@/components/ClimateEvidence";
import { PhotoInput } from "@/components/PhotoInput";
import type { PreparedPhoto } from "@/lib/clientImage";
import type { UnitSystem } from "@/lib/format";
import type { Place } from "@/lib/geocode";
import type { SiteProfile } from "@/lib/siteProfile";

type ClimateState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; profile: SiteProfile }
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

export default function Home() {
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [climate, setClimate] = useState<ClimateState>({ kind: "idle" });
  const [units, setUnits] = useState<UnitSystem>("us");

  const climateRequest = useRef<AbortController | null>(null);

  async function selectPlace(next: Place | null) {
    climateRequest.current?.abort();
    setPlace(next);
    if (!next) {
      setClimate({ kind: "idle" });
      return;
    }
    const controller = new AbortController();
    climateRequest.current = controller;
    setClimate({ kind: "loading" });
    try {
      const res = await fetch("/api/climate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ place: next }),
        signal: controller.signal,
      });
      const data = await res.json();
      setClimate(data.ok ? { kind: "ready", profile: data.profile } : { kind: "error", message: data.message });
    } catch (err) {
      if ((err as Error).name !== "AbortError") setClimate({ kind: "error", message: "Couldn't load climate data. Please try again." });
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="font-mono text-xs tracking-widest text-muted uppercase">EcoReno AI · concept tool</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">See your house, redesigned for your climate.</h1>
        <p className="max-w-2xl text-muted">
          Upload a photo of a house, pick any U.S. city, and get climate-appropriate exterior upgrades edited into the same
          photo, with ten years of local climate evidence behind every change.
        </p>
      </header>

      <Step n="01" title="Your house">
        <PhotoInput photo={photo} onPhoto={setPhoto} />
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
          {climate.kind === "ready" && <ClimateEvidence profile={climate.profile} units={units} onUnits={setUnits} />}
        </Step>
      )}

      <Step n="04" title="Concept">
        <p className="text-muted">
          {photo && climate.kind === "ready"
            ? "Image editing is being connected. Recommendations and the edited photo appear here."
            : "Add a photo and choose a city to continue."}
        </p>
      </Step>
    </main>
  );
}
