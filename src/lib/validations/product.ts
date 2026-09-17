import { z } from "zod";

/**
 * Admin product schemas. Shared by the product form and the /api/admin routes
 * so the two cannot drift apart.
 *
 * Money is validated and carried as a decimal STRING all the way to Prisma.
 * Parsing it into a JS number anywhere in this path would round it through
 * float, which spec 1.4 forbids.
 */

const MONEY = /^\d{1,8}(\.\d{1,2})?$/;

export const moneySchema = z
  .string()
  .trim()
  .regex(MONEY, "Enter an amount like 2499 or 2499.50.");

/** Lowercase, hyphenated, no leading/trailing hyphen. */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Required.")
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and hyphens only.",
  );

export const skuSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(2, "SKU is too short.")
  .max(40, "SKU is too long.")
  .regex(/^[A-Z0-9][A-Z0-9-]*$/, "Use letters, numbers and hyphens only.");

export const productImageSchema = z.object({
  url: z.url("Image URL is not valid."),
  publicId: z.string().trim().min(1),
  altText: z
    .string()
    .trim()
    .min(1, "Describe the photo so screen readers can announce it.")
    .max(200),
});

export const productVariantSchema = z.object({
  /** Existing variant id when editing; absent when adding a new one. */
  id: z.string().trim().min(1).max(64).optional(),
  /**
   * Required. A garment cannot be packed without a size, so a product with no
   * real sizing is recorded explicitly as "Free Size" rather than left blank.
   */
  size: z
    .string()
    .trim()
    .min(1, "Every option needs a size. Use “Free Size” if it is one-size.")
    .max(30),
  sku: skuSchema,
  price: moneySchema,
  stockQty: z
    .number()
    .int("Stock must be a whole number.")
    .min(0, "Stock cannot be negative.")
    .max(100_000),
});

export const productFormSchema = z
  .object({
    name: z.string().trim().min(2, "Give the product a name.").max(200),
    slug: slugSchema,
    sku: skuSchema,
    description: z
      .string()
      .trim()
      .min(10, "Write at least a sentence about the product.")
      .max(5000),
    categoryId: z.string().trim().min(1, "Pick a category."),

    mrp: moneySchema,
    sellingPrice: moneySchema,
    /** ADMIN ONLY. Stored in ProductCost, never returned to a customer route. */
    costPrice: moneySchema,
    supplierName: z.string().trim().max(200).optional().or(z.literal("")),
    purchaseNote: z.string().trim().max(1000).optional().or(z.literal("")),

    isReadymade: z.boolean().default(false),
    isActive: z.boolean().default(true),
    careInstructions: z.string().trim().max(1000).optional().or(z.literal("")),

    images: z
      .array(productImageSchema)
      .min(1, "Add at least one photo.")
      .max(8, "Eight photos is the maximum."),

    variants: z
      .array(productVariantSchema)
      .min(1, "Add at least one size."),

    /** AttributeValue ids that are ticked. */
    attributeValueIds: z.array(z.string().trim().min(1)).default([]),
  })
  .refine((data) => comparableMoney(data.sellingPrice) <= comparableMoney(data.mrp), {
    message: "Selling price cannot be more than the MRP.",
    path: ["sellingPrice"],
  })
  .refine(
    (data) => new Set(data.variants.map((v) => v.sku)).size === data.variants.length,
    { message: "Two sizes share the same SKU.", path: ["variants"] },
  )
  .refine(
    (data) =>
      new Set(data.variants.map((v) => v.size.toLowerCase())).size ===
      data.variants.length,
    { message: "The same size is listed twice.", path: ["variants"] },
  );

/** Compares money as integer paise, so "999.90" vs "1000" is exact. */
function comparableMoney(value: string): number {
  const [whole, fraction = "0"] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export type ProductFormInput = z.infer<typeof productFormSchema>;
export type ProductVariantInput = z.infer<typeof productVariantSchema>;
export type ProductImageInput = z.infer<typeof productImageSchema>;

/* ------------------------------------------------------------------ */
/* Attributes                                                          */
/* ------------------------------------------------------------------ */

export const attributeSchema = z.object({
  name: z.string().trim().min(1, "Name the attribute.").max(60),
  slug: slugSchema,
  inputType: z.enum(["CHECKBOX", "SELECT"]).default("CHECKBOX"),
  isFilterable: z.boolean().default(true),
  isRequired: z.boolean().default(false),
  position: z.number().int().min(0).max(999).default(0),
});

export const attributeValueSchema = z.object({
  attributeId: z.string().trim().min(1),
  value: z.string().trim().min(1, "Enter a value.").max(60),
  /** Derived from the value when the form leaves it blank. */
  slug: slugSchema.optional(),
  position: z.number().int().min(0).max(999).default(0),
});

export type AttributeInput = z.infer<typeof attributeSchema>;
export type AttributeValueInput = z.infer<typeof attributeValueSchema>;

/** "Mirror Work" -> "mirror-work" */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
