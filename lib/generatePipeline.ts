import "server-only";
import { sanitizeSceneText } from "./editPlan";
import { AppError } from "./errors";
import type { ImageEditor, ImageInput } from "./imageEditClient";
import { normalizeToOriginal } from "./imageNormalize";
import { buildEditPrompt, type EditPlan } from "./renovationPrompt";
import { reviewScore, verdictFor, type ReviewResult, type Verdict } from "./reviewSchema";
import { reviewEdit } from "./visionClient";

export type AttemptLog = { attempt: number; editMs: number; reviewMs: number | null; model: string; verdict: Verdict; aspectMismatch: number };

export type GenerationResult = {
  image: ImageInput;
  review: ReviewResult | null;
  verdict: Verdict;
  attempts: AttemptLog[];
  prompt: string;
  editModel: string;
  reviewModel: string | null;
};

/** Second attempt: name the specific misses so the model fixes them, never broaden the edit. */
export function strictPlan(plan: EditPlan, review: ReviewResult): EditPlan {
  const missing = new Set(review.perChange.filter((c) => c.status !== "visible").map((c) => c.id));
  return {
    ...plan,
    changes: plan.changes.map((c) => (missing.has(c.id) ? { ...c, instruction: `${c.instruction} Make this change clearly visible.` } : c)),
    preserve: [...plan.preserve, ...review.perPreserve.filter((p) => !p.kept).map((p) => `${p.item} (this drifted in a previous attempt; keep it identical to the original)`)],
    forbidden: [...plan.forbidden, ...review.unrequestedChanges.slice(0, 4).map((u) => `this unwanted change: "${sanitizeSceneText(u)}"`)],
  };
}

export async function runGeneration(editor: ImageEditor, original: ImageInput, plan: EditPlan): Promise<GenerationResult> {
  const attempts: AttemptLog[] = [];
  let best: GenerationResult | null = null;
  let currentPlan = plan;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const prompt = buildEditPrompt(currentPlan);
    const edit = await editor.edit(original, prompt);
    const norm = await normalizeToOriginal(edit.base64, original.width, original.height);
    const edited: ImageInput = { mimeType: norm.mimeType, base64: norm.base64, width: norm.width, height: norm.height };

    let review: ReviewResult | null = null;
    let reviewMs: number | null = null;
    let reviewModel: string | null = null;
    try {
      const r = await reviewEdit(original, edited, plan);
      review = r.review;
      reviewMs = r.ms;
      reviewModel = r.model;
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      // The edit is still shown, labeled as unreviewed, rather than hidden.
    }
    const verdict: Verdict = review ? verdictFor(review, attempt) : "flag";
    attempts.push({ attempt, editMs: edit.ms, reviewMs, model: edit.model, verdict, aspectMismatch: norm.aspectMismatch });

    const candidate: GenerationResult = { image: edited, review, verdict, attempts, prompt, editModel: edit.model, reviewModel };
    if (!best || (review && (!best.review || reviewScore(review) > reviewScore(best.review)))) best = candidate;
    if (verdict !== "retry" || !review) break;
    currentPlan = strictPlan(plan, review);
  }
  if (!best) throw new AppError("EDIT_FAILED", "The image AI didn't return an edited image. Please try again.", 502);
  // A kept first attempt after a failed retry is still "flag": its issues get shown to the user.
  return { ...best, attempts, verdict: best.verdict === "retry" ? "flag" : best.verdict };
}
