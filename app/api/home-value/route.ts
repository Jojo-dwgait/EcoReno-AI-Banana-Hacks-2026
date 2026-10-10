import { z } from "zod";
import { censusArea, officialMedianValue, PUMS_DATASET, pumsRecords } from "@/lib/census";
import { PlaceSchema } from "@/lib/climateService";
import { AppError, errorResponse } from "@/lib/errors";
import { INTERVENTION_BY_ID, type InterventionId } from "@/lib/interventions";
import { upgradeValues } from "@/lib/premiums";
import { areaDefaults, comparables, fitValueModel, predictValue, prepareRecords, PUMS_YEAR, type HomeKind } from "@/lib/valueModel";
import type { ValueEstimate } from "@/lib/valueTypes";

export const maxDuration = 60;

const ids = Object.keys(INTERVENTION_BY_ID) as [InterventionId, ...InterventionId[]];
const BodySchema = z.object({
  place: PlaceSchema,
  propertyType: z.enum(["single_family", "townhouse", "multifamily", "mobile_home", "other", "unknown"]),
  bedrooms: z.number().int().min(1).max(10).nullable(),
  builtDecade: z.number().int().min(1900).max(2030).nullable(),
  upgrades: z.array(z.enum(ids)).max(3),
});

export async function POST(request: Request) {
  const started = Date.now();
  try {
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError("BAD_REQUEST", "Missing home details for the value estimate.", 400);
    const { place, propertyType, bedrooms, builtDecade, upgrades } = parsed.data;
    if (propertyType === "multifamily" || propertyType === "mobile_home") {
      throw new AppError("VALUE_UNAVAILABLE", "The value model covers one-family houses (detached or attached), not apartment buildings or mobile homes.", 422);
    }
    const kind: HomeKind = propertyType === "townhouse" ? "attached" : "detached";

    const area = await censusArea(place.lat, place.lon);
    const [records, official] = await Promise.all([pumsRecords(area), officialMedianValue(area)]);
    const rows = prepareRecords(records);
    if (rows.length === 0) throw new AppError("VALUE_UNAVAILABLE", "The Census sample has no owner-occupied one-family homes for this area.", 404);

    const defaults = areaDefaults(rows);
    const home = {
      kind,
      bedrooms: bedrooms ?? defaults.bedrooms,
      builtYear: builtDecade !== null ? builtDecade + 5 : defaults.builtYear,
    };
    const model = fitValueModel(rows);
    const prediction = model ? predictValue(model, home) : null;
    const comps = comparables(rows, home);
    const ups = upgradeValues(upgrades);
    const direct = ups.filter((u) => u.mid !== null);
    const withUpgrades =
      prediction && direct.length > 0
        ? {
            low: prediction.low + direct.reduce((s, u) => s + (u.low ?? 0), 0),
            mid: prediction.mid + direct.reduce((s, u) => s + (u.mid ?? 0), 0),
            high: prediction.high + direct.reduce((s, u) => s + (u.high ?? 0), 0),
          }
        : null;

    const body: ValueEstimate = {
      area: { pumaName: area.pumaName, placeName: area.place?.name ?? null, countyName: area.county.name },
      dataset: { ...PUMS_DATASET, dollars: PUMS_YEAR },
      home: { ...home, assumed: { bedrooms: bedrooms === null, builtYear: builtDecade === null, kind: propertyType === "unknown" || propertyType === "other" } },
      model: model && { n: model.n, r2: model.r2, residualSd: model.residualSd, coefficients: model.coefficients },
      prediction,
      comparables: comps,
      official,
      upgrades: ups,
      withUpgrades,
      caveats: [
        "Census home values are owners' own estimates, which tend to run somewhat above actual sale prices.",
        `Figures are in ${PUMS_YEAR} dollars, not today's market.`,
        "Upgrade figures come from published studies and are associations, not guarantees.",
        "Value added is not profit; upgrades cost money.",
        "Illustrative, not an appraisal.",
      ],
    };
    console.log(JSON.stringify({ stage: "home-value", placeId: place.id, puma: `${area.stateFips}-${area.puma}`, n: rows.length, r2: model?.r2 ?? null, ms: Date.now() - started }));
    return Response.json({ ok: true, estimate: body });
  } catch (err) {
    return errorResponse(err);
  }
}
