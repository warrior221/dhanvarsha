import type { Metadata } from "next";
import { ShippingRulesEditor } from "@/components/admin/shipping-rules-editor";
import { TaxSettingsForm } from "@/components/admin/tax-settings-form";
import { requireAdminPage } from "@/lib/auth-guards";
import { getTaxSettings, listShippingRules } from "@/lib/queries/settings";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default async function AdminSettingsPage() {
  await requireAdminPage();

  const [rules, tax] = await Promise.all([listShippingRules(), getTaxSettings()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          What delivery costs, and how GST is recorded. Changes apply to new
          orders straight away.
        </p>
      </div>

      <ShippingRulesEditor initial={rules} />
      <TaxSettingsForm initial={tax} />
    </div>
  );
}
