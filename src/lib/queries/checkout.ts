import { OrderStatus, PaymentMethod, Prisma } from "@prisma/client";
import { paiseToDecimal } from "@/lib/cart";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { formatInr, toPaise } from "@/lib/format";
import { generateOrderNumber } from "@/lib/order-number";

/**
 * Checkout: what the order costs, and placing it.
 *
 * Every amount here is recomputed on the server from the database. Nothing the
 * browser sends about price, quantity or total is trusted (spec 8.4).
 *
 * TAX: taxAmount is recorded as 0 because prices are treated as GST-inclusive,
 * which is how Indian retail normally displays them — the MRP on the tag is
 * what the customer pays. If the business needs GST broken out as a separate
 * line on invoices, that is an accounting decision to confirm before go-live,
 * and the Order.taxAmount column is already there to hold it.
 */

export type OrderTotals = {
  subtotal: string;
  shippingCharge: string;
  taxAmount: string;
  total: string;
  subtotalFormatted: string;
  /** Delivery only, WITHOUT the cash-on-delivery handling fee. */
  shippingFormatted: string;
  /** Shown as its own line, so "free delivery" is not contradicted by a fee. */
  codFeeFormatted: string | null;
  totalFormatted: string;
  /** Which shipping rule applied, for display. */
  shippingRuleName: string | null;
  /** How much more to spend to reach the next cheaper shipping tier. */
  freeShippingGap: { amountFormatted: string; ruleName: string } | null;
};

type CartLine = {
  variantId: string;
  quantity: number;
  unitPricePaise: number;
};

/** Reads the signed-in user's cart lines straight from the database. */
async function readCartLines(userId: string): Promise<CartLine[]> {
  const cart = await db.cart.findUnique({
    where: { userId },
    select: {
      items: {
        select: {
          quantity: true,
          variant: {
            select: {
              id: true,
              price: true,
              product: { select: { isActive: true } },
            },
          },
        },
      },
    },
  });

  if (!cart) return [];

  return cart.items
    .filter((item) => item.variant.product.isActive)
    .map((item) => ({
      variantId: item.variant.id,
      quantity: item.quantity,
      unitPricePaise: toPaise(item.variant.price.toString()),
    }));
}

/**
 * Picks the shipping rule with the highest minSubtotal the order reaches, so
 * "free over 2000" naturally beats "99 from 0".
 */
async function resolveShipping(
  subtotalPaise: number,
  paymentMethod: PaymentMethod,
): Promise<{
  chargePaise: number;
  codFeePaise: number;
  ruleName: string | null;
  nextTier: { amountPaise: number; ruleName: string } | null;
}> {
  const rules = await db.shippingRule.findMany({
    where: { isActive: true },
    orderBy: { minSubtotal: "asc" },
  });

  if (rules.length === 0) {
    // No rules configured: charge nothing rather than invent a number.
    return { chargePaise: 0, codFeePaise: 0, ruleName: null, nextTier: null };
  }

  let applied = null as (typeof rules)[number] | null;

  for (const rule of rules) {
    if (subtotalPaise >= toPaise(rule.minSubtotal.toString())) applied = rule;
  }

  if (!applied) {
    return { chargePaise: 0, codFeePaise: 0, ruleName: null, nextTier: null };
  }

  const base = toPaise(applied.charge.toString());
  const cod =
    paymentMethod === PaymentMethod.COD ? toPaise(applied.codExtraCharge.toString()) : 0;

  // Is there a cheaper tier just above? Worth telling the shopper about.
  const cheaperAbove = rules.find(
    (rule) =>
      toPaise(rule.minSubtotal.toString()) > subtotalPaise &&
      toPaise(rule.charge.toString()) < base,
  );

  return {
    chargePaise: base,
    codFeePaise: cod,
    ruleName: applied.name,
    nextTier: cheaperAbove
      ? {
          amountPaise: toPaise(cheaperAbove.minSubtotal.toString()) - subtotalPaise,
          ruleName: cheaperAbove.name,
        }
      : null,
  };
}

export async function computeOrderTotals(
  userId: string,
  paymentMethod: PaymentMethod,
): Promise<OrderTotals> {
  const lines = await readCartLines(userId);

  const subtotalPaise = lines.reduce(
    (sum, line) => sum + line.unitPricePaise * line.quantity,
    0,
  );

  const shipping = await resolveShipping(subtotalPaise, paymentMethod);
  const taxPaise = 0;
  // Order.shippingCharge holds the combined figure; the two are only split
  // apart for display.
  const deliveryPaise = shipping.chargePaise + shipping.codFeePaise;
  const totalPaise = subtotalPaise + deliveryPaise + taxPaise;

  const subtotal = paiseToDecimal(subtotalPaise);
  const shippingCharge = paiseToDecimal(deliveryPaise);
  const total = paiseToDecimal(totalPaise);

  return {
    subtotal,
    shippingCharge,
    taxAmount: paiseToDecimal(taxPaise),
    total,
    subtotalFormatted: formatInr(subtotal),
    shippingFormatted:
      shipping.chargePaise === 0
        ? "Free"
        : formatInr(paiseToDecimal(shipping.chargePaise)),
    codFeeFormatted:
      shipping.codFeePaise > 0
        ? formatInr(paiseToDecimal(shipping.codFeePaise))
        : null,
    totalFormatted: formatInr(total),
    shippingRuleName: shipping.ruleName,
    freeShippingGap: shipping.nextTier
      ? {
          amountFormatted: formatInr(paiseToDecimal(shipping.nextTier.amountPaise)),
          ruleName: shipping.nextTier.ruleName,
        }
      : null,
  };
}

/* ------------------------------------------------------------------ */
/* Placing the order                                                   */
/* ------------------------------------------------------------------ */

export type PlacedOrder = { orderNumber: string; total: string };

/**
 * Creates a cash-on-delivery order.
 *
 * EVERYTHING happens in one transaction (spec 1.5 / 8.5): stock is checked and
 * decremented, the order and its items are written, the audit trail is started
 * and the cart is emptied. If any step fails, none of it happened.
 *
 * Stock is taken with a CONDITIONAL update — `where stockQty >= quantity` — and
 * the affected row count is checked. That is an atomic compare-and-set, so two
 * customers racing for the last piece cannot both succeed; the loser is told it
 * just sold out rather than the shop overselling.
 */
export async function placeCodOrder(
  userId: string,
  addressId: string,
): Promise<PlacedOrder> {
  // The address must belong to this user (spec 8.11).
  const address = await db.address.findFirst({
    where: { id: addressId, userId },
    select: { id: true },
  });

  if (!address) {
    throw new AppError("ADDRESS_NOT_FOUND", "Choose a delivery address first.", 400);
  }

  // Retry only for an order-number collision, which the unique index catches.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await createOrderTransaction(userId, addressId);
    } catch (error) {
      const isDuplicateOrderNumber =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        String(error.meta?.target ?? "").includes("orderNumber");

      if (!isDuplicateOrderNumber) throw error;
    }
  }

  throw new AppError(
    "ORDER_NUMBER_CLASH",
    "We could not place that order just now. Please try again.",
    500,
  );
}

async function createOrderTransaction(
  userId: string,
  addressId: string,
): Promise<PlacedOrder> {
  return db.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({
      where: { userId },
      select: {
        id: true,
        items: {
          select: {
            quantity: true,
            variant: {
              select: {
                id: true,
                size: true,
                price: true,
                product: {
                  select: {
                    name: true,
                    isActive: true,
                    images: {
                      select: { url: true },
                      orderBy: { position: "asc" },
                      take: 1,
                    },
                    cost: { select: { costPrice: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const lines = (cart?.items ?? []).filter((item) => item.variant.product.isActive);

    if (!cart || lines.length === 0) {
      throw new AppError("CART_EMPTY", "Your bag is empty.", 400);
    }

    let subtotalPaise = 0;

    const orderItems = lines.map((item) => {
      const unitPaise = toPaise(item.variant.price.toString());
      subtotalPaise += unitPaise * item.quantity;

      return {
        variantId: item.variant.id,
        // Snapshots, so editing the product later cannot rewrite this order.
        productName: item.variant.product.name,
        productImage: item.variant.product.images[0]?.url ?? "",
        size: item.variant.size,
        price: item.variant.price,
        costPrice: item.variant.product.cost?.costPrice ?? new Prisma.Decimal(0),
        quantity: item.quantity,
      };
    });

    // Take the stock. Conditional on there being enough, so a race loses
    // rather than overselling.
    for (const item of lines) {
      const taken = await tx.productVariant.updateMany({
        where: { id: item.variant.id, stockQty: { gte: item.quantity } },
        data: { stockQty: { decrement: item.quantity } },
      });

      if (taken.count === 0) {
        throw new AppError(
          "INSUFFICIENT_STOCK",
          `"${item.variant.product.name}"${item.variant.size ? ` (${item.variant.size})` : ""} just sold out. Please adjust your bag and try again.`,
          409,
        );
      }
    }

    const shipping = await resolveShipping(subtotalPaise, PaymentMethod.COD);
    const taxPaise = 0;
    const deliveryPaise = shipping.chargePaise + shipping.codFeePaise;
    const totalPaise = subtotalPaise + deliveryPaise + taxPaise;

    const order = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId,
        addressId,
        status: OrderStatus.PENDING,
        paymentMethod: PaymentMethod.COD,
        subtotal: paiseToDecimal(subtotalPaise),
        shippingCharge: paiseToDecimal(deliveryPaise),
        taxAmount: paiseToDecimal(taxPaise),
        total: paiseToDecimal(totalPaise),
        items: { create: orderItems },
        // Audit trail starts here, written in the same transaction (spec 7).
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: OrderStatus.PENDING,
            changedById: userId,
            note: "Order placed (cash on delivery).",
          },
        },
      },
      select: { orderNumber: true, total: true },
    });

    // The bag has become an order.
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

    return { orderNumber: order.orderNumber, total: order.total.toString() };
  });
}
