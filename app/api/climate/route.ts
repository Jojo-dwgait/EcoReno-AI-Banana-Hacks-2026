import { z } from "zod";
import { getSiteProfile, PlaceSchema } from "@/lib/climateService";
import { AppError, errorResponse } from "@/lib/errors";

export const maxDuration = 60;

export async function POST(request: Request) {
  const started = Date.now();
  try {
    const body = await request.json().catch(() => null);
    const parsed = z.object({ place: PlaceSchema }).safeParse(body);
    if (!parsed.success) throw new AppError("BAD_REQUEST", "Pick a U.S. city from the list first.", 400);

    const { profile, cacheHit } = await getSiteProfile(parsed.data.place);
    const unavailable = Object.values(profile.climate.metrics).filter((m) => m.quality === "unavailable").length;
    console.log(JSON.stringify({ stage: "climate", placeId: profile.place.id, cacheHit, ms: Date.now() - started, unavailable }));
    return Response.json({ ok: true, profile });
  } catch (err) {
    return errorResponse(err);
  }
}
