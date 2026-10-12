import "server-only";
import { Client, handle_file } from "@gradio/client";
import { AppError } from "./errors";
import type { EditResult, ImageEditor, ImageInput } from "./imageEditClient";
import { compactEditPrompt, type EditPlan } from "./renovationPrompt";

export const HF_EDIT_SPACE = process.env.HF_EDIT_SPACE || "black-forest-labs/FLUX.1-Kontext-Dev";

type GradioFile = { url?: string | null; path?: string | null };

/** Maps Space/queue failures to the app's error codes; ZeroGPU quota messages become an honest "daily limit" error. */
export function mapSpaceError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const msg = String((err as { message?: string })?.message ?? err);
  if (/quota|exceeded your gpu|GPU duration/i.test(msg)) {
    return new AppError("EDIT_QUOTA", "Today's free image-editing allowance is used up. The sample homes still show saved results; live editing resets within 24 hours.", 429);
  }
  if (/queue is full|too many requests|429/i.test(msg)) {
    return new AppError("EDIT_QUOTA", "The free image-editing service is busy right now. Please try again in a minute.", 429);
  }
  console.error(JSON.stringify({ level: "error", stage: "edit", provider: "huggingface", error: msg.slice(0, 300) }));
  return new AppError("EDIT_FAILED", "The image AI couldn't edit this photo. Please try again.", 502);
}

/**
 * FLUX.1 Kontext [dev] via Black Forest Labs' public Hugging Face Space (ZeroGPU), called with the
 * project's own HF token so it draws on that account's free daily GPU quota.
 * Kontext is built for in-context edits that keep the rest of the image, and prefers short explicit prompts.
 */
export class HuggingFaceKontextEditor implements ImageEditor {
  readonly provider = "Black Forest Labs FLUX.1 Kontext [dev] on Hugging Face";
  readonly model = "FLUX.1-Kontext-dev";

  formatPrompt(plan: EditPlan): string {
    return compactEditPrompt(plan);
  }

  async edit(input: ImageInput, prompt: string): Promise<EditResult> {
    const started = Date.now();
    const token = process.env.HF_TOKEN?.trim();
    let data: unknown[];
    try {
      const client = await Client.connect(HF_EDIT_SPACE, token ? { hf_token: token as `hf_${string}` } : {});
      const blob = new Blob([Buffer.from(input.base64, "base64")], { type: input.mimeType });
      const result = await client.predict("/infer", {
        input_image: handle_file(blob),
        prompt,
        seed: 42,
        randomize_seed: false,
        guidance_scale: 2.5,
        steps: 28,
      });
      data = result.data as unknown[];
    } catch (err) {
      throw mapSpaceError(err);
    }
    const file = data?.[0] as GradioFile | undefined;
    if (!file?.url) throw new AppError("EDIT_FAILED", "The image AI didn't return an edited image. Please try again.", 502);
    if (!file.url.startsWith("https://")) throw new AppError("EDIT_FAILED", "The image AI returned an unexpected file location.", 502);

    const res = await fetch(file.url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(30_000) }).catch(() => null);
    if (!res?.ok) throw new AppError("EDIT_FAILED", "Couldn't download the edited image. Please try again.", 502);
    const bytes = Buffer.from(await res.arrayBuffer());
    return {
      mimeType: res.headers.get("content-type") ?? "image/webp",
      base64: bytes.toString("base64"),
      provider: this.provider,
      model: this.model,
      ms: Date.now() - started,
      modelNote: null,
    };
  }
}
