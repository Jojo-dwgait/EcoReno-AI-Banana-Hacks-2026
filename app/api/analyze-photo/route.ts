import { z } from "zod";
import { AppError, errorResponse } from "@/lib/errors";
import { decodeUpload } from "@/lib/imageNormalize";
import { enforceLimit } from "@/lib/rateLimit";
import { analyzePhoto } from "@/lib/visionClient";

export const maxDuration = 60;

export async function POST(request: Request) {
  const started = Date.now();
  try {
    const body = await request.json().catch(() => null);
    const parsed = z.object({ image: z.string().max(8_000_000) }).safeParse(body);
    if (!parsed.success) throw new AppError("BAD_REQUEST", "Please add a photo first.", 400);
    enforceLimit("analyze", request);

    let upload;
    try {
      upload = await decodeUpload(parsed.data.image);
    } catch {
      throw new AppError("BAD_REQUEST", "That file couldn't be read as a photo. Please use a JPEG or PNG.", 400);
    }
    const { inventory, model, ms } = await analyzePhoto({ mimeType: "image/jpeg", ...upload });
    console.log(JSON.stringify({ stage: "analyze", model, ms, total: Date.now() - started, house: inventory.isResidentialExterior }));
    if (!inventory.isResidentialExterior) {
      throw new AppError("NOT_A_HOUSE", `This doesn't look like the outside of a home${inventory.rejectionReason ? ` (${inventory.rejectionReason})` : ""}. Please use a photo of a house exterior.`, 422);
    }
    return Response.json({ ok: true, inventory, model });
  } catch (err) {
    return errorResponse(err);
  }
}
