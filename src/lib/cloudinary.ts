import { v2 as cloudinary } from "cloudinary";
import { AppError } from "@/lib/errors";

/**
 * Cloudinary, server side only.
 *
 * The API SECRET must never reach the browser, so uploads are signed here and
 * the browser sends the file straight to Cloudinary with that signature. The
 * photo never passes through this server.
 */

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

export const CLOUDINARY_FOLDER = "dhanvarsha/products";

export function isCloudinaryConfigured(): boolean {
  return Boolean(cloudName && apiKey && apiSecret);
}

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

/**
 * Signs the parameters the upload widget wants to send.
 *
 * Only the fields Cloudinary itself passes are signed — we never sign
 * arbitrary caller-supplied parameters, which would let someone upload
 * wherever they liked in the account.
 */
export function signUploadParams(paramsToSign: Record<string, string>): string {
  if (!apiSecret) {
    throw new AppError(
      "CLOUDINARY_NOT_CONFIGURED",
      "Image uploads are not configured yet. Add the Cloudinary keys to .env.local.",
      503,
    );
  }

  return cloudinary.utils.api_sign_request(paramsToSign, apiSecret);
}

/** Removes an image from Cloudinary once it is no longer referenced. */
export async function destroyImage(publicId: string): Promise<void> {
  if (!isCloudinaryConfigured()) return;

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    // A failed cleanup should never block the admin's edit; it only leaves an
    // orphan file in the media library.
    console.error("[cloudinary] Failed to delete", publicId, error);
  }
}
