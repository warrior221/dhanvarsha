import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderReceipt } from "@/components/shared/order-receipt";
import { PrintButton } from "@/components/shared/print-button";
import { requireUser } from "@/lib/auth-guards";
import { getReceipt } from "@/lib/queries/receipt";

export const metadata: Metadata = {
  title: "Receipt",
  robots: { index: false, follow: false },
};

export default async function CustomerReceiptPage(
  props: PageProps<"/account/orders/[orderNumber]/receipt">,
) {
  const user = await requireUser();
  const { orderNumber } = await props.params;

  // Scoped to this customer, so another person's order number is a 404
  // rather than a look at their address (spec 8.11).
  const receipt = await getReceipt(orderNumber, user.id);

  if (!receipt) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/account/orders/${receipt.orderNumber}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to the order
        </Link>
        <PrintButton />
      </div>

      <OrderReceipt receipt={receipt} />
    </div>
  );
}
