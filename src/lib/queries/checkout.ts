import { OrderStatus, PaymentMethod, Prisma } from "@prisma/client";
import { paiseToDecimal } from "@/lib/cart";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { formatInr, toPaise } from "@/lib/format";
import { generateOrderNumber } from "@/lib/order-number";
import { getTaxSettings } from "@/lib/queries/settings";
import { computeTax, type TaxSettings, taxLineLabel, toBasisPoints } from "@/lib/tax";

/**
 * Checkout: what the order costs, and placing it.
 *
 * Every amount here is recomputed on the server from the database. Nothing the
 * browser sends about price, quantity or total is trusted (spec 8.4).
 *
 * TAX: the GST rate, and whether displayed prices already contain it, come
 * from the StoreSetting row the owner edits in Admin → Settings. With prices
 * marked inclusive the tax is worked backwards out of the subtotal and the
 * total is unchanged; with prices marked exclusive it is added on top. Both
 * are recorded in Order.taxAmount so an invoice can show the split.
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
  /** "Includes GST (5%)" or "GST (5%)". Null when the rate is 0. */
  taxLabel: string | null;
  /** The GST figure, formatted. Null when the rate is 0. */
  taxFormatted: string | null;
  /** True when the tax sits inside the subtotal rather than on top of it. */
  taxIncluded: boolean;
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
 * The shop's charging rules, read once.
 *
 * These are loaded BEFORE the order transaction opens and passed in. Neon sits
 * a long way from here and every round trip inside an interactive transaction
 * counts against its 5-second budget — a budget that must be spent on taking
 * stock, not on re-reading settings that cannot change mid-order.
 */
type CheckoutConfig = {
  shippingRules: ShippingRuleSnapshot[];
  tax: TaxSettings;
};

type ShippingRuleSnapshot = {
  name: string;
  minSubtotal: string;
  charge: string;
  codExtraCharge: string;
};

async function loadCheckoutConfig(): Promise<CheckoutConfig> {
  const [rules, tax] = await Promise.all([
    db.shippingRule.findMany({
      where: { isActive: true },
      orderBy: { minSubtotal: "asc" },
      select: {
        name: true,
        minSubtotal: true,
        charge: true,
        codExtraCharge: true,
      },
    }),
    getTaxSettings(),
  ]);

  return {
    shippingRules: rules.map((rule) => ({
      name: rule.name,
      minSubtotal: rule.minSubtotal.toString(),
      charge: rule.charge.toString(),
      codExtraCharge: rule.codExtraCharge.toString(),
    })),
    tax,
  };
}

/**
 * Picks the shipping rule with the highest minSubtotal the order reaches, so
 * "free over 2000" naturally beats "99 from 0".
 */
function resolveShipping(
  rules: ShippingRuleSnapshot[],
  subtotalPaise: number,
  paymentMethod: PaymentMethod,
): {
  chargePaise: number;
  codFeePaise: number;
  ruleName: string | null;
  nextTier: { amountPaise: number; ruleName: string } | null;
} {
  if (rules.length === 0) {
    // No rules configured: charge nothing rather than invent a number.
    return { chargePaise: 0, codFeePaise: 0, ruleName: null, nextTier: null };
  }

  let applied: ShippingRuleSnapshot | null = null;

  for (const rule of rules) {
    if (subtotalPaise >= toPaise(rule.minSubtotal)) applied = rule;
  }

  if (!applied) {
    return { chargePaise: 0, codFeePaise: 0, ruleName: null, nextTier: null };
  }

  const base = toPaise(applied.charge);
  const cod =
    paymentMethod === PaymentMethod.COD ? toPaise(applied.codExtraCharge) : 0;

  // Is there a cheaper tier just above? Worth telling the shopper about.
  const cheaperAbove = rules.find(
    (rule) => toPaise(rule.minSubtotal) > subtotalPaise && toPaise(rule.charge) < base,
  );

  return {
    chargePaise: base,
    codFeePaise: cod,
    ruleName: applied.name,
    nextTier: cheaperAbove
      ? {
          amountPaise: toPaise(cheaperAbove.minSubtotal) - subtotalPaise,
          ruleName: cheaperAbove.name,
        }
      : null,
  };
}

/**
 * Works out the GST on a goods subtotal using the shop's current settings.
 *
 * `addedPaise` is what the tax adds to the bill: zero when prices already
 * include it. Keeping that separate from `taxPaise` is what stops an
 * inclusive-tax shop charging the tax twice.
 */
function resolveTax(
  settings: TaxSettings,
  subtotalPaise: number,
): {
  taxPaise: number;
  addedPaise: number;
  label: string | null;
  inclusive: boolean;
} {
  const basisPoints = toBasisPoints(settings.gstRate);

  if (basisPoints <= 0) {
    return {
      taxPaise: 0,
      addedPaise: 0,
      label: null,
      inclusive: settings.pricesIncludeTax,
    };
  }

  const breakdown = computeTax(subtotalPaise, basisPoints, settings.pricesIncludeTax);

  return {
    taxPaise: breakdown.taxPaise,
    addedPaise: settings.pricesIncludeTax ? 0 : breakdown.taxPaise,
    label: taxLineLabel(settings.gstRate, settings.pricesIncludeTax),
    inclusive: settings.pricesIncludeTax,
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

  const config = await loadCheckoutConfig();
  const shipping = resolveShipping(config.shippingRules, subtotalPaise, paymentMethod);
  const tax = resolveTax(config.tax, subtotalPaise);
  // Order.shippingCharge holds the combined figure; the two are only split
  // apart for display.
  const deliveryPaise = shipping.chargePaise + shipping.codFeePaise;
  // addedPaise, not taxPaise: inclusive GST is already inside the subtotal.
  const totalPaise = subtotalPaise + deliveryPaise + tax.addedPaise;

  const subtotal = paiseToDecimal(subtotalPaise);
  const shippingCharge = paiseToDecimal(deliveryPaise);
  const total = paiseToDecimal(totalPaise);

  return {
    subtotal,
    shippingCharge,
    taxAmount: paiseToDecimal(tax.taxPaise),
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
    taxLabel: tax.label,
    taxFormatted: tax.label ? formatInr(paiseToDecimal(tax.taxPaise)) : null,
    taxIncluded: tax.inclusive,
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

  // Read the charging rules before opening the transaction, not inside it.
  const config = await loadCheckoutConfig();

  // Retry only for an order-number collision, which the unique index catches.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await createOrderTransaction(userId, addressId, config);
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
  config: CheckoutConfig,
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

    // Pure: no database round trip inside the transaction.
    const shipping = resolveShipping(
      config.shippingRules,
      subtotalPaise,
      PaymentMethod.COD,
    );
    const tax = resolveTax(config.tax, subtotalPaise);
    const deliveryPaise = shipping.chargePaise + shipping.codFeePaise;
    // Must match computeOrderTotals exactly, or the customer is charged
    // something other than the figure they agreed to.
    const totalPaise = subtotalPaise + deliveryPaise + tax.addedPaise;

    const order = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId,
        addressId,
        status: OrderStatus.PENDING,
        paymentMethod: PaymentMethod.COD,
        subtotal: paiseToDecimal(subtotalPaise),
        shippingCharge: paiseToDecimal(deliveryPaise),
        taxAmount: paiseToDecimal(tax.taxPaise),
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
