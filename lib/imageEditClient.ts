import "server-only";
import { FinishReason, Modality } from "@google/genai";
import { AppError } from "./errors";
import { GEMINI_MODELS, geminiClient, mapGeminiError } from "./gemini";

export type ImageInput = { mimeType: "image/jpeg" | "image/png" | "image/webp"; base64: string; width: number; height: number };
export type EditResult = { mimeType: string; base64: string; provider: string; model: string; ms: number; modelNote: string | null };

/** Provider adapter: swapping Gemini for a credits provider or FLUX Kontext only means another implementation. */
export interface ImageEditor {
  readonly provider: string;
  readonly model: string;
  edit(input: ImageInput, prompt: string): Promise<EditResult>;
}

const ASPECTS = ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"] as const;

/** The supported output aspect ratio closest to the source photo, to minimize cropping when normalizing back. */
export function nearestAspect(width: number, height: number): (typeof ASPECTS)[number] {
  const target = Math.log(width / height);
  let best: (typeof ASPECTS)[number] = "1:1";
  let bestDiff = Infinity;
  for (const a of ASPECTS) {
    const [w, h] = a.split(":").map(Number);
    const diff = Math.abs(Math.log(w / h) - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = a;
    }
  }
  return best;
}

const BLOCKED = new Set<string>([FinishReason.SAFETY, FinishReason.PROHIBITED_CONTENT, FinishReason.IMAGE_SAFETY, FinishReason.BLOCKLIST].filter(Boolean));

export class GeminiImageEditor implements ImageEditor {
  readonly provider = "Google Gemini";
  constructor(readonly model = GEMINI_MODELS.image) {}

  async edit(input: ImageInput, prompt: string): Promise<EditResult> {
    const started = Date.now();
    let res;
    try {
      res = await geminiClient().models.generateContent({
        model: this.model,
        contents: [{ role: "user", parts: [{ inlineData: { mimeType: input.mimeType, data: input.base64 } }, { text: prompt }] }],
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
          imageConfig: { aspectRatio: nearestAspect(input.width, input.height) },
        },
      });
    } catch (err) {
      throw mapGeminiError(err, "edit");
    }
    const candidate = res.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const image = parts.find((p) => p.inlineData?.data);
    const text = parts.map((p) => p.text ?? "").join(" ").trim() || null;
    if (!image?.inlineData?.data) {
      const reason = candidate?.finishReason ?? res.promptFeedback?.blockReason ?? "NO_IMAGE";
      const declined = BLOCKED.has(String(reason)) || !!res.promptFeedback?.blockReason;
      throw new AppError(
        "EDIT_FAILED",
        declined ? "The image AI declined to edit this photo. Try a different photo of a house exterior." : "The image AI didn't return an edited image. Please try again.",
        502,
      );
    }
    return {
      mimeType: image.inlineData.mimeType ?? "image/png",
      base64: image.inlineData.data,
      provider: this.provider,
      model: res.modelVersion ?? this.model,
      ms: Date.now() - started,
      modelNote: text,
    };
  }
}
