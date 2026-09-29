import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { SupplierFormInput } from "@/lib/validations/supplier";

/**
 * Weavers and sellers the shop buys from.
 *
 * ADMIN ONLY, all of it. A supplier's name, number and what the shop pays them
 * are commercial information — the same class as cost price — and must never
 * reach a customer route or, later, a STAFF one.
 *
 * A supplier with purchases behind it is never deleted, only deactivated. Old
 * deliveries have to keep naming who supplied the goods.
 */

export type SupplierRow = {
  id: string;
  name: string;
  mobile: string | null;
  notes: string | null;
  isActive: boolean;
  hasPhoto: boolean;
  /** Changes when the photo does, so a replacement busts the cache. */
  photoVersion: string | null;
  purchaseCount: number;
  createdAt: string;
};

export async function listSuppliers(search?: string | null): Promise<SupplierRow[]> {
  const term = search?.trim();

  const rows = await db.supplier.findMany({
    where: term
      ? {
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { mobile: { contains: term } },
          ],
        }
      : undefined,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      mobile: true,
      notes: true,
      isActive: true,
      // The TIMESTAMP, never the bytes. A list only needs to know whether a
      // photo exists; loading a blob per row to answer that would be absurd,
      // and opening one is a deliberate act that gets recorded.
      photoUpdatedAt: true,
      createdAt: true,
      _count: { select: { purchases: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    mobile: row.mobile,
    notes: row.notes,
    isActive: row.isActive,
    hasPhoto: row.photoUpdatedAt !== null,
    photoVersion: row.photoUpdatedAt?.getTime().toString() ?? null,
    purchaseCount: row._count.purchases,
    createdAt: row.createdAt.toISOString(),
  }));
}

/** For the intake screen's picker: active suppliers only, name and number. */
export async function listSupplierOptions(): Promise<
  { id: string; name: string; mobile: string | null }[]
> {
  return db.supplier.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, mobile: true },
  });
}

export async function createSupplier(input: SupplierFormInput): Promise<string> {
  try {
    const created = await db.supplier.create({
      data: {
        name: input.name,
        mobile: input.mobile,
        notes: input.notes?.trim() || null,
        isActive: input.isActive,
      },
      select: { id: true },
    });

    return created.id;
  } catch {
    // The unique index on mobile is the real guard. Checking first and then
    // writing is a race; letting the database refuse it is not.
    throw new AppError(
      "SUPPLIER_EXISTS",
      "A weaver with that mobile number is already on the list.",
      409,
    );
  }
}

export async function updateSupplier(
  id: string,
  input: SupplierFormInput,
): Promise<void> {
  try {
    await db.supplier.update({
      where: { id },
      data: {
        name: input.name,
        mobile: input.mobile,
        notes: input.notes?.trim() || null,
        isActive: input.isActive,
      },
    });
  } catch {
    throw new AppError(
      "SUPPLIER_EXISTS",
      "That mobile number belongs to another weaver on the list.",
      409,
    );
  }
}

/**
 * Removes a supplier, but only one that has never supplied anything.
 *
 * Once there are purchases behind it the record is deactivated instead — a
 * delivery that cannot say who it came from is worth less than a tidy list.
 */
export async function deleteSupplier(id: string): Promise<{ deleted: boolean }> {
  const supplier = await db.supplier.findUnique({
    where: { id },
    select: { _count: { select: { purchases: true } } },
  });

  if (!supplier) {
    throw new AppError("SUPPLIER_NOT_FOUND", "That weaver is not on the list.", 404);
  }

  if (supplier._count.purchases > 0) {
    await db.supplier.update({ where: { id }, data: { isActive: false } });
    return { deleted: false };
  }

  await db.supplier.delete({ where: { id } });
  return { deleted: true };
}
