"use client";

import { useState } from "react";

type Props = {
  before: string;
  after: string;
  width: number;
  height: number;
  afterAlt: string;
};

/** Same-photo comparison. A full-size native range input handles drag, touch, and arrow keys. */
export function BeforeAfterSlider({ before, after, width, height, afterAlt }: Props) {
  const [pos, setPos] = useState(50);
  return (
    <figure className="space-y-2">
      <div className="relative overflow-hidden rounded-md border border-line" style={{ aspectRatio: `${width} / ${height}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URLs */}
        <img src={after} alt={afterAlt} className="absolute inset-0 h-full w-full object-cover" />
        {/* eslint-disable-next-line @next/next/no-img-element -- data URLs */}
        <img
          src={before}
          alt="Original photo"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-y-0 w-0.5 bg-accent" style={{ left: `${pos}%` }}>
          <div className="absolute top-1/2 left-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-surface" />
        </div>
        <span className="pointer-events-none absolute top-2 left-2 rounded bg-ink/80 px-2 py-0.5 font-mono text-xs text-paper">Original</span>
        <span className="pointer-events-none absolute top-2 right-2 rounded bg-accent px-2 py-0.5 font-mono text-xs text-accent-ink">Concept</span>
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Compare original and concept"
          aria-valuetext={`${pos}% original shown`}
          className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        />
      </div>
      <figcaption className="text-xs text-muted">Drag or use arrow keys. AI concept image, not the actual property.</figcaption>
    </figure>
  );
}
