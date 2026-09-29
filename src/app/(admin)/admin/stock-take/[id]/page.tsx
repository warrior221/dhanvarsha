import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CountDesk } from "@/components/admin/count-desk";
import { StocktakeReportView } from "@/components/admin/stocktake-report";
import { requireAdminPage } from "@/lib/auth-guards";
import {
  countProgress,
  openCountLines,
  stocktakeReport,
} from "@/lib/queries/stocktake";

export const metadata: Metadata = {
  title: "Stock-take",
  robots: { index: false, follow: false },
};

/**
 * One shelf count, at whichever stage it has reached.
 *
 * While it is OPEN this is a scanning screen. Once counting stops it becomes
 * the report, and stays as the permanent record of what was found afterwards.
 */
export default async function StocktakePage(
  props: PageProps<"/admin/stock-take/[id]">,
) {
  await requireAdminPage();

  // params is a Promise in Next.js 16.
  const { id } = await props.params;

  const report = await stocktakeReport(id);

  if (!report) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/stock-take"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← All counts
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          {report.stocktake.status === "OPEN" ? "Counting the shelves" : "Count report"}
        </h1>
      </div>

      {report.stocktake.status === "OPEN" ? (
        <CountDesk
          stocktakeId={id}
          initialLines={await openCountLines(id)}
          progress={await countProgress(id)}
        />
      ) : (
        <StocktakeReportView report={report} />
      )}
    </div>
  );
}
