import { toPaise } from "@/lib/format";
import { db } from "@/lib/db";
import { formatInr } from "@/lib/format";
import { getTaxSettings } from "@/lib/queries/settings";

/**
 * The receipt for one order.
 *
 * CUSTOMER-SAFE BY CONSTRUCTION. costPrice is never selected, so there is no
 * path by which a margin could reach a printed page — including the admin's
 * copy, which is the same document. A receipt is what goes in the parcel and
 * into the customer's hands; the admin's profit figures live on the order
 * screen, not here.
 *
 * Everything shown is the SNAPSHOT taken when the order was placed: the
 * product names and prices are copied onto the order line, and editing a
 * delivery address archives the old row rather than overwriting it. A receipt
 * that silently rewrote itself when a customer moved house would be worthless
 * as a record.
 */

export type ReceiptLine = {
  productName: string;
  size: string | null;
  quantity: number;
  unitFormatted: string;
  lineTotalFormatted: string;
};

export type Receipt = {
  orderNumber: string;
  placedAt: string;
  status: string;
  paymentMethod: "COD" | "PREPAID";
  shop: {
    name: string;
    legalName: string | null;
    gstin: string | null;
  };
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
  lines: ReceiptLine[];
  subtotalFormatted: string;
  shippingFormatted: string;
  /** Null when the order carried no GST. */
  taxFormatted: string | null;
  /** True when GST sat inside the prices rather than being added on top. */
  taxIncluded: boolean;
  totalFormatted: string;
  courierName: string | null;
  trackingNumber: string | null;
};

/**
 * Loads a receipt.
 *
 * `userId` scopes it to one customer's own orders. The admin calls this
 * without one, having already passed requireAdmin().
 */
export async function getReceipt(
  orderNumber: string,
  userId?: string,
): Promise<Receipt | null> {
  const order = await db.order.findFirst({
    where: { orderNumber, ...(userId ? { userId } : {}) },
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
        // NOTE: costPrice is deliberately absent.
        select: { productName: true, size: true, price: true, quantity: true },
      },
    },
  });

  if (!order) return null;

  const tax = await getTaxSettings();

  const totalPaise = toPaise(order.total.toString());
  const subtotalPaise = toPaise(order.subtotal.toString());
  const shippingPaise = toPaise(order.shippingCharge.toString());
  const taxPaise = toPaise(order.taxAmount.toString());

  return {
    orderNumber: order.orderNumber,
    placedAt: order.createdAt.toISOString(),
    status: order.status,
    paymentMethod: order.paymentMethod,
    shop: {
      name: "Dhanvarsha",
      legalName: tax.legalName,
      gstin: tax.gstin,
    },
    customer: order.user,
    address: order.address,
    lines: order.items.map((item) => {
      const unit = toPaise(item.price.toString());

      return {
        productName: item.productName,
        size: item.size,
        quantity: item.quantity,
        unitFormatted: formatInr(item.price.toString()),
        lineTotalFormatted: formatInr(((unit * item.quantity) / 100).toFixed(2)),
      };
    }),
    subtotalFormatted: formatInr(order.subtotal.toString()),
    shippingFormatted:
      shippingPaise === 0 ? "Free" : formatInr(order.shippingCharge.toString()),
    taxFormatted: taxPaise > 0 ? formatInr(order.taxAmount.toString()) : null,
    // Derived from THIS order's own figures, so an old receipt still
    // describes itself correctly after the shop changes its tax settings.
    taxIncluded: totalPaise === subtotalPaise + shippingPaise,
    totalFormatted: formatInr(order.total.toString()),
    courierName: order.courierName,
    trackingNumber: order.trackingNumber,
  };
}
