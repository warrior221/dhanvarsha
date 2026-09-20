import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ProductRowActions } from "@/components/admin/product-row-actions";
import { EmptyState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdminPage } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { formatInr } from "@/lib/format";
import { LOW_STOCK_THRESHOLD, listAdminProducts } from "@/lib/queries/admin-products";
import { AdminProductFilters } from "@/components/admin/product-filters";

export const metadata: Metadata = {
  title: "Products",
  robots: { index: false, follow: false },
};

export default async function AdminProductsPage(props: PageProps<"/admin/products">) {
  // Guards again even though the layout did: a page that assumes its layout
  // ran is a page that breaks the day the layout moves.
  await requireAdminPage();

  const searchParams = await props.searchParams;
  const first = (key: string): string | null => {
    const value = searchParams[key];
    return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
  };

  const [categories, list] = await Promise.all([
    db.category.findMany({
      orderBy: { position: "asc" },
      select: { id: true, name: true },
    }),
    listAdminProducts({
      q: first("q"),
      categoryId: first("categoryId"),
      status: first("status"),
      lowStockOnly: first("lowStock") === "1",
      page: Number(first("page") ?? "1") || 1,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="text-sm text-muted-foreground">
            {list.total} {list.total === 1 ? "product" : "products"}
          </p>
        </div>

        <Button asChild>
          <Link href="/admin/products/new">Add product</Link>
        </Button>
      </div>

      <AdminProductFilters categories={categories} />

      {list.rows.length === 0 ? (
        <EmptyState
          title="No products match"
          description="Try clearing the filters, or add your first product."
          action={
            <Button asChild>
              <Link href="/admin/products/new">Add product</Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[42%]">Product</TableHead>
                <TableHead className="text-right">MRP</TableHead>
                <TableHead className="text-right">Selling</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {list.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="relative size-12 shrink-0 overflow-hidden rounded bg-muted">
                        {row.imageUrl ? (
                          <Image
                            src={row.imageUrl}
                            alt=""
                            fill
                            sizes="48px"
                            className="object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/admin/products/${row.id}/edit`}
                          className="line-clamp-1 font-medium hover:underline"
                        >
                          {row.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {row.sku} · {row.categoryName}
                          {/* Admin only: supplier lives in the protected cost
                              table, so no customer query can reach it. */}
                          {row.supplierName ? ` · from ${row.supplierName}` : ""}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatInr(row.mrp)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatInr(row.sellingPrice)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.costPrice ? formatInr(row.costPrice) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.marginPercent === null ? (
                      "—"
                    ) : (
                      <span
                        className={
                          row.marginPercent < 20
                            ? "font-medium text-destructive"
                            : "font-medium text-emerald-700 dark:text-emerald-500"
                        }
                      >
                        {row.marginPercent}%
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="text-right tabular-nums">
                    <span
                      className={
                        row.totalStock <= LOW_STOCK_THRESHOLD
                          ? "font-medium text-amber-700 dark:text-amber-500"
                          : undefined
                      }
                    >
                      {row.totalStock}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      / {row.variantCount}
                    </span>
                  </TableCell>

                  <TableCell>
                    <Badge variant={row.isActive ? "secondary" : "outline"}>
                      {row.isActive ? "Live" : "Hidden"}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right">
                    <ProductRowActions
                      id={row.id}
                      name={row.name}
                      isActive={row.isActive}
                    />
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
