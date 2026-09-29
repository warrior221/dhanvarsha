import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";

/**
 * Proves the ledger and the stock counts still agree.
 *
 *     npx tsx scripts/check-stock-ledger.ts
 *
 * `stockQty` is a cached balance; the movements are the truth. If they drift,
 * some code path wrote stock without recording why — the one thing the ledger
 * exists to prevent — and this is how that gets caught rather than discovered
 * months later when a count cannot be explained.
 *
 * Exits non-zero on any mismatch, so it can be wired into CI or a nightly job.
 */

try {
  process.loadEnvFile(path.join(import.meta.dirname, "..", ".env.local"));
} catch {
  // Fall back to the real environment.
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error("DATABASE_URL is not set. Check .env.local.");
    process.exitCode = 1;
    return;
  }

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const [variants, grouped] = await Promise.all([
      db.productVariant.findMany({
        select: {
          id: true,
          sku: true,
          stockQty: true,
          product: { select: { name: true } },
        },
        orderBy: { sku: "asc" },
      }),
      db.stockMovement.groupBy({ by: ["variantId"], _sum: { delta: true } }),
    ]);

    const ledger = new Map(grouped.map((row) => [row.variantId, row._sum.delta ?? 0]));

    const mismatched = variants.filter(
      (variant) => (ledger.get(variant.id) ?? 0) !== variant.stockQty,
    );

    console.log(
      `${variants.length - mismatched.length}/${variants.length} variants agree with the ledger.`,
    );

    for (const variant of mismatched) {
      console.log(
        `  MISMATCH  ${variant.sku}  (${variant.product.name})  stockQty ${variant.stockQty}, ledger ${ledger.get(variant.id) ?? 0}`,
      );
    }

    // A balance below zero means a guard was bypassed somewhere.
    const negative = variants.filter((variant) => variant.stockQty < 0);

    for (const variant of negative) {
      console.log(`  NEGATIVE  ${variant.sku}: ${variant.stockQty}`);
    }

    const movements = await db.stockMovement.count();
    console.log(`\n${movements} movements recorded.`);

    if (mismatched.length > 0 || negative.length > 0) {
      console.log("\nFAILED.");
      process.exitCode = 1;
    } else {
      console.log("OK.");
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("\nCheck failed to run:");
  console.error(error);
  process.exitCode = 1;
});
