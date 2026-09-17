import Image from "next/image";
import Link from "next/link";
import { WishlistHeart } from "@/components/product/wishlist-heart";
import { Price } from "@/components/shared/price";
import type { ProductCardView } from "@/lib/queries/product";

export function ProductCard({
  product,
  priority = false,
}: {
  product: ProductCardView;
  priority?: boolean;
}) {
  const soldOut = product.totalStock <= 0;

  return (
    <article className="group relative">
      <WishlistHeart productId={product.id} productName={product.name} />

      <Link href={`/products/${product.slug}`} className="block focus:outline-none">
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted">
          {product.image ? (
            <Image
              src={product.image.url}
              alt={product.image.altText}
              fill
              // Two across on phones, up to four on a wide screen.
              sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, 50vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              priority={priority}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No photo yet
            </div>
          )}

          {soldOut ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <span className="rounded-full bg-background px-3 py-1 text-xs font-medium tracking-wide">
                Sold out
              </span>
            </div>
          ) : null}
        </div>

        <div className="mt-3 space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {product.category.name}
          </p>
          <h3 className="line-clamp-2 text-sm font-medium group-hover:underline group-focus-visible:underline">
            {product.name}
          </h3>
          <Price mrp={product.mrp} sellingPrice={product.sellingPrice} />
        </div>
      </Link>
    </article>
  );
}
