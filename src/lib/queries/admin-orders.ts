import { OrderStatus, type PaymentMethod, type Prisma } from "@prisma/client";
import { paiseToDecimal } from "@/lib/cart";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { formatInr, toPaise } from "@/lib/format";
import {
  notificationFor,
  onOrderConfirmed,
  onOrderDelivered,
  onOrderShipped,
} from "@/lib/notifications/order-events";
import { canTransition, requiresTracking, restoresStock } from "@/lib/order-status";

/**
 * Admin order management.
 *
 * This is the only place OrderItem.costPrice is read, so profit can be shown.
 * Every caller must already have passed requireAdmin().
 */

export const ADMIN_ORDERS_PAGE_SIZE = 25;

export type AdminOrderRow = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  customerName: string;
  customerEmail: string | null;
  city: string;
  itemCount: number;
  totalFormatted: string;
  profitFormatted: string;
  placedAt: string;
};

export type AdminOrderList = {
  rows: AdminOrderRow[];
  total: number;
  page: number;
  pageCount: number;
  /** Count per status, for the filter chips. */
  counts: Record<string, number>;
};

export async function listAdminOrders(filters: {
  status?: string | null;
  paymentMethod?: string | null;
  q?: string | null;
  page?: number;
}): Promise<AdminOrderList> {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const and: Prisma.OrderWhereInput[] = [];

  if (filters.status && filters.status in OrderStatus) {
    and.push({ status: filters.status as OrderStatus });
  }

  if (filters.paymentMethod === "COD" || filters.paymentMethod === "PREPAID") {
    and.push({ paymentMethod: filters.paymentMethod });
  }

  if (filters.q) {
    and.push({
      OR: [
        { orderNumber: { contains: filters.q, mode: "insensitive" } },
        { user: { name: { contains: filters.q, mode: "insensitive" } } },
        { user: { email: { contains: filters.q, mode: "insensitive" } } },
      ],
    });
  }

  const where: Prisma.OrderWhereInput = and.length > 0 ? { AND: and } : {};

  const [total, orders, grouped] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_ORDERS_PAGE_SIZE,
      take: ADMIN_ORDERS_PAGE_SIZE,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentMethod: true,
        total: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        address: { select: { city: true } },
        // Admin opts IN to cost price.
        items: { select: { price: true, costPrice: true, quantity: true } },
      },
    }),
    db.order.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const counts: Record<string, number> = {};
  for (const group of grouped) counts[group.status] = group._count._all;

  return {
    rows: orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentMethod: order.paymentMethod,
      customerName: order.user.name,
      customerEmail: order.user.email,
      city: order.address.city,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      totalFormatted: formatInr(order.total.toString()),
      profitFormatted: formatInr(profitOf(order.items)),
      placedAt: order.createdAt.toISOString(),
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / ADMIN_ORDERS_PAGE_SIZE)),
    counts,
  };
}

/** Margin on an order, in integer paise. Admin eyes only. */
function profitOf(
  items: { price: Prisma.Decimal; costPrice: Prisma.Decimal; quantity: number }[],
): string {
  const paise = items.reduce(
    (sum, item) =>
      sum +
      (toPaise(item.price.toString()) - toPaise(item.costPrice.toString())) *
        item.quantity,
    0,
  );

  return paiseToDecimal(paise);
}

export type AdminOrderDetail = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  customer: { name: string; email: string | null; phone: string | null };
  address: {
    fullName: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    pincode: string;
    phone: string;
  };
  items: {
    productName: string;
    productImage: string;
    size: string | null;
    priceFormatted: string;
    costFormatted: string;
    quantity: number;
    lineTotalFormatted: string;
    lineProfitFormatted: string;
  }[];
  subtotalFormatted: string;
  shippingFormatted: string;
  /** Null when the order carried no GST. */
  taxFormatted: string | null;
  /** True when the GST sat inside the prices rather than on top. */
  taxIncluded: boolean;
  totalFormatted: string;
  profitFormatted: string;
  marginPercent: number | null;
  courierName: string | null;
  trackingNumber: string | null;
  placedAt: string;
  history: {
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    note: string | null;
    by: string | null;
    at: string;
  }[];
};

export async function getAdminOrder(
  orderNumber: string,
): Promise<AdminOrderDetail | null> {
  const order = await db.order.findUnique({
    where: { orderNumber },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentMethod: true,
      subtotal: true,
      shippingCharge: true,
      taxAmount: true,
      total: true,
      courierName: true,
      trackingNumber: true,
      createdAt: true,
      user: { select: { name: true, email: true, phone: true } },
      address: {
        select: {
          fullName: true,
          line1: true,
          line2: true,
          city: true,
          state: true,
          pincode: true,
          phone: true,
        },
      },
      items: {
        select: {
          productName: true,
          productImage: true,
          size: true,
          price: true,
          costPrice: true,
          quantity: true,
        },
      },
      statusHistory: {
        orderBy: { createdAt: "asc" },
        select: {
          fromStatus: true,
          toStatus: true,
          note: true,
          createdAt: true,
          changedBy: { select: { name: true, email: true } },
        },
      },
    },
  });

  if (!order) return null;

  const profit = profitOf(order.items);
  const totalPaise = toPaise(order.total.toString());
  const profitPaise = toPaise(profit);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    customer: order.user,
    address: order.address,
    items: order.items.map((item) => {
      const unit = toPaise(item.price.toString());
      const cost = toPaise(item.costPrice.toString());

      return {
        productName: item.productName,
        productImage: item.productImage,
        size: item.size,
        priceFormatted: formatInr(item.price.toString()),
        costFormatted: formatInr(item.costPrice.toString()),
        quantity: item.quantity,
        lineTotalFormatted: formatInr(paiseToDecimal(unit * item.quantity)),
        lineProfitFormatted: formatInr(paiseToDecimal((unit - cost) * item.quantity)),
      };
    }),
    subtotalFormatted: formatInr(order.subtotal.toString()),
    shippingFormatted: formatInr(order.shippingCharge.toString()),
    taxFormatted:
      toPaise(order.taxAmount.toString()) > 0
        ? formatInr(order.taxAmount.toString())
        : null,
    // Derived from this order's own figures, so it stays right after the
    // shop changes its tax settings.
    taxIncluded:
      totalPaise === toPaise(order.subtotal.toString()) +
        toPaise(order.shippingCharge.toString()),
    totalFormatted: formatInr(order.total.toString()),
    profitFormatted: formatInr(profit),
    marginPercent: totalPaise > 0 ? Math.round((profitPaise / totalPaise) * 100) : null,
    courierName: order.courierName,
    trackingNumber: order.trackingNumber,
    placedAt: order.createdAt.toISOString(),
    history: order.statusHistory.map((entry) => ({
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      note: entry.note,
      by: entry.changedBy?.name ?? entry.changedBy?.email ?? null,
      at: entry.createdAt.toISOString(),
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Status transitions                                                  */
/* ------------------------------------------------------------------ */

export type TransitionInput = {
  orderId: string;
  to: OrderStatus;
  adminId: string;
  courierName?: string;
  trackingNumber?: string;
  note?: string;
};

/**
 * Moves an order to its next status.
 *
 * The status change, the audit-trail row and any stock restoration all happen
 * in ONE transaction (spec section 7), and the update is conditional on the
 * order still being in the status we read — so two admins clicking at once
 * cannot both apply a transition.
 *
 * The customer notification fires AFTER the transaction commits. Holding a
 * database transaction open across an email send would be slow, and a mail
 * failure must not roll back a shipment that really happened.
 */
export async function transitionOrder(input: TransitionInput): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      status: true,
      items: { select: { variantId: true, quantity: true } },
    },
  });

  if (!order) {
    throw new AppError("ORDER_NOT_FOUND", "That order no longer exists.", 404);
  }

  if (order.status === input.to) {
    throw new AppError(
      "NO_CHANGE",
      `This order is already marked ${input.to.toLowerCase()}.`,
      400,
    );
  }

  if (!canTransition(order.status, input.to)) {
    throw new AppError(
      "INVALID_TRANSITION",
      `An order that is ${order.status.toLowerCase()} cannot be marked ${input.to.toLowerCase()}.`,
      400,
    );
  }

  if (requiresTracking(input.to)) {
    if (!input.courierName?.trim() || !input.trackingNumber?.trim()) {
      throw new AppError(
        "TRACKING_REQUIRED",
        "Enter the courier name and tracking number before marking this shipped.",
        400,
      );
    }
  }

  const now = new Date();

  await db.$transaction(async (tx) => {
    // Conditional on the status we read, so a concurrent change loses.
    const updated = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: {
        status: input.to,
        ...(input.to === OrderStatus.SHIPPED
          ? {
              courierName: input.courierName?.trim(),
              trackingNumber: input.trackingNumber?.trim(),
              shippedAt: now,
            }
          : {}),
        ...(input.to === OrderStatus.DELIVERED ? { deliveredAt: now } : {}),
      },
    });

    if (updated.count === 0) {
      throw new AppError(
        "CONFLICT",
        "Someone else just changed this order. Reload and try again.",
        409,
      );
    }

    // Audit trail, in the same transaction (spec section 7).
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: input.to,
        changedById: input.adminId,
        note: input.note?.trim() || null,
      },
    });

    // Cancelling puts the goods back on the shelf.
    if (restoresStock(input.to)) {
      for (const item of order.items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQty: { increment: item.quantity } },
        });
      }
    }
  });

  // Committed. Now tell the customer — failures here are logged, not thrown.
  const event = notificationFor(input.to);

  if (event === "CONFIRMED") await onOrderConfirmed(order.id);
  else if (event === "SHIPPED") await onOrderShipped(order.id);
  else if (event === "DELIVERED") await onOrderDelivered(order.id);
}
