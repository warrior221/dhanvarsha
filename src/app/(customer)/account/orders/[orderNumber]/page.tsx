import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  OrderStatusBadge,
  orderStatusLabel,
} from "@/components/shared/order-status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { requireUser } from "@/lib/auth-guards";
import { formatInr, toPaise } from "@/lib/format";
import { getCustomerOrder, type OrderDetailView } from "@/lib/queries/orders";

export const metadata: Metadata = {
  title: "Order",
  robots: { index: false, follow: false },
};

const DATE_TIME = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function OrderDetailPage(
  props: PageProps<"/account/orders/[orderNumber]">,
) {
  const user = await requireUser();

  // params and searchParams are Promises in Next.js 16.
  const [{ orderNumber }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);

  // Scoped to this user, so someone else's order number is a 404 rather than
  // a peek at their address (spec 8.11).
  const order = await getCustomerOrder(user.id, orderNumber);

  if (!order) notFound();

  const justPlaced = searchParams.placed === "1";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/account/orders"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← All orders
      </Link>

      {justPlaced ? (
        <Alert className="mt-4" role="status">
          <AlertDescription>
            <strong>Thank you — your order is placed.</strong> We will confirm it
            shortly and email you when it ships. Please keep{" "}
            {formatInr(order.total)} ready in cash for the courier.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{order.orderNumber}</h1>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="text-sm text-muted-foreground">
        Placed {DATE_TIME.format(new Date(order.placedAt))} ·{" "}
        {order.paymentMethod === "COD" ? "Cash on delivery" : "Paid online"}
      </p>

      <Link
        href={`/account/orders/${order.orderNumber}/receipt`}
        className="mt-2 inline-block text-sm font-medium underline underline-offset-4"
      >
        View receipt
      </Link>

      {order.trackingNumber ? (
        <div className="mt-4 rounded-lg border bg-background p-4 text-sm">
          <p className="font-medium">On its way</p>
          <p className="text-muted-foreground">
            {order.courierName} · Tracking number{" "}
            <span className="font-mono">{order.trackingNumber}</span>
          </p>
        </div>
      ) : null}

      <section className="mt-6 rounded-lg border bg-background p-5">
        <h2 className="mb-4 text-lg font-medium">Items</h2>

        <ul className="divide-y">
          {order.items.map((item, index) => (
            <li key={`${item.productName}-${index}`} className="flex gap-3 py-3">
              <div className="relative size-16 shrink-0 overflow-hidden rounded bg-muted">
                {item.productImage ? (
                  <Image
                    src={item.productImage}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.size ? `Size ${item.size} · ` : ""}
                  {formatInr(item.price)} × {item.quantity}
                </p>
              </div>
              <p className="shrink-0 text-sm tabular-nums">
                {item.lineTotalFormatted}
              </p>
            </li>
          ))}
        </ul>

        <Separator className="my-4" />

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{formatInr(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Delivery</dt>
            <dd className="tabular-nums">
              {toPaise(order.shippingCharge) === 0
                ? "Free"
                : formatInr(order.shippingCharge)}
            </dd>
          </div>
          {/* Compared in paise: Prisma renders zero as "0", not "0.00". */}
          {toPaise(order.taxAmount) > 0 ? (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                {taxWasIncluded(order) ? "Includes GST" : "GST"}
              </dt>
              <dd className="tabular-nums">{formatInr(order.taxAmount)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatInr(order.total)}</dd>
          </div>
        </dl>
      </section>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section className="rounded-lg border bg-background p-5">
          <h2 className="mb-3 text-lg font-medium">Delivering to</h2>
          <address className="text-sm not-italic text-muted-foreground">
            <span className="font-medium text-foreground">
              {order.address.fullName}
            </span>
            <br />
            {order.address.line1}
            {order.address.line2 ? (
              <>
                <br />
                {order.address.line2}
              </>
            ) : null}
            <br />
            {order.address.city}, {order.address.state} {order.address.pincode}
            <br />
            Phone {order.address.phone}
          </address>
        </section>

        <section className="rounded-lg border bg-background p-5">
          <h2 className="mb-3 text-lg font-medium">Progress</h2>
          <ol className="space-y-3">
            {order.history.map((entry, index) => (
              <li key={index} className="text-sm">
                <p className="font-medium">{orderStatusLabel(entry.toStatus)}</p>
                <p className="text-xs text-muted-foreground">
                  {DATE_TIME.format(new Date(entry.at))}
                </p>
                {entry.note ? (
                  <p className="text-xs text-muted-foreground">{entry.note}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}

/**
 * Whether the GST on this order sat inside the prices or was added on top.
 *
 * Derived from the figures the order was placed with rather than from today's
 * settings, so an old order still describes itself correctly after the shop
 * changes how it handles tax.
 */
function taxWasIncluded(order: OrderDetailView): boolean {
  return (
    toPaise(order.total) === toPaise(order.subtotal) + toPaise(order.shippingCharge)
  );
}
