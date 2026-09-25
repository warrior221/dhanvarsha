import { PaymentMethod } from "@prisma/client";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-guards";
import { getCart } from "@/lib/queries/cart";
import { listAddresses } from "@/lib/queries/address";
import { computeOrderTotals } from "@/lib/queries/checkout";
import { getPhoneStatus } from "@/lib/queries/customer-phone";
import { CheckoutClient } from "./checkout-client";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  // Checkout is auth-gated (spec section 7): guests may browse and fill a bag,
  // but not check out. proxy.ts already bounced anyone without a cookie; this
  // is the real check.
  const user = await requireUser();

  const [cart, addresses, totals, phone] = await Promise.all([
    getCart({ kind: "user", userId: user.id }),
    listAddresses(user.id),
    computeOrderTotals(user.id, PaymentMethod.COD),
    getPhoneStatus(user.id),
  ]);

  // Nothing to check out.
  if (cart.items.length === 0) redirect("/cart");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Checkout</h1>
      <CheckoutClient
        addresses={addresses}
        cart={cart}
        totals={totals}
        phone={phone}
      />
    </div>
  );
}
