import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { AddressInput } from "@/lib/validations/checkout";

/**
 * The customer address book.
 *
 * Every function is scoped by userId. A caller passing someone else's address
 * id simply finds nothing, which is how IDOR is prevented (spec 8.11) — never
 * by trusting that the id came from the right person's page.
 *
 * IMMUTABILITY: Order.addressId is a live relation, not a snapshot. Editing an
 * address that is already on an order would change the delivery address on
 * that order after the fact, so those rows are archived and replaced rather
 * than mutated.
 */

export type AddressView = {
  id: string;
  fullName: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  isDefault: boolean;
};

const addressSelect = {
  id: true,
  fullName: true,
  line1: true,
  line2: true,
  city: true,
  state: true,
  pincode: true,
  phone: true,
  isDefault: true,
} as const;

export async function listAddresses(userId: string): Promise<AddressView[]> {
  return db.address.findMany({
    where: { userId, isArchived: false },
    orderBy: [{ isDefault: "desc" }, { id: "asc" }],
    select: addressSelect,
  });
}

export async function getAddress(
  userId: string,
  addressId: string,
): Promise<AddressView | null> {
  return db.address.findFirst({
    where: { id: addressId, userId, isArchived: false },
    select: addressSelect,
  });
}

export async function createAddress(
  userId: string,
  input: AddressInput,
): Promise<AddressView> {
  const existingCount = await db.address.count({
    where: { userId, isArchived: false },
  });

  // The first address saved is the default whether or not the box was ticked.
  const isDefault = input.isDefault || existingCount === 0;

  return db.$transaction(async (tx) => {
    if (isDefault) {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }

    return tx.address.create({
      data: {
        userId,
        fullName: input.fullName,
        line1: input.line1,
        line2: emptyToNull(input.line2),
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        phone: input.phone,
        isDefault,
      },
      select: addressSelect,
    });
  });
}

export async function updateAddress(
  userId: string,
  addressId: string,
  input: AddressInput,
): Promise<AddressView> {
  const existing = await db.address.findFirst({
    where: { id: addressId, userId, isArchived: false },
    select: { id: true, isDefault: true, _count: { select: { orders: true } } },
  });

  if (!existing) {
    throw new AppError("ADDRESS_NOT_FOUND", "That address no longer exists.", 404);
  }

  const isDefault = input.isDefault || existing.isDefault;

  // Already used on an order: archive it and save a new row, so the order
  // keeps pointing at the address it was actually shipped to.
  if (existing._count.orders > 0) {
    return db.$transaction(async (tx) => {
      await tx.address.update({
        where: { id: addressId },
        data: { isArchived: true, isDefault: false },
      });

      if (isDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }

      return tx.address.create({
        data: {
          userId,
          fullName: input.fullName,
          line1: input.line1,
          line2: emptyToNull(input.line2),
          city: input.city,
          state: input.state,
          pincode: input.pincode,
          phone: input.phone,
          isDefault,
        },
        select: addressSelect,
      });
    });
  }

  return db.$transaction(async (tx) => {
    if (isDefault) {
      await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }

    return tx.address.update({
      where: { id: addressId },
      data: {
        fullName: input.fullName,
        line1: input.line1,
        line2: emptyToNull(input.line2),
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        phone: input.phone,
        isDefault,
      },
      select: addressSelect,
    });
  });
}

export async function deleteAddress(userId: string, addressId: string): Promise<void> {
  const existing = await db.address.findFirst({
    where: { id: addressId, userId, isArchived: false },
    select: { id: true, isDefault: true, _count: { select: { orders: true } } },
  });

  if (!existing) {
    throw new AppError("ADDRESS_NOT_FOUND", "That address no longer exists.", 404);
  }

  await db.$transaction(async (tx) => {
    if (existing._count.orders > 0) {
      // Hide it from the book but keep the row for those orders.
      await tx.address.update({
        where: { id: addressId },
        data: { isArchived: true, isDefault: false },
      });
    } else {
      await tx.address.delete({ where: { id: addressId } });
    }

    // Never leave the book without a default.
    if (existing.isDefault) {
      const next = await tx.address.findFirst({
        where: { userId, isArchived: false },
        orderBy: { id: "asc" },
        select: { id: true },
      });

      if (next) {
        await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }
  });
}

export async function setDefaultAddress(
  userId: string,
  addressId: string,
): Promise<void> {
  const exists = await db.address.findFirst({
    where: { id: addressId, userId, isArchived: false },
    select: { id: true },
  });

  if (!exists) {
    throw new AppError("ADDRESS_NOT_FOUND", "That address no longer exists.", 404);
  }

  await db.$transaction([
    db.address.updateMany({ where: { userId }, data: { isDefault: false } }),
    db.address.update({ where: { id: addressId }, data: { isDefault: true } }),
  ]);
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
