import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdminPage } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { formatInr } from "@/lib/format";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  const admin = await requireAdminPage();

  const [products, live, soldOut, piecesInStock, newOrders, revenue] =
    await Promise.all([
      db.product.count(),
      db.product.count({ where: { isActive: true } }),
      db.productVariant.count({ where: { stockQty: 0 } }),
      // Pieces actually on the shelf. More useful than a "low stock" warning
      // in a shop where one or two of a piece IS the normal holding, and a
      // threshold alert would simply fire on everything, forever.
      db.productVariant.aggregate({ _sum: { stockQty: true } }),
      db.order.count({ where: { status: "PENDING" } }),
      // Revenue excludes cancelled and returned orders — money that came back
      // is not revenue.
      db.order.aggregate({
        _sum: { total: true },
        where: { status: { notIn: ["CANCELLED", "RETURNED"] } },
      }),
    ]);

  const revenueTotal = revenue._sum.total?.toString() ?? "0.00";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">
          Signed in as {admin.name ?? admin.email}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="New orders"
          value={newOrders}
          hint="Waiting to be confirmed"
          tone={newOrders > 0 ? "warn" : "plain"}
        />
        <Stat label="Products" value={products} hint={`${live} visible in the shop`} />
        {/* Sold out is NOT an alarm here: a one-of-a-kind piece selling is
            the point. It is shown plainly, in the ordinary colour. */}
        <Stat label="Sold out" value={soldOut} hint="Pieces that have gone" />
        <Stat
          label="Pieces in stock"
          value={piecesInStock._sum.stockQty ?? 0}
          hint="Across every size"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add your stock</CardTitle>
            <CardDescription>
              Create products with photos, sizes, prices and cost price.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild>
              <Link href="/admin/products/new">Add product</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/products">All products</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders</CardTitle>
            <CardDescription>
              {formatInr(revenueTotal)} taken so far, excluding cancellations
              and returns.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild>
              <Link href="/admin/orders?status=PENDING">
                {newOrders > 0 ? `Confirm ${newOrders} new` : "New orders"}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/orders">All orders</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "plain",
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "danger" | "warn" | "plain";
}) {
  const colour =
    tone === "danger"
      ? "text-destructive"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-500"
        : "text-foreground";

  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-3xl font-semibold tabular-nums ${colour}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
