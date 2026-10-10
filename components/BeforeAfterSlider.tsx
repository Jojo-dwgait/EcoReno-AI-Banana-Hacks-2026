"use client";

import { useState, type ReactNode } from "react";

type Props = {
  before: string;
  after: string;
  width: number;
  height: number;
  afterAlt: string;
  /** Non-interactive layer drawn over the concept image (e.g. the change map). */
  underlay?: ReactNode;
  /** Interactive layer above the drag surface (e.g. numbered pins). */
  pins?: ReactNode;
};

/** Same-photo comparison. A full-size native range input handles drag, touch, and arrow keys. */
export function BeforeAfterSlider({ before, after, width, height, afterAlt, underlay, pins }: Props) {
  const [pos, setPos] = useState(50);
  return (
    <figure className="space-y-2">
      <div className="relative overflow-hidden rounded-sheet border border-line" style={{ aspectRatio: `${width} / ${height}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URLs */}
        <img src={after} alt={afterAlt} className="absolute inset-0 h-full w-full object-cover" />
        {underlay && <div className="pointer-events-none absolute inset-0">{underlay}</div>}
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
        <span className="pointer-events-none absolute top-2 left-2 rounded-control bg-ink/80 px-2 py-0.5 font-mono text-xs text-paper">Original</span>
        <span className="pointer-events-none absolute top-2 right-2 rounded-control bg-accent px-2 py-0.5 font-mono text-xs text-accent-ink">Concept</span>
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Compare original and concept"
          aria-valuetext={`${pos}% original shown`}
          className="absolute inset-0 z-10 h-full w-full cursor-ew-resize opacity-0"
        />
        {pins && <div className="pointer-events-none absolute inset-0 z-20">{pins}</div>}
      </div>
      <figcaption className="text-xs text-muted">Drag or use arrow keys to compare. AI concept image, not the actual property.</figcaption>
    </figure>
  );
}
