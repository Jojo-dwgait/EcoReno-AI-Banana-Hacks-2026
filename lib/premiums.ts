import type { InterventionId } from "./interventions";

/**
 * Published evidence on how upgrades relate to sale prices. Only "direct" evidence enters the estimate;
 * "related" evidence is shown with its caveat but never added. Sources verified Oct 10, 2026.
 */
export type Source = { label: string; org: string; year: number; url: string; sample: string };

export type PremiumEvidence =
  | { tier: "direct"; kind: "per-watt"; lowPerWatt: number; midPerWatt: number; highPerWatt: number; assumedWatts: number; note: string; source: Source }
  | { tier: "related"; note: string; source: Source }
  | { tier: "none"; note: string };

const LBNL: Source = {
  label: "Selling into the Sun (Hoen et al.)",
  org: "Lawrence Berkeley National Laboratory, U.S. Department of Energy",
  year: 2015,
  url: "https://newscenter.lbl.gov/?p=33444",
  sample: "≈22,000 home sales (≈4,000 with solar) in 8 states, 1999–2013",
};

const FOREST_SERVICE: Source = {
  label: "Street trees and Portland home prices (Donovan & Butry, Landscape and Urban Planning)",
  org: "USDA Forest Service, Pacific Northwest Research Station",
  year: 2010,
  url: "https://fs.usda.gov/pnw/sciencef/scifi126.pdf",
  sample: "3,479 single-family home sales, east Portland, OR, 2007",
};

const HENRY: Source = {
  label: "Landscaping quality and home sale prices (Henry)",
  org: "Journal of Environmental Horticulture 12(2)",
  year: 1994,
  url: "https://jeh.kglmeridian.com/view/journals/jenh/12/2/article-p65.xml",
  sample: "288 home sales, Greenville, SC",
};

export const PREMIUMS: Record<InterventionId, PremiumEvidence> = {
  "rooftop-solar": {
    tier: "direct",
    kind: "per-watt",
    lowPerWatt: 2.6,
    midPerWatt: 4,
    highPerWatt: 5.9,
    // $15,000 at $4/W implies the study's typical system was about 3.75 kW; real systems vary widely.
    assumedWatts: 3750,
    note: "Buyers paid about $4 per watt of host-owned solar (≈$15,000 for the study's typical system), from about $2.60/W for older systems to $5.90/W for new ones. Leased systems weren't covered, and amounts are in the study's dollars.",
    source: LBNL,
  },
  "shade-tree": {
    tier: "related",
    note: "Street trees in front of or near a house were associated with an average $8,870 higher sale price in Portland. That study measured public street trees, not yard trees, in one city, so it isn't added to the estimate.",
    source: FOREST_SERVICE,
  },
  "native-planting": {
    tier: "related",
    note: "No peer-reviewed study isolates replacing lawn with drought-tolerant planting. One study found homes with landscaping rated 'excellent' sold for about 4–5% more than 'good', which says landscape quality matters, not that this change adds a set amount.",
    source: HENRY,
  },
  "cool-roof": { tier: "none", note: "No reliable published estimate of a sale-price effect." },
  "shade-awnings": { tier: "none", note: "No reliable published estimate of a sale-price effect." },
  "rain-garden": { tier: "none", note: "No reliable published estimate of a sale-price effect." },
  "permeable-pavers": { tier: "none", note: "No reliable published estimate of a sale-price effect." },
  "rain-barrels": { tier: "none", note: "No reliable published estimate of a sale-price effect." },
  windbreak: { tier: "none", note: "No reliable published estimate of a sale-price effect." },
};

export type UpgradeValue = { id: InterventionId; evidence: PremiumEvidence; low: number | null; mid: number | null; high: number | null };

export function upgradeValues(ids: InterventionId[]): UpgradeValue[] {
  return ids.map((id) => {
    const e = PREMIUMS[id];
    if (e.tier !== "direct") return { id, evidence: e, low: null, mid: null, high: null };
    return { id, evidence: e, low: e.lowPerWatt * e.assumedWatts, mid: e.midPerWatt * e.assumedWatts, high: e.highPerWatt * e.assumedWatts };
  });
}
