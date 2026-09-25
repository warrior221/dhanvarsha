import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";

/**
 * The Silk Mark.
 *
 * A certification mark of the Silk Mark Organisation of India, not decoration.
 * Only a registered member may display it, and only against genuine silk, so
 * the artwork is deliberately NOT bundled with this code — nothing here
 * invents a certification mark.
 *
 * Drop the official file SMOI issues to members at:
 *
 *     public/brand/silk-mark.png
 *
 * Until it is there this renders nothing at all, rather than a broken image.
 * The check runs once when the server starts, so a newly added file needs a
 * restart to appear.
 *
 * Server component: it reads the filesystem, so it cannot be used inside a
 * client component.
 */
const ARTWORK = "/brand/silk-mark.png";

const ARTWORK_PRESENT = existsSync(
  path.join(process.cwd(), "public", "brand", "silk-mark.png"),
);

export function SilkMark({
  size = 48,
  className,
  label = "Silk Mark certified pure silk",
}: {
  size?: number;
  className?: string;
  label?: string;
}) {
  if (!ARTWORK_PRESENT) return null;

  return (
    <Image
      src={ARTWORK}
      alt={label}
      width={240}
      height={240}
      style={{ width: size, height: "auto" }}
      className={className}
    />
  );
}
