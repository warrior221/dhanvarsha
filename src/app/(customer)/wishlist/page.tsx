import type { Metadata } from "next";
import { WishlistContent } from "./wishlist-content";

export const metadata: Metadata = {
  title: "Saved items",
  robots: { index: false, follow: false },
};

export default function WishlistPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Saved items</h1>
      <WishlistContent />
    </main>
  );
}
