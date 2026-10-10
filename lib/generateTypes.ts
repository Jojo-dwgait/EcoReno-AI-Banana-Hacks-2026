import type { InterventionId } from "./interventions";
import type { PlannedChange } from "./renovationPrompt";
import type { ReviewResult, Verdict } from "./reviewSchema";

export type GenerateStage = { stage: "plan" } | { stage: "edit"; attempt: number } | { stage: "review"; attempt: number } | { stage: "retry"; reason: string };

export type GenerateResult = {
  type: "result";
  image: string;
  width: number;
  height: number;
  review: ReviewResult | null;
  verdict: Verdict;
  attempts: { attempt: number; editMs: number; reviewMs: number | null; model: string; verdict: Verdict; aspectMismatch: number }[];
  plan: { changes: (PlannedChange & { id: InterventionId })[]; preserve: string[]; forbidden: string[]; climateBasis: string[] };
  prompt: string;
  models: { edit: string; review: string | null };
};

export type GenerateError = { type: "error"; code: string; message: string };

/** Reads the NDJSON stream from /api/generate, reporting stages, and resolves with the final result. */
export async function readGenerateStream(res: Response, onStage: (s: GenerateStage) => void): Promise<GenerateResult> {
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("ndjson")) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message ?? "The request failed. Please try again.");
  }
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line) as GenerateStage | GenerateResult | GenerateError;
      if ("type" in msg && msg.type === "result") return msg;
      if ("type" in msg && msg.type === "error") throw new Error(msg.message);
      onStage(msg as GenerateStage);
    }
    if (done) break;
  }
  throw new Error("The connection closed before the edit finished. Please try again.");
}
