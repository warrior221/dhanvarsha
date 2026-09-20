import type { Metadata } from "next";
import { requireAdminForSetup } from "@/lib/auth-guards";
import { getMfaSetup } from "@/lib/queries/admin-mfa";
import { SecuritySetup } from "./security-setup";

export const metadata: Metadata = {
  title: "Security",
  robots: { index: false, follow: false },
};

/**
 * Setting up the sign-in checks.
 *
 * requireAdminForSetup(), not requireAdminPage(): an admin who has not
 * enrolled yet must be able to reach this page, and one who is mid-ladder
 * must be able to come here to use a different phone.
 */
export default async function AdminSecurityPage() {
  const user = await requireAdminForSetup();
  const setup = await getMfaSetup(user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Security</h1>
        <p className="text-sm text-muted-foreground">
          Extra checks when you sign in to the admin area. Your password alone
          can reach cost prices, supplier names and profit on every order —
          these make sure a stolen password is not enough.
        </p>
      </div>

      <SecuritySetup initial={setup} />
    </div>
  );
}
