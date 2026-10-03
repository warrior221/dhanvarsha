import { db } from "@/lib/db";

/**
 * The tag codes, as text.
 *
 * The owner prints labels with their own barcode converter, so nothing here
 * draws a barcode, makes a PDF or talks to a printer. It hands over the codes
 * and gets out of the way.
 *
 * One row per size, because a code belongs to a size and every piece of that
 * size carries the same code. How many labels are needed is a separate
 * question, which is why `stockQty` comes along: the screen can repeat a code
 * once per piece on hand when the owner is printing rather than looking one up.
 *
 * ADMIN ONLY. A tag code is not secret, but this is the whole shop's stock list
 * in one place and it carries no cost or supplier, so it stays behind the admin
 * guard like every other stock screen.
 */

export type TagCodeRow = {
  variantId: string;
  productName: string;
  /** The piece's one code, printed on its tag. */
  code: string;
  stockQty: number;
  /** False when the piece is not on the shop, so the list is not surprising. */
  isActive: boolean;
};

export async function listTagCodes(): Promise<TagCodeRow[]> {
  const variants = await db.productVariant.findMany({
    // Newest design first: new stock is what needs tags printed.
    orderBy: [{ product: { createdAt: "desc" } }, { barcode: "asc" }],
    select: {
      id: true,
      barcode: true,
      stockQty: true,
      product: { select: { name: true, isActive: true } },
    },
  });

  return variants.map((variant) => ({
    variantId: variant.id,
    productName: variant.product.name,
    code: variant.barcode,
    stockQty: variant.stockQty,
    isActive: variant.product.isActive,
  }));
}
