import { z } from "zod";
import { getSiteProfile, PlaceSchema } from "@/lib/climateService";
import { buildEditPlan, MAX_CHANGES } from "@/lib/editPlan";
import { AppError, errorResponse } from "@/lib/errors";
import { FeatureInventorySchema } from "@/lib/featureInventory";
import { runGeneration, type StageEvent } from "@/lib/generatePipeline";
import { getImageEditor } from "@/lib/editorFactory";
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
  renterMode: z.boolean().optional(),
});

/**
 * Streams newline-delimited JSON so the client shows the real pipeline stages:
 * {"stage":"plan"} → {"stage":"edit","attempt":1} → {"stage":"review","attempt":1} → [retry…] → {"type":"result",…}
 * Validation and rate-limit failures return a normal JSON error before streaming starts.
 */
export async function POST(request: Request) {
  const started = Date.now();
  let body: z.infer<typeof BodySchema>;
  let upload: Awaited<ReturnType<typeof decodeUpload>>;
  try {
    const parsed = BodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError("BAD_REQUEST", "Choose a photo, a city, and 1–3 changes first.", 400);
    body = parsed.data;
    await enforceLimit("generate", request);
    try {
      upload = await decodeUpload(body.image);
    } catch {
      throw new AppError("BAD_REQUEST", "That file couldn't be read as a photo. Please use a JPEG or PNG.", 400);
    }
  } catch (err) {
    return errorResponse(err);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      try {
        send({ stage: "plan" });
        const { profile } = await getSiteProfile(body.place);
        const plan = buildEditPlan([...new Set(body.selected)], profile, body.inventory, { renterMode: body.renterMode });
        const result = await runGeneration(getImageEditor(), { mimeType: "image/jpeg", ...upload }, plan, (e: StageEvent) => send(e));
        console.log(
          JSON.stringify({ stage: "generate", placeId: body.place.id, selected: body.selected, attempts: result.attempts, verdict: result.verdict, totalMs: Date.now() - started }),
        );
        send({
          type: "result",
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
        const e = err instanceof AppError ? err : new AppError("EDIT_FAILED", "Something went wrong while editing the photo. Please try again.", 500);
        if (!(err instanceof AppError)) console.error(JSON.stringify({ level: "error", stage: "generate", error: String(err).slice(0, 300) }));
        send({ type: "error", code: e.code, message: e.message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
