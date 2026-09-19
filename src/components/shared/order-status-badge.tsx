import type { OrderStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

/** Plain-language labels; customers should not have to read enum names. */
const LABEL: Record<OrderStatus, string> = {
  PENDING: "Placed",
  CONFIRMED: "Confirmed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
};

const TONE: Record<OrderStatus, string> = {
  PENDING: "border-amber-500 text-amber-700 dark:text-amber-500",
  CONFIRMED: "border-sky-500 text-sky-700 dark:text-sky-400",
  SHIPPED: "border-indigo-500 text-indigo-700 dark:text-indigo-400",
  DELIVERED: "border-emerald-500 text-emerald-700 dark:text-emerald-500",
  CANCELLED: "border-destructive text-destructive",
  RETURNED: "border-muted-foreground text-muted-foreground",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge variant="outline" className={TONE[status]}>
      {LABEL[status]}
    </Badge>
  );
}

export function orderStatusLabel(status: OrderStatus): string {
  return LABEL[status];
}
