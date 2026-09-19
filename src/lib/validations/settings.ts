import { z } from "zod";
import { moneySchema } from "@/lib/validations/product";

/**
 * Shop settings: delivery charges and GST.
 *
 * Shared by the admin forms and the /api/admin routes so the two cannot drift.
 * Money stays a decimal STRING the whole way to Prisma (spec 1.4).
 */

/** 0 to 100, at most two decimals. "5", "5.5" and "12.00" all pass. */
export const gstRateSchema = z
  .string()
  .trim()
  .regex(/^\d{1,3}(\.\d{1,2})?$/, "Enter a rate like 5 or 12.5.")
  .refine((value) => Number(value) <= 100, "A rate cannot exceed 100%.");

/**
 * 15 characters: 2 state digits, 5 PAN letters, 4 digits, 1 letter, 1
 * entity character, a literal Z, then one check character.
 */
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const taxSettingsSchema = z.object({
  gstRate: gstRateSchema,
  pricesIncludeTax: z.boolean(),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((value) => value === "" || GSTIN.test(value), {
      message: "That does not look like a 15-character GSTIN.",
    })
    .optional()
    .or(z.literal("")),
  legalName: z.string().trim().max(200).optional().or(z.literal("")),
});

export type TaxSettingsInput = z.infer<typeof taxSettingsSchema>;

export const shippingRuleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Give the rule a name customers will understand.")
    .max(80),
  /** The rule applies once the basket reaches this much. */
  minSubtotal: moneySchema,
  charge: moneySchema,
  codExtraCharge: moneySchema,
  isActive: z.boolean(),
});

export type ShippingRuleInput = z.infer<typeof shippingRuleSchema>;
