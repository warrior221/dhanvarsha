import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/product/product-card";
import { ReviewMarquee } from "@/components/shop/review-marquee";
import { EmptyState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { productCardSelect, toProductCardView } from "@/lib/queries/product";
import { getPublishedShopReviews } from "@/lib/queries/shop-reviews";

export default async function HomePage() {
  const [categories, featuredRows, shopReviews] = await Promise.all([
    db.category.findMany({
      orderBy: { position: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        products: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { images: { orderBy: { position: "asc" }, take: 1, select: { url: true } } },
        },
      },
    }),
    db.product.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: productCardSelect,
    }),
    getPublishedShopReviews(),
  ]);

  const featured = featuredRows.map(toProductCardView);

  return (
    <main>
      <section className="border-b bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:py-24">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            Handpicked sarees, lehengas &amp; suits
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Woven silks, block prints and bridal pieces, chosen one at a time.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/products">Shop the collection</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-xl font-semibold">Shop by type</h2>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {categories.map((category) => {
            const image = category.products[0]?.images[0]?.url ?? null;

            return (
              <Link
                key={category.id}
                href={`/products?category=${category.slug}`}
                className="group relative block aspect-[4/3] overflow-hidden rounded-lg bg-muted"
              >
                {image ? (
                  <Image
                    src={image}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 33vw, 100vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : null}
                <div className="absolute inset-0 bg-black/30 transition-colors group-hover:bg-black/40" />
                <span className="absolute inset-0 flex items-center justify-center text-lg font-medium text-white">
                  {category.name}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">New arrivals</h2>
          <Link href="/products" className="text-sm underline underline-offset-4">
            View all
          </Link>
        </div>

        {featured.length === 0 ? (
          <EmptyState
            title="Nothing in the shop yet"
            description="Products added in the admin will show up here."
          />
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
            {featured.map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index < 4} />
            ))}
          </div>
        )}
      </section>

      {shopReviews.reviews.length > 0 ? (
        <section className="border-t bg-muted/30 py-12">
          <div className="mx-auto max-w-6xl px-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-semibold">What our customers say</h2>
              {shopReviews.average !== null ? (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {shopReviews.average.toFixed(1)}
                  </span>{" "}
                  out of 5 from {shopReviews.count}{" "}
                  {shopReviews.count === 1 ? "review" : "reviews"}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-6">
            <ReviewMarquee reviews={shopReviews.reviews} />
          </div>

          <div className="mx-auto mt-6 max-w-6xl px-4">
            <Link
              href="/reviews"
              className="text-sm underline underline-offset-4"
            >
              Read all reviews, or leave your own
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}
