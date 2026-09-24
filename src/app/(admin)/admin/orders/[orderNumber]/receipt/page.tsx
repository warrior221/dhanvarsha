import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderReceipt } from "@/components/shared/order-receipt";
import { PrintButton } from "@/components/shared/print-button";
import { requireAdminPage } from "@/lib/auth-guards";
import { getReceipt } from "@/lib/queries/receipt";

export const metadata: Metadata = {
  title: "Receipt",
  robots: { index: false, follow: false },
};

/**
 * The shop's copy — deliberately the SAME document the customer sees.
 *
 * It carries no cost price or margin: this is the sheet that goes into the
 * parcel, and the two copies have to match to be reconcilable over the phone.
 */
export default async function AdminReceiptPage(
  props: PageProps<"/admin/orders/[orderNumber]/receipt">,
) {
  await requireAdminPage();

  const { orderNumber } = await props.params;
  const receipt = await getReceipt(orderNumber);

  if (!receipt) notFound();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/admin/orders/${receipt.orderNumber}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back to the order
        </Link>
        <PrintButton label="Print for the parcel" />
      </div>

      <OrderReceipt receipt={receipt} />
    </div>
  );
}
