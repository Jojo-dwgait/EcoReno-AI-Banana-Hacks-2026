import "server-only";
import { GoogleGenAI } from "@google/genai";
import { AppError } from "./errors";

/** Model IDs are configurable so the free-tier / credits / fallback choice is a config change, not a code change. */
export const GEMINI_MODELS = {
  image: process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image",
  vision: process.env.GEMINI_VISION_MODEL || "gemini-flash-latest",
};

let client: GoogleGenAI | null = null;

export function geminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AppError("EDIT_FAILED", "Image AI isn't configured on this server yet.", 503);
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

/** Maps SDK/HTTP failures onto the app's error codes without leaking provider details or keys. */
export function mapGeminiError(err: unknown, stage: "edit" | "analysis" | "review"): AppError {
  if (err instanceof AppError) return err;
  const status = (err as { status?: number })?.status;
  const code = stage === "edit" ? "EDIT_FAILED" : stage === "analysis" ? "ANALYSIS_FAILED" : "REVIEW_FAILED";
  if (status === 429) {
    return new AppError("EDIT_QUOTA", "The image AI is at its usage limit right now. Try the sample house, or try again later.", 429);
  }
  if (status && status >= 500) return new AppError(code, "The image AI service had a temporary problem. Please try again.", 503);
  console.error(JSON.stringify({ level: "error", stage, status: status ?? null, error: String((err as Error)?.message ?? err).slice(0, 300) }));
  return new AppError(code, "The image AI couldn't process this request.", 502);
}
