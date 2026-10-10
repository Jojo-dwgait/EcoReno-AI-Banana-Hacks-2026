import "server-only";
import sharp from "sharp";

export type NormalizedImage = {
  base64: string;
  mimeType: "image/jpeg";
  width: number;
  height: number;
  source: { width: number; height: number };
  /** Relative aspect-ratio difference between the model output and the original (0 = identical). */
  aspectMismatch: number;
};

/**
 * Brings a model output back to the original photo's exact pixel size so the slider and pixel-diff line up.
 * Center-crops ("cover") when the aspect ratio differs; the mismatch is reported, never hidden.
 */
export async function normalizeToOriginal(base64: string, width: number, height: number): Promise<NormalizedImage> {
  const input = Buffer.from(base64, "base64");
  const meta = await sharp(input).metadata();
  const sw = meta.width ?? width;
  const sh = meta.height ?? height;
  const aspectMismatch = Math.abs(sw / sh - width / height) / (width / height);
  const out = await sharp(input).resize(width, height, { fit: "cover", position: "centre" }).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  return { base64: out.toString("base64"), mimeType: "image/jpeg", width, height, source: { width: sw, height: sh }, aspectMismatch };
}

/** Decodes an uploaded data URL, validates it is a real image, and returns JPEG bytes ≤ 1536 px (defense in depth: the browser already resized). */
export async function decodeUpload(dataUrl: string, maxEdge = 1536): Promise<{ base64: string; width: number; height: number }> {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("not a supported image data URL");
  const buf = Buffer.from(match[2], "base64");
  if (buf.length > 6 * 1024 * 1024) throw new Error("image too large");
  const img = sharp(buf, { limitInputPixels: 40_000_000 }).rotate();
  const out = await img.resize(maxEdge, maxEdge, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer({ resolveWithObject: true });
  return { base64: out.data.toString("base64"), width: out.info.width, height: out.info.height };
}
