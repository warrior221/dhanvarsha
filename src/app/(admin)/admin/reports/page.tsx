import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { EmptyState } from "@/components/shared/states";
import { requireAdminPage } from "@/lib/auth-guards";
import { getSalesReport } from "@/lib/queries/reports";
import {
  RANGE_OPTIONS,
  type RangeKey,
  isRangeKey,
  resolveRange,
  shortLabel,
} from "@/lib/reports";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Reports",
  robots: { index: false, follow: false },
};

export default async function AdminReportsPage(props: PageProps<"/admin/reports">) {
  await requireAdminPage();

  const searchParams = await props.searchParams;
  const raw = typeof searchParams.range === "string" ? searchParams.range : null;

  // isRangeKey narrows, so no cast is needed and an unknown ?range= in the
  // URL quietly falls back rather than throwing.
  const key: RangeKey = isRangeKey(raw) ? raw : "30d";
  const range = resolveRange(key);
  const report = await getSalesReport(range);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Cancelled and returned orders are left out — money that came back is
          not revenue. Days run midnight to midnight, Indian time.
        </p>
      </div>

      <nav aria-label="Date range" className="flex flex-wrap gap-2">
        {RANGE_OPTIONS.map((option) => (
          <Link
            key={option.value}
            href={`/admin/reports?range=${option.value}`}
            aria-current={option.value === key ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition",
              option.value === key
                ? "bg-foreground text-background"
                : "bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue" value={report.summary.revenueFormatted} />
        <Stat
          label="Profit"
          value={report.summary.profitFormatted}
          hint={
            report.summary.marginPercent !== null
              ? `${report.summary.marginPercent}% margin`
              : undefined
          }
          tone="good"
        />
        <Stat
          label="Orders"
          value={String(report.summary.orders)}
          hint={`${report.summary.units} ${report.summary.units === 1 ? "piece" : "pieces"} sold`}
        />
        <Stat label="Average order" value={report.summary.averageOrderFormatted} />
      </div>

      {report.summary.orders === 0 ? (
        <EmptyState
          title="No sales in this period"
          description="Try a longer date range, or check back once orders come in."
        />
      ) : (
        <>
          {report.daily.length > 1 ? (
            <section className="rounded-lg border bg-background p-5">
              <h2 className="mb-4 text-lg font-medium">Revenue by day</h2>

              <div className="flex h-40 items-end gap-1" role="img"
                aria-label={`Daily revenue for ${range.label.toLowerCase()}`}>
                {report.daily.map((point) => {
                  // Percentage of the busiest day, so the tallest bar always
                  // fills the chart whatever the shop's scale.
                  const height =
                    report.peakPaise > 0
                      ? Math.max(2, (point.revenuePaise / report.peakPaise) * 100)
                      : 2;

                  return (
                    <div
                      key={point.dateKey}
                      className="group relative flex-1"
                      style={{ height: `${height}%` }}
                      title={`${shortLabel(point.dateKey)}: ${point.revenueFormatted} from ${point.orders} ${point.orders === 1 ? "order" : "orders"}`}
                    >
                      <div
                        className={cn(
                          "size-full rounded-sm transition",
                          point.revenuePaise > 0
                            ? "bg-foreground/80 group-hover:bg-foreground"
                            : "bg-muted",
                        )}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{shortLabel(report.daily[0]!.dateKey)}</span>
                <span>{shortLabel(report.daily[report.daily.length - 1]!.dateKey)}</span>
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border bg-background p-5">
            <h2 className="mb-1 text-lg font-medium">Best sellers</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Which pieces sold, and what each one earned.
            </p>

            <ol className="divide-y">
              {report.bestSellers.map((product, index) => (
                <li key={product.productName} className="flex items-center gap-3 py-3">
                  <span className="w-5 shrink-0 text-sm text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>

                  <div className="relative size-12 shrink-0 overflow-hidden rounded bg-muted">
                    {product.productImage ? (
                      <Image
                        src={product.productImage}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium">
                      {product.productName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {product.units} sold · {product.revenueFormatted}
                    </p>
                  </div>

                  <p className="shrink-0 text-sm font-medium tabular-nums text-emerald-700 dark:text-emerald-500">
                    {product.profitFormatted}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "plain",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "plain";
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-2xl font-semibold tabular-nums",
          tone === "good" && "text-emerald-700 dark:text-emerald-500",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
