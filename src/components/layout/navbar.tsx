import { Heart } from "lucide-react";
import Link from "next/link";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/auth-actions";
import { getOptionalUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";

export async function Navbar() {
  const [user, categories] = await Promise.all([
    getOptionalUser(),
    db.category.findMany({
      orderBy: { position: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-sm font-bold tracking-[0.18em] text-primary">
          DHANVARSHA
        </Link>

        <nav aria-label="Categories" className="hidden gap-6 md:flex">
          <Link href="/products" className="text-sm hover:underline">
            All
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/products?category=${category.slug}`}
              className="text-sm hover:underline"
            >
              {category.name}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" aria-label="Wishlist">
            <Link href="/wishlist">
              <Heart className="size-4" aria-hidden />
              <span className="sr-only sm:not-sr-only">Saved</span>
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

      <nav
        aria-label="Categories"
        className="flex gap-4 overflow-x-auto border-t px-4 py-2 md:hidden"
      >
        <Link href="/products" className="whitespace-nowrap text-sm hover:underline">
          All
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/products?category=${category.slug}`}
            className="whitespace-nowrap text-sm hover:underline"
          >
            {category.name}
          </Link>
        ))}
      </nav>
    </header>
  );
}
