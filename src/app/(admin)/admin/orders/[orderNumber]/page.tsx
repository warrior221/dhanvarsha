import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatusControl } from "@/components/admin/order-status-control";
import { orderStatusLabel } from "@/components/shared/order-status-badge";
import { Separator } from "@/components/ui/separator";
import { requireAdminPage } from "@/lib/auth-guards";
import { getAdminOrder } from "@/lib/queries/admin-orders";

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

export default async function AdminOrderDetailPage(
  props: PageProps<"/admin/orders/[orderNumber]">,
) {
  await requireAdminPage();

  const { orderNumber } = await props.params;
  const order = await getAdminOrder(orderNumber);

  if (!order) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/orders"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← All orders
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{order.orderNumber}</h1>
        <p className="text-sm text-muted-foreground">
          Placed {DATE_TIME.format(new Date(order.placedAt))} ·{" "}
          {order.paymentMethod === "COD" ? "Cash on delivery" : "Paid online"}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <OrderStatusControl
            orderId={order.id}
            status={order.status}
            courierName={order.courierName}
            trackingNumber={order.trackingNumber}
          />

          {/* ---------------------- items + profit ---------------------- */}
          <section className="rounded-lg border bg-background p-5">
            <h2 className="mb-4 text-lg font-medium">Items</h2>

            <ul className="divide-y">
              {order.items.map((item, index) => (
                <li key={index} className="flex gap-3 py-3">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded bg-muted">
                    {item.productImage ? (
                      <Image
                        src={item.productImage}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.size ? `Size ${item.size} · ` : ""}
                      {item.priceFormatted} × {item.quantity}
                    </p>
                    {/* Admin only: never rendered on a customer page. */}
                    <p className="text-xs text-muted-foreground">
                      Cost {item.costFormatted} · profit{" "}
                      <span className="text-emerald-700 dark:text-emerald-500">
                        {item.lineProfitFormatted}
                      </span>
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
                <dd className="tabular-nums">{order.subtotalFormatted}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delivery</dt>
                <dd className="tabular-nums">{order.shippingFormatted}</dd>
              </div>
              {order.taxFormatted ? (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    {order.taxIncluded ? "Includes GST" : "GST"}
                  </dt>
                  <dd className="tabular-nums">{order.taxFormatted}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t pt-2 font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{order.totalFormatted}</dd>
              </div>
              <div className="flex justify-between text-emerald-700 dark:text-emerald-500">
                <dt>Profit{order.marginPercent !== null ? ` (${order.marginPercent}%)` : ""}</dt>
                <dd className="font-medium tabular-nums">{order.profitFormatted}</dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border bg-background p-5">
            <h2 className="mb-3 text-lg font-medium">Customer</h2>
            <p className="text-sm font-medium">{order.customer.name}</p>
            <p className="text-sm text-muted-foreground">{order.customer.email}</p>

            <Separator className="my-3" />

            <h3 className="mb-2 text-sm font-medium">Ship to</h3>
            <address className="text-sm not-italic text-muted-foreground">
              {order.address.fullName}
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
              <span className="text-foreground">Phone {order.address.phone}</span>
            </address>
          </section>

          <section className="rounded-lg border bg-background p-5">
            <h2 className="mb-3 text-lg font-medium">History</h2>
            <ol className="space-y-3">
              {order.history.map((entry, index) => (
                <li key={index} className="text-sm">
                  <p className="font-medium">
                    {entry.fromStatus
                      ? `${orderStatusLabel(entry.fromStatus)} → ${orderStatusLabel(entry.toStatus)}`
                      : orderStatusLabel(entry.toStatus)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {DATE_TIME.format(new Date(entry.at))}
                    {entry.by ? ` · ${entry.by}` : ""}
                  </p>
                  {entry.note ? (
                    <p className="text-xs text-muted-foreground">{entry.note}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
