import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getOptionalUser } from "@/lib/auth-guards";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/**
 * Placeholder dashboard. The real one — revenue, low stock, best sellers —
 * is Phase 8. This exists so the Phase 3 auth gate can be verified.
 *
 * The gate itself lives in layout.tsx, which always wraps this page. Throwing
 * a second time here would log an unhandled error on every unauthorised visit
 * while the layout is already rendering the 403, so this only reads the user
 * for display. API routes still guard themselves with requireAdmin() (spec 6).
 */
export default async function AdminDashboardPage() {
  const admin = await getOptionalUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">
          Signed in as {admin?.name ?? admin?.email ?? "admin"}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nothing here yet</CardTitle>
          <CardDescription>
            Revenue, order counts, low stock and best sellers arrive in Phase 8.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Products, orders and inventory management are built in Phases 7 and 8.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
