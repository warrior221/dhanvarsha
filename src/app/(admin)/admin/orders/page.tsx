import { OrderStatus } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatusBadge } from "@/components/shared/order-status-badge";
import { EmptyState } from "@/components/shared/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdminPage } from "@/lib/auth-guards";
import { listAdminOrders } from "@/lib/queries/admin-orders";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Orders",
  robots: { index: false, follow: false },
};

const DATE = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

const STATUS_TABS = [
  { value: null, label: "All" },
  { value: OrderStatus.PENDING, label: "New" },
  { value: OrderStatus.CONFIRMED, label: "Confirmed" },
  { value: OrderStatus.SHIPPED, label: "Shipped" },
  { value: OrderStatus.DELIVERED, label: "Delivered" },
  { value: OrderStatus.CANCELLED, label: "Cancelled" },
  { value: OrderStatus.RETURNED, label: "Returned" },
] as const;

export default async function AdminOrdersPage(props: PageProps<"/admin/orders">) {
  await requireAdminPage();

  const searchParams = await props.searchParams;
  const first = (key: string): string | null => {
    const value = searchParams[key];
    return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  };

  const activeStatus = first("status");
  const activePayment = first("paymentMethod");

  const list = await listAdminOrders({
    status: activeStatus,
    paymentMethod: activePayment,
    q: first("q"),
    page: Number(first("page") ?? "1") || 1,
  });

  /** Keeps the other filters when one changes. */
  function hrefWith(key: string, value: string | null): string {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === "page" || k === key || v === undefined) continue;
      next.set(k, Array.isArray(v) ? (v[0] ?? "") : v);
    }
    if (value) next.set(key, value);
    const query = next.toString();
    return query ? `/admin/orders?${query}` : "/admin/orders";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Orders</h1>
        <p className="text-sm text-muted-foreground">
          {list.total} {list.total === 1 ? "order" : "orders"}
          {list.counts.PENDING ? ` · ${list.counts.PENDING} waiting to be confirmed` : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => {
          const active = (tab.value ?? null) === (activeStatus ?? null);
          const count = tab.value ? (list.counts[tab.value] ?? 0) : null;

          return (
            <Link
              key={tab.label}
              href={hrefWith("status", tab.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition",
                active
                  ? "bg-foreground text-background"
                  : "bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {count !== null && count > 0 ? (
                <span className="ml-1.5 tabular-nums opacity-70">{count}</span>
              ) : null}
            </Link>
          );
        })}

        <span className="mx-1 h-5 w-px bg-border" aria-hidden />

        {[
          { value: null, label: "Any payment" },
          { value: "COD", label: "Cash on delivery" },
          { value: "PREPAID", label: "Paid online" },
        ].map((option) => {
          const active = (option.value ?? null) === (activePayment ?? null);

          return (
            <Link
              key={option.label}
              href={hrefWith("paymentMethod", option.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition",
                active
                  ? "bg-foreground text-background"
                  : "bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </Link>
          );
        })}
      </div>

      {list.rows.length === 0 ? (
        <EmptyState
          title="No orders here"
          description="Orders will appear as customers place them."
        />
      ) : (
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {list.rows.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Link
                      href={`/admin/orders/${order.orderNumber}`}
                      className="font-medium hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {DATE.format(new Date(order.placedAt))}
                    </p>
                  </TableCell>

                  <TableCell>
                    <p className="text-sm">{order.customerName}</p>
                    <p className="text-xs text-muted-foreground">{order.city}</p>
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {order.paymentMethod === "COD" ? "Cash" : "Online"}
                  </TableCell>

                  <TableCell className="text-right tabular-nums">
                    {order.itemCount}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {order.totalFormatted}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-500">
                    {order.profitFormatted}
                  </TableCell>

                  <TableCell>
                    <OrderStatusBadge status={order.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {list.pageCount > 1 ? (
        <p className="text-sm text-muted-foreground">
          Page {list.page} of {list.pageCount}
        </p>
      ) : null}
    </div>
  );
}
