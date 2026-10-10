"use client";

import { useId, useState, type ReactNode } from "react";
import { PhotoError, preparePhoto, type PreparedPhoto } from "@/lib/clientImage";

type Props = {
  photo: PreparedPhoto | null;
  onPhoto: (photo: PreparedPhoto | null) => void;
  /** e.g. a "Try a sample house" button. */
  extraAction?: ReactNode;
  /** e.g. the sample photo's credit line. */
  caption?: ReactNode;
};

export function PhotoInput({ photo, onPhoto, extraAction, caption }: Props) {
  const inputId = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      onPhoto(await preparePhoto(file));
    } catch (err) {
      onPhoto(null);
      setError(err instanceof PhotoError ? err.message : "Couldn't process that photo. Please try another.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
        <img src={photo.dataUrl} alt="Your uploaded house photo" className="w-full rounded-md border border-line" />
      ) : (
        <label
          htmlFor={inputId}
          className="flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line bg-surface p-6 text-center"
        >
          <span className="font-medium">Add a photo of a house exterior</span>
          <span className="text-sm text-muted">Front view with the yard, roof, and windows visible works best. Take one or choose from your library.</span>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={inputId}
          className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-line bg-surface px-4 text-sm font-medium"
        >
          {busy ? "Preparing photo…" : photo ? "Choose a different photo" : "Choose photo"}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*,.heic,.heif"
          className="sr-only"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {extraAction}
        {photo && (
          <span className="font-mono text-xs text-muted">
            {photo.width}×{photo.height} · {(photo.bytes / 1024).toFixed(0)} KB · location data removed
          </span>
        )}
      </div>
      {caption}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
