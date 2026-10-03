import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { requireAdminPage } from "@/lib/auth-guards";
import { formatInr } from "@/lib/format";
import { listAdminProducts } from "@/lib/queries/admin-products";

export const metadata: Metadata = {
  title: "Waiting to be priced",
  robots: { index: false, follow: false },
};

const ADDED = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

/**
 * Pieces entered but not yet priced.
 *
 * Their own list, not a filter on the catalogue: with ten thousand pieces to
 * tag gradually, unpriced stock would bury everything else in Products.
 *
 * Nothing here is visible to a customer. The one exception is a shopper who
 * had already saved the piece — a wishlist never drops anything — and they see
 * it marked "Not available" with no price and no way to buy.
 *
 * Pricing IS the approval. There is no second step: give a piece an MRP and a
 * selling price and it goes on the shop.
 */
export default async function UnpricedProductsPage(
  props: PageProps<"/admin/products/unpriced">,
) {
  await requireAdminPage();

  const searchParams = await props.searchParams;
  const pageParam = Array.isArray(searchParams.page)
    ? searchParams.page[0]
    : searchParams.page;

  const list = await listAdminProducts({
    pricing: "unpriced",
    page: Number(pageParam ?? "1") || 1,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Waiting to be priced</h1>
          <p className="text-sm text-muted-foreground">
            {list.total} {list.total === 1 ? "piece is" : "pieces are"} in stock
            but not on the shop. Giving a piece an MRP and a selling price puts
            it on sale.
          </p>
        </div>

        <Button asChild variant="outline">
          <Link href="/admin/products">All products</Link>
        </Button>
      </div>

      {list.rows.length === 0 ? (
        <EmptyState
          title="Nothing waiting"
          description="Every piece you have entered has a price and is on the shop."
        />
      ) : (
        <ul className="divide-y rounded-lg border bg-background">
          {list.rows.map((product) => (
            <li
              key={product.id}
              className="flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap"
            >
              <div className="relative size-16 shrink-0 overflow-hidden rounded bg-muted">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{product.name}</p>
                <p className="text-xs text-muted-foreground">
                  {product.categoryName} · {product.code ?? "no code"} · added{" "}
                  {ADDED.format(new Date(product.createdAt))}
                </p>
              </div>

              <div className="text-right text-sm">
                {/* Cost is what the owner needs in front of them to decide a
                    price. It is admin-only and never leaves this area. */}
                <p className="tabular-nums">
                  {product.costPrice ? (
                    <>
                      Cost{" "}
                      <span className="font-medium text-foreground">
                        {formatInr(product.costPrice)}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">No cost recorded</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {product.totalStock} in stock
                </p>
              </div>

              <Button asChild size="sm" className="shrink-0">
                <Link href={`/admin/products/${product.id}`}>Set price</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
