import type { InterventionId } from "./interventions";
import type { PremiumEvidence } from "./premiums";
import type { Comparables, Prediction } from "./valueModel";

/** Response of POST /api/home-value (client-safe types). */
export type ValueEstimate = {
  area: { pumaName: string; placeName: string | null; countyName: string };
  dataset: { name: string; org: string; url: string; dollars: number };
  home: { kind: "detached" | "attached"; bedrooms: number; builtYear: number; assumed: { bedrooms: boolean; builtYear: boolean; kind: boolean } };
  model: { n: number; r2: number; residualSd: number; coefficients: { name: string; value: number }[] } | null;
  prediction: Prediction | null;
  comparables: Comparables | null;
  official: { value: number; marginOfError: number | null; geography: string; table: string; url: string } | null;
  upgrades: { id: InterventionId; evidence: PremiumEvidence; low: number | null; mid: number | null; high: number | null }[];
  withUpgrades: Prediction | null;
  caveats: string[];
};
