"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Place } from "@/lib/geocode";

type Props = {
  selected: Place | null;
  onSelect: (place: Place | null) => void;
};

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "results"; places: Place[] }
  | { kind: "error"; message: string };

export function CityPicker({ selected, onSelect }: Props) {
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const [active, setActive] = useState(0);
  const controller = useRef<AbortController | null>(null);

  const trimmed = query.trim();
  const current: SearchState = trimmed.length < 2 ? { kind: "idle" } : state;

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = setTimeout(async () => {
      controller.current?.abort();
      controller.current = new AbortController();
      setState({ kind: "loading" });
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: controller.current.signal });
        const data = await res.json();
        if (data.ok) {
          setState({ kind: "results", places: data.places });
          setActive(0);
        } else {
          setState({ kind: "error", message: data.message });
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") setState({ kind: "error", message: "City search failed. Check your connection and try again." });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  function choose(place: Place) {
    onSelect(place);
    setQuery("");
    setState({ kind: "idle" });
  }

  if (selected) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface p-4">
        <div>
          <p className="font-medium">
            {selected.name}, {selected.state}
          </p>
          <p className="font-mono text-xs text-muted">
            {selected.county ? `${selected.county} County · ` : ""}
            {selected.lat.toFixed(3)}, {selected.lon.toFixed(3)} · {selected.timezone}
          </p>
        </div>
        <button type="button" onClick={() => onSelect(null)} className="min-h-11 rounded-md border border-line px-4 text-sm font-medium">
          Change city
        </button>
      </div>
    );
  }

  const places = current.kind === "results" ? current.places : [];
  return (
    <div className="space-y-2">
      <label htmlFor={inputId} className="block text-sm font-medium">
        City (any U.S. city; add the state to narrow it, e.g. “Springfield, IL”)
      </label>
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={places.length > 0}
        aria-controls={listId}
        aria-activedescendant={places.length > 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (places.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, places.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            choose(places[active]);
          }
        }}
        placeholder="Start typing a city…"
        className="min-h-11 w-full rounded-md border border-line bg-surface px-3"
      />
      <div aria-live="polite" className="text-sm text-muted">
        {current.kind === "loading" && "Searching…"}
        {current.kind === "error" && <span className="text-danger">{current.message}</span>}
        {current.kind === "results" && `${places.length} U.S. match${places.length === 1 ? "" : "es"}. Pick the right one.`}
      </div>
      {places.length > 0 && (
        <ul id={listId} role="listbox" className="divide-y divide-line overflow-hidden rounded-md border border-line bg-surface">
          {places.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(p)}
              className={`cursor-pointer px-3 py-2 ${i === active ? "bg-paper" : ""}`}
            >
              <span className="font-medium">
                {p.name}, {p.state}
              </span>
              <span className="ml-2 font-mono text-xs text-muted">
                {p.county ? `${p.county} County` : ""}
                {p.population ? ` · pop. ${p.population.toLocaleString("en-US")}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
