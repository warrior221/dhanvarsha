import { StoreHydrator } from "@/components/cart/store-hydrator";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { EMPTY_CART, EMPTY_WISHLIST } from "@/lib/cart";
import { getCart } from "@/lib/queries/cart";
import { getWishlist } from "@/lib/queries/wishlist";
import { resolveShopper } from "@/lib/shopper";

export default async function CustomerLayout({ children }: LayoutProps<"/">) {
  // Read-only: no guest cookie is minted here, because a layout renders as a
  // Server Component and cannot write cookies. The first add-to-bag creates it.
  const shopper = await resolveShopper();

  const [cart, wishlist] = shopper
    ? await Promise.all([getCart(shopper), getWishlist(shopper)])
    : [EMPTY_CART, EMPTY_WISHLIST];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Seeds the client stores so the bag badge is correct on first paint. */}
      <StoreHydrator cart={cart} wishlist={wishlist} />
      <Navbar />
      {/* The single <main> landmark for every customer route. Pages and their
          loading skeletons render only the inside of it, so a streamed-in page
          and its fallback can never leave two <main> elements in the DOM. */}
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
