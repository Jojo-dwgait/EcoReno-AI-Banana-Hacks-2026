"use client";

import { useEffect, useState } from "react";
import { PhotoInput } from "@/components/PhotoInput";
import type { PreparedPhoto } from "@/lib/clientImage";
import { listSamples, type SampleManifestEntry } from "@/lib/samples";
import type { PhotoCredit, SearchHit } from "@/lib/unsplash";

type Tab = "search" | "samples" | "upload";

type Props = {
  photo: PreparedPhoto | null;
  credit: PhotoCredit | null;
  onUpload: (photo: PreparedPhoto | null) => void;
  onPicked: (photo: PreparedPhoto, credit: PhotoCredit) => void;
  onSample: (entry: SampleManifestEntry) => void;
};

const TABS: { key: Tab; label: string }[] = [
  { key: "search", label: "Find a house photo" },
  { key: "samples", label: "Sample homes" },
  { key: "upload", label: "Upload your own" },
];

const SUGGESTIONS = ["brick ranch", "craftsman bungalow", "cape cod", "two story colonial", "desert home", "farmhouse"];

export function Credit({ credit }: { credit: PhotoCredit }) {
  return (
    <span>
      Photo by{" "}
      <a href={credit.url} target="_blank" rel="noreferrer" className="underline">
        {credit.name}
      </a>{" "}
      on{" "}
      <a href={credit.sourceUrl} target="_blank" rel="noreferrer" className="underline">
        {credit.source}
      </a>
    </span>
  );
}

function PhotoSearch({ onPicked, onUnavailable }: { onPicked: Props["onPicked"]; onUnavailable: (message: string) => void }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [status, setStatus] = useState<{ kind: "idle" | "searching" | "picking"; id?: string } | { kind: "error"; message: string }>({ kind: "idle" });

  async function search(q: string) {
    setQuery(q);
    setStatus({ kind: "searching" });
    try {
      const res = await fetch(`/api/photo-search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!data.ok) {
        setStatus({ kind: "error", message: data.message });
        if (data.code === "PHOTO_SEARCH_UNAVAILABLE") onUnavailable(data.message);
        return;
      }
      setHits(data.hits);
      setStatus({ kind: "idle" });
    } catch {
      setStatus({ kind: "error", message: "Photo search failed. Check your connection and try again." });
    }
  }

  async function pick(hit: SearchHit) {
    setStatus({ kind: "picking", id: hit.id });
    try {
      const res = await fetch("/api/photo-select", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: hit.id }) });
      const data = await res.json();
      if (!data.ok) {
        setStatus({ kind: "error", message: data.message });
        return;
      }
      onPicked(data.photo, data.credit);
      setStatus({ kind: "idle" });
    } catch {
      setStatus({ kind: "error", message: "Couldn't load that photo. Try another one." });
    }
  }

  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim().length >= 2) search(query.trim());
        }}
      >
        <label className="sr-only" htmlFor="house-search">
          Search real house photos
        </label>
        <input
          id="house-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try “brick ranch” or “craftsman bungalow”"
          className="min-h-11 min-w-0 flex-1 rounded-control border border-line bg-surface px-3"
        />
        <button type="submit" className="min-h-11 rounded-control bg-ink px-4 font-medium text-paper">
          Search
        </button>
      </form>
      <div className="flex flex-wrap gap-2 text-sm">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" onClick={() => search(s)} className="rounded-control border border-line bg-surface px-2.5 py-1">
            {s}
          </button>
        ))}
      </div>
      <div aria-live="polite" className="text-sm">
        {status.kind === "searching" && <span className="text-muted">Searching free-licensed photos on Unsplash…</span>}
        {status.kind === "picking" && <span className="text-muted">Loading the full photo…</span>}
        {status.kind === "error" && <span className="text-danger">{status.message}</span>}
      </div>
      {hits && hits.length === 0 && <p className="text-sm text-muted">No photos matched. Try a different style.</p>}
      {hits && hits.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {hits.map((h) => (
            <li key={h.id} className="space-y-1">
              <button
                type="button"
                onClick={() => pick(h)}
                disabled={status.kind === "picking"}
                className="block w-full overflow-hidden rounded-sheet border border-line"
                aria-label={`Use this photo: ${h.alt}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- hotlinked per Unsplash API guidelines */}
                <img src={h.thumb} alt={h.alt} className="aspect-[4/3] w-full object-cover" />
              </button>
              <p className="text-xs text-muted">
                <Credit credit={h.credit} />
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SampleGallery({ onSample }: { onSample: Props["onSample"] }) {
  const [samples, setSamples] = useState<SampleManifestEntry[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    listSamples()
      .then((s) => !cancelled && setSamples(s))
      .catch(() => !cancelled && setSamples([]));
    return () => {
      cancelled = true;
    };
  }, []);
  if (!samples) return <p className="text-sm text-muted">Loading sample homes…</p>;
  if (samples.length === 0) return <p className="text-sm text-muted">No sample homes are available.</p>;
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {samples.map((s) => (
        <li key={s.id} className="space-y-1">
          <button type="button" onClick={() => onSample(s)} className="block w-full overflow-hidden rounded-sheet border border-line text-left" aria-label={`Use sample home: ${s.title}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- static sample */}
            <img src={s.thumb} alt={s.title} className="aspect-[4/3] w-full object-cover" />
          </button>
          <p className="text-sm font-medium">
            {s.title}
            {Object.keys(s.results).length > 0 && <span className="ml-2 font-mono text-xs text-accent">instant result</span>}
          </p>
          <p className="text-xs text-muted">
            <Credit credit={s.credit} />
          </p>
        </li>
      ))}
    </ul>
  );
}

export function HouseSource({ photo, credit, onUpload, onPicked, onSample }: Props) {
  const [tab, setTab] = useState<Tab>("search");
  const [notice, setNotice] = useState<string | null>(null);

  // Open on the sample homes when this deployment has no photo-search key, instead of a search box that can't work.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/photo-search?status=1")
      .then((r) => r.json())
      .then((d) => !cancelled && d?.configured === false && setTab((t) => (t === "search" ? "samples" : t)))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Choose a house" className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => {
              setTab(t.key);
              setNotice(null);
            }}
            className={`-mb-px min-h-11 border-b-2 px-4 text-sm font-medium ${tab === t.key ? "border-accent text-ink" : "border-transparent text-muted"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="space-y-3">
        {notice && <p className="text-sm text-warn">{notice}</p>}
        {tab === "search" && (
          <PhotoSearch
            onPicked={onPicked}
            onUnavailable={(message) => {
              setTab("samples");
              setNotice(message);
            }}
          />
        )}
        {tab === "samples" && <SampleGallery onSample={onSample} />}
        {tab === "upload" && <PhotoInput photo={null} onPhoto={onUpload} />}
      </div>
      {photo && (
        <figure className="space-y-2 border-t border-line pt-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL */}
          <img src={photo.dataUrl} alt="The house you chose" className="w-full rounded-sheet border border-line" />
          <figcaption className="flex flex-wrap gap-x-3 font-mono text-xs text-muted">
            <span>
              {photo.width}×{photo.height} · {(photo.bytes / 1024).toFixed(0)} KB · location data removed
            </span>
            {credit && (
              <span className="font-sans">
                <Credit credit={credit} />
              </span>
            )}
          </figcaption>
        </figure>
      )}
    </div>
  );
}
