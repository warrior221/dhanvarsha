import type { OrderStatus, PaymentMethod } from "@/generated/prisma";
import { paiseToDecimal } from "@/lib/cart";
import { db } from "@/lib/db";
import { formatInr, toPaise } from "@/lib/format";

/**
 * Customer-facing order queries.
 *
 * OrderItem carries a costPrice snapshot for profit reporting. It is
 * deliberately absent from every select here — leaking what the shop paid a
 * supplier to the person buying it is exactly what spec 1.3 forbids. Admin
 * order queries opt in separately.
 *
 * Every function is scoped by userId, so requesting another customer's order
 * finds nothing (spec 8.11).
 */

export type OrderSummaryView = {
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  total: string;
  totalFormatted: string;
  itemCount: number;
  placedAt: string;
  firstImage: string | null;
  firstProductName: string | null;
};

export type OrderDetailView = {
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  subtotal: string;
  shippingCharge: string;
  taxAmount: string;
  total: string;
  courierName: string | null;
  trackingNumber: string | null;
  placedAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
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
    price: string;
    quantity: number;
    lineTotalFormatted: string;
  }[];
  history: {
    toStatus: OrderStatus;
    note: string | null;
    at: string;
  }[];
};

export async function listCustomerOrders(userId: string): Promise<OrderSummaryView[]> {
  const orders = await db.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      orderNumber: true,
      status: true,
      paymentMethod: true,
      total: true,
      createdAt: true,
      items: {
        // NOTE: no costPrice.
        select: { productName: true, productImage: true, quantity: true },
      },
    },
  });

  return orders.map((order) => ({
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    total: order.total.toString(),
    totalFormatted: formatInr(order.total.toString()),
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    placedAt: order.createdAt.toISOString(),
    firstImage: order.items[0]?.productImage ?? null,
    firstProductName: order.items[0]?.productName ?? null,
  }));
}

export async function getCustomerOrder(
  userId: string,
  orderNumber: string,
): Promise<OrderDetailView | null> {
  const order = await db.order.findFirst({
    // Scoped by userId: another customer's order number simply is not found.
    where: { orderNumber, userId },
    select: {
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
      shippedAt: true,
      deliveredAt: true,
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
        // NOTE: no costPrice.
        select: {
          productName: true,
          productImage: true,
          size: true,
          price: true,
          quantity: true,
        },
      },
      statusHistory: {
        orderBy: { createdAt: "asc" },
        select: { toStatus: true, note: true, createdAt: true },
      },
    },
  });

  if (!order) return null;

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentMethod: order.paymentMethod,
    subtotal: order.subtotal.toString(),
    shippingCharge: order.shippingCharge.toString(),
    taxAmount: order.taxAmount.toString(),
    total: order.total.toString(),
    courierName: order.courierName,
    trackingNumber: order.trackingNumber,
    placedAt: order.createdAt.toISOString(),
    shippedAt: order.shippedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    address: order.address,
    items: order.items.map((item) => {
      const unit = item.price.toString();
      // Integer paise, never Number(...) * quantity — money must not round
      // through float (spec 1.4).
      const lineTotal = paiseToDecimal(toPaise(unit) * item.quantity);

      return {
        productName: item.productName,
        productImage: item.productImage,
        size: item.size,
        price: unit,
        quantity: item.quantity,
        lineTotalFormatted: formatInr(lineTotal),
      };
    }),
    history: order.statusHistory.map((entry) => ({
      toStatus: entry.toStatus,
      note: entry.note,
      at: entry.createdAt.toISOString(),
    })),
  };
}
