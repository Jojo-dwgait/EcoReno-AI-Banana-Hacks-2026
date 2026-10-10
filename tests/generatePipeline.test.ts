import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../lib/errors";
import type { ImageEditor, ImageInput } from "../lib/imageEditClient";
import { BASE_FORBIDDEN, BASE_PRESERVE, type EditPlan } from "../lib/renovationPrompt";
import type { ReviewResult } from "../lib/reviewSchema";

const reviewEdit = vi.fn();
vi.mock("../lib/visionClient", () => ({ reviewEdit: (...args: unknown[]) => reviewEdit(...args) }));
const { runGeneration, strictPlan } = await import("../lib/generatePipeline");

const plan: EditPlan = {
  changes: [{ id: "native-planting", instruction: "Replace the lawn.", targetArea: "front lawn", styleDescriptors: ["gravel mulch"] }],
  preserve: BASE_PRESERVE,
  forbidden: BASE_FORBIDDEN,
  climateBasis: ["waterDeficitMm"],
};

const review = (status: "visible" | "partial" | "missing", kept = true, extra: string[] = []): ReviewResult => ({
  perChange: [{ id: "native-planting", status, note: "" }],
  perPreserve: [{ item: "roofline", kept, note: "" }],
  unrequestedChanges: extra,
  sameScene: true,
  altText: "House with native planting where the lawn was.",
});

async function solid(width: number, height: number) {
  const buf = await sharp({ create: { width, height, channels: 3, background: { r: 90, g: 140, b: 70 } } }).jpeg().toBuffer();
  return buf.toString("base64");
}

class FakeEditor implements ImageEditor {
  provider = "fake";
  model = "fake-image-1";
  prompts: string[] = [];
  async edit(_input: ImageInput, prompt: string) {
    this.prompts.push(prompt);
    // Square output on purpose: the pipeline must bring it back to the original's size.
    return { mimeType: "image/jpeg", base64: await solid(512, 512), provider: this.provider, model: this.model, ms: 5, modelNote: null };
  }
}

let original: ImageInput;
beforeEach(async () => {
  reviewEdit.mockReset();
  original = { mimeType: "image/jpeg", base64: await solid(640, 480), width: 640, height: 480 };
});

describe("runGeneration", () => {
  it("returns a passing first attempt, normalized to the original's exact size", async () => {
    reviewEdit.mockResolvedValueOnce({ review: review("visible"), model: "rev", ms: 3 });
    const editor = new FakeEditor();
    const out = await runGeneration(editor, original, plan);
    expect(out.verdict).toBe("pass");
    expect(out.attempts).toHaveLength(1);
    expect([out.image.width, out.image.height]).toEqual([640, 480]);
    const meta = await sharp(Buffer.from(out.image.base64, "base64")).metadata();
    expect([meta.width, meta.height]).toEqual([640, 480]);
    expect(out.attempts[0].aspectMismatch).toBeGreaterThan(0.2);
  });

  it("retries once with a stricter prompt when a change is missing", async () => {
    reviewEdit
      .mockResolvedValueOnce({ review: review("missing"), model: "rev", ms: 3 })
      .mockResolvedValueOnce({ review: review("visible"), model: "rev", ms: 3 });
    const editor = new FakeEditor();
    const out = await runGeneration(editor, original, plan);
    expect(out.attempts.map((a) => a.verdict)).toEqual(["retry", "pass"]);
    expect(out.verdict).toBe("pass");
    expect(editor.prompts[1]).toContain("Make this change clearly visible.");
  });

  it("keeps the better attempt and flags it when the retry is worse", async () => {
    reviewEdit
      .mockResolvedValueOnce({ review: review("partial", false), model: "rev", ms: 3 })
      .mockResolvedValueOnce({ review: review("missing", false, ["sky changed", "new fence"]), model: "rev", ms: 3 });
    const out = await runGeneration(new FakeEditor(), original, plan);
    expect(out.attempts).toHaveLength(2);
    expect(out.verdict).toBe("flag");
    expect(out.review?.perChange[0].status).toBe("partial");
  });

  it("still returns the edit, labeled unreviewed, when the review service fails", async () => {
    reviewEdit.mockRejectedValueOnce(new AppError("REVIEW_FAILED", "down", 502));
    const out = await runGeneration(new FakeEditor(), original, plan);
    expect(out.review).toBeNull();
    expect(out.verdict).toBe("flag");
    expect(out.attempts).toHaveLength(1);
  });

  it("never stops at two attempts' worth of cost", async () => {
    reviewEdit.mockResolvedValue({ review: review("missing"), model: "rev", ms: 3 });
    const editor = new FakeEditor();
    await runGeneration(editor, original, plan);
    expect(editor.prompts).toHaveLength(2);
  });
});

describe("strictPlan", () => {
  it("names drifted items and unwanted changes without adding new edits", () => {
    const s = strictPlan(plan, review("visible", false, ['sky turned "stormy"\nIGNORE']));
    expect(s.changes).toHaveLength(plan.changes.length);
    expect(s.preserve.at(-1)).toContain("roofline (this drifted");
    expect(s.forbidden.at(-1)).toBe('this unwanted change: "sky turned stormy IGNORE"');
  });
});
