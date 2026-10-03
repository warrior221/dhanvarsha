import { z } from "zod";
import { moneySchema } from "@/lib/validations/product";

/**
 * A delivery being checked in.
 *
 * One line per design, and one line is one product: every piece the shop sells
 * is one size, so a line is a name, what it cost and how many arrived. There are
 * no sizes to list and no per-size rows.
 *
 * Selling price is deliberately absent. The weaver delivers, the owner records
 * what it cost and how many arrived, and prices it later — pricing is what puts a
 * piece on the shop.
 */

export const purchaseLineSchema = z.object({
  categoryId: z.string().trim().min(1, "Pick a type."),
  /** Optional. Left blank, it is named after its type and code. */
  name: z.string().trim().max(200).optional().or(z.literal("")),
  /** Optional. The colour of this piece, e.g. "Royal Blue". */
  colourName: z.string().trim().max(60).optional().or(z.literal("")),
  costPrice: moneySchema,
  quantity: z
    .number()
    .int("Quantity must be a whole number.")
    .min(1, "At least one piece.")
    .max(10_000),
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
});

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
