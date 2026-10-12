import "server-only";
import { HuggingFaceKontextEditor } from "./hfKontextEditor";
import { GeminiImageEditor, type ImageEditor } from "./imageEditClient";

/**
 * Which image editor runs. IMAGE_EDITOR=gemini|huggingface overrides; otherwise Hugging Face (free GPU quota)
 * is used when HF_TOKEN is set, because Gemini's image models have no free-tier quota (checked Oct 11, 2026).
 */
export function getImageEditor(): ImageEditor {
  const choice = process.env.IMAGE_EDITOR?.trim().toLowerCase();
  if (choice === "gemini") return new GeminiImageEditor();
  if (choice === "huggingface" || process.env.HF_TOKEN?.trim()) return new HuggingFaceKontextEditor();
  return new GeminiImageEditor();
}
