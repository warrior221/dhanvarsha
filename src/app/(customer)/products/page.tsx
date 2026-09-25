import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CatalogToolbar } from "@/components/product/catalog-toolbar";
import { FilterSidebar } from "@/components/product/filter-sidebar";
import { Pagination } from "@/components/product/pagination";
import { ProductCard } from "@/components/product/product-card";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { parseCatalogParams, type SearchParams } from "@/lib/catalog";
import { getCatalogPage, getFilterableAttributes } from "@/lib/queries/catalog";

export const metadata: Metadata = {
  title: "Shop all",
  description:
    "Browse sarees, lehengas, suits, kurta sets, dupattas and crop tops by occasion, fabric and style.",
};

export default async function ProductsPage(props: PageProps<"/products">) {
  // searchParams is a Promise in Next.js 16.
  const searchParams = (await props.searchParams) as SearchParams;

  const [attributes, categories] = await Promise.all([
    getFilterableAttributes(),
    db.category.findMany({
      orderBy: { position: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  // Parsing needs the attribute list, so that only real filter names and real
  // value slugs are honoured.
  const params = parseCatalogParams(searchParams, attributes);
  const { products, total, page, pageCount } = await getCatalogPage(params);

  const hasFilters =
    Boolean(params.categorySlug) ||
    Boolean(params.q) ||
    Boolean(params.minPrice) ||
    Boolean(params.maxPrice) ||
    Object.keys(params.attributeFilters).length > 0;

  return (
    <div className="shell py-8">
      <h1 className="text-2xl font-semibold">Shop all</h1>

      <div className="mt-6 lg:grid lg:grid-cols-[16rem_1fr] lg:gap-10">
        <aside className="hidden lg:block">
          <Suspense fallback={null}>
            <FilterSidebar attributes={attributes} categories={categories} />
          </Suspense>
        </aside>

        <div className="space-y-6">
          <Suspense fallback={null}>
            <CatalogToolbar
              attributes={attributes}
              categories={categories}
              total={total}
            />
          </Suspense>

          {products.length === 0 ? (
            <EmptyState
              title={hasFilters ? "No products match those filters" : "Nothing here yet"}
              description={
                hasFilters
                  ? "Try removing a filter or widening the price range."
                  : "Products added in the admin will appear here."
              }
              action={
                hasFilters ? (
                  <Button asChild variant="outline">
                    <Link href="/products">Clear all filters</Link>
                  </Button>
                ) : null
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {products.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    priority={index < 4}
                  />
                ))}
              </div>

              <Pagination
                page={page}
                pageCount={pageCount}
                searchParams={searchParams}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
