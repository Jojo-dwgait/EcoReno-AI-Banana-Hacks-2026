import { isPresent, type FeatureInventory, type FeatureKey, type Box } from "./featureInventory";
import { CONFLICTS, INTERVENTIONS, type Category, type InterventionId } from "./interventions";
import type { SiteProfile } from "./siteProfile";

export type Priority = "balanced" | "water" | "cool" | "rain";
export const PRIORITY_LABELS: Record<Priority, string> = {
  balanced: "Balanced",
  water: "Save water",
  cool: "Stay cool",
  rain: "Manage rain",
};
const PRIORITY_CATEGORY: Record<Exclude<Priority, "balanced">, Category> = { water: "water", cool: "heat", rain: "stormwater" };

export const WEIGHTS = { climate: 0.4, benefit: 0.3, feasibility: 0.2, preference: 0.1 } as const;
export const MIN_RELEVANCE = 35;
export const MIN_SCORE = 55;
const DIVERSITY_MARGIN = 15;
const MAX_PICKS = 3;

export type Recommendation = {
  id: InterventionId;
  category: Category;
  score: number;
  breakdown: { climate: number; benefit: number; feasibility: number; preference: number };
  blockedReason: string | null;
  lowRelevance: boolean;
  target: FeatureKey;
  targetBox: Box | null;
  targetNote: string;
  preselected: boolean;
};

export type EngineInput = {
  profile: SiteProfile;
  inventory: FeatureInventory;
  priority: Priority;
  confirmed?: Partial<Record<FeatureKey, boolean>>;
  renterMode?: boolean;
};

function preferenceFor(category: Category, priority: Priority): number {
  if (priority === "balanced") return 50;
  return PRIORITY_CATEGORY[priority] === category ? 100 : 30;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Deterministic: same profile + photo features + priority → same ranking. */
export function recommend({ profile, inventory, priority, confirmed, renterMode = false }: EngineInput): Recommendation[] {
  const has = (f: FeatureKey) => isPresent(inventory, f, confirmed);
  const ctx = { profile, has, roofFacesCamera: inventory.roofFacesCamera };

  const recs: Recommendation[] = INTERVENTIONS.map((iv) => {
    const blockedReason = renterMode && !iv.renterFriendly ? "Not a renter-friendly change." : iv.gate(ctx);
    const climate = round1(iv.relevance(profile));
    const target = inventory.features[iv.target];
    const feasibility = blockedReason ? 0 : confirmed?.[iv.target] ? 100 : round1(target.confidence * 100);
    const breakdown = { climate, benefit: iv.benefitProxy, feasibility, preference: preferenceFor(iv.category, priority) };
    const score = round1(
      WEIGHTS.climate * breakdown.climate + WEIGHTS.benefit * breakdown.benefit + WEIGHTS.feasibility * breakdown.feasibility + WEIGHTS.preference * breakdown.preference,
    );
    return {
      id: iv.id,
      category: iv.category,
      score: blockedReason ? 0 : score,
      breakdown,
      blockedReason,
      lowRelevance: climate < MIN_RELEVANCE,
      target: iv.target,
      targetBox: target.box,
      targetNote: target.note,
      preselected: false,
    };
  });

  recs.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  for (const id of selectDefaults(recs, priority)) {
    const r = recs.find((x) => x.id === id);
    if (r) r.preselected = true;
  }
  return recs;
}

const conflicts = (a: InterventionId, picked: InterventionId[]) =>
  CONFLICTS.some(([x, y]) => (x === a && picked.includes(y)) || (y === a && picked.includes(x)));

/**
 * Balanced: take the top item, then prefer an uncovered category only when it scores ≥ 55 and within 15 points
 * of the best redundant option — a mix when the evidence supports one, never forced diversity.
 * Focused priorities simply take the top eligible items.
 */
export function selectDefaults(ranked: Recommendation[], priority: Priority): InterventionId[] {
  const eligible = ranked.filter((r) => !r.blockedReason && !r.lowRelevance && r.score >= MIN_SCORE);
  const picked: Recommendation[] = [];
  while (picked.length < MAX_PICKS) {
    const remaining = eligible.filter((r) => !picked.includes(r) && !conflicts(r.id, picked.map((p) => p.id)));
    if (remaining.length === 0) break;
    if (priority !== "balanced" || picked.length === 0) {
      picked.push(remaining[0]);
      continue;
    }
    const covered = new Set(picked.map((p) => p.category));
    const bestAny = remaining[0];
    const bestNew = remaining.find((r) => !covered.has(r.category));
    picked.push(bestNew && bestNew.score >= bestAny.score - DIVERSITY_MARGIN ? bestNew : bestAny);
  }
  return picked.map((p) => p.id);
}
