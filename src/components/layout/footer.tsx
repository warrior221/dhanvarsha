import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { SilkMark } from "@/components/shop/silk-mark";

export function Footer() {
  return (
    <footer className="mt-16 border-t print:hidden">
      <div className="shell flex flex-col gap-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <Logo />

        {/* The home page only links to reviews once some exist, which is
            exactly backwards: a shop with none is the one that needs the
            page reachable. So it lives here too, always. */}
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/products" className="hover:text-foreground hover:underline">
            Shop
          </Link>
          <Link href="/reviews" className="hover:text-foreground hover:underline">
            Reviews
          </Link>
          <Link href="/account/orders" className="hover:text-foreground hover:underline">
            My orders
          </Link>
        </nav>

        {/* Shop-level membership, which is what the mark means down here.
            Whether an individual piece is certified is a separate claim and
            is made on that product, not on every page. */}
        <div className="flex items-center gap-3">
          <SilkMark size={44} label="Silk Mark Organisation of India — member" />
          <p>© {new Date().getFullYear()} Dhanvarsha. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
