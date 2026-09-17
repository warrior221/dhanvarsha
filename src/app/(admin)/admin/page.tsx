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
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { LOW_STOCK_THRESHOLD } from "@/lib/queries/admin-products";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();

  const [products, live, attributes, outOfStock, lowStock] = await Promise.all([
    db.product.count(),
    db.product.count({ where: { isActive: true } }),
    db.attributeValue.count(),
    db.productVariant.count({ where: { stockQty: 0 } }),
    db.productVariant.count({
      where: { stockQty: { gt: 0, lte: LOW_STOCK_THRESHOLD } },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">
          Signed in as {admin.name ?? admin.email}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Products" value={products} hint={`${live} visible in the shop`} />
        <Stat label="Filter options" value={attributes} hint="Across all attributes" />
        <Stat
          label="Out of stock"
          value={outOfStock}
          hint="Sizes at zero"
          tone={outOfStock > 0 ? "danger" : "plain"}
        />
        <Stat
          label="Low stock"
          value={lowStock}
          hint={`${LOW_STOCK_THRESHOLD} or fewer left`}
          tone={lowStock > 0 ? "warn" : "plain"}
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
            <CardTitle>Sales figures</CardTitle>
            <CardDescription>
              Revenue, order counts, best sellers and profit reporting.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              These arrive once checkout and orders are built, since there is
              nothing to report on until orders exist.
            </p>
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
