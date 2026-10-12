/** Diagnostic: which Gemini image models this key can use (free tier vs paid). Run: npx tsx scripts/probe-image-models.mts */
import { readFile } from "node:fs/promises";
import { GoogleGenAI, Modality } from "@google/genai";
try { process.loadEnvFile(".env.local"); } catch { /* shell env */ }
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!.trim() });
const img = (await readFile("public/samples/cape-cod/thumb.jpg")).toString("base64");
for (const model of ["gemini-3.1-flash-lite-image", "gemini-3.1-flash-image", "gemini-2.5-flash-image", "gemini-3-pro-image"]) {
  const t = Date.now();
  try {
    const res = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: "image/jpeg", data: img } }, { text: "Edit this photo: add one small potted plant beside the front door. Change nothing else." }] }],
      config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
    });
    const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    console.log(`${model}: OK in ${Date.now() - t} ms, image=${part ? Math.round(part.inlineData!.data!.length * 0.75 / 1024) + " KB" : "none"}, finish=${res.candidates?.[0]?.finishReason}`);
  } catch (e) {
    const err = e as { message?: string; status?: number };
    const msg = String(err?.message ?? e).replace(/\s+/g, " ");
    console.log(`${model}: ERROR status=${err?.status} ${msg.slice(0, 420)}`);
  }
}
