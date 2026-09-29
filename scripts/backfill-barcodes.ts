import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
import { generateBarcode } from "../src/lib/barcode";

/**
 * Gives every variant that has no barcode one.
 *
 *     npx tsx scripts/backfill-barcodes.ts
 *
 * Safe to run repeatedly: a variant that already has a code keeps it. That
 * matters more than it sounds — a barcode is ink on a tag, and reissuing one
 * would invalidate every label already printed.
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
    const needing = await db.productVariant.findMany({
      where: { barcode: null },
      select: { id: true, sku: true },
      orderBy: { sku: "asc" },
    });

    console.log(`${needing.length} variants without a barcode.\n`);

    let issued = 0;

    for (const variant of needing) {
      // Retry on the unique constraint rather than checking first. A check
      // then a write is a race; letting the database refuse the duplicate is
      // not. Collisions are vanishingly rare, so this almost never loops.
      for (let attempt = 0; attempt < 5; attempt++) {
        const barcode = generateBarcode();

        try {
          await db.productVariant.update({
            where: { id: variant.id },
            data: { barcode },
          });
          console.log(`  ${variant.sku.padEnd(20)} ${barcode}`);
          issued++;
          break;
        } catch {
          if (attempt === 4) {
            console.error(`  ${variant.sku}: could not find a free code after 5 tries.`);
            process.exitCode = 1;
          }
        }
      }
    }

    console.log(`\nIssued ${issued} barcodes.`);

    const remaining = await db.productVariant.count({ where: { barcode: null } });
    console.log(`${remaining} variants still without one.`);

    if (remaining > 0) process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("\nBackfill failed:");
  console.error(error);
  process.exitCode = 1;
});
