import type { Metadata } from "next";
import { ScanOutDesk } from "@/components/admin/scan-out-desk";
import { requireAdminPage } from "@/lib/auth-guards";
import { todaysScans } from "@/lib/queries/scan-out";

export const metadata: Metadata = {
  title: "Scan out",
  robots: { index: false, follow: false },
};

/**
 * The counter desk.
 *
 * Scanning a tag takes one piece out of stock and records who did it and when.
 * It is NOT billing — the bill book is still the bill — and nothing here shows
 * a total, takes a payment or produces a receipt.
 *
 * The piece to watch for is one sold at the counter but never scanned: the
 * website still believes it is in stock and may sell it online a second time.
 * Scanning at the moment the bill is written is what prevents that, and the
 * monthly stock-take (Phase 5) catches the ones that slip through.
 */
export default async function ScanOutPage() {
  await requireAdminPage();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Scan out</h1>
        <p className="text-sm text-muted-foreground">
          Scan a piece as it leaves the shop, at the same moment you write the
          bill. This keeps the website&rsquo;s stock true — it does not bill
          anyone.
        </p>
      </div>

      <ScanOutDesk initialScans={await todaysScans()} />
    </div>
  );
}
