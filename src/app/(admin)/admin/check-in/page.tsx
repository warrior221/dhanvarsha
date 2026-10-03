import type { Metadata } from "next";
import { CheckInTabs } from "@/components/admin/check-in-tabs";
import { PurchaseForm } from "@/components/admin/purchase-form";
import { RestockForm } from "@/components/admin/restock-form";
import { requireAdminPage } from "@/lib/auth-guards";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Check in stock",
  robots: { index: false, follow: false },
};

/**
 * Recording a delivery.
 *
 * The screen that turns a pile of sarees on the counter into stock the system
 * knows about. Everything here is admin-only: it writes cost prices, names the
 * weaver, and moves stock.
 */
export default async function CheckInPage() {
  await requireAdminPage();

  const categories = await db.category.findMany({
    orderBy: { position: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Check in stock</h1>
        <p className="text-sm text-muted-foreground">
          What arrived, from whom, and what it cost. Pieces go straight into
          stock but stay off the shop until you price them.
        </p>
      </div>

      <CheckInTabs
        newDesign={<PurchaseForm categories={categories} />}
        restock={<RestockForm />}
      />
    </div>
  );
}
