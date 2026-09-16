import { ProductGridSkeleton } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";

/** Shown while the catalog server component fetches (spec 1.9). */
export default function ProductsLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Skeleton className="h-8 w-40" />

      <div className="mt-6 lg:grid lg:grid-cols-[16rem_1fr] lg:gap-10">
        <aside className="hidden space-y-6 lg:block">
          {Array.from({ length: 4 }, (_, section) => (
            <div key={section} className="space-y-3">
              <Skeleton className="h-4 w-24" />
              {Array.from({ length: 4 }, (_, row) => (
                <Skeleton key={row} className="h-4 w-32" />
              ))}
            </div>
          ))}
        </aside>

        <div className="space-y-6">
          <div className="flex justify-between gap-3">
            <Skeleton className="h-9 w-full max-w-xs" />
            <Skeleton className="h-9 w-[180px]" />
          </div>
          <ProductGridSkeleton />
        </div>
      </div>
    </main>
  );
}
