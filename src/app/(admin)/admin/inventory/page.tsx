import type { Metadata } from "next";
import Link from "next/link";
import { StockCell } from "@/components/admin/stock-cell";
import { EmptyState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { LOW_STOCK_THRESHOLD } from "@/lib/queries/admin-products";

export const metadata: Metadata = {
  title: "Inventory",
  robots: { index: false, follow: false },
};

export default async function AdminInventoryPage() {
  await requireAdmin();

  const variants = await db.productVariant.findMany({
    orderBy: [{ stockQty: "asc" }, { sku: "asc" }],
    select: {
      id: true,
      sku: true,
      size: true,
      stockQty: true,
      product: {
        select: { id: true, name: true, sku: true, isActive: true },
      },
    },
  });

  const outOfStock = variants.filter((v) => v.stockQty === 0).length;
  const low = variants.filter(
    (v) => v.stockQty > 0 && v.stockQty <= LOW_STOCK_THRESHOLD,
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="text-sm text-muted-foreground">
          {variants.length} sizes across all products. Sorted lowest stock first.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <SummaryCard label="Out of stock" value={outOfStock} tone="danger" />
        <SummaryCard
          label={`Low (${LOW_STOCK_THRESHOLD} or fewer)`}
          value={low}
          tone="warn"
        />
        <SummaryCard label="Total sizes" value={variants.length} tone="plain" />
      </div>

      {variants.length === 0 ? (
        <EmptyState
          title="Nothing to track yet"
          description="Add a product and its sizes will show up here."
        />
      ) : (
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Size SKU</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Stock</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {variants.map((variant) => (
                <TableRow key={variant.id}>
                  <TableCell>
                    <Link
                      href={`/admin/products/${variant.product.id}/edit`}
                      className="font-medium hover:underline"
                    >
                      {variant.product.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {variant.product.sku}
                      {variant.product.isActive ? "" : " · hidden"}
                    </p>
                  </TableCell>

                  <TableCell>{variant.size ?? "Free Size"}</TableCell>
                  <TableCell className="text-muted-foreground">{variant.sku}</TableCell>

                  <TableCell>
                    {variant.stockQty === 0 ? (
                      <Badge variant="destructive">Out of stock</Badge>
                    ) : variant.stockQty <= LOW_STOCK_THRESHOLD ? (
                      <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-500">
                        Low
                      </Badge>
                    ) : (
                      <Badge variant="secondary">In stock</Badge>
                    )}
                  </TableCell>

                  <TableCell>
                    <StockCell
                      variantId={variant.id}
                      stockQty={variant.stockQty}
                      label={`${variant.product.name}, size ${variant.size ?? "Free Size"}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "danger" | "warn" | "plain";
}) {
  const colour =
    tone === "danger"
      ? "text-destructive"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-500"
        : "text-foreground";

  return (
    <div className="min-w-36 rounded-lg border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${colour}`}>{value}</p>
    </div>
  );
}
