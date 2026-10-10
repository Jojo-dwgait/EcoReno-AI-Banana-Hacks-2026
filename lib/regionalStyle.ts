import type { SiteProfile } from "./siteProfile";

/**
 * Regional adaptation table (PLAN.md §5.4): site-profile classes → concrete visual descriptors for the
 * image prompt. Inputs are profile numbers and classes only — never the city name.
 */
export type PlantingPalette = { key: string; summary: string; descriptors: string[] };

export function plantingPalette(p: SiteProfile): PlantingPalette {
  const aridity = p.classes.aridityClass;
  const zone = p.classes.hardinessZone?.zone ?? null;
  const koppenGroup = p.classes.koppen?.code ?? "";

  if ((aridity === "arid" || aridity === "hyper-arid") && zone !== null && zone >= 9) {
    return {
      key: "desert",
      summary: "desert-adapted planting with gravel ground cover",
      descriptors: ["desert-adapted succulents and agave-like rosettes", "decomposed-granite and gravel ground cover", "sparse, naturalistic spacing"],
    };
  }
  if (aridity === "arid" || aridity === "hyper-arid" || aridity === "semi-arid" || aridity === "dry sub-humid" || /^(Cs|B)/.test(koppenGroup)) {
    return {
      key: "dry-summer",
      summary: "drought-tolerant native shrubs and grasses with gravel mulch",
      descriptors: ["drought-tolerant native shrubs and ornamental grasses", "gravel mulch between plants", "a few low boulders"],
    };
  }
  if (zone !== null && zone <= 6) {
    return {
      key: "cold-humid",
      summary: "native prairie grasses and hardy perennials",
      descriptors: ["native prairie grasses and coneflower-type perennials", "shredded-bark mulch", "layered heights"],
    };
  }
  if (zone !== null && zone >= 9) {
    return {
      key: "warm-humid",
      summary: "lush native flowering shrubs and broadleaf plants",
      descriptors: ["lush native flowering shrubs and broadleaf plants", "mulched planting beds"],
    };
  }
  return {
    key: "temperate",
    summary: "mixed native perennials and grasses",
    descriptors: ["mixed native perennials and grasses", "bark mulch"],
  };
}

export function shadeTreeStyle(p: SiteProfile): { summary: string; descriptor: string } {
  const aridity = p.classes.aridityClass;
  if (aridity === "arid" || aridity === "hyper-arid") {
    return { summary: "drought-tolerant desert shade tree", descriptor: "a drought-tolerant desert shade tree with a light, airy canopy" };
  }
  if (p.classes.thermalDominance === "cooling") {
    return { summary: "broad-canopy shade tree", descriptor: "a broad-canopy shade tree" };
  }
  return {
    summary: "deciduous shade tree (bare in winter, so winter sun still reaches the house)",
    descriptor: "a deciduous shade tree with foliage matching the season shown in the photo",
  };
}
