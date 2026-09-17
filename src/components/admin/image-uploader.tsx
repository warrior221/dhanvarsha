"use client";

import { ArrowLeft, ArrowRight, ImagePlus, X } from "lucide-react";
import Image from "next/image";
import { CldUploadWidget, type CloudinaryUploadWidgetResults } from "next-cloudinary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type EditableImage = { url: string; publicId: string; altText: string };

const MAX_IMAGES = 8;

/**
 * Product photos.
 *
 * The browser uploads straight to Cloudinary using a signature minted by
 * /api/admin/upload, so the API secret stays on the server and large files
 * never pass through it.
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
  const configured = Boolean(process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);

  function handleUpload(result: CloudinaryUploadWidgetResults) {
    const info = result.info;

    // `info` is a string for some widget events; only the object form is an
    // actual uploaded asset.
    if (!info || typeof info === "string") return;

    const url = info.secure_url;
    const publicId = info.public_id;

    if (!url || !publicId) return;
    if (images.some((image) => image.publicId === publicId)) return;

    onChange([...images, { url, publicId, altText: "" }].slice(0, MAX_IMAGES));
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
                    onChange(images.filter((candidate) => candidate.publicId !== image.publicId))
                  }
                >
                  <X className="size-3.5" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {!configured ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Image uploads need Cloudinary. Add CLOUDINARY_CLOUD_NAME, API key and
          secret plus NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME to <code>.env.local</code>.
        </p>
      ) : images.length >= MAX_IMAGES ? (
        <p className="text-sm text-muted-foreground">
          That is the maximum of {MAX_IMAGES} photos.
        </p>
      ) : (
        <CldUploadWidget
          signatureEndpoint="/api/admin/upload"
          options={{
            folder: "dhanvarsha/products",
            multiple: true,
            maxFiles: MAX_IMAGES - images.length,
            sources: ["local", "url", "camera"],
            clientAllowedFormats: ["png", "jpg", "jpeg", "webp", "avif"],
            maxFileSize: 10_000_000,
          }}
          onSuccess={handleUpload}
        >
          {({ open }) => (
            <Button type="button" variant="outline" onClick={() => open()}>
              <ImagePlus className="size-4" aria-hidden />
              Upload photos
            </Button>
          )}
        </CldUploadWidget>
      )}

      <p className="text-xs text-muted-foreground">
        The first photo is used on listing tiles. Drag order with the arrows.
      </p>
    </div>
  );
}
