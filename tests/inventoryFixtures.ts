import { FEATURE_KEYS, type FeatureInventory, type FeatureKey } from "../lib/featureInventory";

/** A typical front-of-house photo: everything visible with good confidence. */
export function fullInventory(overrides: Partial<Record<FeatureKey, Partial<FeatureInventory["features"][FeatureKey]>>> = {}, roofFacesCamera = true): FeatureInventory {
  const notes: Record<FeatureKey, string> = {
    roof: "hip roof across the top of the frame",
    lawn: "front lawn, lower left",
    paving: "concrete driveway, lower right",
    windows: "two front windows left of the door",
    downspout: "downspout at the left corner",
    openYard: "open lawn area left of the walkway",
    wall: "front wall beside the lawn",
  };
  const features = Object.fromEntries(
    FEATURE_KEYS.map((k) => [k, { visible: true, confidence: 0.9, box: { x: 0.1, y: 0.5, w: 0.3, h: 0.3 }, note: notes[k], ...overrides[k] }]),
  ) as FeatureInventory["features"];
  return {
    isResidentialExterior: true,
    rejectionReason: null,
    propertyType: "single_family",
    stories: 1,
    roofFacesCamera,
    peopleVisible: false,
    features,
    scene: { lighting: "bright midday sun", weather: "clear blue sky", season: "summer", condition: "lived-in, slightly weathered paint" },
    uncertainties: [],
  };
}
