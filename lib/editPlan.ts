import type { FeatureInventory } from "./featureInventory";
import { INTERVENTION_BY_ID, type InterventionId } from "./interventions";
import { BASE_FORBIDDEN, BASE_PRESERVE, type EditPlan } from "./renovationPrompt";
import type { SiteProfile } from "./siteProfile";

export const MAX_CHANGES = 3;

const DEFAULT_TARGET: Record<string, string> = {
  roof: "the roof plane facing the camera",
  lawn: "the front lawn",
  paving: "the existing driveway",
  windows: "the front-facing windows",
  downspout: "a downspout at a corner of the house",
  openYard: "open yard space away from the entry",
  wall: "a wall section beside open ground",
};

/** Vision-model text is untrusted: single line, capped, and quoted when placed in the prompt. */
export function sanitizeSceneText(s: string, max = 80): string {
  return s.replace(/[\r\n\t"`]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);
}

export function buildEditPlan(
  selected: InterventionId[],
  profile: SiteProfile,
  inventory: FeatureInventory,
  options: { renterMode?: boolean } = {},
): EditPlan {
  if (selected.length === 0 || selected.length > MAX_CHANGES) throw new Error(`Select between 1 and ${MAX_CHANGES} changes.`);
  const changes = selected.map((id) => {
    const iv = INTERVENTION_BY_ID[id];
    const variant = options.renterMode && iv.renterInstruction ? iv.renterInstruction : iv.instruction;
    const { instruction, styleDescriptors } = variant(profile);
    const note = sanitizeSceneText(inventory.features[iv.target].note);
    return {
      id,
      instruction,
      targetArea: note ? `"${note}"` : DEFAULT_TARGET[iv.target],
      styleDescriptors,
    };
  });

  const scene = inventory.scene;
  const sceneLines = [
    scene.lighting && `the lighting as photographed: "${sanitizeSceneText(scene.lighting)}"`,
    scene.weather && `the weather and sky as photographed: "${sanitizeSceneText(scene.weather)}"`,
    scene.season && `the season as photographed: "${sanitizeSceneText(scene.season)}"`,
    scene.condition && `the house's visible condition: "${sanitizeSceneText(scene.condition)}"`,
  ].filter((x): x is string => Boolean(x));

  const targetsPaving = selected.includes("permeable-pavers");
  const preserve = BASE_PRESERVE.filter((p) => !(targetsPaving && p.startsWith("the driveway"))).concat(sceneLines);
  if (targetsPaving) preserve.push("the walkway footprint and the driveway's exact outline (only its surface changes)");

  return {
    changes,
    preserve,
    forbidden: BASE_FORBIDDEN,
    climateBasis: [...new Set(selected.flatMap((id) => INTERVENTION_BY_ID[id].evidence))],
  };
}

/** Used by tests and logging: the climate place never leaks into the image prompt. */
export function placeTokens(profile: SiteProfile): string[] {
  return [profile.place.name, profile.place.state, profile.place.stateCode, profile.place.county ?? ""].filter((t) => t.length > 2);
}
