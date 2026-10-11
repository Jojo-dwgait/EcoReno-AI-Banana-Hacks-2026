import { describe, expect, it } from "vitest";
import { isUnsplashApiUrl, isUnsplashImageUrl, PhotoIdSchema, searchQuery, toHit, withUtm } from "../lib/unsplash";

describe("Unsplash helpers", () => {
  it("keeps searches on house exteriors", () => {
    expect(searchQuery("brick")).toBe("brick house exterior");
    expect(searchQuery("  craftsman   bungalow ")).toBe("craftsman bungalow exterior");
    expect(searchQuery("modern home")).toBe("modern home exterior");
  });

  it("only allows Unsplash hosts for server-side fetches", () => {
    expect(isUnsplashImageUrl("https://images.unsplash.com/photo-1?ixid=x")).toBe(true);
    expect(isUnsplashImageUrl("https://images.unsplash.com.evil.test/x")).toBe(false);
    expect(isUnsplashImageUrl("http://images.unsplash.com/x")).toBe(false);
    expect(isUnsplashApiUrl("https://api.unsplash.com/photos/abc/download?ixid=1")).toBe(true);
    expect(isUnsplashApiUrl("https://169.254.169.254/latest")).toBe(false);
  });

  it("validates photo ids", () => {
    expect(PhotoIdSchema.safeParse("L8SsHskRWIE").success).toBe(true);
    expect(PhotoIdSchema.safeParse("../../etc").success).toBe(false);
  });

  it("credits the photographer with referral links", () => {
    const hit = toHit({
      id: "abc123",
      width: 4000,
      height: 3000,
      alt_description: "a brick house",
      urls: { raw: "https://images.unsplash.com/p?x=1", small: "https://images.unsplash.com/p?w=400", regular: "https://images.unsplash.com/p?w=1080" },
      links: { html: "https://unsplash.com/photos/abc123", download_location: "https://api.unsplash.com/photos/abc123/download" },
      user: { name: "Jane Doe", links: { html: "https://unsplash.com/@jane" } },
    });
    expect(hit.credit.url).toBe("https://unsplash.com/@jane?utm_source=ecoreno_ai&utm_medium=referral");
    expect(hit.credit.sourceUrl).toContain("utm_medium=referral");
    expect(withUtm("https://x.test/?a=1")).toBe("https://x.test/?a=1&utm_source=ecoreno_ai&utm_medium=referral");
  });
});
