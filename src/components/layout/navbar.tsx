import { Heart } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { Logo } from "@/components/layout/logo";
import { SearchBox } from "@/components/layout/search-box";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/auth-actions";
import { getOptionalUser } from "@/lib/auth-guards";

export async function Navbar() {
  const user = await getOptionalUser();

  return (
    <header className="silk-bar sticky top-0 z-40 border-b print:hidden">
      <div className="shell flex items-center justify-between gap-4 py-3">
        <Logo tone="silk" />

        {/* useSearchParams needs a Suspense boundary in Next 16. */}
        <Suspense fallback={null}>
          <SearchBox className="hidden w-full max-w-xs lg:block" />
        </Suspense>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" aria-label="Wishlist">
            <Link href="/wishlist">
              <Heart className="size-4" aria-hidden />
              <span className="sr-only sm:not-sr-only">Wishlist</span>
            </Link>
          </Button>

          <CartDrawer />

          {user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/account">Account</Link>
              </Button>
              {user.role === "ADMIN" ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin">Admin</Link>
                </Button>
              ) : null}
              <form action={logoutAction}>
                <Button type="submit" variant="outline" size="sm">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="border-t px-4 py-2 lg:hidden">
        <Suspense fallback={null}>
          <SearchBox />
        </Suspense>
      </div>
    </header>
  );
}
