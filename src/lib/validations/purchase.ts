import { z } from "zod";
import { moneySchema } from "@/lib/validations/product";

/**
 * A delivery being checked in.
 *
 * One line per design. A saree is one line with a single unsized row; a
 * readymade suit is one line with a row per size, because each size is its own
 * variant with its own stock and its own tag.
 *
 * Selling price is deliberately absent. The weaver delivers, the owner records
 * what it cost and how many arrived, and prices it later — pricing is what
 * puts a piece on the shop.
 */

export const purchaseRowSchema = z.object({
  /** Null for a one-size piece, which is most sarees. */
  size: z.string().trim().max(30).nullable(),
  quantity: z
    .number()
    .int("Quantity must be a whole number.")
    .min(1, "At least one piece.")
    .max(10_000),
});

export const purchaseLineSchema = z
  .object({
    categoryId: z.string().trim().min(1, "Pick a type."),
    /** Optional. Left blank, it is named after its type and code. */
    name: z.string().trim().max(200).optional().or(z.literal("")),
    /** Cost never varies by size, so it belongs to the line, not the row. */
    costPrice: moneySchema,
    rows: z.array(purchaseRowSchema).min(1, "Add at least one size or quantity."),
    images: z
      .array(
        z.object({
          url: z.string().trim().min(1),
          publicId: z.string().trim().min(1),
          altText: z.string().trim().max(200).default(""),
        }),
      )
      .max(8)
      .default([]),
  })
  .refine(
    (line) => new Set(line.rows.map((row) => row.size ?? "")).size === line.rows.length,
    { message: "The same size is listed twice.", path: ["rows"] },
  );

export const purchaseFormSchema = z.object({
  /**
   * Optional on purpose. Stock already sitting in the shop when the system
   * started counting has no delivery behind it and no weaver to name.
   */
  supplierId: z.string().trim().min(1).nullable(),
  /**
   * True for stock already on the shelves rather than something that arrived
   * today. Changes the reason written into the ledger, nothing else.
   */
  isOpeningStock: z.boolean().default(false),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
  lines: z.array(purchaseLineSchema).min(1, "Add at least one piece."),
});

export type PurchaseFormInput = z.infer<typeof purchaseFormSchema>;
export type PurchaseLineInput = z.infer<typeof purchaseLineSchema>;
