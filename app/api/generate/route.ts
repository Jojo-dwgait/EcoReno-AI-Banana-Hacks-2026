import { z } from "zod";
import { getSiteProfile, PlaceSchema } from "@/lib/climateService";
import { buildEditPlan, MAX_CHANGES } from "@/lib/editPlan";
import { AppError, errorResponse } from "@/lib/errors";
import { FeatureInventorySchema } from "@/lib/featureInventory";
import { runGeneration } from "@/lib/generatePipeline";
import { GeminiImageEditor } from "@/lib/imageEditClient";
import { decodeUpload } from "@/lib/imageNormalize";
import { INTERVENTION_BY_ID, type InterventionId } from "@/lib/interventions";
import { enforceLimit } from "@/lib/rateLimit";

export const maxDuration = 180;

const ids = Object.keys(INTERVENTION_BY_ID) as [InterventionId, ...InterventionId[]];
const BodySchema = z.object({
  image: z.string().max(8_000_000),
  place: PlaceSchema,
  selected: z.array(z.enum(ids)).min(1).max(MAX_CHANGES),
  inventory: FeatureInventorySchema,
});

export async function POST(request: Request) {
  const started = Date.now();
  try {
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError("BAD_REQUEST", "Choose a photo, a city, and 1–3 changes first.", 400);
    enforceLimit("generate", request);
    const { image, place, selected, inventory } = parsed.data;

    let upload;
    try {
      upload = await decodeUpload(image);
    } catch {
      throw new AppError("BAD_REQUEST", "That file couldn't be read as a photo. Please use a JPEG or PNG.", 400);
    }
    const { profile } = await getSiteProfile(place);
    const plan = buildEditPlan([...new Set(selected)], profile, inventory);
    const result = await runGeneration(new GeminiImageEditor(), { mimeType: "image/jpeg", ...upload }, plan);

    console.log(
      JSON.stringify({ stage: "generate", placeId: place.id, selected, attempts: result.attempts, verdict: result.verdict, totalMs: Date.now() - started }),
    );
    return Response.json({
      ok: true,
      image: `data:${result.image.mimeType};base64,${result.image.base64}`,
      width: result.image.width,
      height: result.image.height,
      review: result.review,
      verdict: result.verdict,
      attempts: result.attempts,
      plan: { changes: plan.changes, preserve: plan.preserve, forbidden: plan.forbidden, climateBasis: plan.climateBasis },
      prompt: result.prompt,
      models: { edit: result.editModel, review: result.reviewModel },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
