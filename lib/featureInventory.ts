import { z } from "zod";

export const FEATURE_KEYS = ["roof", "lawn", "paving", "windows", "downspout", "openYard", "wall"] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  roof: "Roof",
  lawn: "Lawn / turf grass",
  paving: "Driveway or paving",
  windows: "Windows",
  downspout: "Gutter downspout",
  openYard: "Open yard space",
  wall: "Exterior wall",
};

/** Normalized box: fractions of image width/height, origin top-left. */
export const BoxSchema = z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() });
export type Box = z.infer<typeof BoxSchema>;

const FeatureSchema = z.object({
  visible: z.boolean(),
  confidence: z.number().min(0).max(1),
  box: BoxSchema.nullable(),
  note: z.string(),
});
export type Feature = z.infer<typeof FeatureSchema>;

export const FeatureInventorySchema = z.object({
  isResidentialExterior: z.boolean(),
  rejectionReason: z.string().nullable(),
  propertyType: z.enum(["single_family", "townhouse", "multifamily", "mobile_home", "other", "unknown"]),
  stories: z.number().int().min(0).max(6).nullable(),
  roofFacesCamera: z.boolean(),
  peopleVisible: z.boolean(),
  features: z.object(Object.fromEntries(FEATURE_KEYS.map((k) => [k, FeatureSchema])) as Record<FeatureKey, typeof FeatureSchema>),
  scene: z.object({
    lighting: z.string(),
    weather: z.string(),
    season: z.string(),
    condition: z.string(),
  }),
  uncertainties: z.array(z.string()),
});
export type FeatureInventory = z.infer<typeof FeatureInventorySchema>;

/** A feature counts as present once the user confirms it, or when the model is reasonably confident. */
export function isPresent(inv: FeatureInventory, key: FeatureKey, confirmed?: Partial<Record<FeatureKey, boolean>>): boolean {
  if (confirmed && key in confirmed) return !!confirmed[key];
  const f = inv.features[key];
  return f.visible && f.confidence >= 0.5;
}
