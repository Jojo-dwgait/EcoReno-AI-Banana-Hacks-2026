import { getCache } from "@/lib/cache";
import { AppError, errorResponse } from "@/lib/errors";
import { enforceLimit } from "@/lib/rateLimit";
import { SearchResponse, searchQuery, toHit, type SearchHit } from "@/lib/unsplash";

const DAY = 86_400;

export async function GET(request: Request) {
  // Read the request before the try block so Next's "render at request time" signal isn't swallowed by errorResponse.
  const params = new URL(request.url).searchParams;
  if (params.get("status") === "1") return Response.json({ ok: true, configured: Boolean(process.env.UNSPLASH_ACCESS_KEY) });
  try {
    const key = process.env.UNSPLASH_ACCESS_KEY;
    if (!key) throw new AppError("PHOTO_SEARCH_UNAVAILABLE", "Photo search isn't configured on this server yet. Try one of the sample homes.", 503);
    const raw = (params.get("q") ?? "").trim();
    const page = Math.min(5, Math.max(1, Number(params.get("page")) || 1));
    if (raw.length < 2) throw new AppError("BAD_REQUEST", "Type a house style or feature to search, like “brick ranch”.", 400);

    const query = searchQuery(raw);
    const cacheKey = `unsplash:search:${query.toLowerCase()}:${page}`;
    const cache = getCache();
    let hits = await cache.get<SearchHit[]>(cacheKey);
    if (!hits) {
      await enforceLimit("photoSearch", request);
      const url = new URL("https://api.unsplash.com/search/photos");
      url.searchParams.set("query", query);
      url.searchParams.set("per_page", "12");
      url.searchParams.set("page", String(page));
      url.searchParams.set("orientation", "landscape");
      url.searchParams.set("content_filter", "high");
      const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" }, signal: AbortSignal.timeout(10_000) }).catch(() => null);
      if (!res || res.status === 403 || res.status === 429) {
        throw new AppError("PHOTO_SEARCH_UNAVAILABLE", "Photo search is busy right now. Try one of the sample homes, or search again in a few minutes.", 503);
      }
      if (!res.ok) throw new AppError("PHOTO_SEARCH_UNAVAILABLE", "Photo search had a problem. Try one of the sample homes.", 502);
      const parsed = SearchResponse.safeParse(await res.json());
      if (!parsed.success) throw new AppError("PHOTO_SEARCH_UNAVAILABLE", "Photo search returned an unexpected response.", 502);
      hits = parsed.data.results.map(toHit);
      await cache.set(cacheKey, hits, DAY);
    }
    return Response.json({ ok: true, query, hits });
  } catch (err) {
    return errorResponse(err);
  }
}
