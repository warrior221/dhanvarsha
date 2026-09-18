import { getUploadAuthParams } from "@imagekit/next/server";
import { AppError } from "@/lib/errors";

/**
 * ImageKit, server side only.
 *
 * NOTE ON THE SPEC: section 2 names Cloudinary. ImageKit was chosen instead —
 * it serves from Indian edge locations and has a more generous free tier,
 * which matters for a shop selling into India. Nothing else in the app
 * changes: ProductImage still stores a url plus an opaque id, and ImageKit's
 * `fileId` fills the `publicId` column.
 *
 * The PRIVATE key must never reach the browser. Uploads are signed here and
 * the browser sends the file straight to ImageKit with that signature, so
 * photos never pass through this server.
 *
 * The public key and URL endpoint are designed to be public — they are
 * NEXT_PUBLIC_ on purpose and appear in the client bundle by design.
 */

const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY;

export function isImageKitConfigured(): boolean {
  return Boolean(privateKey && publicKey);
}

export type UploadAuth = {
  token: string;
  signature: string;
  expire: number;
  publicKey: string;
};

/**
 * Short-lived credentials for one browser upload. They expire on their own, so
 * a leaked set is useless within minutes.
 */
export function createUploadAuth(): UploadAuth {
  if (!privateKey || !publicKey) {
    throw new AppError(
      "IMAGEKIT_NOT_CONFIGURED",
      "Image uploads are not configured yet. Add the ImageKit keys to .env.local.",
      503,
    );
  }

  const { token, signature, expire } = getUploadAuthParams({
    privateKey,
    publicKey,
  });

  return { token, signature, expire, publicKey };
}

/**
 * Removes a file from the ImageKit media library once nothing references it.
 * Authenticated with HTTP Basic using the private key as the username.
 */
export async function destroyImage(fileId: string): Promise<void> {
  if (!privateKey) return;

  try {
    const response = await fetch(`https://api.imagekit.io/v1/files/${fileId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${Buffer.from(`${privateKey}:`).toString("base64")}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      console.error("[imagekit] Delete failed", fileId, response.status);
    }
  } catch (error) {
    // A failed cleanup must never block an admin edit; it only leaves an
    // orphan file in the media library.
    console.error("[imagekit] Failed to delete", fileId, error);
  }
}
