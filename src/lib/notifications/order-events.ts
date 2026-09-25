import { OrderStatus, PaymentMethod } from "@/generated/prisma";
import { paiseToDecimal } from "@/lib/cart";
import { db } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email/client";
import {
  OrderEventEmail,
  subjectFor,
  type OrderEventKind,
} from "@/lib/email/templates/order-event";
import { formatInr, toPaise } from "@/lib/format";

/**
 * Customer notifications for order events (spec section 7).
 *
 * Deliberately channel-agnostic: one function per event, each dispatching to
 * whatever channels are switched on. Adding WhatsApp once Meta Business
 * verification is done means one extra case in `dispatch`, not a rewrite.
 *
 * There are no admin notifications by design — the spec says so, and the
 * dashboard shows new orders instead.
 *
 * NOTHING here is allowed to throw. These run after the status change has
 * already been committed; a mail server having a bad day must not make it look
 * as though the order failed to update.
 */

type Channel = "EMAIL" | "WHATSAPP";

/** Which channels are live. WhatsApp stays off until Meta verification. */
function enabledChannels(): Channel[] {
  const channels: Channel[] = [];
  if (isEmailConfigured()) channels.push("EMAIL");
  return channels;
}

export async function onOrderConfirmed(orderId: string): Promise<void> {
  await notify(orderId, "CONFIRMED");
}

export async function onOrderShipped(orderId: string): Promise<void> {
  await notify(orderId, "SHIPPED");
}

export async function onOrderDelivered(orderId: string): Promise<void> {
  await notify(orderId, "DELIVERED");
}

/** Maps a new status onto its event, or null when nothing is sent. */
export function notificationFor(status: OrderStatus): OrderEventKind | null {
  switch (status) {
    case OrderStatus.CONFIRMED:
      return "CONFIRMED";
    case OrderStatus.SHIPPED:
      return "SHIPPED";
    case OrderStatus.DELIVERED:
      return "DELIVERED";
    default:
      // Cancellations and returns are handled by a person, not a template.
      return null;
  }
}

async function notify(orderId: string, kind: OrderEventKind): Promise<void> {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        orderNumber: true,
        total: true,
        paymentMethod: true,
        courierName: true,
        trackingNumber: true,
        user: { select: { name: true, email: true } },
        items: {
          // No costPrice: this goes to the customer.
          select: { productName: true, size: true, price: true, quantity: true },
        },
      },
    });

    if (!order?.user.email) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const payload = {
      kind,
      customerName: order.user.name || "there",
      orderNumber: order.orderNumber,
      orderUrl: `${appUrl}/account/orders/${order.orderNumber}`,
      totalFormatted: formatInr(order.total.toString()),
      isCod: order.paymentMethod === PaymentMethod.COD,
      items: order.items.map((item) => ({
        name: item.productName,
        size: item.size,
        quantity: item.quantity,
        // Integer paise; never float (spec 1.4).
        lineTotal: formatInr(
          paiseToDecimal(toPaise(item.price.toString()) * item.quantity),
        ),
      })),
      courierName: order.courierName,
      trackingNumber: order.trackingNumber,
    };

    for (const channel of enabledChannels()) {
      await dispatch(channel, order.user.email, payload);
    }
  } catch (error) {
    // Logged, never rethrown — see the note at the top of this file.
    console.error(`[notifications] ${kind} for order ${orderId} failed:`, error);
  }
}

type Payload = Parameters<typeof OrderEventEmail>[0];

async function dispatch(
  channel: Channel,
  to: string,
  payload: Payload,
): Promise<void> {
  switch (channel) {
    case "EMAIL":
      await sendEmail({
        to,
        subject: subjectFor(payload.kind, payload.orderNumber),
        react: OrderEventEmail(payload),
      });
      return;

    case "WHATSAPP":
      // Deferred until Meta Business verification. Listed so the gap is
      // visible rather than silently missing.
      return;
  }
}
