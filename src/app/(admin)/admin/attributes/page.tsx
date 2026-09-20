import type { Metadata } from "next";
import { AttributeManager } from "@/components/admin/attribute-manager";
import { requireAdminPage } from "@/lib/auth-guards";
import { listAdminAttributes } from "@/lib/queries/admin-attributes";

export const metadata: Metadata = {
  title: "Attributes",
  robots: { index: false, follow: false },
};

export default async function AdminAttributesPage() {
  await requireAdminPage();

  const attributes = await listAdminAttributes();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Attributes</h1>
        <p className="text-sm text-muted-foreground">
          Anything you add here becomes a filter customers can use, with no code
          change. You can also add options straight from the product form.
        </p>
      </div>

      <AttributeManager attributes={attributes} />
    </div>
  );
}
