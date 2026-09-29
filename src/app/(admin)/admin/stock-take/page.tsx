import type { Metadata } from "next";
import Link from "next/link";
import { StartCountButton } from "@/components/admin/start-count-button";
import { Badge } from "@/components/ui/badge";
import { requireAdminPage } from "@/lib/auth-guards";
import { listStocktakes, openStocktakeId } from "@/lib/queries/stocktake";

export const metadata: Metadata = {
  title: "Stock-take",
  robots: { index: false, follow: false },
};

const DATE = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Kolkata",
});

const STATUS: Record<string, { label: string; className: string }> = {
  OPEN: { label: "Counting", className: "bg-blue-600 text-white" },
  COUNTED: { label: "Needs review", className: "bg-amber-600 text-white" },
  CLOSED: { label: "Done", className: "bg-muted text-muted-foreground" },
  ABANDONED: { label: "Abandoned", className: "bg-muted text-muted-foreground" },
};

/**
 * Shelf counts.
 *
 * The one thing that finds a saree sold at the counter but never scanned out.
 * Until a count happens the website still believes that piece is in stock and
 * can sell it online a second time, which is the worst thing this shop's system
 * can do to a customer.
 */
export default async function StockTakePage() {
  await requireAdminPage();

  const [counts, openId] = await Promise.all([listStocktakes(), openStocktakeId()]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Stock-take</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Count what is actually on the shelves and compare it with what the
            website thinks. This is how a piece sold at the counter but never
            scanned gets found — before it sells online a second time.
          </p>
        </div>

        {openId ? (
          <Link
            href={`/admin/stock-take/${openId}`}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Carry on counting
          </Link>
        ) : (
          <StartCountButton />
        )}
      </div>

      {counts.length === 0 ? (
        <div className="rounded-lg border bg-background p-8 text-center">
          <p className="font-medium">No count has been done yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Once a month is plenty. It takes as long as walking the shelves.
          </p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-background">
          {counts.map((count) => {
            const status = STATUS[count.status] ?? STATUS.CLOSED;

            return (
              <li key={count.id}>
                <Link
                  href={`/admin/stock-take/${count.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 transition hover:bg-muted/50"
                >
                  <Badge className={status.className}>{status.label}</Badge>

                  <span className="text-sm font-medium">
                    {DATE.format(new Date(count.startedAt))}
                  </span>

                  <span className="text-sm text-muted-foreground">
                    {count.countedPieces} counted
                    {count.startedBy ? ` · ${count.startedBy}` : ""}
                  </span>

                  {count.openDifferences > 0 ? (
                    <span className="ml-auto text-sm font-medium text-amber-700 dark:text-amber-500">
                      {count.openDifferences} to look at
                    </span>
                  ) : null}

                  {count.note ? (
                    <span className="w-full text-sm text-muted-foreground">
                      {count.note}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
