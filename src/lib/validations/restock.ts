import { z } from "zod";
import { moneySchema } from "@/lib/validations/product";

/**
 * More of something the shop already has.
 *
 * Separate from checking a delivery in, because the two are different acts. A
 * new design needs a name, a type, photos and a tag; a restock needs none of
 * that — it is a quantity and what this batch cost.
 *
 * One line per product, because a product is one piece. There are no sizes to
 * split a delivery across.
 */

export const restockLineSchema = z.object({
  productId: z.string().trim().min(1),
  /** What THIS batch cost per piece. The stored cost becomes the average. */
  costPrice: moneySchema,
  quantity: z
    .number()
    .int("Quantity must be a whole number.")
    .min(1, "At least one piece.")
    .max(10_000),
});

export const restockFormSchema = z
  .object({
    /** Null when the pieces were already in the shop, with no delivery behind them. */
    supplierId: z.string().trim().min(1).nullable(),
    note: z.string().trim().max(1000).optional().or(z.literal("")),
    lines: z.array(restockLineSchema).min(1, "Add at least one piece."),
  })
  .refine((form) => new Set(form.lines.map((line) => line.productId)).size === form.lines.length, {
    message: "The same piece is listed twice.",
    path: ["lines"],
  });

export type RestockFormInput = z.infer<typeof restockFormSchema>;
export type RestockLineInput = z.infer<typeof restockLineSchema>;
