import { z } from "zod";

export const ReviewSchema = z.object({
  perChange: z.array(z.object({ id: z.string(), status: z.enum(["visible", "partial", "missing"]), note: z.string() })),
  perPreserve: z.array(z.object({ item: z.string(), kept: z.boolean(), note: z.string() })),
  unrequestedChanges: z.array(z.string()),
  sameScene: z.boolean(),
  altText: z.string(),
});
export type ReviewResult = z.infer<typeof ReviewSchema>;

export type Verdict = "pass" | "retry" | "flag";

/**
 * pass: every requested change at least partly visible, every preserve item kept, same scene.
 * retry: a change is missing or the geometry/scene drifted. flag: a retry already happened.
 */
export function verdictFor(review: ReviewResult, attempt: number): Verdict {
  const missing = review.perChange.some((c) => c.status === "missing");
  const drift = review.perPreserve.some((p) => !p.kept) || !review.sameScene;
  if (!missing && !drift && review.unrequestedChanges.length === 0) return "pass";
  return attempt === 1 ? "retry" : "flag";
}

/** Higher is better; used to keep the better of two attempts. */
export function reviewScore(review: ReviewResult): number {
  const changes = review.perChange.reduce((s, c) => s + (c.status === "visible" ? 2 : c.status === "partial" ? 1 : 0), 0);
  const kept = review.perPreserve.filter((p) => p.kept).length;
  return changes * 3 + kept - review.unrequestedChanges.length * 2 - (review.sameScene ? 0 : 10);
}
