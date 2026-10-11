import type { MetricKey } from "./climateMetrics";
import type { FeatureKey } from "./featureInventory";
import { formatMetric, type UnitSystem } from "./format";
import { plantingPalette, shadeTreeStyle } from "./regionalStyle";
import type { SiteProfile } from "./siteProfile";

export type Category = "water" | "heat" | "energy" | "stormwater";
export type InterventionId =
  | "native-planting"
  | "rooftop-solar"
  | "cool-roof"
  | "shade-tree"
  | "shade-awnings"
  | "rain-garden"
  | "permeable-pavers"
  | "rain-barrels"
  | "windbreak";

export type GateContext = {
  profile: SiteProfile;
  has: (f: FeatureKey) => boolean;
  roofFacesCamera: boolean;
};

export type Intervention = {
  id: InterventionId;
  title: string;
  category: Category;
  /** Disclosed design heuristic (0–100), not a measured savings figure. */
  benefitProxy: number;
  renterFriendly: boolean;
  /** Feature whose box locates the change, and whose confidence drives feasibility. */
  target: FeatureKey;
  gate: (ctx: GateContext) => string | null;
  relevance: (p: SiteProfile) => number;
  evidence: MetricKey[];
  explain: (p: SiteProfile, units: UnitSystem) => string;
  instruction: (p: SiteProfile) => { instruction: string; styleDescriptors: string[] };
  caveat: string;
};

/** Linear ramp from lo → 0 to hi → 100, clamped. Breakpoints are disclosed heuristics tuned on recorded fixtures. */
export const ramp = (v: number | null, lo: number, hi: number) => (v === null ? 0 : Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100)));

const val = (p: SiteProfile, k: MetricKey) => p.climate.metrics[k].value;
const fmt = (p: SiteProfile, k: MetricKey, u: UnitSystem) => {
  const f = formatMetric(p.climate.metrics[k], u);
  return `${f.value} ${f.unit}`;
};
/** Just the number, for counts that read better in a sentence ("8 dry months a year"). */
const num = (p: SiteProfile, k: MetricKey) => formatMetric(p.climate.metrics[k], "us").value;
/** Gridded data under-counts coastal hot days (e.g. Miami), so heat relevance uses the stronger of hot days and cooling degree days. */
const heatSignal = (p: SiteProfile) => Math.max(ramp(val(p, "hotDays"), 10, 120), ramp(val(p, "coolingDegreeDaysF"), 500, 3000));

export const INTERVENTIONS: Intervention[] = [
  {
    id: "native-planting",
    title: "Replace lawn with regional native planting",
    category: "water",
    benefitProxy: 80,
    renterFriendly: false,
    target: "lawn",
    gate: ({ has }) => (has("lawn") ? null : "No lawn detected in the photo."),
    relevance: (p) => 0.7 * ramp(val(p, "waterDeficitMm"), 0, 800) + 0.3 * ramp(val(p, "dryMonths"), 0, 6),
    evidence: ["waterDeficitMm", "dryMonths", "annualPrecipMm", "annualEt0Mm"],
    explain: (p, u) =>
      `Plants here demand about ${fmt(p, "waterDeficitMm", u)} more water than falls as rain (evapotranspiration ${fmt(p, "annualEt0Mm", u)} vs. ${fmt(p, "annualPrecipMm", u)} of precipitation), and ${num(p, "dryMonths")} months a year are dry. Swapping thirsty turf for ${plantingPalette(p).summary} can reduce irrigation needs.`,
    instruction: (p) => ({
      instruction: "Replace the mowed lawn with planting beds, keeping the lawn's exact outline and edges.",
      styleDescriptors: [...plantingPalette(p).descriptors, "plants at realistic young-to-mature sizes"],
    }),
    caveat: "Irrigation savings depend on current watering habits and plant choice.",
  },
  {
    id: "rooftop-solar",
    title: "Rooftop solar panels",
    category: "energy",
    benefitProxy: 85,
    renterFriendly: false,
    target: "roof",
    gate: ({ has, roofFacesCamera }) => (!has("roof") ? "No roof visible in the photo." : !roofFacesCamera ? "No roof plane faces the camera, so panels can't be shown honestly." : null),
    relevance: (p) => ramp(val(p, "solarKwhM2Day"), 3.0, 5.5),
    evidence: ["solarKwhM2Day"],
    explain: (p, u) =>
      `The site averages ${fmt(p, "solarKwhM2Day", u)} of sunlight on a flat surface (${p.classes.solarBand ?? "unknown"} for the U.S.).`,
    instruction: () => ({
      instruction: "Add a tidy array of dark solar panels flush-mounted on the roof plane that faces the camera.",
      styleDescriptors: ["black-framed panels in neat rows", "setbacks from the roof edges and ridge"],
    }),
    caveat: "Illustrative only: real output depends on roof orientation, shading, and condition, which need a site assessment.",
  },
  {
    id: "cool-roof",
    title: "Cool (light, reflective) roof",
    category: "heat",
    benefitProxy: 60,
    renterFriendly: false,
    target: "roof",
    gate: ({ has, profile }) =>
      !has("roof") ? "No roof visible in the photo." : profile.classes.thermalDominance === "heating" ? "Heating-dominated climate: a reflective roof can raise winter heating needs." : null,
    relevance: (p) => ramp(val(p, "coolingDegreeDaysF"), 500, 3000),
    evidence: ["coolingDegreeDaysF", "hotDays"],
    explain: (p, u) =>
      `${fmt(p, "coolingDegreeDaysF", u)} of cooling demand and ${num(p, "hotDays")} days a year at 90 °F or hotter. A lighter, reflective roof absorbs less sun.`,
    instruction: () => ({
      instruction: "Change the roof covering to a lighter, sun-reflective color in the same roofing material and pattern.",
      styleDescriptors: ["light gray or off-white reflective finish", "same roof shape, pitch, and edges"],
    }),
    caveat: "Benefit depends on attic insulation and existing roof color.",
  },
  {
    id: "shade-tree",
    title: "Shade tree on the sunny side",
    category: "heat",
    benefitProxy: 70,
    renterFriendly: false,
    target: "openYard",
    gate: ({ has }) => (has("openYard") ? null : "No open yard space to plant a tree without blocking the entry."),
    relevance: heatSignal,
    evidence: ["hotDays", "coolingDegreeDaysF"],
    explain: (p, u) =>
      `${num(p, "hotDays")} days a year reach 90 °F, and the site logs ${fmt(p, "coolingDegreeDaysF", u)} of cooling demand. A ${shadeTreeStyle(p).summary} can shade walls and windows.`,
    instruction: (p) => ({
      instruction: "Plant one young shade tree in the open yard, offset from the entry and walkway so it never blocks the door.",
      styleDescriptors: [shadeTreeStyle(p).descriptor, "realistic size for a recently planted tree", "a mulch ring at its base"],
    }),
    caveat: "Placement relative to sun path and utilities needs a site check.",
  },
  {
    id: "shade-awnings",
    title: "Window awnings",
    category: "heat",
    benefitProxy: 55,
    renterFriendly: true,
    target: "windows",
    gate: ({ has }) => (has("windows") ? null : "No windows visible in the photo."),
    relevance: (p) => 0.6 * heatSignal(p) + 0.4 * ramp(val(p, "solarKwhM2Day"), 3.5, 5.5),
    evidence: ["hotDays", "solarKwhM2Day"],
    explain: (p, u) =>
      `Strong sun (${fmt(p, "solarKwhM2Day", u)}) and ${num(p, "hotDays")} days a year at 90 °F or hotter. Awnings block direct sun before it reaches the glass.`,
    instruction: () => ({
      instruction: "Add simple fabric awnings directly above the front-facing windows.",
      styleDescriptors: ["muted neutral fabric that matches the house colors", "modest projection"],
    }),
    caveat: "Most effective on windows facing the afternoon sun.",
  },
  {
    id: "rain-garden",
    title: "Rain garden for roof runoff",
    category: "stormwater",
    benefitProxy: 65,
    renterFriendly: false,
    target: "openYard",
    gate: ({ has }) => (has("openYard") || has("lawn") ? null : "No open ground to place a rain garden."),
    relevance: (p) => 0.7 * ramp(val(p, "heavyRainDays"), 2, 12) + 0.3 * ramp(val(p, "annualPrecipMm"), 300, 1300),
    evidence: ["heavyRainDays", "annualPrecipMm"],
    explain: (p, u) =>
      `${num(p, "heavyRainDays")} days a year bring 1 inch or more of rain, out of ${fmt(p, "annualPrecipMm", u)} in total. A rain garden gives roof runoff a place to soak in. This is rainfall context, not a flood-risk rating.`,
    instruction: () => ({
      instruction: "Add a small rain garden: a shallow planted depression in the yard that receives water from the nearest downspout.",
      styleDescriptors: ["moisture-tolerant native plants", "river rock where the water enters", "kept well away from the house foundation"],
    }),
    caveat: "Needs a soil infiltration check and a setback from the foundation.",
  },
  {
    id: "permeable-pavers",
    title: "Permeable pavers in the same driveway footprint",
    category: "stormwater",
    benefitProxy: 50,
    renterFriendly: false,
    target: "paving",
    gate: ({ has }) => (has("paving") ? null : "No driveway or paving visible in the photo."),
    relevance: (p) => ramp(val(p, "heavyRainDays"), 2, 12),
    evidence: ["heavyRainDays"],
    explain: (p) => `${num(p, "heavyRainDays")} days a year bring 1 inch or more of rain. Permeable pavers let some of that runoff soak in instead of running to the street.`,
    instruction: () => ({
      instruction: "Resurface the existing driveway with permeable interlocking pavers, keeping its exact footprint and edges.",
      styleDescriptors: ["gravel-filled joints", "a color close to the existing paving"],
    }),
    caveat: "Performance depends on the base layers and soil.",
  },
  {
    id: "rain-barrels",
    title: "Rain barrel at a downspout",
    category: "water",
    benefitProxy: 40,
    renterFriendly: true,
    target: "wall",
    gate: ({ has }) => (has("downspout") || has("wall") ? null : "No downspout or wall area visible for a barrel."),
    relevance: (p) => 0.5 * ramp(val(p, "dryMonths"), 1, 6) + 0.5 * ramp(val(p, "annualPrecipMm"), 200, 800),
    evidence: ["dryMonths", "annualPrecipMm"],
    explain: (p, u) => `${fmt(p, "annualPrecipMm", u)} of precipitation, and ${num(p, "dryMonths")} months a year are dry. A rain barrel stores roof runoff from wet periods for watering in dry ones.`,
    instruction: () => ({
      instruction: "Add one rain barrel connected to a downspout at a corner of the house.",
      styleDescriptors: ["dark green or brown barrel on a low stand", "neatly connected to the downspout"],
    }),
    caveat: "Small storage; check local rules on rainwater use.",
  },
  {
    id: "windbreak",
    title: "Evergreen windbreak",
    category: "energy",
    benefitProxy: 50,
    renterFriendly: false,
    target: "openYard",
    gate: ({ has, profile }) =>
      !has("openYard") ? "No open yard space along the side of the lot." : profile.classes.thermalDominance === "cooling" ? "Cooling-dominated climate: a winter windbreak adds little." : null,
    relevance: (p) => 0.6 * ramp(val(p, "heatingDegreeDaysF"), 2000, 8000) + 0.4 * ramp(val(p, "freezeDays"), 20, 150),
    evidence: ["heatingDegreeDaysF", "freezeDays"],
    explain: (p, u) =>
      `${fmt(p, "heatingDegreeDaysF", u)} of heating demand and ${num(p, "freezeDays")} freezing nights a year. An evergreen row on the windward side can cut winter wind against the house.`,
    instruction: () => ({
      instruction: "Add a row of young evergreen shrubs or small trees along the side edge of the yard, away from the entry and front windows.",
      styleDescriptors: ["dense evergreen foliage", "realistic young plant sizes"],
    }),
    caveat: "Works best on the side facing prevailing winter winds, which needs local knowledge.",
  },
];

export const INTERVENTION_BY_ID = Object.fromEntries(INTERVENTIONS.map((i) => [i.id, i])) as Record<InterventionId, Intervention>;

/** Pairs that edit the same surface; Balanced preselection never picks both. */
export const CONFLICTS: [InterventionId, InterventionId][] = [["rooftop-solar", "cool-roof"]];
