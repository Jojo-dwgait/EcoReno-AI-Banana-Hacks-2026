"use client";

import type { GenerateStage } from "@/lib/generateTypes";

const STEPS = [
  { key: "plan", label: "Building the edit plan from climate evidence + photo features" },
  { key: "edit", label: "Editing your photo (image model)" },
  { key: "review", label: "Independent fidelity review (vision model)" },
] as const;

export function PipelineStepper({ stages, elapsedSec }: { stages: GenerateStage[]; elapsedSec: number }) {
  const last = stages.at(-1);
  const currentKey = last?.stage === "retry" ? "edit" : (last?.stage ?? "plan");
  const attempt = [...stages].reverse().find((s) => s.stage === "edit") as { attempt: number } | undefined;
  const retry = stages.find((s) => s.stage === "retry") as { reason: string } | undefined;
  const currentIndex = STEPS.findIndex((s) => s.key === currentKey);

  return (
    <div aria-live="polite" className="space-y-3 rounded-md border border-line bg-surface p-4">
      <ol className="space-y-2">
        {STEPS.map((s, i) => {
          const state = i < currentIndex ? "done" : i === currentIndex ? "active" : "todo";
          return (
            <li key={s.key} className="flex items-center gap-3 text-sm">
              <span
                aria-hidden
                className={`flex h-6 w-6 items-center justify-center rounded-full border font-mono text-xs ${
                  state === "done" ? "border-ok text-ok" : state === "active" ? "border-accent text-accent" : "border-line text-muted"
                }`}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span className={state === "todo" ? "text-muted" : ""}>
                {s.label}
                {s.key !== "plan" && attempt && attempt.attempt > 1 && state !== "todo" ? " · attempt 2" : ""}
                {state === "active" ? "…" : ""}
              </span>
            </li>
          );
        })}
      </ol>
      {retry && <p className="text-sm text-warn">Retrying with a stricter prompt: {retry.reason}.</p>}
      <p className="font-mono text-xs text-muted">{elapsedSec}s elapsed · usually 20–60 s</p>
    </div>
  );
}
