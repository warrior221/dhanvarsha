import type { Metadata } from "next";
import { WishlistContent } from "./wishlist-content";

export const metadata: Metadata = {
  title: "Wishlist",
  robots: { index: false, follow: false },
};

export default function WishlistPage() {
  return (
    <div className="shell py-8">
      <h1 className="mb-6 text-2xl font-semibold">Wishlist</h1>
      <WishlistContent />
    </div>
  );
}
