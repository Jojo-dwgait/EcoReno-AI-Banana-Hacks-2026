import sharp from "sharp";
import { z } from "zod";
import { AppError, errorResponse } from "@/lib/errors";
import { enforceLimit } from "@/lib/rateLimit";
import { creditFor, isUnsplashApiUrl, isUnsplashImageUrl, PhotoIdSchema, PhotoResponse } from "@/lib/unsplash";

export const maxDuration = 30;

/** Fetches a chosen Unsplash photo for editing: validates the id, reports the download (API guideline), returns a ≤1536 px JPEG. */
export async function POST(request: Request) {
  try {
    const key = process.env.UNSPLASH_ACCESS_KEY;
    if (!key) throw new AppError("PHOTO_SEARCH_UNAVAILABLE", "Photo search isn't configured on this server yet. Try one of the sample homes.", 503);
    const parsed = z.object({ id: PhotoIdSchema }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AppError("BAD_REQUEST", "That photo couldn't be found.", 400);
    await enforceLimit("photoSelect", request);

    const headers = { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" };
    const meta = await fetch(`https://api.unsplash.com/photos/${parsed.data.id}`, { headers, signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (!meta?.ok) throw new AppError("PHOTO_SEARCH_UNAVAILABLE", "Couldn't load that photo from Unsplash. Try another one.", 502);
    const photo = PhotoResponse.safeParse(await meta.json());
    if (!photo.success || !isUnsplashImageUrl(photo.data.urls.raw) || !isUnsplashApiUrl(photo.data.links.download_location)) {
      throw new AppError("PHOTO_SEARCH_UNAVAILABLE", "Unsplash returned an unexpected photo record.", 502);
    }

    // Required by the Unsplash API guidelines whenever a photo is used (fire-and-forget).
    void fetch(photo.data.links.download_location, { headers, signal: AbortSignal.timeout(5_000) }).catch(() => undefined);

    const imgRes = await fetch(`${photo.data.urls.raw}&w=1536&fm=jpg&q=85`, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (!imgRes?.ok) throw new AppError("PHOTO_SEARCH_UNAVAILABLE", "Couldn't download that photo. Try another one.", 502);
    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (buf.length > 12 * 1024 * 1024) throw new AppError("BAD_REQUEST", "That photo is too large.", 400);
    const out = await sharp(buf, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(1536, 1536, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer({ resolveWithObject: true });

    return Response.json({
      ok: true,
      photo: { dataUrl: `data:image/jpeg;base64,${out.data.toString("base64")}`, width: out.info.width, height: out.info.height, bytes: out.data.length },
      credit: creditFor(photo.data),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
