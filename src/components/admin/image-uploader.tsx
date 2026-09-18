"use client";

import {
  ImageKitAbortError,
  ImageKitInvalidRequestError,
  ImageKitServerError,
  ImageKitUploadNetworkError,
  upload,
} from "@imagekit/next";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, requestJson } from "@/lib/api-client";

export type EditableImage = { url: string; publicId: string; altText: string };

type UploadAuth = {
  token: string;
  signature: string;
  expire: number;
  publicKey: string;
};

const MAX_IMAGES = 8;
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/**
 * Path inside the media library. Deliberately NOT prefixed with the account
 * name: the URL endpoint already ends in /dhanvarsha, so "/dhanvarsha/products"
 * nests it twice and yields .../dhanvarsha/dhanvarsha/products/...
 *
 * Declared here rather than imported from @/lib/imagekit, which is a server
 * module — importing a value from it would pull the private-key code into the
 * browser bundle.
 */
const IMAGEKIT_FOLDER = "/products";

/**
 * Product photos, uploaded to ImageKit.
 *
 * The browser sends each file straight to ImageKit using short-lived
 * credentials minted by /api/admin/upload, so the private key stays on the
 * server and large photos never proxy through it.
 *
 * ImageKit's `fileId` is stored in ProductImage.publicId — it is what a later
 * delete needs.
 *
 * Order matters: the first image is the one shown on catalog tiles.
 */
export function ImageUploader({
  images,
  onChange,
}: {
  images: EditableImage[];
  onChange: (next: EditableImage[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const configured = Boolean(process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY);
  const remaining = MAX_IMAGES - images.length;

  async function onFilesPicked(event: ChangeEvent<HTMLInputElement>) {
    const picked = [...(event.target.files ?? [])];
    // Let the same file be chosen again later.
    event.target.value = "";

    if (picked.length === 0) return;

    setError(null);

    const tooBig = picked.find((file) => file.size > MAX_BYTES);
    if (tooBig) {
      setError(`"${tooBig.name}" is larger than 10 MB. Please compress it first.`);
      return;
    }

    const wrongType = picked.find((file) => !ACCEPTED.includes(file.type));
    if (wrongType) {
      setError(`"${wrongType.name}" is not a JPG, PNG, WebP or AVIF.`);
      return;
    }

    const files = picked.slice(0, remaining);
    if (picked.length > remaining) {
      setError(`Only ${remaining} more photo${remaining === 1 ? "" : "s"} can be added.`);
    }

    setBusy(true);
    const uploaded: EditableImage[] = [];

    try {
      for (const [index, file] of files.entries()) {
        setProgress(`Uploading ${index + 1} of ${files.length}…`);

        // Credentials are single-use, so each file gets its own set.
        const auth = await requestJson<UploadAuth>("/api/admin/upload", "GET");

        const result = await upload({
          file,
          fileName: file.name,
          folder: IMAGEKIT_FOLDER,
          useUniqueFileName: true,
          token: auth.token,
          signature: auth.signature,
          expire: auth.expire,
          publicKey: auth.publicKey,
        });

        if (!result.url || !result.fileId) {
          throw new Error("ImageKit did not return a URL for that file.");
        }

        uploaded.push({ url: result.url, publicId: result.fileId, altText: "" });
      }

      if (uploaded.length > 0) {
        onChange([...images, ...uploaded].slice(0, MAX_IMAGES));
      }
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;

    const next = [...images];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  }

  return (
    <div className="space-y-4">
      {images.length > 0 ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((image, index) => (
            <li key={image.publicId} className="space-y-2 rounded-lg border p-2">
              <div className="relative aspect-[2/3] overflow-hidden rounded bg-muted">
                <Image
                  src={image.url}
                  alt={image.altText || "Product photo"}
                  fill
                  sizes="200px"
                  className="object-cover"
                />
                {index === 0 ? (
                  <span className="absolute left-1 top-1 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background">
                    Main
                  </span>
                ) : null}
              </div>

              <div>
                <Label
                  htmlFor={`alt-${image.publicId}`}
                  className="mb-1 block text-xs text-muted-foreground"
                >
                  Describe this photo
                </Label>
                <Input
                  id={`alt-${image.publicId}`}
                  value={image.altText}
                  placeholder="Deep maroon silk saree, full drape"
                  className="h-8 text-xs"
                  onChange={(event) => {
                    const next = [...images];
                    next[index] = { ...image, altText: event.target.value };
                    onChange(next);
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={index === 0}
                    aria-label="Move photo earlier"
                    onClick={() => move(index, -1)}
                  >
                    <ArrowLeft className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={index === images.length - 1}
                    aria-label="Move photo later"
                    onClick={() => move(index, 1)}
                  >
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive"
                  aria-label="Remove photo"
                  onClick={() =>
                    onChange(
                      images.filter((candidate) => candidate.publicId !== image.publicId),
                    )
                  }
                >
                  <X className="size-3.5" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {!configured ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Image uploads need ImageKit. Add IMAGEKIT_PRIVATE_KEY,
          NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY and NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT
          to <code>.env.local</code>.
        </p>
      ) : remaining <= 0 ? (
        <p className="text-sm text-muted-foreground">
          That is the maximum of {MAX_IMAGES} photos.
        </p>
      ) : (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            multiple
            className="sr-only"
            onChange={(event) => void onFilesPicked(event)}
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                {progress ?? "Uploading…"}
              </>
            ) : (
              <>
                <ImagePlus className="size-4" aria-hidden />
                Upload photos
              </>
            )}
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        JPG, PNG, WebP or AVIF, up to 10 MB each. The first photo is used on
        listing tiles — reorder with the arrows.
      </p>
    </div>
  );
}

function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof ImageKitAbortError) return "That upload was cancelled.";
  if (error instanceof ImageKitInvalidRequestError) {
    return `ImageKit rejected that file: ${error.message}`;
  }
  if (error instanceof ImageKitUploadNetworkError) {
    return "The upload could not reach ImageKit. Check your connection and try again.";
  }
  if (error instanceof ImageKitServerError) {
    return "ImageKit had a problem. Please try again in a moment.";
  }
  return "That upload failed. Please try again.";
}
