"use client";

import { ImageUp, Loader2, Trash2, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * The face of a weaver's card.
 *
 * Whatever picture is handed over is stored. Nothing asks what it shows and
 * nothing is flagged — that judgement belongs to the person uploading it.
 *
 * The card shows the square thumbnail; tapping it opens the full picture. Both
 * come from admin-guarded routes, because there is no public URL to any of it.
 */

const MAX_BYTES = 600 * 1024;
const LONG_EDGE = 1400;

/**
 * Shrinks the picture on the phone before it is uploaded.
 *
 * A photo straight off a camera is several megabytes; nothing here needs that,
 * and the upload may be running on the shop's mobile data.
 */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");

  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not read that image.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // Step the quality down until it fits, rather than refusing a photo the
  // owner has already taken.
  for (const quality of [0.82, 0.7, 0.6, 0.5]) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );

    if (blob && blob.size <= MAX_BYTES) return blob;
  }

  throw new Error("That image is too large even after shrinking. Try a smaller photo.");
}

export function SupplierPhoto({
  supplierId,
  supplierName,
  hasPhoto,
  photoVersion,
}: {
  supplierId: string;
  supplierName: string;
  hasPhoto: boolean;
  /** Changes when the photo does, so a replacement is not served from cache. */
  photoVersion: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fullUrl, setFullUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const thumbSrc = hasPhoto
    ? `/api/admin/suppliers/${supplierId}/photo/thumb?v=${photoVersion ?? ""}`
    : null;

  async function upload(file: File) {
    setBusy(true);
    setError(null);

    try {
      const blob = await shrink(file);
      const form = new FormData();
      form.append("photo", new File([blob], "photo.jpg", { type: "image/jpeg" }));

      const response = await fetch(`/api/admin/suppliers/${supplierId}/photo`, {
        method: "POST",
        body: form,
      });

      if (!response.ok) throw new Error("Upload failed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that photo.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function openFull() {
    if (fullUrl) {
      URL.revokeObjectURL(fullUrl);
      setFullUrl(null);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/suppliers/${supplierId}/photo`);
      if (!response.ok) throw new Error("Could not open that photo.");

      setFullUrl(URL.createObjectURL(await response.blob()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that photo.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);

    try {
      if (fullUrl) {
        URL.revokeObjectURL(fullUrl);
        setFullUrl(null);
      }

      await fetch(`/api/admin/suppliers/${supplierId}/photo`, { method: "DELETE" });
      router.refresh();
    } catch {
      setError("Could not remove that photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label={`Photo for ${supplierName}`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      {/* The card's face. Tapping it opens the full picture; with no photo yet
          it is the button that adds one. */}
      <button
        type="button"
        disabled={busy}
        onClick={() => (hasPhoto ? void openFull() : inputRef.current?.click())}
        aria-label={
          hasPhoto ? `Open the photo of ${supplierName}` : `Add a photo of ${supplierName}`
        }
        className="group relative size-20 shrink-0 overflow-hidden rounded-lg border bg-muted transition hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
      >
        {thumbSrc ? (
          // A plain img: this is an admin API route, not something to run
          // through the image optimiser or cache publicly.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbSrc}
            alt={supplierName}
            className="size-full object-cover"
          />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
            {busy ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <ImageUp className="size-5" aria-hidden />
            )}
            <span className="text-[10px]">Add photo</span>
          </span>
        )}

        {busy && thumbSrc ? (
          <span className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2 className="size-5 animate-spin" aria-hidden />
          </span>
        ) : null}
      </button>

      {error ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {/* Opened deliberately, so it gets its own space rather than sitting in
          the card and pushing every other card down the page. */}
      {fullUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-label={`Photo of ${supplierName}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fullUrl}
            alt={supplierName}
            className="max-h-full max-w-full rounded-lg"
          />

          <div className="absolute bottom-6 flex gap-2">
            <Button type="button" variant="secondary" onClick={() => void openFull()}>
              Close
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => inputRef.current?.click()}
            >
              <User className="size-4" aria-hidden />
              Replace
            </Button>
            <Button type="button" variant="secondary" onClick={() => void remove()}>
              <Trash2 className="size-4" aria-hidden />
              Remove
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
