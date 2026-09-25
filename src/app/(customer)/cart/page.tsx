import type { Metadata } from "next";
import { CartContent } from "./cart-content";

export const metadata: Metadata = {
  title: "Your bag",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Your bag</h1>
      <CartContent />
    </div>
  );
}
