import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { OrderStatusBadge } from "@/components/shared/order-status-badge";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth-guards";
import { listCustomerOrders } from "@/lib/queries/orders";

export const metadata: Metadata = {
  title: "Your orders",
  robots: { index: false, follow: false },
};

const DATE = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function OrdersPage() {
  const user = await requireUser();
  const orders = await listCustomerOrders(user.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Your orders</h1>

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="When you place an order it will appear here with its progress."
          action={
            <Button asChild>
              <Link href="/products">Start shopping</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.orderNumber}>
              <Link
                href={`/account/orders/${order.orderNumber}`}
                className="flex items-center gap-4 rounded-lg border bg-background p-4 transition hover:border-foreground/40"
              >
                <div className="relative size-16 shrink-0 overflow-hidden rounded bg-muted">
                  {order.firstImage ? (
                    <Image
                      src={order.firstImage}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{order.orderNumber}</p>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                    {order.firstProductName}
                    {order.itemCount > 1 ? ` and ${order.itemCount - 1} more` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Placed {DATE.format(new Date(order.placedAt))} ·{" "}
                    {order.paymentMethod === "COD" ? "Cash on delivery" : "Paid online"}
                  </p>
                </div>

                <p className="shrink-0 font-medium tabular-nums">
                  {order.totalFormatted}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
