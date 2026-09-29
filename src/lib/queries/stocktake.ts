import { normaliseScan } from "@/lib/barcode";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { setStockTo } from "@/lib/queries/stock";

/**
 * Counting the shelves.
 *
 * The safety net for pieces that left without being scanned out. The website
 * goes on believing those are in stock and can sell them online a second time,
 * and nothing except a count will ever notice.
 *
 * Three rules hold this together:
 *
 * 1. NOTHING IS APPLIED AUTOMATICALLY. A count produces a report. The owner
 *    decides, line by line, what to correct.
 * 2. `expectedQty` is FROZEN when scanning stops. Days can pass before the
 *    corrections are applied, and an online order in that gap must not be
 *    silently undone — so applying compares the live figure with the frozen one
 *    and refuses the line if it has moved.
 * 3. Corrections go through `setStockTo`, so they land in the same ledger as
 *    every other movement, with a reason of STOCKTAKE and a note that says what
 *    was expected and what was found.
 *
 * Admin only. There are no staff accounts.
 */

export type StocktakeSummary = {
  id: string;
  status: "OPEN" | "COUNTED" | "CLOSED" | "ABANDONED";
  note: string | null;
  startedAt: string;
  countedAt: string | null;
  closedAt: string | null;
  startedBy: string | null;
  /** Pieces counted (the sum, not the number of lines). */
  countedPieces: number;
  /** Differences still waiting for a decision. Zero once everything is done. */
  openDifferences: number;
};

export type StocktakeLineView = {
  lineId: string;
  variantId: string | null;
  productName: string;
  size: string | null;
  sku: string | null;
  scannedCode: string | null;
  countedQty: number;
  expectedQty: number | null;
  /** counted − expected. Negative means pieces are missing from the shelf. */
  difference: number | null;
  /** The live figure, so a line that moved since the count can be spotted. */
  currentQty: number | null;
  applied: boolean;
  skipped: boolean;
};

export type StocktakeReport = {
  stocktake: StocktakeSummary;
  /** Expected on the shelf, not found. Almost always a missed counter scan. */
  missing: StocktakeLineView[];
  /**
   * Found on the shelf, not expected. Usually stock entered twice, or a piece
   * scanned out that never actually left.
   */
  extra: StocktakeLineView[];
  /** Tags that belong to no piece in the system. */
  unknown: StocktakeLineView[];
  /** Lines where the count agreed. Nothing to do, shown only as a total. */
  agreedLines: number;
  /** Decisions already taken, kept so the count reads as a finished record. */
  settled: StocktakeLineView[];
};

/* -------------------------------------------------------------------------- */
/* Starting and finding a count                                               */
/* -------------------------------------------------------------------------- */

/**
 * Starts a count.
 *
 * Only one may be open at a time: two counts over the same shelves would each
 * report the other's pieces as missing. This is checked here rather than in the
 * database, because a partial unique index cannot be written in the Prisma
 * schema and would then look like something to delete the next time a migration
 * is generated.
 */
export async function startStocktake(adminId: string, note?: string | null) {
  const existing = await db.stocktake.findFirst({
    where: { status: "OPEN" },
    select: { id: true },
  });

  if (existing) {
    throw new AppError(
      "COUNT_ALREADY_OPEN",
      "A count is already open. Finish or abandon that one first.",
      409,
    );
  }

  return db.stocktake.create({
    data: { startedById: adminId, note: note?.trim() || null },
    select: { id: true },
  });
}

/** The count currently being scanned, if there is one. */
export async function openStocktakeId(): Promise<string | null> {
  const open = await db.stocktake.findFirst({
    where: { status: "OPEN" },
    select: { id: true },
  });

  return open?.id ?? null;
}

/* -------------------------------------------------------------------------- */
/* Scanning                                                                   */
/* -------------------------------------------------------------------------- */

export type CountScanResult = {
  productName: string;
  size: string | null;
  /** How many of this piece have been counted in this session so far. */
  countedQty: number;
  /** True when the tag matched nothing — worth looking at, not an error. */
  unknownTag: boolean;
  /** Total pieces counted in this session, across every line. */
  sessionPieces: number;
};

/**
 * Records one piece found on the shelf.
 *
 * Each scan of the same tag adds one, because every piece of a size carries the
 * same tag — three sarees of one design and size means scanning it three times.
 *
 * A tag that matches nothing is recorded rather than refused. On a shelf count
 * an unreadable or foreign label is information, and throwing it away would
 * leave the owner wondering what that label was.
 */
export async function countScan(
  stocktakeId: string,
  raw: string,
): Promise<CountScanResult> {
  const stocktake = await db.stocktake.findUnique({
    where: { id: stocktakeId },
    select: { status: true },
  });

  if (stocktake?.status !== "OPEN") {
    throw new AppError("COUNT_NOT_OPEN", "This count is no longer taking scans.", 409);
  }

  const scannedCode = normaliseScan(raw);

  if (scannedCode === "") {
    throw new AppError("EMPTY_SCAN", "Scan a tag.", 400);
  }

  const variant = await db.productVariant.findUnique({
    where: { barcode: scannedCode },
    select: { id: true, size: true, product: { select: { name: true } } },
  });

  // Two different keys for the same idea: a known piece is one line per
  // variant, an unknown tag is one line per code. Upserting on the right one
  // keeps a second scan of either from making a duplicate row.
  const line = variant
    ? await db.stocktakeLine.upsert({
        where: { stocktakeId_variantId: { stocktakeId, variantId: variant.id } },
        create: { stocktakeId, variantId: variant.id, scannedCode, countedQty: 1 },
        update: { countedQty: { increment: 1 } },
        select: { countedQty: true },
      })
    : await db.stocktakeLine.upsert({
        where: { stocktakeId_scannedCode: { stocktakeId, scannedCode } },
        create: { stocktakeId, scannedCode, countedQty: 1 },
        update: { countedQty: { increment: 1 } },
        select: { countedQty: true },
      });

  const total = await db.stocktakeLine.aggregate({
    where: { stocktakeId },
    _sum: { countedQty: true },
  });

  return {
    productName: variant?.product.name ?? "Unknown tag",
    size: variant?.size ?? null,
    countedQty: line.countedQty,
    unknownTag: variant === null,
    sessionPieces: total._sum.countedQty ?? 0,
  };
}

/**
 * Types a count in directly, for when a tag was scanned once too often or a
 * piece has no tag to scan at all. Zero is allowed: it means none were found.
 */
export async function setCount(lineId: string, countedQty: number) {
  if (!Number.isInteger(countedQty) || countedQty < 0 || countedQty > 9999) {
    throw new AppError("BAD_COUNT", "Enter how many are on the shelf.", 400);
  }

  const line = await db.stocktakeLine.findUnique({
    where: { id: lineId },
    select: { stocktake: { select: { status: true } } },
  });

  if (line?.stocktake.status !== "OPEN") {
    throw new AppError("COUNT_NOT_OPEN", "This count is closed.", 409);
  }

  await db.stocktakeLine.update({ where: { id: lineId }, data: { countedQty } });
}

/** How far through the shop the count has got, to warn before finishing. */
export async function countProgress(stocktakeId: string) {
  const [counted, expected] = await Promise.all([
    db.stocktakeLine.aggregate({
      where: { stocktakeId },
      _sum: { countedQty: true },
    }),
    db.productVariant.aggregate({
      where: { stockQty: { gt: 0 } },
      _sum: { stockQty: true },
    }),
  ]);

  return {
    countedPieces: counted._sum.countedQty ?? 0,
    expectedPieces: expected._sum.stockQty ?? 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Finishing the count                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Stops scanning and freezes the comparison.
 *
 * Three statements do the whole shop rather than one round trip per piece: Neon
 * gives a transaction five seconds, and a shop with a few hundred pieces would
 * not finish in time otherwise.
 *
 * The third statement is the point of the whole feature — it raises a line for
 * every piece the system expects that nobody scanned. Those are the missing
 * ones. A count must therefore cover the whole shop before it is finished, or
 * everything unscanned is reported missing; the screen says so before asking.
 */
export async function finishCounting(stocktakeId: string) {
  const stocktake = await db.stocktake.findUnique({
    where: { id: stocktakeId },
    select: { status: true },
  });

  if (stocktake?.status !== "OPEN") {
    throw new AppError("COUNT_NOT_OPEN", "This count is already finished.", 409);
  }

  await db.$transaction(async (tx) => {
    // What the system believes right now, for every piece that was scanned.
    await tx.$executeRaw`
      UPDATE "StocktakeLine" AS l
      SET "expectedQty" = v."stockQty", "updatedAt" = now()
      FROM "ProductVariant" AS v
      WHERE l."variantId" = v."id" AND l."stocktakeId" = ${stocktakeId}
    `;

    // A tag belonging to no piece was never expected on the shelf.
    await tx.$executeRaw`
      UPDATE "StocktakeLine"
      SET "expectedQty" = 0, "updatedAt" = now()
      WHERE "stocktakeId" = ${stocktakeId} AND "variantId" IS NULL
    `;

    // Everything the system expects that nobody scanned: the missing pieces.
    await tx.$executeRaw`
      INSERT INTO "StocktakeLine"
        ("id", "stocktakeId", "variantId", "countedQty", "expectedQty", "firstSeenAt", "updatedAt")
      SELECT gen_random_uuid()::text, ${stocktakeId}, v."id", 0, v."stockQty", now(), now()
      FROM "ProductVariant" AS v
      WHERE v."stockQty" > 0
        AND NOT EXISTS (
          SELECT 1 FROM "StocktakeLine" AS l
          WHERE l."stocktakeId" = ${stocktakeId} AND l."variantId" = v."id"
        )
    `;

    await tx.stocktake.update({
      where: { id: stocktakeId },
      data: { status: "COUNTED", countedAt: new Date() },
    });
  });
}

/** Gives up on a count. Nothing was applied, and now nothing can be. */
export async function abandonStocktake(stocktakeId: string) {
  const stocktake = await db.stocktake.findUnique({
    where: { id: stocktakeId },
    select: { status: true },
  });

  if (stocktake === null || stocktake.status === "CLOSED") {
    throw new AppError("COUNT_CLOSED", "That count is already finished.", 409);
  }

  await db.stocktake.update({
    where: { id: stocktakeId },
    data: { status: "ABANDONED", closedAt: new Date() },
  });
}

/* -------------------------------------------------------------------------- */
/* Applying corrections                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Corrects one piece's stock to what was actually on the shelf.
 *
 * Refuses if the live figure no longer matches what was frozen at the count:
 * something sold or arrived in between, so the shelf has moved on and the old
 * count no longer describes it. Guessing here would quietly undo a real sale.
 *
 * The correction is an ordinary STOCKTAKE movement carrying a note that says
 * what was expected and what was found, so the ledger explains itself without
 * anyone having to open this screen again.
 */
export async function applyCorrection(
  lineId: string,
  adminId: string,
  extraNote?: string | null,
): Promise<{ balanceAfter: number }> {
  const line = await db.stocktakeLine.findUnique({
    where: { id: lineId },
    select: {
      id: true,
      variantId: true,
      countedQty: true,
      expectedQty: true,
      appliedMovement: { select: { id: true } },
      stocktake: { select: { status: true, countedAt: true } },
    },
  });

  if (!line || line.variantId === null || line.expectedQty === null) {
    throw new AppError("NOT_CORRECTABLE", "There is nothing to correct on that line.", 400);
  }

  if (line.stocktake.status !== "COUNTED") {
    throw new AppError("COUNT_NOT_READY", "Finish the count before applying corrections.", 409);
  }

  if (line.appliedMovement) {
    throw new AppError("ALREADY_APPLIED", "That has already been corrected.", 409);
  }

  if (line.countedQty === line.expectedQty) {
    throw new AppError("NOTHING_TO_DO", "The count already agrees.", 400);
  }

  // Narrowed above, but the closure below loses that, so hold it in a local.
  const variantId = line.variantId;
  const expectedQty = line.expectedQty;

  const on = line.stocktake.countedAt
    ? line.stocktake.countedAt.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : "an earlier date";

  const note = [
    `Shelf count ${on}: expected ${expectedQty}, found ${line.countedQty}.`,
    extraNote?.trim(),
  ]
    .filter(Boolean)
    .join(" ");

  const balanceAfter = await db.$transaction(async (tx) => {
    const current = await tx.productVariant.findUnique({
      where: { id: variantId },
      select: { stockQty: true },
    });

    if (!current) {
      throw new AppError("VARIANT_GONE", "That size no longer exists.", 404);
    }

    if (current.stockQty !== expectedQty) {
      throw new AppError(
        "STOCK_MOVED",
        `Stock has changed since the count (now ${current.stockQty}, was ${expectedQty}). Count this piece again rather than applying an old figure.`,
        409,
      );
    }

    const movement = await setStockTo(tx, {
      variantId,
      newQty: line.countedQty,
      reason: "STOCKTAKE",
      note,
      createdById: adminId,
    });

    if (!movement) {
      throw new AppError("NOTHING_TO_DO", "The count already agrees.", 400);
    }

    // Links the correction back to the line it came from. The column is unique,
    // so a second attempt at the same line is refused by the database.
    await tx.stockMovement.update({
      where: { id: movement.movementId },
      data: { stocktakeLineId: line.id },
    });

    return movement.balanceAfter;
  });

  return { balanceAfter };
}

/** Records that a difference was looked at and deliberately left alone. */
export async function skipLine(lineId: string, skip: boolean) {
  const line = await db.stocktakeLine.findUnique({
    where: { id: lineId },
    select: { appliedMovement: { select: { id: true } } },
  });

  if (!line) throw new AppError("NOT_FOUND", "That line is gone.", 404);

  if (line.appliedMovement) {
    throw new AppError("ALREADY_APPLIED", "That one has already been corrected.", 409);
  }

  await db.stocktakeLine.update({
    where: { id: lineId },
    data: { skippedAt: skip ? new Date() : null },
  });
}

/**
 * Marks a count finished with.
 *
 * Refuses while any difference is still undecided, so a count cannot be filed
 * away with a missing saree nobody ever looked at.
 */
export async function closeStocktake(stocktakeId: string) {
  const undecided = await db.stocktakeLine.count({
    where: {
      stocktakeId,
      skippedAt: null,
      appliedMovement: null,
      NOT: { countedQty: { equals: db.stocktakeLine.fields.expectedQty } },
    },
  });

  if (undecided > 0) {
    throw new AppError(
      "DIFFERENCES_LEFT",
      `${undecided} difference${undecided === 1 ? "" : "s"} still waiting. Correct or leave each one, then close.`,
      409,
    );
  }

  await db.stocktake.update({
    where: { id: stocktakeId },
    data: { status: "CLOSED", closedAt: new Date() },
  });
}

/* -------------------------------------------------------------------------- */
/* Reading                                                                    */
/* -------------------------------------------------------------------------- */

const LINE_SELECT = {
  id: true,
  variantId: true,
  scannedCode: true,
  countedQty: true,
  expectedQty: true,
  skippedAt: true,
  appliedMovement: { select: { id: true } },
  variant: {
    select: {
      sku: true,
      size: true,
      stockQty: true,
      product: { select: { name: true } },
    },
  },
} as const;

type LineRow = {
  id: string;
  variantId: string | null;
  scannedCode: string | null;
  countedQty: number;
  expectedQty: number | null;
  skippedAt: Date | null;
  appliedMovement: { id: string } | null;
  variant: {
    sku: string;
    size: string | null;
    stockQty: number;
    product: { name: string };
  } | null;
};

function toLineView(row: LineRow): StocktakeLineView {
  return {
    lineId: row.id,
    variantId: row.variantId,
    productName: row.variant?.product.name ?? "Unknown tag",
    size: row.variant?.size ?? null,
    sku: row.variant?.sku ?? null,
    scannedCode: row.scannedCode,
    countedQty: row.countedQty,
    expectedQty: row.expectedQty,
    difference: row.expectedQty === null ? null : row.countedQty - row.expectedQty,
    currentQty: row.variant?.stockQty ?? null,
    applied: row.appliedMovement !== null,
    skipped: row.skippedAt !== null,
  };
}

/** Everything scanned so far, newest first, while a count is still open. */
export async function openCountLines(stocktakeId: string): Promise<StocktakeLineView[]> {
  const rows = await db.stocktakeLine.findMany({
    where: { stocktakeId },
    orderBy: { updatedAt: "desc" },
    take: 500,
    select: LINE_SELECT,
  });

  return rows.map(toLineView);
}

/** The report: what is missing, what is extra, and what nobody recognises. */
export async function stocktakeReport(
  stocktakeId: string,
): Promise<StocktakeReport | null> {
  const stocktake = await db.stocktake.findUnique({
    where: { id: stocktakeId },
    select: {
      id: true,
      status: true,
      note: true,
      startedAt: true,
      countedAt: true,
      closedAt: true,
      startedBy: { select: { name: true, email: true } },
      lines: { select: LINE_SELECT, orderBy: { firstSeenAt: "asc" } },
    },
  });

  if (!stocktake) return null;

  const views = stocktake.lines.map(toLineView);
  const settled = views.filter((line) => line.applied || line.skipped);
  const open = views.filter((line) => !line.applied && !line.skipped);

  return {
    stocktake: {
      id: stocktake.id,
      status: stocktake.status,
      note: stocktake.note,
      startedAt: stocktake.startedAt.toISOString(),
      countedAt: stocktake.countedAt?.toISOString() ?? null,
      closedAt: stocktake.closedAt?.toISOString() ?? null,
      startedBy: stocktake.startedBy?.name ?? stocktake.startedBy?.email ?? null,
      countedPieces: views.reduce((sum, line) => sum + line.countedQty, 0),
      openDifferences: open.filter((line) => line.difference !== 0).length,
    },
    missing: open.filter((line) => line.variantId !== null && (line.difference ?? 0) < 0),
    extra: open.filter((line) => line.variantId !== null && (line.difference ?? 0) > 0),
    unknown: open.filter((line) => line.variantId === null),
    agreedLines: open.filter((line) => line.difference === 0).length,
    settled,
  };
}

/** The list of counts, newest first. */
export async function listStocktakes(): Promise<StocktakeSummary[]> {
  const rows = await db.stocktake.findMany({
    orderBy: { startedAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      note: true,
      startedAt: true,
      countedAt: true,
      closedAt: true,
      startedBy: { select: { name: true, email: true } },
      lines: {
        select: {
          countedQty: true,
          expectedQty: true,
          skippedAt: true,
          appliedMovement: { select: { id: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    note: row.note,
    startedAt: row.startedAt.toISOString(),
    countedAt: row.countedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    startedBy: row.startedBy?.name ?? row.startedBy?.email ?? null,
    countedPieces: row.lines.reduce((sum, line) => sum + line.countedQty, 0),
    openDifferences: row.lines.filter(
      (line) =>
        line.appliedMovement === null &&
        line.skippedAt === null &&
        line.expectedQty !== null &&
        line.countedQty !== line.expectedQty,
    ).length,
  }));
}
