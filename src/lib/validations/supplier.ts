import { z } from "zod";

/**
 * A weaver or seller the shop buys from.
 *
 * The mobile number is the identity here, not the name. Two weavers called
 * Ramesh are two people; one weaver entered as "Ramesh" and "Ramesh Weavers"
 * is one person twice. A number settles both, which is why it is required and
 * unique.
 */

/** Ten digits, the Indian mobile format, with any spacing or +91 stripped. */
const MOBILE = /^[6-9]\d{9}$/;

export const supplierMobileSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, "").replace(/^(\+91|91|0)/, ""))
  .refine((value) => MOBILE.test(value), {
    message: "Enter a 10-digit Indian mobile number.",
  });

export const supplierFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Give the weaver a name you will recognise.")
    .max(120),
  mobile: supplierMobileSchema,
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export type SupplierFormInput = z.infer<typeof supplierFormSchema>;
