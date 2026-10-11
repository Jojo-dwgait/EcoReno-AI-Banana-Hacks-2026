import type { InterventionId } from "./interventions";

/** Official next-step resources per upgrade (all URLs checked Oct 10, 2026). */
export type NextStep = { label: string; url: string } | { label: string; url?: undefined };

const DOE_LANDSCAPING = { label: "DOE Energy Saver: landscaping for shade and wind (PDF)", url: "https://www.energy.gov/sites/default/files/2021-08/ES-Landscaping_081721.pdf" };
const EPA_TREES = { label: "EPA: trees and vegetation for cooler neighborhoods", url: "https://www.epa.gov/heatislands/using-trees-and-vegetation-reduce-heat-islands" };

const STEPS: Record<InterventionId, NextStep[]> = {
  "native-planting": [
    { label: "EPA WaterSense: what to plant", url: "https://www.epa.gov/watersense/what-plant" },
    { label: "EPA WaterSense: outdoor water use", url: "https://www.epa.gov/watersense/outdoors" },
    { label: "Ask your water utility about turf-replacement rebates" },
  ],
  "rooftop-solar": [{ label: "DOE: Homeowner's Guide to Going Solar", url: "https://www.energy.gov/eere/solar/homeowners-guide-going-solar" }],
  "cool-roof": [
    { label: "EPA: using cool roofs", url: "https://www.epa.gov/heatislands/using-cool-roofs-reduce-heat-islands" },
    { label: "Cool Roof Rating Council product directory", url: "https://coolroofs.org/" },
  ],
  "shade-tree": [DOE_LANDSCAPING, EPA_TREES],
  "shade-awnings": [],
  "rain-garden": [{ label: "EPA Soak Up the Rain: rain gardens", url: "https://www.epa.gov/soakuptherain/soak-rain-rain-gardens" }],
  "permeable-pavers": [{ label: "EPA Soak Up the Rain: permeable pavement", url: "https://www.epa.gov/soakuptherain/soak-rain-permeable-pavement" }],
  "rain-barrels": [{ label: "EPA Soak Up the Rain: rain barrels", url: "https://www.epa.gov/soakuptherain/soak-rain-rain-barrels" }],
  windbreak: [DOE_LANDSCAPING],
};

/** Upgrades where state energy incentives commonly apply get a DSIRE link for the selected state. */
const STATE_INCENTIVES: InterventionId[] = ["rooftop-solar", "cool-roof", "shade-awnings"];

export function nextStepsFor(id: InterventionId, stateCode: string): NextStep[] {
  const steps = [...STEPS[id]];
  if (STATE_INCENTIVES.includes(id)) {
    steps.push({ label: `DSIRE: incentives in ${stateCode}`, url: `https://programs.dsireusa.org/system/program?state=${encodeURIComponent(stateCode)}` });
  }
  return steps;
}
