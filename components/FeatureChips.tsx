"use client";

import { FEATURE_KEYS, FEATURE_LABELS, isPresent, type FeatureInventory, type FeatureKey } from "@/lib/featureInventory";

type Props = {
  inventory: FeatureInventory;
  confirmed: Partial<Record<FeatureKey, boolean>>;
  onConfirm: (key: FeatureKey, present: boolean) => void;
};

/** Detections are tentative: the user can correct any of them before recommendations are scored. */
export function FeatureChips({ inventory, confirmed, onConfirm }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">
        Detected in your photo. These are the AI&apos;s best guesses, not an inspection. Tap to correct anything it got wrong.
      </p>
      <ul className="flex flex-wrap gap-2">
        {FEATURE_KEYS.map((k) => {
          const f = inventory.features[k];
          const present = isPresent(inventory, k, confirmed);
          const corrected = k in confirmed;
          return (
            <li key={k}>
              <button
                type="button"
                aria-pressed={present}
                onClick={() => onConfirm(k, !present)}
                title={f.note || undefined}
                className={`min-h-11 rounded-control border px-3 text-sm ${present ? "border-ink bg-ink text-paper" : "border-line bg-surface text-muted line-through"}`}
              >
                {FEATURE_LABELS[k]}
                <span className="ml-2 font-mono text-xs opacity-80">{corrected ? "you set" : `${Math.round(f.confidence * 100)}%`}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {inventory.uncertainties.length > 0 && (
        <p className="text-xs text-muted">Unsure about: {inventory.uncertainties.slice(0, 3).join("; ")}</p>
      )}
    </div>
  );
}
