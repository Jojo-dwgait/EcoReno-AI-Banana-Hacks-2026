import { AppError, errorResponse } from "@/lib/errors";
import { searchUsPlaces } from "@/lib/geocode";

export async function GET(request: Request) {
  const started = Date.now();
  try {
    const q = new URL(request.url).searchParams.get("q") ?? "";
    const places = await searchUsPlaces(q);
    console.log(JSON.stringify({ stage: "geocode", ms: Date.now() - started, results: places.length }));
    if (places.length === 0) {
      throw new AppError("GEOCODE_NO_MATCH", "No U.S. city matched. Check the spelling, or add the state (e.g. “Springfield, IL”).", 404);
    }
    return Response.json({ ok: true, places });
  } catch (err) {
    return errorResponse(err);
  }
}
