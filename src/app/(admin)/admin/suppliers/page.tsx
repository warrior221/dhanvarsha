import type { Metadata } from "next";
import { SupplierManager } from "@/components/admin/supplier-manager";
import { requireAdminPage } from "@/lib/auth-guards";
import { listSuppliers } from "@/lib/queries/suppliers";

export const metadata: Metadata = {
  title: "Weavers",
  robots: { index: false, follow: false },
};

/**
 * The weavers and sellers the shop buys from.
 *
 * ADMIN ONLY. A supplier's name, number and what they are paid are commercial
 * information of the same class as cost price, and must never reach a customer
 * route or, when Phase 3 lands, a STAFF one.
 */
export default async function AdminSuppliersPage() {
  await requireAdminPage();

  const suppliers = await listSuppliers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Weavers</h1>
        <p className="text-sm text-muted-foreground">
          The people you buy from. Recording them here rather than typing a name
          each time is what lets you see everything one weaver has supplied, and
          what it cost.
        </p>
      </div>

      <SupplierManager initial={suppliers} />
    </div>
  );
}
