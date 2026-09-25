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
        imageUrl: true,
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
    <div>
      <section className="border-b bg-muted/30">
        <div className="shell py-16 text-center sm:py-24">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
            Handpicked sarees, lehengas &amp; more
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Woven silks, block prints and bridal pieces, chosen one at a time.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/products">Shop the collection</Link>
          </Button>
        </div>
      </section>

      <section className="shell py-12">
        <h2 className="text-xl font-semibold">Shop by type</h2>

        {/*
          * A rail rather than a grid. There are six types now and more will
          * come; stacking them into rows pushes the new arrivals further down
          * the page every time one is added. Scrolling sideways keeps the
          * section one row tall however many there are, and the card clipped
          * at the edge is what tells you to keep going.
          */}
        <div className="no-scrollbar shell-bleed mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto">
          {categories.map((category) => {
            // A tile set on the category itself is a designed picture with the
            // name already lettered into it. Without one we borrow the newest
            // product's photo, which is better than nothing but is a photo of
            // one item rather than of the type.
            const tile = category.imageUrl;
            const image = tile ?? category.products[0]?.images[0]?.url ?? null;

            return (
              <Link
                key={category.id}
                href={`/products?category=${category.slug}`}
                // Silk, not muted grey: a category with nothing in it yet shows no
                // photo, and white on a pale tile is unreadable.
                // Portrait, like the product cards and the wishlist. Clothing is worn
                // standing up, so a landscape crop of a saree is mostly floor and
                // ceiling — and a rail that switches shape halfway down the page
                // looks like two different websites.
                className="group relative block aspect-[2/3] w-64 shrink-0 snap-start overflow-hidden rounded-lg bg-silk"
              >
                {image ? (
                  <Image
                    src={image}
                    alt=""
                    fill
                    sizes="256px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : null}
                {/* A borrowed product photo needs a wash to carry white text.
                    A designed tile does not — dimming it by a third would only
                    dull the artwork — so it darkens on hover alone. */}
                <div
                  className={
                    tile
                      ? "absolute inset-0 transition-colors group-hover:bg-black/15"
                      : "absolute inset-0 bg-black/30 transition-colors group-hover:bg-black/40"
                  }
                />

                {/* The tile already letters the name, so the site does not draw
                    it twice. The link still has to say where it goes, hence the
                    name kept for screen readers. */}
                {tile ? (
                  <span className="sr-only">{category.name}</span>
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-lg font-medium text-white">
                    {category.name}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="shell pb-16">
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
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {featured.map((product, index) => (
              <ProductCard key={product.id} product={product} priority={index < 4} />
            ))}
          </div>
        )}
      </section>

      {shopReviews.reviews.length > 0 ? (
        <section className="border-t bg-muted/30 py-12">
          <div className="shell">
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

          <div className="shell mt-6">
            <Link
              href="/reviews"
              className="text-sm underline underline-offset-4"
            >
              Read all reviews, or leave your own
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
