import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";

/**
 * Checks that every product is exactly one piece with one code.
 *
 * The shop sells one size of everything, so a product has one variant, and that
 * variant is what the product page sells, what the grid counts and what a tag is
 * printed for. The admin form cannot make a second one, so this is an invariant
 * check rather than a chore — if it ever fails, something wrote to the database
 * that should not have.
 *
 * Nothing here changes anything.
 *
 *   npx tsx scripts/check-single-variant.ts
 */

async function main() {
  if (!process.env.DATABASE_URL) {
    process.loadEnvFile(path.join(import.meta.dirname, "..", ".env.local"));
  }

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const products = await db.product.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        name: true,
        variants: {
          orderBy: { barcode: "asc" },
          select: { barcode: true, stockQty: true },
        },
      },
    });

    const extras = products.filter((product) => product.variants.length > 1);
    const empty = products.filter((product) => product.variants.length === 0);

    console.log(`${products.length} products checked.`);

    for (const product of empty) {
      console.log(`\n${product.name}\n  has NO piece, so it cannot be sold, counted or tagged.`);
    }

    for (const product of extras) {
      const [sells, ...rest] = product.variants;
      const stranded = rest.reduce((sum, piece) => sum + piece.stockQty, 0);

      console.log(`\n${product.name}`);
      console.log(`  sells: ${sells.barcode} (${sells.stockQty} in stock)`);
      console.log(
        `  ${rest.length} extra ${rest.length === 1 ? "piece" : "pieces"} holding ${stranded} no customer can buy:`,
      );
      for (const piece of rest) {
        console.log(`    ${piece.barcode}  ${piece.stockQty} in stock`);
      }
    }

    if (extras.length === 0 && empty.length === 0) {
      console.log("Every product is one piece with one code. OK.");
      return;
    }

    const wrong = extras.length + empty.length;
    console.log(
      `\n${wrong} ${wrong === 1 ? "product needs" : "products need"} a decision. Nothing was changed.`,
    );
    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
