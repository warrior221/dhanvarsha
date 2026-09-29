import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

/**
 * The one optional photo held against a weaver, and its card-sized crop.
 *
 * KEPT IN THE DATABASE, not on an image host. An image host serves files by
 * URL, and a URL that exists can be shared, guessed, or sit in a cache long
 * after it stopped being wanted. There is no URL here: the bytes leave only
 * through a route that has already called requireAdmin().
 *
 * Whatever is handed over is stored. Nothing asks what the picture shows,
 * nothing is read out of it, and nothing is flagged.
 *
 * Two sizes are kept. The square thumbnail is the face of the weaver's card
 * and loads with the list; the original is fetched only when someone opens it.
 * Generating the thumbnail once on upload beats resizing the full image on
 * every page load.
 */

/** After the browser has already shrunk it. Refused above this. */
export const MAX_PHOTO_BYTES = 600 * 1024;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type SupplierPhotoMeta = {
  mimeType: string;
  updatedAt: string;
};

/** Card face. Square, and small enough that a list of them stays quick. */
const THUMB_SIZE = 256;

export async function savePhoto(
  supplierId: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<void> {
  if (!ALLOWED_TYPES.includes(mimeType as (typeof ALLOWED_TYPES)[number])) {
    throw new AppError("BAD_IMAGE", "Use a JPEG, PNG or WebP image.", 400);
  }

  if (bytes.byteLength === 0) {
    throw new AppError("BAD_IMAGE", "That file is empty.", 400);
  }

  if (bytes.byteLength > MAX_PHOTO_BYTES) {
    throw new AppError(
      "IMAGE_TOO_LARGE",
      `That image is ${Math.round(bytes.byteLength / 1024)}KB. Keep it under ${Math.round(MAX_PHOTO_BYTES / 1024)}KB.`,
      413,
    );
  }

  // Imported here rather than at the top so the module can be pulled into a
  // context that never saves a photo without dragging sharp along with it.
  const sharp = (await import("sharp")).default;

  const thumb = await sharp(Buffer.from(bytes))
    .rotate() // Honour the phone's orientation tag, or faces come out sideways.
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover", position: "attention" })
    .jpeg({ quality: 80 })
    .toBuffer();

  await db.supplier.update({
    where: { id: supplierId },
    data: {
      photo: Buffer.from(bytes),
      photoThumb: thumb,
      photoMimeType: mimeType,
      photoUpdatedAt: new Date(),
    },
  });
}

/**
 * The card face.
 *
 * Not logged, unlike opening the full picture: this loads once per card every
 * time the list renders, so recording it would bury the log in noise without
 * telling anyone anything.
 */
export async function readThumb(
  supplierId: string,
): Promise<{ bytes: Buffer } | null> {
  const supplier = await db.supplier.findUnique({
    where: { id: supplierId },
    select: { photoThumb: true },
  });

  if (!supplier?.photoThumb) return null;

  return { bytes: Buffer.from(supplier.photoThumb) };
}

export async function removePhoto(supplierId: string): Promise<void> {
  await db.supplier.update({
    where: { id: supplierId },
    data: {
      photo: null,
      photoThumb: null,
      photoMimeType: null,
      photoUpdatedAt: null,
    },
  });
}

/**
 * Reads the photo out, and RECORDS THAT IT WAS READ.
 *
 * The log is not there to police the shop. It is there so that "who has seen
 * this" has an answer, which matters when the picture may be somebody's
 * identity document.
 *
 * The caller must already have passed requireAdmin(); `viewedById` is who that
 * turned out to be.
 */
export async function readPhoto(
  supplierId: string,
  viewedById: string,
): Promise<{ bytes: Buffer; mimeType: string }> {
  const supplier = await db.supplier.findUnique({
    where: { id: supplierId },
    select: { photo: true, photoMimeType: true },
  });

  if (!supplier?.photo || !supplier.photoMimeType) {
    throw new AppError("NO_PHOTO", "There is no photo for this weaver.", 404);
  }

  await db.supplierPhotoView.create({
    data: { supplierId, viewedById },
  });

  return { bytes: Buffer.from(supplier.photo), mimeType: supplier.photoMimeType };
}

/** Who has opened this weaver's photo, most recent first. */
export async function listPhotoViews(
  supplierId: string,
): Promise<{ viewedAt: string; by: string }[]> {
  const views = await db.supplierPhotoView.findMany({
    where: { supplierId },
    orderBy: { viewedAt: "desc" },
    take: 50,
    select: { viewedAt: true, viewedBy: { select: { name: true, email: true } } },
  });

  return views.map((view) => ({
    viewedAt: view.viewedAt.toISOString(),
    by: view.viewedBy.name || view.viewedBy.email || "Unknown",
  }));
}
