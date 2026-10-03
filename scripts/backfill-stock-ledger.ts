import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";

/**
 * Gives every existing variant an OPENING_BALANCE movement.
 *
 * RUN ONCE, after the stock_ledger migration:
 *
 *     npx tsx scripts/backfill-stock-ledger.ts
 *
 * Without it the ledger starts out disagreeing with `stockQty` for every piece
 * already in the shop, and the consistency check at the end would report every
 * variant as broken.
 *
 * Safe to run twice: a variant that already has movements is skipped, so it
 * cannot double-count, and it is safe to run after real movements exist
 * because it only touches variants with none at all.
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
    const variants = await db.productVariant.findMany({
      select: {
        id: true,
        barcode: true,
        stockQty: true,
        _count: { select: { movements: true } },
      },
      orderBy: { barcode: "asc" },
    });

    const needing = variants.filter((variant) => variant._count.movements === 0);

    console.log(
      `${variants.length} variants, ${needing.length} without any movement yet.\n`,
    );

    if (needing.length === 0) {
      console.log("Nothing to backfill.");
    } else {
      // One statement. Every opening balance has the same shape, and a row at
      // a time through the ORM would be thousands of round trips once ten
      // thousand pieces are tagged.
      const created = await db.stockMovement.createMany({
        data: needing.map((variant) => ({
          variantId: variant.id,
          delta: variant.stockQty,
          balanceAfter: variant.stockQty,
          reason: "OPENING_BALANCE" as const,
          note: "Stock already on the shelf when the ledger started.",
        })),
      });

      console.log(`Wrote ${created.count} opening balances.`);
    }

    // Prove it rather than assume it.
    const grouped = await db.stockMovement.groupBy({
      by: ["variantId"],
      _sum: { delta: true },
    });
    const ledger = new Map(grouped.map((row) => [row.variantId, row._sum.delta ?? 0]));

    const mismatched = variants.filter(
      (variant) => (ledger.get(variant.id) ?? 0) !== variant.stockQty,
    );

    console.log(
      `\nConsistency: ${variants.length - mismatched.length}/${variants.length} variants agree with the ledger.`,
    );

    for (const variant of mismatched) {
      console.log(
        `  MISMATCH ${variant.barcode}: stockQty ${variant.stockQty}, ledger ${ledger.get(variant.id) ?? 0}`,
      );
    }

    if (mismatched.length > 0) process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("\nBackfill failed:");
  console.error(error);
  process.exitCode = 1;
});
