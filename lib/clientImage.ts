export type PreparedPhoto = {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
};

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_EDGE_PX = 1536;
export const MIN_EDGE_PX = 400;

export class PhotoError extends Error {}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new PhotoError("Couldn't read the processed photo."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Downscales to ≤ 1536 px on the long edge and re-encodes as JPEG in the browser.
 * Re-encoding through a canvas drops all EXIF metadata, including GPS location.
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const looksLikeImage = file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name);
  if (!looksLikeImage) throw new PhotoError("Please choose a photo (JPEG, PNG, or HEIC).");
  if (file.size > MAX_UPLOAD_BYTES) throw new PhotoError("That photo is over 20 MB. Please choose a smaller one.");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoError("This browser can't read that photo format. Try a JPEG or PNG (on iPhone, Share → Save as JPEG).");
  }
  if (Math.min(bitmap.width, bitmap.height) < MIN_EDGE_PX) {
    bitmap.close();
    throw new PhotoError(`That photo is too small. Please use one at least ${MIN_EDGE_PX} px on the short side.`);
  }

  const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PhotoError("Your browser couldn't process the photo.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob) throw new PhotoError("Your browser couldn't process the photo.");
  return { dataUrl: await blobToDataUrl(blob), width, height, bytes: blob.size };
}
