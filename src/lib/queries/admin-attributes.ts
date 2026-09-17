import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  slugify,
  type AttributeInput,
  type AttributeValueInput,
} from "@/lib/validations/product";

/**
 * Attribute management.
 *
 * Nothing about attributes is hardcoded anywhere in the app: the customer
 * filter sidebar and the product form both render from these rows, so a value
 * created here appears in both immediately (spec 1.1 / 7).
 */

export type AdminAttribute = {
  id: string;
  name: string;
  slug: string;
  inputType: "CHECKBOX" | "SELECT";
  isFilterable: boolean;
  isRequired: boolean;
  position: number;
  values: {
    id: string;
    value: string;
    slug: string;
    position: number;
    /** How many products carry this value — shown before deleting. */
    productCount: number;
  }[];
};

export async function listAdminAttributes(): Promise<AdminAttribute[]> {
  const attributes = await db.attribute.findMany({
    orderBy: { position: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      inputType: true,
      isFilterable: true,
      isRequired: true,
      position: true,
      values: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          value: true,
          slug: true,
          position: true,
          _count: { select: { products: true } },
        },
      },
    },
  });

  return attributes.map((attribute) => ({
    ...attribute,
    values: attribute.values.map((value) => ({
      id: value.id,
      value: value.value,
      slug: value.slug,
      position: value.position,
      productCount: value._count.products,
    })),
  }));
}

export async function createAttribute(input: AttributeInput) {
  const existing = await db.attribute.findFirst({
    where: { OR: [{ slug: input.slug }, { name: input.name }] },
    select: { id: true },
  });

  if (existing) {
    throw new AppError("DUPLICATE", `"${input.name}" already exists.`, 409);
  }

  return db.attribute.create({
    data: input,
    select: { id: true, name: true, slug: true },
  });
}

/**
 * Creates one value. Used both by the attribute manager and by the "add new"
 * box inside the product form, which is why it returns the full row — the form
 * ticks it the moment it comes back.
 */
export async function createAttributeValue(input: AttributeValueInput) {
  const attribute = await db.attribute.findUnique({
    where: { id: input.attributeId },
    select: { id: true, name: true },
  });

  if (!attribute) {
    throw new AppError("ATTRIBUTE_NOT_FOUND", "That attribute no longer exists.", 404);
  }

  const slug = input.slug ?? slugify(input.value);

  if (!slug) {
    throw new AppError("INVALID_VALUE", "That value cannot be used as a filter name.", 422);
  }

  const existing = await db.attributeValue.findUnique({
    where: { attributeId_slug: { attributeId: attribute.id, slug } },
    select: { id: true, value: true, slug: true, position: true },
  });

  // Adding something that already exists just selects it, rather than erroring
  // at someone who is mid-way through a product form.
  if (existing) return { ...existing, created: false };

  const last = await db.attributeValue.findFirst({
    where: { attributeId: attribute.id },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const created = await db.attributeValue.create({
    data: {
      attributeId: attribute.id,
      value: input.value,
      slug,
      position: input.position || (last?.position ?? 0) + 1,
    },
    select: { id: true, value: true, slug: true, position: true },
  });

  return { ...created, created: true };
}

export async function updateAttribute(
  id: string,
  input: Partial<AttributeInput>,
): Promise<void> {
  await db.attribute.update({ where: { id }, data: input });
}

export async function deleteAttributeValue(id: string): Promise<void> {
  // Deleting a value only untags products; it never touches order history,
  // because OrderItem snapshots its own copy of the product details.
  await db.attributeValue.delete({ where: { id } });
}

export async function deleteAttribute(id: string): Promise<void> {
  await db.attribute.delete({ where: { id } });
}
