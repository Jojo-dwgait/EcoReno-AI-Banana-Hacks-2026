import { z } from "zod";

/**
 * Unsplash API helpers (pure parts are unit-tested). API guidelines followed:
 * - search results hotlink Unsplash's own image URLs;
 * - choosing a photo triggers its download_location endpoint;
 * - every photo is credited "Photo by <name> on Unsplash" with utm referral links.
 */
export const UTM = "utm_source=ecoreno_ai&utm_medium=referral";
export const withUtm = (url: string) => `${url}${url.includes("?") ? "&" : "?"}${UTM}`;

export const PhotoIdSchema = z.string().regex(/^[A-Za-z0-9_-]{6,24}$/);

const HOUSE_WORDS = /\b(house|home|houses|homes|bungalow|cottage|ranch|colonial|craftsman|farmhouse|townhouse|duplex|cabin|villa|split[- ]level|cape cod|adobe|victorian|tudor)\b/i;

/** Keeps searches on house exteriors: "brick" becomes "brick house exterior". */
export function searchQuery(raw: string): string {
  const q = raw.trim().replace(/\s+/g, " ").slice(0, 60);
  return HOUSE_WORDS.test(q) ? `${q} exterior` : `${q} house exterior`;
}

const UnsplashPhoto = z.object({
  id: z.string(),
  width: z.number(),
  height: z.number(),
  alt_description: z.string().nullish(),
  description: z.string().nullish(),
  urls: z.object({ raw: z.string(), small: z.string(), regular: z.string() }),
  links: z.object({ html: z.string(), download_location: z.string() }),
  user: z.object({ name: z.string(), links: z.object({ html: z.string() }) }),
});
export const SearchResponse = z.object({ total: z.number(), results: z.array(UnsplashPhoto) });
export const PhotoResponse = UnsplashPhoto;
export type UnsplashPhotoT = z.infer<typeof UnsplashPhoto>;

export type PhotoCredit = { name: string; url: string; sourceUrl: string; source: string; license: string };
export type SearchHit = { id: string; thumb: string; width: number; height: number; alt: string; credit: PhotoCredit };

export function creditFor(p: UnsplashPhotoT): PhotoCredit {
  return { name: p.user.name, url: withUtm(p.user.links.html), sourceUrl: withUtm(p.links.html), source: "Unsplash", license: "Unsplash License" };
}

export function toHit(p: UnsplashPhotoT): SearchHit {
  return { id: p.id, thumb: p.urls.small, width: p.width, height: p.height, alt: p.alt_description ?? p.description ?? "House photo", credit: creditFor(p) };
}

/** Only Unsplash's own hosts are ever fetched server-side (guards against SSRF via crafted URLs). */
export function isUnsplashImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "images.unsplash.com";
  } catch {
    return false;
  }
}

export function isUnsplashApiUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "api.unsplash.com";
  } catch {
    return false;
  }
}
