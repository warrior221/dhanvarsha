import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { AttributeInputType, PrismaClient } from "@prisma/client";

/**
 * Seed data for local development.
 *
 * Run with: npx prisma db seed
 *
 * This file is re-runnable. Everything is keyed off a natural unique column
 * (slug or sku) and upserted, so running it twice updates rows rather than
 * creating duplicates.
 *
 * NOTE ON IMAGES: the image URLs below are placeholders so the catalog has
 * something to render before Cloudinary is wired up in Phase 8. The `publicId`
 * values are placeholders too, and get replaced by real Cloudinary public IDs
 * once products are uploaded through the admin UI.
 */

// tsx does not load .env.local on its own, and this file runs outside Next.js.
// Load it before the client is constructed.
try {
  process.loadEnvFile(path.join(import.meta.dirname, "..", ".env.local"));
} catch {
  // Fall back to the real environment (e.g. DATABASE_URL already exported).
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Add it to .env.local (see .env.example).",
  );
}

// The seed builds its own client rather than importing src/lib/db.ts, because
// ES module imports are hoisted above the loadEnvFile() call above.
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
  log: ["error"],
});

/* ------------------------------------------------------------------ */
/* Shape of the seed data                                              */
/* ------------------------------------------------------------------ */

type CategorySeed = {
  name: string;
  slug: string;
  position: number;
};

type AttributeSeed = {
  name: string;
  slug: string;
  inputType: AttributeInputType;
  isFilterable: boolean;
  isRequired: boolean;
  position: number;
  values: { value: string; slug: string; position: number }[];
};

type VariantSeed = {
  size: string | null;
  sku: string;
  /** Decimal as a string — never a JS number, which would round through float. */
  price: string;
  stockQty: number;
};

type ProductSeed = {
  sku: string;
  name: string;
  slug: string;
  description: string;
  categorySlug: string;
  mrp: string;
  sellingPrice: string;
  isReadymade: boolean;
  careInstructions: string;
  cost: { costPrice: string; supplierName: string; purchaseNote?: string };
  /** Attribute value slugs, as "<attribute-slug>:<value-slug>". */
  attributes: string[];
  imageCount: number;
  variants: VariantSeed[];
};

/* ------------------------------------------------------------------ */
/* The data                                                            */
/* ------------------------------------------------------------------ */

const categories: CategorySeed[] = [
  { name: "Saree", slug: "saree", position: 1 },
  { name: "Lehenga", slug: "lehenga", position: 2 },
  { name: "Suit", slug: "suit", position: 3 },
];

const attributes: AttributeSeed[] = [
  {
    name: "Occasion",
    slug: "occasion",
    inputType: AttributeInputType.CHECKBOX,
    isFilterable: true,
    isRequired: false,
    position: 1,
    values: [
      { value: "Wedding", slug: "wedding", position: 1 },
      { value: "Festive", slug: "festive", position: 2 },
      { value: "Party", slug: "party", position: 3 },
      { value: "Casual", slug: "casual", position: 4 },
    ],
  },
  {
    name: "Fabric",
    slug: "fabric",
    inputType: AttributeInputType.CHECKBOX,
    isFilterable: true,
    isRequired: false,
    position: 2,
    values: [
      { value: "Silk", slug: "silk", position: 1 },
      { value: "Cotton", slug: "cotton", position: 2 },
      { value: "Georgette", slug: "georgette", position: 3 },
      { value: "Chiffon", slug: "chiffon", position: 4 },
      { value: "Velvet", slug: "velvet", position: 5 },
    ],
  },
  {
    name: "Style",
    slug: "style",
    inputType: AttributeInputType.CHECKBOX,
    isFilterable: true,
    isRequired: false,
    position: 3,
    values: [
      { value: "Kanjeevaram", slug: "kanjeevaram", position: 1 },
      { value: "Banarasi", slug: "banarasi", position: 2 },
      { value: "Bandhani", slug: "bandhani", position: 3 },
      { value: "Embroidered", slug: "embroidered", position: 4 },
      { value: "Printed", slug: "printed", position: 5 },
    ],
  },
];

const products: ProductSeed[] = [
  {
    sku: "SR-KJV-001",
    name: "Kanjeevaram Silk Saree in Deep Maroon",
    slug: "kanjeevaram-silk-saree-deep-maroon",
    description:
      "A handwoven Kanjeevaram silk saree in deep maroon with a contrast mustard border and traditional temple motifs in pure zari. Comes with an unstitched blouse piece of matching silk.",
    categorySlug: "saree",
    mrp: "12999.00",
    sellingPrice: "8999.00",
    isReadymade: false,
    careInstructions: "Dry clean only. Store folded in a cotton cloth.",
    cost: {
      costPrice: "5500.00",
      supplierName: "Kumaran Silks, Kanchipuram",
      purchaseNote: "Bulk rate for 10+ pieces.",
    },
    attributes: [
      "occasion:wedding",
      "occasion:festive",
      "fabric:silk",
      "style:kanjeevaram",
    ],
    imageCount: 5,
    variants: [{ size: null, sku: "SR-KJV-001-FS", price: "8999.00", stockQty: 6 }],
  },
  {
    sku: "SR-BNS-002",
    name: "Banarasi Silk Saree in Royal Blue",
    slug: "banarasi-silk-saree-royal-blue",
    description:
      "Classic Banarasi silk saree in royal blue, woven with an all-over gold zari jaal and a broad pallu. A wedding-season staple that photographs beautifully.",
    categorySlug: "saree",
    mrp: "9999.00",
    sellingPrice: "6499.00",
    isReadymade: false,
    careInstructions: "Dry clean only. Avoid direct sunlight.",
    cost: {
      costPrice: "4000.00",
      supplierName: "Varanasi Handloom Co.",
    },
    attributes: [
      "occasion:wedding",
      "occasion:festive",
      "fabric:silk",
      "style:banarasi",
    ],
    imageCount: 4,
    variants: [{ size: null, sku: "SR-BNS-002-FS", price: "6499.00", stockQty: 9 }],
  },
  {
    sku: "SR-GRG-003",
    name: "Georgette Party Saree in Emerald Green",
    slug: "georgette-party-saree-emerald-green",
    description:
      "Lightweight georgette saree in emerald green with a sequinned scalloped border. Drapes easily and sits well through a long evening.",
    categorySlug: "saree",
    mrp: "4999.00",
    sellingPrice: "2999.00",
    isReadymade: false,
    careInstructions: "Hand wash cold, or dry clean. Do not wring.",
    cost: {
      costPrice: "1600.00",
      supplierName: "Surat Textile Hub",
    },
    attributes: ["occasion:party", "fabric:georgette", "style:embroidered"],
    imageCount: 4,
    variants: [{ size: null, sku: "SR-GRG-003-FS", price: "2999.00", stockQty: 14 }],
  },
  {
    sku: "LH-BRD-004",
    name: "Bridal Lehenga in Crimson Velvet",
    slug: "bridal-lehenga-crimson-velvet",
    description:
      "Heavy crimson velvet bridal lehenga with dense zardozi and mirror work across the ghagra, a matching embroidered choli and a net dupatta with a scalloped edge.",
    categorySlug: "lehenga",
    mrp: "45999.00",
    sellingPrice: "32999.00",
    isReadymade: true,
    careInstructions: "Dry clean only. Hang on a padded hanger to keep the flare.",
    cost: {
      costPrice: "21000.00",
      supplierName: "Chandni Chowk Bridal House",
      purchaseNote: "Made to order, 3 week lead time.",
    },
    attributes: ["occasion:wedding", "fabric:velvet", "style:embroidered"],
    imageCount: 5,
    variants: [
      { size: "S", sku: "LH-BRD-004-S", price: "32999.00", stockQty: 2 },
      { size: "M", sku: "LH-BRD-004-M", price: "32999.00", stockQty: 3 },
      { size: "L", sku: "LH-BRD-004-L", price: "32999.00", stockQty: 2 },
    ],
  },
  {
    sku: "ST-CTN-005",
    name: "Cotton Straight Suit Set in Indigo Block Print",
    slug: "cotton-straight-suit-set-indigo-block-print",
    description:
      "Readymade three-piece cotton suit set in an indigo hand block print, with a straight kurta, matching palazzo and a mulmul dupatta. Comfortable enough for daily wear.",
    categorySlug: "suit",
    mrp: "3499.00",
    sellingPrice: "2199.00",
    isReadymade: true,
    careInstructions: "Machine wash cold, separately for the first two washes.",
    cost: {
      costPrice: "1200.00",
      supplierName: "Jaipur Block Prints",
    },
    attributes: ["occasion:casual", "fabric:cotton", "style:printed"],
    imageCount: 4,
    variants: [
      { size: "S", sku: "ST-CTN-005-S", price: "2199.00", stockQty: 8 },
      { size: "M", sku: "ST-CTN-005-M", price: "2199.00", stockQty: 12 },
      { size: "L", sku: "ST-CTN-005-L", price: "2199.00", stockQty: 10 },
      { size: "XL", sku: "ST-CTN-005-XL", price: "2199.00", stockQty: 4 },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Seeding                                                             */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  console.log("Seeding database...\n");

  // 0. Shipping rules --------------------------------------------------
  // Editable in the database rather than hardcoded (spec 1.1). The rule that
  // applies is the one with the highest minSubtotal the order reaches.
  const shippingRules = [
    { name: "Standard delivery", minSubtotal: "0.00", charge: "99.00", codExtraCharge: "50.00" },
    { name: "Free delivery over Rs 2,000", minSubtotal: "2000.00", charge: "0.00", codExtraCharge: "50.00" },
  ];

  for (const rule of shippingRules) {
    const existing = await db.shippingRule.findFirst({ where: { name: rule.name } });

    if (existing) {
      await db.shippingRule.update({ where: { id: existing.id }, data: rule });
    } else {
      await db.shippingRule.create({ data: rule });
    }
  }
  console.log(`  shipping:   ${shippingRules.length} rules`);

  // 1. Categories -----------------------------------------------------
  for (const category of categories) {
    await db.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, position: category.position },
      create: category,
    });
  }
  console.log(`  categories: ${categories.length}`);

  // 2. Attributes and their values ------------------------------------
  // Maps "<attribute-slug>:<value-slug>" -> AttributeValue id, so products
  // can reference values by a readable key.
  const valueIdByKey = new Map<string, string>();

  for (const attribute of attributes) {
    const { values, ...attributeFields } = attribute;

    const saved = await db.attribute.upsert({
      where: { slug: attribute.slug },
      update: {
        name: attributeFields.name,
        inputType: attributeFields.inputType,
        isFilterable: attributeFields.isFilterable,
        isRequired: attributeFields.isRequired,
        position: attributeFields.position,
      },
      create: attributeFields,
    });

    for (const value of values) {
      const savedValue = await db.attributeValue.upsert({
        where: {
          attributeId_slug: { attributeId: saved.id, slug: value.slug },
        },
        update: { value: value.value, position: value.position },
        create: { ...value, attributeId: saved.id },
      });

      valueIdByKey.set(`${attribute.slug}:${value.slug}`, savedValue.id);
    }
  }

  const valueCount = attributes.reduce((n, a) => n + a.values.length, 0);
  console.log(`  attributes: ${attributes.length} (${valueCount} values)`);

  // 3. Products -------------------------------------------------------
  for (const product of products) {
    const category = await db.category.findUniqueOrThrow({
      where: { slug: product.categorySlug },
    });

    const saved = await db.product.upsert({
      where: { slug: product.slug },
      update: {
        sku: product.sku,
        name: product.name,
        description: product.description,
        categoryId: category.id,
        mrp: product.mrp,
        sellingPrice: product.sellingPrice,
        isReadymade: product.isReadymade,
        careInstructions: product.careInstructions,
        isActive: true,
      },
      create: {
        sku: product.sku,
        name: product.name,
        slug: product.slug,
        description: product.description,
        categoryId: category.id,
        mrp: product.mrp,
        sellingPrice: product.sellingPrice,
        isReadymade: product.isReadymade,
        careInstructions: product.careInstructions,
        isActive: true,
      },
    });

    // Cost price — admin-only table, never exposed to a customer route.
    await db.productCost.upsert({
      where: { productId: saved.id },
      update: {
        costPrice: product.cost.costPrice,
        supplierName: product.cost.supplierName,
        purchaseNote: product.cost.purchaseNote ?? null,
      },
      create: {
        productId: saved.id,
        costPrice: product.cost.costPrice,
        supplierName: product.cost.supplierName,
        purchaseNote: product.cost.purchaseNote ?? null,
      },
    });

    // Images — replaced wholesale so re-running cannot accumulate duplicates.
    await db.productImage.deleteMany({ where: { productId: saved.id } });
    await db.productImage.createMany({
      data: Array.from({ length: product.imageCount }, (_, i) => ({
        productId: saved.id,
        url: `https://picsum.photos/seed/${product.slug}-${i + 1}/900/1350`,
        publicId: `seed-placeholder/${product.slug}-${i + 1}`,
        altText: `${product.name} — view ${i + 1} of ${product.imageCount}`,
        position: i,
      })),
    });

    // Variants — upserted by SKU so stock edits are not clobbered on re-run.
    for (const variant of product.variants) {
      await db.productVariant.upsert({
        where: { sku: variant.sku },
        update: {
          size: variant.size,
          price: variant.price,
          productId: saved.id,
        },
        create: {
          productId: saved.id,
          size: variant.size,
          sku: variant.sku,
          price: variant.price,
          stockQty: variant.stockQty,
        },
      });
    }

    // Attribute links.
    await db.productAttributeValue.deleteMany({ where: { productId: saved.id } });
    for (const key of product.attributes) {
      const valueId = valueIdByKey.get(key);

      if (!valueId) {
        throw new Error(
          `Product "${product.slug}" references unknown attribute value "${key}".`,
        );
      }

      await db.productAttributeValue.create({
        data: { productId: saved.id, valueId },
      });
    }
  }

  const variantCount = products.reduce((n, p) => n + p.variants.length, 0);
  console.log(`  products:   ${products.length} (${variantCount} variants)`);
  console.log("\nSeeding complete.");
}

main()
  .catch((error: unknown) => {
    console.error("\nSeeding failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void db.$disconnect();
  });
